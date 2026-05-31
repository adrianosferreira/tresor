package models

import (
	"time"

	"github.com/google/uuid"
)

type KdfParams struct {
	MemoryKiB   int `json:"memoryKiB"`
	Iterations  int `json:"iterations"`
	Parallelism int `json:"parallelism"`
	HashLength  int `json:"hashLength"`
}

type EncryptedBlob struct {
	Ciphertext string `json:"ciphertext"`
	Nonce      string `json:"nonce"`
}

type User struct {
	ID                 uuid.UUID
	Email              string
	KdfSalt            []byte
	KdfParams          KdfParams
	EncryptedVaultKey  []byte
	VaultKeyNonce      []byte
	AuthKeyHash        []byte
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type Project struct {
	ID             uuid.UUID `json:"id"`
	NameCiphertext []byte    `json:"-"`
	NameNonce      []byte    `json:"-"`
	NameEncrypted  EncryptedBlob `json:"nameEncrypted"`
	SortOrder      int       `json:"sortOrder"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Category struct {
	ID             uuid.UUID `json:"id"`
	ProjectID      uuid.UUID `json:"projectId"`
	NameCiphertext []byte    `json:"-"`
	NameNonce      []byte    `json:"-"`
	NameEncrypted  EncryptedBlob `json:"nameEncrypted"`
	SortOrder      int       `json:"sortOrder"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Secret struct {
	ID                uuid.UUID `json:"id"`
	CategoryID        uuid.UUID `json:"categoryId"`
	Alias             *string   `json:"alias,omitempty"`
	TitleCiphertext   []byte    `json:"-"`
	TitleNonce        []byte    `json:"-"`
	TitleEncrypted    EncryptedBlob `json:"titleEncrypted"`
	PayloadCiphertext []byte    `json:"-"`
	PayloadNonce      []byte    `json:"-"`
	PayloadEncrypted  EncryptedBlob `json:"payloadEncrypted"`
	Version           int       `json:"version"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}
