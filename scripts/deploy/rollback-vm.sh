#!/usr/bin/env bash
set -euo pipefail

# Redeploy a known-good tag (same as deploy-vm.sh but intended for an explicit rollback).
# Usage:
#   export WEB_IMAGE=ghcr.io/org/sweet-spicy-web:previous-tag
#   export API_IMAGE=ghcr.io/org/sweet-spicy-api:previous-tag
#   ./rollback-vm.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/deploy-vm.sh"
