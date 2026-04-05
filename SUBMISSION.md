# ETHGlobal Cannes 2026 — Submission

## Project Name
**BountyNet**

## Tagline (300 chars max)
A prover network where agents get paid to fix your builds with your idle infra: stake EURC when CI breaks, solvers claim with LLM patches, a CI oracle verifies on-chain, green build triggers payout.

## Description
BountyNet turns broken CI into **bounties** settled on **Arc** with **EURC**. Stakers attach failures from GitHub (or stake API credits); **solver agents** watch events, generate patches, and open PRs. A **Flare TEE–backed CI oracle** attests whether the build went green, then **on-chain escrow** pays out (README documents a **70% solver / 30% treasury** split). Identity ties together **Dynamic** auth, **EIP‑8004** agent registration, **ENS** **CCIP‑Read** names (`agent-N.maceip.eth`), and optional **Circle Modular Wallets** for smart-account / passkey flows on **Arc Testnet**. The repo includes **webv2/** (Cannes **Vite + React** UI + Arweave watercolor) and **web/** (legacy **OGL** canvas), **live:** https://bountynet.stare.network; a **Flask** gateway with GitHub App flows and **MCP**; **Vyper** contracts with **Moccasin**; simulation agents; **Jetpack Compose** Android (**minSdk 30**) for foldable-friendly navigation and in-app auth.

## How It's Made

### Tech Stack (as in this repo)
- **Smart contracts:** **Vyper** (`contracts/src/*.vy`) · **Moccasin** (`contracts/moccasin.toml`, `mox test` in CI) · **Solidity** ENS resolver (`contracts/src/ens/BountyNetResolver.sol`)
- **Chain:** **Arc Testnet** (e.g. RPC `https://rpc.testnet.arc.network` in `android/app/.../ArcClient.kt`, `web/src/wallet/circle.ts`)
- **Frontend (Cannes):** **webv2/** — **Vite** + **React 19** + **TypeScript** + **Tailwind 4** · **@dynamic-labs/sdk-react-core** + **@dynamic-labs/ethereum** · **@circle-fin/modular-wallets-core** (wallet paths parallel **web/**)
- **Frontend (legacy):** **web/** — same Dynamic stack · **wagmi** + **viem** + **RainbowKit** · **OGL** WebGL watercolor (`web/package.json`, `web/src/wallet/circle.ts`)
- **Backend / gateway:** **Flask** blueprints (e.g. `gateway/routes/github.py`, `gateway/routes/identity.py`, `gateway/routes/ens.py`, `gateway/routes/bounties.py`) + **MCP** Streamable HTTP (`gateway/mcp_server.py`, `/mcp`)
- **Oracle / TEE:** **Flare** TEE extension entry (`oracle-tee/main.py` and `oracle-tee/app/…`)
- **Mobile (Android):** **Kotlin 2.3.0** · **Jetpack Compose** (BOM `2025.12.00` in `android/gradle/libs.versions.toml`) · **Material 3** · **minSdk 30** · **Navigation 3** + two-pane adaptive UI · **web3j** · Chrome **Custom Tabs** / **Auth Tab** hints (`android/.../PartialCustomTabLogin.kt`) · **Timber** + file/optional HTTP log shipping (`android/.../logging/`)
- **Agent / CLI:** Rust **`bounty`** binary from **`be/`** (e.g. `bounty join`, `bounty bounties` — see `be/src/cli/`) · Python **`sim/`** agents · **integrations/claude-code-bountynet/** (Claude Code plugin + status line)
- **CI/CD:** GitHub Actions — **contracts** (`moccasin` / `mox test`), **web** / **webv2** builds (`npm run build`); paths under `.github/workflows/`

### Sponsor Integrations

#### Arc + Circle — settlement on Arc Testnet, EURC / smart accounts
- **What we used:** Arc RPC + testnet chain definitions; **Circle Modular Wallets** (`@circle-fin/modular-wallets-core`); **Vyper** escrow / identity / validation contracts; **web3j** toward Arc from Android.
- **Where in the code:** `contracts/src/BountyEscrow.vy`, `contracts/src/MockEURC.vy`, `contracts/src/IdentityRegistry.vy`, `contracts/src/ValidationRegistry.vy` · `web/src/wallet/circle.ts` · `web/src/App.tsx` (Arc / EURC UI) · `android/.../web3/ArcClient.kt` · `gateway/chain.py` (and routes that call `send_tx` / escrow)
- **How it works:** Bounties and payouts are modeled against **EURC** and Arc contracts; the web stack can build **Circle smart accounts** on **Arc Testnet**; the gateway submits transactions to chain helpers.

#### Dynamic — auth, embedded wallets, JWT to gateway
- **What we used:** **Dynamic Labs JS SDK** (`@dynamic-labs/sdk-react-core`, `@dynamic-labs/ethereum`); **Node** bridge for server-side Dynamic calls (`wallet/dynamic_bridge.mjs` invoked from `gateway/routes/identity.py`); **mobile** sign-in via **`/android-auth`** and `bountynet://auth/callback` (`web/src/pages/AndroidAuth.tsx`, Android `MainActivity` + `PartialCustomTabLogin`).
- **Where in the code:** `web/src/auth/DynamicProvider.tsx`, `web/src/auth/useAuth.ts`, `web/src/App.tsx` · `gateway/routes/identity.py`, `gateway/routes/github.py` (Dynamic user creation for stakers) · `wallet/dynamic_bridge.mjs` · `android/.../MainNav.kt`, `MainActivity.kt`, `AndroidManifest.xml` (deep link)
- **How it works:** Users sign in with Dynamic; the app gets a **JWT** and calls **`GATEWAY`** (`VITE_GATEWAY_URL`, default `https://gateway.stare.network` in `useAuth.ts`); Android can complete the same flow and store the JWT locally.

#### ENS — CCIP-Read wildcard for agents
- **What we used:** Off-chain resolution for **`*.maceip.eth`** and chain-specific `coinType` (incl. Arc and Flare Coston2) per `gateway/routes/ens.py`.
- **Where in the code:** `gateway/routes/ens.py` · on-chain piece `contracts/src/ens/BountyNetResolver.sol` · UI shows `auth.ensName` from `useAuth` in `web/src/App.tsx`
- **How it works:** Resolver / gateway answers ENS **CCIP-Read** style lookups so **`agent-{id}.maceip.eth`** maps to registry-backed wallets across chains.

#### Flare — TEE CI oracle
- **What we used:** **Flare TEE** extension process + HTTP oracle API (see `oracle-tee/`).
- **Where in the code:** `oracle-tee/main.py`, `oracle-tee/app/handlers.py` (and related) · `gateway/routes/github.py` (ValidationRegistry / TEE attestation notes) · `gateway/routes/ens.py` (Coston2 `coinType`)
- **How it works:** Oracle runs as a **TEE extension**, with documented env ports and signing; gateway integrates attested validation into the **Arc** validation flow.

## Bounties Applied For
Check only what you actually want judges to score (edit freely):

- [ ] World — Best use of Agent Kit
- [ ] World — Best use of World ID 4.0
- [ ] World — Best use of Minikit 2.0
- [ ] 0G — Best OpenClaw Agent on 0G
- [ ] 0G — Best DeFi App on 0G
- [ ] 0G — Wildcard on 0G
- [x] Arc — Best Smart Contracts with Advanced Stablecoin Logic *(EURC / escrow math — align pitch with bounty wording)*
- [ ] Arc — Best Chain Abstracted USDC Apps *(repo emphasizes **EURC**; check only if you frame stablecoin abstraction generically)*
- [x] Arc — Best Agentic Economy with Nanopayments *(agent payouts / bounty claims — tune narrative to match “nanopayments”)*
- [ ] Arc — Best Prediction Markets on Arc
- [x] ENS — Best ENS Integration for AI Agents
- [x] ENS — Most Creative Use of ENS
- [x] Flare — Next gen apps with TEE Extensions and Smart Accounts
- [ ] Flare — Bonus: Best Smart Account App *(optional if you stress Circle smart accounts + Flare — verify eligibility)*
- [ ] Ledger — AI Agents x Ledger
- [ ] Ledger — Clear Signing, Integrations & Apps
- [ ] Chainlink — Best workflow with Chainlink CRE
- [ ] Chainlink — Connect the World with Chainlink
- [ ] Chainlink — Best usage of Chainlink privacy standard
- [x] Dynamic — Most comprehensive use of Dynamic Node SDK *(bridge in `wallet/dynamic_bridge.mjs` + `gateway/routes/identity.py`)*
- [x] Dynamic — Most comprehensive use of Dynamic JS SDK
- [x] Dynamic — Most comprehensive use of Dynamic in mobile

## Demo
- **Video:** submission.mp4 (or link)
- **Live URL:** https://bountynet.stare.network

### Demo video — script & shot plan (~4–5 min)

**Production checklist (B-roll, audio, screen caps, kit):** see [`DEMO_VIDEO_BROLL.md`](DEMO_VIDEO_BROLL.md) in the repo root.


Four to five minutes is long for **listing features** but short for **proving a full loop**. Treat it as a small product story: one problem, one character, one payoff, then “how” in layers—avoid **~45s+** on any single screen without a beat change.

**What judges tend to remember**

1. The **one sentence** they can repeat: *CI breaks → bounty → agent fixes → oracle pays.*
2. **One live proof** (real GitHub / Arc / login)—not only slides.
3. **One clear moment per sponsor** you care about (Arc settlement, Dynamic auth, ENS name, Flare TEE)—each **visible once**.
4. **One personality beat** (e.g. foldable Android, fast cut, humor, or one clean diagram)—pick one.

**Suggested arc (~4:30)**

| Block | Time | Purpose |
|--------|------|---------|
| **Cold open** | 0:00–0:25 | Pain: blunt + funny (“I hate CI”, “RED RED RED emails”)—then inhale and pivot. No logos yet. |
| **Promise** | 0:25–0:45 | Name + one line: stake / agents / on-chain payout. Show **https://bountynet.stare.network**. |
| **Hero demo (web)** | 0:45–2:15 | Log in (**Dynamic**), dashboard / bounties / **Arc** stats or escrow line. Tie **EURC** in one phrase. |
| **The loop (tight)** | 2:15–3:15 | Diagram or split screen → GitHub install / webhook **or** **pre-recorded** PR clip (caption: “recorded run” if not live) → green build → payout language. |
| **Identity / ENS** | 3:15–3:45 | **`agent-N.maceip.eth`** or ENS UI—one zoom, one sentence (CCIP-Read / agent binding). |
| **Oracle / Flare** | 3:45–4:05 | TEE oracle: short terminal/`oracle-tee` clip or gateway log line—minimal jargon. |
| **Android / fold** | 4:05–4:35 | Phone **closed** → open app → **unfold** → two-pane + in-app auth sheet—**mostly visual**, little VO. |
| **Close** | 4:35–4:45 | Tagline + **Live: bountynet.stare.network** + “ships today”. |

If long, **trim the middle of the web tour**, not the cold open or the foldable beat.

**Composition**

- Talking head **≤~20%** of runtime; use **L-cuts** (VO continues over UI).
- **Full-screen UI** for Dynamic login, bounties, Arc stats, ENS—large cursor, 1080p, hide unrelated tabs.
- **One diagram** (README architecture) for **10–15s** when you say “escrow + oracle.”
- **Lower-third** the first time each sponsor matters (*Dynamic · Arc · ENS · Flare*)—then stop repeating.
- Music: subtle or none; duck under VO on key lines.

**Voice:** super blunt, funny, **honest guy**—not keynote corporate. One punchline per beat, then say the real fact. Don’t dunk on sponsors.

**Talking points / script beats** (improv ok — say it how you’d say it to a friend)

- *Open:* “I don’t know if you’re like me, but **I hate CI**. And when my inbox goes **red, red, RED**—those emails give me anxiety. I’m not built for this.” *[beat]* “So we built something meaner than hope.”
- *Transition:* “**BountyNet**: CI breaks, you stake, bots actually try to fix it, and if the build goes green you get paid like an adult. On-chain. Not vibes.”
- *Web:* “Live app—**bountynet dot stare dot network**. I log in with **Dynamic** because I’m not inventing account number seven.” → dashboard → “That’s **Arc**, that’s escrow, that’s **EURC**—real money behavior, testnet manners.”
- *Loop:* “Failure hits, agent grabs it, PR shows up. Who says the build is green? Not me—I’m biased. **Flare TEE** oracle. Trust the hardware attestation crowd.”
- *ENS:* “Agents get names humans can say: **`agent` dash your id dot `maceip` dot eth**. Not `0x` soup. You’re welcome.”
- *Android:* “Phone closed, anxiety high, fold it open—two panes, sign-in in a half-height Chrome sheet so you’re not yeeted into browser limbo.”
- *Close:* “**BountyNet**. Less red email. More green build. **bountynet dot stare dot network**—ship it.”

**Avoid**

- Reading this doc or listing every file.
- **90s** of architecture **before** any UI.
- Faking chain behavior—**pre-record** flaky segments and label them.
- Ending on credits; end on **URL + one sentence**.

**Optional:** A **2:30 “judge cut”** (same arc minus oracle deep dive) plus the **4:30** full story—many reviewers watch the short one first.

### Sponsor prizes — targeting (cost / fit / EV-style)

True EV needs **official prize $**, **number of entries per track**, and rubrics off **ethglobal.com**. Until then, rank by **fit × differentiation × demo clarity − narrative risk**.

**Strong fits in this repo**

| Track | Why |
|--------|-----|
| **ENS** | `gateway/routes/ens.py`, resolver, `agent-{id}.maceip.eth`—clear “agents + ENS” story. |
| **Arc** | Vyper escrow / EURC / registries—**core** product, not garnish. |
| **Dynamic** | Web + `dynamic_bridge.mjs` / `identity.py` + **Android** auth—full-stack, rare. |
| **Flare** | `oracle-tee/`—real but **harder to show** prettily in seconds. |

**Recommended top 3 to *pitch* in the video and align judging**

1. **ENS — Best ENS Integration for AI Agents** (or **Most Creative**)—high differentiation, easy to **show** in one beat.  
2. **Arc — Best Smart Contracts with Advanced Stablecoin Logic**—EURC/escrow/splits; stress **stablecoin + escrow mechanics** (avoid USDC-only wording unless rubric fits).  
3. **Dynamic — Most comprehensive use of Dynamic in mobile** *(or **JS SDK** if you emphasize server bridge)*—fold + Auth Tab is memorable; pick **one** Dynamic bounty as primary to avoid scattered story.

**Higher risk / optional**

- **Arc — Chain Abstracted USDC**—you’re **EURC-first**; only if you can align narrative to bounty wording.  
- **Arc — Prediction Markets**—weak fit unless you reshape the product.  
- **Flare**—great if you have a **tight ~20s** oracle proof; else fourth priority behind the three above.

Re-check **exact bounty titles & prize structure** on the event site before final checks in the list above.

## Team
- **Members:** Ryan MacArthur (@maceip)
- **Contact:** rex@lowkey.email

## Will You Keep Building This?
**Yes.** The README positions BountyNet as a full loop (stakers, solvers, on-chain escrow, TEE oracle, ENS identities); the monorepo already splits contracts, gateway, oracle, web, Android, and sim agents, which is a strong base to extend after the hackathon.
