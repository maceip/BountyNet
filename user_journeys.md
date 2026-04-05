# BountyNet — Hackathon Task Map

Every task is tied to a user journey, a spec glossary item, and a bounty.
If it's not on this list, we don't build it.

---

## Components

### 1. `bounty` CLI (Rust sources under `be/`, binary name from Cargo)

Source: `be/` (mise clone + BountyNet commands in `be/src/cli/bnet.rs`, `join.rs`, etc.)

| Command | What it does | Status |
|---|---|---|
| `bounty join` | Browser → Dynamic login → creates wallet → registers agent → saves ~/.bountynet/agent.json | DONE (Rust, compiled, tested) |
| `bounty bounties list` | Calls GET /bounties on gateway, displays active bounties | DONE (Rust, compiled, tested) |
| `bounty bounties create` | Staker creates bounty: deposits API key + budget | DONE (Rust, compiled, tested) |
| `bounty bounties claim <hash>` | Claims bounty, returns bnet_token + inference endpoint | DONE (Rust, compiled, tested) |
| `bounty bounties watch` | Polls for claimable bounties, auto-claims | DONE (Rust, compiled, tested) |
| `bounty status` | Shows agent ID, wallet, ENS, balances | DONE (Rust, compiled, tested) |

### 2. Contracts (Vyper, Moccasin)

Source: `contracts/`
Deployed: Arc Testnet (chain 5042002) + Flare Coston2 (chain 114)

| Contract | Chain | Address | Status |
|---|---|---|---|
| BountyEscrow.vy | Arc | 0x439E...4812 | DEPLOYED |
| IdentityRegistry.vy | Arc | 0xb165...0eE | DEPLOYED |
| ValidationRegistry.vy | Arc | 0xCbe1...7e1 | DEPLOYED |
| BountyNetResolver.sol | Sepolia | deployed | DEPLOYED |
| MockEURC.vy | Arc | 0x89B5...D72a | DEPLOYED |
| OracleProofStore.sol | Coston2 | 0xcb2D...D544 | DEPLOYED, ecrecover verified |

### 3. Gateway (Python/Flask, deployed on EC2)

Source: `gateway/`
Running at: https://gateway.stare.network

| Route | Status |
|---|---|
| POST /identity/onboard | DEPLOYED — returns agent_id from on-chain scan |
| POST /identity/{id}/wallet | DEPLOYED — links Circle Smart Account |
| GET /identity/{id} | DEPLOYED — wallet, balances, ENS |
| GET /bounties | DEPLOYED — merged on-chain + API-key bounties |
| POST /bounties/create | DEPLOYED — api_key + eurc modes |
| POST /bounties/{hash}/claim | DEPLOYED — both modes, bnet_token issued |
| POST /github/webhook | DEPLOYED — check_run, installation, pull_request |
| POST /github/scan/{id} | DEPLOYED — scan repos for CI failures + insights |
| POST /github/setup | DEPLOYED — configure repos, API key, budget |
| POST /github/submit-pr | DEPLOYED — creates branch, commits, opens PR (E2E verified) |
| POST /oracle | DEPLOYED — TEE-attested validation |
| GET /oracle/health | DEPLOYED — TEE signer, source hash, image digest |
| POST /v1/messages | DEPLOYED — Anthropic-compatible inference proxy (LiteLLM) |
| POST /v1/chat/completions | DEPLOYED — OpenAI-compatible inference proxy |
| POST /budget/deposit | DEPLOYED — staker/solver key deposit |
| GET /budget/{hash} | DEPLOYED |
| GET /credits/{id} | DEPLOYED |
| POST /attest | DEPLOYED — GitHub OIDC attestation |
| GET /ens/lookup/{sub} | DEPLOYED — multi-chain (Arc + Coston2) |
| GET /ens/{sender}/{data}.json | DEPLOYED — CCIP-Read ENSIP-25 |
| GET /events | DEPLOYED — unified event stream |
| GET /health | DEPLOYED |
| POST/GET /mcp | DEPLOYED — MCP Streamable HTTP (tools + resources; optional `BOUNTYNET_MCP_SUBSCRIBE=1` for watch feed subscriptions) |

### 4. Web frontends

**Primary (Cannes UI):** `webv2/` — Vite, React 19, Tailwind 4, COSS-style components, Dynamic auth, **Arweave watercolor hero** + parallax / motion (`WatercolorBackdrop`). Same gateway as `web/`.

**Legacy:** `web/` — OGL generative watercolor canvas, hex motif, cane mode.

Deployed site: https://bountynet.stare.network (confirm which bundle the host serves; both build to static `dist/`).

| Feature | webv2 | web (legacy) |
|---|---|---|
| Landing / hero | DONE (particles + watercolor image) | DONE (OGL canvas) |
| Bounty + event feeds | DONE | DONE |
| Setup `/setup` | DONE | DONE |
| Android auth `/android-auth` | DONE | DONE |
| Circle / passkey flows | per Dynamic SDK | WRITTEN, needs client key |
| Stake/solve/bounty detail/profile | NOT DONE | NOT DONE |

### 5. GitHub App

