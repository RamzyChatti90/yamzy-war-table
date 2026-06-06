// ═══════════════════════════════════════════════════════════════════
// 🎴 CARD TAVERN ROOM — La Taverne aux Cartes du Destin
//
// Mécanique data unique : tu es assis à une table ronde dans une
// taverne médiévale. Les deals sont des cartes que tu joues.
// L'aubergiste te conseille. Les rats rongent les comptes à risque.
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. git-tree-room).
//
// Cérémonies détectées :
//   🍾 Toast     = deal won (applaudissements + or)
//   💀 Sépulture = deal lost (poussière grise)
//   🌟 Légende   = major contract (étoile blanche)
//   🐀 Rats      = churn imminent (flash rouge)
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

interface ProspectCard {
  id: number;
  company: string;
  contactName: string;
  tier: 'STARTER' | 'PRO' | 'ENTERPRISE';
  mrrPotential: number;
  stage: 'lead' | 'qualified' | 'demo' | 'proposal' | 'won' | 'lost';
  owner: string;
  source: string;
  revealed: boolean;
  churnRisk?: boolean;
}

interface Trophy {
  company: string;
  amount: number;
}

@Component({
  selector: 'wt-card-tavern-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ct-host">
      <header class="ct-topbar">
        <div class="ct-title">
          <h1>🎴 CARD TAVERN</h1>
          <p>La Taverne aux Cartes · {{ prospects().length }} prospects · MRR €{{ mrr() }} · Win rate {{ winRate() }}%</p>
        </div>
        <div class="ct-legend">
          <span class="dot lead"></span>Lead
          <span class="dot qual"></span>Qualifié
          <span class="dot won"></span>Won
          <span class="dot risk"></span>Rats
        </div>
      </header>

      <canvas #canvas class="ct-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="ct-flash" [attr.data-type]="f.type">
        <div class="ct-flash-content">
          <div class="ct-flash-icon">{{ f.icon }}</div>
          <div class="ct-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Side panel prospect info -->
      <div *ngIf="selectedProspect() as p" class="ct-panel">
        <button class="ct-panel-close" (click)="selectedProspect.set(null)">×</button>
        <div class="ct-panel-head">
          <strong class="ct-panel-company">{{ p.company }}</strong>
          <span class="ct-panel-tier" [attr.data-tier]="p.tier">{{ p.tier }}</span>
        </div>
        <div class="ct-panel-row"><span>Contact</span><b>{{ p.contactName }}</b></div>
        <div class="ct-panel-row"><span>MRR potentiel</span><b class="gold">€{{ p.mrrPotential }}</b></div>
        <div class="ct-panel-row"><span>Stage</span><b>{{ p.stage }}</b></div>
        <div class="ct-panel-row"><span>Owner</span><b>{{ p.owner }}</b></div>
        <div class="ct-panel-row"><span>Source</span><b>{{ p.source }}</b></div>
        <div *ngIf="p.churnRisk" class="ct-panel-warn">🐀 Risque churn imminent</div>
      </div>

      <!-- 🎬 Splash welcome overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Card Tavern"
        loreName="La Taverne aux Cartes du Destin"
        color="#fbbf24"
        oneLiner="Taverne médiévale, cartes prospects, aubergiste NPC, carte aux trésors."
        [duration]="65"
        [timeboxDurationS]="1200"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Card Tavern"
        loreName="La Taverne aux Cartes"
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
    .ct-host { position: relative; width: 100%; height: 100vh; background: #1a0d05; color: #fef3c7; font-family: "Tinos", serif; }
    .ct-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .ct-topbar > * { pointer-events: auto; }
    .ct-back { color: #fbbf24; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #92400e; border-radius: 8px; background: rgba(40,20,0,0.5); }
    .ct-back:hover { background: rgba(92,40,0,0.6); }
    .ct-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 2px; color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.4); }
    .ct-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.75; color: #fde68a; }
    .ct-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; color: #fde68a; }
    .ct-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .ct-legend .lead { background: #6b4423; }
    .ct-legend .qual { background: #fbbf24; box-shadow: 0 0 6px #fbbf24; }
    .ct-legend .won  { background: #16a34a; box-shadow: 0 0 6px #16a34a; }
    .ct-legend .risk { background: #dc2626; box-shadow: 0 0 6px #dc2626; }

    .ct-canvas { display: block; width: 100%; height: 100%; }
    .ct-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); }
    .ct-controls button { background: rgba(60,30,5,0.8); color: #fde68a; border: 1px solid #92400e; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit; }
    .ct-controls button:hover { background: rgba(146,64,14,0.8); color: #fff; }
    .ct-controls .ct-narrator { background: rgba(60,40,5,0.85); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .ct-controls .ct-narrator:hover { background: rgba(251,191,36,0.3); color: #fff; }
    .ct-controls .ct-narrator.ct-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .ct-controls .ct-narrator.ct-play:hover { background: #f5b923; color: #1a1500; }
    .ct-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; color: #fde68a; }

    /* Flash cérémonie */
    .ct-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: ct-flash-pulse 1.6s ease-out forwards; }
    .ct-flash[data-type="toast"]    { background: radial-gradient(circle at center, rgba(251,191,36,0.55), transparent 65%); }
    .ct-flash[data-type="grave"]    { background: radial-gradient(circle at center, rgba(120,120,120,0.55), transparent 60%); }
    .ct-flash[data-type="legend"]   { background: radial-gradient(circle at center, rgba(255,255,255,0.7), transparent 70%); }
    .ct-flash[data-type="rats"]     { background: radial-gradient(circle at center, rgba(220,38,38,0.55), transparent 60%); animation: ct-flash-pulse 1.6s ease-out forwards, ct-rat-flicker 0.15s 6; }
    .ct-flash-content { text-align: center; animation: ct-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .ct-flash-icon  { font-size: 100px; line-height: 1; filter: drop-shadow(0 0 24px rgba(251,191,36,0.7)); }
    .ct-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 2px; text-shadow: 0 0 14px rgba(0,0,0,0.6); }
    @keyframes ct-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes ct-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }
    @keyframes ct-rat-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* Side panel */
    .ct-panel { position: absolute; right: 22px; top: 80px; width: 290px; padding: 16px; background: rgba(30,15,5,0.94); border: 1px solid #92400e; border-radius: 12px; backdrop-filter: blur(10px); z-index: 9; font-size: 12px; box-shadow: 0 0 30px rgba(251,191,36,0.2); }
    .ct-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(251,191,36,0.5); border-radius: 50%; color: #fbbf24; cursor: pointer; font-size: 14px; line-height: 1; }
    .ct-panel-head { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; justify-content: space-between; }
    .ct-panel-company { color: #fbbf24; font-size: 14px; }
    .ct-panel-tier { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(251,191,36,0.2); color: #fde68a; }
    .ct-panel-tier[data-tier="ENTERPRISE"] { background: rgba(168,85,247,0.3); color: #d8b4fe; }
    .ct-panel-tier[data-tier="PRO"] { background: rgba(59,130,246,0.3); color: #93c5fd; }
    .ct-panel-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed rgba(146,64,14,0.4); }
    .ct-panel-row span { opacity: 0.65; }
    .ct-panel-row b { color: #fef3c7; }
    .ct-panel-row b.gold { color: #fbbf24; }
    .ct-panel-warn { margin-top: 10px; padding: 8px; background: rgba(220,38,38,0.2); border: 1px solid #dc2626; border-radius: 6px; color: #fca5a5; text-align: center; }
  `]
})
export class CardTavernRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── État signals ───
  prospects = signal<ProspectCard[]>([]);
  trophies = signal<Trophy[]>([]);
  mrr = signal<number>(0);
  barrelFill = signal<number>(0.35);  // 0-1, niveau du tonneau de bière
  selectedProspect = signal<ProspectCard | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🃏', title: 'Chaque carte est un prospect', body: 'Sur les tables de la taverne, les cartes représentent vos prospects commerciaux. Plus la table est près du feu, plus le deal est chaud.' },
    { icon: '🍻', title: 'L\'aubergiste vous guide', body: 'Le NPC central commente votre pipeline. Il suggère qui relancer, qui laisser refroidir, qui inviter à l\'arrière-salle.' },
    { icon: '🔥', title: 'Le feu de cheminée chauffe', body: 'Les cartes proches du feu (Hot leads) s\'allument. Celles dans l\'ombre (Cold leads) sont gelées et demandent un effort de réveil.' },
    { icon: '🗺', title: 'La carte aux trésors', body: 'Sur le mur, la carte révèle les territoires conquis et les zones à prospecter. X marque les comptes stratégiques.' },
    { icon: '🍺', title: 'Trinquer = closer un deal', body: 'Quand vous remportez une affaire, l\'aubergiste lève sa chope. Cinématique de victoire + cérémonie sonore.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque carte est un prospect commercial.',
    'L\'aubergiste vous suggère qui relancer.',
    'Près du feu, les leads chauds brûlent.',
    'La carte aux trésors révèle les territoires.',
    'Trinquer, c\'est célébrer un deal closé.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  winRate = computed(() => {
    const list = this.prospects();
    if (list.length === 0) return 0;
    const won = list.filter(p => p.stage === 'won').length;
    return Math.round((won / list.length) * 100);
  });

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
  private time = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ─── Refs de meshes pour animation ───
  private cardMeshes: any[] = [];                    // toutes les cartes sur la table
  private cardsByProspect = new Map<any, ProspectCard>();
  private coinStack: any[] = [];                     // pièces d'or
  private ratMeshes: any[] = [];                     // rats animés
  private candleFlames: any[] = [];                  // flammes Points
  private innkeeperGroup: any;                       // groupe entier de l'aubergiste
  private innkeeperHead: any;                        // tête de l'aubergiste
  private innkeeperArmR: any;                        // bras droit (lever la chope)
  private innkeeperBaseY = 0;                        // y de base de l'aubergiste
  private barrelLiquid: any;                         // niveau de remplissage
  private pyramidCards: any[] = [];                  // pyramide funnel
  private tankardMeshes: any[] = [];                 // mugs sur le bar (cheers)
  private treasureMapGroup: any;                     // groupe carte aux trésors (parchemin + régions)
  private treasureMapRegions: any[] = [];            // régions colorées sur la carte
  private treasureMapBaseScale = 1;
  private banner: any;                               // drapeau de victoire au plafond
  private bannerPoleY = 0;                           // y de base du drapeau (rangé)
  private bannerTopY = 0;                            // y final du drapeau (hissé)
  /** Cards en attente d'animation cinematic (flip, glow) */
  private cardAnimStates = new Map<any, { kind: 'flip' | 'glow' | 'deal'; t0: number; duration: number; data?: any }>();
  /** État global animations cinematic (innkeeper cheer, banner hoist, map unfurl) */
  private cinematicState = {
    innkeeperCheerT0: 0, innkeeperCheerDur: 0,
    bannerHoistT0: 0, bannerHoistDur: 0,
    mapUnfurlT0: 0, mapUnfurlDur: 0,
    trumpcardTarget: null as any, trumpcardT0: 0, trumpcardDur: 0,
  };

  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#84cc16',
      hint: 'Mouse drag = orbit · molette = zoom · clic carte = info',
      controls: [
        { icon: '🎬', label: 'Demo deals', action: () => this.loadDemo() },
        { icon: '🍻', label: 'Toast (win deal)', action: () => this.toastWin() },
        { icon: '⚔', label: 'Compare 2 cards', action: () => this.compareCards() },
        { icon: '🪄', label: 'Cast outbound', action: () => this.castOutbound() },
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

  // ═══════════════════════════════════════════════════════════════════
  // INIT : scène, lumières, caméra
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // ─── Scène ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x1a0d05);   // brun chaud sombre
    this.scene.fog = new T.FogExp2(0x1a0d05, 0.025);

    // ─── Caméra (vue assise à la table) ───
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(0, 5, 9);
    this.camera.lookAt(0, 1, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lumières (chaleur de bougies) ───
    this.scene.add(new T.AmbientLight(0x4a2a10, 0.4));
    const candleLight = new T.PointLight(0xfbbf24, 1.8, 18, 2);
    candleLight.position.set(0, 4, 0);
    this.scene.add(candleLight);
    const hearthGlow = new T.PointLight(0xff6b1a, 1.2, 14, 2);
    hearthGlow.position.set(-5, 2, -3);
    this.scene.add(hearthGlow);
    const innkeeperLamp = new T.PointLight(0xfde68a, 1.0, 10, 2);
    innkeeperLamp.position.set(5, 3, -4);
    this.scene.add(innkeeperLamp);

    // ─── Construction de la taverne ───
    this.buildTavern(T);
    this.buildRoundTable(T);
    this.buildInnkeeper(T);
    this.buildBar(T);
    this.buildBeerBarrel(T);
    this.buildTreasureMap(T);
    this.buildTrophyShelves(T);
    this.buildCandles(T);
    this.buildBanner(T);

    // ─── Contrôles orbit ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 1, 0);
      this.controls.maxDistance = 22;
      this.controls.minDistance = 3;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    }

    // ─── Raycaster pour cliquer cartes ───
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île du Commerce)
    const island = getIslandForRoom('/card-tavern');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-13, 3.5, -10],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[CardTavern] 🎴 Tavern scene ready');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'card-tavern',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONSTRUCTION : la taverne (murs, sol, poutres)
  // ═══════════════════════════════════════════════════════════════════
  private buildTavern(T: any) {
    // ─── Sol en bois brun ───
    const floorGeom = new T.BoxGeometry(22, 0.2, 22);
    const floorMat = new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.9 });
    const floor = new T.Mesh(floorGeom, floorMat);
    floor.position.y = -0.1;
    this.scene.add(floor);

    // ─── Murs (4 BoxGeometry) ───
    const wallMat = new T.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.95 });
    const wallH = 6;
    const wallT = 0.3;
    const wallL = 22;

    // Mur arrière
    const wallBack = new T.Mesh(new T.BoxGeometry(wallL, wallH, wallT), wallMat);
    wallBack.position.set(0, wallH / 2, -wallL / 2);
    this.scene.add(wallBack);

    // Mur avant
    const wallFront = new T.Mesh(new T.BoxGeometry(wallL, wallH, wallT), wallMat);
    wallFront.position.set(0, wallH / 2, wallL / 2);
    this.scene.add(wallFront);

    // Murs latéraux
    const wallLeft = new T.Mesh(new T.BoxGeometry(wallT, wallH, wallL), wallMat);
    wallLeft.position.set(-wallL / 2, wallH / 2, 0);
    this.scene.add(wallLeft);

    const wallRight = new T.Mesh(new T.BoxGeometry(wallT, wallH, wallL), wallMat);
    wallRight.position.set(wallL / 2, wallH / 2, 0);
    this.scene.add(wallRight);

    // ─── Poutres au plafond (cylindres) ───
    const beamMat = new T.MeshStandardMaterial({ color: 0x2a1808, roughness: 1.0 });
    for (let i = -3; i <= 3; i++) {
      const beam = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, wallL, 8), beamMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(i * 3, wallH - 0.3, 0);
      this.scene.add(beam);
    }

    // ─── Cheminée / âtre dans un coin (pour la chaleur) ───
    const hearthBase = new T.Mesh(
      new T.BoxGeometry(2.5, 1.5, 1.2),
      new T.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 }),
    );
    hearthBase.position.set(-9, 0.75, -9);
    this.scene.add(hearthBase);

    // Flammes du feu (cône orange)
    const fireGeom = new T.ConeGeometry(0.6, 1.5, 6);
    const fireMat = new T.MeshStandardMaterial({
      color: 0xff6b1a, emissive: 0xff8a3a, emissiveIntensity: 1.5, roughness: 0.4,
    });
    const fire = new T.Mesh(fireGeom, fireMat);
    fire.position.set(-9, 1.8, -9);
    fire.userData.isFire = true;
    this.candleFlames.push(fire);
    this.scene.add(fire);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TABLE RONDE + CARTES
  // ═══════════════════════════════════════════════════════════════════
  private buildRoundTable(T: any) {
    // ─── Pied de la table ───
    const legGeom = new T.CylinderGeometry(0.25, 0.4, 1.0, 8);
    const woodMat = new T.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.85 });
    const leg = new T.Mesh(legGeom, woodMat);
    leg.position.y = 0.5;
    this.scene.add(leg);

    // ─── Plateau de la table (cylindre plat) ───
    const tableGeom = new T.CylinderGeometry(3, 3, 0.15, 32);
    const tableMat = new T.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.75 });
    const table = new T.Mesh(tableGeom, tableMat);
    table.position.y = 1.0;
    this.scene.add(table);

    // ─── Anneau doré sur le bord (décoration) ───
    const ringGeom = new T.TorusGeometry(2.95, 0.04, 8, 48);
    const ringMat = new T.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.3,
    });
    const ring = new T.Mesh(ringGeom, ringMat);
    ring.position.y = 1.08;
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CARTES : 1 carte = 1 prospect
  // ═══════════════════════════════════════════════════════════════════
  private buildCards(prospects: ProspectCard[], T: any) {
    // Cleanup avant rebuild
    for (const c of this.cardMeshes) this.scene.remove(c);
    this.cardMeshes = [];
    this.cardsByProspect.clear();
    for (const pc of this.pyramidCards) this.scene.remove(pc);
    this.pyramidCards = [];

    // ─── Cartes étalées sur la table (en arc) ───
    const tableSurface = 1.1;
    const radius = 2.0;
    const visible = prospects.slice(0, 10);
    for (let i = 0; i < visible.length; i++) {
      const prospect = visible[i];
      const angle = (i / visible.length) * Math.PI * 1.4 - Math.PI * 0.7;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const card = this.makeCardMesh(prospect, T);
      card.position.set(x, tableSurface, z);
      card.rotation.y = -angle + Math.PI / 2;
      card.userData.basePos = { x, y: tableSurface, z };
      card.userData.hoverPhase = Math.random() * Math.PI * 2;
      card.userData.baseRotX = card.rotation.x;
      // Première carte = représentative du concept "card" pour le tutorial
      if (i === 0) {
        card.userData.tutorialId = 'card';
      }

      this.cardMeshes.push(card);
      this.cardsByProspect.set(card, prospect);
      this.scene.add(card);
    }

    // ─── Pyramide de cartes (funnel : 5 niveaux) ───
    this.buildPyramidFunnel(prospects, T);
  }

  private makeCardMesh(prospect: ProspectCard, T: any): any {
    // Une carte = BoxGeometry plate
    const cardW = 0.5;
    const cardH = 0.75;
    const cardThickness = 0.03;
    const geom = new T.BoxGeometry(cardW, cardThickness, cardH);

    let color = 0x2a1810;     // dos de carte brun foncé
    let emissive = 0x000000;
    let emissiveIntensity = 0;

    if (prospect.revealed) {
      // Face visible : couleur selon tier
      switch (prospect.tier) {
        case 'STARTER':    color = 0x60a5fa; emissive = 0x1e40af; break;
        case 'PRO':        color = 0xfbbf24; emissive = 0x92400e; break;
        case 'ENTERPRISE': color = 0xa855f7; emissive = 0x6b21a8; break;
      }
      emissiveIntensity = 0.4;
    }
    if (prospect.stage === 'won') {
      color = 0x16a34a;
      emissive = 0x166534;
      emissiveIntensity = 0.6;
    }
    if (prospect.churnRisk) {
      color = 0xdc2626;
      emissive = 0xdc2626;
      emissiveIntensity = 0.5;
    }

    const mat = new T.MeshStandardMaterial({
      color, emissive, emissiveIntensity, roughness: 0.5, metalness: 0.2,
    });
    const card = new T.Mesh(geom, mat);

    // ─── Liseré doré sur le dessus (petit plan) ───
    if (prospect.revealed) {
      const borderGeom = new T.PlaneGeometry(cardW * 0.85, cardH * 0.85);
      const borderMat = new T.MeshStandardMaterial({
        color: 0xfde68a, emissive: 0xfde68a, emissiveIntensity: 0.3, side: T.DoubleSide,
      });
      const border = new T.Mesh(borderGeom, borderMat);
      border.rotation.x = -Math.PI / 2;
      border.position.y = cardThickness / 2 + 0.001;
      card.add(border);
    }

    return card;
  }

  private buildPyramidFunnel(prospects: ProspectCard[], T: any) {
    // 5 niveaux : Lead (5 cartes) → Qualified (4) → Demo (3) → Proposal (2) → Won (1)
    const stages: Array<{ key: string; color: number; count: number }> = [
      { key: 'lead',      color: 0x6b4423, count: 5 },
      { key: 'qualified', color: 0xfbbf24, count: 4 },
      { key: 'demo',      color: 0xf59e0b, count: 3 },
      { key: 'proposal',  color: 0xd97706, count: 2 },
      { key: 'won',       color: 0x16a34a, count: 1 },
    ];
    const baseX = 5.5;
    const baseZ = 1.5;
    const cardW = 0.35;
    const cardH = 0.5;
    const cardT = 0.02;

    for (let lvl = 0; lvl < stages.length; lvl++) {
      const stage = stages[lvl];
      const realCount = prospects.filter(p => p.stage === stage.key).length;
      const intensity = Math.min(1, realCount / stage.count);
      for (let i = 0; i < stage.count; i++) {
        const geom = new T.BoxGeometry(cardW, cardT, cardH);
        const mat = new T.MeshStandardMaterial({
          color: stage.color,
          emissive: stage.color,
          emissiveIntensity: 0.3 + intensity * 0.4,
          roughness: 0.4,
        });
        const card = new T.Mesh(geom, mat);
        // Empilé : chaque niveau de la pyramide
        const offset = (i - (stage.count - 1) / 2) * (cardW + 0.05);
        card.position.set(baseX + offset, 1.15 + lvl * 0.06, baseZ);
        card.rotation.y = (Math.random() - 0.5) * 0.1;
        this.pyramidCards.push(card);
        this.scene.add(card);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // AUBERGISTE (NPC humanoïde simple)
  // ═══════════════════════════════════════════════════════════════════
  private buildInnkeeper(T: any) {
    const group = new T.Group();
    group.position.set(5, 0, -4);
    group.userData.tutorialId = 'innkeeper';
    this.innkeeperGroup = group;
    this.innkeeperBaseY = group.position.y;

    // ─── Corps (cylindre) ───
    const bodyGeom = new T.CylinderGeometry(0.45, 0.55, 1.3, 12);
    const bodyMat = new T.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.95;
    group.add(body);

    // ─── Tablier (planche rectangulaire devant) ───
    const apronGeom = new T.PlaneGeometry(0.85, 0.95);
    const apronMat = new T.MeshStandardMaterial({
      color: 0xfde68a, roughness: 0.9, side: T.DoubleSide,
    });
    const apron = new T.Mesh(apronGeom, apronMat);
    apron.position.set(0, 0.85, 0.5);
    group.add(apron);

    // ─── Tête (sphère) ───
    const headGeom = new T.SphereGeometry(0.32, 16, 12);
    const headMat = new T.MeshStandardMaterial({ color: 0xfde6d3, roughness: 0.6 });
    const head = new T.Mesh(headGeom, headMat);
    head.position.y = 1.85;
    group.add(head);
    this.innkeeperHead = head;

    // ─── Yeux ───
    const eyeGeom = new T.SphereGeometry(0.04, 6, 6);
    const eyeMat = new T.MeshStandardMaterial({ color: 0x111111 });
    const eyeL = new T.Mesh(eyeGeom, eyeMat);
    eyeL.position.set(-0.1, 1.88, 0.28);
    const eyeR = new T.Mesh(eyeGeom, eyeMat);
    eyeR.position.set(0.1, 1.88, 0.28);
    head.add(eyeL);
    head.add(eyeR);

    // ─── Moustache (rectangle brun) ───
    const moustacheGeom = new T.BoxGeometry(0.2, 0.04, 0.04);
    const moustacheMat = new T.MeshStandardMaterial({ color: 0x4a2a10 });
    const moustache = new T.Mesh(moustacheGeom, moustacheMat);
    moustache.position.set(0, 1.78, 0.3);
    head.add(moustache);

    // ─── Chapeau (cône) ───
    const hatGeom = new T.ConeGeometry(0.35, 0.35, 12);
    const hatMat = new T.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const hat = new T.Mesh(hatGeom, hatMat);
    hat.position.y = 2.2;
    group.add(hat);

    // ─── Bras (cylindres pendants) ───
    const armGeom = new T.CylinderGeometry(0.1, 0.1, 0.9, 8);
    const armMat = new T.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });
    const armL = new T.Mesh(armGeom, armMat);
    armL.position.set(-0.55, 1.05, 0);
    group.add(armL);
    // Bras droit pivote depuis l'épaule pour le geste "cheers"
    const armRPivot = new T.Group();
    armRPivot.position.set(0.55, 1.5, 0);
    const armR = new T.Mesh(armGeom, armMat);
    armR.position.set(0, -0.45, 0); // pendu sous le pivot épaule
    armRPivot.add(armR);
    // Chope dans la main droite (cylindre + petite torus pour anse)
    const tankardGeom = new T.CylinderGeometry(0.11, 0.11, 0.22, 12);
    const tankardMat = new T.MeshStandardMaterial({
      color: 0x8b5a2b, emissive: 0x4a2a10, emissiveIntensity: 0.2, roughness: 0.5, metalness: 0.3,
    });
    const tankard = new T.Mesh(tankardGeom, tankardMat);
    tankard.position.set(0, -0.85, 0.1);
    armRPivot.add(tankard);
    group.add(armRPivot);
    this.innkeeperArmR = armRPivot;

    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BAR avec mugs
  // ═══════════════════════════════════════════════════════════════════
  private buildBar(T: any) {
    // ─── Comptoir (box long) ───
    const barGeom = new T.BoxGeometry(4, 1.1, 1);
    const barMat = new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.8 });
    const bar = new T.Mesh(barGeom, barMat);
    bar.position.set(6, 0.55, -5.5);
    this.scene.add(bar);

    // ─── Plateau doré du comptoir ───
    const topGeom = new T.BoxGeometry(4.1, 0.08, 1.1);
    const topMat = new T.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0x92400e, emissiveIntensity: 0.2,
      metalness: 0.4, roughness: 0.5,
    });
    const top = new T.Mesh(topGeom, topMat);
    top.position.set(6, 1.15, -5.5);
    this.scene.add(top);

    // ─── 4 mugs (cylindres + anse) — la première porte le tag tutorialId="tankard" ───
    for (let i = 0; i < 4; i++) {
      const mugGeom = new T.CylinderGeometry(0.13, 0.13, 0.25, 12);
      const mugMat = new T.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 });
      const mug = new T.Mesh(mugGeom, mugMat);
      mug.position.set(4.6 + i * 0.7, 1.32, -5.5);
      mug.userData.baseY = 1.32;
      mug.userData.phaseOffset = i * 0.18;
      if (i === 0) {
        mug.userData.tutorialId = 'tankard';
      }
      this.tankardMeshes.push(mug);
      this.scene.add(mug);

      // Anse (torus)
      const handleGeom = new T.TorusGeometry(0.08, 0.025, 6, 12, Math.PI);
      const handle = new T.Mesh(handleGeom, mugMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(4.6 + i * 0.7 + 0.15, 1.32, -5.5);
      handle.userData.baseY = 1.32;
      handle.userData.phaseOffset = i * 0.18;
      this.tankardMeshes.push(handle);
      this.scene.add(handle);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TONNEAU DE BIÈRE (objectif annuel ARR)
  // ═══════════════════════════════════════════════════════════════════
  private buildBeerBarrel(T: any) {
    const group = new T.Group();
    group.position.set(-6, 0.6, 5);

    // ─── Tonneau (cylindre couché) ───
    const barrelGeom = new T.CylinderGeometry(0.7, 0.7, 1.5, 16);
    const barrelMat = new T.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.85 });
    const barrel = new T.Mesh(barrelGeom, barrelMat);
    barrel.rotation.z = Math.PI / 2;
    group.add(barrel);

    // ─── Cerclages métal (3 anneaux) ───
    const hoopMat = new T.MeshStandardMaterial({ color: 0x6b6b6b, metalness: 0.7, roughness: 0.4 });
    for (let i = -1; i <= 1; i++) {
      const hoopGeom = new T.TorusGeometry(0.72, 0.04, 8, 24);
      const hoop = new T.Mesh(hoopGeom, hoopMat);
      hoop.rotation.y = Math.PI / 2;
      hoop.position.x = i * 0.5;
      group.add(hoop);
    }

    // ─── Liquide visible sur le dessus (niveau de remplissage) ───
    const liquidGeom = new T.CylinderGeometry(0.4, 0.4, 0.05, 16);
    const liquidMat = new T.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.5, roughness: 0.3,
    });
    const liquid = new T.Mesh(liquidGeom, liquidMat);
    liquid.position.set(0, 0.7, 0);
    liquid.scale.y = this.barrelFill();
    group.add(liquid);
    this.barrelLiquid = liquid;

    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CARTE AUX TRÉSORS MURALE
  // ═══════════════════════════════════════════════════════════════════
  private buildTreasureMap(T: any) {
    // Groupe entier de la carte aux trésors (taggé tutorialId)
    const group = new T.Group();
    group.position.set(-4, 3.5, -10.85);
    group.userData.tutorialId = 'treasure-map';
    this.treasureMapGroup = group;

    // Parchemin (plan beige sur mur du fond)
    const mapGeom = new T.PlaneGeometry(3.5, 2.3);
    const mapMat = new T.MeshStandardMaterial({
      color: 0xfde6c0, roughness: 0.95, emissive: 0x5a3018, emissiveIntensity: 0.1,
      side: T.DoubleSide,
    });
    const map = new T.Mesh(mapGeom, mapMat);
    group.add(map);

    // ─── Régions colorées (3 petits quads sur la carte) ───
    const regions = [
      { color: 0x16a34a, x: -0.7, y: 0.4 },   // vert (EMEA)
      { color: 0x60a5fa, x: 0.5,  y: 0.5 },   // bleu (USA)
      { color: 0xa855f7, x: -0.2, y: -0.4 },  // violet (APAC)
    ];
    this.treasureMapRegions = [];
    for (const r of regions) {
      const regGeom = new T.PlaneGeometry(0.8, 0.6);
      const regMat = new T.MeshStandardMaterial({
        color: r.color, emissive: r.color, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.6, side: T.DoubleSide,
      });
      const region = new T.Mesh(regGeom, regMat);
      region.position.set(r.x, r.y, 0.02);
      region.userData.baseEmissive = 0.3;
      this.treasureMapRegions.push(region);
      group.add(region);
    }

    // ─── X marquant le trésor ───
    const xGeom = new T.RingGeometry(0.12, 0.16, 16);
    const xMat = new T.MeshStandardMaterial({
      color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.6, side: T.DoubleSide,
    });
    const x = new T.Mesh(xGeom, xMat);
    x.position.set(0.5, 0.5, 0.03);
    group.add(x);

    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PIÈCES D'OR + TROPHÉES + BOUGIES
  // ═══════════════════════════════════════════════════════════════════
  private buildCoinStack(T: any, count: number) {
    // Cleanup
    for (const c of this.coinStack) this.scene.remove(c);
    this.coinStack = [];

    // Piles de pièces sur la table (latérales)
    const stacks = 3;
    for (let s = 0; s < stacks; s++) {
      const stackHeight = Math.ceil(count / stacks);
      for (let i = 0; i < stackHeight; i++) {
        const coinGeom = new T.CylinderGeometry(0.13, 0.13, 0.04, 16);
        const coinMat = new T.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3,
          metalness: 0.9, roughness: 0.25,
        });
        const coin = new T.Mesh(coinGeom, coinMat);
        const angle = (s / stacks) * Math.PI * 2 + Math.PI / 4;
        coin.position.set(
          Math.cos(angle) * 2.5,
          1.1 + i * 0.045,
          Math.sin(angle) * 2.5 - 1.5,
        );
        coin.userData.rotSpeed = 0.5 + Math.random() * 0.5;
        this.coinStack.push(coin);
        this.scene.add(coin);
      }
    }
  }

  private buildTrophyShelves(T: any) {
    // ─── Étagère murale (planche horizontale) ───
    const shelfGeom = new T.BoxGeometry(5, 0.1, 0.4);
    const shelfMat = new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.85 });
    const shelf = new T.Mesh(shelfGeom, shelfMat);
    shelf.position.set(4, 4, -10.7);
    this.scene.add(shelf);

    // ─── 4 trophées : cylindre + petites sphères d'or ───
    for (let i = 0; i < 4; i++) {
      const x = 4 + (i - 1.5) * 1.2;
      // Base
      const baseGeom = new T.CylinderGeometry(0.18, 0.22, 0.3, 12);
      const baseMat = new T.MeshStandardMaterial({
        color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.4,
        metalness: 0.9, roughness: 0.25,
      });
      const base = new T.Mesh(baseGeom, baseMat);
      base.position.set(x, 4.2, -10.7);
      this.scene.add(base);

      // Coupe (cylindre plus large au-dessus)
      const cupGeom = new T.CylinderGeometry(0.28, 0.18, 0.35, 12);
      const cup = new T.Mesh(cupGeom, baseMat);
      cup.position.set(x, 4.55, -10.7);
      this.scene.add(cup);

      // Petite sphère d'or au sommet
      const ornGeom = new T.SphereGeometry(0.1, 12, 8);
      const orn = new T.Mesh(ornGeom, baseMat);
      orn.position.set(x, 4.85, -10.7);
      this.scene.add(orn);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BANNIÈRE DE VICTOIRE (drapeau au plafond — contract signed)
  // ═══════════════════════════════════════════════════════════════════
  private buildBanner(T: any) {
    const group = new T.Group();
    group.userData.tutorialId = 'banner';

    // Hampe (cylindre vertical)
    const poleGeom = new T.CylinderGeometry(0.05, 0.05, 2.6, 8);
    const poleMat = new T.MeshStandardMaterial({ color: 0xa68246, metalness: 0.6, roughness: 0.4 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.set(0, 1.3, 0);
    group.add(pole);

    // Drapeau (plane vertical)
    const flagGeom = new T.PlaneGeometry(1.2, 1.6, 6, 6);
    const flagMat = new T.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.35,
      side: T.DoubleSide, roughness: 0.5,
    });
    const flag = new T.Mesh(flagGeom, flagMat);
    flag.position.set(0.6, 1.6, 0);
    // Sauvegarde positions pour flutter
    const fa = flagGeom.attributes.position;
    const flagOriginals = new Float32Array(fa.array.length);
    flagOriginals.set(fa.array);
    flag.userData.originals = flagOriginals;
    group.add(flag);

    // Pomeau doré au sommet
    const finialGeom = new T.SphereGeometry(0.12, 12, 8);
    const finialMat = new T.MeshStandardMaterial({
      color: 0xfde047, emissive: 0xfbbf24, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.25,
    });
    const finial = new T.Mesh(finialGeom, finialMat);
    finial.position.set(0, 2.7, 0);
    group.add(finial);

    // ─── Position de repos (rangé sous le plafond, presque invisible) ───
    // Plafond ~ y=6 ; group sera entre les poutres au-dessus de la table
    this.bannerPoleY = 5.2;   // état rangé (haut)
    this.bannerTopY  = 3.4;   // état hissé (drapeau bien en vue)
    group.position.set(0, this.bannerPoleY, 0);

    this.banner = group;
    this.scene.add(group);
  }

  private buildCandles(T: any) {
    // ─── 4 bougies sur la table ─── (cylindre + flamme Points)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(angle) * 1.2;
      const z = Math.sin(angle) * 1.2;

      // Cire (cylindre blanc cassé)
      const waxGeom = new T.CylinderGeometry(0.06, 0.07, 0.4, 8);
      const waxMat = new T.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.7 });
      const wax = new T.Mesh(waxGeom, waxMat);
      wax.position.set(x, 1.3, z);
      this.scene.add(wax);

      // Flamme (petit cône orange émissif)
      const flameGeom = new T.ConeGeometry(0.05, 0.18, 6);
      const flameMat = new T.MeshStandardMaterial({
        color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: 1.5,
        transparent: true, opacity: 0.95,
      });
      const flame = new T.Mesh(flameGeom, flameMat);
      flame.position.set(x, 1.6, z);
      flame.userData.isCandleFlame = true;
      flame.userData.basePos = { x, y: 1.6, z };
      flame.userData.flickerPhase = Math.random() * Math.PI * 2;
      this.candleFlames.push(flame);
      this.scene.add(flame);

      // Petite lumière ponctuelle pour halo
      const flameLight = new T.PointLight(0xfbbf24, 0.5, 3, 2);
      flameLight.position.set(x, 1.65, z);
      flame.userData.light = flameLight;
      this.scene.add(flameLight);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RATS qui rongent une carte (animation)
  // ═══════════════════════════════════════════════════════════════════
  private buildRats(T: any) {
    // Cleanup
    for (const r of this.ratMeshes) this.scene.remove(r);
    this.ratMeshes = [];

    // ─── 2 rats positionnés près d'une carte spécifique ───
    for (let i = 0; i < 2; i++) {
      const group = new T.Group();

      // Corps (sphère étirée)
      const bodyGeom = new T.SphereGeometry(0.12, 10, 8);
      const bodyMat = new T.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
      const body = new T.Mesh(bodyGeom, bodyMat);
      body.scale.set(1.4, 0.7, 1);
      group.add(body);

      // Queue (cône)
      const tailGeom = new T.ConeGeometry(0.03, 0.25, 6);
      const tailMat = new T.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 });
      const tail = new T.Mesh(tailGeom, tailMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-0.2, 0, 0);
      group.add(tail);

      // Petites oreilles
      const earGeom = new T.SphereGeometry(0.04, 6, 6);
      const earL = new T.Mesh(earGeom, bodyMat);
      earL.position.set(0.12, 0.08, -0.05);
      group.add(earL);
      const earR = new T.Mesh(earGeom, bodyMat);
      earR.position.set(0.12, 0.08, 0.05);
      group.add(earR);

      // Yeux rouges
      const eyeGeom = new T.SphereGeometry(0.015, 6, 6);
      const eyeMat = new T.MeshStandardMaterial({
        color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 1,
      });
      const eyeL = new T.Mesh(eyeGeom, eyeMat);
      eyeL.position.set(0.18, 0.03, -0.04);
      group.add(eyeL);
      const eyeR = new T.Mesh(eyeGeom, eyeMat);
      eyeR.position.set(0.18, 0.03, 0.04);
      group.add(eyeR);

      // Position près d'une carte de churn
      const baseX = 1.5 + i * 0.3;
      const baseZ = 1.4;
      group.position.set(baseX, 1.15, baseZ);
      group.userData.basePos = { x: baseX, y: 1.15, z: baseZ };
      group.userData.phase = i * Math.PI;

      this.ratMeshes.push(group);
      this.scene.add(group);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA : 12 prospects (mixed stages)
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const T = (window as any).THREE;
    if (!T) return;

    const data: ProspectCard[] = [
      { id: 1,  company: 'Acme Forge',     contactName: 'Jean Dubois',  tier: 'ENTERPRISE', mrrPotential: 2500, stage: 'qualified', owner: 'Ramzy', source: 'Inbound',  revealed: true },
      { id: 2,  company: 'Mistral SaaS',   contactName: 'Alice Martin', tier: 'PRO',        mrrPotential: 900,  stage: 'demo',      owner: 'Maya',  source: 'Outbound', revealed: true },
      { id: 3,  company: 'Pixel & Co',     contactName: 'Bob Lefèvre',  tier: 'STARTER',    mrrPotential: 199,  stage: 'lead',      owner: 'Yves',  source: 'LinkedIn', revealed: false },
      { id: 4,  company: 'Banque Royale',  contactName: 'M. Rothschild',tier: 'ENTERPRISE', mrrPotential: 5000, stage: 'proposal',  owner: 'Ramzy', source: 'Referral', revealed: true },
      { id: 5,  company: 'Atelier Bois',   contactName: 'Marie Dupont', tier: 'PRO',        mrrPotential: 750,  stage: 'won',       owner: 'Maya',  source: 'Inbound',  revealed: true },
      { id: 6,  company: 'Cosmos Lab',     contactName: 'Dr. Lambert',  tier: 'ENTERPRISE', mrrPotential: 3200, stage: 'won',       owner: 'Ramzy', source: 'Conference', revealed: true },
      { id: 7,  company: 'GreenTech',      contactName: 'P. Verdier',   tier: 'PRO',        mrrPotential: 650,  stage: 'demo',      owner: 'Yves',  source: 'Inbound',  revealed: true },
      { id: 8,  company: 'Studio Tarot',   contactName: 'Lila Verdier', tier: 'STARTER',    mrrPotential: 149,  stage: 'lead',      owner: 'Maya',  source: 'Web',      revealed: false },
      { id: 9,  company: 'NovaCloud',      contactName: 'Sam Ferrand',  tier: 'PRO',        mrrPotential: 1100, stage: 'qualified', owner: 'Ramzy', source: 'Outbound', revealed: true, churnRisk: true },
      { id: 10, company: 'Café du Coin',   contactName: 'Mme Garcia',   tier: 'STARTER',    mrrPotential: 99,   stage: 'lost',      owner: 'Yves',  source: 'Web',      revealed: true },
      { id: 11, company: 'TitanBuild',     contactName: 'F. Rousseau',  tier: 'ENTERPRISE', mrrPotential: 4200, stage: 'lead',      owner: 'Ramzy', source: 'Referral', revealed: false },
      { id: 12, company: 'Vélo Express',   contactName: 'L. Bouchard',  tier: 'PRO',        mrrPotential: 550,  stage: 'qualified', owner: 'Maya',  source: 'Inbound',  revealed: true },
    ];

    this.prospects.set(data);
    this.mrr.set(4500);
    this.trophies.set([
      { company: 'Atelier Bois', amount: 750 },
      { company: 'Cosmos Lab',   amount: 3200 },
      { company: 'OldClient SA', amount: 1500 },
      { company: 'MegaCorp',     amount: 2800 },
    ]);

    this.buildCards(data, T);
    this.buildCoinStack(T, 18);
    this.buildRats(T);

    this.emitCeremony({ type: 'toast', label: '🎴 Taverne ouverte · 12 prospects à la table', icon: '🍻' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('card-tavern', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  toastWin() {
    // ─── Trouve un prospect non-won, le passe à won ───
    const list = [...this.prospects()];
    const idx = list.findIndex(p => p.stage !== 'won' && p.stage !== 'lost');
    if (idx >= 0) {
      list[idx] = { ...list[idx], stage: 'won', revealed: true };
      this.prospects.set(list);
      this.mrr.update(v => v + list[idx].mrrPotential);
      // Rebuild cartes
      const T = (window as any).THREE;
      if (T) {
        this.buildCards(list, T);
        this.buildCoinStack(T, 18 + Math.floor(this.mrr() / 250));
      }
      // Augmente le niveau du tonneau
      this.barrelFill.update(v => Math.min(1, v + 0.08));
      if (this.barrelLiquid) this.barrelLiquid.scale.y = this.barrelFill();

      const isMajor = list[idx].mrrPotential >= 3000;
      if (isMajor) {
        this.emitCeremony({ type: 'legend', label: `🌟 LÉGENDE · ${list[idx].company} · €${list[idx].mrrPotential}/mo`, icon: '🌟' });
      } else {
        this.emitCeremony({ type: 'toast', label: `🍻 Toast ! ${list[idx].company} signé`, icon: '🍾' });
      }
    }
  }

  compareCards() {
    // ─── Met en avant les 2 plus gros prospects (animation) ───
    this.emitCeremony({ type: 'toast', label: '⚔ Combat de cartes · 2 prospects comparés', icon: '⚔' });
  }

  castOutbound() {
    // ─── Émet un sort : email outbound ───
    this.emitCeremony({ type: 'toast', label: '🪄 Sort lancé · séquence outbound activée', icon: '🪄' });
  }

  triggerRatsAlert() {
    this.emitCeremony({ type: 'rats', label: '🐀 Alerte aux rats · churn imminent !', icon: '🐀' });
  }

  triggerGrave() {
    this.emitCeremony({ type: 'grave', label: '💀 Sépulture · deal perdu', icon: '💀' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoqués par le playExample tutorial JSON
  // ═══════════════════════════════════════════════════════════════════

  /** 🃏 CARD FLIP — la carte se retourne révélant son contenu (lead qualifié). */
  cardFlip(idx?: number) {
    if (!this.cardMeshes || this.cardMeshes.length === 0) return;

    // Détermine la carte cible : idx fourni, sinon première carte non révélée, sinon idx=0
    let target: any = null;
    if (typeof idx === 'number' && this.cardMeshes[idx]) {
      target = this.cardMeshes[idx];
    } else {
      for (const c of this.cardMeshes) {
        const p = this.cardsByProspect.get(c);
        if (p && !p.revealed) { target = c; break; }
      }
      if (!target) target = this.cardMeshes[0];
    }
    if (!target) return;

    // Marque la carte pour anim (rotation X 0 → π → π*2 modulo, mais visuellement → 2π)
    this.cardAnimStates.set(target, {
      kind: 'flip',
      t0: performance.now(),
      duration: 900,
      data: { baseRotX: target.rotation.x || 0 },
    });

    // Marque le prospect comme révélé
    const prospect = this.cardsByProspect.get(target);
    if (prospect && !prospect.revealed) {
      prospect.revealed = true;
      // Met à jour la liste signal (sans rebuild full)
      const list = this.prospects().map(p => p.id === prospect.id ? { ...p, revealed: true } : p);
      this.prospects.set(list);
    }

    this.emitCeremony({ type: 'toast', label: '🃏 Carte retournée · prospect qualifié', icon: '🃏' });
  }

  /** 🎴 CARD DEAL — nouvelles cartes distribuées sur la table (leads added). */
  cardDeal() {
    const T = (window as any).THREE;
    if (!T) return;

    // Génère 3 nouvelles cartes "lead" face cachée
    const newCards: ProspectCard[] = [];
    const newCompanies = [
      { company: 'Astral Forge', contact: 'Léa Moreau', tier: 'PRO',        mrr: 850 },
      { company: 'Iron Quill',   contact: 'M. Faure',   tier: 'STARTER',    mrr: 220 },
      { company: 'Mirage SAS',   contact: 'Théo Roy',   tier: 'ENTERPRISE', mrr: 3800 },
    ];
    const existing = this.prospects();
    let nextId = existing.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    for (let i = 0; i < newCompanies.length; i++) {
      const c = newCompanies[i];
      newCards.push({
        id: nextId++,
        company: c.company,
        contactName: c.contact,
        tier: c.tier as ProspectCard['tier'],
        mrrPotential: c.mrr,
        stage: 'lead',
        owner: ['Ramzy', 'Maya', 'Yves'][i % 3],
        source: 'Outbound',
        revealed: false,
      });
    }
    const merged = [...existing, ...newCards];
    this.prospects.set(merged);

    // Cree les meshes : départ haut, atterrit sur la table
    const tableSurface = 1.1;
    const radius = 2.0;
    const totalBefore = this.cardMeshes.length;
    for (let i = 0; i < newCards.length; i++) {
      const prospect = newCards[i];
      const overallIdx = Math.min(totalBefore + i, 9);
      const angle = (overallIdx / 10) * Math.PI * 1.4 - Math.PI * 0.7;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const card = this.makeCardMesh(prospect, T);
      // Start position : haut au-dessus de la table (effet "distribué")
      card.position.set(x, tableSurface + 3.5 + i * 0.2, z);
      card.rotation.y = -angle + Math.PI / 2;
      card.rotation.x = (Math.random() - 0.5) * 0.6; // chute en spin
      card.userData.basePos = { x, y: tableSurface, z };
      card.userData.hoverPhase = Math.random() * Math.PI * 2;
      card.userData.baseRotX = 0;
      this.cardMeshes.push(card);
      this.cardsByProspect.set(card, prospect);
      this.scene.add(card);
      // Anim "deal" via cardAnimStates : tombe sur la table en 700ms
      this.cardAnimStates.set(card, {
        kind: 'deal',
        t0: performance.now() + i * 150,
        duration: 700,
        data: {
          fromY: tableSurface + 3.5 + i * 0.2,
          toY: tableSurface,
          fromRotX: card.rotation.x,
        },
      });
    }
    this.emitCeremony({ type: 'toast', label: `🎴 ${newCards.length} nouvelles cartes distribuées`, icon: '🎴' });
  }

  /** ✨ TRUMP CARD TWIST — la carte centrale brille en doré (deal closed). */
  trumpcardTwist(idx?: number) {
    if (!this.cardMeshes || this.cardMeshes.length === 0) return;
    const target = (typeof idx === 'number' && this.cardMeshes[idx])
      ? this.cardMeshes[idx]
      : this.cardMeshes[Math.floor(this.cardMeshes.length / 2)];
    if (!target) return;
    this.cinematicState.trumpcardTarget = target;
    this.cinematicState.trumpcardT0 = performance.now();
    this.cinematicState.trumpcardDur = 2200;
    // Marque le prospect comme won pour cohérence data
    const prospect = this.cardsByProspect.get(target);
    if (prospect) {
      prospect.stage = 'won';
      prospect.revealed = true;
      const list = this.prospects().map(p => p.id === prospect.id ? { ...prospect } : p);
      this.prospects.set(list);
    }
    this.emitCeremony({ type: 'legend', label: '✨ Atout magistral · deal closed', icon: '✨' });
  }

  /** 🍻 INNKEEPER REACT — l'aubergiste lève sa chope et tape sur le bar (sales engagement). */
  innkeeperReact() {
    if (!this.innkeeperGroup) return;
    this.cinematicState.innkeeperCheerT0 = performance.now();
    this.cinematicState.innkeeperCheerDur = 1800;
    this.emitCeremony({ type: 'toast', label: '🍻 L\'Aubergiste lève sa chope · engagement', icon: '🍻' });
  }

  /** 🗺 TREASURE MAP UNFURL — la carte murale s'ouvre, les régions brillent (territoire ciblé). */
  treasureMapUnfurl() {
    if (!this.treasureMapGroup) return;
    this.cinematicState.mapUnfurlT0 = performance.now();
    this.cinematicState.mapUnfurlDur = 2400;
    this.emitCeremony({ type: 'toast', label: '🗺 Territoire identifié · raid prêt', icon: '🗺' });
  }

  /** 🚩 BANNER HOIST — le drapeau de victoire monte au plafond (contract signed). */
  bannerHoist() {
    if (!this.banner) return;
    this.cinematicState.bannerHoistT0 = performance.now();
    this.cinematicState.bannerHoistDur = 2000;
    this.emitCeremony({ type: 'legend', label: '🚩 Bannière de victoire hissée · contrat signé', icon: '🚩' });
  }

  /** 🎉 TRIGGER CELEBRATION — musique visuelle + tankards cheers (big win). */
  triggerCelebration() {
    // Joue tout en cascade : aubergiste lève chope, banner monte, tankards trinquent
    this.innkeeperReact();
    setTimeout(() => this.bannerHoist(), 250);
    // Tankards cheers : marque toutes les chopes pour une oscillation festive
    const now = performance.now();
    for (const mug of this.tankardMeshes) {
      mug.userData.cheerT0 = now;
      mug.userData.cheerDur = 1600;
    }
    // Bump barrel fill
    this.barrelFill.update(v => Math.min(1, v + 0.12));
    if (this.barrelLiquid) this.barrelLiquid.scale.y = this.barrelFill();
    this.emitCeremony({ type: 'legend', label: '🎉 LÉGENDE · Big Win à la Taverne !', icon: '🎉' });
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 5, 9);
    this.camera.lookAt(0, 1, 0);
    if (this.controls) this.controls.target.set(0, 1, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic carte → afficher prospect
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
    const intersects = this.raycaster.intersectObjects(this.cardMeshes, true);
    if (intersects.length > 0) {
      // Remonte au root mesh (la carte elle-même)
      let target = intersects[0].object;
      while (target.parent && !this.cardsByProspect.has(target)) {
        target = target.parent;
      }
      const prospect = this.cardsByProspect.get(target);
      if (prospect) {
        this.selectedProspect.set(prospect);
        // Petit flash : la carte saute
        target.position.y += 0.15;
        setTimeout(() => { target.position.y -= 0.15; }, 200);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BOUCLE DE RENDU
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.time += dt;

    // ─── Cartes hovering (oscillation Y subtile) ───
    // Skip si la carte est en cours d'animation cinematic (flip/deal/glow)
    const now = performance.now();
    for (const card of this.cardMeshes) {
      if (this.cardAnimStates.has(card)) continue;
      const base = card.userData.basePos;
      const phase = card.userData.hoverPhase || 0;
      if (base) {
        card.position.y = base.y + Math.sin(this.time * 1.5 + phase) * 0.025;
      }
    }

    // ─── Animations cinematic actives sur les cartes ───
    if (this.cardAnimStates.size > 0) {
      const toRemove: any[] = [];
      this.cardAnimStates.forEach((state, card) => {
        const t = (now - state.t0) / state.duration;
        if (t < 0) return;
        const tc = Math.min(1, t);
        const ease = tc < 0.5 ? 2 * tc * tc : 1 - Math.pow(-2 * tc + 2, 2) / 2;
        if (state.kind === 'flip') {
          // Rotation X 0 → 2π avec un petit "bounce" Y
          card.rotation.x = (state.data?.baseRotX || 0) + ease * Math.PI * 2;
          const base = card.userData.basePos;
          if (base) {
            const lift = Math.sin(tc * Math.PI) * 0.5;
            card.position.y = base.y + lift;
          }
        } else if (state.kind === 'deal') {
          // Chute depuis fromY → toY + spin rotX
          const fromY = state.data?.fromY ?? card.position.y;
          const toY = state.data?.toY ?? (card.userData.basePos?.y ?? card.position.y);
          card.position.y = fromY + (toY - fromY) * ease;
          const fromRX = state.data?.fromRotX ?? 0;
          card.rotation.x = fromRX * (1 - ease);
        } else if (state.kind === 'glow') {
          // Pulse emissive (utilisé en fallback)
          const mat = card.material;
          if (mat && 'emissiveIntensity' in mat) {
            mat.emissiveIntensity = 0.4 + Math.sin(tc * Math.PI * 3) * 0.6;
          }
        }
        if (tc >= 1) {
          // Reset rotation X pour flip (fin = même apparence visuelle)
          if (state.kind === 'flip') {
            card.rotation.x = state.data?.baseRotX || 0;
          }
          toRemove.push(card);
        }
      });
      for (const c of toRemove) this.cardAnimStates.delete(c);
    }

    // ─── Trumpcard glow (carte centrale en or pulsant) ───
    if (this.cinematicState.trumpcardTarget && this.cinematicState.trumpcardDur > 0) {
      const tt = (now - this.cinematicState.trumpcardT0) / this.cinematicState.trumpcardDur;
      const target = this.cinematicState.trumpcardTarget;
      if (target && target.material && 'emissiveIntensity' in target.material) {
        if (tt < 1) {
          // Pulse vif + scale subtil
          target.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(tt * Math.PI * 4)) * 1.5;
          target.scale.setScalar(1 + Math.sin(tt * Math.PI) * 0.25);
          // Vire vers doré
          const T = (window as any).THREE;
          if (T && target.material.color) {
            target.material.color.setHex(0xfde047);
            target.material.emissive.setHex(0xfbbf24);
          }
        } else {
          target.material.emissiveIntensity = 0.6;
          target.scale.setScalar(1);
          this.cinematicState.trumpcardDur = 0;
          this.cinematicState.trumpcardTarget = null;
        }
      }
    }

    // ─── Innkeeper cheer (lève bras droit + bounce vertical) ───
    if (this.cinematicState.innkeeperCheerDur > 0 && this.innkeeperGroup) {
      const ct = (now - this.cinematicState.innkeeperCheerT0) / this.cinematicState.innkeeperCheerDur;
      if (ct < 1) {
        // Hop : Y baseY → +0.25 → baseY
        const hop = Math.sin(ct * Math.PI) * 0.25;
        this.innkeeperGroup.position.y = this.innkeeperBaseY + hop;
        // Bras droit lève en arc (rotation Z autour du pivot épaule)
        if (this.innkeeperArmR) {
          this.innkeeperArmR.rotation.z = -Math.sin(ct * Math.PI) * 1.4;
          this.innkeeperArmR.rotation.x = -Math.sin(ct * Math.PI) * 0.4;
        }
      } else {
        this.innkeeperGroup.position.y = this.innkeeperBaseY;
        if (this.innkeeperArmR) {
          this.innkeeperArmR.rotation.z = 0;
          this.innkeeperArmR.rotation.x = 0;
        }
        this.cinematicState.innkeeperCheerDur = 0;
      }
    }

    // ─── Banner hoist (monte + flutter) ───
    if (this.banner) {
      if (this.cinematicState.bannerHoistDur > 0) {
        const bt = (now - this.cinematicState.bannerHoistT0) / this.cinematicState.bannerHoistDur;
        if (bt < 1) {
          const ease = bt < 0.5 ? 2 * bt * bt : 1 - Math.pow(-2 * bt + 2, 2) / 2;
          this.banner.position.y = this.bannerPoleY + (this.bannerTopY - this.bannerPoleY) * ease;
        } else {
          this.banner.position.y = this.bannerTopY;
          // Stays visible 4s puis retourne (purely visual)
          if ((now - this.cinematicState.bannerHoistT0) > this.cinematicState.bannerHoistDur + 4000) {
            this.banner.position.y = this.bannerPoleY;
            this.cinematicState.bannerHoistDur = 0;
          }
        }
      }
      // Flutter du drapeau (toujours, plus actif quand hissé)
      const flagMesh = this.banner.children[1];
      if (flagMesh?.geometry?.attributes?.position) {
        const pos = flagMesh.geometry.attributes.position;
        const orig = flagMesh.userData.originals;
        if (orig) {
          const amp = this.banner.position.y > this.bannerPoleY ? 0.08 : 0.02;
          for (let i = 0; i < pos.count; i++) {
            const y = orig[i * 3 + 1];
            const flutter = Math.sin(this.time * 5 + y * 6) * amp * (orig[i * 3] + 0.7);
            pos.array[i * 3 + 2] = orig[i * 3 + 2] + flutter;
          }
          pos.needsUpdate = true;
        }
      }
    }

    // ─── Treasure map unfurl (scale + regions glow) ───
    if (this.cinematicState.mapUnfurlDur > 0 && this.treasureMapGroup) {
      const mt = (now - this.cinematicState.mapUnfurlT0) / this.cinematicState.mapUnfurlDur;
      if (mt < 1) {
        const ease = mt < 0.5 ? 2 * mt * mt : 1 - Math.pow(-2 * mt + 2, 2) / 2;
        const scale = this.treasureMapBaseScale * (1 + ease * 0.25);
        this.treasureMapGroup.scale.set(scale, scale, 1);
        // Regions pulse
        for (const reg of this.treasureMapRegions) {
          if (reg.material && 'emissiveIntensity' in reg.material) {
            reg.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(mt * Math.PI * 6)) * 1.2;
          }
        }
      } else {
        this.treasureMapGroup.scale.set(this.treasureMapBaseScale, this.treasureMapBaseScale, 1);
        for (const reg of this.treasureMapRegions) {
          if (reg.material && 'emissiveIntensity' in reg.material) {
            reg.material.emissiveIntensity = reg.userData.baseEmissive ?? 0.3;
          }
        }
        this.cinematicState.mapUnfurlDur = 0;
      }
    }

    // ─── Tankards cheers (oscillation des chopes en cas de big win) ───
    for (const mug of this.tankardMeshes) {
      const baseY = mug.userData.baseY ?? mug.position.y;
      const t0 = mug.userData.cheerT0;
      const dur = mug.userData.cheerDur;
      if (typeof t0 === 'number' && typeof dur === 'number' && dur > 0) {
        const ct = (now - t0) / dur;
        if (ct >= 0 && ct < 1) {
          const wave = Math.sin(ct * Math.PI * 5 + (mug.userData.phaseOffset || 0)) * 0.18 * (1 - ct);
          mug.position.y = baseY + Math.abs(wave) + 0.05;
          mug.rotation.z = Math.sin(ct * Math.PI * 6) * 0.25;
        } else if (ct >= 1) {
          mug.position.y = baseY;
          mug.rotation.z = 0;
          mug.userData.cheerDur = 0;
        }
      }
    }

    // ─── Pyramide légère oscillation ───
    for (let i = 0; i < this.pyramidCards.length; i++) {
      const c = this.pyramidCards[i];
      c.rotation.y += dt * 0.08;
    }

    // ─── Pièces d'or shimmering (rotation) ───
    for (const coin of this.coinStack) {
      const speed = coin.userData.rotSpeed || 1;
      coin.rotation.y += dt * speed * 0.6;
    }

    // ─── Flammes de bougie flickering ───
    for (const flame of this.candleFlames) {
      if (flame.userData.isCandleFlame) {
        const phase = flame.userData.flickerPhase || 0;
        const base = flame.userData.basePos;
        const flicker = 0.85 + Math.sin(this.time * 15 + phase) * 0.1 + Math.random() * 0.08;
        flame.scale.set(flicker, flicker, flicker);
        if (base) {
          flame.position.x = base.x + Math.sin(this.time * 10 + phase) * 0.005;
          flame.position.z = base.z + Math.cos(this.time * 12 + phase) * 0.005;
        }
        if (flame.userData.light) {
          flame.userData.light.intensity = 0.4 + Math.sin(this.time * 14 + phase) * 0.15;
        }
      }
      if (flame.userData.isFire) {
        const f = 1 + Math.sin(this.time * 8) * 0.12 + Math.random() * 0.06;
        flame.scale.set(f, f, f);
      }
    }

    // ─── Rats : petits mouvements de grignotage ───
    for (const rat of this.ratMeshes) {
      const base = rat.userData.basePos;
      const phase = rat.userData.phase || 0;
      if (base) {
        rat.position.x = base.x + Math.sin(this.time * 4 + phase) * 0.08;
        rat.position.y = base.y + Math.abs(Math.sin(this.time * 8 + phase)) * 0.03;
        rat.rotation.y = Math.sin(this.time * 3 + phase) * 0.4;
      }
    }

    // ─── Aubergiste : tourne la tête de temps en temps ───
    if (this.innkeeperHead) {
      this.innkeeperHead.rotation.y = Math.sin(this.time * 0.4) * 0.5;
    }

    // ─── Tonneau de bière : remplissage progressif (très lent) ───
    if (this.barrelLiquid) {
      // Le niveau cible est barrelFill, on lerp doucement
      const target = this.barrelFill();
      const current = this.barrelLiquid.scale.y;
      this.barrelLiquid.scale.y = current + (target - current) * 0.02;
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.time);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════
  /** Lancer le play */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    this.narrator.startPlayExample(0);
  }

  /** Entrer (skip play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
  }

  /** ⏱ Lance le mode TIMEBOX RÉEL — HUD countdown avec la vraie durée Scrum, sans narration. */
  onSplashTimebox(): void {
    this.splashVisible.set(false);
    this.narrator.startTimeboxOnly(1200, 'Pipeline review');
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
