# Unraveling The Damage

## 1. What Happened To `web/`

`web/` is now carrying two incompatible purposes:

- a deadline-driven demo shell
- a real product surface with setup, auth, agent state, and gateway wiring

The damage is not one bug. It is that we patched around a broken identity stack by replacing truth with demo state in the frontend.

Current demo-only hacks in `web/`:

- [`web/src/auth/DynamicProvider.tsx`](/home/cory/BountyNet/web/src/auth/DynamicProvider.tsx) is now a no-op provider.
- [`web/src/auth/useAuth.ts`](/home/cory/BountyNet/web/src/auth/useAuth.ts) is demo auth backed by `localStorage`, not real Dynamic auth.
- The logged-in state binds directly to `GET /identity/1`, which hardcodes a seeded production agent instead of onboarding or resolving the real user.
- The public shell and dashboard copy were retuned repeatedly for demos, prizes, and judges.
- The authenticated dashboard now mixes real gateway data with mocked or implied capability fields.

What is still real in `web/`:

- `GET /health`
- `GET /events`
- `GET /bounties`
- `GET /resources`
- `GET /sessions`
- `GET /oracle/health`
- `GET /github/repos/:installation_id`
- `POST /github/scan/:installation_id`
- `POST /github/setup`
- `POST /github/test-key`
- setup flow for repo selection, API key test, and scan

What is not trustworthy in `web/`:

- login state
- agent ownership
- any claim that the current browser user actually owns the shown agent

## 2. Why Identity Is Flimsy

The main identity flaw is that our system does not have one durable canonical identity key that survives across web, CLI, Dynamic, and Arc.

### Web

The frontend currently treats auth as:

- `loggedIn: true/false` in local storage
- a fake `userId`
- then directly looks up agent `#1`

That means:

- web auth does not prove ownership of the shown wallet
- web auth does not prove ownership of the shown ENS name
- web auth does not prove ownership of the shown EIP-8004 identity

### Gateway

[`gateway/routes/identity.py`](/home/cory/BountyNet/gateway/routes/identity.py) accepts:

- `POST /identity/onboard`
- body: `{ external_id: "..." }`

It then:

1. asks Dynamic for a user matching that external id
2. creates a Dynamic user if needed
3. gets or creates an EVM wallet
4. scans Arc `IdentityRegistry` for any agent whose wallet matches that address
5. returns `agent_id` if found, otherwise `null`

This is flimsy because:

- `external_id` is caller-chosen and unstable
- the route does not actually register a missing agent onchain
- the route only discovers an existing Arc agent by wallet scan
- there is no signed proof that the caller owns the returned identity beyond the Dynamic flow itself

### CLI

The **supported** CLI is **`be-cli/`** → binary `be` (minimal Rust; gateway routes only).

Older duplicate flows (`be/` mise fork, `be/join.py`) were **removed** from this repo. If join/onboard behavior regresses, debug against `be-cli/src/commands/join.rs` and the current `POST /identity/onboard` contract on the gateway.

### Arc / EIP-8004

The onchain identity model is actually the strongest part:

- [`contracts/src/IdentityRegistry.vy`](/home/cory/BountyNet/contracts/src/IdentityRegistry.vy)
- agent = NFT id
- wallet = `agent_wallet`
- optional URI = `agent_uri`
- optional metadata = `metadata`

But the web and CLI do not reliably create or bind to this identity. They only read from it after the fact.

So the truth today is:

- Arc identity is strong
- gateway identity discovery is weak
- web identity presentation is fake
- CLI identity onboarding is inconsistent

## 3. ENS Is Real, But It Depends On Arc Identity Being Real

ENS resolution is one of the cleaner parts:

- [`contracts/src/ens/BountyNetResolver.sol`](/home/cory/BountyNet/contracts/src/ens/BountyNetResolver.sol)
- [`gateway/routes/ens.py`](/home/cory/BountyNet/gateway/routes/ens.py)

Flow:

1. client resolves `agent-N.maceip.eth`
2. wildcard resolver triggers CCIP-Read
3. gateway resolves `agent-N`
4. gateway reads wallet from Arc `IdentityRegistry`
5. gateway signs the response
6. resolver verifies signature and returns the address

This part is solid.

The weakness is upstream:

- ENS is only as truthful as the Arc agent record
- Arc agent creation is not currently guaranteed by web or CLI onboarding

## 4. Web frontend

There is **one** app: **`web/`** (Vite + React). Older trees such as **`webv3/`** were removed — do not reintroduce v2/v3 splits.

The open product question is the same as before: **identity truth** (gateway + Dynamic + Arc) must match what the UI claims. Point the UI at real routes (`/health`, `/bounties`, `/identity/...`, GitHub setup, etc.) and avoid “demo identity” shortcuts.

## 5. Short version (recovery themes)

The damage is not visual. The damage is identity truth.

- the web app must not pretend identity is settled until the gateway does
- gateway onboarding discovers identity but does not guarantee it on all branches
- keep **one** CLI path: **`be-cli/`** (`be`); delete duplicate / forked CLIs when they appear
- Arc + ENS are the strongest primitives, but the product layers above them do not bind to them cleanly

That is the real thing to fix next.
