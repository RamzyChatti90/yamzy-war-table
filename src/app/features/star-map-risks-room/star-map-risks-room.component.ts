// ═══════════════════════════════════════════════════════════════════
// 🌌 STAR MAP RISKS ROOM — La Carte Céleste des Périls
//
// Mécanique data unique : planétarium intérieur 3D. Au plafond la voûte
// stellaire des risques. Chaque constellation = 1 risque. Plus rouge =
// plus de severity, plus haut = plus probable. Trous noirs = oubliés.
//
// Implémentation : Three.js procedural sky, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🌠 Pluie d'étoiles = sprint review (3+ risques résolus)
//   🌑 Eclipse        = 3+ risques alignés (alerte conseil)
//   💥 Supernova       = risque réalisé (post-mortem déclenché)
//   🌙 Pleine lune    = revue mensuelle des ADRs
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
import { SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent, TutorialStep, SpellFooterService } from '../../core/spell-ui';

// ─── Types ─────────────────────────────────────────────────────────
interface StarRiskData {
  id: number;
  title: string;
  category: 'tech' | 'security' | 'business' | 'legal' | 'ops';
  severity: number;       // 1-5 (rougeur des étoiles)
  likelihood: number;     // 1-5 (altitude dans le ciel)
  age_days: number;       // pour détecter les trous noirs (>60j)
  owner: string;
  status: 'identified' | 'analyzed' | 'mitigating' | 'realized' | 'closed';
  hasAdrs?: number;       // nombre d'ADRs liés (= nb de lunes)
}

interface StarRiskLink {
  fromRiskId: number;
  toRiskId: number;
}

