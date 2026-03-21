# Sweet & Spicy — monorepo

Turborepo + pnpm workspaces: **Next.js 15** (`apps/web`) + **NestJS** (`apps/api`) + shared packages `@sweet-spicy/shared-types` and `@sweet-spicy/game-logic`.

## Prerequisites

- Node 20+
- pnpm 9+
- PostgreSQL (for Prisma) — optional for socket-only dev if you stub env

## Setup

```bash
pnpm install
pnpm --filter api exec prisma generate
```

Copy environment files:

- `apps/api/.env.example` → `apps/api/.env`
- `apps/web/.env.local.example` → `apps/web/.env.local` (create if missing)

### `apps/api/.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for guest JWTs |
| `PORT` | API port (default `4000`) |
| `CLIENT_URL` | CORS origin for the Next app (e.g. `http://localhost:3000`) |

### `apps/web/.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | REST base URL (e.g. `http://localhost:4000`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL (same host/port as API, e.g. `http://localhost:4000`) |

## Database

```bash
docker compose up -d   # if using repo docker-compose for Postgres
pnpm --filter api exec prisma db push
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Turbo: all workspaces `dev` |
| `pnpm dev:web` | Next.js on :3000 |
| `pnpm dev:api` | NestJS API |
| `pnpm build` | Production build (packages → apps) |

## Structure

- `apps/web` — App Router, Zustand, Socket.IO client, shadcn/ui
- `apps/api` — NestJS, Prisma, Socket.IO gateway (`realtime`), JWT guest auth
- `packages/shared-types` — shared TypeScript contracts
- `packages/game-logic` — pure game engine (client + server)

### Notes

- **Workspace packages**: `apps/web/next.config.ts` aliases `@sweet-spicy/*` to each package’s `dist/` output so Next bundles the compiled ESM (NodeNext `.js` re-exports in `src/` are not fed to webpack).
- **Typecheck**: `typescript.ignoreBuildErrors` is enabled for the web app to avoid Next 15 typegen vs `@types/react` 18 peer-tree mismatches; run `pnpm --filter web exec tsc --noEmit` locally when tightening types.