Source: `gateway/routes/github.py` + `action/`
Registered: bountynet-ci-client (App ID 3269358)
Permissions: Contents R/W, Pull requests R/W, Checks R, Actions R

| Piece | Status |
|---|---|
| Webhook handler (check_run, installation, pull_request) | DEPLOYED |
| bountynet/attest Action (OIDC) | PUBLISHED (v1 tag) |
| GitHub App registered + installed on maceip | DONE |
| Scan-on-install (CI failures + workflow insights) | DEPLOYED |
| PR submission (branch + commit + PR) | VERIFIED (PR #2) |
| bountynet.yml injection on install | NOT DONE |

### 6. Oracle TEE (Flare)

Source: `oracle-tee/`
Running at: EC2 Docker (port 8095)

| Piece | Status |
|---|---|
| Flare FCE extension (Python handler) | DEPLOYED |
| TEE signing with ECDSA (secp256k1) | WORKING |
| OracleProofStore on Coston2 | DEPLOYED, ecrecover verified |
| Source hash + image digest in proofs | WORKING |
| Gateway wired to TEE oracle | DEPLOYED |
| Cross-chain proof (Coston2 → Arc) | WORKING |
| Runner Docker image | BUILT (not deployed) |

### 7. SimBountyNet

Source: `sim/`

| Piece | Status |
|---|---|
| sim/agent.py (honest/hallucinate/malicious) | TESTED — PR #2 created |
| sim/malicious.py (7 attack vectors) | TESTED — 4/7 defended |
| sim/sim_vishy.py (browser-use) | BUILT, needs ANTHROPIC_API_KEY |
| sim/sim_joe.py (browser-use) | BUILT, needs ANTHROPIC_API_KEY |

### 8. ENS (CCIP-Read + ENSIP-25)

| Piece | Status |
|---|---|
| BountyNetResolver.sol deployed (Sepolia) | DONE |
| Gateway resolves *.maceip.eth | DONE |
| agent-{id}.maceip.eth from Arc registry | DONE |
| ENSIP-25 multi-chain (Arc + Coston2 coin types) | DONE |
| Text records (oracle.source_hash, network.*) | DONE |
| Mainnet deployment | NEEDS ETH |

---

## User Journeys — Current Status

### Joe (Staker)

```
1. Joe visits bountynet.stare.network               ✅ WORKS
2. Clicks "Install GitHub App"                       ✅ WORKS → github.com/apps/bountynet-ci-client
3. GitHub redirects to /setup?installation_id=X      ✅ WORKS
4. Setup scans repos, shows CI failures + insights   ✅ WORKS (5 failures found on freehold-relay)
5. Joe pastes API key, sets budget, activates         ✅ WORKS
6. CI fails → webhook → bounty created + comment     ✅ WORKS (in-memory, comment posted)
7. Solver claims → inference through Joe's key        ✅ WORKS (metered, events logged)
8. Solver submits PR                                  ✅ WORKS (PR #2 verified)
9. CI passes → oracle validates → payout              ⚠️ PARTIAL (oracle signs, on-chain resolution needs webhook)
```

### Vishy (Solver)

```
1. Runs `bounty join`                                 ✅ WORKS (Rust binary, Dynamic OAuth)
2. Runs `bounty bounties list`                         ✅ WORKS
3. Runs `bounty bounties claim <hash>`                ✅ WORKS (bnet_token issued)
4. Sets ANTHROPIC_API_KEY + BASE_URL                  ✅ WORKS
5. Inference routed through staker's key              ✅ WORKS (LiteLLM, 3-tier resolution)
6. Agent generates fix → submit PR                    ✅ WORKS (PR #2)
7. CI passes → oracle → payout                        ⚠️ PARTIAL (same as Joe #9)
8. Runs `bounty status`                               ✅ WORKS
9. Runs `bounty bounties watch` (auto-pilot)          ✅ WORKS (polls + auto-claims)
```

---

## Bounty Alignment

### Arc/Circle ($15k)
- BountyEscrow.vy on Arc ✅
- EURC settlement ✅
- Circle Modular Wallet (web/src/wallet/circle.ts) ✅
- Circle wallet linking endpoint ✅
- Gasless claims via backend relayer ✅
- Circle paymaster frontend test — **NEEDS CLIENT KEY**

### ENS ($10k)
- CCIP-Read wildcard resolver ✅
- ENSIP-25 multi-chain ✅
- agent-{id}.maceip.eth ✅
- Text records ✅
- Mainnet deployment — **NEEDS ETH**

### Flare ($10k)
- TEE oracle on Coston2 ✅
- OracleProofStore deployed + verified ✅
- Source hash + image digest attestation ✅
- Cross-chain proofs (Coston2 → Arc) ✅
- Runner Docker image ✅

---

## Open Items

1. Web pages: stake, solve, bounty detail, agent profile, explore
2. Identity spoof fix (agent_id=-1 accepted on claim)
3. Installation persistence (in-memory, lost on restart)
4. bountynet.yml injection on install
5. Circle paymaster E2E (frontend passkey)
6. Demo video + submission
7. Progressive bounty escalation
8. Mic button + auto-scroll agent UX
