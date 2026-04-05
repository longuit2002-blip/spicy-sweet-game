#!/usr/bin/env bash
# Run on the EC2 host after Let's Encrypt exists for your domain.
# Loads NEXT_PUBLIC_SOCKET_URL from /opt/sweet-spicy/.env (or SWEET_SPICY_ENV), then applies
# sites-available.sweetspicy.template.conf via sync-nginx-sweetspicy.sh.
#
# Typical VM (files copied by CI into /opt/sweet-spicy/.deploy-assets/):
#   SWEET_SPICY_ENV=/opt/sweet-spicy/.env bash /opt/sweet-spicy/.deploy-assets/run-nginx-sync-from-vm-env.sh
#
# From a full git clone on the server:
#   bash scripts/deploy/run-nginx-sync-from-vm-env.sh
#
set -euo pipefail

ENV_FILE="${SWEET_SPICY_ENV:-/opt/sweet-spicy/.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
SYNC_SH="${SCRIPT_DIR}/sync-nginx-sweetspicy.sh"
TEMPLATE_NEXT_TO_SCRIPT="${SCRIPT_DIR}/sites-available.sweetspicy.template.conf"
REPO_TEMPLATE="$(cd "${SCRIPT_DIR}/../.." && pwd)/deploy/vm/nginx/sites-available.sweetspicy.template.conf"

if [[ ! -f "$SYNC_SH" ]]; then
  echo "run-nginx-sync: expected sync-nginx-sweetspicy.sh in ${SCRIPT_DIR}"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "run-nginx-sync: missing ${ENV_FILE} — create it or set SWEET_SPICY_ENV"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

: "${NEXT_PUBLIC_SOCKET_URL:?Set NEXT_PUBLIC_SOCKET_URL in ${ENV_FILE} (e.g. https://your.domain)}"

if [[ -z "${NGINX_TEMPLATE_LOCAL:-}" ]]; then
  if [[ -f "${TEMPLATE_NEXT_TO_SCRIPT}" ]]; then
    export NGINX_TEMPLATE_LOCAL="${TEMPLATE_NEXT_TO_SCRIPT}"
  elif [[ -f "${REPO_TEMPLATE}" ]]; then
    export NGINX_TEMPLATE_LOCAL="${REPO_TEMPLATE}"
  else
    echo "run-nginx-sync: no template found next to script or at ${REPO_TEMPLATE}; set NGINX_TEMPLATE_LOCAL"
    exit 1
  fi
fi

export NEXT_PUBLIC_SOCKET_URL
bash "${SYNC_SH}"
