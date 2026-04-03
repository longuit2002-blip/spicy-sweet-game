# Jenkins Pipeline Spec For Sweet & Spicy

## Scope

This document defines the Jenkins pipeline design for the current repo.

Pipeline goals:

- validate code quality
- build Docker images for `web` and `api`
- push images to a registry
- deploy to a cloud VM over SSH

Out of scope:

- Kubernetes
- multi-cluster deployment
- progressive delivery features such as canary or blue-green in phase 1

## Pipeline Objectives

The Jenkins pipeline must:

1. be easy to read
2. fail early on quality issues
3. produce versioned Docker images
4. separate CI from deployment logic
5. support later expansion to staging and production

## Assumptions

This spec assumes:

- the repo is stored in Git
- Jenkins can clone the repo
- Dockerfiles exist for `web` and `api`
- a container registry is available
- a cloud VM exists for deployment
- Jenkins has SSH access to the target VM

Preferred stack:

- Jenkins
- Docker
- GHCR
- AWS EC2

Valid alternative:

- Jenkins
- Docker
- GHCR
- GCP Compute Engine

## Repo Contracts Jenkins Depends On

Before this pipeline is implemented, the repo should provide:

- root scripts for `lint`, `build`, `typecheck`, and `test`
- Dockerfiles for `web` and `api`
- CI helper scripts under `scripts/ci`
- deploy helper scripts under `scripts/deploy`

Jenkinsfile should orchestrate these scripts, not replace them.

## Pipeline Topology

The initial pipeline should be single-path and simple:

```text
Checkout
  -> Install
  -> Typecheck
  -> Lint
  -> Test
  -> Build
  -> Docker Build
  -> Docker Push
  -> Deploy To Staging VM
```

Production deploy can be added later as a gated stage.

## Branch Strategy

Recommended initial branch behavior:

- feature branches: run CI only
- `develop` or equivalent staging branch: CI + staging image push
- `main`: CI + push + staging deploy

If the repo does not yet have `develop`, keep it simpler:

- non-main branches: CI only
- `main`: CI + image push + deploy

## Tag Strategy

Each pipeline run should generate:

- branch-safe tag
- short commit SHA tag

Recommended format:

- `<branch>-<shortsha>`

Examples:

- `main-a1b2c3d`
- `feature-room-join-1f2e3d4`

For `main`, optionally also publish:

- `latest`

Rule:

- do not use `latest` as the only deployment reference
- deployment should always know the exact immutable tag

## Required Jenkins Credentials

### Registry credentials

Credential ids:

- `ghcr-username`
- `ghcr-token`

Or a single username/password credential if preferred.

### SSH credentials

Credential id:

- `sweet-spicy-deploy-ssh`

This should be an SSH private key credential for the target VM user.

### Optional future credentials

- cloud-specific secret store access
- Slack or Discord webhook
- production-specific SSH key

## Required Jenkins Environment Variables

Minimum variables:

- `REGISTRY_HOST`
- `REGISTRY_NAMESPACE`
- `WEB_IMAGE_NAME`
- `API_IMAGE_NAME`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`

Suggested defaults:

- `REGISTRY_HOST=ghcr.io`
- `WEB_IMAGE_NAME=sweet-spicy-web`
- `API_IMAGE_NAME=sweet-spicy-api`
- `DEPLOY_PATH=/opt/sweet-spicy`

## Jenkinsfile Design Rules

1. Keep business logic out of Jenkinsfile
2. Shell scripts belong in `scripts/ci` and `scripts/deploy`
3. Use declarative pipeline syntax for readability
4. Avoid duplicating tag logic across stages
5. Do not hardcode secrets
6. Do not bury deploy behavior inside inline SSH one-liners when it grows beyond trivial size

## Stage-By-Stage Specification

## Stage 1: Checkout

Purpose:

- fetch the exact commit being built

Responsibilities:

- checkout source
- expose git commit SHA to later stages

Outputs:

- workspace source code
- commit SHA available for image tag computation

## Stage 2: Install

Purpose:

- install dependencies deterministically

Command source:

- `scripts/ci/install.sh`

Expected behavior:

- use frozen lockfile
- fail immediately on install error

## Stage 3: Typecheck

Purpose:

- fail fast on TypeScript contract issues

Command source:

- `scripts/ci/typecheck.sh`

Expected behavior:

- run root typecheck
- run app-specific typecheck if root script delegates to them

## Stage 4: Lint

Purpose:

- enforce code quality and style consistency

Command source:

- `scripts/ci/lint.sh`

Expected behavior:

- no auto-fix in CI for now
- fail on lint issues

## Stage 5: Test

Purpose:

- validate functional behavior

Command source:

- `scripts/ci/test.sh`

Expected behavior:

- start minimal if test coverage is immature
- still keep the stage in pipeline so it can grow over time

## Stage 6: Build

Purpose:

- confirm repo builds before packaging images

Command source:

- `scripts/ci/build.sh`

Expected behavior:

- build shared packages
- build `web`
- build `api`

## Stage 7: Docker Build

Purpose:

- build versioned images

Command source:

- `scripts/ci/docker-build.sh`

Inputs:

- computed tag
- registry namespace
- image names

Outputs:

- local Docker images for `web` and `api`

## Stage 8: Docker Push

Purpose:

- publish images to registry

Command source:

- `scripts/ci/docker-push.sh`

Requirements:

- authenticated registry session
- push both `web` and `api` images

## Stage 9: Deploy To VM

Purpose:

- update the remote server to the new image tag

Command source:

- `scripts/deploy/deploy-vm.sh`

Deployment rule:

- run only on allowed branches
- production deploy should not happen on feature branches

Expected remote actions:

1. change into deploy directory
2. log in to registry if needed
3. pull tagged images
4. restart compose services
5. run health checks

## Optional Stage 10: Rollback

This is not automatic in phase 1, but the workflow should exist.

Command source:

- `scripts/deploy/rollback-vm.sh`

Trigger:

- manual Jenkins parameterized run
- or emergency manual SSH execution on server

## Suggested Pipeline Parameters

Add later if needed:

- `DEPLOY_ENABLED`
- `DEPLOY_ENV`
- `ROLLBACK_TAG`

Phase 1 can start without parameters if branch-based behavior is enough.

## Suggested Jenkinsfile Variables

These computed values should be defined once and reused:

- sanitized branch name
- short git SHA
- image tag
- full web image reference
- full api image reference

Examples:

- `IMAGE_TAG = main-a1b2c3d`
- `WEB_IMAGE = ghcr.io/org/sweet-spicy-web:main-a1b2c3d`
- `API_IMAGE = ghcr.io/org/sweet-spicy-api:main-a1b2c3d`

## Deployment Target Contract

The remote VM should contain:

```text
/opt/sweet-spicy/
  .env
  docker-compose.prod.yml
  nginx/
    default.conf
