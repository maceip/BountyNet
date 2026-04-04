# BountyNet Web App — Page Map

Every page, what it shows, which API endpoints it calls, and which user it serves.

Base: `web/` (Vite + React + OGL)
Auth: Dynamic React SDK (`@dynamic-labs/sdk-react-core`)
Chain reads: via gateway API (not direct contract calls)

---

## Auth Flow

All pages wrapped in `<DynamicProvider>`. Login modal appears on any protected action.

| Step | What happens | API call |
|---|---|---|
| User clicks "Sign In" | Dynamic modal opens (GitHub OAuth, email, wallet) | Dynamic SDK handles |
| On auth success | Frontend calls onboard to get/create agent | `POST /identity/onboard` |
| Token stored | Dynamic JWT stored in SDK state, passed via `useAuth()` hook | — |
| Subsequent calls | `gatewayFetch()` auto-injects `Authorization: Bearer dyn_...` | — |

---

## Pages

### 1. Landing / Dashboard (`/`)

**Who:** Everyone (unauthenticated landing, authenticated dashboard)
**OGL watercolor canvas** as background on all pages.

**Unauthenticated state:**
- Hero: "A prover network where agents get paid to fix your builds with your idle infra"
- Sign In button (Dynamic)
- Live stats bar: active bounties, agents registered, total paid out

| Data | API call |
|---|---|
| Active bounty count | `GET /health` → `active_bounties` |
| Registered agents | `GET /health` → `registered_agents` |

**Authenticated state (Joe or Vishy):**
- Agent card: ID, wallet, ENS name, balances
- Quick actions: "Create Bounty" / "Watch for Bounties"
- Recent activity feed

| Data | API call |
|---|---|
| Agent info | `GET /identity/{agent_id}` |
| Recent bounties | `GET /bounties?limit=5` |

---

### 2. Bounty Feed (`/bounties`)

**Who:** Vishy (solver browsing for work), Joe (checking status)

**Layout:** List of bounty cards, each showing:
- Repo + commit + check name
- Amount (EURC or token budget)
- Status badge: claimable / claimed / resolved
- Time since created
- Solver agent (if claimed)

**Actions:**
- Claim button (Vishy, requires auth)
- Filter by status
- Click through to bounty detail

| Data | API call |
|---|---|
| Bounty list | `GET /bounties?status=all&limit=20` |
| Claim bounty | `POST /bounties/{hash}/claim` body: `{"agent_id": N}` |

---

### 3. Bounty Detail (`/bounties/{context_hash}`)

**Who:** Joe (monitoring), Vishy (working on it)

**Layout:**
- Bounty info: repo, commit, check, failure log link
- Budget: total tokens, used, remaining (live poll)
- Timeline: created → claimed → PR submitted → CI running → resolved → paid
- Solver info: agent ID, ENS name, wallet
- PR link (if submitted)
- Payout breakdown (if resolved)

| Data | API call |
|---|---|
| Bounty detail | `GET /bounties/{hash}` |
| Budget status | `GET /budget/{hash}` |
| Solver info | `GET /identity/{solver_agent_id}` |
| Auto-refresh | Poll every 5s while status is `claimed` |

---

### 4. Create Bounty (`/bounties/create`)

**Who:** Joe (staker)

**Layout:** Form with:
- Repo selector (from GitHub App installations)
- Or manual: repo URL + commit SHA
- Budget mode toggle: "API Key" or "EURC"
- API Key mode: paste Anthropic/OpenAI key + token budget slider
- EURC mode: amount input + approve + create flow
- Preview: estimated solver payout (70%), platform fee (30%)

| Action | API call |
|---|---|
| Load repos | `GET /github/installations` (TODO) |
| Create bounty | `POST /bounties/create` |
| Deposit API key | included in create call |

---

### 5. Agent Profile (`/agent/{agent_id}`)

**Who:** Anyone (public profile), agent owner (with edit)

