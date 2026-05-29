# 🔒 WAR TABLE — Security & Git Push Checklist

> **À LIRE AVANT LE PREMIER `git push`** sur n'importe quel repo Yamzy (frontend, backend, registry).

## ⛔ NE JAMAIS PUSH

### Secrets backend (monolithe Yamzy)

Le fichier `backend/src/main/resources/application.yml` contient actuellement :

```yaml
GITHUB_CLIENT_SECRET   ← OAuth client secret GitHub
DB_PASSWORD            ← Mot de passe Postgres
JWT_SECRET             ← Clé de signature des tokens (CRITIQUE)
CARNIVAL_GITHUB_TOKEN  ← Token GitHub utilisé par l'app
```

→ **Ce fichier ne doit JAMAIS être commit en l'état.** Vérifier dans `.gitignore` :
```gitignore
backend/src/main/resources/application.yml
```

→ Garder uniquement `application.yml.example` versionné, avec des **placeholders** :
```yaml
DB_PASSWORD: ${DB_PASSWORD:CHANGEME}
JWT_SECRET: ${JWT_SECRET:CHANGEME-must-be-256-bits}
```

### Secrets frontend

| Fichier | Pourquoi |
|---------|----------|
| `src/environments/environment.local.ts` | URLs internes + tokens dev |
| `src/environments/environment.private.ts` | Idem prod |
| `proxy.conf.local.json` | URLs internes |
| `.env.local` / `.env` | Variables sensibles |

### Fichiers utilisateurs

| Fichier | Pourquoi |
|---------|----------|
| `~/.yamzy/extensions.json` | Paths absolus + PIDs (info utilisateur) |
| `ng-serve.log` | Peut contenir des stack traces avec secrets |
| `target/`, `dist/`, `node_modules/` | Build artifacts (jamais) |
| `*.xlsx` | Données projet privées |

## ✅ CE QU'ON PUSH

| Fichier | Statut |
|---------|--------|
| Code source (`.ts`, `.java`, `.html`, `.css`) | ✅ |
| `extension.json` (sans secrets) | ✅ |
| `*.example` (`.yml.example`, `.env.example`, etc.) | ✅ |
| `README.md`, `SECURITY.md`, doc | ✅ |
| `.gitignore`, `Dockerfile`, `docker-compose.yml` | ✅ |
| Workflows CI (`.github/workflows/*.yml`) | ✅ — vérifier qu'aucun secret en clair |
| Migrations Flyway `V*.sql` | ✅ — schema uniquement, pas de données |

## 🔍 Vérification avant push

### 1. Scan secrets via grep
```powershell
# Cherche des patterns suspects dans tout le staging area
git diff --cached | Select-String -Pattern "password|secret|token|api[_-]?key" -CaseSensitive:$false
```

### 2. Vérifier ce qui sera pushé
```bash
git diff --cached --name-only
```

### 3. Utiliser git-secrets ou trufflehog (optionnel mais recommandé)
```bash
brew install git-secrets   # macOS
choco install git-secrets  # Windows
git secrets --register-aws
git secrets --scan
```

## 🚨 Si tu as déjà push un secret par erreur

```bash
# 1. Révoquer IMMÉDIATEMENT le secret (GitHub, AWS, etc.)
# 2. Réécrire l'historique git
git filter-repo --invert-paths --path backend/src/main/resources/application.yml
# 3. Force push
git push --force-with-lease
# 4. Re-générer un nouveau secret
```

## 📋 Pre-commit hook (auto-protection)

Le repo war-table-frontend installe automatiquement un pre-commit hook qui :
1. Refuse de commit `application.yml`, `.env`, `*.private.*`
2. Scan le contenu pour détecter `password=`, `JWT_SECRET=`, etc.
3. Bloque si trouvé

Installation :
```bash
cd yamzy-war-table-frontend
./scripts/install-git-hooks.sh   # ou .ps1 Windows
```

## 🌍 Mode prod déployé

Quand Yamzy World est déployé en prod (cloud), les extensions WAR TABLE distantes :
1. Pointent vers `https://api.yamzy.world` (pas localhost)
2. Reçoivent leur JWT via le bridge SSO HTTPS
3. Stockent leurs données dans la DB prod Yamzy

→ Les **secrets de prod** ne vivent QUE sur :
- Le serveur prod Yamzy (variables d'env du conteneur Docker)
- Le GitHub Secrets (pour les CI builds)
- **Jamais** dans le code source ou les configs versionnées

## 🛡 Checklist avant CHAQUE push

- [ ] `git status` → aucun fichier `.yml` (sauf `.example`) staged
- [ ] `git status` → aucun fichier `.env` staged
- [ ] `git diff --cached` → aucune chaîne `password=`, `secret=`, `token=` en clair
- [ ] Vérifié qu'aucune URL interne d'entreprise ou personnelle dans les logs/commentaires
- [ ] `extension.json` → champs `homepage`, `repo.url` ok (publics)
- [ ] Si push d'une image splash → vérifier que c'est ton image (pas un asset tiers)

Une seule fois ces 6 points cochés → `git push` en toute confiance.
