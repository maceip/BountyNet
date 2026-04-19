#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-slice}"
LITELLM_KEY="${LITELLM_KEY:-local-litellm-master-key}"

case "${PROFILE}" in
  slice|full) ;;
  *)
    echo "Usage: ./scripts/dev-stack-smoke.sh [slice|full]"
    exit 1
    ;;
esac

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

need_cmd curl
need_cmd jq
need_cmd python3

wait_http() {
  local url="$1"
  local attempts="${2:-40}"
  local sleep_s="${3:-1}"
  local i=1
  while (( i <= attempts )); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${sleep_s}"
    ((i++))
  done
  echo "Timed out waiting for ${url}"
  return 1
}

wait_jsonrpc() {
  local attempts="${1:-40}"
  local i=1
  while (( i <= attempts )); do
    local resp
    resp="$(
      curl -fsS "http://127.0.0.1:8545" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' || true
    )"
    if [[ -n "${resp}" ]] && jq -e '.result != null' >/dev/null 2>&1 <<<"${resp}"; then
      return 0
    fi
    sleep 1
    ((i++))
  done
  echo "Timed out waiting for Anvil JSON-RPC"
  return 1
}

wait_litellm_completion() {
  local attempts="${1:-60}"
  local i=1
  while (( i <= attempts )); do
    local body
    body="$(
      curl -sS --max-time 10 "http://127.0.0.1:4000/v1/chat/completions" \
        -H "Authorization: Bearer ${LITELLM_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
          "model":"agents/default",
          "messages":[{"role":"user","content":"Reply with exactly: ok"}],
          "max_tokens":8
        }' || true
    )"
    if [[ -n "${body}" ]] && jq -e '.choices[0].message.content != null' >/dev/null 2>&1 <<<"${body}"; then
      printf '%s' "${body}"
      return 0
    fi
    sleep 2
    ((i++))
  done
  echo "Timed out waiting for LiteLLM completion readiness" >&2
  return 1
}

litellm_completion() {
  local user_text="$1"
  curl -sS --max-time 20 "http://127.0.0.1:4000/v1/chat/completions" \
    -H "Authorization: Bearer ${LITELLM_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\":\"agents/default\",
      \"messages\":[{\"role\":\"user\",\"content\":\"${user_text}\"}],
      \"max_tokens\":24
    }"
}

check_agent_adapter_handoff() {
  for adapter in ts-migrator rust-sentinel; do
    local resp
    resp="$(
      curl -fsS --max-time 25 "http://127.0.0.1:8000/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "X-Agent-ID: ${adapter}" \
        -d '{
          "model":"base-coder",
          "messages":[{"role":"user","content":"Reply with ok"}],
          "max_tokens":16
        }'
    )"
    jq -e --arg marker "[agent-id:${adapter}]" '.choices[0].message.content | contains($marker)' >/dev/null <<<"${resp}"
  done
}

dev_factor_proof() {
  local factor_type="$1"
  local challenge_id="$2"
  local nonce="$3"
  local identifier="$4"
  python3 - "$factor_type" "$challenge_id" "$nonce" "$identifier" <<'PY'
import hashlib
import sys

secret = "adapter-dev-secret"
factor_type = sys.argv[1]
challenge_id = sys.argv[2]
nonce = sys.argv[3]
identifier = sys.argv[4].lower()
payload = f"{secret}:{factor_type}:{challenge_id}:{nonce}:{identifier}"
print(hashlib.sha256(payload.encode("utf-8")).hexdigest())
PY
}

sign_eth_message() {
  local private_key="$1"
  local message="$2"
  python3 - "$private_key" "$message" <<'PY'
import sys
from eth_account import Account
from eth_account.messages import encode_defunct

private_key = sys.argv[1]
message = sys.argv[2]
sig = Account.sign_message(encode_defunct(text=message), private_key).signature.hex()
print(sig if sig.startswith("0x") else f"0x{sig}")
PY
}

sign_eth_challenge_from_json() {
  local challenge_json="$1"
  local private_key="$2"
  python3 - "$challenge_json" "$private_key" <<'PY'
import json
import sys
from eth_account import Account
from eth_account.messages import encode_defunct

challenge = json.loads(sys.argv[1])
private_key = sys.argv[2]
message = challenge["message_template"]
sig = Account.sign_message(encode_defunct(text=message), private_key).signature.hex()
print(sig if sig.startswith("0x") else f"0x{sig}")
PY
}

generate_eth_identity() {
  python3 - <<'PY'
import json
from eth_account import Account

account = Account.create()
print(json.dumps({"address": account.address.lower(), "private_key": account.key.hex()}))
PY
}

