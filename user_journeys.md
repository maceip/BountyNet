# BountyNet — Hackathon Task Map

Every task is tied to a user journey, a spec glossary item, and a bounty.
If it's not on this list, we don't build it.

---

## Components

### 1. `be` CLI (Rust, forked from open-source mise)

Source: `be/` (mise clone, already in repo)
Spec ref: §4.1 Rust-to-Node Bridge, §6 Sleeve CLI UI
Must copy from: `maceip/sleeve` sleeves subsystem (accounts, identity)

| Command | What it does | Glossary item | Status |
|---|---|---|---|
| `be join` | Opens browser → Dynamic login (GitHub) → creates wallet → registers Agent Identity on Arc → writes ~/.bountynet/agent.json | Agent Identity | NOT STARTED in Rust (Python prototype exists) |
| `be watch` | Local proxy on :8100. Passthrough to Anthropic normally. When bounty active, routes through gateway (staker pays). No restart. | Inference Proxy, Proof of Intent | NOT STARTED in Rust (Python prototype exists) |
| `be bounty list` | Calls GET /bounties on gateway, displays active bounties | Bounty Feed | NOT STARTED |
| `be bounty create` | Staker creates bounty: deposits API key + budget via gateway | Context Payload, Compute Credits | NOT STARTED |
| `be status` | Shows agent ID, wallet, ENS name, EURC balance, compute credits, reputation | CLI Dashboard (§6) | NOT STARTED |

**Work to do:**
1. Copy sleeves subsystem from `maceip/sleeve` into `be/src/cli/`
2. Add `bounty` subcommand module with `list`, `create`
3. Add `join` command that shells out to `node` for Dynamic bridge (spec §4.1)
4. Add `watch` command that starts local HTTP proxy (Rust has hyper/axum)
5. Add `status` command that calls gateway and formats output

### 2. Contracts (Vyper, Moccasin)

Source: `contracts/`
Spec ref: §4.2 Escrow Contract
Deployed: Arc Testnet (chain 5042002)
Bounty: **Arc/Circle** — Smart Contracts on Arc ($3k), Agentic Nanopayments ($6k)

| Contract | Address | Glossary item | Status |
|---|---|---|---|
| BountyEscrow.vy | 0x439E...4812 | Escrow, Compute Credits, Staker/Solver | DEPLOYED, 11 tests |
| IdentityRegistry.vy | 0xb165...08C3b0eE | Agent Identity, Fleet | DEPLOYED |
| ValidationRegistry.vy | 0xCbe1...97e1 | CI Oracle, Proof of Outcome | DEPLOYED |
| BountyNetResolver.sol | 0xb165...08C3b0eE (Sepolia) | ENS subdomains | DEPLOYED |
| MockEURC.vy | test only | — | DONE |

**Work to do:**
1. Progressive escalation logic (Silverback cron or contract-side)
2. Context Payload hash canonical format (keccak of repo:sha:job:failure)

### 3. Gateway (Python/Flask, deployed on EC2)

Source: `gateway/`
Running at: https://gateway.stare.network
Spec ref: §2.1 CI Oracle, §2.3 Inference Proxy, §2.4 GitHub App, §2.5 Bounty Feed

| Route | Glossary item | Bounty | Status |
|---|---|---|---|
| POST /identity/onboard | Agent Identity | Dynamic | DEPLOYED |
| GET /identity/<id> | Agent Identity, Fleet | Dynamic | DEPLOYED |
| GET /bounties | Bounty Feed | — | DEPLOYED |
| POST /github/webhook | GitHub App, Context Payload | — | DEPLOYED |
| POST /oracle | CI Oracle, Proof of Outcome | Arc/Circle | DEPLOYED |
| POST /v1/messages | Inference Proxy, Compute Credits | Arc/Circle | DEPLOYED (LiteLLM) |
| POST /v1/chat/completions | Inference Proxy | Arc/Circle | DEPLOYED (LiteLLM) |
| POST /budget/deposit | Compute Credits (API key mode) | Arc/Circle | DEPLOYED |
| GET /ens/lookup/<sub> | ENS subdomains | ENS | DEPLOYED |
| GET /ens/{sender}/{data}.json | ENS CCIP-Read | ENS | DEPLOYED |
| POST /attest | OIDC attestation | Flare (future) | DEPLOYED |
| POST /github/submit-pr | Solver PR submission | — | DEPLOYED |

**Work to do:**
1. Wire /identity/onboard to actually call Dynamic Node SDK (currently stubbed)
2. Wire /oracle to actually call ValidationRegistry on Arc when CI passes
3. Test end-to-end: Joe installs app → CI fails → bounty created → Vishy claims → fix submitted → CI green → payout

### 4. Web Frontend (React + OGL + Vite)

Source: `web/`
Spec ref: §2.5 Bounty Feed
Bounty: (supports demo, not a specific bounty target)

| Feature | Status |
|---|---|
| OGL watercolor canvas | DONE |
| Glassmorphic component library | DONE |
| Dashboard (reads contract directly) | DONE |
| Dynamic auth (DynamicProvider + useAuth) | WRITTEN, not tested |
| Wire dashboard to gateway API | NOT DONE |
| Bounty feed view | NOT DONE |
| Agent status page | NOT DONE |

**Work to do:**
1. Replace direct contract reads with gateway API calls
2. Add bounty feed page (list active bounties from /bounties)
3. Test Dynamic login flow end-to-end

### 5. GitHub App

Source: `github-app/app.py` + `action/`
Spec ref: §2.1 CI Oracle, §2.4 GitHub App
Bounty: —

