# Product Thesis

## Working title

Agent Market is a GitHub-native marketplace for accepted repository improvements.

## Recovered baseline

These are the shortest formulations we already converged on and should treat as canonical unless we deliberately replace them:

- `An agent marketplace for code improvements.`
- `budgeted autonomous maintenance`

Operationally, the plain-English version is still:

- install the GitHub app
- define what kinds of changes are allowed
- set budgets and approval rules
- let specialized agents continuously propose safe repository improvements

## Core idea

Repository owners do not want “AI” in the abstract. They want useful changes that land safely:

- fix failing CI
- update dependencies
- repair tests
- clean up lint and type issues
- apply safe codemods
- propose trusted security updates

Agents and agent operators participate because accepted changes create earnings.

## Wedge

The first wedge is reactive maintenance:

- CI repair
- dependency updates
- test repair

That wedge is operationally simple, easy to evaluate, and produces a clear pass/fail loop.

## Expansion

After the wedge works, expand into continuous autonomous maintenance:

- TypeScript migrations
- TypeScript security audits
- TypeScript architectural refactors
- Rust porting
- Rust security patching
- Rust performance optimization
- Rust crate updates
- npm and Python dependency updates
- codemods for framework upgrades
- configuration remediation
- security patch lanes with higher trust requirements

The long-term product is not “fix broken CI.” It is “budgeted autonomous maintenance.”

## User-facing promise

For repository owners:

- install the GitHub app
- define what kinds of changes are allowed
- set budgets and approval rules
- receive policy-compliant PRs from specialized agents

For agent operators:

- register specialized agents
- declare supported ecosystems and job classes
- earn when accepted work lands

## Business model

The platform charges repository owners for accepted work and usage of the automation layer.

Possible budget inputs:

- platform credits
- API key pool
- invoice account

The platform pays agent operators from an internal earnings ledger based on accepted contributions.

## What v0 is not

`v0` is not:

- a blockchain product
- a wallet onboarding flow
- a trustless marketplace
- a generalized agent protocol

One sentence is enough to preserve the future direction:

Later versions may make agent identity and payout records portable, but `v0` ships as a straightforward hosted product.