echo "== Dev stack smoke (${PROFILE}) =="

echo "-- waiting for core services"
wait_http "http://127.0.0.1:4000/health/liveliness"
wait_http "http://127.0.0.1:8090/health"
wait_jsonrpc

echo "-- anvil request"
ANVIL_RESP="$(
  curl -fsS "http://127.0.0.1:8545" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
)"
jq -e '.result | type == "string"' >/dev/null <<<"${ANVIL_RESP}"

if [[ "${PROFILE}" == "full" ]]; then
  echo "-- full model backend checks"
  wait_http "http://127.0.0.1:8000/v1/models" 180 2
  wait_http "http://127.0.0.1:5173/" 180 2
  MODELS_RESP="$(curl -fsS "http://127.0.0.1:8000/v1/models")"
  if jq -e '.data[0].owned_by == "bountynet-local"' >/dev/null 2>&1 <<<"${MODELS_RESP}"; then
    echo "full profile is still using the mock model backend on :8000"
    exit 1
  fi
fi

echo "-- litellm completion request"
LITELLM_RESP="$(wait_litellm_completion)"

echo "-- gateway API checks"
curl -fsS "http://127.0.0.1:8090/events" | jq -e '.events != null' >/dev/null
curl -fsS "http://127.0.0.1:8090/health" | jq -e '.status != null' >/dev/null
MCP_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "http://127.0.0.1:8090/mcp")"
if [[ "${MCP_CODE}" != "204" ]]; then
  echo "Expected OPTIONS /mcp to return 204, got ${MCP_CODE}"
  exit 1
fi

