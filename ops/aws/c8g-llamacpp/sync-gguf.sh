#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [[ ! -f ".env" ]]; then
  echo "Missing .env; copy from .env.example first."
  exit 1
fi

# shellcheck disable=SC1091
source ./.env

if [[ -z "${GGUF_MODEL_URI:-}" ]]; then
  echo "GGUF_MODEL_URI is empty."
  exit 1
fi
if [[ "${GGUF_MODEL_URI}" != s3://* ]]; then
  echo "GGUF_MODEL_URI must be an s3:// URI."
  exit 1
fi

mkdir -p ./models
aws s3 cp "${GGUF_MODEL_URI}" "./models/model.gguf"
echo "Synced ./models/model.gguf"
