// ═══════════════════════════════════════════════════════════════════
// 🍇 REFINEMENT ORCHARD ROOM — Le Verger des Affinages
//
// Backlog refinement / grooming.
// - 6 arbres porteurs de fruits (tickets)
// - Fruits verts = non affinés, dorés = DoR respecté
// - Cueillir + scinder + estimer + DoR check
// - Fruits mûrs tombent dans un panier sprint (torus rouge)
//
// Cérémonie publiée : 'harvest' (= moisson / refinement done)
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
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent, SpellFooterService } from '../../core/spell-ui';

interface OrchardTicket {
  id: number;
  title: string;
  status: 'green' | 'yellow' | 'gold';  // green=non affiné, yellow=en cours, gold=DoR OK
  estimate?: number;                     // fibonacci
  treeIdx: number;
  fruitIdx: number;
}

@Component({
  selector: 'wt-refinement-orchard-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ro-host">
      <header class="ro-topbar">
        <div class="ro-title">
          <h1>🍇 Le Verger des Affinages</h1>
          <p>Backlog grooming · {{ tickets().length }} fruits · {{ dorOkCount() }} dorés · {{ basketCount() }} dans le panier</p>
        </div>
      </header>

      <canvas #canvas class="ro-canvas"></canvas>

      <!-- 🪶 Narrator overlay -->
      <wt-narrator></wt-narrator>

      <!-- Flash cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="ro-flash" [attr.data-type]="f.type">
        <div class="ro-flash-content">
          <div class="ro-flash-icon">{{ f.icon }}</div>
          <div class="ro-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Sidebar liste tickets -->
      <aside class="ro-tickets">
        <div class="ro-section-title">📜 Backlog · 6 tickets exemple</div>
        <div *ngFor="let t of tickets()" class="ro-ticket" [class.ro-green]="t.status === 'green'" [class.ro-yellow]="t.status === 'yellow'" [class.ro-gold]="t.status === 'gold'">
          <span class="ro-dot"></span>
          <span class="ro-ticket-title">{{ t.title }}</span>
          <span class="ro-ticket-est" *ngIf="t.estimate != null">{{ t.estimate }}</span>
        </div>
      </aside>

      <!-- Manifesto -->
      <footer class="ro-manifesto">
        <em>« Cueille au bon moment : ni trop vert, ni trop mûr. Le DoR juge. »</em>
      </footer>

      <!-- 🎬 Splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Refinement Orchard"
        loreName="Le Verger des Affinages"
        color="#84cc16"
        oneLiner="Backlog grooming : fruits = tickets, mûrissent quand DoR OK."
        [duration]="70"
        [timeboxDurationS]="3600"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Refinement Orchard"
        loreName="Le Verger des Affinages"
        accent="#84cc16"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; position: fixed; inset: 0; }
    .ro-host { position: relative; width: 100%; height: 100dvh; max-height: 100dvh; background: #0a1a0a; color: #d4f0d4; font-family: "Tinos", serif; overflow: hidden; }
    .ro-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

    .ro-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .ro-topbar > * { pointer-events: auto; }
    .ro-back { color: #bef264; text-decoration: none; font-size: 13px; padding: 7px 12px; border: 1px solid #84cc16; border-radius: 8px; background: rgba(20, 40, 20, 0.75); backdrop-filter: blur(6px); }
    .ro-back:hover { background: rgba(132, 204, 22, 0.25); }
    .ro-title h1 { margin: 0; font-family: 'Henny Penny', cursive; font-size: 28px; color: #bef264; text-shadow: 0 0 14px rgba(132, 204, 22, 0.55); }
    .ro-title p { margin: 4px 0 0; font-size: 12px; opacity: 0.78; font-style: italic; }
    .ro-actions { display: flex; gap: 8px; }
    .ro-narrator { background: rgba(40, 60, 20, 0.75); color: #ecfccb; border: 1px solid #84cc16; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .ro-narrator:hover { background: rgba(132, 204, 22, 0.28); }
    .ro-narrator.ro-play { background: #84cc16; color: #0a1a0a; border-color: #84cc16; }
    .ro-narrator.ro-play:hover { background: #65a30d; }

    /* Sidebar tickets */
    .ro-tickets { position: absolute; top: 80px; right: 16px; width: 290px; max-height: calc(100vh - 160px); overflow-y: auto; background: rgba(10, 30, 10, 0.88); border: 1px solid rgba(132, 204, 22, 0.4); border-radius: 14px; backdrop-filter: blur(10px); padding: 14px; z-index: 8; }
    .ro-section-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #bef264; text-transform: uppercase; margin-bottom: 10px; }
    .ro-ticket { display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 4px; background: rgba(20, 40, 20, 0.55); border-radius: 6px; font-size: 12px; border-left: 3px solid transparent; }
    .ro-green { border-left-color: #84cc16; }
    .ro-yellow { border-left-color: #facc15; }
    .ro-gold { border-left-color: #fbbf24; background: rgba(251, 191, 36, 0.15); }
    .ro-dot { width: 8px; height: 8px; border-radius: 50%; background: #84cc16; }
    .ro-yellow .ro-dot { background: #facc15; }
    .ro-gold .ro-dot { background: #fbbf24; box-shadow: 0 0 6px #fbbf24; }
    .ro-ticket-title { flex: 1; }
    .ro-ticket-est { font-weight: 700; color: #fbbf24; padding: 2px 6px; background: rgba(251, 191, 36, 0.15); border-radius: 4px; font-size: 11px; }

    /* Flash cérémonie */
    .ro-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: ro-flash-pulse 1.6s ease-out forwards; background: radial-gradient(circle at center, rgba(132, 204, 22, 0.5), transparent 65%); }
    .ro-flash-content { text-align: center; animation: ro-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .ro-flash-icon { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 28px rgba(132, 204, 22, 0.9)); }
    .ro-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.6); }
    @keyframes ro-flash-pulse { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes ro-flash-grow { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    .ro-manifesto { position: absolute; bottom: 60px; left: 0; right: 0; padding: 10px 24px; background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); text-align: center; font-size: 13px; opacity: 0.75; z-index: 6; pointer-events: none; }
    .ro-manifesto em { color: #bef264; }
  `]
})
export class RefinementOrchardRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── State ───
  tickets = signal<OrchardTicket[]>([]);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  basketCount = signal(0);
  dorOkCount = signal(0);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🌳', title: '6 arbres = épopées du backlog', body: 'Chaque arbre du verger porte les tickets d\'une épopée. Les fruits qui pendent sont les user stories à affiner.' },
    { icon: '🍏', title: 'Vert = non affiné', body: 'Un fruit vert est encore acerbe : description floue, pas de critères, pas d\'estimation. À cueillir et travailler.' },
    { icon: '🍎', title: 'Doré = DoR respecté', body: 'Quand un ticket coche tous les critères Definition of Ready (clair, estimé, testable), son fruit devient doré.' },
    { icon: '🧺', title: 'Panier sprint en bas', body: 'Le grand panier rouge en torus en bas recueille les fruits dorés cueillis. C\'est votre sprint backlog en construction.' },
    { icon: '🌬', title: 'Vent d\'automne = harvest', body: 'Lors de la cérémonie de refinement, le vent souffle et fait tomber tous les fruits mûrs dans le panier. Carillon doux.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque arbre porte une épopée du backlog.',
    'Les fruits verts sont les tickets non affinés.',
    'Doré signifie que la DoR est respectée.',
    'Le panier en bas reçoit les fruits mûrs.',
    'Le vent d\'automne moissonne le refinement.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  // ─── DI ───
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
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
  private trees: any[] = [];                  // 6 trees
  private fruitMeshes: any[] = [];            // tous les fruits sur arbres
  private fruitsByTicket = new Map<number, any>();
  private basketGroup: any = null;
  private basketFruits: any[] = [];
  private eagleSprite: any = null;
  private eagleData = { angle: 0, radius: 9, height: 5.5 };
  private animals: any[] = [];                // lapins / moutons au sol
  private ceremonyFlashTimer: any = null;

  // Anim states
  private splitTargetIdx: number | null = null;
  private splitT0 = 0;
  private estimateTicketId: number | null = null;
  private estimateScale = 1.0;
  private dorPulseT0 = 0;
  private fallTicketId: number | null = null;
  private fallT0 = 0;

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit(): void {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#84cc16',
      controls: [
        { icon: '🎓', label: 'Tutorial', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée' },
        { icon: '▶', label: 'Play example', variant: 'primary', action: () => this.narrator.startPlayExample(), title: 'Démo animée' },
      ],
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap(): Promise<void> {
    await this.ensureThree();
    if (this.disposed) return;
    this.initScene();
    this.loadInitialBacklog();
    this.animate();
    // 🎬 Intro cinématique
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 10, y: 8, z: 14 },
      { x: 0, y: 3, z: 0 },
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
    this.scene.background = new T.Color(0x0a1a0a);
    // Brouillard léger au sol
    this.scene.fog = new T.FogExp2(0x1a2a1a, 0.025);

    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(10, 8, 14);
    this.camera.lookAt(0, 3, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights : matin doux
    this.scene.add(new T.AmbientLight(0x6b8a6b, 0.55));
    const sun = new T.DirectionalLight(0xfff8e8, 0.95);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);
    this.scene.add(new T.HemisphereLight(0xfacc15, 0x1a2a1a, 0.5));

    // Sky universel
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 500, starRadius: 75,
      moonPos: [-22, 26, -22],
      auroraPos: [0, 30, -40],
      cometPos: [22, 24, -18],
      shootingStarCount: 4,
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'refinement-orchard') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Build
    this.buildGroundAndFog(T);
    this.buildTrees(T);
    this.buildBasket(T);
    this.buildEagle(T);
    this.buildAnimals(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 3, 0);
      this.controls.maxDistance = 32;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🪶 Attach Narrator → loads refinement-orchard.tutorial.json
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'refinement-orchard',
    });
    console.log('[RefinementOrchard] 🍇 Verger ready — let the fruits ripen');
  }

  // ─── Sol vert clair + brouillard subtil ───
  private buildGroundAndFog(T: any): void {
    const floor = new T.Mesh(
      new T.CylinderGeometry(20, 20, 0.4, 64),
      new T.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.95 })
    );
    floor.position.y = -0.2;
    this.scene.add(floor);

    // Anneau de gazon plus clair (highlight central)
    const ring = new T.Mesh(
      new T.RingGeometry(2.5, 14, 64),
      new T.MeshStandardMaterial({ color: 0x6b8a4a, roughness: 0.9, side: T.DoubleSide, transparent: true, opacity: 0.4 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);

    // Pierres décoratives
    const stoneMat = new T.MeshStandardMaterial({ color: 0x808080, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 6; i++) {
      const stone = new T.Mesh(new T.DodecahedronGeometry(0.3 + Math.random() * 0.25, 0), stoneMat);
      const a = (i / 6) * Math.PI * 2;
      stone.position.set(Math.cos(a) * 11, 0.1, Math.sin(a) * 11);
      stone.scale.y = 0.55;
      this.scene.add(stone);
    }
  }

  // ─── 6 arbres (trunk cylinder brown + foliage icosahedron green) ───
  private buildTrees(T: any): void {
    // Cleanup
    for (const tr of this.trees) this.scene.remove(tr);
    this.trees = [];

    const positions: Array<[number, number]> = [
      [-8, -2],
      [-5, 4],
      [-1, -5],
      [3, 3],
      [6, -3],
      [8, 2],
    ];
    const trunkMat = new T.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.95 });
    const foliageMat = new T.MeshStandardMaterial({ color: 0x166534, emissive: 0x14532d, emissiveIntensity: 0.18, roughness: 0.7, flatShading: true });

    for (let ti = 0; ti < positions.length; ti++) {
      const [x, z] = positions[ti];
      const tree = new T.Group();
      tree.position.set(x, 0, z);
      tree.userData.tutorialId = ti === 0 ? 'tree' : undefined;
      tree.userData.treeIdx = ti;
      tree.userData.windPhase = Math.random() * Math.PI * 2;

      // Trunk
      const trunkH = 3.0 + Math.random() * 0.4;
      const trunk = new T.Mesh(
        new T.CylinderGeometry(0.32, 0.42, trunkH, 12),
        trunkMat
      );
      trunk.position.y = trunkH / 2;
      tree.add(trunk);

      // Foliage main (icosahedron green)
      const foliage = new T.Mesh(
        new T.IcosahedronGeometry(1.5, 0),
        foliageMat
      );
      foliage.position.y = trunkH + 0.6;
      foliage.scale.set(1, 0.9, 1);
      tree.add(foliage);
      // Two smaller foliage blobs
      const f2 = new T.Mesh(new T.IcosahedronGeometry(0.85, 0), foliageMat);
      f2.position.set(0.7, trunkH + 1.1, 0.4);
      tree.add(f2);
      const f3 = new T.Mesh(new T.IcosahedronGeometry(0.8, 0), foliageMat);
      f3.position.set(-0.5, trunkH + 1.3, -0.5);
      tree.add(f3);

      tree.userData.foliageCenterY = trunkH + 0.6;

      this.trees.push(tree);
      this.scene.add(tree);
    }
  }

  // ─── Fruits sur les arbres (sphères) ───
  private buildFruitsForTickets(T: any): void {
    // Cleanup
    for (const f of this.fruitMeshes) {
      if (f.parent) f.parent.remove(f);
    }
    this.fruitMeshes = [];
    this.fruitsByTicket.clear();

    const list = this.tickets();
    for (const t of list) {
      const tree = this.trees[t.treeIdx % this.trees.length];
      if (!tree) continue;
      const fruit = this.makeFruitMesh(T, t);
      // Position autour de la canopée
      const centerY = tree.userData.foliageCenterY ?? 3.5;
      const r = 1.1 + Math.random() * 0.4;
      const a = (t.fruitIdx / 5) * Math.PI * 2 + Math.random() * 0.3;
      const yOff = (Math.random() - 0.3) * 0.7;
      fruit.position.set(Math.cos(a) * r, centerY + yOff, Math.sin(a) * r);
      fruit.userData.ticketId = t.id;
      fruit.userData.basePhase = Math.random() * Math.PI * 2;
      fruit.userData.baseY = fruit.position.y;
      fruit.userData.baseScale = fruit.scale.x;
      fruit.userData.basePos = { x: fruit.position.x, y: fruit.position.y, z: fruit.position.z };
      tree.add(fruit);
      this.fruitMeshes.push(fruit);
      this.fruitsByTicket.set(t.id, fruit);
    }
  }

  private makeFruitMesh(T: any, t: OrchardTicket): any {
    const isGold = t.status === 'gold';
    const isYellow = t.status === 'yellow';
    const color = isGold ? 0xfbbf24 : (isYellow ? 0xfacc15 : 0x84cc16);
    const emissive = isGold ? 0xfbbf24 : (isYellow ? 0xa16207 : 0x365314);
    const mat = new T.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: isGold ? 0.8 : (isYellow ? 0.3 : 0.15),
      roughness: 0.4,
      metalness: isGold ? 0.4 : 0.1,
      transparent: !isGold,
      opacity: isGold ? 1.0 : 0.75,
    });
    // Taille selon estimate (fibonacci-like)
    const baseR = 0.18 + (t.estimate ?? 1) * 0.04;
    const fruit = new T.Mesh(new T.SphereGeometry(Math.min(baseR, 0.42), 12, 10), mat);
    if (t.id === this.tickets()[0]?.id) {
      fruit.userData.tutorialId = 'fruit';
    }
    return fruit;
  }

  // ─── Panier au centre (torus rouge + intérieur visible) ───
  private buildBasket(T: any): void {
    const grp = new T.Group();
    grp.position.set(0, 0.2, 0);
    grp.userData.tutorialId = 'basket';

    // Torus rouge (le bord du panier)
    const rim = new T.Mesh(
      new T.TorusGeometry(0.95, 0.16, 12, 32),
      new T.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0x7f1d1d, emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.2 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.55;
    grp.add(rim);

    // Fond du panier (cylindre court, intérieur visible)
    const bowl = new T.Mesh(
      new T.CylinderGeometry(0.9, 0.7, 0.5, 24, 1, true),
      new T.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85, side: T.DoubleSide })
    );
    bowl.position.y = 0.3;
    grp.add(bowl);

    // Bottom plate
    const bottom = new T.Mesh(
      new T.CircleGeometry(0.7, 24),
      new T.MeshStandardMaterial({ color: 0x4a1d10, roughness: 0.95 })
    );
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.06;
    grp.add(bottom);

    // Cordons croisés (panier tressé : 6 lignes verticales)
    const cordMat = new T.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.7 });
    for (let k = 0; k < 8; k++) {
      const cord = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.5, 6), cordMat);
      const a = (k / 8) * Math.PI * 2;
      cord.position.set(Math.cos(a) * 0.82, 0.3, Math.sin(a) * 0.82);
      grp.add(cord);
    }

    // Bandeau "Sprint"
    const tag = new T.Mesh(
      new T.PlaneGeometry(0.65, 0.18),
      new T.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfde68a, emissiveIntensity: 0.5, side: T.DoubleSide })
    );
    tag.position.set(0, 1.0, 1.0);
    tag.rotation.x = -0.15;
    grp.add(tag);

    this.basketGroup = grp;
    this.scene.add(grp);
  }

  // ─── Aigle messager qui survole (planet 2D sprite) ───
  private buildEagle(T: any): void {
    // Sprite simple : un plan colorié texturé avec un dégradé canvas
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // V shape (ailes d'oiseau stylisées)
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.moveTo(8, 36);
      ctx.lineTo(32, 26);
      ctx.lineTo(56, 36);
      ctx.lineTo(48, 40);
      ctx.lineTo(32, 32);
      ctx.lineTo(16, 40);
      ctx.closePath();
      ctx.fill();
      // Petit corps doré
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(32, 32, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new T.CanvasTexture(canvas);
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false });
    this.eagleSprite = new T.Sprite(mat);
    this.eagleSprite.scale.set(1.6, 1.6, 1);
    this.eagleSprite.userData.tutorialId = 'eagle';
    this.scene.add(this.eagleSprite);
  }

  // ─── Moutons / lapins au sol (petits boxes blanches stylisées) ───
  private buildAnimals(T: any): void {
    const positions: Array<[number, number]> = [
      [-6, 6],
      [4, 7],
      [-4, -7],
      [7, -6],
    ];
    for (let i = 0; i < positions.length; i++) {
      const [x, z] = positions[i];
      const grp = new T.Group();
      grp.position.set(x, 0, z);
      grp.userData.basePos = { x, z };
      grp.userData.phase = Math.random() * Math.PI * 2;

      // Corps (box blanc cassé)
      const body = new T.Mesh(
        new T.BoxGeometry(0.55, 0.4, 0.85),
        new T.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.9 })
      );
      body.position.y = 0.45;
      grp.add(body);
      // Tête (petit cube devant)
      const head = new T.Mesh(
        new T.BoxGeometry(0.32, 0.32, 0.32),
        new T.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.9 })
      );
      head.position.set(0, 0.6, 0.55);
      grp.add(head);
      // 4 pattes (petits cubes noirs)
      const legMat = new T.MeshStandardMaterial({ color: 0x44403c });
      for (let lx = -1; lx <= 1; lx += 2) {
        for (let lz = -1; lz <= 1; lz += 2) {
          const leg = new T.Mesh(new T.BoxGeometry(0.1, 0.25, 0.1), legMat);
          leg.position.set(lx * 0.18, 0.13, lz * 0.3);
          grp.add(leg);
        }
      }

      this.animals.push(grp);
      this.scene.add(grp);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA
  // ═══════════════════════════════════════════════════════════════════
  private loadInitialBacklog(): void {
    const init: OrchardTicket[] = [
      { id: 1, title: 'User profile redesign',  status: 'green',  estimate: 5,  treeIdx: 0, fruitIdx: 0 },
      { id: 2, title: 'Pagination cache fix',   status: 'yellow', estimate: 3,  treeIdx: 1, fruitIdx: 0 },
      { id: 3, title: 'Search ranking boost',   status: 'green',  estimate: 8,  treeIdx: 2, fruitIdx: 0 },
      { id: 4, title: 'CI flaky test cleanup',  status: 'gold',   estimate: 2,  treeIdx: 3, fruitIdx: 0 },
      { id: 5, title: 'Voice tour Spanish',     status: 'gold',   estimate: 5,  treeIdx: 4, fruitIdx: 0 },
      { id: 6, title: 'Mobile bottom-sheet',    status: 'green',  estimate: 13, treeIdx: 5, fruitIdx: 0 },
      // Extra fruits décoratifs sur les arbres (pas dans la sidebar)
      { id: 7, title: '(extra)',                status: 'green',  treeIdx: 0, fruitIdx: 1 },
      { id: 8, title: '(extra)',                status: 'green',  treeIdx: 0, fruitIdx: 2 },
      { id: 9, title: '(extra)',                status: 'green',  treeIdx: 2, fruitIdx: 1 },
      { id: 10, title: '(extra)',               status: 'green',  treeIdx: 4, fruitIdx: 1 },
      { id: 11, title: '(extra)',               status: 'green',  treeIdx: 5, fruitIdx: 1 },
      { id: 12, title: '(extra)',               status: 'gold',   treeIdx: 1, fruitIdx: 1 },
    ];
    this.tickets.set(init);
    this.recomputeStats();
    const T = (window as any).THREE;
    if (T) this.buildFruitsForTickets(T);
    this.emitCeremony({ type: 'harvest', label: '🍇 Verger ouvert · 12 fruits à affiner', icon: '🍇' });
  }

  private recomputeStats(): void {
    this.dorOkCount.set(this.tickets().filter(t => t.status === 'gold').length);
    this.basketCount.set(this.basketFruits.length);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CEREMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }): void {
    this.ceremonyBus.publishFromRoom('refinement-orchard', c);
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

  /** ⏱ Lance le mode TIMEBOX RÉEL — HUD countdown avec la vraie durée Scrum, sans narration. */
  onSplashTimebox(): void {
    this.splashVisible.set(false);
    this.narrator.startTimeboxOnly(3600, 'Refinement');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS (called by playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════════

  /** Step ~10s : 1er fruit cueilli (highlight zoom) */
  pickFirstFruit(): void {
    const list = this.tickets();
    const target = list.find(t => t.status === 'green');
    if (target) {
      this.estimateTicketId = target.id;
      this.estimateScale = 1.0;
      this.dorPulseT0 = performance.now();
    }
    this.emitCeremony({ type: 'harvest', label: '🪜 Fruit cueilli · ' + (target?.title ?? 'ticket'), icon: '🪜' });
  }

  /** Step ~22s : split en 2 fruits plus petits */
  splitFruit(): void {
    const T = (window as any).THREE;
    const list = [...this.tickets()];
    const target = list.find(t => t.id === this.estimateTicketId) ?? list.find(t => t.status === 'green');
    if (!target) return;
    // Create 2 smaller copies
    const a: OrchardTicket = { id: target.id * 100 + 1, title: target.title + ' (part A)', status: 'green', estimate: Math.max(1, Math.floor((target.estimate ?? 5) / 2)), treeIdx: target.treeIdx, fruitIdx: target.fruitIdx + 5 };
    const b: OrchardTicket = { id: target.id * 100 + 2, title: target.title + ' (part B)', status: 'green', estimate: Math.max(1, Math.ceil((target.estimate ?? 5) / 2)), treeIdx: target.treeIdx, fruitIdx: target.fruitIdx + 6 };
    this.tickets.update(prev => prev.map(t => t.id === target.id ? a : t).concat([b]));
    this.estimateTicketId = a.id;
    this.recomputeStats();
    if (T) this.buildFruitsForTickets(T);
    this.emitCeremony({ type: 'harvest', label: '✂ Story split · 2 fruits plus petits', icon: '✂' });
  }

  /** Step ~35s : estimation (taille du fruit grandit selon fibonacci) */
  estimateFibonacci(): void {
    const T = (window as any).THREE;
    const targetId = this.estimateTicketId;
    if (targetId == null) return;
    const fib = [1, 2, 3, 5, 8];
    const picked = fib[Math.floor(Math.random() * fib.length)];
    this.tickets.update(prev => prev.map(t => t.id === targetId ? { ...t, estimate: picked, status: 'yellow' as const } : t));
    this.recomputeStats();
    if (T) this.buildFruitsForTickets(T);
    this.emitCeremony({ type: 'harvest', label: '📏 Estimation · ' + picked + ' points', icon: '📏' });
  }

  /** Step ~50s : DoR check (fruit devient doré) */
  dorCheck(): void {
    const T = (window as any).THREE;
    const targetId = this.estimateTicketId;
    if (targetId == null) return;
    this.tickets.update(prev => prev.map(t => t.id === targetId ? { ...t, status: 'gold' as const } : t));
    this.dorPulseT0 = performance.now();
    this.recomputeStats();
    if (T) this.buildFruitsForTickets(T);
    this.emitCeremony({ type: 'harvest', label: '✨ DoR check OK · fruit doré', icon: '✨' });
  }

  /** Step ~65s : tombe dans panier sprint */
  dropIntoBasket(): void {
    const T = (window as any).THREE;
    const targetId = this.estimateTicketId;
    if (targetId == null) return;
    this.fallTicketId = targetId;
    this.fallT0 = performance.now();
    this.emitCeremony({ type: 'harvest', label: '🧺 Sprint basket · ticket ready', icon: '🧺' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;
    const nowMs = performance.now();

    if (this.sky) this.sky.tick(dt, this.elapsed);

    // Trees : sway léger (vent)
    for (const tree of this.trees) {
      const phase = tree.userData.windPhase ?? 0;
      tree.rotation.z = Math.sin(this.elapsed * 0.6 + phase) * 0.025;
      tree.rotation.x = Math.cos(this.elapsed * 0.4 + phase) * 0.018;
    }

    // Fruits : bob léger + pulse doré
    for (const fruit of this.fruitMeshes) {
      const phase = fruit.userData.basePhase ?? 0;
      const baseY = fruit.userData.baseY ?? 3.5;
      fruit.position.y = baseY + Math.sin(this.elapsed * 1.2 + phase) * 0.04;
      const ticketId = fruit.userData.ticketId;
      const ticket = this.tickets().find(t => t.id === ticketId);
      if (ticket && ticket.status === 'gold' && fruit.material) {
        fruit.material.emissiveIntensity = 0.7 + Math.sin(this.elapsed * 4 + phase) * 0.35;
      }

      // Estimation : fruit cible grandit progressivement
      if (this.estimateTicketId === ticketId && ticket && ticket.status !== 'gold') {
        const target = (ticket.estimate ?? 1);
        const targetScale = 1.0 + Math.min(target * 0.08, 0.5);
        const cur = fruit.scale.x;
        const newScale = cur + (targetScale - cur) * dt * 1.4;
        fruit.scale.setScalar(newScale);
      }

      // Fall into basket
      if (this.fallTicketId === ticketId) {
        const elapsed = (nowMs - this.fallT0) / 1000;
        const dur = 1.8;
        const t = Math.min(1, elapsed / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const from = fruit.userData.basePos;
        // worldPos target = (0, 0.5, 0) — basket
        // But fruit is child of tree, so compute relative target
        if (from && fruit.parent) {
          const worldTarget = { x: 0, y: 0.55, z: 0 };
          // tree position
          const tp = fruit.parent.position;
          const relTarget = { x: worldTarget.x - tp.x, y: worldTarget.y - tp.y, z: worldTarget.z - tp.z };
          // arc
          const arc = (1.5) * (4 * t * (1 - t));
          fruit.position.x = from.x + (relTarget.x - from.x) * e;
          fruit.position.y = from.y + (relTarget.y - from.y) * e + arc;
          fruit.position.z = from.z + (relTarget.z - from.z) * e;
        }
        if (t >= 1 && this.fallTicketId === ticketId) {
          // Once landed, reparent visually : move to scene root + record basket fruit
          this.basketFruits.push(fruit);
          this.basketCount.set(this.basketFruits.length);
          this.fallTicketId = null;
        }
      }
    }

    // Aigle messager : survole en cercle au-dessus
    if (this.eagleSprite) {
      this.eagleData.angle += dt * 0.4;
      this.eagleSprite.position.set(
        Math.cos(this.eagleData.angle) * this.eagleData.radius,
        this.eagleData.height + Math.sin(this.elapsed * 0.7) * 0.4,
        Math.sin(this.eagleData.angle) * this.eagleData.radius,
      );
    }

    // Animaux : petit hop random
    for (const a of this.animals) {
      const ph = a.userData.phase ?? 0;
      a.position.y = Math.abs(Math.sin(this.elapsed * 1.8 + ph)) * 0.08;
    }

    // DoR pulse (golden flash)
    if (this.dorPulseT0 > 0 && nowMs - this.dorPulseT0 < 1200) {
      // visual sugar: golden glow on basket
      if (this.basketGroup) {
        const t = (nowMs - this.dorPulseT0) / 1200;
        const pulse = Math.sin(t * Math.PI) * 0.5;
        this.basketGroup.scale.setScalar(1 + pulse * 0.08);
      }
    } else if (this.basketGroup) {
      this.basketGroup.scale.setScalar(1);
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
