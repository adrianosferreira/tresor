import { bytesToBase64, deriveKeys } from "@tresor/crypto";
import { DEFAULT_API_URL, saveSession, type SessionFile } from "../config.js";
import { authLogin, authLookup } from "../api.js";
import { promptLine, promptPassword } from "../prompt.js";
import { unlockVaultKeyAtLogin } from "../vault-key.js";

export async function loginCommand(): Promise<void> {
  const apiUrl = process.env.TRESOR_API_URL ?? DEFAULT_API_URL;
  const email = process.env.TRESOR_EMAIL ?? (await promptLine("Email: "));
  if (!email) {
    throw new Error("Email is required");
  }

  const password = await promptPassword("Password: ");
  if (!password) {
    throw new Error("Password is required");
  }

  const lookup = await authLookup(apiUrl, email);
  const salt = Uint8Array.from(atob(lookup.kdfSalt), (c) => c.charCodeAt(0));
  const { authKey } = await deriveKeys(password, salt, lookup.kdfParams);
  const response = await authLogin(apiUrl, email, bytesToBase64(authKey));

  const session: SessionFile = {
    apiUrl,
    email: response.user.email,
    token: response.token,
    kdfSalt: response.user.kdfSalt,
    kdfParams: response.user.kdfParams,
    encryptedVaultKey: response.user.encryptedVaultKey,
  };

  const vaultKey = await unlockVaultKeyAtLogin(session, password);
  session.vaultKey = bytesToBase64(vaultKey);

  await saveSession(session);
  console.log(`Signed in as ${session.email}. Session saved.`);
}
