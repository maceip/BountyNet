#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="bountynet-marketplace"

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/vllm-base.yaml
kubectl apply -f k8s/vllm-speculative.yaml

helm repo add langfuse https://langfuse.github.io/langfuse-k8s || true
helm repo update

helm upgrade --install langfuse langfuse/langfuse \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  -f k8s/langfuse-values.yaml

echo "Bootstrap deployment complete."
