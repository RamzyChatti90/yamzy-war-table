# Changelog

Toutes les modifications notables de WAR TABLE ⚔ — format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

---

## [1.0.12] — 2026-05-30

🎯 **Cockpit "Chicago"** : widget dashboard 4 onglets carrousel — vue
pilotage temps-réel inspiré du pattern weather-card gaming.

### Added — Cockpit widget (dashboard)
- Nouvelle carte **COCKPIT** entre le hero PS et le Top Selection,
  avec en-tête titre + horizontal rule lumineuse + sous-titre dynamique
  (sprint actif · nb événements à venir)
- **Hero zone** (équivalent big-temp Chicago) avec icône animée pulse,
  grosse valeur (min écoulés / restantes / count), label de l'item
  actif et bouton CTA contextuel
- **Nav carrousel 4 onglets** :
  - 🎯 **Action** — événement IN_PROGRESS ou prochain à venir, avec
    timer live (min écoulés vs prévues) et bouton ▶ Démarrer / ■ Terminer
  - 📅 **Réunions** — 4 prochaines cérémonies cliquables (ouvre détail)
  - ⚡ **Tickets** — top tickets bloquants (lien vers Backlog)
  - ⚠ **Alertes** — alertes HIGH du système reminders (lien vers Risques)
- Panneau de contenu réactif qui swap selon onglet sélectionné
- Indicateur visuel onglet actif (gradient or + dot lumineux)

### Style
- Palette cosmic gradient + or Yamzy `#d99a51` (vs `#C4A865` Chicago)
- Glassmorphism subtle (rgba sur fond cosmic), shadows profondes
- Animation `cockpitPulseIcon` 3s ease infinite sur l'icône hero
- Hover transform sur items (translateX 2px + bordure or)
- Responsive ≤720px : grille 2 colonnes + CTA pleine largeur

### Why
> "utilise le même style en référence ça pour l'ajouter au dashboard
> toujours avec l'action en cours, les prochaines réunions, en carrousel"

Le cockpit transforme le dashboard en **centre de pilotage temps-réel**
sans quitter la home : pas besoin de naviguer vers Agenda/Backlog/Risques
pour voir ce qui demande attention maintenant.

---

## [1.0.11] — 2026-06-01

🗓 **Calendrier intelligent** : source de vérité temporelle structurée pour
le futur LLM YAMZY. Le studio devient l'agenda Scrum complet.

### Added — Calendar Event entity
- **Flyway V62** : table `pos_calendar_events` avec JSONB attendees/reminders,
  RRULE (RFC 5545 recurrence), liens vers projet + sprint, status FSM
  (SCHEDULED → IN_PROGRESS → COMPLETED/CANCELLED/MISSED)
- **PosCalendarEvent entity** + repository avec queries date-range et
  upcoming/starting-soon

### Added — Auto-génération Scrum
- Au launch d'un sprint, **`PosCalendarService.generateScrumCeremonies`**
  crée automatiquement :
  - **Sprint Planning** J1 à 9h00 (1h)
  - **Daily Stand-up** tous les jours ouvrés à 9h30 (15 min)
  - **Sprint Review** Jn à 14h00 (1h)
  - **Sprint Retrospective** Jn à 16h00 (45 min)
- Idempotent : ne re-crée pas si déjà présent
- Bouton "🔄 Régénérer cérémonies" pour ré-exécuter manuellement

### Added — Tracking live des événements
- **Bouton ▶ Démarrer** : enregistre `actualStart = now`, status → IN_PROGRESS
- **Bouton ⏹ Terminer** : enregistre `actualEnd = now` + notes live, status → COMPLETED
- **Notes live** : textarea libre pendant l'événement (yesterday/today/blockers
  pour daily, minutes pour meeting, décisions pour planning)
- Affichage durée prévue vs réelle dans le récap

### Added — Notifications proactives
- Polling 60s : détecte les événements qui démarrent dans les 5 min
- Notification WtDialog avec 3 choix :
  - ▶ **Démarrer maintenant** (jump direct vers détail event)
  - ⏸ **Rappeler dans 5 min**
  - 👁 **Voir détails**
- Dédup via `eventNotifShown` Set (pas de spam)

### Added — Invitations & RSVP
- Champ `attendees` JSON: `[{name, response, respondedAt}]`
- 3 boutons RSVP dans le détail event : **✓ J'accepte** / **? Peut-être** / **✕ Je refuse**
- Statut visuel par participant (vert/or/rouge/gris)
- Endpoint `POST /events/{id}/respond` pour les invités

### Added — Page Agenda + iCal export
- Nouvelle page **⏰ Agenda** (catégorie Planning)
- Liste groupée par jour avec event cards (marker coloré par type,
  pulse cyan pour IN_PROGRESS, opacity 0.65 pour COMPLETED)
- 7 types d'événement : DAILY (vert), PLANNING (cyan), REVIEW (doré),
  RETRO (magenta), MEETING (violet), CALL (cyan), OTHER (mauve)
- Modal détail riche : titre, when, lieu, status, notes textarea,
  participants, RSVP, actions
