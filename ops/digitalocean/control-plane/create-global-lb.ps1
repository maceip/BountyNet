param(
  [string]$Name = "bountynet-control-global"
)

$ErrorActionPreference = "Stop"
$token = $env:DIGITALOCEAN_TOKEN
if (-not $token) {
  throw "DIGITALOCEAN_TOKEN is required"
}

$headers = @{ Authorization = "Bearer $token" }
$lbs = (Invoke-RestMethod -Method Get -Uri "https://api.digitalocean.com/v2/load_balancers" -Headers $headers).load_balancers
$regional = @($lbs | Where-Object { $_.name -like "bountynet-control-*-lb" })

if (-not $regional.Count) {
  throw "No regional load balancers found"
}

$priorities = @{}
$priority = 1
foreach ($lb in $regional) {
  if ($lb.region.slug) {
    $priorities[$lb.region.slug] = $priority
    $priority += 1
  }
}

$body = @{
  name = $Name
  type = "GLOBAL"
  region = "global"
  regional_load_balancers = @($regional | ForEach-Object { $_.id })
  region_priorities = $priorities
  failure_threshold = 50
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.digitalocean.com/v2/load_balancers" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
