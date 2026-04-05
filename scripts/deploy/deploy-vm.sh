#!/usr/bin/env bash
set -euo pipefail

# Run on the EC2 host. Requires docker compose v2, images in a registry, and files under /opt/sweet-spicy/.
# Usage:
#   export WEB_IMAGE=ghcr.io/org/sweet-spicy-web:abc123
#   export API_IMAGE=ghcr.io/org/sweet-spicy-api:abc123
#   ./deploy-vm.sh
#
# Optional: copy deploy/vm/deploy.env to /opt/sweet-spicy/deploy.env and uncomment the next lines:
# set -a
# source /opt/sweet-spicy/deploy.env
# set +a

: "${WEB_IMAGE:?Set WEB_IMAGE (e.g. ghcr.io/org/sweet-spicy-web:tag)}"
: "${API_IMAGE:?Set API_IMAGE (e.g. ghcr.io/org/sweet-spicy-api:tag)}"

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/sweet-spicy}"
COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_ROOT}/docker-compose.prod.yml}"

cd "${DEPLOY_ROOT}"
export WEB_IMAGE API_IMAGE
docker compose -f "${COMPOSE_FILE}" pull
docker compose -f "${COMPOSE_FILE}" up -d postgres redis
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps api \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
docker compose -f "${COMPOSE_FILE}" up -d api web

echo "Deploy finished (including prisma migrate deploy). Check: docker compose -f ${COMPOSE_FILE} ps"

# Optional nginx: apply template if CI assets exist and .env defines NEXT_PUBLIC_SOCKET_URL.
NGINX_WRAPPER="${DEPLOY_ROOT}/.deploy-assets/run-nginx-sync-from-vm-env.sh"
if [[ -f "${NGINX_WRAPPER}" ]] && [[ -f "${DEPLOY_ROOT}/.env" ]]; then
  SWEET_SPICY_ENV="${DEPLOY_ROOT}/.env" bash "${NGINX_WRAPPER}" || true
elif [[ -n "${NEXT_PUBLIC_SOCKET_URL:-}" ]]; then
  SYNC_SCRIPT="${DEPLOY_ROOT}/.deploy-assets/sync-nginx-sweetspicy.sh"
  TMPL="${DEPLOY_ROOT}/.deploy-assets/sites-available.sweetspicy.template.conf"
  if [[ -f "${SYNC_SCRIPT}" ]] && [[ -f "${TMPL}" ]]; then
    export NGINX_TEMPLATE_LOCAL="${TMPL}"
    bash "${SYNC_SCRIPT}" || true
  elif [[ -n "${COMPOSE_REPO:-}" ]] && [[ -n "${COMPOSE_REF:-}" ]]; then
    curl -fsSL "https://raw.githubusercontent.com/${COMPOSE_REPO}/${COMPOSE_REF}/scripts/deploy/sync-nginx-sweetspicy.sh" | bash || true
  fi
fi
