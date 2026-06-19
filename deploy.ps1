# deploy.ps1 - one-click publish for Ramsay Gardens Cafe
# Stages everything, commits, and pushes to GitHub.
# Netlify is connected to the GitHub repo, so the push auto-triggers a deploy.
#
# Usage:
#   Right-click > "Run with PowerShell", or double-click deploy.cmd,
#   or from a terminal:  .\deploy.ps1 "optional commit message"

param(
    [string]$Message
)

$ErrorActionPreference = "Stop"

# Always work from the folder this script lives in
Set-Location -Path $PSScriptRoot

Write-Host "Checking for changes..." -ForegroundColor Cyan

# Stage all changes (new, modified, deleted)
git add -A

# Is there anything to commit?
$pending = git status --porcelain
if ([string]::IsNullOrWhiteSpace($pending)) {
    Write-Host "Nothing to deploy - working tree is clean." -ForegroundColor Yellow
    exit 0
}

# Build a commit message
if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "Update site - " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

Write-Host "Committing: $Message" -ForegroundColor Cyan
git commit -m $Message

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "Done. Netlify will build and publish in ~1 minute." -ForegroundColor Green
