// ═══════════════════════════════════════════════════════════════════
// 🏝 KANBAN ISLAND ROOM — L'Archipel des Quêtes
//
// Mécanique data unique : chaque ticket est un VOYAGEUR physique. Il s'échoue
// sur la plage (Backlog), traverse la forêt (Refined/TODO), gravit la montagne
// (In Progress), plante son drapeau au sommet (Done). Les blocked stagnent
// sur la falaise du doute, surveillés par un vautour.
//
// Implémentation : Three.js procedural island, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🚢 Débarquement = sprint planning (cargo arrive, tickets s'échouent)
//   🌅 Aube         = daily stand-up (lumière dorée, feu de camp)
//   🏁 Sommet       = sprint review (flash blanc, drapeaux illuminés)
//   🔥 Feu de joie  = retrospective (flammes rouges, mots brûlés)
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { createPortal3D, getIslandForRoom, PortalHandle } from '../../core/portal/portal.factory';
import { SpellTutorialOverlayComponent, TutorialStep } from '../../core/spell-ui';
import { SpellButtonComponent, SpellPanelComponent, SpellFooterService } from '../../core/spell-ui';

type IslandZone =
  | 'beach'           // 🌊 Plage de l'Aurore — Backlog
  | 'forest_refined'  // 🌳 Forêt du Cadrage — Refined
  | 'forest_todo'     // 🛤 Sentier en Forêt — TODO
  | 'mountain_wip'    // ⛰ Montagne du Build — In Progress
  | 'summit_done'     // 🏔 Sommet du Sanctuaire — Done
  | 'cliff_blocked';  // 🪨 Falaise du Doute — Blocked

interface IslandTicket {
  id: number;
  title: string;
  zone: IslandZone;
  priority: number;     // 1 (low) - 4 (critical)
  storyPoints: number;
  assignee: string;
  assigneeColor: string;
  dueDate: Date;
  blockedReason?: string;
  createdAt: number;
}

