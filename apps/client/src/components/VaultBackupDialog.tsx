import { FormEvent, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { Button, Card, Input } from "./ui";
import {
  createExportDownload,
  importVaultFile,
  triggerDownload,
  type ImportMode,
} from "../lib/vault-export";

const MIN_PASSPHRASE_LENGTH = 8;
const REPLACE_CONFIRM_PHRASE = "REPLACE ALL";

type VaultBackupDialogProps = {
  mode: "export" | "import";
  token: string;
  vaultKey: Uint8Array;
  onClose: () => void;
  onImported: () => void;
};

export function VaultBackupDialog({
  mode,
  token,
  vaultKey,
  onClose,
  onImported,
}: VaultBackupDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [replaceConfirm, setReplaceConfirm] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const passphraseValid = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const exportReady = passphraseValid && passphrase === confirmPassphrase;
  const replaceConfirmed = importMode !== "replace" || replaceConfirm === REPLACE_CONFIRM_PHRASE;
  const importReady = passphraseValid && selectedFile !== null && replaceConfirmed;

  async function handleExport(e: FormEvent) {
    e.preventDefault();
    if (!exportReady) return;

    setBusy(true);
    setError("");
    try {
      const { filename, content } = await createExportDownload(token, vaultKey, passphrase);
      triggerDownload(filename, content);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (!importReady || !selectedFile) return;

    setBusy(true);
    setError("");
    try {
      const content = await selectedFile.text();
      await importVaultFile(token, vaultKey, content, passphrase, importMode);
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {mode === "export" ? (
                <>
                  <Download className="h-5 w-5 text-tresor-400" />
                  Export vault
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-tresor-400" />
                  Import vault
                </>
              )}
            </h2>
            <p className="mt-1 text-sm text-tresor-400">
              {mode === "export"
                ? "Download an encrypted backup you can store anywhere."
                : "Restore from an encrypted .tresor export file."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-tresor-400 transition hover:bg-tresor-800 hover:text-tresor-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "export" ? (
          <form onSubmit={handleExport} className="space-y-3">
            <Input
              label="Export passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSPHRASE_LENGTH}
            />
            <Input
              label="Confirm passphrase"
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSPHRASE_LENGTH}
            />
            <p className="text-xs text-tresor-500">
              This passphrase encrypts the file. It is separate from your master password — store it safely.
            </p>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={!exportReady || busy} className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                {busy ? "Exporting…" : "Download backup"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleImport} className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-sm text-tresor-300">Backup file</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".tresor,application/json"
                className="block w-full text-sm text-tresor-300 file:mr-3 file:rounded-lg file:border-0 file:bg-tresor-800 file:px-3 file:py-2 file:text-sm file:text-tresor-100"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Input
              label="Export passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="current-password"
              required
              minLength={MIN_PASSPHRASE_LENGTH}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm text-tresor-300">Import mode</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-tresor-800 px-3 py-2">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm text-tresor-100">Merge</span>
                  <span className="block text-xs text-tresor-500">Add imported items alongside existing data.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-red-900/50 px-3 py-2">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm text-red-300">Replace all</span>
                  <span className="block text-xs text-tresor-500">
                    Delete everything in the vault, then import.
                  </span>
                </span>
              </label>
            </fieldset>
            {importMode === "replace" && (
              <Input
                label={`Type "${REPLACE_CONFIRM_PHRASE}" to confirm`}
                value={replaceConfirm}
                onChange={(e) => setReplaceConfirm(e.target.value)}
                autoComplete="off"
              />
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={!importReady || busy} className="inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {busy ? "Importing…" : "Import vault"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
