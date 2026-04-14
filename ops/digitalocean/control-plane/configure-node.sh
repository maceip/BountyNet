#!/usr/bin/env bash
set -euo pipefail

ROOT=/opt/bountynet-control
mkdir -p "$ROOT"

if [ ! -f "$ROOT/.env" ]; then
  echo ".env missing at $ROOT/.env" >&2
  exit 1
fi

cp docker-compose.yml "$ROOT/docker-compose.yml"
cp Caddyfile "$ROOT/Caddyfile"
cp litellm.config.yaml "$ROOT/litellm.config.yaml"

cd "$ROOT"
docker compose pull
docker compose up -d --build
