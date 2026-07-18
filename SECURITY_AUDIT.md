# BountyNet Security Audit — Ops, Infra & Deployment

**Date:** 2026-07-18
**Scope:** `ops/`, `infra/`, `docker/`, `scripts/`, CI/CD workflows, gateway auth

> Excludes previously reported issues: Terraform 0.0.0.0/0 SSH/inference defaults,
> hardcoded Langfuse DB credentials, self-hosted runner Docker socket/sudo,
> adapter router unauthenticated endpoints, Oracle TEE signing without auth.

---

## Finding 1 — API Keys Written in Plaintext to EC2 User-Data (Visible in Instance Metadata)

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Location** | `infra/marketplace-fleet/terraform/aws-inf2-serving/cloud-init.tftpl:13-23` |
| **Also affects** | `infra/marketplace-fleet/terraform/aws-c8g-llamacpp/cloud-init.tftpl:19-27` |
| **Title** | Sensitive API key baked into EC2 user-data in cleartext |
| **Evidence** | `cloud-init.tftpl` line 16: `VLLM_API_KEY=${api_key}` is rendered by `templatefile()` in `main.tf:141-150` and passed as `user_data` on the `aws_instance` resource. The variable `api_key` is marked `sensitive = true` in Terraform but the rendered user-data is stored as-is in the EC2 instance metadata service (IMDS). |
| **Attack path** | 1. Any process on the EC2 host (or any container with host networking) can query `http://169.254.169.254/latest/user-data` to retrieve the full cloud-init script, including the plaintext `VLLM_API_KEY`. 2. If IMDS v1 is not disabled (no `metadata_options` block in `main.tf`), any SSRF from any workload on the instance leaks the key. 3. The API key grants full inference access to the model endpoint. |
| **Impact** | Credential theft via IMDS. Attacker gains unrestricted access to the model serving endpoint, enabling prompt injection, data exfiltration via model, and compute abuse. |
| **Remediation** | 1. Pull secrets from AWS Secrets Manager or SSM Parameter Store at boot instead of embedding in user-data. 2. Add `metadata_options { http_tokens = "required", http_endpoint = "enabled" }` to enforce IMDSv2 and limit blast radius. |

---

## Finding 2 — EC2 Instances Lack IMDSv2 Enforcement

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Location** | `infra/marketplace-fleet/terraform/aws-inf2-serving/main.tf:132-165` |
| **Also affects** | `infra/marketplace-fleet/terraform/aws-c8g-llamacpp/main.tf:132-164` |
| **Title** | No `metadata_options` block — IMDS v1 enabled by default |
| **Evidence** | Neither `aws_instance.serving` resource block contains a `metadata_options` stanza. AWS defaults to IMDSv1 (no token required). |
| **Attack path** | 1. An SSRF vulnerability in any container running on the host (vLLM, adapter-router Flask, any future sidecar) allows an attacker to reach `http://169.254.169.254/`. 2. With IMDSv1, a single GET retrieves the instance IAM role credentials (`iam/security-credentials/<role>`). 3. The attached IAM role has `s3:GetObject` on the adapter/model bucket — attacker can exfiltrate model weights and adapter artifacts. |
| **Impact** | Full instance role credential theft via SSRF. Access to S3 model/adapter buckets, SSM, and any other services the role can reach. |
| **Remediation** | Add `metadata_options { http_tokens = "required"; http_put_response_hop_limit = 1; http_endpoint = "enabled" }` to both `aws_instance` resources. |

---

## Finding 3 — Cloud-Init Installs Docker via Piped curl-to-shell Over the Internet

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `ops/aws/c8g-llamacpp/cloud-init.yaml:12`, `ops/aws/inf2-serving/cloud-init.yaml:11`, `ops/aws/vllm/cloud-init.yaml:10`, `ops/digitalocean/control-plane/cloud-init.yaml:11`, `infra/marketplace-fleet/terraform/aws-inf2-serving/cloud-init.tftpl:7`, `infra/marketplace-fleet/terraform/aws-c8g-llamacpp/cloud-init.tftpl:7` |
| **Title** | `curl \| sh` pattern for Docker install without integrity verification |
| **Evidence** | All cloud-init scripts run: `curl -fsSL https://get.docker.com \| sh`. The Foundry toolchain install in `docker/soak/Dockerfile:20` uses the same pattern: `curl -L https://foundry.paradigm.xyz \| bash`. |
| **Attack path** | 1. DNS hijack, BGP hijack, or TLS interception of `get.docker.com` (or `foundry.paradigm.xyz`) during instance boot. 2. Attacker-controlled script executes as root, gaining full host compromise. 3. In the Terraform cloud-init templates this runs on production infrastructure at first boot — a narrow but real supply chain vector. |
| **Impact** | Full host compromise during provisioning. All secrets and workloads on the instance are exposed. |
| **Remediation** | Pin Docker and Foundry versions. Use OS package managers (`apt-get install docker-ce=<version>`) with GPG-verified APT repos, or download binaries with SHA256 checksum verification. |

