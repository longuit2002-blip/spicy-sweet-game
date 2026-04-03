# DevOps Implementation Plan For Sweet & Spicy

## Scope

This document turns the DevOps roadmap into a concrete implementation plan for this repo.

Current scope:

- Dockerize the monorepo for `apps/web` and `apps/api`
- Add Jenkins CI/CD
- Deploy to a cloud VM on AWS or GCP
- Do not introduce Kubernetes in this phase

Primary recommendation:

- `Jenkins + Docker + GHCR + AWS EC2`

Alternative:

- `Jenkins + Docker + GHCR + GCP Compute Engine`

## Current Repo State

### Monorepo shape

- `apps/web`: Next.js 16 app on port `3000`
- `apps/api`: NestJS 10 API / Socket.IO app
- `packages/shared-types`
- `packages/game-logic`

### Current root scripts

From `package.json`:

- `build = turbo run build`
- `dev = turbo run dev`
- `lint = turbo run lint`
- `dev:web = turbo run dev --filter=web`
- `dev:api = turbo run dev --filter=api`

### Current app scripts

`apps/web/package.json`

- `build:deps`
- `dev`
- `build`
- `start`
- `lint`

`apps/api/package.json`

- `build`
- `dev`
- `start`
- `lint`
- Prisma DB scripts

### Gaps before CI/CD

These are the main missing pieces:

1. No root `typecheck` script
2. No root `test` script
3. No Dockerfiles for `web` and `api`
4. No production compose file
5. No Jenkins pipeline
6. No deploy scripts
7. No cloud VM deployment guide in-repo

## Target Architecture

### Runtime architecture

For this phase, keep deployment simple:

- one cloud VM
- one `web` container
- one `api` container
- one Nginx reverse proxy on the VM

Traffic flow:

```text
Browser
  -> Nginx
    -> web container
    -> api container
```

Nginx routes:

- `/` -> `web`
- `/api` -> `api`
- `/socket.io` -> `api`

This is enough to learn:

- Docker build and runtime
- image registry push/pull
- SSH deployment
- reverse proxy
- websocket forwarding

## Implementation Phases

## Phase 1: Standardize Build And Env

### Goal

Make the repo predictable before introducing containers and CI.

### Files to add or update

- `package.json`
- `apps/web/package.json`
- `apps/api/package.json`
- `.env.example`
- `README.md`

### Required changes

1. Add root scripts:

- `typecheck`
- `test`
- `build:web`
- `build:api`

2. Add app-level typecheck scripts:

For `apps/web`:

- `typecheck = tsc --noEmit`

For `apps/api`:

- `typecheck = tsc --noEmit`

3. Decide test strategy for CI phase 1:

If no stable automated tests exist yet, define:

- `test = echo "No tests configured yet"`

That is acceptable temporarily, but document it clearly and replace it later.

4. Create one env example file for the repo:

Minimum variables to document:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `DATABASE_URL` if DB is required

### Done criteria

- `pnpm install`
- `pnpm lint`
- `pnpm build`
- `pnpm typecheck`

must all be runnable in a documented way.

## Phase 2: Dockerize Web And API

### Goal

Produce reproducible images for both apps and a local compose stack.

### Files to add

- `.dockerignore`
- `docker/web/Dockerfile`
- `docker/api/Dockerfile`
- `docker/compose/docker-compose.dev.yml`
- `docker/compose/docker-compose.prod.yml`

### Recommended `.dockerignore`

Ignore at least:

- `node_modules`
- `.next`
- `dist`
- `.turbo`
- `.git`
- local env files

### Web Dockerfile plan

File:

- `docker/web/Dockerfile`

Requirements:

1. Use multi-stage build
2. Install workspace dependencies with `pnpm`
3. Build workspace packages needed by `web`
4. Build the Next.js app
5. Start with `next start -p 3000`

Recommended stages:

1. `base`
2. `deps`
3. `builder`
4. `runner`

Important details:

- `apps/web` depends on workspace packages
- lockfile and workspace manifests must be copied early for cache efficiency
- runtime image should not include the whole repo if avoidable

