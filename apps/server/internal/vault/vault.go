package vault

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tresor/tresor/internal/models"
)

var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func blobFromRow(ciphertext, nonce []byte) models.EncryptedBlob {
	return models.EncryptedBlob{
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
	}
}

func decodeBlob(blob models.EncryptedBlob) (ciphertext, nonce []byte, err error) {
	ciphertext, err = base64.StdEncoding.DecodeString(blob.Ciphertext)
	if err != nil {
		return nil, nil, fmt.Errorf("ciphertext: %w", err)
	}
	nonce, err = base64.StdEncoding.DecodeString(blob.Nonce)
	if err != nil {
		return nil, nil, fmt.Errorf("nonce: %w", err)
	}
	return ciphertext, nonce, nil
}

func (s *Service) ListProjects(ctx context.Context, userID uuid.UUID) ([]models.Project, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name_ciphertext, name_nonce, sort_order, created_at, updated_at
		FROM projects WHERE user_id = $1 ORDER BY sort_order, created_at
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.NameCiphertext, &p.NameNonce, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.NameEncrypted = blobFromRow(p.NameCiphertext, p.NameNonce)
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *Service) CreateProject(ctx context.Context, userID uuid.UUID, name models.EncryptedBlob, sortOrder int) (*models.Project, error) {
	ct, nonce, err := decodeBlob(name)
	if err != nil {
		return nil, err
	}

	id := uuid.New()
	now := time.Now()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO projects (id, user_id, name_ciphertext, name_nonce, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, userID, ct, nonce, sortOrder, now, now)
	if err != nil {
		return nil, err
	}

	return &models.Project{
		ID:             id,
		NameCiphertext: ct,
		NameNonce:      nonce,
		NameEncrypted:  name,
		SortOrder:      sortOrder,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func (s *Service) DeleteProject(ctx context.Context, userID, projectID uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1 AND user_id = $2`, projectID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) verifyProjectOwner(ctx context.Context, userID, projectID uuid.UUID) error {
	var owner uuid.UUID
	err := s.pool.QueryRow(ctx, `SELECT user_id FROM projects WHERE id = $1`, projectID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if owner != userID {
		return ErrForbidden
	}
	return nil
}

func (s *Service) ListCategories(ctx context.Context, userID, projectID uuid.UUID) ([]models.Category, error) {
	if err := s.verifyProjectOwner(ctx, userID, projectID); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name_ciphertext, name_nonce, sort_order, created_at, updated_at
		FROM categories WHERE project_id = $1 ORDER BY sort_order, created_at
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.NameCiphertext, &c.NameNonce, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.NameEncrypted = blobFromRow(c.NameCiphertext, c.NameNonce)
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func (s *Service) CreateCategory(ctx context.Context, userID, projectID uuid.UUID, name models.EncryptedBlob, sortOrder int) (*models.Category, error) {
	if err := s.verifyProjectOwner(ctx, userID, projectID); err != nil {
		return nil, err
	}

	ct, nonce, err := decodeBlob(name)
	if err != nil {
		return nil, err
	}

	id := uuid.New()
	now := time.Now()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO categories (id, project_id, name_ciphertext, name_nonce, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, projectID, ct, nonce, sortOrder, now, now)
	if err != nil {
		return nil, err
	}

	return &models.Category{
		ID:             id,
		ProjectID:      projectID,
		NameCiphertext: ct,
		NameNonce:      nonce,
		NameEncrypted:  name,
		SortOrder:      sortOrder,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func (s *Service) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	if err := s.verifyCategoryOwner(ctx, userID, categoryID); err != nil {
		return err
	}

	tag, err := s.pool.Exec(ctx, `DELETE FROM categories WHERE id = $1`, categoryID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) verifyCategoryOwner(ctx context.Context, userID, categoryID uuid.UUID) error {
	var owner uuid.UUID
	err := s.pool.QueryRow(ctx, `
		SELECT p.user_id FROM categories c
		JOIN projects p ON p.id = c.project_id
		WHERE c.id = $1
	`, categoryID).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if owner != userID {
		return ErrForbidden
	}
	return nil
}

func (s *Service) ListSecrets(ctx context.Context, userID, categoryID uuid.UUID) ([]models.Secret, error) {
	if err := s.verifyCategoryOwner(ctx, userID, categoryID); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, category_id, alias, title_ciphertext, title_nonce, payload_ciphertext, payload_nonce, version, created_at, updated_at
		FROM secrets WHERE category_id = $1 ORDER BY updated_at DESC
	`, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []models.Secret
	for rows.Next() {
		var sec models.Secret
		if err := rows.Scan(
			&sec.ID, &sec.CategoryID, &sec.Alias, &sec.TitleCiphertext, &sec.TitleNonce,
			&sec.PayloadCiphertext, &sec.PayloadNonce, &sec.Version, &sec.CreatedAt, &sec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		sec.TitleEncrypted = blobFromRow(sec.TitleCiphertext, sec.TitleNonce)
		sec.PayloadEncrypted = blobFromRow(sec.PayloadCiphertext, sec.PayloadNonce)
		secrets = append(secrets, sec)
	}
	return secrets, rows.Err()
}

func (s *Service) CreateSecret(ctx context.Context, userID, categoryID uuid.UUID, title, payload models.EncryptedBlob, alias *string) (*models.Secret, error) {
	if err := s.verifyCategoryOwner(ctx, userID, categoryID); err != nil {
		return nil, err
	}

	var normalizedAlias *string
	if alias != nil && *alias != "" {
		n := normalizeAlias(*alias)
		if err := validateAlias(n); err != nil {
			return nil, err
		}
		taken, err := s.aliasInUse(ctx, userID, n, nil)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, ErrAliasTaken
		}
		normalizedAlias = &n
	}

	titleCT, titleNonce, err := decodeBlob(title)
	if err != nil {
		return nil, err
	}
	payloadCT, payloadNonce, err := decodeBlob(payload)
	if err != nil {
		return nil, err
	}

	id := uuid.New()
	now := time.Now()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO secrets (id, category_id, alias, title_ciphertext, title_nonce, payload_ciphertext, payload_nonce, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
	`, id, categoryID, normalizedAlias, titleCT, titleNonce, payloadCT, payloadNonce, now, now)
	if err != nil {
		return nil, err
	}

	return &models.Secret{
		ID:                id,
		CategoryID:        categoryID,
		Alias:             normalizedAlias,
		TitleCiphertext:   titleCT,
		TitleNonce:        titleNonce,
		TitleEncrypted:    title,
		PayloadCiphertext: payloadCT,
		PayloadNonce:      payloadNonce,
		PayloadEncrypted:  payload,
		Version:           1,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func (s *Service) GetSecretByAlias(ctx context.Context, userID uuid.UUID, alias string) (*models.Secret, error) {
	n := normalizeAlias(alias)
	if err := validateAlias(n); err != nil {
		return nil, err
	}

	var sec models.Secret
	err := s.pool.QueryRow(ctx, `
		SELECT s.id, s.category_id, s.alias, s.title_ciphertext, s.title_nonce,
		       s.payload_ciphertext, s.payload_nonce, s.version, s.created_at, s.updated_at
		FROM secrets s
		JOIN categories c ON c.id = s.category_id
		JOIN projects p ON p.id = c.project_id
		WHERE p.user_id = $1 AND lower(s.alias) = lower($2)
	`, userID, n).Scan(
		&sec.ID, &sec.CategoryID, &sec.Alias, &sec.TitleCiphertext, &sec.TitleNonce,
		&sec.PayloadCiphertext, &sec.PayloadNonce, &sec.Version, &sec.CreatedAt, &sec.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	sec.TitleEncrypted = blobFromRow(sec.TitleCiphertext, sec.TitleNonce)
	sec.PayloadEncrypted = blobFromRow(sec.PayloadCiphertext, sec.PayloadNonce)
	return &sec, nil
}

func (s *Service) aliasInUse(ctx context.Context, userID uuid.UUID, alias string, excludeID *uuid.UUID) (bool, error) {
	var existing uuid.UUID
	query := `
		SELECT s.id FROM secrets s
		JOIN categories c ON c.id = s.category_id
		JOIN projects p ON p.id = c.project_id
		WHERE p.user_id = $1 AND lower(s.alias) = lower($2)
	`
	args := []any{userID, alias}
	if excludeID != nil {
		query += ` AND s.id <> $3`
		args = append(args, *excludeID)
	}
	err := s.pool.QueryRow(ctx, query, args...).Scan(&existing)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) UpdateSecret(ctx context.Context, userID, secretID uuid.UUID, title, payload *models.EncryptedBlob, alias *string, clearAlias bool) (*models.Secret, error) {
	var categoryID uuid.UUID
	err := s.pool.QueryRow(ctx, `SELECT category_id FROM secrets WHERE id = $1`, secretID).Scan(&categoryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.verifyCategoryOwner(ctx, userID, categoryID); err != nil {
		return nil, err
	}

	now := time.Now()
	if title != nil && payload != nil {
		titleCT, titleNonce, err := decodeBlob(*title)
		if err != nil {
			return nil, err
		}
		payloadCT, payloadNonce, err := decodeBlob(*payload)
		if err != nil {
			return nil, err
		}
		_, err = s.pool.Exec(ctx, `
			UPDATE secrets SET title_ciphertext = $1, title_nonce = $2, payload_ciphertext = $3, payload_nonce = $4,
			version = version + 1, updated_at = $5 WHERE id = $6
		`, titleCT, titleNonce, payloadCT, payloadNonce, now, secretID)
		if err != nil {
			return nil, err
		}
	}

	if clearAlias {
		_, err = s.pool.Exec(ctx, `UPDATE secrets SET alias = NULL, updated_at = $1 WHERE id = $2`, now, secretID)
		if err != nil {
			return nil, err
		}
	} else if alias != nil {
		if *alias == "" {
			_, err = s.pool.Exec(ctx, `UPDATE secrets SET alias = NULL, updated_at = $1 WHERE id = $2`, now, secretID)
			if err != nil {
				return nil, err
			}
		} else {
			n := normalizeAlias(*alias)
			if err := validateAlias(n); err != nil {
				return nil, err
			}
			taken, err := s.aliasInUse(ctx, userID, n, &secretID)
			if err != nil {
				return nil, err
			}
			if taken {
				return nil, ErrAliasTaken
			}
			_, err = s.pool.Exec(ctx, `UPDATE secrets SET alias = $1, updated_at = $2 WHERE id = $3`, n, now, secretID)
			if err != nil {
				return nil, err
			}
		}
	}

	var sec models.Secret
	err = s.pool.QueryRow(ctx, `
		SELECT id, category_id, alias, title_ciphertext, title_nonce, payload_ciphertext, payload_nonce, version, created_at, updated_at
		FROM secrets WHERE id = $1
	`, secretID).Scan(
		&sec.ID, &sec.CategoryID, &sec.Alias, &sec.TitleCiphertext, &sec.TitleNonce,
		&sec.PayloadCiphertext, &sec.PayloadNonce, &sec.Version, &sec.CreatedAt, &sec.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	sec.TitleEncrypted = blobFromRow(sec.TitleCiphertext, sec.TitleNonce)
	sec.PayloadEncrypted = blobFromRow(sec.PayloadCiphertext, sec.PayloadNonce)
	return &sec, nil
}

func (s *Service) DeleteSecret(ctx context.Context, userID, secretID uuid.UUID) error {
	var categoryID uuid.UUID
	err := s.pool.QueryRow(ctx, `SELECT category_id FROM secrets WHERE id = $1`, secretID).Scan(&categoryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := s.verifyCategoryOwner(ctx, userID, categoryID); err != nil {
		return err
	}

	tag, err := s.pool.Exec(ctx, `DELETE FROM secrets WHERE id = $1`, secretID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
