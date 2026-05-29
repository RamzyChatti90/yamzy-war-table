# ════════════════════════════════════════════════════════════════════
#  install-git-hooks.ps1 — installe un pre-commit hook anti-secrets
# ════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) { throw "Pas dans un repo git" }

$hookFile = "$repoRoot\.git\hooks\pre-commit"
$hookContent = @'
#!/bin/sh
# Pre-commit hook : bloque les secrets avant push.

FORBIDDEN_FILES="application\.yml$|application-local\.yml$|application-private\.yml$|application-prod\.yml$|\.env$|\.env\.local$|environment\.local\.ts$|environment\.private\.ts$|proxy\.conf\.local\.json$"
FORBIDDEN_PATTERNS="password\s*=\s*[^\"']{8,}|JWT_SECRET\s*=\s*[^\"']{16,}|GITHUB_CLIENT_SECRET\s*=|client[_-]?secret\s*:\s*[a-f0-9]{20,}"

STAGED=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED" ]; then exit 0; fi

# 1) Bloque les fichiers interdits par nom
BLOCKED=$(echo "$STAGED" | grep -E "$FORBIDDEN_FILES" || true)
if [ -n "$BLOCKED" ]; then
  echo "🚨 PRE-COMMIT BLOQUÉ : fichiers contenant probablement des secrets :"
  echo "$BLOCKED" | sed 's/^/   /'
  echo ""
  echo "💡 Utilise .example à la place, ou ajoute au .gitignore."
  exit 1
fi

# 2) Scan le contenu staged pour des patterns suspects
SUSPECT=$(git diff --cached -U0 | grep -E "$FORBIDDEN_PATTERNS" || true)
if [ -n "$SUSPECT" ]; then
  echo "🚨 PRE-COMMIT BLOQUÉ : patterns secret-like détectés dans le diff :"
  echo "$SUSPECT" | head -5 | sed 's/^/   /'
  echo ""
  echo "💡 Si ce sont vraiment des placeholders, force avec : git commit --no-verify"
  exit 1
fi

exit 0
'@

Set-Content -Path $hookFile -Value $hookContent -Encoding utf8 -NoNewline
Write-Host "✓ pre-commit hook installé : $hookFile" -ForegroundColor Green
Write-Host "  Test : git commit (sera bloqué si secrets détectés)" -ForegroundColor Gray
