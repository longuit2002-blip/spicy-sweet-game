# DevOps: setup from scratch and deploy (Sweet & Spicy)

This is the **single source of truth** for taking the `spicy-sweet-game` monorepo from zero to a running production-like stack on a cloud VM, including Docker images, GitHub Container Registry (GHCR), AWS EC2, Nginx, and Jenkins. Earlier scattered specs have been merged here.

**What you get at the end**

- Two container images: **web** (Next.js) and **api** (NestJS + Socket.IO).
- One **Ubuntu** VM running Docker: containers listen on **localhost only**; **Nginx** on the host serves **80** (and **443** after TLS).
- A repeatable **manual** deploy and an optional **Jenkins** pipeline: build → push → SSH → `docker compose pull && up`.

**Out of scope for this guide**

- Kubernetes, ECS, load balancers, autoscaling HA.
- GCP is summarized in an appendix (same pattern as EC2).

**Recommended stack for learning**

`Jenkins` + `Docker` + `GHCR` + `AWS EC2` + host `Nginx`.

---

## Table of contents

1. [Architecture and ports](#1-architecture-and-ports)
2. [Part 0 — Run the app locally (before Docker)](#2-part-0--run-the-app-locally-before-docker)
3. [Part 1 — Docker images in this repo](#3-part-1--docker-images-in-this-repo)
4. [Part 2 — Build, tag, and push images (GHCR)](#4-part-2--build-tag-and-push-images-ghcr)
5. [Part 3 — AWS EC2 from scratch](#5-part-3--aws-ec2-from-scratch)
6. [Part 4 — Prepare the server (Docker, Nginx, `/opt/sweet-spicy`)](#6-part-4--prepare-the-server-docker-nginx-optsweet-spicy)
7. [Part 5 — Environment variables and URL rules](#7-part-5--environment-variables-and-url-rules)
8. [Part 6 — PostgreSQL and Prisma migrations](#8-part-6--postgresql-and-prisma-migrations)
9. [Part 7 — First manual deploy on the VM](#9-part-7--first-manual-deploy-on-the-vm)
10. [Part 8 — Verify, health checks, and troubleshooting](#10-part-8--verify-health-checks-and-troubleshooting)
11. [Part 9 — Jenkins CI/CD](#11-part-9--jenkins-cicd)
12. [Part 10 — TLS (HTTPS) with Let’s Encrypt](#12-part-10--tls-https-with-lets-encrypt)
13. [Part 11 — Rollback](#13-part-11--rollback)
14. [Appendix A — Repo files reference](#appendix-a--repo-files-reference)
15. [Appendix B — GCP Compute Engine (same model)](#appendix-b--gcp-compute-engine-same-model)
16. [Appendix C — Later: Kubernetes (learning only)](#appendix-c--later-kubernetes-learning-only)
17. [Appendix D — Redeploy when code changes (Vietnamese)](#appendix-d--redeploy-when-code-changes-vietnamese)

---

## 1. Architecture and ports

```text
Browser
  -> Nginx on VM :80 / :443
       -> http://127.0.0.1:3000  (web container)
       -> http://127.0.0.1:8000  (api container) for /api/ and /socket.io
```

| Path on public URL | Proxied to |
|--------------------|------------|
| `/` | web:3000 |
| `/api/...` | api:8000 with **`/api` prefix stripped** (Nest serves `/auth/...`, `/health`, not `/api/auth/...`) |
| `/socket.io...` | api:8000 with **websocket** upgrade headers |

**Why two ports**

- Local development often uses API on **3001**; **production behind Nginx uses API `PORT=8000`** to match the compose and proxy examples. Set `PORT=8000` in server `.env`.

**Security group**

- Allow **22** (SSH, ideally from your IP only), **80**, **443**.
- Do **not** expose **3000** or **8000** to the world; only Nginx is public.

---

## 2. Part 0 — Run the app locally (before Docker)

Confirm the repo builds and runs on your machine (PostgreSQL required for API). Follow the root **[README.md](../README.md)**:

- Install **Node 20+**, **pnpm 10** (Corepack), dependencies: `pnpm install`.
- Prisma: `pnpm --filter api exec prisma generate`, `prisma db push` (or migrations) with `DATABASE_URL`.
- Dev: `pnpm dev:api` and `pnpm dev:web` (or `pnpm dev`).

If local dev does not work, Docker and deploy will fail for the same reasons.

---

## 3. Part 1 — Docker images in this repo

Build context is always the **repository root** (monorepo: shared packages `@sweet-spicy/shared-types`, `@sweet-spicy/game-logic`).

| Artifact | Path |
|----------|------|
| Web Dockerfile | `apps/web/Dockerfile` (multi-stage, `turbo prune web`, Next **standalone**) |
| API Dockerfile | `apps/api/Dockerfile` (Prisma generate + Nest build) |
| Build ignore | `.dockerignore` |
| Production compose (copy to server) | `docker/compose/docker-compose.prod.yml` |
| Nginx site config (copy to server) | `deploy/vm/nginx/default.conf` |
| Env template | `deploy/vm/.env.example` |
| Deploy script | `scripts/deploy/deploy-vm.sh` |
| Jenkins stub | `Jenkinsfile` |

**Web image build-time variables (required for production)**

`NEXT_PUBLIC_*` are inlined at **build** time. They must match what browsers will use:

```bash
docker build -f apps/web/Dockerfile -t ghcr.io/YOUR_ORG/sweet-spicy-web:TAG . \
  --build-arg NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://YOUR_DOMAIN
```

For a first test over **HTTP** and raw IP, use `http://YOUR_PUBLIC_IP` in place of `https://YOUR_DOMAIN` (no trailing slash on `NEXT_PUBLIC_SOCKET_URL`).

**API image**

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/YOUR_ORG/sweet-spicy-api:TAG .
```

---

## 4. Part 2 — Build, tag, and push images (GHCR)

### 4.1 Where to build (important)

| Where | When to use |
|-------|----------------|
| **Your laptop / desktop** | **Recommended.** Plenty of disk; avoids `ERR_PNPM_ENOSPC` / `no space left on device` on small EC2 roots. |
| **EC2 same as production** | Only if the root volume has **≥30 GiB free** for *both* images (Next.js + full `pnpm install` is large). **8 GiB / 12 GiB roots usually cannot build both.** |
| **CI (Jenkins, GitHub Actions)** | Best long-term: build there, push to GHCR, server only pulls. |

Always build from the **repository root** (directory that contains `apps/`, `pnpm-lock.yaml`, `package.json`).

### 4.2 Build commands (same on laptop or server)

Replace `YOUR_ORG`, `TAG`, and public URLs (example IP: `http://100.48.53.117`).

```bash
cd /path/to/spicy-sweet-game
git pull

docker build --no-cache -f apps/api/Dockerfile \
  -t ghcr.io/YOUR_ORG/sweet-spicy-api:TAG .

docker build --no-cache -f apps/web/Dockerfile \
  -t ghcr.io/YOUR_ORG/sweet-spicy-web:TAG . \
  --build-arg NEXT_PUBLIC_API_URL=http://YOUR_PUBLIC_IP/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://YOUR_PUBLIC_IP
```

Example for public IP `100.48.53.117`:

```bash
  --build-arg NEXT_PUBLIC_API_URL=http://100.48.53.117/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://100.48.53.117
```

### 4.3 If you already built **api** on EC2 and **web** fails with `ENOSPC`

1. **Push api** so you do not lose it, then free cache (keeps tagged images; removes build cache):

   ```bash
   docker login ghcr.io -u YOUR_GITHUB_USERNAME
   docker push ghcr.io/YOUR_ORG/sweet-spicy-api:TAG
   docker builder prune -af
   sudo apt-get clean
   df -h /
   ```

2. Remove **old** tags you no longer need (example): `docker rmi ghcr.io/YOUR_ORG/sweet-spicy-api:v1` only if `v2` exists locally or is already pushed.

3. **Build web again.** If `df` still shows **under ~5 GiB free**, do **not** keep fighting on that VM — **grow the EBS volume** (see troubleshooting table in §10) or run the **web** `docker build` on your **PC**, then `docker push` both images.

### 4.4 Log in and push

1. Create a GitHub PAT with `write:packages` (see [GitHub docs](https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages)). Do **not** commit the token.
2. On the machine that built the images:

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
docker push ghcr.io/YOUR_ORG/sweet-spicy-web:TAG
docker push ghcr.io/YOUR_ORG/sweet-spicy-api:TAG
```

**Tagging rule**

- Prefer immutable tags: `main-abc1234` or Git SHA — not `latest` alone for production deploys.

---

## 5. Part 3 — AWS EC2 from scratch

1. **Create a key pair** in EC2 and download the `.pem`. On Linux/macOS: `chmod 400 key.pem`.
2. **Launch instance**
   - AMI: **Ubuntu Server 24.04 LTS**.
   - Instance type: **t3.small** (or **t3.micro** / free tier if you accept lighter headroom).
   - Storage: at least **30 GiB** gp3 if you plan to **build Docker images on the instance**; **20 GiB** can be enough for **pull-only** deploys.
   - Security group **inbound**: TCP **22** (your IP preferred), **80**, **443** from `0.0.0.0/0`.
3. **Elastic IP** (optional): allocate and associate so DNS and SSH targets stay stable.
4. **DNS** (optional): `A` record pointing to the public IP for real TLS later.

**SSH**

```bash
ssh -i /path/to/key.pem ubuntu@EC2_PUBLIC_IP
```

---

## 6. Part 4 — Prepare the server (Docker, Nginx, `/opt/sweet-spicy`)

### 6.1 Install Docker and Nginx

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg nginx git

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME:-stable}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

### 6.2 Deploy tree and Docker permissions

```bash
sudo mkdir -p /opt/sweet-spicy/logs
sudo chown -R "$USER:$USER" /opt/sweet-spicy
sudo usermod -aG docker ubuntu
```

**Log out and SSH back in** so `docker` works without `sudo`.

**Optional dedicated user** `deploy` (for Jenkins SSH): `sudo adduser deploy`, add to `docker` group, install your public key in `~/.ssh/authorized_keys`. If you skip this, Jenkins can use `ubuntu`.

### 6.3 Nginx configuration

Never copy a fake path like `/path/from/repo`. Get the real file **`deploy/vm/nginx/default.conf`** onto the server, then:

```bash
sudo cp /path/where/you/put/default.conf /etc/nginx/sites-available/sweet-spicy
sudo ln -sf /etc/nginx/sites-available/sweet-spicy /etc/nginx/sites-enabled/sweet-spicy
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**If `nginx -t` failed** (broken symlink / missing file):

```bash
sudo rm -f /etc/nginx/sites-enabled/sweet-spicy
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**Ways to get `default.conf`**

- Clone repo: `git clone ... && sudo cp spicy-sweet-game/deploy/vm/nginx/default.conf /etc/nginx/sites-available/sweet-spicy`
- From laptop: `scp -i key.pem deploy/vm/nginx/default.conf ubuntu@IP:/tmp/` then `sudo mv /tmp/default.conf /etc/nginx/sites-available/sweet-spicy`

### 6.4 Copy compose, env, and deploy script

On the server, `/opt/sweet-spicy/` should contain:

```text
/opt/sweet-spicy/
  .env                      # secrets + runtime (from deploy/vm/.env.example)
  docker-compose.prod.yml   # from docker/compose/docker-compose.prod.yml
  deploy-vm.sh              # from scripts/deploy/deploy-vm.sh (chmod +x)
  deploy.env                # optional: WEB_IMAGE=... API_IMAGE=...
  logs/
```

```bash
cp /path/to/repo/docker/compose/docker-compose.prod.yml /opt/sweet-spicy/docker-compose.prod.yml
cp /path/to/repo/scripts/deploy/deploy-vm.sh /opt/sweet-spicy/deploy-vm.sh
chmod +x /opt/sweet-spicy/deploy-vm.sh
cp /path/to/repo/deploy/vm/.env.example /opt/sweet-spicy/.env
nano /opt/sweet-spicy/.env   # edit real values
```

Compose expects **`WEB_IMAGE`** and **`API_IMAGE`** in the **shell environment** when you run `docker compose` (or export them from `deploy.env` before `up`). The `.env` file supplies app runtime vars (`PORT`, `DATABASE_URL`, etc.).

---

## 7. Part 5 — Environment variables and URL rules

### 7.1 On the VM (`/opt/sweet-spicy/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | **Do not set in `.env`** when using `docker-compose.prod.yml`: Compose sets **`web` → 3000** and **`api` → 8000**. A single `PORT=8000` in `.env` was applied to **both** containers and broke Next (502 / connection reset). |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Used by the **`postgres`** service in `docker-compose.prod.yml` (DB on the same VM). |
| `DATABASE_URL` | API connection string. With bundled Compose Postgres, host is **`postgres`** (service name), port **5432**, password must match `POSTGRES_PASSWORD`. For RDS etc., use the cloud hostname instead. |
| `JWT_SECRET` | Strong secret in production. |
| `CLIENT_URL` | Browser origin allowed by CORS — e.g. `http://YOUR_IP` or `https://your.domain`. |
| `NEXT_PUBLIC_API_URL` | Must be **`https://domain/api`** or **`http://IP/api`** — includes `/api` path; client calls `${NEXT_PUBLIC_API_URL}/auth/...`. |
| `NEXT_PUBLIC_SOCKET_URL` | Scheme + host **only**, e.g. `https://your.domain` (no `/socket.io`). |

**Rule:** production values must **not** stay `localhost`. After TLS, switch `http` → `https` everywhere and **rebuild the web image** with matching `--build-arg` values.

### 7.2 Nginx and `/api`

The repo’s Nginx config uses `location /api/` with `proxy_pass http://127.0.0.1:8000/;` so **`/api` is stripped**. Public health check: `http://YOUR_HOST/api/health` → upstream `/health`.

---

## 8. Part 6 — PostgreSQL and Prisma migrations

Production **`docker-compose.prod.yml`** in this repo includes a **`postgres`** container on the same VM (no public DB port; only `api` talks to it). For serious production, prefer **managed Postgres** instead and remove or stop the bundled `postgres` service.

Set `DATABASE_URL`, `POSTGRES_PASSWORD`, etc. in `/opt/sweet-spicy/.env` (see `deploy/vm/.env.example`).

**Apply schema after containers are up** — on the VM from `/opt/sweet-spicy` (uses the running `api` container and the same `.env`):

```bash
cd /opt/sweet-spicy
docker compose -f docker-compose.prod.yml exec api \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

If you use **only** a remote DB (no `postgres` service), you can instead run a one-off container with `DATABASE_URL` set:

```bash
docker run --rm --env-file /opt/sweet-spicy/.env ghcr.io/YOUR_ORG/sweet-spicy-api:TAG \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

Use **`migrate deploy`** in production, not `db push`, once you rely on migration history. Rollback of **application** images does not undo DB schema; plan migrations and backups separately.

---

## 9. Part 7 — First manual deploy on the VM

**Prerequisite:** images exist in GHCR (or another registry the VM can pull from).

On the EC2 instance:

```bash
docker login ghcr.io
cd /opt/sweet-spicy
export WEB_IMAGE=ghcr.io/YOUR_ORG/sweet-spicy-web:TAG
export API_IMAGE=ghcr.io/YOUR_ORG/sweet-spicy-api:TAG
./deploy-vm.sh
```

`deploy-vm.sh` runs `docker compose -f docker-compose.prod.yml pull` and `up -d`.

---

## 10. Part 8 — Verify, health checks, and troubleshooting

```bash
docker ps
curl -sf http://127.0.0.1:3000/ >/dev/null && echo "web ok"
curl -sf http://127.0.0.1:8000/health && echo "api ok"
curl -sf "http://127.0.0.1/api/health" && echo "nginx+api ok"
```

Open `http://EC2_PUBLIC_IP` in a browser.

| Symptom | Likely cause |
|---------|----------------|
| UI loads, API 404 or wrong path | `NEXT_PUBLIC_API_URL` missing `/api` suffix or Nginx prefix strip misconfigured. |
| HTTP works, realtime broken | Nginx missing `Upgrade` / `Connection` for `/socket.io`; wrong `NEXT_PUBLIC_SOCKET_URL`. |
| CORS errors | `CLIENT_URL` must exactly match the site origin (scheme + host + port). |
| Prisma errors | `DATABASE_URL` wrong; migrations not applied. |
| Docker build **`no space left on device`** / **`ENOSPC`** on EC2 | Root volume too small (common with **8 GiB**). **Grow the EBS volume** to **≥30 GiB**, or run **`docker builder prune -af`** / **`docker system prune -af`** before rebuilding, or build images on your **laptop** and **push** to GHCR. The **API** Dockerfile uses **`turbo prune api`** to reduce install size, but multi-stage builds still need spare disk. |

**Disk:** periodically `docker system prune` with care — do not delete volumes you need.

---

## 11. Part 9 — Jenkins CI/CD

### 11.1 Principles

- **Fail early:** no Docker build/push/deploy if install, typecheck, lint, test, or non-Docker build fails.
- **Thin Jenkinsfile:** keep orchestration in Jenkins; long shell logic belongs in `scripts/ci/*` (add scripts as you grow).
- **Immutable deploy tags:** pass `WEB_IMAGE` / `API_IMAGE` with full digest or `org/name:sha`.

### 11.2 Credentials (examples)

| Jenkins credential ID | Use |
|------------------------|-----|
| `ghcr-username` / `ghcr-token` (or single user/pass) | `docker login ghcr.io` on the agent |
| `sweet-spicy-deploy-ssh` | SSH private key for `ubuntu` or `deploy` on EC2 |

### 11.3 Global environment / job parameters

Suggested:

- `REGISTRY_HOST=ghcr.io`
- `REGISTRY_NAMESPACE` (GitHub org or user, lowercase)
- `WEB_IMAGE_NAME=sweet-spicy-web`
- `API_IMAGE_NAME=sweet-spicy-api`
- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH=/opt/sweet-spicy`
- `PUBLIC_DOMAIN` or `NEXT_PUBLIC_API_BASE` for web build-args

**Image tag pattern**

- `sanitized-branch-shortsha`, e.g. `main-a1b2c3d4`.

### 11.4 Pipeline stages (target topology)

```text
Checkout → Install → Typecheck → Lint → Test → Build → Docker build (web+api) → Docker push → Deploy (SSH, main/develop only)
```

1. **Checkout** — record `GIT_COMMIT`, branch.
2. **Install** — `pnpm install --frozen-lockfile` (from repo root).
3. **Typecheck** — e.g. `pnpm --filter web exec tsc --noEmit` and `pnpm --filter api exec tsc --noEmit` when those scripts exist; or a root `pnpm typecheck` if you add it to `package.json`.
4. **Lint** — `pnpm lint`.
5. **Test** — `pnpm test` or placeholder until tests exist (**keep the stage**).
6. **Build** — `pnpm build` (validates monorepo without Docker).
7. **Docker build** — root context, both Dockerfiles, pass `NEXT_PUBLIC_*` build-args to **web**.
8. **Docker push** — both tags to GHCR.
9. **Deploy** — SSH: `export WEB_IMAGE=... API_IMAGE=... && /opt/sweet-spicy/deploy-vm.sh` (only on protected branches).

The repo root **`Jenkinsfile`** is a stub: replace `echo` lines with real `sh` and `sshagent`/`ssh` steps.

### 11.5 Branch policy

- **Feature branches:** CI only (no deploy).
- **`main`** (or `develop`): CI + push + deploy to your VM.

### 11.6 Logging safety

Never print tokens, `.env` contents, or private keys in build logs.

---

## 12. Part 10 — TLS (HTTPS) with Let’s Encrypt

1. Point DNS **A** record at the server.
2. Install Certbot and the Nginx plugin on Ubuntu (`certbot python3-certbot-nginx`), obtain cert for your domain.
3. Update **all** URLs to `https://`:
   - `/opt/sweet-spicy/.env`: `CLIENT_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`
   - Rebuild and redeploy **web** with matching `--build-arg`.
4. Reload Nginx.

Validate on **HTTP** first in a new setup; add TLS once routing and env are correct.

---

## 13. Part 11 — Rollback

1. Record the last known-good **image tags** after each successful deploy.
2. On the VM:

```bash
export WEB_IMAGE=ghcr.io/ORG/sweet-spicy-web:OLD_TAG
export API_IMAGE=ghcr.io/ORG/sweet-spicy-api:OLD_TAG
/opt/sweet-spicy/deploy-vm.sh
```

3. Do **not** expect automatic DB downgrades; handle schema separately.

---

## Appendix A — Repo files reference

| File | Role |
|------|------|
| `apps/web/Dockerfile` | Web production image |
| `apps/api/Dockerfile` | API production image |
| `docker/compose/docker-compose.prod.yml` | Pull-only production compose |
| `deploy/vm/nginx/default.conf` | Nginx site |
| `deploy/vm/.env.example` | Server env template |
| `deploy/vm/deploy.env.example` | Optional image-tag env file |
| `scripts/deploy/deploy-vm.sh` | Pull + compose up |
| `scripts/deploy/rollback-vm.sh` | Same as deploy with old tags |
| `Jenkinsfile` | Pipeline stub |
| `deploy/vm/README.md` | Short VM-focused notes |

---

## Appendix B — GCP Compute Engine (same model)

- One **Ubuntu** VM, firewall rules **tcp:22,80,443**, static IP optional.
- Install Docker and Nginx identically.
- Same `/opt/sweet-spicy` layout and Jenkins SSH deploy; registry can stay **GHCR** or use **Artifact Registry**.

---

## Appendix C — Later: Kubernetes (learning only)

After VM-based deploy is boring and reliable, you can practice **k3d**, **minikube**, or a small cloud cluster: Deployments, Services, Ingress, probes, ConfigMaps/Secrets. That path is **optional** and **not** required to ship this repo on EC2.

---

## Appendix D — Redeploy when code changes (Vietnamese)

For a Vietnamese guide on **which changes require rebuilding `web` vs `api`**, updating `.env`, and running **`deploy-vm.sh`** again, see **[huong-dan-deploy-lai-khi-doi-code.md](./huong-dan-deploy-lai-khi-doi-code.md)**.

---

## Acceptance checklist (end-to-end)

1. Local dev works per README.
2. Both images build from repo root; web image built with correct `NEXT_PUBLIC_*` build-args.
3. Images push to GHCR; VM can `docker pull` them.
4. EC2: Docker + Nginx + `/opt/sweet-spicy` + `.env` + compose + `deploy-vm.sh`.
5. Manual `./deploy-vm.sh` succeeds; site and `/api/health` work; Socket.IO functions in the app.
6. Jenkins (optional) runs CI, pushes tags, SSH deploys; rollback via old tags works.
