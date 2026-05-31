# Using Tresor in CI (Jenkins, GitHub Actions, etc.)

## How it fits your pipeline

1. The job reaches your **deployed** Tresor API over HTTPS (`TRESOR_API_URL`).
2. The job provides **email + password** (Jenkins credentials).
3. The CLI logs in (or reuses `session.json`), fetches ciphertext by **alias**, decrypts locally, prints one field to stdout.
4. Your build uses that value (env var, file, `withCredentials`, etc.).

The server never sees decrypted secrets. The password is required for `login` (or use a cached session from a prior step). `secret get` reuses the unlocked session and does not prompt again.

## Prerequisites

- A running Tresor instance the agent can reach.
- Secrets in the vault with stable **aliases** (e.g. `prod/deploy`, `ci/npm-token`).
- **Node.js 20+** and **pnpm** on the CI agent (same as local CLI usage).
- Checkout of this repo (or a published `@tresor/cli` package if you add one later).

## One-time setup on the agent

```bash
pnpm install
pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build
```

Cache `node_modules` between builds to speed this up.

## Commands

```bash
export TRESOR_API_URL=https://vault.example.com
export TRESOR_EMAIL=you@example.com
export TRESOR_PASSWORD='…'
export TRESOR_CONFIG_DIR="${WORKSPACE}/.tresor"
mkdir -p "$TRESOR_CONFIG_DIR"

pnpm --filter @tresor/cli exec node dist/index.js login
export DEPLOY_KEY="$(pnpm --filter @tresor/cli exec node dist/index.js secret get prod/deploy --field apiKey)"
```

Do not `echo` secret values. Prefer `--field apiKey` over `--json`.

## Jenkins (declarative pipeline)

Store in Jenkins **Credentials**:

| ID | Type | Content |
|----|------|---------|
| `tresor-email` | Secret text | Vault account email |
| `tresor-password` | Secret text | Vault password |

```groovy
pipeline {
  agent any

  environment {
    TRESOR_API_URL = 'https://vault.example.com'
    TRESOR_CONFIG_DIR = "${WORKSPACE}/.tresor"
  }

  stages {
    stage('Fetch secret') {
      steps {
        sh 'pnpm install && pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build'
        withCredentials([
          string(credentialsId: 'tresor-email', variable: 'TRESOR_EMAIL'),
          string(credentialsId: 'tresor-password', variable: 'TRESOR_PASSWORD'),
        ]) {
          sh '''
            mkdir -p "$TRESOR_CONFIG_DIR"
            pnpm --filter @tresor/cli exec node dist/index.js login
            export DEPLOY_KEY="$(pnpm --filter @tresor/cli exec node dist/index.js secret get prod/deploy --field apiKey)"
            ./deploy.sh
          '''
        }
      }
    }
  }
}
```

Enable **Mask passwords** so credentials are not logged.

## GitHub Actions (example)

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install && pnpm --filter @tresor/crypto --filter @tresor/shared --filter @tresor/cli build
      - name: Fetch Tresor secret
        env:
          TRESOR_API_URL: https://vault.example.com
          TRESOR_EMAIL: ${{ secrets.TRESOR_EMAIL }}
          TRESOR_PASSWORD: ${{ secrets.TRESOR_PASSWORD }}
          TRESOR_CONFIG_DIR: ${{ github.workspace }}/.tresor
        run: |
          mkdir -p "$TRESOR_CONFIG_DIR"
          pnpm --filter @tresor/cli exec node dist/index.js login
          echo "DEPLOY_KEY=$(pnpm --filter @tresor/cli exec node dist/index.js secret get prod/deploy --field apiKey)" >> "$GITHUB_ENV"
```

## Local dev

Point at the dev API on the host (while `./scripts/start-dev.sh` is running):

```bash
export TRESOR_API_URL=http://localhost:8080
pnpm --filter @tresor/cli exec node dist/index.js login
```

## Session caching

`login` writes `session.json` (JWT + encrypted vault key). `secret get` uses the vault key saved at `login` and does not prompt again.

- Cache `$TRESOR_CONFIG_DIR` between builds when the JWT is still valid (24h by default).
- If login fails with 401, delete `session.json` and run `login` again.

## Security checklist

- [ ] Password only in Jenkins Credentials / vault, never in the job DSL or repo.
- [ ] Protect cached `session.json` between stages (contains decrypted vault key).
- [ ] HTTPS to Tresor in production; restrict API by network/firewall.
- [ ] One vault user per CI purpose; aliases scoped per environment (`ci/…`, `prod/…`).
- [ ] Rotate password and re-save Jenkins credentials when people leave.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `secret not found` | Alias exists in UI; same account as `TRESOR_EMAIL`. |
| `Connection refused` | `TRESOR_API_URL` wrong or agent cannot reach the host. |
| `invalid credentials` | Email/password mismatch. |
| JWT expired | Run `login` again. |
