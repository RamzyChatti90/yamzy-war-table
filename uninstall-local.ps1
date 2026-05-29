# ════════════════════════════════════════════════════════════════════
#  WAR TABLE ⚔ — uninstall-local.ps1 (arrête + désinscrit)
# ════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'SilentlyContinue'
$YAMZY_HOME = if ($env:YAMZY_HOME) { $env:YAMZY_HOME } else { "$env:USERPROFILE\.yamzy" }
$regFile = "$YAMZY_HOME\extensions.json"

Write-Host "→ Stop processus sur :4201…" -ForegroundColor Cyan
$existing = Get-NetTCPConnection -LocalPort 4201 -ErrorAction SilentlyContinue
if ($existing) {
  $existing | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  Write-Host "  ✓ stoppé" -ForegroundColor Green
}

if (Test-Path $regFile) {
  $registry = Get-Content $regFile -Raw | ConvertFrom-Json
  $registry.extensions = @($registry.extensions | Where-Object { $_.name -ne 'war-table' })
  $registry | ConvertTo-Json -Depth 6 | Set-Content $regFile -Encoding utf8
  Write-Host "✓ désinscrit du registre" -ForegroundColor Green
}
