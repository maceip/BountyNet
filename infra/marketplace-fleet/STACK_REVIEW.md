# BountyNet LLM Stack Review

This review focuses on your operating target:

- many specialized agents
- one or two base models
- continuous improvement over time

## What is already strong

- vLLM split for base + speculative specialist runtime.
- Axolotl QLoRA adapter training path.
- Langfuse for traces and cost attribution.
- Multi-cloud global ingress scaffolding (AWS + DigitalOcean + Cloudflare).

## Missing for fine-tuning maturity

1. **Adapter registry + promotion policy**
   - Add an adapter registry service with immutable artifacts:
     - adapter id/version
     - base model compatibility
     - eval scorecards
     - rollout state (`shadow`, `canary`, `active`, `rollback`)
   - Without this, specialist quality drifts and rollbacks are slow.

2. **Eval harness before promotion**
   - Add offline and online gates:
     - offline: code-fix benchmark suites per specialist
     - online: shadow traffic acceptance + latency/cost deltas
   - Promotion should require passing thresholds, not manual judgment.

3. **Data flywheel pipelines**
   - Add automated curation jobs from production traces:
     - accepted diffs -> positive examples
     - rejected diffs / policy violations -> negative examples
   - Build anonymization + policy redaction before training export.

4. **Preference optimization layer**
   - QLoRA SFT is good baseline, but add preference training:
     - DPO / ORPO pass on top of SFT adapters
     - focus on patch minimality, policy compliance, and deterministic edits

5. **Specialist routing policy**
   - Add a router to map job metadata -> specialist adapter + decoding profile.
   - Route by language, risk, file-type, repo policy, and latency budget.

6. **Long-horizon memory and retrieval**
   - Add RAG for repository context and historical decisions (not only prompt prefix).
   - Keep model count low while increasing agent capability via better context retrieval.

7. **Drift and regression monitoring**
   - Add scheduled regression sweeps and drift alerts:
     - pass rate drops
     - cost/token inflation
     - latency regressions
   - Trigger automatic rollback when thresholds are breached.

## Recommended architecture (many agents, 1-2 base models)

Use this control pattern:

1. **Base models**
   - `Model-A`: primary coding/reasoning model.
   - `Model-B`: optional low-latency drafter or fallback reliability lane.

2. **Agent persona = policy + tools + adapter profile**
   - Do not spawn new base models for each agent.
   - Implement each agent as:
     - system/policy template
     - tool permission set
     - retrieval profile
     - optional LoRA adapter
     - decoding policy (temperature, max tokens, speculative decode on/off)

3. **Adapter packs**
   - Maintain adapter packs per domain:
     - TypeScript Auditor
     - Rust Sentinel
     - Security Triage
   - Hot-load per request or per worker pool.

4. **Promotion loop**
   - Trace -> curate -> train -> evaluate -> canary -> promote -> monitor.
   - Langfuse trace IDs should join every stage for attribution and billing.

## Immediate next infra additions

- Add `adapter-registry` service (metadata + artifact pointers).
- Add `eval-runner` service for benchmark suites and canary checks.
- Add `data-curator` batch job for training corpus generation from traces.
- Add gateway `/ops/*` endpoints:
  - `/ops/serving/topology`
  - `/ops/traffic/weights`
  - `/ops/model/rollouts`
  - `/ops/traces/health`

These endpoints map directly to the Operator panel cards already in the web UI.
