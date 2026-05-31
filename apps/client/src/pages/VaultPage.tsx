import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderTree,
  Globe,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  decryptSecretPayload,
  decryptString,
  encryptSecretPayload,
  encryptString,
} from "@tresor/crypto";
import type { Category, Project, Secret, SecretPayload, SecretType } from "@tresor/shared";
import { normalizeAlias, validateAlias } from "@tresor/shared";
import { api, fromEncryptedBlob, toEncryptedBlob } from "../lib/api";
import { useVaultStore } from "../store/vault";
import { Button, Card, ConfirmDeleteDialog, Input, Textarea } from "../components/ui";
import { VaultBackupDialog } from "../components/VaultBackupDialog";

type DeleteTarget =
  | { type: "project"; item: Project; name: string }
  | { type: "category"; item: Category; name: string }
  | { type: "secret"; item: Secret; name: string };

function decryptName(
  blob: { ciphertext: string; nonce: string },
  vaultKey: Uint8Array,
): string {
  try {
    return decryptString(fromEncryptedBlob(blob), vaultKey);
  } catch {
    return "(encrypted)";
  }
}

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-tresor-400">
      <span className="text-tresor-500">{icon}</span>
      {children}
    </h2>
  );
}

function SidebarItem({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
        active ? "bg-tresor-700 text-white" : "text-tresor-200 hover:bg-tresor-800"
      }`}
      onClick={onClick}
    >
      <span className={`shrink-0 ${active ? "text-tresor-300" : "text-tresor-500"}`}>{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

function CopyableField({
  label,
  value,
  icon,
  masked = false,
  multiline = false,
  onToggleMask,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  masked?: boolean;
  multiline?: boolean;
  onToggleMask?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-tresor-800/80 bg-tresor-950/40 p-3">
      <dt className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-tresor-400">
        <span className="text-tresor-500">{icon}</span>
        {label}
      </dt>
      <dd className={`flex gap-2 ${multiline ? "items-start" : "items-center"}`}>
        <button
          type="button"
          onClick={handleCopy}
          className={`group flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-sm transition hover:bg-tresor-800/60 ${multiline ? "items-start whitespace-pre-wrap" : ""}`}
          title="Click to copy"
        >
          <span className={multiline ? "" : "truncate"}>{masked ? "••••••••••••" : value}</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md p-1.5 text-tresor-400 transition hover:bg-tresor-800 hover:text-tresor-200"
          title="Copy"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
        {onToggleMask && (
          <button
            type="button"
            onClick={onToggleMask}
            className="shrink-0 rounded-md p-1.5 text-tresor-400 transition hover:bg-tresor-800 hover:text-tresor-200"
            title={masked ? "Show password" : "Hide password"}
          >
            {masked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
      </dd>
    </div>
  );
}

export default function VaultPage() {
  const { token, vaultKey, email, lock, logout } = useVaultStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [isCreatingSecret, setIsCreatingSecret] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [secretType, setSecretType] = useState<SecretType>("login");
  const [secretForm, setSecretForm] = useState({
    title: "",
    alias: "",
    username: "",
    password: "",
    apiKey: "",
    keyId: "",
    provider: "",
    url: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backupDialog, setBackupDialog] = useState<"export" | "import" | null>(null);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    const data = (await api.listProjects(token)) as Project[];
    setProjects(data);
    if (data.length > 0 && !selectedProject) {
      setSelectedProject(data[0]!);
    }
  }, [token, selectedProject]);

  const loadCategories = useCallback(async () => {
    if (!token || !selectedProject) return;
    const data = (await api.listCategories(token, selectedProject.id)) as Category[];
    setCategories(data);
    setSelectedCategory(data[0] ?? null);
  }, [token, selectedProject]);

  const loadSecrets = useCallback(async () => {
    if (!token || !selectedCategory) return;
    const data = (await api.listSecrets(token, selectedCategory.id)) as Secret[];
    setSecrets(data);
    if (data.length === 0) {
      setSelectedSecret(null);
      setIsCreatingSecret(true);
    } else {
      setSelectedSecret((current) => data.find((s) => s.id === current?.id) ?? data[0]!);
      setIsCreatingSecret(false);
    }
  }, [token, selectedCategory]);

  useEffect(() => {
    loadProjects().catch((e) => setError(e.message));
  }, [loadProjects]);

  useEffect(() => {
    loadCategories().catch((e) => setError(e.message));
  }, [loadCategories]);

  useEffect(() => {
    loadSecrets().catch((e) => setError(e.message));
  }, [loadSecrets]);

  useEffect(() => {
    setPasswordVisible(false);
    setApiKeyVisible(false);
  }, [selectedSecret?.id]);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!token || !vaultKey || !newProjectName.trim()) return;

    const nameEncrypted = toEncryptedBlob(encryptString(newProjectName.trim(), vaultKey));
    await api.createProject(token, { nameEncrypted, sortOrder: projects.length });
    setNewProjectName("");
    await loadProjects();
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!token || !vaultKey || !selectedProject || !newCategoryName.trim()) return;

    const nameEncrypted = toEncryptedBlob(encryptString(newCategoryName.trim(), vaultKey));
    await api.createCategory(token, selectedProject.id, { nameEncrypted, sortOrder: categories.length });
    setNewCategoryName("");
    await loadCategories();
  }

  function emptySecretForm() {
    return {
      title: "",
      alias: "",
      username: "",
      password: "",
      apiKey: "",
      keyId: "",
      provider: "",
      url: "",
      notes: "",
    };
  }

  function buildSecretPayload(type: SecretType): SecretPayload {
    const notes = secretForm.notes.trim() || undefined;
    if (type === "api_key") {
      return {
        type,
        apiKey: secretForm.apiKey || undefined,
        keyId: secretForm.keyId || undefined,
        provider: secretForm.provider || undefined,
        url: secretForm.url || undefined,
        notes,
      };
    }
    if (type === "note") {
      return { type, notes };
    }
    return {
      type,
      username: secretForm.username || undefined,
      password: secretForm.password || undefined,
      url: secretForm.url || undefined,
      notes,
    };
  }

  function startCreatingSecret() {
    setSelectedSecret(null);
    setIsCreatingSecret(true);
    setSecretType("login");
    setSecretForm(emptySecretForm());
  }

  async function handleCreateSecret(e: FormEvent) {
    e.preventDefault();
    if (!token || !vaultKey || !selectedCategory) return;

    const aliasInput = secretForm.alias.trim();
    const alias = aliasInput ? normalizeAlias(aliasInput) : undefined;
    if (alias) {
      const aliasError = validateAlias(alias);
      if (aliasError) {
        setError(aliasError);
        return;
      }
    }

    const payload = buildSecretPayload(secretType);
    const titleEncrypted = toEncryptedBlob(encryptString(secretForm.title, vaultKey));
    const payloadEncrypted = toEncryptedBlob(encryptSecretPayload(payload, vaultKey));

    const created = (await api.createSecret(token, selectedCategory.id, {
      titleEncrypted,
      payloadEncrypted,
      alias,
    })) as Secret;
    setSecretForm(emptySecretForm());
    setIsCreatingSecret(false);

    const data = (await api.listSecrets(token, selectedCategory.id)) as Secret[];
    setSecrets(data);
    setSelectedSecret(data.find((s) => s.id === created.id) ?? created);
  }

  function openDeleteTarget(target: DeleteTarget) {
    setDeleteTarget(target);
  }

  async function handleConfirmDelete() {
    if (!token || !deleteTarget) return;

    setDeleting(true);
    setError("");
    try {
      if (deleteTarget.type === "project") {
        const id = deleteTarget.item.id;
        await api.deleteProject(token, id);
        const data = (await api.listProjects(token)) as Project[];
        setProjects(data);
        if (selectedProject?.id === id) {
          setSelectedProject(data[0] ?? null);
          setSelectedCategory(null);
          setSelectedSecret(null);
          setCategories([]);
          setSecrets([]);
        }
      } else if (deleteTarget.type === "category") {
        const id = deleteTarget.item.id;
        await api.deleteCategory(token, id);
        const data = (await api.listCategories(token, selectedProject!.id)) as Category[];
        setCategories(data);
        if (selectedCategory?.id === id) {
          setSelectedCategory(data[0] ?? null);
          setSelectedSecret(null);
          setSecrets([]);
        }
      } else {
        const id = deleteTarget.item.id;
        await api.deleteSecret(token, id);
        const data = (await api.listSecrets(token, selectedCategory!.id)) as Secret[];
        setSecrets(data);
        if (selectedSecret?.id === id) {
          setSelectedSecret(data[0] ?? null);
          setIsCreatingSecret(data.length === 0);
        }
      }
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleVaultImported() {
    if (!token) return;
    const data = (await api.listProjects(token)) as Project[];
    setProjects(data);
    setSelectedProject(data[0] ?? null);
    setSelectedCategory(null);
    setSelectedSecret(null);
    setCategories([]);
    setSecrets([]);
  }

  function getSecretPayload(secret: Secret): SecretPayload | null {
    if (!vaultKey) return null;
    try {
      return decryptSecretPayload(fromEncryptedBlob(secret.payloadEncrypted), vaultKey);
    } catch {
      return null;
    }
  }

  const selectedPayload = selectedSecret ? getSecretPayload(selectedSecret) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-tresor-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tresor-800 text-tresor-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Tresor</h1>
            <p className="text-xs text-tresor-400">{email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {vaultKey && token && (
            <>
              <Button
                variant="ghost"
                onClick={() => setBackupDialog("export")}
                className="inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="ghost"
                onClick={() => setBackupDialog("import")}
                className="inline-flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={lock} className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Lock
          </Button>
          <Button variant="ghost" onClick={logout} className="inline-flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      {error && <p className="bg-red-950/50 px-6 py-2 text-sm text-red-300">{error}</p>}

      <div className="grid flex-1 grid-cols-12 gap-0">
        {/* Projects sidebar */}
        <aside className="col-span-2 border-r border-tresor-800 p-4">
          <SectionHeading icon={<Briefcase className="h-3.5 w-3.5" />}>Projects</SectionHeading>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <SidebarItem
                  active={selectedProject?.id === p.id}
                  icon={<Briefcase className="h-4 w-4" />}
                  onClick={() => setSelectedProject(p)}
                >
                  {vaultKey ? decryptName(p.nameEncrypted, vaultKey) : "…"}
                </SidebarItem>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateProject} className="mt-4 space-y-2">
            <Input
              placeholder="New project"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button type="submit" variant="ghost" className="inline-flex w-full items-center justify-center gap-2 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add project
            </Button>
          </form>
          {selectedProject && vaultKey && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
              onClick={() =>
                openDeleteTarget({
                  type: "project",
                  item: selectedProject,
                  name: decryptName(selectedProject.nameEncrypted, vaultKey),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete project
            </Button>
          )}
        </aside>

        {/* Categories */}
        <aside className="col-span-2 border-r border-tresor-800 p-4">
          <SectionHeading icon={<Layers className="h-3.5 w-3.5" />}>Categories</SectionHeading>
          {selectedProject ? (
            <>
              <ul className="space-y-1">
                {categories.map((c) => (
                  <li key={c.id}>
                    <SidebarItem
                      active={selectedCategory?.id === c.id}
                      icon={<FolderTree className="h-4 w-4" />}
                      onClick={() => {
                        setSelectedCategory(c);
                        setIsCreatingSecret(false);
                      }}
                    >
                      {vaultKey ? decryptName(c.nameEncrypted, vaultKey) : "…"}
                    </SidebarItem>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleCreateCategory} className="mt-4 space-y-2">
                <Input
                  placeholder="New category"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button type="submit" variant="ghost" className="inline-flex w-full items-center justify-center gap-2 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add category
                </Button>
              </form>
              {selectedCategory && vaultKey && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
                  onClick={() =>
                    openDeleteTarget({
                      type: "category",
                      item: selectedCategory,
                      name: decryptName(selectedCategory.nameEncrypted, vaultKey),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete category
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-tresor-500">Select a project</p>
          )}
        </aside>

        {/* Secrets list */}
        <section className="col-span-3 border-r border-tresor-800 p-4">
          <SectionHeading icon={<KeyRound className="h-3.5 w-3.5" />}>Secrets</SectionHeading>
          {selectedCategory ? (
            <>
              <ul className="space-y-1">
                {secrets.map((s) => (
                  <li key={s.id}>
                    <SidebarItem
                      active={selectedSecret?.id === s.id && !isCreatingSecret}
                      icon={<KeyRound className="h-4 w-4" />}
                      onClick={() => {
                        setSelectedSecret(s);
                        setIsCreatingSecret(false);
                      }}
                    >
                      {vaultKey ? decryptName(s.titleEncrypted, vaultKey) : "…"}
                    </SidebarItem>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 text-xs"
                onClick={startCreatingSecret}
              >
                <Plus className="h-3.5 w-3.5" />
                Add secret
              </Button>
            </>
          ) : (
            <p className="text-sm text-tresor-500">Select a category</p>
          )}
        </section>

        {/* Detail / create */}
        <main className="col-span-5 p-4">
          {isCreatingSecret && selectedCategory ? (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <KeyRound className="h-5 w-5 text-tresor-400" />
                New secret
              </h2>
              <form onSubmit={handleCreateSecret} className="space-y-3">
                <div className="flex gap-2">
                  {(
                    [
                      ["login", "Login", KeyRound],
                      ["api_key", "API key", Code2],
                      ["note", "Note", StickyNote],
                    ] as const
                  ).map(([type, label, Icon]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSecretType(type)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                        secretType === type
                          ? "border-tresor-500 bg-tresor-800 text-white"
                          : "border-tresor-800 text-tresor-400 hover:border-tresor-700 hover:text-tresor-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
                <Input label="Title" value={secretForm.title} onChange={(e) => setSecretForm({ ...secretForm, title: e.target.value })} required />
                <Input
                  label="Alias (for CLI)"
                  placeholder="prod/stripe"
                  value={secretForm.alias}
                  onChange={(e) => setSecretForm({ ...secretForm, alias: e.target.value })}
                />
                <p className="-mt-1 text-xs text-tresor-500">Optional path for tresor secret get</p>
                {secretType === "login" && (
                  <>
                    <Input label="Username" value={secretForm.username} onChange={(e) => setSecretForm({ ...secretForm, username: e.target.value })} />
                    <Input label="Password" type="password" value={secretForm.password} onChange={(e) => setSecretForm({ ...secretForm, password: e.target.value })} />
                    <Input label="URL" value={secretForm.url} onChange={(e) => setSecretForm({ ...secretForm, url: e.target.value })} />
                  </>
                )}
                {secretType === "api_key" && (
                  <>
                    <Input label="Provider" placeholder="stripe, aws, …" value={secretForm.provider} onChange={(e) => setSecretForm({ ...secretForm, provider: e.target.value })} />
                    <Input label="Key ID" value={secretForm.keyId} onChange={(e) => setSecretForm({ ...secretForm, keyId: e.target.value })} />
                    <Input label="API key" type="password" value={secretForm.apiKey} onChange={(e) => setSecretForm({ ...secretForm, apiKey: e.target.value })} required />
                    <Input label="URL" value={secretForm.url} onChange={(e) => setSecretForm({ ...secretForm, url: e.target.value })} />
                  </>
                )}
                <Textarea label="Notes" value={secretForm.notes} onChange={(e) => setSecretForm({ ...secretForm, notes: e.target.value })} rows={3} />
                <div className="flex gap-2">
                  <Button type="submit" className="inline-flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Save secret
                  </Button>
                  {secrets.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsCreatingSecret(false);
                        setSelectedSecret(secrets[0] ?? null);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          ) : selectedSecret && selectedPayload ? (
            <Card>
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <KeyRound className="h-5 w-5 text-tresor-400" />
                  {vaultKey ? decryptName(selectedSecret.titleEncrypted, vaultKey) : "…"}
                </h2>
                {vaultKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="inline-flex shrink-0 items-center gap-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
                    onClick={() =>
                      openDeleteTarget({
                        type: "secret",
                        item: selectedSecret,
                        name: decryptName(selectedSecret.titleEncrypted, vaultKey),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
              <dl className="space-y-3 text-sm">
                {selectedSecret.alias && (
                  <CopyableField label="Alias" value={selectedSecret.alias} icon={<Code2 className="h-3.5 w-3.5" />} />
                )}
                {selectedPayload.provider && (
                  <CopyableField label="Provider" value={selectedPayload.provider} icon={<Code2 className="h-3.5 w-3.5" />} />
                )}
                {selectedPayload.keyId && (
                  <CopyableField label="Key ID" value={selectedPayload.keyId} icon={<KeyRound className="h-3.5 w-3.5" />} />
                )}
                {selectedPayload.apiKey && (
                  <CopyableField
                    label="API key"
                    value={selectedPayload.apiKey}
                    icon={<Lock className="h-3.5 w-3.5" />}
                    masked={!apiKeyVisible}
                    onToggleMask={() => setApiKeyVisible((visible) => !visible)}
                  />
                )}
                {selectedPayload.username && (
                  <CopyableField label="Username" value={selectedPayload.username} icon={<User className="h-3.5 w-3.5" />} />
                )}
                {selectedPayload.password && (
                  <CopyableField
                    label="Password"
                    value={selectedPayload.password}
                    icon={<Lock className="h-3.5 w-3.5" />}
                    masked={!passwordVisible}
                    onToggleMask={() => setPasswordVisible((visible) => !visible)}
                  />
                )}
                {selectedPayload.url && (
                  <div>
                    <CopyableField label="URL" value={selectedPayload.url} icon={<Globe className="h-3.5 w-3.5" />} />
                    <a
                      href={selectedPayload.url}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-tresor-400 transition hover:text-tresor-300"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open link
                    </a>
                  </div>
                )}
                {selectedPayload.notes && (
                  <CopyableField label="Notes" value={selectedPayload.notes} icon={<StickyNote className="h-3.5 w-3.5" />} multiline />
                )}
              </dl>
            </Card>
          ) : selectedCategory ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-tresor-500">
              <KeyRound className="h-10 w-10 text-tresor-700" />
              <p className="text-sm">Select a secret or add a new one</p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-tresor-500">
              <FolderTree className="h-10 w-10 text-tresor-700" />
              <p className="text-sm">Select a category to add secrets</p>
            </div>
          )}
        </main>
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === "project"
            ? "Delete project"
            : deleteTarget?.type === "category"
              ? "Delete category"
              : "Delete secret"
        }
        message={
          deleteTarget?.type === "project"
            ? "This permanently deletes the project and all its categories and secrets."
            : deleteTarget?.type === "category"
              ? "This permanently deletes the category and all its secrets."
              : "This permanently deletes the secret."
        }
        confirmPhrase={deleteTarget?.name ?? ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirming={deleting}
      />

      {backupDialog && token && vaultKey && (
        <VaultBackupDialog
          mode={backupDialog}
          token={token}
          vaultKey={vaultKey}
          onClose={() => setBackupDialog(null)}
          onImported={handleVaultImported}
        />
      )}
    </div>
  );
}
