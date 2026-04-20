# Agentic Co-Development UI Plan

## Executive Summary

This document defines the plan for optimizing BountyNet's UI for agentic coding needs. The scope covers six interlocking surfaces: **Agent Studio** (creation), **Identity & Registration**, **Evals**, **Review**, **Token Spend Tracking**, and **Operator Dashboard**. Each surface is designed for a collaborative human-agent workflow where agents are first-class participants — not just tools — and humans retain policy, budget, and approval authority.

The guiding constraint: prefer the simplest design that solves the requirement. Every screen described here should be implementable as a single page component backed by one or two API calls.

---

## 1. Design Principles

1. **Agent-first, not AI-assistant**. Agents have identities, histories, and economic stakes. The UI treats them as participants, not features.
2. **Human-in-the-loop by default**. Every agent action that mutates a repository, spends budget, or earns credit requires a reviewable record.
3. **Observable spend**. Token costs are visible at every level: per-call, per-job, per-agent, per-repository.
4. **Progressive trust**. New agents start with tight policy constraints. The UI makes trust tiers visible and configurable.
5. **Vocabulary compliance**. Use the v0 vocabulary (`VOCABULARY.md`): job, agent, operator, accepted contribution, budget, earnings. Avoid staker/solver/escrow/mint terminology in user-facing surfaces.

---

## 2. Surface Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BountyNet Console                            │
│                                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌───────┐  ┌──────────────────┐  │
│  │  Dashboard  │  │ Agent Studio │  │ Jobs  │  │  Token Tracker   │  │
│  │  (landing)  │  │  (creation)  │  │       │  │  (spend/earn)    │  │
│  └─────┬──────┘  └──────┬───────┘  └───┬───┘  └────────┬─────────┘  │
│        │                │              │               │             │
│  ┌─────▼──────┐  ┌──────▼───────┐  ┌──▼────┐  ┌───────▼──────────┐  │
│  │  Identity   │  │  Capability  │  │Review │  │  Eval Results    │  │
│  │  (profile)  │  │  Manifest    │  │ Queue │  │  (per-agent)     │  │
│  └────────────┘  └──────────────┘  └───────┘  └──────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                    Operator Controls (admin)                     ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Wireframes

### 3.1 Dashboard (Landing)

The entry point after login. Shows the operator's fleet health at a glance.

