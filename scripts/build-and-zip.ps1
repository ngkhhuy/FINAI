#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# FINAI – Local build + deployment ZIP
# Builds backend & frontend locally, packages pre-built artifacts for AWS EB.
# Usage:  .\scripts\build-and-zip.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$root = Split-Path $PSScriptRoot -Parent

Write-Host "`n[1/5] Building backend..." -ForegroundColor Cyan
Set-Location "$root\backend"
# Install all deps (including devDeps like typescript) for building
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed"; exit 1 }
Write-Host "    Backend built OK" -ForegroundColor Green

Write-Host "`n[1b] Pruning to production dependencies only..." -ForegroundColor Cyan
# Remove devDeps so only production node_modules go into ZIP
npm prune --omit=dev 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "npm prune failed"; exit 1 }
Write-Host "    Production deps ready OK" -ForegroundColor Green

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

# Use ZipFile API to ensure forward slashes (Linux-compatible) in ZIP entries
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

function Add-FileToZip($archive, $filePath, $entryName) {
    # Always use forward slashes in ZIP entry names
    $entryName = $entryName.Replace('\', '/')
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($filePath)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

function Add-DirToZip($archive, $dirPath, $zipPrefix) {
    $files = Get-ChildItem $dirPath -Recurse -File
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($dirPath.Length + 1)
        $entryName = "$zipPrefix/$relative"
        Add-FileToZip $archive $file.FullName $entryName
    }
}

# Include: .ebextensions/, backend/ (excluding src/ only — node_modules included), Procfile
Add-DirToZip $archive "$root\.ebextensions" ".ebextensions"

# backend: include everything except backend/src/ (TypeScript source not needed)
# NOTE: node_modules/**/src/ must NOT be excluded — many packages need their src/ folder
$backendSrcPath = "$root\backend\src\"
$backendFiles = Get-ChildItem "$root\backend" -Recurse -File | Where-Object {
    -not $_.FullName.StartsWith($backendSrcPath)
}
foreach ($file in $backendFiles) {
    $relative = $file.FullName.Substring("$root\".Length)
    Add-FileToZip $archive $file.FullName $relative
}

# Root files
foreach ($f in @('Procfile', '.gitignore')) {
    $fp = "$root\$f"
    if (Test-Path $fp) { Add-FileToZip $archive $fp $f }
}

$archive.Dispose()
$zipStream.Dispose()

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "    ZIP created: finai-deploy.zip ($sizeMB MB)" -ForegroundColor Green

Write-Host "`n[5/5] Done!" -ForegroundColor Green
Write-Host "    Upload  finai-deploy.zip  to AWS EB Console" -ForegroundColor Yellow
Write-Host "    Or run: eb deploy finai-prod --label v$(Get-Date -Format 'yyyyMMdd-HHmm')`n"
