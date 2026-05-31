<p align="center">
  <img src="public/images/logo.png" alt="Tresor logo" width="160">
</p>

# Tresor

Self-hosted, zero-knowledge password vault.

## Architecture

- **Client** — React SPA with client-side encryption (`@tresor/crypto`)
- **Server** — Go API (chi + PostgreSQL)
- **Proxy** — Caddy for routing and TLS

```
Browser → Caddy → React (static) + Go API → PostgreSQL
                      ↓
              Encrypt/decrypt locally
```

## Quick start (development)

### Prerequisites

- Node.js 20+
- pnpm 10+
- Go 1.23+
- Docker & Docker Compose

### 1. Start the database and API

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```

### 2. Install dependencies and run the client

```bash
pnpm install
pnpm --filter @tresor/crypto build
pnpm --filter @tresor/shared build
pnpm --filter @tresor/client dev
```

Open [http://localhost:5173](http://localhost:5173).

### 3. Run the Go server locally (alternative to Docker API)

```bash
cd apps/server
export DATABASE_URL="postgres://tresor:tresor_dev_password@localhost:5432/tresor?sslmode=disable"
export JWT_SECRET="dev-jwt-secret-change-in-production"
export CORS_ORIGIN="http://localhost:5173"
go run ./cmd/tresor
```

## Self-hosted (production)

```bash
cp .env.example .env
# Edit .env — set DB_PASSWORD and JWT_SECRET

docker compose -f deploy/docker-compose.yml up -d
```

Visit `http://localhost` (or configure `PUBLIC_DOMAIN` in Caddy for HTTPS).

## Security model

1. Master password → **Argon2id** → auth key + encryption key
2. Random **vault key** encrypted with encryption key, stored on server
3. All secrets encrypted with vault key before upload
4. Server verifies login via auth key proof (constant-time compare)

See [docs/SECURITY.md](docs/SECURITY.md) for details.

## Monorepo structure

```
tresor/
├── apps/
│   ├── client/     # React + Vite
│   └── server/     # Go API
├── packages/
│   ├── crypto/     # Encryption primitives
│   └── shared/     # Shared types & Zod schemas
└── deploy/         # Docker Compose + Caddy
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| GET | `/api/v1/auth/lookup?email=` | Get KDF params for login |
| POST | `/api/v1/auth/login` | Authenticate |
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects/:id/categories` | List categories |
| POST | `/api/v1/projects/:id/categories` | Create category |
| GET | `/api/v1/categories/:id/secrets` | List secrets |
| POST | `/api/v1/categories/:id/secrets` | Create secret |

## License

[Tresor Personal Use License 1.0](LICENSE) — free for personal and non-commercial use. Commercial use requires a separate license from the maintainers.
