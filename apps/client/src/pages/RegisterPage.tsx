import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createVaultRegistrationMaterial, bytesToBase64 } from "@tresor/crypto";
import { KeyRound, Lock, LogIn, Mail, ShieldAlert } from "lucide-react";
import { api, fromEncryptedBlob, toEncryptedBlob } from "../lib/api";
import { useVaultStore } from "../store/vault";
import { Button, Card, ErrorMessage, Input, Logo } from "../components/ui";
import type { AuthResponse } from "@tresor/shared";

export default function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useVaultStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Master password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const material = await createVaultRegistrationMaterial(password);
      const response = (await api.register({
        email,
        kdfSalt: bytesToBase64(material.salt),
        kdfParams: material.kdfParams,
        encryptedVaultKey: toEncryptedBlob(material.encryptedVaultKey),
        authKeyHash: bytesToBase64(material.authKey),
      })) as AuthResponse;

      setSession({
        token: response.token,
        email: response.user.email,
        kdfSalt: material.salt,
        kdfParams: material.kdfParams,
        encryptedVaultKey: fromEncryptedBlob(response.user.encryptedVaultKey),
      });

      navigate("/unlock");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Logo centered />
          <p className="mt-3 text-sm text-tresor-400">Create your encrypted vault</p>
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
              autoComplete="new-password"
            />
            <Input
              label="Confirm master password"
              type="password"
              icon={<KeyRound className="h-4 w-4" />}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="flex items-start gap-2 rounded-lg border border-tresor-800 bg-tresor-950/50 px-3 py-2.5 text-xs text-tresor-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-tresor-500" />
              <span>Your master password never leaves this device. If you lose it, your vault cannot be recovered.</span>
            </p>
            {error && <ErrorMessage message={error} />}
            <Button type="submit" className="inline-flex w-full items-center justify-center gap-2" disabled={loading}>
              <KeyRound className="h-4 w-4" />
              {loading ? "Creating vault…" : "Create vault"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-tresor-400">
          Already have a vault?{" "}
          <Link to="/login" className="inline-flex items-center gap-1 text-tresor-300 hover:text-white">
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
