# Docker Implementation Spec For Sweet & Spicy

## Scope

This document defines the Docker implementation for the current monorepo.

Targets:

- `apps/web`
- `apps/api`
- shared workspace packages required by both apps

Out of scope:

- Kubernetes
- multi-environment orchestration beyond Docker Compose
- production observability stack

## Objectives

The Docker setup must satisfy these goals:

1. build both apps reproducibly
2. support local containerized validation
3. support Jenkins image build and push
4. support deployment to a single cloud VM
5. stay maintainable for a pnpm workspace monorepo

## Current Constraints

### Repo characteristics

- package manager: `pnpm@10.32.1`
- monorepo orchestrator: `turbo`
- frontend: `Next.js 16`
- backend: `NestJS 10`
- shared packages:
  - `@sweet-spicy/shared-types`
  - `@sweet-spicy/game-logic`

### Build constraints

`apps/web` depends on workspace builds:

- `pnpm --filter @sweet-spicy/shared-types build`
- `pnpm --filter @sweet-spicy/game-logic build`

`apps/api` also depends on workspace packages and may depend on Prisma artifacts.

This means both Dockerfiles must treat the monorepo as the build context, not only the individual app folders.

## Design Principles

1. Use multi-stage builds
2. Keep runtime images smaller than builder images
3. Separate dependency install from source copy for cache efficiency
4. Avoid copying the entire repo into final runtime image
5. Keep runtime env out of build steps unless required by framework constraints
6. Use one source of truth for ports and environment names

## File Layout

The Docker implementation should use this structure:

```text
.dockerignore
docker/
  web/
    Dockerfile
  api/
    Dockerfile
  compose/
    docker-compose.dev.yml
    docker-compose.prod.yml
```

## Shared Docker Conventions

### Base image

Use Node LTS on Alpine or Debian slim.

Preferred default:

- `node:22-alpine`

Fallback:

- `node:22-bookworm-slim`

Use Alpine only if all native dependencies build correctly. If Prisma or Next.js native behavior becomes unstable on Alpine, move both images to Debian slim for consistency.

### Package manager activation

Use `corepack enable` and pin `pnpm`.

Do not curl-install pnpm in each Dockerfile.

### Working directory

Use one shared constant:

- `/app`

### Shared build arguments

If needed later:

- `NODE_ENV`
- `APP_NAME`
- `COMMIT_SHA`

These should remain optional in phase 1.

## .dockerignore Specification

Create `.dockerignore` at repo root.

Minimum entries:

```text
node_modules
.next
dist
.turbo
.git
.github
.cursor
.agents
coverage
tmp
*.log
.env
.env.local
.env.*.local
```

Purpose:

- reduce build context size
- improve Docker cache efficiency
- avoid leaking local state or secrets into images

## Web Dockerfile Specification

File:

- `docker/web/Dockerfile`

### Responsibilities

1. install workspace dependencies
2. build required shared packages
3. build the Next.js web app
4. run the app on port `3000`

### Required stages

#### Stage 1: `base`

Responsibilities:

- define base image
- enable corepack
- set working directory

#### Stage 2: `deps`

Responsibilities:

- copy lockfile
- copy root `package.json`
- copy `pnpm-workspace.yaml`
- copy app package manifests
- copy package manifests from `packages/*`
- install dependencies with frozen lockfile

Key rule:

- this stage should copy only manifests first, not full source, to maximize cache reuse

#### Stage 3: `builder`

Responsibilities:

- copy repo source needed for build
- build shared packages
- build the Next.js app

Expected commands:

- build `@sweet-spicy/shared-types`
- build `@sweet-spicy/game-logic`
- build `web`

### Stage 4: `runner`

Responsibilities:

- copy only runtime artifacts
- expose `3000`
- run `next start -p 3000`

### Output strategy

Preferred approach:

- use Next.js standalone output if the app can support it cleanly

If standalone output is not yet configured:

- keep the initial runtime image simple
- copy `.next`, `public`, package metadata, and required node_modules

Recommendation:

Phase 1 should optimize for correctness first, then image size second.

### Environment variables

Web runtime will likely need:

