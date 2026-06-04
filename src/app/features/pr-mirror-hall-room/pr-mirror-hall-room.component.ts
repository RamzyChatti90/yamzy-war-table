// ═══════════════════════════════════════════════════════════════════
// 🪞 PR MIRROR HALL ROOM — La Galerie des Vérités
//
// Mécanique data unique : une chambre circulaire cathédrale où chaque
// PR est un miroir doré au mur. Le reflet révèle la santé du code :
//   ✨ Reflet net      = approved (haute emissive)
//   🩸 Reflet brisé    = conflicts (fissures + teinte rouge)
//   〰  Reflet ondulé   = changes requested (UV qui ondule)
//   🌫 Reflet sombre   = no review yet (opacité basse)
//
// Statues de pierre entre les miroirs = reviewers assignés.
//   🗿 Pierre         = pending
//   🏆 Or illuminé    = approved
//   🔴 Rouge          = blocked / changes requested
//
// Tapis rouge vers une PR mergeable, sablier flottant sur PRs en retard.
//
// Cérémonies : approbation (dorée), conflit (rouge), hall of fame (gold
// spotlight), éclair (urgence security violette).
//
// Implémentation : Three.js r128 pure code, no GLB. Pattern hérité du
// git-tree-room (cf. features/git-tree-room/).
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { createPortal3D, getIslandForRoom, PortalHandle } from '../../core/portal/portal.factory';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { SpellButtonComponent, SpellTutorialOverlayComponent, TutorialStep } from '../../core/spell-ui';

type PrStatus = 'approved' | 'changes_requested' | 'conflicts' | 'no_review' | 'mergeable_now';

interface PrMirrorData {
  id: number;
  repo: string;
  number: number;
  title: string;
  author: string;
  authorColor: string;
  status: PrStatus;
  reviewers: { name: string; verdict: 'pending' | 'approved' | 'changes_requested'; color: string }[];
  filesChanged: number;
  additions: number;
  deletions: number;
  commentsCount: number;
  createdAt: Date;
  slaDueAt: Date;
  isStale: boolean;        // sablier au-dessus
  isSecurity?: boolean;    // éclair violet
  url: string;
}

