param(
  [switch]$SkipTerraform,
  [switch]$SkipCompose
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "== BountyNet infra preflight ==" -ForegroundColor Cyan

if (-not $SkipTerraform) {
  if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    throw "terraform not found on PATH"
  }

  $modules = @(
    "infra/marketplace-fleet/terraform/aws-global-accelerator",
    "infra/marketplace-fleet/terraform/digitalocean-global-dns",
    "infra/marketplace-fleet/terraform/digitalocean-global-lb",
    "infra/marketplace-fleet/terraform/digitalocean-regional-lbs"
  )

  Write-Host "[terraform] fmt check..."
  terraform fmt -check -recursive "infra/marketplace-fleet/terraform"

  foreach ($module in $modules) {
    Write-Host "[terraform] init+validate $module"
    terraform -chdir=$module init -backend=false
    terraform -chdir=$module validate
  }
}

if (-not $SkipCompose) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker not found on PATH"
  }
  Write-Host "[compose] validating docker-compose.soak.yml"
  docker compose -f "docker-compose.soak.yml" config | Out-Null
}

Write-Host "Infra preflight complete." -ForegroundColor Green
