#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/laptop/docker-compose.yml"
PROJECT_NAME="${PROJECT_NAME:-bountynet-laptop}"

usage() {
  cat <<'EOF'
Usage: ./scripts/laptop-stack.sh <command>

Commands:
  up       Build and start the laptop stack (default profile: slice)
  down     Stop and remove stack resources
  ps       Show stack services
  logs     Tail stack logs
  smoke    Run local smoke against running stack

Examples:
  ./scripts/laptop-stack.sh up
  ./scripts/laptop-stack.sh up full
  ./scripts/laptop-stack.sh logs slice
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
    profile="${1:-slice}"
    case "${profile}" in
      slice|full) ;;
      *)
        echo "Invalid profile '${profile}'. Expected: slice or full."
        exit 1
        ;;
    esac
    shift || true
    compose --profile "${profile}" up -d --build "$@"
    ;;
  down)
    compose --profile slice --profile full down -v "$@"
    ;;
  ps)
    profile="${1:-slice}"
    case "${profile}" in
      slice|full)
        shift || true
        compose --profile "${profile}" ps "$@"
        ;;
      *)
        compose ps "${profile}" "$@"
        ;;
    esac
    ;;
  logs)
    profile="${1:-slice}"
    case "${profile}" in
      slice|full)
        shift || true
        compose --profile "${profile}" logs -f "$@"
        ;;
      *)
        compose logs -f "${profile}" "$@"
        ;;
    esac
    ;;
  smoke)
    profile="${1:-slice}"
    case "${profile}" in
      slice|full) ;;
      *)
        echo "Invalid profile '${profile}'. Expected: slice or full."
        exit 1
        ;;
    esac
    "${ROOT_DIR}/scripts/dev-stack-smoke.sh" "${profile}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
