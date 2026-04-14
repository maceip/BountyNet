param(
  [string]$ProjectSlug = "bountynet-control",
  [string]$DropletSize = "s-4vcpu-8gb",
  [string]$Image = "docker-20-04",
  [string]$SshKeyFingerprint = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$regions = Get-Content (Join-Path $root "regions.json") | ConvertFrom-Json

foreach ($region in $regions) {
  $name = "$ProjectSlug-$($region.name)"
  $tag = $region.tag
  $cmd = @(
    "compute", "droplet", "create", $name,
    "--region", $region.region,
    "--size", $DropletSize,
    "--image", $Image,
    "--tag-name", $tag,
    "--user-data-file", (Join-Path $root "cloud-init.yaml"),
    "--wait",
    "--enable-monitoring",
    "--enable-backups"
  )
  if ($SshKeyFingerprint) {
    $cmd += @("--ssh-keys", $SshKeyFingerprint)
  }
  doctl @cmd
}
