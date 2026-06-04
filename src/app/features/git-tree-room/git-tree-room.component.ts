// ═══════════════════════════════════════════════════════════════════
// 🌳 GIT TREE ROOM — L'Arbre des Lignées
//
// Mécanique data unique : chaque branche git est une VRAIE branche physique
// qui pousse depuis le tronc. Les feuilles = commits, les fruits = releases.
//
// Implémentation : Three.js procedural tree, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🌸 Bloom = branch created (fleurs roses sur la branche)
//   🍂 Fall = branch deleted (cascade dorée de feuilles)
//   🪓 Pruning = force-push (branche s'effrite)
//   🌳 Harvest = release tagged (fruits cueillis + carillon)
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
import { createPortal3D, getIslandForRoom, PortalHandle } from '../../core/portal/portal.factory';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent, TutorialStep } from '../../core/spell-ui';

interface GitBranchData {
  name: string;
  ahead: number;        // commits ahead of main
  behind: number;
  lastPushAt: Date;
  isStale: boolean;
  authorColor: string;  // couleur des feuilles
  hasRelease?: { tag: string; state: 'draft' | 'published' };
}

interface GitTreeCommit {
  sha: string;
  author: string;
  message: string;
  timestamp: number;
  authorColor: string;
}

@Component({
  selector: 'wt-git-tree-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gt-host">
      <header class="gt-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#67e8f9" [routerLink]="'/yamzy-island'" icon="←">Yamzy Island</wt-spell-btn>
        <div class="gt-title">
          <h1>🌳 GIT TREE ROOM</h1>
          <p>L'Arbre des Lignées — {{ branches().length }} branches · {{ totalCommits() }} commits · {{ releases().length }} fruits</p>
        </div>
        <div class="gt-legend">
          <span class="dot trunk"></span>main
          <span class="dot leaf"></span>commit
          <span class="dot fruit"></span>release
          <span class="dot mushroom"></span>stash
        </div>
      </header>

      <canvas #canvas class="gt-canvas"></canvas>

      <footer class="gt-controls">
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="loadDemo()" icon="🎬">Demo repo (8 branches)</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="toggleSeason()">{{ season() === 'spring' ? '🍂 Autumn' : '🌸 Spring' }}</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="resetCamera()" icon="🎥">Reset cam</wt-spell-btn>
        <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9" (click)="pruneStale()" icon="🪓">Prune stale</wt-spell-btn>
        <wt-spell-btn variant="primary" size="sm" accent="#67e8f9" (click)="openTutorial()" icon="🎓" title="Visite guidée par Yamzy">How it works</wt-spell-btn>
        <wt-spell-btn variant="primary" size="sm" accent="#67e8f9" (click)="narrator.startPlayExample()" icon="▶" title="Démo animée">Play example</wt-spell-btn>
        <span class="hint">Mouse drag = orbit · molette = zoom · clic feuille = commit</span>
      </footer>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="gt-flash" [attr.data-type]="f.type">
        <div class="gt-flash-content">
          <div class="gt-flash-icon">{{ f.icon }}</div>
          <div class="gt-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel commit info -->
      <wt-spell-panel
        [open]="!!selectedCommit()"
        title="Détail de la lignée"
        icon="🌳"
        accent="#67e8f9"
        side="right"
        size="sm"
        (close)="selectedCommit.set(null)">
        <ng-container *ngIf="selectedCommit() as c">
          <div class="gt-panel-head">
            <strong class="gt-panel-sha">{{ c.sha.slice(0, 7) }}</strong>
            <span class="gt-panel-author" [style.color]="c.authorColor">{{ c.author }}</span>
          </div>
          <div class="gt-panel-msg">{{ c.message }}</div>
          <div class="gt-panel-time">{{ fmtAgo(c.timestamp) }}</div>
        </ng-container>
      </wt-spell-panel>

      <!-- 🎬 Splash overlay (welcome screen avant entrée) -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Git Tree"
        loreName="L'Arbre des Lignées"
        color="#15803d"
        oneLiner="Chêne 3D : commits = feuilles, releases = fruits dorés, branches = vraies branches git."
        [duration]="60"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Git Tree"
        loreName="L'Arbre des Lignées"
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
    .gt-host { position: relative; width: 100%; height: 100vh; background: #0a1612; color: #e8eaf6; font-family: system-ui, sans-serif; }
    .gt-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .gt-topbar > * { pointer-events: auto; }
    .gt-back { color: #86efac; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #15803d; border-radius: 8px; background: rgba(0,40,20,0.4); }
    .gt-back:hover { background: rgba(20,128,61,0.4); }
    .gt-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #86efac; }
    .gt-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.7; }
    .gt-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; }
    .gt-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .gt-legend .trunk    { background: #6b4423; }
    .gt-legend .leaf     { background: #4ade80; }
    .gt-legend .fruit    { background: #facc15; box-shadow: 0 0 8px #facc15; }
    .gt-legend .mushroom { background: #dc2626; }

    .gt-canvas { display: block; width: 100%; height: 100%; }
    .gt-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); }
    .gt-controls button { background: rgba(20,40,30,0.7); color: #e8eaf6; border: 1px solid #15803d; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .gt-controls button:hover { background: rgba(20,128,61,0.6); }
    .gt-controls .gt-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .gt-controls .gt-narrator:hover { background: rgba(251,191,36,0.3); }
    .gt-controls .gt-narrator.gt-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .gt-controls .gt-narrator.gt-play:hover { background: #f5b923; }
    .gt-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .gt-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: gt-flash-pulse 1.4s ease-out forwards; }
    .gt-flash[data-type="bloom"]   { background: radial-gradient(circle at center, rgba(244,114,182,0.5), transparent 60%); }
    .gt-flash[data-type="fall"]    { background: radial-gradient(circle at center, rgba(250,204,21,0.55), transparent 60%); }
    .gt-flash[data-type="pruning"] { background: radial-gradient(circle at center, rgba(220,38,38,0.5), transparent 60%); }
    .gt-flash[data-type="harvest"] { background: radial-gradient(circle at center, rgba(250,204,21,0.7), transparent 70%); }
    .gt-flash-content { text-align: center; animation: gt-flash-grow 1.4s cubic-bezier(0.16, 1, 0.3, 1); }
    .gt-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .gt-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.5); }
    @keyframes gt-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes gt-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    /* Panel commit */
    .gt-panel { position: absolute; right: 22px; top: 80px; width: 280px; padding: 14px; background: rgba(15,30,20,0.92); border: 1px solid #15803d; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; }
    .gt-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(134, 239, 172, 0.4); border-radius: 50%; color: #86efac; cursor: pointer; }
    .gt-panel-head { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
    .gt-panel-sha { color: #facc15; font-family: monospace; }
    .gt-panel-author { font-weight: 600; }
    .gt-panel-msg { color: #e2e8f0; margin: 8px 0; line-height: 1.4; }
    .gt-panel-time { font-size: 10px; opacity: 0.6; }
  `]
})
export class GitTreeRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private ceremonyBus = inject(CeremonyBusService);

  // Méthode publique pour le narrator (emit ceremony from JSON tutorial)
  public emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('git-tree-room', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1400);
  }

  branches = signal<GitBranchData[]>([]);
  releases = signal<{ tag: string; branch: string }[]>([]);
  totalCommits = signal<number>(0);
  season = signal<'spring' | 'autumn'>('spring');
  selectedCommit = signal<GitTreeCommit | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🌳', title: 'Le tronc, c\'est main', body: 'Le tronc épais central représente la branche principale. Sa hauteur reflète l\'historique cumulé des commits.' },
    { icon: '🌿', title: 'Branches = vraies branches git', body: 'Chaque branche git pousse depuis le tronc avec un angle déterministe (hash du nom). Sa longueur est proportionnelle au nombre de commits d\'avance.' },
    { icon: '🍃', title: 'Feuilles = commits', body: 'Chaque feuille colorée est un commit. La couleur correspond à l\'auteur. Cliquez sur une feuille pour voir le SHA, l\'auteur et le message.' },
    { icon: '🍎', title: 'Fruits = releases', body: 'Les fruits dorés brillants au bout des branches sont des releases publiées. Les verts sont en draft.' },
    { icon: '🍄', title: 'Champignons = stashes', body: 'À la base du tronc, les petits champignons rouges représentent les stashes git en attente.' },
  ];
  tutorialVoiceLines: string[] = [
    'Le tronc, c\'est la branche main.',
    'Chaque branche git est une vraie branche physique.',
    'Les feuilles colorées sont les commits.',
    'Les fruits dorés sont les releases publiées.',
    'Les champignons à la base sont les stashes.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;

  // 3D refs
  private trunk: any;
  private branchMeshes = new Map<string, any>();
  private leafMeshes: any[] = [];      // toutes les feuilles (clic = commit)
  private commitsByLeaf = new Map<any, GitTreeCommit>();
  private fruitMeshes: any[] = [];
  private mushroomMeshes: any[] = [];
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private ceremonyFlashTimer: any = null;
  private windTime = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

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

  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scene
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a1612);
    this.scene.fog = new T.FogExp2(0x0a1612, 0.018);

    // Camera
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(0, 6, 18);
    this.camera.lookAt(0, 4, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights — golden hour forest
    this.scene.add(new T.AmbientLight(0x4a6b4a, 0.4));
    const sun = new T.DirectionalLight(0xfff4d4, 0.9);
    sun.position.set(8, 14, 6);
    this.scene.add(sun);
    const fillBlue = new T.HemisphereLight(0x90b8ff, 0x335533, 0.3);
    this.scene.add(fillBlue);

    // Ground (mossy forest floor)
    const groundGeom = new T.PlaneGeometry(40, 40, 8, 8);
    const groundMat = new T.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.95 });
    const ground = new T.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    this.scene.add(ground);

    // Stars (fond + fireflies forest)
    this.createFireflies(T, 80);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 4, 0);
      this.controls.maxDistance = 50;
      this.controls.minDistance = 2;
    }

    // Raycaster pour cliquer feuilles
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Livraison)
    const island = getIslandForRoom('/git-tree-room');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-12, 3.5, 0],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[GitTree] 🌳 Forest scene ready');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'git-tree-room',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : tronc + branches + feuilles + fruits + champignons
  // ═══════════════════════════════════════════════════════════════════
  private buildTree(branches: GitBranchData[]) {
    const T = (window as any).THREE;
    // Cleanup
    this.disposeTreeMeshes();

    // ─── Tronc (main branch) ───
    const trunkH = 8;
    const trunkR = 0.45;
    const trunkGeom = new T.CylinderGeometry(trunkR * 0.8, trunkR, trunkH, 12, 8);
    const trunkMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95, metalness: 0.05 });
    this.trunk = new T.Mesh(trunkGeom, trunkMat);
    this.trunk.position.y = trunkH / 2;
    // 🪶 Narrator tag : permet le highlight depuis le tutorial JSON
    this.trunk.userData.tutorialId = 'trunk';
    this.scene.add(this.trunk);

    // Mark trunk = main branch
    const mainCommits = this.generateCommitsFor('main', 50);  // beaucoup de commits sur main
    this.attachLeavesToBranch(this.trunk, mainCommits, trunkH, trunkR, T);

    // ─── Branches ───
    let placed = 0;
    for (const branch of branches) {
      this.growBranch(branch, T);
      placed++;
    }

    // ─── Champignons (stashes) à la base ───
    this.spawnMushrooms(3 + Math.floor(Math.random() * 5), T);

    console.log(`[GitTree] 🌳 Tree built : 1 trunk + ${placed} branches + ${this.leafMeshes.length} leaves + ${this.fruitMeshes.length} fruits + ${this.mushroomMeshes.length} mushrooms`);
  }

  private growBranch(branch: GitBranchData, T: any) {
    // Angle déterministe via hash du name
    const angle = this.hashAngle(branch.name);
    const heightOnTrunk = 2 + this.hashHeight(branch.name) * 5;  // entre 2 et 7
    // Branch length ∝ ahead commits
    const length = Math.max(1.5, Math.min(6, branch.ahead * 0.35 + 1.5));
    // Branch tilt (vers le haut, varie par hash)
    const tilt = Math.PI / 4 + (this.hashAngle(branch.name + '_t') / Math.PI) * 0.3;
    const radius = 0.08 + Math.min(0.12, branch.ahead * 0.005);

    const geom = new T.CylinderGeometry(radius * 0.6, radius, length, 8);
    const color = branch.isStale ? 0x4a5d3d : 0x8b6b3e;
    const mat = new T.MeshStandardMaterial({ color, roughness: 0.85 });
    const mesh = new T.Mesh(geom, mat);

    // Position : on the trunk side
    const trunkRadius = 0.4;
    mesh.position.set(
      Math.cos(angle) * trunkRadius,
      heightOnTrunk,
      Math.sin(angle) * trunkRadius,
    );

    // Orientation : tilt outward + upward
    // Cylinder is Y-aligned by default. We want it along (cos(a), tilt, sin(a))
    const direction = new T.Vector3(Math.cos(angle), Math.cos(tilt), Math.sin(angle)).normalize();
    const axis = new T.Vector3(0, 1, 0);
    const quaternion = new T.Quaternion().setFromUnitVectors(axis, direction);
    mesh.quaternion.copy(quaternion);

    // Shift along its own axis so its base is on the trunk (not centered)
    mesh.position.add(direction.clone().multiplyScalar(length / 2));

    // Mossy texture if stale
    if (branch.isStale) {
      mesh.userData.isStale = true;
      // Add green moss specks via emissive
      mat.emissive = new T.Color(0x1a3a1a);
      mat.emissiveIntensity = 0.2;
    }

    // 🪶 Narrator tag : permet highlight de toutes les branches via tutorialId
    mesh.userData.tutorialId = 'branch';
    this.branchMeshes.set(branch.name, mesh);
    this.scene.add(mesh);

    // ─── Feuilles (commits) sur cette branche ───
    const commits = this.generateCommitsFor(branch.name, branch.ahead);
    const tipPos = mesh.position.clone().add(direction.clone().multiplyScalar(length / 2));
    this.attachLeavesToBranch(mesh, commits, length, radius, T, branch.authorColor);

    // ─── Fruit (release) au bout de la branche ───
    if (branch.hasRelease) {
      const fruitColor = branch.hasRelease.state === 'published' ? 0xfacc15 : 0x84cc16;
      const fruitGeom = new T.SphereGeometry(0.25, 16, 12);
      const fruitMat = new T.MeshStandardMaterial({
        color: fruitColor,
        emissive: fruitColor,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.4,
      });
      const fruit = new T.Mesh(fruitGeom, fruitMat);
      fruit.position.copy(tipPos);
      fruit.userData = { kind: 'release', tag: branch.hasRelease.tag, branch: branch.name, tutorialId: 'fruit' };
      this.fruitMeshes.push(fruit);
      this.scene.add(fruit);
    }
  }

  private attachLeavesToBranch(branchMesh: any, commits: GitTreeCommit[], length: number, radius: number, T: any, authorColorOverride?: string) {
    const leafCount = Math.min(commits.length, 12);  // max 12 feuilles par branche pour perf
    for (let i = 0; i < leafCount; i++) {
      const t = (i + 1) / (leafCount + 1);  // position le long de la branche (0-1)
      const angleAround = (i / leafCount) * Math.PI * 2 + Math.random() * 0.5;
      const radial = radius * 1.8 + Math.random() * 0.3;
      // World position : approximation simple
      const leafGeom = new T.IcosahedronGeometry(0.13, 0);
      const baseColor = this.season() === 'autumn' ? '#dc7633' : (authorColorOverride || commits[i].authorColor);
      const leafMat = new T.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.15,
        roughness: 0.7,
      });
      const leaf = new T.Mesh(leafGeom, leafMat);
      // Position relative au mesh de la branche
      branchMesh.updateMatrixWorld();
      const localPos = new T.Vector3(
        Math.cos(angleAround) * radial,
        (t - 0.5) * length * 0.9,
        Math.sin(angleAround) * radial,
      );
      leaf.position.copy(localPos);
      leaf.userData.tutorialId = 'leaf';
      branchMesh.add(leaf);
      this.leafMeshes.push(leaf);
      this.commitsByLeaf.set(leaf, commits[i]);
      // Petite rotation aléatoire
      leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      // Wind sway speed
      leaf.userData.windPhase = Math.random() * Math.PI * 2;
      leaf.userData.basePos = localPos.clone();
    }
  }

  private spawnMushrooms(n: number, T: any) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 0.6;
      // Stem (small cylinder)
      const stemGeom = new T.CylinderGeometry(0.04, 0.05, 0.18, 6);
      const stemMat = new T.MeshStandardMaterial({ color: 0xfae6c0, roughness: 0.8 });
      const stem = new T.Mesh(stemGeom, stemMat);
      stem.position.set(Math.cos(angle) * r, 0.09, Math.sin(angle) * r);
      // Cap (red half-sphere)
      const capGeom = new T.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new T.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55, emissive: 0x551111, emissiveIntensity: 0.3 });
      const cap = new T.Mesh(capGeom, capMat);
      cap.position.copy(stem.position);
      cap.position.y += 0.16;
      cap.userData = { kind: 'stash', tutorialId: 'mushroom' };
      stem.userData.tutorialId = 'mushroom';
      this.mushroomMeshes.push(stem, cap);
      this.scene.add(stem, cap);
    }
  }

  private createFireflies(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = 2 + Math.random() * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xfff4a0, size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.9 });
    const fireflies = new T.Points(geom, mat);
    fireflies.userData.kind = 'fireflies';
    fireflies.userData.tutorialId = 'firefly';
    this.scene.add(fireflies);
  }

  private disposeTreeMeshes() {
    // Remove trunk, branches, leaves, fruits, mushrooms
    if (this.trunk) { this.scene.remove(this.trunk); this.trunk = null; }
    this.branchMeshes.forEach(b => this.scene.remove(b));
    this.branchMeshes.clear();
    this.leafMeshes.forEach(l => l.parent?.remove(l));
    this.leafMeshes = [];
    this.commitsByLeaf.clear();
    this.fruitMeshes.forEach(f => this.scene.remove(f));
    this.fruitMeshes = [];
    this.mushroomMeshes.forEach(m => this.scene.remove(m));
    this.mushroomMeshes = [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA
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
    ];
    const branchSpecs: Array<Partial<GitBranchData> & { ahead: number }> = [
      { name: 'feature/cosmos-orrery',  ahead: 24, behind: 2,  lastPushAt: new Date(now - 1 * day),  isStale: false, hasRelease: { tag: 'v1.0.144', state: 'published' } },
      { name: 'feature/auth-oauth',     ahead: 18, behind: 0,  lastPushAt: new Date(now - 2 * day),  isStale: false },
      { name: 'bugfix/yamzy-anim',      ahead: 4,  behind: 8,  lastPushAt: new Date(now - 3 * day),  isStale: false },
      { name: 'feature/git-tree-room',  ahead: 8,  behind: 1,  lastPushAt: new Date(now - 1 * day),  isStale: false, hasRelease: { tag: 'v1.1.0-draft', state: 'draft' } },
      { name: 'feature/finops-cellar',  ahead: 12, behind: 5,  lastPushAt: new Date(now - 5 * day),  isStale: false },
      { name: 'wip/star-map-risks',     ahead: 6,  behind: 3,  lastPushAt: new Date(now - 7 * day),  isStale: false },
      { name: 'archive/old-billing',    ahead: 2,  behind: 25, lastPushAt: new Date(now - 60 * day), isStale: true },
      { name: 'experiment/wasm-renderer', ahead: 15, behind: 8, lastPushAt: new Date(now - 40 * day), isStale: true },
    ];
    const branches: GitBranchData[] = branchSpecs.map((b, i) => {
      const author = authors[i % authors.length];
      return {
        name: b.name!,
        ahead: b.ahead,
        behind: b.behind ?? 0,
        lastPushAt: b.lastPushAt ?? new Date(),
        isStale: b.isStale ?? false,
        authorColor: author.color,
        hasRelease: b.hasRelease,
      };
    });
    this.branches.set(branches);
    this.releases.set(branches.filter(b => b.hasRelease).map(b => ({ tag: b.hasRelease!.tag, branch: b.name })));
    const total = 50 + branches.reduce((s, b) => s + b.ahead, 0);
    this.totalCommits.set(total);
    this.buildTree(branches);
    this.emitCeremony({ type: 'bloom', label: 'Repository chargé · 8 branches floraissent', icon: '🌸' });
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
  // CÉRÉMONIES — emitCeremony() est public au-dessus (utilisé aussi par Narrator)
  // ═══════════════════════════════════════════════════════════════════
  pruneStale() {
    const survivors = this.branches().filter(b => !b.isStale);
    const pruned = this.branches().length - survivors.length;
    if (pruned > 0) {
      this.branches.set(survivors);
      this.buildTree(survivors);
      this.emitCeremony({ type: 'pruning', label: `🪓 ${pruned} branches stale élaguées`, icon: '🪓' });
    }
  }

  toggleSeason() {
    const next = this.season() === 'spring' ? 'autumn' : 'spring';
    this.season.set(next);
    this.buildTree(this.branches());
    this.emitCeremony({
      type: next === 'autumn' ? 'fall' : 'bloom',
      label: next === 'autumn' ? 'Automne · Les feuilles dorent' : 'Printemps · Renouveau',
      icon: next === 'autumn' ? '🍂' : '🌸',
    });
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 6, 18);
    this.camera.lookAt(0, 4, 0);
    if (this.controls) this.controls.target.set(0, 4, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic feuille → afficher commit
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
    const intersects = this.raycaster.intersectObjects(this.leafMeshes, false);
    if (intersects.length > 0) {
      const commit = this.commitsByLeaf.get(intersects[0].object);
      if (commit) {
        this.selectedCommit.set(commit);
        // Petit flash au-dessus de la feuille
        intersects[0].object.scale.set(1.8, 1.8, 1.8);
        setTimeout(() => intersects[0].object.scale.set(1, 1, 1), 200);
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
    this.windTime += dt;

    // Wind sway on leaves
    for (const leaf of this.leafMeshes) {
      const phase = leaf.userData.windPhase || 0;
      const base = leaf.userData.basePos;
      if (base) {
        leaf.position.x = base.x + Math.sin(this.windTime * 1.5 + phase) * 0.04;
        leaf.position.y = base.y + Math.sin(this.windTime * 2 + phase) * 0.03;
      }
      leaf.rotation.y += dt * 0.3;
    }

    // Fruits bobbing
    for (const fruit of this.fruitMeshes) {
      fruit.position.y += Math.sin(this.windTime * 1.2 + (fruit.userData.phase || 0)) * 0.002;
    }

    // Fireflies flicker
    this.scene.traverse((obj: any) => {
      if (obj.userData?.kind === 'fireflies' && obj.material) {
        obj.material.opacity = 0.5 + Math.sin(this.windTime * 3) * 0.3;
      }
    });

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.windTime);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════
  private hashAngle(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return (h / 360) * Math.PI * 2;
  }
  private hashHeight(s: string): number {
    let h = 17;
    for (let i = 0; i < s.length; i++) h = (h * 17 + s.charCodeAt(i)) % 100;
    return h / 100;  // 0-1
  }

  private generateCommitsFor(branchName: string, count: number): GitTreeCommit[] {
    const authors = [
      { name: 'Ramzy', color: '#86efac' },
      { name: 'Alice', color: '#60a5fa' },
      { name: 'Bob',   color: '#fbbf24' },
      { name: 'Maya',  color: '#f472b6' },
      { name: 'Yves',  color: '#a78bfa' },
    ];
    const messages = [
      'feat: add new feature', 'fix: bug correction', 'refactor: cleanup module',
      'docs: update README', 'test: add unit tests', 'style: format code',
      'perf: optimize rendering', 'chore: bump deps', 'feat: implement endpoint',
    ];
    const out: GitTreeCommit[] = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const author = authors[(this.hashHeight(branchName + i) * authors.length) | 0];
      out.push({
        sha: this.fakeSha(branchName + i),
        author: author.name,
        message: messages[i % messages.length],
        timestamp: now - i * 3600000,
        authorColor: author.color,
      });
    }
    return out;
  }
  private fakeSha(seed: string): string {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0') + Math.random().toString(16).slice(2, 10);
  }

  fmtAgo(ts: number): string {
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'il y a quelques minutes';
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
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
