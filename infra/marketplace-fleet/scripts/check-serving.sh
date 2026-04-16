#!/usr/bin/env bash
set -euo pipefail

curl -fsS http://localhost:8000/health >/dev/null && echo "vllm-base healthy"
curl -fsS http://localhost:8001/health >/dev/null && echo "vllm-specialist healthy"
curl -fsS http://localhost:3001/api/public/health >/dev/null && echo "langfuse healthy"
