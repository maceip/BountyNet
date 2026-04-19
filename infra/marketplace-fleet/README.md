# BountyNet Marketplace Fleet Bootstrap

Bootstrap infra kit for the first managed marketplace fleet:

- **Serving stack:** vLLM OpenAI-compatible endpoints (base + specialist)
- **Tuning stack:** Axolotl with QLoRA configs for specialist adapters
- **Observability:** Langfuse + Postgres + Redis + ClickHouse
- **Deployment paths:** Docker Compose (local) and Kubernetes (cluster bootstrap)

## Why this shape

This scaffold is optimized for your marketplace control plane:

- **High-concurrency serving:** vLLM continuous batching + PagedAttention.
- **2026 optimization path:**
  - Prefix caching enabled by default (`--enable-prefix-caching`)
  - Speculative decoding enabled on specialist server (`--speculative-model`, `--num-speculative-tokens`)
- **Specialist iteration speed:** Axolotl QLoRA adapters for pod/lane specializations (Rust Sentinel, TypeScript Auditor).
- **Trace + cost attribution:** Langfuse backbone for plan tracing and billing normalization.

## Unified wiring diagram

### Layer A: Marketplace Brain (DigitalOcean)

- **Ingress + identity:** LiteLLM gateway receives task intent and forwards identity metadata with `X-Agent-ID` (example: `rust_security`).
- **Context sync:** Redis-backed KV/prefix cache keeps a rolling project state so requests can reuse recent context and append only net-new files.
- **Role:** route, cache, and gate before inference execution.

### Layer B: Execution Core (AWS Inferentia/Graviton)

- **Primary inference:** one universal base model (`Qwen/Qwen3.6-35B-A3B`) served on Inferentia2 (`inf2`) via vLLM + Neuron.
- **Dynamic identity loading:** hot-swap LoRA adapters by `X-Agent-ID` instead of running six full model replicas.
- **CPU lane:** fallback and utility execution on Graviton (`c8g`) with `llama.cpp` GGUF paths where latency/cost wins.

### Layer C: Evolution Loop (AWS Trainium)

- **Data flywheel:** successful PR outcomes + preserved thinking traces are pushed to S3.
- **Cadence:** scheduled weekly Axolotl jobs on `trn1.32xlarge`.
- **Output:** refreshed adapter set for all six identities against a shared golden base.

## Dual-tune strategy

- **Golden base (infrequent):** tune Qwen3.6-35B-A3B on broad agentic trajectories (terminal/tool/diff behavior).
- **Identity adapters (frequent):** tune compact LoRA layers for each specialist persona (security patch, vendor swap, recovery).
- **MoE routing focus:** prioritize gate/down projections to improve expert routing for domain-heavy identities (for example, Rust borrow-checker repair paths).

## Long-context training posture

- Enable `liger_rope: true` in Axolotl configs for 256k-stability workstreams.
- Use FSDP sharding in Trainium jobs so long-sequence tuning can be distributed across accelerator cores.
- Roll context in stages to keep runs stable:
  - stage1: `32768`
  - stage2: `65536`
  - stage3: `131072`
  - stage4: `262144`

## Folder layout

```text
infra/marketplace-fleet/
├─ .env.example
├─ docker-compose.yml
├─ docker/axolotl/Dockerfile
├─ axolotl/
│  ├─ configs/
│  │  ├─ specialist-template.yml
│  │  ├─ rust-sentinel-qlora.yml
│  │  └─ typescript-auditor-qlora.yml
│  └─ datasets/
│     └─ README.md
├─ scripts/
│  ├─ train-specialist.sh
│  └─ check-serving.sh
├─ STACK_REVIEW.md
├─ terraform/
│  ├─ main.tf
│  ├─ variables.tf
│  ├─ aws-global-accelerator/
│  ├─ digitalocean-regional-lbs/
│  ├─ digitalocean-global-lb/
│  └─ digitalocean-global-dns/
└─ k8s/
   ├─ namespace.yaml
   ├─ vllm-base.yaml
   ├─ vllm-speculative.yaml
   ├─ langfuse-values.yaml
   └─ deploy.sh
```

## Quick start (Compose)

1. Copy env:

```bash
cp .env.example .env
```

2. Start serving + observability:

```bash
docker compose up -d
```

3. Optional: start tuning worker profile:

```bash
docker compose --profile tune up -d axolotl-trainer
```

4. Health checks:

```bash
bash scripts/check-serving.sh
```

## Specialist training workflow (Axolotl + QLoRA)

