// ═══════════════════════════════════════════════════════════════════
// 🏝 YAMZY ISLAND HUB — La Carte de l'Île
//
// Vue 3D isométrique de toutes les rooms. Hover = preview, click = enter.
// 2 modes :
//   ▶ PLAY  — naviguer en cliquant les bâtiments (router.navigate)
//   ✏ EDIT — TransformControls (Blender-way) pour déplacer chaque bâtiment
//            + persistance des positions en localStorage
//
// Chaque room = un bâtiment 3D iconique sur l'île :
//   💎 Conclave VESPER     → Crystal qui tourne (orrery)
//   🌳 Git Tree            → Arbre stylisé
//   🏝 Kanban Island       → Mini-île dans l'île
//   🪞 PR Mirror Hall      → Pavillon octogonal
//   🔥 Phoenix Forge       → Forge avec flamme
//   ⛰ OKR Mountain         → Petite montagne
//   🏛 Library Cathedral   → Cathédrale gothique
//   🌌 Star Map Risks      → Observatoire dôme
//   🐠 Oracle Aquarium     → Aquarium géant
//   ⚗ Alchemist Cellar     → Tour d'alchimie
//   🎴 Card Tavern         → Taverne médiévale
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, effect, ElementRef, OnDestroy, OnInit,
  ViewChild, signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SpellButtonComponent, SpellTutorialOverlayComponent, SpellDayFlowComponent, TutorialStep, SpellFooterService } from '../../core/spell-ui';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { playIslandIntro } from '../../core/island-intro/island-intro';

interface RoomBuilding {
  key: string;
  route: string;
  icon: string;
  name: string;
  loreName: string;
  color: string;
  defaultPos: [number, number, number];
  group?: any;        // THREE.Group
  hover?: boolean;
}

