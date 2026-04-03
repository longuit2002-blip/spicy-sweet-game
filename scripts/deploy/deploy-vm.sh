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
docker compose -f "${COMPOSE_FILE}" up -d

echo "Deploy finished. Check: docker compose -f ${COMPOSE_FILE} ps"
