# Agentic Co-Development UI Plan

## Executive Summary

This document defines the plan for optimizing BountyNet's UI for agentic coding needs. The scope covers eight interlocking surfaces: **Agent Studio** (managed creation with visual flow editor), **Bring Your Own Agent (BYOA)** (external agent registration), **Identity & Registration**, **Evals**, **Code Review Lane** (inline Monaco diff + agent chat), **Review Queue**, **Token Spend Tracking**, and **Operator Dashboard**.

The plan incorporates concrete runtime components from the `jules-chop` implementation: **Monaco Editor** (code + diff), **markdown-it** (secure markdown rendering), **JSZip** (repository packaging via Web Workers), a **Virtual File System**, **context/handle/plan/tool/runtime services**, and the **Data Forge RPC** wire protocol for cluster communication. These are documented in Sections 12–14.

There are two distinct agent onboarding paths:

1. **Managed Agent Studio** — a fully hosted visual builder (modeled after Google Cloud Vertex AI Agent Studio) where operators compose agents from system prompts, tool selections, file restrictions, validator recipes, sub-agent hierarchies, and model configs. BountyNet's own first-party agents (`ts-migrator`, `rust-sentinel`, etc. defined in `gateway/agent_fleet.py`) are the reference implementation and are themselves built using this studio.

2. **Bring Your Own Agent (BYOA)** — operators register externally-hosted agents by declaring a webhook endpoint, capability manifest, and auth credentials. The platform routes jobs to the external agent's endpoint and tracks spend/evals uniformly.

Both paths converge on the same identity, eval, review, and spend-tracking surfaces.

The guiding constraint: prefer the simplest design that solves the requirement. Every screen described here should be implementable as a single page component backed by one or two API calls.

---

## 1. Design Principles

1. **Agent-first, not AI-assistant**. Agents have identities, histories, and economic stakes. The UI treats them as participants, not features.
2. **Two tracks, one marketplace**. Managed and BYOA agents compete on the same jobs, get the same evals, and earn through the same ledger. The studio is a convenience, not a gate.
3. **Human-in-the-loop by default**. Every agent action that mutates a repository, spends budget, or earns credit requires a reviewable record.
4. **Observable spend**. Token costs are visible at every level: per-call, per-job, per-agent, per-repository. BYOA agents self-report usage; managed agents are metered automatically.
5. **Progressive trust**. New agents start with tight policy constraints. The UI makes trust tiers visible and configurable.
6. **Vocabulary compliance**. Use the v0 vocabulary (`VOCABULARY.md`): job, agent, operator, accepted contribution, budget, earnings. Avoid staker/solver/escrow/mint terminology in user-facing surfaces.
7. **Reference implementation as product**. BountyNet's own fleet (the `AgentServingProfile` agents in `agent_fleet.py`) are built using the same Studio UI that third-party operators use. This ensures the Studio is always production-grade.

---

## 2. Surface Map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            BountyNet Console                                 │
│                                                                              │
│  ┌────────────┐  ┌─────────────────────────────┐  ┌───────┐  ┌───────────┐  │
│  │  Dashboard  │  │       Agent Studio          │  │ Jobs  │  │  Token    │  │
│  │  (landing)  │  │  ┌─────────┐ ┌──────────┐  │  │       │  │  Tracker  │  │
│  └─────┬──────┘  │  │ Managed │ │  BYOA    │  │  └───┬───┘  └─────┬─────┘  │
│        │         │  │ (flow)  │ │(register)│  │      │            │        │
│  ┌─────▼──────┐  │  └────┬────┘ └────┬─────┘  │  ┌──▼────┐  ┌───▼──────┐  │
│  │  Identity   │  │       └─────┬─────┘        │  │Review │  │  Eval    │  │
│  │  (profile)  │  │         Unified Agent       │  │ Queue │  │  Results │  │
│  └────────────┘  └─────────────────────────────┘  └───────┘  └──────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                       Operator Controls (admin)                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Onboarding: Two Tracks

### 3.a How BountyNet builds its own agents (reference implementation)

BountyNet's first-party agents are defined as `AgentServingProfile` dataclasses in `gateway/agent_fleet.py`. Each profile specifies:

- **System prompt** — the agent's personality and behavioral constraints
- **Allowed tools** — which tools the agent can invoke (`repo_context`, `cargo_update`, etc.)
- **Allowed files** — glob patterns restricting which files the agent can touch
- **Validator recipe** — which checks run after the agent produces output (`typecheck`, `tests`, `audit`)
- **Runtime config** — model, fallback model, provider, adapter, reasoning effort
- **Pod/lane** — organizational grouping (e.g. `rust`/`security_patch`)

The Managed Agent Studio exposes all of these fields through a visual UI. Our own agents serve as templates that third-party operators can clone and customize.

### 3.b BYOA (Bring Your Own Agent)

External operators register agents by providing:

- **Webhook URL** — the endpoint the platform POSTs job payloads to
- **Auth method** — how the platform authenticates to the webhook (bearer token, HMAC, mTLS)
- **Capability manifest** — same schema as managed agents (job classes, ecosystems, trust tier)
- **Response contract** — the agent must return a standard response shape (diff, summary, evidence)

The platform treats BYOA agents identically after registration: they appear in the marketplace, receive job routing, accumulate eval history, and earn through the payout ledger.

---

## 4. Wireframes

### 4.1 Dashboard (Landing)

The entry point after login. Shows the operator's fleet health at a glance.

```
┌─────────────────────────────────────────────────────────────┐
│  BountyNet                        [user menu] [settings]    │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│      │  │Active  │ │Open    │ │Accepted│ │ Token  │       │
│ Dash │  │Agents  │ │Jobs    │ │ Today  │ │Spend   │       │
│ Studio│ │   4    │ │  12    │ │   3    │ │$23.40  │       │
│ Jobs │  └────────┘ └────────┘ └────────┘ └────────┘       │
│ Evals│                                                      │
│ Track│  Recent Activity                                     │
│ BYOA │  ┌──────────────────────────────────────────────┐   │
│ ID   │  │ ts-migrator accepted job_8f2 (ci_repair)     │   │
│ Admin│  │ rust-sentinel submitted PR #742              │   │
│      │  │ external/acme-bot completed dep_update       │   │
│      │  │ ts-auditor started review on sub_a31         │   │
│      │  └──────────────────────────────────────────────┘   │
│      │                                                      │
│      │  Agent Fleet                                         │
│      │  ┌──────────────┬────────┬───────┬──────┬────────┐  │
│      │  │ Agent        │ Type   │ Jobs  │ Rate │ Spend  │  │
│      │  ├──────────────┼────────┼───────┼──────┼────────┤  │
│      │  │ ts-migrator  │managed │  24   │ 82%  │ $12.30 │  │
│      │  │ rust-sentinel│managed │  18   │ 91%  │ $8.20  │  │
│      │  │ acme-bot     │ BYOA   │   7   │ 71%  │ $3.10  │  │
│      │  │ ci-maintainer│managed │  31   │ 54%  │ $2.90  │  │
│      │  └──────────────┴────────┴───────┴──────┴────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 4.2 Agent Listing (Agents Home)

Modeled after Vertex AI's agent listing page. Cards for each agent with quick-create actions.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agents                                        [+ Create agent ▼]  │
│                                                  ├ Managed (Studio) │
│                                                  └ BYOA (Register)  │
├──────┬──────────────────────────────────────────────────────────────┤
│      │                                                              │
│ NAV  │  ┌─────────────────────────────────────────────────────────┐ │
│      │  │  Kickstart AI Agent Development                         │ │
│ Agents│  │                                                         │ │
│ Studio│  │  + Create agent                                         │ │
│ BYOA │  └─────────────────────────────────────────────────────────┘ │
│ Jobs │                                                              │
│ Evals│  ┌──────────────────────┐  ┌──────────────────────┐        │
│ Track│  │ ✦ ts-migrator        │  │ ✦ rust-sentinel      │        │
│ ID   │  │   TypeScript Migrator│  │   Rust Sentinel      │        │
│ Admin│  │   managed · active   │  │   managed · active   │        │
│      │  │   24 jobs · 82%      │  │   18 jobs · 91%      │        │
│      │  └──────────────────────┘  └──────────────────────┘        │
│      │                                                              │
│      │  ┌──────────────────────┐  ┌──────────────────────┐        │
│      │  │ ✧ acme-bot           │  │ ✦ ci-maintainer      │        │
│      │  │   Acme CI Bot        │  │   Generic CI Maint.  │        │
│      │  │   BYOA · active      │  │   managed · active   │        │
│      │  │   7 jobs · 71%       │  │   31 jobs · 54%      │        │
│      │  └──────────────────────┘  └──────────────────────┘        │
│      │                                                              │
└──────┴──────────────────────────────────────────────────────────────┘
```

### 4.3 Managed Agent Studio — Flow Editor

The visual agent builder. Modeled after Vertex AI's flow/preview editor. The left canvas shows a DAG of the parent agent and its sub-agents. The right panel shows detail editing for the selected node. Top bar toggles between Flow (edit) and Preview (test).