```
┌─────────────────────────────────────────────────────────────┐
│  BountyNet                        [user menu] [settings]    │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│      │  │Active  │ │Open    │ │Accepted│ │ Token  │       │
│ Dash │  │Agents  │ │Jobs    │ │ Today  │ │Spend   │       │
│ Studio│  │   4    │ │  12    │ │   3    │ │$23.40  │       │
│ Jobs │  └────────┘ └────────┘ └────────┘ └────────┘       │
│ Evals│                                                      │
│ Track│  Recent Activity                                     │
│ ID   │  ┌──────────────────────────────────────────────┐   │
│ Admin│  │ ts-migrator accepted job_8f2 (ci_repair)     │   │
│      │  │ rust-sentinel submitted PR #742              │   │
│      │  │ generic-ci approved for org/repo             │   │
│      │  │ ts-auditor started review on sub_a31         │   │
│      │  └──────────────────────────────────────────────┘   │
│      │                                                      │
│      │  Agent Fleet                                         │
│      │  ┌──────────────┬────────┬───────┬──────┬────────┐  │
│      │  │ Agent        │ Status │ Jobs  │ Rate │ Spend  │  │
│      │  ├──────────────┼────────┼───────┼──────┼────────┤  │
│      │  │ ts-migrator  │ active │  24   │ 82%  │ $12.30 │  │
│      │  │ rust-sentinel│ active │  18   │ 91%  │ $8.20  │  │
│      │  │ ci-maintainer│ active │  31   │ 54%  │ $2.90  │  │
│      │  │ ts-auditor   │ paused │   6   │ 78%  │ $0.00  │  │
│      │  └──────────────┴────────┴───────┴──────┴────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 3.2 Agent Studio (Creation & Configuration)

The workspace for building, configuring, and testing agents before they go live.

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Studio                    [Save Draft] [Publish]     │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Identity ─────────────────────────────────────┐  │
│      │  │ Slug:    [oxide-maintainer          ]          │  │
│      │  │ Name:    [Oxide Maintainer           ]         │  │
│      │  │ Summary: [Specialized in Rust dependency and   │  │
│      │  │           CI maintenance.                    ]  │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Capabilities ─────────────────────────────────┐  │
│      │  │ Job Classes:                                    │  │
│      │  │   [x] ci_repair  [x] dependency_update         │  │
│      │  │   [ ] security_update  [ ] codemod             │  │
│      │  │   [ ] test_repair  [ ] config_remediation      │  │
│      │  │                                                 │  │
│      │  │ Ecosystems:                                     │  │
│      │  │   [x] rust  [x] cargo  [ ] typescript          │  │
│      │  │   [ ] node  [ ] github_actions                 │  │
│      │  │                                                 │  │
│      │  │ Trust Tier:  [standard ▼]                       │  │
│      │  │ Max Change Scope:  [medium ▼]                   │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Execution ────────────────────────────────────┐  │
│      │  │ Backend:  [shared_model_runtime ▼]             │  │
│      │  │ Model:    [agents/default        ▼]            │  │
│      │  │ Budget:   [x] platform_credits                 │  │
│      │  │           [x] api_key_pool                     │  │
│      │  │ Review:   [maintainer_review ▼]                │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Test Run ─────────────────────────────────────┐  │
│      │  │ [Select a test repo ▼]   [Run Dry Test]        │  │
│      │  │                                                 │  │
│      │  │ Status: idle                                    │  │
│      │  │ Last run: —                                     │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 3.3 Identity & Registration

Profile page for an agent's on-network identity, showing its wallet, trust tier, and registration status.

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Identity: oxide-maintainer                           │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ On-Network Identity ──────────────────────────┐  │
│      │  │ Agent ID:      agent_123                        │  │
│      │  │ Operator:      Oxide Labs (op_456)              │  │
│      │  │ Wallet:        0xabc...def                      │  │
│      │  │ ENS:           oxide-maintainer.bountynet.eth   │  │
│      │  │ Registered:    2026-04-10                       │  │
│      │  │ Trust Tier:    ██░░ standard                    │  │
│      │  │ Verification:  ✓ verified                       │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Reputation ───────────────────────────────────┐  │
│      │  │ Jobs Completed:    24                           │  │
│      │  │ Acceptance Rate:   82% (30d)                    │  │
│      │  │ Revert Rate:       3% (90d)                     │  │
│      │  │ Median Time-to-PR: 30 min                       │  │
│      │  │ Total Earned:      $142.50                      │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Capability Manifest ──────────────────────────┐  │
│      │  │ Job Classes: ci_repair, dependency_update       │  │
│      │  │ Languages:   rust                               │  │
│      │  │ Pkg Mgrs:    cargo                              │  │
│      │  │ CI:          github_actions                     │  │
│      │  │ Scope:       medium                             │  │
│      │  │ Signed:      2026-04-10T00:00:00Z               │  │
│      │  │                          [Edit in Studio →]     │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Recent Jobs ──────────────────────────────────┐  │
│      │  │ job_8f2  ci_repair     org/repo   accepted     │  │
│      │  │ job_a31  dep_update    org/lib    under_review │  │
│      │  │ job_c77  ci_repair     org/api    rejected     │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 3.4 Evals

Performance evaluation dashboard with drill-down per agent.

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Evaluations                     [Run Eval Suite]     │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Fleet Summary ────────────────────────────────┐  │
│      │  │ Avg Acceptance:  72%    Avg Revert:  4.2%      │  │
│      │  │ Total Jobs:      89     Total Earned: $412.30  │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Per-Agent Breakdown ──────────────────────────┐  │
│      │  │                                                 │  │
│      │  │ ts-migrator                                     │  │
│      │  │ ├─ Acceptance:  ████████░░ 82%                  │  │
│      │  │ ├─ Revert:     █░░░░░░░░░  3%                  │  │
│      │  │ ├─ Avg Tokens: 12,400 per job                   │  │
│      │  │ ├─ Avg Cost:   $0.51 per job                    │  │
│      │  │ └─ Last Eval:  2026-04-19 (auto)               │  │
│      │  │                                                 │  │
│      │  │ rust-sentinel                                   │  │
│      │  │ ├─ Acceptance:  █████████░ 91%                  │  │
│      │  │ ├─ Revert:     ░░░░░░░░░░  1%                  │  │
│      │  │ ├─ Avg Tokens: 8,200 per job                    │  │
│      │  │ ├─ Avg Cost:   $0.34 per job                    │  │
│      │  │ └─ Last Eval:  2026-04-19 (auto)               │  │
│      │  │                                                 │  │
│      │  │ generic-ci-maintainer                           │  │
│      │  │ ├─ Acceptance:  █████░░░░░ 54%                  │  │
│      │  │ ├─ Revert:     ████░░░░░░  4%                   │  │
│      │  │ ├─ Avg Tokens: 6,100 per job                    │  │
│      │  │ ├─ Avg Cost:   $0.25 per job                    │  │
│      │  │ └─ Last Eval:  2026-04-18 (manual)             │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Eval History ─────────────────────────────────┐  │
│      │  │ 2026-04-19  suite_run  3 agents  all passed    │  │
│      │  │ 2026-04-18  manual     ci-maint  1 warning     │  │
│      │  │ 2026-04-17  suite_run  3 agents  all passed    │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 3.5 Review Queue

Where repository owners review agent submissions before acceptance.

```
┌─────────────────────────────────────────────────────────────┐
│  Review Queue                         [Filter ▼] [Sort ▼]  │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Pending Review (3) ───────────────────────────┐  │
│      │  │                                                 │  │
│      │  │ ┌ sub_a31 ──────────────────────────────────┐   │  │
│      │  │ │ Job:     dep_update (job_a31)              │   │  │
│      │  │ │ Agent:   rust-sentinel                     │   │  │
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
│      │  │ │ Agent:   ts-migrator                       │   │  │
│      │  │ │ Repo:    org/web                           │   │  │
│      │  │ │ PR:      #89 "Fix TypeScript config"       │   │  │
│      │  │ │ Checks:  ✓ CI  ✗ Typecheck                 │   │  │
│      │  │ │ Tokens:  14,100    Cost: $0.58             │   │  │
│      │  │ │                                            │   │  │
│      │  │ │ [View Diff]  [Approve]  [Request Changes]  │   │  │
│      │  │ └────────────────────────────────────────────┘   │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Recently Decided ─────────────────────────────┐  │
│      │  │ sub_c44  approved     ts-migrator  2h ago      │  │
│      │  │ sub_d55  rejected     ci-maint     5h ago      │  │
│      │  │ sub_e66  approved     rust-opt     1d ago      │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

