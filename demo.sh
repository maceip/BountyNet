#!/usr/bin/env bash
set -euo pipefail

echo
echo "BountyNet demo helpers"
echo

echo "Open dashboard:"
echo "  https://bountynet.stare.network/?v=2"
echo

echo "Emitting one fresh event..."
python3 - <<'PY'
import uuid
import requests

external_id = f"demo:{uuid.uuid4().hex[:8]}"
r = requests.post(
    "https://gateway.stare.network/identity/onboard",
    json={"external_id": external_id},
    timeout=10,
)
print(r.text)
PY

echo
echo "Watching live events. Ctrl+C to stop."
watch -n 2 "curl -fsS https://gateway.stare.network/events?limit=10 | jq"
