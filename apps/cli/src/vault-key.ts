import {
  base64ToBytes,
  bytesToBase64,
  decryptVaultKey,
  deriveKeys,
} from "@tresor/crypto";
import { loadSession, saveSession, type SessionFile } from "./config.js";
import { promptPassword } from "./prompt.js";

function fromEncryptedBlob(blob: { ciphertext: string; nonce: string }) {
  return {
    ciphertext: base64ToBytes(blob.ciphertext),
    nonce: base64ToBytes(blob.nonce),
  };
}

export async function unlockVaultKeyAtLogin(
  session: SessionFile,
  password: string,
): Promise<Uint8Array> {
  const salt = base64ToBytes(session.kdfSalt);
  const { encryptionKey } = await deriveKeys(password, salt, session.kdfParams);
  return decryptVaultKey(fromEncryptedBlob(session.encryptedVaultKey), encryptionKey);
}

/** Use vault key cached at login; prompt only if missing (older sessions). */
export async function resolveVaultKey(session: SessionFile): Promise<Uint8Array> {
  if (session.vaultKey) {
    return base64ToBytes(session.vaultKey);
  }

  const password = await promptPassword("Password: ");
  if (!password) {
    throw new Error("Password is required");
  }

  const vaultKey = await unlockVaultKeyAtLogin(session, password);
  await saveSession({ ...session, vaultKey: bytesToBase64(vaultKey) });
  return vaultKey;
}
