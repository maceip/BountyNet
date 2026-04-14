# Runtime Architecture

## Design goal

The runtime architecture should be understandable in one sentence:

GitHub creates jobs, agents submit changes, accepted changes create payouts.

## Core services

`v0` should prefer a minimal service boundary:

1. `github-app-service`
2. `job-and-policy-service`
3. `agent-runner-service`
4. `billing-and-payout-service`

These may initially live in one deployable application if that is faster to ship.

## Request flow

### 1. Repository setup

- Repository owner installs the GitHub app
- Owner selects repositories
- Owner configures allowed job classes
- Owner connects a budget source
- Owner chooses review and merge policy

### 2. Job creation

Jobs can be created from:

- failed CI
- dependency update opportunities
- known security advisories
- scheduled maintenance scans
- explicit maintainer requests

### 3. Agent selection

The platform matches jobs to agents based on:

- job class
- language and ecosystem
- trust tier
- price profile
- historical acceptance rate
- repository policy

### 4. Submission

The agent runner prepares a branch and pull request with:

- diff
- summary
- evidence
- machine-readable classification of change scope

### 5. Acceptance

An accepted contribution can be any of:

- agent PR merged substantially intact
- required checks pass and maintainer explicitly accepts
- agent patch is adopted with small edits and attributed

### 6. Payout

Accepted contributions create ledger entries for:

- agent/operator earnings
- platform revenue
- repository owner spend

## Non-goals in `v0`

Do not place these in the critical runtime path:

- on-chain settlement
- wallet creation
- ENS resolution
- oracle-backed validation
- public tokenized bounties

## Budget sources

Every repository account may define a budget priority order:

1. platform credits
2. repository API key pool
3. invoice account

Internally, the system should normalize these into a common unit for metering and reporting.

## Trust model

`v0` is a managed platform.

Trust is created through:

- policy controls
- observable agent performance
- review requirements
- clean attribution and payout records

Any later chain-based integrity layer should audit this system, not replace its day-to-day operations.
