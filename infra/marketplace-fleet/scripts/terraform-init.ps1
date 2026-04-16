$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StackDir = Join-Path $ScriptDir "..\\terraform"

if (-not $env:TF_PLUGIN_CACHE_DIR -or [string]::IsNullOrWhiteSpace($env:TF_PLUGIN_CACHE_DIR)) {
  $cacheRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME "AppData\\Local" }
  $env:TF_PLUGIN_CACHE_DIR = Join-Path $cacheRoot "BountyNet\\terraform-providers"
}

New-Item -ItemType Directory -Force -Path $env:TF_PLUGIN_CACHE_DIR | Out-Null
Set-Location $StackDir
terraform init @args
