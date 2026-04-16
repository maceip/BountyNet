#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <axolotl-config-relative-path>"
  echo "Example: $0 axolotl/configs/rust-sentinel-qlora.yml"
  exit 1
fi

CONFIG_PATH="$1"

docker compose run --rm axolotl-trainer \
  axolotl train "/workspace/${CONFIG_PATH}"
