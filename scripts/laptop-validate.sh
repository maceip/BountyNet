#!/usr/bin/env bash
set -euo pipefail

SKIP_PYTHON=0
SKIP_NODE=0
SKIP_RUST=0
SKIP_INFRA=0

for arg in "$@"; do
  case "$arg" in
    --skip-python) SKIP_PYTHON=1 ;;
    --skip-node) SKIP_NODE=1 ;;
    --skip-rust) SKIP_RUST=1 ;;
    --skip-infra) SKIP_INFRA=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found on PATH: $1" >&2
    exit 1
  fi
}

echo "== BountyNet laptop validate =="

if [[ "$SKIP_PYTHON" -eq 0 ]]; then
  require_cmd python
  echo "[python] running targeted gateway tests..."
  python -m pytest \
    gateway/tests/test_contract.py::test_health_on_asgi_stack \
    gateway/tests/test_contract.py::test_health_degraded_mode_without_rpc \
    gateway/tests/test_ops_env.py

  echo "[python] running local dev surface smoke..."
  python scripts/simulate_dev_surface.py
fi

if [[ "$SKIP_NODE" -eq 0 ]]; then
  require_cmd npm
  echo "[node] building clients/web..."
  (cd clients/web && npm install && npm run build)

  echo "[node] building projects/agent-market/console-ui..."
  (cd projects/agent-market/console-ui && npm install && npm run build)
fi

if [[ "$SKIP_RUST" -eq 0 ]]; then
  require_cmd cargo
  echo "[rust] testing clients/cli..."
  cargo test --manifest-path clients/cli/Cargo.toml
fi

if [[ "$SKIP_INFRA" -eq 0 ]]; then
  echo "[infra] running deploy preflight..."
  ./scripts/preflight-infra.sh
fi

echo
echo "Laptop validation complete."
