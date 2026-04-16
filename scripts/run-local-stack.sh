#!/usr/bin/env bash
set -euo pipefail

GATEWAY_PORT="${GATEWAY_PORT:-8090}"
CONSOLE_PORT="${CONSOLE_PORT:-5174}"
DEGRADED_HEALTH="${DEGRADED_HEALTH:-0}"
DRY_RUN="${DRY_RUN:-0}"

echo "== BountyNet local stack =="

export PYTHONPATH=.
export GATEWAY_PORT
if [[ "$DEGRADED_HEALTH" == "1" ]]; then
  export BOUNTYNET_HEALTH_ALLOW_DEGRADED=1
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] gateway command: python -m gateway.app"
  echo "[dry-run] console command: VITE_GATEWAY_URL=http://127.0.0.1:${GATEWAY_PORT} npm run dev -- --host 127.0.0.1 --port ${CONSOLE_PORT}"
  exit 0
fi

echo "[gateway] starting on :${GATEWAY_PORT}"
python -m gateway.app > /tmp/bountynet-gateway.log 2>&1 &
GATEWAY_PID=$!

echo "[console] starting on :${CONSOLE_PORT}"
(
  cd projects/agent-market/console-ui
  VITE_GATEWAY_URL="http://127.0.0.1:${GATEWAY_PORT}" npm run dev -- --host 127.0.0.1 --port "${CONSOLE_PORT}" > /tmp/bountynet-console.log 2>&1
) &
CONSOLE_PID=$!

echo
echo "Started."
echo "Gateway: http://127.0.0.1:${GATEWAY_PORT} (pid ${GATEWAY_PID})"
echo "Console: http://127.0.0.1:${CONSOLE_PORT} (pid ${CONSOLE_PID})"
echo "Logs: /tmp/bountynet-gateway.log and /tmp/bountynet-console.log"
