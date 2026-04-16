#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_DIR="${SCRIPT_DIR}/../terraform"

export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/bountynet/terraform-providers}"
mkdir -p "${TF_PLUGIN_CACHE_DIR}"

cd "${STACK_DIR}"
terraform init "$@"
