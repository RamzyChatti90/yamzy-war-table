# ════════════════════════════════════════════════════════════════════
#  WAR TABLE ⚔ — install.ps1
#  Installe l'extension WAR TABLE dans un système YAMZY World existant.
#
#  Usage :
#    iwr -useb https://raw.githubusercontent.com/RamzyChatti90/yamzy-war-table/main/install.ps1 | iex
#
#  Ce que fait le script :
#    1. Clone le repo war-table dans %YAMZY_HOME%/extensions/war-table/
#    2. Télécharge le JAR backend depuis la release GitHub
#    3. Build l'image Docker du frontend
#    4. Lance les 2 conteneurs (backend :8090 + frontend :4201)
#    5. Enregistre l'extension dans le manifest YAMZY (~/.yamzy/extensions.json)
# ════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$ExtensionName = 'war-table'
$RepoUrl = 'https://github.com/RamzyChatti90/yamzy-war-table.git'
$JarVersion = '1.0.0'
$JarUrl = "https://github.com/RamzyChatti90/yamzy-war-table/releases/download/v$JarVersion/war-table-backend-$JarVersion.jar"

# 1. Résoudre YAMZY_HOME
$YamzyHome = if ($env:YAMZY_HOME) { $env:YAMZY_HOME } else { "$env:USERPROFILE\.yamzy" }
$ExtDir = "$YamzyHome\extensions\$ExtensionName"
Write-Host "→ YAMZY_HOME = $YamzyHome" -ForegroundColor Cyan

# 2. Cloner le repo (ou git pull si déjà là)
if (Test-Path $ExtDir) {
  Write-Host "→ Extension déjà installée. Mise à jour…" -ForegroundColor Yellow
  Set-Location $ExtDir
  git pull origin main
} else {
  Write-Host "→ Clone du repo war-table…" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path "$YamzyHome\extensions" | Out-Null
  git clone --depth 1 $RepoUrl $ExtDir
  Set-Location $ExtDir
}

# 3. Télécharger le JAR backend
$JarFile = "$ExtDir\backend\war-table-backend-$JarVersion.jar"
if (-not (Test-Path $JarFile)) {
  Write-Host "→ Téléchargement JAR backend ($JarVersion)…" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path "$ExtDir\backend" | Out-Null
  Invoke-WebRequest -Uri $JarUrl -OutFile $JarFile
}

# 4. Lire le manifest extension.json
$Manifest = Get-Content "$ExtDir\extension.json" -Raw | ConvertFrom-Json
Write-Host "→ Installation $($Manifest.displayName) v$($Manifest.version) par $($Manifest.author)" -ForegroundColor Green

# 5. Lancer Docker Compose
Write-Host "→ Build + start des conteneurs…" -ForegroundColor Cyan
docker compose up -d --build

# 6. Enregistrer dans le manifest YAMZY global
$RegFile = "$YamzyHome\extensions.json"
$Registry = if (Test-Path $RegFile) {
  Get-Content $RegFile -Raw | ConvertFrom-Json
} else { @{ extensions = @() } }

$Already = $Registry.extensions | Where-Object { $_.name -eq $ExtensionName }
if (-not $Already) {
  $Registry.extensions += [PSCustomObject]@{
    name        = $ExtensionName
    displayName = $Manifest.displayName
    version     = $Manifest.version
    installedAt = (Get-Date -Format 'o')
    path        = $ExtDir
    status      = 'running'
    frontendUrl = "http://localhost:$($Manifest.frontend.port)"
    backendUrl  = "http://localhost:$($Manifest.backend.port)"
  }
  $Registry | ConvertTo-Json -Depth 6 | Set-Content $RegFile -Encoding utf8
  Write-Host "✓ Extension enregistrée dans $RegFile" -ForegroundColor Green
}

# 7. Done
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ WAR TABLE ⚔ installé et lancé" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:$($Manifest.frontend.port)/war-table"
Write-Host "  Backend  : http://localhost:$($Manifest.backend.port)/actuator/health"
Write-Host "  Logs     : docker compose -f $ExtDir\docker-compose.yml logs -f"
Write-Host "  Stop     : docker compose -f $ExtDir\docker-compose.yml down"
Write-Host ""
