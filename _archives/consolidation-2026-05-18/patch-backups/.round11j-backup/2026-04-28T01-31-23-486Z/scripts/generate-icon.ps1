Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Assets = Join-Path $Root "assets"
$Build = Join-Path $Root "build"

function Assert-Exists {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing required branding asset: $Path"
  }
}

Write-Host "DCC branding lock"
Write-Host "Project: $Root"
Write-Host "Mode: preserve canonical assets; no icon regeneration"

New-Item -ItemType Directory -Force -Path $Assets | Out-Null
New-Item -ItemType Directory -Force -Path $Build | Out-Null

$RequiredAssets = @(
  "dcc.ico",
  "icon.png",
  "dcc-logo.png",
  "installerHeader.bmp",
  "installerSidebar.bmp"
)

foreach ($Asset in $RequiredAssets) {
  Assert-Exists (Join-Path $Assets $Asset)
}

Copy-Item -LiteralPath (Join-Path $Assets "installerHeader.bmp") -Destination (Join-Path $Build "installerHeader.bmp") -Force
Copy-Item -LiteralPath (Join-Path $Assets "installerSidebar.bmp") -Destination (Join-Path $Build "installerSidebar.bmp") -Force

Write-Host "[OK] assets/dcc.ico preserved"
Write-Host "[OK] assets/icon.png preserved"
Write-Host "[OK] assets/dcc-logo.png preserved"
Write-Host "[OK] installer BMPs synced from assets/ to build/"
Write-Host "[OK] old generated DCC icon routine disabled"
