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

**Keep this file in sync with the repo.** When `DEPLOY_TO_EC2` is enabled, the workflow downloads the latest `docker/compose/docker-compose.prod.yml` from GitHub (same ref as the run) into `/opt/sweet-spicy/` before `compose up`. Manual deploys still need you to copy updates yourself. `.env` is never overwritten by CI.
- `deploy/vm/nginx/default.conf` → reference for `location` rules.
- **`deploy/vm/nginx/sites-available.sweetspicy.example.conf`** → **full** manual copy-paste vhost (same layout as the template).
- **`deploy/vm/nginx/sites-available.sweetspicy.template.conf`** + **`scripts/deploy/sync-nginx-sweetspicy.sh`** → used by **GitHub Actions** deploy: hostname is taken from **Actions variable `NEXT_PUBLIC_SOCKET_URL`** (scheme/path stripped). **Requires** Let’s Encrypt files at `/etc/letsencrypt/live/<host>/` on the VM (run `certbot` once); until then the script **skips** nginx (no failure). Requires **`ubuntu` passwordless `sudo`** for `tee` / `nginx` / `systemctl`. The template replaces **`/etc/nginx/sites-available/sweetspicy`** with **`/api/`** and **`/socket.io` → :8000** (fixes Certbot-only vhosts that only had **`/` → :3000**).
- **Manual / re-run on the VM (same layout as CI):** copy `scripts/deploy/run-nginx-sync-from-vm-env.sh` next to the template under **`/opt/sweet-spicy/.deploy-assets/`** (or use the files Actions uploads), ensure **`NEXT_PUBLIC_SOCKET_URL`** is set in **`/opt/sweet-spicy/.env`**, then:
  ```bash
  SWEET_SPICY_ENV=/opt/sweet-spicy/.env bash /opt/sweet-spicy/.deploy-assets/run-nginx-sync-from-vm-env.sh
  ```
  **`scripts/deploy/deploy-vm.sh`** runs this automatically when `.deploy-assets/run-nginx-sync-from-vm-env.sh` and **`/opt/sweet-spicy/.env`** exist.

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

## Database migrations

`scripts/deploy/deploy-vm.sh` now runs:

1. `docker compose up -d postgres redis`
2. `npx prisma migrate deploy` (inside one-off `api` container)
3. `docker compose up -d api web`

So every deploy applies committed Prisma migrations before the new API starts.
Use `prisma db push` only for quick local experiments, not production.

If your DB was initialized earlier with **`prisma db push`** (or any path that created tables **without** `_prisma_migrations`), the first `migrate deploy` can fail with **`P3018`** / Postgres **`42P07`** (`relation "User" already exists`). The schema is already there; Prisma just doesn’t know the migration ran.

**One-time fix on the VM** (needs `WEB_IMAGE` / `API_IMAGE` or `source deploy.env` so compose can start the `api` image):

```bash
cd /opt/sweet-spicy
set -a && source ./deploy.env && set +a

docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  sh -c "cd /app/apps/api && npx prisma migrate resolve --applied 20260405000000_init"

docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

Then re-run the GitHub deploy job (or finish `up -d api web` manually). **Only use `resolve --applied` if** the live database already matches that migration’s schema (typical after a prior `db push` of the same models).

## Run on the VM

1. `docker login ghcr.io` (or your registry).
2. Create `/opt/sweet-spicy/.env` from `.env.example`.
3. Export tags, for example: `export WEB_IMAGE=...` and `export API_IMAGE=...`, or `source deploy.env`.
4. `WEB_IMAGE=... API_IMAGE=... /opt/sweet-spicy/deploy-vm.sh`

## Health checks (from the spec)

```bash
docker ps
curl -sf http://127.0.0.1:3000/ >/dev/null && echo web ok
curl -sf http://127.0.0.1:8000/health && echo api ok
curl -sf http://YOUR_PUBLIC_HOST/api/health && echo via nginx ok
docker compose -f /opt/sweet-spicy/docker-compose.prod.yml exec redis redis-cli ping
```

TLS (Let’s Encrypt) is phase 2 in the spec; validate HTTP routing first.

### Nginx must receive traffic before Next (troubleshooting)

If `https://YOUR_DOMAIN/api/...` returns **HTML 404** from Next instead of JSON from the API, your public entrypoint is sending **`/api` to port 3000 only**. Fix one of:

1. **Preferred:** Point **Nginx** (or Cloudflare Tunnel) at **:80** on the VM and use `deploy/vm/nginx/default.conf` so `/api/` and `/socket.io` go to `127.0.0.1:8000`.
2. **Or:** Use a **new web image** built from this repo: the Dockerfile sets `API_PROXY_ORIGIN=http://api:8000`, so the Next standalone server proxies `/api/*` and `/socket.io` to the `api` service on the Compose network when you only publish the web container.

### Socket.IO / `wss://…/socket.io` fails (browser: WebSocket error)

REST can work (Next `app/api` proxy) while **realtime still breaks**: Socket.IO needs **WebSocket upgrade** to Nest on **:8000**. Next.js `rewrites` to `http://api:8000` are **not reliable for WebSockets** in production.

**Do this:**

1. **Nginx on the EC2 host** (recommended): install Nginx, use `deploy/vm/nginx/default.conf` — especially `location /socket.io` with `Upgrade` / `Connection` and `proxy_pass http://127.0.0.1:8000`. Point your Cloudflare Tunnel or DNS to **Nginx :80/:443**, not only to `:3000`.

2. **Cloudflare Tunnel without Nginx**: use **path-based ingress** so `/socket.io` hits the API port (example — adjust hostname and ports):

   ```yaml
   ingress:
     - hostname: sweetspicy.qzz.io
       path: /socket.io
       service: http://127.0.0.1:8000
     - hostname: sweetspicy.qzz.io
       service: http://127.0.0.1:3000
     - service: http_status:404
   ```

3. **On-VM checks (SSH):**

   ```bash
   # Nest answers Socket.IO polling (engine.io handshake)
   curl -sS "http://127.0.0.1:8000/socket.io/?EIO=4&transport=polling" | head -c 120

   # Via Nginx :80 — expect the same `0{"sid":...` prefix:
   curl -sS "http://127.0.0.1/socket.io/?EIO=4&transport=polling" | head -c 120

   # Via Nginx :443 — if this is wrong but :80 is right, copy `location /api/`, `/socket.io`, `/`
   # into the `server { listen 443 ssl; }` block (Certbot often creates TLS-only locations).
   curl -sk "https://127.0.0.1/socket.io/?EIO=4&transport=polling" -H "Host: YOUR_DOMAIN" | head -c 120
   ```

   If `8000` works but the browser does not, the **edge** (Tunnel / Nginx / Cloudflare) is not forwarding `/socket.io` to **8000** with WebSocket support.

## Scripts in `scripts/deploy/`

`deploy-vm.sh` and `rollback-vm.sh` are the standard deploy entrypoints after copying `docker-compose.prod.yml` into `/opt/sweet-spicy/`. They expect `WEB_IMAGE` and `API_IMAGE` in the environment (or `deploy.env`), and `deploy-vm.sh` also applies Prisma migrations automatically.
