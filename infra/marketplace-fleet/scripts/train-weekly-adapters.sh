#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd aws
require_cmd docker

TRAJECTORY_BUCKET="${TRAJECTORY_BUCKET:-}"
ADAPTER_BUCKET="${ADAPTER_BUCKET:-${VLLM_ADAPTER_BUCKET:-}}"
RUN_ID="${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"

if [[ -z "${TRAJECTORY_BUCKET}" ]]; then
  echo "Set TRAJECTORY_BUCKET to s3://... path containing curated weekly traces."
  exit 1
fi
if [[ -z "${ADAPTER_BUCKET}" ]]; then
  echo "Set ADAPTER_BUCKET (or VLLM_ADAPTER_BUCKET) to s3://... adapter artifact prefix."
  exit 1
fi

echo "== Weekly specialist evolution loop =="
echo "Trajectories: ${TRAJECTORY_BUCKET}"
echo "Adapter sink: ${ADAPTER_BUCKET}"
echo "Run ID: ${RUN_ID}"

declare -a TRAIN_TARGETS=(
  "rust-sentinel|axolotl/configs/rust-sentinel-qlora.yml|axolotl/output/rust-sentinel"
  "typescript-auditor|axolotl/configs/typescript-auditor-qlora.yml|axolotl/output/typescript-auditor"
)

for target in "${TRAIN_TARGETS[@]}"; do
  IFS='|' read -r identity config_path output_dir <<<"${target}"
  dataset_path="axolotl/datasets/${identity}-train.jsonl"
  artifact_dir="${output_dir}/${RUN_ID}"

  echo "-- [${identity}] sync curated traces"
  aws s3 cp "${TRAJECTORY_BUCKET}/${identity}.jsonl" "${dataset_path}"

  echo "-- [${identity}] train adapter with Axolotl"
  bash scripts/train-specialist.sh "${config_path}"

  if [[ ! -d "${output_dir}" ]]; then
    echo "Expected output directory missing: ${output_dir}"
    exit 1
  fi
  mkdir -p "${artifact_dir}"
  cp -R "${output_dir}/." "${artifact_dir}/"

  echo "-- [${identity}] publish adapters"
  aws s3 sync "${artifact_dir}" "${ADAPTER_BUCKET}/${identity}/${RUN_ID}/"
done

echo "Weekly adapter evolution complete."
