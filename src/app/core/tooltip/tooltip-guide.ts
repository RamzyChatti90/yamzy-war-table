// WAR TABLE v1.0.14 — Source de vérité narrative : Yamzy Guide + Scrum Guide.
//
// Pour chaque page/concept du studio, on documente :
//   - scrum : nom officiel scrum.org
//   - yamzy : nom dans l'univers Yamzy World (narratif gaming)
//   - desc  : explication concise (1-2 phrases)
//   - tip   : (optionnel) astuce pratique
//
// Bilingual : fr / en. Si la langue active n'a pas la clé, fallback FR.

export interface TooltipEntry {
  fr: { yamzy: string; scrum: string; desc: string; tip?: string };
  en: { yamzy: string; scrum: string; desc: string; tip?: string };
}

export const TOOLTIP_GUIDE: Record<string, TooltipEntry> = {

  // ═══ DOCUMENTATION ═══
  'mode-emploi': {
    fr: { yamzy: 'Grimoire du Studio',     scrum: 'User Guide',           desc: "Guide d'utilisation complet du studio. Lis-le en premier pour comprendre les rituels Scrum implémentés ici." },
    en: { yamzy: 'Studio Grimoire',         scrum: 'User Guide',           desc: 'Complete studio user guide. Read it first to understand the Scrum rituals implemented here.' },
  },
  'checkup': {
    fr: { yamzy: 'Préparation de Quête',    scrum: 'Project Kick-off Checklist', desc: "Check-list de lancement projet : prérequis, équipe, outils, dates clés. À cocher avant de partir à l'aventure.", tip: 'Tant que tout n\'est pas vert, ne lance pas ton premier sprint.' },
    en: { yamzy: 'Quest Preparation',       scrum: 'Project Kick-off Checklist', desc: 'Project launch checklist: prerequisites, team, tools, key dates. Tick before starting the adventure.', tip: 'Don\'t start your first sprint until everything is green.' },
  },
  'routine': {
    fr: { yamzy: 'Rituel Quotidien',        scrum: 'Daily Routine',        desc: "Routine quotidienne du Scrum Master / dev : ce qu'il faut vérifier chaque matin et chaque soir pour rester aligné." },
    en: { yamzy: 'Daily Ritual',            scrum: 'Daily Routine',        desc: "Daily routine for Scrum Master / dev: what to check each morning and evening to stay aligned." },
  },
  'daily': {
    fr: { yamzy: 'Conseil Matinal',         scrum: 'Daily Stand-up',       desc: "Réunion de 15 min — chaque membre dit ce qu'il a fait hier, ce qu'il fait aujourd'hui, et ses blockers.", tip: 'Si ça dure plus de 15 min, c\'est qu\'il faut un meeting séparé.' },
    en: { yamzy: 'Morning Council',         scrum: 'Daily Stand-up',       desc: '15-min meeting — each member says what they did yesterday, today, and their blockers.', tip: 'If it lasts more than 15 min, you need a separate meeting.' },
  },
  'nouveau-projet': {
    fr: { yamzy: 'Nouvelle Aventure',       scrum: 'New Project Setup',    desc: 'Créer un nouveau projet : code, nom, dates, capacité par sprint, statut.' },
    en: { yamzy: 'New Adventure',           scrum: 'New Project Setup',    desc: 'Create a new project: code, name, dates, sprint capacity, status.' },
  },
  'regen-alloc': {
    fr: { yamzy: 'Recalcul des Forces',     scrum: 'Allocation Recompute', desc: 'Régénère l\'allocation Multi-Projets en redistribuant les membres selon leur disponibilité par sprint.' },
    en: { yamzy: 'Forces Recompute',        scrum: 'Allocation Recompute', desc: 'Regenerate Multi-Project allocation by redistributing members per sprint availability.' },
  },

  // ═══ GUIDES SCRUM ═══
  'dod': {
    fr: { yamzy: 'Pacte de Victoire',       scrum: 'Definition of Done',   desc: "Définition officielle de \"terminé\" : tous les critères qu'un ticket doit cocher avant d'être déclaré fini." },
    en: { yamzy: 'Victory Pact',            scrum: 'Definition of Done',   desc: 'Official definition of "done": all criteria a ticket must check before being declared finished.' },
  },
  'dor': {
    fr: { yamzy: 'Pacte de Préparation',    scrum: 'Definition of Ready',  desc: "Définition de \"prêt à embarquer\" : critères qu'un ticket doit remplir avant d'entrer en sprint." },
    en: { yamzy: 'Readiness Pact',          scrum: 'Definition of Ready',  desc: 'Definition of "ready to board": criteria a ticket must meet before entering a sprint.' },
  },
  'templates': {
    fr: { yamzy: 'Parchemins Modèles',      scrum: 'Ticket Templates',     desc: 'Modèles de tickets prêts à copier : User Story, Bug, Spike, Tech Debt. Format optimal pour le LLM.' },
    en: { yamzy: 'Template Scrolls',        scrum: 'Ticket Templates',     desc: 'Ready-to-copy ticket templates: User Story, Bug, Spike, Tech Debt. LLM-friendly format.' },
  },

  // ═══ DASHBOARDS ═══
  'dashboard': {
    fr: { yamzy: 'Tour de Garde',           scrum: 'Project Dashboard',    desc: 'Vue d\'ensemble du projet : KPIs, sprint actif, news, cockpit pilotage. Page d\'accueil du studio.' },
    en: { yamzy: 'Watch Tower',             scrum: 'Project Dashboard',    desc: 'Project overview: KPIs, active sprint, news, pilot cockpit. Studio home page.' },
  },
  'dashboard-param': {
    fr: { yamzy: 'Tour Personnalisée',      scrum: 'Custom Dashboard',     desc: 'Dashboard configurable : choisis les widgets à afficher pour ton rôle (PO, Dev, SM, Manager).' },
    en: { yamzy: 'Custom Tower',            scrum: 'Custom Dashboard',     desc: 'Configurable dashboard: pick the widgets to show for your role (PO, Dev, SM, Manager).' },
  },
  'dashboard-legacy': {
    fr: { yamzy: 'Tour Historique',         scrum: 'Classic Dashboard',    desc: 'Ancien format dashboard (vue table). Gardé pour comparaison et continuité.' },
    en: { yamzy: 'Legacy Tower',            scrum: 'Classic Dashboard',    desc: 'Old dashboard format (table view). Kept for comparison and continuity.' },
  },

  // ═══ COMMUNICATION ═══
  'vue-stakeholder': {
    fr: { yamzy: 'Œil du Conseil',          scrum: 'Stakeholder View',     desc: 'Vue lecture-seule destinée aux sponsors : KPIs, jalons, satisfaction, top actions. Pas de détail technique.' },
    en: { yamzy: 'Council Eye',             scrum: 'Stakeholder View',     desc: 'Read-only view for sponsors: KPIs, milestones, satisfaction, top actions. No technical detail.' },
  },
  'stakeholders': {
    fr: { yamzy: 'Conseil des Sages',       scrum: 'Stakeholders',         desc: "Liste des parties prenantes : sponsors, clients, métier. Note de satisfaction par sprint (NPS-like).", tip: 'Score < 5/10 = action requise.' },
    en: { yamzy: 'Council of Sages',        scrum: 'Stakeholders',         desc: 'Stakeholder list: sponsors, clients, business. Satisfaction score per sprint (NPS-like).', tip: 'Score < 5/10 = action required.' },
  },
  'export-stakeholder': {
    fr: { yamzy: 'Décret Royal',            scrum: 'Stakeholder Report',   desc: 'Export PDF / PPT du rapport stakeholder du sprint en cours. Format prêt à présenter.' },
    en: { yamzy: 'Royal Decree',            scrum: 'Stakeholder Report',   desc: 'PDF / PPT export of current sprint stakeholder report. Presentation-ready format.' },
  },

  // ═══ MULTI-PROJETS ═══
  'projets': {
    fr: { yamzy: 'Royaume des Quêtes',      scrum: 'Projects',             desc: 'Liste de tous les projets / produits que tu pilotes. Switch rapide entre eux via le sélecteur topbar.' },
    en: { yamzy: 'Quest Realm',             scrum: 'Projects',             desc: 'List of all projects / products you pilot. Quick switch via topbar selector.' },
  },
  'phases': {
    fr: { yamzy: 'Actes de l\'Aventure',    scrum: 'Project Phases',       desc: 'Découpage du projet en phases (Cadrage, Build, Run...). Chacune a son budget jours + dates.' },
    en: { yamzy: 'Adventure Acts',          scrum: 'Project Phases',       desc: 'Project split into phases (Discovery, Build, Run...). Each has its day budget + dates.' },
  },
  'allocation': {
    fr: { yamzy: 'Carte des Forces',        scrum: 'Multi-Project Allocation', desc: 'Vue % alloué × sprint × projet pour chaque membre. Détecte les sur-allocations (rouge > 100%).' },
    en: { yamzy: 'Forces Map',              scrum: 'Multi-Project Allocation', desc: '% allocated × sprint × project view per member. Detects over-allocations (red > 100%).' },
  },
  'charge': {
    fr: { yamzy: 'Pesée des Charges',       scrum: 'Multi-Project Workload', desc: 'Charge en heures par membre × sprint × projet. Compare au capacityHours.' },
    en: { yamzy: 'Workload Scale',          scrum: 'Multi-Project Workload', desc: 'Hours load per member × sprint × project. Compares to capacityHours.' },
  },
  'capacity': {
    fr: { yamzy: 'Compagnons d\'Aventure',  scrum: 'Capacity Planning',    desc: 'Annuaire d\'équipe enrichi : avatar, rôle, email, @yamzy_handle. Chaque membre = future identité Yamzy invitable.', tip: 'Renseigne le @yamzy_handle pour préparer les futures collaborations.' },
    en: { yamzy: 'Adventure Companions',    scrum: 'Capacity Planning',    desc: 'Enriched team directory: avatar, role, email, @yamzy_handle. Each member = future invitable Yamzy identity.', tip: 'Fill @yamzy_handle to prepare future collaborations.' },
  },

  // ═══ CONFIG ═══
  'parametres': {
    fr: { yamzy: 'Forge des Réglages',      scrum: 'Project Settings',     desc: 'Configuration projet : h/jour, jours/sprint, holidays, leaves, capacité. Sources des calculs Excel.' },
    en: { yamzy: 'Settings Forge',          scrum: 'Project Settings',     desc: 'Project config: h/day, days/sprint, holidays, leaves, capacity. Source of Excel computations.' },
  },

  // ═══ BACKLOGS ═══
  'backlog': {
    fr: { yamzy: 'Carnet de Quêtes',        scrum: 'Product Backlog',      desc: 'Liste ordonnée de tous les tickets (stories, bugs, spikes). Glisse pour prioriser, coche pour bulk update.', tip: 'Le top du backlog = le prochain candidat sprint.' },
    en: { yamzy: 'Quest Logbook',           scrum: 'Product Backlog',      desc: 'Ordered list of all tickets (stories, bugs, spikes). Drag to prioritize, check for bulk update.', tip: 'Top of backlog = next sprint candidate.' },
  },
  'backlog-tma': {
    fr: { yamzy: 'Carnet d\'Entretien',     scrum: 'Maintenance Backlog',  desc: 'Backlog dédié aux tickets TMA (maintenance applicative) — séparé du backlog projet.' },
    en: { yamzy: 'Maintenance Logbook',     scrum: 'Maintenance Backlog',  desc: 'Backlog dedicated to MMA tickets (application maintenance) — separate from project backlog.' },
  },

  // ═══ CÉRÉMONIES ═══
  'sprint-planning': {
    fr: { yamzy: 'Conseil de Sprint',       scrum: 'Sprint Planning',      desc: 'Cérémonie J1 : équipe sélectionne les tickets à embarquer dans le sprint en fonction de sa vélocité.', tip: 'Bloque 1h en début de sprint pour le planning.' },
    en: { yamzy: 'Sprint Council',          scrum: 'Sprint Planning',      desc: 'Day 1 ceremony: team picks tickets to board based on its velocity.', tip: 'Block 1h at sprint start for planning.' },
  },
  'sprint-review': {
    fr: { yamzy: 'Démonstration au Roi',    scrum: 'Sprint Review',        desc: 'Démo produit du sprint à la fin : on montre ce qui est livré, on récolte les feedbacks stakeholder.' },
    en: { yamzy: 'Royal Demonstration',     scrum: 'Sprint Review',        desc: 'Product demo at sprint end: show what\'s delivered, gather stakeholder feedback.' },
  },
  'retros': {
    fr: { yamzy: 'Cercle des Sages',        scrum: 'Sprint Retrospective', desc: 'Cérémonie de fin de sprint : Garder / Améliorer / Démarrer / Arrêter. L\'amélioration continue de l\'équipe.', tip: 'Une action concrète par retro — pas plus.' },
    en: { yamzy: 'Sage Circle',             scrum: 'Sprint Retrospective', desc: 'Sprint-end ceremony: Keep / Improve / Start / Stop. Team continuous improvement.', tip: 'One concrete action per retro — no more.' },
  },
  'detail-tickets': {
    fr: { yamzy: 'Carte des Quêtes',        scrum: 'Ticket Details',       desc: 'Vue détaillée par ticket : description complète, critères d\'acceptation, sous-tâches, dépendances.' },
    en: { yamzy: 'Quest Map',               scrum: 'Ticket Details',       desc: 'Detailed ticket view: full description, acceptance criteria, sub-tasks, dependencies.' },
  },
  'vue-sprint': {
    fr: { yamzy: 'Vue d\'Expédition',       scrum: 'Sprint View',          desc: 'Tickets groupés par sprint avec totaux SP/heures, état d\'avancement, charge restante.' },
    en: { yamzy: 'Expedition View',         scrum: 'Sprint View',          desc: 'Tickets grouped per sprint with SP/hour totals, progress state, remaining workload.' },
  },
  'sprints': {
    fr: { yamzy: 'Carte des Expéditions',   scrum: 'Sprints',              desc: 'Liste des sprints avec dates, capacité, statut. Bouton "Lancer" pour démarrer le sprint actif.', tip: 'Lance un sprint pour auto-générer ses cérémonies.' },
    en: { yamzy: 'Expedition Map',          scrum: 'Sprints',              desc: 'Sprint list with dates, capacity, status. "Launch" button to start the active sprint.', tip: 'Launch a sprint to auto-generate its ceremonies.' },
  },

  // ═══ MÉTRIQUES ═══
  'burndown': {
    fr: { yamzy: 'Courbe de Combat',        scrum: 'Burndown Chart',       desc: 'Évolution des SP restants jour par jour. La courbe idéale descend en ligne droite — la réelle révèle la vérité.' },
    en: { yamzy: 'Combat Curve',            scrum: 'Burndown Chart',       desc: 'Daily evolution of remaining SP. Ideal curve drops straight — the real one reveals the truth.' },
  },
  'cfd-velocity': {
    fr: { yamzy: 'Pouls de l\'Équipe',      scrum: 'CFD & Velocity',       desc: 'Cumulative Flow Diagram (par statut) + Velocity par sprint (SP livrés). Prédit la capacité future.' },
    en: { yamzy: 'Team Pulse',              scrum: 'CFD & Velocity',       desc: 'Cumulative Flow Diagram (per status) + Velocity per sprint (SP delivered). Predicts future capacity.' },
  },

  // ═══ PILOTAGE ═══
  'roadmap': {
    fr: { yamzy: 'Voie de l\'Aventure',     scrum: 'Roadmap',              desc: 'Trimestres + jalons. Le chemin macro du produit sur 6-12 mois.' },
    en: { yamzy: 'Adventure Path',          scrum: 'Roadmap',              desc: 'Quarters + milestones. The product macro-path over 6-12 months.' },
  },
  'dependances': {
    fr: { yamzy: 'Liens d\'Alliance',       scrum: 'Dependencies',         desc: 'Ticket A dépend de Ticket B. Si B en retard ou bloqué, A est en risque. Détection automatique.' },
    en: { yamzy: 'Alliance Bonds',          scrum: 'Dependencies',         desc: 'Ticket A depends on Ticket B. If B late or blocked, A at risk. Automatic detection.' },
  },
  'tech-debt': {
    fr: { yamzy: 'Dette de Sang',           scrum: 'Technical Debt',       desc: 'Dette technique cumulée : raccourcis, hacks, refactorings reportés. À traiter avant qu\'elle ne te dévore.', tip: '20% de chaque sprint = paiement de dette.' },
    en: { yamzy: 'Blood Debt',              scrum: 'Technical Debt',       desc: 'Accumulated tech debt: shortcuts, hacks, postponed refactoring. Handle before it devours you.', tip: '20% of each sprint = debt payment.' },
  },
  'knowledge': {
    fr: { yamzy: 'Bibliothèque du Mage',    scrum: 'Knowledge Base',       desc: 'Documentation technique : ADRs, glossaire, runbooks, lessons learned. La mémoire du projet.' },
    en: { yamzy: 'Mage Library',            scrum: 'Knowledge Base',       desc: 'Technical docs: ADRs, glossary, runbooks, lessons learned. The project memory.' },
  },

  // ═══ PERSONNEL ═══
  'overtime': {
    fr: { yamzy: 'Veillées Tardives',       scrum: 'Overtime Tracking',    desc: 'Suivi des heures sup et du mood quotidien. Rouge = burnout imminent — réagit avant.', tip: 'Si tu rouges 3 jours d\'affilée, lève l\'alerte à ton SM.' },
    en: { yamzy: 'Late Vigils',             scrum: 'Overtime Tracking',    desc: 'Tracks overtime hours and daily mood. Red = imminent burnout — react first.', tip: 'If you red for 3 days in a row, raise the alert to your SM.' },
  },

  // ═══ PLANNING ═══
  'gantt': {
    fr: { yamzy: 'Frise du Temps',          scrum: 'Gantt Chart',          desc: 'Vue temporelle : barres horizontales par ticket, colorées par sprint. La ligne rouge = aujourd\'hui.' },
    en: { yamzy: 'Time Frieze',             scrum: 'Gantt Chart',          desc: 'Time view: horizontal bars per ticket, colored per sprint. Red line = today.' },
  },
  'calendrier': {
    fr: { yamzy: 'Calendrier de Bataille',  scrum: 'Monthly Calendar',     desc: 'Grille mensuelle avec daily/planning/review en haut + tickets en bas. Mini-avatars participants + détection collisions ⚠.', tip: 'Clique sur un event pour voir les détails et démarrer/terminer.' },
    en: { yamzy: 'Battle Calendar',         scrum: 'Monthly Calendar',     desc: 'Monthly grid with daily/planning/review on top + tickets below. Mini participant avatars + collision detection ⚠.', tip: 'Click an event to view details and start/end.' },
  },
  'agenda': {
    fr: { yamzy: 'Journal d\'Aventures',    scrum: 'Agenda',               desc: 'Liste chronologique des cérémonies et meetings, groupés par jour. Time allocation widget tickets vs cérémonies.' },
    en: { yamzy: 'Adventure Journal',       scrum: 'Agenda',               desc: 'Chronological list of ceremonies and meetings, grouped per day. Time allocation widget tickets vs ceremonies.' },
  },

  // ═══ VUE EXTERNE ═══
  'vue-reviewer': {
    fr: { yamzy: 'Œil du Reviewer',         scrum: 'Code Review View',     desc: 'Vue dédiée aux reviewers : commits liés, PRs, blockers techniques, commentaires de review.' },
    en: { yamzy: 'Reviewer Eye',            scrum: 'Code Review View',     desc: 'Reviewer-dedicated view: linked commits, PRs, technical blockers, review comments.' },
  },

  // ═══ RISQUES ═══
  'risks': {
    fr: { yamzy: 'Sortilèges Sombres',      scrum: 'Risk Register',        desc: 'Registre des risques : probabilité × impact = score. Owner, mitigation, ticket lié, date d\'identification.', tip: 'Score ≥ 12 (4×3+) = action immédiate.' },
    en: { yamzy: 'Dark Spells',             scrum: 'Risk Register',        desc: 'Risk register: probability × impact = score. Owner, mitigation, linked ticket, identification date.', tip: 'Score ≥ 12 (4×3+) = immediate action.' },
  },
  'lessons': {
    fr: { yamzy: 'Mémoires de Guerre',      scrum: 'Lessons Learned',      desc: 'Apprentissages capitalisés à la fin de chaque sprint / phase / projet. La sagesse de l\'équipe.' },
    en: { yamzy: 'War Memoirs',             scrum: 'Lessons Learned',      desc: 'Lessons captured at end of each sprint / phase / project. Team wisdom.' },
  },

  // ═══ LISTES ═══
  'listes': {
    fr: { yamzy: 'Tablettes Sacrées',       scrum: 'Reference Lists',      desc: 'Listes de référence (statuts, types, composants...) verrouillées — source de vérité pour les dropdowns.' },
    en: { yamzy: 'Sacred Tablets',          scrum: 'Reference Lists',      desc: 'Reference lists (statuses, types, components...) locked — source of truth for dropdowns.' },
  },

  // ═══ TOPBAR / OUTILS ═══
  'topbar-import': {
    fr: { yamzy: 'Importer Aventure',       scrum: 'Excel Import',         desc: 'Importer un planning Excel (template Scrum) — détecte automatiquement les feuilles Backlog, Sprints, Risques, etc.' },
    en: { yamzy: 'Import Adventure',        scrum: 'Excel Import',         desc: 'Import an Excel plan (Scrum template) — auto-detects sheets Backlog, Sprints, Risks, etc.' },
  },
  'topbar-export': {
    fr: { yamzy: 'Exporter Aventure',       scrum: 'Excel Export',         desc: 'Exporte tout en Excel (round-trip) — DB → .xlsx avec template fidèle, formules préservées.' },
    en: { yamzy: 'Export Adventure',        scrum: 'Excel Export',         desc: 'Export everything to Excel (round-trip) — DB → .xlsx with faithful template, formulas preserved.' },
  },
  'topbar-edit-mode': {
    fr: { yamzy: 'Mode Création',           scrum: 'Edit Mode',            desc: 'Active/désactive l\'édition inline + les boutons + et 🗑 sur chaque page. Off = mode lecture/présentation.' },
    en: { yamzy: 'Creation Mode',           scrum: 'Edit Mode',            desc: 'Toggle inline editing + the + and 🗑 buttons on each page. Off = read/presentation mode.' },
  },
  'topbar-reminders': {
    fr: { yamzy: 'Cloche d\'Alerte',        scrum: 'Reminders',            desc: 'Notifications du système : tickets en retard, daily manqué, risques non résolus, sprint overrun.', tip: 'Les rouges = action requise.' },
    en: { yamzy: 'Alert Bell',              scrum: 'Reminders',            desc: 'System notifications: late tickets, missed daily, unresolved risks, sprint overrun.', tip: 'Reds = action required.' },
  },
  'topbar-project': {
    fr: { yamzy: 'Sélecteur d\'Aventure',   scrum: 'Project Selector',     desc: 'Switch entre les projets/produits que tu pilotes. Chaque projet a son propre backlog, sprints, équipe.' },
    en: { yamzy: 'Adventure Selector',      scrum: 'Project Selector',     desc: 'Switch between projects/products you pilot. Each project has its own backlog, sprints, team.' },
  },

  // ═══ COCKPIT TABS ═══
  'cockpit-action': {
    fr: { yamzy: 'Action en Cours',         scrum: 'Active / Next Event',  desc: 'Cérémonie EN_COURS (timer live) ou prochaine à venir. Bouton ▶ Démarrer / ■ Terminer.' },
    en: { yamzy: 'Current Action',          scrum: 'Active / Next Event',  desc: 'IN_PROGRESS ceremony (live timer) or upcoming. ▶ Start / ■ End button.' },
  },
  'cockpit-upcoming': {
    fr: { yamzy: 'Prochaines Cérémonies',   scrum: 'Upcoming Events',      desc: 'Les 4 prochains daily / planning / review / meeting. Clic = ouvre le détail.' },
    en: { yamzy: 'Upcoming Ceremonies',     scrum: 'Upcoming Events',      desc: 'Next 4 daily / planning / review / meeting. Click = open detail.' },
  },
  'cockpit-tickets': {
    fr: { yamzy: 'Tickets Critiques',       scrum: 'Top Blocking Tickets', desc: 'Tickets bloquants du sprint courant. Clic = ouvre le backlog filtré.' },
    en: { yamzy: 'Critical Tickets',        scrum: 'Top Blocking Tickets', desc: 'Blocking tickets of current sprint. Click = opens filtered backlog.' },
  },
  'cockpit-alerts': {
    fr: { yamzy: 'Alertes Critiques',       scrum: 'High Severity Alerts', desc: 'Alertes HIGH du système (sprint overrun, risque non résolu...). Clic = page risque.' },
    en: { yamzy: 'Critical Alerts',         scrum: 'High Severity Alerts', desc: 'HIGH system alerts (sprint overrun, unresolved risk...). Click = risk page.' },
  },
};
