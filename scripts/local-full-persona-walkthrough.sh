#!/usr/bin/env bash
set -euo pipefail

GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://127.0.0.1:8090}"

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
  local attempts="${2:-60}"
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
  exit 1
}

echo "== BountyNet local full persona walkthrough =="
wait_http "${GATEWAY_BASE_URL}/health"

RUN_ID="$(date +%s)"
OP_SLUG="local-operator-${RUN_ID}"
REPO_FULL_NAME="local/persona-demo-${RUN_ID}"

echo "-- persona A: repo owner onboarding"
REPO_SETUP="$(
  curl -fsS "${GATEWAY_BASE_URL}/market/repositories/setup" \
    -H "Content-Type: application/json" \
    -d "{
      \"installation_id\": ${RUN_ID},
      \"repos\": [\"${REPO_FULL_NAME}\"],
      \"owner\": \"local\",
      \"local_path\": \"/tmp\",
      \"enabled_job_classes\": [\"ci_repair\",\"dependency_update\"],
      \"required_checks\": [\"CI\"],
      \"budget_priority\": [\"platform_credits\",\"api_key_pool\"],
      \"monthly_spend_cap\": 10000,
      \"per_job_spend_cap\": 1000
    }"
)"
jq -e '.repositories | length >= 1' >/dev/null <<<"${REPO_SETUP}"
jq -e --arg repo "${REPO_FULL_NAME}" '.repositories[] | select(.repo_full_name == $repo)' >/dev/null <<<"${REPO_SETUP}"

echo "-- persona B: agent operator onboarding + 6 agents"
OP_CREATE="$(
  curl -fsS "${GATEWAY_BASE_URL}/market/operators" \
    -H "Content-Type: application/json" \
    -d "{
      \"slug\":\"${OP_SLUG}\",
      \"display_name\":\"Local Operator ${RUN_ID}\",
      \"summary\":\"Local operator walkthrough\",
      \"contact_email\":\"ops+${RUN_ID}@local.test\"
    }"
)"
OPERATOR_ID="$(jq -r '.operator.id' <<<"${OP_CREATE}")"
[[ -n "${OPERATOR_ID}" && "${OPERATOR_ID}" != "null" ]]

curl -fsS "${GATEWAY_BASE_URL}/market/operators/${OPERATOR_ID}/onboard" \
  -H "Content-Type: application/json" \
  -d "{
    \"identity_anchor\":\"dynamic:local-operator-${RUN_ID}\",
    \"wallet\":\"0x1111111111111111111111111111111111111111\",
    \"verification_status\":\"verified\"
  }" >/dev/null

declare -a AGENT_SPECS=(
  "ts-migrator|typescript|migration|ci_repair,dependency_update|typescript,github_actions"
  "ts-auditor|typescript|security_audit|security_update,ci_repair|typescript,github_actions"
  "ts-architect|typescript|planning|ci_repair,dependency_update|typescript"
  "rust-porter|rust|porting|dependency_update,ci_repair|rust,github_actions"
  "rust-sentinel|rust|security_patch|security_update,ci_repair|rust,github_actions"
  "rust-optimizer|rust|optimization|ci_repair,dependency_update|rust"
)

FIRST_AGENT_ID=""
for spec in "${AGENT_SPECS[@]}"; do
  IFS='|' read -r slug pod lane job_classes ecosystems <<<"${spec}"
  agent_slug="${OP_SLUG}-${slug}"
  AGENT_CREATE="$(
    curl -fsS "${GATEWAY_BASE_URL}/market/agents" \
      -H "Content-Type: application/json" \
      -d "{
        \"slug\":\"${agent_slug}\",
        \"display_name\":\"${agent_slug}\",
        \"operator_id\":\"${OPERATOR_ID}\",
        \"agent_kind\":\"specialist\",
        \"pod\":\"${pod}\",
        \"lane\":\"${lane}\",
        \"supported_job_classes\":[\"${job_classes/,/\",\"}\"],
        \"supported_ecosystems\":[\"${ecosystems/,/\",\"}\"],
        \"supported_budget_types\":[\"platform_credits\"],
        \"status\":\"active\"
      }"
  )"
  AGENT_ID="$(jq -r '.agent.id' <<<"${AGENT_CREATE}")"
  [[ -n "${AGENT_ID}" && "${AGENT_ID}" != "null" ]]
  if [[ -z "${FIRST_AGENT_ID}" ]]; then
    FIRST_AGENT_ID="${AGENT_ID}"
  fi
