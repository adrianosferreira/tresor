# Tresor CLI

The Tresor CLI (`@tresor/cli`) fetches secrets from your vault **from the terminal or CI**. It uses the same zero-knowledge model as the web app: the server returns only ciphertext; decryption happens on the machine where you run the CLI.

Use it when you want something like `aws secretsmanager get-secret-value`, but with Tresor holding the data and your password unlocking it locally.

## Table of contents

- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Prepare secrets in the UI](#prepare-secrets-in-the-ui)
- [Commands](#commands)
- [Session file](#session-file)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Continuous integration](#continuous-integration)
  - [Jenkins](#jenkins)
  - [GitHub Actions](#github-actions)
  - [Freestyle Jenkins job](#freestyle-jenkins-job)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## How it works


1. **`login`** — Authenticate with email + password. Saves a session file (JWT + unlocked vault key).
2. **`secret get <alias>`** — Load secret by [alias](#prepare-secrets-in-the-ui), decrypt, print fields or a single value with `--field`.
3. **`logout`** — Delete the session file.

Each `tresor` invocation is a **new process**. The password you type at `login` is not kept in memory for the next shell command; it is stored in `session.json` so `secret get` does not ask again until you `logout` or delete that file.

## Prerequisites

- **Node.js 20+** and **pnpm** (from the monorepo root).
- A running Tresor API you can reach (local dev or production).
- An account on that instance.
- Secrets created in the UI with an **alias** when you want path-based lookup (e.g. `prod/stripe`).

## Install

From the repository root:

```bash
pnpm install
pnpm cli:build
```

**Monorepo shortcut** (from repo root, after `cli:build`):

```bash
pnpm tresor login
pnpm tresor secret get prod/stripe --field apiKey
pnpm tresor logout
```

This runs `pnpm --filter @tresor/cli exec tresor`, which uses the `tresor` bin defined in `apps/cli/package.json` (`dist/index.js`).

**Optional — global command** (no `pnpm` prefix anywhere):

```bash
pnpm --filter @tresor/cli link --global
tresor login
```

Rebuild after pulling CLI changes:

```bash
pnpm cli:build
```

## Prepare secrets in the UI

1. Open the vault in the browser.
2. Create a secret (type **Login**, **API key**, or **Note**).
3. Set **Alias (for CLI)** — a stable path, lowercase, e.g. `prod/stripe` or `ci/npm-token`.
   - Allowed characters: letters, numbers, `/`, `-`, `_`.
4. Save.

The CLI calls `GET /api/v1/secrets/by-alias/<alias>`. The server stores the alias in plaintext for lookup; the **secret value stays encrypted**.

| Secret type | Common `--field` values |
|-------------|------------------------|
| API key | `apiKey`, `keyId`, `provider`, `url`, `notes` |
| Login | `username`, `password`, `url`, `notes` |
| Note | `notes` |

## Commands

### `login`

Sign in and unlock the vault for subsequent `secret get` commands.

```bash
export TRESOR_API_URL=http://localhost:8080   # or https://vault.example.com

tresor login
# Email: you@example.com
# Password: (hidden)
# Signed in as you@example.com. Session saved.
```

Non-interactive (scripts / CI):

```bash
export TRESOR_EMAIL=you@example.com
export TRESOR_PASSWORD='your-vault-password'
tresor login
```

### `logout`

Remove the session file (sign out, lock CLI access on this machine).

```bash
tresor logout
```

### `secret get <alias>`

Fetch and decrypt a secret by alias.

```bash
# Human-readable output
tresor secret get prod/stripe

# Single field for scripting (only value on stdout)
tresor secret get prod/stripe --field apiKey

# JSON (title + payload)
tresor secret get prod/stripe --json
```

Requires a prior `login` (or a valid `session.json` from an earlier build step in CI).

**Examples:**

```bash
export STRIPE_KEY="$(tresor secret get prod/stripe --field apiKey)"
docker login -u user -p "$(tresor secret get ci/docker --field password)" registry.example.com
```

## Session file

| | |
|--|--|
| **Default path** | `~/.config/tresor/session.json` |
| **Override** | `export TRESOR_CONFIG_DIR=/path/to/dir` → `$TRESOR_CONFIG_DIR/session.json` |
| **Permissions** | Directory `0700`, file `0600` |

**Contents (after `login`):**

| Field | Description |
|-------|-------------|
| `apiUrl` | API base URL used at login |
| `email` | Account email |
| `token` | JWT (expires after ~24h) |
| `kdfSalt`, `kdfParams`, `encryptedVaultKey` | Crypto metadata from server |
| `vaultKey` | Unlocked vault key (allows `secret get` without prompting) |

Treat `session.json` like a password: anyone with this file can decrypt your vault secrets until the JWT expires or you run `logout`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `TRESOR_API_URL` | API base URL. Default: `http://localhost:8080`. **Required in CI** (your deployed host). |
| `TRESOR_EMAIL` | Skip email prompt on `login`. |
| `TRESOR_PASSWORD` | Skip password prompt on `login`. |
| `TRESOR_MASTER_PASSWORD` | Alias for `TRESOR_PASSWORD` (backward compatible). |
| `TRESOR_CONFIG_DIR` | Session directory. Default: `~/.config/tresor`. Use `$WORKSPACE/.tresor` in CI. |

## Local development

Start the stack (see [README — Development](../README.md#development)):

1. `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d` → UI at [http://localhost](http://localhost), API on port **8080** for the CLI.
2. Register or log in in the browser and create a secret with an **alias**.
4. **CLI** — from the repo root:

   ```bash
   pnpm cli:build
   export TRESOR_API_URL=http://localhost:8080
   pnpm tresor login
   pnpm tresor secret get your/alias --field apiKey
   ```

---

## Continuous integration

CI jobs use the same CLI as your laptop. The agent must reach your **deployed** Tresor URL (not `localhost` unless Tresor runs on the same agent).

### Flow

1. Set `TRESOR_API_URL` to your vault (e.g. `https://vault.example.com`).
2. Provide `TRESOR_EMAIL` and `TRESOR_PASSWORD` from the CI secret store.
3. `login` → writes `session.json` under `TRESOR_CONFIG_DIR`.
4. `secret get <alias> --field …` → prints one secret; no second password prompt.
5. Pass the value into your deploy script (env var, file, etc.).

The Tresor server never receives decrypted secrets. Do not `echo` secret values in logs; enable credential masking in Jenkins / GitHub.

### Agent requirements

- Node.js 20+, pnpm
- Network access to `TRESOR_API_URL`
- Checkout of this repo (or a copy of `apps/cli` + packages), then:

  ```bash
  pnpm install
  pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build
  ```

Cache `node_modules` and optionally `$WORKSPACE/.tresor` between builds to save time.

### Jenkins credentials

Create two **Secret text** credentials:

| Jenkins ID | Value |
|------------|--------|
| `tresor-email` | Vault account email |
| `tresor-password` | Vault password |

Use a dedicated vault user for CI with only the aliases that pipeline needs (`ci/deploy`, not your personal logins).

### Jenkins

**Declarative pipeline:**

```groovy
pipeline {
  agent any

  environment {
    TRESOR_API_URL = 'https://vault.example.com'
    TRESOR_CONFIG_DIR = "${WORKSPACE}/.tresor"
  }

  stages {
    stage('Build CLI') {
      steps {
        sh 'pnpm install && pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build'
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([
          string(credentialsId: 'tresor-email', variable: 'TRESOR_EMAIL'),
          string(credentialsId: 'tresor-password', variable: 'TRESOR_PASSWORD'),
        ]) {
          sh '''
            set -euo pipefail
            mkdir -p "$TRESOR_CONFIG_DIR"
            pnpm --filter @tresor/cli exec node apps/cli/dist/index.js login
            export DEPLOY_KEY="$(pnpm --filter @tresor/cli exec node apps/cli/dist/index.js secret get prod/deploy --field apiKey)"
            ./deploy.sh
          '''
        }
      }
    }
  }
}
```

**Tips:**

- Enable **Mask passwords** (and mask regex for the fetched secret if needed).
- Stash `TRESOR_CONFIG_DIR` between stages with `stash`/`unstash` only if the workspace is wiped; otherwise the workspace file is enough for one pipeline run.
- If `login` returns 401, delete `$TRESOR_CONFIG_DIR/session.json` and retry (JWT expired).

**Shared library / shorter shell** (after global `tresor` link on the agent):

```groovy
sh '''
  export TRESOR_API_URL=https://vault.example.com
  export TRESOR_CONFIG_DIR="${WORKSPACE}/.tresor"
  tresor login
  export API_KEY="$(tresor secret get prod/stripe --field apiKey)"
'''
```

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      TRESOR_API_URL: https://vault.example.com
      TRESOR_CONFIG_DIR: ${{ github.workspace }}/.tresor

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install and build CLI
        run: pnpm install && pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build

      - name: Fetch secret and deploy
        env:
          TRESOR_EMAIL: ${{ secrets.TRESOR_EMAIL }}
          TRESOR_PASSWORD: ${{ secrets.TRESOR_PASSWORD }}
        run: |
          set -euo pipefail
          mkdir -p "$TRESOR_CONFIG_DIR"
          pnpm --filter @tresor/cli exec node apps/cli/dist/index.js login
          echo "DEPLOY_KEY=$(pnpm --filter @tresor/cli exec node apps/cli/dist/index.js secret get prod/deploy --field apiKey)" >> "$GITHUB_ENV"

      - name: Run deploy
        run: ./deploy.sh
```

Store `TRESOR_EMAIL` and `TRESOR_PASSWORD` in GitHub **Secrets**, not in the workflow file.

### Freestyle Jenkins job

1. **Build** — Execute shell:

   ```bash
   pnpm install && pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build
   ```

2. **Deploy** — Execute shell (bind credentials as environment variables `TRESOR_EMAIL`, `TRESOR_PASSWORD`):

   ```bash
   export TRESOR_API_URL=https://vault.example.com
   export TRESOR_CONFIG_DIR="$WORKSPACE/.tresor"
   mkdir -p "$TRESOR_CONFIG_DIR"

   pnpm --filter @tresor/cli exec node apps/cli/dist/index.js login
   export DEPLOY_KEY="$(pnpm --filter @tresor/cli exec node apps/cli/dist/index.js secret get prod/deploy --field apiKey)"

   ./deploy.sh
   ```

---

## Security

- **Password** — Only in Jenkins/GitHub secrets or your head; never commit to git or print in logs.
- **`session.json`** — Contains an unlocked vault key after `login`. Restrict file permissions; do not archive as build artifacts.
- **HTTPS** — Use TLS for `TRESOR_API_URL` in production.
- **Scope** — CI service account + aliases per environment (`ci/…`, `prod/…`).
- **Rotation** — Change vault password and CI credentials when people leave; run `logout` on shared machines.
- **Aliases** — Plaintext on server (path only); values remain encrypted.

See also [SECURITY.md](SECURITY.md) for the full cryptographic model.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `secret not found` | Wrong alias or wrong user | Check alias in UI; same email as `TRESOR_EMAIL`. |
| `Connection refused` / `fetch failed` | Bad URL or network | Set `TRESOR_API_URL`; ensure agent can reach host/firewall. |
| `invalid credentials` | Wrong email/password | Verify credentials; try `logout` then `login`. |
| Password asked again after `login` | Old CLI build or old session | `pnpm --filter @tresor/cli build`; `logout` then `login`. |
| `401` on `secret get` | JWT expired | Delete `session.json`; run `login` again. |
| `Field not found: apiKey` | Wrong type or empty field | Use API key secret or another `--field` name. |
| Command not found: `tresor` | Not linked globally | Use `pnpm --filter @tresor/cli exec node apps/cli/dist/index.js` or `link --global`. |

## API reference

CLI-related HTTP endpoints (all require `Authorization: Bearer <token>` except auth):

| Method | Path | CLI usage |
|--------|------|-----------|
| GET | `/api/v1/auth/lookup?email=` | `login` |
| POST | `/api/v1/auth/login` | `login` |
| GET | `/api/v1/secrets/by-alias/*` | `secret get` |

Full API list: [README](../README.md#api).
