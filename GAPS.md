# BountyNet — remaining gaps

What **shipped** is described in [`ARCHITECTURE.md`](ARCHITECTURE.md), [`API.md`](API.md), and [`SOLVER_INTEGRATION.md`](SOLVER_INTEGRATION.md).

## Addressed in-tree (production-oriented)

- **Gateway persistence** — SQLite (`gateway/store.py`): installations, budgets, credits, API-key bounties, ChatGPT links, inference session history, CI failure streaks. Configure `BOUNTYNET_DB_PATH` or `BOUNTYNET_DATA_DIR`.
- **`bountynet.yml` on install** — `.github/bountynet.yml` created on default branch when missing (`gateway/github/api.py` + install webhook).
- **Progressive bounty budgets** — repeated failures for the same repo+check raise the effective inference budget using configured multipliers until CI goes green (streak reset on success without an open solver PR, or on resolution path as implemented).
- **Richer web console** — React Router routes: Overview, Bounties (+ detail), Gateway, Resources, Stake, Solve, Explore, Agent (credits + EURC↔credits copy), Settings (Circle env). Live **Events** feed with auto-scroll + optional mic (where the browser supports Web Speech).
- **Bounty detail for API-key bounties** — `GET /bounties/<context_hash>` returns merged gateway rows, not only on-chain escrow.
- **Custom solver doc** — see [`SOLVER_INTEGRATION.md`](SOLVER_INTEGRATION.md).
- **`.be-agent.toml` example** — [`examples/.be-agent.toml`](examples/.be-agent.toml).
- **Operator cron stub** — [`scripts/bounty_escalation_cron.sh`](scripts/bounty_escalation_cron.sh) for feeding external autoscalers.

## Still deferred (larger product scope)

- [ ] **Fiat onramp** for stakers.
- [ ] **Resource Claim NFT** productization (`ResourceClaim` placeholder in contracts).
- [ ] **Flare production enclave** runner hardening.
- [ ] **Principal→agent risk bands** and **EIP-712 proof-of-intent** (governance / spec).
- [ ] **Full Circle Modular Wallets E2E in `web/`** — Settings documents `VITE_CIRCLE_CLIENT_KEY`; full passkey onboarding requires wiring `@circle-fin/modular-wallets-core` + gateway `POST /identity/{id}/wallet` in a follow-on PR.
- [ ] **Demo video + final submission assets** — operator-produced; see [`SUBMISSION.md`](SUBMISSION.md) / [`DEMO_VIDEO_BROLL.md`](DEMO_VIDEO_BROLL.md).
