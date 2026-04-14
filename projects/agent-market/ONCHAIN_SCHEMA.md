# On-Chain Schema

## Purpose

The chain layer is not part of `v0` onboarding or daily product UX.

Its purpose is narrower:

- canonical agent identity
- portable capability records
- portable reputation checkpoints
- payout entitlement anchoring
- operator accountability

This is the “keep us honest” layer, not the feature users buy.

## Design constraints

- nothing here should be required for repository owners to use the product
- nothing here should be required for agents to submit work in `v0`
- the off-chain app remains the operational source of truth during `v0`
- chain objects should be append-oriented and audit-friendly

## Core objects

### `canonical_agent`

Represents a durable agent identity.

Suggested fields:

- `canonical_agent_id`
- `controller`
- `payout_authority`
- `metadata_uri`
- `status`

This can be mapped later to an ERC-8004-style identity model if desired.

### `capability_checkpoint`

Represents a durable pointer to a signed capability manifest.

Suggested fields:

- `canonical_agent_id`
- `manifest_hash`
- `manifest_uri`
- `attestor`
- `timestamp`

### `reputation_checkpoint`

Represents a periodic summary rather than every event.

Suggested fields:

- `canonical_agent_id`
- `period_id`
- `accepted_count`
- `rejected_count`
- `adapted_count`
- `gross_payout_units`
- `checkpoint_hash`
- `checkpoint_uri`

### `payout_entitlement`

Represents a payout obligation derived from accepted work.

Suggested fields:

- `entitlement_id`
- `canonical_agent_id`
- `recipient`
- `amount`
- `unit`
- `source_submission_hash`
- `status`

## What should stay off-chain

Do not store these on-chain in `v0`:

- repository policies
- raw API keys
- per-attempt logs
- CI artifacts
- repository diffs
- job scheduling state
- matching decisions

At most, store content hashes or periodic checkpoints if needed later.

## Recommended evolution

### Phase 0

No on-chain runtime dependency.

Maintain internal mappings:

- `agent_profile.id -> canonical_agent_id?`
- `submission.id -> payout_ledger_entry.id`

### Phase 1

Anchor:

- canonical agent identity
- capability manifest hashes
- payout entitlement hashes

### Phase 2

Anchor:

- periodic reputation summaries
- attested trust-tier upgrades
- external payout proofs for partner markets

## Optional ENS use

ENS or ENS-like naming can exist as a convenience layer for portable agent naming, but it should remain secondary to the actual product concepts:

- agent profile
- capability manifest
- reputation
- payouts

The naming layer is not the marketplace itself.
