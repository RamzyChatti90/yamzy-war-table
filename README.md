# WAR TABLE ⚔ — Planning Studio (Yamzy Extension)

> Extension officielle pour **Yamzy World** : Planning Organisator Studio avec 42 pages Scrum, CRUD complet sur 17 entités, Excel auto-saved, i18n FR/EN, 3D background alchimique, Gantt visuel, versioning, et plus.

[![Yamzy Extension](https://img.shields.io/badge/yamzy-extension-d99a51?style=flat-square)](https://yamzy.world/extensions)
[![Version](https://img.shields.io/badge/version-1.0.6-8b7fd6?style=flat-square)](https://github.com/RamzyChatti90/yamzy-war-table/releases)
[![License](https://img.shields.io/badge/license-PROPRIETARY-orange?style=flat-square)](LICENSE)
[![GitFlow](https://img.shields.io/badge/workflow-GitFlow-2ea1cb?style=flat-square)](#gitflow-workflow)

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

## 🎨 Features (v1.0.6)

### Core Studio
- 📊 **42 pages Scrum** : Dashboard, Backlog, Sprints, Gantt visuel, Calendrier, Risques, Tech Debt, Lessons Learned, ADRs, Capacity Planning, Stakeholders, Retros, Daily Standup, etc.
- 📥 **Import Excel fidèle** : un classeur `.xlsx` Scrum entier → 42 pages mappées en DB
- 📤 **Export Excel template** : le fichier original avec toutes ses formules, styles, jalons préservés
- 🕒 **Versioning** : auto-snapshot à chaque import + snapshots manuels nommés + restore
- 🎮 **Skin "streaming dashboard"** : Video card projet actif + News feed + Top Selection
- 🔍 **Recherche fusionnée** : pages + tickets + projets dans une seule barre
- 📜 **Pagination lazy** : 5 éléments par défaut sur tous les tableaux
- 🎬 **Splash screen** : "Planification Temporelle" avec progress réel + 8 étapes
- 🔐 **SSO Yamzy** : pas de re-login, JWT bridgé automatiquement

### v1.0.2 — 3D Background
- 🎨 **3D Background alchimique** : `alchemy_table.glb` (24 MB) animé en rotation lente derrière tout le studio (Three.js + GLTFLoader)
- 💎 **Glassmorphism** sur tous les panels (`backdrop-filter: blur(10px)`)
- 💡 **Lighting cinématique** : 7 sources (hemisphere + ambient + key + fill chaud + 3 point lights) pour rendu doux

### v1.0.3 — i18n FR / EN
- 🌐 **Switcher FR / EN runtime** : bascule à chaud sans reload (LangSwitcherComponent dans le topbar)
- 📚 **2 dictionnaires JSON complets** : 42 pages, 15 catégories, colonnes tables, modals, splash, empty states — tout est bilingue
- 💾 **Persistance localStorage** (`wt_lang`) + auto-détection navigator
- 🗓 **Calendar weekdays** (Lun/Mar… ↔ Mon/Tue…) basculent avec la langue

### v1.0.4 — Full CRUD
- 🔓 **Mode édition** : toggle 🔒/🔓 dans le topbar, persisté localStorage (`wt_edit_mode`)
- 🆕 **Modal "Nouveau projet"** : créer un Realm vide (code, nom, dates, capacité, statut) sans Excel
- ➕ **CRUD complet sur 17 entités** : Projects, Sprints, Phases, Tickets, Risks, TechDebt, Lessons, ADRs, Glossary, Capacity, Quarters, Milestones, Overtime, Retros, Stakeholders, Feedback, DailyStandups
- 💾 **Excel auto-saved** : régénération automatique dans `~/.yamzy/exports/{code}-{ts}.xlsx` après chaque mutation (debounce 1,5 s, rotation FIFO 5/projet)
- 🔔 **Toast Excel** : notification visuelle avec path du fichier après chaque save

### v1.0.5 / v1.0.6 — Sprint Naming Yamzy Pattern
- 🏷 **Pattern `{PROJ}-S{N}`** : nouveau sprint nommé `OTSYS-S3` au lieu de `Sprint 3` (préfixe = code projet alphanumérique uppercase max 6 chars, façon Yamzy)
- 🔄 **Bouton « Rebrand »** sur la page Sprints (mode édition) : renomme tous les sprints existants (`Sprint 1`, `S01`, `Sprint 1 - Init`, etc.) en `{PROJ}-S{N}` (idempotent)
- 🔄 **Bouton topbar « Reset & archive »** : rebrand → export Excel propre → delete projet en 1 clic (workflow ré-import propre)
- 🐛 **Fix critique** : `PosExcelExportService` + `PosDashboardService` + template HTML utilisaient `"Sprint " + number` hardcodé au lieu de `sp.getName()` — propagation des noms personnalisés partout (Excel, CFD, Velocity, Burndown, Calendar legend, Gantt badges)
- 🔗 Le rebrand propage désormais aux **tickets** : `t.sprint` (string column denormalized) est aussi mis à jour

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

## 🌳 GitFlow workflow

Le studio suit un GitFlow simplifié avec branches dédiées + merge no-ff pour traçabilité PR-like :

```
main ──────────────────●──────●──────●──────●──→
                       │      │      │      │
                       │      │      │      └─ merge bugfix/calendar-sprint-references (v1.0.6)
                       │      │      └──────── merge bugfix/sprint-name-display      (v1.0.5)
                       │      └─────────────── (release inline)                       (v1.0.4)
                       └────────────────────── feat: i18n FR/EN                       (v1.0.3)
```

**Convention nom de branche** :
- `feature/<courte-description>` — nouvelle feature backward-compatible
- `bugfix/<courte-description>` — fix d'un bug
- `hotfix/<courte-description>` — fix critique sur main
- `release/X.Y.Z` — préparation release (bump versions, CHANGELOG)

**Convention de commit** : [Conventional Commits](https://www.conventionalcommits.org/)
```
feat(scope): description courte
fix(scope): description courte
chore(scope): description
docs(scope): description
```

**SemVer policy** :
- `MAJOR` : breaking change (API endpoint retiré, schema DB incompatible)
- `MINOR` : nouvelle feature backward-compatible
- `PATCH` : bug fix backward-compatible

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [CHANGELOG.md](CHANGELOG.md) pour les détails.

## 📝 License

PROPRIETARY — voir [LICENSE](LICENSE). Tous droits réservés Yamzy World / RamzyChatti90.

---

**Mainteneur** : RamzyChatti90 · **Issues** : [GitHub](https://github.com/RamzyChatti90/yamzy-war-table/issues) · **Releases** : [v1.0.0 → v1.0.6](https://github.com/RamzyChatti90/yamzy-war-table/releases)
