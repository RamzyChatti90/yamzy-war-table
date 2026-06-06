// ═══════════════════════════════════════════════════════════════════
// ⛵ RETROSPECTIVE COVE ROOM — Le Cercle du Rétroviseur
//
// Sprint retrospective format Sailboat (Glad/Sad/Mad + Actions).
//
// Métaphore :
//   - Le navire 3D au centre = l'équipe
//   - L'île verte à l'horizon = l'objectif sprint (la mission)
//   - Vent qui gonfle les voiles = ce qui marche (Glad ✓)
//   - Ancres qui tombent = ce qui freine (Sad ✗)
//   - Récifs émergés = risques / frustrations (Mad ⚠)
//   - Drapeaux plantés sur l'île = actions concrètes (🎯)
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine + sky-ornaments + ceremony-bus.
//
// Cérémonies émises :
//   🌬 vent       = items Glad → sky aurora
//   ⚓ ancres     = items Sad  → sky solar-storm
//   🪨 récifs     = items Mad  → sky meteor
//   🏁 drapeaux   = actions    → sky shooting-star (flag)
//   ⛵ sommet     = navire arrive à l'île (rétro accomplie)
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
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { playIslandIntro } from '../../core/island-intro/island-intro';
import { SpellButtonComponent, SpellTutorialOverlayComponent, TutorialStep, SpellFooterService } from '../../core/spell-ui';

// ─── Modèles métier (sticky notes par zone) ───
type SailboatZone = 'wind' | 'anchor' | 'reef' | 'island';

interface RetroNote {
  id: number;
  zone: SailboatZone;
  text: string;
  author: string;
  authorColor: string;
}

interface AnchorHandle {
  group: any;          // groupe THREE de l'ancre + chaîne
  basePhase: number;
  swingPhase: number;
}

interface ReefHandle {
  mesh: any;           // icosaèdre du récif
  basePhase: number;
  foam: any;           // petites particules d'écume
}

interface FlagHandle {
  group: any;          // mât + drapeau planté sur l'île
  fabric: any;         // PlaneGeometry du drapeau
  baseRotZ: number;
}

