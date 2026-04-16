param(
  [switch]$SkipPython,
  [switch]$SkipNode,
  [switch]$SkipRust
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found on PATH: $Name"
  }
}

Write-Host "== BountyNet local bootstrap ==" -ForegroundColor Cyan

if (-not $SkipPython) {
  Require-Command "python"
  Write-Host "[python] installing gateway requirements..."
  python -m pip install -r "gateway/requirements.txt"
}

if (-not $SkipNode) {
  Require-Command "npm"
  Write-Host "[node] installing clients/web dependencies..."
  Push-Location "clients/web"
  try {
    npm install
  } finally {
    Pop-Location
  }

  Write-Host "[node] installing console-ui dependencies..."
  Push-Location "projects/agent-market/console-ui"
  try {
    npm install
  } finally {
    Pop-Location
  }
}

if (-not $SkipRust) {
  Require-Command "cargo"
  Write-Host "[rust] prefetching cli dependencies..."
  cargo fetch --manifest-path "clients/cli/Cargo.toml"
}

Write-Host ""
Write-Host "Bootstrap complete." -ForegroundColor Green
Write-Host "Next: scripts/run-local-stack.ps1"
