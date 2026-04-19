# Agent Serving Platform

This document describes the serving structure for the six-agent fleet.

## Goal

Front six distinct product agents through one shared model runtime.

The six agents remain first-class product identities:

1. `ts-migrator`
2. `ts-auditor`
3. `ts-architect`
4. `rust-porter`
5. `rust-sentinel`
6. `rust-optimizer`

## Core idea

The fleet is not six separate model deployments.

The fleet is one shared runtime stack with six stable product identities:

- LiteLLM as the northbound gateway
- one shared self-hosted inference backend
- six agent prompt packs now
- six adapter slots later
- six tool policies
- six validator recipes
- six routing identities
- one bounded execution plane

## Layers

### 1. Shared model runtime

Implemented in [model_runtime.py](C:/Users/mac/BountyNet/gateway/model_runtime.py).

This is the pooled inference contract.

It now assumes:

- LiteLLM in front
- one OpenAI-compatible backend behind it
- model aliases per agent
- fallback model support
- future adapter-aware specialization

It also supports a hosted-only mode:

- six agent aliases resolve directly to a hosted provider model
- `ANTHROPIC_API_KEY` alone is enough to make the six agents available
- self-hosted base model infrastructure becomes optional instead of required

Current runtime contract:

- provider
- model alias
- fallback model alias
- api_base
- api_key
- reasoning_effort
- extra_body metadata

Configured through:

- `AGENT_RUNTIME_PROVIDER`
- `AGENT_RUNTIME_MODEL`
- `AGENT_RUNTIME_FALLBACK_MODEL`
- `AGENT_RUNTIME_API_BASE`
- `AGENT_RUNTIME_API_KEY`
- `AGENT_RUNTIME_EXTRA_BODY_JSON`

## 2. Agent fleet profiles

Implemented in [agent_fleet.py](C:/Users/mac/BountyNet/gateway/agent_fleet.py).

Each agent has:

- system prompt
- allowed tools
- allowed file surfaces
- validator recipe
- runtime model
- runtime provider
- runtime adapter id placeholder
- plan requirement

This is the main place where the six agents are differentiated.

Each profile now carries:

- runtime alias
- fallback alias
- adapter id
- reasoning profile

## 3. Agent gateway/service

Implemented in [agent_service.py](C:/Users/mac/BountyNet/gateway/agent_service.py).

This layer:

- builds the request envelope
- snapshots relevant repo context
- composes the model messages
- invokes the shared runtime
- records invocation telemetry
- hands execution off to bounded repo tools

## 4. Bounded execution plane

Implemented in [market_exec.py](C:/Users/mac/BountyNet/gateway/market_exec.py).

The model does not edit repositories directly.

It operates through bounded repo tools and deterministic patchers:

- workflow action upgrades
- tsconfig normalization
- package.json dependency updates
- Cargo.toml dependency updates
- opportunity scanning

This keeps execution policy-enforced even when the model is shared.

## 5. Marketplace/control plane

Implemented in [market.py](C:/Users/mac/BountyNet/gateway/routes/market.py).

This layer:

- seeds the managed fleet
- routes jobs to the right agent
- records recommendations
- records plans
- creates assignments
- executes assignments
- stores submissions
- tracks payouts
- stores scout opportunities

## 6. Telemetry plane

Stored in [store.py](C:/Users/mac/BountyNet/gateway/store.py).

Current telemetry tables include:

- `market_execution_runs`
- `market_agent_invocations`
- `market_job_recommendations`
- `market_payout_ledger`

Invocation telemetry captures:

- request envelope
- model/provider
- response payload
- planned tool calls
- validation recipe
- token counts
- timing

## Current execution model

Today, the serving structure is real but hybrid.

That means:

- the request goes through a real shared-runtime abstraction
- each agent has a distinct prompt/policy identity
- bounded repo execution still performs the actual file changes

If the runtime is not configured, the service falls back and records that fallback in telemetry.

## Deployable stack

Deployable stack artifacts now live in [docker/agent-runtime](C:/Users/mac/BountyNet/docker/agent-runtime).

That directory contains:

- `docker-compose.yml`
- `litellm.config.yaml`
- `.env.example`
- `adapters/`

The intended runtime shape is:

1. gateway points at LiteLLM
2. LiteLLM exposes six stable agent aliases
3. the aliases target one shared backend model
4. external providers cover overflow or weak lanes
5. later, agent aliases can bind to PEFT adapters without changing the product API

For the fastest launch path, those aliases can all resolve to a single hosted model such as `anthropic/claude-sonnet-4-5`.

## Near-term production path

1. bring up LiteLLM plus SGLang locally
2. point `AGENT_RUNTIME_API_BASE` at LiteLLM
3. keep the six agent identities unchanged
4. improve each agent’s prompt pack and validator recipe
5. later attach LoRA adapters only where a lane proves worth specializing

## Non-goals

This platform is not:

- six separate GPU services
- six independent model stacks
- a direct-model-to-repo mutation system
- a chat interface pretending to be a fleet

It is a shared-runtime multi-agent gateway with product-real agent identities.
