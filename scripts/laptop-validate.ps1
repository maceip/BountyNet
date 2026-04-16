param(
  [switch]$SkipPython,
  [switch]$SkipNode,
  [switch]$SkipRust,
  [switch]$SkipInfra
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found on PATH: $Name"
  }
}

Write-Host "== BountyNet laptop validate ==" -ForegroundColor Cyan

if (-not $SkipPython) {
  Require-Command "python"
  Write-Host "[python] running targeted gateway tests..."
  python -m pytest `
    "gateway/tests/test_contract.py::test_health_on_asgi_stack" `
    "gateway/tests/test_contract.py::test_health_degraded_mode_without_rpc" `
    "gateway/tests/test_ops_env.py"

  Write-Host "[python] running local dev surface smoke..."
  python "scripts/simulate_dev_surface.py"
}

if (-not $SkipNode) {
  Require-Command "npm"
  Write-Host "[node] building clients/web..."
  Push-Location "clients/web"
  try {
    npm install
    npm run build
  } finally {
    Pop-Location
  }

  Write-Host "[node] building projects/agent-market/console-ui..."
  Push-Location "projects/agent-market/console-ui"
  try {
    npm install
    npm run build
  } finally {
    Pop-Location
  }
}

if (-not $SkipRust) {
  Require-Command "cargo"
  Write-Host "[rust] testing clients/cli..."
  cargo test --manifest-path "clients/cli/Cargo.toml"
}

if (-not $SkipInfra) {
  Write-Host "[infra] running deploy preflight..."
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/preflight-infra.ps1"
}

Write-Host ""
Write-Host "Laptop validation complete." -ForegroundColor Green
