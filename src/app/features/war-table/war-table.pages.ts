// Source unique des 43 pages WAR TABLE.
// v1.0.61 — 5 super-catégories (superCat) avec sous-cats (cat) préservées.
// v1.0.81 — Chaque page reçoit une carte Yamzy (PNG + GLB) unique ou partagée.

export interface PageDef {
  id: string;
  label: string;
  icon: string;
  cat: string;       // sous-catégorie (existante, garde la granularité)
  superCat: SuperCat; // une des 5 grandes catégories
  card: string;      // v1.0.81 — nom de fichier (sans ext) — assets/cards/{card}.png + .glb
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
  // ═══ 🎯 DASHBOARD (3) — cartes royales / wisdom ═══
  { superCat: 'Dashboard', cat: 'Dashboards',    id: 'dashboard',         label: 'Dashboard Global',       icon: '📊', card: '6_King' },
  { superCat: 'Dashboard', cat: 'Dashboards',    id: 'dashboard-param',   label: 'Dashboard Paramétré',    icon: '🎛', card: '30_Wizard' },
  { superCat: 'Dashboard', cat: 'Dashboards',    id: 'dashboard-legacy',  label: 'Dashboard',              icon: '📈', card: '27_Book' },

  // ═══ 🏃 SPRINT (10) — cartes action ═══
  // Backlogs (2)
  { superCat: 'Sprint',    cat: 'Backlogs',      id: 'backlog',           label: 'Backlog',                icon: '📜', card: '27_Book' },
  { superCat: 'Sprint',    cat: 'Backlogs',      id: 'backlog-tma',       label: 'Backlog TMA',            icon: '🔧', card: '29_Block' },
  // Cérémonies (6)
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'sprints',           label: 'Sprints',                icon: '🏃', card: '1_Fireball' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'sprint-planning',   label: 'Sprint Planning',        icon: '🎯', card: '28_RollDice' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'sprint-review',     label: 'Sprint Review',          icon: '🔍', card: '15_Cult' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'retros',            label: 'Rétrospectives',         icon: '🔄', card: '17_Rebirth' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'vue-sprint',        label: 'Vue par Sprint',         icon: '📋', card: '16_Belltowers' },
  { superCat: 'Sprint',    cat: 'Cérémonies',    id: 'detail-tickets',    label: 'Détail tickets',         icon: '🗒', card: '14_Coin' },
  // Risques & Lessons (2)
  { superCat: 'Sprint',    cat: 'Risques',       id: 'risks',             label: 'Risques',                icon: '⚠', card: '13_SeaMonster' },
  { superCat: 'Sprint',    cat: 'Risques',       id: 'lessons',           label: 'Lessons Learned',        icon: '✨', card: '9_Hypnosis' },

  // ═══ 📅 PLANNING (9) — cartes temps / éléments ═══
  // Vues temporelles (3)
  { superCat: 'Planning',  cat: 'Vues temporelles', id: 'gantt',          label: 'Gantt',                  icon: '📅', card: '20_Element_Fire' },
  { superCat: 'Planning',  cat: 'Vues temporelles', id: 'calendrier',     label: 'Calendrier',             icon: '🗓', card: '22_Element_Air' },
  { superCat: 'Planning',  cat: 'Vues temporelles', id: 'agenda',         label: 'Agenda',                 icon: '⏰', card: '21_Element_Lightning' },
  // Multi-Projets (5)
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'projets',           label: 'Projets',                icon: '🗂', card: '4_Market' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'phases',            label: 'Phases',                 icon: '🧩', card: '25_Element_Earth' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'allocation',        label: 'Allocation Multi-Projets', icon: '📐', card: '23_Element_Water' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'charge',            label: 'Charge Multi-Projets',   icon: '⚖', card: '24_Element_Dark' },
  { superCat: 'Planning',  cat: 'Multi-Projets', id: 'capacity',          label: 'Capacity Planning',      icon: '👥', card: '10_Beehive' },
  // Personnel (1)
  { superCat: 'Planning',  cat: 'Personnel',     id: 'overtime',          label: 'Heures Sup',             icon: '⏰', card: '11_Polinization' },

  // ═══ 📊 REPORTING (11) — cartes sagesse / observation ═══
  // Métriques (2)
  { superCat: 'Reporting', cat: 'Métriques',     id: 'burndown',          label: 'Burndown',               icon: '📉', card: '18_WaterDragon' },
  { superCat: 'Reporting', cat: 'Métriques',     id: 'cfd-velocity',      label: 'CFD & Velocity',         icon: '📊', card: '8_LightningWizard' },
  // Pilotage (4)
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'roadmap',           label: 'Roadmap',                icon: '🗺', card: '19_OceanTreasure' },
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'dependances',       label: 'Dépendances',            icon: '🔗', card: '12_Mimic' },
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'tech-debt',         label: 'Tech Debt',              icon: '💳', card: '7_StinkTrap' },
  { superCat: 'Reporting', cat: 'Pilotage',      id: 'knowledge',         label: 'Knowledge Base',         icon: '📚', card: '27_Book' },
  // Stakeholders (3)
  { superCat: 'Reporting', cat: 'Communication', id: 'vue-stakeholder',   label: 'Vue Stakeholder',        icon: '👁', card: '5_Steal' },
  { superCat: 'Reporting', cat: 'Communication', id: 'stakeholders',      label: 'Stakeholders',           icon: '😊', card: '3_Monk' },
  { superCat: 'Reporting', cat: 'Communication', id: 'export-stakeholder',label: 'Export Stakeholder',     icon: '📤', card: '4_Market' },
  // Vue Externe (1)
  { superCat: 'Reporting', cat: 'Vue Externe',   id: 'vue-reviewer',      label: 'Vue Reviewer',           icon: '🔎', card: '12_Mimic' },
  // Listes (1)
  { superCat: 'Reporting', cat: 'Listes',        id: 'listes',            label: 'Listes',                 icon: '🔒', card: '26_BloodRing' },

  // ═══ ⚙ SETUP & GUIDES (10) — cartes mystique / nature ═══
  // Documentation (6)
  { superCat: 'Setup',     cat: 'Documentation', id: 'mode-emploi',       label: "Mode d'emploi",          icon: '📖', card: '27_Book' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'checkup',           label: 'Check-up lancement',     icon: '🚀', card: '1_Fireball' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'routine',           label: 'Routine quotidienne',    icon: '📅', card: '11_Polinization' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'daily',             label: 'Daily Stand-up',         icon: '🗣', card: '3_Monk' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'nouveau-projet',    label: 'Nouveau projet',         icon: '🆕', card: '17_Rebirth' },
  { superCat: 'Setup',     cat: 'Documentation', id: 'regen-alloc',       label: 'Régénérer Allocation',   icon: '🔄', card: '2_TrenchcoatMushrooms' },
  // Guides Scrum (3)
  { superCat: 'Setup',     cat: 'Guides Scrum',  id: 'dod',               label: 'DoD',                    icon: '📋', card: '6_King' },
  { superCat: 'Setup',     cat: 'Guides Scrum',  id: 'dor',               label: 'DoR',                    icon: '📥', card: '28_RollDice' },
  { superCat: 'Setup',     cat: 'Guides Scrum',  id: 'templates',         label: 'Templates Tickets',      icon: '📑', card: '0_Card_Front' },
  // Config (1)
  { superCat: 'Setup',     cat: 'Config',        id: 'parametres',        label: 'Paramètres',             icon: '⚙', card: '30_Wizard' },
];
