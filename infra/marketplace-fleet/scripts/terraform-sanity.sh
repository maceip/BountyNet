#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_ROOT="${SCRIPT_DIR}/../terraform"

modules=(
  "${TF_ROOT}"
  "${TF_ROOT}/digitalocean-regional-lbs"
  "${TF_ROOT}/digitalocean-global-lb"
  "${TF_ROOT}/digitalocean-global-dns"
  "${TF_ROOT}/aws-global-accelerator"
  "${TF_ROOT}/aws-inf2-serving"
  "${TF_ROOT}/aws-c8g-llamacpp"
)

echo "== Terraform sanity =="
terraform fmt -check -recursive "${TF_ROOT}"

for module in "${modules[@]}"; do
  echo "-- init/validate: ${module}"
  terraform -chdir="${module}" init -backend=false -input=false
  terraform -chdir="${module}" validate
done

echo "Terraform sanity checks passed."
