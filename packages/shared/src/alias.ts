/** Logical path for CLI lookup, e.g. prod/stripe/api-key */
const ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9/_-]*[a-z0-9])?$/;

export const ALIAS_MAX_LENGTH = 128;

export function normalizeAlias(input: string): string {
  return input.trim().toLowerCase();
}

export function validateAlias(alias: string): string | null {
  if (alias.length === 0) {
    return "Alias is required";
  }
  if (alias.length > ALIAS_MAX_LENGTH) {
    return `Alias must be at most ${ALIAS_MAX_LENGTH} characters`;
  }
  if (!ALIAS_PATTERN.test(alias)) {
    return "Alias must use lowercase letters, numbers, slashes, hyphens, or underscores (e.g. prod/stripe)";
  }
  return null;
}
