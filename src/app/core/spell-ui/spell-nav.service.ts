// ════════════════════════════════════════════════════════════════════
// 🪄 SPELL NAV SERVICE — Mapping route → breadcrumbs unifié
//
// Une seule source de vérité pour la navigation globale Yamzy World.
// Le SpellHeader (injecté dans app.component) lit ce service et affiche
// les crumbs + le bouton retour adaptés à la route courante.
//
// USAGE :
//   const { crumbs, backTo, showHeader } = nav.snapshot();
//   <wt-spell-header [crumbs]="snap().crumbs" [backTo]="snap().backTo" ...>
// ════════════════════════════════════════════════════════════════════
import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SpellCrumb } from './spell-header.component';

export interface SpellNavSnap {
  crumbs: SpellCrumb[];
  backTo: string | null;
  showHeader: boolean;
  showQuit: boolean;
  accent: string;
}

/** Configuration par route — route exacte (ou prefix avec :*) → crumbs */
const NAV_MAP: Record<string, Omit<SpellNavSnap, 'showHeader'>> = {
  // Welcome est la home — pas de back/quit (on EST déjà chez soi)
  '/chez-yamzy': {
    crumbs: [{ label: 'Yamzy World', icon: '🪄' }],
    backTo: null,
    showQuit: false,
    accent: '#d54adf',
  },

  // Hub gallery (la Vitrine)
  '/yamzy-rooms': {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label: 'Yamzy Rooms' },
    ],
    backTo: '/chez-yamzy',
    showQuit: true,
    accent: '#d54adf',
  },

  // Grande Île principale (Le Conclave)
  '/yamzy-island': {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label: 'Yamzy Island' },
    ],
    backTo: '/chez-yamzy',
    showQuit: true,
    accent: '#d54adf',
  },

  // ═══ 11 ROOMS du CONCLAVE (sur la grande Île — accessibles via /yamzy-island) ═══
  '/conclave':          conclaveCrumbs('Conclave VESPER',   '#d54adf'),
  '/phoenix-forge':     conclaveCrumbs('Phoenix Forge',     '#f97316'),

  // ═══ Rooms rattachées aux SOUS-ÎLES ═══
  // 🌿 Delivery Island
  '/git-tree-room':     subIslandCrumbs('Git Tree',         'Delivery Island', '/island/delivery', '#22c55e'),
  '/kanban-island':     subIslandCrumbs('Kanban Island',    'Delivery Island', '/island/delivery', '#0ea5e9'),
  '/pr-mirror-hall':    subIslandCrumbs('PR Mirror Hall',   'Delivery Island', '/island/delivery', '#a78bfa'),

  // 🌌 Strategy Island
  '/okr-mountain':      subIslandCrumbs('OKR Mountain',     'Strategy Island', '/island/strategy', '#f3f4f6'),
  '/star-map-risks':    subIslandCrumbs('Star Map Risks',   'Strategy Island', '/island/strategy', '#ef4444'),
  '/telescope-island':  subIslandCrumbs('Telescope Island', 'Strategy Island', '/island/strategy', '#60a5fa'),

  // 🏛 Knowledge Island
  '/library-cathedral': subIslandCrumbs('Library Cathedral','Knowledge Island','/island/knowledge','#92400e'),
  '/alchemist-cellar':  subIslandCrumbs('Alchemist Cellar', 'Knowledge Island','/island/knowledge','#84cc16'),
  '/five-whys-well':    subIslandCrumbs('Five Whys Well',   'Knowledge Island','/island/knowledge','#0891b2'),

  // ⚗ Commerce Island
  '/card-tavern':       subIslandCrumbs('Card Tavern',      'Commerce Island', '/island/commerce', '#fbbf24'),
  '/oracle-aquarium':   subIslandCrumbs('Oracle Aquarium',  'Commerce Island', '/island/commerce', '#3b82f6'),
  '/mana-fountain':     subIslandCrumbs('Mana Fountain',    'Commerce Island', '/island/commerce', '#06b6d4'),

  // ═══ WORKSHOPS Scrum (cérémonies indépendantes) ═══
  '/lean-coffee':         workshopCrumbs('Lean Coffee',         '#6b4423'),
  '/definitions-beach':   workshopCrumbs('Definitions Beach',   '#fbbf24'),
  '/refinement-orchard':  workshopCrumbs('Refinement Orchard',  '#dc2626'),
  '/story-trail':         workshopCrumbs('Story Trail',         '#10b981'),
  '/premortem-crypt':     workshopCrumbs('Premortem Crypt',     '#6b7280'),
  '/retrospective-cove':  workshopCrumbs('Retrospective Cove',  '#a78bfa'),

  // ═══ 4 SOUS-ÎLES (hubs thématiques autour de Yamzy Island) ═══
  '/island/delivery':  subIslandHub('Delivery Island',  '#86efac'),
  '/island/strategy':  subIslandHub('Strategy Island',  '#c4b5fd'),
  '/island/knowledge': subIslandHub('Knowledge Island', '#06b6d4'),
  '/island/commerce':  subIslandHub('Commerce Island',  '#fbbf24'),

  // ═══ STUDIOS (outils de création / visualisation) ═══
  '/yamzy-studio-maker': studioCrumbs('Studio Maker',   '#fbbf24'),
  '/orrery-viewer':      studioCrumbs('Orrery Viewer',  '#fbbf24'),
  '/orrery-lab':         studioCrumbs('Orrery Lab',     '#a78bfa'),
};

