#!/bin/bash
# BountyNet Runner entrypoint
#
# Registers as a GitHub Actions self-hosted runner, then starts.
# On completion, posts attestation to the BountyNet gateway.

set -euo pipefail

REPO_URL="${REPO_URL:?Set REPO_URL}"
GITHUB_TOKEN="${GITHUB_TOKEN:?Set GITHUB_TOKEN}"
RUNNER_NAME="${RUNNER_NAME:-bountynet-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-bountynet,tee,self-hosted}"
GATEWAY_URL="${GATEWAY_URL:-https://gateway.stare.network}"

echo "[bountynet-runner] configuring runner: ${RUNNER_NAME}"
echo "[bountynet-runner] repo: ${REPO_URL}"
echo "[bountynet-runner] labels: ${RUNNER_LABELS}"

# Get registration token from GitHub API
OWNER_REPO=$(echo "$REPO_URL" | sed 's|https://github.com/||')
REG_TOKEN=$(curl -s -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER_REPO}/actions/runners/registration-token" \
  | jq -r .token)

if [ "$REG_TOKEN" = "null" ] || [ -z "$REG_TOKEN" ]; then
  echo "[bountynet-runner] ERROR: could not get registration token"
  echo "[bountynet-runner] check GITHUB_TOKEN has admin:repo scope"
  exit 1
fi

# Configure runner
./config.sh \
  --url "$REPO_URL" \
  --token "$REG_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --unattended \
  --replace

# Cleanup on exit
cleanup() {
  echo "[bountynet-runner] removing runner..."
  ./config.sh remove --token "$REG_TOKEN" 2>/dev/null || true
}
trap cleanup EXIT

echo "[bountynet-runner] starting runner..."
./run.sh
