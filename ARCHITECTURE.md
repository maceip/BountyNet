# BountyNet architecture

This document ties together the **on-chain layer**, **`be` CLI**, and **gateway** so reviewers can see a single coherent design. For HTTP details, see [`API.md`](API.md).

---

## Smart contracts (Vyper, Arc Testnet)

Contracts live in `contracts/src/`. They are intentionally **small, separable, and auditable** — each registry does one job; `BountyEscrow` composes them.

| Contract | Role |
|----------|------|
| **IdentityRegistry** | EIP-8004-style agents: mint NFT `agent_id`, `ownerOf`, `get_agent_wallet(agent_id)`, `agent_uri`. Gateway relayer can `register` + transfer to user wallet so `be join` users immediately own their agent. |
| **ValidationRegistry** | CI / oracle verdicts: validator records `validation_request` + `validation_response` for a `bytes32` request hash. Escrow **does not** trust strings — it checks `is_validated` for the hash bound to each bounty. |
| **BountyEscrow** | EURC-collateralized marketplace: `createBounty`, `claimBounty`, `resolveBounty`, `cancelBounty`, treasury + solver split (`solver_bps` / `treasury_bps`). Links `context_hash` → validation request hash so resolution requires an on-chain validation record. |
| **MockEURC** | Test ERC-20 matching EURC decimals for local/moccasin tests — **not** a production asset; deploys use real EURC on Arc where configured. |
| **ResourceClaim** | Placeholder / future extension for staking non-fungible “resource” claims (see `GAPS.md`). |

**Design choices**

- **Escrow ↔ identity**: Claims and payouts key off `agent_id` from IdentityRegistry, so solvers are always attributable agents, not raw EOAs in business logic.
- **Escrow ↔ validation**: Payout path depends on the validation registry, not on gateway JSON — the gateway’s job is to submit the right tx when CI is green.
- **Upgrades / ops**: Admin surfaces are minimal; production concerns (pausing, new treasury) belong in explicit governance or redeploy — not hidden in the gateway.

Tests: `contracts/` Moccasin/boa suite.

---

## CLI — `be` (`be-cli/`)

The CLI is **minimal on purpose**: three subcommands map **only** to gateway routes we expect humans and agents to use in the loop.

| Command | Maps to |
|---------|---------|
| `be join` | Dynamic login URL → callback → `POST /identity/onboard` — writes `~/.bountynet/agent.json` |
| `be status` | `GET /identity/<agent_id>` |
| `be bounties …` | `GET/POST /bounties` (list, create, claim; `watch` = poll + claim) |

No parallel HTTP client features, no second config format — the gateway remains the single source of truth for agent state and bounties.

Build: `cd be-cli && cargo build --release` → `target/release/be`.

---

## Gateway — production-shaped “open router” service

Source: `gateway/` (Flask app + ASGI wrapper in `gateway/factory.py`). Deployed as a single HTTP service with a **small set of orthogonal concerns**:

### 1. Identity & sessions

- Dynamic JWT (JWKS), optional dev flags documented in `gateway/auth.py`.
- Onboarding: bridge to Dynamic Node SDK, on-chain agent minting/transfer via relayer.

### 2. Bounty feed & GitHub integration

- Public **`GET /bounties`** merges on-chain and API-key-funded rows (ephemeral store — see `GAPS.md` for persistence plans).
- **GitHub App** webhooks: `check_run`, install, PR events; scan-on-install; optional PR submission for solvers (`POST /github/submit-pr`).

### 3. Inference — OpenRouter-style surface

- **`POST /v1/chat/completions`** (OpenAI) and **`POST /v1/messages`** (Anthropic) via **LiteLLM**.
- **Auth:** `Authorization: Bearer bnet_<agent_id>:<context_hash>` — ties metering to a claimed bounty context.
- **Keys:** Resolution order is **staker (per `context_hash`) → solver → platform** — same idea as hosted routers (model + key pool), with **BountyNet metering** (`/budget/*`, `/credits/*`).

This is intended to run as a **real multi-tenant edge**: model strings are passed through to LiteLLM; gateway only handles auth, pooling, and token accounting.

### 4. Oracle & attestations

- **TEE-backed** CI proofs (`oracle-tee/`), gateway submits to `ValidationRegistry` when configured.
- **No degraded “fake” validation** in production paths — if TEE is unreachable, validation is not forged (see `gateway/routes/oracle.py`).

### 5. ENS / CCIP-Read

- Off-chain resolver gateway in `contracts/gateway/server.py` (EIP-3668), namehash-aligned `addr(node)` — no wildcard fallthrough to arbitrary addresses.

### Coherent interface summary

| Auth pattern | Use |
|--------------|-----|
| None | Health, public bounty feed, ENS reads |
| Dynamic JWT | Identity onboard, stake flows requiring user |
| `bnet_…` token | Inference proxy (solver on a context) |
| GitHub HMAC | Webhooks |
| Internal relayer key | On-chain txs (deployed env only) |

For the full route list, see [`API.md`](API.md) and `user_journeys.md`.

---

## Browser automation sims (`sim/`)

| Script | Persona |
|--------|---------|
| **`sim_staker.py`** | Staker — landing → GitHub App → setup → API key / budget (browser-use). |
| **`sim_solver.py`** | Solver — landing → login → feed → claim path in the web UI (browser-use). |
| **`sim/vishy.py`** | Same solver pipeline via **HTTP/API** (poll, LLM, `submit-pr`). |
| **`sim/agent.py`** | Lighter-weight agent loop (see file). |
| **`sim/malicious.py`** | Adversarial scenarios against the gateway. |

All sims are **optional tooling**; production behavior is defined by contracts + gateway + CLI above.
