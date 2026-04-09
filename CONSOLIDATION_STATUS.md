# Consolidation status

## Applied

- `clients/web` is the canonical frontend.
- `/setup` is the canonical staker flow.
- `POST /identity/onboard` is the canonical onboarding operation.
- `be join` now uses the canonical CLI auth adapter:
  - `POST /identity/cli/sessions`
  - web `/auth/cli`
  - `POST /identity/onboard`
  - poll completed session back into the CLI
- Resource claims now have canonical routes:
  - `POST /resources/claims`
  - `GET /resources/claims`
  - `GET /resources/claims/<id>`
- `identity_anchor` is the only internal identity term used in gateway onboarding.
- `sim/agent.py` is the canonical end-to-end solver simulator; other sims are support or test-only.
- Canonical bounty payloads now have schema-backed contracts for feed/detail and create responses.
- Canonical resource-claim payloads now have schema-backed contracts for list/detail and create responses.
- Removed `/stake`, `/connect`, `/resources`, `/resources/<id>`, `/resources/stake`, `/github`, and the old onboarding field-based identity path.

## Next structural migrations

1. Move CLI auth state persistence and web onboarding responses onto one typed contract shared across clients.
2. Split budget vocabulary and APIs more cleanly:
   - inference budget
   - escrow funding
   - resource claims
   - solver provider keys
3. Decide whether Python remains the orchestration owner or whether gateway + CLI move into one Rust workspace later.