---

## Finding 4 — DigitalOcean Edge Droplets Write Secrets to Cloud-Init User-Data

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Location** | `infra/marketplace-fleet/terraform/digitalocean-regional-lbs/main.tf:56-66` |
| **Title** | LiteLLM master key and salt key embedded in droplet user-data |
| **Evidence** | Lines 57-58 of the cloud-init heredoc: `LITELLM_MASTER_KEY=${var.litellm_master_key}` and `LITELLM_SALT_KEY=${var.litellm_salt_key}`. These are written to `/opt/bountynet/.env` via `write_files`. DigitalOcean user-data is readable via the metadata endpoint at `http://169.254.169.254/metadata/v1/user-data` from any process on the droplet. |
| **Attack path** | 1. Any process on the droplet (LiteLLM container, Redis, any compromised workload) can read the metadata endpoint. 2. The `LITELLM_MASTER_KEY` is the admin credential for the LiteLLM proxy — it controls API key creation, model routing, and configuration. 3. Attacker with the master key can add their own API keys, route traffic through attacker-controlled models, or exfiltrate all proxied API keys. |
| **Impact** | Full LiteLLM admin takeover. Ability to intercept and redirect all inference traffic across the fleet. |
| **Remediation** | Use DigitalOcean's managed secrets/vault, or the existing AWS SSM sync mechanism (already partially implemented in `sync-secrets.sh`) to inject secrets post-boot rather than in user-data. |

---

## Finding 5 — Kubernetes Manifests Hardcode API Key in Pod Spec Args

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Location** | `infra/marketplace-fleet/k8s/vllm-base.yaml:27` |
| **Also affects** | `infra/marketplace-fleet/k8s/vllm-speculative.yaml:27` |
| **Title** | `--api-key replace-with-strong-key` hardcoded in container args |
| **Evidence** | Both vLLM Deployment manifests set `args: [..., "--api-key", "replace-with-strong-key", ...]` as literal strings in the pod spec. These manifests are committed to the repository. |
| **Attack path** | 1. The placeholder value `replace-with-strong-key` is likely deployed as-is (it's the default, and there's no Secret or ConfigMap reference to override it). 2. Anyone with cluster network access (other pods, services) can call the vLLM inference API with this known key. 3. If the Service is exposed via Ingress/LB, the key is effectively public. |
| **Impact** | Unauthenticated inference access. Compute abuse, prompt injection, model weight exfiltration via crafted queries. |
| **Remediation** | Use a Kubernetes Secret for the API key and reference it via `env` + `valueFrom.secretKeyRef`, then pass it as `$(VLLM_API_KEY)` in args. |

---

## Finding 6 — Kubernetes Deployments Run Without Security Context

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `infra/marketplace-fleet/k8s/vllm-base.yaml:15-49` |
| **Also affects** | `infra/marketplace-fleet/k8s/vllm-speculative.yaml:15-53` |
| **Title** | No `securityContext` — containers run as root with full capabilities |
| **Evidence** | Neither Deployment spec includes `securityContext` at pod or container level. The vLLM image runs as root by default. No `readOnlyRootFilesystem`, `runAsNonRoot`, `allowPrivilegeEscalation`, or capability drop is set. No `NetworkPolicy` exists in the namespace. |
| **Attack path** | 1. A vulnerability in vLLM (or any dependency) gives the attacker a shell as root inside the container. 2. With full Linux capabilities and writable root filesystem, the attacker can install tools, pivot to the node (especially if the container has `hostPID`, `hostNetwork`, or a mounted service account token with elevated RBAC). 3. No NetworkPolicy means all pods in the namespace can communicate freely. |
| **Impact** | Container escape risk. Lateral movement within the Kubernetes cluster. |
| **Remediation** | Add `securityContext: { runAsNonRoot: true, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, capabilities: { drop: ["ALL"] } }`. Create a `NetworkPolicy` restricting traffic to required paths. |

