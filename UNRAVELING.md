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

There are two different join implementations:

- [`be/src/cli/join.rs`](/home/cory/BountyNet/be/src/cli/join.rs)
- [`be/join.py`](/home/cory/BountyNet/be/join.py)

They disagree on payload shape:

- Rust posts `external_id: dynamic:<jwt>` plus `dynamic_token`
- Python posts only `dynamic_token`

The gateway only requires `external_id`, so:

- Rust uses a terrible unstable external id derived from a JWT
- Python does not even match the route contract cleanly

This means the CLI does not produce a durable identity anchor. It produces a one-off onboarding attempt.

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

## 4. `webv3` Status

`webv3/` is not a product yet. It is scaffolding.

What is good:

- separate from the damaged `web/`
- Vite
- Tailwind v4
- shadcn initialized
- `motion`
- `lucide-react`
- alias + `cn()` helper

What is bad:

- no real gateway integration yet
- no auth path
- no setup flow
- no data model
- still contains starter assets and unused scaffold files
- committed `dist/` and `node_modules/`, which should be removed

So `webv3` is viable as the replacement path, but not yet the app.

## 5. Recommended Recovery Plan

### Phase A: Stop The Bleeding In `web/`

Keep `web/` only as the emergency demo surface.

Do not add more auth logic there.
Do not claim it is truthful identity.
Only keep:

- landing
- `/setup`
- minimal post-setup control plane

### Phase B: Make Identity Canonical

Choose one canonical identity anchor:

- Dynamic user id
- or wallet address
- but persistently map it to one Arc agent id

Required changes:

1. `POST /identity/onboard` must create or bind a real Arc agent, not just scan and hope.
2. CLI and web must send the same stable identity payload.
3. The gateway must persist the mapping:
   Dynamic user id -> Arc agent id
4. Web should display agent state only after the gateway returns a real bound agent.

### Phase C: Replace `web/` With `webv3`

`webv3` should have exactly three surfaces:

1. Landing
2. Setup
3. Control plane

And it should only talk to real endpoints:

- `/github/repos/:installation_id`
- `/github/test-key`
- `/github/setup`
- `/github/scan/:installation_id`
- `/bounties`
- `/events`
- `/identity/:id`
- `/oracle/health`
- `/resources`
- `/sessions`

## 6. Short Version

The damage is not visual. The damage is identity truth.

- `web/` became a demo shell
- gateway onboarding discovers identity but does not guarantee it
- CLI join is inconsistent and unstable
- Arc + ENS are the strongest primitives, but the product layers above them do not bind to them cleanly

That is the real thing to fix next.
