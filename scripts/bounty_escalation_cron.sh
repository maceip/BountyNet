#!/usr/bin/env bash
# Optional operator cron: export metrics about open bounties for external autoscalers
# (e.g. Silverback, Datadog). Does not mutate state.
set -euo pipefail
GATEWAY="${BOUNTYNET_GATEWAY:-https://gateway.stare.network}"
curl -fsS "${GATEWAY%/}/bounties" | python3 -c "import json,sys; d=json.load(sys.stdin); print('bounties_open', d.get('count', len(d.get('bounties',[]))))"