---

## Finding 7 — `BOUNTYNET_DEV_SKIP_JWT_VERIFICATION` Baked into Soak Docker Image

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `docker/soak/Dockerfile:33-34` |
| **Title** | Auth bypass flags hardcoded as ENV in a publishable Docker image |
| **Evidence** | Lines 33-34: `ENV BOUNTYNET_DEV_SKIP_JWT_VERIFICATION=1` and `ENV BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY=1`. These environment variables are baked into the image at build time. |
| **Attack path** | 1. If this image (or a derivative) is accidentally deployed to staging or production, all JWT authentication is bypassed. 2. The `gateway/auth.py:23-26` `_allow_unverified_jwt()` function checks for this env var and returns a hardcoded `{"sub": "local-dev"}` claim set. 3. An attacker can access any protected route without any token. |
| **Impact** | Complete authentication bypass if the soak image is deployed outside of testing. |
| **Remediation** | Do not set these as `ENV` in Dockerfiles. Pass them only at `docker run` time via `-e` flags for test runs. Add CI guardrails to prevent deployment of images containing dev bypass flags. |

---

## Finding 8 — Bootstrap Admin Endpoint Grants Admin Without Secret When Unset

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Location** | `gateway/auth_stack.py:562-563` |
| **Title** | `/auth/bootstrap/admin` grants admin role when `BOUNTYNET_AUTH_BOOTSTRAP_SECRET` is empty |
| **Evidence** | Line 562: `if _AUTH_BOOTSTRAP_SECRET and secret != _AUTH_BOOTSTRAP_SECRET:`. When `BOUNTYNET_AUTH_BOOTSTRAP_SECRET` is unset or empty (the default in `.env.sample`), the `_AUTH_BOOTSTRAP_SECRET` is falsy, so the entire check is skipped. Any unauthenticated POST to `/auth/bootstrap/admin` with an `identifier_value` will create or find a principal and grant it the `admin` role. |
| **Attack path** | 1. Attacker sends `POST /auth/bootstrap/admin {"identifier_kind": "email", "identifier_value": "attacker@evil.com"}`. 2. With no bootstrap secret configured, the check at line 562 passes. 3. The attacker's identifier receives the `admin` role with `scope: "*"`. 4. The attacker can now call any admin-protected endpoint. |
| **Impact** | Unauthenticated privilege escalation to admin. Full control over the gateway: user management, bounties, agent dispatch. |
| **Remediation** | Require `_AUTH_BOOTSTRAP_SECRET` to be set (fail closed). If empty, reject all bootstrap requests with 403. Add rate limiting on this endpoint. Consider making the endpoint available only via a CLI flag or internal network. |

---

## Finding 9 — Magic Link Token Echoed in API Response by Default

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `gateway/auth_stack.py:29,485-486` |
| **Title** | `BOUNTYNET_DEV_MAGIC_LINK_ECHO` defaults to `"1"`, leaking magic link tokens in HTTP responses |
| **Evidence** | Line 29: `_MAGIC_LINK_DEV_ECHO = os.getenv("BOUNTYNET_DEV_MAGIC_LINK_ECHO", "1").lower() in {"1", "true", "yes"}`. Default is `"1"` (enabled). Lines 485-486: `if _MAGIC_LINK_DEV_ECHO: response["dev_magic_link_token"] = token`. |
| **Attack path** | 1. In production, if `BOUNTYNET_DEV_MAGIC_LINK_ECHO` is not explicitly set to `0`, the magic link token is returned in the API response body. 2. Any man-in-the-middle, proxy log, or response logger captures the token. 3. Attacker uses the token to authenticate as the target user via `/auth/magic-link/consume`. |
| **Impact** | Account takeover. Any user whose magic link request is observed can be impersonated. |
| **Remediation** | Change default to `"0"`. Magic link tokens should only be delivered via email in production. |

---

