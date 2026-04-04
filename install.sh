#!/bin/bash
# BountyNet — one-line installer
# curl -fsSL https://bountynet.stare.network/install.sh | bash

set -euo pipefail

INSTALL_DIR="${HOME}/.bountynet/bin"
BINARY="${INSTALL_DIR}/bounty"
GATEWAY="https://gateway.stare.network"

echo "[bountynet] installing..."

mkdir -p "$INSTALL_DIR"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

URL="https://bountynet.stare.network/bounty-${OS}-${ARCH}"

echo "[bountynet] downloading bounty CLI..."
curl -fsSL "$URL" -o "$BINARY"
chmod +x "$BINARY"

# Add to PATH if not already
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$rc" ]; then
      echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$rc"
    fi
  done
  export PATH="$INSTALL_DIR:$PATH"
fi

echo "[bountynet] installed: $BINARY"
echo "[bountynet] joining BountyNet..."

"$BINARY" join --gateway "$GATEWAY"
