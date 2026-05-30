# Changelog

Toutes les modifications notables de WAR TABLE ⚔ — format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

---

## [1.0.7] — 2026-05-31

### Added — Sprint Launch Flow
- 🚀 **Banner "Lancer Sprint"** sur le Dashboard quand un sprint est lançable aujourd'hui (PLANNED dont startDate ≤ today, ou prochain à venir)
  - 3 modes visuels : `is-today` (doré chaud), `is-overdue` (rouge), `upcoming` (violet/bleu)
  - Animation rocket float + pulse box-shadow
- 🆕 **Endpoint `POST /api/pos/sprints/{id}/launch`** : workflow complet
  1. Status → `EN_COURS` + `launched_at = now`
  2. Crée auto un **Daily Stand-up du jour** (idempotent, pas de doublon si existant)
  3. Génère **ticketKey `YC-{PROJ}-S{N}-{seq}`** pour tickets sans ID propre (placeholder `NEW-*` ou pattern non-Yamzy)
  4. Trigger l'auto-export Excel
- 🆕 **Endpoint `GET /api/pos/projects/{id}/sprints/launchable`** : détecte le prochain sprint lançable + `daysUntilStart` + flags `isToday`/`isOverdue`
- 📦 **Flyway V61** : ajoute `status` + `launched_at` à `pos_sprints`. Backfill auto basé sur les dates :
  - `end_date < today` → `TERMINE`
  - `start_date ≤ today ≤ end_date` → `EN_COURS`
  - reste → `PLANNED`
- 🚀 **Launcher `start-war-table.bat`** : 1 double-clic démarre Postgres-check + backend + studio + ouvre browser sur :4201

### Fixed — Audit incréments
- 🐛 **Auto-génération IDs côté backend** (max+1 au lieu de length+1, robust contre delete au milieu) :
  - `createRisk` → si `riskId` blank, génère `R-{NNN}` basé sur `max(numericSuffix)+1`
  - `createDebt` → idem avec `TD-{NNN}`
  - `createLesson` → idem avec `L-{NNN}`
  - `createAdr` → idem avec `ADR-{NNN}`
- Helper `nextBusinessId(existing, prefix)` réutilisable + tested

### Changed
- `selectProject(id)` re-déclenche `refreshLaunchable()` auto
- PosSprint entity : nouveau champ `status` (default `PLANNED`) + `launchedAt`

---

## [1.0.6] — 2026-05-30

### Fixed
- 🐛 **Calendrier / Légende sprints** : le rebrand propage désormais aux tickets aussi
  - Avant : `pos_sprints.name` renommé mais `pos_tickets.sprint` (string column) gardait `Sprint 1, 2, 3…` → calendrier affichait les anciens
  - Maintenant : rebrand met à jour toutes les `t.sprint` matchant l'ancien nom OU les variantes `Sprint N` / `sprint N` / `S{N}` / `S0{N}`
  - Réponse de l'endpoint enrichie : `ticketsUpdated` ajouté pour debug

---

## [1.0.5] — 2026-05-30

### Added
- 🏷 **Rebrand sprints** : bouton dans la page Sprints qui renomme tous les sprints en `{PROJ}-S{N}` (pattern Yamzy)
- 🆕 **Endpoint `POST /api/pos/projects/{id}/sprints/rebrand?force={bool}`** : renomme tous les sprints (force=true par défaut, accepte `Sprint 1 - Init`, `S01`, etc.) ; retourne aussi les changements pour debug
- 🆕 **Endpoint `POST /api/pos/projects/{id}/reset-and-archive`** : rebrand + export Excel propre dans `~/.yamzy/exports/{code}-RESET-{ts}.xlsx` + delete projet (workflow ré-import propre)
- 🔄 **Bouton topbar** rouge/orange (visible quand un projet est sélectionné) pour déclencher le reset
- Auto-numérotation sur création de sprint : `max(number) + 1` au lieu de la length

### Fixed
- 🐛 **PosExcelExportService** (ligne 156) : utilise `sp.getName()` au lieu de `"Sprint " + sp.getNumber()` — l'Excel exporté préserve enfin les noms personnalisés (`OTSYS-S3` au lieu de `Sprint 3`)
- 🐛 **PosDashboardService** (3 lignes : CFD/Velocity/Burndown) : utilise `sp.getName()` pour le label sprint au lieu du `"S" + number` hardcodé
- 🐛 **war-table.component.html** (4 occurrences) : `Sprint {{ s.number }}` → `s.name || ('Sprint ' + s.number)`
  - Dashboard skin → carte sprint actif
  - Page Sprints → cartes
  - Sprint Review → tableau
  - Sprint Planning → dropdown