@Component({
  selector: 'wt-yamzy-island-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, SpellButtonComponent, SpellTutorialOverlayComponent, SpellDayFlowComponent, RoomSplashComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hub-host">
      <header class="hub-topbar">
        <div class="hub-mode">
          <!-- DEMO (just le nom, pattern EXIT-style avec animations) -->
          <button class="hub-text-btn hub-day-btn" (click)="openDayDemo()"
                  title="Lancer la démo d'une journée Scrum complète" aria-label="Demo">
            <span class="hub-text-label">DEMO</span>
          </button>

          <!-- PLAY -->
          <button class="hub-text-btn hub-play-btn" [class.active]="mode() === 'play'"
                  (click)="setMode('play')" title="Mode exploration (Play)" aria-label="Play">
            <span class="hub-text-label">PLAY</span>
          </button>

          <!-- EDIT -->
          <button class="hub-text-btn hub-edit-btn" [class.active]="mode() === 'edit'"
                  (click)="setMode('edit')" title="Mode édition (Blender-way G/R/S)" aria-label="Edit">
            <span class="hub-text-label">EDIT</span>
          </button>

          <!-- SAVE -->
          <button *ngIf="mode() === 'edit'" class="hub-text-btn hub-mode-save"
                  (click)="saveLayout()" title="Sauvegarder le layout" aria-label="Save">
            <span class="hub-text-label">SAVE</span>
          </button>

          <!-- RESET -->
          <button *ngIf="mode() === 'edit'" class="hub-text-btn hub-mode-reset"
                  (click)="resetLayout()" title="Réinitialiser le layout" aria-label="Reset">
            <span class="hub-text-label">RESET</span>
          </button>
        </div>
      </header>

      <canvas #canvas class="hub-canvas"></canvas>

      <!-- Sidebar de tous les rooms (cliquable directement) -->
      <aside class="hub-sidebar">
        <div class="hub-sidebar-title">🏝 ROOMS</div>
        <button *ngFor="let r of rooms" class="hub-room-card"
                [style.border-color]="r.color"
                (click)="enterRoom(r)"
                (mouseenter)="highlightRoom(r)"
                (mouseleave)="unhighlightRoom(r)">
          <span class="hub-room-icon">{{ r.icon }}</span>
          <div class="hub-room-text">
            <div class="hub-room-name" [style.color]="r.color">{{ r.name }}</div>
            <div class="hub-room-lore">{{ r.loreName }}</div>
          </div>
          <span class="hub-room-arrow">→</span>
        </button>
      </aside>

      <!-- Tooltip flottant au hover d'un bâtiment 3D -->
      <div *ngIf="hoveredRoom() as h" class="hub-tooltip" [style.left.px]="mouseX()" [style.top.px]="mouseY() - 60">
        <div class="hub-tt-icon">{{ h.icon }}</div>
        <div class="hub-tt-name" [style.color]="h.color">{{ h.name }}</div>
        <div class="hub-tt-lore">{{ h.loreName }}</div>
        <div class="hub-tt-cta">{{ mode() === 'play' ? 'Cliquer pour entrer →' : 'Drag pour déplacer' }}</div>
      </div>

      <!-- Edit mode HUD -->
      <div *ngIf="mode() === 'edit' && editTarget()" class="hub-edit-panel">
        <div class="hub-edit-title">✏ Édition — {{ editTarget()?.name }}</div>
        <div class="hub-edit-keys">G = translate · R = rotate · S = scale · Échap = désélectionner</div>
      </div>

      <!-- 🎬 Splash welcome overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Yamzy Island"
        loreName="Le Cœur du Royaume"
        color="#d54adf"
        oneLiner="Le hub central — passerelle vers les 11 rooms du Conclave. Choisis ta destination."
        [duration]="45"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🌅 DAY FLOW : timeline d'une journée Scrum à travers les rooms -->
      <wt-spell-day-flow
        [open]="dayDemoOpen()"
        accent="#d54adf"
        (close)="dayDemoOpen.set(false)" />

      <!-- 🎓 Tutorial overlay welcome-style -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Yamzy Island"
        loreName="Le Cœur du Royaume"
        accent="#d54adf"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (cameraViewChange)="onCameraView($event)"
        (animCueChange)="onAnimCue($event)"
        (close)="closeTutorial()" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .hub-host { position: relative; width: 100%; height: 100vh; background: radial-gradient(circle at 50% 35%, #1a2348 0%, #060818 70%); color: #e8eaf6; font-family: system-ui, sans-serif; }

    /* Topbar = juste le titre, sous la ligne SpellHeader */
    .hub-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: transparent; pointer-events: none; }
    .hub-topbar > * { pointer-events: auto; }

    /* 🪄 hub-mode RELOCALISÉE dans la ligne SpellHeader (top:0-60px) — à gauche des Glossaire/Retour/Quitter */
    .hub-mode {
      position: fixed !important;
      top: 12px !important;
      right: 500px !important;
      left: auto !important;
      z-index: 10501;
      pointer-events: auto;
    }
    .hub-back { color: #fbbf24; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #b89240; border-radius: 8px; background: rgba(40,30,5,0.5); }
    .hub-title h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 1px; color: #fbbf24; }
    .hub-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.7; }
    .hub-mode { display: flex; gap: 14px; align-items: center; }

    /* ━━━ TEXT button pattern (cohérent avec EXIT — juste le nom du bouton)
       Pas de box, pas d'icône, texte stylé + animations idle blink + hover pulse ━━━ */
    .hub-text-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 56px;
      height: 44px;
      padding: 0 6px;
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      transition: color 0.25s ease, transform 0.25s ease, filter 0.25s ease;
      overflow: visible;
      font-family: inherit;
    }
    .hub-text-label {
      font-family: "Tinos", "Trebuchet MS", serif;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 0.15em;
      color: inherit;
      text-shadow: 0 0 4px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.7);
      transition: text-shadow 0.25s ease, letter-spacing 0.25s ease, transform 0.25s ease;
      pointer-events: none;
      white-space: nowrap;
      line-height: 1;
      /* Idle blink — comme l'EXIT, 88% on / 5% off */
      animation: hubTextBlink 4s ease-in-out infinite;
    }
    @keyframes hubTextBlink {
      0%, 88%, 100% {
        opacity: 1;
        text-shadow: 0 0 4px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.7);
      }
      90%, 94% {
        opacity: 0.35;
        text-shadow: 0 0 1px rgba(255,255,255,0.2);
      }
      92% {
        opacity: 1;
        text-shadow: 0 0 6px rgba(255,255,255,0.7);
      }
    }
    /* Hover : pulse + glow (couleur définie par variante) */
    .hub-text-btn:hover .hub-text-label {
      animation: hubTextPulse 0.7s ease-in-out infinite alternate;
    }
    @keyframes hubTextPulse {
      from { letter-spacing: 0.15em; transform: scale(1); }
      to   { letter-spacing: 0.20em; transform: scale(1.06); }
    }
    .hub-text-btn:active { transform: scale(0.94); }

    /* État actif (PLAY/EDIT sélectionné) — couleur permanente + glow */
    .hub-text-btn.active {
      color: #d54adf;
    }
    .hub-text-btn.active .hub-text-label {
      text-shadow:
        0 0 6px rgba(213, 74, 223, 1),
        0 0 12px rgba(213, 74, 223, 0.6),
        0 1px 2px rgba(0,0,0,0.7);
      animation: hubTextActiveGlow 2s ease-in-out infinite alternate;
    }
    @keyframes hubTextActiveGlow {
      from { text-shadow: 0 0 6px rgba(213, 74, 223, 1), 0 0 12px rgba(213, 74, 223, 0.5), 0 1px 2px rgba(0,0,0,0.7); }
      to   { text-shadow: 0 0 10px rgba(213, 74, 223, 1), 0 0 20px rgba(213, 74, 223, 0.8), 0 1px 2px rgba(0,0,0,0.7); }
    }

    /* ─── Variantes colorées au hover par fonction ─── */
    /* DEMO : doré-orange (chaud comme le lever de soleil) */
    .hub-day-btn:hover { color: #fbbf24; }
    .hub-day-btn:hover .hub-text-label {
      text-shadow:
        0 0 6px rgba(251, 191, 36, 1),
        0 0 14px rgba(251, 191, 36, 0.7),
        0 1px 2px rgba(0,0,0,0.7);
    }
    /* PLAY/EDIT hover : magenta crystal */
    .hub-play-btn:hover,
    .hub-edit-btn:hover { color: #d54adf; }
    .hub-play-btn:hover .hub-text-label,
    .hub-edit-btn:hover .hub-text-label {
      text-shadow:
        0 0 6px rgba(213, 74, 223, 1),
        0 0 14px rgba(213, 74, 223, 0.7),
        0 1px 2px rgba(0,0,0,0.7);
    }
    /* SAVE : vert validation */
    .hub-mode-save:hover { color: #22c55e; }
    .hub-mode-save:hover .hub-text-label {
      text-shadow:
        0 0 6px rgba(34, 197, 94, 1),
        0 0 14px rgba(34, 197, 94, 0.7),
        0 1px 2px rgba(0,0,0,0.7);
    }
    /* RESET : rouge danger */
    .hub-mode-reset:hover { color: #ec5e4e; }
    .hub-mode-reset:hover .hub-text-label {
      text-shadow:
        0 0 6px rgba(236, 94, 78, 1),
        0 0 14px rgba(236, 94, 78, 0.7),
        0 1px 2px rgba(0,0,0,0.7);
    }

    .hub-canvas { display: block; width: 100%; height: 100%; }

    .hub-sidebar { position: absolute; top: 80px; right: 22px; width: 280px; max-height: calc(100vh - 180px); overflow-y: auto; background: rgba(15,20,40,0.85); border: 1px solid #3b3f55; border-radius: 14px; backdrop-filter: blur(12px); padding: 14px; z-index: 8; }
    .hub-sidebar-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #fbbf24; margin-bottom: 10px; }
    .hub-room-card { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; background: rgba(30,35,55,0.7); border: 1px solid; border-radius: 10px; margin-bottom: 6px; cursor: pointer; transition: all 0.15s ease; text-align: left; color: inherit; font-family: inherit; }
    .hub-room-card:hover { background: rgba(60,80,150,0.4); transform: translateX(-3px); }
    .hub-room-icon { font-size: 24px; }
    .hub-room-text { flex: 1; }
    .hub-room-name { font-size: 13px; font-weight: 700; }
    .hub-room-lore { font-size: 10px; opacity: 0.7; }
    .hub-room-arrow { opacity: 0.6; font-size: 14px; }

    .hub-tooltip { position: absolute; z-index: 30; background: rgba(15,20,40,0.95); border: 1px solid #fbbf24; border-radius: 10px; padding: 10px 14px; pointer-events: none; backdrop-filter: blur(8px); }
    .hub-tt-icon { font-size: 28px; text-align: center; }
    .hub-tt-name { font-size: 14px; font-weight: 700; margin-top: 4px; }
    .hub-tt-lore { font-size: 11px; opacity: 0.8; }
    .hub-tt-cta { font-size: 10px; color: #fbbf24; margin-top: 6px; font-weight: 600; }

    .hub-edit-panel { position: absolute; left: 22px; top: 80px; padding: 12px 16px; background: rgba(20,80,40,0.85); border: 1px solid #15803d; border-radius: 10px; z-index: 9; backdrop-filter: blur(8px); }
    .hub-edit-title { font-size: 13px; font-weight: 700; color: #86efac; }
    .hub-edit-keys { font-size: 11px; opacity: 0.8; margin-top: 4px; font-family: monospace; }

  `]
})
export class YamzyIslandHubComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ═══════════════════════════════════════════════════════════════════
  // CONFIG des 11 rooms (incluant Conclave VESPER existant)
  // Positions par défaut sur l'île, en grille 4×3 légèrement randomisée
  // ═══════════════════════════════════════════════════════════════════
  rooms: RoomBuilding[] = [
    { key: 'conclave',          route: '/conclave',           icon: '💎', name: 'Conclave VESPER',   loreName: 'Le studio du stratège',          color: '#d99a51', defaultPos: [0, 0, 0] },
    { key: 'git-tree',          route: '/git-tree-room',      icon: '🌳', name: 'Git Tree',           loreName: "L'Arbre des Lignées",            color: '#15803d', defaultPos: [-8, 0, -6] },
    { key: 'kanban-island',     route: '/kanban-island',      icon: '🏝', name: 'Kanban Island',      loreName: "L'Archipel des Quêtes",          color: '#7dd3fc', defaultPos: [8, 0, -6] },
    { key: 'pr-mirror-hall',    route: '/pr-mirror-hall',     icon: '🪞', name: 'PR Mirror Hall',     loreName: 'La Galerie des Vérités',         color: '#a3e9ff', defaultPos: [-8, 0, 6] },
    { key: 'phoenix-forge',     route: '/phoenix-forge',      icon: '🔥', name: 'Phoenix Forge',      loreName: "L'Atelier des Renaissances",     color: '#ea580c', defaultPos: [8, 0, 6] },
    { key: 'okr-mountain',      route: '/okr-mountain',       icon: '⛰', name: 'OKR Mountain',       loreName: "L'Ascension du Sommet",          color: '#a855f7', defaultPos: [-14, 0, 0] },
    { key: 'library-cathedral', route: '/library-cathedral',  icon: '🏛', name: 'Library Cathedral',  loreName: 'La Bibliothèque du Conclave',    color: '#0891b2', defaultPos: [14, 0, 0] },
    { key: 'star-map-risks',    route: '/star-map-risks',     icon: '🌌', name: 'Star Map Risks',     loreName: 'La Carte Céleste des Périls',    color: '#8b1a1a', defaultPos: [-12, 0, -12] },
    { key: 'oracle-aquarium',   route: '/oracle-aquarium',    icon: '🐠', name: 'Oracle Aquarium',    loreName: "L'Étang des Voix",               color: '#a855f7', defaultPos: [12, 0, -12] },
    { key: 'alchemist-cellar',  route: '/alchemist-cellar',   icon: '⚗', name: 'Alchemist Cellar',   loreName: 'La Cave aux Fioles',             color: '#84cc16', defaultPos: [-12, 0, 12] },
    { key: 'card-tavern',       route: '/card-tavern',        icon: '🎴', name: 'Card Tavern',        loreName: 'La Taverne aux Cartes',          color: '#fbbf24', defaultPos: [12, 0, 12] },
    // 💧 Mana Fountain — la source qui rend visible la consommation IA
    { key: 'mana-fountain',     route: '/mana-fountain',      icon: '💧', name: 'Mana Fountain',      loreName: 'La Source qui mesure la magie',  color: '#d54adf', defaultPos: [0, 0, 18] },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // STATE signals
  // ═══════════════════════════════════════════════════════════════════
  mode = signal<'play' | 'edit'>('play');
  hoveredRoom = signal<RoomBuilding | null>(null);
  editTarget = signal<RoomBuilding | null>(null);
  mouseX = signal(0);
  mouseY = signal(0);
  axesVisible = signal(false);
  gridVisible = signal(true);

  // ─── Splash + Tutorial (welcome ADN) ───
  splashVisible = signal<boolean>(true);
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    {
      icon: '🏝', title: 'Bienvenue sur Yamzy Island',
      body: "Cette île 3D est le cœur du Conclave. Chaque bâtiment est une room du Royaume.",
      cite: "Yamzy le Conteur",
      cameraView: { position: [40, 32, 40], target: [0, 2, 0], durationMs: 1800 },
      animCue: 'pulse-all',                  // tous bâtiments pulsent doucement
    },
    {
      icon: '💎', title: 'Conclave VESPER au centre',
      body: "Le studio du stratège brille au centre — c'est ton port d'attache pour piloter tous les projets.",
      cameraView: { position: [10, 9, 12], target: [0, 4, 0], durationMs: 1500 },
      animCue: 'highlight-conclave',         // bâtiment central glow + crystal spin
    },
    {
      icon: '🌳', title: 'Onze bâtiments à explorer',
      body: "Git Tree, Kanban, Phoenix Forge, OKR Mountain, Library Cathedral, et bien d'autres. Chacun manipule la data autrement.",
      cameraView: { position: [28, 14, 0], target: [0, 3, 0], durationMs: 1500 },
      animCue: 'glow-ring',                  // couronne de bâtiments tour à tour
    },
    {
      icon: '🎮', title: 'Deux modes : PLAY et EDIT',
      body: "En PLAY tu cliques pour entrer dans une room. En EDIT tu peux déplacer les bâtiments à la Blender (G/R/S).",
      cameraView: { position: [-20, 18, 22], target: [0, 3, 0], durationMs: 1500 },
      animCue: 'bounce-buildings',           // bâtiments rebondissent légèrement
    },
    {
      icon: '🎥', title: 'Caméra orbitale',
      body: "Mouse-drag = orbite, molette = zoom. Vue isométrique par défaut. Survole un bâtiment pour un aperçu.",
      cameraView: { position: [0, 45, 0.1], target: [0, 0, 0], durationMs: 1800 },
      animCue: 'rotate-island',              // île entière tourne légèrement sur Y
    },
  ];
  tutorialVoiceLines: string[] = [
    "Bienvenue sur Yamzy Island, le cœur battant du Royaume.",
    "Au centre brille le Conclave VESPER, ton port d'attache.",
    "Onze bâtiments mythiques t'attendent, chacun avec sa mécanique unique.",
    "Deux modes : PLAY pour explorer, EDIT pour réaménager l'île à ta guise.",
    "Caméra orbitale libre. À toi de naviguer entre les temples du savoir.",
  ];

  onSplashPlay(): void {
    this.splashVisible.set(false);
    // Lance l'intro cinématique + ouvre le tutorial
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }
  onSplashEnter(): void { this.splashVisible.set(false); }
  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }
  closeTutorial(): void {
    this.tutorialOpen.set(false);
    this.resetAnimCues();
  }

  // ─── 🌅 Day Demo overlay ────────────────────────────────────────
  dayDemoOpen = signal<boolean>(false);
  openDayDemo(): void { this.dayDemoOpen.set(true); }

  // ═══════════════════════════════════════════════════════════════════
  // CAMERA FLY — déclenché par cameraViewChange du tutorial overlay
  // ═══════════════════════════════════════════════════════════════════
  private camTween: number | null = null;
  onCameraView(view: NonNullable<TutorialStep['cameraView']>): void {
    if (!this.camera || !this.controls) return;
    this.flyCameraTo(view.position, view.target, view.durationMs ?? 1500, view.fov);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANIM CUE — déclenché par animCueChange du tutorial overlay
  // Chaque cue lance une animation specifique sur les bâtiments / île.
  // ═══════════════════════════════════════════════════════════════════
  private animCueState = signal<string>('');
  private animCueT0 = 0;
  private animCueId: number | null = null;

  onAnimCue(cue: string): void {
    this.animCueState.set(cue);
    this.animCueT0 = performance.now();
    // Le tick principal lit animCueState() et applique les transforms
    // -> rien d'autre a faire ici, le RAF anime via applyAnimCue()
  }

  /** Appelé chaque frame depuis le RAF principal pour appliquer l'effet du cue actif. */
  private applyAnimCue(_elapsed: number): void {
    const cue = this.animCueState();
    if (!cue || !this.rooms || this.rooms.length === 0) return;
    const t = (performance.now() - this.animCueT0) / 1000; // secondes depuis declenchement

    switch (cue) {
      case 'pulse-all': {
        // Tous bâtiments pulsent en Y (scale legere)
        const s = 1 + Math.sin(t * 2) * 0.05;
        this.rooms.forEach((r: any) => {
          if (!r.group) return;
          r.group.scale.y = s;
        });
        break;
      }
      case 'highlight-conclave': {
        // Bâtiment central tourne sur Y + scale up
        const center = this.rooms.find((r: any) =>
          r.group && (r.id === 'conclave' || r.key === 'conclave' || r.name?.toLowerCase().includes('conclave')));
        if (center?.group) {
          center.group.rotation.y = t * 0.6;
          center.group.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
        }
        break;
      }
      case 'glow-ring': {
        // Couronne de bâtiments éclaire l'un après l'autre (vague)
        const list = this.rooms;
        list.forEach((r: any, i: number) => {
          if (!r.group || r.id === 'conclave') return;
          const phase = (t * 1.5 - i * 0.25);
          const intensity = Math.max(0, Math.sin(phase) ** 8);
          r.group.traverse((c: any) => {
            if (c.isMesh && c.material?.emissive) {
              if (c.userData.baseEmissive === undefined) {
                c.userData.baseEmissive = c.material.emissiveIntensity ?? 0;
              }
              c.material.emissiveIntensity = c.userData.baseEmissive + intensity * 1.5;
            }
          });
        });
        break;
      }
      case 'bounce-buildings': {
        // Petit rebond vertical en cascade
        this.rooms.forEach((r: any, i: number) => {
          if (!r.group) return;
          if (r.group.userData.baseY === undefined) r.group.userData.baseY = r.group.position.y;
          const offset = Math.max(0, Math.sin(t * 3 - i * 0.4)) * 0.4;
          r.group.position.y = r.group.userData.baseY + offset;
        });
        break;
      }
      case 'rotate-island': {
        // L'île entière tourne lentement sur Y (via tous les rooms group rotation)
        const angle = Math.sin(t * 0.5) * 0.3;
        this.rooms.forEach((r: any) => {
          if (!r.group) return;
          if (r.group.userData.baseRotY === undefined) r.group.userData.baseRotY = r.group.rotation.y;
          r.group.rotation.y = r.group.userData.baseRotY + angle;
        });
        break;
      }
    }
  }

  /** Reset animations (appelé quand tutorial se ferme). */
  private resetAnimCues(): void {
    if (!this.rooms) return;
    this.animCueState.set('');
    this.rooms.forEach((r: any) => {
      if (!r.group) return;
      if (r.group.userData.baseY !== undefined) r.group.position.y = r.group.userData.baseY;
      r.group.scale.setScalar(1);
      r.group.rotation.y = r.group.userData.baseRotY ?? 0;
      r.group.traverse((c: any) => {
        if (c.isMesh && c.userData.baseEmissive !== undefined && c.material?.emissive) {
          c.material.emissiveIntensity = c.userData.baseEmissive;
        }
      });
    });
  }

  private flyCameraTo(
    posTarget: [number, number, number],
    lookTarget: [number, number, number],
    durationMs = 1500,
    fovTarget?: number,
  ): void {
    if (this.camTween) cancelAnimationFrame(this.camTween);
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const startPos    = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startFov    = this.camera.fov;
    const endPos      = new THREE.Vector3(...posTarget);
    const endTarget   = new THREE.Vector3(...lookTarget);
    const endFov      = fovTarget ?? startFov;
    const t0 = performance.now();

    // Désactiver damping pendant l'animation pour pas de fight
    const prevDamping = this.controls.enableDamping;
    this.controls.enableDamping = false;

    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / durationMs);
      // ease-in-out cubic
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(startPos, endPos, e);
      this.controls.target.lerpVectors(startTarget, endTarget, e);
      if (fovTarget !== undefined) {
        this.camera.fov = startFov + (endFov - startFov) * e;
        this.camera.updateProjectionMatrix();
      }
      this.controls.update();
      if (t < 1) {
        this.camTween = requestAnimationFrame(tick);
      } else {
        this.controls.enableDamping = prevDamping;
        this.camTween = null;
      }
    };
    this.camTween = requestAnimationFrame(tick);
  }

  // ═══════════════════════════════════════════════════════════════════
  // THREE.js refs
  // ═══════════════════════════════════════════════════════════════════
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;
  private controls: any;
  private transformControls: any;
  private raycaster: any;
  private mouse: any;
  private gridHelper: any;
  private axesHelper: any;
  private ocean: any;
  private clickHandler: any;
  private moveHandler: any;
  private keyHandler: any;
  private buildingsRoot: any;
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;
  private ceremonyBus = inject(CeremonyBusService);
  private spellFooter = inject(SpellFooterService);

  constructor(private router: Router) {
    // 🪄 Footer global réactif : 3 actions + hint qui change avec le mode play/edit
    effect(() => {
      const m = this.mode();
      const a = this.axesVisible();
      const g = this.gridVisible();
      this.spellFooter.setSlots({
        accent: '#d54adf',
        controls: [
          { icon: '🎥', label: 'Vue isométrique', variant: 'secondary', action: () => this.resetCamera(), title: 'Reset caméra' },
          { icon: '🧭', label: `${a ? 'Hide' : 'Show'} axes`, variant: 'secondary', action: () => this.toggleAxes(), title: 'Toggle axes helper' },
          { icon: '📐', label: `${g ? 'Hide' : 'Show'} grid`, variant: 'secondary', action: () => this.toggleGrid(), title: 'Toggle grid helper' },
        ],
        hint: `Mouse drag = orbit · molette = zoom · ${m === 'edit' ? 'cliquer bâtiment = sélectionner' : 'cliquer bâtiment = entrer dans la room'}`,
      });
    });
  }

  ngOnInit() { this.bootstrap(); }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) this.renderer.dispose();
    const canvas = this.canvasEl?.nativeElement;
    if (canvas) {
      if (this.clickHandler) canvas.removeEventListener('click', this.clickHandler);
      if (this.moveHandler) canvas.removeEventListener('mousemove', this.moveHandler);
    }
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    this.loadSavedLayout();
  }

  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (!(window as any).THREE?.TransformControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js');
    }
  }
  private loadScript(src: string): Promise<void> {
    return new Promise(r => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => r(); s.onerror = () => r();
      document.head.appendChild(s);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCENE INIT
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x07041a);
    // Fog plus léger pour ne pas masquer les corps célestes
    this.scene.fog = new T.FogExp2(0x100828, 0.006);

    // Caméra isométrique haut perspective (far étendu pour ciel lointain)
    this.camera = new T.PerspectiveCamera(40, w / h, 0.1, 300);
    this.camera.position.set(25, 22, 25);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Lights
    this.scene.add(new T.AmbientLight(0x404060, 0.5));
    const sun = new T.DirectionalLight(0xfff4e0, 1.0);
    sun.position.set(15, 25, 12);
    this.scene.add(sun);
    const fill = new T.HemisphereLight(0x88aaff, 0x223344, 0.4);
    this.scene.add(fill);

    // ─── ÎLE de base (grand disque) ───
    const islandRadius = 22;
    const islandGeom = new T.CylinderGeometry(islandRadius, islandRadius + 2, 1, 64);
    const islandMat = new T.MeshStandardMaterial({ color: 0x3d5a4d, roughness: 0.95 });
    const island = new T.Mesh(islandGeom, islandMat);
    island.position.y = -0.5;
    this.scene.add(island);

    // Plage autour (ring sableux)
    const beachGeom = new T.RingGeometry(islandRadius - 1, islandRadius + 1.5, 64);
    const beachMat = new T.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.95, side: T.DoubleSide });
    const beach = new T.Mesh(beachGeom, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 0.05;
    this.scene.add(beach);

    // Océan autour
    const oceanGeom = new T.PlaneGeometry(120, 120, 64, 64);
    const oceanMat = new T.MeshStandardMaterial({
      color: 0x1a3a6e, metalness: 0.4, roughness: 0.5,
      transparent: true, opacity: 0.85,
    });
    this.ocean = new T.Mesh(oceanGeom, oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -1.5;
    this.scene.add(this.ocean);
    // Save base positions for wave anim
    const posAttr = oceanGeom.attributes.position;
    const basePos = new Float32Array(posAttr.array);
    (this.ocean as any).userData.basePos = basePos;

    // 🌌 Ciel universel synchronisé avec les autres îles
    // Positions optimisées pour la caméra isométrique (25,22,25) → (0,0,0)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 600,
      starRadius: 75,
      moonPos: [-18, 26, -8],     // Lune top-left depuis l'angle isométrique
      auroraPos: [-5, 30, -25],   // Aurore au fond gauche
      cometPos: [20, 28, 10],     // Comète traversant la droite
      shootingStarCount: 6,
    });
    // Subscribe au bus de cérémonies — chaque événement projet déclenche
    // une étoile filante colorée selon le type
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      // Anti-loop : ignorer si l'event vient de l'île elle-même
      if (c.sourceRoom === 'yamzy-island') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Grid + axes helpers
    this.gridHelper = new T.GridHelper(40, 20, 0x4a5a7a, 0x2a3a5a);
    this.gridHelper.position.y = 0.06;
    this.scene.add(this.gridHelper);
    this.axesHelper = new T.AxesHelper(8);
    this.axesHelper.visible = false;
    this.scene.add(this.axesHelper);

    // Root des bâtiments (= rooms)
    this.buildingsRoot = new T.Group();
    this.scene.add(this.buildingsRoot);
    this.buildRoomBuildings(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 0, 0);
      this.controls.maxDistance = 60;
      this.controls.minDistance = 8;
      this.controls.maxPolarAngle = Math.PI / 2.2;  // empêche de passer sous l'horizon
    }

    // TransformControls (Blender gizmo) — utilisé en mode EDIT
    if (T.TransformControls) {
      this.transformControls = new T.TransformControls(this.camera, canvas);
      this.transformControls.addEventListener('dragging-changed', (e: any) => {
        // Quand on drag le gizmo, désactiver OrbitControls
        if (this.controls) this.controls.enabled = !e.value;
      });
      this.scene.add(this.transformControls);
    }

    // Raycaster pour clic / hover sur bâtiments
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.onCanvasClick(e);
    this.moveHandler = (e: MouseEvent) => this.onCanvasMove(e);
    canvas.addEventListener('click', this.clickHandler);
    canvas.addEventListener('mousemove', this.moveHandler);

    // Keyboard shortcuts (G/R/S pour transform mode, Échap pour deselect)
    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[YamzyIsland] 🏝 Hub ready —', this.rooms.length, 'rooms placés sur l\'île');

    // 🎬 Intro cinématique : vue d'oiseau qui zoom progressivement
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 25, y: 22, z: 25 },
      { x: 0, y: 0, z: 0 },
      3.5,
    );

    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : un mini bâtiment iconique par room
  // ═══════════════════════════════════════════════════════════════════
  private buildRoomBuildings(T: any) {
    for (const room of this.rooms) {
      const group = new T.Group();
      group.name = room.key;
      group.userData = { room };
      group.position.set(...room.defaultPos);
      group.position.y = 0.5;

      // Socle commun (disque coloré accent)
      const baseGeom = new T.CylinderGeometry(1.4, 1.6, 0.3, 12);
      const baseMat = new T.MeshStandardMaterial({
        color: room.color, emissive: room.color, emissiveIntensity: 0.4,
        roughness: 0.5, metalness: 0.5,
      });
      const base = new T.Mesh(baseGeom, baseMat);
      group.add(base);

      // Bâtiment iconique propre à la room
      const building = this.buildIconicBuilding(T, room);
      building.position.y = 0.5;
      group.add(building);

      // Halo lumineux subtil
      const halo = new T.Mesh(
        new T.RingGeometry(1.6, 1.9, 32),
        new T.MeshBasicMaterial({ color: room.color, transparent: true, opacity: 0.4, side: T.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.18;
      halo.userData.isHalo = true;
      group.add(halo);

      // Label flottant (canvas texture)
      const label = this.makeLabel(T, room);
      label.position.y = 3.6;
      group.add(label);

      room.group = group;
      this.buildingsRoot.add(group);
    }
  }

  private buildIconicBuilding(T: any, room: RoomBuilding): any {
    const g = new T.Group();
    const c = parseInt(room.color.slice(1), 16);
    const mat = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15, roughness: 0.55, metalness: 0.4 });
    const stone = new T.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.9 });
    const gold = new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.3 });

    switch (room.key) {
      case 'conclave': {
        // Crystal 3D (Icosahedron) — l'orrery
        const crystal = new T.Mesh(new T.IcosahedronGeometry(1.1, 0), mat);
        crystal.userData.spin = true;
        g.add(crystal);
        // 3 anneaux orbitaux fins autour
        for (let i = 0; i < 3; i++) {
          const ring = new T.Mesh(new T.TorusGeometry(1.5 + i * 0.3, 0.04, 8, 32), gold);
          ring.rotation.x = Math.PI / 2 + i * 0.3;
          ring.userData.orbit = true;
          g.add(ring);
        }
        break;
      }
      case 'git-tree': {
        // Arbre : tronc + 4 branches + feuilles
        const trunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 1.6, 8), new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 }));
        trunk.position.y = 0.8;
        g.add(trunk);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const branch = new T.Mesh(new T.CylinderGeometry(0.06, 0.1, 0.9, 6), new T.MeshStandardMaterial({ color: 0x8b6b3e }));
          branch.position.set(Math.cos(a) * 0.35, 1.3, Math.sin(a) * 0.35);
          branch.rotation.z = Math.cos(a) * 0.5;
          branch.rotation.x = Math.sin(a) * 0.5;
          g.add(branch);
          const leaf = new T.Mesh(new T.IcosahedronGeometry(0.4, 0), mat);
          leaf.position.set(Math.cos(a) * 0.8, 1.6, Math.sin(a) * 0.8);
          g.add(leaf);
        }
        break;
      }
      case 'kanban-island': {
        // Mini île dans l'île (cone + drapeau)
        const cone = new T.Mesh(new T.ConeGeometry(1, 1.5, 12), mat);
        cone.position.y = 0.75;
        g.add(cone);
        const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.8, 6), gold);
        pole.position.y = 1.8;
        g.add(pole);
        const flag = new T.Mesh(new T.PlaneGeometry(0.5, 0.3), mat);
        flag.position.set(0.25, 1.9, 0);
        g.add(flag);
        break;
      }
      case 'pr-mirror-hall': {
        // Pavillon octogonal + miroir
        const hall = new T.Mesh(new T.CylinderGeometry(1, 1, 1.5, 8), stone);
        hall.position.y = 0.75;
        g.add(hall);
        const roof = new T.Mesh(new T.ConeGeometry(1.1, 0.6, 8), gold);
        roof.position.y = 1.8;
        g.add(roof);
        const mirror = new T.Mesh(new T.PlaneGeometry(0.5, 0.8), new T.MeshStandardMaterial({ color: 0xa3e9ff, emissive: 0xa3e9ff, emissiveIntensity: 0.5, metalness: 0.95, roughness: 0.05 }));
        mirror.position.set(0, 1, 1.01);
        g.add(mirror);
        break;
      }
      case 'phoenix-forge': {
        // Forge avec flamme
        const forge = new T.Mesh(new T.CylinderGeometry(0.7, 0.9, 0.9, 8), stone);
        forge.position.y = 0.45;
        g.add(forge);
        const flame = new T.Mesh(new T.ConeGeometry(0.5, 1.3, 8), new T.MeshStandardMaterial({ color: 0xea580c, emissive: 0xea580c, emissiveIntensity: 1.0 }));
        flame.position.y = 1.6;
        flame.userData.flame = true;
        g.add(flame);
        const flameTip = new T.Mesh(new T.ConeGeometry(0.25, 0.7, 8), new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.2 }));
        flameTip.position.y = 2.4;
        flameTip.userData.flame = true;
        g.add(flameTip);
        break;
      }
      case 'okr-mountain': {
        // Petite montagne
        const peak = new T.Mesh(new T.ConeGeometry(1.2, 2, 8), mat);
        peak.position.y = 1;
        g.add(peak);
        const snow = new T.Mesh(new T.ConeGeometry(0.4, 0.6, 8), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 }));
        snow.position.y = 1.9;
        g.add(snow);
        // Drapeau sommet
        const flagpole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.6, 6), gold);
        flagpole.position.y = 2.5;
        g.add(flagpole);
        const flag = new T.Mesh(new T.PlaneGeometry(0.4, 0.25), mat);
        flag.position.set(0.2, 2.6, 0);
        g.add(flag);
        break;
      }
      case 'library-cathedral': {
        // Cathédrale gothique : tour + flèche
        const tower = new T.Mesh(new T.BoxGeometry(1.4, 1.5, 1.4), stone);
        tower.position.y = 0.75;
        g.add(tower);
        const spire = new T.Mesh(new T.ConeGeometry(0.6, 1.6, 4), mat);
        spire.position.y = 2.3;
        g.add(spire);
        // 4 vitraux colorés
        const stainedMat = new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const w = new T.Mesh(new T.PlaneGeometry(0.3, 0.6), stainedMat);
          w.position.set(Math.cos(a) * 0.72, 0.9, Math.sin(a) * 0.72);
          w.lookAt(Math.cos(a) * 2, 0.9, Math.sin(a) * 2);
          g.add(w);
        }
        break;
      }
      case 'star-map-risks': {
        // Observatoire dôme
        const tower = new T.Mesh(new T.CylinderGeometry(0.9, 1, 1.2, 12), stone);
        tower.position.y = 0.6;
        g.add(tower);
        const dome = new T.Mesh(new T.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0x8b1a1a, emissive: 0x8b1a1a, emissiveIntensity: 0.4, metalness: 0.7 }));
        dome.position.y = 1.2;
        g.add(dome);
        // Telescope mesh qui dépasse
        const scope = new T.Mesh(new T.CylinderGeometry(0.1, 0.15, 1.2, 8), gold);
        scope.position.set(0.3, 1.6, 0.3);
        scope.rotation.set(0.6, 0, 0.6);
        g.add(scope);
        break;
      }
      case 'oracle-aquarium': {
        // Aquarium cubique transparent + poisson dedans
        const tank = new T.Mesh(new T.BoxGeometry(1.6, 1.6, 1.6), new T.MeshPhysicalMaterial({ color: 0xa3e9ff, transparent: true, opacity: 0.3, transmission: 0.8, metalness: 0.1, roughness: 0.05 }));
        tank.position.y = 0.8;
        g.add(tank);
        // 2 poissons à l'intérieur
        for (let i = 0; i < 3; i++) {
          const fish = new T.Mesh(new T.ConeGeometry(0.15, 0.4, 6), new T.MeshStandardMaterial({ color: room.color, emissive: room.color, emissiveIntensity: 0.7 }));
          fish.position.set((i - 1) * 0.4, 0.8 + Math.random() * 0.5, 0);
          fish.rotation.z = Math.PI / 2;
          fish.userData.swim = true;
          g.add(fish);
        }
        break;
      }
      case 'alchemist-cellar': {
        // Tour d'alchimiste : cylindre + toit conique pointu
        const tower = new T.Mesh(new T.CylinderGeometry(0.7, 0.9, 1.8, 8), stone);
        tower.position.y = 0.9;
        g.add(tower);
        const roof = new T.Mesh(new T.ConeGeometry(0.8, 0.8, 8), mat);
        roof.position.y = 2.2;
        g.add(roof);
        // Vapeur qui monte (sphère verte au-dessus)
        const smoke = new T.Mesh(new T.SphereGeometry(0.3, 8, 8), new T.MeshStandardMaterial({ color: 0x84cc16, emissive: 0x84cc16, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 }));
        smoke.position.y = 2.9;
        smoke.userData.smoke = true;
        g.add(smoke);
        break;
      }
      case 'card-tavern': {
        // Auberge bois : cube + toit triangulaire
        const inn = new T.Mesh(new T.BoxGeometry(1.6, 1.2, 1.4), new T.MeshStandardMaterial({ color: 0x8b6b3e, roughness: 0.9 }));
        inn.position.y = 0.6;
        g.add(inn);
        const roof = new T.Mesh(new T.ConeGeometry(1.3, 0.9, 4), new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
        roof.position.y = 1.6;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        // Enseigne dorée
        const sign = new T.Mesh(new T.BoxGeometry(0.6, 0.3, 0.05), gold);
        sign.position.set(0, 0.9, 0.75);
        g.add(sign);
        // Bougies aux fenêtres (lumière chaude)
        const light = new T.PointLight(0xfbbf24, 0.8, 4);
        light.position.set(0, 1.2, 0);
        g.add(light);
        break;
      }
      case 'mana-fountain': {
        // 💧 Mini fontaine : vasque + colonne d'eau lumineuse
        const bowl = new T.Mesh(
          new T.CylinderGeometry(1.0, 0.85, 0.35, 24),
          new T.MeshStandardMaterial({ color: 0x4a3a6a, roughness: 0.85 })
        );
        bowl.position.y = 0.2;
        g.add(bowl);
        // Surface d'eau (cercle émissif cyan)
        const water = new T.Mesh(
          new T.CircleGeometry(0.9, 24),
          new T.MeshStandardMaterial({ color: 0xa3e9ff, emissive: 0xa3e9ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.4;
        g.add(water);
        // Colonne d'eau lumineuse au-dessus
        const col = new T.Mesh(
          new T.CylinderGeometry(0.18, 0.10, 1.5, 12),
          new T.MeshBasicMaterial({ color: 0xa3e9ff, transparent: true, opacity: 0.7, blending: T.AdditiveBlending })
        );
        col.position.y = 1.2;
        g.add(col);
        // Halo en haut
        const halo = new T.Mesh(
          new T.SphereGeometry(0.35, 16, 12),
          new T.MeshBasicMaterial({ color: 0xd68ddc, transparent: true, opacity: 0.5, blending: T.AdditiveBlending })
        );
        halo.position.y = 2.0;
        g.add(halo);
        // Light magenta-cyan
        const lt = new T.PointLight(0xd54adf, 1.2, 5);
        lt.position.y = 1.5;
        g.add(lt);
        break;
      }
    }
    return g;
  }

  private makeLabel(T: any, room: RoomBuilding): any {
    // Canvas texture pour le label
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(15,20,40,0.85)';
    this.roundRect(ctx, 0, 0, 256, 80, 12); ctx.fill();
    ctx.strokeStyle = room.color; ctx.lineWidth = 3;
    this.roundRect(ctx, 0, 0, 256, 80, 12); ctx.stroke();
    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = room.color;
    ctx.textAlign = 'center';
    ctx.fillText(room.icon + ' ' + room.name, 128, 38);
    ctx.font = '13px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(room.loreName, 128, 60);
    const tex = new T.CanvasTexture(canvas);
    const mat = new T.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(2.5, 0.8, 1);
    return sprite;
  }
  private roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private createStars(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true });
    this.scene.add(new T.Points(geom, mat));
  }

  // ═══════════════════════════════════════════════════════════════════
  // MODES Play / Edit
  // ═══════════════════════════════════════════════════════════════════
  setMode(m: 'play' | 'edit') {
    this.mode.set(m);
    if (m === 'play' && this.transformControls) {
      this.transformControls.detach();
      this.editTarget.set(null);
    }
  }

  enterRoom(room: RoomBuilding) {
    if (this.mode() === 'edit') {
      // En mode edit, click sidebar = sélectionner pour gizmo
      this.selectForEdit(room);
    } else {
      // En mode play = navigate
      this.router.navigate([room.route]);
    }
  }

  private selectForEdit(room: RoomBuilding) {
    if (!this.transformControls || !room.group) return;
    this.transformControls.attach(room.group);
    this.transformControls.setMode('translate');
    this.editTarget.set(room);
  }

  // Sauvegarde des positions dans localStorage
  saveLayout() {
    const layout: Record<string, [number, number, number]> = {};
    for (const r of this.rooms) {
      if (r.group) {
        layout[r.key] = [r.group.position.x, r.group.position.y, r.group.position.z];
      }
    }
    localStorage.setItem('yamzy-island-layout', JSON.stringify(layout));
    console.log('[YamzyIsland] 💾 Layout saved');
  }
  resetLayout() {
    for (const r of this.rooms) {
      if (r.group) r.group.position.set(r.defaultPos[0], 0.5, r.defaultPos[2]);
    }
    localStorage.removeItem('yamzy-island-layout');
    console.log('[YamzyIsland] 🔄 Layout reset to defaults');
  }
  private loadSavedLayout() {
    const raw = localStorage.getItem('yamzy-island-layout');
    if (!raw) return;
    try {
      const layout = JSON.parse(raw);
      for (const r of this.rooms) {
        if (r.group && layout[r.key]) {
          const [x, y, z] = layout[r.key];
          r.group.position.set(x, y, z);
        }
      }
      console.log('[YamzyIsland] ✓ Layout loaded from localStorage');
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOVER + CLICK handlers
  // ═══════════════════════════════════════════════════════════════════
  private onCanvasMove(e: MouseEvent) {
    if (!this.raycaster || !this.camera) return;
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    this.mouseX.set(e.clientX);
    this.mouseY.set(e.clientY);
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.buildingsRoot, true);
    if (intersects.length > 0) {
      const r = this.findRoomFromObject(intersects[0].object);
      if (r) {
        if (this.hoveredRoom() !== r) this.hoveredRoom.set(r);
        this.canvasEl.nativeElement.style.cursor = 'pointer';
        return;
      }
    }
    this.hoveredRoom.set(null);
    this.canvasEl.nativeElement.style.cursor = '';
  }

  private onCanvasClick(e: MouseEvent) {
    // Si transformControls drag en cours, ne pas intercepter
    if (this.transformControls?.dragging) return;
    const h = this.hoveredRoom();
    if (h) this.enterRoom(h);
  }

  private onKey(e: KeyboardEvent) {
    if (this.mode() !== 'edit' || !this.transformControls) return;
    if (e.key === 'g' || e.key === 'G') this.transformControls.setMode('translate');
    if (e.key === 'r' || e.key === 'R') this.transformControls.setMode('rotate');
    if (e.key === 's' || e.key === 'S') this.transformControls.setMode('scale');
    if (e.key === 'Escape') { this.transformControls.detach(); this.editTarget.set(null); }
  }

  private findRoomFromObject(obj: any): RoomBuilding | null {
    let cur = obj;
    while (cur) {
      if (cur.userData?.room) return cur.userData.room;
      cur = cur.parent;
    }
    return null;
  }

  highlightRoom(r: RoomBuilding) {
    if (r.group) r.group.scale.set(1.1, 1.1, 1.1);
  }
  unhighlightRoom(r: RoomBuilding) {
    if (r.group) r.group.scale.set(1, 1, 1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // UI buttons
  // ═══════════════════════════════════════════════════════════════════
  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(25, 22, 25);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) this.controls.target.set(0, 0, 0);
  }
  toggleAxes() {
    this.axesVisible.set(!this.axesVisible());
    if (this.axesHelper) this.axesHelper.visible = this.axesVisible();
  }
  toggleGrid() {
    this.gridVisible.set(!this.gridVisible());
    if (this.gridHelper) this.gridHelper.visible = this.gridVisible();
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // Animation océan (vagues)
    if (this.ocean) {
      const posAttr = this.ocean.geometry.attributes.position;
      const base = (this.ocean as any).userData.basePos;
      for (let i = 0; i < posAttr.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        posAttr.setY(i, Math.sin(x * 0.15 + t * 0.8) * 0.3 + Math.cos(z * 0.18 + t * 0.6) * 0.25);
      }
      posAttr.needsUpdate = true;
    }

    // Animations des bâtiments
    for (const r of this.rooms) {
      if (!r.group) continue;
      // Bobbing global du bâtiment
      const baseY = 0.5;
      r.group.position.y = baseY + Math.sin(t * 1.2 + this.rooms.indexOf(r)) * 0.08;
      r.group.traverse((obj: any) => {
        if (obj.userData?.spin) obj.rotation.y = t * 0.4;
        if (obj.userData?.orbit) obj.rotation.y += dt * 0.5;
        if (obj.userData?.flame) {
          obj.scale.y = 1 + Math.sin(t * 8) * 0.15;
        }
        if (obj.userData?.swim) {
          obj.position.x = (obj.position.x + dt * 0.4);
          if (obj.position.x > 0.5) obj.position.x = -0.5;
        }
        if (obj.userData?.smoke) {
          obj.position.y = 2.9 + Math.sin(t * 2) * 0.2;
          obj.material.opacity = 0.6 + Math.sin(t * 3) * 0.2;
        }
        if (obj.userData?.isHalo) {
          obj.material.opacity = 0.3 + Math.sin(t * 2 + this.rooms.indexOf(r)) * 0.15;
        }
      });
    }

    // 🌌 Animer le ciel universel (étoiles, lune, aurore, comète, filantes)
    this.sky?.tick(dt, t);

    // 🎬 Animation cue per tutorial step (highlight, pulse, glow, rotate...)
    if (this.tutorialOpen()) this.applyAnimCue(t);

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
