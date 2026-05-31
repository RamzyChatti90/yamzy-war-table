// Place: yamzy-war-table-frontend/src/app/features/war-table/war-table.pages-meta.ts
// v1.0.110 — Metadonnees enrichies par page pour le Page Hero Gaming.
//
// Chaque page a :
//   - summary       : phrase tagline (sur le hero)
//   - description   : 2-3 phrases sur l'usage Scrum.org
//   - scrumRefs     : références au Scrum Guide 2020 / Nexus / etc.
//   - forRoles      : roles Scrum cibles
//   - cadence       : frequence ("Quotidien", "Sprint", "Trimestriel", ...)
//   - quickActions  : actions rapides (icon + label + description + actionId)
//   - relatedPages  : autres pages reliees logiquement (pour cards reference)
//   - inputs        : ce qui rentre dans cette page
//   - outputs       : ce qui en sort
//   - tipsScrum     : pro-tips style Scrum.org
//
// actionId mappes vers des methodes du war-table.component.ts via un dictionnaire
// dans le composant (executeAction(actionId)).

export type ScrumRole = 'PO' | 'SM' | 'DEV' | 'ARCH' | 'STAKE' | 'ALL';

export interface ActionDef {
  id: string;                  // ex: "add-ticket", "launch-sprint"
  icon: string;                // emoji
  label: string;
  description: string;         // tooltip explicatif
  primary?: boolean;           // bouton principal stylé en avant
  edit?: boolean;              // visible uniquement en mode édition
}

export interface PageMeta {
  summary: string;
  description: string;
  scrumRefs: string[];
  forRoles: ScrumRole[];
  cadence?: string;
  quickActions: ActionDef[];
  relatedPages: string[];
  inputs: string[];
  outputs: string[];
  tipsScrum: string[];
}

export const ROLE_LABELS: Record<ScrumRole, { label: string; icon: string; color: string }> = {
  PO:    { label: 'Product Owner',     icon: '🎯', color: '#d99a51' },
  SM:    { label: 'Scrum Master',      icon: '🧙', color: '#6647bf' },
  DEV:   { label: 'Developer',         icon: '⚔',  color: '#4696b9' },
  ARCH:  { label: 'Architect',         icon: '🏛', color: '#9d8ad6' },
  STAKE: { label: 'Stakeholder',       icon: '👁', color: '#c25d8d' },
  ALL:   { label: 'Toute la team',     icon: '🛡', color: '#70b944' },
};

