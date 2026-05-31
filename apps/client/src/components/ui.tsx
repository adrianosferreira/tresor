import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, KeyRound } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-tresor-800 bg-tresor-900/80 p-6 shadow-xl backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-tresor-500 hover:bg-tresor-400 text-white",
    ghost: "bg-transparent hover:bg-tresor-800 text-tresor-100 border border-tresor-700",
    danger: "bg-red-700 hover:bg-red-600 text-white",
  };

  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  icon,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm text-tresor-300">{label}</span>}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tresor-500">
            {icon}
          </span>
        )}
        <input
          className={`w-full rounded-lg border border-tresor-700 bg-tresor-950 py-2.5 text-sm outline-none ring-tresor-500 focus:ring-2 ${icon ? "pl-9 pr-3" : "px-3"} ${className}`}
          {...props}
        />
      </div>
    </label>
  );
}

export function Textarea({
  label,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm text-tresor-300">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-tresor-700 bg-tresor-950 px-3 py-2 text-sm outline-none ring-tresor-500 focus:ring-2 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Logo({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${centered ? "justify-center" : ""}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tresor-500 text-white shadow-lg shadow-tresor-500/20">
        <KeyRound className="h-5 w-5" />
      </div>
      <span className="text-xl font-semibold tracking-tight">Tresor</span>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  confirmPhrase,
  onConfirm,
  onCancel,
  confirming = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmPhrase: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirming?: boolean;
}) {
  const [input, setInput] = useState("");

  useEffect(() => {
    if (open) {
      setInput("");
    }
  }, [open, confirmPhrase]);

  if (!open) {
    return null;
  }

  const matched = input === confirmPhrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <h2 className="text-lg font-semibold text-red-300">{title}</h2>
        <p className="mt-2 text-sm text-tresor-300">{message}</p>
        <div className="mt-4">
          <Input
            label={`Type "${confirmPhrase}" to confirm`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={!matched || confirming} onClick={onConfirm}>
            {confirming ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
