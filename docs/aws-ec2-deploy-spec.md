# AWS EC2 Deploy Spec For Sweet & Spicy

## Scope

This document defines how to deploy the current project to AWS EC2 in the first DevOps phase.

Deployment model:

- one EC2 instance
- Dockerized `web` and `api`
- Nginx reverse proxy
- Jenkins deploy over SSH

Out of scope:

- Kubernetes
- ECS
- load balancers
- autoscaling
- multi-instance high availability

## Why EC2 First

For this repo, EC2 is the best first AWS target because it teaches the right fundamentals:

- Linux server administration
- Docker runtime management
- reverse proxy setup
- environment management
- SSH-based deployment
- basic rollback discipline

It also keeps the deployment model simple enough to debug end-to-end.

## Target Architecture

### Runtime components

The initial production-like stack should be:

- `web` container
- `api` container
- `nginx` on the host VM

Traffic flow:

```text
Browser
  -> Nginx on EC2
    -> web container on localhost:3000
    -> api container on localhost:8000
```

Routing rules:

- `/` -> `web`
- `/api` -> `api`
- `/socket.io` -> `api`

This is critical because Socket.IO must pass through Nginx with websocket upgrade support.

## EC2 Instance Specification

### Recommended starting size

For learning and low-traffic deployment:

- `t3.small`

Possible cheaper starting option:

- `t3.micro`

Use `t3.micro` only if traffic is very light and the repo footprint stays modest. For Docker + Jenkins experimentation, `t3.small` is the safer recommendation.

### Recommended OS

- `Ubuntu Server 24.04 LTS`

Reason:

- broad documentation support
- simple package installation
- good fit for Docker and Nginx

### Storage

Recommended initial root volume:

- `20 GB` gp3

This leaves enough space for:

- Docker images
- container logs
- OS packages
- temporary deploy artifacts

## AWS Resources To Create

Minimum AWS resources:

1. EC2 instance
2. security group
3. key pair or SSH access strategy
4. elastic IP optional but recommended

### Security group rules

Inbound:

- `22` from your trusted IP or VPN only
- `80` from `0.0.0.0/0`
- `443` from `0.0.0.0/0`

Do not expose:

- internal app ports like `3000` or `8000` publicly

Outbound:

- allow standard outbound access so the VM can pull images and install packages

## Domain And DNS

### Recommended

Use a real domain or subdomain such as:

- `sweetspicy.example.com`

DNS should point to:

- the EC2 public IP or elastic IP

Reason:

- easier TLS setup
- more realistic production-like environment
- correct frontend/API/socket URLs

## Server Bootstrap

## Phase 1 bootstrap responsibilities

After the VM is created, install:

- Docker Engine
- Docker Compose plugin
- Nginx
- curl
- ufw optional

### Host-level directory structure

Use a stable deployment directory:

```text
/opt/sweet-spicy/
  .env
  docker-compose.prod.yml
  deploy.env
  nginx/
    default.conf
  logs/
```

Purpose of files:

- `.env`: runtime application environment variables
- `deploy.env`: image tags and deploy-related environment variables if needed
- `docker-compose.prod.yml`: production compose definition
- `nginx/default.conf`: reverse proxy config

## Docker Setup On EC2

### Host requirements

Install Docker and enable service startup:

- Docker daemon enabled on boot
- deploy user added to `docker` group if appropriate

Rule:

- avoid running everyday deploy commands as `root` if not necessary

### Compose deployment model

Compose file should:

- use registry image references
- not build on the server
- reference env file stored locally on VM
- restart containers automatically

### Container exposure rules

Preferred:

- `web` bound only to localhost
- `api` bound only to localhost

Example exposure model:

- `127.0.0.1:3000:3000`
- `127.0.0.1:8000:8000`

Reason:

- only Nginx should be public

## Nginx Specification

## Responsibilities

Nginx on the EC2 host must:

1. terminate HTTP traffic initially
2. proxy frontend requests to `web`
3. proxy API requests to `api`
4. proxy websocket traffic to `api`

### Routing contract

- `/` -> `http://127.0.0.1:3000`
- `/api` -> `http://127.0.0.1:8000`
- `/socket.io` -> `http://127.0.0.1:8000`

### Websocket requirements

Nginx config must include:

- `Upgrade` header forwarding
- `Connection` upgrade forwarding
- appropriate HTTP version

Without that, Socket.IO may appear partially functional but fail during websocket upgrade.

### TLS

Phase 1:

- HTTP only is acceptable for first deployment validation

Phase 2:

- add Let's Encrypt with Certbot

Recommendation:

- validate deployment on `http`
- then add TLS once routing and env values are correct

## Environment Variable Contract

### On the server

The `.env` file on EC2 should include at least:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `DATABASE_URL` if DB is used

### Recommended production values

Examples:

- `NEXT_PUBLIC_API_URL=https://sweetspicy.example.com/api`
- `NEXT_PUBLIC_SOCKET_URL=https://sweetspicy.example.com`
- `CLIENT_URL=https://sweetspicy.example.com`
- `PORT=8000`

Important:

