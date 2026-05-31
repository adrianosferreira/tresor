export const DEFAULT_KDF_PARAMS = {
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 4,
  hashLength: 64,
} as const;

export type KdfParams = {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
};

export type DerivedKeys = {
  authKey: Uint8Array;
  encryptionKey: Uint8Array;
};

export type EncryptedPayload = {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
};

export type VaultRegistrationMaterial = {
  salt: Uint8Array;
  kdfParams: KdfParams;
  encryptedVaultKey: EncryptedPayload;
  authKey: Uint8Array;
};

export const AUTH_KEY_LENGTH = 32;
export const ENCRYPTION_KEY_LENGTH = 32;
export const VAULT_KEY_LENGTH = 32;
export const SALT_LENGTH = 16;
export const NONCE_LENGTH = 12;