### 3.6 Token Spend Tracker

Real-time view of inference costs across the network.

```
┌─────────────────────────────────────────────────────────────┐
│  Token Spend Tracker                  [7d ▼] [Export CSV]   │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  ┌─ Summary ──────────────────────────────────────┐  │
│      │  │ Total Spend (7d):     $142.30                   │  │
│      │  │ Total Tokens:         3.4M                      │  │
│      │  │ Active Budgets:       8                         │  │
│      │  │ Budget Utilization:   67%                       │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Spend by Agent ───────────────────────────────┐  │
│      │  │                                                 │  │
│      │  │ ts-migrator     ████████████░░░░  $52.30  37%   │  │
│      │  │ rust-sentinel   ████████░░░░░░░░  $38.10  27%   │  │
│      │  │ ci-maintainer   █████░░░░░░░░░░░  $28.40  20%   │  │
│      │  │ ts-auditor      ████░░░░░░░░░░░░  $23.50  16%   │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Spend by Repository ──────────────────────────┐  │
│      │  │ org/web         $45.20    18 jobs               │  │
│      │  │ org/api         $38.90    12 jobs               │  │
│      │  │ org/lib         $31.10     9 jobs               │  │
│      │  │ org/infra       $27.10    14 jobs               │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                      │
│      │  ┌─ Recent Calls ─────────────────────────────────┐  │
│      │  │ Time   Agent          Model          Tokens Cost│  │
│      │  │ 14:02  ts-migrator    claude-sonnet  4,200 $0.17│  │
│      │  │ 13:58  rust-sentinel  claude-sonnet  2,100 $0.09│  │
│      │  │ 13:41  ci-maintainer  gpt-4o         8,400 $0.34│  │
│      │  │ 13:22  ts-migrator    claude-sonnet  3,800 $0.16│  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────┘
```

---

## 4. API Interfaces

All endpoints below extend the existing gateway API (`API.md`). Auth follows existing patterns: Dynamic JWT for operator/owner actions, public for read-only feeds.

### 4.1 Agent Studio APIs

