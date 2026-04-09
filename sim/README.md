# Simulators

**Sim** here means **simulate the BountyNet network**: stand in for stakers, solvers, chain, gateway, and the glue around them so you can see the system move without relying on production traffic alone.

What lives in this folder:

| Script | What it simulates |
|--------|-------------------|
| **`agent.py`** | Solver-side automation against gateway/API-style flows (persona: agent fixing bounties). |
| **`sim_staker.py`** | Staker journey in the browser (install/setup/onboarding shape). |
| **`sim_solver.py`** | Solver journey in the browser (feed, claim, post-claim). |
| **`seed_gateway.py`** | Throws data/state at the gateway for demos or local runs. |
| **`malicious.py`** | Adversarial or abuse-oriented scenarios. |

The **soak test** (`tests/soak/`) is the same idea in a different package: a **deterministic** full loop (local chain, contracts, fake GitHub, gateway) for CI. It is not under `sim/`, but it is still **network simulation**.

Nothing in this README defines sim as “Playwright imports” or a single health command—those are environment details. **Sim is the behavior you are modeling**, not the tooling checklist.

---

## What simulation needs to cover (the whole network)

If the goal is to catch shallow work—agents that patch code without proving the network still works—simulation plus deep tests together need to exercise **every obligation** below (split across soak, `agent.py`, browser sims, and contract tests as appropriate).

**Chain**

- Deploy collateral + `IdentityRegistry` + `ValidationRegistry` + `BountyEscrow` with correct wiring.
- Fund/stake: balances, `approve`, `create_bounty`, event visibility.
- Claim: `claim_intent` with the **correct** signing identity (solver owns `agent_id`).
- Resolve: validation hash recorded on `ValidationRegistry`, `resolve_bounty` only when rules say so.
- Negative paths: double-claim, resolve without validation, expired bounty, etc.

**Gateway store + HTTP**

- SQLite: installations, repos, API-key budgets, streak multipliers, bounty rows, credits—invariants hold after each step.
- GitHub webhooks: `installation`, failing `check_run`, and success/PR paths you care about.
- Identity: onboard, wallet/agent linkage; same for CLI session adapter if you treat `be join` as production.
- Bounty feed: on-chain + API-key rows merged; detail/claim responses match chain or store.

**Inference router**

- `bnet_*` accepts only valid claimed contexts; metering and budget behavior matches design (failure modes, no free inference).

**GitHub API adjunct**

- Whatever production uses: installation tokens, commit comments, optional PR creation, config file paths—stubbed or live.

**Solver automation (`agent.py` path)**

- Poll → claim → use issued credentials → optional clone/fix/PR loop; fraud modes (`--hallucinate`, `--malicious`) if you rely on them for red-team coverage.

**Human-shaped UI (browser sims)**

- Staker setup funnel and solver feed/claim/resolution **as seen in the browser**, against the URL you ship.

**Adversarial**

- Abuse and bypass attempts against webhooks, auth, and metering—should fail closed.

**Reproducible spine (today: `tests/soak/`)**

- One fully local, deterministic pass: chain + contracts + fake GitHub + gateway imports once + webhook + onboard + on-chain claim—so CI can fail before anyone merges a lucky edit.

No single script does all of this today; the **union** of these behaviors is what “simulating the network” must mean if you want to catch agents that skip verification.
