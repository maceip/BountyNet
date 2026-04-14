param(
  [string]$ProjectSlug = "bountynet-control"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$regions = Get-Content (Join-Path $root "regions.json") | ConvertFrom-Json
$token = $env:DIGITALOCEAN_TOKEN
if (-not $token) {
  throw "DIGITALOCEAN_TOKEN is required"
}

foreach ($region in $regions) {
  $body = @{
    name = "$ProjectSlug-$($region.name)-lb"
    type = "REGIONAL"
    region = $region.region
    size_unit = 1
    tag = $region.tag
    redirect_http_to_https = $true
    enable_proxy_protocol = $false
    enable_backend_keepalive = $true
    forwarding_rules = @(
      @{
        entry_protocol = "http"
        entry_port = 80
        target_protocol = "http"
        target_port = 8090
      },
      @{
        entry_protocol = "https"
        entry_port = 443
        target_protocol = "http"
        target_port = 8090
      }
    )
    health_check = @{
      protocol = "http"
      port = 8090
      path = "/health"
      check_interval_seconds = 10
      response_timeout_seconds = 5
      healthy_threshold = 3
      unhealthy_threshold = 3
    }
    sticky_sessions = @{
      type = "none"
    }
  } | ConvertTo-Json -Depth 8

  Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.digitalocean.com/v2/load_balancers" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $body | Out-Null
}
