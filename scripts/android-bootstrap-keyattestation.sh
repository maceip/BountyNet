#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git submodule update --init --depth 1 clients/android/third_party/keyattestation
python3 "$ROOT/scripts/patch-keyattestation-gradle.py"
echo "android/keyattestation submodule ready (kotlin plugin patched for composite build)."