- 🐛 **war-table.component.html** (3 autres places) : retros, stakeholder feedback, vue-stakeholder utilisent désormais `sprintNameByNumber(num)` qui résout le vrai nom depuis le store

### Changed
- `createSprint` (POST) : si `body.name` n'est pas fourni, génère `{PROJ_CODE_CLEAN}-S{N}` automatiquement, et `goal = "Itération {N} — {nom projet}"`
- `generateSprintName(project, n)` : helper réutilisable, max 6 chars alphanumériques du code projet
- Rename des fichiers RESET : insère `-RESET-` juste avant le timestamp (au lieu de couper le code projet sur le premier `-`)

---

## [1.0.4] — 2026-05-30

### Added
- 🔓 **Mode édition** : toggle 🔒/🔓 dans le topbar — active inline edit + boutons CRUD partout (persisté localStorage `wt_edit_mode`)
- 🆕 **Modal "Nouveau projet"** : création d'un Realm vide (code, nom, dates, capacité, statut) sans passer par Excel
- 💾 **Excel auto-saved** : régénération automatique du `.xlsx` dans `~/.yamzy/exports/{code}-{timestamp}.xlsx` après chaque mutation (debounce 1,5 s, rotation FIFO 5 derniers/projet)
- 🔔 **Toast Excel** : notification visuelle après chaque save indiquant le path du fichier régénéré
- ➕ **Boutons "+ Ajouter"** sur 14 pages : Backlog, Sprints, Phases, Risks, Tech Debt, Lessons, ADRs, Glossary, Capacity, Quarters, Milestones, Overtime, Retros, Stakeholders, Daily
- 🗑 **Boutons "supprimer"** par ligne sur toutes ces pages (confirm avant delete)

### Backend
- `PosExcelAutoExportService` (signal debouncé, rotation FIFO, path mémorisé)
- `PosCrudController` : POST + PUT + DELETE complets sur 15 entités (Projects, Sprints, Phases, Risks, TechDebt, Lessons, ADRs, Glossary, Capacity, Quarters, Milestones, Overtime, Retros, Stakeholders, StakeholderFeedback, DailyStandups)
- `POST /api/pos/projects` (créer projet sans Excel)
- `PUT /api/pos/projects/{id}` (modifier projet)
- `GET /api/pos/projects/{id}/auto-export-path` (path du dernier .xlsx généré)
- `POST /api/pos/projects/{id}/regenerate-excel` (force sans debounce)
- Tous les CRUD de tickets existants triggent désormais aussi l'auto-export

### Frontend
- `WarTableApi` : ~45 nouvelles méthodes typées (create/update/delete par entité)
- `editMode` signal réactif + persistance localStorage
- `newProject` modal avec form validation (code unique requis)
- `notifyExcelChanged(projectId)` poll automatique du backend après chaque save

---

## [1.0.3] — 2026-05-30

### Added
- 🌐 **i18n FR / EN runtime** : système de bascule de langue à chaud, sans reload
- `I18nService` signal-based avec persistance `localStorage` (`wt_lang`) + auto-détection navigator
- `TranslatePipe` impur (`{{ 'cle.path' | t }}`) avec interpolation `{n}` params
- `LangSwitcherComponent` : pill toggle 🇫🇷 FR / 🇬🇧 EN dans le topbar
- 2 dictionnaires JSON complets `assets/i18n/{fr,en}.json` couvrant : sidebar, topbar, 42 pages, 15 catégories, colonnes de tables, modals, splash, empty states, KPI tiles
- Méthodes `pageLabel(p)` + `catLabel(c)` + `weekdays()` réactives au signal `lang`

### Changed
- `navLabels` et `catsSkin` passés en `computed()` (réactifs au switch FR/EN)
- `kpiTiles.tip` traduit (Vélocité / Velocity, Cycle Time, etc.)
- Tous les `<th>` des tableaux, `<placeholder>`, `<title>`, et empty states branchés sur `| t`
- Jours du calendrier (Lun/Mar... ↔ Mon/Tue...) basculent avec la langue
- `<html lang>` mis à jour automatiquement à chaque switch

