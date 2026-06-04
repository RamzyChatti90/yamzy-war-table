// ═══════════════════════════════════════════════════════════════════
// 🏝 YAMZY ROOMS GALLERY — La Vitrine des Scènes
//
// Page d'accueil : cards pour chaque room + island + studio maker.
// Design IDENTIQUE au YAMZY STUDIO MAKER (même topbar, mêmes couleurs).
// Chaque card a un bouton "Go to" qui navigue comme si on cliquait
// sur le bâtiment depuis l'île.
// ═══════════════════════════════════════════════════════════════════
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SpellButtonComponent, SpellChoicesComponent, SpellChoice } from '../../core/spell-ui';

type GalleryFilter = 'all' | 'hub' | 'studio' | 'room' | 'workshop';

interface SceneCard {
  key: string;
  route: string;
  icon: string;
  name: string;
  loreName: string;
  color: string;
  description: string;
  category: 'hub' | 'studio' | 'room' | 'workshop';
  status?: 'ready' | 'beta' | 'planned';
}

@Component({
  selector: 'wt-yamzy-rooms-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink, SpellButtonComponent, SpellChoicesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="yrg-host">
      <!-- ═══ TOPBAR identique Studio Maker ═══ -->
      <header class="yrg-topbar">
        <div class="yrg-brand">
          <span class="yrg-brand-icon">🏝</span>
          <span class="yrg-brand-text">YAMZY WORLD</span>
        </div>
        <nav class="yrg-nav">
          <wt-spell-choices
            [choices]="filterChoices"
            [selected]="filter()"
            accent="#d54adf"
            (selectedChange)="setFilter($event)" />
        </nav>
        <div class="yrg-actions">
          <wt-spell-btn variant="primary" size="sm" accent="#c084fc"
                        routerLink="/showcase/yamzy-world"
                        icon="🎓"
                        title="Visite guidée animée — Yamzy raconte le projet">Guide animé</wt-spell-btn>
          <wt-spell-btn variant="secondary" size="sm" accent="#d54adf"
                        routerLink="/yamzy-island"
                        icon="🏝"
                        title="Vue île 3D">Vue île</wt-spell-btn>
          <wt-spell-btn variant="primary" size="sm" accent="#fbbf24"
                        routerLink="/yamzy-studio-maker"
                        icon="🏗"
                        title="Studio Maker">Studio Maker</wt-spell-btn>
        </div>
      </header>

      <!-- ═══ MAIN — Hero + Grid de cards ═══ -->
      <main class="yrg-main">
        <section class="yrg-hero">
          <h1 class="yrg-hero-title">Le Conclave des 13 Rooms</h1>
          <p class="yrg-hero-subtitle">
            Choisis ta destination — chaque scène est une mécanique 3D unique de manipulation de la data.
          </p>
        </section>

        <section class="yrg-grid">
          @for (card of filtered(); track card.key) {
            <article class="yrg-card" [style.--accent]="card.color" [attr.data-cat]="card.category">
              <div class="yrg-card-bar"></div>
              <div class="yrg-card-icon-wrap">
                <div class="yrg-card-icon-halo"></div>
                <span class="yrg-card-icon">{{ card.icon }}</span>
              </div>
              <div class="yrg-card-name">{{ card.name }}</div>
              <div class="yrg-card-lore">{{ card.loreName }}</div>
              <div class="yrg-card-desc">{{ card.description }}</div>
              <div class="yrg-card-meta">
                <span class="yrg-card-cat">{{ catLabel(card.category) }}</span>
                @if (card.status === 'beta') { <span class="yrg-card-beta">BETA</span> }
              </div>
              <button class="yrg-card-cta" (click)="goTo(card)">
                Go to → <span class="yrg-card-cta-arrow">↗</span>
              </button>
            </article>
          }
        </section>
      </main>

      <!-- ═══ FOOTER ═══ -->
      <footer class="yrg-footer">
        <span>{{ filtered().length }} / {{ cards.length }} scènes</span>
        <span class="yrg-spacer"></span>
        <span class="yrg-tip">💡 Astuce : tu peux aussi explorer l'île en 3D depuis 🏝 Vue île</span>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; min-height: 100vh; }

    /* Variables = Studio Maker palette */
    .yrg-host { display: flex; flex-direction: column; min-height: 100vh; background: #0a0e1c; color: #e8eaf6; font-family: system-ui, sans-serif; font-size: 13px; }

    /* ═══ TOPBAR (identique Studio Maker) ═══ */
    .yrg-topbar { display: flex; align-items: center; gap: 14px; padding: 10px 22px; background: linear-gradient(90deg, #131830 0%, #1a1f3a 100%); border-bottom: 1px solid #2a3055; flex: 0 0 auto; min-height: 56px; flex-wrap: wrap; }
    .yrg-brand { display: flex; align-items: center; gap: 10px; }
    .yrg-brand-icon { font-size: 28px; filter: drop-shadow(0 0 8px rgba(251,191,36,0.4)); }
    .yrg-brand-text { font-weight: 800; letter-spacing: 2px; color: #fbbf24; font-size: 16px; }
    .yrg-nav { display: flex; gap: 4px; margin-left: 12px; }
    .yrg-nav button { background: rgba(20,25,50,0.7); color: #e8eaf6; border: 1px solid #3b3f55; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; }
    .yrg-nav button:hover { background: rgba(60,80,150,0.5); }
    .yrg-nav button.active { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .yrg-actions { display: flex; gap: 6px; margin-left: auto; }
    .yrg-quick { background: rgba(40,30,5,0.7); color: #fbbf24; border: 1px solid #b89240; padding: 6px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; }
    .yrg-quick:hover { background: rgba(251,191,36,0.3); }
    .yrg-quick-primary { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .yrg-quick-primary:hover { background: #f5b923; }
    .yrg-quick-guide {
      background: linear-gradient(135deg, rgba(168,85,247,0.4) 0%, rgba(96,165,250,0.4) 100%);
      color: #e9d5ff;
      border-color: #c084fc;
      font-weight: 700;
      box-shadow: 0 0 12px rgba(192,132,252,0.35);
      position: relative;
      overflow: hidden;
    }
    .yrg-quick-guide::after {
      content: '✨';
      position: absolute;
      right: 6px;
      top: 3px;
      font-size: 8px;
      opacity: 0.7;
      animation: yrg-sparkle 2s ease-in-out infinite;
    }
    @keyframes yrg-sparkle {
      0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
      50% { transform: scale(1.4) rotate(180deg); opacity: 1; }
    }
    .yrg-quick-guide:hover {
      background: linear-gradient(135deg, rgba(168,85,247,0.6) 0%, rgba(96,165,250,0.6) 100%);
      box-shadow: 0 0 18px rgba(192,132,252,0.6), 0 2px 8px rgba(0,0,0,0.4);
    }

    /* ═══ MAIN ═══ */
    .yrg-main { flex: 1; padding: 28px 32px 60px; max-width: 1400px; width: 100%; margin: 0 auto; }

    .yrg-hero { text-align: center; margin-bottom: 32px; }
    .yrg-hero-title { font-size: 38px; font-weight: 800; letter-spacing: 1.5px; color: #fbbf24; margin: 0 0 8px; text-shadow: 0 0 24px rgba(251,191,36,0.3); }
    .yrg-hero-subtitle { font-size: 14px; color: #cbd5e1; opacity: 0.85; max-width: 700px; margin: 0 auto; line-height: 1.6; }

    /* ═══ GRID Cards ═══ */
    .yrg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }

    .yrg-card {
      position: relative;
      background: linear-gradient(135deg, rgba(20,25,50,0.7) 0%, rgba(30,35,65,0.7) 100%);
      border: 1px solid #2a3055;
      border-radius: 16px;
      padding: 22px 18px 18px;
      display: flex; flex-direction: column; gap: 6px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(6px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .yrg-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent, #fbbf24);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--accent, #fbbf24);
    }
    .yrg-card-bar {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: var(--accent, #fbbf24);
      border-radius: 16px 16px 0 0;
      box-shadow: 0 0 16px var(--accent, #fbbf24);
    }
    .yrg-card-icon-wrap { position: relative; width: 80px; height: 80px; margin: 8px auto 10px; display: flex; align-items: center; justify-content: center; }
    .yrg-card-icon-halo {
      position: absolute; inset: 0; border-radius: 50%;
      background: radial-gradient(circle, var(--accent, #fbbf24) 0%, transparent 70%);
      opacity: 0.25;
      filter: blur(8px);
    }
    .yrg-card-icon { position: relative; font-size: 56px; line-height: 1; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4)); }
    .yrg-card-name { font-size: 16px; font-weight: 800; letter-spacing: 1px; color: var(--accent, #fbbf24); text-align: center; }
    .yrg-card-lore { font-size: 11px; color: #cbd5e1; opacity: 0.75; text-align: center; font-style: italic; }
    .yrg-card-desc { font-size: 12px; color: #cbd5e1; opacity: 0.85; line-height: 1.5; text-align: center; margin: 8px 0 6px; min-height: 36px; }
    .yrg-card-meta { display: flex; justify-content: center; gap: 6px; margin-bottom: 12px; }
    .yrg-card-cat { font-size: 9px; padding: 2px 8px; background: rgba(0,0,0,0.4); border: 1px solid #3a4070; border-radius: 4px; color: #93c5fd; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }
    .yrg-card-beta { font-size: 9px; padding: 2px 8px; background: rgba(160,80,20,0.4); border: 1px solid #ea580c; border-radius: 4px; color: #fdba74; letter-spacing: 1px; font-weight: 700; }
    .yrg-card-cta {
      background: var(--accent, #fbbf24);
      color: #1a1500;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
      font-family: inherit;
    }
    .yrg-card-cta:hover {
      filter: brightness(1.1);
      box-shadow: 0 4px 16px var(--accent, #fbbf24);
      transform: translateY(-1px);
    }
    .yrg-card-cta-arrow { font-size: 14px; transition: transform 0.2s; }
    .yrg-card:hover .yrg-card-cta-arrow { transform: translate(2px, -2px); }

    /* ═══ FOOTER ═══ */
    .yrg-footer { display: flex; align-items: center; padding: 10px 24px; background: #0a0e1c; border-top: 1px solid #1f2540; font-size: 11px; opacity: 0.7; flex: 0 0 auto; height: 36px; }
    .yrg-spacer { flex: 1; }
    .yrg-tip { color: #93c5fd; }

    /* ═══ Variations par catégorie ═══ */
    .yrg-card[data-cat="hub"] { background: linear-gradient(135deg, rgba(40,40,70,0.85) 0%, rgba(40,30,5,0.4) 100%); }
    .yrg-card[data-cat="studio"] { background: linear-gradient(135deg, rgba(20,40,80,0.7) 0%, rgba(30,50,90,0.7) 100%); }
  `]
})
export class YamzyRoomsGalleryComponent {
  private router = inject(Router);
  filter = signal<GalleryFilter>('all');
  setFilter(v: GalleryFilter) { this.filter.set(v); }

  filterChoices: SpellChoice<GalleryFilter>[] = [
    { value: 'all',      label: 'Tout' },
    { value: 'hub',      label: 'Hubs',      icon: '🏝' },
    { value: 'studio',   label: 'Studios',   icon: '🏗' },
    { value: 'room',     label: 'Rooms',     icon: '🚪' },
    { value: 'workshop', label: 'Workshops', icon: '💧' },
  ];

  cards: SceneCard[] = [
    // Hubs
    { key: 'island',         route: '/yamzy-island',       icon: '🏝', name: 'YAMZY ISLAND',      loreName: 'Le Conclave',                       color: '#fbbf24', description: 'Vue isométrique 3D de l\'île avec les 11 rooms cliquables. Mode play / mode edit avec gizmo Blender.', category: 'hub', status: 'ready' },
    { key: 'studio-maker',   route: '/yamzy-studio-maker', icon: '🏗', name: 'STUDIO MAKER',      loreName: 'L\'Atelier Universel',              color: '#86efac', description: 'Éditeur 3D pour créer des rooms : librairie templates + inspector + GLB import/export + tutorial form-builder.', category: 'studio', status: 'beta' },
    // Island Hubs — 4 îles thématiques avec portails
    { key: 'island-delivery',  route: '/island/delivery',  icon: '🌿', name: 'ÎLE LIVRAISON',     loreName: 'L\'Archipel des Œuvres',            color: '#86efac', description: 'Hub des 4 rooms du flux de livraison : Git Tree, PR Mirror, Kanban, Phoenix Forge. 3 portails vers les autres îles.', category: 'hub', status: 'ready' },
    { key: 'island-strategy',  route: '/island/strategy',  icon: '🌌', name: 'ÎLE STRATÉGIE',     loreName: 'Le Royaume Stellaire',              color: '#a855f7', description: 'Hub des 3 rooms de la stratégie : OKR Mountain, Star Map Risks, Telescope Island. 3 portails magiques.', category: 'hub', status: 'ready' },
    { key: 'island-knowledge', route: '/island/knowledge', icon: '🏛', name: 'ÎLE SAVOIR',        loreName: 'Le Sanctuaire des Voix',            color: '#06b6d4', description: 'Hub des 2 rooms du savoir : Library Cathedral + Oracle Aquarium. Étang + bibliothèque + 3 portails.', category: 'hub', status: 'ready' },
    { key: 'island-commerce',  route: '/island/commerce',  icon: '⚗', name: 'ÎLE COMMERCE',      loreName: 'La Côte d\'Ambre',                  color: '#fbbf24', description: 'Hub des 2 rooms du commerce : Alchemist Cellar + Card Tavern. Tonneaux d\'or + 3 portails.', category: 'hub', status: 'ready' },
    // Rooms — alignées sur le Hub Island
    { key: 'conclave',          route: '/conclave',            icon: '💎', name: 'CONCLAVE VESPER',   loreName: 'Le studio du stratège',             color: '#d99a51', description: 'Orrery 3D où chaque ticket orbite. 42 pages Scrum, cérémonies par alignement géométrique.', category: 'room', status: 'ready' },
    { key: 'orrery-viewer',     route: '/orrery-viewer',       icon: '🔭', name: 'ORRERY VIEWER',     loreName: 'Le Planétarium des Sprints',        color: '#a3b8d0', description: 'Vue standalone fullscreen du Cosmos × Crystal avec sliders + timeline 60s + demo project.', category: 'room', status: 'ready' },
    { key: 'git-tree',          route: '/git-tree-room',       icon: '🌳', name: 'GIT TREE',          loreName: 'L\'Arbre des Lignées',              color: '#15803d', description: 'Chêne 3D où chaque branche git est une vraie branche, feuilles=commits, fruits=releases.', category: 'room', status: 'ready' },
    { key: 'kanban-island',     route: '/kanban-island',       icon: '🏝', name: 'KANBAN ISLAND',     loreName: 'L\'Archipel des Quêtes',            color: '#7dd3fc', description: 'Île 3D où les tickets voyagent de la plage au sommet. Marée=deadline, volcan=release.', category: 'room', status: 'ready' },
    { key: 'pr-mirror-hall',    route: '/pr-mirror-hall',      icon: '🪞', name: 'PR MIRROR HALL',    loreName: 'La Galerie des Vérités',            color: '#a3e9ff', description: 'Hall circulaire avec 8 miroirs PR + statues reviewers + tapis rouge mergeable.', category: 'room', status: 'ready' },
    { key: 'phoenix-forge',     route: '/phoenix-forge',       icon: '🔥', name: 'PHOENIX FORGE',     loreName: 'L\'Atelier des Renaissances',       color: '#ea580c', description: 'Athanor + phénix vivant + 600 flame particles. Releases = œufs qui éclosent.', category: 'room', status: 'ready' },
    { key: 'okr-mountain',      route: '/okr-mountain',        icon: '⛰', name: 'OKR MOUNTAIN',      loreName: 'L\'Ascension du Sommet',            color: '#a855f7', description: 'Montagne 3D avec sentier spiral + cordée + 4 météos. Sommet = objective trimestriel.', category: 'room', status: 'ready' },
    { key: 'library-cathedral', route: '/library-cathedral',   icon: '🏛', name: 'LIBRARY CATHEDRAL', loreName: 'La Bibliothèque du Conclave',       color: '#0891b2', description: '50 livres procéduraux + vitraux + aigle messager + sphère de recherche luminueuse.', category: 'room', status: 'ready' },
    { key: 'star-map-risks',    route: '/star-map-risks',      icon: '🌌', name: 'STAR MAP RISKS',    loreName: 'La Carte Céleste des Périls',       color: '#8b1a1a', description: 'Planétarium 3D + constellations=risques + comètes + éclipses + supernovas.', category: 'room', status: 'ready' },
    { key: 'oracle-aquarium',   route: '/oracle-aquarium',     icon: '🐠', name: 'ORACLE AQUARIUM',   loreName: 'L\'Étang des Voix',                 color: '#a855f7', description: '30 poissons-interviews + 3 méduses pain points + trésor persona + aigle pêcheur.', category: 'room', status: 'ready' },
    { key: 'alchemist-cellar',  route: '/alchemist-cellar',    icon: '⚗', name: 'ALCHEMIST CELLAR',  loreName: 'La Cave aux Fioles',                color: '#84cc16', description: '18 fioles colorées + athanor central + cristaux distillés + hibou alerte budget.', category: 'room', status: 'ready' },
    { key: 'card-tavern',       route: '/card-tavern',         icon: '🎴', name: 'CARD TAVERN',       loreName: 'La Taverne aux Cartes',             color: '#fbbf24', description: 'Taverne médiévale + cartes prospects + aubergiste NPC + carte aux trésors murale.', category: 'room', status: 'ready' },
    { key: 'telescope-island',  route: '/telescope-island',    icon: '🔭', name: 'TELESCOPE ISLAND',  loreName: 'L\'Observatoire des Phénomènes',    color: '#c4b5fd', description: 'Île + observatoire + télescope pivotable. Le ciel reflète TOUS les événements projet : comète, éclipse, aurora, supernova, nébula...', category: 'room', status: 'ready' },
    // ─── 💧 Workshops Scrum ───
    { key: 'mana-fountain',     route: '/mana-fountain',       icon: '💧', name: 'MANA FOUNTAIN',     loreName: 'La Source qui mesure la magie',     color: '#d54adf', description: 'Sensibilisation IA / Eau / $ : chaque sort consomme tokens + mL d\'eau + dollars. Jauge live, budget mensuel, équivalences.', category: 'workshop', status: 'ready' },
    { key: 'retro-cove',        route: '/retrospective-cove',  icon: '⛵', name: 'RETRO SAILBOAT',    loreName: 'Le Cercle du Rétroviseur',          color: '#67e8f9', description: 'Sprint retrospective format Sailboat : vent (Glad), ancres (Sad), récifs (Mad), île objectif.', category: 'workshop', status: 'ready' },
    { key: 'premortem-crypt',   route: '/premortem-crypt',     icon: '⚰', name: 'PRE-MORTEM CRYPT',  loreName: 'Le Caveau des Pré-Mortems',         color: '#831843', description: 'Imaginer les scénarios d\'échec : sarcophages = causes de mort, bougies = vote impact, runes = contre-mesures.', category: 'workshop', status: 'ready' },
    { key: 'story-trail',       route: '/story-trail',         icon: '🏔', name: 'STORY MAPPING',     loreName: 'La Carte des Sentiers',             color: '#f59e0b', description: 'Story Mapping Jeff Patton : sentiers user journey + pierres user stories + ligne de release MVP.', category: 'workshop', status: 'ready' },
    { key: 'lean-coffee',       route: '/lean-coffee',         icon: '☕', name: 'LEAN COFFEE',       loreName: 'La Brûlerie Lean',                  color: '#6b4423', description: 'Agenda démocratique : tasses-sujets qui se déplacent To Discuss → Discussing → Discussed → Action.', category: 'workshop', status: 'ready' },
    { key: 'refinement-orchard',route: '/refinement-orchard',  icon: '🍇', name: 'REFINEMENT ORCHARD',loreName: 'Le Verger des Affinages',           color: '#84cc16', description: 'Backlog grooming : fruits = tickets, mûrissent quand DoR OK. Cueillir, scinder, estimer.', category: 'workshop', status: 'ready' },
    { key: 'five-whys-well',    route: '/five-whys-well',      icon: '🪨', name: 'FIVE WHYS WELL',    loreName: 'Le Puits des Cinq Pourquoi',        color: '#475569', description: 'Root cause analysis : descendre 5 niveaux pour atteindre la racine. Toyota method.', category: 'workshop', status: 'ready' },
    { key: 'definitions-beach', route: '/definitions-beach',   icon: '🏖', name: 'DEFINITIONS BEACH', loreName: 'La Plage des Définitions',          color: '#fde68a', description: 'DoR / DoD : drapeaux Ready/Done plantés dans le sable, liens entre eux, export markdown.', category: 'workshop', status: 'ready' },
    // Bonus
    { key: 'orrery-lab',     route: '/orrery-lab',     icon: '🧪', name: 'ORRERY LAB',     loreName: 'Le Laboratoire des Mécaniques',  color: '#60a5fa', description: 'Scène 3D pure (no GLB) pour valider les mécaniques avant de les porter à la prod.', category: 'studio', status: 'beta' },
  ];

  // Computed via signal — re-runs quand filter() change
  filtered = computed(() => {
    const f = this.filter();
    if (f === 'all') return this.cards;
    return this.cards.filter(c => c.category === f);
  });

  catLabel(c: string): string {
    switch (c) {
      case 'hub': return '🏝 HUB';
      case 'studio': return '🏗 STUDIO';
      case 'room': return '🚪 ROOM';
      case 'workshop': return '💧 WORKSHOP';
      default: return c;
    }
  }

  goTo(card: SceneCard) {
    this.router.navigate([card.route]);
  }
}