## Finding 10 — DigitalOcean Load Balancers Use TCP-Mode Without TLS Termination

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `infra/marketplace-fleet/terraform/digitalocean-regional-lbs/main.tf:191-195` |
| **Also affects** | `infra/marketplace-fleet/terraform/digitalocean-global-lb/main.tf:5-9,27-31` |
| **Title** | LB forwarding rules use `tcp` protocol — no TLS termination at the LB |
| **Evidence** | Regional LB: `entry_protocol = "tcp"`, `target_protocol = "tcp"` on port 443. Global LBs: same pattern. When `entry_protocol` is `tcp`, the DigitalOcean LB performs raw TCP passthrough — it does not terminate TLS. The backend must handle TLS, but the droplet runs a bare LiteLLM container on port 4000 with no TLS configuration. |
| **Attack path** | 1. Traffic between clients and the LB, and between the LB and droplets, transits in cleartext. 2. Inference requests (containing prompts, API keys in headers, and model responses) are visible to network observers. 3. The Caddy-based control plane deployment handles TLS correctly, but the Terraform-provisioned edge fleet does not. |
| **Impact** | Cleartext transmission of API keys, prompts, and model responses across the public internet. |
| **Remediation** | Use `entry_protocol = "https"` with a DO-managed certificate, or ensure the backend containers terminate TLS. Alternatively, deploy a TLS-terminating reverse proxy (Caddy/nginx) on each droplet. |

---

## Finding 11 — Redis on Edge Droplets Has No Authentication

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `infra/marketplace-fleet/terraform/digitalocean-regional-lbs/main.tf:50-51,167-169` |
| **Title** | Redis installed and used without `requirepass` on edge nodes |
| **Evidence** | Cloud-init installs `redis-server` (line 50) and starts it (lines 167-169). The LiteLLM config references `redis_host: "127.0.0.1"` with `redis_port: 6379` but no `redis_password`. The DO control-plane `docker-compose.yml` does use `--requirepass`, but the Terraform-provisioned edge droplets do not. |
| **Attack path** | 1. If any service on the droplet is compromised, the attacker can connect to Redis on localhost without authentication. 2. Redis stores LiteLLM routing state, rate limiting data, and possibly cached API keys. 3. Attacker can flush Redis to disrupt service, or read cached data. |
| **Impact** | Data exposure and service disruption. Cached credentials and routing state accessible without authentication. |
| **Remediation** | Configure Redis with `requirepass` and reference the password in the LiteLLM config via environment variable. |

---

## Finding 12 — vLLM Containers Mount Host HuggingFace Cache as Root-Writable

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `ops/aws/inf2-serving/docker-compose.yml:25`, `ops/aws/vllm/docker-compose.yml:27-28` |
| **Also affects** | `infra/marketplace-fleet/terraform/aws-inf2-serving/cloud-init.tftpl:144` |
| **Title** | Host path `~/.cache/huggingface` (or `/root/.cache/huggingface`) mounted read-write into containers |
| **Evidence** | `volumes: - ~/.cache/huggingface:/root/.cache/huggingface` (no `:ro` flag). The Terraform cloud-init template mounts `/root/.cache/huggingface:/root/.cache/huggingface` with no read-only constraint. |
| **Attack path** | 1. If the vLLM container is compromised, the attacker has read-write access to the host's HuggingFace cache. 2. The cache may contain `HF_TOKEN` credentials in `~/.cache/huggingface/token`. 3. Attacker can write a malicious model to the cache, which will be loaded on next restart — achieving persistent model poisoning. |
| **Impact** | HuggingFace token theft. Persistent model supply chain attack via cache poisoning. |
| **Remediation** | Mount the volume as read-only (`:ro`). Store HF tokens in a secrets manager, not in the filesystem cache. |

---

## Finding 13 — `train-specialist.sh` Mounts `/tmp` Into Training Container

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `infra/marketplace-fleet/scripts/train-specialist.sh:46-47` |
| **Title** | Host `/tmp` mounted into Axolotl training container |
| **Evidence** | Line 46-47: `docker compose run --rm -v /tmp:/tmp axolotl-trainer ...`. The host's `/tmp` directory is shared with the training container. |
| **Attack path** | 1. If the training data or model is malicious (the training data is synced from S3 via `train-weekly-adapters.sh`), code execution during training can read/write arbitrary files in the host's `/tmp`. 2. Other processes on the host that use `/tmp` for temporary files (config files, scripts, credentials) are exposed. 3. Symlink attacks in `/tmp` can be leveraged to read/write outside `/tmp` depending on host processes. |
| **Impact** | Host filesystem exposure. Potential for privilege escalation via symlink races or credential theft from `/tmp`. |
| **Remediation** | Use a dedicated temporary volume instead of mounting host `/tmp`. If `/tmp` sharing is required, use a bind-mount to a dedicated directory. |

---

