#!/usr/bin/env bash
set -euo pipefail

INF2_BASE="${INF2_BASE:-${AWS_VLLM_API_BASE:-}}"
INF2_KEY="${INF2_KEY:-${AWS_VLLM_API_KEY:-}}"
C8G_BASE="${C8G_BASE:-${AWS_C8G_API_BASE:-}}"
C8G_KEY="${C8G_KEY:-${AWS_C8G_API_KEY:-}}"
AGENT_ID_HEADER="${AGENT_ID_HEADER:-X-Agent-ID}"
AGENT_ID_VALUE="${AGENT_ID_VALUE:-rust-sentinel}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

need_cmd curl
need_cmd jq

probe_lane() {
  local name="$1"
  local base="$2"
  local key="$3"
  local model="$4"

  if [[ -z "${base}" ]]; then
    echo "-- ${name}: skipped (base URL not configured)"
    return 0
  fi

  echo "-- ${name}: models"
  curl -fsS "${base}/models" \
    -H "Authorization: Bearer ${key}" \
    | jq -e '.data | length >= 1' >/dev/null

  echo "-- ${name}: completion + adapter identity"
  local resp
  resp="$(
    curl -fsS "${base}/chat/completions" \
      -H "Authorization: Bearer ${key}" \
      -H "${AGENT_ID_HEADER}: ${AGENT_ID_VALUE}" \
      -H "Content-Type: application/json" \
      -d "{
        \"model\":\"${model}\",
        \"messages\":[{\"role\":\"user\",\"content\":\"Reply with ok\"}],
        \"max_tokens\":16
      }"
  )"
  jq -e '.choices[0].message.content != null' >/dev/null <<<"${resp}"
}

echo "== Model lane smoke =="
probe_lane "inf2" "${INF2_BASE%/v1}/v1" "${INF2_KEY}" "base-coder"
probe_lane "c8g" "${C8G_BASE%/v1}/v1" "${C8G_KEY}" "cpu-worker"
echo "Model lane smoke passed."
