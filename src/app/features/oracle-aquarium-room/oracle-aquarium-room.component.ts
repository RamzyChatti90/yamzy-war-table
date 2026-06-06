// ═══════════════════════════════════════════════════════════════════
// 🐠 ORACLE AQUARIUM ROOM — L'Étang des Voix
//
// Mécanique data unique : un grand aquarium magique 3D rempli de
// poissons-paroles (interviews). Tu observes par toutes les faces.
//
// Implémentation : Three.js procedural pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🐠 Arrivée banc      = 5 nouvelles interviews (jet d'eau bleu)
//   🪼 Alerte méduse     = pain point critique (pulse violet)
//   🦅 Plongée aigle     = weekly summary (or scintillant)
//   💰 Trésor scintille  = persona archétype consolidé (étincelles dorées)
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { createPortal3D, getIslandForRoom, PortalHandle } from '../../core/portal/portal.factory';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent, SpellFooterService } from '../../core/spell-ui';

// ─── Modèles data ───
interface OracleInterview {
  id: number;
  persona: string;           // segment persona
  personaColor: string;      // couleur du poisson
  participant: string;
  durationMin: number;       // taille du poisson
  date: string;
  keyQuote: string;
  segment: 'B2B' | 'B2C' | 'Internal';
}

interface OraclePersona {
  id: number;
  name: string;
  segment: 'B2B' | 'B2C' | 'Internal';
  color: string;
  archetypeUnlocked: boolean;
}

interface OracleJellyfish {
  id: number;
  painPoint: string;
  severity: number;          // 1-5
  mentionCount: number;
}

interface OracleCoral {
  theme: string;             // JTBD
  color: string;
}

