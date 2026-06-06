// ═══════════════════════════════════════════════════════════════════
// ⛰ OKR MOUNTAIN ROOM — L'Ascension du Sommet
//
// Mécanique data unique : une montagne 3D à gravir. Ton avatar est
// physiquement sur le sentier en lacets. Sa position = progression %.
// La cordée (équipe) te suit, la météo capture le health, l'aigle
// royal (coach IA) tournoie autour du pic.
//
// Implémentation : Three.js procedural mountain, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🌅 Aube du trimestre   = Q kickoff (golden dawn shimmer)
//   ⛰ Sommet conquis      = objective achieved (white sparkle)
//   🌌 Solstice mid-Q      = check-in mi-trimestre (purple moonlight)
//   ⚡ Tempête             = OKR at risk (lightning red flash)
//   🏴 Plantation drapeau  = KR validé (marteau anim)
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
import { SpellButtonComponent, SpellTutorialOverlayComponent, TutorialStep, SpellFooterService } from '../../core/spell-ui';

interface MountainKR {
  id: number;
  title: string;
  unit: string;             // '%' | 'count' | 'eur' | 'days'
  target_value: number;
  current_value: number;
  altitude_meters: number;  // 0-1000, visual position on mountain
  owner: string;
}

interface MountainObjective {
  id: number;
  quarter: string;          // '2026-Q2'
  objective: string;
  status: 'on_track' | 'at_risk' | 'off_track' | 'achieved';
}

interface CordeeMember {
  name: string;
  color: string;
  progressionPct: number;   // 0-100, sa position relative sur le sentier
}

interface PastTrophy {
  quarter: string;
  label: string;
  color: string;
}

type WeatherState = 'sunny' | 'rainy' | 'stormy' | 'snowy';

