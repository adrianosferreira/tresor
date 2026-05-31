import {
  createVaultExportFile,
  decryptSecretPayload,
  decryptString,
  encryptSecretPayload,
  encryptString,
  parseVaultExportFile,
  serializeVaultExportFile,
  type VaultExportData,
} from "@tresor/crypto";
import type { Category, Project, Secret } from "@tresor/shared";
import { api, fromEncryptedBlob, toEncryptedBlob } from "./api";

export type ImportMode = "merge" | "replace";

export async function fetchDecryptedVault(
  token: string,
  vaultKey: Uint8Array,
): Promise<VaultExportData> {
  const projects = (await api.listProjects(token)) as Project[];
  const exportProjects: VaultExportData["projects"] = [];

  for (const project of projects) {
    const categories = (await api.listCategories(token, project.id)) as Category[];
    const exportCategories: VaultExportData["projects"][number]["categories"] = [];

    for (const category of categories) {
      const secrets = (await api.listSecrets(token, category.id)) as Secret[];
      exportCategories.push({
        name: decryptString(fromEncryptedBlob(category.nameEncrypted), vaultKey),
        sortOrder: category.sortOrder,
        secrets: secrets.map((secret) => ({
          title: decryptString(fromEncryptedBlob(secret.titleEncrypted), vaultKey),
          alias: secret.alias,
          payload: decryptSecretPayload(fromEncryptedBlob(secret.payloadEncrypted), vaultKey),
        })),
      });
    }

    exportProjects.push({
      name: decryptString(fromEncryptedBlob(project.nameEncrypted), vaultKey),
      sortOrder: project.sortOrder,
      categories: exportCategories,
    });
  }

  return { projects: exportProjects };
}

export async function createExportDownload(
  token: string,
  vaultKey: Uint8Array,
  passphrase: string,
): Promise<{ filename: string; content: string }> {
  const data = await fetchDecryptedVault(token, vaultKey);
  const file = await createVaultExportFile(data, passphrase);
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `tresor-export-${date}.tresor`,
    content: serializeVaultExportFile(file),
  };
}

export function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importVaultData(
  token: string,
  vaultKey: Uint8Array,
  data: VaultExportData,
  mode: ImportMode,
): Promise<void> {
  if (mode === "replace") {
    const existing = (await api.listProjects(token)) as Project[];
    for (const project of existing) {
      await api.deleteProject(token, project.id);
    }
  }

  for (const exportProject of data.projects) {
    const createdProject = (await api.createProject(token, {
      nameEncrypted: toEncryptedBlob(encryptString(exportProject.name, vaultKey)),
      sortOrder: exportProject.sortOrder,
    })) as Project;

    for (const exportCategory of exportProject.categories) {
      const createdCategory = (await api.createCategory(token, createdProject.id, {
        nameEncrypted: toEncryptedBlob(encryptString(exportCategory.name, vaultKey)),
        sortOrder: exportCategory.sortOrder,
      })) as Category;

      for (const exportSecret of exportCategory.secrets) {
        await api.createSecret(token, createdCategory.id, {
          titleEncrypted: toEncryptedBlob(encryptString(exportSecret.title, vaultKey)),
          payloadEncrypted: toEncryptedBlob(encryptSecretPayload(exportSecret.payload, vaultKey)),
          alias: exportSecret.alias,
        });
      }
    }
  }
}

export async function importVaultFile(
  token: string,
  vaultKey: Uint8Array,
  fileContent: string,
  passphrase: string,
  mode: ImportMode,
): Promise<void> {
  const data = await parseVaultExportFile(fileContent, passphrase);
  await importVaultData(token, vaultKey, data, mode);
}
