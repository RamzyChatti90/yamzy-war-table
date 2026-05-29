# ════════════════════════════════════════════════════════════════════
#  WAR TABLE ⚔ — install-local.ps1
#
#  Mode privé / local : pas de git clone, pas de Docker, pas de JAR.
#  L'extension utilise le backend Yamzy World existant sur :8080.
#  Le frontend tourne en mode dev Angular sur :4201.
#
#  Usage :  .\install-local.ps1
#
#  Ce que fait le script :
#    1. Vérifie node + npm + backend Yamzy (:8080)
#    2. npm install si node_modules absent
#    3. Lance ng serve --port 4201 en arrière-plan
#    4. Attend que :4201 réponde
#    5. Enregistre l'extension dans ~/.yamzy/extensions.json
#    6. Ouvre http://localhost:4201/war-table avec bridge SSO
# ════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$EXT_NAME = 'war-table'
$EXT_DIR = $PSScriptRoot
$YAMZY_HOME = if ($env:YAMZY_HOME) { $env:YAMZY_HOME } else { "$env:USERPROFILE\.yamzy" }

Write-Host ""
Write-Host "═══ WAR TABLE ⚔ — INSTALL LOCAL ═══" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifs
Write-Host "→ Vérification des prérequis…" -ForegroundColor Cyan
try { node --version | Out-Null } catch { throw "Node.js requis (v18+). Install : https://nodejs.org" }
try { npm --version  | Out-Null } catch { throw "npm requis (vient avec Node)." }

# Backend Yamzy World ?
Write-Host "→ Test backend Yamzy World (:8080)…" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 3 -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw "non OK" }
  Write-Host "  ✓ backend up" -ForegroundColor Green
} catch {
  Write-Host "  ⚠ backend Yamzy World non joignable sur :8080" -ForegroundColor Yellow
  Write-Host "    Lance-le d'abord : cd ../backend && mvn spring-boot:run" -ForegroundColor Yellow
  $r = Read-Host "  Continuer quand même ? (y/N)"
  if ($r -ne 'y') { exit 1 }
}

# 2. npm install si besoin
Set-Location $EXT_DIR
if (-not (Test-Path "$EXT_DIR\node_modules")) {
  Write-Host "→ npm install (peut prendre 1-2 min)…" -ForegroundColor Cyan
  npm install --no-audit --no-fund
}

# 3. Tuer un éventuel serveur déjà sur :4201
Write-Host "→ Nettoyage port 4201…" -ForegroundColor Cyan
$existing = Get-NetTCPConnection -LocalPort 4201 -ErrorAction SilentlyContinue
if ($existing) {
  $existing | ForEach-Object {
    try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
  }
  Start-Sleep -Seconds 1
}

# 4. Lancer ng serve en arrière-plan (job PowerShell)
Write-Host "→ Lancement du frontend (ng serve --port 4201)…" -ForegroundColor Cyan
$logFile = "$EXT_DIR\ng-serve.log"
$job = Start-Process -FilePath 'cmd' -ArgumentList "/c", "npm start > `"$logFile`" 2>&1" -WorkingDirectory $EXT_DIR -PassThru -WindowStyle Hidden
Write-Host "  PID : $($job.Id) · log : $logFile" -ForegroundColor Gray

# 5. Attendre :4201
Write-Host "→ Attente que :4201 réponde…" -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest -Uri 'http://localhost:4201/' -TimeoutSec 2 -UseBasicParsing | Out-Null
    $ready = $true; break
  } catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) {
  Write-Host "  ⚠ :4201 pas encore prêt (vérifie $logFile)" -ForegroundColor Yellow
} else {
  Write-Host "  ✓ :4201 répond" -ForegroundColor Green
}

# 6. Registry
New-Item -ItemType Directory -Force -Path $YAMZY_HOME | Out-Null
$regFile = "$YAMZY_HOME\extensions.json"
$registry = if (Test-Path $regFile) {
  Get-Content $regFile -Raw | ConvertFrom-Json
} else { @{ extensions = @() } }

$entry = [PSCustomObject]@{
  name        = $EXT_NAME
  displayName = 'WAR TABLE ⚔'
  version     = '1.0.0-private'
  visibility  = 'private'
  installedAt = (Get-Date -Format 'o')
  path        = $EXT_DIR
  status      = if ($ready) { 'running' } else { 'starting' }
  pid         = $job.Id
  frontendUrl = 'http://localhost:4201'
  route       = '/war-table'
  logFile     = $logFile
}
$registry.extensions = @($registry.extensions | Where-Object { $_.name -ne $EXT_NAME }) + $entry
$registry | ConvertTo-Json -Depth 6 | Set-Content $regFile -Encoding utf8

# 7. Done
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ WAR TABLE ⚔ installé et lancé en local (privé)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:4201/war-table" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8080 (Yamzy World partagé)" -ForegroundColor White
Write-Host "  Logs     : Get-Content $logFile -Wait" -ForegroundColor White
Write-Host "  Stop     : .\uninstall-local.ps1" -ForegroundColor White
Write-Host ""

# 8. Auto-open avec SSO bridge
if ($ready) {
  Write-Host "→ Ouverture du studio avec bridge SSO…" -ForegroundColor Cyan
  Start-Process 'http://localhost:4200/auth/bridge?return=http://localhost:4201/war-table'
}
