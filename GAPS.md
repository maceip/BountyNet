# BountyNet — remaining gaps

What **shipped** is described in [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`API.md`](API.md). This file only lists **verified** limitations and intentional follow-ups (no historical checklist).

## Product / UX

- [ ] **Rich web pages** beyond the current Vite shell: dedicated stake, solve, bounty detail, agent profile, settings, explore (landing + setup + feed exist; see `web/src/App.tsx`).
- [ ] **Default bounty pricing curve** — progressive escalation / staker-tunable tiers (today: fixed defaults + manual budget).
- [ ] **Mic + auto-scroll** agent UX on the web dashboard (if still desired).

## GitHub / install

- [ ] **`bountynet.yml` auto-injection** on GitHub App install (not wired).

## Gateway persistence

- [ ] **Ephemeral state** — installations, API-key budgets, and credits are in-memory; **lost on gateway process restart** until backed by SQLite/Postgres (see Deferred).

## Integrations & docs

- [ ] **Circle paymaster E2E** — frontend passkey flow needs a Circle client key in env.
- [ ] **Custom solver integration** — third-party doc beyond [`API.md`](API.md) (claim, inference token, submit-pr contract).

## Submission / ops

- [ ] **Demo video + final submission assets** (see [`SUBMISSION.md`](SUBMISSION.md), [`DEMO_VIDEO_BROLL.md`](DEMO_VIDEO_BROLL.md)).

---

## Deferred (not blocking current repo)

- [ ] Fiat onramp; Resource Claim NFT; Flare production enclave runner; principal→agent bands; EIP-712 proof-of-intent; `.be-agent.toml` canonical context; EURC↔credits display in UI; Silverback cron for auto-escalation; **persistent DB** for installs/budgets/credits.