@Component({
  selector: 'wt-pr-mirror-hall-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph-host">
      <header class="ph-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#67e8f9" [routerLink]="'/yamzy-island'" icon="←">Yamzy Island</wt-spell-btn>
        <div class="ph-title">
          <h1>🪞 PR MIRROR HALL</h1>
          <p>La Galerie des Vérités — {{ prs().length }} miroirs · {{ approvedCount() }} approved · {{ blockedCount() }} bloqués · {{ staleCount() }} en retard</p>
        </div>
        <div class="ph-legend">
          <span class="dot approved"></span>approved
          <span class="dot changes"></span>changes
          <span class="dot conflicts"></span>conflicts
          <span class="dot noreview"></span>no review
          <span class="dot mergeable"></span>mergeable
        </div>
      </header>

      <canvas #canvas class="ph-canvas"></canvas>

      <footer class="ph-controls">
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="loadDemo()" icon="🎬">Demo PRs (8 miroirs)</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="spotlightMergeable()" icon="🎯">Spotlight mergeable</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="triggerLightning()" icon="⚡">Trigger éclair (security)</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="resetCamera()" icon="🎥">Reset cam</wt-spell-btn>
        <wt-spell-btn variant="primary" size="sm" accent="#67e8f9" (click)="openTutorial()" icon="🎓" title="Visite guidée par Yamzy">How it works</wt-spell-btn>
        <wt-spell-btn variant="primary" size="sm" accent="#67e8f9" (click)="narrator.startPlayExample()" icon="▶" title="Démo animée">Play example</wt-spell-btn>
        <span class="hint">Drag = orbiter · molette = zoom · clic miroir = ouvrir PR</span>
      </footer>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="ph-flash" [attr.data-type]="f.type">
        <div class="ph-flash-content">
          <div class="ph-flash-icon">{{ f.icon }}</div>
          <div class="ph-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel PR info -->
      <div *ngIf="selectedPr() as p" class="ph-panel">
        <button class="ph-panel-close" (click)="selectedPr.set(null)">×</button>
        <div class="ph-panel-head">
          <span class="ph-panel-repo">{{ p.repo }}</span>
          <strong class="ph-panel-num">#{{ p.number }}</strong>
          <span class="ph-panel-status" [attr.data-status]="p.status">{{ statusLabel(p.status) }}</span>
        </div>
        <div class="ph-panel-title">{{ p.title }}</div>
        <div class="ph-panel-author">
          <span class="ph-author-dot" [style.background]="p.authorColor"></span>
          {{ p.author }} · ouvert {{ fmtAgo(p.createdAt.getTime()) }}
        </div>
        <div class="ph-panel-stats">
          <span class="stat-files">📁 {{ p.filesChanged }} fichiers</span>
          <span class="stat-add">+{{ p.additions }}</span>
          <span class="stat-del">-{{ p.deletions }}</span>
          <span class="stat-com">💬 {{ p.commentsCount }}</span>
        </div>
        <div class="ph-panel-reviewers">
          <div class="reviewer-title">Reviewers ({{ p.reviewers.length }})</div>
          <div class="reviewer-list">
            <span *ngFor="let r of p.reviewers" class="reviewer-chip" [attr.data-verdict]="r.verdict">
              <span class="r-dot" [style.background]="r.color"></span>
              {{ r.name }}
              <small>{{ verdictIcon(r.verdict) }}</small>
            </span>
          </div>
        </div>
        <div class="ph-panel-sla" *ngIf="p.isStale">
          ⏳ SLA dépassée depuis {{ fmtAgo(p.slaDueAt.getTime()) }}
        </div>
      </div>

      <!-- 🎬 Splash overlay (welcome screen avant entrée) -->
      <wt-room-splash *ngIf="splashVisible()"
        title="PR Mirror Hall"
        loreName="La Galerie des Vérités"
        color="#a3e9ff"
        oneLiner="Hall circulaire avec 8 miroirs PR + statues reviewers + tapis rouge mergeable."
        [duration]="65"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="PR Mirror Hall"
        loreName="La Galerie des Vérités"
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
    .ph-host { position: relative; width: 100%; height: 100vh; background: #0a0e1f; color: #e8eaf6; font-family: system-ui, sans-serif; }
    .ph-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .ph-topbar > * { pointer-events: auto; }
    .ph-back { color: #7dd3fc; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #0369a1; border-radius: 8px; background: rgba(2,30,55,0.4); }
    .ph-back:hover { background: rgba(3,105,161,0.4); }
    .ph-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1.5px; color: #7dd3fc; text-shadow: 0 0 12px rgba(125,211,252,0.4); }
    .ph-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.75; }
    .ph-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; flex-wrap: wrap; }
    .ph-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .ph-legend .dot.approved  { background: #facc15; box-shadow: 0 0 10px #facc15; }
    .ph-legend .dot.changes   { background: #38bdf8; }
    .ph-legend .dot.conflicts { background: #dc2626; box-shadow: 0 0 8px #dc2626; }
    .ph-legend .dot.noreview  { background: #475569; }
    .ph-legend .dot.mergeable { background: #86efac; box-shadow: 0 0 10px #86efac; }

    .ph-canvas { display: block; width: 100%; height: 100%; }
    .ph-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); }
    .ph-controls button { background: rgba(15,30,55,0.7); color: #e8eaf6; border: 1px solid #0369a1; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; transition: background 0.15s; }
    .ph-controls button:hover { background: rgba(3,105,161,0.5); }
    .ph-narrator { background: rgba(40,30,5,0.7) !important; border-color: #b89240 !important; color: #fbbf24 !important; font-weight: 600; }
    .ph-narrator:hover { background: rgba(251,191,36,0.3) !important; }
    .ph-narrator.ph-play { background: #fbbf24 !important; color: #1a1500 !important; border-color: #fbbf24 !important; }
    .ph-narrator.ph-play:hover { background: #f5b923 !important; }
    .ph-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .ph-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: ph-flash-pulse 1.6s ease-out forwards; }
    .ph-flash[data-type="approval"] { background: radial-gradient(circle at center, rgba(250,204,21,0.65), transparent 65%); }
    .ph-flash[data-type="conflict"] { background: radial-gradient(circle at center, rgba(220,38,38,0.55), transparent 60%); }
    .ph-flash[data-type="fame"]     { background: radial-gradient(circle at center, rgba(250,204,21,0.85), transparent 75%); }
    .ph-flash[data-type="lightning"]{ background: radial-gradient(circle at center, rgba(168,85,247,0.7), transparent 65%); }
    .ph-flash[data-type="merge"]    { background: radial-gradient(circle at center, rgba(134,239,172,0.65), transparent 70%); }
    .ph-flash-content { text-align: center; animation: ph-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .ph-flash-icon  { font-size: 108px; line-height: 1; filter: drop-shadow(0 0 28px rgba(255,255,255,0.75)); }
    .ph-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1.5px; text-shadow: 0 0 14px rgba(0,0,0,0.55); }
    @keyframes ph-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes ph-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }

    /* Panel PR */
    .ph-panel { position: absolute; right: 22px; top: 80px; width: 320px; padding: 16px; background: rgba(10,18,35,0.94); border: 1px solid #0369a1; border-radius: 12px; backdrop-filter: blur(10px); z-index: 9; font-size: 12px; box-shadow: 0 0 24px rgba(125,211,252,0.15); }
    .ph-panel-close { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: transparent; border: 1px solid rgba(125,211,252,0.45); border-radius: 50%; color: #7dd3fc; cursor: pointer; }
    .ph-panel-head { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; }
    .ph-panel-repo { font-family: monospace; color: #94a3b8; font-size: 11px; }
    .ph-panel-num { color: #7dd3fc; font-family: monospace; }
    .ph-panel-status { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .ph-panel-status[data-status="approved"]          { background: rgba(250,204,21,0.2); color: #facc15; }
    .ph-panel-status[data-status="changes_requested"] { background: rgba(56,189,248,0.2); color: #38bdf8; }
    .ph-panel-status[data-status="conflicts"]         { background: rgba(220,38,38,0.25); color: #f87171; }
    .ph-panel-status[data-status="no_review"]         { background: rgba(71,85,105,0.3); color: #94a3b8; }
    .ph-panel-status[data-status="mergeable_now"]     { background: rgba(134,239,172,0.2); color: #86efac; }
    .ph-panel-title { color: #e2e8f0; margin: 8px 0; line-height: 1.4; font-weight: 600; }
    .ph-panel-author { font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
    .ph-author-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .ph-panel-stats { display: flex; gap: 10px; font-size: 11px; margin-bottom: 10px; flex-wrap: wrap; }
    .ph-panel-stats .stat-files { color: #94a3b8; }
    .ph-panel-stats .stat-add { color: #86efac; font-family: monospace; }
    .ph-panel-stats .stat-del { color: #f87171; font-family: monospace; }
    .ph-panel-stats .stat-com { color: #7dd3fc; }
    .reviewer-title { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .reviewer-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .reviewer-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 12px; font-size: 11px; background: rgba(30,41,59,0.7); border: 1px solid rgba(71,85,105,0.5); }
    .reviewer-chip[data-verdict="approved"]          { border-color: rgba(250,204,21,0.5); }
    .reviewer-chip[data-verdict="changes_requested"] { border-color: rgba(220,38,38,0.5); }
    .r-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
    .ph-panel-sla { margin-top: 10px; padding: 6px 10px; background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.4); border-radius: 6px; color: #f87171; font-size: 11px; }
  `]
})
export class PrMirrorHallRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── Signals state ───
  prs = signal<PrMirrorData[]>([]);
  selectedPr = signal<PrMirrorData | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🪞', title: '8 miroirs = vos pull requests ouvertes', body: 'Chaque miroir reflète une PR en cours. La clarté du miroir indique l\'état : limpide = prête à merger, terne = checks rouges.' },
    { icon: '🗿', title: 'Statues reviewers autour', body: 'Les statues qui entourent chaque miroir sont les reviewers assignés. Elles s\'illuminent quand un avis est posté.' },
    { icon: '✅', title: 'Tapis rouge = mergeable', body: 'Quand tous les checks passent et 2+ approvals sont obtenus, un tapis rouge se déroule du miroir vers la porte du merge.' },
    { icon: '👻', title: 'Miroirs hantés = PR stale', body: 'Les PR ouvertes depuis 14+ jours deviennent hantées : fumée violette, statues qui pleurent. Relance ou ferme.' },
    { icon: '🎭', title: 'Cliquer un miroir = ouvrir la PR', body: 'Cliquez un miroir pour zoomer : diff highlight, threads de commentaires, suggestions reviewers.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque miroir reflète une pull request ouverte.',
    'Les statues sont les reviewers assignés.',
    'Tapis rouge quand la PR est mergeable.',
    'Les miroirs hantés signalent les PR stales.',
    'Cliquez un miroir pour ouvrir le diff.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  // ─── Counts dérivés ───
  approvedCount = computed(() => this.prs().filter(p => p.status === 'approved' || p.status === 'mergeable_now').length);
  blockedCount  = computed(() => this.prs().filter(p => p.status === 'conflicts' || p.status === 'changes_requested').length);
  staleCount    = computed(() => this.prs().filter(p => p.isStale).length);

  // ─── Three.js refs ───
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

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ─── 3D meshes ───
  private mirrorMeshes: any[] = [];               // les 8 miroirs cliquables
  private mirrorByMesh = new Map<any, PrMirrorData>();
  private mirrorFrames: any[] = [];               // les cadres dorés
  private mirrorSurfaces: any[] = [];             // surfaces réfléchissantes (diff canvas)
  private statueMeshes: any[] = [];               // toutes les sous-pièces statue (base, body, head, arm, aura)
  private statueParts: any[] = [];                // body + head uniquement (cinematic illumination)
  private hourglassMeshes: any[] = [];            // sabliers flottants
  private redCarpet: any = null;
  private centerCircle: any = null;               // anneau doré au sol
  private chandelierBulbs: any[] = [];            // ampoules visuelles
  private pointLights: any[] = [];                // lumières chaudes au plafond
  private spotlightMesh: any = null;              // spotlight pour le mergeable
  private timeAccum = 0;

  // ─── Cinematic transient state (driven by methods, processed in animate()) ───
  private rippleFx: { mesh: any; t: number; halo?: any; halo0?: number } | null = null;
  private statueGlowEndAt = 0;                    // statueIllumination end timestamp (ms)
  private carpetRevealStartAt = 0;                // redCarpetReveal anim start
  private carpetRevealActive = false;
  private chandelierFlashStartAt = 0;             // chandelierFlash anim start
  private chandelierFlashPhase: 'idle' | 'white' | 'redPulse' = 'idle';
  private cascadeBoostEndAt = 0;                  // hourglassCascade end timestamp
  private lightningFxEndAt = 0;                   // triggerLightning ambient lift

  // Layout : 8 miroirs sur un cercle de rayon 9
  private readonly MIRROR_COUNT = 8;
  private readonly ROOM_RADIUS = 10;
  private readonly MIRROR_RADIUS = 8.6;

  ngOnInit() {
    this.bootstrap();
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
  // INIT SCENE — cathédrale circulaire
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // ─── Scene + brume cathédrale ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a0e1f);
    this.scene.fog = new T.FogExp2(0x0a0e1f, 0.045);

    // ─── Camera : au centre du hall, légèrement levée comme un visiteur ───
    this.camera = new T.PerspectiveCamera(55, w / h, 0.1, 200);
    this.camera.position.set(0, 2.5, 0.1);
    this.camera.lookAt(8, 2.5, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lumières : ambiance cathédrale tamisée chaude ───
    this.scene.add(new T.AmbientLight(0x1a1e3a, 0.35));
    const hemi = new T.HemisphereLight(0x4a3a2a, 0x0a0e1f, 0.3);
    this.scene.add(hemi);

    // ─── Géométrie de la salle ───
    this.buildRoom(T);

    // ─── Lumières ponctuelles au plafond (chaudes, dorées) ───
    this.placePointLights(T);

    // ─── OrbitControls (pour explorer en mode démo) ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.09;
      this.controls.target.set(8, 2.5, 0);
      this.controls.maxDistance = 22;
      this.controls.minDistance = 0.5;
      this.controls.maxPolarAngle = Math.PI * 0.85;
    }

    // ─── Raycaster pour cliquer un miroir ───
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Livraison)
    const island = getIslandForRoom('/pr-mirror-hall');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-14, 3, -8],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[PrMirrorHall] 🪞 Cathédrale prête');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'pr-mirror-hall',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // ROOM : sol circulaire + murs cylindriques + dôme
  // ═══════════════════════════════════════════════════════════════════
  private buildRoom(T: any) {
    // ─── Sol : disque dallé sombre avec veines dorées ───
    const floorGeom = new T.CircleGeometry(this.ROOM_RADIUS, 64);
    const floorMat = new T.MeshStandardMaterial({
      color: 0x0f1530,
      roughness: 0.55,
      metalness: 0.25,
      emissive: 0x050816,
      emissiveIntensity: 0.4,
    });
    const floor = new T.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Cercle doré central au sol (motif rituel)
    const centerCircleGeom = new T.RingGeometry(0.8, 1.0, 48);
    const centerCircleMat = new T.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
      side: T.DoubleSide,
    });
    const centerCircle = new T.Mesh(centerCircleGeom, centerCircleMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.005;
    centerCircle.userData.tutorialId = 'center-circle';
    centerCircle.userData.baseEmissive = 0.6;
    this.centerCircle = centerCircle;
    this.scene.add(centerCircle);

    // ─── Murs cylindriques (open top/bottom) ───
    const wallH = 8;
    const wallGeom = new T.CylinderGeometry(this.ROOM_RADIUS, this.ROOM_RADIUS, wallH, 64, 1, true);
    const wallMat = new T.MeshStandardMaterial({
      color: 0x141b3a,
      roughness: 0.85,
      side: T.BackSide,             // visible de l'intérieur
      emissive: 0x0a0e1f,
      emissiveIntensity: 0.3,
    });
    const wall = new T.Mesh(wallGeom, wallMat);
    wall.position.y = wallH / 2;
    this.scene.add(wall);

    // ─── Dôme du plafond (demi-sphère) ───
    const domeGeom = new T.SphereGeometry(this.ROOM_RADIUS, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new T.MeshStandardMaterial({
      color: 0x0a0e1f,
      roughness: 0.95,
      side: T.BackSide,
      emissive: 0x1a1530,
      emissiveIntensity: 0.25,
    });
    const dome = new T.Mesh(domeGeom, domeMat);
    dome.position.y = wallH;
    this.scene.add(dome);

    // ─── Anneau doré entre mur et dôme (corniche) ───
    const corniceGeom = new T.TorusGeometry(this.ROOM_RADIUS - 0.05, 0.08, 8, 64);
    const corniceMat = new T.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.85,
      roughness: 0.3,
      emissive: 0x4a3a0a,
      emissiveIntensity: 0.5,
    });
    const cornice = new T.Mesh(corniceGeom, corniceMat);
    cornice.position.y = wallH;
    cornice.rotation.x = Math.PI / 2;
    cornice.userData.tutorialId = 'cornice';
    this.scene.add(cornice);
  }

  // ═══════════════════════════════════════════════════════════════════
  // LUMIÈRES PONCTUELLES — 4 chandeliers chauds au plafond
  // ═══════════════════════════════════════════════════════════════════
  private placePointLights(T: any) {
    const positions = [
      { x: 0, y: 6.5, z: 0, intensity: 0.6, color: 0xffc88a },
    ];
    // 4 chandeliers répartis sur un anneau intermédiaire
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      positions.push({
        x: Math.cos(a) * (this.ROOM_RADIUS * 0.55),
        y: 6.5,
        z: Math.sin(a) * (this.ROOM_RADIUS * 0.55),
        intensity: 0.85,
        color: 0xffb878,
      });
    }
    let firstBulbTagged = false;
    for (const p of positions) {
      const light = new T.PointLight(p.color, p.intensity, 16, 1.5);
      light.position.set(p.x, p.y, p.z);
      this.scene.add(light);
      this.pointLights.push(light);
      // Sauve l'intensité de base pour la cinematic chandelierFlash
      (light as any).userData = { ...(light as any).userData, baseIntensity: p.intensity, baseColor: p.color };

      // Petite ampoule visuelle (sphère émissive)
      const bulbGeom = new T.SphereGeometry(0.09, 8, 6);
      const bulbMat = new T.MeshStandardMaterial({
        color: p.color,
        emissive: p.color,
        emissiveIntensity: 1.2,
      });
      const bulb = new T.Mesh(bulbGeom, bulbMat);
      bulb.position.set(p.x, p.y, p.z);
      // Premier chandelier porte le tag tutorialId
      if (!firstBulbTagged) {
        bulb.userData.tutorialId = 'chandelier';
        firstBulbTagged = true;
      }
      this.chandelierBulbs.push(bulb);
      this.scene.add(bulb);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : positionne les 8 miroirs + 8 statues
  // ═══════════════════════════════════════════════════════════════════
  private buildMirrorsAndStatues(prs: PrMirrorData[]) {
    const T = (window as any).THREE;
    this.disposeMirrors();

    // ─── 8 MIROIRS sur le mur, équidistants ───
    for (let i = 0; i < Math.min(prs.length, this.MIRROR_COUNT); i++) {
      const angle = (i / this.MIRROR_COUNT) * Math.PI * 2;
      this.placeMirror(prs[i], angle, T, i === 0);
    }

    // ─── 8 STATUES entre les miroirs ───
    for (let i = 0; i < this.MIRROR_COUNT; i++) {
      // Décalée d'un demi-pas pour être ENTRE deux miroirs
      const angle = ((i + 0.5) / this.MIRROR_COUNT) * Math.PI * 2;
      // Verdict général sur cette zone : on prend le reviewer le plus tranchant
      // d'un des miroirs adjacents
      const pr = prs[i % prs.length];
      const verdict = this.dominantVerdict(pr);
      this.placeStatue(angle, verdict, T, i === 0);
    }

    // ─── Tapis rouge vers la PR mergeable ───
    this.placeRedCarpet(prs, T);

    // ─── Sabliers au-dessus des PRs en retard ───
    this.placeHourglasses(prs, T);

    console.log(`[PrMirrorHall] 🪞 ${this.mirrorMeshes.length} miroirs + ${this.statueMeshes.length} statues + ${this.hourglassMeshes.length / 2} sabliers placés`);
  }

  // ─── Place un miroir (cadre doré + surface réflective avec diff) ───
  private placeMirror(pr: PrMirrorData, angle: number, T: any, tagTutorial: boolean = false) {
    const x = Math.cos(angle) * this.MIRROR_RADIUS;
    const z = Math.sin(angle) * this.MIRROR_RADIUS;
    const yCenter = 3.0;                              // hauteur centre du miroir
    const mirrorW = 1.4;
    const mirrorH = 2.4;
    const frameT = 0.18;                              // épaisseur du cadre

    // ─── CADRE DORÉ (BoxGeometry plat) ───
    const frameGeom = new T.BoxGeometry(mirrorW + frameT * 2, mirrorH + frameT * 2, 0.15);
    const frameMat = new T.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.25,
      emissive: 0x6b4a08,
      emissiveIntensity: 0.55,
    });
    const frame = new T.Mesh(frameGeom, frameMat);
    frame.position.set(x, yCenter, z);
    // Le cadre regarde vers le centre du hall
    frame.lookAt(0, yCenter, 0);
    this.scene.add(frame);
    this.mirrorFrames.push(frame);

    // ─── SURFACE DU MIROIR (PlaneGeometry, légèrement devant le cadre) ───
    const surfGeom = new T.PlaneGeometry(mirrorW, mirrorH, 8, 16);
    const surfMat = this.makeMirrorMaterial(pr, T);

    const surf = new T.Mesh(surfGeom, surfMat);
    // On positionne juste devant le cadre vers le centre
    const inward = new T.Vector3(0, yCenter, 0).sub(frame.position).normalize();
    surf.position.copy(frame.position).add(inward.clone().multiplyScalar(0.085));
    surf.lookAt(0, yCenter, 0);
    surf.userData.prId = pr.id;
    surf.userData.baseUV = { offsetX: 0, offsetY: 0 };
    surf.userData.status = pr.status;
    surf.userData.baseEmissive = surfMat.emissiveIntensity ?? 0.5;
    surf.userData.basePosition = surf.position.clone();
    surf.userData.inward = inward.clone();
    // Premier miroir reçoit le tag tutorialId (tour will highlight all mirrors via this)
    if (tagTutorial) {
      surf.userData.tutorialId = 'mirror';
      frame.userData.tutorialId = 'mirror';
    }
    this.scene.add(surf);
    this.mirrorMeshes.push(surf);
    this.mirrorSurfaces.push(surf);
    this.mirrorByMesh.set(surf, pr);

    // ─── Halo lumineux selon statut ───
    const haloColor = this.haloColorForStatus(pr.status);
    if (haloColor !== null) {
      const halo = new T.PointLight(haloColor, 0.7, 4, 2);
      halo.position.copy(surf.position).add(inward.clone().multiplyScalar(0.4));
      this.scene.add(halo);
      surf.userData.halo = halo;
    }

    // ─── Plaque dorée gravée dessous (nom de PR) ───
    const plaqueGeom = new T.BoxGeometry(mirrorW * 0.85, 0.18, 0.05);
    const plaqueMat = new T.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.9,
      roughness: 0.35,
      emissive: 0x3a2a06,
      emissiveIntensity: 0.4,
    });
    const plaque = new T.Mesh(plaqueGeom, plaqueMat);
    plaque.position.copy(frame.position);
    plaque.position.y -= (mirrorH / 2 + frameT + 0.18);
    plaque.lookAt(0, plaque.position.y, 0);
    this.scene.add(plaque);
  }

  // ─── Matériau du miroir avec canvas texture (diff simulé) ───
  private makeMirrorMaterial(pr: PrMirrorData, T: any): any {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    this.paintDiffCanvas(ctx, canvas.width, canvas.height, pr);
    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;

    let material: any;
    switch (pr.status) {
      case 'approved':
      case 'mergeable_now':
        // Reflet net et brillant + emissive haute
        material = new T.MeshStandardMaterial({
          map: tex,
          color: 0xffffff,
          emissive: pr.status === 'mergeable_now' ? 0x86efac : 0xfacc15,
          emissiveMap: tex,
          emissiveIntensity: 0.95,
          metalness: 0.85,
          roughness: 0.15,
          side: T.DoubleSide,
        });
        break;
      case 'conflicts':
        // Fissures (bump) + teinte rouge
        material = new T.MeshStandardMaterial({
          map: tex,
          color: 0xff8a8a,
          emissive: 0x8a1010,
          emissiveMap: tex,
          emissiveIntensity: 0.6,
          metalness: 0.6,
          roughness: 0.55,
          bumpMap: tex,
          bumpScale: 0.4,
          side: T.DoubleSide,
        });
        material.userData = { isCracked: true };
        break;
      case 'changes_requested':
        // Reflet ondulé : UV qui ondule en animate()
        material = new T.MeshStandardMaterial({
          map: tex,
          color: 0xb0e7ff,
          emissive: 0x0a3a55,
          emissiveMap: tex,
          emissiveIntensity: 0.5,
          metalness: 0.7,
          roughness: 0.35,
          side: T.DoubleSide,
        });
        material.userData = { isWavy: true };
        break;
      case 'no_review':
      default:
        // Reflet sombre / fumée, opacité réduite
        material = new T.MeshStandardMaterial({
          map: tex,
          color: 0x2a3050,
          emissive: 0x0a0e1f,
          emissiveIntensity: 0.15,
          metalness: 0.4,
          roughness: 0.85,
          transparent: true,
          opacity: 0.55,
          side: T.DoubleSide,
        });
        break;
    }

    // Marquer security si applicable
    if (pr.isSecurity) {
      material.emissive = new T.Color(0xa855f7);
      material.emissiveIntensity = 0.85;
      material.userData = { ...material.userData, isSecurity: true };
    }
    return material;
  }

  // ─── Peint un faux diff sur le canvas (bandes vertes/rouges) ───
  private paintDiffCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, pr: PrMirrorData) {
    // Fond sombre type éditeur
    ctx.fillStyle = '#0a0e1f';
    ctx.fillRect(0, 0, w, h);

    // Numéros de ligne sur la gauche
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 28, h);

    const lineH = 14;
    const totalLines = Math.floor(h / lineH);
    for (let i = 0; i < totalLines; i++) {
      const y = i * lineH;
      // 25% additions vertes, 12% deletions rouges, le reste neutre
      const r = Math.random();
      let bg: string | null = null;
      let lineColor = '#475569';
      if (r < 0.25) {
        bg = 'rgba(34,197,94,0.18)';
        lineColor = '#4ade80';
      } else if (r < 0.37) {
        bg = 'rgba(239,68,68,0.22)';
        lineColor = '#f87171';
      } else if (r < 0.7) {
        lineColor = '#94a3b8';
      }
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(28, y, w - 28, lineH);
      }
      // Numéro de ligne
      ctx.fillStyle = '#475569';
      ctx.font = '8px monospace';
      ctx.fillText(String(i + 1), 4, y + lineH - 3);

      // Faux contenu de ligne (rectangles)
      ctx.fillStyle = lineColor;
      const indent = 32 + Math.floor(Math.random() * 4) * 8;
      const len = 30 + Math.random() * (w - indent - 50);
      ctx.fillRect(indent, y + 4, len, 6);

      // Parfois second segment court
      if (Math.random() < 0.4) {
        ctx.fillRect(indent + len + 8, y + 4, 20 + Math.random() * 30, 6);
      }
    }

    // Si conflicts : superposer des fissures noires
    if (pr.status === 'conflicts') {
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, 0);
        let cx = Math.random() * w;
        let cy = 0;
        while (cy < h) {
          cy += 20 + Math.random() * 50;
          cx += (Math.random() - 0.5) * 40;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      // Tache rouge centrale
      const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w);
      grad.addColorStop(0, 'rgba(220,38,38,0.45)');
      grad.addColorStop(1, 'rgba(220,38,38,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Si no_review : fumée
    if (pr.status === 'no_review') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(20,27,58,0.85)');
      grad.addColorStop(0.5, 'rgba(20,27,58,0.4)');
      grad.addColorStop(1, 'rgba(20,27,58,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // En-tête PR (nom)
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`PR #${pr.number}`, 6, 16);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    const ttl = pr.title.length > 30 ? pr.title.slice(0, 27) + '…' : pr.title;
    ctx.fillText(ttl, 60, 16);
  }

  // ─── Statue (cylindre corps + sphère tête) ───
  private placeStatue(angle: number, verdict: 'pending' | 'approved' | 'changes_requested', T: any, tagTutorial: boolean = false) {
    const r = this.MIRROR_RADIUS - 0.2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    let bodyColor = 0x6b7280;       // pierre grise par défaut
    let emissive = 0x000000;
    let emInt = 0;
    if (verdict === 'approved') {
      bodyColor = 0xd4af37;
      emissive = 0xfacc15;
      emInt = 0.55;
    } else if (verdict === 'changes_requested') {
      bodyColor = 0x991b1b;
      emissive = 0xdc2626;
      emInt = 0.45;
    }

    // ─── Socle (cylindre épais) ───
    const baseGeom = new T.CylinderGeometry(0.42, 0.5, 0.22, 16);
    const baseMat = new T.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.1 });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.set(x, 0.11, z);
    this.scene.add(base);
    this.statueMeshes.push(base);

    // ─── Corps (cylindre haut) ───
    const bodyGeom = new T.CylinderGeometry(0.18, 0.3, 1.3, 12);
    const bodyMat = new T.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.75,
      metalness: verdict === 'approved' ? 0.7 : 0.15,
      emissive,
      emissiveIntensity: emInt,
    });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.position.set(x, 0.87, z);
    body.userData.baseEmissive = emInt;
    body.userData.statueGroup = true;
    if (tagTutorial) body.userData.tutorialId = 'statue';
    this.scene.add(body);
    this.statueMeshes.push(body);
    this.statueParts.push(body);

    // ─── Tête (sphère) ───
    const headGeom = new T.SphereGeometry(0.18, 16, 12);
    const headMat = new T.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.7,
      metalness: verdict === 'approved' ? 0.6 : 0.1,
      emissive,
      emissiveIntensity: emInt * 0.8,
    });
    const head = new T.Mesh(headGeom, headMat);
    head.position.set(x, 1.7, z);
    head.userData.baseEmissive = emInt * 0.8;
    head.userData.statueGroup = true;
    this.scene.add(head);
    this.statueMeshes.push(head);
    this.statueParts.push(head);

    // ─── Bras croisés stylisés (deux petits cylindres horizontaux) ───
    const armGeom = new T.CylinderGeometry(0.08, 0.08, 0.55, 8);
    const armMat = bodyMat;
    const armL = new T.Mesh(armGeom, armMat);
    armL.position.set(x, 1.1, z);
    armL.rotation.z = Math.PI / 4;
    // Tourner pour faire face au centre
    armL.lookAt(0, 1.1, 0);
    armL.rotateZ(Math.PI / 4);
    this.scene.add(armL);
    this.statueMeshes.push(armL);

    // ─── Halo doré si approved ───
    if (verdict === 'approved') {
      const aura = new T.PointLight(0xfacc15, 0.5, 2.5, 2);
      aura.position.set(x, 1.5, z);
      this.scene.add(aura);
      this.statueMeshes.push(aura);
    } else if (verdict === 'changes_requested') {
      const aura = new T.PointLight(0xdc2626, 0.45, 2.2, 2);
      aura.position.set(x, 1.5, z);
      this.scene.add(aura);
      this.statueMeshes.push(aura);
    }
  }

  // ─── Tapis rouge (BoxGeometry étiré du centre vers la PR mergeable) ───
  private placeRedCarpet(prs: PrMirrorData[], T: any) {
    const mergeable = prs.find(p => p.status === 'mergeable_now');
    if (!mergeable) return;
    const idx = prs.indexOf(mergeable);
    const angle = (idx / this.MIRROR_COUNT) * Math.PI * 2;
    const length = this.MIRROR_RADIUS - 0.5;
    const width = 1.0;

    const geom = new T.BoxGeometry(length, 0.04, width);
    // Texture procédurale pour donner relief au tapis
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 128; texCanvas.height = 32;
    const tctx = texCanvas.getContext('2d')!;
    tctx.fillStyle = '#991b1b';
    tctx.fillRect(0, 0, 128, 32);
    // Bordure dorée
    tctx.strokeStyle = '#d4af37';
    tctx.lineWidth = 4;
    tctx.strokeRect(2, 2, 124, 28);
    // Motifs décoratifs
    tctx.fillStyle = '#d4af37';
    for (let i = 0; i < 6; i++) {
      tctx.beginPath();
      tctx.arc(12 + i * 22, 16, 3, 0, Math.PI * 2);
      tctx.fill();
    }
    const tex = new T.CanvasTexture(texCanvas);
    tex.wrapS = T.RepeatWrapping;
    tex.repeat.set(length / 1.5, 1);

    const mat = new T.MeshStandardMaterial({
      map: tex,
      color: 0xb91c1c,
      roughness: 0.75,
      emissive: 0x3a0a0a,
      emissiveIntensity: 0.3,
    });
    const carpet = new T.Mesh(geom, mat);
    // Centrer entre le centre et le miroir
    const midR = (this.MIRROR_RADIUS - 0.5) / 2;
    carpet.position.set(Math.cos(angle) * midR, 0.02, Math.sin(angle) * midR);
    carpet.rotation.y = -angle;
    carpet.userData.tutorialId = 'red-carpet';
    carpet.userData.baseEmissive = 0.3;
    carpet.userData.angle = angle;
    carpet.userData.length = length;
    this.scene.add(carpet);
    this.redCarpet = carpet;
  }

  // ─── Sabliers flottants au-dessus des PR en retard ───
  private placeHourglasses(prs: PrMirrorData[], T: any) {
    let firstHourglassTagged = false;
    for (let i = 0; i < prs.length; i++) {
      if (!prs[i].isStale) continue;
      const angle = (i / this.MIRROR_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * (this.MIRROR_RADIUS - 0.5);
      const z = Math.sin(angle) * (this.MIRROR_RADIUS - 0.5);
      const yTop = 5.0;

      // Demi-cônes opposés = sablier (cone haut pointe en bas, cone bas pointe en haut)
      const coneMat = new T.MeshStandardMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.55,
        metalness: 0.3,
        roughness: 0.25,
        emissive: 0xfde68a,
        emissiveIntensity: 0.35,
      });
      const coneTopGeom = new T.ConeGeometry(0.22, 0.32, 12);
      const coneTop = new T.Mesh(coneTopGeom, coneMat);
      coneTop.position.set(x, yTop + 0.16, z);
      coneTop.rotation.x = Math.PI;
      if (!firstHourglassTagged) {
        coneTop.userData.tutorialId = 'hourglass';
        firstHourglassTagged = true;
      }
      this.scene.add(coneTop);
      this.hourglassMeshes.push(coneTop);

      const coneBotGeom = new T.ConeGeometry(0.22, 0.32, 12);
      const coneBot = new T.Mesh(coneBotGeom, coneMat);
      coneBot.position.set(x, yTop - 0.16, z);
      this.scene.add(coneBot);
      this.hourglassMeshes.push(coneBot);

      // Sphère au centre (sable qui coule)
      const sandGeom = new T.SphereGeometry(0.04, 8, 6);
      const sandMat = new T.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xfbbf24,
        emissiveIntensity: 1.2,
      });
      const sand = new T.Mesh(sandGeom, sandMat);
      sand.position.set(x, yTop, z);
      sand.userData.isSand = true;
      sand.userData.baseY = yTop;
      sand.userData.cascadeSpeed = 3;       // vitesse de base (modulée par hourglassCascade)
      this.scene.add(sand);
      this.hourglassMeshes.push(sand);
    }
  }

  // ─── Dispose des miroirs / statues / sabliers / tapis ───
  private disposeMirrors() {
    [...this.mirrorMeshes, ...this.mirrorFrames, ...this.statueMeshes, ...this.hourglassMeshes].forEach(m => {
      // Halo lights nichés dans userData
      if (m?.userData?.halo) this.scene.remove(m.userData.halo);
      this.scene.remove(m);
    });
    this.mirrorMeshes = [];
    this.mirrorFrames = [];
    this.mirrorSurfaces = [];
    this.statueMeshes = [];
    this.statueParts = [];
    this.hourglassMeshes = [];
    this.mirrorByMesh.clear();
    if (this.redCarpet) { this.scene.remove(this.redCarpet); this.redCarpet = null; }
    if (this.spotlightMesh) { this.scene.remove(this.spotlightMesh); this.spotlightMesh = null; }
    // Reset cinematic transient state
    this.rippleFx = null;
    this.statueGlowEndAt = 0;
    this.carpetRevealActive = false;
    this.chandelierFlashPhase = 'idle';
    this.cascadeBoostEndAt = 0;
    this.lightningFxEndAt = 0;
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

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA — 8 PRs variés (3 approved / 2 changes / 1 conflicts / 1 noreview / 1 mergeable)
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const now = Date.now();
    const day = 86400000;
    const authors = [
      { name: 'Ramzy', color: '#86efac' },
      { name: 'Alice', color: '#60a5fa' },
      { name: 'Bob',   color: '#fbbf24' },
      { name: 'Maya',  color: '#f472b6' },
      { name: 'Yves',  color: '#a78bfa' },
      { name: 'Lucie', color: '#fb7185' },
    ];
    const specs: Array<Omit<PrMirrorData, 'id' | 'authorColor'> & { authorIdx: number }> = [
      {
        authorIdx: 0, repo: 'yamzy-world', number: 412, title: 'feat: orrery zoom inertia + planet labels',
        author: 'Ramzy', status: 'mergeable_now', filesChanged: 18, additions: 421, deletions: 86, commentsCount: 7,
        reviewers: [
          { name: 'Alice', verdict: 'approved', color: '#60a5fa' },
          { name: 'Bob',   verdict: 'approved', color: '#fbbf24' },
        ],
        createdAt: new Date(now - 2 * day), slaDueAt: new Date(now + 1 * day), isStale: false,
        url: 'https://github.com/yamzy/world/pull/412',
      },
      {
        authorIdx: 1, repo: 'yamzy-world', number: 410, title: 'fix: war-table avatar regression on Safari',
        author: 'Alice', status: 'approved', filesChanged: 4, additions: 38, deletions: 12, commentsCount: 3,
        reviewers: [
          { name: 'Ramzy', verdict: 'approved', color: '#86efac' },
        ],
        createdAt: new Date(now - 1 * day), slaDueAt: new Date(now + 2 * day), isStale: false,
        url: 'https://github.com/yamzy/world/pull/410',
      },
      {
        authorIdx: 2, repo: 'pos-backend', number: 88, title: 'feat: capacity batch import via xlsx',
        author: 'Bob', status: 'approved', filesChanged: 12, additions: 256, deletions: 41, commentsCount: 11,
        reviewers: [
          { name: 'Maya',  verdict: 'approved', color: '#f472b6' },
          { name: 'Yves',  verdict: 'approved', color: '#a78bfa' },
        ],
        createdAt: new Date(now - 3 * day), slaDueAt: new Date(now + 1 * day), isStale: false,
        url: 'https://github.com/yamzy/world/pull/88',
      },
      {
        authorIdx: 3, repo: 'yamzy-world', number: 415, title: 'feat: PR mirror hall (this very room!)',
        author: 'Maya', status: 'approved', filesChanged: 6, additions: 622, deletions: 0, commentsCount: 9,
        reviewers: [
          { name: 'Ramzy', verdict: 'approved', color: '#86efac' },
          { name: 'Lucie', verdict: 'approved', color: '#fb7185' },
        ],
        createdAt: new Date(now - 5 * day), slaDueAt: new Date(now - 1 * day), isStale: false,
        url: 'https://github.com/yamzy/world/pull/415',
      },
      {
        authorIdx: 4, repo: 'extensions-registry', number: 24, title: 'refactor: extension manager hot reload',
        author: 'Yves', status: 'changes_requested', filesChanged: 8, additions: 124, deletions: 188, commentsCount: 16,
        reviewers: [
          { name: 'Ramzy', verdict: 'changes_requested', color: '#86efac' },
          { name: 'Alice', verdict: 'pending', color: '#60a5fa' },
        ],
        createdAt: new Date(now - 4 * day), slaDueAt: new Date(now - 0.5 * day), isStale: true,
        url: 'https://github.com/yamzy/world/pull/24',
      },
      {
        authorIdx: 5, repo: 'pos-frontend', number: 142, title: 'feat: ticket drag-drop into sprints',
        author: 'Lucie', status: 'changes_requested', filesChanged: 5, additions: 89, deletions: 22, commentsCount: 5,
        reviewers: [
          { name: 'Bob', verdict: 'changes_requested', color: '#fbbf24' },
        ],
        createdAt: new Date(now - 2 * day), slaDueAt: new Date(now + 1 * day), isStale: false,
        url: 'https://github.com/yamzy/world/pull/142',
      },
      {
        authorIdx: 0, repo: 'yamzy-world', number: 408, title: 'wip: replace JWT with PASETO tokens',
        author: 'Ramzy', status: 'conflicts', filesChanged: 22, additions: 348, deletions: 287, commentsCount: 14,
        reviewers: [
          { name: 'Maya', verdict: 'changes_requested', color: '#f472b6' },
          { name: 'Yves', verdict: 'pending', color: '#a78bfa' },
        ],
        createdAt: new Date(now - 9 * day), slaDueAt: new Date(now - 4 * day), isStale: true,
        isSecurity: true,
        url: 'https://github.com/yamzy/world/pull/408',
      },
      {
        authorIdx: 2, repo: 'pos-backend', number: 92, title: 'chore: bump spring boot to 3.4.0',
        author: 'Bob', status: 'no_review', filesChanged: 3, additions: 14, deletions: 14, commentsCount: 0,
        reviewers: [
          { name: 'Maya',  verdict: 'pending', color: '#f472b6' },
          { name: 'Alice', verdict: 'pending', color: '#60a5fa' },
        ],
        createdAt: new Date(now - 0.3 * day), slaDueAt: new Date(now + 2 * day), isStale: false,
        url: 'https://github.com/yamzy/world/pull/92',
      },
    ];
    const prs: PrMirrorData[] = specs.map((s, i) => ({
      id: i + 1,
      repo: s.repo,
      number: s.number,
      title: s.title,
      author: s.author,
      authorColor: authors[s.authorIdx].color,
      status: s.status,
      reviewers: s.reviewers,
      filesChanged: s.filesChanged,
      additions: s.additions,
      deletions: s.deletions,
      commentsCount: s.commentsCount,
      createdAt: s.createdAt,
      slaDueAt: s.slaDueAt,
      isStale: s.isStale,
      isSecurity: s.isSecurity,
      url: s.url,
    }));
    this.prs.set(prs);
    this.buildMirrorsAndStatues(prs);
    this.emitCeremony({ type: 'fame', label: '8 miroirs convoqués · La galerie s\'éveille', icon: '🪞' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES & ACTIONS UTILISATEUR
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('pr-mirror-hall', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  spotlightMergeable() {
    const T = (window as any).THREE;
    const mergeable = this.prs().find(p => p.status === 'mergeable_now');
    if (!mergeable) {
      this.emitCeremony({ type: 'conflict', label: 'Aucune PR mergeable', icon: '🚫' });
      return;
    }
    const idx = this.prs().indexOf(mergeable);
    const angle = (idx / this.MIRROR_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * (this.MIRROR_RADIUS - 0.5);
    const z = Math.sin(angle) * (this.MIRROR_RADIUS - 0.5);

    // SpotLight depuis le plafond vers la PR
    if (this.spotlightMesh) this.scene.remove(this.spotlightMesh);
    const spot = new T.SpotLight(0xfacc15, 4.5, 18, Math.PI / 8, 0.6, 1.5);
    spot.position.set(x, 7.5, z);
    spot.target.position.set(x, 2.5, z);
    this.scene.add(spot);
    this.scene.add(spot.target);
    this.spotlightMesh = spot;

    // Bouger la caméra vers le miroir
    if (this.camera) {
      this.camera.position.set(x * 0.35, 2.5, z * 0.35);
      this.camera.lookAt(x, 2.5, z);
      if (this.controls) this.controls.target.set(x, 2.5, z);
    }
    this.emitCeremony({ type: 'fame', label: `🎯 #${mergeable.number} sous spotlight — prête à merger`, icon: '🏆' });

    // Retirer le spot après quelques secondes
    setTimeout(() => {
      if (this.spotlightMesh) {
        this.scene.remove(this.spotlightMesh);
        this.spotlightMesh = null;
      }
    }, 5500);
  }

  triggerLightning() {
    const security = this.prs().find(p => p.isSecurity);
    if (!security) {
      this.emitCeremony({ type: 'lightning', label: 'Aucune PR security en alerte', icon: '⚡' });
      return;
    }
    // Pulse violet sur le miroir security
    const surf = this.mirrorSurfaces.find(m => m.userData.prId === security.id);
    if (surf?.material) {
      const orig = surf.material.emissiveIntensity;
      surf.material.emissive.setHex(0xa855f7);
      surf.material.emissiveIntensity = 2.0;
      setTimeout(() => {
        if (surf.material) {
          surf.material.emissiveIntensity = orig;
          surf.material.emissive.setHex(0xa855f7);
        }
      }, 1400);
    }
    // Coup d'éclat ambient (bumped in animate via lightningFxEndAt)
    this.lightningFxEndAt = performance.now() + 1400;
    this.emitCeremony({ type: 'lightning', label: `⚡ #${security.number} — sécurité urgente !`, icon: '⚡' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoked from tutorial JSON playExample
  // (each method is safe : early return if refs absent)
  // ═══════════════════════════════════════════════════════════════════

  /** 🪞 MIRROR RIPPLE — un miroir ondule + son halo pulse (= new review submitted) */
  mirrorRipple(idx?: number) {
    if (!this.mirrorSurfaces.length) return;
    const T = (window as any).THREE;
    const i = (typeof idx === 'number' && idx >= 0 && idx < this.mirrorSurfaces.length)
      ? idx
      : Math.floor(Math.random() * this.mirrorSurfaces.length);
    const mesh = this.mirrorSurfaces[i];
    if (!mesh?.material) return;
    // Start ripple state — animate() will handle the wave for ~1.4s
    this.rippleFx = {
      mesh,
      t: 0,
      halo: mesh.userData.halo,
      halo0: mesh.userData.halo?.intensity ?? 0.7,
    };
    // Boost emissive instantanément
    const base = mesh.userData.baseEmissive ?? mesh.material.emissiveIntensity ?? 0.5;
    mesh.material.emissiveIntensity = base * 2.4;
    if (mesh.userData.halo) {
      mesh.userData.halo.intensity = 2.0;
    }
    this.emitCeremony({ type: 'approval', label: `🪞 Nouvelle review · miroir #${i + 1}`, icon: '🪞' });
  }

  /** 🗿 STATUE ILLUMINATION — toutes les statues s'illuminent en doré (= reviewer approves) */
  statueIllumination() {
    if (!this.statueParts.length) return;
    // Boost emissive global pendant 3s (animate fade-out)
    this.statueGlowEndAt = performance.now() + 3000;
    for (const part of this.statueParts) {
      if (part.material) {
        part.material.emissive?.setHex?.(0xfacc15);
        part.material.emissiveIntensity = 1.5;
      }
    }
    this.emitCeremony({ type: 'approval', label: '🗿 Les Sentinelles bénissent · Approved', icon: '✨' });
  }

  /** 🟥 RED CARPET REVEAL — tapis s'illumine du centre vers la PR mergeable (= requirements met) */
  redCarpetReveal() {
    if (!this.redCarpet) return;
    this.carpetRevealStartAt = performance.now();
    this.carpetRevealActive = true;
    // Boost ponctuel
    if (this.redCarpet.material) {
      this.redCarpet.material.emissiveIntensity = 1.3;
    }
    this.emitCeremony({ type: 'merge', label: '🟥 Le Chemin du Sacre se déroule', icon: '🟥' });
  }

  /** 🕯 CHANDELIER FLASH — chandelier flash blanc puis pulse rouge (= breaking change critique) */
  chandelierFlash() {
    if (!this.pointLights.length) return;
    const T = (window as any).THREE;
    this.chandelierFlashStartAt = performance.now();
    this.chandelierFlashPhase = 'white';
    // Boost instantané vers blanc
    for (const light of this.pointLights) {
      if (light.color?.setHex) light.color.setHex(0xffffff);
      light.intensity = 3.5;
    }
    for (const bulb of this.chandelierBulbs) {
      if (bulb.material) {
        bulb.material.color?.setHex?.(0xffffff);
        bulb.material.emissive?.setHex?.(0xffffff);
        bulb.material.emissiveIntensity = 3.0;
      }
    }
    this.emitCeremony({ type: 'lightning', label: '🕯 PR critique · breaking change détecté', icon: '⚠️' });
  }

  /** ⏳ HOURGLASS CASCADE — sable des sabliers accélère (= deadline approche) */
  hourglassCascade() {
    if (!this.hourglassMeshes.length) return;
    this.cascadeBoostEndAt = performance.now() + 4000;
    this.emitCeremony({ type: 'lightning', label: '⏳ Le sable s\'écoule · SLA imminente', icon: '⏳' });
  }


  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 2.5, 0.1);
    this.camera.lookAt(8, 2.5, 0);
    if (this.controls) this.controls.target.set(8, 2.5, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic miroir → sélectionner PR
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
    const intersects = this.raycaster.intersectObjects(this.mirrorMeshes, false);
    if (intersects.length > 0) {
      const pr = this.mirrorByMesh.get(intersects[0].object);
      if (pr) {
        this.selectedPr.set(pr);
        // Petit zoom du miroir
        const mesh = intersects[0].object;
        mesh.scale.set(1.08, 1.08, 1.08);
        setTimeout(() => mesh.scale.set(1, 1, 1), 220);
        // Cérémonie selon statut
        const cer = this.ceremonyForStatus(pr.status);
        if (cer) this.emitCeremony(cer);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP — sway/ondulations/sablier
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.timeAccum += dt;

    // ─── Animation des surfaces miroir ───
    for (const surf of this.mirrorSurfaces) {
      const ud = surf.material?.userData;
      if (!ud) continue;
      // Ondulation UV pour changes_requested
      if (ud.isWavy && surf.material.map) {
        surf.material.map.offset.x = Math.sin(this.timeAccum * 1.4) * 0.03;
        surf.material.map.offset.y = Math.cos(this.timeAccum * 1.1) * 0.025;
        surf.material.map.needsUpdate = false;     // pas besoin de réuploader, offset suffit
      }
      // Pulsation lente du halo des approved
      if (surf.userData.halo) {
        surf.userData.halo.intensity = 0.6 + Math.sin(this.timeAccum * 2) * 0.15;
      }
      // Crépitement des fissures (conflicts)
      if (ud.isCracked) {
        surf.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(this.timeAccum * 5.5)) * 0.25;
      }
      // Pulsation security (violette)
      if (ud.isSecurity) {
        surf.material.emissiveIntensity = 0.7 + Math.sin(this.timeAccum * 4) * 0.4;
      }
    }

    // ─── Sablier : sable qui flotte + assemblage qui tourne ───
    const cascadeBoost = (performance.now() < this.cascadeBoostEndAt) ? 3.0 : 1.0;
    for (const m of this.hourglassMeshes) {
      if (m.userData?.isSand) {
        const speed = (m.userData.cascadeSpeed ?? 3) * cascadeBoost;
        m.position.y = m.userData.baseY + Math.sin(this.timeAccum * speed) * 0.12;
        if (m.material && cascadeBoost > 1) {
          m.material.emissiveIntensity = 1.6 + Math.sin(this.timeAccum * 12) * 0.4;
        } else if (m.material) {
          m.material.emissiveIntensity = 1.2;
        }
      } else {
        // Cones qui tournent doucement (rotation atmosphérique)
        m.rotation.y += dt * 0.4 * cascadeBoost;
      }
    }

    // ─── Pulsation lente des bougies au plafond ───
    // Modulé par chandelierFlash (phase white → redPulse → idle)
    const flashElapsed = performance.now() - this.chandelierFlashStartAt;
    if (this.chandelierFlashPhase === 'white' && flashElapsed > 400) {
      this.chandelierFlashPhase = 'redPulse';
    } else if (this.chandelierFlashPhase === 'redPulse' && flashElapsed > 2800) {
      // Restaure les couleurs et état idle
      this.chandelierFlashPhase = 'idle';
      for (const light of this.pointLights) {
        const baseColor = light.userData?.baseColor ?? 0xffb878;
        if (light.color?.setHex) light.color.setHex(baseColor);
      }
      for (const bulb of this.chandelierBulbs) {
        if (bulb.material) {
          bulb.material.color?.setHex?.(0xffb878);
          bulb.material.emissive?.setHex?.(0xffb878);
          bulb.material.emissiveIntensity = 1.2;
        }
      }
    }
    for (let i = 0; i < this.pointLights.length; i++) {
      const light = this.pointLights[i];
      const baseIntensity = light.userData?.baseIntensity ?? (i === 0 ? 0.6 : 0.85);
      if (this.chandelierFlashPhase === 'white') {
        light.intensity = 3.5;
      } else if (this.chandelierFlashPhase === 'redPulse') {
        // Pulse rouge intense
        light.intensity = 1.8 + Math.abs(Math.sin(this.timeAccum * 8)) * 1.4;
        if (light.color?.setHex) light.color.setHex(0xdc2626);
        if (i < this.chandelierBulbs.length) {
          const b = this.chandelierBulbs[i];
          if (b.material) {
            b.material.color?.setHex?.(0xdc2626);
            b.material.emissive?.setHex?.(0xdc2626);
            b.material.emissiveIntensity = 1.5 + Math.abs(Math.sin(this.timeAccum * 8)) * 1.0;
          }
        }
      } else {
        // Idle : pulsation lente normale + lift léger pour triggerLightning
        const lift = performance.now() < this.lightningFxEndAt ? 0.4 : 0;
        light.intensity = baseIntensity + lift + Math.sin(this.timeAccum * 1.2 + i * 1.3) * 0.12;
      }
    }

    // ─── 🎬 CINEMATIC : mirror ripple wave (sin sur Z + halo pulse) ───
    if (this.rippleFx) {
      this.rippleFx.t += dt;
      const r = this.rippleFx;
      const mesh = r.mesh;
      if (mesh?.geometry?.attributes?.position) {
        const pos = mesh.geometry.attributes.position;
        // Ondulation transitoire (fade-out sur 1.4s)
        const fade = Math.max(0, 1 - r.t / 1.4);
        const amp = 0.07 * fade;
        for (let i = 0; i < pos.count; i++) {
          const ix = i * 3;
          const x0 = (mesh.geometry as any).attributes.position.array[ix];
          const y0 = (mesh.geometry as any).attributes.position.array[ix + 1];
          // Push along normal local Z
          pos.array[ix + 2] = Math.sin(this.timeAccum * 10 + (x0 + y0) * 4) * amp;
        }
        pos.needsUpdate = true;
      }
      // Fade emissive vers base
      if (mesh?.material) {
        const base = mesh.userData?.baseEmissive ?? 0.5;
        const peak = base * 2.4;
        const k = Math.max(0, 1 - r.t / 1.4);
        mesh.material.emissiveIntensity = base + (peak - base) * k;
      }
      // Fade halo
      if (r.halo) {
        const base = r.halo0 ?? 0.7;
        const k = Math.max(0, 1 - r.t / 1.4);
        r.halo.intensity = base + (2.0 - base) * k;
      }
      if (r.t >= 1.4) {
        // Reset Z to flat + drop fx state
        if (mesh?.geometry?.attributes?.position) {
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] = 0;
          pos.needsUpdate = true;
        }
        this.rippleFx = null;
      }
    }

    // ─── 🎬 CINEMATIC : statue illumination fade-out ───
    if (this.statueGlowEndAt > 0) {
      const now = performance.now();
      const remaining = this.statueGlowEndAt - now;
      if (remaining > 0) {
        const k = remaining / 3000;
        for (const part of this.statueParts) {
          if (part.material) {
            const base = part.userData?.baseEmissive ?? 0;
            part.material.emissiveIntensity = base + (1.5 - base) * k;
          }
        }
      } else {
        // Restore base
        for (const part of this.statueParts) {
          if (part.material) {
            part.material.emissiveIntensity = part.userData?.baseEmissive ?? 0;
          }
        }
        this.statueGlowEndAt = 0;
      }
    }

    // ─── 🎬 CINEMATIC : red carpet reveal (length sweep from 0 → full) ───
    if (this.carpetRevealActive && this.redCarpet) {
      const elapsed = (performance.now() - this.carpetRevealStartAt) / 1000;
      const dur = 2.0;
      const k = Math.min(1, elapsed / dur);
      // Pulse emissive + slight scale anim
      if (this.redCarpet.material) {
        const base = this.redCarpet.userData?.baseEmissive ?? 0.3;
        this.redCarpet.material.emissiveIntensity = base + (1.4 - base) * (1 - Math.abs(k - 0.5) * 2);
      }
      // Légère levée + dé-pose
      this.redCarpet.position.y = 0.02 + Math.sin(k * Math.PI) * 0.08;
      if (k >= 1) {
        this.carpetRevealActive = false;
        this.redCarpet.position.y = 0.02;
        if (this.redCarpet.material) {
          this.redCarpet.material.emissiveIntensity = this.redCarpet.userData?.baseEmissive ?? 0.3;
        }
      }
    }

    // ─── 🎬 CINEMATIC : center circle pulse pendant statueGlow / carpet reveal ───
    if (this.centerCircle?.material) {
      const base = this.centerCircle.userData?.baseEmissive ?? 0.6;
      const lift = (this.statueGlowEndAt > performance.now() || this.carpetRevealActive) ? 0.6 : 0;
      this.centerCircle.material.emissiveIntensity = base + lift + Math.sin(this.timeAccum * 2) * 0.1;
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.timeAccum);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════
  private dominantVerdict(pr: PrMirrorData): 'pending' | 'approved' | 'changes_requested' {
    if (pr.reviewers.some(r => r.verdict === 'changes_requested')) return 'changes_requested';
    if (pr.reviewers.every(r => r.verdict === 'approved') && pr.reviewers.length > 0) return 'approved';
    return 'pending';
  }

  private haloColorForStatus(s: PrStatus): number | null {
    switch (s) {
      case 'approved':       return 0xfacc15;
      case 'mergeable_now':  return 0x86efac;
      case 'conflicts':      return 0xdc2626;
      case 'changes_requested': return 0x38bdf8;
      default: return null;
    }
  }

  private ceremonyForStatus(s: PrStatus): { type: string; label: string; icon: string } | null {
    switch (s) {
      case 'approved':       return { type: 'approval', label: 'Reflet pur · Approved', icon: '✨' };
      case 'mergeable_now':  return { type: 'merge', label: 'Prête à fusionner', icon: '🟥' };
      case 'conflicts':      return { type: 'conflict', label: 'Conflit détecté', icon: '🩸' };
      case 'changes_requested': return { type: 'conflict', label: 'Changes requested', icon: '〰️' };
      default: return null;
    }
  }

  statusLabel(s: PrStatus): string {
    return { approved: 'Approved', changes_requested: 'Changes', conflicts: 'Conflicts', no_review: 'No review', mergeable_now: 'Mergeable' }[s];
  }
  verdictIcon(v: 'pending' | 'approved' | 'changes_requested'): string {
    return v === 'approved' ? '✓' : v === 'changes_requested' ? '✗' : '…';
  }

  fmtAgo(ts: number): string {
    const diff = Date.now() - ts;
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 3600000);
    const future = diff < 0;
    if (h < 1) return future ? 'dans quelques minutes' : 'il y a quelques minutes';
    if (h < 24) return future ? `dans ${h}h` : `il y a ${h}h`;
    const d = Math.floor(h / 24);
    return future ? `dans ${d}j` : `il y a ${d}j`;
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