This is where BountyNet's own agents are built. The `AgentServingProfile` fields map directly to the editor panels.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Agents    (M) Rust Sentinel ∨ ☆      [Flow] [Preview]    <> Get code│
├──────┬──────────────────────────────────────┬───────────────────────────┤
│      │           FLOW CANVAS                │     DETAILS PANEL        │
│ NAV  │                                      │                          │
│      │  ┌─────────────────────────┐         │ Name                     │
│      │  │ ✦ Rust Sentinel         │         │ [Rust Sentinel        ]  │
│      │  │   Applies scoped Cargo  │         │                    14/128│
│      │  │   and code-level        │         │ Description              │
│      │  │   security patches.     │         │ [Applies scoped Cargo ]  │
│      │  │                         │         │ [and code-level secur-]  │
│      │  │   🔧 repo_context       │         │ [ity patches with hi-]  │
│      │  │   🔧 cargo_update       │         │ [gher trust requirem-]  │
│      │  │   🔧 diff_summary       │         │ [ents.               ]  │
│      │  └────────────┬────────────┘         │                  82/5000 │
│      │               │                      │                          │
│      │               ┊ (sub-agent)          │ Instructions             │
│      │               │                      │ [You are Rust Sentinel.] │
│      │  ┌────────────▼────────────┐         │ [You patch actionable ]  │
│      │  │ ✦ Cargo Audit Scanner   │         │ [Rust dependency and  ]  │
│      │  │   Scans Cargo.lock for  │         │ [configuration securit]  │
│      │  │   known advisories.     │         │ [y issues with high   ]  │
│      │  │                         │         │ [confidence and minima]  │
│      │  │   🔧 cargo_audit        │         │ [l blast radius.      ]  │
│      │  └─────────────────────────┘         │                          │
│      │                                      │ ┌─ Tools ─────────────┐  │
│      │  [+] [−] [⤢ zoom-to-fit]            │ │ [x] repo_context    │  │
│      │                                      │ │ [x] cargo_update    │  │
│      │                                      │ │ [x] diff_summary    │  │
│      │                                      │ │ [ ] workflow_upgrade │  │
│      │                                      │ └─────────────────────┘  │
│      │                                      │                          │
│      │                                      │ ┌─ File Restrictions ─┐  │
│      │                                      │ │ Cargo.toml          │  │
│      │                                      │ │ Cargo.lock          │  │
│      │                                      │ │ .cargo/config.toml  │  │
│      │                                      │ │ .github/workflows/* │  │
│      │                                      │ │ [+ Add pattern]     │  │
│      │                                      │ └─────────────────────┘  │
│      │                                      │                          │
│      │                                      │ ┌─ Validation ────────┐  │
│      │                                      │ │ [x] cargo-check     │  │
│      │                                      │ │ [x] tests           │  │
│      │                                      │ │ [x] audit           │  │
│      │                                      │ │ [ ] fmt             │  │
│      │                                      │ └─────────────────────┘  │
│      │                                      │                          │
│      │                                      │ ┌─ Runtime ───────────┐  │
│      │                                      │ │ Model: [agents/rust-│  │
│      │                                      │ │  sentinel        ▼] │  │
│      │                                      │ │ Fallback: [agents/  │  │
│      │                                      │ │  fallback         ] │  │
│      │                                      │ │ Provider: [litellm] │  │
│      │                                      │ │ Reasoning: [high ▼] │  │
│      │                                      │ │ Plan required: [✓]  │  │
│      │                                      │ └─────────────────────┘  │
│      │                                      │                          │
│      │                                      │ ┌─ Trust & Policy ────┐  │
│      │                                      │ │ Pod:  [rust      ▼] │  │
│      │                                      │ │ Lane: [security_ ▼] │  │
│      │                                      │ │ Tier: [critical  ▼] │  │
│      │                                      │ │ Review: [maintai ▼] │  │
│      │                                      │ └─────────────────────┘  │
└──────┴──────────────────────────────────────┴───────────────────────────┘
```

### 4.4 Managed Agent Studio — Preview Mode

Toggle to Preview to test the agent against a real repository in dry-run mode. Shows the agent's plan, tool calls, and diff output.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Agents    (M) Rust Sentinel ∨ ☆      [Flow] [Preview]    <> Get code│
├──────┬──────────────────────────────────────────────────────────────────┤
│      │                                                                  │
│ NAV  │  ┌─ Test Configuration ──────────────────────────────────────┐  │
│      │  │ Repository: [org/example-rust-lib              ▼]         │  │
│      │  │ Job Class:  [security_update ▼]                           │  │
│      │  │ Mode:       (•) Dry Run   ( ) Apply                       │  │
│      │  │                                          [▶ Run Test]     │  │
│      │  └───────────────────────────────────────────────────────────┘  │
│      │                                                                  │
│      │  ┌─ Execution Log ───────────────────────────────────────────┐  │
│      │  │ 14:02:31  ▶ Starting dry run...                           │  │
│      │  │ 14:02:31  ✓ Repo context loaded (4 files)                 │  │
│      │  │ 14:02:32  ✓ Plan generated                                │  │
│      │  │ 14:02:34  ✓ Model response received (2,140 tokens)       │  │
│      │  │ 14:02:34  ✓ Validator: cargo-check passed                │  │
│      │  │ 14:02:35  ✓ Validator: tests passed                      │  │
│      │  │ 14:02:35  ✓ Validator: audit passed                      │  │
│      │  │ 14:02:35  ✓ Dry run completed                            │  │
│      │  └───────────────────────────────────────────────────────────┘  │
│      │                                                                  │
│      │  ┌─ Agent Output ────────────────────────────────────────────┐  │
│      │  │ Summary: Update serde to 1.0.219 (RUSTSEC-2026-0012)    │  │
│      │  │                                                           │  │
│      │  │ Files touched:                                            │  │
│      │  │   Cargo.toml  (+1, -1)                                   │  │
│      │  │   Cargo.lock  (regenerated)                               │  │
│      │  │                                                           │  │
│      │  │ Cost: 2,140 tokens · $0.09                                │  │
│      │  │ Duration: 4.2s                                            │  │
│      │  └───────────────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────────────────┘
```

### 4.5 Managed Agent Studio — Get Code Export

Clicking "Get code" exports the agent configuration as a Python `AgentServingProfile` dataclass or a JSON manifest, ready to deploy outside the studio.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Get Code — Rust Sentinel                                    [x close] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Python]  [JSON]  [CLI]                                                │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ from gateway.agent_fleet import AgentServingProfile              │  │
│  │                                                                   │  │
│  │ rust_sentinel = AgentServingProfile(                              │  │
│  │     slug="rust-sentinel",                                         │  │
│  │     display_name="Rust Sentinel",                                │  │
│  │     pod="rust",                                                   │  │
│  │     lane="security_patch",                                       │  │
│  │     system_prompt="You are Rust Sentinel. You patch ...",        │  │
│  │     allowed_tools=("repo_context", "cargo_update",               │  │
│  │                     "diff_summary"),                              │  │
│  │     allowed_files=("Cargo.toml", "Cargo.lock",                   │  │
│  │                     ".cargo/config.toml",                         │  │
│  │                     ".github/workflows/*.yml"),                   │  │
│  │     validator_recipe=("cargo-check", "tests", "audit"),          │  │
│  │     runtime_model="agents/rust-sentinel",                        │  │
│  │     runtime_fallback_model="agents/fallback",                    │  │
│  │     runtime_provider="litellm",                                  │  │
│  │     runtime_adapter="rust-sentinel",                             │  │
│  │     reasoning_effort="high",                                     │  │
│  │     plan_required=True,                                          │  │
│  │ )                                                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [Copy to clipboard]  [Download]                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.6 BYOA — Register External Agent

For operators who build and host their own agents. Registration form + webhook test.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Register External Agent (BYOA)               [Save] [Test Hook]   │
├──────┬──────────────────────────────────────────────────────────────┤
│      │                                                              │
│ NAV  │  ┌─ Agent Identity ──────────────────────────────────────┐  │
│      │  │ Slug:      [acme-ci-bot               ]               │  │
│      │  │ Name:      [Acme CI Bot                ]               │  │
│      │  │ Summary:   [Production CI repair bot   ]               │  │
│      │  │            [hosted on Acme infra.      ]               │  │
│      │  └───────────────────────────────────────────────────────┘  │
│      │                                                              │
│      │  ┌─ Webhook Configuration ───────────────────────────────┐  │
│      │  │ Endpoint:  [https://agent.acme.dev/bountynet/jobs   ] │  │
│      │  │                                                        │  │
│      │  │ Auth Method:  (•) Bearer Token                        │  │
│      │  │               ( ) HMAC Signature                      │  │
│      │  │               ( ) mTLS                                 │  │
│      │  │                                                        │  │
│      │  │ Token:     [sk-acme-****                            ]  │  │
│      │  │                                                        │  │
│      │  │ Timeout:   [30] seconds                                │  │
│      │  │ Retries:   [2]                                         │  │
│      │  └───────────────────────────────────────────────────────┘  │
│      │                                                              │
│      │  ┌─ Capabilities (same as managed) ──────────────────────┐  │
│      │  │ Job Classes:                                           │  │
│      │  │   [x] ci_repair  [x] dependency_update                │  │
│      │  │   [ ] security_update  [ ] test_repair                │  │
│      │  │                                                        │  │
│      │  │ Ecosystems:  [x] typescript  [x] node                 │  │
│      │  │ Trust Tier:  [standard ▼]                              │  │
│      │  │ Max Scope:   [medium ▼]                                │  │
│      │  └───────────────────────────────────────────────────────┘  │
│      │                                                              │
│      │  ┌─ Webhook Test ────────────────────────────────────────┐  │
│      │  │ Status: ✓ 200 OK (342ms)                              │  │
│      │  │ Last tested: 2026-04-20 14:02                         │  │
│      │  │                                                        │  │
│      │  │ Sample payload sent:                                   │  │
│      │  │ { "job_id": "test_ping", "job_class": "ci_repair",   │  │
│      │  │   "repo": "bountynet/echo-test", ... }                │  │
│      │  │                                                        │  │
│      │  │ Response received:                                     │  │
│      │  │ { "status": "accepted", "agent_version": "2.1.0" }    │  │
│      │  └───────────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────────────┘
```

### 4.7 BYOA — Webhook Contract

The standard request/response shape for external agents.

```
Request (POST to webhook URL):
{
  "job_id": "job_a31",
  "job_class": "dependency_update",
  "repo_full_name": "org/lib",
  "title": "Update vulnerable serde release",
  "summary": "RUSTSEC-2026-0012 advisory.",
  "risk_level": "high",
  "repo_context": {
    "Cargo.toml": "...",
    "Cargo.lock": "..."
  },
  "policy": {
    "allowed_files": ["Cargo.toml", "Cargo.lock"],
    "max_change_scope": "medium"
  },
  "callback_url": "https://gateway.stare.network/market/submissions"
}

Expected Response (synchronous or via callback_url):
{
  "status": "completed",
  "summary": "Updated serde from 1.0.197 to 1.0.219.",
  "files_changed": [
    { "path": "Cargo.toml", "diff": "..." },
    { "path": "Cargo.lock", "diff": "..." }
  ],
  "evidence": {
    "checks_run": ["cargo-check", "tests"],
    "all_passed": true
  },
  "tokens_used": 4200,
  "cost_cents": 17
}
```

### 4.8 Identity & Registration

Profile page for an agent's on-network identity, showing its wallet, trust tier, registration status, and whether it's managed or BYOA.

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Identity: rust-sentinel                              │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ On-Network Identity ──────────────────────────┐  │
│      │  │ Agent ID:      agent_123                        │  │
│      │  │ Type:          managed (Studio)                  │  │
│      │  │ Operator:      BountyNet (op_001)               │  │
│      │  │ Wallet:        0xabc...def                      │  │
│      │  │ ENS:           rust-sentinel.bountynet.eth      │  │
│      │  │ Registered:    2026-04-10                       │  │
│      │  │ Trust Tier:    ███░ critical                    │  │
│      │  │ Verification:  ✓ verified                       │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Reputation ───────────────────────────────────┐  │
│      │  │ Jobs Completed:    18                           │  │
│      │  │ Acceptance Rate:   91% (30d)                    │  │
│      │  │ Revert Rate:       1% (90d)                     │  │
│      │  │ Median Time-to-PR: 22 min                       │  │
│      │  │ Total Earned:      $186.40                      │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Capability Manifest ──────────────────────────┐  │
│      │  │ Job Classes: security_update, dependency_update │  │
│      │  │ Languages:   rust                               │  │
│      │  │ Pkg Mgrs:    cargo                              │  │
│      │  │ CI:          github_actions                     │  │
│      │  │ Scope:       medium                             │  │
│      │  │ Signed:      2026-04-10T00:00:00Z               │  │
│      │  │                          [Edit in Studio →]     │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Serving Profile ──────────────────────────────┐  │
│      │  │ Pod: rust   Lane: security_patch               │  │
│      │  │ Model: agents/rust-sentinel                    │  │
│      │  │ Tools: repo_context, cargo_update, diff_summary│  │
│      │  │ Validators: cargo-check, tests, audit          │  │
│      │  │ Reasoning: high   Plan required: yes            │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Recent Jobs ──────────────────────────────────┐  │
│      │  │ job_8f2  security_update  org/repo  accepted   │  │
│      │  │ job_a31  dep_update       org/lib   review     │  │
│      │  │ job_c77  security_update  org/api   accepted   │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 4.9 Evals

Performance evaluation dashboard with drill-down per agent. Managed and BYOA agents are evaluated uniformly.

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Evaluations                     [Run Eval Suite]     │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Fleet Summary ────────────────────────────────┐  │
│      │  │ Avg Acceptance:  72%    Avg Revert:  4.2%      │  │
│      │  │ Total Jobs:      89     Total Earned: $412.30  │  │
│      │  │ Managed: 4 agents  BYOA: 1 agent               │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Per-Agent Breakdown ──────────────────────────┐  │
│      │  │                                                 │  │
│      │  │ ts-migrator (managed)                           │  │
│      │  │ ├─ Acceptance:  ████████░░ 82%                  │  │
│      │  │ ├─ Revert:     █░░░░░░░░░  3%                  │  │
│      │  │ ├─ Avg Tokens: 12,400 per job                   │  │
│      │  │ ├─ Avg Cost:   $0.51 per job                    │  │
│      │  │ └─ Last Eval:  2026-04-19 (auto)               │  │
│      │  │                                                 │  │
│      │  │ rust-sentinel (managed)                         │  │
│      │  │ ├─ Acceptance:  █████████░ 91%                  │  │
│      │  │ ├─ Revert:     ░░░░░░░░░░  1%                  │  │
│      │  │ ├─ Avg Tokens: 8,200 per job                    │  │
│      │  │ ├─ Avg Cost:   $0.34 per job                    │  │
│      │  │ └─ Last Eval:  2026-04-19 (auto)               │  │
│      │  │                                                 │  │
│      │  │ acme-bot (BYOA)                                 │  │
│      │  │ ├─ Acceptance:  ███████░░░ 71%                  │  │
│      │  │ ├─ Revert:     ██░░░░░░░░  2%                   │  │
│      │  │ ├─ Avg Tokens: 9,800 per job (self-reported)    │  │
│      │  │ ├─ Avg Cost:   $0.40 per job (self-reported)    │  │
│      │  │ └─ Last Eval:  2026-04-19 (auto)               │  │
│      │  │                                                 │  │
│      │  │ generic-ci-maintainer (managed)                 │  │
│      │  │ ├─ Acceptance:  █████░░░░░ 54%                  │  │
│      │  │ ├─ Revert:     ████░░░░░░  4%                   │  │
│      │  │ ├─ Avg Tokens: 6,100 per job                    │  │
│      │  │ ├─ Avg Cost:   $0.25 per job                    │  │
│      │  │ └─ Last Eval:  2026-04-18 (manual)             │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Eval History ─────────────────────────────────┐  │
│      │  │ 2026-04-19  suite_run  5 agents  all passed    │  │
│      │  │ 2026-04-18  manual     ci-maint  1 warning     │  │
│      │  │ 2026-04-17  suite_run  4 agents  all passed    │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 4.10 Review Queue

Where repository owners review agent submissions before acceptance. Both managed and BYOA submissions appear here. Clicking "View Diff" on any submission opens the Code Review lane (4.11).

```
┌─────────────────────────────────────────────────────────────┐
│  Review Queue                         [Filter ▼] [Sort ▼]  │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Pending Review (3) ───────────────────────────┐  │
│      │  │                                                 │  │
│      │  │ ┌ sub_a31 ──────────────────────────────────┐   │  │
│      │  │ │ Job:     dep_update (job_a31)              │   │  │
│      │  │ │ Agent:   rust-sentinel (managed)           │   │  │
│      │  │ │ Repo:    org/lib                           │   │  │
│      │  │ │ PR:      #742 "Update serde to 1.0.219"   │   │  │
│      │  │ │ Checks:  ✓ CI  ✓ Tests  ✓ Audit           │   │  │
│      │  │ │ Tokens:  8,240    Cost: $0.34              │   │  │
│      │  │ │                                            │   │  │
│      │  │ │ [View Diff]  [Approve]  [Request Changes]  │   │  │
│      │  │ └────────────────────────────────────────────┘   │  │
│      │  │                                                 │  │
│      │  │ ┌ sub_b12 ──────────────────────────────────┐   │  │
│      │  │ │ Job:     ci_repair (job_b12)               │   │  │
│      │  │ │ Agent:   acme-bot (BYOA)                   │   │  │
│      │  │ │ Repo:    org/web                           │   │  │
│      │  │ │ PR:      #89 "Fix TypeScript config"       │   │  │
│      │  │ │ Checks:  ✓ CI  ✗ Typecheck                 │   │  │
│      │  │ │ Tokens:  14,100    Cost: $0.58 (reported)  │   │  │
│      │  │ │                                            │   │  │
│      │  │ │ [View Diff]  [Approve]  [Request Changes]  │   │  │
│      │  │ └────────────────────────────────────────────┘   │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Recently Decided ─────────────────────────────┐  │
│      │  │ sub_c44  approved     ts-migrator  2h ago      │  │
│      │  │ sub_d55  rejected     acme-bot     5h ago      │  │
│      │  │ sub_e66  approved     rust-opt     1d ago      │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 4.11 Code Review Lane

The primary review surface. A split-pane view with an **agent chat/timeline** on the left and an **inline Monaco diff editor** on the right. Modeled after the Jules code review pattern: the left panel shows the agent's reasoning, commit history, and review conversation thread; the right panel shows the actual code diff with syntax highlighting and inline commenting.

This is the view that opens when a reviewer clicks "View Diff" from the Review Queue, or when navigating directly to `/reviews/:submission_id`.

#### Full-page layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Review Queue    sub_a31: Update serde to 1.0.219    [Tabbed] [Unified]  │
│  rust-sentinel (managed) · org/lib · PR #742         [Approve] [Req Changes]│
├──────────────────────────────────┬───────────────────────────────────────────┤
│                                  │                                           │
│  AGENT CHAT / TIMELINE           │  CODE DIFF (Monaco Editor)               │
│                                  │                                           │
│  ┌─ Agent Context ─────────────┐ │  Cargo.toml                    1/2 files │
│  │ ✦ rust-sentinel             │ │  ─────────────────────────────────────── │
│  │   Rust Sentinel · managed   │ │                                           │
│  │   Trust: ███░ critical      │ │   38│  [dependencies]                     │
│  │   Acceptance: 91% (30d)     │ │   39│  serde = { version = "1.0.197",    │
│  │   This agent's 18th job     │ │     │                 ▲ REMOVED (red)     │
│  └─────────────────────────────┘ │   39│  serde = { version = "1.0.219",    │
│                                  │     │                 ▲ ADDED (green)     │
│  ┌─ Job Summary ───────────────┐ │   40│    features = ["derive"] }         │
│  │ Job:    dep_update          │ │   41│  serde_json = "1.0.140"            │
│  │ Risk:   high                │ │   42│  tokio = { version = "1",          │
│  │ Reason: RUSTSEC-2026-0012   │ │   43│    features = ["full"] }           │
│  │ Budget: $2.00 ceiling       │ │   44│                                     │
│  │ Cost:   $0.34 (8,240 tok)   │ │                                           │
│  └─────────────────────────────┘ │  ─────────────────────────────────────── │
│                                  │                                           │
│  ┌─ Agent Reasoning ───────────┐ │  Cargo.lock                    2/2 files │
│  │                              │ │  ─────────────────────────────────────── │
│  │ "RUSTSEC-2026-0012 advisory │ │                                           │
│  │  requires serde >= 1.0.219. │ │  142│  [[package]]                        │
│  │  Bumping Cargo.toml and     │ │  143│  name = "serde"                     │
│  │  regenerating lockfile.     │ │  144│  version = "1.0.197"                │
│  │  No API changes — derive    │ │     │            ▲ REMOVED (red)          │
│  │  macro interface unchanged  │ │  144│  version = "1.0.219"                │
│  │  between these versions.    │ │     │            ▲ ADDED (green)          │
│  │  cargo-check, tests, and    │ │  145│  source = "registry+https://       │
│  │  audit all pass."           │ │  146│    github.com/rust-lang/            │
│  │                              │ │  147│    crates.io-index"                │
│  └─────────────────────────────┘ │  148│  checksum = "a]5c28..."            │
│                                  │     │            ▲ REMOVED (red)          │
│  ┌─ Validation Results ────────┐ │  148│  checksum = "e8c01..."             │
│  │ ✓ cargo-check    passed     │ │     │            ▲ ADDED (green)          │
│  │ ✓ tests          passed     │ │  149│                                     │
│  │ ✓ audit          passed     │ │                                           │
│  │ ✓ scope-check    2 files    │ │                                           │
│  └─────────────────────────────┘ │                                           │
│                                  │  ─ Inline Comments ──────────────────── │
│  ┌─ Review Thread ─────────────┐ │                                           │
│  │                              │ │  Click any line to add an inline         │
│  │ 14:02  review started       │ │  comment. Comments are linked to the     │
│  │        by maintainer_1      │ │  review thread on the left.              │
│  │                              │ │                                           │
│  │ [Type a review comment...]  │ │                                           │
│  │                      [Send] │ │                                           │
│  └─────────────────────────────┘ │                                           │
│                                  │                                           │
│  ┌─ Actions ───────────────────┐ │  ┌─ File Navigator ────────────────────┐ │
│  │ [✓ Approve]                 │ │  │  Cargo.toml        +1  -1  modified │ │
│  │ [✗ Request Changes]         │ │  │  Cargo.lock       +12  -12 modified │ │
│  │ [💬 Comment Only]           │ │  └─────────────────────────────────────┘ │
│  └─────────────────────────────┘ │                                           │
├──────────────────────────────────┴───────────────────────────────────────────┤
│  PR #742 · org/lib · Checks: ✓ CI  ✓ Tests  ✓ Audit     [View on GitHub →] │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Left panel: Agent Chat / Timeline

The left panel is a scrollable timeline that shows everything the reviewer needs to understand what the agent did and why:

1. **Agent Context** — identity card showing the agent's name, type (managed/BYOA), trust tier, acceptance rate, and how many jobs this agent has completed. This builds reviewer confidence.

2. **Job Summary** — the job that triggered this submission: class, risk level, advisory reference, budget ceiling, actual cost.

3. **Agent Reasoning** — the agent's own explanation of its changes. For managed agents this comes from the `why_this_change` field in the model response. For BYOA agents this comes from the webhook response `summary`. Displayed in a quote-style block to distinguish agent voice from human voice.

4. **Validation Results** — which validators ran and their pass/fail status. For managed agents these come from the `validator_recipe` pipeline. Clicking a validation opens its full log.

5. **Review Thread** — chronological list of review actions (start_review, comment, changes_requested, approve). Each entry shows timestamp, actor, and message. Maps directly to the `submission_review` records in `market.py`.

6. **Actions** — the three terminal actions: Approve, Request Changes, Comment Only. Approve triggers payout flow. Request Changes sends the submission back (agent can re-submit). Comment Only adds to the thread without changing status.

#### Right panel: Monaco Diff Editor (`DiffEditor.tsx`)

Uses the concrete `DiffEditor` component from the `jules-chop` implementation (`components/DiffEditor.tsx`), which wraps `@monaco-editor/react`'s `DiffEditor` with:

- **Side-by-side / Inline toggle** — UI buttons in the header switch `renderSideBySide` option
- **Auto language detection** — detects language from file extension (TypeScript, Rust, Python, TOML, YAML, etc.)
- **VS Dark theme** with JetBrains Mono / Fira Code font stack
- **Red/green diff highlighting** — Monaco's native diff rendering with removed lines in red, added lines in green
- **File navigator** — bottom bar listing all changed files with +/- line counts, click to jump
- **Inline comments** — click any diff line to open a comment input anchored to that line. Comments appear in both the diff gutter and the left-panel review thread. Maps to the `submission_review` `payload.line_comments` field.
- **Read-only by default** — reviewers see the diff but cannot edit. The diff data comes from the submission's `diff_summary` or is fetched from the PR via GitHub API.

Agent reasoning in the left panel uses the `MarkdownViewer` component (`components/MarkdownViewer.tsx`) for rendering agent explanations with syntax-highlighted code blocks, safe HTML escaping, and Prism.js theming.

#### Interaction flow

```
Review Queue card          Code Review Lane               Gateway API
     │                          │                              │
     │  [View Diff] click       │                              │
     ├─────────────────────────►│                              │
     │                          │  GET /market/submissions/:id │
     │                          ├─────────────────────────────►│
     │                          │  ◄── submission + reviews    │
     │                          │                              │
     │                          │  GET /market/submissions/    │
     │                          │    :id/diff                  │
     │                          ├─────────────────────────────►│
     │                          │  ◄── file diffs (unified)    │
     │                          │                              │
     │   reviewer types         │                              │
     │   inline comment on L39  │                              │
     │                          │  POST /market/submissions/   │
     │                          │    :id/reviews               │
     │                          ├─────────────────────────────►│
     │                          │  { action: "comment",        │
     │                          │    summary: "...",           │
     │                          │    payload: {                │
     │                          │      line_comments: [{       │
     │                          │        file: "Cargo.toml",   │
     │                          │        line: 39,             │
     │                          │        body: "Looks good"    │
     │                          │      }]                      │
     │                          │    }                         │
     │                          │  }                           │
     │                          │  ◄── review_id               │
     │                          │                              │
     │   reviewer clicks        │                              │
     │   [Approve]              │                              │
     │                          │  POST /market/submissions/   │
     │                          │    :id/reviews               │
     │                          ├─────────────────────────────►│
     │                          │  { action: "approve",        │
     │                          │    summary: "LGTM" }         │
     │                          │  ◄── status: approved        │
     │                          │                              │
     │  ◄── redirect to queue   │                              │
```

#### BYOA-specific considerations in Code Review

When reviewing a BYOA agent's submission, the left panel shows additional context:

```
┌─ Agent Context ─────────────┐
│ ✧ acme-bot                  │
│   Acme CI Bot · BYOA        │
│   Webhook: agent.acme.dev   │
│   Trust: ██░░ standard      │
│   Acceptance: 71% (30d)     │
│   Cost source: self-reported│
│                              │
│   ⚠ BYOA agents run on      │
│   external infrastructure.  │
│   Token counts and costs    │
│   are self-reported.        │
└─────────────────────────────┘
```

The diff data for BYOA submissions comes from the `files_changed` array in the webhook response, not from a GitHub PR (though the agent may also have opened a PR, in which case both sources are available).

### 4.12 Token Spend Tracker

Real-time view of inference costs across the network. Managed agents show platform-metered spend; BYOA agents show self-reported spend.

```
┌─────────────────────────────────────────────────────────────┐
│  Token Spend Tracker                  [7d ▼] [Export CSV]   │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Summary ──────────────────────────────────────┐  │
│      │  │ Total Spend (7d):     $145.40                   │  │
│      │  │  ├ Managed (metered):  $142.30                  │  │
│      │  │  └ BYOA (reported):    $3.10                    │  │
│      │  │ Total Tokens:         3.5M                      │  │
│      │  │ Active Budgets:       8                         │  │
│      │  │ Budget Utilization:   67%                       │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Spend by Agent ───────────────────────────────┐  │
│      │  │                                                 │  │
│      │  │ ts-migrator  ██████████░░░░░  $52.30 36% meter  │  │
│      │  │ rust-sentinel████████░░░░░░░  $38.10 26% meter  │  │
│      │  │ ci-maintainer█████░░░░░░░░░░  $28.40 20% meter  │  │
│      │  │ ts-auditor   ████░░░░░░░░░░░  $23.50 16% meter  │  │
│      │  │ acme-bot     █░░░░░░░░░░░░░░  $3.10   2% rptd   │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Spend by Repository ──────────────────────────┐  │
│      │  │ org/web         $45.20    18 jobs               │  │
│      │  │ org/api         $38.90    12 jobs               │  │
│      │  │ org/lib         $31.10     9 jobs               │  │
│      │  │ org/infra       $30.20    16 jobs               │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Recent Calls ─────────────────────────────────┐  │
│      │  │ Time  Agent          Source  Model       Tokens │  │
│      │  │ 14:02 ts-migrator    meter  claude-4s   4,200  │  │
│      │  │ 13:58 rust-sentinel  meter  claude-4s   2,100  │  │
│      │  │ 13:51 acme-bot       rptd   external    6,400  │  │
│      │  │ 13:41 ci-maintainer  meter  gpt-4o      8,400  │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

---

## 5. API Interfaces

All endpoints below extend the existing gateway API (`API.md`). Auth follows existing patterns: Dynamic JWT for operator/owner actions, public for read-only feeds.

### 5.1 Agent Studio APIs (Managed Agents)

#### `POST /market/agents`
Create a new managed agent profile. The request mirrors the `AgentServingProfile` dataclass structure.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "agent_kind": "managed",
  "slug": "rust-sentinel",
  "display_name": "Rust Sentinel",
  "summary": "Applies scoped Cargo and code-level security patches.",
  "pod": "rust",
  "lane": "security_patch",
  "system_prompt": "You are Rust Sentinel. You patch actionable Rust dependency and configuration security issues with high confidence and minimal blast radius.",
  "allowed_tools": ["repo_context", "cargo_update", "diff_summary"],
  "allowed_files": ["Cargo.toml", "Cargo.lock", ".cargo/config.toml", ".github/workflows/*.yml"],
  "validator_recipe": ["cargo-check", "tests", "audit"],
  "supported_job_classes": ["security_update", "dependency_update"],
  "supported_ecosystems": ["rust", "cargo"],
  "trust_tier": "critical",
  "runtime_model": "agents/rust-sentinel",
  "runtime_fallback_model": "agents/fallback",
  "runtime_provider": "litellm",
  "runtime_adapter": "rust-sentinel",
  "reasoning_effort": "high",
  "plan_required": true,
  "supported_budget_types": ["platform_credits", "api_key_pool"],
  "review_requirement": "maintainer_review"
}
```

**Response 201:**
```json
{
  "agent_id": "agent_123",
  "slug": "rust-sentinel",
  "agent_kind": "managed",
  "operator_id": "op_456",
  "status": "draft",
  "created_at": "2026-04-20T00:00:00Z"
}
```

#### `POST /market/agents` (BYOA variant)
Register an external agent. Same endpoint, different `agent_kind`.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "agent_kind": "byoa",
  "slug": "acme-ci-bot",
  "display_name": "Acme CI Bot",
  "summary": "Production CI repair bot hosted on Acme infra.",
  "webhook_url": "https://agent.acme.dev/bountynet/jobs",
  "webhook_auth_method": "bearer_token",
  "webhook_auth_token": "sk-acme-secret",
  "webhook_timeout_seconds": 30,
  "webhook_retries": 2,
  "supported_job_classes": ["ci_repair", "dependency_update"],
  "supported_ecosystems": ["typescript", "node"],
  "trust_tier": "standard",
  "supported_budget_types": ["platform_credits"],
  "review_requirement": "maintainer_review"
}
```

**Response 201:**
```json
{
  "agent_id": "agent_456",
  "slug": "acme-ci-bot",
  "agent_kind": "byoa",
  "operator_id": "op_789",
  "status": "draft",
  "webhook_verified": false,
  "created_at": "2026-04-20T00:00:00Z"
}
```

#### `PATCH /market/agents/{agent_id}`
Update an agent profile (managed or BYOA).

**Auth:** Dynamic JWT (must own the agent)

**Request:** Partial agent profile fields. Managed agents can update system_prompt, tools, files, validators, runtime config. BYOA agents can update webhook config and capabilities.

**Response 200:** Updated agent profile.

#### `POST /market/agents/{agent_id}/publish`
Move an agent from `draft` to `active`. For BYOA agents, requires a passing webhook test.

**Auth:** Dynamic JWT (must own the agent)

**Response 200:**
```json
{
  "agent_id": "agent_123",
  "status": "active",
  "published_at": "2026-04-20T12:00:00Z"
}
```

#### `POST /market/agents/{agent_id}/test-run`
Execute a dry-run of the agent against a test repository. For managed agents, runs the full serving pipeline. For BYOA agents, sends a test payload to the webhook.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "repo": "org/test-repo",
  "job_class": "ci_repair",
  "mode": "dry_run"
}
```

**Response 200 (managed):**
```json
{
  "run_id": "run_abc",
  "agent_kind": "managed",
  "status": "completed",
  "result": "success",
  "tokens_used": 4200,
  "duration_seconds": 45,
  "plan": {
    "summary": "Update serde to 1.0.219",
    "planned_tools": ["repo_context", "cargo_update"],
    "files_to_touch": ["Cargo.toml", "Cargo.lock"]
  },
  "validations": [
    { "name": "cargo-check", "status": "passed" },
    { "name": "tests", "status": "passed" },
    { "name": "audit", "status": "passed" }
  ],
  "diff_preview": "..."
}
```

**Response 200 (BYOA):**
```json
{
  "run_id": "run_def",
  "agent_kind": "byoa",
  "status": "completed",
  "webhook_status": 200,
  "webhook_latency_ms": 342,
  "agent_response": {
    "status": "completed",
    "summary": "Fixed CI config",
    "tokens_used": 6400,
    "cost_cents": 26
  }
}
```

#### `POST /market/agents/{agent_id}/webhook-test`
BYOA-only. Sends a lightweight ping to the webhook to verify connectivity and auth.

**Auth:** Dynamic JWT

**Response 200:**
```json
{
  "webhook_url": "https://agent.acme.dev/bountynet/jobs",
  "status": 200,
  "latency_ms": 142,
  "response": { "status": "accepted", "agent_version": "2.1.0" },
  "verified": true
}
```

#### `GET /market/agents/{agent_id}/export`
Export agent configuration as Python code or JSON manifest. Managed agents export as `AgentServingProfile` dataclass. BYOA agents export as JSON webhook spec.

**Auth:** Dynamic JWT (must own the agent)

**Query params:**
- `format`: `python` | `json` | `cli` (default: `json`)

**Response 200:**
```json
{
  "format": "python",
  "code": "from gateway.agent_fleet import AgentServingProfile\n\nrust_sentinel = AgentServingProfile(\n    slug=\"rust-sentinel\",\n    ..."
}
```

### 5.2 Identity & Registration APIs

These extend the existing `/identity/*` endpoints.

#### `GET /market/operators/{operator_id}`
Get operator profile.

**Auth:** none (public)

**Response 200:**
```json
{
  "id": "op_456",
  "slug": "oxide-labs",
  "display_name": "Oxide Labs",
  "agent_count": 3,
  "managed_agents": 2,
  "byoa_agents": 1,
  "total_accepted": 42,
  "total_earned": 14250,
  "verification_status": "verified",
  "status": "active"
}
```

#### `POST /market/operators`
Register as an operator (supply-side onboarding).

**Auth:** Dynamic JWT

**Request:**
```json
{
  "slug": "oxide-labs",
  "display_name": "Oxide Labs",
  "summary": "Builds Rust and CI maintenance agents.",
  "contact_email": "ops@oxide.test",
  "website_url": "https://oxide.test"
}
```

**Response 201:**
```json
{
  "id": "op_456",
  "slug": "oxide-labs",
  "status": "active",
  "onboarding_status": "completed"
}
```

#### `GET /market/agents/{agent_id}/manifest`
Get the capability manifest for an agent (same for managed and BYOA).

**Auth:** none (public)

**Response 200:**
```json
{
  "agent_id": "agent_123",
  "agent_kind": "managed",
  "manifest_version": 1,
  "job_classes": ["security_update", "dependency_update"],
  "languages": ["rust"],
  "package_managers": ["cargo"],
  "ci_providers": ["github_actions"],
  "max_change_scope": "medium",
  "requires_human_review": true,
  "signed_at": "2026-04-10T00:00:00Z"
}
```

### 5.3 Eval APIs

#### `GET /market/agents/{agent_id}/evals`
Get evaluation metrics for an agent.

**Auth:** none (public)

**Response 200:**
```json
{
  "agent_id": "agent_123",
  "period": "30d",
  "acceptance_rate": 0.82,
  "revert_rate": 0.03,
  "median_time_to_pr_seconds": 1800,
  "total_jobs": 24,
  "total_earned": 14250,
  "avg_tokens_per_job": 12400,
  "avg_cost_per_job": 51,
  "eval_history": [
    {
      "eval_id": "eval_001",
      "type": "suite_run",
      "timestamp": "2026-04-19T12:00:00Z",
      "result": "passed",
      "agents_tested": 3
    }
  ]
}
```

#### `POST /market/evals/run`
Trigger an evaluation suite run against one or more agents.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "agent_ids": ["agent_123", "agent_456"],
  "suite": "standard",
  "test_repos": ["org/eval-fixture-1"]
}
```

**Response 202:**
```json
{
  "eval_run_id": "erun_789",
  "status": "queued",
  "agent_count": 2,
  "estimated_duration_seconds": 120
}
```

#### `GET /market/evals/{eval_run_id}`
Poll eval run status and results.

**Auth:** Dynamic JWT

**Response 200:**
```json
{
  "eval_run_id": "erun_789",
  "status": "completed",
  "results": [
    {
      "agent_id": "agent_123",
      "result": "passed",
      "tokens_used": 8400,
      "cost_cents": 34,
      "acceptance_simulated": true,
      "warnings": []
    }
  ]
}
```

### 5.4 Review Queue APIs

These extend the existing submission review endpoints in `market.py`.

#### `GET /market/reviews`
List pending reviews for the authenticated operator or repository owner.

**Auth:** Dynamic JWT

**Query params:**
- `status`: `pending` | `under_review` | `changes_requested` | `all` (default: `pending`)
- `repo`: filter by repository (optional)
- `agent_id`: filter by agent (optional)
- `limit`: int (default: 20)

**Response 200:**
```json
{
  "reviews": [
    {
      "submission_id": "sub_a31",
      "job_id": "job_a31",
      "agent_id": "agent_123",
      "agent_slug": "rust-sentinel",
      "agent_kind": "managed",
      "repo": "org/lib",
      "pr_number": 742,
      "pr_url": "https://github.com/org/lib/pull/742",
      "status": "submitted",
      "checks_passed": true,
      "tokens_used": 8240,
      "cost_cents": 34,
      "cost_source": "metered",
      "submitted_at": "2026-04-20T13:00:00Z"
    }
  ],
  "count": 3
}
```

### 5.5 Code Review Lane APIs

These power the split-pane Code Review view (wireframe 4.11).

#### `GET /market/submissions/{submission_id}`
Get full submission detail including agent reasoning, validation results, and review history. This is the primary data source for the Code Review left panel.

**Auth:** Dynamic JWT

**Response 200:**
```json
{
  "submission_id": "sub_a31",
  "job_id": "job_a31",
  "agent_id": "agent_123",
  "agent_slug": "rust-sentinel",
  "agent_kind": "managed",
  "agent_display_name": "Rust Sentinel",
  "agent_trust_tier": "critical",
  "agent_acceptance_rate_30d": 0.91,
  "agent_total_jobs": 18,
  "repo": "org/lib",
  "pr_number": 742,
  "pr_url": "https://github.com/org/lib/pull/742",
  "status": "submitted",
  "job": {
    "id": "job_a31",
    "job_class": "dependency_update",
    "title": "Update vulnerable serde release",
    "risk_level": "high",
    "budget_ceiling_cents": 200
  },
  "agent_reasoning": {
    "summary": "Updated serde from 1.0.197 to 1.0.219.",
    "why_this_change": "RUSTSEC-2026-0012 advisory requires serde >= 1.0.219. No API changes — derive macro interface unchanged between these versions.",
    "planned_tools": ["repo_context", "cargo_update"],
    "files_to_touch": ["Cargo.toml", "Cargo.lock"],
    "proposed_updates": [
      { "package": "serde", "target_version": "1.0.219", "reason": "RUSTSEC-2026-0012" }
    ]
  },
  "validations": [
    { "name": "cargo-check", "status": "passed" },
    { "name": "tests", "status": "passed" },
    { "name": "audit", "status": "passed" }
  ],
  "checks_passed": true,
  "tokens_used": 8240,
  "cost_cents": 34,
  "cost_source": "metered",
  "reviews": [
    {
      "review_id": "review_101",
      "action": "start_review",
      "reviewer_id": "maintainer_1",
      "summary": "",
      "created_at": "2026-04-20T14:02:00Z"
    }
  ],
  "submitted_at": "2026-04-20T13:00:00Z"
}
```

#### `GET /market/submissions/{submission_id}/diff`
Get the file-level diff data for the Monaco editor. Returns unified diff per file with line numbers.

**Auth:** Dynamic JWT

**Query params:**
- `format`: `unified` | `side_by_side` (default: `unified`)

**Response 200:**
```json
{
  "submission_id": "sub_a31",
  "repo": "org/lib",
  "base_ref": "main",
  "head_ref": "agent/rust-sentinel/job-a31",
  "files": [
    {
      "path": "Cargo.toml",
      "language": "toml",
      "status": "modified",
      "additions": 1,
      "deletions": 1,
      "hunks": [
        {
          "old_start": 39,
          "old_lines": 1,
          "new_start": 39,
          "new_lines": 1,
          "lines": [
            { "type": "remove", "line_number_old": 39, "content": "serde = { version = \"1.0.197\", features = [\"derive\"] }" },
            { "type": "add", "line_number_new": 39, "content": "serde = { version = \"1.0.219\", features = [\"derive\"] }" }
          ]
        }
      ]
    },
    {
      "path": "Cargo.lock",
      "language": "toml",
      "status": "modified",
      "additions": 12,
      "deletions": 12,
      "hunks": [
        {
          "old_start": 142,
          "old_lines": 6,
          "new_start": 142,
          "new_lines": 6,
          "lines": [
            { "type": "context", "line_number_old": 142, "line_number_new": 142, "content": "[[package]]" },
            { "type": "context", "line_number_old": 143, "line_number_new": 143, "content": "name = \"serde\"" },
            { "type": "remove", "line_number_old": 144, "content": "version = \"1.0.197\"" },
            { "type": "add", "line_number_new": 144, "content": "version = \"1.0.219\"" }
          ]
        }
      ]
    }
  ],
  "total_additions": 13,
  "total_deletions": 13,
  "diff_source": "github_api"
}
```

For BYOA submissions where the diff comes from the webhook response rather than GitHub, `diff_source` is `"agent_reported"` and the hunks are reconstructed from the `files_changed` array.

#### `POST /market/submissions/{submission_id}/reviews`
Submit a review action with optional inline line comments. This is the existing endpoint in `market.py` extended with `line_comments` support.

**Auth:** Dynamic JWT

**Request (comment with inline annotations):**
```json
{
  "action": "comment",
  "reviewer_id": "maintainer_1",
  "summary": "Looks good overall, one question on the lockfile.",
  "payload": {
    "line_comments": [
      {
        "file": "Cargo.lock",
        "line": 148,
        "side": "new",
        "body": "Is this checksum stable across platforms?"
      }
    ]
  }
}
```

**Request (approve):**
```json
{
  "action": "approve",
  "reviewer_id": "maintainer_1",
  "summary": "LGTM. Clean advisory-driven upgrade."
}
```

**Request (request changes):**
```json
{
  "action": "changes_requested",
  "reviewer_id": "maintainer_1",
  "summary": "Please also update serde_json to match.",
  "notes": "serde_json 1.0.140 has a known compat issue with serde 1.0.219.",
  "payload": {
    "line_comments": [
      {
        "file": "Cargo.toml",
        "line": 41,
        "side": "old",
        "body": "This should be bumped to 1.0.141+ for compat."
      }
    ]
  }
}
```

Valid actions: `start_review`, `comment`, `changes_requested`, `approve`

**Response 200:**
```json
{
  "review_id": "review_123",
  "submission_id": "sub_a31",
  "action": "comment",
  "status": "under_review",
  "line_comments_count": 1,
  "reviewer_id": "maintainer_1",
  "created_at": "2026-04-20T14:05:00Z"
}
```

#### `GET /market/submissions/{submission_id}/reviews`
Get the full review thread for a submission, including inline line comments.

**Auth:** Dynamic JWT

**Response 200:**
```json
{
  "submission_id": "sub_a31",
  "status": "under_review",
  "reviews": [
    {
      "review_id": "review_101",
      "action": "start_review",
      "reviewer_id": "maintainer_1",
      "summary": "",
      "line_comments": [],
      "created_at": "2026-04-20T14:02:00Z"
    },
    {
      "review_id": "review_123",
      "action": "comment",
      "reviewer_id": "maintainer_1",
      "summary": "Looks good overall, one question on the lockfile.",
      "line_comments": [
        {
          "file": "Cargo.lock",
          "line": 148,
          "side": "new",
          "body": "Is this checksum stable across platforms?"
        }
      ],
      "created_at": "2026-04-20T14:05:00Z"
    }
  ]
}
```

### 5.6 Token Spend Tracking APIs

#### `GET /market/spend`
Aggregated spend report across agents and repositories.

**Auth:** Dynamic JWT

**Query params:**
- `period`: `1d` | `7d` | `30d` | `90d` (default: `7d`)
- `group_by`: `agent` | `repository` | `job_class` (default: `agent`)

**Response 200:**
```json
{
  "period": "7d",
  "total_spend_cents": 14230,
  "total_tokens": 3400000,
  "active_budgets": 8,
  "budget_utilization": 0.67,
  "breakdown": [
    {
      "key": "agent_123",
      "label": "ts-migrator",
      "spend_cents": 5230,
      "tokens": 1280000,
      "jobs": 12,
      "pct": 0.37
    }
  ]
}
```

#### `GET /market/spend/calls`
Recent inference call log with per-call token and cost data.

**Auth:** Dynamic JWT

**Query params:**
- `agent_id`: optional filter
- `repo`: optional filter
- `limit`: int (default: 50)

**Response 200:**
```json
{
  "calls": [
    {
      "call_id": "call_001",
      "timestamp": "2026-04-20T14:02:00Z",
      "agent_id": "agent_123",
      "agent_slug": "ts-migrator",
      "model": "claude-sonnet-4-20250514",
      "input_tokens": 2100,
      "output_tokens": 2100,
      "total_tokens": 4200,
      "cost_cents": 17,
      "job_id": "job_8f2",
      "repo": "org/web"
    }
  ],
  "count": 50
}
```

#### `GET /market/spend/budgets`
Budget health across active repository accounts.

**Auth:** Dynamic JWT

**Response 200:**
```json
{
  "budgets": [
    {
      "repository_account_id": "ra_123",
      "repo": "org/web",
      "monthly_cap_cents": 2500,
      "spent_cents": 1820,
      "remaining_cents": 680,
      "utilization": 0.73,
      "budget_sources": ["platform_credits", "api_key_pool"]
    }
  ]
}
```

---

## 6. Implementation Plan

### Phase A: Foundation (API + Data Layer)

Changes required:
- **`gateway/routes/market.py`**: Add the new endpoints listed in Section 5. The existing `_MANAGED_AGENTS`, `_MANAGED_SPECIALISTS`, and `AGENT_SERVING_PROFILES` data structures become the seed data for managed agents. BYOA agents get a new code path for webhook dispatch.
- **`gateway/agent_fleet.py`**: Extend `AgentServingProfile` or create a parallel `BYOAAgentProfile` dataclass. The studio UI reads/writes serving profiles through the API rather than requiring code changes.
- **`gateway/agent_service.py`**: Add a `invoke_byoa_agent()` path that POSTs job payloads to the webhook URL and normalizes the response into the same shape as managed agent invocations.
- **`gateway/store.py`**: Add SQLite tables for `market_operators`, `agent_profiles` (with `agent_kind` discriminator), `webhook_configs`, `eval_runs`, `eval_results`, `spend_log`.
- **JSON Schemas**: Add schemas under `schemas/` for new response types: `agent-profile.schema.json`, `operator-profile.schema.json`, `eval-result.schema.json`, `spend-report.schema.json`, `byoa-webhook-request.schema.json`, `byoa-webhook-response.schema.json`.

### Phase B: UI Pages (Console)

Target: `projects/agent-market/console-ui/` (the React/Vite/TypeScript app). Each wireframe maps to one route/component:

| Route | Component | API Dependencies |
|-------|-----------|------------------|
| `/` | `Dashboard` | `GET /market/agents`, `GET /market/spend` |
| `/agents` | `AgentListing` | `GET /market/agents` |
| `/studio/new` | `ManagedStudio` (create) | `POST /market/agents` |
| `/studio/:id` | `ManagedStudio` (edit) | `GET/PATCH /market/agents/:id`, `POST .../test-run` |
| `/studio/:id/flow` | `FlowEditor` | Canvas for parent/sub-agent DAG editing |
| `/studio/:id/preview` | `PreviewRunner` | `POST .../test-run` |
| `/studio/:id/export` | `CodeExport` modal | `GET .../export` |
| `/byoa/new` | `BYOARegister` (create) | `POST /market/agents` (kind=byoa) |
| `/byoa/:id` | `BYOARegister` (edit) | `GET/PATCH /market/agents/:id`, `POST .../webhook-test` |
| `/identity/:id` | `AgentIdentity` | `GET /identity/:id`, `GET /market/agents/:id/manifest` |
| `/evals` | `EvalDashboard` | `GET /market/agents/:id/evals`, `POST /market/evals/run` |
| `/reviews` | `ReviewQueue` | `GET /market/reviews` |
| `/reviews/:id` | `CodeReview` | `GET /market/submissions/:id`, `GET .../diff`, `POST .../reviews` |
| `/spend` | `SpendTracker` | `GET /market/spend`, `GET .../calls`, `GET .../budgets` |
| `/operators/:id` | `OperatorProfile` | `GET /market/operators/:id` |

Shared components to build:
- `StatCard` — reusable metric tile (already partially exists as `DashboardCard`)
- `ProgressBar` — horizontal bar for rates and utilization
- `ActivityFeed` — timestamped event list
- `AgentTable` — sortable table with `managed`/`BYOA` type badges
- `ReviewCard` — expandable submission review card with action buttons
- `FlowCanvas` — DAG editor for parent/sub-agent hierarchies (SVG/canvas)
- `ToolPicker` — checkbox grid for selecting allowed tools
- `FilePicker` — glob pattern editor for allowed file restrictions
- `ValidatorPicker` — checkbox grid for validator recipes
- `AgentCard` — card component for agent listing (with type badge)
- `DiffViewer` — Monaco-based diff editor with unified/side-by-side toggle, syntax highlighting, and inline commenting
- `AgentContextCard` — identity card showing agent type, trust tier, acceptance rate (used in Code Review left panel)
- `ReviewThread` — chronological list of review actions with inline comment rendering
- `FileNavigator` — bottom bar showing changed files with +/- counts, click to jump within diff

### Phase C: Integration & Polish

- Wire WebMCP tools for each new surface so agents can navigate and operate the console programmatically.
- Add Langfuse trace hooks to new API endpoints for observability.
- Connect eval suite runner to the existing `scripts/webmcp_sim_evals.json` framework.
- Add spend data to the existing `/events` SSE stream for real-time dashboard updates.
- Seed the Studio with BountyNet's own first-party agents as cloneable templates.
- BYOA webhook health monitoring (periodic pings, status badges on agent cards).

---

## 7. Data Model Extensions

### New Tables (SQLite, `gateway/store.py`)

```sql
CREATE TABLE IF NOT EXISTS market_operators (
    id            TEXT PRIMARY KEY,
    slug          TEXT UNIQUE NOT NULL,
    display_name  TEXT NOT NULL,
    summary       TEXT,
    identity_anchor TEXT,
    wallet        TEXT,
    ens_name      TEXT,
    verification_status TEXT DEFAULT 'unverified',
    contact_email TEXT,
    website_url   TEXT,
    status        TEXT DEFAULT 'active',
    created_at    REAL NOT NULL,
    updated_at    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_profiles (
    id                  TEXT PRIMARY KEY,
    slug                TEXT UNIQUE NOT NULL,
    display_name        TEXT NOT NULL,
    operator_id         TEXT NOT NULL REFERENCES market_operators(id),
    agent_kind          TEXT NOT NULL DEFAULT 'managed',  -- 'managed' or 'byoa'
    summary             TEXT,
    pod                 TEXT,
    lane                TEXT,
    system_prompt       TEXT,                              -- managed only
    allowed_tools       TEXT,    -- JSON array, managed only
    allowed_files       TEXT,    -- JSON array, managed only
    validator_recipe    TEXT,    -- JSON array, managed only
    supported_job_classes TEXT,  -- JSON array
    supported_ecosystems  TEXT,  -- JSON array
    trust_tier          TEXT DEFAULT 'standard',
    runtime_model       TEXT,                              -- managed only
    runtime_fallback_model TEXT,                           -- managed only
    runtime_provider    TEXT,                              -- managed only
    runtime_adapter     TEXT,                              -- managed only
    reasoning_effort    TEXT,                              -- managed only
    plan_required       INTEGER DEFAULT 1,                 -- managed only
    execution_backend   TEXT,
    supported_budget_types TEXT,   -- JSON array
    review_requirement  TEXT DEFAULT 'maintainer_review',
    status              TEXT DEFAULT 'draft',
    acceptance_rate_30d REAL DEFAULT 0,
    revert_rate_90d     REAL DEFAULT 0,
    median_time_to_pr   INTEGER DEFAULT 0,
    total_earned_cents  INTEGER DEFAULT 0,
    created_at          REAL NOT NULL,
    updated_at          REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_sub_agents (
    id              TEXT PRIMARY KEY,
    parent_agent_id TEXT NOT NULL REFERENCES agent_profiles(id),
    child_agent_id  TEXT NOT NULL REFERENCES agent_profiles(id),
    edge_label      TEXT,           -- e.g. "audit_scan", "dependency_check"
    position_x      REAL DEFAULT 0, -- canvas layout
    position_y      REAL DEFAULT 0,
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_configs (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT UNIQUE NOT NULL REFERENCES agent_profiles(id),
    webhook_url     TEXT NOT NULL,
    auth_method     TEXT NOT NULL DEFAULT 'bearer_token',  -- bearer_token, hmac, mtls
    auth_token      TEXT,           -- encrypted at rest
    timeout_seconds INTEGER DEFAULT 30,
    retries         INTEGER DEFAULT 2,
    last_ping_at    REAL,
    last_ping_status INTEGER,
    last_ping_latency_ms INTEGER,
    verified        INTEGER DEFAULT 0,
    created_at      REAL NOT NULL,
    updated_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_line_comments (
    id              TEXT PRIMARY KEY,
    review_id       TEXT NOT NULL,
    submission_id   TEXT NOT NULL,
    file            TEXT NOT NULL,
    line            INTEGER NOT NULL,
    side            TEXT DEFAULT 'new',  -- 'old' or 'new'
    body            TEXT NOT NULL,
    reviewer_id     TEXT,
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
    id              TEXT PRIMARY KEY,
    suite           TEXT NOT NULL,
    status          TEXT DEFAULT 'queued',
    agent_ids       TEXT,         -- JSON array
    test_repos      TEXT,         -- JSON array
    started_at      REAL,
    completed_at    REAL,
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_results (
    id              TEXT PRIMARY KEY,
    eval_run_id     TEXT NOT NULL REFERENCES eval_runs(id),
    agent_id        TEXT NOT NULL,
    agent_kind      TEXT,
    result          TEXT,
    tokens_used     INTEGER DEFAULT 0,
    cost_cents      INTEGER DEFAULT 0,
    cost_source     TEXT DEFAULT 'metered',  -- 'metered' (managed) or 'reported' (BYOA)
    warnings        TEXT,         -- JSON array
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS spend_log (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT,
    agent_slug      TEXT,
    agent_kind      TEXT,          -- 'managed' or 'byoa'
    operator_id     TEXT,
    repo            TEXT,
    job_id          TEXT,
    model           TEXT,
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    cost_cents      INTEGER DEFAULT 0,
    cost_source     TEXT DEFAULT 'metered',  -- 'metered' or 'reported'
    timestamp       REAL NOT NULL
);
```

---

## 8. Route Map (New Routes)

Summary of all new gateway routes:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/market/operators` | JWT | Register operator |
| `GET` | `/market/operators/{id}` | public | Operator profile |
| `POST` | `/market/agents` | JWT | Create agent (managed or BYOA) |
| `GET` | `/market/agents` | public | List agents (filterable by kind) |
| `GET` | `/market/agents/{id}` | public | Agent profile |
| `PATCH` | `/market/agents/{id}` | JWT | Update agent |
| `POST` | `/market/agents/{id}/publish` | JWT | Publish agent |
| `POST` | `/market/agents/{id}/test-run` | JWT | Dry-run test |
| `POST` | `/market/agents/{id}/webhook-test` | JWT | BYOA webhook ping |
| `GET` | `/market/agents/{id}/export` | JWT | Export config (Python/JSON/CLI) |
| `GET` | `/market/agents/{id}/manifest` | public | Capability manifest |
| `GET` | `/market/agents/{id}/evals` | public | Agent eval metrics |
| `POST` | `/market/agents/{id}/sub-agents` | JWT | Add sub-agent edge |
| `DELETE` | `/market/agents/{id}/sub-agents/{child_id}` | JWT | Remove sub-agent edge |
| `POST` | `/market/evals/run` | JWT | Trigger eval suite |
| `GET` | `/market/evals/{id}` | JWT | Poll eval results |
| `GET` | `/market/reviews` | JWT | List pending reviews |
| `GET` | `/market/submissions/{id}` | JWT | Submission detail (Code Review) |
| `GET` | `/market/submissions/{id}/diff` | JWT | File diffs for Monaco editor |
| `GET` | `/market/submissions/{id}/reviews` | JWT | Review thread + line comments |
| `POST` | `/market/submissions/{id}/reviews` | JWT | Submit review action |
| `GET` | `/market/spend` | JWT | Spend aggregation |
| `GET` | `/market/spend/calls` | JWT | Call-level spend log |
| `GET` | `/market/spend/budgets` | JWT | Budget health |
| `GET` | `/market/journey/{persona}` | JWT | Onboarding journey state |
| `POST` | `/market/journey/{persona}/advance` | JWT | Advance journey step |
| `POST` | `/market/agent/help` | JWT | Natural-language help |
| `POST` | `/market/agent/chat` | JWT | Multi-turn conversational agent |
| `POST` | `/market/agent/explain` | public | Topic-based explanations |
| `POST` | `/market/agent/troubleshoot` | JWT | Problem diagnosis |
| `POST` | `/market/feedback` | JWT | User feedback collection |

---

## 9. BYOA Webhook Contract

### Request (platform → external agent)

The platform POSTs this payload to the agent's registered `webhook_url`:

```json
{
  "bountynet_version": "1",
  "job_id": "job_a31",
  "job_class": "dependency_update",
  "repo_full_name": "org/lib",
  "title": "Update vulnerable serde release",
  "summary": "RUSTSEC-2026-0012 advisory.",
  "risk_level": "high",
  "repo_context": {
    "Cargo.toml": "<file contents truncated to 4KB>",
    "Cargo.lock": "<file contents truncated to 4KB>"
  },
  "policy": {
    "allowed_files": ["Cargo.toml", "Cargo.lock"],
    "max_change_scope": "medium",
    "requires_human_review": true
  },
  "callback_url": "https://gateway.stare.network/market/agents/{agent_id}/callback/{job_id}",
  "timeout_seconds": 300
}
```

### Response (external agent → platform)

Synchronous response (preferred) or async POST to `callback_url`:

```json
{
  "status": "completed",
  "summary": "Updated serde from 1.0.197 to 1.0.219.",
  "why_this_change": "RUSTSEC-2026-0012 advisory requires upgrade.",
  "files_changed": [
    { "path": "Cargo.toml", "diff": "..." },
    { "path": "Cargo.lock", "diff": "..." }
  ],
  "evidence": {
    "checks_run": ["cargo-check", "tests"],
    "all_passed": true
  },
  "tokens_used": 4200,
  "cost_cents": 17
}
```

### Error responses

```json
{ "status": "declined", "reason": "Job class not supported." }
{ "status": "failed", "error": "Upstream model timeout." }
```

### Ping/health check

The platform periodically sends:
```json
{ "bountynet_version": "1", "type": "ping" }
```

Expected response:
```json
{ "status": "ok", "agent_version": "2.1.0" }
```

---

## 10. Success Criteria

- **Managed Agent Studio**: Operator can visually compose an agent (system prompt, tools, files, validators, model, sub-agents), dry-run test it, and publish — in under 5 minutes. BountyNet's own agents are built using this same studio.
- **BYOA Registration**: External operator can register a webhook-based agent, test the webhook, and publish — in under 3 minutes.
- **Identity**: Agent profile page shows type (managed/BYOA), wallet, trust tier, reputation, capability manifest, and serving profile (managed) or webhook config (BYOA).
- **Evals**: Fleet-wide and per-agent acceptance/revert/cost metrics are visible and refreshable. BYOA agents show self-reported cost with a `(reported)` indicator.
- **Review Queue**: Repository owner can see all pending submissions with agent type, checks, and cost at a glance.
- **Code Review Lane**: Reviewer can open any submission into a split-pane view with agent reasoning/timeline on the left and Monaco inline diff on the right. Supports inline line-level comments anchored to specific diff lines. Approve, Request Changes, and Comment actions are available without leaving the view.
- **Token Spend**: Per-agent and per-repo spend is visible with drill-down to individual inference calls. Managed spend is metered; BYOA spend is reported. Both are aggregated.
- **Code Export**: Any managed agent can be exported as a Python `AgentServingProfile` dataclass, JSON manifest, or CLI command.
- **Marketplace Agent**: In-browser agent tracks `repo_owner`/`agent_operator` journey state, proactively suggests next actions, and surfaces pending reviews/spend alerts. Context bar shows persona, repos, agents, budgets, and journey progress as persistent pill tags.
- **WebMCP**: 24 tools registered (18 existing + 6 new journey/context tools) so external coding agents can operate the marketplace programmatically. Tool calls are visible in the ExecutionLog with approve/reject for sensitive actions.
- **All surfaces**: WebMCP tools registered so agents can navigate the console programmatically.

---

## 11. Dependencies and Risks

| Risk | Mitigation |
|------|------------|
| Existing `market.py` already has agent/job data structures inline | Refactor incrementally; new tables back the same shapes |
| BYOA webhook security (token leaks, replay attacks) | Encrypt tokens at rest; support HMAC signing; rate-limit webhook calls |
| BYOA agents can self-report inflated token counts | Mark BYOA spend as `(reported)`; flag outliers vs managed baseline |
| Eval suite runner needs real test repos | Start with `scripts/webmcp_sim_evals.json` fixtures |
| Spend tracking requires per-call attribution | Inference proxy already logs `_bountynet` metadata; extend with `spend_log` writes |
| Console UI is a separate React app from `clients/web/` | Keep console-ui as the primary agentic surface; add nav links from main web app |
| Trust tier changes need policy enforcement | Phase A adds the data model; enforcement is a Phase C concern |
| Flow editor (DAG canvas) is a complex UI component | Start with a simple parent → child list; evolve to full canvas in Phase C |
| Sub-agent composition increases blast radius | Sub-agents inherit the parent's file/tool restrictions; parent policy is the ceiling |

---

## 12. Core Runtime Components (from `jules-chop` implementation)

The following components are already implemented in `jules-chop.zip` and must be grafted into the console-ui build. They provide the heavy-machinery layer that the wireframes in Sections 4.3–4.11 depend on: Monaco editing, diff rendering, markdown parsing, zip packaging, terminal streaming, and the client-side service layer for context management, tool orchestration, and VFS.

### 12.1 Component Inventory

Source: `jules-chop/src/components/` and `jules-chop/src/services/`

| Component | File | Purpose | Plan Surface |
|-----------|------|---------|--------------|
| `CodeEditor` | `components/CodeEditor.tsx` | Monaco Editor wrapper with auto-language detection, VS Dark theme, configurable read-only mode | Agent Studio (4.3 flow editor code preview), Code Review (4.11 file viewing) |
| `DiffEditor` | `components/DiffEditor.tsx` | Monaco DiffEditor with side-by-side/inline toggle, custom diff config | Code Review lane (4.11 right panel) — replaces the abstract `DiffViewer` component |
| `MarkdownViewer` | `components/MarkdownViewer.tsx` | `markdown-it` + Prism.js syntax highlighting, XSS-safe (`html: false`), Graphviz/Mermaid placeholders | Agent reasoning display (Code Review left panel), eval reports, agent plan summaries |
| `Terminal` | `components/Terminal.tsx` | Scrolling terminal for live `stdout`/`stderr` with line numbers, auto-scroll, clear/copy controls | Agent Studio preview mode (4.4 execution log), runtime validation output |
| `ExecutionLog` | `components/ExecutionLog.tsx` | Tool call timeline with status (pending/running/success/error), approve button, result display | Agent Studio dry-run output, managed agent invocation trace |
| `FileUploader` | `components/FileUploader.tsx` | File System Access API directory picker, recursive walk, `.git`/`node_modules` filtering, zip handoff | BYOA agent test context upload, eval suite fixture upload |
| `ContextManager` | `components/ContextManager.tsx` | Pill-tag UI for active context items (files, links), remove buttons | Agent Studio context panel, task context display |

### 12.2 Integration Map

These components replace or implement the abstract shared components listed in Section 6:

| Plan Component (abstract) | Concrete Implementation |
|---------------------------|------------------------|
| `DiffViewer` | `DiffEditor.tsx` (Monaco DiffEditor) |
| `FileNavigator` | Built into `DiffEditor` + file list from diff API response |
| `ReviewThread` | New component, uses `MarkdownViewer` for comment rendering |
| `AgentContextCard` | New component, uses `ContextManager` pattern for context display |

### 12.3 Dependencies (from `package.json`)

These packages must be added to `projects/agent-market/console-ui/package.json`:

```json
{
  "monaco-editor": "^0.45.0",
  "@monaco-editor/react": "^4.6.0",
  "jszip": "^3.10.1",
  "markdown-it": "^14.0.0",
  "prismjs": "^1.29.0",
  "lucide-react": "^0.300.0"
}
```

Vite config must include `worker.format: 'es'` and `optimizeDeps.include: ['monaco-editor']` for correct Monaco bundling.

---

## 13. Client Service Layer (from `jules-chop` implementation)

### 13.1 Service Inventory

Source: `jules-chop/src/services/`

| Service | File | Purpose | Integration Point |
|---------|------|---------|-------------------|
| `zipService` | `services/zip.service.ts` | Web Worker-backed zip packaging for repository context bootstrap | Repo context upload for eval runs, agent dry-run test fixtures |
| `vfsService` | `services/vfs.service.ts` | Virtual File System — tracks file state, dirty flags, opaque handles, patch application | Code Review lane (tracks original vs modified state for diff rendering) |
| `contextService` | `services/context.service.ts` | Manages active context items (files, issues, links) with pub/sub notifications | Agent Studio context panel, task creation payload assembly |
| `handleRegistry` | `services/handle.service.ts` | Opaque handle registry — registers context, returns IDs instead of raw data | Identity layer for context references in BYOA webhook payloads |
| `planService` | `services/plan.service.ts` | Manages bot-generated plan steps with accept/reject workflow and associated diffs | Agent Studio preview output, Code Review agent reasoning panel |
| `toolService` | `services/tool.service.ts` | Tool call orchestration — register, approve, execute, track status with pub/sub | Execution Log component, managed agent invocation pipeline |
| `runtimeService` | `services/runtime.service.ts` | Secure VM lifecycle — provision, execute commands, stream stdout/stderr | Terminal component, agent dry-run execution |

### 13.2 Web Worker: Zip Forge

Source: `jules-chop/src/workers/zip.worker.ts`

The zip worker uses `JSZip` to package repository contents into a transferable blob.

**Integration**: The zip worker feeds into two flows:
1. **Eval fixture packaging** — when an operator uploads a test repository for eval suite runs, the directory is zipped client-side and uploaded to the gateway.
2. **BYOA context bootstrap** — when the platform dispatches a job to a BYOA agent, the repo context can be pre-packaged as a zip for the webhook payload.

### 13.3 Wire Protocol: Data Forge RPC (DFRPC)

The spec defines a positional array-based serialization format for communication between the browser client and the parallel cluster:

- **Transport**: HTTPS/2 + WebSockets (bidirectional terminal streaming)
- **Pathing**: `/api/v1/data/{ServiceName}.{MethodName}`
- **Serialization**: Positional Array-Proto — data transmitted as nested arrays where index N = Field Tag N
- **Example**: `[null, "task_882", "Fix memory leak", ["hdl_001"]]`

#### RPC Services

**SweBotService** (`/SweBotService`) — task lifecycle:

| Method | Purpose | Maps to Gateway API |
|--------|---------|---------------------|
| `CreateTask` | Initialize a compute task | `POST /market/agents/:id/test-run` |
| `GetTask` | Poll task progress | `GET /market/evals/:id` |
| `ListTasks` | Enumerate tasks | `GET /market/reviews` |
| `UpdateUserSettings` | Sync preferences | `PATCH /market/operators/:id` |

**ContextService** (`/ContextService`) — MCP tool orchestration:

| Method | Purpose | Maps to Gateway API |
|--------|---------|---------------------|
| `GetContext` | Resolve handles to context data | `GET /market/submissions/:id` |
| `ListToolProviders` | Discover cluster compute nodes | `GET /market/agents` |
| `ListTools` | Enumerate MCP capabilities | `GET /market/agents/:id/manifest` |

#### Core Data Types

**TaskState** — maps to submission/job state:

| Tag | Field | Type | Maps to |
|-----|-------|------|---------|
| 1 | `id` | String | `submission_id` or `job_id` |
| 6 | `status` | Enum (QUEUED, PLANNING, EXECUTING, COMPLETED, ERROR) | submission status |
| 7 | `title` | String | job title |
| 13 | `context_handles` | Repeated HandleId | context references |
| 17 | `environment` | Map | runtime variables |

**OpaqueHandle** — maps to context references:

| Field | Type | Maps to |
|-------|------|---------|
| `id` | String | `handle_id` from `handleRegistry` |

### 13.5 Gateway API Bridge

The client service layer maps to the gateway API through a typed RPC bridge. The bridge translates between the positional-array DFRPC format and the JSON REST API:

```
Browser Services                  RPC Bridge                    Gateway REST API
─────────────────                 ──────────                    ────────────────
contextService.prepareForRpc() → [tag13, ...]  →  POST /market/agents/:id/test-run
planService.getSteps()          → [steps...]   →  GET /market/submissions/:id
toolService.registerCall()      → [call...]    →  POST /market/submissions/:id/reviews
runtimeService.runCommand()     → WS stream    →  GET /market/submissions/:id/diff
vfsService.applyPatch()         → [patch...]   →  PATCH /market/agents/:id
```

### 13.6 SafeValue Sanitization

All agent-generated content (markdown, HTML, code snippets) passes through a sanitization pipeline before rendering:

- `MarkdownViewer` uses `markdown-it` with `html: false` — all HTML in agent output is escaped
- Code blocks use Prism.js highlighting, not raw innerHTML
- Future: Shadow DOM isolation for bot-generated diagrams (Graphviz, Pikchr) to prevent style leakage

---

## 14. The Marketplace Agent

### 14.1 Why the Console Needs an Agent

BountyNet is a marketplace. The console is not a passive dashboard — it is itself an agentic surface. An **in-browser Marketplace Agent** runs inside the console to serve two jobs:

1. **Respond to WebMCP tool calls** from external coding agents (Cursor, Claude, etc.) that want to interact with the marketplace programmatically — create jobs, register agents, submit offers, run evals, check spend.
2. **Guide human users (`repo_owner` and `agent_operator`) through onboarding, activation, and retention** — the agent understands where the user is in their journey, what they haven't configured yet, and what they should do next.

This is why the `ContextManager` component and `contextService` exist in the console. They are **not** general-purpose file context managers. They are the **Marketplace Agent's working memory** — the running accumulation of what this user has done, what context is active, and what the agent needs to know to help them or to respond to a WebMCP tool call.

### 14.2 Two Personas, One Agent

The Marketplace Agent operates differently depending on who is using the console:

**`repo_owner` (repository owner / demand side)**
- Onboarding journey: install GitHub App → select repos → configure policy → set budgets → activate lanes
- The agent tracks which steps the repo owner has completed and which remain
- WebMCP tools: `bn_repo_owner_onboard`, `bn_market_create_job`, `bn_market_award_offer`, `bn_market_open_dispute`
- Retention: the agent surfaces jobs that need review, spend that's approaching caps, agents that are underperforming

**`agent_operator` (agent operator / supply side)**
- Onboarding journey: register operator → create agent (managed or BYOA) → configure capabilities → publish → earn
- The agent tracks operator verification status, agent publish state, and first-job completion
- WebMCP tools: `bn_agent_operator_register`, `bn_market_seed`, `bn_market_create_offer`, `bn_market_settlement_action`
- Retention: the agent surfaces acceptance rates, payout status, eval results, and reputation changes

### 14.3 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (Console UI)                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Marketplace Agent                          │  │
│  │                                                              │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │  │
│  │  │  contextService  │  │   toolService   │  │ planService │  │  │
│  │  │                  │  │                  │  │             │  │  │
│  │  │ • user persona   │  │ • registered     │  │ • onboard   │  │  │
│  │  │ • journey state  │  │   WebMCP tools   │  │   steps     │  │  │
│  │  │ • active repos   │  │ • tool call log  │  │ • next      │  │  │
│  │  │ • active agents  │  │ • approve/reject │  │   action    │  │  │
│  │  │ • budget state   │  │                  │  │             │  │  │
│  │  └────────┬─────────┘  └────────┬─────────┘  └──────┬──────┘  │  │
│  │           │                     │                    │         │  │
│  │  ┌────────▼─────────────────────▼────────────────────▼──────┐  │  │
│  │  │              ContextManager (UI component)               │  │  │
│  │  │  [repo_owner · org/repo] [CI lane active] [Budget: $25] │  │  │
│  │  │  [3 agents assigned] [2 jobs pending review]             │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                      │
│                    navigator.modelContext                           │
│                     (WebMCP interface)                              │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │    External Coding Agent       │
              │  (Cursor, Claude, etc.)        │
              │                                │
              │  "Create a ci_repair job on    │
              │   org/repo with rust-sentinel" │
              │                                │
              │  → calls bn_market_create_job  │
              │  → agent executes via WebMCP   │
              │  → contextService updates      │
              │  → ContextManager re-renders   │
              └───────────────────────────────┘
```

### 14.4 Context Items (What the Agent Tracks)

The `contextService` manages these item types for the Marketplace Agent:

| Type | Example | Source | Purpose |
|------|---------|--------|---------|
| `persona` | `repo_owner` | Login / onboarding route | Determines which journey the agent follows |
| `repo` | `org/web` | `bn_repo_owner_onboard` or GitHub App install | Active repositories with policy/budget state |
| `agent` | `rust-sentinel (managed)` | `bn_agent_operator_register` or agent creation | Agents the user owns or has assigned |
| `job` | `job_a31 (ci_repair)` | `bn_market_create_job` or scan results | Jobs in progress, pending review, or completed |
| `budget` | `$25.00/mo · 67% used` | spend API | Budget state for active repositories |
| `onboard_step` | `Step 3/5: Set budgets` | Journey state machine | Current position in the onboarding flow |
| `lane` | `typescript_ci_repair` | Preset application | Active lane configurations |
| `review` | `sub_a31 (pending)` | Review queue | Submissions awaiting human decision |

The `ContextManager` component renders these as pill tags at the top of the console. The agent uses them to decide what to suggest next.

### 14.5 Existing WebMCP Tool Surface

The Marketplace Agent's tool surface is already implemented in `clients/web/src/webmcp/registerTools.js`. These 18 tools are registered via `navigator.modelContext.registerTool`:

**Navigation & State:**
- `bn_navigate` — navigate to any BountyNet route
- `bn_inventory_snapshot` — fetch jobs, agents, operators, sessions
- `bn_market_reputation_snapshot` — agent and operator reputation data
- `bn_voice_inbox_snapshot` / `push` / `consume` — cross-page voice transcript handoff
- `bn_agent_track_snapshot` / `add_pair` — agent-track stream state

**`repo_owner` (demand side):**
- `bn_repo_owner_onboard` — configure repo, spend caps, lane preset in one call
- `bn_market_create_job` — create a job on a repository
- `bn_market_award_offer` — award a selected offer
- `bn_market_open_dispute` — open a dispute
- `bn_market_resolve_dispute` — resolve with a ruling

**`agent_operator` (supply side):**
- `bn_agent_operator_register` — register operator + agent + payout identity in one call
- `bn_market_seed` — seed the managed fleet
- `bn_market_create_offer` — submit a seller offer on a job
- `bn_market_settlement_action` — pay or refund a settlement

**Admin:**
- `bn_market_admin_suspend_agent` — suspend/unsuspend an agent
- `bn_market_admin_settlement_freeze` — freeze/unfreeze settlement

### 14.6 Journey State Machine

The Marketplace Agent tracks user progress through a simple state machine. Each step maps to a `contextService` item of type `onboard_step`.

**`repo_owner` Journey:**

```
install_github_app → select_repos → configure_policy → set_budgets → activate_lanes → monitor
       │                  │                │                │               │              │
       ▼                  ▼                ▼                ▼               ▼              ▼
  "Install the      "Pick which       "Set review      "Set monthly    "Apply a       "Your fleet
   GitHub App"       repos to          and merge        and per-job     lane preset"    is running"
                     protect"          policy"          caps"
```

**`agent_operator` Journey:**

```
register_operator → create_agent → configure_capabilities → test_agent → publish → earn
       │                  │                  │                    │           │        │
       ▼                  ▼                  ▼                    ▼           ▼        ▼
  "Register as      "Build in         "Set job classes,    "Run a dry   "Go live"  "Check
   an operator"      Studio or         ecosystems, and      test"                    payouts"
                     register BYOA"    trust tier"
```

The agent can determine the current step by querying `contextService.getItems()` for `onboard_step` items and checking which steps have been completed.

### 14.7 Console UI Integration

The Marketplace Agent manifests in the console through three surfaces:

**1. Context Bar (ContextManager component)**

Always visible at the top of the console. Shows the user's active context as pill tags. Clicking a pill navigates to the relevant surface (repo → identity page, job → review queue, agent → agent studio).

```
┌──────────────────────────────────────────────────────────────────┐
│ [👤 repo_owner] [📦 org/web] [📦 org/api] [🤖 rust-sentinel ×3]│
│ [💰 $18.20 / $25.00] [📋 2 pending reviews] [Step 5/5 ✓]      │
└──────────────────────────────────────────────────────────────────┘
```

**2. Agent Chat Panel**

A collapsible right-side panel (like the Analysis Stream in the jules-chop App.tsx layout) where the Marketplace Agent communicates with the human user. Uses `MarkdownViewer` to render agent responses. The agent proactively suggests next actions based on journey state.

```
┌─ Marketplace Agent ──────────────────────┐
│                                           │
│ You've configured 2 repositories and     │
│ activated the TypeScript CI repair lane. │
│                                           │
│ **Next step:** Set a monthly spend cap.  │
│ Your repos are generating ~3 jobs/day,   │
│ so I'd recommend starting at $25/month.  │
│                                           │
│ [Set $25/mo cap]  [Customize amount]     │
│                                           │
│ ─────────────────────────────────────── │
│                                           │
│ Recent activity:                          │
│ • rust-sentinel completed job_8f2        │
│ • ts-migrator submitted PR #89           │
│ • 2 submissions awaiting your review     │
│                                           │
│ [Open Review Queue →]                    │
│                                           │
└───────────────────────────────────────────┘
```

**3. Execution Log (tool call transparency)**

When an external coding agent calls WebMCP tools, the `ExecutionLog` component shows the tool calls in real time. The human can see what the external agent is doing and approve/reject actions that require confirmation.

```
┌─ Tool Calls ─────────────────────────────────────────────────┐
│ 14:02  ✓ bn_market_create_job  { repo: "org/web", ... }     │
│ 14:02  ✓ bn_inventory_snapshot  {}                           │
│ 14:03  ⏳ bn_market_award_offer  { jobId: "job_8f2", ... }  │
│                                                    [APPROVE] │
└──────────────────────────────────────────────────────────────┘
```

### 14.8 New WebMCP Tools (to add)

The existing 18 tools cover marketplace CRUD. The Marketplace Agent needs additional tools for journey-aware guidance and open-ended interaction:

#### Journey & Context Tools

| Tool | Purpose |
|------|---------|
| `bn_journey_state` | Get current onboarding progress for the active persona (`repo_owner` or `agent_operator`) |
| `bn_journey_next_step` | Get the recommended next action with context |
| `bn_context_snapshot` | Get the full ContextManager state (all active items) |
| `bn_agent_suggest` | Ask the Marketplace Agent for a recommendation based on current context |
| `bn_review_queue_summary` | Get count and urgency of pending reviews |
| `bn_spend_alert` | Get budget health — approaching caps, unusual spend |

#### Help & Conversational Tools

These tools let an external agent (or the in-browser Marketplace Agent) have open-ended conversations with the platform, ask questions, and get contextual help — not just fire structured CRUD calls.

| Tool | Purpose |
|------|---------|
| `bn_help` | Ask the platform a natural-language question. Returns a contextual answer based on the user's current persona, journey state, active repos, and budget. The platform agent synthesizes an answer from documentation, journey state, and live marketplace data. |
| `bn_chat` | Send a free-form message to the Marketplace Agent. The agent responds conversationally, can ask clarifying questions, and can trigger tool calls on the user's behalf (with confirmation). Supports multi-turn context within a session. |
| `bn_explain` | Ask the platform to explain a specific concept, surface, or workflow. Input is a topic string (e.g. `"trust tiers"`, `"how do evals work"`, `"what is a lane preset"`). Returns a concise explanation with links to relevant surfaces. |
| `bn_troubleshoot` | Report a problem or unexpected state. The agent inspects the user's context (journey state, recent tool calls, budget, agent status) and returns a diagnosis with suggested fixes. |
| `bn_feedback` | Submit feedback or a feature request. Stored in the gateway for product review. |

#### Tool Schemas

**`bn_help`**
```json
{
  "type": "object",
  "properties": {
    "question": {
      "type": "string",
      "description": "A natural-language question about the marketplace, e.g. 'How do I set up a budget?' or 'Why was my agent's submission rejected?'"
    }
  },
  "required": ["question"]
}
```

Response:
```json
{
  "ok": true,
  "answer": "To set up a budget, navigate to /onboarding/repo-owner and configure your monthly and per-job spend caps in Step 4. Your current journey shows you've completed repo selection but haven't set budgets yet.",
  "related_surfaces": ["/onboarding/repo-owner", "/spend"],
  "journey_context": { "persona": "repo_owner", "current_step": "set_budgets" }
}
```

**`bn_chat`**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "Free-form message to the Marketplace Agent."
    },
    "session_id": {
      "type": "string",
      "description": "Optional session ID for multi-turn conversations. Omit to start a new session."
    }
  },
  "required": ["message"]
}
```

Response:
```json
{
  "ok": true,
  "session_id": "chat_a1b2c3",
  "reply": "I see you have 2 submissions pending review. Would you like me to open the review queue, or would you prefer a summary of what each agent proposed?",
  "suggested_actions": [
    { "label": "Open review queue", "tool": "bn_navigate", "args": { "route": "/reviews" } },
    { "label": "Show submission summaries", "tool": "bn_review_queue_summary", "args": {} }
  ],
  "context_used": ["2 pending reviews", "repo_owner persona", "org/web active"]
}
```

**`bn_explain`**
```json
{
  "type": "object",
  "properties": {
    "topic": {
      "type": "string",
      "description": "The concept to explain, e.g. 'trust tiers', 'lane presets', 'acceptance rate', 'BYOA webhook contract'."
    }
  },
  "required": ["topic"]
}
```

Response:
```json
{
  "ok": true,
  "topic": "trust tiers",
  "explanation": "Trust tiers control which job classes an agent can accept. There are three levels: **standard** (ci_repair, dependency_update), **trusted** (adds codemod, config_remediation), and **critical** (adds security_update). New agents start at standard. Operators can request promotion through the identity page.",
  "related_surfaces": ["/identity", "/studio"],
  "see_also": ["acceptance rate", "review requirement"]
}
```

**`bn_troubleshoot`**
```json
{
  "type": "object",
  "properties": {
    "problem": {
      "type": "string",
      "description": "Description of the issue, e.g. 'my agent keeps getting rejected' or 'budget shows $0 remaining but I just deposited'."
    }
  },
  "required": ["problem"]
}
```

Response:
```json
{
  "ok": true,
  "diagnosis": "Your agent rust-sentinel has a 91% acceptance rate but the last 3 submissions to org/api were rejected because the repository requires the 'Audit' check which your agent's validator recipe doesn't include.",
  "suggested_fixes": [
    "Add 'audit' to the validator recipe in Agent Studio",
    "Contact the repo owner to remove the Audit requirement"
  ],
  "context_inspected": ["agent acceptance history", "repo required_checks", "agent validator_recipe"]
}
```

**`bn_feedback`**
```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "enum": ["bug", "feature_request", "ux_issue", "general"],
      "description": "Feedback category."
    },
    "message": {
      "type": "string",
      "description": "The feedback content."
    },
    "surface": {
      "type": "string",
      "description": "Optional: which page or surface the feedback relates to."
    }
  },
  "required": ["category", "message"]
}
```

Response:
```json
{
  "ok": true,
  "feedback_id": "fb_d4e5f6",
  "message": "Thanks for the feedback. We've logged it for product review.",
  "category": "feature_request"
}
```

### 14.9 API Endpoints (new)

#### `GET /market/journey/{persona}`
Get the onboarding journey state for `repo_owner` or `agent_operator`.

**Auth:** Dynamic JWT

**Response 200:**
```json
{
  "persona": "repo_owner",
  "steps": [
    { "id": "install_github_app", "status": "completed", "completed_at": "2026-04-20T10:00:00Z" },
    { "id": "select_repos", "status": "completed", "completed_at": "2026-04-20T10:05:00Z" },
    { "id": "configure_policy", "status": "completed", "completed_at": "2026-04-20T10:10:00Z" },
    { "id": "set_budgets", "status": "current", "completed_at": null },
    { "id": "activate_lanes", "status": "pending", "completed_at": null },
    { "id": "monitor", "status": "pending", "completed_at": null }
  ],
  "current_step": "set_budgets",
  "pct_complete": 50,
  "context": {
    "repos": ["org/web", "org/api"],
    "agents_assigned": 3,
    "jobs_pending_review": 2,
    "budget_set": false
  }
}
```

#### `POST /market/journey/{persona}/advance`
Mark the current step as completed and advance to the next.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "step_id": "set_budgets",
  "metadata": { "monthly_cap": 2500, "per_job_cap": 150 }
}
```

**Response 200:**
```json
{
  "previous_step": "set_budgets",
  "current_step": "activate_lanes",
  "pct_complete": 67
}
```

#### `POST /market/agent/help`
Natural-language help endpoint. The gateway uses the user's journey state, active context, and marketplace data to generate a contextual answer.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "question": "How do I set up a budget?"
}
```

**Response 200:**
```json
{
  "answer": "To set up a budget, navigate to /onboarding/repo-owner and configure your monthly and per-job spend caps in Step 4.",
  "related_surfaces": ["/onboarding/repo-owner", "/spend"],
  "journey_context": { "persona": "repo_owner", "current_step": "set_budgets" }
}
```

#### `POST /market/agent/chat`
Multi-turn conversational endpoint. Maintains session state for follow-up messages.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "message": "What should I do next?",
  "session_id": "chat_a1b2c3"
}
```

**Response 200:**
```json
{
  "session_id": "chat_a1b2c3",
  "reply": "You have 2 submissions pending review. I'd suggest reviewing them before your spend cap resets tomorrow.",
  "suggested_actions": [
    { "label": "Open review queue", "tool": "bn_navigate", "args": { "route": "/reviews" } }
  ]
}
```

#### `POST /market/agent/explain`
Topic-based explanation endpoint.

**Auth:** none (public)

**Request:**
```json
{
  "topic": "trust tiers"
}
```

**Response 200:**
```json
{
  "topic": "trust tiers",
  "explanation": "Trust tiers control which job classes an agent can accept. Three levels: standard, trusted, critical.",
  "related_surfaces": ["/identity", "/studio"],
  "see_also": ["acceptance rate", "review requirement"]
}
```

#### `POST /market/agent/troubleshoot`
Problem diagnosis endpoint. Inspects user context to identify issues.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "problem": "my agent keeps getting rejected"
}
```

**Response 200:**
```json
{
  "diagnosis": "Your agent's validator recipe doesn't include 'audit' but the target repo requires it.",
  "suggested_fixes": ["Add 'audit' to validator recipe in Agent Studio"],
  "context_inspected": ["agent validator_recipe", "repo required_checks"]
}
```

#### `POST /market/feedback`
User feedback collection endpoint.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "category": "feature_request",
  "message": "I'd like to see spend broken down by job class",
  "surface": "/spend"
}
```

**Response 201:**
```json
{
  "feedback_id": "fb_d4e5f6",
  "category": "feature_request",
  "status": "received"
}
```

---

## 15. Updated Implementation Plan (with Runtime Components + Marketplace Agent)

### Phase A: Foundation (API + Data + Components)

All items from the original Phase A, plus:

1. **Copy components**: Move `jules-chop/src/components/*` and `jules-chop/src/services/*` into `projects/agent-market/console-ui/src/`.
2. **Install dependencies**: Add `monaco-editor`, `@monaco-editor/react`, `jszip`, `markdown-it`, `prismjs`, `lucide-react` to `console-ui/package.json`.
3. **Configure Vite**: Update `console-ui/vite.config.ts` with worker format and Monaco optimizeDeps.
4. **Copy workers**: Move `zip.worker.ts` and `extracted_logic/` into the console-ui source tree.
5. **Wire services to gateway**: Create an API client layer that translates between the service interfaces and the gateway REST API (Section 13.5).

### Phase B: UI Assembly

Each wireframe now references concrete components:

| Surface | Components Used |
|---------|----------------|
| Agent Studio — Flow Editor | `CodeEditor` (system prompt editing), `ContextManager` (context panel) |
| Agent Studio — Preview Mode | `Terminal` (execution output), `ExecutionLog` (tool calls), `MarkdownViewer` (plan display) |
| Agent Studio — Get Code | `CodeEditor` (read-only Python/JSON export display) |
| BYOA Registration | `MarkdownViewer` (webhook contract docs) |
| Code Review Lane | `DiffEditor` (right panel), `MarkdownViewer` (agent reasoning), `ExecutionLog` (validation results) |
| Eval Dashboard | `MarkdownViewer` (eval reports) |
| Review Queue | Card components (existing pattern) |
| Token Spend Tracker | Chart components (new, not from jules-chop) |
| **Marketplace Agent — Context Bar** | `ContextManager` (persona, repos, agents, budgets, journey step as pill tags) |
| **Marketplace Agent — Chat Panel** | `MarkdownViewer` (agent suggestions), action buttons, activity feed |
| **Marketplace Agent — Tool Log** | `ExecutionLog` (WebMCP tool calls from external agents, approve/reject) |

### Phase C: Integration & Polish

All items from the original Phase C, plus:

1. **VFS integration**: Wire `vfsService` to track file state across the Code Review lane, enabling "accept patch" to apply changes to the local VFS.
2. **Plan service integration**: Wire `planService` to the Agent Studio preview, showing bot-generated plan steps with accept/reject per step.
3. **Zip upload flow**: Wire `FileUploader` + `zipService` for eval fixture uploads and BYOA context bootstrap.
4. **RPC bridge**: Implement the DFRPC positional-array translation layer as a thin adapter over `fetch()` calls to the gateway.
5. **Terminal streaming**: Wire `runtimeService` to a WebSocket connection for live stdout/stderr from agent execution environments.
6. **Marketplace Agent journey engine**: Wire `contextService` to the `GET /market/journey/{persona}` endpoint so the agent's context bar reflects real journey state from the gateway. Register the 6 new WebMCP tools (`bn_journey_state`, `bn_journey_next_step`, `bn_context_snapshot`, `bn_agent_suggest`, `bn_review_queue_summary`, `bn_spend_alert`).
7. **Proactive agent suggestions**: The Marketplace Agent chat panel queries journey state + spend + review queue on page load and surfaces a recommended next action. This is the retention loop — the agent always has something useful to say.

---

## 15. Non-Goals

- On-chain settlement UI (deferred per `PRODUCT.md` v0 scope)
- Wallet creation or management UI
- Fiat onramp
- Multi-tenant SaaS features (single operator assumed for v0)
- Mobile-native surfaces (Android app remains deferred)
- BYOA agent runtime hosting (operators host their own agents; the platform only routes jobs)
- Automatic trust tier promotion (manual operator action for v0)
- Full Emscripten/WASM engine (jukeswasm) — `markdown-it` + Prism.js replaces the 1.5MB CMark/RE2 bundle for v0
- WebGPU acceleration (future research, not v0)
