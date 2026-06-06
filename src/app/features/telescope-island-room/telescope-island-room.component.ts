// ═══════════════════════════════════════════════════════════════════
// 🔭 TELESCOPE ISLAND ROOM — L'Observatoire des Phénomènes
//
// Mécanique data unique : une petite île ronde flottant au milieu d'un
// anneau océanique, surmontée d'un observatoire hexagonal et d'un
// télescope sur trépied. Le ciel nocturne au-dessus reflète l'état
// vivant du projet : comètes (deploys), éclipses (blockers), aurores
// (KR validés), pluies de météores (sprint planning), supernovas
// (releases majeures), nébuleuses (idéation), filantes (wins rapides),
// croissants de lune (mid-sprint), tempêtes solaires (incidents) et
// conjonctions (alignements stratégiques).
//
// Le mage stratège scrute le firmament : ce qu'il y lit est le pouls
// de son ouvrage. Le télescope pivote pour viser chaque phénomène.
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Phénomènes célestes (chacun = méthode publique invokable) :
//   ☄ triggerComet()           = deploy (v2.0.0 deployed)
//   🌑 triggerEclipse()         = critical blocker
//   🌌 triggerAurora()          = KR validé / OKR achieved
//   ⭐ triggerMeteorShower()    = sprint planning
//   💥 triggerSupernova()       = release majeure
//   🌫 triggerNebula()          = brainstorm / idéation
//   🌠 triggerShootingStar()    = quick win
//   🌙 setCrescentMoon()        = mid-sprint
//   ⚡ triggerSolarStorm()      = incident / outage
//   🪐 triggerConjunction()     = alignement stratégique
//   ✨ clearSky()               = cleanup
//   🎬 loadDemo()               = cycle de démarrage
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { createPortal3D, getIslandForRoom, PortalHandle } from '../../core/portal/portal.factory';
import { CeremonyBusService, GlobalCeremony, SkyPhenomenon } from '../../core/ceremony-bus/ceremony-bus.service';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent, SpellFooterService } from '../../core/spell-ui';

interface ActivePhenomenon {
  type: string;
  objects: any[];                   // meshes/points/lights à cleanup
  startTime: number;
  duration: number;                 // ms
  update?: (t: number, dt: number) => void;
  onDone?: () => void;
}

