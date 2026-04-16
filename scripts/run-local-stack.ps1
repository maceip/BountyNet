param(
  [int]$GatewayPort = 8090,
  [int]$ConsolePort = 5174,
  [switch]$DegradedHealth,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "== BountyNet local stack ==" -ForegroundColor Cyan

$gatewayCommand = "set PYTHONPATH=. && set GATEWAY_PORT=$GatewayPort"
if ($DegradedHealth) {
  $gatewayCommand += " && set BOUNTYNET_HEALTH_ALLOW_DEGRADED=1"
}
$gatewayCommand += " && python -m gateway.app"

$consoleCommand = "set VITE_GATEWAY_URL=http://127.0.0.1:$GatewayPort && npm run dev -- --host 127.0.0.1 --port $ConsolePort"

if ($DryRun) {
  Write-Host "[dry-run] gateway command: $gatewayCommand"
  Write-Host "[dry-run] console command: $consoleCommand"
  exit 0
}

Write-Host "[gateway] starting in new terminal on :$GatewayPort"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $gatewayCommand -WorkingDirectory (Get-Location).Path | Out-Null

Write-Host "[console] starting in new terminal on :$ConsolePort"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $consoleCommand -WorkingDirectory (Join-Path (Get-Location).Path "projects/agent-market/console-ui") | Out-Null

Write-Host ""
Write-Host "Started."
Write-Host "Gateway: http://127.0.0.1:$GatewayPort"
Write-Host "Console: http://127.0.0.1:$ConsolePort"
