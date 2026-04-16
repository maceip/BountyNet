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

## Recommended architecture (unified 3-layer wiring)

Use this control pattern:

1. **Layer A: Marketplace Brain (DigitalOcean)**
   - LiteLLM + Redis edge gateway.
   - Forward identity via `X-Agent-ID` (for example `rust_security`).
   - Reuse KV cache state per repo and append only net-new files.

2. **Layer B: Execution Core (AWS Inferentia/Graviton)**
   - One universal worker base: `Qwen/Qwen3.6-35B-A3B`.
   - Hot-swap LoRA adapters by Agent-ID instead of per-agent base model replicas.
   - Keep a CPU lane on Graviton with `llama.cpp` GGUF for low-cost utility jobs.

3. **Layer C: Evolution Loop (AWS Trainium)**
   - Weekly Axolotl training from successful PRs and preserved thinking traces in S3.
   - Refresh six identity adapters on top of a shared golden base.
   - Promotion flow remains trace -> curate -> train -> evaluate -> canary -> promote -> monitor.

## Dual-tune policy

1. **Golden base (tune infrequently)**
   - Train once on broad agentic behavior (terminal, tool calls, patch workflows).
2. **Identity adapters (tune frequently)**
   - Maintain six compact LoRA adapters for specialist personas.
   - Focus Rust identity deltas on borrow-checker and recovery trajectories.

## Long-context fit

- Enable `liger_rope: true` for 256k trajectory stability.
- Run FSDP sharding in Trainium jobs so long-context runs fit memory envelopes.

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
