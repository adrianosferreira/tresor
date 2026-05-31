import { gcm } from "@noble/ciphers/aes.js";
import { NONCE_LENGTH, VAULT_KEY_LENGTH, type EncryptedPayload } from "./types.js";

export function generateVaultKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(VAULT_KEY_LENGTH));
}

export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  associatedData?: Uint8Array,
): EncryptedPayload {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const cipher = gcm(key, nonce, associatedData);
  const ciphertext = cipher.encrypt(plaintext);
  return { ciphertext, nonce };
}

export function decrypt(
  payload: EncryptedPayload,
  key: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array {
  const cipher = gcm(key, payload.nonce, associatedData);
  return cipher.decrypt(payload.ciphertext);
}

export function encryptString(plaintext: string, key: Uint8Array): EncryptedPayload {
  const bytes = new TextEncoder().encode(plaintext);
  return encrypt(bytes, key);
}

export function decryptString(payload: EncryptedPayload, key: Uint8Array): string {
  const bytes = decrypt(payload, key);
  return new TextDecoder().decode(bytes);
}

export function encryptVaultKey(
  vaultKey: Uint8Array,
  encryptionKey: Uint8Array,
): EncryptedPayload {
  return encrypt(vaultKey, encryptionKey);
}

export function decryptVaultKey(
  payload: EncryptedPayload,
  encryptionKey: Uint8Array,
): Uint8Array {
  return decrypt(payload, encryptionKey);
}

export function encryptSecretPayload(
  payload: unknown,
  vaultKey: Uint8Array,
): EncryptedPayload {
  const json = JSON.stringify(payload);
  return encryptString(json, vaultKey);
}

export function decryptSecretPayload<T = unknown>(
  encrypted: EncryptedPayload,
  vaultKey: Uint8Array,
): T {
  const json = decryptString(encrypted, vaultKey);
  return JSON.parse(json) as T;
}
