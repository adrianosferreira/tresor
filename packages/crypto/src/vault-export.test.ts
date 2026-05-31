import { describe, expect, it } from "vitest";
import {
  createVaultExportFile,
  parseVaultExportFile,
  serializeVaultExportFile,
  type VaultExportData,
} from "./vault-export.js";

const sampleData: VaultExportData = {
  projects: [
    {
      name: "Personal",
      sortOrder: 0,
      categories: [
        {
          name: "Logins",
          sortOrder: 0,
          secrets: [
            {
              title: "GitHub",
              payload: {
                username: "dev",
                password: "s3cret!",
                url: "https://github.com",
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("vault export", () => {
  it(
    "round-trips export data with passphrase",
    async () => {
      const file = await createVaultExportFile(sampleData, "backup-passphrase-123");
      const json = serializeVaultExportFile(file);
      const restored = await parseVaultExportFile(json, "backup-passphrase-123");
      expect(restored).toEqual(sampleData);
    },
    20_000,
  );

  it(
    "rejects wrong passphrase",
    async () => {
      const file = await createVaultExportFile(sampleData, "correct-passphrase");
      const json = serializeVaultExportFile(file);
      await expect(parseVaultExportFile(json, "wrong-passphrase")).rejects.toThrow(
        "Wrong passphrase or corrupted export file",
      );
    },
    20_000,
  );

  it("rejects invalid file format", async () => {
    await expect(parseVaultExportFile('{"format":"other"}', "pass")).rejects.toThrow(
      "Unrecognized export file format",
    );
  });
});
