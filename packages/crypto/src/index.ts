import { encryptVaultKey, generateVaultKey } from "./cipher.js";
import { deriveKeys, generateSalt } from "./kdf.js";
import { DEFAULT_KDF_PARAMS, SALT_LENGTH, type VaultRegistrationMaterial } from "./types.js";

export async function createVaultRegistrationMaterial(
  masterPassword: string,
): Promise<VaultRegistrationMaterial> {
  const salt = generateSalt(SALT_LENGTH);
  const kdfParams = { ...DEFAULT_KDF_PARAMS };
  const { authKey, encryptionKey } = await deriveKeys(masterPassword, salt, kdfParams);
  const vaultKey = generateVaultKey();
  const encryptedVaultKey = encryptVaultKey(vaultKey, encryptionKey);

  return {
    salt,
    kdfParams,
    encryptedVaultKey,
    authKey,
  };
}

export async function unlockVault(
  masterPassword: string,
  salt: Uint8Array,
  kdfParams: typeof DEFAULT_KDF_PARAMS,
  encryptedVaultKey: { ciphertext: Uint8Array; nonce: Uint8Array },
): Promise<Uint8Array> {
  const { encryptionKey } = await deriveKeys(masterPassword, salt, kdfParams);
  const { decryptVaultKey } = await import("./cipher.js");
  return decryptVaultKey(encryptedVaultKey, encryptionKey);
}

export { DEFAULT_KDF_PARAMS } from "./types.js";
export type {
  DerivedKeys,
  EncryptedPayload,
  KdfParams,
  VaultRegistrationMaterial,
} from "./types.js";
export {
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
  hexToBytes,
  constantTimeEqual,
  deriveKeys,
  generateSalt,
} from "./kdf.js";
export {
  decrypt,
  decryptSecretPayload,
  decryptString,
  decryptVaultKey,
  encrypt,
  encryptSecretPayload,
  encryptString,
  encryptVaultKey,
  generateVaultKey,
} from "./cipher.js";
export {
  createVaultExportFile,
  parseVaultExportFile,
  serializeVaultExportFile,
  VAULT_EXPORT_FORMAT,
  VAULT_EXPORT_VERSION,
} from "./vault-export.js";
export type {
  VaultExportCategory,
  VaultExportData,
  VaultExportFile,
  VaultExportProject,
  VaultExportSecret,
  VaultExportSecretPayload,
} from "./vault-export.js";
