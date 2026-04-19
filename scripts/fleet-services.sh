#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${TF_DIR:-${ROOT_DIR}/infra/marketplace-fleet/terraform}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/fleet-services.sh <start|stop|restart|status> [node-key]

Examples:
  ./scripts/fleet-services.sh status
  ./scripts/fleet-services.sh restart na_east-1

Environment:
  TF_DIR         Terraform root with edge_droplets output
  SSH_USER       SSH username for droplets (default: root)
  SSH_KEY_PATH   Optional private key path used by ssh -i
EOF
}

ACTION="${1:-}"
TARGET_NODE="${2:-}"

if [[ -z "${ACTION}" ]]; then
  usage
  exit 1
fi

case "${ACTION}" in
  start|stop|restart|status) ;;
  *)
    echo "Invalid action '${ACTION}'."
    usage
    exit 1
    ;;
esac

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required."
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required."
  exit 1
fi

if [[ ! -d "${TF_DIR}" ]]; then
  echo "Terraform directory not found: ${TF_DIR}"
  exit 1
fi

if ! EDGE_JSON="$(terraform -chdir="${TF_DIR}" output -json edge_droplets 2>/dev/null)"; then
  echo "Terraform output 'edge_droplets' is unavailable."
  echo "Run 'terraform apply' in ${TF_DIR} before using fleet service controls."
  exit 1
fi

if [[ -z "${EDGE_JSON}" || "${EDGE_JSON}" == "null" ]]; then
  echo "No edge droplets found in terraform output."
  exit 1
fi

if [[ -n "${TARGET_NODE}" ]]; then
  NODE_LIST="$(
    jq -r --arg node "${TARGET_NODE}" '
      to_entries
      | map(select(.key == $node and .value.ipv4 != null and .value.ipv4 != ""))
      | .[]
      | "\(.key) \(.value.ipv4)"
    ' <<<"${EDGE_JSON}"
  )"
else
  NODE_LIST="$(
    jq -r '
      to_entries
      | map(select(.value.ipv4 != null and .value.ipv4 != ""))
      | .[]
      | "\(.key) \(.value.ipv4)"
    ' <<<"${EDGE_JSON}"
  )"
fi

if [[ -z "${NODE_LIST}" ]]; then
  echo "No matching nodes found."
  exit 1
fi

SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
)

if [[ -n "${SSH_KEY_PATH}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY_PATH}")
fi

echo "Running '${ACTION}' on fleet from ${TF_DIR}"
while IFS=' ' read -r node_key node_ip; do
  [[ -z "${node_key}" || -z "${node_ip}" ]] && continue
  echo "== ${node_key} (${node_ip}) =="
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${node_ip}" "bash -s -- ${ACTION}" <<'EOS'
set -euo pipefail

ACTION="${1:?missing action}"
COMPOSE_FILE="/opt/bountynet/docker-compose.yml"
BASE_CMD=(docker compose -f "${COMPOSE_FILE}")

if command -v sudo >/dev/null 2>&1; then
  BASE_CMD=(sudo "${BASE_CMD[@]}")
fi

case "${ACTION}" in
  start)
    "${BASE_CMD[@]}" up -d
    ;;
  stop)
    "${BASE_CMD[@]}" down
    ;;
  restart)
    "${BASE_CMD[@]}" restart litellm
    ;;
  status)
    "${BASE_CMD[@]}" ps
    ;;
  *)
    echo "unsupported action: ${ACTION}"
    exit 1
    ;;
esac
EOS
done <<<"${NODE_LIST}"