@Component({
  selector: 'wt-retrospective-cove-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rc-host">
      <header class="rc-topbar">
        <div class="rc-title">
          <h1>⛵ Le Cercle du Rétroviseur — Retrospective Sailboat</h1>
          <p>Rétro Sailboat — vent ({{ noteCount('wind') }}) · ancres ({{ noteCount('anchor') }}) · récifs ({{ noteCount('reef') }}) · île ({{ noteCount('island') }})</p>
        </div>
      </header>

      <canvas #canvas class="rc-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="rc-flash" [attr.data-type]="f.type">
        <div class="rc-flash-content">
          <div class="rc-flash-icon">{{ f.icon }}</div>
          <div class="rc-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Sidebar : 4 zones de sticky notes -->
      <aside class="rc-sidebar">
        <div class="rc-zone" data-zone="wind">
          <div class="rc-zone-head">
            <span class="rc-zone-icon">🎉</span>
            <span class="rc-zone-label">Glad — Le Vent qui pousse</span>
            <span class="rc-zone-count">{{ noteCount('wind') }}</span>
          </div>
          <div class="rc-zone-list">
            <div *ngFor="let n of notesIn('wind')" class="rc-sticky" [style.--c]="n.authorColor">
              <span class="rc-sticky-text">{{ n.text }}</span>
              <span class="rc-sticky-author">— {{ n.author }}</span>
            </div>
          </div>
        </div>

        <div class="rc-zone" data-zone="anchor">
          <div class="rc-zone-head">
            <span class="rc-zone-icon">😢</span>
            <span class="rc-zone-label">Sad — Les Ancres qui freinent</span>
            <span class="rc-zone-count">{{ noteCount('anchor') }}</span>
          </div>
          <div class="rc-zone-list">
            <div *ngFor="let n of notesIn('anchor')" class="rc-sticky" [style.--c]="n.authorColor">
              <span class="rc-sticky-text">{{ n.text }}</span>
              <span class="rc-sticky-author">— {{ n.author }}</span>
            </div>
          </div>
        </div>

        <div class="rc-zone" data-zone="reef">
          <div class="rc-zone-head">
            <span class="rc-zone-icon">😡</span>
            <span class="rc-zone-label">Mad — Les Récifs qui menacent</span>
            <span class="rc-zone-count">{{ noteCount('reef') }}</span>
          </div>
          <div class="rc-zone-list">
            <div *ngFor="let n of notesIn('reef')" class="rc-sticky" [style.--c]="n.authorColor">
              <span class="rc-sticky-text">{{ n.text }}</span>
              <span class="rc-sticky-author">— {{ n.author }}</span>
            </div>
          </div>
        </div>

        <div class="rc-zone" data-zone="island">
          <div class="rc-zone-head">
            <span class="rc-zone-icon">🎯</span>
            <span class="rc-zone-label">Actions — Les Drapeaux sur l'Île</span>
            <span class="rc-zone-count">{{ noteCount('island') }}</span>
          </div>
          <div class="rc-zone-list">
            <div *ngFor="let n of notesIn('island')" class="rc-sticky" [style.--c]="n.authorColor">
              <span class="rc-sticky-text">{{ n.text }}</span>
              <span class="rc-sticky-author">— {{ n.author }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- 🎬 Splash overlay (welcome screen avant entrée) -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Retrospective Sailboat"
        loreName="Le Cercle du Rétroviseur"
        color="#67e8f9"
        oneLiner="Sprint retro Sailboat : vent (Glad), ancres (Sad), récifs (Mad), île (Actions)."
        [duration]="75"
        [timeboxDurationS]="5400"
        [timeboxLabel]="'Lancer Retro'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Retrospective Sailboat"
        loreName="Le Cercle du Rétroviseur"
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
    .rc-host { position: relative; width: 100%; height: 100vh; background: #061626; color: #cffafe; font-family: "Tinos", serif; }

    /* ═══ Topbar ═══ */
    .rc-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .rc-topbar > * { pointer-events: auto; }
    .rc-back { color: #67e8f9; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #155e75; border-radius: 8px; background: rgba(6,30,48,0.55); }
    .rc-back:hover { background: rgba(21,94,117,0.65); }
    .rc-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 17px; letter-spacing: 0.6px; color: #67e8f9; text-shadow: 0 0 12px rgba(103,232,249,0.45); }
    .rc-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.75; }
    .rc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .rc-btn { background: rgba(6,30,48,0.7); color: #cffafe; border: 1px solid #155e75; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .rc-btn:hover { background: rgba(21,94,117,0.75); box-shadow: 0 0 10px rgba(103,232,249,0.3); }
    .rc-btn.rc-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .rc-btn.rc-narrator:hover { background: rgba(251,191,36,0.3); }
    .rc-btn.rc-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; font-weight: 600; }
    .rc-btn.rc-play:hover { background: #f5b923; }

    .rc-canvas { display: block; width: 100%; height: 100%; }

    /* ═══ Sidebar 4 zones ═══ */
    .rc-sidebar { position: absolute; right: 14px; top: 80px; bottom: 14px; width: 320px; display: flex; flex-direction: column; gap: 10px; z-index: 8; overflow-y: auto; padding-right: 4px; }
    .rc-zone { background: rgba(6,30,48,0.88); border: 1px solid #155e75; border-radius: 12px; backdrop-filter: blur(8px); padding: 10px; }
    .rc-zone[data-zone="wind"]    { border-left: 4px solid #86efac; }
    .rc-zone[data-zone="anchor"]  { border-left: 4px solid #93c5fd; }
    .rc-zone[data-zone="reef"]    { border-left: 4px solid #fb7185; }
    .rc-zone[data-zone="island"]  { border-left: 4px solid #facc15; }
    .rc-zone-head { display: flex; align-items: center; gap: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(103,232,249,0.18); margin-bottom: 8px; }
    .rc-zone-icon { font-size: 17px; }
    .rc-zone-label { flex: 1; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #cffafe; opacity: 0.85; font-weight: 700; }
    .rc-zone-count { font-size: 11px; opacity: 0.65; font-variant-numeric: tabular-nums; }
    .rc-zone-list { display: flex; flex-direction: column; gap: 5px; max-height: 140px; overflow-y: auto; }
    .rc-sticky { padding: 6px 9px; background: rgba(255,255,255,0.05); border-left: 3px solid var(--c, #67e8f9); border-radius: 5px; font-size: 11px; display: flex; flex-direction: column; gap: 2px; }
    .rc-sticky-text { color: #f1f5f9; line-height: 1.35; }
    .rc-sticky-author { font-size: 10px; opacity: 0.65; color: var(--c, #67e8f9); }

    /* ═══ Flash cérémonie ═══ */
    .rc-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: rc-flash-pulse 1.5s ease-out forwards; }
    .rc-flash[data-type="vent"]    { background: radial-gradient(circle at center, rgba(134,239,172,0.55), transparent 65%); }
    .rc-flash[data-type="ancre"]   { background: radial-gradient(circle at center, rgba(147,197,253,0.55), transparent 65%); }
    .rc-flash[data-type="recif"]   { background: radial-gradient(circle at center, rgba(251,113,133,0.55), transparent 65%); }
    .rc-flash[data-type="flag"]    { background: radial-gradient(circle at center, rgba(250,204,21,0.55), transparent 70%); }
    .rc-flash[data-type="sommet"]  { background: radial-gradient(circle at center, rgba(255,255,255,0.65), transparent 70%); }
    .rc-flash-content { text-align: center; animation: rc-flash-grow 1.5s cubic-bezier(0.16, 1, 0.3, 1); }
    .rc-flash-icon  { font-size: 100px; line-height: 1; filter: drop-shadow(0 0 28px rgba(255,255,255,0.7)); }
    .rc-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.5); }
    @keyframes rc-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes rc-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
  `]
})
export class RetrospectiveCoveRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── Injects ───
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);
  private router = inject(Router);

  // ─── État réactif (signals) ───
  notes = signal<RetroNote[]>([]);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '⛵', title: 'Le voilier = votre équipe', body: 'Le navire au centre représente votre équipe en sprint. Les autres éléments classent ce qui s\'est passé.' },
    { icon: '💨', title: 'Vent = Glad (ce qui propulse)', body: 'Le vent qui gonfle les voiles symbolise les forces : bonnes pratiques, succès, énergies qui ont fait avancer l\'équipe.' },
    { icon: '⚓', title: 'Ancres = Sad (ce qui ralentit)', body: 'Les ancres qui traînent au fond sont les frictions qui ont freiné : process lourds, blocages, incompréhensions.' },
    { icon: '🪨', title: 'Récifs = Mad (ce qui frustre)', body: 'Les récifs émergés sont les frustrations vives : conflits non dits, échecs douloureux, sources de colère à exprimer.' },
    { icon: '🏝', title: 'Île = Actions à embarquer', body: 'L\'île au loin est la destination du prochain sprint. Les actions correctives décidées y sont plantées comme drapeaux.' },
  ];
  tutorialVoiceLines: string[] = [
    'Le voilier au centre, c\'est votre équipe.',
    'Le vent gonfle les voiles : ce qui propulse.',
    'Les ancres au fond freinent l\'équipe.',
    'Les récifs émergent les frustrations.',
    'L\'île au loin est la destination du prochain sprint.',
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
  private rafId = 0;
  private disposed = false;
  private controls: any;

  // ─── Sky ornaments + ceremony bus ───
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;

  // ─── 3D refs ───
  private ocean: any;                       // plane mer ondulant
  private oceanBase: Float32Array | null = null;
  private sailboat: any;                    // group navire entier
  private sailLeft: any;                    // voile gauche (triangle)
  private sailRight: any;                   // voile droite
  private flagShip: any;                    // drapeau au sommet du mât
  private island: any;                      // groupe île verte
  private anchors: AnchorHandle[] = [];     // 3-4 ancres tombantes
  private reefs: ReefHandle[] = [];         // 2-3 récifs émergés
  private flagsIsland: FlagHandle[] = [];   // drapeaux plantés sur l'île
  private floatingLabels: any[] = [];       // 4 sprites flottants 🎉😢😡🎯

  // ─── Animation state ───
  private elapsed = 0;
  private ceremonyFlashTimer: any = null;

  // ─── Cinematic state ───
  /** Score équipe : 0 = stagne, 1 = file vers l'île. Anim du navire. */
  private teamScore = 0.0;
  /** Phase d'arrivée du navire à l'île (0..1, modifié par sailToIsland) */
  private arrivalProgress = 0.0;
  private arrivalActive = false;

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#67e8f9',
      controls: [
        { icon: '🎓', label: 'Tutorial', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée par Yamzy' },
        { icon: '▶', label: 'Play example', variant: 'primary', action: () => this.narrator.startPlayExample(), title: 'Démo animée' },
        { icon: '🎬', label: 'Demo notes', action: () => this.loadDemo() },
        { icon: '🎥', label: 'Reset cam', action: () => this.resetCamera() },
      ],
    });
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
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

    // ─── Scene + fog côtier bleu nuit ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x061626);
    this.scene.fog = new T.FogExp2(0x0a2540, 0.018);

    // ─── Camera : vue 3/4 du navire vers l'île ───
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 250);
    this.camera.position.set(10, 8, 14);
    this.camera.lookAt(0, 2, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lights : lune douce + ambient océan ───
    this.scene.add(new T.AmbientLight(0x4a6b8a, 0.55));
    const moonLight = new T.DirectionalLight(0xcffafe, 0.85);
    moonLight.position.set(-12, 18, -8);
    this.scene.add(moonLight);
    const horizon = new T.HemisphereLight(0x67e8f9, 0x0a2540, 0.45);
    this.scene.add(horizon);

    // ─── Build scene ───
    this.buildOcean(T);
    this.buildSailboat(T);
    this.buildIsland(T);
    this.buildAnchors(T);
    this.buildReefs(T);
    this.buildFloatingLabels(T);

    // ─── Sky universel (synchronisé via CeremonyBus) ───
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 500,
      starRadius: 75,
      moonPos: [-26, 22, -28],
      auroraPos: [0, 28, -40],
      cometPos: [22, 24, -22],
      shootingStarCount: 5,
    });
    // Anti-loop : on n'écoute pas les cérémonies qu'on émet nous-mêmes
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'retrospective-cove') return;
      this.sky?.pulseCeremony(c.type);
    });

    // ─── OrbitControls ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 2, 0);
      this.controls.maxDistance = 50;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI / 2.05; // pas sous l'eau
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[RetrospectiveCove] ⛵ Scene ready · ocean, sailboat, island, anchors, reefs');

    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'retrospective-cove',
    });

    // ─── Animate loop d'abord (sinon playIslandIntro ne voit pas la scène évoluer) ───
    this.animate();

    // 🎬 Intro cinématique : caméra vue d'oiseau qui zoom vers le navire
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 10, y: 8, z: 14 },
      { x: 0, y: 2, z: 0 },
      3.5,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : océan ondulant (grand plane avec sin waves sur Y)
  // ═══════════════════════════════════════════════════════════════════
  private buildOcean(T: any) {
    const oceanGeom = new T.PlaneGeometry(180, 180, 56, 56);
    const oceanMat = new T.MeshStandardMaterial({
      color: 0x0e7490,
      roughness: 0.45,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92,
      emissive: 0x083344,
      emissiveIntensity: 0.18,
    });
    this.ocean = new T.Mesh(oceanGeom, oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = 0;
    // Save positions d'origine pour ondulation
    const arr = oceanGeom.attributes.position.array as Float32Array;
    this.oceanBase = new Float32Array(arr.length);
    this.oceanBase.set(arr);
    this.scene.add(this.ocean);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sailboat (procedural — hull box, mast cylindre, voiles triangulaires)
  // ═══════════════════════════════════════════════════════════════════
  private buildSailboat(T: any) {
    const ship = new T.Group();
    ship.position.set(0, 0.4, 0);
    ship.userData.tutorialId = 'sailboat';
    ship.userData.baseY = 0.4;

    // ─── Coque : box étirée vers la proue (gradient bois sombre) ───
    const hullGeom = new T.BoxGeometry(1.6, 0.55, 3.6);
    const hullMat = new T.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.85,
      metalness: 0.1,
      emissive: 0x2a1810,
      emissiveIntensity: 0.18,
    });
    const hull = new T.Mesh(hullGeom, hullMat);
    hull.position.y = 0;
    ship.add(hull);

    // ─── Proue : cone plat à l'avant (renforce le profil bateau) ───
    const bowGeom = new T.ConeGeometry(0.8, 0.95, 4, 1);
    const bow = new T.Mesh(bowGeom, hullMat);
    bow.position.set(0, -0.05, 2.05);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4; // aligne les 4 faces du cone avec la coque
    ship.add(bow);

    // ─── Pont (top) : plane bois clair ───
    const deckGeom = new T.BoxGeometry(1.5, 0.06, 3.4);
    const deckMat = new T.MeshStandardMaterial({
      color: 0xb4895a, roughness: 0.78, metalness: 0.1,
    });
    const deck = new T.Mesh(deckGeom, deckMat);
    deck.position.y = 0.31;
    ship.add(deck);

    // ─── Mât : cylindre vertical ───
    const mastGeom = new T.CylinderGeometry(0.07, 0.09, 4.2, 10);
    const mastMat = new T.MeshStandardMaterial({
      color: 0x8b5a2b, roughness: 0.75, metalness: 0.18,
    });
    const mast = new T.Mesh(mastGeom, mastMat);
    mast.position.set(0, 2.4, 0.2);
    ship.add(mast);
    ship.userData.tutorialId = 'sailboat';

    // ─── Vergue (yardarm horizontale) ───
    const yardGeom = new T.CylinderGeometry(0.045, 0.045, 2.4, 8);
    const yard = new T.Mesh(yardGeom, mastMat);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 3.6, 0.2);
    ship.add(yard);

    // ─── Voile gauche (triangle) ───
    const sailShape = new T.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(-1.05, 0);
    sailShape.lineTo(0, -2.2);
    sailShape.closePath();
    const sailGeomL = new T.ShapeGeometry(sailShape);
    const sailMat = new T.MeshStandardMaterial({
      color: 0xfffce8, roughness: 0.6, metalness: 0.05,
      emissive: 0x60440a, emissiveIntensity: 0.2,
      side: T.DoubleSide,
    });
    this.sailLeft = new T.Mesh(sailGeomL, sailMat);
    this.sailLeft.position.set(0, 3.55, 0.21);
    this.sailLeft.userData.baseRotY = 0;
    this.sailLeft.userData.tutorialId = 'sail';
    ship.add(this.sailLeft);

    // ─── Voile droite (miroir, triangle) ───
    const sailShapeR = new T.Shape();
    sailShapeR.moveTo(0, 0);
    sailShapeR.lineTo(1.05, 0);
    sailShapeR.lineTo(0, -2.2);
    sailShapeR.closePath();
    const sailGeomR = new T.ShapeGeometry(sailShapeR);
    this.sailRight = new T.Mesh(sailGeomR, sailMat);
    this.sailRight.position.set(0, 3.55, 0.21);
    this.sailRight.userData.baseRotY = 0;
    ship.add(this.sailRight);

    // ─── Drapeau au sommet du mât (petit plane qui flotte) ───
    const flagGeom = new T.PlaneGeometry(0.5, 0.3, 6, 3);
    const flagMat = new T.MeshStandardMaterial({
      color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.45,
      roughness: 0.5, side: T.DoubleSide,
    });
    this.flagShip = new T.Mesh(flagGeom, flagMat);
    this.flagShip.position.set(0.28, 4.55, 0.2);
    // Save originals pour flutter
    const fa = flagGeom.attributes.position.array as Float32Array;
    const flagOriginals = new Float32Array(fa.length);
    flagOriginals.set(fa);
    this.flagShip.userData.originals = flagOriginals;
    ship.add(this.flagShip);

    // ─── Petite lumière chaude sur le pont (lanterne) ───
    const shipLight = new T.PointLight(0xfdba74, 0.95, 10, 1.4);
    shipLight.position.set(0, 0.65, -1.0);
    ship.add(shipLight);

    this.sailboat = ship;
    this.scene.add(ship);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : île verte à l'horizon (cylindre disque + cone trees + plage)
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any) {
    const islandGroup = new T.Group();
    islandGroup.position.set(0, 0, -28);
    islandGroup.userData.tutorialId = 'island';

    // ─── Plage sableuse (disque large) ───
    const beachGeom = new T.CylinderGeometry(7.2, 7.8, 0.5, 32);
    const beachMat = new T.MeshStandardMaterial({
      color: 0xfde68a, roughness: 0.95, metalness: 0.05,
    });
    const beach = new T.Mesh(beachGeom, beachMat);
    beach.position.y = 0.25;
    islandGroup.add(beach);

    // ─── Plateau vert (couche supérieure) ───
    const grassGeom = new T.CylinderGeometry(5.2, 6.5, 1.0, 32);
    const grassMat = new T.MeshStandardMaterial({
      color: 0x4ade80, roughness: 0.85, metalness: 0.05,
      emissive: 0x103018, emissiveIntensity: 0.18,
    });
    const grass = new T.Mesh(grassGeom, grassMat);
    grass.position.y = 0.95;
    islandGroup.add(grass);

    // ─── Colline centrale (cone vert + relief) ───
    const hillGeom = new T.ConeGeometry(2.6, 2.8, 18, 1);
    const hillMat = new T.MeshStandardMaterial({
      color: 0x16a34a, roughness: 0.85,
      emissive: 0x052e16, emissiveIntensity: 0.18,
      flatShading: true,
    });
    const hill = new T.Mesh(hillGeom, hillMat);
    hill.position.y = 2.8;
    islandGroup.add(hill);

    // ─── Arbres sur l'île (cones verts mat) ───
    const treePositions: Array<[number, number, number]> = [
      [-2.8, 1.6, -0.4],
      [ 2.4, 1.7,  0.6],
      [-1.2, 1.6,  2.5],
      [ 2.0, 1.5, -2.2],
      [ 0.0, 1.5,  3.4],
      [-3.3, 1.6,  1.8],
    ];
    for (const p of treePositions) {
      const trunkGeom = new T.CylinderGeometry(0.1, 0.14, 0.85, 6);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      trunk.position.set(p[0], p[1] + 0.4, p[2]);
      islandGroup.add(trunk);

      const leafGeom = new T.ConeGeometry(0.55, 1.4, 8);
      const leafMat = new T.MeshStandardMaterial({
        color: 0x15803d, roughness: 0.75,
        emissive: 0x052e16, emissiveIntensity: 0.18,
      });
      const leaf = new T.Mesh(leafGeom, leafMat);
      leaf.position.set(p[0], p[1] + 1.3, p[2]);
      leaf.userData.basePos = leaf.position.clone();
      leaf.userData.phase = Math.random() * Math.PI * 2;
      leaf.userData.kind = 'island-tree';
      islandGroup.add(leaf);
    }

    // ─── Lumière douce sur l'île (vert tendre) ───
    const islandLight = new T.PointLight(0xa7f3d0, 1.0, 15, 1.5);
    islandLight.position.set(0, 3.5, 0);
    islandGroup.add(islandLight);

    this.island = islandGroup;
    this.scene.add(islandGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : ancres tombantes (cones inversés + chaînes en ligne)
  // ═══════════════════════════════════════════════════════════════════
  private buildAnchors(T: any) {
    // Positions sous le navire (3 ancres + 1 ancre 'principale')
    const anchorOffsets: Array<[number, number, number]> = [
      [-0.7, -1.6, -0.4],
      [ 0.6, -2.2,  0.3],
      [-0.3, -1.9,  0.6],
      [ 0.5, -2.6, -0.5],
    ];
    for (let i = 0; i < anchorOffsets.length; i++) {
      const off = anchorOffsets[i];
      const grp = new T.Group();
      grp.position.set(off[0], off[1], off[2]);

      // ─── Cone inversé (la base est le corps de l'ancre) ───
      const anchorBodyGeom = new T.ConeGeometry(0.28, 0.85, 6);
      const anchorMat = new T.MeshStandardMaterial({
        color: 0x52525b, roughness: 0.55, metalness: 0.75,
        emissive: 0x18181b, emissiveIntensity: 0.18,
      });
      const anchorBody = new T.Mesh(anchorBodyGeom, anchorMat);
      anchorBody.rotation.x = Math.PI; // pointe vers le bas (sous l'eau)
      anchorBody.position.y = -0.4;
      grp.add(anchorBody);

      // ─── Anneau d'attache au-dessus ───
      const ringGeom = new T.TorusGeometry(0.14, 0.04, 6, 12);
      const ring = new T.Mesh(ringGeom, anchorMat);
      ring.position.y = 0.15;
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);

      // ─── Bras de l'ancre (2 barres en croix) ───
      const armGeom = new T.BoxGeometry(0.55, 0.06, 0.08);
      const arm1 = new T.Mesh(armGeom, anchorMat);
      arm1.position.y = -0.65;
      grp.add(arm1);
      const arm2 = new T.Mesh(armGeom, anchorMat);
      arm2.position.y = -0.65;
      arm2.rotation.y = Math.PI / 2;
      grp.add(arm2);

      // ─── Chaîne reliant l'ancre au navire (Line vertical) ───
      const chainMat = new T.LineBasicMaterial({ color: 0x9ca3af, transparent: true, opacity: 0.75 });
      const chainGeom = new T.BufferGeometry();
      const yTopAbs = 0.2; // position du navire en monde
      const chainPoints = new Float32Array([
        0, 0.18, 0,
        0, yTopAbs - off[1], 0,
      ]);
      chainGeom.setAttribute('position', new T.BufferAttribute(chainPoints, 3));
      const chain = new T.Line(chainGeom, chainMat);
      grp.add(chain);

      grp.userData.tutorialId = i === 0 ? 'anchor' : undefined;
      this.anchors.push({
        group: grp,
        basePhase: Math.random() * Math.PI * 2,
        swingPhase: Math.random() * Math.PI * 2,
      });
      // Les ancres font partie du sailboat group → swing avec le bateau
      if (this.sailboat) this.sailboat.add(grp);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : récifs (icosaèdres + foam particles)
  // ═══════════════════════════════════════════════════════════════════
  private buildReefs(T: any) {
    const reefPositions: Array<[number, number, number]> = [
      [-8.5, 0.0, -10.0],
      [ 7.5, 0.0, -12.0],
      [-9.0, 0.0,  -5.0],
    ];
    for (let i = 0; i < reefPositions.length; i++) {
      const p = reefPositions[i];
      const reefGeom = new T.IcosahedronGeometry(1.2 + Math.random() * 0.5, 0);
      const reefMat = new T.MeshStandardMaterial({
        color: 0x57534e, roughness: 0.9, metalness: 0.15,
        emissive: 0x1c1917, emissiveIntensity: 0.22,
        flatShading: true,
      });
      const mesh = new T.Mesh(reefGeom, reefMat);
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.set(Math.random(), Math.random() * Math.PI * 2, Math.random());
      mesh.userData.tutorialId = i === 0 ? 'reef' : undefined;
      this.scene.add(mesh);

      // ─── Foam particles autour du récif (petits points blancs) ───
      const foamCount = 24;
      const foamPositions = new Float32Array(foamCount * 3);
      for (let j = 0; j < foamCount; j++) {
        const angle = (j / foamCount) * Math.PI * 2;
        const radius = 1.6 + Math.random() * 0.6;
        foamPositions[j * 3 + 0] = Math.cos(angle) * radius;
        foamPositions[j * 3 + 1] = 0.05 + Math.random() * 0.15;
        foamPositions[j * 3 + 2] = Math.sin(angle) * radius;
      }
      const foamGeom = new T.BufferGeometry();
      foamGeom.setAttribute('position', new T.BufferAttribute(foamPositions, 3));
      const foamMat = new T.PointsMaterial({
        color: 0xe0f2fe, size: 0.18, sizeAttenuation: true,
        transparent: true, opacity: 0.75,
        blending: T.AdditiveBlending, depthWrite: false,
      });
      const foam = new T.Points(foamGeom, foamMat);
      foam.position.set(p[0], 0, p[2]);
      this.scene.add(foam);

      this.reefs.push({
        mesh,
        basePhase: Math.random() * Math.PI * 2,
        foam,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 4 emoji-text sprites flottants au-dessus du navire (🎉😢😡🎯)
  // ═══════════════════════════════════════════════════════════════════
  private buildFloatingLabels(T: any) {
    const labelData = [
      { emoji: '🎉', label: 'Glad',    color: '#86efac', zone: 'wind'   as SailboatZone, pos: [-3.2, 5.5,  1.2] },
      { emoji: '😢', label: 'Sad',     color: '#93c5fd', zone: 'anchor' as SailboatZone, pos: [-3.2, 4.0, -1.2] },
      { emoji: '😡', label: 'Mad',     color: '#fb7185', zone: 'reef'   as SailboatZone, pos: [ 3.2, 4.0, -1.2] },
      { emoji: '🎯', label: 'Actions', color: '#facc15', zone: 'island' as SailboatZone, pos: [ 3.2, 5.5,  1.2] },
    ];
    for (const d of labelData) {
      const sprite = this.makeTextSprite(T, d.emoji + ' ' + d.label, d.color);
      sprite.position.set(d.pos[0], d.pos[1], d.pos[2]);
      sprite.userData.basePos = sprite.position.clone();
      sprite.userData.phase = Math.random() * Math.PI * 2;
      sprite.userData.zone = d.zone;
      sprite.userData.tutorialId = `label-${d.zone}`;
      this.scene.add(sprite);
      this.floatingLabels.push(sprite);
    }
  }

  /** Crée un Sprite avec un canvas-text (emoji + label) — utilisé pour les 4 zones */
  private makeTextSprite(T: any, text: string, color: string): any {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fond translucide + bord coloré
    ctx.fillStyle = 'rgba(6, 30, 48, 0.78)';
    this.roundedRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 18);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    this.roundedRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 18);
    ctx.stroke();
    // Texte
    ctx.fillStyle = color;
    ctx.font = 'bold 48px "Segoe UI Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new T.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const mat = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(2.2, 0.82, 1); // ratio canvas (256:96 ≈ 2.67:1, on raccourcit un peu)
    return sprite;
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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
    this.narrator.startTimeboxOnly(5400, 'Sprint Retrospective');
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA — sticky notes par zone
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const authors = [
      { name: 'Ramzy', color: '#86efac' },
      { name: 'Alice', color: '#60a5fa' },
      { name: 'Bob',   color: '#fb923c' },
      { name: 'Maya',  color: '#f472b6' },
      { name: 'Yves',  color: '#a78bfa' },
    ];
    const demo: Array<Omit<RetroNote, 'id'>> = [
      // 🎉 Glad — Vent
      { zone: 'wind', text: 'Pair programming a fluidifié les reviews',  author: 'Alice', authorColor: '#60a5fa' },
      { zone: 'wind', text: 'Démo client réussie + feedback enthousiaste', author: 'Ramzy', authorColor: '#86efac' },
      { zone: 'wind', text: 'Nouveau pipeline CI 3× plus rapide',        author: 'Bob',   authorColor: '#fb923c' },
      // 😢 Sad — Ancres
      { zone: 'anchor', text: 'Onboarding nouvelle dev a pris 2 semaines', author: 'Maya', authorColor: '#f472b6' },
      { zone: 'anchor', text: 'Spec ambiguë sur module billing',           author: 'Yves', authorColor: '#a78bfa' },
      { zone: 'anchor', text: 'Tests E2E flaky sur Chrome',                author: 'Alice', authorColor: '#60a5fa' },
      // 😡 Mad — Récifs
      { zone: 'reef', text: 'Réunion qui dérape (2h au lieu de 30min)',   author: 'Ramzy', authorColor: '#86efac' },
      { zone: 'reef', text: 'Bug prod détecté seulement après déploiement', author: 'Bob',  authorColor: '#fb923c' },
      // 🎯 Île — Actions
      { zone: 'island', text: 'Mettre en place dot-voting pour réunions', author: 'Maya', authorColor: '#f472b6' },
      { zone: 'island', text: 'Rédiger un onboarding kit (Notion)',       author: 'Yves', authorColor: '#a78bfa' },
      { zone: 'island', text: 'Stabiliser tests E2E (retry policy)',      author: 'Alice', authorColor: '#60a5fa' },
    ];
    const list: RetroNote[] = demo.map((n, i) => ({ ...n, id: i + 1 }));
    this.notes.set(list);

    // Reconstruit les drapeaux plantés sur l'île selon le nombre d'actions
    this.rebuildIslandFlags();

    this.emitCeremony({ type: 'sommet', label: 'Retro chargée · 11 sticky notes', icon: '⛵' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('retrospective-cove', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1500);
  }

  /** Méthode publique appelée depuis le JSON tutorial via narrator.invokeMethod */
  public emitCeremonyPublic(c: { type: string; label: string; icon: string }) {
    this.emitCeremony(c);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS (invoqués par playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════════

  /** 🌬 GLAD WIND — voiles gonflent + emit cérémonie 'vent' */
  windGladSurge() {
    if (this.sailLeft) this.sailLeft.userData.boostUntil = performance.now() + 6000;
    if (this.sailRight) this.sailRight.userData.boostUntil = performance.now() + 6000;
    // Score équipe monte → le navire commence à avancer
    this.teamScore = Math.min(1.0, this.teamScore + 0.35);
    this.emitCeremony({ type: 'vent', label: '🌬 Vent qui pousse · Glad notes', icon: '🎉' });
  }

  /** ⚓ SAD ANCHORS — ancres tombent (anim plonge) + emit cérémonie 'ancre' */
  anchorsDrop() {
    for (let i = 0; i < this.anchors.length; i++) {
      const a = this.anchors[i];
      a.group.userData.dropStart = performance.now() + i * 220;
      a.group.userData.dropDur = 1500;
      a.group.userData.dropFromY = a.group.position.y;
      a.group.userData.dropToY = a.group.position.y - 1.2;
    }
    // Score équipe redescend
    this.teamScore = Math.max(0, this.teamScore - 0.25);
    this.emitCeremony({ type: 'ancre', label: '⚓ Ancres tombent · Sad notes', icon: '😢' });
  }

  /** 🪨 MAD REEFS — récifs pulsent + foam giclent + cérémonie 'recif' */
  reefsEmerge() {
    for (const r of this.reefs) {
      r.mesh.userData.pulseUntil = performance.now() + 5500;
    }
    this.emitCeremony({ type: 'recif', label: '🪨 Récifs émergent · Mad notes', icon: '😡' });
  }

  /** 🏁 ACTIONS PLANT — drapeaux plantés sur l'île, glow boost + cérémonie 'flag' */
  plantActionFlags() {
    // Construit les drapeaux (si pas déjà fait) puis booste leur emissive
    this.rebuildIslandFlags();
    const now = performance.now();
    for (const f of this.flagsIsland) {
      const fabricMat = f.fabric?.material;
      if (fabricMat) {
        fabricMat.userData = fabricMat.userData || {};
        fabricMat.userData.glowUntil = now + 6000;
      }
    }
    // Score équipe boosté par les actions concrètes
    this.teamScore = Math.min(1.0, this.teamScore + 0.4);
    this.emitCeremony({ type: 'flag', label: '🏁 Drapeaux plantés · Actions concrètes', icon: '🎯' });
  }

  /** ⛵ SAIL TO ISLAND — le navire avance vers l'île (équipe alignée) */
  sailToIsland() {
    this.arrivalActive = true;
    this.arrivalProgress = 0;
    this.teamScore = 1.0;
    this.emitCeremony({ type: 'sommet', label: '⛵ Navire vers l\'île · Équipe alignée', icon: '⛵' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : drapeaux plantés sur l'île (un par action / zone='island')
  // ═══════════════════════════════════════════════════════════════════
  private rebuildIslandFlags() {
    const T = (window as any).THREE;
    if (!T || !this.island) return;
    // Cleanup les anciens
    for (const f of this.flagsIsland) {
      this.island.remove(f.group);
      f.group.traverse?.((o: any) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    }
    this.flagsIsland = [];

    const actionNotes = this.notes().filter(n => n.zone === 'island');
    for (let i = 0; i < actionNotes.length; i++) {
      const grp = new T.Group();
      // Distribution circulaire au sommet de la colline
      const angle = (i / Math.max(actionNotes.length, 1)) * Math.PI * 2 + 0.6;
      const r = 1.6;
      grp.position.set(Math.cos(angle) * r, 4.0, Math.sin(angle) * r);

      // ─── Mât ───
      const poleGeom = new T.CylinderGeometry(0.035, 0.045, 1.4, 6);
      const poleMat = new T.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
      const pole = new T.Mesh(poleGeom, poleMat);
      pole.position.y = 0.7;
      grp.add(pole);

      // ─── Drapeau (plane coloré, glow émissif) ───
      const fabricGeom = new T.PlaneGeometry(0.5, 0.32, 6, 3);
      const noteColor = actionNotes[i].authorColor;
      const fabricMat = new T.MeshStandardMaterial({
        color: noteColor,
        emissive: noteColor,
        emissiveIntensity: 0.55,
        roughness: 0.5,
        side: T.DoubleSide,
      });
      const fabric = new T.Mesh(fabricGeom, fabricMat);
      fabric.position.set(0.28, 1.25, 0);
      // Save originals pour flutter
      const fa = fabricGeom.attributes.position.array as Float32Array;
      const flagOriginals = new Float32Array(fa.length);
      flagOriginals.set(fa);
      fabric.userData.originals = flagOriginals;
      grp.add(fabric);

      this.island.add(grp);
      this.flagsIsland.push({ group: grp, fabric, baseRotZ: Math.random() * 0.2 - 0.1 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // ─── Océan : ondulation sin/cos sur Z des sommets ───
    if (this.ocean?.geometry?.attributes?.position && this.oceanBase) {
      const pos = this.ocean.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const base = this.oceanBase;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i];
        const y = base[i + 1];
        // En plane rotated -π/2, l'axe vertical du sommet est sur Z avant rotation
        // → on déplace Z (qui devient Y après rotation)
        const wave = Math.sin(this.elapsed * 1.1 + x * 0.28) * 0.22
                   + Math.cos(this.elapsed * 0.75 + y * 0.22) * 0.18;
        arr[i + 2] = base[i + 2] + wave;
      }
      pos.needsUpdate = true;
    }

    // ─── Sailboat : bobs + tilts + score-driven avance vers l'île ───
    if (this.sailboat) {
      // Bobbing vertical (mer + score)
      this.sailboat.position.y = (this.sailboat.userData.baseY || 0.4)
        + Math.sin(this.elapsed * 1.3) * 0.12
        + this.teamScore * 0.05;
      // Tilt léger (roulis)
      this.sailboat.rotation.z = Math.sin(this.elapsed * 0.7) * 0.04;
      this.sailboat.rotation.x = Math.cos(this.elapsed * 0.55) * 0.025;

      // ─── Arrival animation : navire avance vers (0, 0.4, -22) ───
      if (this.arrivalActive) {
        this.arrivalProgress = Math.min(1, this.arrivalProgress + dt * 0.06);
        const e = 1 - Math.pow(1 - this.arrivalProgress, 3); // easeOutCubic
        this.sailboat.position.z = 0 + (-22 - 0) * e;
        // Quand arrivé : marque comme terminé
        if (this.arrivalProgress >= 1 && !this.sailboat.userData.arrivedEmit) {
          this.sailboat.userData.arrivedEmit = true;
          this.emitCeremony({ type: 'sommet', label: '⛵ Navire arrivé à l\'île · Rétro accomplie', icon: '🏁' });
        }
      }
    }

    // ─── Voiles : sway + boost vent quand score haut ou windGladSurge actif ───
    const nowMs = performance.now();
    if (this.sailLeft) {
      const boost = this.sailLeft.userData.boostUntil && nowMs < this.sailLeft.userData.boostUntil ? 1.0 : 0.0;
      const curl = -0.4 - boost * 0.5 + Math.sin(this.elapsed * 1.5) * 0.12 - this.teamScore * 0.2;
      this.sailLeft.rotation.y = curl;
    }
    if (this.sailRight) {
      const boost = this.sailRight.userData.boostUntil && nowMs < this.sailRight.userData.boostUntil ? 1.0 : 0.0;
      const curl = 0.4 + boost * 0.5 + Math.sin(this.elapsed * 1.5 + 0.5) * 0.12 + this.teamScore * 0.2;
      this.sailRight.rotation.y = curl;
    }

    // ─── Drapeau du navire : flutter ───
    if (this.flagShip?.geometry?.attributes?.position) {
      const pos = this.flagShip.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const orig = this.flagShip.userData.originals as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = orig[i];
        arr[i + 2] = orig[i + 2] + Math.sin(this.elapsed * 5 + x * 7) * 0.045 * (x + 0.25);
      }
      pos.needsUpdate = true;
    }

    // ─── Ancres : swing + drop animation ───
    for (const a of this.anchors) {
      // Swing latéral (au bout de la chaîne)
      const swing = Math.sin(this.elapsed * 1.4 + a.swingPhase) * 0.12;
      a.group.rotation.z = swing;
      // Drop animation
      if (a.group.userData.dropStart && nowMs >= a.group.userData.dropStart) {
        const t = Math.min(1, (nowMs - a.group.userData.dropStart) / (a.group.userData.dropDur || 1500));
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        a.group.position.y = a.group.userData.dropFromY + (a.group.userData.dropToY - a.group.userData.dropFromY) * e;
        if (t >= 1) {
          delete a.group.userData.dropStart;
        }
      }
    }

    // ─── Récifs : rotation lente + pulse on reefsEmerge ───
    for (const r of this.reefs) {
      r.mesh.rotation.y += dt * 0.18;
      const pulse = r.mesh.userData.pulseUntil && nowMs < r.mesh.userData.pulseUntil ? 1.0 : 0.0;
      const scale = 1 + Math.sin(this.elapsed * 4 + r.basePhase) * (0.05 + pulse * 0.18);
      r.mesh.scale.setScalar(scale);
      // Foam particles : oscillent en Y
      if (r.foam?.geometry?.attributes?.position) {
        const pos = r.foam.geometry.attributes.position;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] = 0.05 + Math.sin(this.elapsed * 3 + i * 0.4 + r.basePhase) * 0.18;
        }
        pos.needsUpdate = true;
      }
    }

    // ─── 4 floating labels : bobbing autour de leur basePos ───
    for (const lbl of this.floatingLabels) {
      const base = lbl.userData.basePos;
      const phase = lbl.userData.phase || 0;
      if (base) {
        lbl.position.y = base.y + Math.sin(this.elapsed * 1.5 + phase) * 0.18;
        lbl.position.x = base.x + Math.cos(this.elapsed * 0.9 + phase) * 0.12;
      }
    }

    // ─── Drapeaux sur l'île : flutter + glow boost si plantActionFlags actif ───
    for (const f of this.flagsIsland) {
      if (f.fabric?.geometry?.attributes?.position) {
        const pos = f.fabric.geometry.attributes.position;
        const arr = pos.array as Float32Array;
        const orig = f.fabric.userData.originals as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          const x = orig[i];
          arr[i + 2] = orig[i + 2] + Math.sin(this.elapsed * 4 + x * 5) * 0.04 * (x + 0.25);
        }
        pos.needsUpdate = true;
      }
      // Glow boost si activé
      if (f.fabric?.material?.userData?.glowUntil) {
        const until = f.fabric.material.userData.glowUntil;
        if (nowMs < until) {
          f.fabric.material.emissiveIntensity = 1.4 + Math.sin(this.elapsed * 5) * 0.4;
        } else {
          f.fabric.material.emissiveIntensity = 0.55;
        }
      }
    }

    // ─── Arbres de l'île : wind sway ───
    if (this.island) {
      this.island.traverse((obj: any) => {
        if (obj.userData?.kind === 'island-tree' && obj.userData.basePos) {
          obj.position.x = obj.userData.basePos.x + Math.sin(this.elapsed * 1.3 + obj.userData.phase) * 0.05;
          obj.rotation.z = Math.sin(this.elapsed * 1.0 + obj.userData.phase) * 0.04;
        }
      });
    }

    // ─── Sky ornaments tick (étoiles, lune, aurore, comète, étoiles filantes) ───
    if (this.sky) this.sky.tick(dt, this.elapsed);

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS template + utils
  // ═══════════════════════════════════════════════════════════════════
  notesIn(zone: SailboatZone): RetroNote[] {
    return this.notes().filter(n => n.zone === zone);
  }
  noteCount(zone: SailboatZone): number {
    return this.notesIn(zone).length;
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(10, 8, 14);
    this.camera.lookAt(0, 2, 0);
    if (this.controls) this.controls.target.set(0, 2, 0);
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
