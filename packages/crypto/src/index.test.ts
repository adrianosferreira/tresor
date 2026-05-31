import { describe, expect, it } from "vitest";
import {
  createVaultRegistrationMaterial,
  decryptSecretPayload,
  decryptVaultKey,
  deriveKeys,
  encryptSecretPayload,
  encryptVaultKey,
  generateVaultKey,
  generateSalt,
  constantTimeEqual,
} from "./index.js";

describe("KDF", () => {
  it("derives deterministic keys from password and salt", async () => {
    const salt = generateSalt();
    const a = await deriveKeys("test-password", salt);
    const b = await deriveKeys("test-password", salt);
    expect(constantTimeEqual(a.authKey, b.authKey)).toBe(true);
    expect(constantTimeEqual(a.encryptionKey, b.encryptionKey)).toBe(true);
  });

  it("derives different keys for different passwords", async () => {
    const salt = generateSalt();
    const a = await deriveKeys("password-a", salt);
    const b = await deriveKeys("password-b", salt);
    expect(constantTimeEqual(a.authKey, b.authKey)).toBe(false);
  });
});

describe("Vault key lifecycle", () => {
  it("round-trips vault key encryption", async () => {
    const material = await createVaultRegistrationMaterial("master-password-123!");
    const { encryptionKey } = await deriveKeys(
      "master-password-123!",
      material.salt,
      material.kdfParams,
    );
    const vaultKey = decryptVaultKey(material.encryptedVaultKey, encryptionKey);
    expect(vaultKey.length).toBe(32);
  });

  it("encrypts and decrypts secret payloads", async () => {
    const vaultKey = generateVaultKey();
    const payload = {
      username: "admin",
      password: "s3cret!",
      url: "https://example.com",
      notes: "Production credentials",
    };

    const encrypted = encryptSecretPayload(payload, vaultKey);
    const decrypted = decryptSecretPayload<typeof payload>(encrypted, vaultKey);
    expect(decrypted).toEqual(payload);
  });

  it("fails to decrypt with wrong encryption key", async () => {
    const vaultKey = generateVaultKey();
    const wrongKey = generateVaultKey();
    const encrypted = encryptVaultKey(vaultKey, wrongKey);
    const { encryptionKey } = await deriveKeys("password", generateSalt());
    expect(() => decryptVaultKey(encrypted, encryptionKey)).toThrow();
  });
});
