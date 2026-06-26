# WebMCP Evals in BountyNet

This repo now includes deterministic simulator evals for repo_owner/agent_operator persona journeys.

## Included now

- Eval spec: `scripts/webmcp_sim_evals.json`
- Runner: `scripts/webmcp_simulator_eval.py`
- Script alias: `npm run dev:test:webmcp`
- Full smoke integration: `scripts/dev-stack-smoke.sh` (full profile)

The runner checks:

1. WebMCP journey manifest endpoints are reachable and include repo_owner/agent_operator.
2. Repo owner simulator journey (repo setup + preset application) succeeds.
3. Agent operator simulator journey (operator onboarding + agent registration) succeeds.

## Run locally

```bash
npm run dev:full
npm run dev:test:webmcp
```

## Relationship to GoogleChromeLabs `evals-cli`

The GoogleChromeLabs `evals-cli` project introduces two useful modes:

- `runevals`: static tool-schema + eval definitions
- `webmcpevals`: live browser tool discovery and model-evaluated tool trajectories

Our current simulator evals are deterministic and backend-focused (fast CI signal).
For model behavior scoring, add a second lane using `webmcpevals` against
`http://127.0.0.1:5173` with Chrome Canary and WebMCP testing enabled.

Recommended split:

- **CI required**: deterministic simulator evals (`webmcp_simulator_eval.py`)
- **Nightly/staging**: `webmcpevals` for model/tool-calling quality tracking