### Fixed
- Plus aucune chaîne dure FR dans le shell — bascule EN instantanée et complète

---

## [1.0.2] — 2026-05-30

### Added
- 🎨 **3D Background** : `alchemy_table.glb` (24 MB) animé en rotation lente derrière tout le studio (Three.js + GLTFLoader, lazy-chargés via CDN)
- Composant `WarTableBg3dComponent` standalone full-screen `z-index:0 pointer-events:none`
- Glassmorphism sur les panels : `backdrop-filter: blur(10px)` + opacité ajustable
- Hemisphere light + 7 sources d'éclairage (ambient + key + fill chaud + 3 point lights + top) pour rendu doux

### Changed
- Panels opacité réduite (`.82` → `.55`) — laisse voir la table 3D plus nettement
- Sidebars opacité réduite (`.7` → `.5`)
- `toneMappingExposure: 0.85` → `1.35` (rendu beaucoup plus lumineux)
- Lighting : key 1.0 → 0.7 (moins dur), ambient 0.5 → 0.95, fill violet → doré chaud
- Overlay sombre passé de `.55-.78` à `.15-.35` (3D beaucoup plus visible)

### Fixed
- Chaîne wrapper transparente (43 sélecteurs CSS) : `wt-main`, `wt-sk-dash`, `wt-shell-main`, `wt-body` etc. n'opacifient plus le 3D

---

## [1.0.1] — 2026-05-30

### Added
- Endpoint `/api/extensions/{name}/updates` pour notification de nouvelles versions
- Endpoint `/api/extensions/{name}/refs` listant branches + tags
- Endpoint `POST /api/extensions/{name}/update` avec choix de ref
- Frontend : badge "🆕 Update available" sur les cards avec lien direct
- Frontend : modal "🌿 Choisir une version" avec branches + tags semver-triés

### Changed
- Backend `start()` : `CI=true` + preflight port + `freePort()` automatique
- Spawn `node ng.js` direct (bypass `npm.cmd` Windows qui mourrait silencieusement)
- Frontend polling jusqu'à RUNNING (max 60s, refresh 2s)
- Install async avec progress réel (Phase Copy 5-25% + npm 28-95% + done 100%)

### Fixed
- `ERR_USE_AFTER_CLOSE` quand `ng serve` rencontre un port déjà pris
- Uninstall Windows-safe avec `taskkill /F /T` + `cmd /c rmdir /S /Q`

---

## [1.0.0] — 2026-05-29

### Added
- 🚀 Première version publique de l'extension WAR TABLE
- 42 pages Scrum (Backlog, Sprints, Gantt, Burndown, Calendrier, Risques, Tech Debt, Lessons, ADRs, Capacity, Stakeholders, Retros, DoD/DoR, Templates, etc.)
- Import/export Excel round-trip fidèle (Apache POI — préserve styles + formules + jalons)
- Versioning : auto-snapshot à chaque import + snapshots manuels nommés + restore
- Skin "streaming dashboard" : Video card projet actif + News feed + Top Selection
- Recherche globale fusionnée (pages + tickets + projets)
- Pagination lazy 5/page sur tous les tableaux
- Splash screen "Planification Temporelle" avec 8 étapes de progress
- SSO bridge JWT avec Yamzy hôte + fallback OAuth direct (sans frontend Yamzy)
- Sidebar 4 icônes (Dashboard/Plannings/Backlog/Analytics) + drawer 42 pages
- Mode privé local — aucun secret embarqué

### Security
- Pre-commit hook anti-secrets
- `.gitignore` strict pour `application.yml`, `.env`, `*.private.*`
- Templates `.example` versionnés avec placeholders CHANGEME

---

## Format des entrées

```
## [X.Y.Z] — YYYY-MM-DD

### Added       (nouvelles features)
### Changed     (changements de comportement)
### Deprecated  (features marquées obsolètes)
### Removed     (features supprimées)
### Fixed       (bugs corrigés)
### Security    (vulnérabilités corrigées)
```

**SemVer policy** :
- `MAJOR` : breaking change (API endpoint retiré, schema DB incompatible)
- `MINOR` : nouvelle feature backward-compatible
- `PATCH` : bug fix backward-compatible