@Component({
  selector: 'wt-oracle-aquarium-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="oa-host">
      <header class="oa-topbar">
        <div class="oa-title">
          <h1>🐠 ORACLE AQUARIUM</h1>
          <p>L'Étang des Voix — {{ interviews().length }} interviews · {{ patternsDetected() }} patterns · {{ activeAlerts() }} alertes méduses</p>
        </div>
        <div class="oa-legend">
          <span class="dot fish"></span>interview
          <span class="dot jelly"></span>pain point
          <span class="dot coral"></span>JTBD
          <span class="dot treasure"></span>archétype
        </div>
      </header>

      <canvas #canvas class="oa-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="oa-flash" [attr.data-type]="f.type">
        <div class="oa-flash-content">
          <div class="oa-flash-icon">{{ f.icon }}</div>
          <div class="oa-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel interview info -->
      <div *ngIf="selectedInterview() as i" class="oa-panel">
        <button class="oa-panel-close" (click)="selectedInterview.set(null)">×</button>
        <div class="oa-panel-head">
          <strong class="oa-panel-persona" [style.color]="i.personaColor">🐠 {{ i.persona }}</strong>
          <span class="oa-panel-seg">{{ i.segment }}</span>
        </div>
        <div class="oa-panel-meta">
          <span>{{ i.participant }}</span> · <span>{{ i.durationMin }} min</span> · <span>{{ i.date }}</span>
        </div>
        <div class="oa-panel-quote">« {{ i.keyQuote }} »</div>
      </div>

      <!-- Panel méduse pain point -->
      <div *ngIf="selectedJellyfish() as j" class="oa-panel oa-panel-jelly">
        <button class="oa-panel-close" (click)="selectedJellyfish.set(null)">×</button>
        <div class="oa-panel-head">
          <strong>🪼 Pain point</strong>
          <span class="oa-panel-sev">sev {{ j.severity }}/5</span>
        </div>
        <div class="oa-panel-quote">{{ j.painPoint }}</div>
        <div class="oa-panel-meta">{{ j.mentionCount }} mentions</div>
      </div>

      <!-- 🎬 Welcome splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Oracle Aquarium"
        loreName="L'Étang des Voix"
        color="#a855f7"
        oneLiner="30 poissons-interviews, 3 méduses pain points, trésor persona."
        [duration]="65"
        [timeboxDurationS]="1800"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Oracle Aquarium"
        loreName="L'Étang des Voix"
        accent="#a78bfa"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .oa-host { position: relative; width: 100%; height: 100vh; background: #0a0a1a; color: #e8eaf6; font-family: "Tinos", serif; }
    .oa-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(10,10,30,0.75) 0%, rgba(10,10,30,0) 100%); pointer-events: none; }
    .oa-topbar > * { pointer-events: auto; }
    .oa-back { color: #c4b5fd; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #7c3aed; border-radius: 8px; background: rgba(40,20,80,0.4); }
    .oa-back:hover { background: rgba(124,58,237,0.4); }
    .oa-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1px; color: #c4b5fd; }
    .oa-title p  { margin: 2px 0 0; font-size: 11px; opacity: 0.7; }
    .oa-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; }
    .oa-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .oa-legend .fish     { background: #60a5fa; }
    .oa-legend .jelly    { background: #c084fc; box-shadow: 0 0 8px #c084fc; }
    .oa-legend .coral    { background: #fb7185; }
    .oa-legend .treasure { background: #facc15; box-shadow: 0 0 8px #facc15; }

    .oa-canvas { display: block; width: 100%; height: 100%; }
    .oa-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(10,10,30,0.75) 0%, rgba(10,10,30,0) 100%); }
    .oa-controls button { background: rgba(40,20,80,0.7); color: #e8eaf6; border: 1px solid #7c3aed; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .oa-controls button:hover { background: rgba(124,58,237,0.6); }
    .oa-controls .oa-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .oa-controls .oa-narrator:hover { background: rgba(251,191,36,0.3); }
    .oa-controls .oa-narrator.oa-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .oa-controls .oa-narrator.oa-play:hover { background: #f5b923; }
    .oa-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .oa-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: oa-flash-pulse 1.5s ease-out forwards; }
    .oa-flash[data-type="bank"]     { background: radial-gradient(circle at center, rgba(96,165,250,0.55), transparent 60%); }
    .oa-flash[data-type="jelly"]    { background: radial-gradient(circle at center, rgba(168,85,247,0.6), transparent 60%); }
    .oa-flash[data-type="eagle"]    { background: radial-gradient(circle at center, rgba(250,204,21,0.65), transparent 65%); }
    .oa-flash[data-type="treasure"] { background: radial-gradient(circle at center, rgba(250,204,21,0.75), transparent 70%); }
    .oa-flash-content { text-align: center; animation: oa-flash-grow 1.5s cubic-bezier(0.16, 1, 0.3, 1); }
    .oa-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .oa-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.5); }
    @keyframes oa-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes oa-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    /* Panel interview / méduse */
    .oa-panel { position: absolute; right: 22px; top: 80px; width: 300px; padding: 14px; background: rgba(20,15,40,0.92); border: 1px solid #7c3aed; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; }
    .oa-panel-jelly { border-color: #c084fc; background: rgba(40,15,60,0.92); top: 250px; }
    .oa-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(196, 181, 253, 0.4); border-radius: 50%; color: #c4b5fd; cursor: pointer; }
    .oa-panel-head { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; justify-content: space-between; }
    .oa-panel-persona { font-weight: 700; }
    .oa-panel-seg { font-size: 10px; padding: 2px 6px; border: 1px solid #7c3aed; border-radius: 6px; opacity: 0.85; }
    .oa-panel-sev { font-size: 10px; color: #fda4af; }
    .oa-panel-meta { font-size: 11px; opacity: 0.7; margin-top: 6px; }
    .oa-panel-quote { color: #e0d4ff; margin: 8px 0; line-height: 1.5; font-style: italic; }
  `]
})
export class OracleAquariumRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── State signals ───
  interviews = signal<OracleInterview[]>([]);
  personas   = signal<OraclePersona[]>([]);
  jellyfish  = signal<OracleJellyfish[]>([]);
  corals     = signal<OracleCoral[]>([]);
  selectedInterview = signal<OracleInterview | null>(null);
  selectedJellyfish = signal<OracleJellyfish | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  filterMode = signal<'all' | 'B2B'>('all');
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🐠', title: '30 poissons = 30 interviews user', body: 'Chaque poisson coloré qui nage dans l\'étang est une interview utilisateur. Sa taille = la durée, sa couleur = le segment.' },
    { icon: '🪼', title: 'Méduses = pain points critiques', body: 'Les 3 méduses violettes pulsent. Chacune représente une douleur récurrente détectée dans plusieurs interviews.' },
    { icon: '🦅', title: 'Plongée aigle = weekly summary', body: 'Une fois par semaine, l\'aigle plonge et ressort les insights synthétiques. Étincelles dorées au-dessus de l\'eau.' },
    { icon: '💰', title: 'Trésor = persona consolidé', body: 'Quand un archétype utilisateur se stabilise (3+ interviews convergentes), un trésor scintille au fond — c\'est votre persona.' },
    { icon: '🎣', title: 'Cliquer un poisson = lire la transcription', body: 'Cliquez sur un poisson pour ouvrir la fiche interview : citations, verbatim, tags émotionnels.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque poisson est une interview utilisateur.',
    'Les méduses pulsent sur les pain points critiques.',
    'L\'aigle plonge chaque semaine pour synthétiser.',
    'Le trésor scintille quand un persona émerge.',
    'Cliquez un poisson pour lire la transcription.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  patternsDetected = computed(() => {
    // Heuristique : nombre de groupes de personas avec ≥5 interviews
    const counts = new Map<string, number>();
    for (const it of this.interviews()) counts.set(it.persona, (counts.get(it.persona) ?? 0) + 1);
    return Array.from(counts.values()).filter(n => n >= 5).length;
  });
  activeAlerts = computed(() => this.jellyfish().filter(j => j.severity >= 4).length);

  // ─── Three.js refs ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId = 0;
  private disposed = false;
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;

  // ─── Aquarium 3D refs ───
  private tankMesh: any;
  private waterMesh: any;
  private fishMeshes: any[] = [];           // 30 poissons
  private interviewByFish = new Map<any, OracleInterview>();
  private bubbleMeshes: any[] = [];         // bulles montantes
  private jellyfishMeshes: any[] = [];      // 3 méduses
  private jellyfishByMesh = new Map<any, OracleJellyfish>();
  private algaeMeshes: any[] = [];          // algues bas
  private coralMeshes: any[] = [];          // coraux JTBD
  private treasureMesh: any;
  private treasureGlow: any;
  private eagleMesh: any;
  private eagleState: 'idle' | 'diving' | 'rising' = 'idle';
  private eagleTimer = 0;
  private rectLights: any[] = [];

  // ─── Tank dimensions (volume aquarium) ───
  private readonly TANK = { w: 14, h: 9, d: 9 };
  private waterTime = 0;
  private ceremonyFlashTimer: any = null;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ─── Cinematic animation states ───
  /** Migration banc : tickets userData state */
  private schoolMigrationActive = false;
  private schoolMigrationT = 0;
  private schoolMigrationDuration = 5; // s
  /** Jellyfish pulse boost */
  private jellyfishBoostT = 0;
  private jellyfishBoostDuration = 0;
  /** Coral bloom */
  private coralBloomT = 0;
  private coralBloomDuration = 0;
  /** Active bursts (particules) */
  private activeBursts: any[] = [];

  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#a78bfa',
      hint: 'Mouse drag = orbit · molette = zoom · clic poisson = interview',
      controls: [
        { icon: '🎬', label: 'Demo interviews (30)', action: () => this.loadDemo() },
        { icon: '🦅', label: 'Eagle dive (weekly)', action: () => this.triggerEagleDive() },
        { icon: '🌊', label: 'Filter B2B', action: () => this.filterB2B() },
        { icon: '💰', label: 'Reveal treasure', action: () => this.revealTreasure() },
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
      s.src = src; s.onload = () => r(); s.onerror = () => r();
      document.head.appendChild(s);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INIT scène — caméra, lumières, raycaster, aquarium volumétrique
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scene — fond bleu-violet abysses
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a0a1a);
    this.scene.fog = new T.FogExp2(0x100820, 0.025);

    // Camera
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(0, 5, 22);
    this.camera.lookAt(0, 2, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lumières : ambiance abyssale + projecteurs colorés ───
    this.scene.add(new T.AmbientLight(0x4a3a8a, 0.45));
    const moon = new T.DirectionalLight(0xb6c4ff, 0.6);
    moon.position.set(5, 20, 8);
    this.scene.add(moon);
    // Lumière violette douce depuis le bas (effet eau)
    const underglow = new T.PointLight(0xa855f7, 1.2, 30, 2);
    underglow.position.set(0, -1, 0);
    this.scene.add(underglow);
    // Hémisphère bleu/violet
    this.scene.add(new T.HemisphereLight(0x8b5cf6, 0x1e1b4b, 0.4));

    // ─── Sol abyssal ───
    const floorGeom = new T.PlaneGeometry(60, 60, 8, 8);
    const floorMat = new T.MeshStandardMaterial({ color: 0x1a1133, roughness: 0.95 });
    const floor = new T.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5;
    this.scene.add(floor);

    // ─── Aquarium tank (verre + eau volumétrique) ───
    this.buildAquariumTank(T);
    this.buildAlgae(T);
    this.buildCorals(T);
    this.buildTreasure(T);
    this.buildEagle(T);
    this.buildRectAreaLights(T);
    this.spawnAmbientBubbles(T, 40);

    // ─── OrbitControls ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 2, 0);
      this.controls.maxDistance = 50;
      this.controls.minDistance = 4;
    }

    // ─── Raycaster pour cliquer poisson / méduse ───
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île du Savoir)
    const island = getIslandForRoom('/oracle-aquarium');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-15, 4, 0],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[OracleAquarium] 🐠 Aquarium ready · tank', this.TANK);
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'oracle-aquarium',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : aquarium volumétrique (boîte transparente + eau ondulante)
  // ═══════════════════════════════════════════════════════════════════
  private buildAquariumTank(T: any) {
    const { w, h, d } = this.TANK;
    // Verre — boîte semi-transparente bleue avec wireframe d'arêtes
    const glassGeom = new T.BoxGeometry(w, h, d, 1, 1, 1);
    const glassMat = new T.MeshPhysicalMaterial({
      color: 0x6ec5ff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.85,
      side: T.DoubleSide,
    });
    this.tankMesh = new T.Mesh(glassGeom, glassMat);
    this.tankMesh.position.y = h / 2 - 1;
    this.tankMesh.userData.tutorialId = 'tank';
    this.scene.add(this.tankMesh);

    // Cadre en arêtes lumineuses violet
    const edges = new T.EdgesGeometry(glassGeom);
    const edgeMat = new T.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.7 });
    const edgeLines = new T.LineSegments(edges, edgeMat);
    edgeLines.position.copy(this.tankMesh.position);
    this.scene.add(edgeLines);

    // ─── Eau volumétrique : box légèrement plus petite, ondulation UV ───
    const waterGeom = new T.BoxGeometry(w - 0.2, h - 0.3, d - 0.2, 24, 24, 24);
    const waterMat = new T.MeshPhongMaterial({
      color: 0x4477cc,
      transparent: true,
      opacity: 0.18,
      shininess: 80,
      side: T.BackSide,           // on voit l'eau de l'intérieur depuis l'extérieur
      emissive: 0x331a66,
      emissiveIntensity: 0.4,
    });
    this.waterMesh = new T.Mesh(waterGeom, waterMat);
    this.waterMesh.position.copy(this.tankMesh.position);
    this.scene.add(this.waterMesh);

    // Onde de surface — plan ondulant au sommet de l'eau
    const surfaceGeom = new T.PlaneGeometry(w - 0.4, d - 0.4, 32, 32);
    const surfaceMat = new T.MeshPhongMaterial({
      color: 0x88aaff, transparent: true, opacity: 0.35,
      side: T.DoubleSide, shininess: 100,
    });
    const surface = new T.Mesh(surfaceGeom, surfaceMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, h - 1.1, 0);
    surface.userData.isSurface = true;
    surface.userData.basePositions = surfaceGeom.attributes['position'].array.slice();
    this.scene.add(surface);
    (this as any).surfaceMesh = surface;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : poissons (cônes allongés qui nagent sur orbites circulaires)
  // ═══════════════════════════════════════════════════════════════════
  private buildFish(interviews: OracleInterview[]) {
    const T = (window as any).THREE;
    // Nettoyage poissons précédents
    for (const f of this.fishMeshes) this.scene.remove(f);
    this.fishMeshes = [];
    this.interviewByFish.clear();

    const { w, h, d } = this.TANK;
    // Regrouper par persona pour repérer les bancs synchronisés (≥5 = pattern)
    const personaGroups = new Map<string, OracleInterview[]>();
    for (const it of interviews) {
      if (!personaGroups.has(it.persona)) personaGroups.set(it.persona, []);
      personaGroups.get(it.persona)!.push(it);
    }

    let idx = 0;
    for (const [persona, group] of personaGroups) {
      const isSchool = group.length >= 5;     // banc synchronisé = pattern détecté
      // Orbite de groupe partagée (si banc)
      const groupOrbit = {
        cx: (Math.random() - 0.5) * (w * 0.5),
        cz: (Math.random() - 0.5) * (d * 0.5),
        cy: (Math.random() - 0.5) * (h * 0.4) + 1,
        rxz: 2 + Math.random() * 2.5,
        speed: 0.4 + Math.random() * 0.5,
      };

      for (let g = 0; g < group.length; g++) {
        const it = group[g];
        // Taille du poisson = durée d'interview (0.25 → 0.55)
        const size = Math.max(0.22, Math.min(0.55, it.durationMin * 0.012));
        // Cône allongé = corps du poisson
        const bodyGeom = new T.ConeGeometry(size, size * 3.0, 8);
        bodyGeom.rotateX(Math.PI / 2);    // pointe vers +Z (sens de nage)
        const bodyMat = new T.MeshStandardMaterial({
          color: it.personaColor,
          emissive: it.personaColor,
          emissiveIntensity: 0.25,
          roughness: 0.45,
          metalness: 0.2,
        });
        const fish = new T.Mesh(bodyGeom, bodyMat);

        // Queue : petit cône inverse
        const tailGeom = new T.ConeGeometry(size * 0.7, size * 1.0, 6);
        tailGeom.rotateX(-Math.PI / 2);
        const tail = new T.Mesh(tailGeom, bodyMat);
        tail.position.z = -size * 1.5;
        fish.add(tail);

        // Paramètres de nage individuels (mais alignés si banc)
        fish.userData = {
          interviewId: it.id,
          schoolPhase: isSchool ? (g / group.length) * Math.PI * 2 : Math.random() * Math.PI * 2,
          orbit: isSchool ? groupOrbit : {
            cx: (Math.random() - 0.5) * (w * 0.6),
            cz: (Math.random() - 0.5) * (d * 0.6),
            cy: (Math.random() - 0.5) * (h * 0.5) + 1,
            rxz: 1.5 + Math.random() * 3,
            speed: 0.3 + Math.random() * 0.7,
          },
          ySwingAmp: 0.4 + Math.random() * 0.6,
          ySwingFreq: 0.5 + Math.random() * 1.0,
          rollPhase: Math.random() * Math.PI * 2,
          isSchool,
          baseColor: it.personaColor,
          filtered: false,
        };

        // tutorialId tags : premier poisson = 'fish', premier banc (>=5) = 'school'
        if (idx === 0) fish.userData.tutorialId = 'fish';
        if (isSchool && g === 0 && !this.fishMeshes.some(f => f.userData.tutorialId === 'school')) {
          fish.userData.tutorialId = 'school';
        }

        this.scene.add(fish);
        this.fishMeshes.push(fish);
        this.interviewByFish.set(fish, it);
        idx++;
      }
    }
    console.log(`[OracleAquarium] 🐠 ${idx} fish swimming · ${this.patternsDetected()} patterns`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : méduses (ombrelle + tentacules + pulse magique)
  // ═══════════════════════════════════════════════════════════════════
  private buildJellyfish(jellies: OracleJellyfish[]) {
    const T = (window as any).THREE;
    for (const j of this.jellyfishMeshes) this.scene.remove(j);
    this.jellyfishMeshes = [];
    this.jellyfishByMesh.clear();

    const { w, h, d } = this.TANK;
    jellies.forEach((j, i) => {
      // Position répartie dans le haut/milieu du tank
      const px = (i - (jellies.length - 1) / 2) * (w / Math.max(2, jellies.length)) * 0.6;
      const py = 2 + Math.random() * 2.5;
      const pz = (Math.random() - 0.5) * (d * 0.4);

      // Ombrelle = demi-sphère (mesh group)
      const group = new T.Group();
      group.position.set(px, py, pz);
      const umbrellaGeom = new T.SphereGeometry(0.5 + j.severity * 0.08, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const umbrellaMat = new T.MeshPhongMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.7,
        side: T.DoubleSide,
        shininess: 100,
      });
      const umbrella = new T.Mesh(umbrellaGeom, umbrellaMat);
      umbrella.userData.jellyfishId = j.id;
      group.add(umbrella);

      // Tentacules verticales pendantes (8 lignes)
      const tentacleCount = 8;
      for (let t = 0; t < tentacleCount; t++) {
        const theta = (t / tentacleCount) * Math.PI * 2;
        const rx = 0.35 * Math.cos(theta);
        const rz = 0.35 * Math.sin(theta);
        const pts: any[] = [];
        for (let k = 0; k <= 12; k++) {
          pts.push(new T.Vector3(rx, -0.05 - k * 0.18, rz));
        }
        const tentGeom = new T.BufferGeometry().setFromPoints(pts);
        const tentMat = new T.LineBasicMaterial({
          color: 0xc084fc, transparent: true, opacity: 0.65,
        });
        const tent = new T.Line(tentGeom, tentMat);
        tent.userData.basePositions = pts.map(p => p.clone());
        tent.userData.phase = Math.random() * Math.PI * 2;
        group.add(tent);
      }

      group.userData = {
        jellyfishId: j.id,
        pulsePhase: Math.random() * Math.PI * 2,
        floatAnchor: py,
        severity: j.severity,
        umbrellaMat,
      };
      // tutorialId tag : première méduse
      if (i === 0) group.userData.tutorialId = 'jellyfish';
      this.scene.add(group);
      this.jellyfishMeshes.push(group);
      this.jellyfishByMesh.set(umbrella, j);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : algues vertes ondulantes (quads au fond du tank)
  // ═══════════════════════════════════════════════════════════════════
  private buildAlgae(T: any) {
    for (const a of this.algaeMeshes) this.scene.remove(a);
    this.algaeMeshes = [];
    const { w, h, d } = this.TANK;
    const algaeCount = 14;
    for (let i = 0; i < algaeCount; i++) {
      const algHeight = 2.5 + Math.random() * 2.2;
      const algGeom = new T.PlaneGeometry(0.3, algHeight, 1, 10);
      const algMat = new T.MeshStandardMaterial({
        color: new T.Color(0x52b788).offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.1),
        emissive: 0x1a4a2a,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.85,
        side: T.DoubleSide,
        roughness: 0.8,
      });
      const alg = new T.Mesh(algGeom, algMat);
      const px = (Math.random() - 0.5) * (w - 1);
      const pz = (Math.random() - 0.5) * (d - 1);
      alg.position.set(px, -1 + algHeight / 2, pz);
      alg.userData.basePositions = algGeom.attributes['position'].array.slice();
      alg.userData.phase = Math.random() * Math.PI * 2;
      alg.userData.height = algHeight;
      this.scene.add(alg);
      this.algaeMeshes.push(alg);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : coraux JTBD (formes bumpy colorées au fond)
  // ═══════════════════════════════════════════════════════════════════
  private buildCorals(T: any) {
    for (const c of this.coralMeshes) this.scene.remove(c);
    this.coralMeshes = [];
    const themes: OracleCoral[] = [
      { theme: 'onboarding-friction', color: '#fb7185' },
      { theme: 'data-export',         color: '#fdba74' },
      { theme: 'collaboration',       color: '#86efac' },
      { theme: 'reporting',           color: '#fde047' },
      { theme: 'pricing-clarity',     color: '#a5b4fc' },
    ];
    this.corals.set(themes);
    const { w, d } = this.TANK;
    themes.forEach((c, i) => {
      // Corail = empilement de sphères bumpy (genre coral branching)
      const coralGroup = new T.Group();
      const bumpsCount = 5 + Math.floor(Math.random() * 4);
      for (let b = 0; b < bumpsCount; b++) {
        const r = 0.18 + Math.random() * 0.18;
        const bumpGeom = new T.IcosahedronGeometry(r, 0);
        const bumpMat = new T.MeshStandardMaterial({
          color: c.color,
          emissive: c.color,
          emissiveIntensity: 0.35,
          roughness: 0.6,
        });
        const bump = new T.Mesh(bumpGeom, bumpMat);
        bump.position.set(
          (Math.random() - 0.5) * 0.5,
          b * 0.25,
          (Math.random() - 0.5) * 0.5,
        );
        coralGroup.add(bump);
      }
      const angle = (i / themes.length) * Math.PI * 2;
      const r = Math.min(w, d) * 0.32;
      coralGroup.position.set(Math.cos(angle) * r, -1, Math.sin(angle) * r);
      coralGroup.userData = { theme: c.theme };
      // tutorialId tag : premier corail
      if (i === 0) coralGroup.userData.tutorialId = 'coral';
      this.scene.add(coralGroup);
      this.coralMeshes.push(coralGroup);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : coffre au trésor (persona archétype) + halo doré
  // ═══════════════════════════════════════════════════════════════════
  private buildTreasure(T: any) {
    if (this.treasureMesh) this.scene.remove(this.treasureMesh);
    if (this.treasureGlow) this.scene.remove(this.treasureGlow);

    const group = new T.Group();
    // Coffre
    const chestGeom = new T.BoxGeometry(1.5, 0.9, 1.1);
    const chestMat = new T.MeshStandardMaterial({
      color: 0x6b3e1a, roughness: 0.8, metalness: 0.2,
      emissive: 0x331a08, emissiveIntensity: 0.4,
    });
    const chest = new T.Mesh(chestGeom, chestMat);
    chest.position.y = 0;
    group.add(chest);

    // Couvercle légèrement entrouvert
    const lidGeom = new T.BoxGeometry(1.55, 0.4, 1.15);
    const lid = new T.Mesh(lidGeom, chestMat);
    lid.position.set(0, 0.62, -0.25);
    lid.rotation.x = -0.45;
    group.add(lid);

    // Ferrures dorées
    const ferrureMat = new T.MeshStandardMaterial({
      color: 0xfacc15, metalness: 0.9, roughness: 0.2,
      emissive: 0xfacc15, emissiveIntensity: 0.5,
    });
    const ferrure1 = new T.Mesh(new T.BoxGeometry(0.05, 0.95, 1.16), ferrureMat);
    ferrure1.position.set(0.6, 0, 0);
    group.add(ferrure1);
    const ferrure2 = ferrure1.clone();
    ferrure2.position.x = -0.6;
    group.add(ferrure2);

    // Lumière intérieure dorée (révélée si archétype unlocked)
    const innerLight = new T.PointLight(0xfacc15, 0, 5, 2);
    innerLight.position.set(0, 0.4, 0);
    group.add(innerLight);
    group.userData.innerLight = innerLight;

    group.position.set(0, -1.1, 0);
    group.userData.tutorialId = 'treasure';
    this.scene.add(group);
    this.treasureMesh = group;

    // Halo extérieur (sprite simple — sphere additive)
    const glowGeom = new T.SphereGeometry(1.3, 16, 12);
    const glowMat = new T.MeshBasicMaterial({
      color: 0xfacc15, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false,
    });
    this.treasureGlow = new T.Mesh(glowGeom, glowMat);
    this.treasureGlow.position.copy(group.position);
    this.treasureGlow.position.y += 0.3;
    this.scene.add(this.treasureGlow);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : aigle pêcheur au-dessus du tank
  // ═══════════════════════════════════════════════════════════════════
  private buildEagle(T: any) {
    if (this.eagleMesh) this.scene.remove(this.eagleMesh);
    const group = new T.Group();
    // Corps
    const bodyGeom = new T.ConeGeometry(0.28, 1.1, 8);
    bodyGeom.rotateZ(Math.PI / 2);
    const bodyMat = new T.MeshStandardMaterial({
      color: 0x8b6b3e, emissive: 0x3a2a18, emissiveIntensity: 0.2, roughness: 0.7,
    });
    const body = new T.Mesh(bodyGeom, bodyMat);
    group.add(body);
    // Ailes (deux triangles fins)
    const wingGeom = new T.PlaneGeometry(1.6, 0.5);
    const wingMat = new T.MeshStandardMaterial({
      color: 0x6b4423, side: T.DoubleSide, roughness: 0.8,
    });
    const wingL = new T.Mesh(wingGeom, wingMat);
    wingL.position.set(0, 0, -0.6);
    wingL.rotation.x = -Math.PI / 2;
    group.add(wingL);
    const wingR = wingL.clone();
    wingR.position.z = 0.6;
    group.add(wingR);
    // Tête (sphère blanche)
    const headGeom = new T.SphereGeometry(0.18, 10, 8);
    const headMat = new T.MeshStandardMaterial({ color: 0xfafafa });
    const head = new T.Mesh(headGeom, headMat);
    head.position.set(0.6, 0.05, 0);
    group.add(head);
    // Bec
    const beakGeom = new T.ConeGeometry(0.06, 0.2, 6);
    beakGeom.rotateZ(-Math.PI / 2);
    const beakMat = new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xc89a08, emissiveIntensity: 0.3 });
    const beak = new T.Mesh(beakGeom, beakMat);
    beak.position.set(0.78, 0.05, 0);
    group.add(beak);

    group.position.set(0, this.TANK.h + 3, 0);
    group.userData = {
      anchorY: this.TANK.h + 3,
      patrolPhase: Math.random() * Math.PI * 2,
      wingPhase: 0,
      wingL, wingR,
      tutorialId: 'eagle',
    };
    this.scene.add(group);
    this.eagleMesh = group;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : RectAreaLights colorés au-dessus du tank (filtre persona)
  // ═══════════════════════════════════════════════════════════════════
  private buildRectAreaLights(T: any) {
    for (const l of this.rectLights) this.scene.remove(l);
    this.rectLights = [];
    const colors = [0xa855f7, 0x60a5fa, 0xf472b6];   // violet, bleu, rose
    const { w, h, d } = this.TANK;
    colors.forEach((c, i) => {
      const light = new T.PointLight(c, 1.4, 12, 1.8);
      const angle = (i / colors.length) * Math.PI * 2;
      light.position.set(Math.cos(angle) * (w * 0.3), h - 0.5, Math.sin(angle) * (d * 0.3));
      this.scene.add(light);
      this.rectLights.push(light);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : bulles ambiantes qui montent
  // ═══════════════════════════════════════════════════════════════════
  private spawnAmbientBubbles(T: any, count: number) {
    for (const b of this.bubbleMeshes) this.scene.remove(b);
    this.bubbleMeshes = [];
    const { w, h, d } = this.TANK;
    for (let i = 0; i < count; i++) {
      const r = 0.05 + Math.random() * 0.1;
      const geom = new T.SphereGeometry(r, 8, 6);
      const mat = new T.MeshBasicMaterial({
        color: 0xcfe8ff, transparent: true, opacity: 0.55,
        blending: T.AdditiveBlending, depthWrite: false,
      });
      const bubble = new T.Mesh(geom, mat);
      bubble.position.set(
        (Math.random() - 0.5) * (w - 0.6),
        -1 + Math.random() * (h - 0.5),
        (Math.random() - 0.5) * (d - 0.6),
      );
      bubble.userData = {
        vy: 0.5 + Math.random() * 1.2,
        wobble: Math.random() * Math.PI * 2,
        baseX: bubble.position.x,
        baseZ: bubble.position.z,
      };
      this.scene.add(bubble);
      this.bubbleMeshes.push(bubble);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA — 30 interviews, 3 personas, 3 méduses, 5 coraux
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const personas: OraclePersona[] = [
      { id: 1, name: 'PM SaaS B2B',   segment: 'B2B',      color: '#60a5fa', archetypeUnlocked: false },
      { id: 2, name: 'Indie Maker',   segment: 'B2C',      color: '#f472b6', archetypeUnlocked: false },
      { id: 3, name: 'CTO Internal',  segment: 'Internal', color: '#86efac', archetypeUnlocked: false },
    ];
    this.personas.set(personas);

    const aliases = ['Léa', 'Marc', 'Sofia', 'Jules', 'Amira', 'Noé', 'Yuki', 'Théo', 'Ines', 'Léo'];
    const quotes = [
      "Je perds 3h par semaine à recompiler les exports.",
      "L'onboarding ne m'a jamais expliqué la partie pricing.",
      "Mes devs veulent les mêmes données que la finance, en temps réel.",
      "Quand j'invite un collègue, il bloque sur l'OAuth.",
      "Je rêve d'un dashboard qui résume ma semaine en 5 lignes.",
      "Le rapport hebdo est tellement long que personne ne le lit.",
      "Les permissions sont un cauchemar à maintenir.",
      "Je veux pouvoir partager une vue sans donner un accès.",
      "Notre comptable demande un export Excel chaque vendredi.",
      "L'app est rapide mais l'UI me fait sentir bête.",
    ];

    const interviews: OracleInterview[] = [];
    for (let i = 0; i < 30; i++) {
      const persona = personas[i % personas.length];
      interviews.push({
        id: i + 1,
        persona: persona.name,
        personaColor: persona.color,
        participant: aliases[i % aliases.length] + ' ' + (i + 1),
        durationMin: 20 + Math.floor(Math.random() * 40),
        date: this.fmtDate(Date.now() - i * 86400000 * 2),
        keyQuote: quotes[i % quotes.length],
        segment: persona.segment,
      });
    }
    this.interviews.set(interviews);

    const jellies: OracleJellyfish[] = [
      { id: 1, painPoint: "Onboarding pricing flou → churn semaine 2",  severity: 5, mentionCount: 11 },
      { id: 2, painPoint: "OAuth invitations cassent en production",     severity: 4, mentionCount: 7 },
      { id: 3, painPoint: "Reporting illisible · personne ne le lit",    severity: 4, mentionCount: 6 },
    ];
    this.jellyfish.set(jellies);

    this.buildFish(interviews);
    this.buildJellyfish(jellies);
    this.emitCeremony({ type: 'bank', label: 'Arrivée banc · 30 interviews déversées', icon: '🐠' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES & interactions
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('oracle-aquarium', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1500);
  }

  triggerEagleDive() {
    this.eagleState = 'diving';
    this.eagleTimer = 0;
    this.emitCeremony({ type: 'eagle', label: '🦅 Plongée aigle · weekly summary', icon: '🦅' });
  }

  filterB2B() {
    const next = this.filterMode() === 'B2B' ? 'all' : 'B2B';
    this.filterMode.set(next);
    // Met à jour les poissons : ceux hors filtre deviennent gris
    for (const fish of this.fishMeshes) {
      const it = this.interviewByFish.get(fish);
      if (!it) continue;
      const filtered = next === 'B2B' && it.segment !== 'B2B';
      fish.userData.filtered = filtered;
      const targetColor = filtered ? '#3a3a4a' : it.personaColor;
      fish.material.color.set(targetColor);
      fish.material.emissive.set(targetColor);
      fish.material.emissiveIntensity = filtered ? 0.05 : 0.25;
    }
    if (next === 'B2B') {
      this.emitCeremony({ type: 'bank', label: '🌊 Filtre B2B SaaS activé', icon: '🌊' });
    }
  }

  revealTreasure() {
    // Marque le premier persona comme archétype consolidé
    const ps = this.personas().slice();
    const unlocked = ps.find(p => !p.archetypeUnlocked);
    if (!unlocked) return;
    unlocked.archetypeUnlocked = true;
    this.personas.set(ps);
    // Active la lumière dorée
    if (this.treasureMesh?.userData?.innerLight) {
      this.treasureMesh.userData.innerLight.intensity = 3;
    }
    if (this.treasureGlow?.material) {
      this.treasureGlow.material.opacity = 0.45;
    }
    this.emitCeremony({ type: 'treasure', label: `💰 Archétype "${unlocked.name}" consolidé`, icon: '💰' });
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 5, 22);
    this.camera.lookAt(0, 2, 0);
    if (this.controls) this.controls.target.set(0, 2, 0);
  }

  /** Quand l'utilisateur clique "Lancer le play" sur le splash */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    this.narrator.startPlayExample(0);
  }

  /** Quand l'utilisateur clique "Entrer" (skip le play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
  }

  /** ⏱ Lance le mode TIMEBOX RÉEL — HUD countdown avec la vraie durée Scrum, sans narration. */
  onSplashTimebox(): void {
    this.splashVisible.set(false);
    this.narrator.startTimeboxOnly(1800, 'Voice of customer');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoqués par le playExample tutorial JSON
  // (chaque méthode publique est appelable via narrator.invokeMethod)
  // ═══════════════════════════════════════════════════════════════════

  /** 🐠 SCHOOL MIGRATION — banc de poissons traverse l'aquarium d'un bord à l'autre
   *  (= cohorte d'users feedback qui défilent en masse) */
  schoolMigration() {
    if (!this.fishMeshes || this.fishMeshes.length === 0) return;
    const { w } = this.TANK;
    this.schoolMigrationActive = true;
    this.schoolMigrationT = 0;
    // Sauve les orbites originales + force trajectoire migration : tous → orbite commune côté +X
    for (let i = 0; i < this.fishMeshes.length; i++) {
      const fish = this.fishMeshes[i];
      if (!fish.userData) continue;
      // Stocke l'orbite originale si pas déjà fait
      if (!fish.userData._origOrbit) {
        fish.userData._origOrbit = { ...fish.userData.orbit };
      }
      // Override : orbit centrée à 0 + larger amplitude → effet "tous nagent ensemble"
      fish.userData.orbit = {
        cx: 0,
        cz: (i % 5 - 2) * 0.6,            // bandes horizontales
        cy: (i % 4 - 1.5) * 0.8,         // étages verticaux
        rxz: w * 0.35,
        speed: 0.6 + (i % 3) * 0.1,
      };
      fish.userData.schoolPhase = (i / this.fishMeshes.length) * Math.PI * 2;
    }
    this.emitCeremony({ type: 'bank', label: '🐠 Migration de banc · feedback cohorte', icon: '🐠' });
  }

  /** 🪼 JELLYFISH PULSE — méduses pulsent fort + diffusent particules colorées
   *  (= pain points highlighted) */
  jellyfishPulse() {
    const T = (window as any).THREE;
    if (!this.jellyfishMeshes || this.jellyfishMeshes.length === 0) return;
    this.jellyfishBoostT = 0;
    this.jellyfishBoostDuration = 4.5;
    // Particules colorées violettes émanant de chaque méduse
    for (const jellyG of this.jellyfishMeshes) {
      const count = 60;
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const origin = jellyG.position;
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 0] = origin.x + (Math.random() - 0.5) * 0.4;
        positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.4;
        const ang = Math.random() * Math.PI * 2;
        const speed = 0.04 + Math.random() * 0.08;
        velocities[i * 3 + 0] = Math.cos(ang) * speed;
        velocities[i * 3 + 1] = -0.02 - Math.random() * 0.04;
        velocities[i * 3 + 2] = Math.sin(ang) * speed;
      }
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.BufferAttribute(positions, 3));
      const mat = new T.PointsMaterial({
        color: 0xc084fc, size: 0.18, sizeAttenuation: true,
        transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false,
      });
      const burst = new T.Points(geom, mat);
      burst.userData = { kind: 'jelly-burst', velocities, age: 0, ttl: 3.5 };
      this.activeBursts.push(burst);
      this.scene.add(burst);
    }
    this.emitCeremony({ type: 'jelly', label: '🪼 Pulse méduse · pain points mis en lumière', icon: '🪼' });
  }

  /** 🪸 CORAL BLOOM — coraux brillent et grossissent
   *  (= positive feedback peak) */
  coralBloom() {
    if (!this.coralMeshes || this.coralMeshes.length === 0) return;
    this.coralBloomT = 0;
    this.coralBloomDuration = 5;
    this.emitCeremony({ type: 'bank', label: '🪸 Coraux en floraison · feedback positif', icon: '🪸' });
  }

  /** 💰 TREASURE REVEAL — coffre s'ouvre, lumière dorée sort + halo
   *  (= persona key insight) */
  treasureReveal() {
    const T = (window as any).THREE;
    if (!this.treasureMesh) return;
    // Marque un persona comme archétype consolidé
    const ps = this.personas().slice();
    const unlocked = ps.find(p => !p.archetypeUnlocked);
    if (unlocked) {
      unlocked.archetypeUnlocked = true;
      this.personas.set(ps);
    }
    // Active la lumière intérieure + halo
    if (this.treasureMesh.userData?.innerLight) {
      this.treasureMesh.userData.innerLight.intensity = 4;
    }
    if (this.treasureGlow?.material) {
      this.treasureGlow.material.opacity = 0.55;
    }
    // Ouverture du couvercle : on retrouve le lid (child[1])
    const lid = this.treasureMesh.children?.[1];
    if (lid) {
      lid.userData._origRotX = lid.rotation.x;
      const startRot = lid.rotation.x;
      const targetRot = -1.3;                                    // grand ouvert
      const startTime = performance.now();
      const dur = 800;
      const step = () => {
        const t = Math.min(1, (performance.now() - startTime) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        lid.rotation.x = startRot + (targetRot - startRot) * e;
        if (t < 1) requestAnimationFrame(step);
      };
      step();
    }
    // Burst de particules dorées qui s'élèvent du coffre
    const count = 150;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const origin = this.treasureMesh.position;
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = origin.x + (Math.random() - 0.5) * 0.8;
      positions[i * 3 + 1] = origin.y + 0.4;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.6;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.12;
      velocities[i * 3 + 0] = Math.cos(ang) * speed * 0.5;
      velocities[i * 3 + 1] = 0.10 + Math.random() * 0.18;
      velocities[i * 3 + 2] = Math.sin(ang) * speed * 0.5;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xfacc15, size: 0.22, sizeAttenuation: true,
      transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false,
    });
    const burst = new T.Points(geom, mat);
    burst.userData = { kind: 'treasure-burst', velocities, age: 0, ttl: 4.5 };
    this.activeBursts.push(burst);
    this.scene.add(burst);
    this.emitCeremony({
      type: 'treasure',
      label: `💰 Persona archétype ${unlocked ? '"' + unlocked.name + '" ' : ''}révélé`,
      icon: '💰',
    });
  }

  /** 🦅 EAGLE DIVE — aigle plonge dans l'eau, attrape un poisson, repart
   *  (= action item taken) */
  eagleDive() {
    if (!this.eagleMesh) return;
    this.eagleState = 'diving';
    this.eagleTimer = 0;
    this.emitCeremony({ type: 'eagle', label: '🦅 Aigle plonge · action item engagée', icon: '🦅' });
  }

  /** 🌊 FILTER B2B — highlight juste les poissons d'une couleur particulière
   *  (= filter feedback segment) */
  // (déjà existant — exposé via le bouton footer ; juste renforce qu'il est public pour le narrator)

  /** Helper : restaure les orbites originales des poissons après migration */
  private restoreFishOrbits() {
    for (const fish of this.fishMeshes) {
      if (fish.userData?._origOrbit) {
        fish.userData.orbit = fish.userData._origOrbit;
        delete fish.userData._origOrbit;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic poisson / méduse
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
    // Test poissons d'abord
    const fishHits = this.raycaster.intersectObjects(this.fishMeshes, true);
    if (fishHits.length > 0) {
      // Remonter au mesh root (parent.parent pour la queue)
      let target = fishHits[0].object;
      while (target.parent && !this.interviewByFish.has(target)) target = target.parent;
      const it = this.interviewByFish.get(target);
      if (it) {
        this.selectedInterview.set(it);
        target.scale.set(1.6, 1.6, 1.6);
        setTimeout(() => target.scale.set(1, 1, 1), 220);
        return;
      }
    }
    // Sinon test méduses
    const umbrellas = this.jellyfishMeshes.map(g => g.children[0]);
    const jellyHits = this.raycaster.intersectObjects(umbrellas, false);
    if (jellyHits.length > 0) {
      const j = this.jellyfishByMesh.get(jellyHits[0].object);
      if (j) {
        this.selectedJellyfish.set(j);
        this.emitCeremony({ type: 'jelly', label: `🪼 ${j.painPoint}`, icon: '🪼' });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP — animations naturelles
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.waterTime += dt;
    const T = (window as any).THREE;

    // ─── Nage des poissons (orbite XZ + sin Y + roll) ───
    for (const fish of this.fishMeshes) {
      const u = fish.userData;
      u.schoolPhase += dt * u.orbit.speed;
      const x = u.orbit.cx + Math.cos(u.schoolPhase) * u.orbit.rxz;
      const z = u.orbit.cz + Math.sin(u.schoolPhase) * u.orbit.rxz;
      const y = u.orbit.cy + Math.sin(this.waterTime * u.ySwingFreq + u.rollPhase) * u.ySwingAmp;
      fish.position.set(x, y, z);
      // Orienter le poisson dans le sens de la nage (tangente à l'orbite)
      const tangentX = -Math.sin(u.schoolPhase);
      const tangentZ =  Math.cos(u.schoolPhase);
      const angle = Math.atan2(tangentX, tangentZ);
      fish.rotation.y = angle;
      // Léger roll naturel
      fish.rotation.z = Math.sin(this.waterTime * 2 + u.rollPhase) * 0.18;
    }

    // ─── Bulles montent + fade out près du sommet ───
    const { h: tankH } = this.TANK;
    const topY = tankH - 1.3;
    for (const bubble of this.bubbleMeshes) {
      bubble.position.y += bubble.userData.vy * dt;
      bubble.userData.wobble += dt * 2;
      bubble.position.x = bubble.userData.baseX + Math.sin(bubble.userData.wobble) * 0.08;
      // Fade quand on approche du sommet
      const distFromTop = topY - bubble.position.y;
      bubble.material.opacity = Math.max(0, Math.min(0.6, distFromTop * 0.45));
      // Reset en bas quand on dépasse
      if (bubble.position.y > topY) {
        bubble.position.y = -1;
        bubble.userData.baseX = (Math.random() - 0.5) * (this.TANK.w - 0.6);
        bubble.userData.baseZ = (Math.random() - 0.5) * (this.TANK.d - 0.6);
        bubble.position.x = bubble.userData.baseX;
        bubble.position.z = bubble.userData.baseZ;
      }
    }

    // ─── Méduses : pulse opacité + lent flottement + tentacules ondulent ───
    for (const jellyG of this.jellyfishMeshes) {
      const u = jellyG.userData;
      u.pulsePhase += dt * 1.4;
      const pulse = 0.5 + 0.5 * Math.sin(u.pulsePhase);
      // Pulse échelle (ombrelle)
      const s = 1 + pulse * 0.12;
      jellyG.children[0].scale.set(s, 0.7 + pulse * 0.3, s);
      // Pulse opacité
      if (u.umbrellaMat) {
        u.umbrellaMat.opacity = 0.4 + pulse * 0.45;
        u.umbrellaMat.emissiveIntensity = 0.6 + pulse * 0.7;
      }
      // Flottement vertical
      jellyG.position.y = u.floatAnchor + Math.sin(this.waterTime * 0.4 + u.pulsePhase) * 0.35;
      // Tentacules : onde sinusoïdale latérale
      for (let ci = 1; ci < jellyG.children.length; ci++) {
        const tent = jellyG.children[ci];
        if (!tent.geometry?.attributes?.position) continue;
        const pos = tent.geometry.attributes.position;
        const base = tent.userData.basePositions;
        const phase = tent.userData.phase;
        if (!base) continue;
        for (let k = 0; k < base.length; k++) {
          const bp = base[k];
          const depth = Math.abs(bp.y);
          const sway = Math.sin(this.waterTime * 2 + phase + depth * 0.6) * depth * 0.04;
          pos.setX(k, bp.x + sway);
          pos.setZ(k, bp.z + Math.cos(this.waterTime * 1.6 + phase + depth * 0.5) * depth * 0.03);
        }
        pos.needsUpdate = true;
      }
    }

    // ─── Algues : ondulation des sommets (sway latéral en fonction de la hauteur) ───
    for (const alg of this.algaeMeshes) {
      const pos = alg.geometry.attributes.position;
      const base = alg.userData.basePositions;
      const phase = alg.userData.phase;
      const hH = alg.userData.height;
      if (!base) continue;
      for (let k = 0; k < pos.count; k++) {
        const by = base[k * 3 + 1];
        const ny = (by / hH) + 0.5;                     // 0 en bas, 1 en haut
        const sway = Math.sin(this.waterTime * 1.5 + phase + ny * 2) * ny * 0.4;
        pos.setX(k, base[k * 3] + sway);
        pos.setZ(k, base[k * 3 + 2] + Math.cos(this.waterTime * 1.2 + phase + ny * 1.5) * ny * 0.2);
      }
      pos.needsUpdate = true;
    }

    // ─── Surface de l'eau : ondulation sinusoïdale ───
    const surface = (this as any).surfaceMesh;
    if (surface?.geometry?.attributes?.position && surface.userData?.basePositions) {
      const pos = surface.geometry.attributes.position;
      const base = surface.userData.basePositions;
      for (let k = 0; k < pos.count; k++) {
        const bx = base[k * 3];
        const bz = base[k * 3 + 1];   // PlaneGeometry : Y de la 2e composante avant rotation
        const wave = Math.sin(this.waterTime * 2 + bx * 0.8) * 0.12
                   + Math.cos(this.waterTime * 1.3 + bz * 0.9) * 0.10;
        pos.setZ(k, wave);
      }
      pos.needsUpdate = true;
      surface.geometry.computeVertexNormals();
    }

    // ─── Trésor : pulsation halo doré si unlocked ───
    if (this.treasureGlow?.material && this.treasureGlow.material.opacity > 0.01) {
      const beat = 0.3 + 0.15 * Math.sin(this.waterTime * 2.2);
      this.treasureGlow.material.opacity = Math.min(0.55, beat);
      this.treasureGlow.scale.setScalar(1 + Math.sin(this.waterTime * 2.2) * 0.08);
    }

    // ─── Cinematic : School Migration timer + restore ───
    if (this.schoolMigrationActive) {
      this.schoolMigrationT += dt;
      if (this.schoolMigrationT >= this.schoolMigrationDuration) {
        this.schoolMigrationActive = false;
        this.restoreFishOrbits();
      }
    }

    // ─── Cinematic : Jellyfish pulse boost (override pulse amplitudes 4.5s) ───
    if (this.jellyfishBoostDuration > 0) {
      this.jellyfishBoostT += dt;
      const boost = Math.max(0, 1 - this.jellyfishBoostT / this.jellyfishBoostDuration);
      for (const jellyG of this.jellyfishMeshes) {
        const mat = jellyG.userData?.umbrellaMat;
        if (mat) {
          mat.emissiveIntensity = 0.6 + boost * 2.4;
          mat.opacity = Math.min(1, 0.6 + boost * 0.4);
        }
      }
      if (this.jellyfishBoostT >= this.jellyfishBoostDuration) {
        this.jellyfishBoostDuration = 0;
        this.jellyfishBoostT = 0;
      }
    }

    // ─── Cinematic : Coral bloom (scale + emissive intensity) ───
    if (this.coralBloomDuration > 0) {
      this.coralBloomT += dt;
      const phase = this.coralBloomT / this.coralBloomDuration;       // 0 → 1
      const bell = Math.sin(Math.min(1, phase) * Math.PI);             // 0→1→0
      const scale = 1 + bell * 0.55;
      for (const coralG of this.coralMeshes) {
        coralG.scale.setScalar(scale);
        coralG.traverse((o: any) => {
          if (o.material && 'emissiveIntensity' in o.material) {
            o.material.emissiveIntensity = 0.35 + bell * 1.4;
          }
        });
      }
      if (this.coralBloomT >= this.coralBloomDuration) {
        this.coralBloomDuration = 0;
        this.coralBloomT = 0;
        // Reset
        for (const coralG of this.coralMeshes) {
          coralG.scale.setScalar(1);
          coralG.traverse((o: any) => {
            if (o.material && 'emissiveIntensity' in o.material) o.material.emissiveIntensity = 0.35;
          });
        }
      }
    }

    // ─── Cinematic : Bursts particules (jelly-burst + treasure-burst) ───
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
        }
        pos.needsUpdate = true;
        const ratio = burst.userData.age / burst.userData.ttl;
        burst.material.opacity = Math.max(0, 0.95 * (1 - Math.pow(ratio, 1.4)));
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

    // ─── Aigle : patrouille au-dessus, plongée si déclenchée ───
    if (this.eagleMesh) {
      const u = this.eagleMesh.userData;
      u.wingPhase += dt * 6;
      // Battement d'ailes
      if (u.wingL && u.wingR) {
        const wingFlap = Math.sin(u.wingPhase) * 0.45;
        u.wingL.rotation.y = wingFlap;
        u.wingR.rotation.y = -wingFlap;
      }
      if (this.eagleState === 'idle') {
        u.patrolPhase += dt * 0.5;
        this.eagleMesh.position.x = Math.cos(u.patrolPhase) * 5;
        this.eagleMesh.position.z = Math.sin(u.patrolPhase) * 5;
        this.eagleMesh.position.y = u.anchorY + Math.sin(this.waterTime * 0.8) * 0.3;
        this.eagleMesh.rotation.y = -u.patrolPhase + Math.PI / 2;
      } else if (this.eagleState === 'diving') {
        this.eagleTimer += dt;
        const t = Math.min(1, this.eagleTimer / 1.2);
        this.eagleMesh.position.y = u.anchorY - (u.anchorY - 2) * t;
        this.eagleMesh.rotation.z = -t * 0.6;
        if (t >= 1) { this.eagleState = 'rising'; this.eagleTimer = 0; }
      } else if (this.eagleState === 'rising') {
        this.eagleTimer += dt;
        const t = Math.min(1, this.eagleTimer / 1.4);
        this.eagleMesh.position.y = 2 + (u.anchorY - 2) * t;
        this.eagleMesh.rotation.z = -0.6 + t * 0.6;
        if (t >= 1) { this.eagleState = 'idle'; }
      }
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.waterTime);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════
  private fmtDate(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
