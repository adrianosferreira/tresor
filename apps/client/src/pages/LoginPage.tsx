import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deriveKeys, bytesToBase64 } from "@tresor/crypto";
import { LogIn, Lock, Mail, UserPlus } from "lucide-react";
import { api, fromEncryptedBlob } from "../lib/api";
import { useVaultStore } from "../store/vault";
import { Button, Card, ErrorMessage, Input, Logo } from "../components/ui";
import type { AuthResponse } from "@tresor/shared";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useVaultStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const lookup = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:8080"}/api/v1/auth/lookup?email=${encodeURIComponent(email)}`,
      );

      if (!lookup.ok) {
        throw new Error("Invalid credentials");
      }

      const { kdfSalt, kdfParams } = (await lookup.json()) as {
        kdfSalt: string;
        kdfParams: { memoryKiB: number; iterations: number; parallelism: number; hashLength: number };
      };

      const salt = Uint8Array.from(atob(kdfSalt), (c) => c.charCodeAt(0));
      const { authKey } = await deriveKeys(password, salt, kdfParams);

      const response = (await api.login({
        email,
        authKeyProof: bytesToBase64(authKey),
      })) as AuthResponse;

      setSession({
        token: response.token,
        email: response.user.email,
        kdfSalt: salt,
        kdfParams: kdfParams,
        encryptedVaultKey: fromEncryptedBlob(response.user.encryptedVaultKey),
      });

      navigate("/unlock");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Logo centered />
          <p className="mt-3 text-sm text-tresor-400">Unlock your vault</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Master password"
              type="password"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <ErrorMessage message={error} />}
            <Button type="submit" className="inline-flex w-full items-center justify-center gap-2" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-tresor-400">
          New to Tresor?{" "}
          <Link to="/register" className="inline-flex items-center gap-1 text-tresor-300 hover:text-white">
            <UserPlus className="h-3.5 w-3.5" />
            Create a vault
          </Link>
        </p>
      </div>
    </div>
  );
}
