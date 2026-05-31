#!/bin/sh
set -e

cd /app

echo "→ Installing dependencies…"
pnpm install --frozen-lockfile

echo "→ Building workspace packages…"
pnpm --filter @tresor/crypto --filter @tresor/shared build

echo "→ Starting Vite dev server…"
exec pnpm --filter @tresor/client dev --host 0.0.0.0