1. Place dataset JSONL in `axolotl/datasets/`.
2. Tune using a config:

```bash
bash scripts/train-specialist.sh axolotl/configs/rust-sentinel-qlora.yml
```

Optional staged override without editing config files:

```bash
AXOLOTL_SEQUENCE_LEN=65536 bash scripts/train-specialist.sh axolotl/configs/rust-sentinel-qlora.yml
```

Memory preflight guard is enabled by default and will fail fast on high OOM risk.
You can tune or bypass it with:

```bash
AXOLOTL_AVAILABLE_GPU_MEM_GB=120 AXOLOTL_SEQUENCE_LEN=65536 bash scripts/train-specialist.sh axolotl/configs/rust-sentinel-qlora.yml
# or (not recommended for normal runs)
AXOLOTL_PREFLIGHT=0 bash scripts/train-specialist.sh axolotl/configs/rust-sentinel-qlora.yml
```

3. Export generated LoRA adapters from `axolotl/output/`.
4. Mount/sync adapters into serving nodes when you wire runtime hot-swaps.

### Weekly evolution loop (Trainium/Axolotl pattern)

Use this script to run the "successful traces -> refreshed adapters" cadence:

```bash
bash scripts/train-weekly-adapters.sh
```

Expected env:

- `TRAJECTORY_BUCKET` with curated JSONL datasets per identity.
- `ADAPTER_BUCKET` (or `VLLM_ADAPTER_BUCKET`) for published adapter artifacts.
- `HF_TOKEN` if model/tokenizer pulls require auth.

## Kubernetes bootstrap

Prereqs: `kubectl`, `helm`, GPU nodes with NVIDIA device plugin.

```bash
bash k8s/deploy.sh
```

This applies:

- namespace
- vLLM base deployment/service
- vLLM specialist (speculative decode) deployment/service
- Langfuse Helm deployment with values in `k8s/langfuse-values.yaml`

## Global ingress modules

Terraform modules are included for the production edge topology:

- DigitalOcean edge gateways: 10 droplets total
  - 2 North America west coast
  - 2 North America east coast
  - 3 Europe
  - 2 Asia
  - 1 Australia
- DigitalOcean primary + backup global ingress load balancers (active/standby pattern).
- DigitalOcean DNS global hostname steering across all DigitalOcean edge lanes and global LB failover targets.
- AWS Global Accelerator is optional when you need additional anycast ingress, but not required for the default DO-first spend posture.

- `terraform/` is the single root stack.
- The provider-specific directories under `terraform/` are child modules.

Additional AWS model-plane modules are available:

- `aws-inf2-serving` — Inferentia serving lane with adapter-aware front proxy.
- `aws-c8g-llamacpp` — Graviton CPU worker lane using `llama.cpp` + GGUF.

Start from the unified root:

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
bash scripts/terraform-init.sh
bash scripts/terraform-sanity.sh
```

Then fill the values and apply from `infra/marketplace-fleet/terraform/`.

To enable AWS lanes, set:

- `provision_aws_inf2_serving = true`
- `provision_aws_c8g_cpu_worker = true`

and provide model/API/instance variables in `terraform.tfvars`.

## Notes for gateway integration

- Each DigitalOcean edge droplet boots LiteLLM as a provider-agnostic gateway with:
  - Redis-backed prompt prefix caching.
  - Circuit-break fallback routes across Qwen lanes (supervisor flash + universal worker) and optional external API backups.
  - Optional post-boot secret sync from AWS SSM/KMS (`enable_managed_secret_bootstrap=true`); default mode has no AWS dependency at boot.
- Primary/backup DigitalOcean global LBs are intended to front NA East/NA West lanes, with DNS failover hostname (`llm-backup`) for operator-directed switchover.
- Qwen model lanes are intended as:
  - Supervisor: Qwen3.6-Flash API for rapid triage.
  - Universal Worker: Qwen3.6-35B-A3B for coding and terminal-heavy execution.
  - Tuning target: Qwen3.6-35B-A3B qLoRA adapters on Trainium (trn1).
- Use Langfuse trace IDs to join execution runs, rollouts, and payout ledgers.

## Software manifest

| Component | Software | Hardware |
| --- | --- | --- |
| Edge Gateway | LiteLLM + Redis | DigitalOcean Droplet |
| Inference Server | vLLM (Neuron SDK support) | AWS Inferentia2 (`inf2`) |
| CPU Worker | `llama.cpp` (GGUF quants) | AWS Graviton (`c8g`) |
| Fine-Tuner | Axolotl (Neuron image) | AWS Trainium (`trn1`) |
