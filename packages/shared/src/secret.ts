import { z } from "zod";
import { normalizeAlias, validateAlias } from "./alias.js";

export const secretTypeSchema = z.enum(["login", "api_key", "note"]);
export type SecretType = z.infer<typeof secretTypeSchema>;

export const secretPayloadSchema = z.object({
  type: secretTypeSchema.optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  keyId: z.string().optional(),
  provider: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
  customFields: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        type: z.enum(["text", "hidden"]),
      }),
    )
    .optional(),
});

export type SecretPayload = z.infer<typeof secretPayloadSchema>;

export const optionalAliasSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value.trim() === "") {
      return undefined;
    }
    const normalized = normalizeAlias(value);
    const error = validateAlias(normalized);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      return z.NEVER;
    }
    return normalized;
  });
