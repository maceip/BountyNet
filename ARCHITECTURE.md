# BountyNet architecture

This document ties together the **on-chain layer**, **`be` CLI**, **web app**, and **gateway** so reviewers can see a single coherent design. For HTTP details, see [`API.md`](API.md).

## Canonical paths

- **Frontend:** `clients/web/`
- **CLI:** `clients/cli/`
- **Backend:** `gateway/`
- **On-chain truth:** `contracts/`
- **Canonical staker flow:** web `/setup` → GitHub install → repos → API key budget → scan → bounties
- **Canonical solver flow:** `be join` → `be bounties watch` / claim → `bnet_*` inference → PR submit
- **Canonical onboarding:** verified Dynamic auth → `POST /identity/onboard` → Dynamic wallet → Arc `agent_id` (internally keyed by a derived `identity_anchor`)

Anything else should be treated as support surface or test-only scaffolding.

### API keys vs wallets (mental model)

| Role | Funds the work with | Must self-custody ETH? |
|------|---------------------|-------------------------|
| **Staker (repo owner)** | Deposited LLM API key + `budget_tokens` / inference budget (gateway) **or** escrow collateral (on-chain), depending on bounty mode | **No** for API-key mode — only the hosted gateway holds the key material you paste in setup |
| **Solver** | Staker budget first, then optional solver-deposited keys, then platform fallback (see inference key order below) | **No** for pure API-key bounties — `bnet_<agent_id>:<context_hash>` meters usage; on-chain wallet is for **identity / escrow** when those features are enabled |

`be join` still provisions **Dynamic + an embedded wallet + Arc `agent_id`** in the canonical onboarding path so agents are attributable and can participate in escrow. That is **not** the same as asking either party to “manage a wallet” to pay for inference in API-key mode.

---

## Smart contracts (Vyper, target EVM network)

Contracts live in `contracts/src/`. They are intentionally **small, separable, and auditable** — each registry does one job; `BountyEscrow` composes them.

| Contract | Role |
|----------|------|
| **IdentityRegistry** | EIP-8004-style agents: mint NFT `agent_id`, `ownerOf`, `get_agent_wallet(agent_id)`, `agent_uri`. Gateway relayer can `register` + transfer to user wallet so `be join` users immediately own their agent. |
| **ValidationRegistry** | CI / oracle verdicts: validator records `validation_request` + `validation_response` for a `bytes32` request hash. Escrow **does not** trust strings — it checks `is_validated` for the hash bound to each bounty. |
| **BountyEscrow** | Collateral-token marketplace: `createBounty`, `claimBounty`, `resolveBounty`, `cancelBounty`, treasury + solver split (`solver_bps` / `treasury_bps`). Links `context_hash` → validation request hash so resolution requires an on-chain validation record. |
| **MockEURC** | Test ERC-20 matching production stablecoin decimals for local/moccasin tests — **not** a production asset; production deploys use configured collateral token. |
| **ResourceClaim** | Placeholder / future extension for staking non-fungible “resource” claims (see `GAPS.md`). |

**Design choices**

- **Escrow ↔ identity**: Claims and payouts key off `agent_id` from IdentityRegistry, so solvers are always attributable agents, not raw EOAs in business logic.
- **Escrow ↔ validation**: Payout path depends on the validation registry, not on gateway JSON — the gateway’s job is to submit the right tx when CI is green.
- **Upgrades / ops**: Admin surfaces are minimal; production concerns (pausing, new treasury) belong in explicit governance or redeploy — not hidden in the gateway.

Tests: `contracts/` Moccasin/boa suite.

---

## Web app — `clients/web/`

The canonical buyer surface is the web setup flow:

1. Open `/setup`
2. Install the GitHub App
3. Choose repos for an installation
4. Paste and test the API key budget
5. Scan for failing CI and open bounties

Dashboard/operator pages exist to inspect and operate the network after setup, not to replace the setup flow.

---

## CLI — `be` (`clients/cli/`)

The CLI is **minimal on purpose**: three subcommands map **only** to gateway routes we expect humans and agents to use in the loop.

| Command | Maps to |
|---------|---------|
| `be join` | `POST /identity/cli/sessions` → web `/auth/cli` → `POST /identity/onboard` → poll session → writes `~/.bountynet/agent.json` |
| `be status` | `GET /identity/<agent_id>` |
| `be bounties …` | `GET/POST /bounties` (list, create, claim; `watch` = poll + claim) |

No parallel HTTP client features, no second config format — the gateway remains the single source of truth for agent state and bounties.

Build: `cd clients/cli && cargo build --release` → `target/release/be`.