done

echo "-- create job and attempt fulfillment"
JOB_CREATE="$(
  curl -fsS "${GATEWAY_BASE_URL}/market/jobs" \
    -H "Content-Type: application/json" \
    -d "{
      \"repo_full_name\":\"${REPO_FULL_NAME}\",
      \"job_class\":\"ci_repair\",
      \"title\":\"Persona walkthrough repair\",
      \"summary\":\"Try repair with local tiny model\",
      \"budget_ceiling\": 900
    }"
)"
JOB_ID="$(jq -r '.job.id' <<<"${JOB_CREATE}")"
[[ -n "${JOB_ID}" && "${JOB_ID}" != "null" ]]

PLAN_CREATE="$(
  curl -fsS "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}/plans" \
    -H "Content-Type: application/json" \
    -d "{
      \"agent_id\":\"${FIRST_AGENT_ID}\",
      \"operator_id\":\"${OPERATOR_ID}\",
      \"summary\":\"Analyze CI issue, propose minimal patch, test\",
      \"steps\":[\"analyze\",\"patch\",\"validate\"]
    }"
)"
PLAN_ID="$(jq -r '.plan.id' <<<"${PLAN_CREATE}")"

ASSIGN_CREATE="$(
  curl -fsS "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}/assignments" \
    -H "Content-Type: application/json" \
    -d "{
      \"agent_id\":\"${FIRST_AGENT_ID}\",
      \"plan_id\":\"${PLAN_ID}\",
      \"assigned_by\":\"persona-walkthrough\",
      \"mode\":\"exclusive\",
      \"lease_seconds\": 900
    }"
)"
ASSIGN_ID="$(jq -r '.assignment.id' <<<"${ASSIGN_CREATE}")"

# We deliberately accept either executed or execution_failed to prove attempted fulfillment.
EXECUTE_RESP="$(
  curl -sS "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}/execute" \
    -H "Content-Type: application/json" \
    -d "{
      \"assignment_id\":\"${ASSIGN_ID}\",
      \"mode\":\"dry_run\",
      \"force\": true,
      \"idempotency_key\":\"persona-${RUN_ID}\"
    }"
)"
EXECUTE_STATUS_CODE="$(
  curl -s -o /tmp/bn-persona-exec-${RUN_ID}.json -w "%{http_code}" "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}/execute" \
    -H "Content-Type: application/json" \
    -d "{
      \"assignment_id\":\"${ASSIGN_ID}\",
      \"mode\":\"dry_run\",
      \"force\": true,
      \"idempotency_key\":\"persona-${RUN_ID}-2\"
    }"
)"
if [[ "${EXECUTE_STATUS_CODE}" != "200" && "${EXECUTE_STATUS_CODE}" != "400" ]]; then
  echo "Unexpected execute status code: ${EXECUTE_STATUS_CODE}"
  cat "/tmp/bn-persona-exec-${RUN_ID}.json"
  exit 1
fi

RUNS="$(curl -fsS "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}/runs")"
INVOKES="$(curl -fsS "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}/invocations")"
DETAIL="$(curl -fsS "${GATEWAY_BASE_URL}/market/jobs/${JOB_ID}")"

SUMMARY_PATH="/tmp/bn-persona-walkthrough-${RUN_ID}.json"
jq -n \
  --arg run_id "${RUN_ID}" \
  --arg operator_id "${OPERATOR_ID}" \
  --arg repo "${REPO_FULL_NAME}" \
  --arg job_id "${JOB_ID}" \
  --arg assignment_id "${ASSIGN_ID}" \
  --arg execute_status_code "${EXECUTE_STATUS_CODE}" \
  --argjson runs "$(jq '.runs' <<<"${RUNS}")" \
  --argjson invocations "$(jq '.invocations' <<<"${INVOKES}")" \
  --argjson detail "$(jq '.' <<<"${DETAIL}")" \
  '{
    run_id: $run_id,
    operator_id: $operator_id,
    repo: $repo,
    job_id: $job_id,
    assignment_id: $assignment_id,
    execute_status_code: ($execute_status_code|tonumber),
    runs: $runs,
    invocations: $invocations,
    detail: $detail
  }' > "${SUMMARY_PATH}"

echo "Walkthrough complete. Summary: ${SUMMARY_PATH}"
