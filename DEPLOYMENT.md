# Deployment (Strato VPS + GHCR)

The app is deployed to a Strato VPS at **https://geist.online**. GitHub Actions builds and tests the
images, pushes them to the **private** GitHub Container Registry (GHCR), and then SSHes into the VPS
to pull and run them with Docker Compose. Postgres runs 24/7 on the VPS with a persistent volume and
automatic rotating backups.

```
merge to main
   └─▶ GitHub Actions: test → build geist-backend/geist-frontend → push to GHCR
          └─▶ scp stack files to VPS:/opt/geist → SSH → scripts/deploy.sh → compose pull && up -d
                 └─▶ caddy (443) → frontend → backend → postgres (persistent volume)
```

The VPS needs **no GitHub repo access**: the deploy job copies the stack files
(`docker-compose.prod.yml`, `Caddyfile`, `scripts/`, `database/init.sql`) to `/opt/geist` via scp on
every deploy. The only credential the VPS needs is a `docker login ghcr.io` (a `read:packages` PAT)
so it can pull the private images.

## Pipeline overview

- **test** — `npm ci && npm run build` for backend and frontend (typecheck/compile gate).
- **build-backend / build-frontend** — build images and push to
  `ghcr.io/geist-app/geist-backend` and `ghcr.io/geist-app/geist-frontend`, tagged with the short
  commit SHA and `latest`. On PRs images are built but **not** pushed.
- **deploy** — runs only on push/merge to `main`; scps the stack files to `/opt/geist`, then SSHes
  to the VPS and runs `scripts/deploy.sh` with `IMAGE_TAG=<short-sha>`.

The running commit is exposed at `https://geist.online/api/info` → `{"version":"<short-sha>"}`.

## Config: two separate places

**Do not confuse these.**

### GitHub repo Secrets (Settings → Secrets and variables → Actions)
Only used so the pipeline can reach and log into the VPS:

| Secret | Purpose |
|---|---|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH user on the VPS |
| `VPS_SSH_KEY` | Private SSH key whose public key is in the VPS `~/.ssh/authorized_keys` |
| `VPS_SSH_PASSPHRASE` | *(optional)* passphrase for `VPS_SSH_KEY` if it has one (prefer a passphrase-less key) |
| `VPS_SSH_PORT` | *(optional)* SSH port if not 22 |

GHCR push needs **no** secret — the built-in `GITHUB_TOKEN` (`packages: write`) handles it.

### VPS `.env` (at `/opt/geist/.env`, gitignored)
Configures the running stack. Copy from `.env.example` and set strong secrets: `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `JWT_SECRET`, `IMAGE_TAG`.
Generate secrets with e.g. `openssl rand -hex 32`.

## One-time VPS bootstrap

The VPS does **not** need to clone the repo — CI delivers the stack files by scp on every deploy.
You only need to prepare Docker, a GHCR login, and a `.env`, then let the first merge deploy the rest.

1. **Install Docker** (Engine + compose plugin):
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Log in to GHCR** so the VPS can pull the private images. Create a GitHub Personal Access
   Token with the `read:packages` scope, then:
   ```bash
   echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin
   ```
   In GitHub, set both `geist-backend` and `geist-frontend` packages to **Private** (Package
   settings → Change visibility) and link them to the repo.

3. **Create `/opt/geist/.env`** (this is the only file you place by hand; CI never overwrites it):
   ```bash
   sudo mkdir -p /opt/geist && sudo chown -R "$USER" /opt/geist
   cat > /opt/geist/.env <<EOF
   POSTGRES_USER=geist
   POSTGRES_PASSWORD=$(openssl rand -hex 32)
   POSTGRES_DB=geist
   JWT_SECRET=$(openssl rand -hex 32)
   IMAGE_TAG=latest
   EOF
   # add DATABASE_URL using the password just generated:
   PW=$(grep '^POSTGRES_PASSWORD=' /opt/geist/.env | cut -d= -f2)
   echo "DATABASE_URL=postgresql://geist:${PW}@postgres:5432/geist" >> /opt/geist/.env
   chmod 600 /opt/geist/.env
   ```

4. **DNS + firewall**: point `geist.online` (and `www`) A/AAAA records at the VPS IP, and open
   ports **80** and **443** in the Strato firewall (Caddy needs 80 for the ACME challenge).

5. **Deploy.** Merge to `main` (or run the workflow manually) — CI scps the stack files to
   `/opt/geist` and starts everything. To trigger without a code change:
   ```bash
   gh workflow run "Build, Test and Deploy" --ref main
   ```

6. **Install the backup cron** (daily at 03:00) — after the first deploy has placed the scripts:
   ```bash
   ( crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/geist && bash scripts/backup.sh >> /opt/geist/backups/backup.log 2>&1" ) | crontab -
   ```

7. **Add the GitHub Secrets** listed above. Generate a passphrase-less CI key
   (`ssh-keygen -t ed25519 -C geist-ci -N ""`), add its public key to the VPS `~/.ssh/authorized_keys`,
   and put the private key in `VPS_SSH_KEY`. (If the key has a passphrase, also set
   `VPS_SSH_PASSPHRASE`.) This key is only for CI→VPS SSH/scp — it is unrelated to any GitHub access.

After this, every merge to `main` deploys automatically.

## Backups & restore

- Location: `/opt/geist/backups/daily/` (last 7) and `/opt/geist/backups/weekly/` (last 4 Sundays).
- Manual backup: `bash scripts/backup.sh`
- A pre-deploy backup is taken automatically by `scripts/deploy.sh`.

**Restore** a dump into the running database:
```bash
gunzip -c backups/daily/geist-<stamp>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Data safety across deploys

- Postgres uses the named volume `postgres_data`; `docker compose up -d` does not recreate it, so
  data survives every app redeploy.
- Backend migrations are idempotent (`CREATE TABLE IF NOT EXISTS`) and run at startup, so schema
  updates never drop data.
- The pre-deploy dump plus daily/weekly rotation provide recovery points.

## Rollback

Redeploy a previous commit's images by pinning the tag and re-running compose:
```bash
cd /opt/geist
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<old-short-sha>/" .env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```