## Finding 14 — `env-sync` Stores All Secrets Under Fixed `/hackathon` SSM Prefix

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `infra/env-sync:14` |
| **Title** | All environments share a single, hardcoded SSM prefix with no access isolation |
| **Evidence** | Line 14: `PREFIX="/hackathon"`. The `push` command writes all `.env` keys under `/hackathon/*` in a single AWS region. The `pull` command retrieves all parameters under this prefix. There is no per-environment or per-service scoping. |
| **Attack path** | 1. Any team member or CI job with IAM access to SSM `GetParameter` on `/hackathon/*` can read all secrets for all services and environments. 2. Running `env-sync pull` on a developer laptop retrieves production API keys, database credentials, and signing keys. 3. No audit trail distinguishes which service or environment a secret belongs to. |
| **Impact** | Cross-environment secret leakage. A compromised developer machine exposes all production secrets. |
| **Remediation** | Use environment-scoped prefixes (e.g., `/bountynet/prod/gateway/`, `/bountynet/dev/oracle/`). Apply IAM policies that restrict `ssm:GetParameter` to specific prefixes per role/service. |

---

## Finding 15 — Gateway Dockerfile Runs as Root

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `docker/gateway/Dockerfile:1-17` |
| **Title** | Gateway container runs as root (no `USER` directive) |
| **Evidence** | The Dockerfile uses `FROM python:3.12-slim` and never switches to a non-root user. The `CMD` runs `python -m gateway.app` as PID 1 as root. |
| **Attack path** | 1. A vulnerability in the gateway application (Flask, any dependency) gives the attacker a root shell inside the container. 2. With root access, the attacker can read all environment variables (API keys, DB credentials), modify the application, and potentially escape the container (depending on runtime configuration). |
| **Impact** | Increased blast radius from application-level vulnerabilities. |
| **Remediation** | Add `RUN useradd -r -s /bin/false appuser` and `USER appuser` before the `CMD` directive. Ensure the application directory is owned by the non-root user. |

---

## Finding 16 — Langfuse Helm Values Contain Hardcoded Default Credentials

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `infra/marketplace-fleet/k8s/langfuse-values.yaml:4-6,13-14,22-23` |
| **Title** | Helm values use `replace-with-*` placeholder secrets and hardcoded `langfuse/langfuse` DB credentials |
| **Evidence** | Lines 4-6: `secret: replace-with-strong-secret`, `salt: replace-with-random-salt`, `encryptionKey: replace-with-strong-key`. Lines 13-14: `username: langfuse`, `password: langfuse`. Lines 22-23: ClickHouse `username: langfuse`, `password: langfuse`. These are committed to the repository and used by `deploy.sh`. |
| **Attack path** | 1. If deployed without overriding values (which `deploy.sh` does not do — it uses `-f k8s/langfuse-values.yaml` directly), all Langfuse instances share the same predictable credentials. 2. `replace-with-strong-secret` as `NEXTAUTH_SECRET` means JWT tokens are forged trivially. 3. Anyone with cluster network access can connect to PostgreSQL/ClickHouse with `langfuse:langfuse`. |
| **Impact** | Langfuse authentication bypass. Database access with known credentials. JWT forgery. |
| **Remediation** | Use Kubernetes Secrets or Helm `--set` flags from a secrets manager to inject credentials at deploy time. Do not commit credentials in values files. |

---

## Summary

| # | Severity | Title |
|---|---|---|
| 1 | HIGH | API keys in plaintext EC2 user-data (IMDS readable) |
| 2 | HIGH | EC2 instances lack IMDSv2 enforcement |
| 3 | MEDIUM | curl-pipe-to-shell Docker install without integrity check |
| 4 | HIGH | DigitalOcean droplet user-data contains LiteLLM master key |
| 5 | HIGH | K8s manifests hardcode `replace-with-strong-key` as API key |
| 6 | MEDIUM | K8s deployments run without securityContext |
| 7 | MEDIUM | Auth bypass env vars baked into soak Docker image |
| 8 | HIGH | Bootstrap admin endpoint grants admin when secret is unset |
| 9 | MEDIUM | Magic link token echoed in API response by default |
| 10 | MEDIUM | DO load balancers use TCP mode without TLS termination |
| 11 | MEDIUM | Redis on edge droplets has no authentication |
| 12 | MEDIUM | Host HuggingFace cache mounted read-write into containers |
| 13 | LOW | Host `/tmp` mounted into training container |
| 14 | MEDIUM | `env-sync` uses single hardcoded SSM prefix for all envs |
| 15 | LOW | Gateway Dockerfile runs as root |
| 16 | MEDIUM | Langfuse Helm values contain hardcoded default credentials |