| Piece | Status |
|---|---|
| Webhook handler (check_run, installation) | WRITTEN |
| bountynet/attest Action (OIDC) | WRITTEN |
| GitHub App registered on GitHub | NOT DONE |
| bountynet.yml injection on install | NOT DONE |

**Work to do:**
1. Register the GitHub App on GitHub (needs URL, webhook secret)
2. Test webhook flow with a real repo
3. Wire notification comments to use real installation tokens

### 6. Solver Bot (Silverback)

Source: `solver/bots/solver.py`
Spec ref: §2.6 SimBountyNet, Solver agent
Bounty: —

| Feature | Status |
|---|---|
| Block polling skeleton | WRITTEN |
| Bounty claim logic | NOT DONE |
| LLM inference call (through gateway) | NOT DONE |
| PR submission (through gateway) | NOT DONE |
| SimBountyNet demo loop | NOT DONE |

**Work to do:**
1. Wire solver to claim via gateway
2. Wire solver to call LLM via gateway inference proxy
3. Wire solver to submit PR via /github/submit-pr
4. SimBountyNet: script that runs the full loop against maceip/freehold-relay

### 7. ENS (CCIP-Read)

Source: `contracts/src/ens/`, gateway ENS routes
Spec ref: Agent Identity → ENS name
Bounty: **ENS** — AI Agent Integration ($5k), Most Creative ($5k)

| Piece | Status |
|---|---|
| BountyNetResolver.sol deployed (Sepolia) | DONE |
| maceip.eth registered + resolver set (Sepolia) | DONE |
| Gateway resolves *.maceip.eth | DONE |
| agent-{id}.maceip.eth resolves from Arc registry | DONE |
| Mainnet deployment | NEEDS ETH (< $1) |

**Work to do:**
1. Deploy resolver to mainnet when ETH available
2. Set resolver on mainnet maceip.eth

### 8. Infra (EC2, Caddy, SSM)

| Piece | Status |
|---|---|
| Geth + Lighthouse Sepolia node | RUNNING |
| sepolia.stare.network → RPC | LIVE |
| gateway.stare.network → gateway | LIVE |
| env-sync (SSM secrets) | WORKING |
| Wallets (deployer, relayer, treasury) | FUNDED on Arc |
| QuickNode multichain | WORKING |
| Android SDK, Foundry, Wake, Moccasin, Silverback | INSTALLED |

**Work to do:**
1. Deploy updated gateway code when routes change (scp + restart)

---

## User Journeys → Tasks

### Joe (Staker) — "my CI is red, fix it"

```
1. Joe installs BountyNet GitHub App
   → NEEDS: GitHub App registered (#5.1)
   → NEEDS: /identity/onboard calls Dynamic (#3.1)

2. CI fails on Joe's repo
   → WORKS: bountynet/attest action fires
   → NEEDS: GitHub App posts comment with bounty info (#5.3)

3. Bounty is created with Joe's API key as budget
   → WORKS: POST /budget/deposit
   → NEEDS: auto-creation from webhook (wire #5 → #3)

4. Solver fixes it, PR appears
   → NEEDS: full solver loop (#6.1-6.3)

5. CI goes green, payout happens
   → NEEDS: oracle wired end-to-end (#3.2)

6. Joe sees the result
   → NEEDS: GitHub comment on resolved bounty (#5.3)
```

### Vishy (Solver) — "I want to earn compute credits"

```
1. Vishy runs `be join`
   → NEEDS: Rust command in be/ (#1 join)
   → NEEDS: Dynamic Node bridge (#1 join, spec §4.1)

2. Vishy runs `be watch` 
   → NEEDS: Rust local proxy (#1 watch)
   → OR: Vishy just sets ANTHROPIC_BASE_URL to gateway manually

3. Vishy's agent picks up a bounty
   → WORKS: GET /bounties returns active bounties
   → NEEDS: claim endpoint wired (#3 + #2)

4. Vishy's agent calls Claude through the proxy
   → WORKS: POST /v1/messages with bnet_ token
   → WORKS: LiteLLM routes to correct provider

5. Vishy's agent submits a PR
   → WORKS: POST /github/submit-pr

6. Vishy gets paid
   → NEEDS: oracle resolves → escrow pays → credits visible (#3.2, #6)
```

---

## Bounty Alignment

### Arc/Circle ($15k)
- BountyEscrow.vy on Arc ✓
- EURC settlement ✓  
- Circle Modular Wallet (web/src/wallet/circle.ts) ✓
- Gasless claims via Circle paymaster — **OPEN**

### ENS ($10k)
- CCIP-Read wildcard resolver ✓
- agent-{id}.maceip.eth ✓
- Resolver on Sepolia ✓
- Mainnet deployment — **NEEDS ETH**

### Flare ($10k) — third sponsor if selected
- TEE attestation on CI Oracle — **DEFERRED**
- bountynet/attest action with OIDC — ✓ (upgradeable to TEE later)

---

## Priority order (what to build next)

1. **Register GitHub App** on GitHub — unblocks Joe's entire journey
2. **Wire solver bot** to claim + solve + submit PR through gateway — unblocks Vishy's journey
3. **SimBountyNet** — the demo script that runs both journeys live
4. **`be join` in Rust** — copy sleeve identity code, add Dynamic bridge
5. **`be watch` in Rust** — local proxy using hyper/axum
6. **Wire web dashboard** to gateway API
7. **Mainnet ENS** — deploy resolver when ETH arrives