@Component({
  selector: 'wt-okr-mountain-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="om-host">
      <header class="om-topbar">
        <div class="om-title">
          <h1>⛰ OKR MOUNTAIN ROOM</h1>
          <p>
            {{ objective()?.objective || 'Aucun sommet choisi' }} ·
            {{ objective()?.quarter }} ·
            {{ weatherLabel() }} ·
            <strong>{{ progressionPct() }}%</strong> d'ascension
          </p>
        </div>
        <div class="om-legend">
          <span class="dot summit"></span>sommet
          <span class="dot kr"></span>KR
          <span class="dot you"></span>toi
          <span class="dot eagle"></span>aigle
        </div>
      </header>

      <canvas #canvas class="om-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="om-flash" [attr.data-type]="f.type">
        <div class="om-flash-content">
          <div class="om-flash-icon">{{ f.icon }}</div>
          <div class="om-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Side panel KR détail -->
      <div *ngIf="selectedKR() as kr" class="om-panel">
        <button class="om-panel-close" (click)="selectedKR.set(null)">×</button>
        <div class="om-panel-head">
          <strong class="om-panel-id">KR #{{ kr.id }}</strong>
          <span class="om-panel-altitude">{{ kr.altitude_meters }}m</span>
        </div>
        <div class="om-panel-title">{{ kr.title }}</div>
        <div class="om-panel-progress">
          <div class="om-panel-bar">
            <div class="om-panel-bar-fill" [style.width.%]="krCompletionPct(kr)"></div>
          </div>
          <span>{{ kr.current_value }} / {{ kr.target_value }} {{ kr.unit }}</span>
        </div>
        <div class="om-panel-owner">👤 {{ kr.owner }}</div>
      </div>

      <!-- 🎬 Welcome splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="OKR Mountain"
        loreName="L'Ascension du Sommet"
        color="#a855f7"
        oneLiner="Montagne 3D avec sentier spiral, cordée d'équipe et 4 météos."
        [duration]="70"
        [timeboxDurationS]="1800"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="OKR Mountain"
        loreName="L'Ascension du Sommet"
        accent="#fde68a"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .om-host {
      position: relative; width: 100%; height: 100vh; color: #f1f5f9;
      font-family: "Tinos", serif;
      background: linear-gradient(180deg, #1e293b 0%, #475569 60%, #94a3b8 100%);
    }
    .om-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .om-topbar > * { pointer-events: auto; }
    .om-back { color: #c4b5fd; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #a855f7; border-radius: 8px; background: rgba(40,20,60,0.4); }
    .om-back:hover { background: rgba(168,85,247,0.4); }
    .om-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1px; color: #c4b5fd; }
    .om-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .om-title strong { color: #fff; }
    .om-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; }
    .om-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .om-legend .summit { background: #fff; box-shadow: 0 0 8px #fff; }
    .om-legend .kr     { background: #a855f7; }
    .om-legend .you    { background: #facc15; }
    .om-legend .eagle  { background: #d4a373; }

    .om-canvas { display: block; width: 100%; height: 100%; }
    .om-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%); flex-wrap: wrap; }
    .om-controls button { background: rgba(40,20,60,0.7); color: #f1f5f9; border: 1px solid #a855f7; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .om-controls button:hover:not(:disabled) { background: rgba(168,85,247,0.6); }
    .om-controls button:disabled { opacity: 0.4; cursor: not-allowed; }
    .om-controls .om-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .om-controls .om-narrator:hover:not(:disabled) { background: rgba(251,191,36,0.3); }
    .om-controls .om-narrator.om-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .om-controls .om-narrator.om-play:hover:not(:disabled) { background: #f5b923; }
    .om-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .om-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: om-flash-pulse 1.6s ease-out forwards; }
    .om-flash[data-type="dawn"]    { background: radial-gradient(circle at center, rgba(251,191,36,0.55), transparent 60%); }
    .om-flash[data-type="summit"]  { background: radial-gradient(circle at center, rgba(255,255,255,0.7), transparent 70%); }
    .om-flash[data-type="solstice"]{ background: radial-gradient(circle at center, rgba(168,85,247,0.6), transparent 60%); }
    .om-flash[data-type="storm"]   { background: radial-gradient(circle at center, rgba(220,38,38,0.55), transparent 55%); }
    .om-flash[data-type="flag"]    { background: radial-gradient(circle at center, rgba(168,85,247,0.5), transparent 65%); }
    .om-flash-content { text-align: center; animation: om-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .om-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .om-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.5); }
    @keyframes om-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes om-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    /* Side panel KR */
    .om-panel { position: absolute; right: 22px; top: 80px; width: 300px; padding: 14px; background: rgba(30,20,60,0.92); border: 1px solid #a855f7; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; }
    .om-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(196,181,253,0.4); border-radius: 50%; color: #c4b5fd; cursor: pointer; }
    .om-panel-head { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
    .om-panel-id { color: #fbbf24; font-family: monospace; }
    .om-panel-altitude { color: #c4b5fd; font-size: 11px; }
    .om-panel-title { color: #f1f5f9; margin: 8px 0; line-height: 1.4; font-weight: 600; }
    .om-panel-progress { margin: 10px 0; }
    .om-panel-bar { width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .om-panel-bar-fill { height: 100%; background: linear-gradient(90deg, #a855f7, #fbbf24); transition: width 0.4s; }
    .om-panel-progress span { font-size: 11px; opacity: 0.85; }
    .om-panel-owner { font-size: 11px; opacity: 0.75; margin-top: 6px; }
  `]
})
export class OkrMountainRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── State signals ───
  objective = signal<MountainObjective | null>(null);
  krs = signal<MountainKR[]>([]);
  cordee = signal<CordeeMember[]>([]);
  pastTrophies = signal<PastTrophy[]>([]);
  weather = signal<WeatherState>('sunny');
  progressionPct = signal<number>(0);
  selectedKR = signal<MountainKR | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '⛰', title: 'La montagne, c\'est votre Objectif', body: 'Le sommet à atteindre représente l\'Objective annuel ou trimestriel. Sa hauteur reflète son ambition.' },
    { icon: '🏴', title: 'Drapeaux = Key Results', body: 'Plantés le long du sentier en spirale, chaque drapeau est un KR mesurable. Sa position en hauteur reflète la progression.' },
    { icon: '🧗', title: 'Cordée d\'équipe en progression', body: 'Les petits personnages encordés montent en suivant le sentier. Leur position physique trace l\'avancement du sprint.' },
    { icon: '🌌', title: 'Solstice mi-trimestre', body: 'Au milieu du trimestre, lumière pourpre du solstice : c\'est le moment du check-in. Les KRs au rouge demandent une décision.' },
    { icon: '⚡', title: 'Tempête = OKR at risk', body: 'Quand un KR est en danger, la météo bascule en tempête. Foudre rouge sur la montagne — il faut réagir ou abandonner.' },
  ];
  tutorialVoiceLines: string[] = [
    'La montagne est votre Objectif trimestriel.',
    'Les drapeaux sont les Key Results mesurables.',
    'La cordée monte en suivant le sentier.',
    'Le solstice, c\'est le check-in mi-trimestre.',
    'Une tempête signale un OKR en danger.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  weatherLabel = computed(() => {
    const w = this.weather();
    if (w === 'sunny')  return '☀ Ensoleillé · on track';
    if (w === 'rainy')  return '🌧 Pluie · en retard';
    if (w === 'stormy') return '⚡ Tempête · at risk';
    return '❄ Neige · winter check-in';
  });

  // ─── Three.js refs ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;

  // Scene objects
  private mountain: any;
  private trailMesh: any;
  private trailCurve: any;            // courbe paramétrique pour positionner avatar
  private plateauMeshes: any[] = [];  // pour raycaster KR
  private krByPlateau = new Map<any, MountainKR>();
  private youAvatar: any;
  private cordeeAvatars: any[] = [];
  private sommetFlag: any;
  private sommetCloth: any;
  private trophyMeshes: any[] = [];
  private crevasses: any[] = [];
  private campTent: any;
  private campFire: any;
  private eagleMesh: any;
  private rainPoints: any = null;
  private snowPoints: any = null;
  private dawnHalo: any = null;
  private lightningLight: any;
  private sunLight: any;
  private ambientLight: any;

  // Interaction
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private ceremonyFlashTimer: any = null;

  // Animation timers
  private windTime = 0;
  private lightningNextAt = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ───────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ───────────────────────────────────────────────────────────────
  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#fde68a',
      hint: 'Mouse drag = orbit · molette = zoom · clic plateau = KR détail',
      controls: [
        { icon: '🎬', label: 'Demo OKR', action: () => this.loadDemo() },
        { icon: '⬆', label: 'Update KR', action: () => this.updateKR() },
        { icon: '🌤', label: this.weatherLabel(), action: () => this.toggleWeather() },
        { icon: '🏴', label: 'Plant flag (summit reached!)', action: () => this.plantSummitFlag() },
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

  // ───────────────────────────────────────────────────────────────
  // INIT SCENE
  // ───────────────────────────────────────────────────────────────
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // ─ Scène ─
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x7d8fa8);  // ciel gris-bleu
    this.scene.fog = new T.FogExp2(0x9ab4cf, 0.020);

    // ─ Caméra ─
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(18, 14, 22);
    this.camera.lookAt(0, 6, 0);

    // ─ Renderer ─
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─ Lumières ─
    this.ambientLight = new T.AmbientLight(0xc9d6e8, 0.55);
    this.scene.add(this.ambientLight);
    this.sunLight = new T.DirectionalLight(0xfff1d0, 1.0);
    this.sunLight.position.set(18, 25, 14);
    this.scene.add(this.sunLight);
    // hemisphere fill (ciel violet en altitude)
    const hemi = new T.HemisphereLight(0xa9b6d8, 0x665050, 0.35);
    this.scene.add(hemi);
    // lightning point light (off by default)
    this.lightningLight = new T.PointLight(0xffffff, 0, 80);
    this.lightningLight.position.set(0, 18, 0);
    this.scene.add(this.lightningLight);

    // ─ Sol (plaine alpine) ─
    const groundGeom = new T.PlaneGeometry(80, 80, 1, 1);
    const groundMat = new T.MeshStandardMaterial({ color: 0x4f6a52, roughness: 0.95 });
    const ground = new T.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.scene.add(ground);

    // ─ OrbitControls ─
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 6, 0);
      this.controls.maxDistance = 60;
      this.controls.minDistance = 4;
    }

    // ─ Raycaster pour clic plateaux ─
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Stratégie)
    const island = getIslandForRoom('/okr-mountain');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-15, 4, 15],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[OkrMountain] ⛰ Mountain scene ready');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'okr-mountain',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD MOUNTAIN
  // ═══════════════════════════════════════════════════════════════
  private buildMountain() {
    const T = (window as any).THREE;
    this.disposeMountainMeshes();

    // ─── Montagne multi-niveaux (cônes empilés + déplacement aléatoire) ───
    const mountainGroup = new T.Group();
    const baseRadius = 8;
    const totalHeight = 12;
    const levels = 5;  // nombre de strates pour effet "tiered"

    for (let i = 0; i < levels; i++) {
      const t = i / levels;
      const rBot = baseRadius * (1 - t * 0.85);
      const rTop = baseRadius * (1 - (t + 1 / levels) * 0.85);
      const hSeg = totalHeight / levels;
      const geom = new T.ConeGeometry(rBot, hSeg * 1.6, 14, 3, true);
      // petites déformations pour casser la régularité
      const posAttr = geom.attributes.position;
      for (let j = 0; j < posAttr.count; j++) {
        const x = posAttr.getX(j);
        const z = posAttr.getZ(j);
        const noise = (Math.sin(x * 1.3) + Math.cos(z * 1.7)) * 0.18;
        posAttr.setX(j, x + noise);
        posAttr.setZ(j, z + noise);
      }
      geom.computeVertexNormals();
      // Couleur : marron-gris en bas, neige en haut
      const isSnow = i >= levels - 2;
      const color = isSnow ? 0xf4f6fb : (i === 0 ? 0x5d6e58 : 0x7a7068);
      const mat = new T.MeshStandardMaterial({
        color,
        roughness: isSnow ? 0.45 : 0.95,
        emissive: isSnow ? 0x445566 : 0x000000,
        emissiveIntensity: isSnow ? 0.18 : 0,
        flatShading: true,
      });
      const cone = new T.Mesh(geom, mat);
      cone.position.y = i * hSeg * 1.4 + hSeg / 2;
      mountainGroup.add(cone);
    }
    this.mountain = mountainGroup;
    mountainGroup.userData.tutorialId = 'mountain';
    this.scene.add(mountainGroup);

    // ─── Sentier en spirale (TubeGeometry sur courbe paramétrique) ───
    this.buildTrail(T, baseRadius, totalHeight);

    // ─── 5 Plateaux (KR markers) à différentes altitudes ───
    this.buildPlateaus(T);

    // ─── Avatar (toi) sur le sentier ───
    this.buildYouAvatar(T);

    // ─── Cordée (3 avatars derrière) ───
    this.buildCordee(T);

    // ─── Drapeau du sommet ───
    this.buildSommetFlag(T);

    // ─── Crevasses (risques) sur les pentes ───
    this.buildCrevasses(T);

    // ─── Camp de base (tente + feu de camp) ───
    this.buildCamp(T);

    // ─── Aigle royal tournoyant ───
    this.buildEagle(T);

    // ─── Trophées Q passés au sommet ───
    this.buildTrophies(T);

    console.log(`[OkrMountain] ⛰ Mountain built: ${this.plateauMeshes.length} KR plateaus, ${this.cordeeAvatars.length} cordée, ${this.crevasses.length} crevasses`);
  }

  // ─── Trail : courbe paramétrique spirale ───
  private buildTrail(T: any, baseRadius: number, totalHeight: number) {
    // CatmullRom curve : spirale qui monte sur 2.5 tours
    const turns = 2.4;
    const steps = 60;
    const points: any[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      // rayon diminue avec l'altitude (épouse la pente du cône)
      const r = baseRadius * (1 - t * 0.78) + 0.4;
      const y = t * (totalHeight - 0.8) + 0.4;
      points.push(new T.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    this.trailCurve = new T.CatmullRomCurve3(points);
    const tubeGeom = new T.TubeGeometry(this.trailCurve, 100, 0.18, 8, false);
    const tubeMat = new T.MeshStandardMaterial({
      color: 0x8b5e3c,           // marron terre
      roughness: 0.92,
      emissive: 0x3a2a1a,
      emissiveIntensity: 0.15,
    });
    this.trailMesh = new T.Mesh(tubeGeom, tubeMat);
    this.trailMesh.userData.tutorialId = 'trail';
    this.scene.add(this.trailMesh);
  }

  // ─── 5 plateaux KR (disques cylindriques + drapeau) ───
  private buildPlateaus(T: any) {
    const krList = this.krs();
    const colors = [0xa855f7, 0xc084fc, 0xe879f9, 0xfbbf24, 0x60a5fa];
    krList.forEach((kr, i) => {
      // position le long de la courbe selon altitude (0-1000m → 0-1 sur trail)
      const t = Math.min(0.98, kr.altitude_meters / 1100);
      const pos = this.trailCurve.getPoint(t);
      // décale légèrement vers l'extérieur de la spirale
      const out = pos.clone();
      out.y += 0.02;
      // Disque plateau
      const plateGeom = new T.CylinderGeometry(0.7, 0.8, 0.15, 16);
      const plateMat = new T.MeshStandardMaterial({
        color: 0x9a8a7a,
        roughness: 0.85,
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.25,
      });
      const plate = new T.Mesh(plateGeom, plateMat);
      plate.position.copy(out);
      plate.userData = { kind: 'plateau', krId: kr.id };
      if (i === 0) plate.userData.tutorialId = 'plateau';
      this.scene.add(plate);
      this.plateauMeshes.push(plate);
      this.krByPlateau.set(plate, kr);

      // ─ Drapeau sur le plateau ─
      const poleGeom = new T.CylinderGeometry(0.025, 0.025, 1.1, 6);
      const poleMat = new T.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.5 });
      const pole = new T.Mesh(poleGeom, poleMat);
      pole.position.set(out.x, out.y + 0.62, out.z);
      this.scene.add(pole);

      // Cloth quad
      const clothGeom = new T.PlaneGeometry(0.5, 0.32);
      const clothMat = new T.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.5,
        side: T.DoubleSide,
        roughness: 0.7,
      });
      const cloth = new T.Mesh(clothGeom, clothMat);
      cloth.position.set(out.x + 0.27, out.y + 0.95, out.z);
      cloth.userData.windPhase = Math.random() * Math.PI * 2;
      cloth.userData.kind = 'krFlag';
      this.scene.add(cloth);
      this.plateauMeshes.push(cloth); // cliquable aussi
      this.krByPlateau.set(cloth, kr);

      // Pointe du drapeau (cone)
      const tipGeom = new T.ConeGeometry(0.05, 0.12, 6);
      const tipMat = new T.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.3 });
      const tip = new T.Mesh(tipGeom, tipMat);
      tip.position.set(out.x, out.y + 1.2, out.z);
      this.scene.add(tip);
    });
  }

  // ─── Avatar joueur (sphère + cône) ───
  private buildYouAvatar(T: any) {
    const group = new T.Group();
    // Corps (cône)
    const bodyGeom = new T.ConeGeometry(0.18, 0.4, 8);
    const bodyMat = new T.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.2;
    group.add(body);
    // Tête (sphère)
    const headGeom = new T.SphereGeometry(0.13, 14, 10);
    const headMat = new T.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.5 });
    const head = new T.Mesh(headGeom, headMat);
    head.position.y = 0.52;
    group.add(head);
    // Halo
    const haloGeom = new T.RingGeometry(0.22, 0.28, 24);
    const haloMat = new T.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.6, side: T.DoubleSide });
    const halo = new T.Mesh(haloGeom, haloMat);
    halo.position.y = 0.7;
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    this.youAvatar = group;
    group.userData.tutorialId = 'you-avatar';
    this.scene.add(group);
    this.updateYouPosition();
  }

  // ─── Cordée : 3 avatars en file derrière toi ───
  private buildCordee(T: any) {
    const members = this.cordee();
    for (const m of members) {
      const group = new T.Group();
      const bodyGeom = new T.ConeGeometry(0.15, 0.34, 8);
      const bodyMat = new T.MeshStandardMaterial({ color: m.color, roughness: 0.6 });
      const body = new T.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.17;
      group.add(body);
      const headGeom = new T.SphereGeometry(0.11, 12, 10);
      const headMat = new T.MeshStandardMaterial({ color: 0xfcd9b6, roughness: 0.6 });
      const head = new T.Mesh(headGeom, headMat);
      head.position.y = 0.44;
      group.add(head);
      group.userData.member = m;
      if (this.cordeeAvatars.length === 0) group.userData.tutorialId = 'cordee';
      this.scene.add(group);
      this.cordeeAvatars.push(group);
    }
    this.updateCordeePositions();
  }

  // ─── Drapeau du sommet (grand poteau + cloth qui ondule) ───
  private buildSommetFlag(T: any) {
    const summit = this.trailCurve.getPoint(1.0);
    const summitY = 12.2;

    const poleGeom = new T.CylinderGeometry(0.06, 0.08, 2.2, 8);
    const poleMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.set(0, summitY + 1.1, 0);
    this.scene.add(pole);
    this.sommetFlag = pole;

    // Pointe dorée
    const tipGeom = new T.ConeGeometry(0.12, 0.3, 8);
    const tipMat = new T.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2, emissive: 0xfbbf24, emissiveIntensity: 0.4 });
    const tip = new T.Mesh(tipGeom, tipMat);
    tip.position.set(0, summitY + 2.35, 0);
    this.scene.add(tip);

    // Cloth (plane qui ondule via rotation Y)
    const clothGeom = new T.PlaneGeometry(1.4, 0.85);
    const clothMat = new T.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.55,
      side: T.DoubleSide,
      roughness: 0.6,
    });
    const cloth = new T.Mesh(clothGeom, clothMat);
    cloth.position.set(0.7, summitY + 1.7, 0);
    this.scene.add(cloth);
    this.sommetCloth = cloth;
  }

  // ─── Crevasses : box ovales sombres encastrées sur les pentes ───
  private buildCrevasses(T: any) {
    const positions = [
      { t: 0.35, offset: 1.2 },
      { t: 0.55, offset: -1.4 },
      { t: 0.72, offset: 1.0 },
    ];
    for (const p of positions) {
      const center = this.trailCurve.getPoint(p.t);
      // BoxGeometry étiré en triangle (dark gap)
      const geom = new T.BoxGeometry(0.4, 0.12, 1.6);
      const mat = new T.MeshStandardMaterial({
        color: 0x111522,
        emissive: 0x000000,
        roughness: 1,
        side: T.DoubleSide,
      });
      const box = new T.Mesh(geom, mat);
      // décale légèrement vers l'extérieur de la spirale
      const radial = new T.Vector3(center.x, 0, center.z).normalize();
      box.position.set(
        center.x + radial.x * p.offset,
        center.y - 0.04,
        center.z + radial.z * p.offset,
      );
      box.rotation.y = Math.atan2(center.z, center.x);
      this.scene.add(box);
      this.crevasses.push(box);
    }
  }

  // ─── Camp de base : tente cone + feu de camp ───
  private buildCamp(T: any) {
    // Position : milestone à mi-montagne (t = 0.4)
    const center = this.trailCurve.getPoint(0.4);
    const offsetX = -1.4;
    const camp = new T.Group();
    camp.position.set(center.x + offsetX, center.y, center.z - 0.3);

    // Tente (cone)
    const tentGeom = new T.ConeGeometry(0.55, 0.8, 4);
    const tentMat = new T.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.7,
      emissive: 0x4a1a05,
      emissiveIntensity: 0.2,
    });
    const tent = new T.Mesh(tentGeom, tentMat);
    tent.position.y = 0.4;
    tent.rotation.y = Math.PI / 4;
    camp.add(tent);

    // Feu de camp : cylindre bûches + cône flamme
    const logsGeom = new T.CylinderGeometry(0.2, 0.2, 0.08, 8);
    const logsMat = new T.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.9 });
    const logs = new T.Mesh(logsGeom, logsMat);
    logs.position.set(0.7, 0.04, 0.4);
    camp.add(logs);

    const flameGeom = new T.ConeGeometry(0.18, 0.5, 8);
    const flameMat = new T.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xff4500,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.9,
    });
    const flame = new T.Mesh(flameGeom, flameMat);
    flame.position.set(0.7, 0.3, 0.4);
    flame.userData.kind = 'campfire';
    camp.add(flame);
    this.campFire = flame;

    // Lumière chaude du feu
    const campLight = new T.PointLight(0xff7733, 0.8, 4);
    campLight.position.set(0.7, 0.4, 0.4);
    camp.add(campLight);

    this.scene.add(camp);
    this.campTent = camp;
  }

  // ─── Aigle royal : petit mesh qui orbite autour du sommet ───
  private buildEagle(T: any) {
    const group = new T.Group();
    // Corps
    const bodyGeom = new T.SphereGeometry(0.18, 10, 8);
    bodyGeom.scale(1.3, 0.7, 0.7);
    const bodyMat = new T.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.7 });
    const body = new T.Mesh(bodyGeom, bodyMat);
    group.add(body);
    // Ailes : 2 planes triangulaires
    const wingGeom = new T.PlaneGeometry(0.7, 0.22);
    const wingMat = new T.MeshStandardMaterial({ color: 0x3a2818, side: T.DoubleSide, roughness: 0.8 });
    const wingL = new T.Mesh(wingGeom, wingMat);
    wingL.position.set(0, 0.05, 0.35);
    wingL.rotation.set(0, Math.PI / 12, Math.PI / 14);
    group.add(wingL);
    const wingR = new T.Mesh(wingGeom, wingMat);
    wingR.position.set(0, 0.05, -0.35);
    wingR.rotation.set(0, -Math.PI / 12, -Math.PI / 14);
    group.add(wingR);
    // Tête dorée (royal)
    const headGeom = new T.SphereGeometry(0.08, 8, 6);
    const headMat = new T.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.5, metalness: 0.3 });
    const head = new T.Mesh(headGeom, headMat);
    head.position.set(0.22, 0.04, 0);
    group.add(head);

    group.position.set(5, 16, 0);
    group.userData.tutorialId = 'eagle';
    this.scene.add(group);
    this.eagleMesh = group;
  }

  // ─── Trophées Q passés : 4 petits drapeaux au sommet ───
  private buildTrophies(T: any) {
    const past = this.pastTrophies();
    past.forEach((trophy, i) => {
      const angle = (i / past.length) * Math.PI * 2;
      const r = 1.3;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = 12.2;
      // Mini-poteau
      const poleGeom = new T.CylinderGeometry(0.03, 0.03, 0.9, 6);
      const poleMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
      const pole = new T.Mesh(poleGeom, poleMat);
      pole.position.set(x, y + 0.45, z);
      this.scene.add(pole);
      this.trophyMeshes.push(pole);
      // Drapeau
      const flagGeom = new T.PlaneGeometry(0.4, 0.25);
      const flagMat = new T.MeshStandardMaterial({
        color: trophy.color,
        emissive: trophy.color,
        emissiveIntensity: 0.5,
        side: T.DoubleSide,
      });
      const flag = new T.Mesh(flagGeom, flagMat);
      flag.position.set(x + 0.22, y + 0.75, z);
      flag.userData.kind = 'trophy';
      this.scene.add(flag);
      this.trophyMeshes.push(flag);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // WEATHER EFFECTS
  // ═══════════════════════════════════════════════════════════════
  private applyWeather() {
    const T = (window as any).THREE;
    const w = this.weather();
    // Cleanup particle systems précédents
    if (this.rainPoints) { this.scene.remove(this.rainPoints); this.rainPoints = null; }
    if (this.snowPoints) { this.scene.remove(this.snowPoints); this.snowPoints = null; }

    if (w === 'sunny') {
      this.scene.background = new T.Color(0x9ab4cf);
      this.scene.fog = new T.FogExp2(0xb8c8e0, 0.012);
      this.sunLight.intensity = 1.1;
      this.sunLight.color.setHex(0xfff1d0);
      this.ambientLight.intensity = 0.6;
    } else if (w === 'rainy') {
      this.scene.background = new T.Color(0x4a5867);
      this.scene.fog = new T.FogExp2(0x4a5867, 0.030);
      this.sunLight.intensity = 0.3;
      this.sunLight.color.setHex(0xa0aab8);
      this.ambientLight.intensity = 0.35;
      this.createRain(T, 600);
    } else if (w === 'stormy') {
      this.scene.background = new T.Color(0x1f1f2e);
      this.scene.fog = new T.FogExp2(0x1f1f2e, 0.035);
      this.sunLight.intensity = 0.12;
      this.sunLight.color.setHex(0x6070a8);
      this.ambientLight.intensity = 0.2;
      this.createRain(T, 800);
      // les flashs d'éclair sont gérés dans animate()
    } else if (w === 'snowy') {
      this.scene.background = new T.Color(0x9caec6);
      this.scene.fog = new T.FogExp2(0xb6c4d6, 0.022);
      this.sunLight.intensity = 0.55;
      this.sunLight.color.setHex(0xe8eeff);
      this.ambientLight.intensity = 0.55;
      this.createSnow(T, 700);
    }
  }

  private createRain(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0x8aa4c8,
      size: 0.12,
      transparent: true,
      opacity: 0.75,
    });
    this.rainPoints = new T.Points(geom, mat);
    this.rainPoints.userData.kind = 'rain';
    this.scene.add(this.rainPoints);
  }

  private createSnow(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.92,
    });
    this.snowPoints = new T.Points(geom, mat);
    this.snowPoints.userData.kind = 'snow';
    this.scene.add(this.snowPoints);
  }

  // ═══════════════════════════════════════════════════════════════
  // POSITIONING : avatar sur la courbe
  // ═══════════════════════════════════════════════════════════════
  private updateYouPosition() {
    if (!this.youAvatar || !this.trailCurve) return;
    const t = Math.min(0.995, this.progressionPct() / 100);
    const pos = this.trailCurve.getPoint(t);
    this.youAvatar.position.set(pos.x, pos.y + 0.1, pos.z);
  }

  private updateCordeePositions() {
    if (!this.trailCurve || this.cordeeAvatars.length === 0) return;
    const members = this.cordee();
    this.cordeeAvatars.forEach((avatar, i) => {
      const m = members[i];
      if (!m) return;
      const t = Math.min(0.99, m.progressionPct / 100);
      const pos = this.trailCurve.getPoint(t);
      avatar.position.set(pos.x, pos.y + 0.08, pos.z);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════
  loadDemo() {
    // ─ Objective ─
    this.objective.set({
      id: 1,
      quarter: '2026-Q2',
      objective: 'Atteindre 10K utilisateurs actifs et $100K MRR',
      status: 'on_track',
    });

    // ─ 5 KRs avec altitudes étagées ─
    this.krs.set([
      { id: 1, title: 'Atteindre 10 000 utilisateurs actifs',  unit: 'count', target_value: 10000, current_value: 6800,  altitude_meters: 200, owner: 'Ramzy' },
      { id: 2, title: 'MRR à $100K',                            unit: 'eur',   target_value: 100000, current_value: 72000, altitude_meters: 400, owner: 'Alice' },
      { id: 3, title: 'NPS > 60',                               unit: 'count', target_value: 60,    current_value: 52,    altitude_meters: 600, owner: 'Bob'   },
      { id: 4, title: 'Réduire churn à < 3%',                   unit: '%',     target_value: 3,     current_value: 4.5,   altitude_meters: 780, owner: 'Maya'  },
      { id: 5, title: 'Lancer 3 features stratégiques',         unit: 'count', target_value: 3,     current_value: 2,     altitude_meters: 920, owner: 'Yves'  },
    ]);

    // ─ Cordée (3 membres) ─
    this.cordee.set([
      { name: 'Alice', color: '#60a5fa', progressionPct: 55 },
      { name: 'Bob',   color: '#fbbf24', progressionPct: 48 },
      { name: 'Maya',  color: '#f472b6', progressionPct: 40 },
    ]);

    // ─ 3 trophées Q passés ─
    this.pastTrophies.set([
      { quarter: '2025-Q3', label: 'Lancement MVP',     color: '#f59e0b' },
      { quarter: '2025-Q4', label: 'Series A closed',   color: '#10b981' },
      { quarter: '2026-Q1', label: 'Refonte UX livrée', color: '#3b82f6' },
    ]);

    // Progression globale = moyenne des KRs
    const krs = this.krs();
    const avg = krs.reduce((s, k) => {
      const pct = k.unit === '%' && k.title.includes('churn')
        ? Math.max(0, Math.min(100, ((k.target_value / Math.max(k.current_value, 0.01))) * 100))
        : Math.min(100, (k.current_value / k.target_value) * 100);
      return s + pct;
    }, 0) / krs.length;
    this.progressionPct.set(Math.round(avg));

    this.buildMountain();
    this.applyWeather();
    this.emitCeremony({ type: 'dawn', label: '🌅 Aube du trimestre · Q2 ouvert', icon: '🌅' });
  }

  // ═══════════════════════════════════════════════════════════════
  // INTERACTIONS
  // ═══════════════════════════════════════════════════════════════
  updateKR() {
    // Bouton "Update KR" : avance le KR le moins avancé
    const krs = this.krs();
    if (krs.length === 0) return;
    const sorted = [...krs].sort((a, b) => (a.current_value / a.target_value) - (b.current_value / b.target_value));
    const target = sorted[0];
    const remaining = target.target_value - target.current_value;
    const bump = remaining > 0
      ? Math.max(target.target_value * 0.08, remaining * 0.15)
      : -target.target_value * 0.05;  // si KR négatif (churn), descend
    target.current_value = Math.max(0, target.current_value + bump);
    this.krs.set([...krs]);
    // Recalcule progression globale
    const avg = this.krs().reduce((s, k) => s + Math.min(100, (k.current_value / k.target_value) * 100), 0) / this.krs().length;
    this.progressionPct.set(Math.min(100, Math.round(avg)));
    this.updateYouPosition();
    // Avance aussi la cordée un peu
    this.cordee.set(this.cordee().map(m => ({ ...m, progressionPct: Math.min(95, m.progressionPct + 3) })));
    this.updateCordeePositions();

    if (this.progressionPct() >= 100) {
      this.emitCeremony({ type: 'summit', label: '⛰ Sommet conquis ! Objectif atteint', icon: '⛰' });
    } else if (this.progressionPct() >= 50 && this.progressionPct() < 55) {
      this.emitCeremony({ type: 'solstice', label: '🌌 Solstice mid-trimestre · check-in', icon: '🌌' });
    } else {
      this.emitCeremony({ type: 'flag', label: `🏴 KR "${target.title}" mis à jour`, icon: '🏴' });
    }
  }

  toggleWeather() {
    const cycle: WeatherState[] = ['sunny', 'rainy', 'stormy', 'snowy'];
    const idx = cycle.indexOf(this.weather());
    const next = cycle[(idx + 1) % cycle.length];
    this.weather.set(next);
    this.applyWeather();
    if (next === 'stormy') {
      this.emitCeremony({ type: 'storm', label: '⚡ Tempête · OKR à risque', icon: '⚡' });
    } else if (next === 'snowy') {
      this.emitCeremony({ type: 'solstice', label: '❄ Neige hivernale · check-in', icon: '❄' });
    } else if (next === 'sunny') {
      this.emitCeremony({ type: 'dawn', label: '☀ Beau temps revenu · on track', icon: '☀' });
    }
  }

  plantSummitFlag() {
    if (this.progressionPct() < 100) return;
    this.emitCeremony({ type: 'summit', label: '🏴 Drapeau planté · Sommet conquis !', icon: '🏴' });
    // Animation : la cloth du sommet swirls intensément (géré dans animate())
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(18, 14, 22);
    this.camera.lookAt(0, 6, 0);
    if (this.controls) this.controls.target.set(0, 6, 0);
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
    this.narrator.startTimeboxOnly(1800, 'OKR check-in');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS (invoqués par playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════════

  /** 🌅 QUARTER DAWN — boost de soleil + halo doré 5s */
  quarterDawn() {
    const T = (window as any).THREE;
    if (this.sunLight) {
      this.sunLight.userData.dawnBoostUntil = performance.now() + 5000;
    }
    if (!this.dawnHalo) {
      const haloGeom = new T.SphereGeometry(2.5, 16, 12);
      const haloMat = new T.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.0, blending: T.AdditiveBlending });
      this.dawnHalo = new T.Mesh(haloGeom, haloMat);
      this.scene.add(this.dawnHalo);
    }
    this.dawnHalo.position.set(0, 22, -8);
    this.dawnHalo.userData.fadeUntil = performance.now() + 5000;
    this.emitCeremony({ type: 'dawn', label: '🌅 Aube du trimestre · Q2 commence', icon: '🌅' });
  }

  /** 🚀 CORDÉE ASCENT — tous les membres font un saut de progression */
  cordeeAscent() {
    const now = performance.now();
    if (this.youAvatar) {
      this.youAvatar.userData.ascentJump = now;
    }
    for (const av of this.cordeeAvatars) {
      av.userData.ascentJump = now + Math.random() * 300; // slight stagger
    }
    // Bump progress
    this.cordee.set(this.cordee().map(m => ({ ...m, progressionPct: Math.min(95, m.progressionPct + 7) })));
    this.updateCordeePositions();
    this.emitCeremony({ type: 'flag', label: '🚀 Cordée avance · +7% chaque membre', icon: '🚀' });
  }

  /** 🦅 EAGLE SWOOP — l'aigle plonge sur la cordée puis remonte */
  eagleSwoop() {
    if (!this.eagleMesh) return;
    const T = (window as any).THREE;
    const start = this.eagleMesh.position.clone();
    // Target : juste au-dessus de youAvatar
    const target = this.youAvatar ? this.youAvatar.position.clone() : new T.Vector3(0, 4, 0);
    target.y += 2.5;
    this.eagleMesh.userData.swoopFrom = { x: start.x, y: start.y, z: start.z };
    this.eagleMesh.userData.swoopTo = { x: target.x, y: target.y, z: target.z };
    this.eagleMesh.userData.swoopStart = performance.now();
    this.eagleMesh.userData.swoopReturn = false;
    this.emitCeremony({ type: 'eagle', label: '🦅 Aigle Royal inspecte la cordée', icon: '🦅' });
  }

  /** ⚡ STORM BLAST — tempête brève (3s) puis retour soleil */
  stormBlast() {
    const prev = this.weather();
    this.weather.set('stormy');
    this.applyWeather();
    this.emitCeremony({ type: 'storm', label: '⚡ Tempête · OKR à risque', icon: '⚡' });
    setTimeout(() => {
      this.weather.set('sunny');
      this.applyWeather();
      this.emitCeremony({ type: 'dawn', label: '☀ Tempête écartée · KR remis sur pied', icon: '☀' });
    }, 5000);
  }

  /** 🏔 SUMMIT TRIUMPH — youAvatar saute au sommet, drapeau brille intensément */
  summitTriumph() {
    if (!this.trailCurve || !this.youAvatar) return;
    const T = (window as any).THREE;
    // Teleport youAvatar to summit
    const summit = this.trailCurve.getPoint(0.97);
    this.youAvatar.userData.triumphFrom = { x: this.youAvatar.position.x, y: this.youAvatar.position.y, z: this.youAvatar.position.z };
    this.youAvatar.userData.triumphTo = { x: summit.x, y: summit.y, z: summit.z };
    this.youAvatar.userData.triumphStart = performance.now();
    // Flag boost
    if (this.sommetCloth) {
      this.sommetCloth.userData.triumphFlash = performance.now() + 5000;
    }
    this.progressionPct.set(100);
    this.emitCeremony({ type: 'summit', label: '⛰ Sommet conquis · 100% atteint', icon: '⛰' });
  }

  // ─── Raycaster : clic plateau → ouvre side panel ───
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
    const hits = this.raycaster.intersectObjects(this.plateauMeshes, false);
    if (hits.length > 0) {
      const kr = this.krByPlateau.get(hits[0].object);
      if (kr) {
        this.selectedKR.set(kr);
        // pulse effet
        hits[0].object.scale.set(1.4, 1.4, 1.4);
        setTimeout(() => hits[0].object.scale.set(1, 1, 1), 200);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CÉRÉMONIES
  // ═══════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('okr-mountain', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEAN UP
  // ═══════════════════════════════════════════════════════════════
  private disposeMountainMeshes() {
    if (this.mountain) { this.scene.remove(this.mountain); this.mountain = null; }
    if (this.trailMesh) { this.scene.remove(this.trailMesh); this.trailMesh = null; }
    for (const p of this.plateauMeshes) p.parent?.remove(p);
    this.plateauMeshes = [];
    this.krByPlateau.clear();
    if (this.youAvatar) { this.scene.remove(this.youAvatar); this.youAvatar = null; }
    for (const a of this.cordeeAvatars) this.scene.remove(a);
    this.cordeeAvatars = [];
    if (this.sommetFlag) { this.scene.remove(this.sommetFlag); this.sommetFlag = null; }
    if (this.sommetCloth) { this.scene.remove(this.sommetCloth); this.sommetCloth = null; }
    for (const t of this.trophyMeshes) this.scene.remove(t);
    this.trophyMeshes = [];
    for (const c of this.crevasses) this.scene.remove(c);
    this.crevasses = [];
    if (this.campTent) { this.scene.remove(this.campTent); this.campTent = null; }
    if (this.eagleMesh) { this.scene.remove(this.eagleMesh); this.eagleMesh = null; }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.windTime += dt;

    // ─ Cloth du sommet : ondulation rotation Y ─
    if (this.sommetCloth) {
      this.sommetCloth.rotation.y = Math.sin(this.windTime * 2.2) * 0.35;
      this.sommetCloth.position.y = 13.9 + Math.sin(this.windTime * 1.5) * 0.04;
    }

    // ─ Petits drapeaux KR ondulent aussi ─
    for (const p of this.plateauMeshes) {
      if (p.userData?.kind === 'krFlag') {
        const phase = p.userData.windPhase || 0;
        p.rotation.y = Math.sin(this.windTime * 1.8 + phase) * 0.4;
      }
    }

    // ─ Trophées : drapeaux historiques ondulent ─
    for (const t of this.trophyMeshes) {
      if (t.userData?.kind === 'trophy') {
        t.rotation.y = Math.sin(this.windTime * 1.2 + t.position.x) * 0.3;
      }
    }

    // ─ Aigle royal : orbite autour du sommet (ou swoop cinematic) ─
    const nowMs = performance.now();
    if (this.eagleMesh) {
      const ud = this.eagleMesh.userData;
      if (ud.swoopStart) {
        // Cinematic eagleSwoop : down 1.2s → hold 0.6s → up 1.4s
        const tTotal = (nowMs - ud.swoopStart) / 1000;
        if (tTotal < 1.2) {
          const t = tTotal / 1.2;
          const e = t * (2 - t);
          this.eagleMesh.position.set(
            ud.swoopFrom.x + (ud.swoopTo.x - ud.swoopFrom.x) * e,
            ud.swoopFrom.y + (ud.swoopTo.y - ud.swoopFrom.y) * e,
            ud.swoopFrom.z + (ud.swoopTo.z - ud.swoopFrom.z) * e,
          );
        } else if (tTotal < 1.8) {
          // hold
          this.eagleMesh.position.set(ud.swoopTo.x, ud.swoopTo.y, ud.swoopTo.z);
        } else if (tTotal < 3.2) {
          const t = (tTotal - 1.8) / 1.4;
          const e = t * (2 - t);
          this.eagleMesh.position.set(
            ud.swoopTo.x + (ud.swoopFrom.x - ud.swoopTo.x) * e,
            ud.swoopTo.y + (ud.swoopFrom.y - ud.swoopTo.y) * e,
            ud.swoopTo.z + (ud.swoopFrom.z - ud.swoopTo.z) * e,
          );
        } else {
          delete ud.swoopStart;
        }
        // ailes flap rapide pendant swoop
        if (this.eagleMesh.children[1]) this.eagleMesh.children[1].rotation.z = Math.PI / 14 + Math.sin(this.windTime * 14) * 0.3;
        if (this.eagleMesh.children[2]) this.eagleMesh.children[2].rotation.z = -Math.PI / 14 - Math.sin(this.windTime * 14) * 0.3;
      } else {
        const r = 6;
        const eY = 16 + Math.sin(this.windTime * 0.8) * 0.6;
        const angle = this.windTime * 0.4;
        this.eagleMesh.position.set(Math.cos(angle) * r, eY, Math.sin(angle) * r);
        this.eagleMesh.rotation.y = -angle + Math.PI / 2;
        if (this.eagleMesh.children[1]) this.eagleMesh.children[1].rotation.z = Math.PI / 14 + Math.sin(this.windTime * 6) * 0.15;
        if (this.eagleMesh.children[2]) this.eagleMesh.children[2].rotation.z = -Math.PI / 14 - Math.sin(this.windTime * 6) * 0.15;
      }
    }

    // ─ Cinematic : sunLight dawn boost ─
    if (this.sunLight?.userData?.dawnBoostUntil && nowMs < this.sunLight.userData.dawnBoostUntil) {
      this.sunLight.intensity = 2.6 + Math.sin(this.windTime * 5) * 0.4;
    }
    // ─ Cinematic : dawnHalo fade ─
    if (this.dawnHalo && this.dawnHalo.userData.fadeUntil) {
      const remaining = (this.dawnHalo.userData.fadeUntil - nowMs) / 5000;
      const fadeIn = Math.min(1, (5 - remaining * 5) / 1);
      const fadeOut = Math.max(0, remaining);
      const opacity = Math.min(0.5, fadeIn * 0.5) * Math.min(1, fadeOut * 3);
      this.dawnHalo.material.opacity = opacity;
      const sc = 1 + Math.sin(this.windTime * 3) * 0.08;
      this.dawnHalo.scale.set(sc, sc, sc);
      if (nowMs >= this.dawnHalo.userData.fadeUntil) {
        this.dawnHalo.material.opacity = 0;
        delete this.dawnHalo.userData.fadeUntil;
      }
    }
    // ─ Cinematic : ascentJump (youAvatar + cordée) ─
    const applyJump = (mesh: any) => {
      if (!mesh?.userData?.ascentJump) return;
      const t = (nowMs - mesh.userData.ascentJump) / 800;
      if (t < 1) {
        const jumpY = Math.sin(t * Math.PI) * 0.6;
        mesh.position.y += jumpY * (1 - mesh.userData._jumpApplied || 1);
        mesh.userData._jumpApplied = jumpY;
      } else if (t < 1.1) {
        mesh.position.y -= mesh.userData._jumpApplied || 0;
        mesh.userData._jumpApplied = 0;
        delete mesh.userData.ascentJump;
      }
    };
    if (this.youAvatar) applyJump(this.youAvatar);
    for (const av of this.cordeeAvatars) applyJump(av);

    // ─ Cinematic : youAvatar triumph teleport (1.5s arc) ─
    if (this.youAvatar?.userData?.triumphStart) {
      const ud = this.youAvatar.userData;
      const tT = (nowMs - ud.triumphStart) / 1500;
      if (tT < 1) {
        const e = tT * (2 - tT);
        const peak = Math.max(ud.triumphFrom.y, ud.triumphTo.y) + 3;
        const ybase = ud.triumphFrom.y + (ud.triumphTo.y - ud.triumphFrom.y) * e;
        const arc = (peak - Math.max(ud.triumphFrom.y, ud.triumphTo.y)) * (4 * tT * (1 - tT));
        this.youAvatar.position.set(
          ud.triumphFrom.x + (ud.triumphTo.x - ud.triumphFrom.x) * e,
          ybase + arc,
          ud.triumphFrom.z + (ud.triumphTo.z - ud.triumphFrom.z) * e,
        );
      } else {
        delete ud.triumphStart;
      }
    }

    // ─ Cinematic : sommetCloth triumphFlash ─
    if (this.sommetCloth?.userData?.triumphFlash && nowMs < this.sommetCloth.userData.triumphFlash) {
      this.sommetCloth.material.emissiveIntensity = 2.0 + Math.sin(this.windTime * 8) * 0.8;
    } else if (this.sommetCloth && this.sommetCloth.material.emissiveIntensity > 0.6) {
      this.sommetCloth.material.emissiveIntensity = Math.max(0.55, this.sommetCloth.material.emissiveIntensity - 0.05);
    }

    // ─ Feu de camp : flicker ─
    if (this.campFire) {
      this.campFire.scale.y = 1 + Math.sin(this.windTime * 8) * 0.18;
      this.campFire.scale.x = 1 + Math.sin(this.windTime * 7.3) * 0.1;
    }

    // ─ Halo joueur : oscillation ─
    if (this.youAvatar && this.youAvatar.children[2]) {
      this.youAvatar.children[2].rotation.z = this.windTime * 1.5;
      this.youAvatar.children[2].position.y = 0.7 + Math.sin(this.windTime * 2.5) * 0.08;
    }

    // ─ Rain particles : tombent ─
    if (this.rainPoints) {
      const pos = this.rainPoints.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 0.55;
        if (y < -1) y = 22;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // ─ Snow particles : flottent en tombant doucement ─
    if (this.snowPoints) {
      const pos = this.snowPoints.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 0.08;
        let x = pos.getX(i) + Math.sin(this.windTime + i * 0.1) * 0.02;
        if (y < -1) { y = 22; x = (Math.random() - 0.5) * 50; }
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }

    // ─ Tempête : éclairs aléatoires ─
    if (this.weather() === 'stormy') {
      if (this.windTime > this.lightningNextAt) {
        this.lightningLight.intensity = 4 + Math.random() * 3;
        this.lightningLight.position.set(
          (Math.random() - 0.5) * 20,
          14 + Math.random() * 6,
          (Math.random() - 0.5) * 20,
        );
        // brève impulsion puis decay
        setTimeout(() => { if (this.lightningLight) this.lightningLight.intensity *= 0.4; }, 80);
        setTimeout(() => { if (this.lightningLight) this.lightningLight.intensity = 0; }, 200);
        this.lightningNextAt = this.windTime + 2 + Math.random() * 4;
      }
    } else {
      this.lightningLight.intensity = 0;
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.windTime);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILS template
  // ═══════════════════════════════════════════════════════════════
  krCompletionPct(kr: MountainKR): number {
    if (!kr.target_value) return 0;
    return Math.min(100, Math.round((kr.current_value / kr.target_value) * 100));
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