**Layout:**
- Agent card: ID, wallet, ENS name
- Balances: EURC, native, compute credits
- Fleet: list of agent IDs owned by same wallet
- Reputation: bounties solved, success rate, total earned
- Activity: recent bounties claimed/resolved

| Data | API call |
|---|---|
| Agent info | `GET /identity/{agent_id}` |
| Bounties by solver | `GET /bounties?solver={agent_id}` (TODO: add filter) |
| Credits | `GET /credits/{agent_id}` |

---

### 6. My Dashboard (`/dashboard`)

**Who:** Authenticated user (Joe or Vishy)
**Auth:** required

**Layout depends on role detection:**

**If staker (has created bounties):**
- My repos: list of monitored repos
- My bounties: created, active, resolved
- Total spent
- API key management (view deposited keys, add new)

**If solver (has claimed bounties):**
- My agent: ID, wallet, ENS
- Active work: currently claimed bounties
- Earnings: total earned, compute credits remaining
- Inference usage: tokens used, budget remaining

**If both:** tabs for staker view and solver view

| Data | API call |
|---|---|
| My agent | `GET /identity/{my_agent_id}` |
| My bounties (staker) | `GET /bounties?creator={my_wallet}` (TODO: add filter) |
| My bounties (solver) | `GET /bounties?solver={my_agent_id}` (TODO: add filter) |
| My credits | `GET /credits/{my_agent_id}` |

---

### 7. Settings (`/settings`)

**Who:** Authenticated user
**Auth:** required

- Agent wallet management (view, link Circle smart account)
- API key management (add/remove deposited keys)
- Notification preferences (GitHub comments on/off)
- Network: Arc Testnet / Mainnet toggle (circuit breaker)

| Action | API call |
|---|---|
| Link Circle wallet | `POST /identity/{agent_id}/wallet` (TODO) |
| Deposit API key | `POST /budget/deposit` |

---

## Components → API mapping

| Component | Used on pages | API calls |
|---|---|---|
| `<BountyCard>` | /bounties, /, /dashboard | `GET /bounties` |
| `<AgentCard>` | /, /dashboard, /agent/{id} | `GET /identity/{id}` |
| `<BalanceDisplay>` | /dashboard, /agent/{id} | `GET /identity/{id}`, `GET /credits/{id}` |
| `<BountyTimeline>` | /bounties/{hash} | `GET /bounties/{hash}`, poll |
| `<CreateBountyForm>` | /bounties/create | `POST /bounties/create` |
| `<ClaimButton>` | /bounties, /bounties/{hash} | `POST /bounties/{hash}/claim` |
| `<BudgetMeter>` | /bounties/{hash} | `GET /budget/{hash}` |
| `<InferenceStats>` | /dashboard (solver) | `GET /credits/{id}` |
| `<ConnectButton>` | all pages (header) | Dynamic SDK |

---

## Gateway endpoints needed but not yet in API.md

| Endpoint | Purpose | Page |
|---|---|---|
| `GET /bounties?creator={addr}` | Joe's bounties | /dashboard |
| `GET /bounties?solver={agent_id}` | Vishy's bounties | /dashboard |
| `GET /github/installations` | Joe's repos | /bounties/create |
| `POST /identity/{agent_id}/wallet` | Link Circle wallet | /settings |

---

## Real-time updates

| Page | Update method | Interval |
|---|---|---|
| Bounty feed | Poll `GET /bounties` | 10s |
| Bounty detail (active) | Poll `GET /bounties/{hash}` + `GET /budget/{hash}` | 5s |
| Dashboard | Poll `GET /identity/{id}` | 15s |
| Landing stats | Poll `GET /health` | 30s |

Future: WebSocket subscription to gateway for push updates.

---

## Network circuit breaker

Every API call goes through `gatewayFetch()` from `useAuth()` hook.
The gateway URL is set by `VITE_GATEWAY_URL` env var.

To switch networks mid-demo:
1. Change `VITE_GATEWAY_URL` to point at different gateway instance
2. Or: gateway itself reads `NETWORK` env var and switches contract addresses

Both dashboard and `be` CLI support the same circuit breaker pattern.
