# WAR TABLE ⚔ — Planning Studio (Yamzy Extension)

> Extension officielle pour **Yamzy World** : Planning Organisator Studio avec 42 pages Scrum, import/export Excel fidèle, Gantt visuel, versioning, et plus.

[![Yamzy Extension](https://img.shields.io/badge/yamzy-extension-d99a51?style=flat-square)](https://yamzy.world/extensions)
[![Version](https://img.shields.io/badge/version-1.0.0-8b7fd6?style=flat-square)](https://github.com/RamzyChatti90/yamzy-war-table/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

## 🚀 Installation (1 ligne)

### Windows PowerShell
```powershell
iwr -useb https://raw.githubusercontent.com/RamzyChatti90/yamzy-war-table/main/install.ps1 | iex
```

### Linux / macOS / WSL
```bash
curl -sL https://raw.githubusercontent.com/RamzyChatti90/yamzy-war-table/main/install.sh | bash
```

→ Le script clone le repo, télécharge le JAR backend, lance les conteneurs Docker, et enregistre l'extension dans Yamzy World.

Après installation :
- Frontend : http://localhost:4201/war-table
- Backend  : http://localhost:8090/actuator/health
- Visible automatiquement dans Yamzy World → menu **Extensions**

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Yamzy World (host)                      │
│  Frontend :4200    Backend :8080    Postgres :5432       │
│       │                  │                │              │
│       │  Extension Mgr   │                │              │
│       ▼                  │                │ partagé      │
│  ┌────────────────┐      │                │              │
│  │ WAR TABLE Ext  │      │                │              │
│  │ Frontend :4201 │──────┼────────────────┘              │
│  │  Backend :8090 │      │                                │
│  └────────────────┘      │                                │
└──────────────────────────────────────────────────────────┘
```

L'extension a son propre frontend (Angular) et son propre backend (Spring Boot JAR), mais partage la DB Postgres avec Yamzy World et utilise le même JWT via SSO bridge.

## 📦 Contenu de l'extension

| Composant | Port | Source |
|-----------|------|--------|
| Frontend Angular 17 | 4201 | `frontend/` (ce repo) |
| Backend Spring Boot JAR | 8090 | Release GitHub `war-table-backend-X.Y.Z.jar` |
| DB tables `pos_*` | — | Flyway V58, V59, V60 |
| Manifest | — | `extension.json` |

## 🎨 Features

- 📊 **42 pages Scrum** : Dashboard, Backlog, Sprints, Gantt visuel, Calendrier, Risques, Tech Debt, Lessons Learned, ADRs, Capacity Planning, Stakeholders, Retros, etc.
- 📥 **Import Excel fidèle** : un classeur `.xlsx` Scrum entier → 42 pages mappées en DB
- 📤 **Export Excel template** : le fichier original avec toutes ses formules, styles, jalons préservés
- 🕒 **Versioning** : auto-snapshot à chaque import + snapshots manuels nommés + restore
- 🎮 **Skin "streaming dashboard"** : Video card projet actif + News feed + Top Selection
- 🔍 **Recherche fusionnée** : pages + tickets + projets dans une seule barre
- 📜 **Pagination lazy** : 5 éléments par défaut sur tous les tableaux
- 🎬 **Splash screen** : "Planification Temporelle" avec progress réel + 8 étapes
- 🔐 **SSO Yamzy** : pas de re-login, JWT bridgé automatiquement

## 🔐 SSO Bridge

L'extension ne demande **jamais** de login. Au premier accès :
1. Détecte qu'il n'a pas de JWT
2. Redirect transparent vers `http://localhost:4200/auth/bridge?return=...`
3. Yamzy World renvoie le JWT via `?token=…`
4. L'extension le stocke et nettoie l'URL

Détails techniques : voir `src/main.ts` et `src/app/core/services/auth.service.ts`.

## 🛠 Développement local (sans Docker)

```bash
# Frontend
cd frontend
npm install
npm start          # → http://localhost:4201 avec proxy /api → :8080

# Backend (depuis le repo Yamzy World principal)
cd ../yamzy-world/backend
mvn spring-boot:run
```

## 📁 Structure

```
yamzy-war-table-frontend/
├── extension.json           ← manifest Yamzy (contrat)
├── Dockerfile               ← image nginx + Angular build
├── nginx.conf               ← SPA fallback + proxy /api
├── docker-compose.yml       ← lance backend + frontend
├── install.ps1              ← installeur Windows
├── install.sh               ← installeur Linux/macOS
├── proxy.conf.json          ← proxy dev /api → :8080
├── angular.json             ← config Angular, port 4201
├── package.json
└── src/
    ├── main.ts              ← SSO bridge avant bootstrap
    ├── index.html
    ├── styles.css
    └── app/
        ├── app.config.ts
        ├── app.routes.ts
        ├── app.component.{ts,html,css}
        ├── core/services/
        │   ├── auth.service.ts
        │   └── auth.interceptor.ts
        └── features/war-table/
            ├── war-table.api.ts            ← HTTP client /api/pos/*
            ├── war-table.pages.ts          ← 42 pages
            ├── war-table.component.{ts,html,css}
            └── war-table-splash.component.{ts,html,css}
```

## 📤 Publier une nouvelle version (mainteneurs)

```bash
# 1. Bump version dans extension.json + package.json
# 2. Tag git
git tag v1.0.1 -m "WAR TABLE 1.0.1"
git push origin v1.0.1
# 3. GitHub Actions build automatiquement le JAR + push l'image Docker
#    (voir .github/workflows/release.yml)
# 4. Création de la GitHub Release avec le JAR attaché
```

## 🔄 Mise à jour

```powershell
# Windows
iwr -useb https://raw.githubusercontent.com/RamzyChatti90/yamzy-war-table/main/install.ps1 | iex

# Linux/macOS
curl -sL https://raw.githubusercontent.com/RamzyChatti90/yamzy-war-table/main/install.sh | bash
```

Le script détecte l'install existante et `git pull` + redémarre les conteneurs.

## 🗑 Désinstallation

```bash
# Stop + remove containers
cd ~/.yamzy/extensions/war-table
docker compose down -v

# Remove files
rm -rf ~/.yamzy/extensions/war-table

# Unregister from Yamzy
jq 'del(.extensions[] | select(.name == "war-table"))' ~/.yamzy/extensions.json > /tmp/r.json
mv /tmp/r.json ~/.yamzy/extensions.json
```

## 📝 License

MIT — voir [LICENSE](LICENSE).

---

**Mainteneur** : RamzyChatti90 · **Issues** : [GitHub](https://github.com/RamzyChatti90/yamzy-war-table/issues)