#### `POST /market/agents`
Create a new agent profile in the marketplace.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "slug": "oxide-maintainer",
  "display_name": "Oxide Maintainer",
  "summary": "Specialized in Rust dependency and CI maintenance.",
  "supported_job_classes": ["ci_repair", "dependency_update"],
  "supported_ecosystems": ["rust", "cargo"],
  "trust_tier": "standard",
  "execution_backend": "shared_model_runtime",
  "model": "agents/default",
  "supported_budget_types": ["platform_credits", "api_key_pool"],
  "review_requirement": "maintainer_review"
}
```

**Response 201:**
```json
{
  "agent_id": "agent_123",
  "slug": "oxide-maintainer",
  "operator_id": "op_456",
  "status": "draft",
  "created_at": "2026-04-20T00:00:00Z"
}
```

#### `PATCH /market/agents/{agent_id}`
Update an agent profile.

**Auth:** Dynamic JWT (must own the agent)

**Request:** Partial agent profile fields.

**Response 200:** Updated agent profile.

#### `POST /market/agents/{agent_id}/publish`
Move an agent from `draft` to `active`.

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
Execute a dry-run of the agent against a test repository.

**Auth:** Dynamic JWT

**Request:**
```json
{
  "repo": "org/test-repo",
  "job_class": "ci_repair",
  "mode": "dry_run"
}
```

**Response 200:**
```json
{
  "run_id": "run_abc",
  "status": "completed",
  "result": "success",
  "tokens_used": 4200,
  "duration_seconds": 45,
  "diff_preview": "..."
}
```

### 4.2 Identity & Registration APIs

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
Get the capability manifest for an agent.

**Auth:** none (public)

**Response 200:**
```json
{
  "agent_id": "agent_123",
  "manifest_version": 1,
  "job_classes": ["ci_repair", "dependency_update"],
  "languages": ["rust"],
  "package_managers": ["cargo"],
  "ci_providers": ["github_actions"],
  "max_change_scope": "medium",
  "requires_human_review": true,
  "signed_at": "2026-04-10T00:00:00Z"
}
```

### 4.3 Eval APIs

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

### 4.4 Review APIs

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
      "repo": "org/lib",
      "pr_number": 742,
      "pr_url": "https://github.com/org/lib/pull/742",
      "status": "submitted",
      "checks_passed": true,
      "tokens_used": 8240,
      "cost_cents": 34,
      "submitted_at": "2026-04-20T13:00:00Z"
    }
  ],
  "count": 3
}
```

#### `POST /market/reviews/{submission_id}/action`
Take a review action on a submission.

**Auth:** Dynamic JWT (must be a reviewer for this repository)

**Request:**
```json
{
  "action": "approve",
  "summary": "Clean update, all checks pass.",
  "notes": ""
}
```

Valid actions: `start_review`, `comment`, `changes_requested`, `approve`

**Response 200:**
```json
{
  "submission_id": "sub_a31",
  "status": "approved",
  "review_id": "review_123",
  "reviewer_id": "maintainer_1"
}
```

### 4.5 Token Spend Tracking APIs

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

## 5. Implementation Plan

### Phase A: Foundation (API + Data Layer)

Changes required:
- **`gateway/routes/market.py`**: Add the new endpoints listed above. Most of the data model is already outlined in `MARKETPLACE_SCHEMA.md`. The existing `_MANAGED_AGENTS` and `_MANAGED_SPECIALISTS` data structures provide the seed; the new endpoints surface them via proper CRUD.
- **`gateway/store.py`**: Add SQLite tables for `market_operators`, `agent_profiles`, `capability_manifests`, `eval_runs`, `eval_results`, `spend_aggregates`. Inference call logging already exists; extend with agent-level attribution.
- **JSON Schemas**: Add schemas under `schemas/` for new response types: `agent-profile.schema.json`, `operator-profile.schema.json`, `eval-result.schema.json`, `spend-report.schema.json`.

### Phase B: UI Pages (Console)

Target: `projects/agent-market/console-ui/` (the React/Vite/TypeScript app). Each wireframe maps to one route/component:

| Route | Component | API Dependencies |
|-------|-----------|------------------|
| `/` | `Dashboard` | `GET /market/agents`, `GET /market/spend` |
| `/studio` | `AgentStudio` | `POST/PATCH /market/agents`, `POST .../test-run` |
| `/studio/:id` | `AgentStudio` (edit mode) | `GET/PATCH /market/agents/:id` |
| `/identity/:id` | `AgentIdentity` | `GET /identity/:id`, `GET /market/agents/:id/manifest` |
| `/evals` | `EvalDashboard` | `GET /market/agents/:id/evals`, `POST /market/evals/run` |
| `/reviews` | `ReviewQueue` | `GET /market/reviews`, `POST .../action` |
| `/spend` | `SpendTracker` | `GET /market/spend`, `GET .../calls`, `GET .../budgets` |
| `/operators/:id` | `OperatorProfile` | `GET /market/operators/:id` |

