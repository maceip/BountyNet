#!/usr/bin/env bash
set -euo pipefail

SKIP_TERRAFORM=0
SKIP_COMPOSE=0

for arg in "$@"; do
  case "$arg" in
    --skip-terraform) SKIP_TERRAFORM=1 ;;
    --skip-compose) SKIP_COMPOSE=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "== BountyNet infra preflight =="

if [[ "$SKIP_TERRAFORM" -eq 0 ]]; then
  command -v terraform >/dev/null 2>&1 || { echo "terraform not found on PATH" >&2; exit 1; }
  modules=(
    infra/marketplace-fleet/terraform/aws-global-accelerator
    infra/marketplace-fleet/terraform/digitalocean-global-dns
    infra/marketplace-fleet/terraform/digitalocean-global-lb
    infra/marketplace-fleet/terraform/digitalocean-regional-lbs
  )

  echo "[terraform] fmt check..."
  terraform fmt -check -recursive infra/marketplace-fleet/terraform

  for module in "${modules[@]}"; do
    echo "[terraform] init+validate ${module}"
    terraform -chdir="${module}" init -backend=false
    terraform -chdir="${module}" validate
  done
fi

if [[ "$SKIP_COMPOSE" -eq 0 ]]; then
  command -v docker >/dev/null 2>&1 || { echo "docker not found on PATH" >&2; exit 1; }
  echo "[compose] validating docker-compose.soak.yml"
  docker compose -f docker-compose.soak.yml config >/dev/null
fi

echo "Infra preflight complete."