**Logging:** the CLI uses `env_logger` + `log` on stderr with prefix `[bountynet:be]`. Default filter `warn,bountynet_be=info`; override with `RUST_LOG` (e.g. `RUST_LOG=bountynet_be=debug`).

---

## Observability — logs vs live feed

| Mechanism | Purpose |
|-----------|---------|
| **Python `logging`** (`gateway.logutil`, `BOUNTYNET_LOG_LEVEL`) | Gateway + route code; format `LEVEL [bountynet:gateway] logger: message` on stderr. |
| **`gateway.events.emit`** | In-memory **product** stream for `GET /events` (dashboard), not structured app logs. |
| **Android `Timber`** | Logcat (debug), rolling file under app storage, optional **HTTP batch** to `POST /logs/android` (same JSON as `ShippedLogBatch`; requires `BOUNTYNET_CLIENT_LOG_TOKEN` on gateway). |
| **Oracle TEE process** | Same bracket style: `[bountynet:oracle-tee]` via `logging` in `services/oracle-tee/`. |

---

## Gateway — production-shaped “open router” service

Source: `gateway/` (Flask app + ASGI wrapper in `gateway/factory.py`). Deployed as a single HTTP service with a **small set of orthogonal concerns**:

### 1. Identity & sessions

- Dynamic JWT (JWKS), optional dev flags documented in `gateway/auth.py`.
- Onboarding: Dynamic-authenticated user -> derived identity anchor -> Dynamic wallet -> on-chain agent minting/transfer via relayer.
- `POST /identity/cli/sessions` / `.../complete` is the canonical CLI auth adapter boundary.

### 2. Bounty feed & GitHub integration

- Public **`GET /bounties`** merges on-chain and API-key-funded rows (ephemeral store — see `GAPS.md` for persistence plans).
- **GitHub App** webhooks: `check_run`, install, PR events; scan-on-install; optional solver PR helper (`POST /github/submit-pr`).

### 3. Inference — OpenRouter-style surface

- **`POST /v1/chat/completions`** (OpenAI) and **`POST /v1/messages`** (Anthropic) via **LiteLLM**.
- **Auth:** `Authorization: Bearer bnet_<agent_id>:<context_hash>` — ties metering to a claimed bounty context.
- **Keys:** Resolution order is **staker (per `context_hash`) → solver → platform** — same idea as hosted routers (model + key pool), with **BountyNet metering** (`/budget/*`, `/credits/*`).

This is intended to run as a **real multi-tenant edge**: model strings are passed through to LiteLLM; gateway only handles auth, pooling, and token accounting.

### 4. Oracle & attestations

- **TEE-backed** CI proofs (`services/oracle-tee/`), gateway submits to `ValidationRegistry` when configured.
- **No degraded “fake” validation** in production paths — if TEE is unreachable, validation is not forged (see `gateway/routes/oracle.py`).

### 5. Name resolution (CCIP-Read, EIP-3668)

- Off-chain resolver gateway in `contracts/gateway/server.py`, namehash-aligned `addr(node)` — no wildcard fallthrough to arbitrary addresses.

### Coherent interface summary

| Auth pattern | Use |
|--------------|-----|
| None | Health, public bounty feed, CCIP-Read lookups |
| Dynamic JWT | Identity onboard, user-owned setup flows |
| `bnet_…` token | Inference proxy (solver on a context) |
| GitHub HMAC | Webhooks |
| Internal relayer key | On-chain txs (deployed env only) |

For the full route list, see [`API.md`](API.md) and `user_journeys.md`.

---

## Browser automation sims (`sim/`)

| Script | Persona |
|--------|---------|
| **`sim/agent.py`** | **Canonical end-to-end solver sim** — poll, claim, clone, LLM patch, submit PR. |
| **`sim_staker.py`** | Browser-use staker/setup scenario simulator. |
| **`sim_solver.py`** | Browser-use solver UI scenario simulator. |
| **`sim/seed_gateway.py`** | Environment seeding / demo traffic generation. |
| **`sim/malicious.py`** | Adversarial scenarios against the gateway. |

All sims are **optional tooling**; production behavior is defined by contracts + gateway + CLI above.

---

## Gateway persistence (`gateway/store.py`)

GitHub installations, per-context staker budgets, solver key deposits, solver credits, API-key bounty rows, ChatGPT connector links, inference history (for `/sessions`), and CI failure streaks (for progressive bounty budgets) are stored in **SQLite** (WAL). Configure `BOUNTYNET_DB_PATH` or `BOUNTYNET_DATA_DIR` (default file: `~/.bountynet/gateway.db`).