@Component({
  selector: 'wt-star-map-risks-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sm-host">
      <header class="sm-topbar">
        <div class="sm-title">
          <h1>🌌 STAR MAP RISKS</h1>
          <p>La Carte Céleste des Périls — {{ risks().length }} risques · {{ criticalCount() }} critiques · {{ forgottenCount() }} oubliés</p>
        </div>
        <div class="sm-legend">
          <span class="dot star"></span>étoile
          <span class="dot crit"></span>critique
          <span class="dot hole"></span>trou noir
          <span class="dot moon"></span>ADR
        </div>
      </header>

      <canvas #canvas class="sm-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="sm-flash" [attr.data-type]="f.type">
        <div class="sm-flash-content">
          <div class="sm-flash-icon">{{ f.icon }}</div>
          <div class="sm-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel risk info -->
      <wt-spell-panel
        [open]="!!selectedRisk()"
        title="Risque détecté"
        icon="🌠"
        accent="#f59e0b"
        side="right"
        size="sm"
        (close)="selectedRisk.set(null)">
        <ng-container *ngIf="selectedRisk() as r">
          <div class="sm-panel-head">
            <span class="sm-panel-cat" [attr.data-cat]="r.category">{{ r.category }}</span>
            <span class="sm-panel-status" [attr.data-status]="r.status">{{ r.status }}</span>
          </div>
          <div class="sm-panel-title">{{ r.title }}</div>
          <div class="sm-panel-grid">
            <div><label>Severity</label><strong [style.color]="severityColor(r.severity)">{{ r.severity }}/5</strong></div>
            <div><label>Likelihood</label><strong>{{ r.likelihood }}/5</strong></div>
            <div><label>Age</label><strong [class.danger]="r.age_days > 60">{{ r.age_days }}j</strong></div>
            <div><label>Owner</label><strong>{{ r.owner }}</strong></div>
          </div>
          <div *ngIf="r.hasAdrs" class="sm-panel-adrs">🌙 {{ r.hasAdrs }} ADR(s) liés en orbite</div>
        </ng-container>
      </wt-spell-panel>

      <!-- 🎬 Welcome splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Star Map Risks"
        loreName="La Carte Céleste des Périls"
        color="#8b1a1a"
        oneLiner="Planétarium 3D : constellations de risques, comètes, éclipses, supernovas."
        [duration]="75"
        [timeboxDurationS]="900"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Star Map Risks"
        loreName="La Carte Céleste des Périls"
        accent="#f59e0b"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .sm-host { position: relative; width: 100%; height: 100vh;
      background: radial-gradient(ellipse at top, #1a0a2e 0%, #0a0518 50%, #000000 100%);
      color: #e8eaf6; font-family: "Tinos", serif; }
    .sm-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .sm-topbar > * { pointer-events: auto; }
    .sm-back { color: #f4a8a8; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #8b1a1a; border-radius: 8px; background: rgba(40,0,0,0.4); }
    .sm-back:hover { background: rgba(139,26,26,0.4); }
    .sm-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1px; color: #f4a8a8; text-shadow: 0 0 12px rgba(139,26,26,0.6); }
    .sm-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.7; }
    .sm-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; }
    .sm-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .sm-legend .star { background: #ffffff; box-shadow: 0 0 6px #ffffff; }
    .sm-legend .crit { background: #8b1a1a; box-shadow: 0 0 8px #ff4444; }
    .sm-legend .hole { background: #000000; border: 1px solid #6b4ba8; }
    .sm-legend .moon { background: #d4d4f0; box-shadow: 0 0 6px #9999ff; }

    .sm-canvas { display: block; width: 100%; height: 100%; }
    .sm-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); }
    .sm-controls button { background: rgba(40,10,40,0.7); color: #e8eaf6; border: 1px solid #8b1a1a; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .sm-controls button:hover { background: rgba(139,26,26,0.5); }
    .sm-controls .sm-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .sm-controls .sm-narrator:hover { background: rgba(251,191,36,0.3); }
    .sm-controls .sm-narrator.sm-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .sm-controls .sm-narrator.sm-play:hover { background: #f5b923; }
    .sm-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .sm-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: sm-flash-pulse 1.6s ease-out forwards; }
    .sm-flash[data-type="shower"]   { background: radial-gradient(circle at center, rgba(255,255,255,0.4), transparent 60%); }
    .sm-flash[data-type="eclipse"]  { background: radial-gradient(circle at center, rgba(0,0,0,0.85), rgba(139,26,26,0.4) 40%, transparent 70%); }
    .sm-flash[data-type="supernova"]{ background: radial-gradient(circle at center, rgba(255,255,255,0.9), rgba(255,200,100,0.5) 30%, transparent 70%); }
    .sm-flash[data-type="fullmoon"] { background: radial-gradient(circle at center, rgba(180,200,255,0.5), transparent 60%); }
    .sm-flash-content { text-align: center; animation: sm-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .sm-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .sm-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.7); }
    @keyframes sm-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes sm-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    /* Panel risque */
    .sm-panel { position: absolute; right: 22px; top: 80px; width: 310px; padding: 16px; background: rgba(20,8,30,0.92); border: 1px solid #8b1a1a; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; box-shadow: 0 0 24px rgba(139,26,26,0.3); }
    .sm-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(244,168,168,0.4); border-radius: 50%; color: #f4a8a8; cursor: pointer; }
    .sm-panel-head { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
    .sm-panel-cat, .sm-panel-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .sm-panel-cat[data-cat="tech"]     { background: #1e3a8a; color: #93c5fd; }
    .sm-panel-cat[data-cat="security"] { background: #7c2d12; color: #fca5a5; }
    .sm-panel-cat[data-cat="business"] { background: #14532d; color: #86efac; }
    .sm-panel-cat[data-cat="legal"]    { background: #422006; color: #fbbf24; }
    .sm-panel-cat[data-cat="ops"]      { background: #1e293b; color: #cbd5e1; }
    .sm-panel-status[data-status="identified"] { background: #1f2937; color: #94a3b8; }
    .sm-panel-status[data-status="analyzed"]   { background: #1e3a8a; color: #93c5fd; }
    .sm-panel-status[data-status="mitigating"] { background: #713f12; color: #fbbf24; }
    .sm-panel-status[data-status="realized"]   { background: #7c2d12; color: #fca5a5; }
    .sm-panel-status[data-status="closed"]     { background: #14532d; color: #86efac; }
    .sm-panel-title { font-size: 14px; font-weight: 600; color: #f8e3e3; margin-bottom: 12px; line-height: 1.4; }
    .sm-panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sm-panel-grid > div { display: flex; flex-direction: column; gap: 2px; }
    .sm-panel-grid label { font-size: 10px; opacity: 0.6; text-transform: uppercase; }
    .sm-panel-grid strong { font-size: 14px; color: #fff; }
    .sm-panel-grid strong.danger { color: #ef4444; }
    .sm-panel-adrs { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(139,26,26,0.4); font-size: 11px; color: #c4b5fd; }
  `]
})
export class StarMapRisksRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── State signals ────────────────────────────────────────────────
  risks = signal<StarRiskData[]>([]);
  links = signal<StarRiskLink[]>([]);
  selectedRisk = signal<StarRiskData | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '⭐', title: 'Chaque étoile est un risque', body: 'Le planétarium projette vos risques projet. Chaque étoile = un risque identifié dans le registre. Sa luminosité = sa probabilité.' },
    { icon: '🌌', title: 'Constellations = catégories', body: 'Les étoiles se regroupent par catégorie (tech, sécurité, business, légal, ops). Chaque constellation porte sa couleur dominante.' },
    { icon: '☄', title: 'Comète = risque émergent', body: 'Quand un nouveau risque est ajouté, une comète traverse le ciel. Elle vient se stabiliser dans sa constellation.' },
    { icon: '🌑', title: 'Éclipse = risque mitigé', body: 'Un risque qui passe en statut mitigé subit une éclipse : son étoile s\'efface progressivement. Cérémonie de clôture.' },
    { icon: '💥', title: 'Supernova = risque concrétisé', body: 'Quand un risque devient un vrai problème, son étoile explose en supernova. Lumière aveuglante + ondes de choc dans tout le ciel.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque étoile représente un risque projet.',
    'Les constellations regroupent par catégorie.',
    'Une comète annonce un nouveau risque.',
    'L\'éclipse efface un risque mitigé.',
    'La supernova explose quand un risque se concrétise.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  criticalCount = computed(() => this.risks().filter(r => r.severity >= 4).length);
  forgottenCount = computed(() => this.risks().filter(r => r.age_days > 60).length);

  // ─── Three.js refs ────────────────────────────────────────────────
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

  // ─── 3D meshes ────────────────────────────────────────────────────
  private dome: any;                                  // voûte céleste
  private backgroundStars: any;                       // Points fond
  private constellationGroups = new Map<number, any>(); // risk_id → Group
  private constellationStars: any[] = [];             // toutes les étoiles cliquables
  private riskByStar = new Map<any, StarRiskData>();
  private cascadeLines: any[] = [];                   // lignes argentées entre constellations
  private comets: any[] = [];                         // queue de comètes
  private blackHoles: any[] = [];                     // trous noirs (sphère + anneau)
  private moons: any[] = [];                          // lunes orbitant les constellations
  private astrolabe: any;                             // groupe brass au sol
  private astrolabeRings: any[] = [];                 // toruses concentriques
  private crosshair: any;                             // point de visée
  private sunCorona: any;                             // soleil central (pour eclipse)
  private supernovaParticles: any[] = [];             // explosions actives
  private shootingStars: any[] = [];                  // pluie d'étoiles filantes

  private ceremonyFlashTimer: any = null;
  private skyTime = 0;
  private eclipseTimer = 0;
  private moonlightActive = false;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ─── Cinematic state ──────────────────────────────────────────────
  /** Black holes en train de naître (croissance horizon des événements) */
  private growingBlackHoles: any[] = [];
  /** Lunes éclipsantes (mesh animé qui masque le soleil avec ring of fire) */
  private activeEclipseRig: any = null;
  /** Constellation lighting chain (séquence d'étoiles s'allumant) */
  private constellationLightChain: { stars: any[]; idx: number; nextAt: number; until: number } | null = null;
  /** Astrolabe spin boost timer */
  private astrolabeSpinBoost = 0;
  /** Tweens actifs (interpolations objet 3D) */
  private activeTweens: Array<{
    obj: any;
    from: any; to: any;
    startTime: number; duration: number;
    onDone?: () => void;
  }> = [];

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#f59e0b',
      hint: 'Drag = orbite · molette = zoom · clic étoile = détail risque',
      controls: [
        { icon: '🎬', label: 'Demo risques', action: () => this.loadDemo() },
        { icon: '☄', label: 'Spawn comet', action: () => this.spawnComet() },
        { icon: '🌑', label: 'Trigger eclipse', action: () => this.triggerEclipse() },
        { icon: '💥', label: 'Supernova one', action: () => this.supernovaOne() },
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
  // INIT SCENE
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // ─── Scène : fond gradient violet-noir, brouillard léger ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a0518);
    this.scene.fog = new T.FogExp2(0x0a0518, 0.008);

    // ─── Caméra : on regarde VERS LE HAUT (la voûte) ───
    this.camera = new T.PerspectiveCamera(60, w / h, 0.1, 500);
    this.camera.position.set(0, 2, 0.1);    // proche du sol, légèrement reculé
    this.camera.lookAt(0, 30, 0);            // vise le zénith

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lumières : ambiance nocturne mais lisible ───
    this.scene.add(new T.AmbientLight(0x2a1a4a, 0.5));
    const moonLight = new T.DirectionalLight(0xb8b8ff, 0.4);
    moonLight.position.set(8, 30, 8);
    this.scene.add(moonLight);
    // Une petite lumière chaude au sol pour l'astrolabe en laiton
    const astrolabeLight = new T.PointLight(0xd4a574, 0.8, 12);
    astrolabeLight.position.set(0, 0.5, 0);
    this.scene.add(astrolabeLight);

    // ─── Voûte céleste (dôme inversé) ───
    this.buildDome(T);

    // ─── Étoiles de fond (Points scattered sur le dôme) ───
    this.buildBackgroundStars(T, 600);

    // ─── Soleil central (sera utilisé pour eclipse) ───
    this.buildCentralSun(T);

    // ─── Astrolabe au sol (anneaux de laiton) ───
    this.buildAstrolabe(T);

    // ─── Crosshair indicateur ───
    this.buildCrosshair(T);

    // ─── OrbitControls : on s'autorise rotation libre, mais target = zénith ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 25, 0);   // on regarde le ciel
      this.controls.maxDistance = 35;
      this.controls.minDistance = 1;
      this.controls.maxPolarAngle = Math.PI * 0.95;   // un peu de marge
    }

    // ─── Raycaster pour cliquer étoiles ───
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Stratégie)
    const island = getIslandForRoom('/star-map-risks');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-18, 5, 0],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[StarMap] 🌌 Planetarium scene ready');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'star-map-risks',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : voûte céleste (dôme inversé)
  // ═══════════════════════════════════════════════════════════════════
  private buildDome(T: any) {
    const domeGeom = new T.SphereGeometry(45, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new T.MeshBasicMaterial({
      color: 0x0d0826,
      side: T.BackSide,             // visible de l'intérieur
      transparent: true,
      opacity: 0.95,
    });
    this.dome = new T.Mesh(domeGeom, domeMat);
    this.dome.position.y = 0;
    this.dome.userData.tutorialId = 'dome';
    this.scene.add(this.dome);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : étoiles de fond (Points scattered)
  // ═══════════════════════════════════════════════════════════════════
  private buildBackgroundStars(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Position sur l'hémisphère supérieur
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random());        // 0 → π/2
      const r = 42 + Math.random() * 2;
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      // Couleur : majoritairement blanc, quelques bleues/jaunes
      const tint = Math.random();
      if (tint < 0.7) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
      } else if (tint < 0.85) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1;
      } else {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.6;
      }
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.4,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    this.backgroundStars = new T.Points(geom, mat);
    this.backgroundStars.userData.phases = phases;
    this.scene.add(this.backgroundStars);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : soleil central (pour eclipse)
  // ═══════════════════════════════════════════════════════════════════
  private buildCentralSun(T: any) {
    const sunGeom = new T.SphereGeometry(1.2, 24, 16);
    const sunMat = new T.MeshBasicMaterial({
      color: 0xffe080,
      transparent: true,
      opacity: 0.0,                  // invisible par défaut
    });
    this.sunCorona = new T.Mesh(sunGeom, sunMat);
    this.sunCorona.position.set(0, 30, 0);     // au zénith
    this.scene.add(this.sunCorona);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : astrolabe au sol (anneaux laiton concentriques)
  // ═══════════════════════════════════════════════════════════════════
  private buildAstrolabe(T: any) {
    this.astrolabe = new T.Group();
    this.astrolabe.position.set(0, 0.02, 0);
    this.astrolabe.userData.tutorialId = 'astrolabe';

    // Plaque circulaire de fond
    const plateGeom = new T.CircleGeometry(3.2, 48);
    const plateMat = new T.MeshStandardMaterial({
      color: 0x2a1a0a,
      roughness: 0.7,
      metalness: 0.3,
    });
    const plate = new T.Mesh(plateGeom, plateMat);
    plate.rotation.x = -Math.PI / 2;
    this.astrolabe.add(plate);

    // Anneaux concentriques de laiton (5 toruses)
    const ringRadii = [3.0, 2.4, 1.8, 1.2, 0.7];
    const ringThickness = [0.05, 0.04, 0.04, 0.035, 0.03];
    for (let i = 0; i < ringRadii.length; i++) {
      const ringGeom = new T.TorusGeometry(ringRadii[i], ringThickness[i], 8, 64);
      const ringMat = new T.MeshStandardMaterial({
        color: 0xb8862a,                // laiton
        emissive: 0x6b4423,
        emissiveIntensity: 0.3,
        roughness: 0.35,
        metalness: 0.85,
      });
      const ring = new T.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.userData.rotationSpeed = 0.01 * (i % 2 === 0 ? 1 : -1) * (1 + i * 0.15);
      this.astrolabeRings.push(ring);
      this.astrolabe.add(ring);
    }

    // Aiguilles croisées (deux barres en croix)
    for (let k = 0; k < 4; k++) {
      const armGeom = new T.BoxGeometry(2.8, 0.04, 0.06);
      const armMat = new T.MeshStandardMaterial({
        color: 0xd4a574,
        emissive: 0x6b4423,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.7,
      });
      const arm = new T.Mesh(armGeom, armMat);
      arm.rotation.y = (k * Math.PI) / 4;
      arm.position.y = 0.04;
      this.astrolabe.add(arm);
    }

    // Petites gemmes lumineuses aux 4 points cardinaux
    for (let k = 0; k < 4; k++) {
      const gemGeom = new T.OctahedronGeometry(0.08, 0);
      const gemMat = new T.MeshStandardMaterial({
        color: 0xff8866,
        emissive: 0xff4422,
        emissiveIntensity: 1.0,
      });
      const gem = new T.Mesh(gemGeom, gemMat);
      const angle = (k * Math.PI) / 2;
      gem.position.set(Math.cos(angle) * 3.0, 0.08, Math.sin(angle) * 3.0);
      this.astrolabe.add(gem);
    }

    this.scene.add(this.astrolabe);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : crosshair (indicateur de visée)
  // ═══════════════════════════════════════════════════════════════════
  private buildCrosshair(T: any) {
    const geom = new T.SphereGeometry(0.06, 8, 6);
    const mat = new T.MeshBasicMaterial({
      color: 0xff8866,
      transparent: true,
      opacity: 0.9,
    });
    this.crosshair = new T.Mesh(geom, mat);
    this.crosshair.position.set(0, 0.15, 0);
    this.scene.add(this.crosshair);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : constellations (1 par risque)
  // ═══════════════════════════════════════════════════════════════════
  private buildConstellations(risks: StarRiskData[]) {
    const T = (window as any).THREE;
    this.disposeConstellations();

    for (let i = 0; i < risks.length; i++) {
      const risk = risks[i];
      this.spawnConstellation(risk, i, risks.length, T);
    }

    // Lignes de cascade entre constellations liées
    this.buildCascadeLines(T);

    // Trous noirs : risques avec age_days > 60
    const forgotten = risks.filter(r => r.age_days > 60);
    for (const fr of forgotten) {
      this.spawnBlackHole(fr, T);
    }

    console.log(`[StarMap] 🌌 Sky built : ${risks.length} constellations + ${this.links().length} cascading + ${forgotten.length} black holes`);
  }

  private spawnConstellation(risk: StarRiskData, idx: number, total: number, T: any) {
    // Position dans le ciel : angle horizontal réparti, altitude = likelihood
    const theta = (idx / total) * Math.PI * 2 + (this.hash(risk.title) % 100) / 100 * 0.4;
    const altitudeFactor = 0.2 + (risk.likelihood / 5) * 0.7;   // 0.2 → 0.9
    const phi = Math.PI / 2 - altitudeFactor * (Math.PI / 2 - 0.15);   // colatitude
    const r = 38;

    const center = new T.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );

    // ─── Groupe pour cette constellation ───
    const group = new T.Group();
    group.position.copy(center);
    group.userData = { riskId: risk.id, risk };
    // Tag tutorialId only on first constellation (anchor for narrator highlight)
    if (idx === 0) group.userData.tutorialId = 'constellation';

    // Couleur des étoiles : intensité rouge selon severity
    const sev = Math.max(0, Math.min(5, risk.severity));
    const t = sev / 5;
    // sev 1 = blanc-jaune (0xfff8c8), sev 5 = rouge profond (0x8b1a1a)
    const r1 = 1.0;
    const g1 = 1.0 - t * 0.85;
    const b1 = 1.0 - t * 0.95;
    const starColor = new T.Color(r1, g1, b1);

    const emissiveColor = sev >= 4
      ? new T.Color(0x8b1a1a)
      : new T.Color(r1 * 0.5, g1 * 0.5, b1 * 0.5);

    // ─── 3 à 5 étoiles brillantes formant la constellation ───
    const nStars = 3 + (this.hash(risk.title + 'n') % 3);
    const localPositions: any[] = [];
    for (let s = 0; s < nStars; s++) {
      const localAng = (s / nStars) * Math.PI * 2 + (this.hash(risk.title + s) % 100) / 100;
      const localR = 1.0 + ((this.hash(risk.title + s + 'r') % 100) / 100) * 1.5;
      const localY = ((this.hash(risk.title + s + 'y') % 100) / 100 - 0.5) * 1.2;
      const pos = new T.Vector3(
        Math.cos(localAng) * localR,
        localY,
        Math.sin(localAng) * localR,
      );
      localPositions.push(pos);

      const starSize = 0.18 + (sev / 5) * 0.18;
      const starGeom = new T.SphereGeometry(starSize, 12, 8);
      const starMat = new T.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: 0.95,
      });
      const star = new T.Mesh(starGeom, starMat);
      star.position.copy(pos);
      star.userData = {
        riskId: risk.id,
        risk,
        twinklePhase: Math.random() * Math.PI * 2,
        baseOpacity: 0.95,
        baseColor: starColor.clone(),
      };
      // Halo lumineux autour de chaque étoile (sprite-like)
      const haloGeom = new T.SphereGeometry(starSize * 1.8, 8, 6);
      const haloMat = new T.MeshBasicMaterial({
        color: emissiveColor,
        transparent: true,
        opacity: 0.18,
      });
      const halo = new T.Mesh(haloGeom, haloMat);
      star.add(halo);

      group.add(star);
      this.constellationStars.push(star);
      this.riskByStar.set(star, risk);
    }

    // ─── Lignes argentées entre les étoiles de cette constellation ───
    const linePts: any[] = [];
    for (let s = 0; s < localPositions.length - 1; s++) {
      linePts.push(localPositions[s], localPositions[s + 1]);
    }
    const lineGeom = new T.BufferGeometry().setFromPoints(linePts);
    const lineMat = new T.LineBasicMaterial({
      color: 0xc0c8d8,
      transparent: true,
      opacity: 0.5,
    });
    const line = new T.LineSegments(lineGeom, lineMat);
    group.add(line);

    // ─── Lunes orbitant la constellation si ADRs liés ───
    if (risk.hasAdrs && risk.hasAdrs > 0) {
      for (let m = 0; m < Math.min(risk.hasAdrs, 4); m++) {
        const moonGeom = new T.SphereGeometry(0.15, 10, 8);
        const moonMat = new T.MeshStandardMaterial({
          color: 0xd4d4f0,
          emissive: 0x6666aa,
          emissiveIntensity: 0.5,
          roughness: 0.6,
        });
        const moon = new T.Mesh(moonGeom, moonMat);
        moon.userData = {
          orbitRadius: 2.5 + m * 0.4,
          orbitSpeed: 0.5 + m * 0.15,
          orbitPhase: m * (Math.PI * 2 / risk.hasAdrs),
          riskId: risk.id,
        };
        // Tag tutorialId on first moon globally
        if (this.moons.length === 0) moon.userData.tutorialId = 'moon';
        group.add(moon);
        this.moons.push(moon);
      }
    }

    this.scene.add(group);
    this.constellationGroups.set(risk.id, group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : lignes argentées entre constellations (cascading risks)
  // ═══════════════════════════════════════════════════════════════════
  private buildCascadeLines(T: any) {
    for (const link of this.links()) {
      const g1 = this.constellationGroups.get(link.fromRiskId);
      const g2 = this.constellationGroups.get(link.toRiskId);
      if (!g1 || !g2) continue;
      const pts = [g1.position.clone(), g2.position.clone()];
      const geom = new T.BufferGeometry().setFromPoints(pts);
      const mat = new T.LineBasicMaterial({
        color: 0x9aa8c8,
        transparent: true,
        opacity: 0.35,
        linewidth: 1,
      });
      const line = new T.Line(geom, mat);
      line.userData = { kind: 'cascade', fromId: link.fromRiskId, toId: link.toRiskId };
      // Tag tutorialId on first cascade only
      if (this.cascadeLines.length === 0) line.userData.tutorialId = 'cascade';
      this.cascadeLines.push(line);
      this.scene.add(line);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : trou noir (sphère noire + anneau concentrique distordu)
  // ═══════════════════════════════════════════════════════════════════
  private spawnBlackHole(risk: StarRiskData, T: any) {
    const group = this.constellationGroups.get(risk.id);
    if (!group) return;
    const pos = group.position.clone();
    // Décaler légèrement pour ne pas chevaucher la constellation
    pos.multiplyScalar(0.92);

    const holeGroup = new T.Group();
    holeGroup.position.copy(pos);

    // Sphère noire absolue
    const sphereGeom = new T.SphereGeometry(1.0, 24, 16);
    const sphereMat = new T.MeshBasicMaterial({
      color: 0x000000,
      transparent: false,
    });
    const sphere = new T.Mesh(sphereGeom, sphereMat);
    holeGroup.add(sphere);

    // Anneau d'accrétion violet-orangé (effet distorsion)
    const ringGeom = new T.TorusGeometry(1.6, 0.12, 8, 48);
    const ringMat = new T.MeshBasicMaterial({
      color: 0x6b4ba8,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new T.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2.2;
    holeGroup.add(ring);

    // Deuxième anneau plus large, plus fin
    const ring2Geom = new T.TorusGeometry(2.0, 0.05, 6, 48);
    const ring2Mat = new T.MeshBasicMaterial({
      color: 0xff6622,
      transparent: true,
      opacity: 0.5,
    });
    const ring2 = new T.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.z = Math.PI / 8;
    holeGroup.add(ring2);

    holeGroup.userData = {
      kind: 'blackhole',
      risk,
      ring,
      ring2,
      spinPhase: Math.random() * Math.PI * 2,
    };
    // Tag tutorialId on first blackhole only
    if (this.blackHoles.length === 0) holeGroup.userData.tutorialId = 'blackhole';
    this.blackHoles.push(holeGroup);
    this.scene.add(holeGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : comète (forme allongée traversant le ciel)
  // ═══════════════════════════════════════════════════════════════════
  private spawnCometMesh(T: any, riskTitle: string = 'nouveau risque') {
    const cometGroup = new T.Group();

    // Tête (sphère lumineuse)
    const headGeom = new T.SphereGeometry(0.4, 12, 10);
    const headMat = new T.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const head = new T.Mesh(headGeom, headMat);
    cometGroup.add(head);

    // Queue (cône étiré)
    const tailGeom = new T.ConeGeometry(0.35, 4.0, 12, 1, true);
    const tailMat = new T.MeshBasicMaterial({
      color: 0xc8e0ff,
      transparent: true,
      opacity: 0.55,
      side: T.DoubleSide,
    });
    const tail = new T.Mesh(tailGeom, tailMat);
    tail.position.x = -2.0;       // décalé derrière la tête
    tail.rotation.z = Math.PI / 2;
    cometGroup.add(tail);

    // Trajectoire : angle azimutal aléatoire, traverse la voûte
    const startTheta = Math.random() * Math.PI * 2;
    const startPhi = 0.3 + Math.random() * 0.5;
    const r = 35;
    cometGroup.position.set(
      r * Math.sin(startPhi) * Math.cos(startTheta),
      r * Math.cos(startPhi),
      r * Math.sin(startPhi) * Math.sin(startTheta),
    );

    cometGroup.userData = {
      kind: 'comet',
      title: riskTitle,
      angularVel: 0.1 + Math.random() * 0.15,         // vitesse de rotation
      axis: new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      lifetime: 30,
      age: 0,
    };
    // Tag tutorialId on first active comet globally
    if (this.comets.length === 0) cometGroup.userData.tutorialId = 'comet';
    this.comets.push(cometGroup);
    this.scene.add(cometGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════
  private disposeConstellations() {
    this.constellationGroups.forEach(g => this.scene.remove(g));
    this.constellationGroups.clear();
    this.constellationStars = [];
    this.riskByStar.clear();
    this.cascadeLines.forEach(l => this.scene.remove(l));
    this.cascadeLines = [];
    this.blackHoles.forEach(b => this.scene.remove(b));
    this.blackHoles = [];
    this.moons = [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA : 8 risques + 5 liens de cascade
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const demoRisks: StarRiskData[] = [
      { id: 1, title: 'Fuite de données Postgres prod',   category: 'security', severity: 5, likelihood: 3, age_days: 12, owner: 'Ramzy', status: 'mitigating', hasAdrs: 2 },
      { id: 2, title: 'Dette technique module auth',       category: 'tech',     severity: 4, likelihood: 4, age_days: 45, owner: 'Alice', status: 'analyzed',   hasAdrs: 3 },
      { id: 3, title: 'Concurrent EnterpriseX en gain',    category: 'business', severity: 3, likelihood: 5, age_days: 28, owner: 'Bob',   status: 'identified' },
      { id: 4, title: 'RGPD log retention non conforme',   category: 'legal',    severity: 4, likelihood: 3, age_days: 75, owner: 'Maya',  status: 'realized',   hasAdrs: 1 },
      { id: 5, title: 'Cluster K8s saturé en prod',        category: 'ops',      severity: 5, likelihood: 4, age_days: 8,  owner: 'Yves',  status: 'mitigating', hasAdrs: 2 },
      { id: 6, title: 'API rate limit absent',              category: 'tech',     severity: 3, likelihood: 4, age_days: 22, owner: 'Alice', status: 'analyzed' },
      { id: 7, title: 'Contrat client GlobalCorp non signé', category: 'business', severity: 4, likelihood: 2, age_days: 90, owner: 'Bob',   status: 'identified' },
      { id: 8, title: 'XSS reflected sur form contact',    category: 'security', severity: 2, likelihood: 5, age_days: 5,  owner: 'Ramzy', status: 'mitigating' },
    ];
    // Liens cascading (5)
    const demoLinks: StarRiskLink[] = [
      { fromRiskId: 1, toRiskId: 4 },   // fuite data → RGPD
      { fromRiskId: 2, toRiskId: 6 },   // dette auth → API rate
      { fromRiskId: 5, toRiskId: 6 },   // cluster saturé → API rate
      { fromRiskId: 8, toRiskId: 1 },   // XSS → fuite data
      { fromRiskId: 3, toRiskId: 7 },   // concurrent → contrat
    ];
    this.risks.set(demoRisks);
    this.links.set(demoLinks);
    this.buildConstellations(demoRisks);

    // Spawn 1 comète initiale (nouveau risque détecté cette semaine)
    if ((window as any).THREE) {
      this.spawnCometMesh((window as any).THREE, demoRisks[7].title);
    }

    this.emitCeremony({ type: 'fullmoon', label: 'Carte céleste chargée · 8 constellations', icon: '🌙' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════
  spawnComet() {
    const T = (window as any).THREE;
    if (!T) return;
    this.spawnCometMesh(T, 'Risque détecté ' + new Date().toLocaleDateString('fr-FR'));
    this.emitCeremony({ type: 'shower', label: '☄ Comète détectée — nouveau risque entrant', icon: '☄' });
  }

  triggerEclipse() {
    // Active soleil + corona avec un fondu, déclenche flash
    this.eclipseTimer = 4.5;
    if (this.sunCorona) this.sunCorona.material.opacity = 0.85;
    this.emitCeremony({ type: 'eclipse', label: '🌑 Éclipse — 3 risques s\'alignent', icon: '🌑' });
    // Triple les pulsations sur les étoiles critiques
    for (const star of this.constellationStars) {
      if (star.userData.risk?.severity >= 4) {
        star.userData.eclipsePulse = 1.0;
      }
    }
  }

  supernovaOne() {
    // Choisit un risque (idéalement réalisé), génère explosion
    const T = (window as any).THREE;
    if (!T) return;
    const realized = this.risks().find(r => r.status === 'realized') || this.risks()[0];
    if (!realized) return;
    const group = this.constellationGroups.get(realized.id);
    if (!group) return;

    // Explosion : particules dorées qui éclatent
    const particleCount = 60;
    const particles = new T.Group();
    particles.position.copy(group.position);
    for (let i = 0; i < particleCount; i++) {
      const pGeom = new T.SphereGeometry(0.12, 6, 4);
      const pMat = new T.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffd84a : 0xfff8c8,
        transparent: true,
        opacity: 1.0,
      });
      const p = new T.Mesh(pGeom, pMat);
      const v = new T.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(3 + Math.random() * 4);
      p.userData = { velocity: v, life: 1.0 };
      particles.add(p);
    }
    particles.userData = { kind: 'supernova', life: 2.5 };
    this.supernovaParticles.push(particles);
    this.scene.add(particles);

    this.emitCeremony({ type: 'supernova', label: `💥 Supernova — "${realized.title}"`, icon: '💥' });

    // Marquer le risque comme realized
    const updated = this.risks().map(r => r.id === realized.id ? { ...r, status: 'realized' as const } : r);
    this.risks.set(updated);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoqués par le playExample tutorial JSON
  // (chaque méthode public est appelable via narrator.invokeMethod)
  // ═══════════════════════════════════════════════════════════════════

  /** 🕳 FORGE BLACK HOLE — un nouveau trou noir grandit dans le ciel (= risque catastrophique identifié) */
  forgeBlackHole() {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;

    // Position : choisit un angle libre dans le ciel
    const theta = Math.random() * Math.PI * 2;
    const phi = 0.5 + Math.random() * 0.6;
    const r = 36;
    const pos = new T.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );

    const holeGroup = new T.Group();
    holeGroup.position.copy(pos);

    // Sphère noire absolue (event horizon)
    const sphereGeom = new T.SphereGeometry(0.05, 24, 16);   // démarre minuscule
    const sphereMat = new T.MeshBasicMaterial({ color: 0x000000 });
    const sphere = new T.Mesh(sphereGeom, sphereMat);
    holeGroup.add(sphere);

    // Anneau d'accrétion (démarre fin)
    const ringGeom = new T.TorusGeometry(0.15, 0.02, 8, 48);
    const ringMat = new T.MeshBasicMaterial({
      color: 0x6b4ba8,
      transparent: true,
      opacity: 0.0,
    });
    const ring = new T.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2.2;
    holeGroup.add(ring);

    const ring2Geom = new T.TorusGeometry(0.2, 0.015, 6, 48);
    const ring2Mat = new T.MeshBasicMaterial({
      color: 0xff6622,
      transparent: true,
      opacity: 0.0,
    });
    const ring2 = new T.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = Math.PI / 1.8;
    ring2.rotation.z = Math.PI / 8;
    holeGroup.add(ring2);

    holeGroup.userData = {
      kind: 'blackhole',
      bornAt: this.skyTime,
      grew: false,
      sphere, ring, ring2,
      spinPhase: Math.random() * Math.PI * 2,
    };
    this.growingBlackHoles.push(holeGroup);
    this.blackHoles.push(holeGroup);
    this.scene.add(holeGroup);

    this.emitCeremony({ type: 'supernova', label: '🕳 Trou noir détecté · Risque catastrophique', icon: '🕳' });
  }

  /** ☄ SPAWN COMET — comète arrive depuis le bord vers une constellation (= menace incoming) */
  spawnCometCinematic(targetRiskId?: number) {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;

    // Choisit constellation cible
    let target: any = null;
    if (targetRiskId && this.constellationGroups.has(targetRiskId)) {
      target = this.constellationGroups.get(targetRiskId);
    } else {
      // Première constellation disponible
      const first = this.constellationGroups.values().next();
      if (!first.done) target = first.value;
    }

    const cometGroup = new T.Group();

    // Tête (sphère lumineuse blanche)
    const headGeom = new T.SphereGeometry(0.55, 12, 10);
    const headMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const head = new T.Mesh(headGeom, headMat);
    cometGroup.add(head);

    // Queue allongée
    const tailGeom = new T.ConeGeometry(0.45, 5.0, 12, 1, true);
    const tailMat = new T.MeshBasicMaterial({
      color: 0xc8e0ff, transparent: true, opacity: 0.6, side: T.DoubleSide,
    });
    const tail = new T.Mesh(tailGeom, tailMat);
    tail.position.x = -2.5;
    tail.rotation.z = Math.PI / 2;
    cometGroup.add(tail);

    // Position de départ : loin sur le bord
    const startTheta = Math.random() * Math.PI * 2;
    const startPhi = 0.2 + Math.random() * 0.2;
    const r = 44;
    const startPos = new T.Vector3(
      r * Math.sin(startPhi) * Math.cos(startTheta),
      r * Math.cos(startPhi),
      r * Math.sin(startPhi) * Math.sin(startTheta),
    );
    cometGroup.position.copy(startPos);

    // Cible (constellation ou centre du ciel)
    const targetPos = target ? target.position.clone() : new T.Vector3(0, 30, 0);
    // Peak de l'arc
    const peak = Math.max(startPos.y, targetPos.y) + 8;

    cometGroup.userData = {
      kind: 'comet',
      tweening: true,
      bornAt: this.skyTime,
      lifetime: 30,
      age: 0,
      angularVel: 0,
      axis: new T.Vector3(0, 1, 0),
    };
    // Tag tutorialId on first if none yet
    if (!Array.from(this.comets).some(c => c.userData?.tutorialId === 'comet')) {
      cometGroup.userData.tutorialId = 'comet';
    }
    this.comets.push(cometGroup);
    this.scene.add(cometGroup);

    // Tween en arc vers la cible
    this.tween(cometGroup.position, startPos, targetPos, 2.6, peak, () => {
      cometGroup.userData.tweening = false;
      cometGroup.userData.age = cometGroup.userData.lifetime - 3.5;   // fade out après impact
    });

    this.emitCeremony({ type: 'shower', label: '☄ Comète d\'alerte · Menace incoming', icon: '☄' });
  }

  /** 💥 TRIGGER SUPERNOVA — une étoile explose en pulses brillants (= risque réalisé) */
  triggerSupernova() {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;

    // Choisit cible : risque "realized" sinon premier dispo
    const realized = this.risks().find(r => r.status === 'realized') || this.risks()[0];
    if (!realized) return;
    const group = this.constellationGroups.get(realized.id);
    if (!group) return;

    // Pulse lumineux sur la constellation entière avant explosion
    group.children.forEach((star: any) => {
      if (star.material && star.userData?.riskId) {
        star.userData.eclipsePulse = 1.5;     // réutilise le système de pulse
      }
    });

    // Explosion classique
    const particleCount = 90;
    const particles = new T.Group();
    particles.position.copy(group.position);
    for (let i = 0; i < particleCount; i++) {
      const pGeom = new T.SphereGeometry(0.14, 6, 4);
      const pMat = new T.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffd84a : (i % 5 === 0 ? 0xff6622 : 0xfff8c8),
        transparent: true,
        opacity: 1.0,
      });
      const p = new T.Mesh(pGeom, pMat);
      const v = new T.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(4 + Math.random() * 5);
      p.userData = { velocity: v, life: 1.0 };
      particles.add(p);
    }
    particles.userData = { kind: 'supernova', life: 3.0, bornAt: this.skyTime };
    this.supernovaParticles.push(particles);
    this.scene.add(particles);

    this.emitCeremony({ type: 'supernova', label: `💥 Supernova · "${realized.title}" réalisé`, icon: '💥' });

    // Marquer realized
    const updated = this.risks().map(r => r.id === realized.id ? { ...r, status: 'realized' as const } : r);
    this.risks.set(updated);
  }

  /** 🌑 TRIGGER ECLIPSE — la lune masque le soleil + ring of fire (= mitigation totale) */
  triggerEclipseCinematic() {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;

    // Active sun + corona
    this.eclipseTimer = 5.5;
    if (this.sunCorona) this.sunCorona.material.opacity = 0.9;

    // Crée un rig d'éclipse : lune ombre + anneau de feu
    const rig = new T.Group();
    rig.position.set(0, 30, 0);

    // Disque sombre (la lune qui masque)
    const moonGeom = new T.SphereGeometry(1.25, 24, 16);
    const moonMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 });
    const moonDisc = new T.Mesh(moonGeom, moonMat);
    rig.add(moonDisc);

    // Anneau de feu (ring of fire)
    const ringGeom = new T.TorusGeometry(1.45, 0.08, 12, 64);
    const ringMat = new T.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.0,
    });
    const ringFire = new T.Mesh(ringGeom, ringMat);
    rig.add(ringFire);

    rig.userData = {
      kind: 'eclipseRig',
      moonDisc, ringFire,
      bornAt: this.skyTime,
      lifetime: 5.5,
    };
    this.activeEclipseRig = rig;
    this.scene.add(rig);

    // Pulse les étoiles critiques (les met en valeur durant l'éclipse)
    for (const star of this.constellationStars) {
      if (star.userData.risk?.severity >= 4) {
        star.userData.eclipsePulse = 1.0;
      }
    }

    this.emitCeremony({ type: 'eclipse', label: '🌑 Éclipse · Mitigation totale activée', icon: '🌑' });
  }

  /** ✨ CONSTELLATION LIGHT — une constellation s'allume en chaîne (= risk register reviewed) */
  constellationLight() {
    if (!this.scene || this.constellationStars.length === 0) return;

    // Choisit une constellation : la première trouvée avec >= 3 étoiles
    let chosenRiskId: number | null = null;
    for (const [riskId] of this.constellationGroups) {
      const stars = this.constellationStars.filter(s => s.userData?.riskId === riskId);
      if (stars.length >= 3) { chosenRiskId = riskId; break; }
    }
    if (chosenRiskId === null) return;

    const stars = this.constellationStars.filter(s => s.userData?.riskId === chosenRiskId);
    this.constellationLightChain = {
      stars,
      idx: 0,
      nextAt: this.skyTime,
      until: this.skyTime + (stars.length * 0.35 + 1.5),
    };

    this.emitCeremony({ type: 'fullmoon', label: '✨ Constellation revisitée · Risk register reviewed', icon: '✨' });
  }

  /** 🧭 ASTROLABE SPIN — l'astrolabe tourne rapidement (= analyse de risque en cours) */
  astrolabeSpin() {
    if (!this.astrolabe) return;
    // Boost de vitesse de rotation pendant 4s
    this.astrolabeSpinBoost = 4.0;
    this.emitCeremony({ type: 'fullmoon', label: '🧭 Astrolabe spinning · Analyse en cours', icon: '🧭' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🛠 TWEEN HELPER (interpolations exécutées dans animate())
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

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 2, 0.1);
    this.camera.lookAt(0, 30, 0);
    if (this.controls) this.controls.target.set(0, 25, 0);
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
    this.narrator.startTimeboxOnly(900, 'Risk review');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('star-map-risks', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);

    // Effets latéraux selon type
    const T = (window as any).THREE;
    if (!T) return;
    if (c.type === 'shower') {
      // Pluie d'étoiles filantes (4-6 streaks)
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.spawnShootingStar(T), i * 180);
      }
    } else if (c.type === 'fullmoon') {
      this.moonlightActive = true;
      setTimeout(() => { this.moonlightActive = false; }, 3000);
    }
  }

  private spawnShootingStar(T: any) {
    const sGeom = new T.SphereGeometry(0.18, 8, 6);
    const sMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const star = new T.Mesh(sGeom, sMat);
    const startTheta = Math.random() * Math.PI * 2;
    const startPhi = 0.2 + Math.random() * 0.3;
    const r = 40;
    star.position.set(
      r * Math.sin(startPhi) * Math.cos(startTheta),
      r * Math.cos(startPhi),
      r * Math.sin(startPhi) * Math.sin(startTheta),
    );
    const target = new T.Vector3(
      r * Math.sin(startPhi + 0.6) * Math.cos(startTheta + 0.4),
      r * Math.cos(startPhi + 0.6),
      r * Math.sin(startPhi + 0.6) * Math.sin(startTheta + 0.4),
    );
    star.userData = {
      kind: 'shootingStar',
      velocity: target.sub(star.position).divideScalar(1.5),
      life: 1.5,
    };
    this.shootingStars.push(star);
    this.scene.add(star);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic étoile → afficher risque
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
    const intersects = this.raycaster.intersectObjects(this.constellationStars, true);
    if (intersects.length > 0) {
      // Remonter jusqu'à trouver une étoile enregistrée
      let obj = intersects[0].object;
      while (obj && !this.riskByStar.has(obj)) {
        obj = obj.parent;
      }
      if (obj) {
        const risk = this.riskByStar.get(obj);
        if (risk) {
          this.selectedRisk.set(risk);
          // Petit flash de la star
          obj.scale.set(2.0, 2.0, 2.0);
          setTimeout(() => obj.scale.set(1, 1, 1), 240);
        }
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
    this.skyTime += dt;

    // ─── Étoiles de fond : twinkle global ───
    if (this.backgroundStars?.material) {
      this.backgroundStars.material.opacity = 0.65 + Math.sin(this.skyTime * 0.8) * 0.15;
      // Légère rotation de la voûte (très lente)
      this.backgroundStars.rotation.y += dt * 0.005;
    }

    // ─── Étoiles des constellations : twinkle individuel ───
    for (const star of this.constellationStars) {
      const ud = star.userData;
      const baseOp = ud.baseOpacity || 0.95;
      const phase = ud.twinklePhase || 0;
      const tw = Math.sin(this.skyTime * 2.5 + phase) * 0.25;
      if (star.material) {
        star.material.opacity = Math.max(0.3, Math.min(1.0, baseOp + tw));
      }
      // Pulse eclipse si actif
      if (ud.eclipsePulse > 0) {
        const pulse = 1 + Math.sin(this.skyTime * 8) * 0.4 * ud.eclipsePulse;
        star.scale.set(pulse, pulse, pulse);
        ud.eclipsePulse = Math.max(0, ud.eclipsePulse - dt * 0.4);
      }
    }

    // ─── Lunes orbitant les constellations ───
    for (const moon of this.moons) {
      const ud = moon.userData;
      const t = this.skyTime * ud.orbitSpeed + ud.orbitPhase;
      moon.position.set(
        Math.cos(t) * ud.orbitRadius,
        Math.sin(t * 1.3) * 0.5,
        Math.sin(t) * ud.orbitRadius,
      );
    }

    // ─── Trous noirs : rotation des anneaux + halo aspirant ───
    for (const bh of this.blackHoles) {
      const ud = bh.userData;
      if (ud.ring) ud.ring.rotation.z += dt * 1.2;
      if (ud.ring2) ud.ring2.rotation.z -= dt * 0.6;
      // Légère pulsation
      const p = 1 + Math.sin(this.skyTime * 1.5 + ud.spinPhase) * 0.06;
      bh.scale.set(p, p, p);
    }

    // ─── Comètes : traversent le ciel par rotation autour d'un axe ───
    const cometsAlive: any[] = [];
    for (const comet of this.comets) {
      const ud = comet.userData;
      ud.age += dt;
      // Rotation autour d'un axe via Quaternion
      const T = (window as any).THREE;
      const q = new T.Quaternion().setFromAxisAngle(ud.axis, ud.angularVel * dt);
      comet.position.applyQuaternion(q);
      // Orienter la queue vers l'origine (la comète "tombe" vers le centre)
      comet.lookAt(0, 0, 0);
      // Fade en fin de vie
      if (ud.age > ud.lifetime - 3) {
        const k = Math.max(0, (ud.lifetime - ud.age) / 3);
        comet.children.forEach((c: any) => {
          if (c.material) c.material.opacity = 0.9 * k;
        });
      }
      if (ud.age < ud.lifetime) {
        cometsAlive.push(comet);
      } else {
        this.scene.remove(comet);
      }
    }
    this.comets = cometsAlive;

    // ─── Étoiles filantes (pluie) ───
    const shootingAlive: any[] = [];
    for (const star of this.shootingStars) {
      const ud = star.userData;
      ud.life -= dt;
      star.position.add(ud.velocity.clone().multiplyScalar(dt));
      if (star.material) star.material.opacity = Math.max(0, ud.life / 1.5);
      if (ud.life > 0) shootingAlive.push(star);
      else this.scene.remove(star);
    }
    this.shootingStars = shootingAlive;

    // ─── Supernovae : expansion + fade des particules ───
    const supernovaeAlive: any[] = [];
    for (const sn of this.supernovaParticles) {
      sn.userData.life -= dt;
      sn.children.forEach((p: any) => {
        p.position.add(p.userData.velocity.clone().multiplyScalar(dt));
        p.userData.velocity.multiplyScalar(0.97);     // friction
        if (p.material) p.material.opacity = Math.max(0, sn.userData.life / 2.5);
      });
      if (sn.userData.life > 0) supernovaeAlive.push(sn);
      else this.scene.remove(sn);
    }
    this.supernovaParticles = supernovaeAlive;

    // ─── Astrolabe : rotation lente des anneaux ───
    if (this.astrolabe) {
      this.astrolabe.rotation.y += dt * 0.02;
      for (const ring of this.astrolabeRings) {
        ring.rotation.z += ring.userData.rotationSpeed;
      }
    }

    // ─── Crosshair : oscille légèrement ───
    if (this.crosshair) {
      const c = Math.sin(this.skyTime * 1.5) * 0.4;
      this.crosshair.position.x = c;
      this.crosshair.position.z = Math.cos(this.skyTime * 1.2) * 0.4;
      this.crosshair.material.opacity = 0.7 + Math.sin(this.skyTime * 4) * 0.25;
    }

    // ─── Eclipse : soleil dimme/corona ───
    if (this.eclipseTimer > 0) {
      this.eclipseTimer -= dt;
      if (this.sunCorona?.material) {
        // Pulsation de la corona
        const k = Math.max(0, this.eclipseTimer / 4.5);
        this.sunCorona.material.opacity = 0.85 * k;
        const scale = 1 + Math.sin(this.skyTime * 4) * 0.2 * k;
        this.sunCorona.scale.set(scale, scale, scale);
      }
    } else if (this.sunCorona?.material && this.sunCorona.material.opacity > 0) {
      this.sunCorona.material.opacity = Math.max(0, this.sunCorona.material.opacity - dt * 0.4);
    }

    // ─── Pleine lune : tint global ambient (très bref) ───
    if (this.moonlightActive && this.scene.fog) {
      // Léger virage bleuté du fog
      this.scene.fog.color.lerp(new (window as any).THREE.Color(0x2a3a6a), 0.05);
    } else if (this.scene?.fog) {
      this.scene.fog.color.lerp(new (window as any).THREE.Color(0x0a0518), 0.02);
    }

    // ─── CINEMATIC : Black holes en croissance (event horizon expand) ───
    if (this.growingBlackHoles.length > 0) {
      const stillGrowing: any[] = [];
      for (const bh of this.growingBlackHoles) {
        const ud = bh.userData;
        const elapsed = this.skyTime - ud.bornAt;
        const k = Math.min(1, elapsed / 2.5);   // 2.5s growth
        const easeK = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        // Grow sphere from 0.05 → 1.0
        if (ud.sphere) ud.sphere.scale.setScalar(0.05 + easeK * 20);
        // Grow + fade-in rings
        if (ud.ring) {
          ud.ring.scale.setScalar(0.15 + easeK * 10.5);
          ud.ring.material.opacity = 0.7 * easeK;
        }
        if (ud.ring2) {
          ud.ring2.scale.setScalar(0.2 + easeK * 10);
          ud.ring2.material.opacity = 0.5 * easeK;
        }
        if (k < 1) stillGrowing.push(bh);
      }
      this.growingBlackHoles = stillGrowing;
    }

    // ─── CINEMATIC : Eclipse rig (lune + ring of fire fade in/out) ───
    if (this.activeEclipseRig) {
      const rig = this.activeEclipseRig;
      const ud = rig.userData;
      const elapsed = this.skyTime - ud.bornAt;
      const k = Math.min(1, elapsed / ud.lifetime);
      // Fade in puis fade out
      const fade = k < 0.3 ? (k / 0.3) : (k > 0.7 ? (1 - (k - 0.7) / 0.3) : 1);
      if (ud.moonDisc?.material) ud.moonDisc.material.opacity = 0.95 * fade;
      if (ud.ringFire?.material) {
        ud.ringFire.material.opacity = 0.85 * fade;
        ud.ringFire.rotation.z += dt * 0.8;
      }
      if (k >= 1) {
        this.scene.remove(rig);
        this.activeEclipseRig = null;
      }
    }

    // ─── CINEMATIC : Constellation light chain (séquentiel) ───
    if (this.constellationLightChain) {
      const chain = this.constellationLightChain;
      if (this.skyTime >= chain.nextAt && chain.idx < chain.stars.length) {
        const star = chain.stars[chain.idx];
        star.userData.eclipsePulse = 1.6;   // gros pulse
        if (star.material) {
          // Boost emissive : scale temporaire
          star.scale.set(2.4, 2.4, 2.4);
          setTimeout(() => star.scale.set(1, 1, 1), 320);
        }
        chain.idx++;
        chain.nextAt = this.skyTime + 0.35;
      }
      if (this.skyTime > chain.until) {
        this.constellationLightChain = null;
      }
    }

    // ─── CINEMATIC : Astrolabe spin boost ───
    if (this.astrolabeSpinBoost > 0 && this.astrolabe) {
      this.astrolabe.rotation.y += dt * 2.5;   // x125 du speed normal
      for (const ring of this.astrolabeRings) {
        ring.rotation.z += ring.userData.rotationSpeed * 8;
      }
      this.astrolabeSpinBoost -= dt;
    }

    // ─── TWEENS actifs (comètes en arc, etc.) ───
    if (this.activeTweens.length > 0) {
      const now = performance.now();
      const done: number[] = [];
      for (let i = 0; i < this.activeTweens.length; i++) {
        const tw = this.activeTweens[i];
        const t = Math.min(1, (now - tw.startTime) / tw.duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        tw.obj.x = tw.from.x + (tw.to.x - tw.from.x) * e;
        tw.obj.z = tw.from.z + (tw.to.z - tw.from.z) * e;
        if (tw.to.peak !== undefined) {
          const ybase = tw.from.y + (tw.to.y - tw.from.y) * e;
          const arc = (tw.to.peak - Math.max(tw.from.y, tw.to.y)) * (4 * t * (1 - t));
          tw.obj.y = ybase + arc;
        } else {
          tw.obj.y = tw.from.y + (tw.to.y - tw.from.y) * e;
        }
        if (t >= 1) {
          done.push(i);
          if (tw.onDone) {
            try { tw.onDone(); } catch (err) { console.warn('[StarMap] tween onDone error', err); }
          }
        }
      }
      for (let i = done.length - 1; i >= 0; i--) this.activeTweens.splice(done[i], 1);
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.skyTime);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════
  private hash(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
  }

  severityColor(sev: number): string {
    const t = Math.max(0, Math.min(5, sev)) / 5;
    if (t < 0.4) return '#fef9c3';
    if (t < 0.7) return '#fbbf24';
    if (t < 0.9) return '#ef4444';
    return '#8b1a1a';
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
