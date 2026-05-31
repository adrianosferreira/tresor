import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AuthResponse } from "@tresor/shared";

export const DEFAULT_API_URL = process.env.TRESOR_API_URL ?? "http://localhost:8080";

export type SessionFile = {
  apiUrl: string;
  email: string;
  token: string;
  kdfSalt: string;
  kdfParams: AuthResponse["user"]["kdfParams"];
  encryptedVaultKey: AuthResponse["user"]["encryptedVaultKey"];
  /** Set at login so secret get does not prompt again. Treat session.json as highly sensitive. */
  vaultKey?: string;
};

function configDir(): string {
  return process.env.TRESOR_CONFIG_DIR ?? join(homedir(), ".config", "tresor");
}

export function sessionPath(): string {
  return join(configDir(), "session.json");
}

export async function saveSession(session: SessionFile): Promise<void> {
  const dir = configDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(sessionPath(), `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
}

export async function loadSession(): Promise<SessionFile> {
  const raw = await readFile(sessionPath(), "utf8");
  return JSON.parse(raw) as SessionFile;
}
