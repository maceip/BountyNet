# Canonical Paths

This file classifies the main user- and operator-facing surfaces in the repo.

## Status meanings

- **canonical**: the primary product path we want users to follow
- **support**: valid supporting or operator tooling, but not the first-run story
- **test-only**: for tests, sims, or adversarial/dev harnesses only
- **delete**: intended removal target once replacement is stable

## Frontend routes (`clients/web`)

| Surface | Status | Notes |
|---|---|---|
| `/setup` | canonical | Primary staker flow: install app, choose repos, add/test budget, scan |
| `/auth/cli` | support | Browser-side auth handoff for `be join`; ends at `POST /identity/onboard` |
| `/` | support | Overview / operator landing, not buyer first-run |
| `/bounties` | support | Feed / inspection |
| `/bounties/:hash` | support | Detail / inspection |
| `/gateway` | support | Operator diagnostics |
| `/resources` | support | Resource claim inspection, not core buyer flow |
| `/solve` | support | Solver-facing explanation/support page |
| `/explore` | support | Discovery/support surface |
| `/agent` | support | Agent inspection/support |
| `/settings` | support | Operator configuration |

## CLI (`clients/cli`)

| Command | Status | Notes |
|---|---|---|
| `be join` | canonical | Canonical solver onboarding |
| `be status` | support | Agent inspection |
| `be bounties list` | support | Solver/operator support |
| `be bounties watch` | canonical | Canonical solver pickup loop |
| `be bounties create` | support | Useful for manual/dev workflows, not buyer primary path |

## Gateway routes

### Identity

| Route | Status | Notes |
|---|---|---|
| `POST /identity/onboard` | canonical | Canonical onboarding operation |
| `POST /identity/cli/sessions` | canonical | Canonical CLI auth adapter session creation |
| `GET /identity/cli/sessions/<session_id>` | canonical | Canonical CLI auth adapter polling |
| `POST /identity/cli/sessions/<session_id>/complete` | canonical | Browser-side completion for CLI auth adapter |
| `GET /identity/<agent_id>` | canonical | Canonical identity status read |
| `POST /identity/<agent_id>/wallet` | support | Wallet linking / settlement support |
| `POST /identity/android-attestation/bind` | support | Android device binding |

### Staker / GitHub

| Route | Status | Notes |
|---|---|---|
| `GET /github/repos/<installation_id>` | canonical | Canonical setup flow |
| `POST /github/test-key` | canonical | Canonical setup flow |
| `POST /github/setup` | canonical | Canonical setup flow |
| `POST /github/scan/<installation_id>` | canonical | Canonical setup flow |
| `POST /github/webhook` | canonical | Core system ingestion |
| `POST /github/submit-pr` | canonical | Canonical solver PR submission |

### Bounties / inference

| Route | Status | Notes |
|---|---|---|
| `GET /bounties` | canonical | Canonical marketplace read |
| `GET /bounties/<context_hash>` | canonical | Canonical bounty detail |
| `POST /bounties/<context_hash>/claim` | canonical | Canonical solver claim |
| `POST /v1/messages` | canonical | Canonical Anthropic-style inference |
| `POST /v1/chat/completions` | support | OpenAI-compatible support surface |
| `GET /credits/<agent_id>` | support | Solver/operator inspection |
| `GET /sessions` | support | Operator/session inspection |
| `POST /budget/deposit` | support | Budget/provider-key support API |
| `GET /budget/<context_hash>` | support | Budget inspection |
| `POST /bounties/create` | support | Manual/dev creation path, not buyer primary path |

### Other subsystems

| Route family | Status | Notes |
|---|---|---|
| `/oracle/*` | canonical | Core validation path |
| `/ens/*` | canonical | Core identity/readability layer |
| `POST /resources/claims` | canonical | Canonical resource-claim creation |
| `GET /resources/claims`, `GET /resources/claims/<id>` | canonical | Canonical resource-claim reads |
| `/chatgpt/*` | support | Connector/support path |
| `/attest*`, `/challenge`, `/verify` | support | Device attestation support |
| `/logs/android` | support | Observability |

## Simulators (`sim/`)

| Script | Status | Notes |
|---|---|---|
| `sim/agent.py` | canonical | Canonical end-to-end solver sim |
| `sim/sim_staker.py` | support | Browser-use staker scenario |
| `sim/sim_solver.py` | support | Browser-use solver UI scenario |
| `sim/seed_gateway.py` | support | Demo/environment seeding |
| `sim/malicious.py` | test-only | Adversarial/security simulator |
