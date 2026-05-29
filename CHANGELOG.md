# Changelog

Toutes les modifications notables de WAR TABLE ⚔ — format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

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
