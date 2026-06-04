// ═══════════════════════════════════════════════════════════════════
// ☕ LEAN COFFEE ROOM — La Brûlerie Lean
//
// Lean Coffee : agenda démocratique. Café-bar 4 zones :
//   To Discuss → Discussing (bar) → Discussed (tables) → Action (étagère)
// Chaque tasse = un sujet. Sucres = dot votes. Timer 5 min par sujet.
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Cérémonie publiée : 'aube' (= daily / sujet ouvert).
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { playIslandIntro } from '../../core/island-intro/island-intro';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent } from '../../core/spell-ui';

interface LeanTopic {
  id: number;
  title: string;
  zone: 'to-discuss' | 'discussing' | 'discussed' | 'action';
  votes: number;
  decision?: 'continue' | 'next' | 'action';
}

@Component({
  selector: 'wt-lean-coffee-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lc-host">
      <header class="lc-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#6b4423" [routerLink]="'/yamzy-island'" icon="←">Yamzy Island</wt-spell-btn>
        <div class="lc-title">
          <h1>☕ La Brûlerie Lean</h1>
          <p>Agenda démocratique · {{ topics().length }} sujets · {{ totalVotes() }} sucres distribués</p>
        </div>
        <div class="lc-actions">
          <wt-spell-btn variant="primary" size="sm" accent="#6b4423" (click)="openTutorial()" icon="🎓" title="Visite guidée">Tutorial</wt-spell-btn>
          <wt-spell-btn variant="primary" size="sm" accent="#6b4423" (click)="narrator.startPlayExample()" icon="▶" title="Démo animée">Play example</wt-spell-btn>
        </div>
      </header>

      <canvas #canvas class="lc-canvas"></canvas>

      <!-- 🪶 Narrator overlay -->
      <wt-narrator></wt-narrator>

      <!-- Flash cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="lc-flash" [attr.data-type]="f.type">
        <div class="lc-flash-content">
          <div class="lc-flash-icon">{{ f.icon }}</div>
          <div class="lc-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Sidebar 4 zones -->
      <aside class="lc-zones">
        <div class="lc-zone" *ngFor="let z of zones">
          <div class="lc-zone-head">
            <span class="lc-zone-emoji">{{ z.emoji }}</span>
            <span class="lc-zone-name">{{ z.name }}</span>
            <span class="lc-zone-count">{{ countIn(z.key) }}</span>
          </div>
          <div class="lc-zone-list">
            <div *ngFor="let t of topicsIn(z.key)" class="lc-topic" [class.lc-topic-hot]="t.votes >= 3">
              <span class="lc-cup">☕</span>
              <span class="lc-topic-title">{{ t.title }}</span>
              <span class="lc-topic-votes" *ngIf="t.votes > 0">
                <ng-container *ngFor="let _ of sugarRange(t.votes)">🍬</ng-container>
              </span>
            </div>
            <div *ngIf="countIn(z.key) === 0" class="lc-zone-empty">— vide —</div>
          </div>
        </div>
      </aside>

      <!-- Manifesto -->
      <footer class="lc-manifesto">
        <em>« Le café tiédit, le sujet aussi. Quand la tasse refroidit, on passe. »</em>
      </footer>

      <!-- 🎬 Splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Lean Coffee"
        loreName="La Brûlerie Lean"
        color="#6b4423"
        oneLiner="Agenda démocratique : tasses-sujets dans 4 zones, dot voting, timer 5min."
        [duration]="65"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Lean Coffee"
        loreName="La Brûlerie Lean"
        accent="#6b4423"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; position: fixed; inset: 0; }
    .lc-host { position: relative; width: 100%; height: 100%; background: #1a0d05; color: #fde6c8; font-family: 'Tinos', serif; overflow: hidden; }
    .lc-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

    .lc-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .lc-topbar > * { pointer-events: auto; }
    .lc-back { color: #fdba74; text-decoration: none; font-size: 13px; padding: 7px 12px; border: 1px solid #6b4423; border-radius: 8px; background: rgba(40, 22, 10, 0.75); backdrop-filter: blur(6px); }
    .lc-back:hover { background: rgba(107, 68, 35, 0.55); }
    .lc-title h1 { margin: 0; font-family: 'Henny Penny', cursive; font-size: 28px; color: #fbbf24; text-shadow: 0 0 14px rgba(251, 191, 36, 0.5); }
    .lc-title p { margin: 4px 0 0; font-size: 12px; opacity: 0.75; font-style: italic; }
    .lc-actions { display: flex; gap: 8px; }
    .lc-narrator { background: rgba(60, 35, 12, 0.75); color: #fde6c8; border: 1px solid #b89240; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .lc-narrator:hover { background: rgba(184, 146, 64, 0.3); }
    .lc-narrator.lc-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .lc-narrator.lc-play:hover { background: #f5b923; }

    /* Sidebar zones */
    .lc-zones { position: absolute; top: 80px; right: 16px; width: 280px; max-height: calc(100vh - 160px); overflow-y: auto; background: rgba(25, 15, 8, 0.88); border: 1px solid rgba(184, 146, 64, 0.4); border-radius: 14px; backdrop-filter: blur(10px); padding: 14px; z-index: 8; }
    .lc-zone { padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(184, 146, 64, 0.15); }
    .lc-zone:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .lc-zone-head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 12px; color: #fbbf24; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .lc-zone-emoji { font-size: 16px; }
    .lc-zone-name { flex: 1; }
    .lc-zone-count { background: rgba(184, 146, 64, 0.25); color: #fde6c8; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
    .lc-zone-list { display: flex; flex-direction: column; gap: 4px; }
    .lc-zone-empty { font-size: 11px; opacity: 0.4; font-style: italic; padding: 4px 6px; }
    .lc-topic { display: flex; align-items: center; gap: 6px; padding: 5px 6px; background: rgba(40, 22, 10, 0.5); border-radius: 6px; font-size: 12px; }
    .lc-topic-hot { background: rgba(251, 191, 36, 0.18); border-left: 2px solid #fbbf24; }
    .lc-cup { font-size: 14px; }
    .lc-topic-title { flex: 1; }
    .lc-topic-votes { font-size: 10px; letter-spacing: -1px; }

    /* Flash cérémonie */
    .lc-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: lc-flash-pulse 1.6s ease-out forwards; }
    .lc-flash { background: radial-gradient(circle at center, rgba(251, 191, 36, 0.55), transparent 65%); }
    .lc-flash-content { text-align: center; animation: lc-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .lc-flash-icon { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 28px rgba(251, 191, 36, 0.9)); }
    .lc-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.6); }
    @keyframes lc-flash-pulse { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes lc-flash-grow { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    .lc-manifesto { position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 24px; background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); text-align: center; font-size: 13px; opacity: 0.75; z-index: 6; pointer-events: none; }
    .lc-manifesto em { color: #fde68a; }
  `]
})
export class LeanCoffeeRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── State ───
  topics = signal<LeanTopic[]>([]);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  totalVotes = signal(0);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '☕', title: 'Tasse = sujet proposé', body: 'Chaque tasse fumante sur la table est un sujet de discussion. Quiconque peut en déposer une avant le démarrage.' },
    { icon: '🗳', title: 'Dot voting démocratique', body: 'Les participants placent leurs dots colorés. Les sujets les plus votés remontent en haut de la file d\'attente.' },
    { icon: '⏱', title: 'Timer 5 min par sujet', body: 'Une fois le sujet ouvert, le sablier coule pendant 5 minutes. Sa lumière chaude orange indique le temps restant.' },
    { icon: '👍', title: 'Vote rouge/vert : continuer ou next', body: 'À la fin du timer, vote rapide : on continue 5 minutes de plus ou on passe au sujet suivant.' },
    { icon: '📦', title: 'Discussed → Parking lot', body: 'Les sujets traités migrent vers la zone Discussed. Le parking lot recueille ceux à reporter ailleurs.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque tasse est un sujet proposé.',
    'Le dot voting classe démocratiquement.',
    'Le sablier coule cinq minutes par sujet.',
    'On vote pour continuer ou passer.',
    'Le parking lot reçoit les sujets à reporter.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  zones: Array<{ key: LeanTopic['zone']; name: string; emoji: string }> = [
    { key: 'to-discuss', name: 'To Discuss', emoji: '🗒' },
    { key: 'discussing', name: 'Discussing', emoji: '🔥' },
    { key: 'discussed',  name: 'Discussed', emoji: '✅' },
    { key: 'action',     name: 'Action',    emoji: '📦' },
  ];

  // ─── DI ───
  narrator = inject(NarratorService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── Three.js ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private rafId = 0;
  private disposed = false;
  private elapsed = 0;
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;

  // ─── 3D refs ───
  private cupMeshes: any[] = [];           // 8-10 tasses café
  private steamPoints: any = null;          // particules vapeur (Points)
  private steamVelocities: Float32Array = new Float32Array(0);
  private chandelier: any = null;           // lustre central
  private barCounter: any = null;
  private shelfMesh: any = null;
  private potPlant: any = null;
  private ceremonyFlashTimer: any = null;

  // Anim states pour cinematic methods
  private spawnQueue: number = 0;            // nombre de tasses à spawn progressivement
  private dotVotePulse: number = 0;          // pulse vote sucre
  private timerActive: number = 0;           // timer 5min pour discussing zone

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit(): void { this.bootstrap(); }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    window.removeEventListener('resize', this.onResize);
  }

  private async bootstrap(): Promise<void> {
    await this.ensureThree();
    if (this.disposed) return;
    this.initScene();
    this.loadInitialTopics();
    this.animate();
    // 🎬 Intro cinématique
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 8, y: 6, z: 12 },
      { x: 0, y: 2, z: 0 },
      3.5,
    );
  }

  private async ensureThree(): Promise<void> {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
  }
  private loadScript(src: string): Promise<void> {
    return new Promise(r => { const s = document.createElement('script'); s.src = src; s.onload = () => r(); s.onerror = () => r(); document.head.appendChild(s); });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INIT SCENE
  // ═══════════════════════════════════════════════════════════════════
  private initScene(): void {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x1a0d05);
    this.scene.fog = new T.FogExp2(0x2a1a0a, 0.018);

    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(8, 6, 12);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights warm tavern style
    this.scene.add(new T.AmbientLight(0x4a2a10, 0.55));
    const key = new T.DirectionalLight(0xfbbf24, 0.7);
    key.position.set(4, 9, 6);
    this.scene.add(key);
    this.scene.add(new T.HemisphereLight(0xfbbf24, 0x2a1a0a, 0.4));

    // Sky universel
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 500, starRadius: 70,
      moonPos: [-20, 22, -22],
      auroraPos: [0, 26, -38],
      cometPos: [22, 22, -18],
      shootingStarCount: 4,
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'lean-coffee') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Build the café
    this.buildFloor(T);
    this.buildBarCounter(T);
    this.buildRoundTables(T);
    this.buildShelf(T);
    this.buildPotPlant(T);
    this.buildChandelier(T);
    this.buildCups(T);
    this.buildSteamParticles(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 2, 0);
      this.controls.maxDistance = 28;
      this.controls.minDistance = 4;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🪶 Attach Narrator Yamzy → loads lean-coffee.tutorial.json
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'lean-coffee',
    });
    console.log('[LeanCoffee] ☕ Café ready — let the agenda flow');
  }

  // ─── Sol bois warm ───
  private buildFloor(T: any): void {
    const floor = new T.Mesh(
      new T.CylinderGeometry(16, 16, 0.4, 64),
      new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.9 })
    );
    floor.position.y = -0.2;
    this.scene.add(floor);

    // Planches motif (anneaux)
    for (let i = 1; i <= 3; i++) {
      const ring = new T.Mesh(
        new T.RingGeometry(i * 4.5, i * 4.5 + 0.05, 64),
        new T.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85, side: T.DoubleSide, transparent: true, opacity: 0.4 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      this.scene.add(ring);
    }
  }

  // ─── Comptoir bar au fond ───
  private buildBarCounter(T: any): void {
    const grp = new T.Group();
    grp.position.set(0, 0, -7);
    grp.userData.tutorialId = 'bar';

    // Plateau bar (long box bois)
    const top = new T.Mesh(
      new T.BoxGeometry(10, 0.25, 1.6),
      new T.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.6, metalness: 0.15 })
    );
    top.position.y = 1.4;
    grp.add(top);

    // Pied bar (en dessous)
    const front = new T.Mesh(
      new T.BoxGeometry(10, 1.4, 0.3),
      new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.85 })
    );
    front.position.set(0, 0.7, 0.65);
    grp.add(front);

    // Liseré doré sur le bord
    const trim = new T.Mesh(
      new T.BoxGeometry(10.1, 0.05, 0.05),
      new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.3 })
    );
    trim.position.set(0, 1.55, -0.78);
    grp.add(trim);

    // Étagère arrière du bar avec bouteilles
    const back = new T.Mesh(
      new T.BoxGeometry(10, 2.5, 0.2),
      new T.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.95 })
    );
    back.position.set(0, 2.5, -1.5);
    grp.add(back);

    // 6 bouteilles
    for (let i = 0; i < 6; i++) {
      const bottle = new T.Mesh(
        new T.CylinderGeometry(0.1, 0.13, 0.6, 8),
        new T.MeshStandardMaterial({
          color: i % 2 === 0 ? 0x166534 : 0x7c2d12,
          roughness: 0.4, metalness: 0.2,
          transparent: true, opacity: 0.9,
        })
      );
      bottle.position.set(-4 + i * 1.6, 1.85, -1.4);
      grp.add(bottle);
    }

    this.barCounter = grp;
    this.scene.add(grp);
  }

  // ─── 3 tables rondes au centre + chaises tabourets ───
  private buildRoundTables(T: any): void {
    const positions: Array<[number, number]> = [
      [-3, 2],
      [0, -1],
      [3, 2],
    ];
    const tableMat = new T.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.75 });
    const legMat = new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.85 });
    const stoolMat = new T.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.85 });
    for (let i = 0; i < positions.length; i++) {
      const [x, z] = positions[i];
      const grp = new T.Group();
      grp.position.set(x, 0, z);
      if (i === 0) grp.userData.tutorialId = 'table';

      // Pied table (cylindre)
      const leg = new T.Mesh(new T.CylinderGeometry(0.18, 0.3, 0.95, 8), legMat);
      leg.position.y = 0.475;
      grp.add(leg);

      // Plateau (cylindre court)
      const top = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 0.12, 24), tableMat);
      top.position.y = 1.0;
      grp.add(top);

      // 3 tabourets autour
      for (let k = 0; k < 3; k++) {
        const angle = (k / 3) * Math.PI * 2 + i * 0.5;
        const sx = Math.cos(angle) * 1.3;
        const sz = Math.sin(angle) * 1.3;
        const stoolLeg = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 0.55, 6), legMat);
        stoolLeg.position.set(sx, 0.275, sz);
        grp.add(stoolLeg);
        const stoolTop = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.08, 12), stoolMat);
        stoolTop.position.set(sx, 0.59, sz);
        grp.add(stoolTop);
      }
      this.scene.add(grp);
    }
  }

  // ─── Étagère au mur droit ───
  private buildShelf(T: any): void {
    const grp = new T.Group();
    grp.position.set(7, 0, 0);
    grp.userData.tutorialId = 'shelf';
    grp.rotation.y = -Math.PI / 2;

    const woodMat = new T.MeshStandardMaterial({ color: 0x4a2818, roughness: 0.9 });

    // Cadre vertical (montants)
    for (let s = -1; s <= 1; s += 2) {
      const post = new T.Mesh(new T.BoxGeometry(0.15, 4.5, 0.4), woodMat);
      post.position.set(s * 1.5, 2.25, 0);
      grp.add(post);
    }
    // 4 étagères horizontales
    for (let k = 0; k < 4; k++) {
      const plank = new T.Mesh(
        new T.BoxGeometry(3.3, 0.08, 0.55),
        woodMat
      );
      plank.position.set(0, 0.4 + k * 1.1, 0);
      grp.add(plank);
    }
    // Quelques tasses-action posées sur les étagères
    const actionMat = new T.MeshStandardMaterial({
      color: 0x16a34a, emissive: 0x166534, emissiveIntensity: 0.5, roughness: 0.5,
    });
    for (let k = 0; k < 3; k++) {
      const cup = new T.Mesh(new T.CylinderGeometry(0.18, 0.16, 0.3, 16), actionMat);
      cup.position.set(-1 + k * 1, 0.56 + k * 1.1, 0);
      grp.add(cup);
    }

    this.shelfMesh = grp;
    this.scene.add(grp);
  }

  // ─── Plante en pot dans le coin ───
  private buildPotPlant(T: any): void {
    const grp = new T.Group();
    grp.position.set(-6, 0, 5);

    // Pot
    const pot = new T.Mesh(
      new T.CylinderGeometry(0.4, 0.55, 0.7, 12),
      new T.MeshStandardMaterial({ color: 0x7c4a2a, roughness: 0.85 })
    );
    pot.position.y = 0.35;
    grp.add(pot);

    // Feuillage : un icosaèdre vert
    const foliage = new T.Mesh(
      new T.IcosahedronGeometry(0.7, 0),
      new T.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x14532d, emissiveIntensity: 0.25, roughness: 0.7, flatShading: true })
    );
    foliage.position.y = 1.4;
    grp.add(foliage);
    // 2 petits secondaires
    const f2 = new T.Mesh(
      new T.IcosahedronGeometry(0.35, 0),
      new T.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x166534, emissiveIntensity: 0.2, roughness: 0.7, flatShading: true })
    );
    f2.position.set(0.45, 1.7, 0);
    grp.add(f2);
    const f3 = f2.clone();
    f3.position.set(-0.3, 1.9, 0.2);
    grp.add(f3);

    this.potPlant = grp;
    this.scene.add(grp);
  }

  // ─── Lustre au plafond (sphère gold) ───
  private buildChandelier(T: any): void {
    const grp = new T.Group();
    grp.position.set(0, 6.5, 0);
    grp.userData.tutorialId = 'chandelier';

    // Câble
    const cord = new T.Mesh(
      new T.CylinderGeometry(0.02, 0.02, 1.4, 6),
      new T.MeshStandardMaterial({ color: 0x141414 })
    );
    cord.position.y = 0.7;
    grp.add(cord);

    // Sphère dorée
    const ball = new T.Mesh(
      new T.SphereGeometry(0.45, 24, 18),
      new T.MeshStandardMaterial({
        color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.3,
        metalness: 0.7, roughness: 0.3,
      })
    );
    grp.add(ball);

    // Halo
    const halo = new T.Mesh(
      new T.SphereGeometry(0.65, 16, 12),
      new T.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false })
    );
    grp.add(halo);

    // PointLight
    const light = new T.PointLight(0xfbbf24, 2.5, 18, 1.6);
    grp.add(light);

    this.chandelier = grp;
    this.scene.add(grp);
  }

  // ─── 8-10 tasses café (petits cylinders brown avec poignée torus) ───
  private buildCups(T: any): void {
    // Cleanup old
    for (const c of this.cupMeshes) this.scene.remove(c);
    this.cupMeshes = [];

    const list = this.topics();
    const list8 = list.slice(0, 10);
    for (let i = 0; i < list8.length; i++) {
      const t = list8[i];
      const cup = this.makeCupMesh(T, t);
      this.placeCup(cup, t, i);
      cup.userData.basePhase = Math.random() * Math.PI * 2;
      cup.userData.topicId = t.id;
      if (i === 0) cup.userData.tutorialId = 'cup';
      this.cupMeshes.push(cup);
      this.scene.add(cup);
    }
  }

  private makeCupMesh(T: any, t: LeanTopic): any {
    const grp = new T.Group();
    const color = this.zoneColor(t.zone);

    // Corps tasse (cylindre)
    const body = new T.Mesh(
      new T.CylinderGeometry(0.18, 0.14, 0.28, 16),
      new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.55 })
    );
    body.position.y = 0.14;
    grp.add(body);

    // Liseré crème (haut)
    const rim = new T.Mesh(
      new T.TorusGeometry(0.18, 0.018, 6, 16),
      new T.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfde68a, emissiveIntensity: 0.4, metalness: 0.6 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.28;
    grp.add(rim);

    // Café visible (cercle sombre au top)
    const coffee = new T.Mesh(
      new T.CircleGeometry(0.16, 16),
      new T.MeshStandardMaterial({ color: 0x2a1408, emissive: 0x1a0a04, emissiveIntensity: 0.3, side: T.DoubleSide })
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.281;
    grp.add(coffee);

    // Poignée (torus partiel)
    const handle = new T.Mesh(
      new T.TorusGeometry(0.09, 0.025, 8, 16, Math.PI),
      new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.55 })
    );
    handle.position.set(0.2, 0.16, 0);
    handle.rotation.y = Math.PI / 2;
    grp.add(handle);

    // Sucres (petits cubes blanc cassé) selon votes
    const sugarCount = Math.min(t.votes, 4);
    for (let s = 0; s < sugarCount; s++) {
      const sugar = new T.Mesh(
        new T.BoxGeometry(0.05, 0.05, 0.05),
        new T.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfde68a, emissiveIntensity: 0.45, roughness: 0.5 })
      );
      const a = (s / 4) * Math.PI * 2;
      sugar.position.set(Math.cos(a) * 0.1, 0.31 + s * 0.005, Math.sin(a) * 0.1);
      grp.add(sugar);
    }

    return grp;
  }

  private placeCup(cup: any, t: LeanTopic, idx: number): void {
    let x = 0, y = 0, z = 0;
    if (t.zone === 'to-discuss') {
      // bac à gauche, près du bar
      x = -5 + (idx % 3) * 0.5;
      y = 1.55;
      z = -6.5 + Math.floor(idx / 3) * 0.4;
    } else if (t.zone === 'discussing') {
      // sur le bar central, en évidence
      x = 0;
      y = 1.55;
      z = -7;
    } else if (t.zone === 'discussed') {
      // sur l'une des 3 tables
      const tablePos: Array<[number, number]> = [[-3, 2], [0, -1], [3, 2]];
      const p = tablePos[idx % 3];
      x = p[0] + Math.cos(idx) * 0.25;
      y = 1.08;
      z = p[1] + Math.sin(idx) * 0.25;
    } else {
      // action : sur l'étagère droite (x=7, ouvert)
      x = 6.8;
      y = 0.6 + (idx % 4) * 1.1;
      z = -0.6 + (idx % 3) * 0.6;
    }
    cup.position.set(x, y, z);
    cup.userData.baseY = y;
  }

  private zoneColor(zone: LeanTopic['zone']): number {
    switch (zone) {
      case 'to-discuss': return 0x6b4423;
      case 'discussing': return 0xdc2626;
      case 'discussed':  return 0xfbbf24;
      case 'action':     return 0x16a34a;
    }
  }

  // ─── Vapeur particles au-dessus de certaines tasses (Points white) ───
  private buildSteamParticles(T: any): void {
    const COUNT = 200;
    const positions = new Float32Array(COUNT * 3);
    this.steamVelocities = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = 1.6 + Math.random() * 0.8;
      positions[i * 3 + 2] = -7 + (Math.random() - 0.5) * 3;
      this.steamVelocities[i] = 0.01 + Math.random() * 0.025;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xeeeeee, size: 0.12, transparent: true, opacity: 0.45,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.steamPoints = new T.Points(geom, mat);
    this.scene.add(this.steamPoints);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA
  // ═══════════════════════════════════════════════════════════════════
  private loadInitialTopics(): void {
    const init: LeanTopic[] = [
      { id: 1, title: 'CI build flaky',      zone: 'to-discuss', votes: 0 },
      { id: 2, title: 'Hire FE senior',      zone: 'to-discuss', votes: 0 },
      { id: 3, title: 'IA water budget',     zone: 'to-discuss', votes: 0 },
      { id: 4, title: 'Move to Vite ?',      zone: 'discussed',  votes: 2, decision: 'action' },
      { id: 5, title: 'WfH Wednesdays',      zone: 'action',     votes: 4 },
    ];
    this.topics.set(init);
    this.recomputeVotes();
    const T = (window as any).THREE;
    if (T) this.buildCups(T);
    this.emitCeremony({ type: 'aube', label: '☕ Brûlerie ouverte · 5 sujets prêts', icon: '☕' });
  }

  private recomputeVotes(): void {
    this.totalVotes.set(this.topics().reduce((a, t) => a + t.votes, 0));
  }

  topicsIn(zone: LeanTopic['zone']): LeanTopic[] { return this.topics().filter(t => t.zone === zone); }
  countIn(zone: LeanTopic['zone']): number { return this.topicsIn(zone).length; }
  sugarRange(n: number): number[] { return Array.from({ length: Math.min(n, 6) }); }

  // ═══════════════════════════════════════════════════════════════════
  // CEREMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }): void {
    this.ceremonyBus.publishFromRoom('lean-coffee', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  /** Public hook for narrator JSON */
  public emitCeremonyPublic(c: { type: string; label: string; icon: string }): void { this.emitCeremony(c); }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 SPLASH OVERLAY HANDLERS
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

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS (called by playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════════

  /** Step ~10s : 3 sujets ajoutés au bac "To Discuss" */
  spawnTopics(): void {
    const T = (window as any).THREE;
    const fresh: LeanTopic[] = [
      { id: 101, title: 'Pair programming',  zone: 'to-discuss', votes: 0 },
      { id: 102, title: 'New onboarding',    zone: 'to-discuss', votes: 0 },
      { id: 103, title: 'A11y audit',        zone: 'to-discuss', votes: 0 },
    ];
    this.topics.update(prev => [...prev, ...fresh]);
    if (T) this.buildCups(T);
    this.emitCeremony({ type: 'aube', label: '☕ 3 nouveaux sujets dans le bac', icon: '🗒' });
  }

  /** Step ~22s : dot voting (sucres sur les tasses) */
  dotVoting(): void {
    const T = (window as any).THREE;
    // Distribute votes : top 2 get most
    const list = [...this.topics()];
    const tdIds = list.filter(t => t.zone === 'to-discuss').map(t => t.id);
    if (tdIds.length === 0) return;
    const voteMap: Record<number, number> = {};
    voteMap[tdIds[0]] = 4;
    if (tdIds[1]) voteMap[tdIds[1]] = 3;
    if (tdIds[2]) voteMap[tdIds[2]] = 2;
    if (tdIds[3]) voteMap[tdIds[3]] = 1;
    this.topics.update(prev => prev.map(t => voteMap[t.id] != null ? { ...t, votes: voteMap[t.id] } : t));
    this.recomputeVotes();
    this.dotVotePulse = 1.5;
    if (T) this.buildCups(T);
    this.emitCeremony({ type: 'aube', label: '🍬 Dot voting · sucres distribués', icon: '🍬' });
  }

  /** Step ~35s : top sujet va au bar "Discussing" + vapeur monte */
  startDiscussing(): void {
    const T = (window as any).THREE;
    const list = [...this.topics()];
    // Trouver le top (par votes) en to-discuss
    const top = list.filter(t => t.zone === 'to-discuss').sort((a, b) => b.votes - a.votes)[0];
    if (top) {
      this.topics.update(prev => prev.map(t => t.id === top.id ? { ...t, zone: 'discussing' as const } : t));
    }
    this.timerActive = 1.0;
    if (T) this.buildCups(T);
    this.emitCeremony({ type: 'aube', label: '🔥 Discussion ouverte · timer 5 min', icon: '🔥' });
  }

  /** Step ~50s : vote continue/discussed (la tasse va aux tables) */
  closeDiscussion(): void {
    const T = (window as any).THREE;
    const list = [...this.topics()];
    const current = list.find(t => t.zone === 'discussing');
    if (current) {
      this.topics.update(prev => prev.map(t => t.id === current.id ? { ...t, zone: 'discussed' as const, decision: 'next' as const } : t));
    }
    if (T) this.buildCups(T);
    this.emitCeremony({ type: 'aube', label: '✅ Sujet clos · table des Discussed', icon: '✅' });
  }

  /** Step ~60s : tasse va à "Action" sur l'étagère */
  promoteToAction(): void {
    const T = (window as any).THREE;
    const list = [...this.topics()];
    // Convert le dernier "discussed" en "action"
    const lastDiscussed = list.filter(t => t.zone === 'discussed').slice(-1)[0];
    if (lastDiscussed) {
      this.topics.update(prev => prev.map(t => t.id === lastDiscussed.id ? { ...t, zone: 'action' as const, decision: 'action' as const } : t));
    }
    if (T) this.buildCups(T);
    this.emitCeremony({ type: 'aube', label: '📦 Action item sur l\'étagère', icon: '📦' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // Sky tick
    if (this.sky) this.sky.tick(dt, this.elapsed);

    // Lustre : pulse chaude
    if (this.chandelier) {
      const pulse = 1.1 + Math.sin(this.elapsed * 2.2) * 0.15;
      this.chandelier.children.forEach((c: any, idx: number) => {
        if (idx === 1 && c.material) c.material.emissiveIntensity = pulse;
      });
      this.chandelier.rotation.y += dt * 0.05;
    }

    // Cups : bob léger + spin doux
    for (const cup of this.cupMeshes) {
      const baseY = cup.userData.baseY ?? 1.0;
      const phase = cup.userData.basePhase ?? 0;
      cup.position.y = baseY + Math.sin(this.elapsed * 1.4 + phase) * 0.025;
      cup.rotation.y += dt * 0.15;
    }

    // Steam particles : montent + recycle
    if (this.steamPoints) {
      const positions = this.steamPoints.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < this.steamVelocities.length; i++) {
        const idx = i * 3;
        positions[idx + 1] += this.steamVelocities[i];
        // Slight swirl
        positions[idx + 0] += Math.sin(this.elapsed * 1.5 + i * 0.12) * 0.004;
        positions[idx + 2] += Math.cos(this.elapsed * 1.6 + i * 0.1) * 0.004;
        if (positions[idx + 1] > 5.5) {
          positions[idx + 0] = (Math.random() - 0.5) * 6;
          positions[idx + 1] = 1.6;
          positions[idx + 2] = -7 + (Math.random() - 0.5) * 3;
        }
      }
      this.steamPoints.geometry.attributes.position.needsUpdate = true;
      // Discussing boost : when timerActive, steam stronger
      if (this.timerActive > 0) {
        this.steamPoints.material.opacity = 0.7;
        this.timerActive -= dt * 0.1;
      } else {
        this.steamPoints.material.opacity = 0.45;
      }
    }

    // Dot vote pulse : sugars glow
    if (this.dotVotePulse > 0) {
      this.dotVotePulse -= dt;
      for (const cup of this.cupMeshes) {
        cup.children.forEach((child: any) => {
          if (child.material && child.material.color && child.material.color.r > 0.9 && child.material.color.g > 0.85) {
            child.material.emissiveIntensity = 0.45 + Math.sin(this.elapsed * 7) * 0.4;
          }
        });
      }
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };
}
