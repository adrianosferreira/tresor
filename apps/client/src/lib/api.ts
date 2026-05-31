const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  register: (body: unknown) => request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: unknown) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
  listProjects: (token: string) => request("/api/v1/projects", {}, token),
  createProject: (token: string, body: unknown) =>
    request("/api/v1/projects", { method: "POST", body: JSON.stringify(body) }, token),
  deleteProject: (token: string, id: string) =>
    request(`/api/v1/projects/${id}`, { method: "DELETE" }, token),
  listCategories: (token: string, projectId: string) =>
    request(`/api/v1/projects/${projectId}/categories`, {}, token),
  createCategory: (token: string, projectId: string, body: unknown) =>
    request(`/api/v1/projects/${projectId}/categories`, { method: "POST", body: JSON.stringify(body) }, token),
  listSecrets: (token: string, categoryId: string) =>
    request(`/api/v1/categories/${categoryId}/secrets`, {}, token),
  createSecret: (token: string, categoryId: string, body: unknown) =>
    request(`/api/v1/categories/${categoryId}/secrets`, { method: "POST", body: JSON.stringify(body) }, token),
  updateSecret: (token: string, id: string, body: unknown) =>
    request(`/api/v1/secrets/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteSecret: (token: string, id: string) =>
    request(`/api/v1/secrets/${id}`, { method: "DELETE" }, token),
};

export function toEncryptedBlob(payload: { ciphertext: Uint8Array; nonce: Uint8Array }) {
  return {
    ciphertext: btoa(String.fromCharCode(...payload.ciphertext)),
    nonce: btoa(String.fromCharCode(...payload.nonce)),
  };
}

export function fromEncryptedBlob(blob: { ciphertext: string; nonce: string }) {
  return {
    ciphertext: Uint8Array.from(atob(blob.ciphertext), (c) => c.charCodeAt(0)),
    nonce: Uint8Array.from(atob(blob.nonce), (c) => c.charCodeAt(0)),
  };
}
