# System Baseline

This file is the working baseline for the `v0` product and implementation.

If future discussion drifts from this, treat this document as the default source of truth until it is intentionally edited.

## Product Line

`An agent marketplace for code improvements.`

Short internal framing:

`budgeted autonomous maintenance`

## Purpose

Build a GitHub-native product where repository owners can configure policy and budget, receive agent-authored code improvements, and pay only for accepted outcomes.

## What `v0` must do

`v0` is not a concept demo. It must function as a working product loop:

1. repository is connected or registered
2. jobs are created
3. agents are recommended and assigned
4. agents produce code changes
5. submissions are reviewed or accepted
6. accepted outcomes are attributed and recorded
7. payout ledger is updated

## What the system is

The system has these product components:

1. marketplace presentation layer
2. managed agent fleet
3. job routing and assignment
4. explicit planning before execution
5. policy-aware execution
6. accepted-change attribution
7. budget and payout ledger
8. later trusted update lanes

These are not separate products. They are one product loop.

## Product pillars

These are the agreed pillars:

- specialized agents, not generic bots alone
- explicit planning before execution
- trust-tiered assignment, not first-come claim spam
- policy-aware routing
- accepted-change attribution
- budget source flexibility, including API key pools
- later, trusted update lanes

## Fleet model

The fleet is two-tiered.

### Generic agents

Generic agents exist because they are needed for:

- low-cost baseline coverage
- fallback when no specialist is a good fit
- internal bootstrap supply
- broad low-risk maintenance work

### Specialist agents

Specialists exist because they are needed for:

- differentiated product value
- better routing decisions
- higher-trust job handling
- stronger evaluation later
- higher-quality marketplace inventory

The system should support both.

## Initial specialist set

The first specialist fleet is:

1. TypeScript Migrator
2. TypeScript Auditor
3. TypeScript Architect
4. Rust Porter
5. Rust Sentinel
6. Rust Optimizer

These are the current first-class specialists unless explicitly replaced.

## Initial wedge

The first operational wedge is reactive repository maintenance:

- CI repair
- dependency updates
- test repair
- config remediation

This is the simplest path to a working loop and a usable product.

## Expansion lanes

After the wedge works, expand into:

- TypeScript migrations
- TypeScript security audits
- TypeScript refactors
- Rust porting
- Rust security patching
- Rust performance optimization
- trusted security update lanes

## Marketplace stance

The product should look like a marketplace from day one, even if supply is initially first-party managed.

The user should be able to understand:

- what agents exist
- what each agent is good at
- what trust tier each agent has
- what kinds of jobs each agent can take
- why a given agent was recommended

## Acceptance and payment model

The core rule is:

`pay for accepted work`

For `v0`, accepted outcome means the repository owner has accepted the change according to the configured policy. The implementation may start with `merged PR` as the strict default.

Budget sources may include:

- platform credits
- API key pools
- later invoice-backed budgets

## What `v0` is not

`v0` is not:

- a blockchain-first product
- a wallet onboarding product
- a trustless marketplace
- an eval platform
- a generalized agent protocol

Those may exist later. They are not the `v0` critical path.

## Scope guardrails

Do not re-open these debates by default:

- whether this should exist as a marketplace
- whether it should include both generic and specialist agents
- whether planning is explicit
- whether payouts are tied to accepted outcomes
- whether blockchain is required for `v0`

The default answer to those is already set here.

## Implementation guardrails

When there is ambiguity, prefer:

- a working local loop over architectural purity
- a mocked but functional integration over a blocked real one
- explicit stored state over hand-wavy future abstractions
- deterministic narrow agents over generic “AI magic”
- one integrated product loop over isolated subsystem demos

## Current implementation target

The current implementation target is:

`a functional marketplace with agents that fix code`

That means:

- backend API
- marketplace UI
- managed fleet inventory
- routing
- assignment
- plan capture
- execution runs
- code changes against a local repo path
- submission and acceptance flow
- payout ledger updates

Until that exists, discussion should bias toward implementation, not reframing.
