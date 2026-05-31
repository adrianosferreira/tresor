import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { decryptVaultKey, deriveKeys } from "@tresor/crypto";
import { Lock, Unlock } from "lucide-react";
import { useVaultStore } from "../store/vault";
import { Button, Card, ErrorMessage, Input, Logo } from "../components/ui";

export default function UnlockPage() {
  const navigate = useNavigate();
  const { email, kdfSalt, kdfParams, encryptedVaultKey, unlock } = useVaultStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!kdfSalt || !kdfParams || !encryptedVaultKey) return;

    setError("");
    setLoading(true);

    try {
      const { encryptionKey } = await deriveKeys(password, kdfSalt, kdfParams);
      const vaultKey = decryptVaultKey(encryptedVaultKey, encryptionKey);
      unlock(vaultKey);
      navigate("/");
    } catch {
      setError("Incorrect master password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Logo centered />
          <p className="mt-3 text-sm text-tresor-400">Welcome back, {email}</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Master password"
              type="password"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
            />
            {error && <ErrorMessage message={error} />}
            <Button type="submit" className="inline-flex w-full items-center justify-center gap-2" disabled={loading}>
              <Unlock className="h-4 w-4" />
              {loading ? "Unlocking…" : "Unlock vault"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