@Component({
  selector: 'wt-telescope-island-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ti-host">
      <header class="ti-topbar">
        <div class="ti-title">
          <h1>🔭 TELESCOPE ISLAND</h1>
          <p>L&apos;Observatoire des Phénomènes — état actuel: {{ currentSkyState() }}</p>
        </div>
        <div class="ti-legend">
          <span class="dot comet"></span>comet
          <span class="dot eclipse"></span>eclipse
          <span class="dot aurora"></span>aurora
          <span class="dot supernova"></span>supernova
          <span class="dot nebula"></span>nebula
        </div>
      </header>

      <canvas #canvas class="ti-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="ti-flash" [attr.data-type]="f.type">
        <div class="ti-flash-content">
          <div class="ti-flash-icon">{{ f.icon }}</div>
          <div class="ti-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- 🎬 Welcome splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Telescope Island"
        loreName="L'Observatoire des Phénomènes"
        color="#c4b5fd"
        oneLiner="Ciel dynamique reflétant TOUS les événements projet — comète, éclipse, aurora."
        [duration]="80"
        [timeboxDurationS]="600"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Telescope Island"
        loreName="L'Observatoire des Phénomènes"
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
    .ti-host { position: relative; width: 100%; height: 100vh; background: #05030f; color: #e9d5ff; font-family: "Tinos", serif; }

    .ti-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .ti-topbar > * { pointer-events: auto; }
    .ti-back { color: #c4b5fd; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #7c3aed; border-radius: 8px; background: rgba(30,15,60,0.5); }
    .ti-back:hover { background: rgba(124,58,237,0.45); }
    .ti-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1.5px; color: #c4b5fd; text-shadow: 0 0 12px rgba(196,181,253,0.55); }
    .ti-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .ti-legend { display: flex; gap: 10px; font-size: 11px; align-items: center; flex-wrap: wrap; }
    .ti-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .ti-legend .comet     { background: #bae6fd; box-shadow: 0 0 8px #bae6fd; }
    .ti-legend .eclipse   { background: #1f1f2e; box-shadow: 0 0 6px #fde047; }
    .ti-legend .aurora    { background: #a7f3d0; box-shadow: 0 0 8px #a7f3d0; }
    .ti-legend .supernova { background: #ffffff; box-shadow: 0 0 10px #fff; }
    .ti-legend .nebula    { background: #f0abfc; box-shadow: 0 0 8px #f0abfc; }

    .ti-canvas { display: block; width: 100%; height: 100%; }
    .ti-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); flex-wrap: wrap; }
    .ti-controls button { background: rgba(30,15,60,0.7); color: #e9d5ff; border: 1px solid #7c3aed; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .ti-controls button:hover { background: rgba(124,58,237,0.55); box-shadow: 0 0 10px rgba(196,181,253,0.35); }
    .ti-controls .ti-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .ti-controls .ti-narrator:hover { background: rgba(251,191,36,0.3); }
    .ti-controls .ti-narrator.ti-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .ti-controls .ti-narrator.ti-play:hover { background: #f5b923; }
    .ti-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .ti-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: ti-flash-pulse 1.6s ease-out forwards; }
    .ti-flash[data-type="comet"]         { background: radial-gradient(circle at center, rgba(186,230,253,0.6), transparent 65%); }
    .ti-flash[data-type="eclipse"]       { background: radial-gradient(circle at center, rgba(253,224,71,0.55), transparent 60%); }
    .ti-flash[data-type="aurora"]        { background: radial-gradient(circle at center, rgba(167,243,208,0.55), transparent 65%); }
    .ti-flash[data-type="meteor"]        { background: radial-gradient(circle at center, rgba(250,204,21,0.55), transparent 65%); }
    .ti-flash[data-type="supernova"]     { background: radial-gradient(circle at center, rgba(255,255,255,0.85), transparent 70%); }
    .ti-flash[data-type="nebula"]        { background: radial-gradient(circle at center, rgba(240,171,252,0.55), transparent 65%); }
    .ti-flash[data-type="shooting-star"] { background: radial-gradient(circle at center, rgba(186,230,253,0.5), transparent 65%); }
    .ti-flash[data-type="crescent"]      { background: radial-gradient(circle at center, rgba(196,181,253,0.5), transparent 65%); }
    .ti-flash[data-type="solar-storm"]   { background: radial-gradient(circle at center, rgba(220,38,38,0.6), transparent 60%); }
    .ti-flash[data-type="conjunction"]   { background: radial-gradient(circle at center, rgba(251,191,36,0.55), transparent 65%); }
    .ti-flash-content { text-align: center; animation: ti-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .ti-flash-icon  { font-size: 104px; line-height: 1; filter: drop-shadow(0 0 28px rgba(196,181,253,0.85)); }
    .ti-flash-label { font-size: 22px; margin-top: 10px; color: #fff; font-weight: 700; letter-spacing: 1.2px; text-shadow: 0 0 12px rgba(0,0,0,0.55); }
    @keyframes ti-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes ti-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
  `]
})
export class TelescopeIslandRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);
  private ceremonyBusUnsub: (() => void) | null = null;

  // ─── State signals ───
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  currentSkyState = signal<string>('🌌 Ciel calme · Aucun phénomène');
  /** Dernière cérémonie remote reçue (depuis une autre room) */
  lastRemoteSource = signal<string>('');
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🔭', title: 'Observatoire global du Royaume', body: 'Le télescope au centre observe TOUS les événements qui se déroulent dans l\'ensemble du Yamzy World. C\'est votre tour de garde.' },
    { icon: '☄', title: 'Comète = release importante', body: 'Quand une release majeure est taguée, une comète traverse le ciel avec une longue traînée dorée. Tout le monde la voit.' },
    { icon: '🌑', title: 'Éclipse = incident en cours', body: 'Un incident production déclenche une éclipse partielle. La lumière baisse, les étoiles se voilent. À résoudre vite.' },
    { icon: '🌌', title: 'Aurora = sprint terminé brillamment', body: 'Quand un sprint s\'achève avec tous ses objectifs atteints, une aurora boréale colore le ciel. Cérémonie collective.' },
    { icon: '✨', title: 'Vitesse au filage = cadence équipe', body: 'Plus les étoiles filantes sont nombreuses, plus la cadence de delivery est soutenue. Un ciel calme révèle un ralentissement.' },
  ];
  tutorialVoiceLines: string[] = [
    'Le télescope observe l\'ensemble du Royaume.',
    'Une comète signale une release majeure.',
    'L\'éclipse révèle un incident en cours.',
    'L\'aurora célèbre un sprint réussi.',
    'Le filage des étoiles mesure la cadence.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  // ─── Three.js core ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private rafId: number = 0;
  private disposed = false;
  private ceremonyFlashTimer: any = null;

  // ─── Refs 3D ───
  private island: any;
  private observatory: any;
  private skyDome: any;
  private telescopeGroup: any;
  private telescopeTube: any;
  private starsField: any;
  private torchLights: any[] = [];
  private torchFlames: any[] = [];

  // Cible d'orientation du télescope (interpolée chaque frame)
  private telescopeTargetYaw: number = 0;
  private telescopeTargetPitch: number = 0.6;

  // Phénomènes actifs
  private activePhenomena: ActivePhenomenon[] = [];

  // ─── Animation state ───
  private windTime = 0;
  private elapsed = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
    // 🌌 S'abonner au bus global — le ciel devient le radar universel
    this.ceremonyBusUnsub = this.ceremonyBus.subscribe(c => this.handleRemoteCeremony(c));
    this.spellFooter.setSlots({
      accent: '#f59e0b',
      hint: 'Mouse drag = orbit · molette = zoom · clic télescope = viser le ciel',
      controls: [
        { icon: '🎬', label: 'Demo', action: () => this.loadDemo() },
        { icon: '☄', label: 'Comet', action: () => this.triggerComet() },
        { icon: '🌑', label: 'Eclipse', action: () => this.triggerEclipse() },
        { icon: '🌌', label: 'Aurora', action: () => this.triggerAurora() },
        { icon: '⭐', label: 'Meteor', action: () => this.triggerMeteorShower() },
        { icon: '💥', label: 'Supernova', action: () => this.triggerSupernova() },
        { icon: '🌫', label: 'Nebula', action: () => this.triggerNebula() },
        { icon: '✨', label: 'Reset sky', action: () => this.clearSky() },
        { icon: '🎓', label: 'How it works', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée par Yamzy' },
        { icon: '▶', label: 'Play example', variant: 'primary', action: () => this.narrator.startPlayExample(), title: 'Démo animée' },
      ],
    });
  }

  ngOnDestroy() {
    this.disposed = true;
    this.ceremonyBusUnsub?.();
    this.ceremonyBusUnsub = null;
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

    // ─── Scène : nuit profonde + brume mauve ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x05030f);
    this.scene.fog = new T.FogExp2(0x0a0518, 0.012);

    // ─── Caméra : vue de l'île depuis le sud-est ───
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 250);
    this.camera.position.set(18, 12, 18);
    this.camera.lookAt(0, 3, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lights ───
    this.scene.add(new T.AmbientLight(0x4030a0, 0.35));
    const moonLight = new T.DirectionalLight(0xc4b5fd, 0.55);
    moonLight.position.set(-12, 18, 6);
    this.scene.add(moonLight);
    const skyHemi = new T.HemisphereLight(0x6d28d9, 0x0a0518, 0.4);
    this.scene.add(skyHemi);

    // ─── Build scene elements ───
    this.buildSkyDome(T);
    this.buildIsland(T);
    this.buildOceanRing(T);
    this.buildObservatory(T);
    this.buildTelescope(T);
    this.buildTorches(T);
    this.buildStarsField(T, 600);

    // ─── OrbitControls ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 3, 0);
      this.controls.maxDistance = 80;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI / 2.05;
    }

    // ─── Raycaster (clic télescope / île) ───
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Stratégie)
    const island = getIslandForRoom('/telescope-island');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-12, 4, -12],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[TelescopeIsland] 🔭 Scene ready · sky dome, island, observatory, telescope, stars');

    // 🪶 Attach Narrator Yamzy → permet 🎓 tour / ▶ play example
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'telescope-island',
    });

    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sky dome (sphère renversée backside)
  // ═══════════════════════════════════════════════════════════════════
  private buildSkyDome(T: any) {
    const geom = new T.SphereGeometry(90, 32, 24);
    // Vertex colors pour léger gradient (sommet plus profond, horizon plus mauve)
    const colors = new Float32Array(geom.attributes.position.count * 3);
    const top = new T.Color(0x05020e);
    const horizon = new T.Color(0x1a0a3a);
    for (let i = 0; i < geom.attributes.position.count; i++) {
      const y = geom.attributes.position.getY(i);
      const t = Math.max(0, Math.min(1, (y + 90) / 180));
      const c = horizon.clone().lerp(top, t);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.MeshBasicMaterial({
      color: 0x0a0518,
      vertexColors: true,
      side: T.BackSide,
      fog: false,
    });
    this.skyDome = new T.Mesh(geom, mat);
    this.skyDome.userData.tutorialId = 'sky-dome';
    this.scene.add(this.skyDome);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : île ronde au centre
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any) {
    const geom = new T.CylinderGeometry(8, 8, 1, 36);
    const mat = new T.MeshStandardMaterial({
      color: 0x4a5d4a,
      roughness: 0.85,
      emissive: 0x0f1f0f,
      emissiveIntensity: 0.18,
    });
    this.island = new T.Mesh(geom, mat);
    this.island.position.y = 0.5;
    this.island.userData.tutorialId = 'island';
    this.scene.add(this.island);

    // Petites touffes d'herbe (icosphères vertes) en bordure
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const r = 6.2 + Math.random() * 1.4;
      const tuftGeom = new T.IcosahedronGeometry(0.18 + Math.random() * 0.12, 0);
      const tuftMat = new T.MeshStandardMaterial({
        color: 0x65a065,
        roughness: 0.8,
        emissive: 0x103010,
        emissiveIntensity: 0.2,
      });
      const tuft = new T.Mesh(tuftGeom, tuftMat);
      tuft.position.set(Math.cos(a) * r, 1.05, Math.sin(a) * r);
      this.scene.add(tuft);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : anneau océan autour de l'île
  // ═══════════════════════════════════════════════════════════════════
  private buildOceanRing(T: any) {
    // Disque ext rayon 60, intérieur 8 -> approximation via grand cylindre opaque + un trou central
    // Simple : un grand cylindre + l'île par-dessus masque le centre.
    const geom = new T.CylinderGeometry(60, 60, 0.5, 64);
    const mat = new T.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.35,
      metalness: 0.45,
      transparent: true,
      opacity: 0.82,
      emissive: 0x0a1e4a,
      emissiveIntensity: 0.15,
    });
    const ocean = new T.Mesh(geom, mat);
    ocean.position.y = 0.0;
    ocean.userData.kind = 'ocean';
    this.scene.add(ocean);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : observatoire hexagonal + dôme
  // ═══════════════════════════════════════════════════════════════════
  private buildObservatory(T: any) {
    const group = new T.Group();
    group.position.set(-2.4, 1.0, -1.6);

    // Base hexagonale
    const baseGeom = new T.CylinderGeometry(2.5, 2.5, 2.2, 6);
    const baseMat = new T.MeshStandardMaterial({
      color: 0x4a3520,
      roughness: 0.9,
      emissive: 0x180a04,
      emissiveIntensity: 0.15,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 1.1;
    group.add(base);

    // Dôme (hémisphère ouvert au sommet pour le télescope)
    // SphereGeometry(rayon, widthSeg, heightSeg, phiStart, phiLen, thetaStart, thetaLen)
    // thetaLen partial -> ouvert au sommet
    const domeGeom = new T.SphereGeometry(2.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    domeGeom.scale(1, 0.6, 1);
    const domeMat = new T.MeshStandardMaterial({
      color: 0xc4b5fd,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x4a3a85,
      emissiveIntensity: 0.25,
      side: T.DoubleSide,
    });
    const dome = new T.Mesh(domeGeom, domeMat);
    dome.position.y = 2.2;
    group.add(dome);

    // Petite porte au bas
    const doorGeom = new T.BoxGeometry(0.7, 1.0, 0.1);
    const doorMat = new T.MeshStandardMaterial({
      color: 0x2a1f15,
      roughness: 0.95,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.35,
    });
    const door = new T.Mesh(doorGeom, doorMat);
    door.position.set(0, 0.6, 2.45);
    group.add(door);

    this.observatory = group;
    group.userData.tutorialId = 'observatory';
    this.scene.add(group);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : télescope sur trépied à côté de l'observatoire
  // ═══════════════════════════════════════════════════════════════════
  private buildTelescope(T: any) {
    // Trépied : 3 cylindres inclinés
    const tripodGroup = new T.Group();
    for (let i = 0; i < 3; i++) {
      const legGeom = new T.CylinderGeometry(0.05, 0.05, 2.5, 8);
      const legMat = new T.MeshStandardMaterial({ color: 0x52525b, roughness: 0.7, metalness: 0.45 });
      const leg = new T.Mesh(legGeom, legMat);
      const angle = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(angle) * 0.4, 1.0, Math.sin(angle) * 0.4);
      // Incliner chaque pied vers le centre
      leg.rotation.z = Math.cos(angle) * 0.22;
      leg.rotation.x = -Math.sin(angle) * 0.22;
      tripodGroup.add(leg);
    }

    // Mount : sphère au sommet du trépied
    const mountGeom = new T.SphereGeometry(0.4, 16, 12);
    const mountMat = new T.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.65 });
    const mount = new T.Mesh(mountGeom, mountMat);
    mount.position.y = 2.3;
    tripodGroup.add(mount);

    // Groupe pivotable (tube + eyepiece + counterweight) — fixe au mount
    const pivot = new T.Group();
    pivot.position.y = 2.3;

    // Tube principal
    const tubeGeom = new T.CylinderGeometry(0.18, 0.18, 2.4, 16);
    const tubeMat = new T.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.35,
      metalness: 0.7,
      emissive: 0x1a1235,
      emissiveIntensity: 0.18,
    });
    const tube = new T.Mesh(tubeGeom, tubeMat);
    tube.rotation.z = Math.PI / 2;     // horizontal
    tube.position.set(0.6, 0, 0);
    pivot.add(tube);
    this.telescopeTube = tube;

    // Eyepiece — petit cylindre au bout proche du mount
    const eyeGeom = new T.CylinderGeometry(0.08, 0.08, 0.3, 12);
    const eyeMat = new T.MeshStandardMaterial({ color: 0x52525b, roughness: 0.5, metalness: 0.6 });
    const eyepiece = new T.Mesh(eyeGeom, eyeMat);
    eyepiece.rotation.z = Math.PI / 2;
    eyepiece.position.set(-0.7, 0, 0);
    pivot.add(eyepiece);

    // Lentille à l'autre extrémité (anneau brillant)
    const lensGeom = new T.RingGeometry(0.1, 0.18, 16);
    const lensMat = new T.MeshStandardMaterial({
      color: 0xc4b5fd,
      emissive: 0xc4b5fd,
      emissiveIntensity: 1.0,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const lens = new T.Mesh(lensGeom, lensMat);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(1.85, 0, 0);
    pivot.add(lens);

    // Counterweight — petite sphère métallique pour balance
    const cwGeom = new T.SphereGeometry(0.18, 12, 10);
    const cwMat = new T.MeshStandardMaterial({ color: 0x71717a, roughness: 0.4, metalness: 0.85 });
    const counterweight = new T.Mesh(cwGeom, cwMat);
    counterweight.position.set(-0.95, -0.2, 0);
    pivot.add(counterweight);
    const cwArmGeom = new T.CylinderGeometry(0.03, 0.03, 0.5, 8);
    const cwArm = new T.Mesh(cwArmGeom, cwMat);
    cwArm.position.set(-0.85, -0.05, 0);
    cwArm.rotation.z = Math.PI / 2.5;
    pivot.add(cwArm);

    // Inclinaison initiale vers le ciel
    pivot.rotation.x = -this.telescopeTargetPitch;
    pivot.rotation.y = this.telescopeTargetYaw;

    tripodGroup.add(pivot);
    tripodGroup.position.set(2.4, 0.5, 0.6);
    tripodGroup.userData.tutorialId = 'telescope';
    this.telescopeGroup = pivot;       // → c'est le pivot qu'on tourne pour viser
    this.scene.add(tripodGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 4 torches autour de l'île (point lights flickering)
  // ═══════════════════════════════════════════════════════════════════
  private buildTorches(T: any) {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(angle) * 6.0;
      const z = Math.sin(angle) * 6.0;

      // Poteau
      const poleGeom = new T.CylinderGeometry(0.08, 0.1, 1.2, 6);
      const poleMat = new T.MeshStandardMaterial({ color: 0x3f2a14, roughness: 0.95 });
      const pole = new T.Mesh(poleGeom, poleMat);
      pole.position.set(x, 1.6, z);
      this.scene.add(pole);

      // Flamme (cone orange émissif)
      const flameGeom = new T.ConeGeometry(0.18, 0.45, 8);
      const flameMat = new T.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xf97316,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.9,
      });
      const flame = new T.Mesh(flameGeom, flameMat);
      flame.position.set(x, 2.4, z);
      this.scene.add(flame);
      this.torchFlames.push(flame);

      // Lumière ponctuelle flicker
      const light = new T.PointLight(0xff8a4c, 0.85, 7, 1.8);
      light.position.set(x, 2.5, z);
      light.userData.basePos = light.position.clone();
      light.userData.phase = Math.random() * Math.PI * 2;
      this.scene.add(light);
      this.torchLights.push(light);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : starfield baseline (600 étoiles)
  // ═══════════════════════════════════════════════════════════════════
  private buildStarsField(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribution sphérique sur la moitié supérieure (above horizon)
      const phi = Math.acos(Math.random() * 0.95);            // 0 → ~PI/2
      const theta = Math.random() * Math.PI * 2;
      const r = 70 + Math.random() * 12;
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 8;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      // Couleur légèrement variable (blanc → bleu pâle → ambre pâle)
      const tint = Math.random();
      if (tint < 0.6) {
        colors[i * 3 + 0] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      } else if (tint < 0.85) {
        colors[i * 3 + 0] = 0.75;
        colors[i * 3 + 1] = 0.85;
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3 + 0] = 1.0;
        colors[i * 3 + 1] = 0.92;
        colors[i * 3 + 2] = 0.7;
      }
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: T.AdditiveBlending,
      vertexColors: true,
      fog: false,
    });
    this.starsField = new T.Points(geom, mat);
    this.starsField.userData.tutorialId = 'star';
    this.scene.add(this.starsField);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic télescope ou île
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
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && obj.parent) {
        if (obj.userData?.tutorialId === 'telescope') {
          // Petit hop visuel : viser un point aléatoire
          this.telescopeTargetYaw = (Math.random() - 0.5) * Math.PI;
          this.telescopeTargetPitch = 0.3 + Math.random() * 0.7;
          return;
        }
        obj = obj.parent;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES — helper
  // ═══════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  // 🌌 CEREMONY BUS — Le ciel réagit aux événements de TOUTES les rooms
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Reçoit une cérémonie publiée par n'importe quelle room du Royaume.
   * Mappe le type sémantique vers un phénomène céleste et le déclenche.
   * Affiche aussi un mini badge "Source: {sourceRoom}" en topbar.
   */
  private handleRemoteCeremony(c: GlobalCeremony): void {
    if (this.disposed) return;
    // 🛡 Anti-loop : ignore les cérémonies que NOUS avons publiées (sinon trigger→emit→publish→handle→trigger…)
    if (c.sourceRoom === 'telescope-island') return;
    const sky = c.preferredSkyPhenomenon ?? this.ceremonyBus.mapToSkyPhenomenon(c.type);
    // Update topbar : indique la source de la cérémonie
    const sourceLabel = c.sourceRoom ? `📡 ${c.label} (depuis ${c.sourceRoom})` : c.label;
    this.lastRemoteSource.set(sourceLabel);
    // Déclenche le phénomène céleste correspondant
    switch (sky) {
      case 'comet':          this.triggerComet(); break;
      case 'eclipse':        this.triggerEclipse(); break;
      case 'aurora':         this.triggerAurora(); break;
      case 'meteor-shower':  this.triggerMeteorShower(); break;
      case 'supernova':      this.triggerSupernova(); break;
      case 'nebula':         this.triggerNebula(); break;
      case 'shooting-star':  this.triggerShootingStar(); break;
      case 'crescent-moon':  this.setCrescentMoon(); break;
      case 'solar-storm':    this.triggerSolarStorm(); break;
      case 'conjunction':    this.triggerConjunction(); break;
      default:               this.triggerShootingStar(); break;
    }
    // Après que triggerXxx ait set currentSkyState, on l'enrichit avec la source remote
    setTimeout(() => {
      const current = this.currentSkyState();
      this.currentSkyState.set(`${c.icon} ${current} · 📡 ${c.sourceRoom}`);
    }, 50);
    console.log(`[TelescopeIsland] 🌌 Remote ceremony [${c.type}] from ${c.sourceRoom} → sky=${sky}`);
  }

  /**
   * SIMULATION publique : invoquée depuis le tutorial JSON pour tester
   * la réactivité du ciel à des cérémonies fictives venant d'autres rooms.
   * Args : { type, sourceRoom, label, icon, preferredSkyPhenomenon? }
   */
  public simulateRemoteCeremony(args: {
    type: string; sourceRoom: string; label: string; icon: string;
    preferredSkyPhenomenon?: SkyPhenomenon;
  }): void {
    this.ceremonyBus.publish({
      type: args.type,
      sourceRoom: args.sourceRoom,
      label: args.label,
      icon: args.icon,
      preferredSkyPhenomenon: args.preferredSkyPhenomenon,
    });
  }

  private emitCeremony(c: { type: string; label: string; icon: string }) {
    // 🌌 Publication sur le bus global — autres rooms peuvent réagir
    // (guard handleRemoteCeremony évite le loop : il skip sourceRoom='telescope-island')
    this.ceremonyBus.publishFromRoom('telescope-island', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  /** Méthode publique pour le narrator (emit ceremony from JSON tutorial) */
  public emitCeremonyPublic(c: { type: string; label: string; icon: string }) {
    this.emitCeremony(c);
  }

  private addPhenomenon(p: ActivePhenomenon) {
    this.activePhenomena.push(p);
  }

  private aimTelescopeAt(x: number, y: number, z: number) {
    // Calcule yaw (rotation Y) et pitch (rotation X) du télescope pour
    // pointer la cible. Le pivot est en (~2.4, 2.8, 0.6).
    const dx = x - 2.4;
    const dy = y - 2.8;
    const dz = z - 0.6;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    this.telescopeTargetYaw = Math.atan2(dx, dz) - Math.PI / 2;
    this.telescopeTargetPitch = Math.atan2(dy, horizDist);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 1. ☄ COMET — traverse le ciel de gauche à droite
  // ═══════════════════════════════════════════════════════════════════
  triggerComet() {
    const T = (window as any).THREE;
    const group = new T.Group();
    // Tête (sphère brillante)
    const headGeom = new T.SphereGeometry(0.4, 16, 12);
    const headMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xbae6fd,
      emissiveIntensity: 2.0,
    });
    const head = new T.Mesh(headGeom, headMat);
    group.add(head);

    // Trail : Points étirés derrière la tête
    const tailCount = 50;
    const tailPositions = new Float32Array(tailCount * 3);
    const tailColors = new Float32Array(tailCount * 3);
    for (let i = 0; i < tailCount; i++) {
      const t = i / tailCount;
      tailPositions[i * 3 + 0] = -t * 5.5;
      tailPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.5 * t;
      tailPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5 * t;
      // dégradé bleu pâle → blanc
      tailColors[i * 3 + 0] = 0.6 + (1 - t) * 0.4;
      tailColors[i * 3 + 1] = 0.85 + (1 - t) * 0.15;
      tailColors[i * 3 + 2] = 1.0;
    }
    const tailGeom = new T.BufferGeometry();
    tailGeom.setAttribute('position', new T.BufferAttribute(tailPositions, 3));
    tailGeom.setAttribute('color', new T.BufferAttribute(tailColors, 3));
    const tailMat = new T.PointsMaterial({
      size: 0.32,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      blending: T.AdditiveBlending,
      vertexColors: true,
      fog: false,
    });
    const tail = new T.Points(tailGeom, tailMat);
    group.add(tail);

    // Position initiale : haut gauche du ciel
    const startX = -50;
    const startY = 38;
    const startZ = -20;
    const endX = 50;
    const endY = 32;
    const endZ = 10;
    group.position.set(startX, startY, startZ);
    this.scene.add(group);

    // Vise avec le télescope
    this.aimTelescopeAt(0, 36, -5);

    this.addPhenomenon({
      type: 'comet',
      objects: [group],
      startTime: performance.now(),
      duration: 5500,
      update: (t: number) => {
        // t va de 0 à 1
        const arcY = Math.sin(t * Math.PI) * 6;  // arc en haut
        group.position.x = startX + (endX - startX) * t;
        group.position.y = startY + (endY - startY) * t + arcY;
        group.position.z = startZ + (endZ - startZ) * t;
        // Vise dynamiquement
        this.aimTelescopeAt(group.position.x, group.position.y, group.position.z);
      },
    });
    this.emitCeremony({ type: 'comet', label: '☄ Comète · Deploy détecté', icon: '☄' });
    this.currentSkyState.set('☄ Comet · v2.0.0 deployed');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. 🌑 ECLIPSE — soleil + lune qui s'aligne, ring of fire
  // ═══════════════════════════════════════════════════════════════════
  triggerEclipse() {
    const T = (window as any).THREE;
    const group = new T.Group();
    const skyX = -8;
    const skyY = 32;
    const skyZ = -28;
    group.position.set(skyX, skyY, skyZ);

    // Sun (sphère dorée émissive)
    const sunGeom = new T.SphereGeometry(1.2, 24, 18);
    const sunMat = new T.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfacc15,
      emissiveIntensity: 2.2,
    });
    const sun = new T.Mesh(sunGeom, sunMat);
    group.add(sun);

    // Moon (sphère noire, démarre décalée)
    const moonGeom = new T.SphereGeometry(1.2, 24, 18);
    const moonMat = new T.MeshStandardMaterial({
      color: 0x05030f,
      emissive: 0x000000,
      roughness: 1.0,
    });
    const moon = new T.Mesh(moonGeom, moonMat);
    moon.position.set(-4, 0, 0.5);
    group.add(moon);

    // Ring of fire (RingGeometry derrière)
    const ringGeom = new T.RingGeometry(1.25, 1.65, 32);
    const ringMat = new T.MeshBasicMaterial({
      color: 0xff7a18,
      transparent: true,
      opacity: 0.0,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      fog: false,
    });
    const ring = new T.Mesh(ringGeom, ringMat);
    ring.position.copy(sun.position);
    ring.position.z -= 0.1;
    ring.lookAt(this.camera.position.clone());
    group.add(ring);

    this.scene.add(group);
    this.aimTelescopeAt(skyX, skyY, skyZ);

    this.addPhenomenon({
      type: 'eclipse',
      objects: [group],
      startTime: performance.now(),
      duration: 7000,
      update: (t: number) => {
        // Phase 1 (0→0.4) : la lune avance vers le soleil
        // Phase 2 (0.4→0.6) : alignée → ring brille
        // Phase 3 (0.6→1) : la lune repart
        let moonX: number;
        if (t < 0.4) {
          moonX = -4 + (4) * (t / 0.4);
        } else if (t < 0.6) {
          moonX = 0;
        } else {
          moonX = (t - 0.6) / 0.4 * 4;
        }
        moon.position.x = moonX;
        const aligned = Math.max(0, 1 - Math.abs(moonX) / 1.2);
        ring.material.opacity = aligned * 0.85;
        sun.material.emissiveIntensity = 2.2 - aligned * 1.5;
        ring.scale.setScalar(1 + aligned * 0.2);
      },
    });
    this.emitCeremony({ type: 'eclipse', label: '🌑 Éclipse · Blocker critique', icon: '🌑' });
    this.currentSkyState.set('🌑 Eclipse · Critical blocker');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. 🌌 AURORA — bandes incurvées vert→violet au-dessus de l'horizon
  // ═══════════════════════════════════════════════════════════════════
  triggerAurora() {
    const T = (window as any).THREE;
    const group = new T.Group();
    const bands: any[] = [];
    for (let i = 0; i < 4; i++) {
      const geom = new T.PlaneGeometry(48, 7, 32, 4);
      // Vertex colors gradient vertical vert → violet
      const colors = new Float32Array(geom.attributes.position.count * 3);
      for (let v = 0; v < geom.attributes.position.count; v++) {
        const y = geom.attributes.position.getY(v);
        const ratio = (y + 3.5) / 7;
        colors[v * 3 + 0] = 0.3 + ratio * 0.6;
        colors[v * 3 + 1] = 0.95 - ratio * 0.5;
        colors[v * 3 + 2] = 0.5 + ratio * 0.45;
      }
      geom.setAttribute('color', new T.BufferAttribute(colors, 3));
      const mat = new T.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.0,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        fog: false,
      });
      const band = new T.Mesh(geom, mat);
      band.position.set(0, 20 + i * 4, -34 - i * 2);
      band.rotation.x = -0.25;
      band.userData.phase = Math.random() * Math.PI * 2;
      band.userData.basePositions = new Float32Array(geom.attributes.position.array);
      group.add(band);
      bands.push(band);
    }
    this.scene.add(group);
    this.aimTelescopeAt(0, 24, -34);

    this.addPhenomenon({
      type: 'aurora',
      objects: [group],
      startTime: performance.now(),
      duration: 8000,
      update: (t: number) => {
        const fade = t < 0.15 ? t / 0.15 : (t > 0.85 ? (1 - t) / 0.15 : 1);
        for (let bi = 0; bi < bands.length; bi++) {
          const band = bands[bi];
          band.material.opacity = 0.55 * fade;
          // Oscillation vertices Y
          const pos = band.geometry.attributes.position;
          const base = band.userData.basePositions;
          const phase = band.userData.phase + this.windTime;
          for (let v = 0; v < pos.count; v++) {
            const x = base[v * 3 + 0];
            pos.array[v * 3 + 1] = base[v * 3 + 1] + Math.sin(phase + x * 0.2) * 0.8;
          }
          pos.needsUpdate = true;
          band.scale.y = 1 + Math.sin(this.windTime * 1.3 + bi) * 0.15;
        }
      },
    });
    this.emitCeremony({ type: 'aurora', label: '🌌 Aurore · KR validé', icon: '🌌' });
    this.currentSkyState.set('🌌 Aurora · KR achieved');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. ⭐ METEOR SHOWER — 12 streaks tombant en cascade
  // ═══════════════════════════════════════════════════════════════════
  triggerMeteorShower() {
    const T = (window as any).THREE;
    const group = new T.Group();
    const streaks: any[] = [];
    for (let i = 0; i < 12; i++) {
      const points = [];
      points.push(new T.Vector3(0, 0, 0));
      points.push(new T.Vector3(-1.8, -2.4, -0.5));
      const geom = new T.BufferGeometry().setFromPoints(points);
      const mat = new T.LineBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.95,
        blending: T.AdditiveBlending,
        fog: false,
      });
      const streak = new T.Line(geom, mat);
      const startX = -30 + Math.random() * 60;
      const startY = 40 + Math.random() * 10;
      const startZ = -25 + Math.random() * 30;
      streak.position.set(startX, startY, startZ);
      streak.userData.startY = startY;
      streak.userData.delay = i * 0.42 + Math.random() * 0.3;
      streak.userData.speed = 18 + Math.random() * 8;
      streak.visible = false;
      group.add(streak);
      streaks.push(streak);
    }
    this.scene.add(group);
    this.aimTelescopeAt(0, 38, -8);

    this.addPhenomenon({
      type: 'meteor',
      objects: [group],
      startTime: performance.now(),
      duration: 6500,
      update: (_: number, dt: number) => {
        const elapsed = (performance.now() - this.activePhenomena.find(p => p.type === 'meteor')!.startTime) / 1000;
        for (const s of streaks) {
          if (elapsed < s.userData.delay) continue;
          if (!s.visible) {
            s.visible = true;
          }
          s.position.y -= s.userData.speed * dt;
          s.position.x += s.userData.speed * 0.35 * dt;
          // Fade après une chute de ~10 unités
          const fallen = s.userData.startY - s.position.y;
          s.material.opacity = Math.max(0, 0.95 - fallen / 12);
        }
      },
    });
    this.emitCeremony({ type: 'meteor', label: '⭐ Pluie de météores · Sprint Planning', icon: '⭐' });
    this.currentSkyState.set('⭐ Meteor shower · Sprint Planning');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. 💥 SUPERNOVA — sphère blanche qui pulse + rayons cylindres
  // ═══════════════════════════════════════════════════════════════════
  triggerSupernova() {
    const T = (window as any).THREE;
    const group = new T.Group();
    const skyX = 14;
    const skyY = 30;
    const skyZ = -22;
    group.position.set(skyX, skyY, skyZ);

    // Core sphere
    const coreGeom = new T.SphereGeometry(1, 24, 18);
    const coreMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 8.0,
    });
    const core = new T.Mesh(coreGeom, coreMat);
    group.add(core);

    // 5 rayons (cylindres fins)
    const rays: any[] = [];
    for (let i = 0; i < 5; i++) {
      const rayGeom = new T.CylinderGeometry(0.05, 0.05, 5, 6);
      const rayMat = new T.MeshBasicMaterial({
        color: 0xffe89a,
        transparent: true,
        opacity: 0.0,
        blending: T.AdditiveBlending,
        fog: false,
      });
      const ray = new T.Mesh(rayGeom, rayMat);
      const angle = (i / 5) * Math.PI * 2;
      ray.rotation.z = angle;
      ray.position.set(Math.cos(angle) * 2.5, Math.sin(angle) * 2.5, 0);
      group.add(ray);
      rays.push(ray);
    }

    // Point light vif au centre
    const light = new T.PointLight(0xffffff, 0, 60, 2);
    light.position.set(skyX, skyY, skyZ);
    this.scene.add(light);

    this.scene.add(group);
    this.aimTelescopeAt(skyX, skyY, skyZ);

    this.addPhenomenon({
      type: 'supernova',
      objects: [group, light],
      startTime: performance.now(),
      duration: 7000,
      update: (t: number) => {
        // 0→0.5 : scale 0 → 3
        // 0.5→1 : fade out
        const scale = t < 0.5 ? t / 0.5 * 3 : (3 - (t - 0.5) / 0.5 * 3);
        core.scale.setScalar(Math.max(0.05, scale));
        core.material.emissiveIntensity = 8.0 * (1 - Math.abs(t - 0.4));
        light.intensity = 6 * Math.max(0, 1 - Math.abs(t - 0.4) * 2);
        for (let i = 0; i < rays.length; i++) {
          const ray = rays[i];
          const angle = (i / rays.length) * Math.PI * 2 + t * 0.6;
          ray.rotation.z = angle;
          ray.position.set(Math.cos(angle) * 2.5 * scale, Math.sin(angle) * 2.5 * scale, 0);
          ray.material.opacity = 0.7 * Math.max(0, 1 - Math.abs(t - 0.45) * 2);
          ray.scale.y = scale;
        }
      },
    });
    this.emitCeremony({ type: 'supernova', label: '💥 Supernova · Release majeure', icon: '💥' });
    this.currentSkyState.set('💥 Supernova · Major release');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. 🌫 NEBULA — cloud Points roses/violets drift
  // ═══════════════════════════════════════════════════════════════════
  triggerNebula() {
    const T = (window as any).THREE;
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const skyX = -16;
    const skyY = 30;
    const skyZ = -18;
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = skyX + (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = skyY + (Math.random() - 0.5) * 7;
      positions[i * 3 + 2] = skyZ + (Math.random() - 0.5) * 10;
      const c = Math.random();
      colors[i * 3 + 0] = 0.85 + c * 0.15;
      colors[i * 3 + 1] = 0.4 + c * 0.3;
      colors[i * 3 + 2] = 0.85 + c * 0.15;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.85,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.0,
      blending: T.AdditiveBlending,
      vertexColors: true,
      fog: false,
    });
    const nebula = new T.Points(geom, mat);
    this.scene.add(nebula);
    this.aimTelescopeAt(skyX, skyY, skyZ);

    this.addPhenomenon({
      type: 'nebula',
      objects: [nebula],
      startTime: performance.now(),
      duration: 8000,
      update: (t: number, dt: number) => {
        // Fade in/out
        nebula.material.opacity = t < 0.2 ? (t / 0.2) * 0.8 : (t > 0.85 ? ((1 - t) / 0.15) * 0.8 : 0.8);
        // Drift lent
        const pos = nebula.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.array[i * 3 + 0] += Math.sin(this.windTime * 0.3 + i * 0.1) * dt * 0.18;
          pos.array[i * 3 + 1] += Math.cos(this.windTime * 0.25 + i * 0.15) * dt * 0.1;
        }
        pos.needsUpdate = true;
      },
    });
    this.emitCeremony({ type: 'nebula', label: '🌫 Nébuleuse · Idéation', icon: '🌫' });
    this.currentSkyState.set('🌫 Nebula · Brainstorm in progress');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. 🌠 SHOOTING STAR — une seule streak rapide (1.5s)
  // ═══════════════════════════════════════════════════════════════════
  triggerShootingStar() {
    const T = (window as any).THREE;
    const points = [
      new T.Vector3(0, 0, 0),
      new T.Vector3(-2.5, -1.6, -0.4),
    ];
    const geom = new T.BufferGeometry().setFromPoints(points);
    const mat = new T.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: T.AdditiveBlending,
      fog: false,
    });
    const streak = new T.Line(geom, mat);
    const startX = -25;
    const startY = 40;
    const startZ = -10;
    streak.position.set(startX, startY, startZ);
    this.scene.add(streak);
    this.aimTelescopeAt(0, 38, -8);

    this.addPhenomenon({
      type: 'shooting-star',
      objects: [streak],
      startTime: performance.now(),
      duration: 1500,
      update: (t: number) => {
        streak.position.x = startX + 50 * t;
        streak.position.y = startY - 8 * t;
        streak.material.opacity = Math.max(0, 1 - t);
      },
    });
    this.emitCeremony({ type: 'shooting-star', label: '🌠 Étoile filante · Quick win', icon: '🌠' });
    this.currentSkyState.set('🌠 Shooting star · Quick win');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 8. 🌙 CRESCENT MOON — lune partiellement ombragée
  // ═══════════════════════════════════════════════════════════════════
  setCrescentMoon() {
    const T = (window as any).THREE;
    const group = new T.Group();
    const skyX = 6;
    const skyY = 34;
    const skyZ = -30;
    group.position.set(skyX, skyY, skyZ);

    const moonGeom = new T.SphereGeometry(1.0, 24, 18);
    const moonMat = new T.MeshStandardMaterial({
      color: 0xf5f5dc,
      emissive: 0xfde047,
      emissiveIntensity: 1.4,
      roughness: 0.7,
    });
    const moon = new T.Mesh(moonGeom, moonMat);
    group.add(moon);

    // Sphère sombre devant pour créer la phase
    const shadowGeom = new T.SphereGeometry(1.02, 24, 18);
    const shadowMat = new T.MeshBasicMaterial({
      color: 0x05030f,
      fog: false,
    });
    const shadow = new T.Mesh(shadowGeom, shadowMat);
    shadow.position.set(0.55, 0, 0.05);
    group.add(shadow);

    this.scene.add(group);
    this.aimTelescopeAt(skyX, skyY, skyZ);

    this.addPhenomenon({
      type: 'crescent',
      objects: [group],
      startTime: performance.now(),
      duration: 8000,
      update: (t: number) => {
        // Léger swing du shadow
        shadow.position.x = 0.55 + Math.sin(t * Math.PI * 2) * 0.05;
        moon.material.emissiveIntensity = 1.4 + Math.sin(t * Math.PI * 4) * 0.15;
      },
    });
    this.emitCeremony({ type: 'crescent', label: '🌙 Croissant · Mid-sprint', icon: '🌙' });
    this.currentSkyState.set('🌙 Crescent moon · Mid-sprint');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. ⚡ SOLAR STORM — aurore rouge intense + flashes sur l'horizon
  // ═══════════════════════════════════════════════════════════════════
  triggerSolarStorm() {
    const T = (window as any).THREE;
    const group = new T.Group();
    // Aurore rouge (Plane large incurvé)
    const bandGeom = new T.PlaneGeometry(56, 9, 32, 4);
    const bandColors = new Float32Array(bandGeom.attributes.position.count * 3);
    for (let v = 0; v < bandGeom.attributes.position.count; v++) {
      const y = bandGeom.attributes.position.getY(v);
      const ratio = (y + 4.5) / 9;
      bandColors[v * 3 + 0] = 1.0;
      bandColors[v * 3 + 1] = 0.15 + ratio * 0.3;
      bandColors[v * 3 + 2] = 0.05 + ratio * 0.15;
    }
    bandGeom.setAttribute('color', new T.BufferAttribute(bandColors, 3));
    const bandMat = new T.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      fog: false,
    });
    const band = new T.Mesh(bandGeom, bandMat);
    band.position.set(0, 18, -32);
    band.rotation.x = -0.25;
    band.userData.basePositions = new Float32Array(bandGeom.attributes.position.array);
    group.add(band);

    // Flashes : light rouge clignotant côté horizon
    const flashLight = new T.PointLight(0xff2a0a, 0, 50, 2);
    flashLight.position.set(0, 8, -28);
    this.scene.add(flashLight);

    this.scene.add(group);
    this.aimTelescopeAt(0, 18, -32);

    this.addPhenomenon({
      type: 'solar-storm',
      objects: [group, flashLight],
      startTime: performance.now(),
      duration: 7500,
      update: (t: number) => {
        const fade = t < 0.15 ? t / 0.15 : (t > 0.85 ? (1 - t) / 0.15 : 1);
        band.material.opacity = 0.7 * fade;
        // Wave
        const pos = band.geometry.attributes.position;
        const base = band.userData.basePositions;
        const phase = this.windTime * 2.2;
        for (let v = 0; v < pos.count; v++) {
          const x = base[v * 3 + 0];
          pos.array[v * 3 + 1] = base[v * 3 + 1] + Math.sin(phase + x * 0.25) * 1.0;
        }
        pos.needsUpdate = true;
        // Flicker rouge
        const flick = Math.max(0, Math.sin(this.windTime * 14) * 0.7 + 0.3);
        flashLight.intensity = flick * 4 * fade;
      },
    });
    this.emitCeremony({ type: 'solar-storm', label: '⚡ Tempête solaire · Incident', icon: '⚡' });
    this.currentSkyState.set('⚡ Solar storm · Incident in progress');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. 🪐 CONJUNCTION — deux planètes (Jupiter/Saturn) qui se rapprochent
  // ═══════════════════════════════════════════════════════════════════
  triggerConjunction() {
    const T = (window as any).THREE;
    const group = new T.Group();
    const skyX = 4;
    const skyY = 28;
    const skyZ = -26;
    group.position.set(skyX, skyY, skyZ);

    // Jupiter (sphère orange + barre)
    const jupiterGeom = new T.SphereGeometry(0.6, 20, 14);
    const jupiterMat = new T.MeshStandardMaterial({
      color: 0xfdba74,
      emissive: 0x9a5418,
      emissiveIntensity: 0.55,
      roughness: 0.7,
    });
    const jupiter = new T.Mesh(jupiterGeom, jupiterMat);
    jupiter.position.set(-4, 0, 0);
    group.add(jupiter);

    // Saturn (sphère jaune pâle + anneau)
    const saturnGeom = new T.SphereGeometry(0.5, 20, 14);
    const saturnMat = new T.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0x8a7018,
      emissiveIntensity: 0.55,
      roughness: 0.7,
    });
    const saturn = new T.Mesh(saturnGeom, saturnMat);
    saturn.position.set(4, 0, 0);
    group.add(saturn);
    const ringGeom = new T.RingGeometry(0.65, 0.95, 24);
    const ringMat = new T.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.55,
      side: T.DoubleSide,
      fog: false,
    });
    const ring = new T.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2.4;
    saturn.add(ring);

    this.scene.add(group);
    this.aimTelescopeAt(skyX, skyY, skyZ);

    this.addPhenomenon({
      type: 'conjunction',
      objects: [group],
      startTime: performance.now(),
      duration: 7500,
      update: (t: number) => {
        // 0→0.45 : rapprochement
        // 0.45→0.6 : proche, alignées
        // 0.6→1 : s'éloignent
        let phase: number;
        if (t < 0.45) phase = t / 0.45;             // 0→1
        else if (t < 0.6) phase = 1;
        else phase = 1 - (t - 0.6) / 0.4;
        jupiter.position.x = -4 + phase * 3.2;
        saturn.position.x = 4 - phase * 3.2;
        jupiter.rotation.y += 0.012;
        saturn.rotation.y += 0.01;
      },
    });
    this.emitCeremony({ type: 'conjunction', label: '🪐 Conjonction · Alignement stratégique', icon: '🪐' });
    this.currentSkyState.set('🪐 Conjunction · Strategic alignment');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 11. ✨ CLEAR SKY — cleanup all active phenomena
  // ═══════════════════════════════════════════════════════════════════
  clearSky() {
    for (const p of this.activePhenomena) {
      for (const obj of p.objects) {
        this.scene.remove(obj);
        this.disposeObject(obj);
      }
      if (p.onDone) {
        try { p.onDone(); } catch (e) { console.warn('[TelescopeIsland] onDone error', e); }
      }
    }
    this.activePhenomena = [];
    this.currentSkyState.set('🌌 Ciel calme · Aucun phénomène');
    this.telescopeTargetYaw = 0;
    this.telescopeTargetPitch = 0.6;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 12. 🎬 LOAD DEMO — cycle de démarrage : aurora puis comète
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    // Démarre par une aurore subtile
    this.triggerAurora();
    setTimeout(() => {
      if (!this.disposed) this.triggerComet();
    }, 2200);
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
    this.narrator.startTimeboxOnly(600, 'Daily wrap-up');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers — disposeObject (récursif)
  // ═══════════════════════════════════════════════════════════════════
  private disposeObject(obj: any) {
    if (!obj) return;
    if (obj.geometry?.dispose) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) m.dispose?.();
      } else {
        obj.material.dispose?.();
      }
    }
    if (obj.children) {
      for (const c of [...obj.children]) this.disposeObject(c);
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
    this.elapsed += dt;

    // ─── Stars scintillent doucement ───
    if (this.starsField?.material) {
      this.starsField.material.opacity = 0.85 + Math.sin(this.windTime * 1.4) * 0.1;
    }

    // ─── Torches flickering ───
    for (let i = 0; i < this.torchLights.length; i++) {
      const light = this.torchLights[i];
      const phase = light.userData.phase || 0;
      light.intensity = 0.8 + Math.sin(this.windTime * 7 + phase) * 0.3 + Math.random() * 0.1;
      const flame = this.torchFlames[i];
      if (flame) {
        flame.scale.y = 0.9 + Math.sin(this.windTime * 8 + phase) * 0.2;
        flame.scale.x = 0.95 + Math.cos(this.windTime * 7 + phase) * 0.1;
      }
    }

    // ─── Télescope : interpole vers la cible (yaw/pitch) ───
    if (this.telescopeGroup) {
      const ty = this.telescopeTargetYaw;
      const tp = -this.telescopeTargetPitch;       // pitch négatif = vers le haut
      this.telescopeGroup.rotation.y += (ty - this.telescopeGroup.rotation.y) * 0.05;
      this.telescopeGroup.rotation.x += (tp - this.telescopeGroup.rotation.x) * 0.05;
    }

    // ─── Phénomènes actifs ───
    if (this.activePhenomena.length > 0) {
      const now = performance.now();
      const done: number[] = [];
      for (let i = 0; i < this.activePhenomena.length; i++) {
        const p = this.activePhenomena[i];
        const t = Math.min(1, (now - p.startTime) / p.duration);
        if (p.update) {
          try { p.update(t, dt); } catch (e) { console.warn('[TelescopeIsland] phenomenon update error', e); }
        }
        if (t >= 1) done.push(i);
      }
      for (let i = done.length - 1; i >= 0; i--) {
        const p = this.activePhenomena[done[i]];
        for (const obj of p.objects) {
          this.scene.remove(obj);
          this.disposeObject(obj);
        }
        if (p.onDone) {
          try { p.onDone(); } catch (e) { console.warn('[TelescopeIsland] onDone err', e); }
        }
        this.activePhenomena.splice(done[i], 1);
      }
      // Si plus aucun phénomène, retour à ciel calme
      if (this.activePhenomena.length === 0) {
        this.currentSkyState.set('🌌 Ciel calme · Aucun phénomène');
      }
    }

    // ─── Observatoire : léger glow pulsant du dôme ───
    if (this.observatory) {
      this.observatory.children.forEach((c: any) => {
        if (c.material?.emissiveIntensity !== undefined && c.geometry?.type === 'SphereGeometry') {
          c.material.emissiveIntensity = 0.25 + Math.sin(this.windTime * 1.1) * 0.08;
        }
      });
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.elapsed);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // RESIZE
  // ═══════════════════════════════════════════════════════════════════
  private onResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
