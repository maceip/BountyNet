#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <axolotl-config-relative-path>"
  echo "Example: $0 axolotl/configs/rust-sentinel-qlora.yml"
  exit 1
fi

CONFIG_PATH="$1"

FINAL_CONFIG_PATH="/workspace/${CONFIG_PATH}"
TMP_CONFIG=""
PREFLIGHT="${AXOLOTL_PREFLIGHT:-1}"

if [[ -n "${AXOLOTL_SEQUENCE_LEN:-}" ]]; then
  TMP_CONFIG="$(mktemp /tmp/axolotl-config-XXXXXX.yml)"
  trap '[[ -n "${TMP_CONFIG}" && -f "${TMP_CONFIG}" ]] && rm -f "${TMP_CONFIG}"' EXIT
  awk -v seq="${AXOLOTL_SEQUENCE_LEN}" '
    BEGIN { replaced=0 }
    {
      if (!replaced && $0 ~ /^sequence_len:[[:space:]]*[0-9]+$/) {
        print "sequence_len: " seq
        replaced=1
      } else {
        print $0
      }
    }
  ' "${CONFIG_PATH}" > "${TMP_CONFIG}"
  FINAL_CONFIG_PATH="${TMP_CONFIG}"
fi

if [[ "${PREFLIGHT}" != "0" ]]; then
  LOCAL_CONFIG_PATH="${CONFIG_PATH}"
  [[ -n "${TMP_CONFIG}" ]] && LOCAL_CONFIG_PATH="${TMP_CONFIG}"
  SEQ_LEN="$(awk -F: '/^sequence_len:/ {gsub(/[[:space:]]/, "", $2); print $2; exit}' "${LOCAL_CONFIG_PATH}")"
  MICRO_BATCH="$(awk -F: '/^micro_batch_size:/ {gsub(/[[:space:]]/, "", $2); print $2; exit}' "${LOCAL_CONFIG_PATH}")"
  GRAD_ACCUM="$(awk -F: '/^gradient_accumulation_steps:/ {gsub(/[[:space:]]/, "", $2); print $2; exit}' "${LOCAL_CONFIG_PATH}")"
  python3 "$(dirname "$0")/axolotl-memory-preflight.py" \
    --sequence-len "${SEQ_LEN:-32768}" \
    --micro-batch-size "${MICRO_BATCH:-1}" \
    --gradient-accumulation-steps "${GRAD_ACCUM:-8}"
fi

docker compose run --rm \
  -v /tmp:/tmp \
  axolotl-trainer \
  axolotl train "${FINAL_CONFIG_PATH}"
