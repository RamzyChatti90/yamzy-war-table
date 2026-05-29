# Changelog

Toutes les modifications notables de WAR TABLE ⚔ — format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- Endpoint `/api/extensions/{name}/updates` pour notification de nouvelles versions
- Endpoint `/api/extensions/{name}/refs` listant branches + tags
- Endpoint `POST /api/extensions/{name}/update` avec choix de ref
- Frontend : badge "🆕 Update available" sur les cards avec lien direct
- Frontend : modal "🌿 Choisir une version" avec branches + tags semver-triés

### Changed
- Backend `start()` : `CI=true` + preflight port + `freePort()` automatique
- Frontend polling jusqu'à RUNNING (max 60s, refresh 2s) au lieu d'un seul refresh à 1.5s

### Fixed
- `ERR_USE_AFTER_CLOSE` quand `ng serve` rencontre un port déjà pris (Angular CLI maintenant non-interactif en background)

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
