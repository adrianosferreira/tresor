<p align="center">
  <img src="public/images/logo.png" alt="Tresor logo" width="200">
</p>

<h1 align="center">Tresor</h1>

<p align="center">
  <strong>Your secrets. Your server. Zero knowledge.</strong>
</p>

<p align="center">
  Tresor is a self-hosted password vault for people who want full control without giving up security. Passwords, credentials, and notes are encrypted on your device before they ever reach the server.
</p>

<p align="center">
  <a href="#development">Development</a>
  ·
  <a href="#self-hosted-production">Self-host</a>
  ·
  <a href="docs/CLI.md">CLI</a>
  ·
  <a href="docs/SECURITY.md">Security</a>
</p>

## Why Tresor?

| Feature | Description |
|---------|-------------|
| **Zero-knowledge** | Your password and decrypted secrets never leave the browser. The server stores only ciphertext. |
| **Self-hosted** | Run on your own machine with Docker. No cloud subscription, no vendor lock-in. |
| **Organized** | Projects → categories → secrets. Structure your vault the way you think. |

## Architecture

- **Client** — React SPA with client-side encryption (`@tresor/crypto`)
- **Server** — Go API (chi + PostgreSQL)
- **Proxy** — Caddy for routing and TLS

## Development

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Optional: [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/) for CLI builds or Vite hot reload

### Run the stack

```bash
cp .env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

| What | URL |
|------|-----|
| App (UI + API via Caddy) | [http://localhost](http://localhost) |
| API (direct, for CLI) | [http://localhost:8080](http://localhost:8080) |

First start builds images for the API and client; it can take a few minutes.

## Self-hosted (production)

Use the same Compose file. Copy `.env.example` to `deploy/.env` and set strong `DB_PASSWORD` and `JWT_SECRET`. Point `PUBLIC_URL` / `CORS_ORIGIN` at your public origin and enable TLS in `deploy/Caddyfile` (`PUBLIC_DOMAIN`).

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

## Security model

1. Master password → **Argon2id** → auth key + encryption key
2. Random **vault key** encrypted with encryption key, stored on server
3. All secrets encrypted with vault key before upload
4. Server verifies login via auth key proof (constant-time compare)

See [docs/SECURITY.md](docs/SECURITY.md) for details.

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
| POST | `/api/v1/categories/:id/secrets` | Create secret (optional `alias`) |
| GET | `/api/v1/secrets/by-alias/*` | Get secret by alias (ciphertext only) |

## CLI

Fetch secrets from the terminal or CI (Jenkins, GitHub Actions) with zero-knowledge decryption on the agent.

Full guide — install, aliases, session file, Jenkins pipelines: **[docs/CLI.md](docs/CLI.md)**

## License

[MIT](LICENSE)