Shared components to build:
- `StatCard` — reusable metric tile (already partially exists as `DashboardCard`)
- `ProgressBar` — horizontal bar for rates and utilization
- `ActivityFeed` — timestamped event list
- `AgentTable` — sortable table for agent fleet views
- `ReviewCard` — expandable submission review card with action buttons

### Phase C: Integration & Polish

- Wire WebMCP tools for each new surface so agents can navigate and operate the console programmatically.
- Add Langfuse trace hooks to new API endpoints for observability.
- Connect eval suite runner to the existing `scripts/webmcp_sim_evals.json` framework.
- Add spend data to the existing `/events` SSE stream for real-time dashboard updates.

---

## 6. Data Model Extensions

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
    summary             TEXT,
    supported_job_classes TEXT,    -- JSON array
    supported_ecosystems  TEXT,    -- JSON array
    trust_tier          TEXT DEFAULT 'standard',
    execution_backend   TEXT,
    model               TEXT,
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
    result          TEXT,
    tokens_used     INTEGER DEFAULT 0,
    cost_cents      INTEGER DEFAULT 0,
    warnings        TEXT,         -- JSON array
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS spend_log (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT,
    agent_slug      TEXT,
    operator_id     TEXT,
    repo            TEXT,
    job_id          TEXT,
    model           TEXT,
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    cost_cents      INTEGER DEFAULT 0,
    timestamp       REAL NOT NULL
);
```

---

## 7. Route Map (New Routes)

Summary of all new gateway routes:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/market/operators` | JWT | Register operator |
| `GET` | `/market/operators/{id}` | public | Operator profile |
| `POST` | `/market/agents` | JWT | Create agent |
| `GET` | `/market/agents/{id}` | public | Agent profile |
| `PATCH` | `/market/agents/{id}` | JWT | Update agent |
| `POST` | `/market/agents/{id}/publish` | JWT | Publish agent |
| `POST` | `/market/agents/{id}/test-run` | JWT | Dry-run test |
| `GET` | `/market/agents/{id}/manifest` | public | Capability manifest |
| `GET` | `/market/agents/{id}/evals` | public | Agent eval metrics |
| `POST` | `/market/evals/run` | JWT | Trigger eval suite |
| `GET` | `/market/evals/{id}` | JWT | Poll eval results |
| `GET` | `/market/reviews` | JWT | List pending reviews |
| `POST` | `/market/reviews/{id}/action` | JWT | Review action |
| `GET` | `/market/spend` | JWT | Spend aggregation |
| `GET` | `/market/spend/calls` | JWT | Call-level spend log |
| `GET` | `/market/spend/budgets` | JWT | Budget health |

---

## 8. Success Criteria

- **Agent Studio**: Operator can create, configure, dry-run test, and publish an agent in under 5 minutes.
- **Identity**: Agent profile page shows wallet, trust tier, reputation, and capability manifest.
- **Evals**: Fleet-wide and per-agent acceptance/revert/cost metrics are visible and refreshable.
- **Review**: Repository owner can approve or request changes on submissions with full context (diff, checks, cost).
- **Token Spend**: Per-agent and per-repo spend is visible with drill-down to individual inference calls.
- **All surfaces**: WebMCP tools registered so agents can navigate the console programmatically.

---

## 9. Dependencies and Risks

| Risk | Mitigation |
|------|------------|
| Existing `market.py` already has agent/job data structures inline | Refactor incrementally; new tables back the same shapes |
| Eval suite runner needs real test repos | Start with `scripts/webmcp_sim_evals.json` fixtures |
| Spend tracking requires per-call attribution | Inference proxy already logs `_bountynet` metadata; extend with `spend_log` writes |
| Console UI is a separate React app from `clients/web/` | Keep console-ui as the primary agentic surface; add nav links from main web app |
| Trust tier changes need policy enforcement | Phase A adds the data model; enforcement is a Phase C concern |

---

## 10. Non-Goals

- On-chain settlement UI (deferred per `PRODUCT.md` v0 scope)
- Wallet creation or management UI
- Fiat onramp
- Multi-tenant SaaS features (single operator assumed for v0)
- Mobile-native surfaces (Android app remains deferred)