### API Dockerfile plan

File:

- `docker/api/Dockerfile`

Requirements:

1. Use multi-stage build
2. Install workspace dependencies with `pnpm`
3. Build shared packages if needed
4. Build NestJS app
5. Start with `node dist/main.js`

Important details:

- Prisma runtime dependencies must be handled explicitly
- if Prisma client generation is needed inside image build, do it deterministically

### Dev compose plan

File:

- `docker/compose/docker-compose.dev.yml`

Use case:

- local containerized development or smoke validation

Services:

- `web`
- `api`

Optional later:

- `postgres`

### Prod compose plan

File:

- `docker/compose/docker-compose.prod.yml`

Use case:

- deployment on EC2 or Compute Engine

Requirements:

- pull tagged images from registry
- expose internal ports only as needed
- use env file on server
- restart policy enabled

### Done criteria

The following should work:

1. build `web` image
2. build `api` image
3. start both with compose
4. browser reaches app
5. web can call API
6. websocket connection works through compose

## Phase 3: Add CI Scripts

### Goal

Keep Jenkinsfile thin by moving logic into repo scripts.

### Files to add

- `scripts/ci/install.sh`
- `scripts/ci/typecheck.sh`
- `scripts/ci/lint.sh`
- `scripts/ci/test.sh`
- `scripts/ci/build.sh`
- `scripts/ci/docker-build.sh`
- `scripts/ci/docker-push.sh`

### Script design rules

- fail fast with non-zero exit code
- no interactive prompts
- no hardcoded branch names beyond one shared constant
- no embedded secrets

### Expected responsibilities

`install.sh`

- install dependencies with frozen lockfile

`typecheck.sh`

- run root and app-level type checks

`lint.sh`

- run lint commands

`test.sh`

- run tests or a temporary placeholder until tests exist

`build.sh`

- build shared packages and apps

`docker-build.sh`

- build `web` and `api` images with tags passed in via env vars

`docker-push.sh`

- push the built tags to registry

## Phase 4: Jenkins CI

### Goal

Make every push go through a clean quality and build pipeline.

### Files to add

- `Jenkinsfile`
- `ci/jenkins/README.md`

### Jenkins requirements

Jenkins server needs:

- Git access to the repo
- Docker available on the Jenkins runner
- registry credentials
- SSH deploy credentials for the target VM

### Suggested Jenkins pipeline

Stages:

1. `Checkout`
2. `Install`
3. `Typecheck`
4. `Lint`
5. `Test`
6. `Build`
7. `Docker Build`
8. `Docker Push`
9. `Deploy Staging`
10. `Deploy Production` later

### Tagging strategy

Use image tags derived from:

- branch name
- short commit SHA

Recommended examples:

- `web:main-abc1234`
- `api:main-abc1234`

Optionally also push:

- `web:latest`
- `api:latest`

Only for the main branch.

### Jenkins environment variables

Minimum required:

- `REGISTRY_HOST`
- `REGISTRY_NAMESPACE`
- `IMAGE_TAG`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`

### Jenkins credentials

Minimum required:

- registry username
- registry token/password
- SSH private key

## Phase 5: Cloud VM Deployment

### Goal

Deploy from Jenkins to a single Linux VM over SSH.

### Deployment model

Jenkins will:

1. SSH into the server
2. log in to the image registry
3. pull new image tags
4. restart containers with compose
5. run a health check

### Files to add

- `scripts/deploy/deploy-vm.sh`
- `scripts/deploy/rollback-vm.sh`
- `deploy/vm/README.md`
- `deploy/vm/.env.example`
- `deploy/vm/docker-compose.prod.yml`
- `deploy/vm/nginx/default.conf`

### What should live on the VM

Recommended directory:

```text
/opt/sweet-spicy/
  .env
  docker-compose.prod.yml
  nginx/
    default.conf
