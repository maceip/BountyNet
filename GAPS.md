# BountyNet — Implementation Gaps

Tracked list. Everything here gets built or explicitly cut before submission.

## Done
- [x] GitHub comment notifications (gateway/routes/github.py)
- [x] PR submission via GitHub App token (/github/submit-pr) — PR #2 on maceip/freehold-relay
- [x] Inference credit display (/credits/<agent_id>)
- [x] Contracts: escrow, identity, validation (Arc Testnet)
- [x] ENS CCIP-Read wildcard resolver (Sepolia)
- [x] ENSIP-25 multi-chain resolution (Arc + Coston2 coin types)
- [x] Gateway: unified API surface (consolidated from 3 separate handlers)
- [x] Wallet: Dynamic identity + Circle settlement + wallet linking endpoint
- [x] bountynet/attest GitHub Action (OIDC) — published as v1
- [x] Fleet reverse mapping (owner → agent IDs)
- [x] E2E test: register → bounty → claim → validate → payout
- [x] Proxy: API key budget mode (staker deposits key + token budget)
- [x] GitHub App: webhook handler + scan-on-install + solver PR submission
- [x] `be join` — Rust OAuth login + agent registration (compiled, tested)
- [x] `be bounties list/create/claim/watch` — all four (via `be-cli/`, tested)
- [x] `be status` — agent status display (compiled, tested)
- [x] Flare TEE oracle — Docker deployed on EC2, signing proofs
- [x] OracleProofStore on Coston2 — deployed, ecrecover verified
- [x] Oracle source hash + image digest in every proof
- [x] Unified event stream — /events endpoint, emitted from all routes
- [x] EventFeed component on web landing page
- [x] Setup page — scan repos, show failures + insights, API key + budget
- [x] Cane mode — legacy web 1.0 site toggle (the anti-agent-widget)
- [x] SimBountyNet agent — honest/hallucinate/malicious modes
- [x] SimBountyNet adversarial — 7 attack vectors, 4 defended
- [x] `sim_solver.py` + `sim_staker.py` — browser-use (solver / staker journeys)
- [x] GitHub App install button on landing page
- [x] API-key bounties visible in bounty feed (merged in-memory + on-chain)
- [x] Identity onboard returns agent_id (scans IdentityRegistry)
- [x] Circle wallet linking — POST /identity/{id}/wallet
- [x] GitHub Actions runner Docker image (runner/)
- [x] Bounty feed on landing page (public, unauthenticated)
- [x] Gasless claims via backend relayer (Oracle key sponsors gas)
- [x] PR submission E2E verified — solver creates branch, commits, opens PR

## Open
- [ ] Default bounty pricing (progressive escalation, no staker-tunable curve yet)
- [ ] Circle paymaster E2E test (frontend passkey flow, needs Circle client key)
- [ ] Custom solver integration docs (REST API reference)
- [ ] `bountynet.yml` injection on GitHub App install
- [ ] Web pages: stake, solve, bounty detail, agent profile, settings, explore
- [x] Identity spoof: reject `agent_id <= 0` on claim (`gateway/routes/bounties.py`)
- [ ] Installation persistence (lost on gateway restart)
- [ ] Mic button + auto-scroll agent UX (web)
- [ ] Demo video + submission prep

## Deferred (post-hackathon)
- [ ] Fiat onramp (API key model removes need for demo)
- [ ] Resource Claim NFT (idle infra as stake)
- [ ] Enclave runner (bountynet/attest-enclave on Flare production TEE)
- [ ] Principal→agent band model (attestation-based)
- [ ] EIP-712 Proof of Intent signatures
- [ ] Context Payload canonical format (.be-agent.toml)
- [ ] Compute Credits display (EURC → token conversion)
- [ ] Persistent storage (SQLite/Postgres for installations, budgets, credits)
- [ ] Progressive escalation auto-trigger (Silverback cron)
