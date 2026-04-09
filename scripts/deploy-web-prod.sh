#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT}/imperial-web"
SERVICE_NAME="bountynet-web.service"

"${ROOT}/scripts/build-web-prod.sh"

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl reload caddy

echo "Deployed ${SERVICE_NAME} from ${WEB_DIR}"
