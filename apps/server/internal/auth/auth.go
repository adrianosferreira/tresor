package auth

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tresor/tresor/internal/models"
)

var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrEmailTaken = errors.New("email already registered")

type Service struct {
	pool      *pgxpool.Pool
	jwtSecret []byte
}

func NewService(pool *pgxpool.Pool, jwtSecret string) *Service {
	return &Service{pool: pool, jwtSecret: []byte(jwtSecret)}
}

type RegisterInput struct {
	Email             string
	KdfSalt           []byte
	KdfParams         models.KdfParams
	EncryptedVaultKey []byte
	VaultKeyNonce     []byte
	AuthKeyHash       []byte
}

type AuthUserResponse struct {
	ID                uuid.UUID          `json:"id"`
	Email             string             `json:"email"`
	KdfSalt           string             `json:"kdfSalt"`
	KdfParams         models.KdfParams   `json:"kdfParams"`
	EncryptedVaultKey models.EncryptedBlob `json:"encryptedVaultKey"`
}

type AuthResponse struct {
	Token string           `json:"token"`
	User  AuthUserResponse `json:"user"`
}

type claims struct {
	UserID uuid.UUID `json:"userId"`
	Email  string    `json:"email"`
	jwt.RegisteredClaims
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (*AuthResponse, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, input.Email).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check email: %w", err)
	}
	if exists {
		return nil, ErrEmailTaken
	}

	userID := uuid.New()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO users (
			id, email, kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism, kdf_hash_length,
			encrypted_vault_key, vault_key_nonce, auth_key_hash
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, userID, input.Email, input.KdfSalt,
		input.KdfParams.MemoryKiB, input.KdfParams.Iterations, input.KdfParams.Parallelism, input.KdfParams.HashLength,
		input.EncryptedVaultKey, input.VaultKeyNonce, input.AuthKeyHash,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}

	token, err := s.issueToken(userID, input.Email)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User: AuthUserResponse{
			ID:        userID,
			Email:     input.Email,
			KdfSalt:   base64.StdEncoding.EncodeToString(input.KdfSalt),
			KdfParams: input.KdfParams,
			EncryptedVaultKey: models.EncryptedBlob{
				Ciphertext: base64.StdEncoding.EncodeToString(input.EncryptedVaultKey),
				Nonce:      base64.StdEncoding.EncodeToString(input.VaultKeyNonce),
			},
		},
	}, nil
}

func (s *Service) Login(ctx context.Context, email string, authKeyProof []byte) (*AuthResponse, error) {
	var user models.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism, kdf_hash_length,
		       encrypted_vault_key, vault_key_nonce, auth_key_hash
		FROM users WHERE email = $1
	`, email).Scan(
		&user.ID, &user.Email, &user.KdfSalt,
		&user.KdfParams.MemoryKiB, &user.KdfParams.Iterations, &user.KdfParams.Parallelism, &user.KdfParams.HashLength,
		&user.EncryptedVaultKey, &user.VaultKeyNonce, &user.AuthKeyHash,
	)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if subtle.ConstantTimeCompare(user.AuthKeyHash, authKeyProof) != 1 {
		return nil, ErrInvalidCredentials
	}

	token, err := s.issueToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User: AuthUserResponse{
			ID:        user.ID,
			Email:     user.Email,
			KdfSalt:   base64.StdEncoding.EncodeToString(user.KdfSalt),
			KdfParams: user.KdfParams,
			EncryptedVaultKey: models.EncryptedBlob{
				Ciphertext: base64.StdEncoding.EncodeToString(user.EncryptedVaultKey),
				Nonce:      base64.StdEncoding.EncodeToString(user.VaultKeyNonce),
			},
		},
	}, nil
}

func (s *Service) issueToken(userID uuid.UUID, email string) (string, error) {
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
		},
	})
	return token.SignedString(s.jwtSecret)
}

func (s *Service) ParseToken(tokenString string) (*claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	c, ok := token.Claims.(*claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return c, nil
}

func DecodeBase64(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

type LookupResponse struct {
	KdfSalt   string           `json:"kdfSalt"`
	KdfParams models.KdfParams `json:"kdfParams"`
}

func (s *Service) Lookup(ctx context.Context, email string) (*LookupResponse, error) {
	var user models.User
	err := s.pool.QueryRow(ctx, `
		SELECT kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism, kdf_hash_length
		FROM users WHERE email = $1
	`, email).Scan(
		&user.KdfSalt,
		&user.KdfParams.MemoryKiB, &user.KdfParams.Iterations,
		&user.KdfParams.Parallelism, &user.KdfParams.HashLength,
	)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	return &LookupResponse{
		KdfSalt:   base64.StdEncoding.EncodeToString(user.KdfSalt),
		KdfParams: user.KdfParams,
	}, nil
}
