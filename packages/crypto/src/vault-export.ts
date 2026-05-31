import { decrypt, encrypt } from "./cipher.js";
import { base64ToBytes, bytesToBase64, deriveKeys, generateSalt } from "./kdf.js";
import { DEFAULT_KDF_PARAMS, SALT_LENGTH, type KdfParams } from "./types.js";

export const VAULT_EXPORT_FORMAT = "tresor-vault-export";
export const VAULT_EXPORT_VERSION = 1;

export type VaultExportSecretPayload = {
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  customFields?: { label: string; value: string; type: "text" | "hidden" }[];
};

export type VaultExportSecret = {
  title: string;
  payload: VaultExportSecretPayload;
};

export type VaultExportCategory = {
  name: string;
  sortOrder: number;
  secrets: VaultExportSecret[];
};

export type VaultExportProject = {
  name: string;
  sortOrder: number;
  categories: VaultExportCategory[];
};

export type VaultExportData = {
  projects: VaultExportProject[];
};

export type VaultExportFile = {
  format: typeof VAULT_EXPORT_FORMAT;
  version: typeof VAULT_EXPORT_VERSION;
  exportedAt: string;
  kdfSalt: string;
  kdfParams: KdfParams;
  ciphertext: string;
  nonce: string;
};

function exportAad(): Uint8Array {
  return new TextEncoder().encode(VAULT_EXPORT_FORMAT);
}

export async function createVaultExportFile(
  data: VaultExportData,
  passphrase: string,
): Promise<VaultExportFile> {
  const salt = generateSalt(SALT_LENGTH);
  const kdfParams = { ...DEFAULT_KDF_PARAMS };
  const { encryptionKey } = await deriveKeys(passphrase, salt, kdfParams);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const { ciphertext, nonce } = encrypt(plaintext, encryptionKey, exportAad());

  return {
    format: VAULT_EXPORT_FORMAT,
    version: VAULT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    kdfSalt: bytesToBase64(salt),
    kdfParams,
    ciphertext: bytesToBase64(ciphertext),
    nonce: bytesToBase64(nonce),
  };
}

export function serializeVaultExportFile(file: VaultExportFile): string {
  return JSON.stringify(file, null, 2);
}

export async function parseVaultExportFile(
  json: string,
  passphrase: string,
): Promise<VaultExportData> {
  let file: VaultExportFile;
  try {
    file = JSON.parse(json) as VaultExportFile;
  } catch {
    throw new Error("Invalid export file format");
  }

  if (file.format !== VAULT_EXPORT_FORMAT) {
    throw new Error("Unrecognized export file format");
  }
  if (file.version !== VAULT_EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${file.version}`);
  }

  const salt = base64ToBytes(file.kdfSalt);
  const { encryptionKey } = await deriveKeys(passphrase, salt, file.kdfParams);

  try {
    const plaintext = decrypt(
      { ciphertext: base64ToBytes(file.ciphertext), nonce: base64ToBytes(file.nonce) },
      encryptionKey,
      exportAad(),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as VaultExportData;
  } catch {
    throw new Error("Wrong passphrase or corrupted export file");
  }
}
