import type { AuthResponse, Secret } from "@tresor/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(apiUrl: string, path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
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
  return response.json() as Promise<T>;
}

export async function authLookup(apiUrl: string, email: string) {
  return request<{ kdfSalt: string; kdfParams: AuthResponse["user"]["kdfParams"] }>(
    apiUrl,
    `/api/v1/auth/lookup?email=${encodeURIComponent(email)}`,
  );
}

export async function authLogin(apiUrl: string, email: string, authKeyProof: string) {
  return request<AuthResponse>(apiUrl, "/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, authKeyProof }),
  });
}

export async function getSecretByAlias(apiUrl: string, token: string, alias: string) {
  const path = `/api/v1/secrets/by-alias/${alias
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  return request<Secret>(apiUrl, path, {}, token);
}
