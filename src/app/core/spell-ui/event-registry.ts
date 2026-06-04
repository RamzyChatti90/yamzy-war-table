// ═══════════════════════════════════════════════════════════════════
// 🎉 EVENT REGISTRY — Registre extensible des événements/cérémonies
//
// Une cérémonie = un événement gameplay qui :
//   - peut être joué dans n'importe quelle room (via CeremonyBus)
//   - réagit dans le ciel universel (sky-ornaments)
//   - se documente automatiquement
//
// Pour ajouter une cérémonie : registerEvent({...}) ou pousser dans REGISTRY.
// ═══════════════════════════════════════════════════════════════════
export type EventKind = 'ceremony' | 'milestone' | 'incident' | 'celebration' | 'custom';

export interface EventDescriptor {
  /** Clé technique unique */
  key: string;
  /** Nom affiché (court) */
  name: string;
  /** Catégorie */
  kind: EventKind;
  /** Icône emoji */
  icon: string;
  /** Couleur d'accent */
  accent: string;
  /** Description courte (one-liner) */
  description: string;
  /** Effet visuel sur le ciel : 'pulse-soft' | 'flash' | 'aurora-boost' | etc. */
  skyEffect?: string;
  /** Son MP3 associé */
  sound?: string;
  /** Méta libre */
  meta?: Record<string, any>;
}

const REGISTRY = new Map<string, EventDescriptor>();

export function registerEvent(e: EventDescriptor): void { REGISTRY.set(e.key, e); }
export function getEvent(key: string): EventDescriptor | undefined { return REGISTRY.get(key); }
export function listEvents(kind?: EventKind): EventDescriptor[] {
  const arr = Array.from(REGISTRY.values());
  return kind ? arr.filter(e => e.kind === kind) : arr;
}
export function clearEventRegistry(): void { REGISTRY.clear(); }

// ─── Seed initial : 22 cérémonies Scrum + 4 célébrations ────────────
[
  // Daily ceremonies
  { key: 'daily-start',        name: 'Daily début',        kind: 'ceremony' as EventKind, icon: '🌅', accent: '#f59e0b', description: 'Lancement du daily standup.', skyEffect: 'pulse-soft', sound: 'ping-1' },
  { key: 'daily-end',          name: 'Daily fin',          kind: 'ceremony' as EventKind, icon: '🌄', accent: '#f59e0b', description: 'Fin du daily standup.', sound: 'ping-2' },
  // Sprint ceremonies
  { key: 'sprint-planning',    name: 'Sprint planning',    kind: 'ceremony' as EventKind, icon: '📅', accent: '#67e8f9', description: 'Planification d\'un nouveau sprint.', skyEffect: 'aurora-boost' },
  { key: 'sprint-start',       name: 'Sprint start',       kind: 'ceremony' as EventKind, icon: '🚀', accent: '#84cc16', description: 'Démarrage du sprint.', skyEffect: 'flash', sound: 'enter-1' },
  { key: 'sprint-end',         name: 'Sprint end',         kind: 'ceremony' as EventKind, icon: '🏁', accent: '#d54adf', description: 'Clôture du sprint.', skyEffect: 'aurora-boost', sound: 'portal' },
  // Retro
  { key: 'retro',              name: 'Rétrospective',      kind: 'ceremony' as EventKind, icon: '🔍', accent: '#67e8f9', description: 'Retrospective sprint.' },
  { key: 'sommet',             name: 'Sommet',             kind: 'ceremony' as EventKind, icon: '🏔', accent: '#fde68a', description: 'Sommet d\'équipe / décision majeure.' },
  // Tickets
  { key: 'ticket-created',     name: 'Ticket créé',        kind: 'milestone' as EventKind, icon: '➕', accent: '#a78bfa', description: 'Nouveau ticket créé.' },
  { key: 'ticket-done',        name: 'Ticket done',        kind: 'milestone' as EventKind, icon: '✅', accent: '#84cc16', description: 'Ticket terminé.', skyEffect: 'pulse-soft' },
  { key: 'ticket-blocked',     name: 'Ticket bloqué',      kind: 'incident' as EventKind, icon: '🚧', accent: '#ef4444', description: 'Ticket bloqué.' },
  // PR
  { key: 'pr-opened',          name: 'PR ouverte',         kind: 'milestone' as EventKind, icon: '🪞', accent: '#67e8f9', description: 'Pull request ouverte.' },
  { key: 'pr-merged',          name: 'PR merged',          kind: 'celebration' as EventKind, icon: '🎉', accent: '#84cc16', description: 'PR mergée.', skyEffect: 'flash', sound: 'crystal-reform' },
  { key: 'pr-rejected',        name: 'PR rejected',        kind: 'incident' as EventKind, icon: '↩', accent: '#f59e0b', description: 'PR refusée.' },
  // Risques
  { key: 'risk-spotted',       name: 'Risque détecté',     kind: 'incident' as EventKind, icon: '⚠', accent: '#f59e0b', description: 'Nouveau risque identifié.' },
  { key: 'risk-mitigated',     name: 'Risque mitigé',      kind: 'milestone' as EventKind, icon: '🛡', accent: '#84cc16', description: 'Risque mitigé.' },
  // Phoenix Forge
  { key: 'forge-rebirth',      name: 'Phoenix rebirth',    kind: 'celebration' as EventKind, icon: '🔥', accent: '#ef4444', description: 'Renaissance après incident.', skyEffect: 'flash' },
  // Workshops
  { key: 'workshop-end',       name: 'Workshop end',       kind: 'celebration' as EventKind, icon: '🎓', accent: '#d54adf', description: 'Workshop terminé.', sound: 'ping-2' },
  // OKR
  { key: 'okr-summit',         name: 'OKR summit',         kind: 'celebration' as EventKind, icon: '⛰', accent: '#fde68a', description: 'OKR atteint.', skyEffect: 'aurora-boost' },
  // Knowledge
  { key: 'lesson-archived',    name: 'Lesson archived',    kind: 'milestone' as EventKind, icon: '📚', accent: '#a78bfa', description: 'Leçon archivée à la bibliothèque.' },
  // Magic Water
  { key: 'water-budget-alert', name: 'Budget eau alerte',  kind: 'incident' as EventKind, icon: '💧', accent: '#ef4444', description: 'Budget eau dépassé.' },
  // Custom slots
  { key: 'arrivee',            name: 'Arrivée',            kind: 'milestone' as EventKind, icon: '🎯', accent: '#84cc16', description: 'Atteinte d\'un objectif.' },
  { key: 'tide',               name: 'Marée',              kind: 'ceremony' as EventKind, icon: '🌊', accent: '#67e8f9', description: 'Cycle / marée.', skyEffect: 'pulse-soft' },
].forEach(registerEvent);