- `PORT=3000`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`

Rule:

- document clearly which values are compile-time vs runtime
- avoid assuming `localhost` in production

## API Dockerfile Specification

File:

- `docker/api/Dockerfile`

### Responsibilities

1. install workspace dependencies
2. build shared packages
3. build the NestJS app
4. run the app from `dist/main.js`

### Required stages

#### Stage 1: `base`

Same purpose as `web`.

#### Stage 2: `deps`

Same pattern as `web`.

#### Stage 3: `builder`

Responsibilities:

- copy source
- generate Prisma client if required
- build shared packages
- build API

Important rule:

- if Prisma client generation is needed, make it explicit in this stage

#### Stage 4: `runner`

Responsibilities:

- copy compiled API artifact
- copy Prisma runtime files if needed
- expose backend port
- run `node dist/main.js`

### Environment variables

Minimum likely runtime values:

- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `DATABASE_URL`

If the API can start without DB for some flows, document that explicitly. Otherwise DB should be treated as required for deployment.

## Compose Specification

## docker-compose.dev.yml

Purpose:

- local validation of containerized stack
- smoke testing before CI/CD

Services:

- `web`
- `api`

Optional later:

- `postgres`

### Service naming

Use stable names:

- `sweet-spicy-web`
- `sweet-spicy-api`

Container names may be added if needed, but avoid overusing custom names unless debugging requires them.

### Web service requirements

- builds from `docker/web/Dockerfile`
- exposes `3000:3000`
- depends on API service
- injects runtime env needed by frontend

### API service requirements

- builds from `docker/api/Dockerfile`
- exposes `8000:8000` or the chosen API port
- injects runtime env

### Networking rules

- both services on one compose network
- `web` should call `api` using service hostname where appropriate in containerized runtime paths

## docker-compose.prod.yml

Purpose:

- deployment artifact for VM environments

This file should:

- use prebuilt images from registry
- not build locally on the server
- consume an env file stored on the server
- set restart policies

### Production services

- `web`
- `api`

Nginx can stay outside compose initially or be added later. For the first implementation, running Nginx directly on the VM is acceptable and simpler for learning.

## Port And URL Contract

Use a single explicit contract in docs and env files:

- `web` internal port: `3000`
- `api` internal port: `8000`
- public app URL: `https://<domain>`
- public API URL: `https://<domain>/api`
- public socket path: `https://<domain>/socket.io`

Avoid these anti-patterns:

- hardcoding `localhost` in production
- letting `web` and `api` each invent their own URLs
- duplicating port numbers across files without central documentation

## CI Build Contract

The Docker implementation must support Jenkins with these assumptions:

1. Jenkins checks out the repo
2. Jenkins runs Docker build with repo root as context
3. Jenkins tags both images
4. Jenkins pushes both images to registry

Required tag variables:

- `WEB_IMAGE`
- `API_IMAGE`
- `IMAGE_TAG`

Examples:

- `ghcr.io/<org>/sweet-spicy-web:<tag>`
- `ghcr.io/<org>/sweet-spicy-api:<tag>`

## Deployment Contract

The deployment phase will assume:

1. VM has Docker installed
2. VM has access to registry credentials
3. server stores production env file outside the repo
4. deployment updates image tags in compose or injects them via env vars

Recommended server directory:

```text
/opt/sweet-spicy/
  .env
  docker-compose.prod.yml
```

## Validation Checklist

Docker implementation is valid when all of the following pass:

### Build validation

1. `web` image builds successfully
2. `api` image builds successfully
3. build does not rely on undeclared local machine state

### Runtime validation

1. `docker compose -f docker/compose/docker-compose.dev.yml up` starts both services
2. homepage loads
3. API responds
4. websocket handshake succeeds

### Registry validation

1. Jenkins or local script can tag images
2. images push successfully to registry
3. images can be pulled on a clean machine

## Known Risks

### Next.js build/runtime mismatch

Risk:

- some frontend envs may be assumed at build time rather than runtime

Mitigation:

- document each env explicitly
- keep production build env stable

### Prisma runtime packaging

Risk:

- API image may fail if Prisma client or engine files are not copied correctly

Mitigation:

- verify Prisma generation during builder stage
- verify runtime starts on a clean environment

### Websocket proxy behavior

Risk:

- deployment works for HTTP but fails for Socket.IO

Mitigation:

- keep socket path consistent
- test websocket flows after compose and after cloud deploy

## Delivery Order

Implement Docker work in this sequence:

1. `.dockerignore`
2. `docker/web/Dockerfile`
3. `docker/api/Dockerfile`
4. `docker/compose/docker-compose.dev.yml`
5. `docker/compose/docker-compose.prod.yml`
6. local smoke validation
7. CI integration

## What Comes Next

After this Docker spec is implemented, the next document should be:

- `docs/jenkins-pipeline-spec.md`

That document should define:

- Jenkins stages
- required credentials
- tag strategy
- branch strategy
- deploy flow to AWS EC2 or GCP Compute Engine