```

### VM prerequisites

Install on the VM:

- Docker Engine
- Docker Compose plugin
- Nginx
- Git optional

Open firewall ports:

- `80`
- `443`
- optional SSH port

### Health check plan

After deploy:

1. verify `web` container is running
2. verify `api` container is running
3. curl the app URL
4. curl API health endpoint if available

If any check fails:

- stop rollout
- revert to previous image tag

## Cloud Choice: AWS vs GCP

## Option A: AWS EC2

### Recommended for this repo

Use:

- Ubuntu EC2 instance
- security group
- elastic IP optional
- GHCR or ECR as image registry

### Why AWS EC2 first

- widely used
- lots of CI/CD learning material
- direct path later to ECS if needed

### AWS implementation backlog

1. create EC2 VM
2. open `80`, `443`, `22`
3. install Docker
4. install Nginx
5. copy `docker-compose.prod.yml`
6. copy env file
7. configure Jenkins SSH deploy

## Option B: GCP Compute Engine

### Also valid if you prefer GCP

Use:

- Ubuntu Compute Engine VM
- firewall rules
- static IP optional
- GHCR or Artifact Registry

### GCP implementation backlog

1. create VM
2. open `80`, `443`, `22`
3. install Docker
4. install Nginx
5. copy `docker-compose.prod.yml`
6. copy env file
7. configure Jenkins SSH deploy

## Recommended First Implementation

If the goal is fastest path with strongest learning value, use:

1. `GHCR` as registry
2. `AWS EC2` as target server
3. `Jenkins` on local machine or separate VM

That gives:

- clean CI/CD story
- low platform complexity
- easy debugging

## File-By-File Delivery Order

Implement in this exact order:

1. `.env.example`
2. root `package.json` script updates
3. `apps/web/package.json` typecheck script
4. `apps/api/package.json` typecheck script
5. `.dockerignore`
6. `docker/web/Dockerfile`
7. `docker/api/Dockerfile`
8. `docker/compose/docker-compose.dev.yml`
9. `docker/compose/docker-compose.prod.yml`
10. `scripts/ci/install.sh`
11. `scripts/ci/typecheck.sh`
12. `scripts/ci/lint.sh`
13. `scripts/ci/test.sh`
14. `scripts/ci/build.sh`
15. `scripts/ci/docker-build.sh`
16. `scripts/ci/docker-push.sh`
17. `Jenkinsfile`
18. `deploy/vm/docker-compose.prod.yml`
19. `deploy/vm/nginx/default.conf`
20. `scripts/deploy/deploy-vm.sh`
21. `scripts/deploy/rollback-vm.sh`
22. `ci/jenkins/README.md`
23. `deploy/vm/README.md`

## Acceptance Criteria

This phase is complete when:

1. `web` and `api` build successfully as Docker images
2. Jenkins pipeline can run install, typecheck, lint, build
3. Jenkins can push images to registry
4. Jenkins can SSH into the VM and deploy the new image tags
5. The app is reachable over public domain or server IP
6. Socket.IO still works behind Nginx

## Risks To Handle Early

### 1. Next.js runtime env assumptions

The frontend may assume `localhost` or build-time values.

Action:

- audit `NEXT_PUBLIC_API_URL`
- audit `NEXT_PUBLIC_SOCKET_URL`
- ensure production domain values are documented

### 2. Socket.IO reverse proxy configuration

Realtime connections often fail if proxy config is incomplete.

Action:

- include websocket upgrade headers in Nginx config
- test `/socket.io` explicitly after deploy

### 3. Prisma deployment behavior

If the API uses Prisma in production, migration and client generation must be explicit.

Action:

- decide whether deploy step runs migrations
- document rollback impact if DB schema changes

### 4. Missing automated tests

CI is weaker without tests.

Action:

- keep the test stage even if it starts minimal
- upgrade it later instead of skipping it entirely

## Immediate Next Step

The next practical step is not Jenkins yet.

The correct next step is:

1. standardize scripts and env
2. add Dockerfiles
3. prove local compose works
4. only then create Jenkins pipeline

## Recommended Follow-Up Docs

After this implementation plan, the next two useful docs are:

1. `docs/docker-implementation-spec.md`
2. `docs/jenkins-pipeline-spec.md`

The first should define exact Dockerfile contents and env flow.
The second should define exact Jenkins stages, credentials, and deploy commands.
