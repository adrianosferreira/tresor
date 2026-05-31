ALTER TABLE secrets ADD COLUMN IF NOT EXISTS alias TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_alias_lower
  ON secrets (lower(alias))
  WHERE alias IS NOT NULL;
