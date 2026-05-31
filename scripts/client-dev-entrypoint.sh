#!/bin/sh
set -e

cd /app

echo "→ Installing dependencies…"
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

echo "→ Building workspace packages…"
pnpm --filter @tresor/crypto --filter @tresor/shared build

echo "→ Starting Vite dev server…"
exec pnpm --filter @tresor/client dev --host 0.0.0.0