/** Crumbs pour une room du Conclave (sur Yamzy Island) : World > Yamzy Island > {Room} */
function conclaveCrumbs(label: string, accent: string): Omit<SpellNavSnap, 'showHeader'> {
  return {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label: 'Yamzy Island', route: '/yamzy-island' },
      { label },
    ],
    backTo: '/yamzy-island',
    showQuit: true,
    accent,
  };
}

/** Crumbs pour une room rattachée à une sous-île : World > {Sub-Island} > {Room} */
function subIslandCrumbs(label: string, parentLabel: string, parentRoute: string, accent: string): Omit<SpellNavSnap, 'showHeader'> {
  return {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label: parentLabel, route: parentRoute },
      { label },
    ],
    backTo: parentRoute,
    showQuit: true,
    accent,
  };
}

/** Crumbs pour une sous-île (hub thématique) : World > {Sub-Island} */
function subIslandHub(label: string, accent: string): Omit<SpellNavSnap, 'showHeader'> {
  return {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label },
    ],
    backTo: '/chez-yamzy',
    showQuit: true,
    accent,
  };
}

/** Crumbs pour un workshop Scrum indépendant : World > Workshops > {Workshop} */
function workshopCrumbs(label: string, accent: string): Omit<SpellNavSnap, 'showHeader'> {
  return {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label: 'Workshops', route: '/yamzy-rooms' },
      { label },
    ],
    backTo: '/yamzy-rooms',
    showQuit: true,
    accent,
  };
}

/** Crumbs pour un studio (outil de création) : World > Studios > {Studio} */
function studioCrumbs(label: string, accent: string): Omit<SpellNavSnap, 'showHeader'> {
  return {
    crumbs: [
      { label: 'Yamzy World', route: '/chez-yamzy' },
      { label: 'Studios', route: '/yamzy-rooms' },
      { label },
    ],
    backTo: '/yamzy-rooms',
    showQuit: true,
    accent,
  };
}

/** Routes où le SpellHeader doit rester caché (showcase fullscreen, login…) */
const HIDDEN_ROUTES = new Set<string>([
  // showcase a son propre header role-selector — keep
  // login geré à part
]);

@Injectable({ providedIn: 'root' })
export class SpellNavService {
  private router = inject(Router);
  currentUrl = signal<string>('/');

  snap = computed<SpellNavSnap>(() => {
    const url = this.currentUrl();
    const base = url.split('?')[0];
    if (HIDDEN_ROUTES.has(base)) {
      return { crumbs: [], backTo: null, showHeader: false, showQuit: false, accent: '#d54adf' };
    }
    const cfg = NAV_MAP[base];
    if (!cfg) {
      // Route inconnue → header générique avec juste "Yamzy World"
      return {
        crumbs: [{ label: 'Yamzy World', route: '/chez-yamzy', icon: '🪄' }],
        backTo: '/chez-yamzy',
        showHeader: true,
        showQuit: true,
        accent: '#d54adf',
      };
    }
    return { ...cfg, showHeader: true };
  });

  constructor() {
    this.currentUrl.set(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.currentUrl.set(e.urlAfterRedirects));
  }
}
