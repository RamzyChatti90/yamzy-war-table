// Source unique des 43 pages WAR TABLE.
// v1.0.61 — 5 super-catégories (superCat) avec sous-cats (cat) préservées.

export interface PageDef {
  id: string;
  label: string;
  icon: string;
  cat: string;       // sous-catégorie (existante, garde la granularité)
  superCat: SuperCat; // une des 5 grandes catégories
}

export type SuperCat = 'Dashboard' | 'Sprint' | 'Planning' | 'Reporting' | 'Setup';

export interface SuperCatDef {
  id: SuperCat;
  label: string;
  icon: string;
  desc: string;
  color: string;
}

/** Les 5 grandes catégories de navigation. */
export const SUPER_CATS: SuperCatDef[] = [
  { id: 'Dashboard', label: 'Dashboard',      icon: '🎯', desc: "Vue d'ensemble du projet",          color: '#d99a51' },
  { id: 'Sprint',    label: 'Sprint',         icon: '🏃', desc: 'Exécution Scrum : backlog, cérémonies, risques', color: '#6cd16c' },
  { id: 'Planning',  label: 'Planning',       icon: '📅', desc: 'Quand & qui : Gantt, calendrier, multi-projets', color: '#4696b9' },
  { id: 'Reporting', label: 'Reporting',      icon: '📊', desc: 'Métriques, pilotage, communication',  color: '#c25d8d' },
  { id: 'Setup',     label: 'Setup & Guides', icon: '⚙', desc: 'Documentation, Scrum, configuration', color: '#9d8ad6' },
];

export const WAR_TABLE_PAGES: PageDef[] = [
  // ═══ 🎯 DASHBOARD (3) ═══
  { superCat: 'Dashboard', cat: 'Dashboards',    id: 'dashboard',         label: 'Dashboard Global',       icon: '📊' },
  { superCat: 'Dashboard', cat: 'Dashboards',    id: 'dashboard-param',   label: 'Dashboard Paramétré',    icon: '🎛' },
  { superCat: 'Dashboard', cat: 'Dashboards',    id: 'dashboard-legacy',  label: 'Dashboard',              icon: '📈' },

  // ═══ 🏃 SPRINT (10) ═══
  // Backlogs (2)
  { superCat: 'Sprint',    cat: 'Backlogs',      id: 'backlog',           label: 'Backlog',                icon: '📜' },
  { superCat: 'Sprint',    cat: 'Backlogs',      id: 'backlog-tma',       label: 'Backlog TMA',            icon: '🔧' },
  // Cérémonies (6)
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'sprints',           label: 'Sprints',                icon: '🏃' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'sprint-planning',   label: 'Sprint Planning',        icon: '🎯' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'sprint-review',     label: 'Sprint Review',          icon: '🔍' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'retros',            label: 'Rétrospectives',         icon: '🔄' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'vue-sprint',        label: 'Vue par Sprint',         icon: '📋' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'detail-tickets',    label: 'Détail tickets',         icon: '🗒' },
  // Risques & Lessons (2)
  { superCat: 'Sprint',    cat: 'Risques',       id: 'risks',             label: 'Risques',                icon: '⚠' },
  { superCat: 'Sprint',    cat: 'Risques',       id: 'lessons',           label: 'Lessons Learned',        icon: '✨' },

  // ═══ 📅 PLANNING (9) ═══
  // Vues temporelles (3)
  { superCat: 'Planning',  cat: 'Vues temporelles', id: 'gantt',          label: 'Gantt',                  icon: '📅' },
  { superCat: 'Planning',  cat: 'Vues temporelles', id: 'calendrier',     label: 'Calendrier',             icon: '🗓' },
  { superCat: 'Planning',  cat: 'Vues temporelles', id: 'agenda',         label: 'Agenda',                 icon: '⏰' },
  // Multi-Projets (5)
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'projets',           label: 'Projets',                icon: '🗂' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'phases',            label: 'Phases',                 icon: '🧩' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'allocation',        label: 'Allocation Multi-Projets', icon: '📐' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'charge',            label: 'Charge Multi-Projets',   icon: '⚖' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'capacity',          label: 'Capacity Planning',      icon: '👥' },
  // Personnel (1)
  { superCat: 'Planning',  cat: 'Personnel',     id: 'overtime',          label: 'Heures Sup',             icon: '⏰' },

  // ═══ 📊 REPORTING (11) ═══
  // Métriques (2)
  { superCat: 'Reporting', cat: 'Métriques',     id: 'burndown',          label: 'Burndown',               icon: '📉' },
  { superCat: 'Reporting', cat: 'Métriques',     id: 'cfd-velocity',      label: 'CFD & Velocity',         icon: '📊' },
  // Pilotage (4)
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'roadmap',           label: 'Roadmap',                icon: '🗺' },
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'dependances',       label: 'Dépendances',            icon: '🔗' },
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'tech-debt',         label: 'Tech Debt',              icon: '💳' },
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'knowledge',         label: 'Knowledge Base',         icon: '📚' },
  // Stakeholders (3)
  { superCat: 'Reporting', cat: 'Communication', id: 'vue-stakeholder',   label: 'Vue Stakeholder',        icon: '👁' },
  { superCat: 'Reporting', cat: 'Communication', id: 'stakeholders',      label: 'Stakeholders',           icon: '😊' },
  { superCat: 'Reporting', cat: 'Communication', id: 'export-stakeholder',label: 'Export Stakeholder',     icon: '📤' },
  // Vue Externe (1)
  { superCat: 'Reporting', cat: 'Vue Externe',   id: 'vue-reviewer',      label: 'Vue Reviewer',           icon: '🔎' },
  // Listes (1)
  { superCat: 'Reporting', cat: 'Listes',        id: 'listes',            label: 'Listes',                 icon: '🔒' },

  // ═══ ⚙ SETUP & GUIDES (10) ═══
  // Documentation (6)
  { superCat: 'Setup',     cat: 'Documentation', id: 'mode-emploi',       label: "Mode d'emploi",          icon: '📖' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'checkup',           label: 'Check-up lancement',     icon: '🚀' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'routine',           label: 'Routine quotidienne',    icon: '📅' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'daily',             label: 'Daily Stand-up',         icon: '🗣' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'nouveau-projet',    label: 'Nouveau projet',         icon: '🆕' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'regen-alloc',       label: 'Régénérer Allocation',   icon: '🔄' },
  // Guides Scrum (3)
  { superCat: 'Setup',     cat: 'Guides Scrum',  id: 'dod',               label: 'DoD',                    icon: '📋' },
  { superCat: 'Setup',     cat: 'Guides Scrum',  id: 'dor',               label: 'DoR',                    icon: '📥' },
  { superCat: 'Setup',     cat: 'Guides Scrum',  id: 'templates',         label: 'Templates Tickets',      icon: '📑' },
  // Config (1)
  { superCat: 'Setup',     cat: 'Config',        id: 'parametres',        label: 'Paramètres',             icon: '⚙' },
];
