# EC2 / VM deploy (Sweet & Spicy)

This folder supports the flow in **[docs/devops-setup-and-deploy.md](../../docs/devops-setup-and-deploy.md)**: Docker images for `web` and `api`, host Nginx on ports 80/443, apps bound to `127.0.0.1` only.

## What you need on the server

- Ubuntu 24.04 LTS (recommended in the spec)
- Docker Engine + Docker Compose plugin
- Nginx
- Directory layout:

```text
/opt/sweet-spicy/
  .env                 # from .env.example (secrets + runtime env)
  deploy.env           # optional: WEB_IMAGE / API_IMAGE tags
  docker-compose.prod.yml
  nginx/default.conf   # reference copy; active file lives under /etc/nginx/...
```

Copy from this repo:

- `docker/compose/docker-compose.prod.yml` → `/opt/sweet-spicy/docker-compose.prod.yml`
- `deploy/vm/nginx/default.conf` → use as the basis for `/etc/nginx/sites-available/...` (then `sites-enabled`, `nginx -t`, `systemctl reload nginx`)

## Build images (CI or laptop)

From the **repository root**:

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/YOUR_ORG/sweet-spicy-api:TAG .

docker build -f apps/web/Dockerfile -t ghcr.io/YOUR_ORG/sweet-spicy-web:TAG . \
  --build-arg NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://YOUR_DOMAIN
```

Push both tags to GHCR (or ECR), then set `WEB_IMAGE` / `API_IMAGE` on the server to those references.

**Important:** `NEXT_PUBLIC_*` values are compiled into the web bundle. If the public URL changes, rebuild and redeploy the **web** image.

## First-time database

Point `DATABASE_URL` in `.env` at your Postgres (managed DB recommended in the spec). From a machine that can reach the DB (or inside a one-off container using the API image):

```bash
docker run --rm -e DATABASE_URL="postgresql://..." ghcr.io/YOUR_ORG/sweet-spicy-api:TAG \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

(Use `prisma db push` only for quick experiments, not as a long-term production habit.)

## Run on the VM

1. `docker login ghcr.io` (or your registry).
2. Create `/opt/sweet-spicy/.env` from `.env.example`.
3. Export tags, for example: `export WEB_IMAGE=...` and `export API_IMAGE=...`, or `source deploy.env`.
4. `docker compose -f /opt/sweet-spicy/docker-compose.prod.yml pull && docker compose -f /opt/sweet-spicy/docker-compose.prod.yml up -d`

## Health checks (from the spec)

```bash
docker ps
curl -sf http://127.0.0.1:3000/ >/dev/null && echo web ok
curl -sf http://127.0.0.1:8000/health && echo api ok
curl -sf http://YOUR_PUBLIC_HOST/api/health && echo via nginx ok
```

TLS (Let’s Encrypt) is phase 2 in the spec; validate HTTP routing first.

## Scripts in `scripts/deploy/`

`deploy-vm.sh` and `rollback-vm.sh` are thin wrappers you can run on the server after copying `docker-compose.prod.yml` into `/opt/sweet-spicy/`. They expect `WEB_IMAGE` and `API_IMAGE` in the environment (or `deploy.env`).
