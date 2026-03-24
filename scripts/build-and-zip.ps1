#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# FINAI – Local build + deployment ZIP
# Builds backend & frontend locally, packages pre-built artifacts for AWS EB.
# Usage:  .\scripts\build-and-zip.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Write-Host "`n[1/5] Building backend..." -ForegroundColor Cyan
Set-Location "$root\backend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed"; exit 1 }
Write-Host "    Backend built OK" -ForegroundColor Green

Write-Host "`n[2/5] Building frontend..." -ForegroundColor Cyan
Set-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }
Write-Host "    Frontend built OK" -ForegroundColor Green

Write-Host "`n[3/5] Copying frontend dist -> backend/dist/public..." -ForegroundColor Cyan
$dest = "$root\backend\dist\public"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item $dest -ItemType Directory -Force | Out-Null
Copy-Item "$root\frontend\dist\*" $dest -Recurse -Force
Write-Host "    Copied OK" -ForegroundColor Green

Write-Host "`n[4/5] Creating deployment ZIP..." -ForegroundColor Cyan
Set-Location $root

$zipPath = "$root\finai-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Copy everything needed into a temp staging folder, then zip that
$staging = "$env:TEMP\finai-staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item $staging -ItemType Directory -Force | Out-Null

# Folders to include
$include = @('.ebextensions', 'backend', 'Procfile', '.gitignore')

foreach ($item in $include) {
    $src = "$root\$item"
    if (-not (Test-Path $src)) { continue }
    if ((Get-Item $src).PSIsContainer) {
        Copy-Item $src "$staging\$item" -Recurse -Force
    } else {
        Copy-Item $src "$staging\$item" -Force
    }
}

# Remove node_modules from staging (keep backend/dist which has our build)
Get-ChildItem $staging -Recurse -Directory -Filter "node_modules" | Remove-Item -Recurse -Force

# Zip the staging folder contents
Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item $staging -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "    ZIP created: finai-deploy.zip ($sizeMB MB)" -ForegroundColor Green

Write-Host "`n[5/5] Done!" -ForegroundColor Green
Write-Host "    Upload  finai-deploy.zip  to AWS EB Console" -ForegroundColor Yellow
Write-Host "    Or run: eb deploy finai-prod --label v$(Get-Date -Format 'yyyyMMdd-HHmm')`n"