export const PAGE_META: Record<string, PageMeta> = {
  // ═══ 🎯 DASHBOARD (3 pages) ═══
  'dashboard': {
    summary: 'Tour de garde du Realm — état global du projet en temps réel',
    description: "Vue d'ensemble : sprint actif, vélocité, burndown, alertes. Le Dashboard répond à \"où en est-on ?\" en un coup d'œil. Toutes les métriques clés Scrum sont visibles : sprint goal, days remaining, velocity trend, top blockers, daily attendance.",
    scrumRefs: ['Scrum Guide 2020 §Daily Scrum', 'Empirisme : Transparency'],
    forRoles: ['PO', 'SM', 'DEV', 'STAKE'],
    cadence: 'Permanent (refresh live)',
    quickActions: [
      { id: 'launch-sprint',     icon: '🚀', label: 'Lancer sprint',         description: 'Démarre le sprint prochain (idempotent — génère les cérémonies Scrum)', primary: true },
      { id: 'reset-archive',     icon: '🔄', label: 'Reset & archive',       description: 'Archive le sprint en cours + reset le projet pour repartir propre', edit: true },
      { id: 'regen-ceremonies',  icon: '✨', label: 'Régénérer Scrum',       description: 'Re-crée daily/planning/review/retro pour le sprint actif si absents' },
      { id: 'open-roadmap',      icon: '🗺',  label: 'Roadmap',               description: 'Vue jalons macro à long terme' },
    ],
    relatedPages: ['sprints', 'backlog', 'burndown', 'risks', 'roadmap'],
    inputs: ['Sprint actif', 'Tickets backlog', 'Velocity historique', 'Reminders backend'],
    outputs: ['Décisions de pilotage', 'Alertes équipe', 'Excel export auto'],
    tipsScrum: [
      '🎯 Le Dashboard sert le principe de Transparence (Scrum Pillar 1)',
      '⚡ Si une métrique est rouge → action immédiate, pas attendre la review',
      '📊 La vélocité moyenne sur 3 sprints est plus fiable que celle d\'un seul sprint',
    ],
  },
  'dashboard-param': {
    summary: 'Cockpit personnalisé — chacun voit ce qui le concerne',
    description: 'Dashboard configurable : choisir les widgets visibles selon son rôle. Idéal pour différencier la vue PO (focus ROI/Roadmap) de la vue Dev (focus tickets perso/blockers).',
    scrumRefs: ['Scrum Guide 2020 §Daily Scrum', 'Personalization patterns'],
    forRoles: ['ALL'],
    cadence: 'Permanent',
    quickActions: [
      { id: 'configure-widgets', icon: '🎛', label: 'Configurer widgets', description: 'Ajouter/retirer des cartes du dashboard', primary: true },
      { id: 'reset-layout',      icon: '↺',  label: 'Reset layout',       description: 'Revenir à la disposition par défaut' },
    ],
    relatedPages: ['dashboard', 'dashboard-legacy'],
    inputs: ['Préférences user', 'Données du projet'],
    outputs: ['Vue personnalisée persisted en localStorage'],
    tipsScrum: ['🎨 Chacun adapte sa vue, mais la source de vérité reste partagée'],
  },
  'dashboard-legacy': {
    summary: 'Vue dashboard historique (compat ancienne version)',
    description: 'Préservé pour rétrocompatibilité. Reproduit la disposition originale du studio v1.0.0.',
    scrumRefs: ['—'],
    forRoles: ['ALL'],
    cadence: 'Permanent',
    quickActions: [
      { id: 'migrate-to-current', icon: '➡', label: 'Migrer vers v2', description: 'Passer au dashboard nouvelle version' },
    ],
    relatedPages: ['dashboard'],
    inputs: ['Snapshot historique'],
    outputs: ['Vue legacy'],
    tipsScrum: ['💎 Garde une trace de l\'évolution du studio'],
  },

  // ═══ 🏃 SPRINT (10 pages) ═══
  'backlog': {
    summary: 'Le Product Backlog — toutes les quêtes du Realm',
    description: 'Liste ordonnée de tout ce qui peut être fait : features, bugs, tasks, spikes. Le PO l\'ordonne par valeur. Les Devs raffinent les éléments du haut (refinement). Chaque élément a un title, un type, une estimation, une priorité.',
    scrumRefs: ['Scrum Guide 2020 §Product Backlog', 'Scrum Guide 2020 §Refinement'],
    forRoles: ['PO', 'DEV', 'SM'],
    cadence: 'Refinement hebdo + ad-hoc',
    quickActions: [
      { id: 'add-ticket',     icon: '➕', label: 'Nouveau ticket',     description: 'Crée un PBI (Task/Bug/Story/Spike) avec estimation', primary: true },
      { id: 'bulk-edit',      icon: '✏', label: 'Édition groupée',   description: 'Modifie status/sprint/assignee/priority sur N tickets sélectionnés' },
      { id: 'export-excel',   icon: '📥', label: 'Export Excel',       description: 'Télécharge le backlog en .xlsx' },
      { id: 'refinement',     icon: '🔍', label: 'Mode refinement',    description: 'Filtre les PBIs non estimés pour cérémonie refinement' },
    ],
    relatedPages: ['sprints', 'sprint-planning', 'backlog-tma', 'detail-tickets'],
    inputs: ['Vision produit', 'Discovery user', 'Bug reports', 'Tech debt'],
    outputs: ['PBIs ordonnés', 'Sprint Backlog (après planning)'],
    tipsScrum: [
      '📜 DEEP : Detailed appropriately, Estimated, Emergent, Prioritized',
      '🎯 Seul le top du backlog doit être Ready (DoR) — pas tout',
      '⚖ Le PO est SEUL responsable de l\'ordre — pas la team',
    ],
  },
  'backlog-tma': {
    summary: 'Backlog TMA — maintenance et évolutions petits',
    description: 'Backlog dédié aux tickets de Tierce Maintenance Applicative (run, support, hot-fixes). Permet de séparer le delivery feature du run quotidien pour mesurer leur poids respectif.',
    scrumRefs: ['Scrum.org - Multiple Backlogs antipattern'],
    forRoles: ['PO', 'DEV'],
    cadence: 'Continue',
    quickActions: [
      { id: 'add-ticket',         icon: '➕', label: 'Nouveau ticket TMA', description: 'Crée un ticket de maintenance', primary: true },
      { id: 'tma-vs-build',       icon: '📊', label: 'Ratio TMA/Build',     description: 'Voir le % de capacité absorbée par TMA' },
    ],
    relatedPages: ['backlog', 'tech-debt'],
    inputs: ['Tickets support', 'Incidents production'],
    outputs: ['Tickets TMA prioritisés'],
    tipsScrum: ['⚠ Risque d\'antipattern : 2 backlogs = 2 prios concurrentes. À gérer avec le PO.'],
  },
  'sprints': {
    summary: 'Carte des expéditions — cycles Scrum du projet',
    description: 'Le Sprint = container temporel fixe (1-4 semaines) avec un Sprint Goal. Cette page liste tous les sprints (passés, en cours, planifiés) avec leurs dates, capacités, vélocité réelle vs prévue.',
    scrumRefs: ['Scrum Guide 2020 §Sprint', 'Scrum Guide 2020 §Sprint Goal'],
    forRoles: ['PO', 'SM', 'DEV'],
    cadence: 'Durée Sprint (1-4 sem)',
    quickActions: [
      { id: 'add-sprint',         icon: '➕', label: 'Nouveau sprint',      description: 'Crée le sprint suivant avec dates + capacité', primary: true },
      { id: 'launch-sprint',      icon: '🚀', label: 'Lancer sprint',       description: 'Démarre le sprint launchable → génère cérémonies Scrum' },
      { id: 'rebrand-sprints',    icon: '🏷', label: 'Renommer sprints',    description: 'Applique le pattern {PROJ}-S{N} en bulk' },
      { id: 'reset-archive',      icon: '🔄', label: 'Reset & archive',     description: 'Archive sprint actif + reset projet' },
    ],
    relatedPages: ['sprint-planning', 'sprint-review', 'retros', 'vue-sprint', 'backlog'],
    inputs: ['Capacité équipe', 'Sprint Goal du PO'],
    outputs: ['Sprint Backlog', 'Velocity réalisée'],
    tipsScrum: [
      '🎯 Un Sprint a UN Sprint Goal — pas une liste de tickets',
      '📅 Durée FIXE pendant tout le projet (sauf changement majeur)',
      '⛔ Pas d\'extension de sprint : on cancel et on replan si dépassement structurel',
    ],
  },
  'sprint-planning': {
    summary: 'Sprint Planning — préparer l\'expédition',
    description: 'Cérémonie de début de sprint (max 8h pour 4 semaines). 3 questions : Pourquoi ce sprint a-t-il de la valeur ? (Sprint Goal), Que peut-on livrer ? (Sprint Backlog), Comment va-t-on faire ? (Plan).',
    scrumRefs: ['Scrum Guide 2020 §Sprint Planning'],
    forRoles: ['PO', 'SM', 'DEV'],
    cadence: 'Début de chaque sprint',
    quickActions: [
      { id: 'start-planning',     icon: '▶',  label: 'Démarrer Planning',     description: 'Crée l\'event Planning + ouvre la salle', primary: true },
      { id: 'set-sprint-goal',    icon: '🎯', label: 'Sprint Goal',           description: 'Définit l\'objectif du sprint' },
      { id: 'allocate-tickets',   icon: '📋', label: 'Allouer tickets',       description: 'Drag tickets backlog → sprint' },
    ],
    relatedPages: ['sprints', 'backlog', 'dor'],
    inputs: ['Product Backlog Ready (DoR)', 'Capacité équipe'],
    outputs: ['Sprint Goal', 'Sprint Backlog', 'Tasks décomposées'],
    tipsScrum: [
      '📏 Pas plus de 8h pour 4 semaines de sprint (timebox)',
      '🎯 Sprint Goal AVANT de prendre les tickets',
      '✋ La team décide combien elle prend — pas le PO',
    ],
  },
  'sprint-review': {
    summary: 'Sprint Review — démo aux stakeholders',
    description: 'En fin de sprint (max 4h pour 4 semaines). On montre l\'Increment aux Stakeholders, on récolte feedback, on adapte le Product Backlog. Pas une cérémonie d\'acceptation formelle, c\'est un working session.',
    scrumRefs: ['Scrum Guide 2020 §Sprint Review'],
    forRoles: ['PO', 'DEV', 'STAKE'],
    cadence: 'Fin de chaque sprint',
    quickActions: [
      { id: 'start-review',       icon: '🔍', label: 'Démarrer Review',     description: 'Crée l\'event Review + invite stakeholders', primary: true },
      { id: 'demo-checklist',     icon: '✅', label: 'Checklist demo',       description: 'Vérifie que chaque ticket DONE est démontrable' },
      { id: 'collect-feedback',   icon: '💬', label: 'Collecter feedback',   description: 'Note les retours stakeholders' },
    ],
    relatedPages: ['sprints', 'sprint-planning', 'retros', 'stakeholders'],
    inputs: ['Increment terminé', 'Stakeholders présents'],
    outputs: ['Feedback consigné', 'PBIs nouveaux ajoutés', 'Adaptation backlog'],
    tipsScrum: [
      '🎬 Démo > slides : montre le produit, pas du PowerPoint',
      '👁 Plus de stakeholders = meilleur feedback',
      '🚫 Ce n\'est PAS une demo de validation contractuelle',
    ],
  },
  'retros': {
    summary: 'Rétrospective — apprendre et s\'améliorer',
    description: 'Dernière cérémonie du sprint (max 3h pour 4 semaines). La team réfléchit : What went well? What didn\'t? What to improve? Au moins UNE action concrète d\'amélioration intégrée au sprint suivant.',
    scrumRefs: ['Scrum Guide 2020 §Sprint Retrospective'],
    forRoles: ['SM', 'DEV', 'PO'],
    cadence: 'Fin de chaque sprint',
    quickActions: [
      { id: 'start-retro',        icon: '🔄', label: 'Démarrer Retro',      description: 'Crée l\'event Retro + ouvre la salle', primary: true },
      { id: 'add-lesson',         icon: '✨', label: 'Lesson learned',      description: 'Capture un apprentissage' },
      { id: 'choose-format',      icon: '🎨', label: 'Format retro',         description: 'Glad/Sad/Mad, 4Ls, Speedboat, Mood...' },
    ],
    relatedPages: ['lessons', 'sprint-review', 'sprints'],
    inputs: ['Données sprint', 'Ressenti team'],
    outputs: ['Lessons Learned', 'Actions amélioration', 'PBI \"retro action\"'],
    tipsScrum: [
      '⚖ Vegas Rule : safe space, ce qui est dit en retro reste en retro',
      '🎯 1 action concrète AU MOINS, et elle entre dans le sprint backlog suivant',
      '🔄 Varie les formats pour éviter la routine',
    ],
  },
  'vue-sprint': {
    summary: 'Vue par Sprint — focus tickets d\'un sprint',
    description: 'Vue filtrée des tickets d\'un sprint spécifique avec colonnes Kanban (TODO / WIP / Review / Done / Blocked). Permet le suivi quotidien du Sprint Backlog.',
    scrumRefs: ['Scrum Guide 2020 §Sprint Backlog'],
    forRoles: ['DEV', 'SM'],
    cadence: 'Permanent',
    quickActions: [
      { id: 'switch-sprint',      icon: '🔀', label: 'Changer sprint',      description: 'Switch entre sprints actif/archivés' },
      { id: 'move-ticket',        icon: '➡',  label: 'Déplacer ticket',     description: 'Drag entre colonnes statut' },
    ],
    relatedPages: ['sprints', 'backlog', 'detail-tickets'],
    inputs: ['Sprint Backlog'],
    outputs: ['Statut tickets à jour'],
    tipsScrum: ['📊 Le Sprint Backlog appartient à la team Dev — pas au PO ni au SM'],
  },
  'detail-tickets': {
    summary: 'Détail tickets — vue complète d\'un PBI',
    description: 'Vue détaillée : titre, description, critères d\'acceptation, story points, dépendances, assignee, sous-tâches, commentaires, historique.',
    scrumRefs: ['Scrum.org - Product Backlog Item'],
    forRoles: ['ALL'],
    cadence: 'Ad-hoc',
    quickActions: [
      { id: 'edit-ticket',        icon: '✏', label: 'Éditer ticket',       description: 'Modifie les champs du PBI', primary: true },
      { id: 'add-acceptance',     icon: '✅', label: 'Critères acceptance', description: 'Ajoute des AC (Given/When/Then)' },
      { id: 'estimate',           icon: '🎲', label: 'Estimer',              description: 'Planning poker en équipe' },
    ],
    relatedPages: ['backlog', 'vue-sprint', 'dor', 'dod'],
    inputs: ['Specs', 'Discovery user'],
    outputs: ['PBI complet, Ready (DoR)'],
    tipsScrum: ['🎯 Un bon PBI tient en 1 phrase + des critères clairs'],
  },
  'risks': {
    summary: 'Risk Register — sortilèges sombres à conjurer',
    description: 'Registre des risques projet. Chaque risque a une probabilité, un impact, un score (P×I), un plan de mitigation, un owner. Revue régulière en retro ou daily si critique.',
    scrumRefs: ['Scrum.org - Risk management', 'PMBOK adapted'],
    forRoles: ['PO', 'SM', 'ARCH'],
    cadence: 'Revue hebdo + ad-hoc',
    quickActions: [
      { id: 'add-risk',           icon: '⚠',  label: 'Nouveau risque',      description: 'Ajoute un risque au registre', primary: true },
      { id: 'review-risks',       icon: '🔍', label: 'Revue risques',        description: 'Cérémonie dédiée revue risques' },
      { id: 'risk-to-ticket',     icon: '🎫', label: 'Mitigation → ticket',  description: 'Crée un ticket pour la mitigation' },
    ],
    relatedPages: ['lessons', 'tech-debt', 'dashboard'],
    inputs: ['Identification team', 'Stakeholders', 'Tech debt'],
    outputs: ['Plans mitigation', 'Tickets mitigation', 'Reporting risques'],
    tipsScrum: ['⚡ Risque HIGH = action dans le sprint en cours, pas attendre'],
  },
  'lessons': {
    summary: 'Lessons Learned — sagesse capturée des batailles passées',
    description: 'Base de connaissance des apprentissages de chaque sprint. Ce qui a marché, ce qui n\'a pas marché, et pourquoi. Source précieuse pour nouveaux projets.',
    scrumRefs: ['Scrum Guide 2020 §Retrospective outputs'],
    forRoles: ['ALL'],
    cadence: 'Sprint (depuis retros)',
    quickActions: [
      { id: 'add-lesson',         icon: '✨', label: 'Lesson learned',      description: 'Capture un apprentissage', primary: true },
      { id: 'browse-lessons',     icon: '📚', label: 'Parcourir',           description: 'Filtre par catégorie/sprint' },
      { id: 'export-knowledge',   icon: '📤', label: 'Export PDF',          description: 'Génère un livret des lessons' },
    ],
    relatedPages: ['retros', 'knowledge', 'risks'],
    inputs: ['Retros', 'Post-mortems'],
    outputs: ['Base de connaissance', 'Patterns réutilisables'],
    tipsScrum: ['💎 Une lesson par sprint au minimum → sinon retro inefficace'],
  },

  // ═══ 📅 PLANNING (9 pages) ═══
  'gantt': {
    summary: 'Gantt visuel — barres temporelles des sprints',
    description: 'Vue temporelle de l\'avancement : barres par sprint avec dates début/fin, % avancement, phases. Utile pour communication stakeholders et coordination multi-équipes.',
    scrumRefs: ['Scrum.org - Hybrid antipattern (Gantt pur ≠ Scrum)'],
    forRoles: ['PO', 'SM', 'STAKE'],
    cadence: 'Vue continue',
    quickActions: [
      { id: 'zoom-gantt',         icon: '🔍', label: 'Zoom temporel',       description: 'Zoom jour/semaine/mois' },
      { id: 'export-gantt',       icon: '📷', label: 'Export PNG',          description: 'Capture pour rapport' },
    ],
    relatedPages: ['sprints', 'phases', 'roadmap'],
    inputs: ['Sprints', 'Phases'],
    outputs: ['Vue visuelle communication'],
    tipsScrum: ['⚠ Gantt = outil de communication, PAS de pilotage Scrum'],
  },
  'calendrier': {
    summary: 'Calendrier de bataille — cérémonies + tickets',
    description: 'Vue mois/jour/année des events Scrum + tickets avec leurs dates. Détection collisions, drag-edit, créer event direct depuis cellule.',
    scrumRefs: ['Scrum Guide 2020 §Sprint events'],
    forRoles: ['ALL'],
    cadence: 'Permanent',
    quickActions: [
      { id: 'new-event',          icon: '➕', label: 'Nouvel event',        description: 'Crée meeting/daily/call', primary: true },
      { id: 'switch-view',        icon: '🗓', label: 'Vue jour/mois/an',    description: 'Switch view scale' },
      { id: 'export-ical',        icon: '📤', label: 'Export iCal',         description: 'Sync vers Outlook/Google' },
    ],
    relatedPages: ['agenda', 'meeting-reports'],
    inputs: ['Events Scrum auto-générés', 'Events custom'],
    outputs: ['iCal feed', 'Notifs imminentes'],
    tipsScrum: ['📅 Les events Scrum sont auto-générés au launch sprint'],
  },
  'agenda': {
    summary: 'Agenda — chronologie des événements',
    description: 'Liste chronologique de tous les events (passés + à venir). Click event = détail + actions (démarrer, terminer, répondre).',
    scrumRefs: ['Scrum Guide 2020 §Sprint events'],
    forRoles: ['ALL'],
    cadence: 'Permanent',
    quickActions: [
      { id: 'new-event',          icon: '➕', label: 'Nouvel event',        description: 'Crée un event', primary: true },
      { id: 'filter-events',      icon: '🔍', label: 'Filtres',             description: 'Type / sprint / status' },
    ],
    relatedPages: ['calendrier', 'meeting-reports'],
    inputs: ['Events DB'],
    outputs: ['Détails events', 'Actions live (start/end/respond)'],
    tipsScrum: ['⏰ Démarre l\'event au moment réel → tracking précis'],
  },
  'projets': {
    summary: 'Multi-projets — vue portfolio',
    description: 'Liste de tous les projets (Realms) accessibles. Permet switch rapide, création d\'un nouveau projet, archivage.',
    scrumRefs: ['Scrum@Scale', 'Nexus framework'],
    forRoles: ['PO', 'SM', 'STAKE'],
    cadence: 'Permanent',
    quickActions: [
      { id: 'new-project',        icon: '➕', label: 'Nouveau projet',      description: 'Crée un projet vierge', primary: true },
      { id: 'archive-project',    icon: '📦', label: 'Archiver',            description: 'Sort le projet de la liste active' },
      { id: 'import-excel',       icon: '📥', label: 'Importer Excel',      description: 'Crée projet depuis template Excel' },
    ],
    relatedPages: ['phases', 'allocation', 'capacity'],
    inputs: ['Vision portfolio'],
    outputs: ['Liste Realms gérés'],
    tipsScrum: ['🏰 Chaque projet = Realm indépendant avec son backlog'],
  },
  'phases': {
    summary: 'Phases projet — découpage macro',
    description: 'Phases temporelles d\'un projet : Discovery, MVP, Scale, Maintenance. Permet vision plus large que le sprint.',
    scrumRefs: ['Scrum.org - Project phases (controversed)'],
    forRoles: ['PO', 'STAKE'],
    cadence: 'Initial + Quarterly',
    quickActions: [
      { id: 'add-phase',          icon: '➕', label: 'Nouvelle phase',      description: 'Crée une phase avec dates' },
      { id: 'milestone',          icon: '🏁', label: 'Jalon de phase',      description: 'Marque la fin d\'une phase' },
    ],
    relatedPages: ['gantt', 'projets', 'roadmap'],
    inputs: ['Vision produit'],
    outputs: ['Phases temporelles', 'Jalons macro'],
    tipsScrum: ['⚠ Risque waterfall : garder les phases LARGES, pas micro-managées'],
  },
  'allocation': {
    summary: 'Allocation Multi-Projets — qui sur quoi',
    description: 'Vue matricielle : team members × projets. Allocation % par sprint. Détection over-allocation.',
    scrumRefs: ['Scrum.org - Stable teams', 'Cost of context switching'],
    forRoles: ['SM', 'STAKE'],
    cadence: 'Sprint',
    quickActions: [
      { id: 'edit-allocation',    icon: '✏', label: 'Éditer allocation',   description: 'Ajuste % par membre/projet', primary: true },
      { id: 'detect-overlap',     icon: '⚠',  label: 'Détecter overlap',    description: 'Trouve les > 100% allocation' },
    ],
    relatedPages: ['capacity', 'projets', 'overtime'],
    inputs: ['Team members', 'Projets actifs'],
    outputs: ['Allocation valide', 'Alertes over-allocation'],
    tipsScrum: ['⚡ Switch projet = -20% productivité (étude Tom DeMarco)'],
  },
  'charge': {
    summary: 'Charge Multi-Projets — workload réel',
    description: 'Heures consommées vs allouées par membre, par projet. Identifie les surcharges et sous-charges.',
    scrumRefs: ['Scrum.org - Sustainable pace'],
    forRoles: ['SM', 'PO'],
    cadence: 'Sprint',
    quickActions: [
      { id: 'view-burndown',      icon: '📉', label: 'Burndown', description: 'Voir burndown global' },
      { id: 'rebalance',          icon: '⚖',  label: 'Rebalancer', description: 'Redistribuer la charge' },
    ],
    relatedPages: ['allocation', 'capacity', 'burndown', 'overtime'],
    inputs: ['Heures saisies tickets'],
    outputs: ['Vue workload', 'Alertes surcharge'],
    tipsScrum: ['🎯 Sustainable pace = principe Agile #8'],
  },
  'capacity': {
    summary: 'Capacity Planning — qui est dispo',
    description: 'Capacité prévue par membre par sprint. Tient compte des congés, jours fériés, % allocation. Base du calcul Sprint Backlog.',
    scrumRefs: ['Scrum Guide 2020 §Capacity'],
    forRoles: ['SM', 'DEV'],
    cadence: 'Sprint Planning',
    quickActions: [
      { id: 'add-member',         icon: '➕', label: 'Nouveau membre',      description: 'Ajoute à la team avec avatar', primary: true },
      { id: 'set-leaves',         icon: '🏖', label: 'Congés',              description: 'Saisis les absences' },
      { id: 'compute-capacity',   icon: '🔢', label: 'Recalcul capacité',   description: 'Recompute h×j×alloc' },
    ],
    relatedPages: ['allocation', 'overtime', 'projets'],
    inputs: ['Team', 'Congés', 'Holidays'],
    outputs: ['Capacity heures/sprint'],
    tipsScrum: ['⚡ Capacity ≠ Velocity : Capacity = théorique, Velocity = empirique'],
  },
  'overtime': {
    summary: 'Heures sup — l\'antipattern à surveiller',
    description: 'Tracking des heures sup. Permet visibilité sur l\'overload chronique = signal de problème structurel.',
    scrumRefs: ['Scrum Guide 2020 §Sustainable pace antipattern'],
    forRoles: ['SM', 'DEV'],
    cadence: 'Continue',
    quickActions: [
      { id: 'log-overtime',       icon: '⏰', label: 'Saisir h sup',        description: 'Log une session h sup' },
      { id: 'trend-overtime',     icon: '📈', label: 'Tendance',            description: 'Voir évolution sur 6 sprints' },
    ],
    relatedPages: ['capacity', 'charge', 'risks'],
    inputs: ['Déclarations équipe'],
    outputs: ['Alerte burn-out', 'Discussion retro'],
    tipsScrum: ['🚨 H sup régulières = échec du sprint planning, à traiter en retro'],
  },

  // ═══ 📊 REPORTING (12 pages) ═══
  'burndown': {
    summary: 'Burndown — points restants vs temps',
    description: 'Graphique avec sur l\'axe X le temps et sur l\'axe Y le travail restant. Courbe descendante idéale vs réelle. Détecte les écarts.',
    scrumRefs: ['Scrum.org - Burndown chart'],
    forRoles: ['SM', 'DEV'],
    cadence: 'Daily refresh',
    quickActions: [
      { id: 'switch-sprint',      icon: '🔀', label: 'Changer sprint',     description: 'Voir burndown autre sprint' },
      { id: 'forecast',           icon: '🔮', label: 'Forecast fin',        description: 'Projeter atterrissage si tendance' },
    ],
    relatedPages: ['cfd-velocity', 'sprints', 'dashboard'],
    inputs: ['Tickets sprint', 'Estimations'],
    outputs: ['Visuel rythme'],
    tipsScrum: ['📉 Courbe plate en milieu de sprint = blocker à creuser en daily'],
  },
  'cfd-velocity': {
    summary: 'CFD & Velocity — flux et débit',
    description: 'CFD (Cumulative Flow Diagram) : épaisseur des bandes par status = work in progress. Velocity = points livrés par sprint.',
    scrumRefs: ['Scrum.org - Velocity', 'Kanban CFD'],
    forRoles: ['SM', 'PO'],
    cadence: 'Sprint',
    quickActions: [
      { id: 'show-cfd',           icon: '📊', label: 'Voir CFD',            description: 'Diagramme cumul flow' },
      { id: 'show-velocity',      icon: '🚀', label: 'Voir vélocité',       description: 'Bars chart sprints' },
    ],
    relatedPages: ['burndown', 'sprints', 'dashboard'],
    inputs: ['Historique tickets'],
    outputs: ['Prédictibilité', 'Tendance équipe'],
    tipsScrum: ['📊 Velocity moyenne sur 3 sprints > velocity d\'un seul sprint'],
  },
  'meeting-reports': {
    summary: 'Comptes-rendus — mémoire des réunions',
    description: 'Tous les events COMPLETED avec leurs notes. Recherche full-text, filtres par sprint/type/date. Source d\'info pour onboarding ou audit.',
    scrumRefs: ['Scrum Guide 2020 §Transparency'],
    forRoles: ['ALL'],
    cadence: 'Permanent (consulté ad-hoc)',
    quickActions: [
      { id: 'search-reports',     icon: '🔍', label: 'Recherche',           description: 'Full-text dans titres+notes', primary: true },
      { id: 'filter-reports',     icon: '🎚', label: 'Filtres',             description: 'Sprint/type/date' },
      { id: 'export-pdf',         icon: '📤', label: 'Export PDF',          description: 'Livret des compte-rendus' },
    ],
    relatedPages: ['agenda', 'calendrier'],
    inputs: ['Events COMPLETED avec notes'],
    outputs: ['Vue chronologique', 'Source onboarding'],
    tipsScrum: ['📜 Lire les comptes-rendus = excellent onboarding'],
  },
  'roadmap': {
    summary: 'Roadmap produit — vision long terme',
    description: 'Jalons macros par trimestre/an. Communication stakeholders sans engagement détaillé. Now/Next/Later format recommandé.',
    scrumRefs: ['Scrum.org - Now Next Later roadmap'],
    forRoles: ['PO', 'STAKE'],
    cadence: 'Trimestriel',
    quickActions: [
      { id: 'add-milestone',      icon: '🏁', label: 'Nouveau jalon',       description: 'Ajoute milestone', primary: true },
      { id: 'now-next-later',     icon: '📅', label: 'Format NNL',          description: 'Bascule en Now/Next/Later' },
    ],
    relatedPages: ['phases', 'gantt', 'dashboard'],
    inputs: ['Vision produit', 'OKRs'],
    outputs: ['Communication stakeholders'],
    tipsScrum: ['🎯 Roadmap = direction, pas plan figé. Adapte au feedback.'],
  },
  'dependances': {
    summary: 'Dépendances — qui bloque qui',
    description: 'Graphe des dépendances tickets. Identifie chaînes critiques, deadlocks, paths qui bloquent un sprint.',
    scrumRefs: ['Scrum@Scale - Cross-team dependencies'],
    forRoles: ['SM', 'DEV', 'ARCH'],
    cadence: 'Refinement',
    quickActions: [
      { id: 'add-dep',            icon: '🔗', label: 'Lier 2 tickets',      description: 'Ticket A dépend de Ticket B', primary: true },
      { id: 'show-blockers',      icon: '⚠',  label: 'Top blockers',         description: 'Tickets qui bloquent le plus' },
    ],
    relatedPages: ['backlog', 'risks'],
    inputs: ['Tickets'],
    outputs: ['Graphe dépendances', 'Alertes deadlock'],
    tipsScrum: ['🔗 Dépendance cross-team = signal pour Scrum of Scrums'],
  },
  'tech-debt': {
    summary: 'Tech Debt — dette technique à rembourser',
    description: 'Catalogue de la dette technique : refactors nécessaires, lib obsolètes, code smell. Score sévérité + coût estimé. Ratio recommandé : 20% du sprint budget.',
    scrumRefs: ['Scrum.org - Technical Debt'],
    forRoles: ['DEV', 'ARCH', 'PO'],
    cadence: 'Continue',
    quickActions: [
      { id: 'add-debt',           icon: '💳', label: 'Nouvelle dette',      description: 'Catalogue une dette', primary: true },
      { id: 'debt-to-ticket',     icon: '🎫', label: 'Dette → ticket',      description: 'Convertit en ticket backlog' },
      { id: 'debt-ratio',         icon: '📊', label: 'Ratio dette',         description: 'Voir % dette en cours' },
    ],
    relatedPages: ['backlog', 'risks', 'lessons'],
    inputs: ['Code review', 'Audits archi'],
    outputs: ['Plans remboursement', 'Tickets dette'],
    tipsScrum: ['⚡ Dette ignorée = velocity en chute libre dans 3-6 mois'],
  },
  'knowledge': {
    summary: 'Knowledge Base — documentation vivante',
    description: 'Base de connaissance : ADRs (Architecture Decision Records), runbooks, FAQ, glossaire. Source unique de vérité technique.',
    scrumRefs: ['Scrum.org - Knowledge sharing'],
    forRoles: ['ARCH', 'DEV'],
    cadence: 'Continue',
    quickActions: [
      { id: 'add-adr',            icon: '📜', label: 'Nouvel ADR',          description: 'Architecture Decision Record', primary: true },
      { id: 'add-glossary',       icon: '📖', label: 'Terme glossaire',     description: 'Définition métier' },
      { id: 'search-kb',          icon: '🔍', label: 'Recherche',           description: 'Full-text KB' },
    ],
    relatedPages: ['lessons', 'tech-debt', 'dor', 'dod'],
    inputs: ['Décisions archi', 'Onboarding new joiners'],
    outputs: ['Base de connaissance vivante'],
    tipsScrum: ['📚 ADR = "ce qu\'on a décidé ET pourquoi" → précieux 6 mois après'],
  },
  'vue-stakeholder': {
    summary: 'Vue Stakeholder — la vue simplifiée externe',
    description: 'Vue épurée pour Stakeholders : pas de détails techniques, juste avancement macro, jalons, prochaine review. Pas d\'édition possible.',
    scrumRefs: ['Scrum Guide 2020 §Stakeholders'],
    forRoles: ['STAKE'],
    cadence: 'Sprint',
    quickActions: [
      { id: 'export-stake',       icon: '📤', label: 'Export stakeholder',  description: 'PDF/PNG du rapport' },
      { id: 'send-update',        icon: '✉',  label: 'Email update',        description: 'Envoie newsletter sprint' },
    ],
    relatedPages: ['stakeholders', 'export-stakeholder', 'roadmap'],
    inputs: ['Sprint actif', 'Roadmap'],
    outputs: ['Vue lisible par non-tech'],
    tipsScrum: ['👁 Stakeholder = "intéressé mais pas dans la team". Pas de jargon.'],
  },
  'stakeholders': {
    summary: 'Stakeholders — qui sont nos parties prenantes',
    description: 'Annuaire des stakeholders : nom, rôle, niveau d\'influence, attentes. Permet ciblage des updates et reviews.',
    scrumRefs: ['Scrum Guide 2020 §Stakeholders'],
    forRoles: ['PO'],
    cadence: 'Initial + ad-hoc',
    quickActions: [
      { id: 'add-stake',          icon: '➕', label: 'Nouveau stakeholder', description: 'Ajoute au registre', primary: true },
      { id: 'map-influence',      icon: '🗺',  label: 'Cartographie',        description: 'Influence × Intérêt' },
    ],
    relatedPages: ['vue-stakeholder', 'export-stakeholder'],
    inputs: ['Identification', 'Engagement'],
    outputs: ['Annuaire', 'Plan communication'],
    tipsScrum: ['🎯 Stakeholder map (High/Low Influence × High/Low Interest) = outil clé'],
  },
  'export-stakeholder': {
    summary: 'Export Stakeholder — packager le rapport',
    description: 'Génère un export PDF/PNG du sprint actif adapté aux stakeholders. Sans jargon, avec graphiques.',
    scrumRefs: ['Scrum.org - Stakeholder communication'],
    forRoles: ['PO'],
    cadence: 'Sprint',
    quickActions: [
      { id: 'generate-export',    icon: '📥', label: 'Générer export',      description: 'Crée le PDF', primary: true },
      { id: 'customize-template', icon: '🎨', label: 'Template',            description: 'Choisis le format' },
    ],
    relatedPages: ['vue-stakeholder', 'stakeholders'],
    inputs: ['Sprint data'],
    outputs: ['PDF/PNG livrable'],
    tipsScrum: ['📄 1 page max — sinon ils ne lisent pas'],
  },
  'vue-reviewer': {
    summary: 'Vue Reviewer — vue externe d\'audit',
    description: 'Vue pour reviewer externe (audit qualité, sécurité). Accès lecture aux tickets, sprints, KPIs sans pouvoir éditer.',
    scrumRefs: ['Scrum.org - External audit'],
    forRoles: ['STAKE', 'ARCH'],
    cadence: 'Ad-hoc',
    quickActions: [
      { id: 'audit-trail',        icon: '🔎', label: 'Audit trail',         description: 'Historique modif' },
      { id: 'export-audit',       icon: '📤', label: 'Export audit',        description: 'Package pour reviewer' },
    ],
    relatedPages: ['dashboard', 'knowledge'],
    inputs: ['Données projet'],
    outputs: ['Vue auditable read-only'],
    tipsScrum: ['🔒 Lecture seule = pas de risque de corruption pendant audit'],
  },
  'listes': {
    summary: 'Listes — récap macro des entités',
    description: 'Vue tabulaire compacte de toutes les entités (tickets, risques, lessons, debt, etc.). Idéal pour bulk-edit ou aperçu global.',
    scrumRefs: ['—'],
    forRoles: ['ALL'],
    cadence: 'Ad-hoc',
    quickActions: [
      { id: 'choose-entity',      icon: '🎚', label: 'Choisir entité',      description: 'Tickets/Risks/Lessons/Debt/...' },
      { id: 'export-csv',         icon: '📤', label: 'Export CSV',          description: 'Pour analyse externe' },
    ],
    relatedPages: ['backlog', 'risks', 'lessons', 'tech-debt'],
    inputs: ['Toutes entités'],
    outputs: ['Tableau export'],
    tipsScrum: ['📋 Utile pour reporting régulier ou debugging data'],
  },

  // ═══ ⚙ SETUP & GUIDES (10 pages) ═══
  'mode-emploi': {
    summary: 'Mode d\'emploi — guide du Realm',
    description: 'Documentation interactive du studio : par où commencer, workflows recommandés, raccourcis clavier, intégration Excel.',
    scrumRefs: ['—'],
    forRoles: ['ALL'],
    cadence: 'Initial',
    quickActions: [
      { id: 'open-tour',          icon: '🎓', label: 'Tour guidé',          description: 'Re-démarre l\'onboarding', primary: true },
      { id: 'show-shortcuts',     icon: '⌨', label: 'Raccourcis',          description: 'Ctrl+Space / Ctrl+Win / etc.' },
    ],
    relatedPages: ['checkup', 'routine', 'daily'],
    inputs: ['Première utilisation'],
    outputs: ['Onboarding réussi'],
    tipsScrum: ['📖 Lis avant de plonger pour gagner 2h'],
  },
  'checkup': {
    summary: 'Check-up lancement — êtes-vous Ready ?',
    description: 'Checklist avant de lancer un sprint : vision claire, backlog prio, team capacity, DoR validés.',
    scrumRefs: ['Scrum.org - Ready criteria'],
    forRoles: ['PO', 'SM'],
    cadence: 'Avant launch sprint',
    quickActions: [
      { id: 'run-checkup',        icon: '✅', label: 'Lancer checkup',      description: 'Vérifie tous les points', primary: true },
      { id: 'save-state',         icon: '💾', label: 'Sauver état',          description: 'Snapshot moment T' },
    ],
    relatedPages: ['dor', 'dod', 'templates'],
    inputs: ['Préparation sprint'],
    outputs: ['Go/no-go', 'Points bloquants'],
    tipsScrum: ['✅ Ready vs Ready : Sprint Ready (planning OK) vs Item Ready (DoR)'],
  },
  'routine': {
    summary: 'Routine quotidienne — rituels du Scrum',
    description: 'Calendrier-type d\'une semaine Scrum : daily 9h, planning lundi, review jeudi, retro vendredi, refinement mardi/jeudi.',
    scrumRefs: ['Scrum Guide 2020 §Events'],
    forRoles: ['SM', 'ALL'],
    cadence: 'Hebdo',
    quickActions: [
      { id: 'apply-template',     icon: '✨', label: 'Appliquer template',  description: 'Crée les events récurrents', primary: true },
      { id: 'customize',          icon: '🎨', label: 'Customiser',          description: 'Adapte à ta team' },
    ],
    relatedPages: ['daily', 'calendrier', 'mode-emploi'],
    inputs: ['Sprint actif'],
    outputs: ['Calendrier rempli'],
    tipsScrum: ['⏰ Même heure même endroit = rituel ancré = adoption rapide'],
  },
  'daily': {
    summary: 'Daily Stand-up — synchro 15 min',
    description: 'Cérémonie quotidienne (max 15min). 3 questions : Hier? Aujourd\'hui? Blockers? Pour la team Dev, par la team Dev.',
    scrumRefs: ['Scrum Guide 2020 §Daily Scrum'],
    forRoles: ['DEV'],
    cadence: 'Tous les jours ouvrés',
    quickActions: [
      { id: 'start-daily',        icon: '▶',  label: 'Démarrer daily',      description: 'Crée event + ouvre notes', primary: true },
      { id: 'fill-daily',         icon: '✏', label: 'Remplir hier/aujourd', description: 'Standup format' },
      { id: 'log-blocker',        icon: '🚧', label: 'Log blocker',         description: 'Capture blocker pour SM' },
    ],
    relatedPages: ['vue-sprint', 'agenda', 'risks'],
    inputs: ['Hier/Aujourd\'hui de chacun'],
    outputs: ['Sync team', 'Liste blockers'],
    tipsScrum: [
      '⏱ 15 min MAX — sinon c\'est un meeting',
      '🚫 PAS un status report au SM',
      '🛠 Discussions techniques après le daily, pas pendant',
    ],
  },
  'nouveau-projet': {
    summary: 'Nouveau projet — assistant de création',
    description: 'Wizard guidé pour créer un nouveau Realm : nom, code, dates, capacity, première équipe.',
    scrumRefs: ['—'],
    forRoles: ['PO', 'SM'],
    cadence: 'Initial',
    quickActions: [
      { id: 'create-project',     icon: '➕', label: 'Créer le projet',     description: 'Lance le wizard', primary: true },
      { id: 'import-excel',       icon: '📥', label: 'Importer Excel',      description: 'Depuis template' },
    ],
    relatedPages: ['projets', 'parametres', 'capacity'],
    inputs: ['Vision projet'],
    outputs: ['Realm créé prêt à démarrer'],
    tipsScrum: ['🏰 Code de projet court (3-6 caractères) — sert au sprint naming OTSYS-S1'],
  },
  'regen-alloc': {
    summary: 'Régénérer Allocation — recalcul auto',
    description: 'Recalcule automatiquement l\'allocation par sprint sur base de la capacity + sprint backlog. Évite la saisie manuelle.',
    scrumRefs: ['—'],
    forRoles: ['SM'],
    cadence: 'Ad-hoc',
    quickActions: [
      { id: 'regen-alloc',        icon: '🔄', label: 'Lancer régen',        description: 'Recompute pour tous sprints', primary: true },
      { id: 'preview-diff',       icon: '👁', label: 'Preview diff',         description: 'Avant/après' },
    ],
    relatedPages: ['allocation', 'capacity', 'charge'],
    inputs: ['Capacity', 'Sprint Backlog'],
    outputs: ['Allocation mise à jour'],
    tipsScrum: ['⚙ Idempotent — peut être lancé plusieurs fois sans risque'],
  },
  'dod': {
    summary: 'Definition of Done — quand un ticket est DONE',
    description: 'Critères que TOUS les PBIs doivent satisfaire pour être DONE. Exemple : code review fait, tests verts, doc à jour, déployé en staging. La team Dev définit. Le PO valide.',
    scrumRefs: ['Scrum Guide 2020 §Definition of Done'],
    forRoles: ['DEV', 'PO'],
    cadence: 'Continue',
    quickActions: [
      { id: 'edit-dod',           icon: '✏', label: 'Éditer DoD',          description: 'Ajoute/retire critères', primary: true },
      { id: 'apply-template',     icon: '✨', label: 'Template par défaut', description: 'Charge DoD standard' },
    ],
    relatedPages: ['dor', 'checkup', 'knowledge'],
    inputs: ['Standards qualité team'],
    outputs: ['Increment vraiment DONE'],
    tipsScrum: [
      '🚫 Pas de DoD = pas d\'increment selon Scrum Guide',
      '🎯 1 DoD pour TOUT le produit, pas par PBI',
      '⬆ Renforce la DoD au fur et à mesure de la maturité',
    ],
  },
  'dor': {
    summary: 'Definition of Ready — quand un PBI est Ready',
    description: 'Critères qu\'un PBI doit remplir pour entrer en sprint planning : User Story OK, AC définis, dépendances identifiées, estimé. Optionnel selon Scrum Guide mais recommandé.',
    scrumRefs: ['Scrum.org - Definition of Ready (optional)'],
    forRoles: ['PO', 'DEV'],
    cadence: 'Refinement',
    quickActions: [
      { id: 'edit-dor',           icon: '✏', label: 'Éditer DoR',          description: 'Ajoute/retire critères', primary: true },
      { id: 'apply-template',     icon: '✨', label: 'Template INVEST',     description: 'Charge DoR INVEST' },
    ],
    relatedPages: ['dod', 'backlog', 'detail-tickets'],
    inputs: ['Standards refinement'],
    outputs: ['PBIs Ready pour planning'],
    tipsScrum: [
      '⚖ INVEST : Independent, Negotiable, Valuable, Estimable, Small, Testable',
      '🚫 DoR n\'est PAS dans le Scrum Guide — c\'est un complément',
      '🎯 PBI Ready = peut être fini en 1 sprint',
    ],
  },
  'templates': {
    summary: 'Templates Tickets — créer plus vite',
    description: 'Templates de PBI préremplis (User Story, Bug Report, Spike, Tech Task). Speed-up création tickets.',
    scrumRefs: ['—'],
    forRoles: ['PO', 'DEV'],
    cadence: 'Continue',
    quickActions: [
      { id: 'create-template',    icon: '➕', label: 'Nouveau template',    description: 'Crée un template custom', primary: true },
      { id: 'apply-template',     icon: '✨', label: 'Appliquer',           description: 'Sur ticket nouveau' },
    ],
    relatedPages: ['backlog', 'detail-tickets'],
    inputs: ['Patterns récurrents'],
    outputs: ['PBIs créés rapidement'],
    tipsScrum: ['🎯 User Story format : As a [role], I want [feature] so that [benefit]'],
  },
  'parametres': {
    summary: 'Paramètres — config du Realm',
    description: 'Configuration globale : nom projet, code, dates, capacité, jours fériés, langue, exports.',
    scrumRefs: ['—'],
    forRoles: ['PO', 'SM'],
    cadence: 'Initial + ad-hoc',
    quickActions: [
      { id: 'edit-config',        icon: '✏', label: 'Éditer config',       description: 'Ouvre l\'éditeur', primary: true },
      { id: 'add-holiday',        icon: '🎉', label: 'Jour férié',          description: 'Ajoute un holiday' },
      { id: 'language',           icon: '🌐', label: 'Langue',              description: 'FR/EN switch' },
    ],
    relatedPages: ['nouveau-projet', 'capacity'],
    inputs: ['Choix config'],
    outputs: ['Config persistée'],
    tipsScrum: ['⚙ Config bien faite au début → 0 friction ensuite'],
  },
};

/** Helper : récupère le PageMeta avec fallback "page sans meta encore définie". */
export function getPageMeta(pageId: string): PageMeta {
  return PAGE_META[pageId] || {
    summary: 'Page WAR TABLE',
    description: 'Cette page est en construction. Sa documentation détaillée arrive bientôt.',
    scrumRefs: ['—'],
    forRoles: ['ALL'],
    cadence: 'Ad-hoc',
    quickActions: [],
    relatedPages: [],
    inputs: [],
    outputs: [],
    tipsScrum: [],
  };
}