- Modal "+ Nouvel événement" : type, titre, début/fin (datetime-local),
  lieu/lien, description
- **Export iCal** : `GET /events/ical` → fichier .ics compatible
  Outlook / Google Calendar / Apple Calendar

### Added — Smart data foundation pour LLM YAMZY
Toutes les données collectées (scheduled vs actual, notes live, RSVP,
durées, types) sont stockées en JSONB structuré, prêtes pour ingestion
par le LLM YAMZY pour générer :
- Rapports de durée moyenne des dailies
- Taux d'acceptation des invitations
- Détection de patterns de dépassement
- Analyse de fréquence des meetings vs deep work
- Synthèse de notes de meeting cross-sprint

### Endpoints ajoutés (9)
- `GET  /api/pos/projects/{id}/events` (+ from/to filter)
- `GET  /api/pos/projects/{id}/events/upcoming`
- `GET  /api/pos/projects/{id}/events/starting-soon?windowMinutes=N`
- `POST /api/pos/projects/{id}/events`
- `PUT  /api/pos/events/{id}`
- `DELETE /api/pos/events/{id}`
- `POST /api/pos/events/{id}/start`
- `POST /api/pos/events/{id}/end`
- `POST /api/pos/events/{id}/respond`
- `POST /api/pos/projects/{id}/events/regenerate-scrum`
- `GET  /api/pos/projects/{id}/events/ical`

### GitFlow
Cette release est issue d'un seul gros merge no-ff :
- feature/calendar-events → main

---

## [1.0.10] — 2026-06-01

Massive Excel ↔ Studio parity release. Audit revealed 5 gap categories;
this release closes them all (except holidays JSON edit which was new
ground). Plus 9-category reminder system and PS-style hero card.

### Added — Reminders system (Category Excel: conditional formatting)
- `PosReminderService` backend with 9 detection categories
  (ticket-overdue, ticket-blocked-stale, ticket-aging-wip,
  ticket-no-assignee, daily-missing-today, daily-empty-yesterday,
  risk-overdue, techdebt-critical-noplan, sprint-overrun)
- `GET /api/pos/projects/{id}/reminders` endpoint
- Topbar bell with shake animation when HIGH severity present
- Glassmorphism dropdown panel with severity pills + categories
- Per-reminder dismiss + 120s auto-poll + manual refresh

### Added — Hidden Excel data exposure (Categories A + B)
- Backlog: Spent(h) editable, Reste(h) computed live, Cycle/Lead(j)
  per-ticket, acceptanceCriteria as tooltip on ID
- Detail Tickets: dedicated `<pre>` block for acceptanceCriteria,
  meta enriched with spent/remaining/cycle
- Risks: +5 columns (Owner, LinkedTicket, Mitigation, IdentifiedAt,
  DueDate), all inline editable, **auto-recompute score = proba × impact**
- Tech Debt: +2 columns (DetectedAt, ResolutionPlan), all editable
- Vue Reviewer: +reviewerComment column
- Phases: +Reste(j) computed column, inline edit
- Parametres: +workDaysPerWeek, +allocatedDays/consumedDays, +status
- Hidden KPIs in dashboard map now displayed:
  Top3Actions panel, CFD total in tooltip+label, velocity hours
  columns, dependencies stateA pill

### Added — Excel formulas replayed live (Category D)
- New Project modal: `sprintCapacityHours = hoursPerDay × daysPerSprint`
  auto-recompute on input change
- Risks: `score = probability × impact` auto on inline edit (atomic
  patch with both fields)
- Phases: `Reste = Planned - Consumed` live in column

### Added — Bulk operations (Category E)
- Backend: `PUT /tickets/bulk` (multi-patch), `POST /tickets/bulk-delete`,
  `POST /tickets/bulk-reorder` (rankIndex)
- Backlog: checkbox column + sticky bulk action bar when ≥1 selected
- 6 bulk actions: Statut / Sprint / Assigné / Priorité (via WtDialog
  choice cards) + 🗑 Supprimer + ✕ Désélectionner
- Whitelisted bulk-patch fields, cross-project IDs auto-skipped

### Added — Holidays / Leaves editor
- 📅 Jours fériés (cyan chips) + 🏖 Congés (gold chips) on parametres page
- Add row in edit mode: date picker + label/reason input
- Persisted via `updateProject({ holidays: [...], leaves: [...] })` JSONB
- Auto-export triggered after each modification

### Other
- WtDialog used for all confirmations (no more native browser popups)
- PS-style hero card on dashboard with Yamzy 3D avatar (static)
- Mythrill Magic Card glow effect on hero (rotating gradient ring)
- News thumb cards have shimmer band + matching blur halo

### GitFlow
This release is the result of 4 merged branches:
- bugfix/excel-parity-kpis → fix(excel-parity): expose 4 hidden KPIs
- feature/bulk-operations → feat(bulk-ops): multi-select + mass update
- feature/holidays-leaves-editor → feat(holidays-leaves): JSON editors
- (plus prior feature/sprint-launch-flow and bugfix branches)

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
