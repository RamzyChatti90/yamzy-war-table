// ═══════════════════════════════════════════════════════════════════
// ⚗ ALCHEMIST CELLAR ROOM — La Cave aux Fioles
//
// Mécanique data unique : une cave voûtée 3D où les fioles colorées
// montent/descendent EN TEMPS RÉEL selon la facturation cloud.
// Chaque service est une fiole, chaque économie est un cristal distillé.
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   💎 Cristallisation = économie >€500 réalisée (gold gleam)
//   🌋 Éruption        = budget dépassé (lave rouge + sirène)
//   ⚖ Pesée juste     = décision Reserved Instances signée (balance d'or)
//   🦉 Hululement      = alerte 80% budget mensuel (lueur du hibou)
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
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent } from '../../core/spell-ui';

// ─── Types métier ──────────────────────────────────────────────────
type Provider = 'aws' | 'gcp' | 'azure';
type ServiceKind = 'compute' | 'storage' | 'network' | 'ai' | 'db';

interface FioleData {
  id: string;
  provider: Provider;
  serviceKind: ServiceKind;
  serviceName: string;
  costEur: number;          // coût mensuel courant
  baselineEur: number;      // baseline référence
  trend: 'up' | 'down' | 'flat';
  recommendation?: string;
  isAnomaly: boolean;       // delta >30% baseline
}

interface CrystalData {
  id: string;
  savingEur: number;
  label: string;
}

interface RecommendationData {
  id: string;
  serviceId: string;
  action: string;
  estSavingEur: number;
  effort: 'low' | 'medium' | 'high';
}

// Couleurs services (mapping du spec)
const SERVICE_COLOR: Record<ServiceKind, number> = {
  compute: 0xef4444,  // rouge
  storage: 0x3b82f6,  // bleu
  network: 0x22c55e,  // vert
  ai:      0xa855f7,  // violet
  db:      0xf59e0b,  // ambré
};

