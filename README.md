<p align="center">
  <img src="public/images/logo.png" alt="Tresor logo" width="200">
</p>

<h1 align="center">Tresor</h1>

<p align="center">
  <strong>Your secrets. Your server. Zero knowledge.</strong>
</p>

<p align="center">
  Tresor is a self-hosted password vault for people who want full control without giving up security.<br>
  Passwords, credentials, and notes are encrypted on your device before they ever reach the server —<br>
  so even if someone gets your database, your vault stays locked without your password.
</p>

<p align="center">
  <a href="#quick-start-development">Get started</a>
  ·
  <a href="#self-hosted-production">Self-host</a>
  ·
  <a href="docs/SECURITY.md">Security</a>
</p>

## Why Tresor?

| Feature | Description |
|---------|-------------|
| **Zero-knowledge** | Your password and decrypted secrets never leave the browser. The server stores only ciphertext. |
| **Self-hosted** | Run on your own machine with Docker. No cloud subscription, no vendor lock-in. |
| **Organized** | Projects → categories → secrets. Structure your vault the way you think. |
| **Simple ops** | One script to spin up the full dev stack. Production deploy is Docker Compose + Caddy. |

```
You encrypt locally  →  Server stores locked data  →  Only your password opens the vault
```

## Architecture

- **Client** — React SPA with client-side encryption (`@tresor/crypto`)
- **Server** — Go API (chi + PostgreSQL)
- **Proxy** — Caddy for routing and TLS

## Quick start (development)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

No local Node.js, pnpm, or Go required — everything runs in containers.

### Start the dev stack

```bash
./scripts/start-dev.sh
```

This starts PostgreSQL, the Go API, and the Vite dev server, then streams client logs. Press **Ctrl+C** to detach (containers keep running).

| Service | URL |
|---------|-----|
| Client | [http://localhost:5173](http://localhost:5173) |
| API | [http://localhost:8080](http://localhost:8080) |

**Useful flags:**

```bash
./scripts/start-dev.sh --detach    # start in background, no log stream
./scripts/start-dev.sh --rebuild   # force rebuild Docker images
./scripts/start-dev.sh --help      # show all options
```

**Stop the stack:**

```bash
docker compose -f deploy/docker-compose.dev.yml down
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
├── deploy/         # Docker Compose + Caddy
└── scripts/        # Dev helpers (start-dev.sh)
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
