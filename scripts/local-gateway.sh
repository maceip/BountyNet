#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

VENV_PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$VENV_PY" ]]; then
  echo "[local-gateway] Missing ${ROOT}/.venv — create it and install deps:" >&2
  echo "  cd \"${ROOT}\" && uv venv .venv && uv pip install -r gateway/requirements.txt" >&2
  exit 1
fi

if [[ -f "${ROOT}/gateway/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/gateway/.env"
  set +a
fi

: "${GATEWAY_PORT:=8090}"

exec "$VENV_PY" -m gateway.app
