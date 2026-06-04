// ═══════════════════════════════════════════════════════════════════
// 🌌 CEREMONY BUS — Bus global des cérémonies cross-room
//
// Chaque room qui émet une cérémonie locale (sprint planning, release,
// blocker, sommet OKR, etc.) peut aussi publier sur ce bus global.
//
// Telescope Island Room subscribe à ce bus et map chaque type de
// cérémonie à un phénomène céleste (comet, eclipse, aurora, supernova,
// nebula, meteor shower, etc.) — le ciel devient le radar universel
// du Royaume.
//
// Usage :
//   constructor(private ceremonyBus: CeremonyBusService) {}
//
//   // Émettre (depuis n'importe quelle room) :
//   this.ceremonyBus.publish({
//     type: 'renaissance',
//     label: 'v1.5.0 published',
//     icon: '🐦',
//     sourceRoom: 'phoenix-forge',
//   });
//
//   // S'abonner (typiquement depuis telescope-island) :
//   this.unsub = this.ceremonyBus.subscribe(c => this.handleRemoteCeremony(c));
//   // Et dans ngOnDestroy : this.unsub?.();
// ═══════════════════════════════════════════════════════════════════
import { Injectable, signal, computed } from '@angular/core';

/** Type de cérémonie globale qui circule sur le bus */
export interface GlobalCeremony {
  /** Type sémantique de la cérémonie. Sert au mapping sky. */
  type: string;
  /** Label affiché à l'utilisateur (titre court) */
  label: string;
  /** Icône emoji (optionnel) */
  icon: string;
  /** Room source de la cérémonie (ex: 'phoenix-forge', 'kanban-island') */
  sourceRoom: string;
  /** Timestamp d'émission (ms epoch) */
  timestamp: number;
  /** Phénomène céleste préféré (optionnel). Si absent, sera déduit du type. */
  preferredSkyPhenomenon?: SkyPhenomenon;
}

/** Catalogue des phénomènes célestes disponibles dans Telescope Island */
export type SkyPhenomenon =
  | 'comet'
  | 'eclipse'
  | 'aurora'
  | 'meteor-shower'
  | 'supernova'
  | 'nebula'
  | 'shooting-star'
  | 'crescent-moon'
  | 'solar-storm'
  | 'conjunction';

/**
 * Mapping CONVENTIONNEL : type de cérémonie → phénomène céleste.
 * Utilisé par Telescope Island pour traduire les événements projet
 * en phénomènes visuels dans le ciel.
 *
 * Ajout d'un mapping = simple ligne ici.
 */
export const CEREMONY_TO_SKY: Record<string, SkyPhenomenon> = {
  // ─── Releases / Deploy ───
  'renaissance':   'comet',
  'harvest':       'comet',
  'release':       'comet',
  'major-release': 'supernova',
  'comet':         'comet',

  // ─── Blockers / Incidents ───
  'eclipse':       'eclipse',
  'siren':         'eclipse',
  'death':         'solar-storm',
  'rollback':      'solar-storm',
  'incident':      'solar-storm',

  // ─── Sprint flow ───
  'debarquement':  'meteor-shower',  // sprint planning = many things arrive
  'sommet':        'aurora',         // sprint review success
  'aube':          'nebula',         // daily stand-up
  'dawn':          'nebula',
  'flag':          'shooting-star',  // KR achievement
  'bloom':         'nebula',         // new feature branch
  'fall':          'meteor-shower',  // branch deletion
  'pruning':       'meteor-shower',

  // ─── Strategy ───
  'storm':         'solar-storm',
  'solstice':      'crescent-moon',
  'feu':           'solar-storm',
  'supernova':     'supernova',
  'aurora':        'aurora',
  'nebula':        'nebula',
  'meteor':        'meteor-shower',
  'shooting-star': 'shooting-star',
  'crescent':      'crescent-moon',
  'solar-storm':   'solar-storm',
  'conjunction':   'conjunction',
};

@Injectable({ providedIn: 'root' })
export class CeremonyBusService {
  /** Liste des écouteurs actifs (rooms qui veulent réagir) */
  private listeners: Array<(c: GlobalCeremony) => void> = [];

  /** Signal exposant la DERNIÈRE cérémonie reçue (pour UI déclarative) */
  lastCeremony = signal<GlobalCeremony | null>(null);

  /** Signal compteur — incrémente à chaque cérémonie pour reactive computeds */
  ceremonyCount = signal<number>(0);

  /** Historique des N dernières cérémonies (pour debug + replay) */
  private history: GlobalCeremony[] = [];
  private readonly HISTORY_LIMIT = 50;

  /**
   * Publie une cérémonie sur le bus global.
   * Tous les abonnés sont notifiés.
   */
  publish(c: Omit<GlobalCeremony, 'timestamp'> & { timestamp?: number }): void {
    const ceremony: GlobalCeremony = {
      ...c,
      timestamp: c.timestamp ?? Date.now(),
    };
    this.lastCeremony.set(ceremony);
    this.ceremonyCount.update(n => n + 1);
    this.history.push(ceremony);
    if (this.history.length > this.HISTORY_LIMIT) {
      this.history.splice(0, this.history.length - this.HISTORY_LIMIT);
    }
    // Notifier les listeners (en copie pour éviter mutation pendant iteration)
    for (const fn of [...this.listeners]) {
      try {
        fn(ceremony);
      } catch (e) {
        console.warn('[CeremonyBus] listener error', e);
      }
    }
    console.log(`[CeremonyBus] 🌌 ${ceremony.type} from ${ceremony.sourceRoom} → ${ceremony.label}`);
  }

  /**
   * S'abonne aux cérémonies. Retourne une fonction d'unsubscribe.
   */
  subscribe(listener: (c: GlobalCeremony) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Retourne l'historique des cérémonies (lecture seule) */
  getHistory(): ReadonlyArray<GlobalCeremony> {
    return this.history;
  }

  /**
   * Helper raccourci : publie une cérémonie en spécifiant juste la roomKey source.
   * À utiliser depuis `emitCeremony(c)` d'une room :
   *
   *   this.ceremonyBus.publishFromRoom('kanban-island', c);
   *
   * Équivalent à publish({...c, sourceRoom: 'kanban-island'}).
   */
  publishFromRoom(sourceRoom: string, c: { type: string; label: string; icon: string }): void {
    this.publish({ type: c.type, label: c.label, icon: c.icon, sourceRoom });
  }

  /**
   * Helper : retourne le phénomène céleste correspondant au type de cérémonie.
   * Si rien ne matche, retourne 'shooting-star' (fallback générique).
   */
  mapToSkyPhenomenon(type: string): SkyPhenomenon {
    return CEREMONY_TO_SKY[type] ?? 'shooting-star';
  }
}
