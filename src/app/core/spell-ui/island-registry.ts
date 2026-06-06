// ═══════════════════════════════════════════════════════════════════
// 🏝 ISLAND REGISTRY — Registre extensible des îles du Royaume Yamzy
//
// Architecture dynamique : pour ajouter une nouvelle île plus tard,
// pousser un IslandDescriptor dans REGISTRY (ou via registerIsland()).
// Tous les composants UI qui itèrent sur les îles (gallery, hub,
// welcome conte, sky-ornaments) tirent depuis ce registre.
//
// Pattern inspiré du "feature registry" des design-systems modernes.
// ═══════════════════════════════════════════════════════════════════
export type IslandKind = 'hub' | 'delivery' | 'strategy' | 'knowledge' | 'commerce' | 'workshop' | 'showcase' | 'custom';

export interface IslandDescriptor {
  /** Clé technique unique — slug stable */
  key: string;
  /** Nom affiché */
  name: string;
  /** Nom lore (poétique) */
  loreName: string;
  /** Route Angular vers l'île */
  route: string;
  /** Catégorie pour filter / clustering */
  kind: IslandKind;
  /** Icône emoji */
  icon: string;
  /** Couleur d'accent (CSS) */
  accent: string;
  /** Phrase de présentation (one-liner) */
  oneLiner: string;
  /** Durée estimée de la démo en secondes */
  durationSec?: number;
  /** Niveau Scrum nécessaire (0=débutant, 3=expert) */
  level?: 0 | 1 | 2 | 3;
  /** Clés des rooms contenues dans cette île */
  rooms?: string[];
  /** Méta libre (tags, layer, etc.) */
  meta?: Record<string, any>;
}

/** REGISTRE in-memory — peuplé statiquement + extensible runtime */
const REGISTRY = new Map<string, IslandDescriptor>();

/** Enregistre / met à jour une île. Idempotent. */
export function registerIsland(d: IslandDescriptor): void {
  REGISTRY.set(d.key, d);
}

/** Récupère une île par sa clé. */
export function getIsland(key: string): IslandDescriptor | undefined {
  return REGISTRY.get(key);
}

/** Liste toutes les îles, optionnellement filtrées par kind. */
export function listIslands(kind?: IslandKind): IslandDescriptor[] {
  const arr = Array.from(REGISTRY.values());
  return kind ? arr.filter(i => i.kind === kind) : arr;
}

/** Vide complètement le registre (pour tests). */
export function clearIslandRegistry(): void { REGISTRY.clear(); }

// ─── Seed initial : 4 îles du Royaume + Yamzy Hub + Welcome ─────────
const SEED_ISLANDS: IslandDescriptor[] = [
  { key: 'chez-yamzy', name: 'Yamzy World', loreName: 'Le Seuil du Royaume', route: '/chez-yamzy', kind: 'hub', icon: '🌍', accent: '#d54adf', oneLiner: 'Page d\'accueil de Yamzy World — map 3D des îles + accès direct aux rooms.', durationSec: 120, level: 0 },
  { key: 'yamzy-island', name: 'Yamzy Island', loreName: 'Le Cœur du Royaume', route: '/yamzy-island', kind: 'hub', icon: '🏝', accent: '#d54adf', oneLiner: 'Hub central — passerelle vers les 4 îles thématiques.', durationSec: 30, level: 0 },
  { key: 'delivery',  name: 'Île Livraison',  loreName: 'Le Port des Quêtes',    route: '/island/delivery',  kind: 'delivery',  icon: '🌿', accent: '#67e8f9', oneLiner: 'Flux delivery : git tree, kanban, PR, phoenix forge.', level: 1, rooms: ['git-tree-room', 'kanban-island', 'pr-mirror-hall', 'phoenix-forge'] },
  { key: 'strategy',  name: 'Île Stratégie',  loreName: 'L\'Observatoire',       route: '/island/strategy',  kind: 'strategy',  icon: '🌌', accent: '#f59e0b', oneLiner: 'OKR, risques, télescope — pilotage stratégique.', level: 2, rooms: ['okr-mountain', 'star-map-risks', 'telescope-island'] },
  { key: 'knowledge', name: 'Île Savoir',     loreName: 'La Bibliothèque',       route: '/island/knowledge', kind: 'knowledge', icon: '🏛', accent: '#a78bfa', oneLiner: 'Bibliothèque + oracle — savoir partagé du Conclave.', level: 1, rooms: ['library-cathedral', 'oracle-aquarium'] },
  { key: 'commerce',  name: 'Île Commerce',   loreName: 'Le Marché des Sortilèges', route: '/island/commerce', kind: 'commerce', icon: '⚗', accent: '#84cc16', oneLiner: 'Alchimie + taverne de cartes — valeur et trade.', level: 2, rooms: ['alchemist-cellar', 'card-tavern'] },
];
SEED_ISLANDS.forEach(registerIsland);

// ─── Seed des rooms workshop / autres (peuvent être étiquetées îlots) ─
[
  { key: 'mana-fountain',       name: 'Mana Fountain',       loreName: 'La Source qui mesure la magie',      route: '/mana-fountain',       kind: 'workshop' as IslandKind, icon: '💧', accent: '#d54adf', oneLiner: 'Sensibilisation IA/Eau/$.', durationSec: 60 },
  { key: 'retrospective-cove',  name: 'Retrospective Sailboat', loreName: 'Le Cercle du Rétroviseur',         route: '/retrospective-cove',  kind: 'workshop' as IslandKind, icon: '⛵', accent: '#67e8f9', oneLiner: 'Sprint retro Sailboat.', durationSec: 75 },
  { key: 'premortem-crypt',     name: 'Pre-mortem Crypt',    loreName: 'Le Caveau des Pré-Mortems',          route: '/premortem-crypt',     kind: 'workshop' as IslandKind, icon: '⚰', accent: '#831843', oneLiner: 'Imaginer les scénarios d\'échec.', durationSec: 80 },
  { key: 'story-trail',         name: 'Story Mapping',        loreName: 'La Carte des Sentiers',             route: '/story-trail',         kind: 'workshop' as IslandKind, icon: '🏔', accent: '#f59e0b', oneLiner: 'Story mapping Jeff Patton.', durationSec: 75 },
  { key: 'lean-coffee',         name: 'Lean Coffee',          loreName: 'La Brûlerie Lean',                  route: '/lean-coffee',         kind: 'workshop' as IslandKind, icon: '☕', accent: '#6b4423', oneLiner: 'Agenda démocratique.', durationSec: 65 },
  { key: 'refinement-orchard',  name: 'Refinement Orchard',   loreName: 'Le Verger des Affinages',           route: '/refinement-orchard',  kind: 'workshop' as IslandKind, icon: '🍇', accent: '#84cc16', oneLiner: 'Backlog grooming.', durationSec: 70 },
  { key: 'five-whys-well',      name: 'Five Whys Well',       loreName: 'Le Puits des Cinq Pourquoi',        route: '/five-whys-well',      kind: 'workshop' as IslandKind, icon: '🪨', accent: '#475569', oneLiner: 'Root cause analysis.', durationSec: 70 },
  { key: 'definitions-beach',   name: 'Definitions Beach',    loreName: 'La Plage des Définitions',          route: '/definitions-beach',   kind: 'workshop' as IslandKind, icon: '🏖', accent: '#fde68a', oneLiner: 'DoR / DoD.', durationSec: 60 },
].forEach(registerIsland);
