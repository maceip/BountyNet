#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/laptop/docker-compose.yml"
PROJECT_NAME="${PROJECT_NAME:-bountynet-laptop}"

usage() {
  cat <<'EOF'
Usage: ./scripts/laptop-stack.sh <command>

Commands:
  up       Build and start the laptop stack
  down     Stop and remove stack resources
  ps       Show stack services
  logs     Tail stack logs
  smoke    Run local smoke against running stack
EOF
}

cmd="${1:-}"
if [[ -z "${cmd}" ]]; then
  usage
  exit 1
fi

shift || true

compose() {
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" "$@"
}

case "${cmd}" in
  up)
    compose up -d --build "$@"
    ;;
  down)
    compose down -v "$@"
    ;;
  ps)
    compose ps "$@"
    ;;
  logs)
    compose logs -f "$@"
    ;;
  smoke)
    python "${ROOT_DIR}/scripts/simulate_dev_surface.py"
    ;;
  *)
    usage
    exit 1
    ;;
esac
