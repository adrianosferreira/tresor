import { base64ToBytes, decryptSecretPayload, decryptString } from "@tresor/crypto";
import type { SecretPayload } from "@tresor/shared";
import { normalizeAlias, validateAlias } from "@tresor/shared";
import { getSecretByAlias } from "../api.js";
import { loadSession } from "../config.js";
import { resolveVaultKey } from "../vault-key.js";

export type SecretGetOptions = {
  field?: string;
  json: boolean;
};

function fromEncryptedBlob(blob: { ciphertext: string; nonce: string }) {
  return {
    ciphertext: base64ToBytes(blob.ciphertext),
    nonce: base64ToBytes(blob.nonce),
  };
}

export async function secretGetCommand(aliasArg: string, options: SecretGetOptions): Promise<void> {
  const alias = normalizeAlias(aliasArg);
  const aliasError = validateAlias(alias);
  if (aliasError) {
    throw new Error(aliasError);
  }

  const session = await loadSession();
  const vaultKey = await resolveVaultKey(session);

  const secret = await getSecretByAlias(session.apiUrl, session.token, alias);
  const title = decryptString(fromEncryptedBlob(secret.titleEncrypted), vaultKey);
  const payload = decryptSecretPayload<SecretPayload>(fromEncryptedBlob(secret.payloadEncrypted), vaultKey);

  if (options.field) {
    const value = payload[options.field as keyof SecretPayload];
    if (value === undefined || value === null) {
      throw new Error(`Field not found: ${options.field}`);
    }
    if (typeof value === "object") {
      console.log(JSON.stringify(value));
    } else {
      console.log(String(value));
    }
    return;
  }

  const output = {
    alias: secret.alias ?? alias,
    title,
    payload,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Title: ${title}`);
  if (secret.alias) {
    console.log(`Alias: ${secret.alias}`);
  }
  if (payload.type) {
    console.log(`Type: ${payload.type}`);
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key === "type" || value === undefined || value === null || value === "") {
      continue;
    }
    if (typeof value === "object") {
      console.log(`${key}: ${JSON.stringify(value)}`);
    } else {
      console.log(`${key}: ${value}`);
    }
  }
}
