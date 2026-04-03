# Sweet & Spicy — monorepo

Turborepo + pnpm workspaces: **Next.js 16** (`apps/web`, React 19) + **NestJS** (`apps/api`) + shared packages `@sweet-spicy/shared-types` and `@sweet-spicy/game-logic`.

## Prerequisites

- **Node.js** 20 or newer (LTS recommended)
- **pnpm** 10.x (pinned in `packageManager`; see [Package manager](#package-manager))
- **PostgreSQL** 16+ — required for the API on startup (Prisma connects when Nest boots). The repo includes Docker Compose for a local database.

## Run the app: frontend and backend

From the **repository root**, use **two terminals** (API first is fine; Next.js needs the API for full functionality).

**Backend — NestJS (`apps/api`), default port 3001**

```bash
pnpm dev:api
```

**Frontend — Next.js (`apps/web`), port 3000**

```bash
pnpm dev:web
```

Then open the UI at [http://localhost:3000](http://localhost:3000). Check the API at [http://localhost:3001/health](http://localhost:3001/health).

**Single terminal — everything Turbo runs in dev** (API, web, and workspace package watchers):

```bash
pnpm dev
```

Do the [Quick start](#quick-start) steps once (install, env, database) before the first run.

## Quick start

From the repository root:

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Generate Prisma Client**

   ```bash
   pnpm --filter api exec prisma generate
   ```

3. **Build shared workspace packages once**  
   Next.js resolves `@sweet-spicy/*` to compiled files under each package’s `dist/`. Build them before the first `dev:web` (or run full `pnpm dev` and wait for the package `tsc --watch` tasks to emit `dist/`).

   ```bash
   pnpm exec turbo run build --filter=@sweet-spicy/shared-types --filter=@sweet-spicy/game-logic
   ```

4. **Environment files**

   - Copy `apps/api/.env.example` → `apps/api/.env`
   - Copy `apps/web/.env.local.example` → `apps/web/.env.local`

5. **Database**

   Start Postgres (Docker example):

   ```bash
   docker compose up -d
   ```

   Apply the schema:

   ```bash
   pnpm --filter api exec prisma db push
   ```

6. **Run the app** — same commands as [Run the app: frontend and backend](#run-the-app-frontend-and-backend): `pnpm dev:api` and `pnpm dev:web` in two terminals, or `pnpm dev` in one.

7. **URLs**

   - Web: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:3001](http://localhost:3001) (default `PORT` in `apps/api/src/main.ts`)
   - Health: [http://localhost:3001/health](http://localhost:3001/health)

### Package manager

The repo pins `packageManager` to **pnpm@10.32.1** (Corepack reads this when you run `pnpm` from the Node.js install).

- **Windows:** If `where.exe pnpm` lists `...\AppData\Local\pnpm\pnpm` *above* your Node.js folder, that **standalone** pnpm wins and **Corepack is ignored**. You will keep seeing whatever version that binary is (e.g. 9.15) even after `corepack prepare pnpm@10.32.1 --activate`. Fix: in **Environment Variables → Path**, move **Node.js** (e.g. `C:\Program Files\nodejs\`) **above** `...\AppData\Local\pnpm`, or remove the standalone pnpm path; open a **new** terminal and run `corepack enable` then `pnpm -v`.

- If `pnpm` is not found, use **Corepack**:

  ```bash
  corepack enable
  corepack prepare pnpm@10.32.1 --activate
  ```

- Or prefix with **npx** (no global install):

  ```bash
  npx pnpm@10.32.1 install
  npx pnpm@10.32.1 dev:web
  ```

### pnpm 10: allowed install scripts

pnpm 10 ignores dependency `postinstall` scripts unless they are allowlisted. This repo already sets `onlyBuiltDependencies` in `pnpm-workspace.yaml` (Prisma, `sharp`, etc.), so a normal `pnpm install` should run those scripts without prompts.

If you still see **Ignored build scripts** after a fresh clone or dependency change, approve them and re-install:

```bash
pnpm approve-builds
pnpm install
```

To approve every pending package in one step (non-interactive):

```bash
pnpm approve-builds --all
pnpm install
```

## Environment variables

### `apps/api/.env`

| Variable       | Description |
|----------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`   | Secret for guest JWTs (optional in dev; code has a fallback — set explicitly in production) |
| `PORT`         | API port (**default `3001`** in code) |
| `CLIENT_URL`   | Allowed browser origin for CORS (**default `http://localhost:3000`**) |

### `apps/web/.env.local`

| Variable                  | Description |
|---------------------------|-------------|
| `NEXT_PUBLIC_API_URL`     | REST base URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_SOCKET_URL`  | Socket.IO URL (same host/port as the API) |

If these are omitted, the web app falls back to `http://localhost:3001` for API and Socket.IO.

## Database (Docker Compose)

`docker-compose.yml` runs Postgres 16 with:

- User / password: `postgres` / `postgres`
- Database: `sweet_spicy`
- **Host port `5433`** maps to Postgres `5432` inside the container (avoids clashing with another Postgres already using `5432` on Windows or macOS).

Example `DATABASE_URL` (matches `apps/api/.env.example`):

```text
postgresql://postgres:postgres@127.0.0.1:5433/sweet_spicy
```

After `docker compose up -d`, sync the schema:

```bash
pnpm --filter api exec prisma db push
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | **Backend** — NestJS API + Socket.IO (watch), default [http://localhost:3001](http://localhost:3001) |
| `pnpm dev:web` | **Frontend** — Next.js dev server, [http://localhost:3000](http://localhost:3000) |
| `pnpm dev` | Turbo: all workspaces `dev` (API + web + shared package `tsc --watch`) |
| `pnpm build` | Production build (packages first, then apps) |
| `pnpm lint` | Lint via Turbo |
| `pnpm approve-builds` | pnpm 10+: interactively allow dependency install scripts (updates `pnpm-workspace.yaml`) |
| `pnpm approve-builds --all` | Approve all pending build scripts without prompts |

API database scripts (from repo root):

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma db push
pnpm --filter api exec prisma migrate dev
```

## Troubleshooting

- **`pnpm` not found** — Use [Package manager](#package-manager) (Corepack or `npx pnpm@10.32.1`).
- **`pnpm -v` stuck on 9.x after Corepack / install** — On Windows, standalone pnpm in `%LOCALAPPDATA%\pnpm` often comes first on `PATH`; reorder or remove that entry so Node’s `pnpm` shim (Corepack) runs. See [Package manager](#package-manager).
- **`Ignored build scripts` (pnpm 10)** — See [pnpm 10: allowed install scripts](#pnpm-10-allowed-install-scripts) for the exact commands (`pnpm approve-builds` then `pnpm install`). This repo pre-lists common packages in `pnpm-workspace.yaml`.
- **Next.js cannot resolve `@sweet-spicy/...`** — Run the [shared package build](#quick-start) step so `packages/*/dist/` exists.
- **API crashes on startup with Prisma `P1000` / connection errors** — Postgres is not running, or `DATABASE_URL` in `apps/api/.env` does not match your server (host port, user, password, database name). With this repo’s Compose file, use port **5433** on the host. If you still see “credentials not valid” while Docker is up, another service may be bound to that port — check `docker ps` and that `DATABASE_URL` uses `127.0.0.1` and the Compose-mapped port.
- **CORS or Socket.IO from the browser** — Ensure `CLIENT_URL` matches the Next.js origin (e.g. `http://localhost:3000`) and that `NEXT_PUBLIC_*` URLs point at the API port.
- **React hydration warning on `<div hidden>` with `bis_skin_checked` / `bis_register`** — Those attributes are injected by **browser extensions** (often password managers) into Next.js’s own metadata placeholder and `<body>`. They are not from this app. Use a private/incognito window with extensions disabled, or turn off “inject” / autofill features for `localhost`, to clear the warning. `suppressHydrationWarning` is already set on `<html>` and `<body>` where we control the markup.

## Structure

- `apps/web` — App Router, Zustand, Socket.IO client, shadcn/ui
- `apps/api` — NestJS, Prisma, Socket.IO gateway (`realtime`), JWT guest auth
- `packages/shared-types` — shared TypeScript contracts
- `packages/game-logic` — pure game engine (client + server)
- **`docs/devops-setup-and-deploy.md`** — Docker, AWS EC2, Nginx, registry, and Jenkins from scratch through deploy (older DevOps/EC2 doc names redirect there)

### Notes

- **Workspace packages**: `apps/web/next.config.ts` aliases `@sweet-spicy/*` to each package’s `dist/` output so Next bundles the compiled ESM (NodeNext `.js` re-exports in `src/` are not fed to webpack). **Next.js 16** defaults to Turbopack; this repo uses **`next dev` / `next build` with `--webpack`** because Turbopack on Windows still errors on these absolute `resolveAlias` paths (“windows imports are not implemented yet”). `turbopack.resolveAlias` is kept for when that limitation is lifted.
- **Typecheck**: `typescript.ignoreBuildErrors` is enabled for the web app so installs stay usable while generated types and dependencies catch up to React 19 / Next 16; run `pnpm --filter web exec tsc --noEmit` locally when tightening types.
