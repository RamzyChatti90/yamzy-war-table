# ════════════════════════════════════════════════════════════════════
#  git-init-and-push.ps1
#  Initialise le repo war-table en local, scan secrets, prépare le push.
#  Signataire : RamzyChatti90 (Yamzy World Wizard)
# ════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'

$GIT_USER_NAME  = 'RamzyChatti90'
$GIT_USER_EMAIL = 'ramzychatti90@users.noreply.github.com'
$GIT_SIGNATURE  = 'Yamzy World Wizard'

Set-Location $PSScriptRoot\..

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git non installé" }

# 1. Init si pas déjà fait
if (-not (Test-Path .git)) {
  Write-Host "→ git init" -ForegroundColor Cyan
  git init -b main
}

# 2. Config local du repo (n'écrase pas le ~/.gitconfig global)
git config user.name  $GIT_USER_NAME
git config user.email $GIT_USER_EMAIL
Write-Host "→ git user : $GIT_USER_NAME <$GIT_USER_EMAIL>" -ForegroundColor Gray

# 3. Installer le pre-commit hook
& "$PSScriptRoot\install-git-hooks.ps1"

# 4. Stage tous les fichiers (le .gitignore exclut les secrets)
Write-Host "→ git add ." -ForegroundColor Cyan
git add .

# 5. Scan anti-secrets sur les staged
$staged = git diff --cached --name-only
$suspectFiles = $staged | Select-String -Pattern "application\.yml$|^\.env$|\.private\." -CaseSensitive:$false
if ($suspectFiles) {
  Write-Host "🚨 STAGED contient des fichiers suspects :" -ForegroundColor Red
  $suspectFiles | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
  Write-Host "Annule avec : git reset HEAD <fichier>" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "→ Fichiers prêts pour commit :" -ForegroundColor Green
git diff --cached --name-only | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host ""

$confirm = Read-Host "Créer le commit initial ? (y/N)"
if ($confirm -ne 'y') { Write-Host "Annulé." -ForegroundColor Yellow; exit 0 }

# 6. Commit — signature Yamzy World Wizard (aucune mention IA)
$msg = @"
feat: initial commit — WAR TABLE Yamzy extension

- Planning Studio standalone (Angular 17, port 4201)
- 42 pages Scrum (Backlog, Sprints, Gantt, Calendrier, etc.)
- Import/export Excel round-trip fidèle (Apache POI)
- SSO bridge JWT avec Yamzy hôte
- Splash screen Planification Temporelle (8 étapes)
- Pagination lazy (5 par page)
- Mode privé local — aucun secret embarqué

Signed-by: $GIT_SIGNATURE
"@

git commit -m $msg

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ Commit créé (auteur : $GIT_USER_NAME)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Push vers GitHub (repo PRIVÉ) :" -ForegroundColor White
Write-Host "  1. Crée le repo VIDE : https://github.com/new" -ForegroundColor Gray
Write-Host "     Nom : yamzy-war-table   Visibility : Private" -ForegroundColor Gray
Write-Host "  2. git remote add origin git@github.com:RamzyChatti90/yamzy-war-table.git" -ForegroundColor Yellow
Write-Host "  3. git push -u origin main" -ForegroundColor Yellow
Write-Host ""
