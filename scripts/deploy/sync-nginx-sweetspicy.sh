#!/usr/bin/env bash
# Run on the VM (e.g. from GitHub Actions SSH deploy). Requires passwordless sudo.
# Env: NEXT_PUBLIC_SOCKET_URL (https://your.domain)
# Template source (one of):
#   - NGINX_TEMPLATE_LOCAL=/path/to/sites-available.sweetspicy.template.conf (recommended from CI after scp)
#   - COMPOSE_REPO + COMPOSE_REF + curl raw.githubusercontent.com (public repo only)
set -euo pipefail

: "${NEXT_PUBLIC_SOCKET_URL:?Set NEXT_PUBLIC_SOCKET_URL}"

extract_host() {
  local u="$1"
  u="${u#*://}"
  u="${u%%/*}"
  u="${u%%:*}"
  printf '%s' "$u"
}

DOMAIN="$(extract_host "${NEXT_PUBLIC_SOCKET_URL}")"
if [[ -z "${DOMAIN}" ]]; then
  echo "sync-nginx: could not parse host from NEXT_PUBLIC_SOCKET_URL; abort"
  exit 1
fi

CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
# Let's Encrypt live/ is often mode 0700: unprivileged [[ -f ]] fails even when cert exists — use sudo.
if ! sudo test -f "${CERT}"; then
  echo "sync-nginx: TLS cert not found at ${CERT} — skip nginx sync (run: sudo certbot --nginx -d ${DOMAIN})"
  exit 0
fi

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

if [[ -n "${NGINX_TEMPLATE_LOCAL:-}" && -f "${NGINX_TEMPLATE_LOCAL}" ]]; then
  cp "${NGINX_TEMPLATE_LOCAL}" "${TMP}"
elif [[ -n "${COMPOSE_REPO:-}" && -n "${COMPOSE_REF:-}" ]]; then
  TMPL_URL="https://raw.githubusercontent.com/${COMPOSE_REPO}/${COMPOSE_REF}/deploy/vm/nginx/sites-available.sweetspicy.template.conf"
  curl -fsSL "${TMPL_URL}" -o "${TMP}"
else
  echo "sync-nginx: set NGINX_TEMPLATE_LOCAL to the template file path, or COMPOSE_REPO + COMPOSE_REF for public GitHub raw fetch"
  exit 1
fi

sudo mkdir -p /var/www/html

CONTENT="$(<"${TMP}")"
CONTENT="${CONTENT//__DEPLOY_DOMAIN__/${DOMAIN}}"

printf '%s\n' "${CONTENT}" | sudo tee /etc/nginx/sites-available/sweetspicy >/dev/null
sudo ln -sf /etc/nginx/sites-available/sweetspicy /etc/nginx/sites-enabled/sweetspicy
sudo rm -f /etc/nginx/sites-enabled/sweet-spicy

# Fail CI / deploy if the live file does not actually contain API + Socket.IO (catches skipped sync or wrong path).
if ! sudo grep -qE 'location[[:space:]]+/socket\.io' /etc/nginx/sites-available/sweetspicy; then
  echo "sync-nginx: ERROR: /etc/nginx/sites-available/sweetspicy missing location /socket.io after write"
  exit 1
fi
if ! sudo grep -qE 'location[[:space:]]+/api/' /etc/nginx/sites-available/sweetspicy; then
  echo "sync-nginx: ERROR: /etc/nginx/sites-available/sweetspicy missing location /api/"
  exit 1
fi

sudo nginx -t
sudo systemctl reload nginx
echo "sync-nginx: applied template for ${DOMAIN} and reloaded nginx"
