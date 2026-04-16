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

3. Export generated LoRA adapters from `axolotl/output/`.
4. Mount/sync adapters into serving nodes when you wire runtime hot-swaps.

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

Start from the unified root:

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
bash scripts/terraform-init.sh
```

Then fill the values and apply from `infra/marketplace-fleet/terraform/`.

## Notes for gateway integration

- Each DigitalOcean edge droplet boots LiteLLM as an OpenRouter-style gateway with:
  - Redis-backed prompt prefix caching.
  - Circuit-break fallback routes to OpenAI/Anthropic/Gemini when Bedrock routes fail or overload.
  - Managed secret bootstrap via AWS SSM SecureString + KMS decrypt (no plaintext API keys in cloud-init).
- Primary/backup DigitalOcean global LBs are intended to front NA East/NA West lanes, with DNS failover hostname (`llm-backup`) for operator-directed switchover.
- Bedrock model lanes are intended as:
  - Supervisor: Mistral Small 4.
  - Workers (Security + Vendor Swap): GLM 5.1 (Axolotl tuned).
  - Workers (Get Back on Track): MiniMax M2.7.
- Use Langfuse trace IDs to join execution runs, rollouts, and payout ledgers.
