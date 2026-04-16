#!/usr/bin/env bash
# POSIX-oriented bootstrap for macOS/Linux developer laptops.
set -euo pipefail

SKIP_PYTHON=0
SKIP_NODE=0
SKIP_RUST=0

for arg in "$@"; do
  case "$arg" in
    --skip-python) SKIP_PYTHON=1 ;;
    --skip-node) SKIP_NODE=1 ;;
    --skip-rust) SKIP_RUST=1 ;;
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

echo "== BountyNet local bootstrap =="

if [[ "$SKIP_PYTHON" -eq 0 ]]; then
  require_cmd python
  echo "[python] installing gateway requirements..."
  python -m pip install -r gateway/requirements.txt
fi

if [[ "$SKIP_NODE" -eq 0 ]]; then
  require_cmd npm
  echo "[node] installing clients/web dependencies..."
  (cd clients/web && npm install)

  echo "[node] installing console-ui dependencies..."
  (cd projects/agent-market/console-ui && npm install)
fi

if [[ "$SKIP_RUST" -eq 0 ]]; then
  require_cmd cargo
  echo "[rust] prefetching cli dependencies..."
  cargo fetch --manifest-path clients/cli/Cargo.toml
fi

echo
echo "Bootstrap complete."
echo "Next: ./scripts/run-local-stack.sh"