@Component({
  selector: 'wt-alchemist-cellar-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ac-host">
      <header class="ac-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#84cc16" [routerLink]="'/yamzy-island'" icon="←">Yamzy Island</wt-spell-btn>
        <div class="ac-title">
          <h1>⚗ ALCHEMIST CELLAR</h1>
          <p>La Cave aux Fioles —
            <strong>{{ totalMonthlyCost() | number:'1.0-0' }} €</strong> /mois ·
            <span class="ac-anomaly">🌋 {{ anomaliesCount() }} anomalies</span> ·
            <span class="ac-savings">💎 {{ savingsRealized() | number:'1.0-0' }} € économisés</span>
          </p>
        </div>
        <div class="ac-legend">
          <span class="dot compute"></span>compute
          <span class="dot storage"></span>storage
          <span class="dot network"></span>network
          <span class="dot ai"></span>AI
          <span class="dot db"></span>DB
        </div>
      </header>

      <canvas #canvas class="ac-canvas"></canvas>

      <footer class="ac-controls">
        <wt-spell-btn variant="secondary" size="sm" accent="#84cc16" (click)="loadDemo()" icon="🎬">Demo billing</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#84cc16" (click)="distillRecommendation()" icon="💎">Distiller recommandation</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#84cc16" (click)="triggerAnomaly()" icon="🌋">Trigger anomalie</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#84cc16" (click)="testOwlAlert()" icon="🦉">Test owl alert</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#84cc16" (click)="resetCamera()" icon="🎥">Reset cam</wt-spell-btn>
        <wt-spell-btn variant="primary" size="sm" accent="#84cc16" (click)="openTutorial()" icon="🎓" title="Visite guidée par Yamzy">How it works</wt-spell-btn>
        <wt-spell-btn variant="primary" size="sm" accent="#84cc16" (click)="narrator.startPlayExample()" icon="▶" title="Démo animée">Play example</wt-spell-btn>
        <span class="hint">Souris = orbite · molette = zoom · clic fiole = service</span>
      </footer>

      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="ac-flash" [attr.data-type]="f.type">
        <div class="ac-flash-content">
          <div class="ac-flash-icon">{{ f.icon }}</div>
          <div class="ac-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel service détail -->
      <div *ngIf="selectedFiole() as s" class="ac-panel">
        <button class="ac-panel-close" (click)="selectedFiole.set(null)">×</button>
        <div class="ac-panel-head">
          <span class="ac-panel-kind" [style.background]="serviceColorHex(s.serviceKind)">{{ s.serviceKind }}</span>
          <strong>{{ s.serviceName }}</strong>
        </div>
        <div class="ac-panel-row"><span>Provider</span><strong>{{ s.provider.toUpperCase() }}</strong></div>
        <div class="ac-panel-row"><span>Coût mensuel</span><strong>{{ s.costEur | number:'1.0-0' }} €</strong></div>
        <div class="ac-panel-row"><span>Baseline</span><strong>{{ s.baselineEur | number:'1.0-0' }} €</strong></div>
        <div class="ac-panel-row"><span>Trend</span><strong [class.up]="s.trend==='up'" [class.down]="s.trend==='down'">{{ s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→' }} {{ deltaPct(s) }}%</strong></div>
        <div *ngIf="s.isAnomaly" class="ac-panel-anomaly">🌋 Anomalie détectée — 24h pour traiter</div>
        <div *ngIf="s.recommendation" class="ac-panel-reco">💡 {{ s.recommendation }}</div>
      </div>

      <!-- 🎬 Splash welcome overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Alchemist Cellar"
        loreName="La Cave aux Fioles"
        color="#84cc16"
        oneLiner="18 fioles colorées, athanor central, cristaux distillés, hibou alerte budget."
        [duration]="65"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Alchemist Cellar"
        loreName="La Cave aux Fioles"
        accent="#84cc16"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .ac-host { position: relative; width: 100%; height: 100vh; background: #1c1410; color: #f5e8d4; font-family: system-ui, sans-serif; }
    .ac-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .ac-topbar > * { pointer-events: auto; }
    .ac-back { color: #84cc16; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #4d7c0f; border-radius: 8px; background: rgba(20,40,10,0.4); }
    .ac-back:hover { background: rgba(77,124,15,0.4); }
    .ac-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #84cc16; }
    .ac-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.85; }
    .ac-anomaly { color: #f87171; margin-left: 8px; }
    .ac-savings { color: #fbbf24; margin-left: 8px; }
    .ac-legend { display: flex; gap: 10px; font-size: 11px; align-items: center; }
    .ac-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; box-shadow: 0 0 6px currentColor; }
    .ac-legend .compute { background: #ef4444; color: #ef4444; }
    .ac-legend .storage { background: #3b82f6; color: #3b82f6; }
    .ac-legend .network { background: #22c55e; color: #22c55e; }
    .ac-legend .ai      { background: #a855f7; color: #a855f7; }
    .ac-legend .db      { background: #f59e0b; color: #f59e0b; }

    .ac-canvas { display: block; width: 100%; height: 100%; }

    .ac-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); }
    .ac-controls button { background: rgba(30,25,15,0.7); color: #f5e8d4; border: 1px solid #4d7c0f; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .ac-controls button:hover { background: rgba(77,124,15,0.5); }
    .ac-controls .ac-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .ac-controls .ac-narrator:hover { background: rgba(251,191,36,0.3); }
    .ac-controls .ac-narrator.ac-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .ac-controls .ac-narrator.ac-play:hover { background: #f5b923; }
    .ac-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .ac-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: ac-flash-pulse 1.6s ease-out forwards; }
    .ac-flash[data-type="crystal"]  { background: radial-gradient(circle at center, rgba(251,191,36,0.65), transparent 60%); }
    .ac-flash[data-type="eruption"] { background: radial-gradient(circle at center, rgba(220,38,38,0.7), transparent 60%); }
    .ac-flash[data-type="balance"]  { background: radial-gradient(circle at center, rgba(250,204,21,0.55), transparent 60%); }
    .ac-flash[data-type="owl"]      { background: radial-gradient(circle at center, rgba(168,85,247,0.5), transparent 60%); }
    .ac-flash-content { text-align: center; animation: ac-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .ac-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .ac-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.6); }
    @keyframes ac-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes ac-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }

    /* Panel service */
    .ac-panel { position: absolute; right: 22px; top: 80px; width: 300px; padding: 14px; background: rgba(28,20,16,0.94); border: 1px solid #4d7c0f; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.6); }
    .ac-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(132, 204, 22, 0.4); border-radius: 50%; color: #84cc16; cursor: pointer; }
    .ac-panel-head { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(132,204,22,0.2); }
    .ac-panel-kind { padding: 2px 8px; border-radius: 4px; color: #fff; font-size: 10px; text-transform: uppercase; font-weight: 700; }
    .ac-panel-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .ac-panel-row span { opacity: 0.7; }
    .ac-panel-row .up   { color: #f87171; }
    .ac-panel-row .down { color: #4ade80; }
    .ac-panel-anomaly { margin-top: 8px; padding: 6px 10px; background: rgba(220,38,38,0.2); border-left: 3px solid #dc2626; border-radius: 4px; font-size: 11px; color: #fca5a5; }
    .ac-panel-reco { margin-top: 8px; padding: 6px 10px; background: rgba(132,204,22,0.15); border-left: 3px solid #84cc16; border-radius: 4px; font-size: 11px; color: #d9f99d; }
  `]
})
export class AlchemistCellarRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── État réactif (signals) ──────────────────────────────────────
  fioles = signal<FioleData[]>([]);
  crystals = signal<CrystalData[]>([]);
  recommendations = signal<RecommendationData[]>([]);
  selectedFiole = signal<FioleData | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🧪', title: '18 fioles = postes budgétaires', body: 'Chaque fiole colorée représente une ligne du budget IT (cloud, licences, salaires, infra). Sa hauteur de liquide montre la consommation.' },
    { icon: '🔥', title: 'L\'athanor central distille', body: 'L\'athanor au centre brûle votre OPEX du mois. Sa flamme s\'intensifie quand vous approchez du plafond.' },
    { icon: '💎', title: 'Cristaux = économies générées', body: 'Les cristaux qui flottent sont les économies cumulées (négociations, optimisations cloud). Ils deviennent une rente.' },
    { icon: '🦉', title: 'Le hibou veille le budget', body: 'À 80% du budget mensuel, le hibou hulule. À 100%, ses yeux deviennent rouges et il appelle l\'alerte FinOps.' },
    { icon: '⚗️', title: 'Recette = scénario d\'allocation', body: 'Sauvegardez vos recettes (combinaisons de fioles) pour comparer plusieurs scénarios budgétaires avant de trancher.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque fiole est un poste budgétaire IT.',
    'L\'athanor distille votre OPEX du mois.',
    'Les cristaux sont les économies cumulées.',
    'À quatre-vingts pourcent, le hibou hulule.',
    'Sauvegardez vos recettes budgétaires.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  totalMonthlyCost = computed(() => this.fioles().reduce((s, f) => s + f.costEur, 0));
  anomaliesCount   = computed(() => this.fioles().filter(f => f.isAnomaly).length);
  savingsRealized  = computed(() => this.crystals().reduce((s, c) => s + c.savingEur, 0));

  // ─── Three.js state ──────────────────────────────────────────────
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private ceremonyFlashTimer: any = null;
  private elapsed = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // 3D refs spécifiques
  private fioleMeshes = new Map<string, { outer: any; liquid: any; data: FioleData; baseLiquidY: number }>();
  private fioleHitMeshes: any[] = [];   // pour le raycaster
  private fioleByMesh = new Map<any, FioleData>();
  private crystalMeshes: any[] = [];
  private athanorFlames: any = null;     // Points (particules)
  private athanorFlameGeom: any = null;
  private chimneyFlame: any = null;
  private chimneySmoke: any = null;
  private chimneySmokeGeom: any = null;
  private owlHead: any = null;
  private owlBody: any = null;
  private owlEyeL: any = null;
  private owlEyeR: any = null;
  private owlGroup: any = null;
  private owlWingL: any = null;
  private owlWingR: any = null;
  private bubblesByFiole = new Map<string, { points: any; geom: any; velocities: number[] }>();
  private balanceArm: any = null;
  private balanceGroup: any = null;
  private balanceTiltTarget = 0;   // radians cible pour la balance (animée dans la loop)
  private balanceTiltDecay = 0;    // temps restant avant retour à 0
  private athanorOpening: any = null;
  private athanorLight: any = null;
  private athanorFireBoost = 0;    // 0..1 boost intensité athanor sur quelques secondes
  private grimoireGroup: any = null;
  private grimoirePages: any[] = [];
  private grimoireBase: any = null;
  private grimoireBaseY = 0;
  private grimoireOpenState = 0;    // 0 fermé → 1 ouvert grand
  private grimoireOpenDecay = 0;
  private owlPulse = 0;             // 0..1 pulse rouge en cours
  private owlPulseDecay = 0;
  private fermentingFioleId: string | null = null;
  private fermentDecay = 0;
  /** Flux particulaires actifs (recommandations, étincelles distillation) */
  private activeFluxes: any[] = [];

  // ─── Lifecycle ───────────────────────────────────────────────────
  ngOnInit() { this.bootstrap(); }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.portal?.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
    }
    window.removeEventListener('resize', this.onResize);
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

  // ═══════════════════════════════════════════════════════════════════
  // INIT SCENE : cave voûtée, éclairage chaud, sol pierre
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scène + brouillard épais pour ambiance cave
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x1c1410);
    this.scene.fog = new T.FogExp2(0x1c1410, 0.035);

    // Caméra
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(0, 4, 14);
    this.camera.lookAt(0, 2, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lumière ambiante très basse (cave sombre)
    this.scene.add(new T.AmbientLight(0x3d2817, 0.4));
    // Lumière chaude depuis l'athanor (point light orange)
    const athanorLight = new T.PointLight(0xff7733, 2.5, 18, 1.5);
    athanorLight.position.set(0, 1.8, 0);
    athanorLight.userData.kind = 'athanorLight';
    this.athanorLight = athanorLight;
    this.scene.add(athanorLight);
    // Torches d'appoint sur les murs
    const torchL = new T.PointLight(0xffaa44, 0.8, 10);
    torchL.position.set(-5, 3.5, -5);
    this.scene.add(torchL);
    const torchR = new T.PointLight(0xffaa44, 0.8, 10);
    torchR.position.set(5, 3.5, -5);
    this.scene.add(torchR);

    // ─── Construction de la cave ───
    this.buildCellarStructure(T);
    this.buildAthanor(T);
    this.buildBalance(T);
    this.buildGrimoire(T);
    this.buildChimneyAndOwl(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 2, 0);
      this.controls.maxDistance = 30;
      this.controls.minDistance = 3;
      this.controls.maxPolarAngle = Math.PI / 2.05;
    }

    // Raycaster
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île du Commerce)
    const island = getIslandForRoom('/alchemist-cellar');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-13, 4, 0],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[AlchemistCellar] ⚗ Cave voûtée prête');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'alchemist-cellar',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // STRUCTURE : sol, murs, voûte, colonnes, étagères
  // ═══════════════════════════════════════════════════════════════════
  private buildCellarStructure(T: any) {
    const stoneMat = new T.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95, metalness: 0.05 });
    const darkStoneMat = new T.MeshStandardMaterial({ color: 0x2e2419, roughness: 0.98 });

    // Sol dallé
    const floor = new T.Mesh(new T.PlaneGeometry(20, 20, 4, 4), darkStoneMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Murs (low boxes pour des murs de pierre)
    const wallH = 5;
    const wallT = 0.4;
    const wallBack  = new T.Mesh(new T.BoxGeometry(20, wallH, wallT), stoneMat);
    wallBack.position.set(0, wallH / 2, -10);
    this.scene.add(wallBack);
    const wallLeft  = new T.Mesh(new T.BoxGeometry(wallT, wallH, 20), stoneMat);
    wallLeft.position.set(-10, wallH / 2, 0);
    this.scene.add(wallLeft);
    const wallRight = new T.Mesh(new T.BoxGeometry(wallT, wallH, 20), stoneMat);
    wallRight.position.set(10, wallH / 2, 0);
    this.scene.add(wallRight);

    // Voûte en arches croisées (TorusGeometry demi-arc)
    // 4 arches le long de la cave (axe Z) + 2 arches transverses (axe X)
    const archMat = new T.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 });
    for (let i = -2; i <= 2; i++) {
      // Arches transverses (suivant X) : demi-tores
      const torusGeom = new T.TorusGeometry(5, 0.3, 8, 24, Math.PI);
      const arch = new T.Mesh(torusGeom, archMat);
      arch.position.set(0, wallH, i * 3.5);
      arch.rotation.z = 0;     // plane XY
      this.scene.add(arch);
    }
    // 2 arches longitudinales (suivant Z) pour les croisements
    for (let i = -1; i <= 1; i += 2) {
      const torusGeom2 = new T.TorusGeometry(5, 0.25, 8, 24, Math.PI);
      const arch2 = new T.Mesh(torusGeom2, archMat);
      arch2.position.set(i * 4.5, wallH, 0);
      arch2.rotation.y = Math.PI / 2;
      this.scene.add(arch2);
    }

    // Colonnes centrales (4 cylindres)
    const colMat = new T.MeshStandardMaterial({ color: 0x6b5640, roughness: 0.85 });
    const colPositions: [number, number][] = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
    for (const [x, z] of colPositions) {
      const col = new T.Mesh(new T.CylinderGeometry(0.35, 0.4, wallH, 12), colMat);
      col.position.set(x, wallH / 2, z);
      this.scene.add(col);
      // Chapiteau
      const cap = new T.Mesh(new T.BoxGeometry(0.9, 0.2, 0.9), archMat);
      cap.position.set(x, wallH - 0.1, z);
      this.scene.add(cap);
      // Base
      const base = new T.Mesh(new T.BoxGeometry(0.9, 0.15, 0.9), archMat);
      base.position.set(x, 0.08, z);
      this.scene.add(base);
    }

    // Étagères : 3 étagères, une par provider (mur arrière, mur gauche, mur droit)
    const shelfMat = new T.MeshStandardMaterial({ color: 0x3e2a1c, roughness: 0.9 });
    // Provider AWS : mur arrière
    this.buildShelf(T, shelfMat, new T.Vector3(0, 0, -9.5), new T.Euler(0, 0, 0), 'aws');
    // Provider GCP : mur gauche
    this.buildShelf(T, shelfMat, new T.Vector3(-9.5, 0, 0), new T.Euler(0, Math.PI / 2, 0), 'gcp');
    // Provider Azure : mur droit
    this.buildShelf(T, shelfMat, new T.Vector3(9.5, 0, 0), new T.Euler(0, -Math.PI / 2, 0), 'azure');

    // Pierre noire (coûts non taggés) coin de la pièce
    const blackStone = new T.Mesh(
      new T.DodecahedronGeometry(0.55, 0),
      new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4, metalness: 0.6, emissive: 0x1a0a2a, emissiveIntensity: 0.4 })
    );
    blackStone.position.set(-7, 0.6, 7);
    this.scene.add(blackStone);
  }

  // Une étagère = backboard + 2 niveaux de planches qui recevront les fioles
  private buildShelf(T: any, mat: any, position: any, rotation: any, providerLabel: string) {
    const group = new T.Group();
    group.position.copy(position);
    group.rotation.copy(rotation);

    // Backboard (planche verticale contre le mur)
    const backboard = new T.Mesh(new T.BoxGeometry(8, 3.5, 0.08), mat);
    backboard.position.set(0, 2, -0.1);
    backboard.userData.tutorialId = 'shelf';
    group.userData.tutorialId = 'shelf';
    group.add(backboard);

    // Niveau bas (planche)
    const shelfBot = new T.Mesh(new T.BoxGeometry(8, 0.12, 0.6), mat);
    shelfBot.position.set(0, 1, 0.2);
    group.add(shelfBot);
    // Niveau haut
    const shelfTop = new T.Mesh(new T.BoxGeometry(8, 0.12, 0.6), mat);
    shelfTop.position.set(0, 2.5, 0.2);
    group.add(shelfTop);

    // Support latéraux
    const sideL = new T.Mesh(new T.BoxGeometry(0.12, 3, 0.6), mat);
    sideL.position.set(-4, 1.5, 0.2);
    group.add(sideL);
    const sideR = new T.Mesh(new T.BoxGeometry(0.12, 3, 0.6), mat);
    sideR.position.set(4, 1.5, 0.2);
    group.add(sideR);

    // Tag provider (petit cube coloré sur le côté)
    const tagColor = providerLabel === 'aws' ? 0xff9900 : providerLabel === 'gcp' ? 0x4285f4 : 0x0078d4;
    const tag = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.1), new T.MeshStandardMaterial({ color: tagColor, emissive: tagColor, emissiveIntensity: 0.5 }));
    tag.position.set(-3.9, 3.3, 0.2);
    group.add(tag);

    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FIOLES : 2 cylindres imbriqués (extérieur transparent + liquide intérieur)
  // ═══════════════════════════════════════════════════════════════════
  private buildFioleMesh(T: any, fiole: FioleData): { group: any; outer: any; liquid: any; baseLiquidY: number } {
    const group = new T.Group();
    const colorHex = SERVICE_COLOR[fiole.serviceKind];

    // Bouteille extérieure : cylindre étroit en verre semi-transparent
    const bottleR = 0.16;
    const bottleH = 0.9;
    const outerGeom = new T.CylinderGeometry(bottleR, bottleR, bottleH, 14, 1, true);
    const outerMat = new T.MeshPhysicalMaterial({
      color: 0xeeeeff,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.85,
      transparent: true,
      opacity: 0.45,
      side: T.DoubleSide,
    });
    const outer = new T.Mesh(outerGeom, outerMat);
    outer.position.y = bottleH / 2;
    group.add(outer);

    // Bouchon (petit cylindre étroit en haut)
    const corkGeom = new T.CylinderGeometry(bottleR * 0.7, bottleR * 0.8, 0.12, 10);
    const corkMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const cork = new T.Mesh(corkGeom, corkMat);
    cork.position.y = bottleH + 0.06;
    group.add(cork);

    // Liquide intérieur (cylindre plein, scale Y animé)
    // Niveau initial proportionnel au coût (entre 0.15 et 0.95)
    const liquidLevel = Math.max(0.15, Math.min(0.95, fiole.costEur / 1500));
    const innerR = bottleR * 0.85;
    const liquidGeom = new T.CylinderGeometry(innerR, innerR, bottleH * 0.9, 12);
    const liquidMat = new T.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92,
    });
    const liquid = new T.Mesh(liquidGeom, liquidMat);
    // On scale depuis le bas : déplace le pivot pour scaler vers le haut
    liquid.geometry.translate(0, (bottleH * 0.9) / 2, 0);
    liquid.scale.y = liquidLevel;
    liquid.position.y = 0.05;
    group.add(liquid);

    return { group, outer, liquid, baseLiquidY: liquidLevel };
  }

  // Place toutes les fioles sur leurs étagères respectives par provider
  private placeFioles(T: any) {
    // Nettoyage
    for (const { outer } of this.fioleMeshes.values()) {
      outer.parent?.parent?.remove(outer.parent);
    }
    this.fioleMeshes.clear();
    this.fioleHitMeshes = [];
    this.fioleByMesh.clear();
    for (const { points } of this.bubblesByFiole.values()) {
      this.scene.remove(points);
    }
    this.bubblesByFiole.clear();

    // Positions par provider (mur arrière, gauche, droit)
    const shelfMap: Record<Provider, { center: any; normal: any; rotY: number }> = {
      aws:   { center: new T.Vector3(0, 0, -9.2),  normal: new T.Vector3(0, 0, 1),  rotY: 0 },
      gcp:   { center: new T.Vector3(-9.2, 0, 0),  normal: new T.Vector3(1, 0, 0),  rotY: Math.PI / 2 },
      azure: { center: new T.Vector3(9.2, 0, 0),   normal: new T.Vector3(-1, 0, 0), rotY: -Math.PI / 2 },
    };

    // On groupe par provider
    const byProvider: Record<Provider, FioleData[]> = { aws: [], gcp: [], azure: [] };
    for (const f of this.fioles()) byProvider[f.provider].push(f);

    for (const provider of Object.keys(byProvider) as Provider[]) {
      const list = byProvider[provider];
      const shelf = shelfMap[provider];
      // Réparti sur 2 niveaux (bas y=1.0, haut y=2.5)
      list.forEach((fiole, idx) => {
        const level = idx < 3 ? 1 : 2;  // 3 fioles par niveau
        const slot = idx % 3;            // 0,1,2
        // Position le long du mur (axe perpendiculaire au normal)
        const tangent = new T.Vector3(shelf.normal.z, 0, -shelf.normal.x);
        const offset = (slot - 1) * 1.6;
        const yBase = level === 1 ? 1.08 : 2.58;
        const pos = shelf.center.clone()
          .add(tangent.multiplyScalar(offset))
          .add(shelf.normal.clone().multiplyScalar(0.5));
        pos.y = yBase;

        const { group, outer, liquid, baseLiquidY } = this.buildFioleMesh(T, fiole);
        group.position.copy(pos);
        group.rotation.y = shelf.rotY;
        group.userData = { kind: 'fiole', id: fiole.id };
        // Première fiole de l'AWS shelf = représentative pour le tutorial
        if (provider === 'aws' && idx === 0) {
          group.userData.tutorialId = 'fiole';
          outer.userData.tutorialId = 'fiole';
        }
        this.scene.add(group);

        // L'outer = mesh cliquable
        outer.userData = { ...(outer.userData || {}), kind: 'fiole', id: fiole.id };
        this.fioleHitMeshes.push(outer);
        this.fioleByMesh.set(outer, fiole);

        this.fioleMeshes.set(fiole.id, { outer, liquid, data: fiole, baseLiquidY });

        // Si anomalie : bulles
        if (fiole.isAnomaly) {
          this.spawnBubblesFor(T, fiole.id, pos.clone().add(new T.Vector3(0, 0.9, 0)));
        }
      });
    }
  }

  // Bulles qui montent d'une fiole anormale
  private spawnBubblesFor(T: any, fioleId: string, originPos: any) {
    const count = 14;
    const positions = new Float32Array(count * 3);
    const velocities: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = originPos.x + (Math.random() - 0.5) * 0.08;
      positions[i * 3 + 1] = originPos.y + Math.random() * 1.2;
      positions[i * 3 + 2] = originPos.z + (Math.random() - 0.5) * 0.08;
      velocities.push(0.4 + Math.random() * 0.6);
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xffe066,
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    const points = new T.Points(geom, mat);
    points.userData = { kind: 'bubbles', fioleId, originY: originPos.y };
    this.scene.add(points);
    this.bubblesByFiole.set(fioleId, { points, geom, velocities });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ATHANOR : fourneau central avec flammes (particules) + cristaux au pied
  // ═══════════════════════════════════════════════════════════════════
  private buildAthanor(T: any) {
    // Base massive (cylindre large brique sombre)
    const base = new T.Mesh(
      new T.CylinderGeometry(1.0, 1.2, 1.4, 16),
      new T.MeshStandardMaterial({ color: 0x3a241a, roughness: 0.9, emissive: 0x331100, emissiveIntensity: 0.3 })
    );
    base.position.set(0, 0.7, 0);
    base.userData.tutorialId = 'athanor';
    this.scene.add(base);

    // Corps supérieur (cylindre plus étroit)
    const body = new T.Mesh(
      new T.CylinderGeometry(0.65, 0.9, 1.2, 16),
      new T.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.85 })
    );
    body.position.set(0, 2.0, 0);
    this.scene.add(body);

    // Couvercle bombé
    const lid = new T.Mesh(
      new T.SphereGeometry(0.65, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new T.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.7, metalness: 0.3 })
    );
    lid.position.set(0, 2.6, 0);
    this.scene.add(lid);

    // Ouverture du fourneau (anneau lumineux)
    const opening = new T.Mesh(
      new T.TorusGeometry(0.45, 0.08, 8, 16),
      new T.MeshStandardMaterial({ color: 0xff5500, emissive: 0xff3300, emissiveIntensity: 1.2 })
    );
    opening.position.set(0, 1.4, 0);
    opening.rotation.x = Math.PI / 2;
    opening.userData.tutorialId = 'athanor';
    this.athanorOpening = opening;
    this.scene.add(opening);

    // Flammes particulaires en bouillonnement au-dessus du couvercle
    const flameCount = 40;
    const flamePositions = new Float32Array(flameCount * 3);
    const flameColors = new Float32Array(flameCount * 3);
    for (let i = 0; i < flameCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.4;
      flamePositions[i * 3 + 0] = Math.cos(a) * r;
      flamePositions[i * 3 + 1] = 2.8 + Math.random() * 0.8;
      flamePositions[i * 3 + 2] = Math.sin(a) * r;
      flameColors[i * 3 + 0] = 1;
      flameColors[i * 3 + 1] = 0.4 + Math.random() * 0.4;
      flameColors[i * 3 + 2] = 0.1;
    }
    const flameGeom = new T.BufferGeometry();
    flameGeom.setAttribute('position', new T.BufferAttribute(flamePositions, 3));
    flameGeom.setAttribute('color', new T.BufferAttribute(flameColors, 3));
    const flameMat = new T.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
    });
    this.athanorFlames = new T.Points(flameGeom, flameMat);
    this.athanorFlameGeom = flameGeom;
    this.scene.add(this.athanorFlames);

    // Cristaux distillés au pied de l'athanor (clusters d'icosaèdres)
    this.crystalMeshes = [];
    const crystalColors = [0x84cc16, 0xfacc15, 0x60a5fa];
    for (let i = 0; i < 4; i++) {
      const cluster = new T.Group();
      const angle = (i / 4) * Math.PI * 2;
      const r = 1.6;
      cluster.position.set(Math.cos(angle) * r, 0.15, Math.sin(angle) * r);
      for (let j = 0; j < 3; j++) {
        const size = 0.12 + Math.random() * 0.08;
        const c = crystalColors[i % crystalColors.length];
        const crystal = new T.Mesh(
          new T.IcosahedronGeometry(size, 0),
          new T.MeshStandardMaterial({
            color: c,
            emissive: c,
            emissiveIntensity: 0.7,
            roughness: 0.2,
            metalness: 0.6,
            transparent: true,
            opacity: 0.9,
          })
        );
        crystal.position.set((Math.random() - 0.5) * 0.3, size, (Math.random() - 0.5) * 0.3);
        crystal.rotation.set(Math.random(), Math.random(), Math.random());
        cluster.add(crystal);
      }
      // Premier cluster = représentatif pour le tutorial
      if (i === 0) cluster.userData.tutorialId = 'crystal';
      this.crystalMeshes.push(cluster);
      this.scene.add(cluster);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BALANCE ROMAINE : tore (poignée) + 2 plateaux suspendus
  // ═══════════════════════════════════════════════════════════════════
  private buildBalance(T: any) {
    const group = new T.Group();
    group.position.set(-5, 0, 5);
    group.userData.tutorialId = 'balance';

    // Pied
    const pole = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.08, 2.2, 8),
      new T.MeshStandardMaterial({ color: 0x9a7a4a, metalness: 0.7, roughness: 0.4 })
    );
    pole.position.y = 1.1;
    group.add(pole);

    // Arm horizontal (cylindre)
    this.balanceArm = new T.Group();
    this.balanceArm.position.y = 2.2;
    const arm = new T.Mesh(
      new T.CylinderGeometry(0.05, 0.05, 1.6, 8),
      new T.MeshStandardMaterial({ color: 0xb89456, metalness: 0.8, roughness: 0.3 })
    );
    arm.rotation.z = Math.PI / 2;
    this.balanceArm.add(arm);

    // Poignée centrale = tore
    const handle = new T.Mesh(
      new T.TorusGeometry(0.1, 0.03, 6, 12),
      new T.MeshStandardMaterial({ color: 0xddb060, metalness: 0.9, roughness: 0.2, emissive: 0x553311, emissiveIntensity: 0.3 })
    );
    handle.rotation.x = Math.PI / 2;
    this.balanceArm.add(handle);

    // 2 plateaux : tore aplati = pan
    for (const side of [-1, 1]) {
      const pan = new T.Mesh(
        new T.CylinderGeometry(0.35, 0.4, 0.06, 14),
        new T.MeshStandardMaterial({ color: 0xb89456, metalness: 0.7, roughness: 0.4 })
      );
      pan.position.set(side * 0.78, -0.5, 0);
      this.balanceArm.add(pan);
      // Chaînes (3 fines lignes par plateau approximées par cylindres)
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2;
        const chain = new T.Mesh(
          new T.CylinderGeometry(0.01, 0.01, 0.5, 4),
          new T.MeshStandardMaterial({ color: 0x9a7a4a, metalness: 0.8 })
        );
        chain.position.set(side * 0.78 + Math.cos(ang) * 0.25, -0.25, Math.sin(ang) * 0.25);
        this.balanceArm.add(chain);
      }
    }
    group.add(this.balanceArm);
    this.balanceGroup = group;
    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // GRIMOIRE : livre ouvert sur table latérale
  // ═══════════════════════════════════════════════════════════════════
  private buildGrimoire(T: any) {
    const group = new T.Group();
    group.position.set(5, 0, 5);
    group.userData.tutorialId = 'grimoire';

    // Table
    const table = new T.Mesh(
      new T.BoxGeometry(1.6, 1.0, 1.0),
      new T.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.85 })
    );
    table.position.y = 0.5;
    group.add(table);

    // Couverture du grimoire (cuir sombre)
    const bookBase = new T.Mesh(
      new T.BoxGeometry(1.2, 0.08, 0.8),
      new T.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.95, emissive: 0x331108, emissiveIntensity: 0.2 })
    );
    bookBase.position.set(0, 1.04, 0);
    bookBase.rotation.x = -0.15;
    group.add(bookBase);

    // Pages (planes inclinées émissives = pages éclairées)
    const pageGeom = new T.PlaneGeometry(0.55, 0.75);
    const pageMat = new T.MeshStandardMaterial({
      color: 0xefe1c2,
      emissive: 0xfacc15,
      emissiveIntensity: 0.18,
      roughness: 0.75,
      side: T.DoubleSide,
    });
    const pageL = new T.Mesh(pageGeom, pageMat);
    pageL.position.set(-0.3, 1.1, 0);
    pageL.rotation.x = -Math.PI / 2 + 0.15;
    group.add(pageL);
    const pageR = new T.Mesh(pageGeom, pageMat);
    pageR.position.set(0.3, 1.1, 0);
    pageR.rotation.x = -Math.PI / 2 + 0.15;
    group.add(pageR);

    // Plume
    const quill = new T.Mesh(
      new T.ConeGeometry(0.03, 0.5, 6),
      new T.MeshStandardMaterial({ color: 0xe8d8b0 })
    );
    quill.position.set(0.5, 1.3, 0.3);
    quill.rotation.set(0.4, 0, -0.5);
    group.add(quill);

    // Référence pour les méthodes cinematic (open/glow/floats)
    this.grimoireGroup = group;
    this.grimoirePages = [pageL, pageR];
    this.grimoireBase = bookBase;
    this.grimoireBaseY = group.position.y;

    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHEMINÉE + HIBOU
  // ═══════════════════════════════════════════════════════════════════
  private buildChimneyAndOwl(T: any) {
    // Cheminée (cylindre creux qui descend du plafond)
    const chimney = new T.Mesh(
      new T.CylinderGeometry(0.6, 0.7, 1.8, 12, 1, true),
      new T.MeshStandardMaterial({ color: 0x2e1c12, roughness: 0.9, side: T.DoubleSide })
    );
    chimney.position.set(0, 5.5, 0);
    this.scene.add(chimney);

    // Petite flamme dans la cheminée (cone émissive animé)
    const flameGeom = new T.ConeGeometry(0.3, 0.7, 8);
    const flameMat = new T.MeshStandardMaterial({
      color: 0xff5522,
      emissive: 0xff3300,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.85,
    });
    this.chimneyFlame = new T.Mesh(flameGeom, flameMat);
    this.chimneyFlame.position.set(0, 5.2, 0);
    this.scene.add(this.chimneyFlame);

    // Fumée s'élevant (particules)
    const smokeCount = 25;
    const smokePos = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      smokePos[i * 3 + 0] = (Math.random() - 0.5) * 0.3;
      smokePos[i * 3 + 1] = 6.0 + Math.random() * 1.5;
      smokePos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    const smokeGeom = new T.BufferGeometry();
    smokeGeom.setAttribute('position', new T.BufferAttribute(smokePos, 3));
    const smokeMat = new T.PointsMaterial({
      color: 0x9a8a78,
      size: 0.32,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    this.chimneySmoke = new T.Points(smokeGeom, smokeMat);
    this.chimneySmokeGeom = smokeGeom;
    this.scene.add(this.chimneySmoke);

    // ─── Hibou perché sur la cheminée ───
    const owlGroup = new T.Group();
    owlGroup.position.set(0.8, 6.4, 0);
    owlGroup.userData.tutorialId = 'owl';

    // Corps : ellipsoïde (sphère écrasée)
    this.owlBody = new T.Mesh(
      new T.SphereGeometry(0.32, 16, 12),
      new T.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.85 })
    );
    this.owlBody.scale.set(1, 1.2, 0.9);
    owlGroup.add(this.owlBody);

    // Tête (sphère plus petite)
    this.owlHead = new T.Mesh(
      new T.SphereGeometry(0.22, 16, 12),
      new T.MeshStandardMaterial({ color: 0x7b5a44, roughness: 0.85 })
    );
    this.owlHead.position.y = 0.42;
    owlGroup.add(this.owlHead);

    // Grands yeux jaunes
    this.owlEyeL = new T.Mesh(
      new T.SphereGeometry(0.08, 12, 8),
      new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.6 })
    );
    this.owlEyeL.position.set(-0.1, 0.45, 0.18);
    owlGroup.add(this.owlEyeL);
    this.owlEyeR = new T.Mesh(
      new T.SphereGeometry(0.08, 12, 8),
      new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.6 })
    );
    this.owlEyeR.position.set(0.1, 0.45, 0.18);
    owlGroup.add(this.owlEyeR);

    // Pupilles
    const pupilMat = new T.MeshStandardMaterial({ color: 0x000000 });
    const pupL = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), pupilMat);
    pupL.position.set(-0.1, 0.45, 0.25);
    owlGroup.add(pupL);
    const pupR = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), pupilMat);
    pupR.position.set(0.1, 0.45, 0.25);
    owlGroup.add(pupR);

    // Bec (petit cône)
    const beak = new T.Mesh(
      new T.ConeGeometry(0.04, 0.1, 6),
      new T.MeshStandardMaterial({ color: 0xd4a44a })
    );
    beak.position.set(0, 0.38, 0.2);
    beak.rotation.x = Math.PI / 2;
    owlGroup.add(beak);

    // Ailes (deux plans repliés contre le corps, ouvrables via owlScreech)
    const wingGeom = new T.PlaneGeometry(0.45, 0.5);
    const wingMat = new T.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9, side: T.DoubleSide });
    this.owlWingL = new T.Mesh(wingGeom, wingMat);
    this.owlWingL.position.set(-0.3, 0.05, 0);
    this.owlWingL.rotation.y = 0.4;
    this.owlWingL.rotation.z = 0.1;
    owlGroup.add(this.owlWingL);
    this.owlWingR = new T.Mesh(wingGeom, wingMat);
    this.owlWingR.position.set(0.3, 0.05, 0);
    this.owlWingR.rotation.y = -0.4;
    this.owlWingR.rotation.z = -0.1;
    owlGroup.add(this.owlWingR);

    this.owlGroup = owlGroup;
    this.scene.add(owlGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA : 3 providers × 6 services + anomalies + recommandations
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const services: Array<{ kind: ServiceKind; name: string }> = [
      { kind: 'compute', name: 'EC2/Compute' },
      { kind: 'storage', name: 'S3/Storage' },
      { kind: 'network', name: 'CloudFront' },
      { kind: 'ai',      name: 'SageMaker/AI' },
      { kind: 'db',      name: 'RDS/Database' },
      { kind: 'compute', name: 'Lambda' },
    ];
    const providers: Provider[] = ['aws', 'gcp', 'azure'];
    const out: FioleData[] = [];
    let id = 1;
    for (const p of providers) {
      services.forEach((svc, idx) => {
        const baseline = 300 + Math.random() * 800;
        // Quelques anomalies (~10%)
        const anomaly = (p === 'aws' && idx === 0) || (p === 'gcp' && idx === 3);
        const cost = anomaly ? baseline * (1.45 + Math.random() * 0.3) : baseline * (0.85 + Math.random() * 0.25);
        out.push({
          id: `${p}-${id++}`,
          provider: p,
          serviceKind: svc.kind,
          serviceName: `${p.toUpperCase()} ${svc.name}`,
          costEur: Math.round(cost),
          baselineEur: Math.round(baseline),
          trend: anomaly ? 'up' : (Math.random() > 0.5 ? 'flat' : 'down'),
          recommendation: anomaly ? 'Reserved Instances 1y → -32% sur ce service' : (idx === 1 ? 'Migrate to S3 Intelligent-Tiering' : undefined),
          isAnomaly: anomaly,
        });
      });
    }
    this.fioles.set(out);

    // Cristaux (économies déjà réalisées)
    this.crystals.set([
      { id: 'c1', savingEur: 612, label: 'Rightsizing EC2 fleet' },
      { id: 'c2', savingEur: 248, label: 'S3 Lifecycle policies' },
      { id: 'c3', savingEur: 480, label: 'Reserved RDS instances' },
    ]);

    // Recommandations en attente de distillation
    this.recommendations.set([
      { id: 'r1', serviceId: out[0].id, action: 'Migrate to Graviton',     estSavingEur: 320, effort: 'medium' },
      { id: 'r2', serviceId: out[2].id, action: 'Use CloudFront caching',  estSavingEur: 140, effort: 'low' },
      { id: 'r3', serviceId: out[8].id, action: 'Compress AI batch jobs',  estSavingEur: 560, effort: 'high' },
      { id: 'r4', serviceId: out[5].id, action: 'Cold storage for backups',estSavingEur: 95,  effort: 'low' },
    ]);

    const T = (window as any).THREE;
    this.placeFioles(T);
    this.emitCeremony({ type: 'crystal', label: 'Billing data chargée · 18 fioles distillées', icon: '⚗' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTIONS UI
  // ═══════════════════════════════════════════════════════════════════
  distillRecommendation() {
    const recs = this.recommendations();
    if (recs.length === 0) {
      this.emitCeremony({ type: 'crystal', label: 'Plus de recommandations à distiller', icon: '💎' });
      return;
    }
    // Prend la première avec le plus gros saving
    const best = [...recs].sort((a, b) => b.estSavingEur - a.estSavingEur)[0];
    this.recommendations.set(recs.filter(r => r.id !== best.id));
    // Ajoute un cristal d'économie
    this.crystals.update(arr => [...arr, { id: 'c-' + Date.now(), savingEur: best.estSavingEur, label: best.action }]);
    // Spawn d'un cristal visuel près de l'athanor
    this.spawnNewCrystal();
    const isBig = best.estSavingEur >= 500;
    this.emitCeremony({
      type: isBig ? 'crystal' : 'balance',
      label: isBig ? `💎 Cristallisation · ${best.estSavingEur}€ économisés` : `⚖ ${best.action} appliqué`,
      icon: isBig ? '💎' : '⚖',
    });
  }

  private spawnNewCrystal() {
    const T = (window as any).THREE;
    const cluster = new T.Group();
    const angle = Math.random() * Math.PI * 2;
    const r = 1.8 + Math.random() * 0.4;
    cluster.position.set(Math.cos(angle) * r, 0.15, Math.sin(angle) * r);
    const color = 0x84cc16;
    for (let j = 0; j < 3; j++) {
      const size = 0.14 + Math.random() * 0.08;
      const crystal = new T.Mesh(
        new T.IcosahedronGeometry(size, 0),
        new T.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 1.0,
          roughness: 0.15, metalness: 0.7, transparent: true, opacity: 0.95,
        })
      );
      crystal.position.set((Math.random() - 0.5) * 0.3, size, (Math.random() - 0.5) * 0.3);
      crystal.rotation.set(Math.random(), Math.random(), Math.random());
      cluster.add(crystal);
    }
    cluster.userData = { kind: 'crystal', isNew: true, spawnAt: this.elapsed };
    this.crystalMeshes.push(cluster);
    this.scene.add(cluster);
  }

  triggerAnomaly() {
    // Choisit une fiole non-anomalie au hasard et la marque
    const candidates = this.fioles().filter(f => !f.isAnomaly);
    if (candidates.length === 0) {
      this.emitCeremony({ type: 'eruption', label: 'Toutes les fioles sont déjà anormales !', icon: '🌋' });
      return;
    }
    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    this.fioles.update(arr => arr.map(f => f.id === victim.id ? { ...f, isAnomaly: true, costEur: Math.round(f.baselineEur * 1.6), trend: 'up' as const } : f));
    // Spawn bulles
    const T = (window as any).THREE;
    const fmesh = this.fioleMeshes.get(victim.id);
    if (fmesh) {
      const worldPos = new T.Vector3();
      fmesh.outer.getWorldPosition(worldPos);
      worldPos.y += 0.5;
      this.spawnBubblesFor(T, victim.id, worldPos);
    }
    this.emitCeremony({ type: 'eruption', label: `🌋 Éruption · ${victim.serviceName} +60%`, icon: '🌋' });
  }

  testOwlAlert() {
    this.emitCeremony({ type: 'owl', label: '🦉 Hululement · 80% du budget atteint', icon: '🦉' });
    // Boost intensité des yeux brièvement
    if (this.owlEyeL && this.owlEyeR) {
      (this.owlEyeL.material as any).emissiveIntensity = 2.5;
      (this.owlEyeR.material as any).emissiveIntensity = 2.5;
      setTimeout(() => {
        if (this.owlEyeL) (this.owlEyeL.material as any).emissiveIntensity = 0.6;
        if (this.owlEyeR) (this.owlEyeR.material as any).emissiveIntensity = 0.6;
      }, 1400);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoqués par le playExample tutorial JSON
  // Chaque méthode est publique + safe (early return si refs absentes).
  // ═══════════════════════════════════════════════════════════════════

  /** 🫧 FERMENT RECIPE — bulles depuis une fiole + mixture change couleur (budget en cours) */
  fermentRecipe(fioleId?: string) {
    const T = (window as any).THREE;
    if (!T) return;
    // Cible : id fourni, sinon première fiole disponible
    const allIds = Array.from(this.fioleMeshes.keys());
    if (allIds.length === 0) return;
    const targetId = fioleId && this.fioleMeshes.has(fioleId) ? fioleId : allIds[0];
    const entry = this.fioleMeshes.get(targetId);
    if (!entry) return;
    const worldPos = new T.Vector3();
    entry.outer.getWorldPosition(worldPos);
    worldPos.y += 0.55;
    // Spawn bulles si pas déjà présentes
    if (!this.bubblesByFiole.has(targetId)) {
      this.spawnBubblesFor(T, targetId, worldPos);
    }
    // Liquide change progressivement de couleur (vers ambré "en fermentation")
    const liqMat = entry.liquid.material;
    if (liqMat) {
      try {
        liqMat.color.set(0xfbbf24);
        liqMat.emissive.set(0xb45309);
        liqMat.emissiveIntensity = 0.8;
      } catch {}
    }
    // Tag pour le clean-up + boost athanor doux
    this.fermentingFioleId = targetId;
    this.fermentDecay = 4.5;
    this.emitCeremony({ type: 'balance', label: '🫧 Fermentation · budget en cours de mesure', icon: '🫧' });
  }

  /** 🔥 ATHANOR FIRE — athanor s'embrase + glow rouge (processus comptable lancé) */
  athanorFire() {
    if (!this.athanorOpening || !this.athanorLight) return;
    this.athanorFireBoost = 4.0; // décompté dans animate()
    this.emitCeremony({ type: 'eruption', label: '🔥 Athanor sacré · Cost engine lancé', icon: '🔥' });
  }

  /** 💎 CRYSTALLIZE — cristal apparaît avec rayons (insight distillé enregistré) */
  crystallize(savingEur: number = 480) {
    const T = (window as any).THREE;
    if (!T) return;
    this.spawnNewCrystal();
    // Burst de particules rayonnantes depuis le pied de l'athanor
    const count = 80;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = 0.4;
      positions[i * 3 + 2] = 0;
      const ang = Math.random() * Math.PI * 2;
      const elev = Math.random() * 0.6 + 0.3;
      const sp = 0.06 + Math.random() * 0.1;
      velocities[i * 3 + 0] = Math.cos(ang) * sp;
      velocities[i * 3 + 1] = elev * 0.6;
      velocities[i * 3 + 2] = Math.sin(ang) * sp;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xfde047,
      size: 0.22,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      blending: T.AdditiveBlending,
    });
    const burst = new T.Points(geom, mat);
    burst.userData = { kind: 'crystal-rays', velocities, age: 0, ttl: 2.2 };
    this.activeFluxes.push(burst);
    this.scene.add(burst);
    this.emitCeremony({ type: 'crystal', label: `💎 Cristallisation · ${savingEur}€ insight distillé`, icon: '💎' });
  }

  /** ⚖ BALANCE TILT — balance s'incline (budget warning over/under) */
  balanceTilt(direction: 'over' | 'under' | 'left' | 'right' = 'over') {
    if (!this.balanceArm) return;
    const sign = (direction === 'over' || direction === 'left') ? 1 : -1;
    this.balanceTiltTarget = sign * 0.45;
    this.balanceTiltDecay = 3.5;
    this.emitCeremony({
      type: 'balance',
      label: direction === 'over' ? '⚖ Balance penche · cost overrun détecté' : '⚖ Balance penche · économie possible',
      icon: '⚖',
    });
  }

  /** 🦉 OWL SCREECH — hibou ailes ouvertes + pulse rouge (alerte audit) */
  owlScreech() {
    if (!this.owlGroup) return;
    this.owlPulse = 1.0;
    this.owlPulseDecay = 3.0;
    // Boost eyes en rouge alarme
    const T = (window as any).THREE;
    if (this.owlEyeL && this.owlEyeR && T) {
      try {
        (this.owlEyeL.material as any).color.set(0xef4444);
        (this.owlEyeR.material as any).color.set(0xef4444);
        (this.owlEyeL.material as any).emissive.set(0xdc2626);
        (this.owlEyeR.material as any).emissive.set(0xdc2626);
        (this.owlEyeL.material as any).emissiveIntensity = 2.6;
        (this.owlEyeR.material as any).emissiveIntensity = 2.6;
      } catch {}
      setTimeout(() => {
        try {
          if (this.owlEyeL) {
            (this.owlEyeL.material as any).color.set(0xfacc15);
            (this.owlEyeL.material as any).emissive.set(0xfacc15);
            (this.owlEyeL.material as any).emissiveIntensity = 0.6;
          }
          if (this.owlEyeR) {
            (this.owlEyeR.material as any).color.set(0xfacc15);
            (this.owlEyeR.material as any).emissive.set(0xfacc15);
            (this.owlEyeR.material as any).emissiveIntensity = 0.6;
          }
        } catch {}
      }, 3000);
    }
    this.emitCeremony({ type: 'owl', label: '🦉 Hibou Veilleur · Audit alert levée', icon: '🦉' });
  }

  /** 📖 GRIMOIRE OPEN — grimoire flotte ouvert avec pages tournant (savoir capitalisé) */
  grimoireOpen() {
    if (!this.grimoireGroup) return;
    this.grimoireOpenState = 1.0;
    this.grimoireOpenDecay = 5.0;
    // Boost émission pages
    for (const p of this.grimoirePages) {
      if (p?.material) {
        try {
          (p.material as any).emissiveIntensity = 1.4;
        } catch {}
      }
    }
    setTimeout(() => {
      for (const p of this.grimoirePages) {
        if (p?.material) {
          try { (p.material as any).emissiveIntensity = 0.18; } catch {}
        }
      }
    }, 5000);
    this.emitCeremony({ type: 'crystal', label: '📖 Grimoire ouvert · Lessons learned capitalisées', icon: '📖' });
  }

  /** 🫗 DISTILL RECOMMENDATION — flux qui converge d'une fiole vers le grimoire (recommandation savants) */
  distillRecommendationFlow(fromFioleId?: string) {
    const T = (window as any).THREE;
    if (!T || !this.grimoireGroup) return;
    const allIds = Array.from(this.fioleMeshes.keys());
    if (allIds.length === 0) return;
    const targetId = fromFioleId && this.fioleMeshes.has(fromFioleId) ? fromFioleId : allIds[0];
    const entry = this.fioleMeshes.get(targetId);
    if (!entry) return;
    const fromPos = new T.Vector3();
    entry.outer.getWorldPosition(fromPos);
    fromPos.y += 0.5;
    const toPos = new T.Vector3();
    this.grimoireGroup.getWorldPosition(toPos);
    toPos.y += 1.2;
    // Stream de particules de fromPos → toPos
    const count = 30;
    const positions = new Float32Array(count * 3);
    const stream: any[] = [];
    for (let i = 0; i < count; i++) {
      const t0 = i / count;
      positions[i * 3 + 0] = fromPos.x;
      positions[i * 3 + 1] = fromPos.y;
      positions[i * 3 + 2] = fromPos.z;
      stream.push({ t: t0, speed: 0.5 + Math.random() * 0.3 });
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xa3e635,
      size: 0.14,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: T.AdditiveBlending,
    });
    const flow = new T.Points(geom, mat);
    flow.userData = {
      kind: 'distill-flow',
      stream,
      from: fromPos.clone(),
      to: toPos.clone(),
      age: 0,
      ttl: 4.0,
    };
    this.activeFluxes.push(flow);
    this.scene.add(flow);
    // Pages clignotent quand le flux arrive
    setTimeout(() => this.grimoireOpen(), 1500);
    this.emitCeremony({ type: 'crystal', label: '🫗 Distillation savants · recommandation vers grimoire', icon: '🫗' });
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 4, 14);
    this.camera.lookAt(0, 2, 0);
    if (this.controls) this.controls.target.set(0, 2, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('alchemist-cellar', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic fiole → ouvrir le panel détail
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
    const intersects = this.raycaster.intersectObjects(this.fioleHitMeshes, false);
    if (intersects.length > 0) {
      const fiole = this.fioleByMesh.get(intersects[0].object);
      if (fiole) {
        this.selectedFiole.set(fiole);
        // Petit flash de scale sur la fiole cliquée
        const group = intersects[0].object.parent;
        if (group) {
          group.scale.set(1.18, 1.18, 1.18);
          setTimeout(() => group?.scale.set(1, 1, 1), 220);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP — animations live
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // ─── Fioles : niveau de liquide fluctue (sinus pour réalisme) ───
    for (const { liquid, baseLiquidY, data } of this.fioleMeshes.values()) {
      const wobble = Math.sin(this.elapsed * 0.6 + data.id.length) * 0.04;
      const trendBias = data.trend === 'up' ? Math.sin(this.elapsed * 0.3) * 0.02 : 0;
      const targetY = Math.max(0.1, Math.min(1.0, baseLiquidY + wobble + trendBias));
      liquid.scale.y = targetY;
    }

    // ─── Bulles d'anomalies : montent et bouclent ───
    for (const [fioleId, b] of this.bubblesByFiole.entries()) {
      const posAttr = b.geom.attributes['position'];
      const arr = posAttr.array as Float32Array;
      const originY = b.points.userData.originY ?? 1.5;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3 + 1] += b.velocities[i] * dt * 0.8;
        if (arr[i * 3 + 1] > originY + 2.5) {
          arr[i * 3 + 1] = originY;
        }
      }
      posAttr.needsUpdate = true;
    }

    // ─── Athanor : flammes flickering ───
    if (this.athanorFlameGeom) {
      const posAttr = this.athanorFlameGeom.attributes['position'];
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3 + 1] += (0.6 + Math.random() * 0.4) * dt;
        if (arr[i * 3 + 1] > 4.2) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.4;
          arr[i * 3 + 0] = Math.cos(a) * r;
          arr[i * 3 + 1] = 2.8;
          arr[i * 3 + 2] = Math.sin(a) * r;
        }
      }
      posAttr.needsUpdate = true;
    }
    if (this.athanorFlames) {
      this.athanorFlames.material.opacity = 0.7 + Math.sin(this.elapsed * 7) * 0.25;
    }

    // ─── Cristaux : scintillement (rotation et pulsation) ───
    for (let i = 0; i < this.crystalMeshes.length; i++) {
      const c = this.crystalMeshes[i];
      c.rotation.y += dt * 0.4;
      c.position.y = 0.15 + Math.sin(this.elapsed * 1.4 + i) * 0.04;
      // Cristaux nouvellement spawnés : grossissent
      if (c.userData?.isNew) {
        const age = this.elapsed - (c.userData.spawnAt ?? 0);
        const s = Math.min(1, age * 1.5);
        c.scale.set(s, s, s);
        if (s >= 1) c.userData.isNew = false;
      }
    }

    // ─── Cheminée : flamme qui pulse + fumée qui monte ───
    if (this.chimneyFlame) {
      const s = 1 + Math.sin(this.elapsed * 12) * 0.15;
      this.chimneyFlame.scale.set(s, 1 + Math.sin(this.elapsed * 9) * 0.2, s);
      (this.chimneyFlame.material as any).emissiveIntensity = 1.4 + Math.sin(this.elapsed * 8) * 0.3;
    }
    if (this.chimneySmokeGeom) {
      const posAttr = this.chimneySmokeGeom.attributes['position'];
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3 + 1] += 0.3 * dt;
        arr[i * 3 + 0] += Math.sin(this.elapsed + i) * 0.005;
        if (arr[i * 3 + 1] > 8.5) {
          arr[i * 3 + 0] = (Math.random() - 0.5) * 0.3;
          arr[i * 3 + 1] = 6.0;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }
      }
      posAttr.needsUpdate = true;
    }

    // ─── Hibou : tourne la tête de temps en temps ───
    if (this.owlHead) {
      const turn = Math.sin(this.elapsed * 0.4) * 0.7;
      // Mouvement saccadé : on échantillonne par paliers
      const stepped = Math.round(turn * 3) / 3;
      this.owlHead.rotation.y += (stepped - this.owlHead.rotation.y) * dt * 4;
      // Petit clignement périodique
      const blink = Math.sin(this.elapsed * 0.3) > 0.97 ? 0.05 : 1;
      if (this.owlEyeL) this.owlEyeL.scale.y = blink;
      if (this.owlEyeR) this.owlEyeR.scale.y = blink;
    }

    // ─── Balance : oscille doucement OU tilt cinematic actif ───
    if (this.balanceArm) {
      if (this.balanceTiltDecay > 0) {
        // Tilt forcé vers la cible, puis decay
        this.balanceTiltDecay -= dt;
        const target = this.balanceTiltDecay > 0 ? this.balanceTiltTarget : 0;
        this.balanceArm.rotation.z += (target - this.balanceArm.rotation.z) * dt * 3.5;
      } else {
        this.balanceArm.rotation.z = Math.sin(this.elapsed * 0.7) * 0.04;
      }
    }

    // ─── Lumière athanor : pulse + boost cinematic ───
    let athanorBoost = 0;
    if (this.athanorFireBoost > 0) {
      this.athanorFireBoost -= dt;
      athanorBoost = Math.max(0, this.athanorFireBoost / 4.0);
    }
    if (this.athanorLight) {
      this.athanorLight.intensity = 2.2 + Math.sin(this.elapsed * 6) * 0.4 + athanorBoost * 4.5;
    }
    if (this.athanorOpening?.material) {
      const baseEmi = 1.2 + Math.sin(this.elapsed * 5) * 0.3;
      (this.athanorOpening.material as any).emissiveIntensity = baseEmi + athanorBoost * 2.4;
      try {
        const t = athanorBoost;
        (this.athanorOpening.material as any).color.setRGB(1, 0.33 - t * 0.2, 0.0);
      } catch {}
    }

    // ─── Hibou : pulse rouge cinematic + ailes ouvertes ───
    if (this.owlGroup) {
      if (this.owlPulseDecay > 0) {
        this.owlPulseDecay -= dt;
        const flap = Math.sin(this.elapsed * 14) * 0.6 * Math.min(1, this.owlPulseDecay);
        if (this.owlWingL) this.owlWingL.rotation.z = 0.1 + flap;
        if (this.owlWingR) this.owlWingR.rotation.z = -0.1 - flap;
        // Léger sursaut vertical
        this.owlGroup.position.y = 6.4 + Math.abs(Math.sin(this.elapsed * 14)) * 0.1 * Math.min(1, this.owlPulseDecay);
      } else {
        // Repos : ailes refermées
        if (this.owlWingL) this.owlWingL.rotation.z += (0.1 - this.owlWingL.rotation.z) * dt * 4;
        if (this.owlWingR) this.owlWingR.rotation.z += (-0.1 - this.owlWingR.rotation.z) * dt * 4;
        this.owlGroup.position.y += (6.4 - this.owlGroup.position.y) * dt * 4;
      }
    }

    // ─── Grimoire : flotte ouvert (pages écartées) ───
    if (this.grimoireGroup) {
      if (this.grimoireOpenDecay > 0) {
        this.grimoireOpenDecay -= dt;
        const open = Math.min(1, this.grimoireOpenDecay);
        // Lévitation
        this.grimoireGroup.position.y = this.grimoireBaseY + 0.35 * open + Math.sin(this.elapsed * 2.5) * 0.04 * open;
        // Tournage de pages (rotation Y pulsante)
        if (this.grimoirePages[0]) this.grimoirePages[0].rotation.y = Math.sin(this.elapsed * 3) * 0.5 * open;
        if (this.grimoirePages[1]) this.grimoirePages[1].rotation.y = -Math.sin(this.elapsed * 3 + 0.5) * 0.5 * open;
      } else {
        // Retour repos
        this.grimoireGroup.position.y += (this.grimoireBaseY - this.grimoireGroup.position.y) * dt * 3;
        if (this.grimoirePages[0]) this.grimoirePages[0].rotation.y += (0 - this.grimoirePages[0].rotation.y) * dt * 3;
        if (this.grimoirePages[1]) this.grimoirePages[1].rotation.y += (0 - this.grimoirePages[1].rotation.y) * dt * 3;
      }
    }

    // ─── Reset fermenting fiole color après decay ───
    if (this.fermentingFioleId && this.fermentDecay > 0) {
      this.fermentDecay -= dt;
      if (this.fermentDecay <= 0) {
        const entry = this.fioleMeshes.get(this.fermentingFioleId);
        if (entry?.liquid?.material) {
          try {
            const colorHex = SERVICE_COLOR[entry.data.serviceKind];
            (entry.liquid.material as any).color.setHex(colorHex);
            (entry.liquid.material as any).emissive.setHex(colorHex);
            (entry.liquid.material as any).emissiveIntensity = 0.45;
          } catch {}
        }
        this.fermentingFioleId = null;
      }
    }

    // ─── FLUX/BURSTS cinematic actifs (crystallize rays + distill flow) ───
    if (this.activeFluxes.length > 0) {
      const done: number[] = [];
      for (let bi = 0; bi < this.activeFluxes.length; bi++) {
        const f = this.activeFluxes[bi];
        f.userData.age += dt;
        const ratio = f.userData.age / f.userData.ttl;
        const posAttr = f.geometry?.attributes?.position;
        if (!posAttr) { done.push(bi); continue; }
        const arr = posAttr.array as Float32Array;
        if (f.userData.kind === 'crystal-rays') {
          const vels = f.userData.velocities as Float32Array;
          for (let i = 0; i < arr.length / 3; i++) {
            arr[i * 3 + 0] += vels[i * 3 + 0] * dt * 60;
            arr[i * 3 + 1] += vels[i * 3 + 1] * dt * 60;
            arr[i * 3 + 2] += vels[i * 3 + 2] * dt * 60;
            vels[i * 3 + 1] -= 0.005;
          }
        } else if (f.userData.kind === 'distill-flow') {
          const stream = f.userData.stream as Array<{ t: number; speed: number }>;
          const from = f.userData.from;
          const to = f.userData.to;
          for (let i = 0; i < stream.length; i++) {
            stream[i].t += stream[i].speed * dt;
            if (stream[i].t > 1) stream[i].t -= 1;
            const t = stream[i].t;
            // Arc parabolique entre from et to (peak en Y)
            const peak = Math.max(from.y, to.y) + 1.5;
            arr[i * 3 + 0] = from.x + (to.x - from.x) * t;
            arr[i * 3 + 2] = from.z + (to.z - from.z) * t;
            const ybase = from.y + (to.y - from.y) * t;
            const arc = (peak - Math.max(from.y, to.y)) * (4 * t * (1 - t));
            arr[i * 3 + 1] = ybase + arc;
          }
        }
        posAttr.needsUpdate = true;
        if (f.material) {
          f.material.opacity = Math.max(0, 0.95 * (1 - Math.pow(ratio, 1.4)));
        }
        if (ratio >= 1) done.push(bi);
      }
      for (let i = done.length - 1; i >= 0; i--) {
        const f = this.activeFluxes[done[i]];
        this.scene.remove(f);
        f.geometry?.dispose();
        f.material?.dispose();
        this.activeFluxes.splice(done[i], 1);
      }
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.elapsed);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS template
  // ═══════════════════════════════════════════════════════════════════
  serviceColorHex(kind: ServiceKind): string {
    return '#' + SERVICE_COLOR[kind].toString(16).padStart(6, '0');
  }

  deltaPct(f: FioleData): number {
    if (f.baselineEur === 0) return 0;
    return Math.round(((f.costEur - f.baselineEur) / f.baselineEur) * 100);
  }

  /** Lancer le play */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    this.narrator.startPlayExample(0);
  }

  /** Entrer (skip play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
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
