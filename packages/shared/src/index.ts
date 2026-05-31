import { z } from "zod";

export const kdfParamsSchema = z.object({
  memoryKiB: z.number().int().positive(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive(),
  hashLength: z.number().int().positive(),
});

export const encryptedBlobSchema = z.object({
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  kdfSalt: z.string().min(1),
  kdfParams: kdfParamsSchema,
  encryptedVaultKey: encryptedBlobSchema,
  authKeyHash: z.string().min(1),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  authKeyProof: z.string().min(1),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const createProjectRequestSchema = z.object({
  nameEncrypted: encryptedBlobSchema,
  sortOrder: z.number().int().default(0),
});

export const createCategoryRequestSchema = z.object({
  nameEncrypted: encryptedBlobSchema,
  sortOrder: z.number().int().default(0),
});

export const createSecretRequestSchema = z.object({
  titleEncrypted: encryptedBlobSchema,
  payloadEncrypted: encryptedBlobSchema,
});

export const updateSecretRequestSchema = z.object({
  titleEncrypted: encryptedBlobSchema.optional(),
  payloadEncrypted: encryptedBlobSchema.optional(),
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type CreateSecretRequest = z.infer<typeof createSecretRequestSchema>;
export type UpdateSecretRequest = z.infer<typeof updateSecretRequestSchema>;

export interface Project {
  id: string;
  nameEncrypted: { ciphertext: string; nonce: string };
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  projectId: string;
  nameEncrypted: { ciphertext: string; nonce: string };
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Secret {
  id: string;
  categoryId: string;
  titleEncrypted: { ciphertext: string; nonce: string };
  payloadEncrypted: { ciphertext: string; nonce: string };
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SecretPayload {
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  customFields?: { label: string; value: string; type: "text" | "hidden" }[];
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    kdfSalt: string;
    kdfParams: z.infer<typeof kdfParamsSchema>;
    encryptedVaultKey: { ciphertext: string; nonce: string };
  };
}

export interface ApiError {
  error: string;
  code?: string;
}