@Component({
  selector: 'wt-kanban-island-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ki-host">
      <header class="ki-topbar">
        <div class="ki-title">
          <h1>🏝 KANBAN ISLAND ROOM</h1>
          <p>L'Archipel des Quêtes — {{ tickets().length }} voyageurs · {{ zoneCount('summit_done') }} drapeaux plantés · {{ zoneCount('cliff_blocked') }} bloqués</p>
        </div>
        <div class="ki-legend">
          <span class="dot beach"></span>Backlog ({{ zoneCount('beach') }})
          <span class="dot refined"></span>Refined ({{ zoneCount('forest_refined') }})
          <span class="dot todo"></span>TODO ({{ zoneCount('forest_todo') }})
          <span class="dot wip"></span>WIP ({{ zoneCount('mountain_wip') }})
          <span class="dot done"></span>Done ({{ zoneCount('summit_done') }})
          <span class="dot blocked"></span>Blocked ({{ zoneCount('cliff_blocked') }})
        </div>
      </header>

      <canvas #canvas class="ki-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="ki-flash" [attr.data-type]="f.type">
        <div class="ki-flash-content">
          <div class="ki-flash-icon">{{ f.icon }}</div>
          <div class="ki-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel ticket info -->
      <wt-spell-panel
        [open]="!!selectedTicket()"
        title="Quête en cours"
        icon="🏝"
        accent="#67e8f9"
        side="right"
        size="sm"
        (close)="selectedTicket.set(null)">
        <ng-container *ngIf="selectedTicket() as t">
          <div class="ki-panel-head">
            <strong class="ki-panel-id">#{{ t.id }}</strong>
            <span class="ki-panel-zone" [attr.data-zone]="t.zone">{{ zoneLabel(t.zone) }}</span>
          </div>
          <div class="ki-panel-title">{{ t.title }}</div>
          <div class="ki-panel-row">
            <span>👤 <span [style.color]="t.assigneeColor">{{ t.assignee }}</span></span>
            <span>📊 {{ t.storyPoints }} pts</span>
            <span>🎯 P{{ t.priority }}</span>
          </div>
          <div class="ki-panel-row">
            <span>📅 {{ fmtDue(t.dueDate) }}</span>
          </div>
          <div *ngIf="t.blockedReason" class="ki-panel-blocked">🪨 {{ t.blockedReason }}</div>
          <div class="ki-panel-time">Créé {{ fmtAgo(t.createdAt) }}</div>
        </ng-container>
      </wt-spell-panel>

      <!-- 🎬 Splash overlay (welcome screen avant entrée) -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Kanban Island"
        loreName="L'Archipel des Quêtes"
        color="#7dd3fc"
        oneLiner="Île 3D où les tickets voyagent de la plage au sommet du volcan."
        [duration]="70"
        [timeboxDurationS]="900"
        [timeboxLabel]="'Lancer Daily'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Kanban Island"
        loreName="L'Archipel des Quêtes"
        accent="#67e8f9"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .ki-host { position: relative; width: 100%; height: 100vh; background: #051a2e; color: #e0f2fe; font-family: "Tinos", serif; }
    .ki-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .ki-topbar > * { pointer-events: auto; }
    .ki-back { color: #7dd3fc; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #0c4a6e; border-radius: 8px; background: rgba(8,30,55,0.5); }
    .ki-back:hover { background: rgba(12,74,110,0.6); }
    .ki-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1px; color: #7dd3fc; }
    .ki-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.75; }
    .ki-legend { display: flex; gap: 10px; font-size: 11px; align-items: center; flex-wrap: wrap; }
    .ki-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .ki-legend .beach   { background: #fde68a; box-shadow: 0 0 6px #fde68a; }
    .ki-legend .refined { background: #4ade80; }
    .ki-legend .todo    { background: #22c55e; }
    .ki-legend .wip     { background: #f97316; box-shadow: 0 0 6px #f97316; }
    .ki-legend .done    { background: #facc15; box-shadow: 0 0 8px #facc15; }
    .ki-legend .blocked { background: #dc2626; box-shadow: 0 0 6px #dc2626; }

    .ki-canvas { display: block; width: 100%; height: 100%; }
    .ki-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); }
    .ki-controls button { background: rgba(8,30,55,0.7); color: #e0f2fe; border: 1px solid #0c4a6e; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .ki-controls button:hover { background: rgba(12,74,110,0.8); }
    .ki-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }
    .ki-narrator { background: rgba(40,30,5,0.7) !important; border-color: #b89240 !important; color: #fbbf24 !important; font-weight: 600; }
    .ki-narrator:hover { background: rgba(251,191,36,0.3) !important; }
    .ki-narrator.ki-play { background: #fbbf24 !important; color: #1a1500 !important; border-color: #fbbf24 !important; }
    .ki-narrator.ki-play:hover { background: #f5b923 !important; }

    /* Flash cérémonie */
    .ki-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: ov-flash-pulse 1.4s ease-out forwards; }
    .ki-flash[data-type="debarquement"] { background: radial-gradient(circle at center, rgba(56,189,248,0.55), transparent 65%); }
    .ki-flash[data-type="aube"]         { background: radial-gradient(circle at center, rgba(250,204,21,0.55), transparent 65%); }
    .ki-flash[data-type="sommet"]       { background: radial-gradient(circle at center, rgba(255,255,255,0.7), transparent 70%); }
    .ki-flash[data-type="feu"]          { background: radial-gradient(circle at center, rgba(220,38,38,0.6), transparent 65%); }
    .ki-flash-content { text-align: center; animation: ov-flash-grow 1.4s cubic-bezier(0.16, 1, 0.3, 1); }
    .ki-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .ki-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.5); }
    @keyframes ov-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes ov-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    /* Panel ticket */
    .ki-panel { position: absolute; right: 22px; top: 90px; width: 300px; padding: 16px; background: rgba(8,30,55,0.94); border: 1px solid #0c4a6e; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; }
    .ki-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(125, 211, 252, 0.4); border-radius: 50%; color: #7dd3fc; cursor: pointer; }
    .ki-panel-head { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
    .ki-panel-id { color: #7dd3fc; font-family: monospace; font-size: 13px; }
    .ki-panel-zone { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(125,211,252,0.18); color: #bae6fd; }
    .ki-panel-zone[data-zone="cliff_blocked"] { background: rgba(220,38,38,0.25); color: #fca5a5; }
    .ki-panel-zone[data-zone="summit_done"]   { background: rgba(250,204,21,0.25); color: #fde68a; }
    .ki-panel-title { color: #f1f5f9; margin: 8px 0; line-height: 1.4; font-weight: 600; }
    .ki-panel-row { display: flex; gap: 12px; margin: 6px 0; font-size: 11px; opacity: 0.9; }
    .ki-panel-blocked { margin-top: 8px; padding: 6px 10px; background: rgba(220,38,38,0.15); border-left: 3px solid #dc2626; border-radius: 4px; color: #fecaca; font-size: 11px; }
    .ki-panel-time { font-size: 10px; opacity: 0.55; margin-top: 8px; }
  `]
})
export class KanbanIslandRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  tickets = signal<IslandTicket[]>([]);
  selectedTicket = signal<IslandTicket | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  stormActive = signal<boolean>(false);
  volcanoActive = signal<boolean>(false);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🏝', title: 'Une île, six zones', body: 'L\'île est divisée en zones : plage (Backlog), forêt (Refined/TODO), montagne (WIP), sommet (Done), falaise (Blocked). Chaque ticket est un voyageur.' },
    { icon: '🌊', title: 'Plage de l\'Aurore = Backlog', body: 'Les tickets s\'échouent ici à leur création. Sable doré qui scintille à chaque nouveau cargo.' },
    { icon: '⛰', title: 'Montagne du Build = WIP', body: 'Les tickets In Progress gravissent la montagne. Plus ils sont haut, plus ils approchent du sommet.' },
    { icon: '🏔', title: 'Sommet = Done', body: 'Au sommet, les tickets terminés plantent leur drapeau. Sprint review = flash blanc qui illumine tous les drapeaux.' },
    { icon: '🪨', title: 'Falaise du Doute = Blocked', body: 'Les bloqués stagnent sur la falaise sous l\'œil d\'un vautour. Cliquez un ticket pour voir sa raison de blocage.' },
  ];
  tutorialVoiceLines: string[] = [
    'Une île, six zones agiles.',
    'La plage de l\'aurore accueille le backlog.',
    'La montagne, c\'est le travail en cours.',
    'Au sommet, les drapeaux du Done.',
    'Sur la falaise, le vautour veille les bloqués.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;

  // 3D refs
  private water: any;
  private waterBaseY = 0;
  private tideOffset = 0;
  private volcanoGlow: any;
  private vulture: any;
  private flag: any;
  private campfire: any;
  private rainParticles: any;
  private mountainMesh: any;
  private summitMesh: any;
  /** Tweens actifs (positions interpolées par animate()) */
  private activeTweens: Array<{
    obj: any;
    from: any; to: any;
    startTime: number; duration: number;
    onDone?: () => void;
  }> = [];
  /** Bursts de particules actifs */
  private activeBursts: any[] = [];
  /** Override de lumière ambiante temporaire */
  private dawnGlow: any = null;
  private ticketMeshes: any[] = [];
  private ticketByMesh = new Map<any, IslandTicket>();
  private trees: any[] = [];
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private ceremonyFlashTimer: any = null;
  private windTime = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#67e8f9',
      hint: 'Mouse drag = orbit · molette = zoom · clic ticket = détail',
      controls: [
        { icon: '🎬', label: 'Demo project (30 tickets)', action: () => this.loadDemo() },
        { icon: '🌊', label: 'Trigger Marée', action: () => this.triggerTide() },
        { label: this.stormActive() ? '☀️ Stop Tempête' : '⛈ Tempête', action: () => this.toggleStorm() },
        { label: this.volcanoActive() ? '🧊 Calmer Volcan' : '🌋 Volcan', action: () => this.toggleVolcano() },
        { icon: '🎥', label: 'Reset cam', action: () => this.resetCamera() },
        { icon: '🎓', label: 'How it works', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée par Yamzy' },
        { icon: '▶', label: 'Play example', variant: 'primary', action: () => this.narrator.startPlayExample(), title: 'Démo animée' },
      ],
    });
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.portal?.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
    }
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    this.loadDemo();
  }

  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
  }
  private loadScript(src: string): Promise<void> {
    return new Promise(r => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => r();
      s.onerror = () => r();
      document.head.appendChild(s);
    });
  }

  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scene — bleu profond océan + brume tropicale
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x051a2e);
    this.scene.fog = new T.FogExp2(0x0a2540, 0.014);

    // Camera — vue isométrique au-dessus de l'île
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 300);
    this.camera.position.set(22, 18, 22);
    this.camera.lookAt(0, 2, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights — soleil tropical + ciel cyan
    this.scene.add(new T.AmbientLight(0x4a6b8a, 0.45));
    const sun = new T.DirectionalLight(0xffeac4, 1.0);
    sun.position.set(15, 22, 10);
    this.scene.add(sun);
    const sky = new T.HemisphereLight(0x7dd3fc, 0x2a4a3a, 0.5);
    this.scene.add(sky);

    // ─── Océan (water plane) ───
    this.buildOcean(T);

    // ─── Île étagée (terrasses + montagne + sommet) ───
    this.buildIsland(T);

    // ─── Falaise du Doute (côté ombre + vautour) ───
    this.buildCliff(T);

    // ─── Drapeau au sommet ───
    this.buildSummitFlag(T);

    // ─── Volcan glow au sommet (intensité ∝ release) ───
    this.buildVolcano(T);

    // ─── Feu de camp central (cérémonie Aube/Retro) ───
    this.buildCampfire(T);

    // ─── Étoiles + lucioles tropicales ───
    this.createFireflies(T, 90);
    this.createStars(T, 220);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 3, 0);
      this.controls.maxDistance = 70;
      this.controls.minDistance = 6;
      this.controls.maxPolarAngle = Math.PI / 2.1; // pas sous la mer
    }

    // Raycaster pour cliquer tickets
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Livraison)
    const island = getIslandForRoom('/kanban-island');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-15, 3.5, -15],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[KanbanIsland] 🏝 Island scene ready · ocean, island, cliff, volcano, campfire, stars');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'kanban-island',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : océan + île terrassée
  // ═══════════════════════════════════════════════════════════════════
  private buildOcean(T: any) {
    // Mer infinie autour de l'île (vagues animées dans la loop)
    const oceanGeom = new T.PlaneGeometry(140, 140, 48, 48);
    const oceanMat = new T.MeshStandardMaterial({
      color: 0x0e7490,
      roughness: 0.4,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92,
    });
    this.water = new T.Mesh(oceanGeom, oceanMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0;
    this.waterBaseY = 0;
    this.scene.add(this.water);

    // Sauvegarde des positions originales pour ondulation
    const posAttr = oceanGeom.attributes.position;
    const originals = new Float32Array(posAttr.array.length);
    originals.set(posAttr.array);
    this.water.userData.originals = originals;
    console.log('[KanbanIsland] 🌊 Ocean plane built (140x140, 48 segments)');
  }

  private buildIsland(T: any) {
    // ─── Plage de l'Aurore (Backlog) : disque sablé bas, autour de l'île ───
    const beachGeom = new T.CylinderGeometry(14, 14, 0.4, 48);
    const beachMat = new T.MeshStandardMaterial({ color: 0xfde68a, roughness: 1.0 });
    const beach = new T.Mesh(beachGeom, beachMat);
    beach.position.y = 0.2;
    beach.userData.zone = 'beach';
    beach.userData.tutorialId = 'beach';
    this.scene.add(beach);

    // ─── Forêt du Cadrage (Refined) : plateau vert ───
    const refinedGeom = new T.CylinderGeometry(10, 11, 1.4, 40);
    const refinedMat = new T.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.85 });
    const refined = new T.Mesh(refinedGeom, refinedMat);
    refined.position.y = 1.0;
    refined.userData.tutorialId = 'forest';
    this.scene.add(refined);

    // Quelques touffes d'arbres sur la forêt refined
    this.scatterTrees(T, 7, 1.7, 8.5, 6, 'refined');

    // ─── Sentier en Forêt (TODO) : plateau vert plus haut ───
    const todoGeom = new T.CylinderGeometry(7.5, 8.5, 1.6, 36);
    const todoMat = new T.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85 });
    const todo = new T.Mesh(todoGeom, todoMat);
    todo.position.y = 2.5;
    todo.userData.tutorialId = 'forest';
    this.scene.add(todo);
    this.scatterTrees(T, 5, 3.3, 6.0, 4, 'todo');

    // Sentier visible (anneau brun)
    const pathGeom = new T.TorusGeometry(5.5, 0.12, 8, 36);
    const pathMat = new T.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    const path = new T.Mesh(pathGeom, pathMat);
    path.position.y = 3.32;
    path.rotation.x = -Math.PI / 2;
    this.scene.add(path);

    // ─── Montagne du Build (In Progress) : cone rocailleux ───
    const mountainGeom = new T.ConeGeometry(5.5, 5.5, 24, 1);
    const mountainMat = new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95, flatShading: true });
    const mountain = new T.Mesh(mountainGeom, mountainMat);
    mountain.position.y = 6.0;
    mountain.userData.tutorialId = 'mountain';
    this.scene.add(mountain);
    this.mountainMesh = mountain;

    // Rochers sur la pente (effet escarpé)
    for (let i = 0; i < 18; i++) {
      const rockGeom = new T.DodecahedronGeometry(0.25 + Math.random() * 0.35, 0);
      const rockMat = new T.MeshStandardMaterial({ color: 0x52525b, roughness: 0.95, flatShading: true });
      const rock = new T.Mesh(rockGeom, rockMat);
      const a = Math.random() * Math.PI * 2;
      const ry = 4.5 + Math.random() * 3.5;
      const radius = (8.5 - ry) * 0.6 + 0.2;
      rock.position.set(Math.cos(a) * radius, ry, Math.sin(a) * radius);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(rock);
    }

    // ─── Sommet du Sanctuaire (Done) : plateau au sommet ───
    const summitGeom = new T.CylinderGeometry(1.6, 2.0, 0.6, 16);
    const summitMat = new T.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5, emissive: 0xfacc15, emissiveIntensity: 0.18 });
    const summit = new T.Mesh(summitGeom, summitMat);
    summit.position.y = 9.0;
    summit.userData.tutorialId = 'summit';
    this.scene.add(summit);
    this.summitMesh = summit;
    console.log('[KanbanIsland] 🏔 Island terraces built : beach + refined + todo + mountain + summit');
  }

  private buildCliff(T: any) {
    // ─── Falaise du Doute (Blocked) : promontoire sombre côté nord ───
    const cliffGeom = new T.BoxGeometry(4.5, 3.5, 2.5);
    const cliffMat = new T.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.95, flatShading: true });
    const cliff = new T.Mesh(cliffGeom, cliffMat);
    cliff.position.set(-7, 3.5, -7);
    cliff.rotation.y = Math.PI / 5;
    cliff.userData.tutorialId = 'cliff';
    this.scene.add(cliff);

    // Vautour qui tournoie au-dessus
    const vultureGroup = new T.Group();
    const bodyGeom = new T.ConeGeometry(0.18, 0.5, 6);
    const bodyMat = new T.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    vultureGroup.add(body);
    // Ailes
    const wingGeom = new T.BoxGeometry(1.4, 0.04, 0.3);
    const wingMat = new T.MeshStandardMaterial({ color: 0x27272a, roughness: 0.7 });
    const wing = new T.Mesh(wingGeom, wingMat);
    vultureGroup.add(wing);
    vultureGroup.position.set(-7, 6.5, -7);
    this.vulture = vultureGroup;
    this.scene.add(vultureGroup);
    console.log('[KanbanIsland] 🪨 Cliff + vulture built');
  }

  private buildSummitFlag(T: any) {
    const poleGeom = new T.CylinderGeometry(0.04, 0.04, 1.6, 6);
    const poleMat = new T.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.5 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.set(0, 10.1, 0);

    const flagGeom = new T.PlaneGeometry(0.9, 0.55, 8, 4);
    const flagMat = new T.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      side: T.DoubleSide,
    });
    const flagMesh = new T.Mesh(flagGeom, flagMat);
    flagMesh.position.set(0.46, 10.55, 0);
    this.flag = flagMesh;
    // Sauvegarde positions pour flutter
    const fa = flagGeom.attributes.position;
    const flagOriginals = new Float32Array(fa.array.length);
    flagOriginals.set(fa.array);
    flagMesh.userData.originals = flagOriginals;

    const group = new T.Group();
    group.add(pole);
    group.add(flagMesh);
    this.scene.add(group);
    console.log('[KanbanIsland] 🚩 Summit flag planted');
  }

  private buildVolcano(T: any) {
    // Glow rouge au sommet (intensité ∝ volcano state)
    const glowGeom = new T.SphereGeometry(0.55, 16, 12);
    const glowMat = new T.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.0, // démarre éteint
      roughness: 0.4,
    });
    const glow = new T.Mesh(glowGeom, glowMat);
    glow.position.set(0, 9.3, 0);
    glow.userData.tutorialId = 'volcano';
    this.volcanoGlow = glow;
    this.scene.add(glow);

    // Light ponctuelle qu'on pourra varier
    const volcLight = new T.PointLight(0xff5722, 0.0, 10, 2);
    volcLight.position.set(0, 9.5, 0);
    glow.userData.light = volcLight;
    this.scene.add(volcLight);
  }

  private buildCampfire(T: any) {
    // Petit feu de camp central (vit pour cérémonie Aube et Retro)
    const group = new T.Group();
    // Bûches
    for (let i = 0; i < 3; i++) {
      const logGeom = new T.CylinderGeometry(0.07, 0.07, 0.45, 6);
      const logMat = new T.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
      const log = new T.Mesh(logGeom, logMat);
      log.position.set(Math.cos(i * 2.1) * 0.12, 1.35, Math.sin(i * 2.1) * 0.12);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * 1.2;
      group.add(log);
    }
    // Flamme (cone orange émissif)
    const flameGeom = new T.ConeGeometry(0.2, 0.55, 8);
    const flameMat = new T.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xf97316,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    });
    const flame = new T.Mesh(flameGeom, flameMat);
    flame.position.set(0, 1.65, 0);
    group.add(flame);
    group.userData.flame = flame;
    // Lumière chaleureuse
    const fireLight = new T.PointLight(0xff6e2c, 0.8, 6, 2);
    fireLight.position.set(0, 1.7, 0);
    group.add(fireLight);
    group.userData.light = fireLight;
    this.campfire = group;
    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : tickets — selon leur zone
  // ═══════════════════════════════════════════════════════════════════
  private buildTickets(tickets: IslandTicket[]) {
    const T = (window as any).THREE;
    // Cleanup
    this.disposeTickets();

    for (const t of tickets) {
      const mesh = this.createTicketMesh(t, T);
      this.ticketMeshes.push(mesh);
      this.ticketByMesh.set(mesh, t);
      this.scene.add(mesh);
    }
    console.log(`[KanbanIsland] 🎫 ${tickets.length} tickets placés sur l'île`);
  }

  private createTicketMesh(t: IslandTicket, T: any): any {
    const group = new T.Group();
    const pos = this.positionForZone(t.zone, t.id);

    if (t.zone === 'beach') {
      // 🍾 Bouteille à la mer : cylindre + cone (col) + matériau verre
      const bodyGeom = new T.CylinderGeometry(0.18, 0.2, 0.55, 12);
      const bodyMat = new T.MeshStandardMaterial({
        color: 0x86efac,
        roughness: 0.15,
        metalness: 0.35,
        transparent: true,
        opacity: 0.78,
        emissive: 0x065f46,
        emissiveIntensity: 0.2,
      });
      const body = new T.Mesh(bodyGeom, bodyMat);
      const neckGeom = new T.CylinderGeometry(0.07, 0.18, 0.18, 10);
      const neck = new T.Mesh(neckGeom, bodyMat);
      neck.position.y = 0.36;
      group.add(body); group.add(neck);
      group.rotation.z = Math.PI / 3 + Math.random() * 0.4; // couchée sur le sable
      group.userData.kind = 'bottle';
    } else if (t.zone === 'forest_refined') {
      // 🌱 Graine plantée (petite icosphère verte)
      const seedGeom = new T.IcosahedronGeometry(0.18, 0);
      const seedMat = new T.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x166534,
        emissiveIntensity: 0.4,
        roughness: 0.5,
      });
      const seed = new T.Mesh(seedGeom, seedMat);
      group.add(seed);
      group.userData.kind = 'seed';
    } else if (t.zone === 'forest_todo') {
      // 🌿 Jeune arbre (cylindre tronc + cone feuillage)
      const trunkGeom = new T.CylinderGeometry(0.05, 0.07, 0.45, 6);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      const leafGeom = new T.ConeGeometry(0.28, 0.6, 8);
      const leafMat = new T.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.7, emissive: 0x064e3b, emissiveIntensity: 0.15 });
      const leaf = new T.Mesh(leafGeom, leafMat);
      leaf.position.y = 0.45;
      group.add(trunk); group.add(leaf);
      group.userData.kind = 'sapling';
    } else if (t.zone === 'mountain_wip') {
      // 🐴 Mule transportant l'arbre (cube brun + cone vert au-dessus)
      const muleGeom = new T.BoxGeometry(0.32, 0.22, 0.5);
      const muleMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
      const mule = new T.Mesh(muleGeom, muleMat);
      const treeGeom = new T.ConeGeometry(0.2, 0.55, 7);
      const treeMat = new T.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
      const tree = new T.Mesh(treeGeom, treeMat);
      tree.position.y = 0.42;
      group.add(mule); group.add(tree);
      group.userData.kind = 'mule';
    } else if (t.zone === 'summit_done') {
      // 🌲 Arbre mature + drapeau planté
      const trunkGeom = new T.CylinderGeometry(0.08, 0.1, 0.65, 7);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      const crownGeom = new T.IcosahedronGeometry(0.32, 0);
      const crownColor = this.colorForPriority(t.priority);
      const crownMat = new T.MeshStandardMaterial({
        color: crownColor,
        emissive: crownColor,
        emissiveIntensity: 0.4,
        roughness: 0.55,
      });
      const crown = new T.Mesh(crownGeom, crownMat);
      crown.position.y = 0.6;
      // Mini drapeau accroché
      const flagGeom = new T.PlaneGeometry(0.22, 0.14);
      const flagMat = new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.6, side: T.DoubleSide });
      const flag = new T.Mesh(flagGeom, flagMat);
      flag.position.set(0.13, 0.85, 0);
      group.add(trunk); group.add(crown); group.add(flag);
      group.userData.kind = 'mature_tree';
    } else {
      // 🪨 Bloqué : arbre déraciné penché sur la falaise
      const trunkGeom = new T.CylinderGeometry(0.06, 0.09, 0.55, 6);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x44403c, roughness: 0.95 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      const leafGeom = new T.ConeGeometry(0.22, 0.45, 7);
      const leafMat = new T.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8, emissive: 0x450a0a, emissiveIntensity: 0.25 });
      const leaf = new T.Mesh(leafGeom, leafMat);
      leaf.position.y = 0.4;
      group.add(trunk); group.add(leaf);
      group.rotation.z = Math.PI / 4; // penché
      group.userData.kind = 'blocked_tree';
    }

    group.position.copy(pos);
    group.userData.ticket = t;
    group.userData.basePos = pos.clone();
    group.userData.phase = Math.random() * Math.PI * 2;
    return group;
  }

  private positionForZone(zone: IslandZone, id: number): any {
    const T = (window as any).THREE;
    // Distribution déterministe basée sur l'id pour éviter chevauchements
    const angle = (id * 137.508) * (Math.PI / 180); // golden angle
    switch (zone) {
      case 'beach': {
        const r = 12 + (id % 3) * 0.4;
        return new T.Vector3(Math.cos(angle) * r, 0.45, Math.sin(angle) * r);
      }
      case 'forest_refined': {
        const r = 7 + (id % 5) * 0.4;
        return new T.Vector3(Math.cos(angle) * r, 1.8, Math.sin(angle) * r);
      }
      case 'forest_todo': {
        const r = 4.5 + (id % 4) * 0.5;
        return new T.Vector3(Math.cos(angle) * r, 3.4, Math.sin(angle) * r);
      }
      case 'mountain_wip': {
        const r = 2.5 + (id % 4) * 0.4;
        const h = 5 + (id % 5) * 0.5;
        return new T.Vector3(Math.cos(angle) * r, h, Math.sin(angle) * r);
      }
      case 'summit_done': {
        const r = 0.6 + (id % 3) * 0.3;
        return new T.Vector3(Math.cos(angle) * r, 9.5, Math.sin(angle) * r);
      }
      case 'cliff_blocked': {
        // Cluster autour de la falaise
        return new T.Vector3(-7 + (Math.cos(angle) * 1.5), 5.2 + (id % 3) * 0.3, -7 + (Math.sin(angle) * 1.5));
      }
    }
  }

  private scatterTrees(T: any, n: number, y: number, radius: number, height: number, tag: string) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.55 + Math.random() * 0.4);
      const trunkGeom = new T.CylinderGeometry(0.08, 0.12, 0.7, 6);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      trunk.position.set(Math.cos(a) * r, y + 0.35, Math.sin(a) * r);
      const leafGeom = new T.ConeGeometry(0.45, 1.0, 8);
      const leafMat = new T.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7, emissive: 0x052e16, emissiveIntensity: 0.15 });
      const leaf = new T.Mesh(leafGeom, leafMat);
      leaf.position.set(trunk.position.x, trunk.position.y + 0.7, trunk.position.z);
      leaf.userData.basePos = leaf.position.clone();
      leaf.userData.phase = Math.random() * Math.PI * 2;
      leaf.userData.tag = tag;
      this.trees.push(leaf);
      this.scene.add(trunk);
      this.scene.add(leaf);
    }
  }

  private createFireflies(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 1] = 1.5 + Math.random() * 7;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0x7dd3fc, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    const fireflies = new T.Points(geom, mat);
    fireflies.userData.kind = 'fireflies';
    this.scene.add(fireflies);
  }

  private createStars(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 80;
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xfff4d4, size: 0.4, sizeAttenuation: true, transparent: true, opacity: 0.6 });
    const stars = new T.Points(geom, mat);
    stars.userData.kind = 'stars';
    this.scene.add(stars);
  }

  private buildRain(T: any) {
    if (this.rainParticles) return;
    const count = 800;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = 5 + Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      velocities[i] = 0.18 + Math.random() * 0.22;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xbae6fd, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.6 });
    this.rainParticles = new T.Points(geom, mat);
    this.rainParticles.userData.velocities = velocities;
    this.rainParticles.userData.kind = 'rain';
    this.scene.add(this.rainParticles);
  }

  private disposeRain() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry?.dispose();
      this.rainParticles.material?.dispose();
      this.rainParticles = null;
    }
  }

  private disposeTickets() {
    for (const m of this.ticketMeshes) this.scene.remove(m);
    this.ticketMeshes = [];
    this.ticketByMesh.clear();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA — 30 tickets répartis dans les zones
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const now = Date.now();
    const day = 86400000;
    const assignees = [
      { name: 'Ramzy', color: '#86efac' },
      { name: 'Alice', color: '#60a5fa' },
      { name: 'Bob',   color: '#fbbf24' },
      { name: 'Maya',  color: '#f472b6' },
      { name: 'Yves',  color: '#a78bfa' },
      { name: 'Léa',   color: '#fb923c' },
    ];
    const titles = [
      'Login OAuth Google',
      'Refonte page profil',
      'Migration Postgres 16',
      'Animation 3D Yamzy',
      'Fix bug timezone',
      'Export Excel sprints',
      'Notifs websocket',
      'Dark mode toggle',
      'Search facets API',
      'CI cache Docker',
      'Onboarding video',
      'Webhook Slack',
      'Rate limit redis',
      'Logs structurés',
      'Tests E2E auth',
      'Refactor module billing',
      'Upgrade Angular 18',
      'Localisation FR/EN',
      'Backup S3 nightly',
      'Metrics Prometheus',
      'A11y audit modal',
      'API GraphQL POC',
      'Lazy load routes',
      'Réécriture parser CSV',
      'Audit SQL N+1',
      'Bouton retour clavier',
      'Cron archivage',
      'Email transactionnel',
      'Hot reload extensions',
      'Documentation API',
    ];
    const zoneDistribution: IslandZone[] = [
      ...Array(7).fill('beach'),
      ...Array(5).fill('forest_refined'),
      ...Array(4).fill('forest_todo'),
      ...Array(6).fill('mountain_wip'),
      ...Array(5).fill('summit_done'),
      ...Array(3).fill('cliff_blocked'),
    ];
    const blockedReasons = [
      'Attente review architecture',
      'Dépendance externe down',
      'Spec ambiguë, besoin PO',
    ];
    const out: IslandTicket[] = [];
    for (let i = 0; i < 30; i++) {
      const zone = zoneDistribution[i];
      const a = assignees[i % assignees.length];
      out.push({
        id: 1000 + i,
        title: titles[i],
        zone,
        priority: 1 + ((i * 7) % 4),
        storyPoints: [1, 2, 3, 5, 8][i % 5],
        assignee: a.name,
        assigneeColor: a.color,
        dueDate: new Date(now + (((i * 3) % 14) - 3) * day),
        blockedReason: zone === 'cliff_blocked' ? blockedReasons[i % blockedReasons.length] : undefined,
        createdAt: now - i * 3600000 * 6,
      });
    }
    this.tickets.set(out);
    this.buildTickets(out);
    this.emitCeremony({ type: 'debarquement', label: '🚢 Débarquement · 30 voyageurs sur l\'archipel', icon: '🚢' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES & EVENTS TEMPORELS
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('kanban-island', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1400);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 SPLASH OVERLAY — Welcome screen handlers
  // ═══════════════════════════════════════════════════════════════════
  /** Quand l'utilisateur clique "Lancer le play" sur le splash */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    // Démarre le play example du narrator pour cette room (idx 0 = principal)
    this.narrator.startPlayExample(0);
  }

  /** Quand l'utilisateur clique "Entrer" (skip le play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
  }

  /** ⏱ Lance le mode TIMEBOX RÉEL — HUD countdown avec la vraie durée Scrum, sans narration. */
  onSplashTimebox(): void {
    this.splashVisible.set(false);
    this.narrator.startTimeboxOnly(900, 'Daily Standup');
  }

  triggerTide() {
    // 🌊 Marée qui monte — anime le niveau d'eau quelques secondes
    this.tideOffset = 0.8;
    this.emitCeremony({ type: 'aube', label: '🌅 Aube · Marée qui monte (deadline imminente)', icon: '🌊' });
    setTimeout(() => { this.tideOffset = 0; }, 4500);
  }

  toggleStorm() {
    const T = (window as any).THREE;
    const next = !this.stormActive();
    this.stormActive.set(next);
    if (next) {
      this.buildRain(T);
      this.emitCeremony({ type: 'feu', label: '⛈ Tempête · Sprint review imminente', icon: '⛈' });
    } else {
      this.disposeRain();
    }
  }

  toggleVolcano() {
    const next = !this.volcanoActive();
    this.volcanoActive.set(next);
    if (next) {
      this.emitCeremony({ type: 'sommet', label: '🌋 Volcan gronde · Release imminente', icon: '🌋' });
    }
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(22, 18, 22);
    this.camera.lookAt(0, 2, 0);
    if (this.controls) this.controls.target.set(0, 3, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoqués par le playExample tutorial JSON
  // (chaque méthode public est appelable via narrator.invokeMethod)
  // ═══════════════════════════════════════════════════════════════════

  /** 🚢 ARRIVÉE CARGO — 5 nouvelles bouteilles s'échouent sur la plage avec animation tide */
  arriveCargo() {
    const T = (window as any).THREE;
    const now = Date.now();
    const newTickets: IslandTicket[] = [];
    const titles = ['Refactor checkout', 'Notif push iOS', 'Migration secrets vault', 'SDK Python v2', 'Audit GDPR'];
    const assignees = [
      { name: 'Ramzy', color: '#86efac' }, { name: 'Alice', color: '#60a5fa' },
      { name: 'Bob', color: '#fbbf24' },   { name: 'Maya', color: '#f472b6' },
      { name: 'Léa', color: '#fb923c' },
    ];
    for (let i = 0; i < 5; i++) {
      const nextId = 2000 + Math.floor(Math.random() * 800) + i;
      const a = assignees[i];
      const t: IslandTicket = {
        id: nextId,
        title: titles[i],
        zone: 'beach',
        priority: 1 + (i % 4),
        storyPoints: [1, 2, 3, 5, 8][i % 5],
        assignee: a.name,
        assigneeColor: a.color,
        dueDate: new Date(now + 7 * 86400000),
        createdAt: now,
      };
      newTickets.push(t);
    }
    const current = this.tickets();
    this.tickets.set([...current, ...newTickets]);

    // Crée les meshes : départ à la mer (loin), arrivée plage
    for (let i = 0; i < newTickets.length; i++) {
      const t = newTickets[i];
      const mesh = this.createTicketMesh(t, T);
      this.ticketMeshes.push(mesh);
      this.ticketByMesh.set(mesh, t);
      const target = this.positionForZone('beach', t.id);
      // Start position : loin en mer côté est
      const farAngle = (i / 5) * Math.PI * 0.6 + Math.PI * 0.2;
      const start = new T.Vector3(Math.cos(farAngle) * 32, 0.6, Math.sin(farAngle) * 32);
      mesh.position.copy(start);
      mesh.userData.basePos = target.clone();
      mesh.userData.tweening = true;
      this.scene.add(mesh);
      // Tween vers la plage avec arc Y
      const dur = 2.0 + i * 0.18;
      this.tween(mesh.position, start, target, dur, target.y + 1.2, () => { mesh.userData.tweening = false; });
    }
    this.emitCeremony({ type: 'debarquement', label: '🚢 Sprint Planning · 5 nouveaux tickets', icon: '🚢' });
    // Marée brève pour aider l'illusion
    this.tideOffset = 0.5;
    setTimeout(() => { this.tideOffset = 0; }, 3000);
  }

  /** 🚶 MIGRATION TICKETS — déplace N tickets de zone A → zone B avec arc parabolique */
  migrateTickets(fromZone: IslandZone, toZone: IslandZone, count: number = 3) {
    const T = (window as any).THREE;
    const tickets = this.tickets();
    const movers = tickets.filter(t => t.zone === fromZone).slice(0, count);
    if (movers.length === 0) return;
    // Trouve les meshes correspondants
    for (const ticket of movers) {
      let mesh: any = null;
      for (const m of this.ticketMeshes) {
        if (this.ticketByMesh.get(m)?.id === ticket.id) { mesh = m; break; }
      }
      if (!mesh) continue;
      const from = mesh.position.clone();
      const targetPos = this.positionForZone(toZone, ticket.id);
      // Tween arc parabolique (Y + peak)
      const peak = Math.max(from.y, targetPos.y) + 3;
      mesh.userData.tweening = true;
      this.tween(mesh.position, from, targetPos, 1.8, peak, () => {
        // Une fois arrivé : update data + recréer le mesh dans le bon style
        ticket.zone = toZone;
        this.scene.remove(mesh);
        const idx = this.ticketMeshes.indexOf(mesh);
        if (idx >= 0) this.ticketMeshes.splice(idx, 1);
        this.ticketByMesh.delete(mesh);
        const newMesh = this.createTicketMesh(ticket, T);
        this.ticketMeshes.push(newMesh);
        this.ticketByMesh.set(newMesh, ticket);
        this.scene.add(newMesh);
      });
    }
    // Force le rafraîchissement des compteurs zone
    this.tickets.set([...tickets]);
  }

  /** 🌅 DAWN RITUAL — daily stand-up : feu brille, lumière dorée 4s */
  dawnRitual() {
    const T = (window as any).THREE;
    if (this.campfire?.userData.light) {
      this.campfire.userData.light.intensity = 2.4;
    }
    if (!this.dawnGlow) {
      this.dawnGlow = new T.PointLight(0xfde047, 2.5, 60, 1.4);
      this.dawnGlow.position.set(0, 14, 0);
      this.scene.add(this.dawnGlow);
    }
    this.emitCeremony({ type: 'aube', label: '🌅 Daily Stand-up · Cercle de l\'Aube', icon: '🌅' });
    setTimeout(() => {
      if (this.campfire?.userData.light) this.campfire.userData.light.intensity = 0.8;
      if (this.dawnGlow) { this.scene.remove(this.dawnGlow); this.dawnGlow.dispose?.(); this.dawnGlow = null; }
    }, 4500);
  }

  /** 🏁 PLANT FLAGS — les arbres au sommet brillent + le grand drapeau s'illumine */
  plantFlags() {
    const T = (window as any).THREE;
    if (this.flag) {
      const m = this.flag.material;
      m.emissiveIntensity = 2.4;
      m.color = new T.Color(0xfde047);
      m.emissive = new T.Color(0xfacc15);
      setTimeout(() => { m.emissiveIntensity = 0.35; m.color = new T.Color(0x7dd3fc); m.emissive = new T.Color(0x0ea5e9); }, 4500);
    }
    if (this.summitMesh) {
      const m = this.summitMesh.material;
      const prev = m.emissiveIntensity;
      m.emissiveIntensity = 1.4;
      setTimeout(() => m.emissiveIntensity = prev, 4500);
    }
    // Boost emissive des mature_trees
    for (const mesh of this.ticketMeshes) {
      if (mesh.userData.kind === 'mature_tree') {
        mesh.traverse((o: any) => {
          if (o.material && 'emissiveIntensity' in o.material) {
            o.userData._prev = o.material.emissiveIntensity;
            o.material.emissiveIntensity = 1.5;
          }
        });
      }
    }
    setTimeout(() => {
      for (const mesh of this.ticketMeshes) {
        if (mesh.userData.kind === 'mature_tree') {
          mesh.traverse((o: any) => {
            if (o.material && 'emissiveIntensity' in o.material && o.userData._prev !== undefined) {
              o.material.emissiveIntensity = o.userData._prev;
            }
          });
        }
      }
    }, 4500);
    this.emitCeremony({ type: 'sommet', label: '🏔 Sprint Review · Drapeaux plantés', icon: '🏁' });
  }

  /** 🌋 VOLCAN ERUPT — éruption complète : volcan ON + particules + flash + camera shake */
  volcanoErupt() {
    const T = (window as any).THREE;
    this.volcanoActive.set(true);
    // Burst de particules cendres + lave
    const count = 240;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 1] = 9.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.07 + Math.random() * 0.15;
      velocities[i * 3 + 0] = Math.cos(ang) * speed * 0.5;
      velocities[i * 3 + 1] = 0.18 + Math.random() * 0.22;
      velocities[i * 3 + 2] = Math.sin(ang) * speed * 0.5;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xff7043, size: 0.25, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: T.AdditiveBlending });
    const burst = new T.Points(geom, mat);
    burst.userData = { kind: 'eruption-burst', velocities, age: 0, ttl: 3.5 };
    this.activeBursts.push(burst);
    this.scene.add(burst);
    this.emitCeremony({ type: 'sommet', label: '🌋 Release Deployed · Éruption !', icon: '🌋' });
    setTimeout(() => this.volcanoActive.set(false), 8000);
  }

  /** 🌫 NIGHT FALL — fade à la nuit (assombrit ciel + étoiles plus fortes) */
  nightFall() {
    const T = (window as any).THREE;
    if (this.scene.background?.set) {
      // Animate background to deeper blue
      const start = this.scene.background.clone();
      const end = new T.Color(0x020a1f);
      const startTime = performance.now();
      const dur = 1200;
      const step = () => {
        const t = Math.min(1, (performance.now() - startTime) / dur);
        this.scene.background.r = start.r + (end.r - start.r) * t;
        this.scene.background.g = start.g + (end.g - start.g) * t;
        this.scene.background.b = start.b + (end.b - start.b) * t;
        if (t < 1) requestAnimationFrame(step);
      };
      step();
    }
    // Reset après 8s
    setTimeout(() => {
      if (this.scene.background?.set) {
        const start = this.scene.background.clone();
        const end = new T.Color(0x051a2e);
        const startTime = performance.now();
        const dur = 1500;
        const step = () => {
          const t = Math.min(1, (performance.now() - startTime) / dur);
          this.scene.background.r = start.r + (end.r - start.r) * t;
          this.scene.background.g = start.g + (end.g - start.g) * t;
          this.scene.background.b = start.b + (end.b - start.b) * t;
          if (t < 1) requestAnimationFrame(step);
        };
        step();
      }
    }, 8000);
  }

  /** 🦅 VULTURE DIVE — vautour plonge sur la falaise (focus blocked) */
  vultureDive() {
    if (!this.vulture) return;
    const T = (window as any).THREE;
    const startPos = this.vulture.position.clone();
    const targetPos = new T.Vector3(-7, 4.2, -7);
    this.tween(this.vulture.position, startPos, targetPos, 1.2, undefined, () => {
      setTimeout(() => {
        this.tween(this.vulture.position, this.vulture.position.clone(), startPos, 1.6);
      }, 800);
    });
    this.emitCeremony({ type: 'feu', label: '🦅 Vautour du Doute · Tickets bloqués', icon: '🦅' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🛠 TWEEN HELPER (interpolations executées dans animate())
  // ═══════════════════════════════════════════════════════════════════
  private tween(target: any, from: any, to: any, duration: number, arcPeak?: number, onDone?: () => void) {
    this.activeTweens.push({
      obj: target,
      from: { x: from.x, y: from.y, z: from.z },
      to: { x: to.x, y: to.y, z: to.z, peak: arcPeak },
      startTime: performance.now(),
      duration: duration * 1000,
      onDone,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic ticket → afficher détail
  // ═══════════════════════════════════════════════════════════════════
  private handleCanvasClick(e: MouseEvent) {
    if (!this.camera || !this.raycaster) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    // 🌀 Test portail (priorité haute, navigation)
    const portalTarget = this.portal?.hitTest(this.raycaster);
    if (portalTarget) {
      this.router.navigate([portalTarget]);
      return;
    }
    // Test contre tous les enfants récursifs des groupes ticket
    const intersects = this.raycaster.intersectObjects(this.ticketMeshes, true);
    if (intersects.length > 0) {
      // Remonter au groupe parent
      let target = intersects[0].object;
      while (target && !this.ticketByMesh.has(target) && target.parent) target = target.parent;
      const ticket = this.ticketByMesh.get(target);
      if (ticket) {
        this.selectedTicket.set(ticket);
        // Petit flash de zoom
        target.scale.set(1.45, 1.45, 1.45);
        setTimeout(() => target.scale.set(1, 1, 1), 220);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.windTime += dt;

    // ─── Vagues océan (ondulation des sommets) ───
    if (this.water?.geometry?.attributes?.position) {
      const pos = this.water.geometry.attributes.position;
      const orig = this.water.userData.originals;
      for (let i = 0; i < pos.count; i++) {
        const x = orig[i * 3 + 0];
        const z = orig[i * 3 + 2];
        const wave = Math.sin(this.windTime * 1.2 + x * 0.3) * 0.18
                   + Math.cos(this.windTime * 0.8 + z * 0.25) * 0.15;
        pos.array[i * 3 + 1] = orig[i * 3 + 1] + wave;
      }
      pos.needsUpdate = true;
      // Marée
      this.water.position.y = this.waterBaseY + this.tideOffset + Math.sin(this.windTime * 0.3) * 0.05;
    }

    // ─── Drapeau au sommet (flutter) ───
    if (this.flag?.geometry?.attributes?.position) {
      const pos = this.flag.geometry.attributes.position;
      const orig = this.flag.userData.originals;
      for (let i = 0; i < pos.count; i++) {
        const x = orig[i * 3 + 0];
        const flutter = Math.sin(this.windTime * 4 + x * 6) * 0.05 * (x + 0.45);
        pos.array[i * 3 + 2] = orig[i * 3 + 2] + flutter;
      }
      pos.needsUpdate = true;
    }

    // ─── Wind sway on trees ───
    for (const leaf of this.trees) {
      const base = leaf.userData.basePos;
      if (base) {
        leaf.position.x = base.x + Math.sin(this.windTime * 1.4 + leaf.userData.phase) * 0.06;
        leaf.position.z = base.z + Math.cos(this.windTime * 1.1 + leaf.userData.phase) * 0.05;
      }
    }

    // ─── Tickets : animation contextuelle ───
    for (const m of this.ticketMeshes) {
      // Skip si en cours de tween cinematic (arriveCargo / migrateTickets)
      if (m.userData.tweening) continue;
      const kind = m.userData.kind;
      const base = m.userData.basePos;
      const phase = m.userData.phase || 0;
      if (kind === 'bottle' && base) {
        // Bouteilles flottent doucement avec la mer
        m.position.y = base.y + Math.sin(this.windTime * 1.5 + phase) * 0.08 + this.tideOffset * 0.3;
        m.rotation.y += dt * 0.4;
      } else if (kind === 'seed' && base) {
        m.position.y = base.y + Math.sin(this.windTime * 2 + phase) * 0.04;
        m.rotation.y += dt * 0.6;
      } else if (kind === 'sapling') {
        m.rotation.z = Math.sin(this.windTime * 1.5 + phase) * 0.05;
      } else if (kind === 'mule' && base) {
        // Mules avancent doucement vers le sommet (montée)
        const climb = 0.4 * Math.sin(this.windTime * 0.5 + phase);
        m.position.y = base.y + climb * 0.15;
        m.rotation.y = Math.sin(this.windTime * 0.3 + phase) * 0.2;
      } else if (kind === 'mature_tree') {
        m.rotation.z = Math.sin(this.windTime * 1.2 + phase) * 0.03;
      } else if (kind === 'blocked_tree') {
        // Tremblement subtil (instabilité)
        m.rotation.x = Math.sin(this.windTime * 3 + phase) * 0.015;
      }
    }

    // ─── Vautour qui tournoie au-dessus de la falaise ───
    if (this.vulture) {
      const t = this.windTime * 0.6;
      this.vulture.position.x = -7 + Math.cos(t) * 2.2;
      this.vulture.position.z = -7 + Math.sin(t) * 2.2;
      this.vulture.position.y = 6.8 + Math.sin(this.windTime * 1.5) * 0.3;
      this.vulture.rotation.y = -t + Math.PI / 2;
    }

    // ─── Feu de camp (flicker) ───
    if (this.campfire?.userData.flame) {
      const f = this.campfire.userData.flame;
      f.scale.y = 0.9 + Math.sin(this.windTime * 8) * 0.18 + Math.random() * 0.08;
      f.scale.x = 0.95 + Math.cos(this.windTime * 7) * 0.1;
      if (this.campfire.userData.light) {
        this.campfire.userData.light.intensity = 0.7 + Math.sin(this.windTime * 9) * 0.25;
      }
    }

    // ─── Volcan (intensité variable si actif) ───
    if (this.volcanoGlow) {
      const targetOpacity = this.volcanoActive() ? (0.7 + Math.sin(this.windTime * 5) * 0.25) : 0;
      this.volcanoGlow.material.opacity += (targetOpacity - this.volcanoGlow.material.opacity) * 0.05;
      const targetEmissive = this.volcanoActive() ? (1.2 + Math.sin(this.windTime * 6) * 0.6) : 0.0;
      this.volcanoGlow.material.emissiveIntensity = targetEmissive;
      if (this.volcanoGlow.userData.light) {
        const targetLight = this.volcanoActive() ? (2.0 + Math.sin(this.windTime * 4) * 0.8) : 0;
        this.volcanoGlow.userData.light.intensity += (targetLight - this.volcanoGlow.userData.light.intensity) * 0.05;
      }
      this.volcanoGlow.scale.setScalar(1 + Math.sin(this.windTime * 3) * 0.1);
    }

    // ─── Pluie tempête ───
    if (this.rainParticles) {
      const pos = this.rainParticles.geometry.attributes.position;
      const vels = this.rainParticles.userData.velocities;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] -= vels[i];
        if (pos.array[i * 3 + 1] < 0.2) {
          pos.array[i * 3 + 1] = 18 + Math.random() * 5;
          pos.array[i * 3 + 0] = (Math.random() - 0.5) * 30;
          pos.array[i * 3 + 2] = (Math.random() - 0.5) * 30;
        }
      }
      pos.needsUpdate = true;
    }

    // ─── Lucioles + étoiles scintillent ───
    this.scene.traverse((obj: any) => {
      if (obj.userData?.kind === 'fireflies' && obj.material) {
        obj.material.opacity = 0.55 + Math.sin(this.windTime * 2.5) * 0.3;
      }
      if (obj.userData?.kind === 'stars' && obj.material) {
        obj.material.opacity = 0.5 + Math.sin(this.windTime * 0.5) * 0.15;
      }
    });

    // ─── TWEENS actifs (arcs ticket migration, cargo arrival, vautour dive) ───
    if (this.activeTweens.length > 0) {
      const now = performance.now();
      const done: number[] = [];
      for (let i = 0; i < this.activeTweens.length; i++) {
        const tw = this.activeTweens[i];
        const t = Math.min(1, (now - tw.startTime) / tw.duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out quad
        tw.obj.x = tw.from.x + (tw.to.x - tw.from.x) * e;
        tw.obj.z = tw.from.z + (tw.to.z - tw.from.z) * e;
        if (tw.to.peak !== undefined) {
          // Y suit un arc parabolique : 0 → peak → 0 relatif à la ligne base
          const ybase = tw.from.y + (tw.to.y - tw.from.y) * e;
          const arc = (tw.to.peak - Math.max(tw.from.y, tw.to.y)) * (4 * t * (1 - t));
          tw.obj.y = ybase + arc;
        } else {
          tw.obj.y = tw.from.y + (tw.to.y - tw.from.y) * e;
        }
        if (t >= 1) {
          done.push(i);
          if (tw.onDone) {
            try { tw.onDone(); } catch (e) { console.warn('[KanbanIsland] tween onDone error', e); }
          }
        }
      }
      // Remove finished tweens (en sens inverse pour préserver les indices)
      for (let i = done.length - 1; i >= 0; i--) this.activeTweens.splice(done[i], 1);
    }

    // ─── BURSTS de particules (éruption volcan) ───
    if (this.activeBursts.length > 0) {
      const doneB: number[] = [];
      for (let bi = 0; bi < this.activeBursts.length; bi++) {
        const burst = this.activeBursts[bi];
        burst.userData.age += dt;
        const pos = burst.geometry.attributes.position;
        const vels = burst.userData.velocities;
        for (let i = 0; i < pos.count; i++) {
          pos.array[i * 3 + 0] += vels[i * 3 + 0] * dt * 60;
          pos.array[i * 3 + 1] += vels[i * 3 + 1] * dt * 60;
          pos.array[i * 3 + 2] += vels[i * 3 + 2] * dt * 60;
          vels[i * 3 + 1] -= 0.012; // gravité
        }
        pos.needsUpdate = true;
        // Fade opacity au-dessus de 50%
        const ratio = burst.userData.age / burst.userData.ttl;
        burst.material.opacity = Math.max(0, 0.95 * (1 - Math.pow(ratio, 1.5)));
        if (ratio >= 1) doneB.push(bi);
      }
      for (let i = doneB.length - 1; i >= 0; i--) {
        const burst = this.activeBursts[doneB[i]];
        this.scene.remove(burst);
        burst.geometry?.dispose();
        burst.material?.dispose();
        this.activeBursts.splice(doneB[i], 1);
      }
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.windTime);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS template
  // ═══════════════════════════════════════════════════════════════════
  zoneCount(zone: IslandZone): number {
    return this.tickets().filter(t => t.zone === zone).length;
  }

  zoneLabel(zone: IslandZone): string {
    switch (zone) {
      case 'beach':           return '🌊 Plage de l\'Aurore';
      case 'forest_refined':  return '🌳 Forêt du Cadrage';
      case 'forest_todo':     return '🛤 Sentier en Forêt';
      case 'mountain_wip':    return '⛰ Montagne du Build';
      case 'summit_done':     return '🏔 Sommet du Sanctuaire';
      case 'cliff_blocked':   return '🪨 Falaise du Doute';
    }
  }

  private colorForPriority(p: number): number {
    switch (p) {
      case 4: return 0xdc2626; // critique
      case 3: return 0xf97316; // haute
      case 2: return 0xfacc15; // moyenne
      default: return 0x86efac; // basse
    }
  }

  fmtAgo(ts: number): string {
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'il y a quelques minutes';
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  }

  fmtDue(d: Date): string {
    const diff = d.getTime() - Date.now();
    const days = Math.round(diff / 86400000);
    if (days === 0) return 'Aujourd\'hui';
    if (days === 1) return 'Demain';
    if (days > 0) return `Dans ${days}j`;
    return `En retard ${-days}j`;
  }

  private onResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