if [[ "${PROFILE}" == "full" ]]; then
  echo "-- full profile checks (auth verifier + oracle)"
  wait_http "http://127.0.0.1:8100/health"
  wait_http "http://127.0.0.1:8099/health"
  wait_http "http://127.0.0.1:8095/oracle/health"

  echo "-- full profile auth + ops checks"
  IDENTITY_JSON="$(generate_eth_identity)"
  ADMIN_ADDR="$(jq -r '.address' <<<"${IDENTITY_JSON}")"
  ADMIN_ETH_PRIVATE_KEY="$(jq -r '.private_key' <<<"${IDENTITY_JSON}")"
  DEVICE_ID="smoke-device-admin"
  CHAL1="$(
    curl -fsS "http://127.0.0.1:8090/auth/challenge" \
      -H "Content-Type: application/json" \
      -d "{\"factor_type\":\"wallet_eth\",\"payload\":{\"address\":\"${ADMIN_ADDR}\"}}"
  )"
  CHAL1_ID="$(jq -r '.challenge_id' <<<"${CHAL1}")"
  CHAL1_NONCE="$(jq -r '.nonce' <<<"${CHAL1}")"
  CHAL1_SIG="$(sign_eth_challenge_from_json "${CHAL1}" "${ADMIN_ETH_PRIVATE_KEY}")"
  VERIFY1="$(
    curl -fsS "http://127.0.0.1:8090/auth/verify" \
      -H "Content-Type: application/json" \
      -d "{
        \"factor_type\":\"wallet_eth\",
        \"challenge_id\":\"${CHAL1_ID}\",
        \"address\":\"${ADMIN_ADDR}\",
        \"signature\":\"${CHAL1_SIG}\",
        \"device_fingerprint\":\"${DEVICE_ID}\"
      }"
  )"
  ADMIN_TOKEN_BEFORE="$(jq -r '.token' <<<"${VERIFY1}")"
  [[ -n "${ADMIN_TOKEN_BEFORE}" && "${ADMIN_TOKEN_BEFORE}" != "null" ]]

  BLOCKED_CODE="$(
    curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8090/ops/serving/topology" \
      -H "Authorization: Bearer ${ADMIN_TOKEN_BEFORE}" \
      -H "X-BN-Device-Fingerprint: ${DEVICE_ID}"
  )"
  if [[ "${BLOCKED_CODE}" != "401" ]]; then
    echo "Expected non-admin ops topology to return 401, got ${BLOCKED_CODE}"
    exit 1
  fi

  curl -fsS "http://127.0.0.1:8090/auth/bootstrap/admin" \
    -H "Content-Type: application/json" \
    -d "{\"identifier_kind\":\"eth\",\"identifier_value\":\"${ADMIN_ADDR}\"}" >/dev/null

  CHAL2="$(
    curl -fsS "http://127.0.0.1:8090/auth/challenge" \
      -H "Content-Type: application/json" \
      -d "{\"factor_type\":\"wallet_eth\",\"payload\":{\"address\":\"${ADMIN_ADDR}\"}}"
  )"
  CHAL2_ID="$(jq -r '.challenge_id' <<<"${CHAL2}")"
  CHAL2_NONCE="$(jq -r '.nonce' <<<"${CHAL2}")"
  CHAL2_SIG="$(sign_eth_challenge_from_json "${CHAL2}" "${ADMIN_ETH_PRIVATE_KEY}")"
  VERIFY2="$(
    curl -fsS "http://127.0.0.1:8090/auth/verify" \
      -H "Content-Type: application/json" \
      -d "{
        \"factor_type\":\"wallet_eth\",
        \"challenge_id\":\"${CHAL2_ID}\",
        \"address\":\"${ADMIN_ADDR}\",
        \"signature\":\"${CHAL2_SIG}\",
        \"device_fingerprint\":\"${DEVICE_ID}\"
      }"
  )"
  ADMIN_TOKEN="$(jq -r '.token' <<<"${VERIFY2}")"
  [[ -n "${ADMIN_TOKEN}" && "${ADMIN_TOKEN}" != "null" ]]

  TOPOLOGY="$(
    curl -fsS "http://127.0.0.1:8090/ops/serving/topology" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "X-BN-Device-Fingerprint: ${DEVICE_ID}"
  )"
  jq -e '.status != null' >/dev/null <<<"${TOPOLOGY}"
  TRAFFIC_SHIFT="$(
    curl -fsS "http://127.0.0.1:8090/ops/serving/traffic-shift" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "X-BN-Device-Fingerprint: ${DEVICE_ID}" \
      -H "Content-Type: application/json" \
      -d '{"us_percent":60,"eu_percent":40,"changed_by":"smoke","notes":"dev full smoke"}'
  )"
  jq -e '.traffic != null' >/dev/null <<<"${TRAFFIC_SHIFT}"

  echo "-- full profile fallback + cutback checks"
  FALLBACK_RESP="$(litellm_completion "__force_timeout__ force anthropic fallback")"
  jq -e '.choices[0].message.content | contains("[anthropic-fallback]")' >/dev/null <<<"${FALLBACK_RESP}"

  sleep 3
  CUTBACK_RESP="$(litellm_completion "primary should be back")"
  jq -e '.choices[0].message.content | contains("[primary-tiny]")' >/dev/null <<<"${CUTBACK_RESP}"

  echo "-- full profile adapter routing handoff checks"
  check_agent_adapter_handoff

  echo "-- full profile persona orchestrator checks"
  python3 "$(dirname "$0")/full_smoke_orchestrator.py" >/tmp/bn-full-orchestrator-latest.txt

  echo "-- full profile UI render sanity"
  python3 "$(dirname "$0")/ui_render_smoke.py"

  echo "-- full profile WebMCP simulator evals"
  python3 "$(dirname "$0")/webmcp_simulator_eval.py" --base-url "http://127.0.0.1:5173"

  if [[ -n "${AWS_VLLM_API_BASE:-}" || -n "${AWS_C8G_API_BASE:-}" ]]; then
    echo "-- full profile remote model-lane smoke"
    bash "$(dirname "$0")/model-lane-smoke.sh"
  fi

  curl -fsS "http://127.0.0.1:8099/health" | jq -e '.status == "ok"' >/dev/null
  VERIFY_RESP="$(
    curl -fsS "http://127.0.0.1:8099/verify" \
      -H "Content-Type: application/json" \
      -d '{
        "factor_type":"wallet_sol",
        "challenge_id":"smoke-chal",
        "nonce":"smoke-nonce",
        "request_payload":{
          "identifier":"solana:local-dev-user",
          "proof":"304ccd179da0746912adce542a5ac89a40544cf3fa5b8c89b97f17e766acc809"
        }
      }'
  )"
  jq -e '.ok == true' >/dev/null <<<"${VERIFY_RESP}"

  curl -fsS "http://127.0.0.1:8095/oracle/health" | jq -e '.status == "ok"' >/dev/null
  ORACLE_SIGN="$(
    curl -fsS "http://127.0.0.1:8095/oracle/sign" \
      -H "Content-Type: application/json" \
      -d '{"repo":"local/dev","sha":"abc123","check_name":"build","conclusion":"success"}'
  )"
  jq -e '.message_hash != null and .r != null and .s != null and .v != null' >/dev/null <<<"${ORACLE_SIGN}"
fi

echo "Smoke passed for profile: ${PROFILE}"
