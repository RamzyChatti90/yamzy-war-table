# Changelog

Toutes les modifications notables de WAR TABLE ⚔ — format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versioning [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

---

## [1.0.108] — 2026-06-01

✅ **Chantier D2 (Pack complet) — Arcane Mes TODOs live + click navigation + auto-refresh**.

### Added
- `@Output() navigateRequest` sur `<app-arcane-scroll>` qui émet `{ kind, page, id?, ticketKey? }` quand l'user clique sur un scroll auto.
- `onAutoCardClick(scroll, ev)` : route selon `autoKind` (`my-todo` → backlog, `meeting-notes` → meeting-reports, `upcoming-event` → agenda). Ferme l'arcane après émission.
- Auto-refresh `setInterval(60_000)` du feed arcane tant que l'arcane est ouvert. Stop sur Escape + Ctrl+Space toggle off + ngOnDestroy.
- Guard sur boutons (📋 copy, 📌 pin) : intercepte le click avant la nav.
- `war-table.component.ts.onArcaneNavigate(req)` : `studioLevel='section'` + `setPage` + `openPageContent` + ouvre Meeting Report preview ou event detail selon contexte.

---

## [1.0.107] — 2026-06-01

🔮 **Chantier D1 (Pack complet) — Arcane sync notes réunions + cérémonies à venir**.

### Added — Backend (monolithe yamzy-world local)
- Nouveau service `PosArcaneFeedService` :
  - `buildFeed(projectId, userName)` → `List<ScrollFeedItem>` (id, kind, title, category, color, content, metadata, readOnly, pinned).
  - `buildMeetingNotes` : last 10 events COMPLETED avec notes non vides.
  - `buildUpcomingEvents` : next 5 events SCHEDULED dans 7j (pin auto si today).
  - `buildMyTodos` : tickets assignés (case-insensitive match), pin si HIGH priority, limit 10 (utilisé par v1.0.108).
- Nouveau endpoint `GET /api/pos/projects/{id}/arcane-feed`.
- `PosUserResolver.currentUserLogin()` expose le login GitHub courant.
- `@Autowired(required = false)` → graceful degradation si service absent.

### Added — Frontend
- `arcane-scroll.component.ts` :
  - `@Input() posProjectId?: number | null`
  - `autoScrolls: Scroll[]` (feed auto, read-only)
  - `Scroll` interface étendue : `isAuto, autoKind, autoMetadata`
  - `load()` fetch `/pos/projects/{pid}/arcane-feed` quand `posProjectId` set
  - `filtered()` merge `[...autoScrolls, ...scrolls]` puis sort par `pinned desc`
  - 3 nouvelles catégories au début : "Notes reunions" / "Ceremonies a venir" / "Mes TODOs"
- Badge **🔄 AUTO** sur scrolls auto, boutons edit/save/delete cachés si `isAuto`.
- Style `.as-card-auto` : border dashed pour distinction visuelle.
- `war-table.component.html` : `[posProjectId]="api.selectedProjectId()"` passé en Input.

---

## [1.0.106] — 2026-06-01

📋 **Chantier B (Pack complet) — Page Comptes-rendus de réunions**.

### Added
- `war-table.pages.ts` : nouvelle page `meeting-reports` sous `superCat: Reporting`, `cat: Métriques`, icon `📋`, card `27_Book`. Reporting passe de 11 à 12 pages.
- Signals : `meetingReportsFilter`, `meetingReportsPreview`, computed `meetingReports` (filtre events COMPLETED+MISSED par type/sprint/search), computed `meetingReportsSprints`.
- HTML : section avec 3 filtres (search + type + sprint), empty state, grid auto-fill 320px de cards (head + notes preview fade-out + attendees count + badges TERMINÉ/MANQUÉ), modal preview readonly réutilisant `.wt-event-detail-modal`.
- CSS : `.wt-meeting-grid`, `.wt-meeting-card`, `.wt-meeting-card-notes` avec gradient fade-out bas, badges TERMINÉ/MANQUÉ couleurs.

---

## [1.0.105] — 2026-06-01

⏰ **Chantier C (Pack complet) — Auto-MISSED `@Scheduled` + reminders re-notif**.

### Added — Backend
- `PosCalendarService.detectMissedEvents()` — `@Scheduled(fixedDelay = 300_000L, initialDelay = 60_000L)` (5 min).
  - Cherche events `SCHEDULED` dont `scheduledEnd < now` → status `MISSED`.
  - Try/catch + log.info, ne crash jamais le scheduler.
- `PosCalendarEventRepository.findScheduledPastEnd(now)` + `findByProjectIdAndStatusOrderByScheduledStartDesc`.
- `PosReminderService` : injecte `PosCalendarEventRepository` + nouvelle catégorie 10 `event-missed` (severity HIGH).

### Changed — Frontend
- `showEventNotification()` : si action `snooze`, `setTimeout 5 * 60 * 1000` qui **re-pop** la notif SI event toujours `SCHEDULED`. Sinon silencieux (démarré/MISSED/annulé).

---

## [1.0.104] — 2026-06-01

🏁 **Chantier A (Pack complet) — Wrap-up modal intelligent**.

Remplace le simple `dialog.alert("Event terminé")` après `endEventNow()` par un modal complet en 4 sections.

### Added
- 4 sections du modal :
  1. **📝 Notes / compte-rendu** — textarea pré-remplie.
  2. **🎫 Tickets créés** — `+ Nouveau ticket`, champs titre/type/priorité/estim. Chaque ticket `sourceEventId = event.id`.
  3. **📅 Follow-up** — 3 options : Aucun / Daily 15min / Réunion personnalisée (datetime + durée + type).
  4. **👥 Présences** — click cycle ACCEPTED → TENTATIVE → DECLINED → PENDING.
- State : `wrapUpEvent` signal, `wrapUpDraft` object, `wrapUpSaving` signal (anti double-click).
- Orchestration cascade `submitWrapUp()` : `endEvent → createTicket × N → createEvent (followup) → respondEvent × M → notifyExcelChanged`.

### Changed
- `endEventNow(ev)` ouvre le wrap-up au lieu de terminer directement.

---

## [1.0.103] — 2026-06-01

🔗 **Chantier E (Pack complet) — Liaison ticket ↔ event**.

### Added — Backend (monolithe yamzy-world local)
- **V64 migration** : `ALTER TABLE pos_tickets ADD COLUMN source_event_id BIGINT NULL` + index `idx_pos_tickets_source_event_id`. Nullable = rétrocompatible.
- `PosTicket` entity : champ `sourceEventId` (Long).
- `PosTicketRepository` : `findBySourceEventIdOrderByCreatedAtAsc` + `countBySourceEventId`.
- `PosController.ticketsForEvent(eventId)` : `GET /api/pos/calendar-events/{id}/tickets`.
- `PosExcelExportService` : col "Source Event" sur sheet Backlog (label `#<eventId> <eventTitle>`).

### Added — Frontend
- `WarTableApi.PosTicket` interface : `sourceEventId?: number`.
- `api.ticketsForEvent(eventId)`.

---

## [1.0.102] — 2026-05-31

🎯 **State classes du header restreintes au dashboard uniquement** — Vraie solution propre au problème "header reste bleu malgré pick".

### Changed
- HTML : `[class.is-active]`, `[class.is-launchable]`, `[class.is-today]`, `[class.is-overdue]` ne s'appliquent **que** quand `isDashboardSkin()` est vrai.
- Sur les autres pages : aucune classe d'état → `var(--card-c1/c2/c3)` du gradient s'applique naturellement, sans hack `!important`.
- Dashboard inchangé : continue de switcher entre cyan/bleu/violet (ACTIVE), vert (LAUNCHABLE), jaune (TODAY), rouge (OVERDUE) selon état sprint.

### Removed
- Règle CSS `!important` ajoutée en v1.0.101 (faux fix) — supprimée.

---

## [1.0.100] — 2026-05-31

🐛 **Fix hover flicker mini cartes** + 🌈 **Live preview couleur header** via roue chromatique native.

### Fixed — Hover flicker minis
- `translateY(-12px)` au hover supprimé (la carte se déplaçait hors curseur → mouseleave → revenait → mouseenter → boucle infinie).
- `transform-origin: center` → grandit depuis le centre.
- `z-index: 100` au hover (au lieu de 20) → toujours par-dessus les autres minis.
- `animation-play-state: paused` au lieu de `animation: none` → pas de snap brutal.
- `::before` invisible avec `inset: -15px` → hitbox élargi de 15px tout autour.
- `transition: transform .28s cubic-bezier(.32, 1.4, .55, 1.1)` → grow/shrink smooth.

### Added — Live color preview
- `<input type="color">` natif englobé dans `<label>` 🌈 (cross-browser).
- `(input)` event = preview LIVE pendant que l'user glisse dans la roue chromatique.
- `(change)` event final = copy clipboard + toast inline non-bloquant.
- Toast `.wt-ps-color-toast` dans le header (top:52px right:16px) avec chip, mapping, boutons 📋 et ✕.
- Auto-dismiss 4.5s.

### Changed
- `pickHeaderColor()` ne montre plus de modal alert (bloquait la vue du header) — remplacé par toast inline.

---

## [1.0.99] — 2026-05-31

🎨 **Color picker EyeDropper API per card** — Chaque carte peut être mappée à une couleur custom qui devient la base du gradient animé du header.

### Added
- `cardColors = signal<Record<string,string>>(loadCardColors())` — persisté en `localStorage` (`wt_card_colors`).
- `activeCardColor()` computed — retourne la couleur custom ou la valeur de `CARD_COLOR_MAP[card]` (mapping permanent hardcoded).
- `activeCardGradient()` computed — dérive 3 couleurs HSL (hueShift ±25/-30°, lightness ±0.18/-0.22) pour les 3 stops du gradient animé.
- `pickHeaderColor()` — ouvre `EyeDropper API` (Chrome/Edge 95+), extrait la couleur du pixel cliqué, sauvegarde + copie auto dans le presse-papier au format `'NomCarte': '#hex',`.
- Bouton **🎨** dans le coin haut-droit du header (visible si carte active + `studioLevel === 'section'`).
- Bouton **↺ Reset** (visible si couleur custom) — revient au gradient par défaut.
- Color chip de la couleur active.
- `CARD_COLOR_MAP` static readonly (vide initialement) — destiné à être enrichi avec les valeurs envoyées par l'user pour mapping permanent cross-device.

### Changed
- `.wt-ps-header::before` et `::after` utilisent désormais `var(--card-c1/c2/c3, default)` au lieu de couleurs hardcodées — permet override inline via `[style.--card-c1]`.
- Helpers `hexToHsl()` + `hslToHex()` ajoutés pour dérivation chromatique.

---

## [1.0.98] — 2026-05-31

🃏 **Mini cartes dispersées en TRIANGLE diagonal** dans le header (top-right → bot-left), grande carte ancrée Q4 (bottom-right "yellow square").

### Changed
- `superCatFloatingMinis()` retourne 11 positions `topPct` / `leftPct` cascadant sur la diagonale (5%/78% → 68%/4%) avec rotation random et delay séquentiel.
- HTML : minis utilisent `[style.top.%]` et `[style.left.%]` pour positionnement absolute en %.
- CSS : `.wt-ps-mini-row.wt-ps-quad-bl` = `position: relative` spanning `grid-column: 1/-1` (toute la rangée 2 du header).
- En **edit mode** : `clip-path: polygon(0% 100%, 100% 100%, 100% 0%)` visualise le triangle avec gradient orangé.
- `.wt-ps-mini-card.wt-ps-mini-float` = `position: absolute`, `miniCardPour` + `miniCardIdle` keyframes (without `--yoff` removed).

---

## [1.0.97] — 2026-05-31

📐 **Fix grid : Q3 (mini row) et Q4 (big card) fusionnés en `grid-column: 1 / -1`** pour rapprocher les minis de la big card. Big card avec `justify-self: end` + `z-index: 10` pour rester au coin BR par-dessus les minis. Mini row avec `padding-right: 172px` pour laisser place à la big card.

---

## [1.0.96] — 2026-05-31

📐 **Big card collée au coin BR du header** + minis collées à droite de Q3. `align-self: end` + `justify-self: end` sur big card. Minis row `justify-content: flex-end` + `padding-right: 24px`.

---

## [1.0.95] — 2026-05-31

🐛 **Fix grid : Q3 et Q4 SORTIS du wrapper `.wt-ps-en-cours`** pour devenir direct children du `.wt-ps-header` grid container — sans ça, les `grid-area` ne s'appliquaient pas et les cartes restaient au milieu avec lots of empty space.

---

## [1.0.94] — 2026-05-31

📐 **Header en grid 2×2** : Q1 = Planning (top-left), Q2 = En cours (top-right), Q3 = Mini cards (bot-left), Q4 = Big card (bot-right). User : *"il faut diviser la moitié inférieure en 2 quadrants : la grande carte dans le Q4 (coin BR)"*.

---

## [1.0.93] — 2026-05-31

🛠 **Valeurs cards user-tuned en défauts** : `cardsBottom=68, Left=300, Right=300, Height=160, MiniW=130, MiniH=182, BigW=162, BigH=392, Gap=40`. Plages des sliders élargies pour permettre plus de marge.

---

## [1.0.92] — 2026-05-31

🛠 **Edit mode = Cards row uniquement** (déplacement YAMZY + Carousel retiré, plus utile depuis qu'on a viré l'avatar).

---

## [1.0.91] — 2026-05-31

🛠 **Cards row éditable en edit mode** : sliders pour position (bottom/left/right/height/gap) et tailles (miniW/miniH/bigW/bigH). User envoie les valeurs ou clique `📋 Copy CSS coords`.

---

## [1.0.90] — 2026-05-31

🃏 **Cartes étalées horizontalement au BAS du header** (au lieu d'à côté du big PNG) — laisse plus d'espace pour distribuer les sous-pages d'une super-cat chargée comme Sprint (10 pages).

---

## [1.0.89] — 2026-05-31

📐 **Réduit hauteur de `Mes Plannings` dans le header** — occupait trop d'espace pour rien.

---

## [1.0.88] — 2026-05-31

🎯 **Pattern preview + commit** : click sur une mini carte du header = preview (le header se met à jour avec la carte sélectionnée). Click sur le header (PS hero) = ouvre vraiment la page. Évite les navigations accidentelles.

---

## [1.0.87] — 2026-05-31

📐 **Header split 50/50** : LEFT = Planning (Mes Plannings nested), RIGHT = En cours (tag + title + desc + action + cards).

---

## [1.0.86] — 2026-05-31

🃏 **Planning en HAUT du header** + **cartes versées dans la partie inférieure** comme si on versait de vraies cartes sur une table.

---

## [1.0.85] — 2026-05-31

🃏 **Mini cartes flottantes positionnées aléatoirement** + même style que le grand PNG parent (filter, drop-shadow, animation idle). Tailles fils légèrement agrandies.

---

## [1.0.84] — 2026-05-31

🃏 **Mini cartes des sous-pages affichées à côté du grand PNG actif** dans le header.

---

## [1.0.83] — 2026-05-31

↩ **Revert v1.0.82** — User : *"revert png c'estait bcp mieux"*. Retour aux PNG cartes, suppression du composant `YamzyGlbIconComponent`.

---

## [1.0.82] — 2026-05-31

🃏 **Composant réutilisable `YamzyGlbIconComponent`** (Three.js + GLTFLoader CDN) — remplace temporairement les PNG cards par des GLB animées 3D. (Réverté en v1.0.83.)

---

## [1.0.81] — 2026-05-31

🃏 **Chaque page reçoit une carte Yamzy PNG unique ou partagée** — 30 cartes mappées aux 43 pages via `PageDef.card`. Affichée dans le cockpit + PS hero header. Assets copiées de `frontend/dist/assets/cards/` vers `war-table/src/assets/cards/`.

---

## [1.0.80] — 2026-05-31

🐛 **Fix arcane-scroll Tailwind absent** — Tailwind n'est pas installé dans war-table standalone, donc toutes les classes `.fixed inset-0 bg-black/30 backdrop-blur-sm` étaient invisibles. Réécriture du template avec **CSS natif** (`.as-overlay`, `.as-panel`, `.as-card`, `.as-color-yellow/blue/pink/green/purple`).

---

## [1.0.79] — 2026-05-31

⚛ **Wheel Menu (Ctrl+Win) + Arcane Scrolls (Ctrl+Space)** repris du core Yamzy.

### Added
- `wheel-menu.component.ts` (951 lignes) copié de `frontend/src/app/core/wheel-menu/`.
  - Strippé : `FlowLaunchModalComponent` + `AgentIconComponent` (deps Yamzy core).
  - `HostListener` track `ctrlDown` + `metaDown` flags pour shortcut **Ctrl+Win**.
  - Persistance via `/api/users/me/wheel-config`.
- `arcane-scroll.component.ts` (217 lignes) copié de `frontend/src/app/core/arcane-scroll/`.
  - `HostListener Ctrl+Space` toggle, ESC close.
  - Persistance via `/api/arcane-scrolls`.

---

## [1.0.78] — 2026-05-31

🎨 **Header PS hero reçoit le bg style cellule du calendrier** (au lieu du bleu uni).

---

## [1.0.77] — 2026-05-31

🐛 **Fix HOME footer ouvre Dashboard** (au lieu d'écran vide).

### Fixed
- `returnHome()` : `studioLevel='section'` (au lieu de `'home'`) + `setPage('dashboard')` + `pageContentOpen.set(false)` (preview mode).
- Sur Dashboard, NE PAS `openPageContent()` car la dashboard EST le contenu (pas de section `.wt-dashboard` séparée). `.is-content-open` déclenchait `fade-out` de `.wt-sk-dash` → écran vide.

---

## [1.0.76] — 2026-05-31

🐛 Fix click HOME footer (intermédiaire — abouti en v1.0.77).

---

## [1.0.74-75] — 2026-05-31

⏪ **Tentative scroll restreint à la section "Super-cat PAGES" du cockpit + revert** — User : *"nn revert quelque chose est cassé"*.

---

## [1.0.73] — 2026-05-31

🧭 **Breadcrumb footer 3 niveaux** : `HOME > Super-cat > Page sélectionnée` avec couleur de la super-cat (`superCatLabel()`, `superCatColor()`, `superCatIndexFor()`).

---

## [1.0.72] — 2026-05-31

🐛 **Fix sync `yamzyCarouselIndex` avec `setPage()`** — User a trouvé lui-même : *"j'utilise le scroll et le scroll n'est pas adapté au clique menu"*. Le carousel et le menu étaient désynchronisés.

---

## [1.0.71] — 2026-05-31

🐛 **Fix click super-cat sidebar ouvre vraiment la page** — `onNavClick()` ne changeait pas `studioLevel` ni n'ouvrait le content. Ajout `studioLevel='section'` + `openPageContent`.

---

## [1.0.70] — 2026-05-31

🃏 **Cockpit affiche les cards des pages de la super-cat active** sous "ACTUALITÉ DU PROJET" (ex : super-cat Dashboard → 3 pages en sous-cards : Dashboard Global, Dashboard Paramétré, Dashboard Legacy).

---

## [1.0.67-69] — 2026-05-31

📐 **Layout évolution majeure** : avatar viré du header, header pleine hauteur, `Mes Plannings` imbriqué demi-largeur à l'intérieur, scrollbar moche retirée.

---

## [1.0.66] — 2026-05-31

📐 **Cockpit colonne droite, pleine HAUTEUR viewport**.

---

## [1.0.65] — 2026-05-31

🎯 **Carousel cards cachées, PS hero devient l'objet scrollable principal** (wheel + swipe).

---

## [1.0.64] — 2026-05-31

🎯 **Hint clavier retiré + PS hero cliquable** → ouvre le contenu de la page (`openPageContent()` au lieu du wheel hint).

---

## [1.0.63] — 2026-05-31

🧭 **Sidebar gauche = 5 super-cats** (Dashboard / Sprint / Planning / Reporting / Setup) au lieu des 43 pages directement.

---

## [1.0.62] — 2026-05-31

⏪ **Revert v1.0.59** — User : *"désolé je voulais dire occuper la hauteur pas la largeur"*. Cockpit retrouve pleine HAUTEUR (à droite du PS hero) au lieu de pleine largeur dessous.

---

## [1.0.61] — 2026-05-31

🗂 **43 pages réorganisées en 5 super-catégories avec sous-cats préservées**.

### Added
- `PageDef.superCat: SuperCat` (Dashboard / Sprint / Planning / Reporting / Setup).
- `SUPER_CATS: SuperCatDef[]` avec icon, label, desc, color.
- Mapping complet : Dashboard (3 pages), Sprint (10), Planning (9), Reporting (11), Setup & Guides (10).

---

## [1.0.60] — 2026-05-31

📐 **`padding-bottom: 80px` sur main** pour éviter la superposition `Mes Plannings` / footer carousel.

---

## [1.0.51] — 2026-05-30

🔍 **Fix : "je trouve plus mon projet"** — Mes Plannings désormais
visible même quand AUCUN projet n'est sélectionné. L'utilisateur peut
toujours retrouver/sélectionner son projet via les cards.

### Fixed
- Le `<ng-container *ngTemplateOutlet="dashHeaderTpl">` était placé hors
  de `*ngIf="selectedProjectId()"` mais le `<ng-template #dashHeaderTpl>`
  restait défini DEDANS → templateRef = undefined sans projet → seul
  l'écran "empty" s'affichait.
- Le wrapper `<ng-container *ngIf="selectedProjectId() as pid">` est
  remplacé par un `<ng-container>` non-conditionnel (le `pid` n'était
  pas utilisé). Le template est désormais toujours défini.
- `.wt-page-header` reçoit son propre `*ngIf="api.selectedProjectId()
  && !isDashboardSkin()"` pour rester correctement masqué sans projet.

### Added
- `.wt-pick-hint` : message d'aide visible quand des projets existent
  mais qu'aucun n'est sélectionné — pointe vers Mes Plannings + topbar.
- Empty state (`.wt-empty` avec import CTA) maintenant limité au cas
  *zéro projet existant*.

---

## [1.0.50] — 2026-05-30

🔝 **Mes Plannings remonté au-dessus du cockpit** + **sidebar gauche
restylée façon Codepen "Pure CSS One page vertical navigation"**
(référence Alberto Hartzet).

> "déploie la partie my planning pour qu'elle soit au-dessus de la
> partie cockpit ... utilise le même style que cette référence
> identique [Codepen vertical nav]"

### Changed — Ordre dashboard
- `wt-sk-top` (Mes Plannings) déplacé **en première position** dans
  `#dashHeaderTpl`, juste après l'ouverture de `<section class="wt-sk-dash">`.
- L'ancien `wt-sk-top` en bas de section supprimé (un seul rendu).
- Nouvel ordre vertical : **Mes Plannings → PS hero + Cockpit (row) →
  page-specific content**.

### Changed — Sidebar `.wt-sk-nav` (style Codepen hrtzt/pgXMYb)
- `position: fixed` à gauche, **centré verticalement** (top: 0, bottom: 0,
  margin: auto 0, height: 340px).
- Background **transparent** (plus de bloc gris) — flotte au-dessus du
  3D background.
- Icones **blancs 32px** avec drop-shadow.
- Hover : `opacity: 0.5` (Codepen exact).
- Active : `transform: scale(1.2)` + couleur dorée `#d99a51`,
  transition `.5s ease-out` (Codepen exact).
- Labels conservés (DASHBOARD / PLANNINGS / BACKLOG / ANALYTICS / MORE)
  mais réduits à 9px pour matcher.
- `.wt-body { padding-left: 90px }` pour compenser la sidebar fixed
  (le contenu n'est pas masqué).

### Responsive
- `< 760px` : sidebar 56px / icons 24px, padding-left ajusté à 64px,
  labels cachés.

---

## [1.0.49] — 2026-05-30

🪟 **Dashboard converti en ng-template `#dashHeaderTpl`** réinjecté
explicitement au-dessus de chaque page — comme demandé textuellement
par l'utilisateur :

> "prends le dashboard actuel comme template pour chaque page, insère
> le dans toutes les pages c'est simple"

### Changed — Refactor en template Angular
- Tout le bloc dashboard (PS hero + Cockpit + Mes Plannings) est
  maintenant enveloppé dans `<ng-template #dashHeaderTpl>`.
- Le template est défini une seule fois dans `<main>` et rendu via
  `<ng-container *ngTemplateOutlet="dashHeaderTpl"></ng-container>`
  placé au-dessus de toutes les sections de page.
- Comportement identique à v1.0.48 (dashboard visible partout) mais
  structure explicitement template-based comme demandé.

### Pourquoi
- Plus de doute possible sur l'intention : le template est nommé,
  documenté, et rendu via un mécanisme Angular standard.
- Si demain on veut le rendre AILLEURS (footer, modal, etc.), il
  suffit d'ajouter un `*ngTemplateOutlet="dashHeaderTpl"` au bon
  endroit — c'est un template, pas une section figée.

---

## [1.0.48] — 2026-05-30

🪟 **Dashboard universel sur toutes les pages** — copier-coller intégral
de la section `.wt-sk-dash` (PS hero + cockpit + Mes Plannings) comme
header commun sur chaque page du studio.

> "il faut copier coller toute sette section pour chaque page si besoin
> créer un header template et réinjecte le"

### Changed — Section dashboard toujours visible
- Suppression du conditional `[class.is-hidden-section]="activePage() !== 'dashboard'"`
  sur `<section class="wt-sk-dash">` → désormais toujours dans le flux,
  visible quelle que soit la page active.
- Le PS hero du dashboard (avec avatar Yamzy 3D, sprint actif, bouton
  Lancer/Interrompre) devient le header universel.
- Le cockpit + ACTUALITÉ DU PROJET (déjà refactorisés en `ng-template
  #cockpitNewsBlock` en v1.0.45) restent visibles partout.
- Mes Plannings (`.wt-sk-top`) toujours présent — l'utilisateur peut
  switcher de projet depuis n'importe quelle page.

### Removed — Duplicatas page-specific
- `wt-page-ps-header` (introduit v1.0.42) : redondant avec le PS hero du
  dashboard → supprimé du template.
- `wt-page-cockpit-aside` (introduit v1.0.45) : le cockpit est déjà dans
  la section dashboard universelle → supprimé du template.
- Les styles CSS associés restent pour compat (au cas où un autre
  composant les réutiliserait), mais ne sont plus instanciés.

### Changed — Preview mode adapté
- `.wt-main.is-preview > section.wt-sk-dash .wt-sk-top { display: none }`
  RETIRÉ : Mes Plannings reste visible en preview comme demandé.
- En preview (studioLevel='section' && !pageContentOpen), seules les
  sections page-spécifiques sont cachées — le header dashboard complet
  reste affiché.

### Architecture
- Un seul header pour les régir tous : moins de duplication HTML/CSS.
- Le pattern `ng-template #cockpitNewsBlock` permet toujours d'injecter
  le cockpit dans d'autres contextes si besoin futur.

---

## [1.0.23] — 2026-05-31

🎠 **Carrousel 3D vertical à côté de YAMZY** : Yamzy lance des "bulles
de message" — cards 3D qui flottent juste à côté de l'avatar.

### Added — wt-yc carrousel 3D
Inspiré du Team Carousel codepen (perspective:1000px + transitions
cubic-bezier 0.8s). Fixed position à droite du FAB :
- `left: 440px` (= 100 FAB + 320 width + 20 margin)
- `bottom: 50px`, `width: 380px`, `height: 480px`

**5 positions 3D** :
- `.center` : scale 1.06, z-index 10, ring or
- `.up-1` / `.down-1` : ±95px, scale 0.85, translateZ -100, grayscale 40%
- `.up-2` / `.down-2` : ±160px, scale 0.7, translateZ -300, grayscale 70%
- `.hidden` : opacity 0, translateZ -500

**Contenu dynamique (max 6 cards)** :
1. Action en cours / prochain / idle
2-4. Prochaines réunions
5. Top ticket prioritaire
6. Alerte HIGH

**Card design** : 320×150, grid icon coloré + body. Record dot
blanc/rouge au coin (réutilise le pattern live v1.0.20).

**Nav** : arrows up/down + dots + click center = action.

### Fixed — FAB z-index 99999 + isolation
> "l'avatar toujours caché derrière .wt-sk-top"

- z-index 950 → 99999
- `isolation: isolate` → stacking context propre, immune aux parents

### Why
> "maintenant t'utilise la même carrousel de ce code et savoir la
> positioner pour que soit on dirait c'est l'avatar qui les lance
> juste à côté comme si ces panels sont des messages que l'avatar
> affichera"

---

## [1.0.22] — 2026-05-31

### Fixed — YAMZY FAB sur TOUTES les pages (vraiment)
Le FAB était dans `.wt-shell` qui est `display:flex; flex-direction:row`.
Théoriquement `position:fixed` devrait sortir du flux, mais selon le
navigateur et les filtres backdrop des parents, ça pouvait foirer.
- **Déplacé HORS de `.wt-shell`** — maintenant sibling direct du host
- **z-index 80 → 950** (au-dessus de tout sauf les modals/wt-dialog)
- **`*ngIf="!splashVisible()"`** — n'apparaît plus pendant le splash
  d'ouverture (sinon il flashe par-dessus l'anim)

### Why
> "je pense il est pas mit comme fab button sur tout l'app"

---

## [1.0.21] — 2026-05-31

### Changed — YAMZY plus près des bords
- `bottom: 45px → 20px`
- `left: 125px → 100px` (= 80px sidebar + 20px marge)
- Idem responsive (1400: 20/100, 1100: 20/95)

### Why
> "fais 20 au lieu de 45"

---

## [1.0.20] — 2026-05-31

🎯 **Fix live pattern fidèle à la référence** : le rendu cockpit
ne matchait pas le code d'origine — le frame TV en couleur fond
cosmic était invisible, et la barre rouge horizontale n'était pas
le bon pattern.

### Fixed — Bord rouge en L (top + right)
- **Avant** : `border-top: 6px solid #2b2549; border-right: 6px solid
  #2b2549` — la couleur étant celle du fond cosmic, le frame était
  **invisible** sur le dashboard.
- **Maintenant** : repris du SVG path d'origine — un bord rouge
  `#ea4d60` 3px qui trace **uniquement le bord top + right** de la
  card, avec drop-shadow rouge pour le glow.
- Bottom + left en `transparent` pour ne PAS tracer le bas/gauche.
- `border-radius: 24px` matche la card → courbe du coin top-right.

### Fixed — Record dot au coin (2 cercles concentriques)
- **Avant** : `.wt-card-ribbon` séparée avec barre horizontale +
  cercle en deux pseudo-éléments — ne matchait pas la ref.
- **Maintenant** : repris du SVG d'origine — deux cercles
  concentriques au coin top-right :
  - `::before` = cercle blanc 16×16 (outer r=8 = 50%)
  - `::after`  = cercle rouge 8×8 inset (inner r=4 ≈ 50% du parent)
  - `translate(50%, -50%)` → centré pile sur le coin
- Pulse blink subtil (`opacity 1↔0.55` + `scale 1↔0.82` 1.6s) sur
  le cercle interne — plus discret que l'ancien ping qui scalait
  jusqu'à 3.5×.

### Architecture
- Simplifié de 3 décorations (ping + tv + ribbon) à **2** (frame + rec)
- `.wt-sk-card-live { overflow: visible !important }` pour laisser
  passer le record dot qui déborde de 8px du coin (effet record cam)
- ng-template `#liveDeco` raccourci d'une div

### Why
> "le rendu n'est pas pareil dans le code d'origine"

Le pattern original a un bord rouge en L (continu) + un seul record
dot au coin. Pas de barre horizontale détachée + pas de point pulsant
séparé.

---

## [1.0.19] — 2026-05-31

🩹 **Hotfix YAMZY** : reste dans le cadre + plus de rotation
(anti-dizziness).

### Fixed — Position avatar
- **Avant v1.0.19** : `bottom: -40px` poussait l'avatar sous la
  bordure inférieure du viewport — la moitié basse était coupée.
- **Maintenant** : `bottom: 45px; left: 125px` (80px sidebar + 45px
  marge). L'avatar reste entièrement visible dans le cadre.
- Taille ajustée à 320×320 (au lieu de 400×400) pour éviter de
  déborder même sur petits écrans — un compromis taille/visibilité.

### Fixed — Rotation désactivée
- `[rotate]="false"` (était `true`) — le tournoiement constant
  rendait dizzy.
- **Bobbing conservé** (`[bob]="true"`) — translation Y douce
  sinusoïdale, beaucoup moins agressif que la rotation.
- **GLB anims natives conservées** (`[playGlbAnim]="true"`) — joue
  les clips d'idle si présentes dans le modèle.

### Why
> "l'avatar est mal positionné il sort du cadre et n'est pas
> positionné vraiment à 45 px bot et les côtés"
> "il faut qu'il arrête de tourner il m'a fait mal aux yeux"

---

## [1.0.18] — 2026-05-31

📺 **YAMZY 400px + Cockpit LIVE stream** : taille exacte du PS hero
dashboard + chaque card du cockpit prend l'apparence d'un stream
en direct (ping rouge, frame TV, ruban REC).

### Changed — YAMZY companion 400×400
- Size **400px** (égale au PS hero du dashboard, plus 320px)
- Position `bottom: -40px; left: 88px` — pendant exact du PS hero
  `top: -40px; right: -20px`
- Drop-shadow renforcée (40px + glow gold)

### Added — Live PIP pattern sur cockpit cards
Inspiré du React Streaming Dashboard de référence (.ping-outer +
.player frame + ruban rouge). Chaque card cockpit avec
`.wt-sk-card-live` reçoit **3 décorations** :

1. **Ping rouge pulsant** (`.wt-card-ping`) top-right 10×10 px
   - Pseudo `::after` qui scale 1→3.5 avec opacity 0.85→0
   - Animation `wt-card-ping-pulse 1.6s` cubic-bezier infinite
2. **Frame TV** (`.wt-card-tv`)
   - `border-top: 6px solid #2b2549; border-right: 6px solid #2b2549`
   - Effet "écran encastré" cosmic
3. **Ruban REC corner** (`.wt-card-ribbon`)
   - `::before` = barre rouge 60×3 px (avec glow rouge)
   - `::after` = témoin blanc 14×14 px avec anneau rouge 3 px
     (effet record/live light)

### Variantes
- `.wt-sk-card-hero.wt-sk-card-live` : ping 1.2s (plus rapide),
  ribbon glow 14px (plus intense)
- `.wt-sk-card-alert.wt-sk-card-live` : ping + ribbon en `#ff5c5c`
  (orange-rouge alerte)

### Architecture
Pour éviter la duplication HTML, le contenu des 3 décos est dans
un `<ng-template #liveDeco>` réutilisé via `*ngTemplateOutlet` sur
chaque card cockpit (active, next, idle, list items, ticket items,
alert items).

### Why
> "utilise la même taille que celui déjà utilisé dans le dashboard"
> "utilise le même design de live (ping + frame + ribbon) afin de
> l'appliquer à toutes les cards pour le cockpit"

---

## [1.0.17] — 2026-05-31

🎮 **YAMZY companion full-anim** : retour à l'essentiel — juste le gros
avatar 3D animé en bas à gauche, partout dans le studio.

### Changed — FAB simplifié
- **Plus de Guide panel** (popup latérale retirée)
- **Avatar seul**, taille équivalente au PS hero (~320px)
- **Position bottom-left** au lieu de bottom-right (l'autre côté du
  cockpit qui est à droite)
- **Déborde de 40px en bas** comme le PS hero original
- `pointer-events: none` → purement décoratif, ne bloque pas les clics
- Drop-shadow renforcée (24px black + 30px gold glow)

### Added — Toutes les animations actives
- **`rotate`** : rotation Y idle (0.005 rad/frame)
- **`bob`** : translation Y sinusoïdale (period 2.4s, amplitude 8%)
- **`playGlbAnim`** : THREE.AnimationMixer joue toutes les clips
  natives du GLB

```html
<app-yamzy-avatar-3d glbUrl="/assets/agents/YAMZY.glb"
                     [rotate]="true" [bob]="true" [playGlbAnim]="true">
```

### Responsive
- ≤1400px : 240×240
- ≤1024px : 180×180
- ≤720px  : masqué (place pour le contenu)

### Why
> "nn tu mets seulement l'avatar et duplique sa taille et dans l'autre
> partie de l'écran et active toutes les anim"

NB : ça déroge à la règle précédente "laisse le glb fix pas d'anim" qui
ne concernait que **l'avatar du PS hero du dashboard** (qui reste fixe).
Le compagnon FAB v1.0.17 = anim ON.

---

## [1.0.16] — 2026-05-31

🐰 **YAMZY FAB partout** : ton compagnon 3D flotte en bas à droite
sur toutes les pages du studio. Clic = panneau "Yamzy Guide"
contextuel qui t'explique la page active (Yamzy + Scrum).

### Added — Floating YAMZY 3D avatar
- **FAB** (Floating Action Button) avec le modèle GLB `YAMZY.glb`
  positionné `fixed; bottom: 24px; right: 78px;` — laisse passer le
  right sidebar des projets
- **Animations subtiles** :
  - Bobbing flottant 4.2s ease-in-out (translateY ±8px)
  - Glow radial gold + purple en arrière (blur 14px, scale pulse 3s)
  - Bulle 💬 en coin top-right, pulse-rotate 2.4s pour inciter au clic
  - Hover : translateY -6px + scale 1.08 (cubic bezier rebondi)
- **Visible partout** : ajouté en racine du component (hors page
  sections), pas seulement sur le dashboard

### Added — Yamzy Guide panel (contextuel)
- Clic sur le FAB → side panel droite 380px slide-in 0.32s
- Contenu **réactif à la page active** via `TOOLTIP_GUIDE` :
  - 📍 Page ID (monospace gris)
  - **Nom Yamzy** en grand (Pirata One 28px, or glowing)
  - Badge "Scrum: <nom officiel>" (cyan rounded pill)
  - Description narrative (14px, line-height 1.55)
  - 💡 Astuce (italique, fond or léger, bordure gauche)
- **Actions rapides** : 6 boutons 42px ronds (📖 Mode d'emploi,
  🏰 Dashboard, 📅 Agenda, 📜 Backlog, ⚠ Risques, 🌐 toggle FR/EN)
- **Footer narratif** : "✨ Yamzy te guide à travers les rituels Scrum"
- État empty (page sans tooltip) : message d'accueil Yamzy

### Why
> "ajoute l'avatar comme fab sur tout le studio"

Avant v1.0.16, l'avatar Yamzy n'apparaissait QUE sur le dashboard
(dans la card PS hero). Maintenant il accompagne l'utilisateur sur
toutes les pages comme un vrai compagnon — et il est cliquable pour
ouvrir un guide narratif contextuel qui mixe vocabulaire Scrum +
Yamzy World.

---

## [1.0.15] — 2026-05-31

✎ **Mode édition sur le calendrier** : créer / supprimer des événements
directement depuis la grille mensuelle sans quitter la page.

### Added — Calendar edit mode
- **Bouton `+` rond** en haut de chaque cellule (visible au hover en
  mode édition) — pré-remplit la modal "Nouvel événement" avec la
  date de la case + heure par défaut 9h-10h
- **Drop zone "+ événement"** en bas de chaque cellule (alternative
  plus visible que le bouton rond)
- **Bouton `×` rouge** sur chaque event au hover (mode édition) pour
  supprimer rapidement avec confirmation
- **Top crud bar** sur la page Calendrier avec "+ Nouvel événement"
  + "🔄 Régénérer cérémonies Scrum" toujours visibles
- **Hint dynamique** :
  - Mode édition actif : "✎ clique sur le **+** d'une case"
  - Mode lecture : "💡 Active le mode édition (🔒 → 🔓) pour…"

### Why
> "je devrais pouvoir en mode edit de calendrier ajouter les
> événements aussi"

Avant v1.0.15, il fallait aller sur la page Agenda pour ajouter un
event, ou cliquer sur le bouton "+ Réunion" du cockpit. Maintenant
la grille mensuelle est éditable comme l'Excel.

---

## [1.0.14] — 2026-05-31

🎓 **Yamzy Guide narratif + Cockpit fusionné dans la news zone** :
le studio devient pédagogique — chaque label porte deux identités
(Scrum officiel + univers Yamzy World) et le cockpit prend
place dans la zone news, en cards game-style avec avatars game.

### Fixed — Calendar enfin peuplé
- **Bug majeur** : la page Calendrier restait vide même avec des sprints
  parce que `generateScrumCeremonies` ne tournait QUE pour le sprint
  EN_COURS. Si tu importais un Excel avec 5 sprints, seul 1 max
  avait ses daily/planning/review/retro.
- **Backend** : `regenerate-scrum` itère maintenant sur TOUS les sprints
  qui ont des dates (pas juste EN_COURS). Idempotent.
- **Backend** : nouvel endpoint `/events/auto-ensure` — silencieux,
  appelé par le frontend au chargement du calendrier ou de l'agenda
  pour les sprints encore non couverts.
- **Frontend** : `ensureEventsThenRefresh()` se déclenche
  automatiquement à la sélection projet + à l'entrée sur les pages
  calendrier/agenda. Plus besoin de cliquer manuellement.

### Changed — Cockpit fusionné dans .wt-sk-news
- Le cockpit "Chicago" était une carte séparée sous la PS hero.
  Il est maintenant **intégré dans la zone news** (à droite du hero),
  au-dessus des cards news existantes.
- **Header cockpit** : titre ⚔ COCKPIT + sous-titre (sprint · évts)
- **Nav 4 onglets** Action / Réunions / Tickets / Alertes avec
  l'état actif gradient or
- Le contenu du cockpit s'affiche via les **mêmes `.wt-sk-news-card`**
  que les news (background #342e59, radius 24px, layout thumb + body
  + tags) — visuellement cohérent avec le pattern game existant
- Séparateur "ACTUALITÉ DU PROJET" entre cockpit et news classiques

### Added — Avatars game-style sur les cards cockpit
- Les cards d'event affichent les attendees en **avatars overlapping**
  (cercles 26px, -7px margin, 2px border, drop-shadow) — exactement
  le pattern utilisé partout dans le skin Yamzy
- Indicateur "+N" pour les attendees au-delà des 5 visibles

### Added — Tooltip system Yamzy Guide + Scrum Guide
- Nouveau composant **`WtTooltipDirective`** + base de tooltips
  **`TOOLTIP_GUIDE`** (50+ entrées FR + EN)
- Format narratif : "⚔ Carnet de Quêtes · Scrum: Product Backlog"
  + description courte + 💡 astuce optionnelle
- Appliqué sur :
  - **42 pages du drawer** (sidebar) — chaque page = double identité
  - **Topbar** : Import, Export, Edit Mode, Sélecteur de projet,
    Cloche d'alertes
  - **4 onglets cockpit** : Action / Réunions / Tickets / Alertes
- Hover 350ms avant apparition, fade-in 180ms
- Auto-position (top/right/bottom/left) avec clamp viewport
- Style cosmic + bordure or + accent Scrum cyan

### Vocabulaire bilingue (extraits)
| Page Studio       | Yamzy World           | Scrum             |
| ----------------- | --------------------- | ----------------- |
| Backlog           | Carnet de Quêtes      | Product Backlog   |
| Daily             | Conseil Matinal       | Daily Stand-up    |
| Sprint Planning   | Conseil de Sprint     | Sprint Planning   |
| Rétrospective     | Cercle des Sages      | Retrospective     |
| DoD               | Pacte de Victoire     | Definition of Done|
| Dashboard         | Tour de Garde         | Dashboard         |
| Capacity          | Compagnons d'Aventure | Capacity Planning |
| Risques           | Sortilèges Sombres    | Risk Register     |
| Tech Debt         | Dette de Sang         | Technical Debt    |
| Calendrier        | Calendrier de Bataille | Monthly Calendar |
| Agenda            | Journal d'Aventures   | Agenda            |
| Stakeholders      | Conseil des Sages     | Stakeholders      |

### Why
> "pk je vois toujours rien sur mon calendrier pas de daily rien !!"
> "ajoute des tooltip partout dans le studio de sorte comme si c'est
> Yamzy qui expliquait à l'utilisateur — prépare des messages qui
> correspondent au Scrum et Yamzy guide. il faut inclure les deux
> thermes. gère les deux langues français anglais."
> "met le cockpit dans cette partie (.wt-sk-news) — réutilise la même
> carrousel + le même style des cards déjà utilisé pour afficher les
> tickets + le même style des avatars présent dans la source de game"

---

## [1.0.13] — 2026-05-30

👥 **Identité d'équipe + Calendrier riche** : chaque membre a un vrai
avatar (couleur, emoji, initiales) — base du futur réseau Yamzy où
chaque équipier sera un user invitable. Le calendrier mensuel affiche
enfin les daily/planning/review/retro à côté des tickets, avec
détection automatique des collisions d'horaires.

### Added — Team Members (capacity enrichi)
- **V63 migration** : 5 nouvelles colonnes sur `pos_capacity_team`
  (`color_hex`, `avatar_emoji`, `initials`, `email`, `yamzy_handle`)
- **Page Capacity refondue** en cartes-avatars (au lieu d'un tableau plat) :
  - Avatar circulaire 56px (couleur auto-hash + emoji ou initiales)
  - Nom + rôle + chips meta (alloc %, h/j, email, **handle @yamzy**)
  - Modal d'édition d'identité (couleur picker + palette 12 swatches,
    emoji 4 chars, initiales auto, email, handle Yamzy)
- **Vision future** : le `yamzy_handle` est la base du réseau —
  "@pseudo" deviendra une vraie invitation cross-user dans le futur

### Added — Attendees avec avatars
- Multi-select de team members dans la modal "Nouvel événement" :
  chips cliquables avec mini-avatar coloré + nom
- Au launch d'un sprint, `PosCalendarService.generateScrumCeremonies`
  populate automatiquement les attendees de tous les events Scrum
  (planning / daily / review / retro) depuis la team du projet
- Mini-avatars (13px) visibles directement sur le calendrier mensuel
  dans chaque event cell (jusqu'à 4 + "+N" pour le reste)

### Fixed — Calendrier monthly affiche les events
- **Bug majeur** : la page Calendrier ne montrait QUE les tickets,
  pas les daily/planning/review/retro/meetings — corrigé.
- Chaque cellule du calendrier affiche maintenant :
  - Events en haut (color-coded par type, heure + titre + mini-avatars)
  - Tickets en bas (range par sprint color)
- **Couleurs par type d'event** : DAILY vert, PLANNING bleu,
  REVIEW or, RETRO rose, MEETING violet, CALL cyan
- **2 légendes séparées** : "Événements" + "Sprints"

### Added — Détection de collisions
- Backend : nouvel endpoint `/api/pos/projects/{id}/events/collisions`
  qui retourne les paires d'events qui se chevauchent
- Frontend : détection locale temps-réel sur le calendrier
  - Cellules en conflit : bordure rouge + ⚠ pulsant
  - Events en collision : fond rouge + bordure rouge
  - Tooltip "CHEVAUCHEMENT" sur hover

### Added — Time Allocation widget (Agenda)
- Backend : endpoint `/api/pos/projects/{id}/time-allocation`
  qui calcule par sprint : `ticketHours` + `eventHours` + pourcentages
- Frontend : nouveau widget sur la page Agenda
  - Total tickets vs cérémonies (barre or vs bleue)
  - Breakdown par sprint avec stacked bar + meta `Xh · %t / %e`
- Permet de **voir le coût réel** des cérémonies vs travail prod

### Added — Excel sheets v1.0.13
- **Sheet "Team"** : Nom, Rôle, Email, Yamzy Handle, Alloc %, H/jour,
  Couleur, Initiales, Emoji, Sprint Hours
- **Sheet "Calendar"** : Type, Titre, Début, Fin, Status, Lieu,
  Couleur, Attendees (formaté "name (response); name (response)"), Notes
- Round-trip complet : modifie l'équipe dans Excel → ré-importe →
  les avatars persistent

### Why
> "les icon des avatar des utilisateurs en réunion en choix dépend
> de l'excel qui aura le team que l'utilisateur pourra ajouter des
> membres dans son excel et studio pour avoir vraiment l'impression
> qui sont des gens réelles qu'on contactera vraiment dans le futur
> avec le réseau yamzy ;)"

> "pk je vois pas les daily sur le calender???!!! ni les réunion."

> "il faut avoir un calendrier asser riche en infos avec des couleurs
> différentes avec un system qui detecte les collisions aussi"

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