- frontend and backend URL variables must reflect the final public domain
- do not leave them on `localhost`

## Registry Strategy

### Recommended initial choice

- `GHCR`

Reason:

- easy to integrate with Jenkins
- independent from AWS-specific image registry setup
- simple learning path

### AWS-native alternative

- `Amazon ECR`

This is valid, but adds AWS registry setup complexity earlier than necessary.

Recommendation:

- use `GHCR` first
- move to `ECR` later if needed

## Jenkins To EC2 Deployment Flow

The Jenkins deploy stage should perform:

1. compute image tag
2. authenticate to registry
3. SSH into EC2
4. update deploy env or compose image references
5. pull new images
6. restart containers
7. verify health

### Recommended deploy pattern

On the server:

- keep compose file stable
- inject image tags through environment variables

This is cleaner than rewriting long image strings inline on every deploy.

Example deploy values:

- `WEB_IMAGE=ghcr.io/org/sweet-spicy-web:<tag>`
- `API_IMAGE=ghcr.io/org/sweet-spicy-api:<tag>`

## Rollback Model

### Phase 1 rollback

Rollback should be simple and explicit.

Recommended approach:

1. keep previous known-good image tag recorded
2. rerun deploy with old tag
3. restart services

Rollback does not need to be automated initially, but the process must be documented and scriptable.

### What rollback should not do

- it should not revert database schema automatically
- it should not guess the last working version without a recorded tag

## Database Considerations

If the backend requires a production database, decide early where it will live.

### Learning-path recommendation

For the first AWS deploy:

- use a managed Postgres instance if budget allows
or
- temporarily run Postgres on the same EC2 instance only for learning

Preferred from an engineering perspective:

- managed database

Why:

- less operational risk
- easier backup story
- more realistic architecture

If running DB on the same instance temporarily:

- keep it clearly marked as non-production-grade

## Health Checks

### Required checks after every deploy

1. `docker ps` shows `web` running
2. `docker ps` shows `api` running
3. `curl http://127.0.0.1:3000` succeeds
4. `curl http://127.0.0.1:8000` or health endpoint succeeds
5. public URL loads through Nginx

### Recommended API improvement

Add a lightweight health endpoint such as:

- `/health`

This makes deploy verification much cleaner.

## EC2 Hardening Checklist

Minimum hardening for phase 1:

1. restrict SSH source IP
2. disable password auth if using SSH keys only
3. keep OS packages updated
4. avoid public exposure of container ports
5. store secrets only in local env files, not in repo
6. use a non-root deploy user where practical

## Suggested Server Users

Recommended approach:

- one admin user for machine setup
- one deploy-capable user for Jenkins SSH deployment

The deploy user should have:

- SSH access
- permission to manage Docker
- access to `/opt/sweet-spicy`

## Files To Prepare In Repo

These files should exist before full AWS deploy:

- `docker/compose/docker-compose.prod.yml`
- `deploy/vm/nginx/default.conf`
- `deploy/vm/.env.example`
- `deploy/vm/README.md`
- `scripts/deploy/deploy-vm.sh`
- `scripts/deploy/rollback-vm.sh`
- `Jenkinsfile`

## AWS Deployment Sequence

Implement AWS deployment in this order:

1. create EC2 instance
2. configure security group
3. assign public IP or elastic IP
4. install Docker and Nginx
5. place compose and Nginx config on server
6. validate manual deploy over SSH
7. configure Jenkins credentials
8. automate deploy from Jenkins
9. add TLS

The critical rule is:

- manual deploy must work before Jenkins automation starts

## Manual Deploy Checklist

Before wiring Jenkins, prove these steps manually:

1. SSH into EC2
2. log in to registry
3. pull both images
4. run compose
5. open app in browser
6. verify API
7. verify websocket flow

If this does not work manually, Jenkins automation will only hide the real problem.

## Acceptance Criteria

AWS deployment is successful when:

1. EC2 instance is reachable by domain or public IP
2. Nginx proxies frontend correctly
3. Nginx proxies API correctly
4. Socket.IO works through `/socket.io`
5. Jenkins can deploy a new image tag over SSH
6. a previous tag can be redeployed as rollback

## Risks To Watch

### 1. Wrong frontend runtime URLs

Risk:

- frontend points to `localhost` or an internal container hostname

Mitigation:

- define production envs explicitly before first deploy

### 2. Missing websocket proxy headers

Risk:

- normal HTTP works but realtime flow breaks

Mitigation:

- test actual multiplayer/socket paths after deploy

### 3. Docker disk growth

Risk:

- old images and logs fill the EC2 disk

Mitigation:

- add periodic cleanup discipline
- prune unused images carefully

### 4. Single-instance downtime

Risk:

- deploy restarts can briefly interrupt service

Mitigation:

- accept this in phase 1
- document it as expected behavior

## Recommended Next Docs

After this AWS spec, the next useful documents are:

1. `docs/aws-ec2-server-bootstrap-guide.md`
2. `docs/aws-ec2-jenkins-deploy-runbook.md`

The first should contain exact bootstrap commands.
The second should contain exact operational steps for deploy and rollback.