```

The deploy script should assume:

- compose file already exists on the server
- environment file already exists on the server
- only image tags change per deployment

This keeps deploy logic simple and stable.

## AWS EC2 Deployment Notes

For AWS, the pipeline should deploy to:

- one Ubuntu EC2 instance

Minimum server setup:

- Docker Engine
- Docker Compose plugin
- Nginx
- firewall/security group rules for `80`, `443`, and SSH

Jenkins should not need direct AWS API integration in phase 1.

SSH-based deployment is enough.

## GCP Compute Engine Deployment Notes

For GCP, the pipeline should deploy to:

- one Ubuntu Compute Engine VM

Minimum server setup:

- Docker Engine
- Docker Compose plugin
- Nginx
- firewall rules for `80`, `443`, and SSH

Again, SSH-based deployment is enough for phase 1.

## Suggested Repo Files

The pipeline spec assumes these files will exist:

- `Jenkinsfile`
- `scripts/ci/install.sh`
- `scripts/ci/typecheck.sh`
- `scripts/ci/lint.sh`
- `scripts/ci/test.sh`
- `scripts/ci/build.sh`
- `scripts/ci/docker-build.sh`
- `scripts/ci/docker-push.sh`
- `scripts/deploy/deploy-vm.sh`
- `scripts/deploy/rollback-vm.sh`

## Suggested Jenkinsfile Structure

Recommended high-level structure:

1. `pipeline`
2. `agent`
3. `options`
4. `environment`
5. `stages`
6. `post`

### Recommended options

- timestamps
- disable concurrent builds on same branch if deploy side effects matter
- preserve build logs for a reasonable period

### Recommended post actions

- always archive basic logs if useful
- notify failure later if notification integration is added

## Failure Handling Rules

### CI stage failure

If any quality stage fails:

- do not build deployable images
- do not push images
- do not deploy

### Push failure

If image push fails:

- do not deploy
- surface exact image reference that failed

### Deploy failure

If deploy fails:

- mark pipeline failed
- preserve deployed image tag information
- allow rollback using prior known good tag

## Logging And Traceability

The pipeline should log:

- commit SHA
- branch name
- computed image tag
- full image references
- target deployment host

Do not log:

- tokens
- SSH private key contents
- secret env values

## Acceptance Criteria

The Jenkins implementation is complete when:

1. a branch push runs CI stages successfully
2. `main` builds both images
3. `main` pushes both images to registry
4. `main` deploys successfully to the VM
5. deployed app is reachable
6. websocket still works through deployed environment

## Implementation Order

Build the Jenkins layer in this sequence:

1. create `scripts/ci/*`
2. create `scripts/deploy/*`
3. create `Jenkinsfile`
4. validate CI without deploy
5. configure registry credentials
6. validate image push
7. configure SSH deploy
8. validate staging deploy

## What Comes Next

After this spec, the next useful docs are:

1. `docs/aws-ec2-deploy-spec.md`
2. `docs/gcp-compute-engine-deploy-spec.md`

Only one of them needs to be implemented first. The recommended path is AWS EC2.
