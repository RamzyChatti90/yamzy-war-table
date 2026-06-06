// ═══════════════════════════════════════════════════════════════════
// 🏛 LIBRARY CATHEDRAL ROOM — La Bibliothèque du Conclave
//
// Mécanique data unique : cathédrale 3D que l'on visite. Les rayonnages
// montent vers la voûte. Chaque livre = un article du wiki. La lumière
// dorée filtre par les vitraux. Un aigle messager descend du clocher
// pour annoncer un nouvel article. Des fils dorés relient les articles
// cross-référencés. Un sphère lumineuse de recherche illumine les livres
// pertinents.
//
// Implémentation : Three.js procedural cathedral, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   📜 Ouverture = nouvel article publié (aigle solennel + carillon)
//   ⏰ Audit = nettoyage hebdo des livres stale (rituel des poussières)
//   🔱 Conclave = 5+ utilisateurs lisent le même article (couronne d'or)
//   🌟 Article culte = >1000 lectures (vitrail dédié + starburst)
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

interface RuneArticle {
  id: number;
  slug: string;
  title: string;
  category: string;       // catégorie => couleur du livre
  categoryColor: string;
  author: string;
  readCount: number;      // épaisseur du livre (popularité)
  editCount: number;
  lastReadAt: Date;
  lastEditAt: Date;
  status: 'draft' | 'published' | 'archived';
  isStale: boolean;       // > 6 mois sans lecture => toile d'araignée
  isTrending: boolean;    // dans le top des lectures
  isBeingEdited: boolean; // marque-page rouge sortant
  isCult: boolean;        // > 1000 lectures => vitrail dédié
  crossRefs: number[];    // ids des articles liés
}

@Component({
  selector: 'wt-library-cathedral-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lc-host">
      <header class="lc-topbar">
        <div class="lc-title">
          <h1>🏛 LIBRARY CATHEDRAL</h1>
          <p>La Bibliothèque du Conclave — {{ articles().length }} articles · {{ trendingCount() }} trending · {{ staleCount() }} stale · {{ crossRefCount() }} fils dorés</p>
        </div>
        <div class="lc-legend">
          <span class="dot tech"></span>tech
          <span class="dot rh"></span>RH
          <span class="dot biz"></span>biz
          <span class="dot legal"></span>légal
          <span class="dot ops"></span>ops
          <span class="dot cult"></span>culte
        </div>
      </header>

      <canvas #canvas class="lc-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="lc-flash" [attr.data-type]="f.type">
        <div class="lc-flash-content">
          <div class="lc-flash-icon">{{ f.icon }}</div>
          <div class="lc-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel article info (sur clic d'un livre) -->
      <div *ngIf="selectedArticle() as a" class="lc-panel">
        <button class="lc-panel-close" (click)="selectedArticle.set(null)">×</button>
        <div class="lc-panel-head">
          <span class="lc-panel-cat" [style.background]="a.categoryColor">{{ a.category }}</span>
          <span class="lc-panel-status" [attr.data-status]="a.status">{{ a.status }}</span>
        </div>
        <div class="lc-panel-title">{{ a.title }}</div>
        <div class="lc-panel-author">par {{ a.author }}</div>
        <div class="lc-panel-stats">
          <div><strong>{{ a.readCount }}</strong> lectures</div>
          <div><strong>{{ a.editCount }}</strong> éditions</div>
        </div>
        <div class="lc-panel-time">Dernière édition : {{ fmtAgo(a.lastEditAt.getTime()) }}</div>
        <div *ngIf="a.isStale" class="lc-panel-warn">🕸 Article stale — à dépoussiérer</div>
        <div *ngIf="a.isCult" class="lc-panel-cult">🌟 Article culte — vitrail dédié</div>
        <div *ngIf="a.crossRefs.length > 0" class="lc-panel-refs">🔗 {{ a.crossRefs.length }} cross-references</div>
      </div>

      <!-- 🎬 Welcome splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Library Cathedral"
        loreName="La Bibliothèque du Conclave"
        color="#0891b2"
        oneLiner="50 livres procéduraux, vitraux, aigle messager, sphère de recherche luminueuse."
        [duration]="65"
        [timeboxDurationS]="1800"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Library Cathedral"
        loreName="La Bibliothèque du Conclave"
        accent="#a78bfa"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .lc-host { position: relative; width: 100%; height: 100vh; background: #0a1228; color: #f4e4bc; font-family: "Tinos", serif; }
    .lc-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .lc-topbar > * { pointer-events: auto; }
    .lc-back { color: #fcd34d; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #0891b2; border-radius: 8px; background: rgba(8,28,40,0.6); }
    .lc-back:hover { background: rgba(8,145,178,0.4); }
    .lc-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 2px; color: #fcd34d; text-shadow: 0 0 12px rgba(252,211,77,0.4); }
    .lc-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.75; color: #cbd5e1; letter-spacing: 0.5px; }
    .lc-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; color: #cbd5e1; }
    .lc-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .lc-legend .tech  { background: #0891b2; }
    .lc-legend .rh    { background: #ec4899; }
    .lc-legend .biz   { background: #84cc16; }
    .lc-legend .legal { background: #a78bfa; }
    .lc-legend .ops   { background: #f97316; }
    .lc-legend .cult  { background: #fcd34d; box-shadow: 0 0 8px #fcd34d; }

    .lc-canvas { display: block; width: 100%; height: 100%; }
    .lc-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); }
    .lc-controls button { background: rgba(8,28,40,0.7); color: #f4e4bc; border: 1px solid #0891b2; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit; letter-spacing: 0.5px; }
    .lc-controls button:hover { background: rgba(8,145,178,0.5); box-shadow: 0 0 12px rgba(8,145,178,0.4); }
    .lc-controls .lc-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .lc-controls .lc-narrator:hover { background: rgba(251,191,36,0.3); box-shadow: 0 0 12px rgba(251,191,36,0.4); }
    .lc-controls .lc-narrator.lc-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .lc-controls .lc-narrator.lc-play:hover { background: #f5b923; }
    .lc-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .lc-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: lc-flash-pulse 1.6s ease-out forwards; }
    .lc-flash[data-type="ouverture"] { background: radial-gradient(circle at center, rgba(252,211,77,0.55), transparent 60%); }
    .lc-flash[data-type="audit"]     { background: radial-gradient(circle at center, rgba(148,163,184,0.5), transparent 60%); }
    .lc-flash[data-type="conclave"]  { background: radial-gradient(circle at center, rgba(252,211,77,0.7), transparent 70%); }
    .lc-flash[data-type="culte"]     { background: radial-gradient(circle at center, rgba(255,255,255,0.75), transparent 75%); }
    .lc-flash-content { text-align: center; animation: lc-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .lc-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(252,211,77,0.8)); }
    .lc-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 2px; text-shadow: 0 0 12px rgba(0,0,0,0.6); }
    @keyframes lc-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes lc-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }

    /* Panel article */
    .lc-panel { position: absolute; right: 22px; top: 80px; width: 300px; padding: 16px; background: rgba(10,18,40,0.94); border: 1px solid #0891b2; border-radius: 12px; backdrop-filter: blur(10px); z-index: 9; font-size: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(8,145,178,0.2); }
    .lc-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(252,211,77,0.4); border-radius: 50%; color: #fcd34d; cursor: pointer; font-size: 14px; line-height: 1; }
    .lc-panel-head { display: flex; gap: 8px; margin-bottom: 10px; }
    .lc-panel-cat { padding: 3px 8px; border-radius: 4px; font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
    .lc-panel-status { padding: 3px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid currentColor; }
    .lc-panel-status[data-status="published"] { color: #4ade80; }
    .lc-panel-status[data-status="draft"]     { color: #fcd34d; }
    .lc-panel-status[data-status="archived"]  { color: #94a3b8; }
    .lc-panel-title { color: #fcd34d; font-weight: 700; font-size: 15px; line-height: 1.3; margin: 8px 0; }
    .lc-panel-author { color: #cbd5e1; margin-bottom: 12px; font-style: italic; }
    .lc-panel-stats { display: flex; gap: 16px; padding: 8px 0; border-top: 1px solid rgba(8,145,178,0.3); border-bottom: 1px solid rgba(8,145,178,0.3); margin-bottom: 8px; }
    .lc-panel-stats strong { color: #fcd34d; font-size: 16px; }
    .lc-panel-time { font-size: 10px; opacity: 0.6; }
    .lc-panel-warn { margin-top: 10px; padding: 6px 10px; background: rgba(148,163,184,0.15); border-radius: 6px; color: #cbd5e1; font-size: 11px; }
    .lc-panel-cult { margin-top: 6px; padding: 6px 10px; background: rgba(252,211,77,0.2); border-radius: 6px; color: #fcd34d; font-size: 11px; }
    .lc-panel-refs { margin-top: 6px; padding: 6px 10px; background: rgba(8,145,178,0.2); border-radius: 6px; color: #67e8f9; font-size: 11px; }
  `]
})
export class LibraryCathedralRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── État (signals) ───
  articles = signal<RuneArticle[]>([]);
  selectedArticle = signal<RuneArticle | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '📚', title: 'Chaque livre est un article ADR', body: 'Les 50 grimoires alignés sur les étagères sont vos décisions techniques documentées (ADR, RFC, runbook).' },
    { icon: '🌟', title: 'Reliure dorée = best-seller', body: 'La couleur du dos du livre traduit sa fréquence de consultation. Les vitraux dorés brillent pour les articles cultes (>1000 lectures).' },
    { icon: '🦅', title: 'L\'aigle messager', body: 'Quand un nouvel article est publié, l\'aigle traverse la nef. Cérémonie d\'ouverture qui notifie le conclave.' },
    { icon: '🔮', title: 'Sphère de recherche', body: 'Au centre, la sphère luminueuse est votre moteur de recherche full-text. Tapez votre requête, elle illumine les livres pertinents.' },
    { icon: '⏰', title: 'Audit hebdo des poussières', body: 'Chaque semaine, rituel des poussières : les livres non lus depuis 90 jours sont marqués stale et migrés en archive.' },
  ];
  tutorialVoiceLines: string[] = [
    'Chaque livre est un ADR ou un runbook.',
    'Les reliures dorées sont les articles cultes.',
    'L\'aigle messager publie un nouvel article.',
    'La sphère illumine vos requêtes de recherche.',
    'Audit hebdo : les livres stales sont archivés.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  trendingCount = computed(() => this.articles().filter(a => a.isTrending).length);
  staleCount    = computed(() => this.articles().filter(a => a.isStale).length);
  crossRefCount = computed(() => this.articles().reduce((s, a) => s + a.crossRefs.length, 0) / 2);

  // ─── Refs Three.js ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;

  private bookMeshes: any[] = [];                 // tous les livres (raycast cible)
  private articlesByBook = new Map<any, RuneArticle>();
  private cobwebMeshes: any[] = [];
  private bookmarkMeshes: any[] = [];
  private goldThreads: any[] = [];                 // lignes dorées entre cross-refs
  private stainedGlassMeshes: any[] = [];          // vitraux meshes (Three.js)
  private stainedGlassMats: any[] = [];            // pour shimmer
  private columnMeshes: any[] = [];
  private archMeshes: any[] = [];
  private particleGroups: any[] = [];              // rayons de lumière
  private eagle: any = null;
  private eagleState: 'perched' | 'flying' | 'swooping' = 'perched';
  private eagleTime = 0;
  private searchSphere: any = null;
  private searchSphereLight: any = null;
  private searchSphereTarget: any = null;
  private searchSphereTime = 0;
  private bellTower: any = null;
  private cultHaloMeshes: any[] = [];
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private ceremonyFlashTimer: any = null;
  private animTime = 0;

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;
  // ─── Cinematic state (animate loop helpers) ───
  private naveMesh: any = null;
  private dawnBeam: any = null;
  private dawnBeamLight: any = null;
  private cinematicBursts: any[] = [];        // particle bursts (bookFloat dust, etc.)
  private cinematicLines: any[] = [];         // gold-thread cinematic weave (durée limitée)
  private vitrauxRippleUntil = 0;
  private vitrauxRippleStart = 0;
  private searchLaunchUntil = 0;
  private cobwebAuditUntil = 0;

  // ─── Constantes cathédrale ───
  private NAVE_LENGTH = 60;
  private NAVE_WIDTH  = 14;
  private AISLE_WIDTH = 6;
  private CEILING_HEIGHT = 18;
  private SHELF_ROWS = 5;

  private CATEGORIES = [
    { name: 'tech',  color: '#0891b2', hex: 0x0891b2 },
    { name: 'RH',    color: '#ec4899', hex: 0xec4899 },
    { name: 'biz',   color: '#84cc16', hex: 0x84cc16 },
    { name: 'legal', color: '#a78bfa', hex: 0xa78bfa },
    { name: 'ops',   color: '#f97316', hex: 0xf97316 },
  ];

  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#a78bfa',
      hint: 'Souris = orbit · molette = zoom · clic livre = article',
      controls: [
        { icon: '🎬', label: 'Demo wiki', action: () => this.loadDemo() },
        { icon: '🔍', label: 'Search "react"', action: () => this.launchSearchSphere('react') },
        { icon: '🦅', label: 'Send eagle', action: () => this.sendEagle() },
        { icon: '📜', label: 'New article', action: () => this.newArticle() },
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
  // INIT scène
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scène
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a1228);
    this.scene.fog = new T.FogExp2(0x0a1228, 0.012);

    // Caméra : au milieu de la nef, à hauteur d'humain
    this.camera = new T.PerspectiveCamera(55, w / h, 0.1, 250);
    this.camera.position.set(0, 5, this.NAVE_LENGTH / 2 - 6);
    this.camera.lookAt(0, 5, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lumières : ambiance cathédrale, chaude et mystique ───
    this.scene.add(new T.AmbientLight(0x2a2040, 0.45));
    // Lumière dorée descendante (rayons depuis vitraux)
    const goldenSun = new T.DirectionalLight(0xfcd34d, 0.85);
    goldenSun.position.set(8, 22, -4);
    this.scene.add(goldenSun);
    // Lumière turquoise froide depuis l'autre côté
    const turquoise = new T.DirectionalLight(0x0891b2, 0.45);
    turquoise.position.set(-8, 16, 6);
    this.scene.add(turquoise);
    // Hemisphere sky/floor
    this.scene.add(new T.HemisphereLight(0x3a4880, 0x1a0a06, 0.35));

    // Build cathédrale
    this.buildCathedral(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 5, 0);
      this.controls.maxDistance = 80;
      this.controls.minDistance = 2;
      this.controls.maxPolarAngle = Math.PI * 0.55;  // pas regarder en dessous du sol
    }

    // Raycaster pour cliquer livres
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île du Savoir)
    const island = getIslandForRoom('/library-cathedral');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-14, 4, -10],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[LibraryCathedral] 🏛 Cathédrale prête');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'library-cathedral',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sol + colonnes + voûte + vitraux + étagères + aigle + clocher
  // ═══════════════════════════════════════════════════════════════════
  private buildCathedral(T: any) {
    // ─── Sol en marbre sombre ───
    const floorGeom = new T.PlaneGeometry(this.NAVE_WIDTH + this.AISLE_WIDTH * 2 + 8, this.NAVE_LENGTH);
    const floorMat = new T.MeshStandardMaterial({
      color: 0x1a1228,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x0a0612,
      emissiveIntensity: 0.2,
    });
    const floor = new T.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);

    // Tapis central rouge sang (allée principale)
    const carpetGeom = new T.PlaneGeometry(3.5, this.NAVE_LENGTH - 2);
    const carpetMat = new T.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.85,
      emissive: 0x3a0a06,
      emissiveIntensity: 0.15,
    });
    const carpet = new T.Mesh(carpetGeom, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.01, 0);
    carpet.userData.tutorialId = 'nave';
    this.naveMesh = carpet;
    this.scene.add(carpet);

    // ─── Colonnes alignées (2 rangées) ───
    const colCount = 8;
    const colR = 0.6;
    const colH = this.CEILING_HEIGHT;
    for (let i = 0; i < colCount; i++) {
      const z = (-this.NAVE_LENGTH / 2) + 4 + i * ((this.NAVE_LENGTH - 8) / (colCount - 1));
      for (const x of [-this.NAVE_WIDTH / 2, this.NAVE_WIDTH / 2]) {
        const colGeom = new T.CylinderGeometry(colR, colR * 1.15, colH, 16);
        const colMat = new T.MeshStandardMaterial({
          color: 0x382a4a,
          roughness: 0.7,
          metalness: 0.15,
          emissive: 0x1a1228,
          emissiveIntensity: 0.2,
        });
        const col = new T.Mesh(colGeom, colMat);
        col.position.set(x, colH / 2, z);
        this.columnMeshes.push(col);
        this.scene.add(col);
        // Chapiteau doré au sommet
        const capGeom = new T.BoxGeometry(colR * 2.4, 0.4, colR * 2.4);
        const capMat = new T.MeshStandardMaterial({
          color: 0xfcd34d,
          metalness: 0.7,
          roughness: 0.3,
          emissive: 0x7c5e10,
          emissiveIntensity: 0.4,
        });
        const cap = new T.Mesh(capGeom, capMat);
        cap.position.set(x, colH - 0.2, z);
        this.scene.add(cap);
      }
    }

    // ─── Voûte d'arches (TorusGeometry demi-cercles) ───
    for (let i = 0; i < colCount; i++) {
      const z = (-this.NAVE_LENGTH / 2) + 4 + i * ((this.NAVE_LENGTH - 8) / (colCount - 1));
      const archGeom = new T.TorusGeometry(this.NAVE_WIDTH / 2, 0.25, 8, 24, Math.PI);
      const archMat = new T.MeshStandardMaterial({
        color: 0x4a3a6a,
        roughness: 0.5,
        metalness: 0.25,
        emissive: 0x1a1040,
        emissiveIntensity: 0.3,
      });
      const arch = new T.Mesh(archGeom, archMat);
      arch.position.set(0, colH, z);
      arch.rotation.y = Math.PI / 2;  // orienté à travers la nef
      this.archMeshes.push(arch);
      this.scene.add(arch);
    }

    // ─── Murs hauts (BoxGeometry simples) ───
    for (const side of [-1, 1]) {
      const wallGeom = new T.BoxGeometry(0.4, this.CEILING_HEIGHT - 1, this.NAVE_LENGTH);
      const wallMat = new T.MeshStandardMaterial({
        color: 0x251a3a,
        roughness: 0.85,
        emissive: 0x0a0418,
        emissiveIntensity: 0.15,
      });
      const wall = new T.Mesh(wallGeom, wallMat);
      wall.position.set(side * (this.NAVE_WIDTH / 2 + 0.8), this.CEILING_HEIGHT / 2, 0);
      this.scene.add(wall);
    }

    // ─── Vitraux : grandes plaques colorées sur les murs ───
    const stainedColors = [0x0891b2, 0xec4899, 0xfcd34d, 0x84cc16, 0xa78bfa, 0xf97316, 0xef4444, 0x06b6d4];
    const windowCount = 6;
    for (let i = 0; i < windowCount; i++) {
      const z = (-this.NAVE_LENGTH / 2) + 7 + i * ((this.NAVE_LENGTH - 14) / (windowCount - 1));
      for (const side of [-1, 1]) {
        const colorIdx = (i + (side > 0 ? 4 : 0)) % stainedColors.length;
        const color = stainedColors[colorIdx];
        const winGeom = new T.PlaneGeometry(3, 7, 4, 6);
        const winMat = new T.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.85,
          side: T.DoubleSide,
        });
        const win = new T.Mesh(winGeom, winMat);
        win.position.set(side * (this.NAVE_WIDTH / 2 + 0.6), this.CEILING_HEIGHT * 0.6, z);
        win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        win.userData.baseEmissive = winMat.emissiveIntensity;
        win.userData.shimmerPhase = Math.random() * Math.PI * 2;
        win.userData.baseColor = color;
        // Tag premier vitrail pour highlight tutorial
        if (this.stainedGlassMeshes.length === 0) {
          win.userData.tutorialId = 'stained-glass';
        }
        this.stainedGlassMeshes.push(win);
        this.stainedGlassMats.push(winMat);
        this.scene.add(win);
        // Petite PointLight derrière le vitrail pour backlight
        const lightColor = new T.Color(color);
        const winLight = new T.PointLight(lightColor, 0.6, 18, 2);
        winLight.position.set(side * (this.NAVE_WIDTH / 2 + 1.5), this.CEILING_HEIGHT * 0.6, z);
        winLight.userData.basePower = 0.6;
        winLight.userData.shimmerPhase = Math.random() * Math.PI * 2;
        this.stainedGlassMats.push(winLight as any);  // les traiter ensemble dans le shimmer
        this.scene.add(winLight);
      }
    }

    // ─── Rayons de poussière dorée descendant des vitraux ───
    for (let i = 0; i < windowCount * 2; i++) {
      const rayCount = 60;
      const positions = new Float32Array(rayCount * 3);
      const baseX = ((i % 2 === 0) ? -1 : 1) * (this.NAVE_WIDTH / 2 - 1);
      const baseZ = (-this.NAVE_LENGTH / 2) + 7 + Math.floor(i / 2) * ((this.NAVE_LENGTH - 14) / (windowCount - 1));
      for (let p = 0; p < rayCount; p++) {
        positions[p * 3 + 0] = baseX + (Math.random() - 0.5) * 2;
        positions[p * 3 + 1] = Math.random() * this.CEILING_HEIGHT;
        positions[p * 3 + 2] = baseZ + (Math.random() - 0.5) * 2;
      }
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.BufferAttribute(positions, 3));
      const mat = new T.PointsMaterial({
        color: 0xfcd34d,
        size: 0.08,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55,
        blending: T.AdditiveBlending,
      });
      const dust = new T.Points(geom, mat);
      dust.userData.kind = 'lightray';
      dust.userData.phase = Math.random() * Math.PI * 2;
      this.particleGroups.push(dust);
      this.scene.add(dust);
    }

    // ─── Crypte : porte sombre au fond de la nef ───
    const cryptArchGeom = new T.TorusGeometry(1.6, 0.3, 8, 24, Math.PI);
    const cryptArchMat = new T.MeshStandardMaterial({
      color: 0x1a0a18,
      roughness: 0.9,
      emissive: 0x301a30,
      emissiveIntensity: 0.4,
    });
    const cryptArch = new T.Mesh(cryptArchGeom, cryptArchMat);
    cryptArch.position.set(0, 2.4, -this.NAVE_LENGTH / 2 + 0.5);
    this.scene.add(cryptArch);
    // Porte sombre dessous (rectangle noir)
    const doorGeom = new T.PlaneGeometry(3, 4);
    const doorMat = new T.MeshStandardMaterial({
      color: 0x05010a,
      emissive: 0x2a0d3a,
      emissiveIntensity: 0.25,
      side: T.DoubleSide,
    });
    const door = new T.Mesh(doorGeom, doorMat);
    door.position.set(0, 1.6, -this.NAVE_LENGTH / 2 + 0.7);
    this.scene.add(door);
    // Lueur violette inquiétante depuis la crypte
    const cryptLight = new T.PointLight(0x8b00ff, 0.7, 14, 2);
    cryptLight.position.set(0, 1.5, -this.NAVE_LENGTH / 2 + 1);
    this.scene.add(cryptLight);

    // ─── Autel doré à l'extrémité opposée (vers la sortie) ───
    const altarGeom = new T.BoxGeometry(4, 1.2, 1.5);
    const altarMat = new T.MeshStandardMaterial({
      color: 0xfcd34d,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x7c5e10,
      emissiveIntensity: 0.5,
    });
    const altar = new T.Mesh(altarGeom, altarMat);
    altar.position.set(0, 0.6, this.NAVE_LENGTH / 2 - 4);
    this.scene.add(altar);

    // ─── Clocher (bell tower) au-dessus du choeur ───
    const towerGeom = new T.CylinderGeometry(1.2, 1.4, 4, 12);
    const towerMat = new T.MeshStandardMaterial({
      color: 0x382a4a,
      roughness: 0.7,
      metalness: 0.2,
    });
    this.bellTower = new T.Mesh(towerGeom, towerMat);
    this.bellTower.position.set(0, this.CEILING_HEIGHT + 2, -this.NAVE_LENGTH / 2 + 6);
    this.scene.add(this.bellTower);
    // Cloche dedans (sphère dorée)
    const bellGeom = new T.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const bellMat = new T.MeshStandardMaterial({
      color: 0xfcd34d,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0x7c5e10,
      emissiveIntensity: 0.4,
    });
    const bell = new T.Mesh(bellGeom, bellMat);
    bell.position.set(0, this.CEILING_HEIGHT + 2, -this.NAVE_LENGTH / 2 + 6);
    bell.userData.kind = 'bell';
    this.bellTower.userData.bell = bell;
    this.scene.add(bell);

    // ─── Aigle messager perché sur le clocher ───
    this.eagle = this.buildEagle(T);
    this.eagle.position.set(0, this.CEILING_HEIGHT + 4, -this.NAVE_LENGTH / 2 + 6);
    this.eagle.userData.tutorialId = 'eagle';
    this.scene.add(this.eagle);
  }

  // ─── Aigle : groupe de mesh simples (corps + ailes + tête) ───
  private buildEagle(T: any): any {
    const eagle = new T.Group();
    // Corps (sphère allongée)
    const bodyGeom = new T.SphereGeometry(0.4, 12, 10);
    const bodyMat = new T.MeshStandardMaterial({
      color: 0xfcd34d,
      roughness: 0.5,
      metalness: 0.5,
      emissive: 0x7c5e10,
      emissiveIntensity: 0.3,
    });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.scale.set(0.7, 0.5, 1.4);
    eagle.add(body);
    // Tête (petite sphère)
    const headGeom = new T.SphereGeometry(0.22, 10, 8);
    const head = new T.Mesh(headGeom, bodyMat);
    head.position.set(0, 0.15, 0.5);
    eagle.add(head);
    // Bec (cône doré)
    const beakGeom = new T.ConeGeometry(0.07, 0.2, 6);
    const beakMat = new T.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4, metalness: 0.5 });
    const beak = new T.Mesh(beakGeom, beakMat);
    beak.position.set(0, 0.1, 0.72);
    beak.rotation.x = Math.PI / 2;
    eagle.add(beak);
    // Ailes (box plates) — animées
    const wingGeom = new T.BoxGeometry(1.4, 0.05, 0.7);
    const wingMat = new T.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.7,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.25,
    });
    const wingL = new T.Mesh(wingGeom, wingMat);
    wingL.position.set(-0.7, 0, 0);
    wingL.userData.kind = 'wingL';
    eagle.add(wingL);
    const wingR = new T.Mesh(wingGeom, wingMat);
    wingR.position.set(0.7, 0, 0);
    wingR.userData.kind = 'wingR';
    eagle.add(wingR);
    eagle.userData = { wingL, wingR };
    return eagle;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD livres : étagères longeant les murs, 50 livres répartis
  // ═══════════════════════════════════════════════════════════════════
  private buildBooks(articles: RuneArticle[]) {
    const T = (window as any).THREE;
    this.disposeBookMeshes();

    // Étagères : 2 côtés × SHELF_ROWS × N livres par row
    // Distribuer 50 livres entre 2 murs × SHELF_ROWS étages
    const wallSides = [-1, 1];
    const shelfDepth = 0.4;
    const shelfYStart = 1.2;
    const shelfYStep = (this.CEILING_HEIGHT - 4) / this.SHELF_ROWS;
    const shelfStartZ = -this.NAVE_LENGTH / 2 + 5;
    const shelfEndZ   =  this.NAVE_LENGTH / 2 - 5;
    const shelfLen    = shelfEndZ - shelfStartZ;

    // ─── Planches des étagères (BoxGeometry plates) ───
    for (const side of wallSides) {
      for (let row = 0; row < this.SHELF_ROWS; row++) {
        const y = shelfYStart + row * shelfYStep;
        const shelfX = side * (this.NAVE_WIDTH / 2 - 0.8);
        const plankGeom = new T.BoxGeometry(shelfDepth * 2, 0.08, shelfLen);
        const plankMat = new T.MeshStandardMaterial({
          color: 0x3a1f0d,
          roughness: 0.8,
          metalness: 0.1,
        });
        const plank = new T.Mesh(plankGeom, plankMat);
        plank.position.set(shelfX, y - 0.2, (shelfStartZ + shelfEndZ) / 2);
        this.scene.add(plank);
      }
    }

    // Répartition des articles entre les positions
    const positions: { x: number, y: number, z: number, side: number, row: number, idx: number }[] = [];
    const booksPerRow = Math.ceil(articles.length / (wallSides.length * this.SHELF_ROWS));
    let idx = 0;
    for (const side of wallSides) {
      for (let row = 0; row < this.SHELF_ROWS; row++) {
        const y = shelfYStart + row * shelfYStep;
        for (let i = 0; i < booksPerRow; i++) {
          if (idx >= articles.length) break;
          const t = booksPerRow === 1 ? 0.5 : i / (booksPerRow - 1);
          const z = shelfStartZ + 0.5 + t * (shelfLen - 1);
          const x = side * (this.NAVE_WIDTH / 2 - 0.8);
          positions.push({ x, y, z, side, row, idx });
          idx++;
        }
      }
    }

    // ─── Création des livres ───
    for (const pos of positions) {
      const article = articles[pos.idx];
      if (!article) continue;
      const popularityWidth = 0.25 + Math.min(article.readCount / 1500, 1) * 0.65;  // 0.25 - 0.9
      const bookH = 0.85 + Math.random() * 0.35;
      const bookD = 0.45 + (article.editCount / 20) * 0.15;

      const bookGeom = new T.BoxGeometry(popularityWidth, bookH, bookD);
      const colorHex = parseInt(article.categoryColor.replace('#', ''), 16);
      const emissiveStrength = article.isCult ? 0.7 : (article.isTrending ? 0.4 : 0.18);
      const bookMat = new T.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.55,
        metalness: article.isCult ? 0.6 : 0.2,
        emissive: colorHex,
        emissiveIntensity: emissiveStrength,
      });
      const book = new T.Mesh(bookGeom, bookMat);
      // Position : aligné contre le mur, livre debout
      book.position.set(
        pos.x - pos.side * 0.05,
        pos.y + bookH / 2 - 0.1,
        pos.z,
      );
      book.rotation.y = pos.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      book.userData = {
        kind: 'book',
        articleId: article.id,
        baseEmissive: emissiveStrength,
        baseY: book.position.y,
        // Tag premier livre seulement pour le tutorial highlight
        tutorialId: this.bookMeshes.length === 0 ? 'book' : undefined,
      };
      this.bookMeshes.push(book);
      this.articlesByBook.set(book, article);
      this.scene.add(book);

      // Dorure (tranche dorée sur les livres trending)
      if (article.isTrending || article.isCult) {
        const gildingGeom = new T.BoxGeometry(popularityWidth * 0.95, 0.04, bookD * 1.02);
        const gildingMat = new T.MeshStandardMaterial({
          color: 0xfcd34d,
          metalness: 0.9,
          roughness: 0.2,
          emissive: 0xfcd34d,
          emissiveIntensity: 0.6,
        });
        const gilding = new T.Mesh(gildingGeom, gildingMat);
        gilding.position.copy(book.position);
        gilding.position.y = book.position.y + bookH / 2 - 0.04;
        gilding.rotation.y = book.rotation.y;
        this.scene.add(gilding);
      }

      // Toile d'araignée si stale (quad gris translucide)
      if (article.isStale) {
        const webGeom = new T.PlaneGeometry(popularityWidth * 1.6, bookH * 1.5);
        const webMat = new T.MeshStandardMaterial({
          color: 0xb8c8d8,
          transparent: true,
          opacity: 0.35,
          roughness: 1,
          side: T.DoubleSide,
          depthWrite: false,
        });
        const web = new T.Mesh(webGeom, webMat);
        web.position.set(
          pos.x - pos.side * 0.18,
          book.position.y + 0.05,
          pos.z,
        );
        web.rotation.y = book.rotation.y;
        web.userData.kind = 'cobweb';
        web.userData.baseOpacity = 0.35;
        // Tag premier cobweb pour highlight tutorial
        if (this.cobwebMeshes.length === 0) {
          web.userData.tutorialId = 'cobweb';
        }
        this.cobwebMeshes.push(web);
        this.scene.add(web);
      }

      // Marque-page rouge si en cours d'édition
      if (article.isBeingEdited) {
        const bmGeom = new T.PlaneGeometry(popularityWidth * 0.6, 0.5);
        const bmMat = new T.MeshStandardMaterial({
          color: 0xdc2626,
          emissive: 0x991b1b,
          emissiveIntensity: 0.6,
          roughness: 0.4,
          side: T.DoubleSide,
        });
        const bm = new T.Mesh(bmGeom, bmMat);
        // Dépasse du dessus du livre
        bm.position.set(
          pos.x - pos.side * 0.18,
          book.position.y + bookH / 2 + 0.15,
          pos.z,
        );
        bm.rotation.y = book.rotation.y;
        bm.userData.kind = 'bookmark';
        this.bookmarkMeshes.push(bm);
        this.scene.add(bm);
      }

      // Halo doré pour les articles culte (couronne au-dessus)
      if (article.isCult) {
        const haloGeom = new T.TorusGeometry(0.3, 0.04, 8, 24);
        const haloMat = new T.MeshStandardMaterial({
          color: 0xfcd34d,
          emissive: 0xfcd34d,
          emissiveIntensity: 1.2,
          metalness: 0.9,
          roughness: 0.15,
        });
        const halo = new T.Mesh(haloGeom, haloMat);
        halo.position.set(book.position.x, book.position.y + bookH / 2 + 0.5, book.position.z);
        halo.rotation.x = Math.PI / 2;
        halo.userData.kind = 'cultHalo';
        this.cultHaloMeshes.push(halo);
        this.scene.add(halo);
      }
    }

    // ─── Fils dorés entre articles cross-référencés ───
    this.buildGoldThreads(articles, T);

    console.log(`[LibraryCathedral] 📚 ${this.bookMeshes.length} books · ${this.cobwebMeshes.length} cobwebs · ${this.bookmarkMeshes.length} bookmarks · ${this.goldThreads.length} threads · ${this.cultHaloMeshes.length} halos`);
  }

  private buildGoldThreads(articles: RuneArticle[], T: any) {
    const bookByArticleId = new Map<number, any>();
    for (const [book, art] of this.articlesByBook) bookByArticleId.set(art.id, book);

    const seen = new Set<string>();
    for (const art of articles) {
      for (const refId of art.crossRefs) {
        const key = [Math.min(art.id, refId), Math.max(art.id, refId)].join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const bookA = bookByArticleId.get(art.id);
        const bookB = bookByArticleId.get(refId);
        if (!bookA || !bookB) continue;
        // Courbe : 3 points, milieu surélevé pour effet de cordon
        const start = bookA.position.clone();
        const end = bookB.position.clone();
        const mid = start.clone().lerp(end, 0.5);
        mid.y += 2;
        const curve = new T.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(32);
        const geom = new T.BufferGeometry().setFromPoints(points);
        const mat = new T.LineBasicMaterial({
          color: 0xfcd34d,
          transparent: true,
          opacity: 0.65,
        });
        const line = new T.Line(geom, mat);
        line.userData.kind = 'goldThread';
        line.userData.basePhase = Math.random() * Math.PI * 2;
        // Tag premier fil doré pour highlight tutorial
        if (this.goldThreads.length === 0) {
          line.userData.tutorialId = 'gold-thread';
        }
        this.goldThreads.push(line);
        this.scene.add(line);
      }
    }
  }

  private disposeBookMeshes() {
    for (const b of this.bookMeshes) this.scene.remove(b);
    this.bookMeshes = [];
    this.articlesByBook.clear();
    for (const c of this.cobwebMeshes) this.scene.remove(c);
    this.cobwebMeshes = [];
    for (const b of this.bookmarkMeshes) this.scene.remove(b);
    this.bookmarkMeshes = [];
    for (const t of this.goldThreads) this.scene.remove(t);
    this.goldThreads = [];
    for (const h of this.cultHaloMeshes) this.scene.remove(h);
    this.cultHaloMeshes = [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA : 50 articles, 5 catégories, 8 stale, 12 trending, 3 refs
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const now = Date.now();
    const day = 86400000;
    const titles = [
      'Onboarding new dev (React)', 'OAuth flow setup', 'Database migration guide',
      'Sprint planning rituals', 'Performance budget Q3', 'Hiring framework 2026',
      'Compliance GDPR checklist', 'Deploy to production', 'Postmortem template',
      'Code review charter', 'Customer success metrics', 'Architecture decision records',
      'Three.js best practices', 'Bell tower alerting', 'Git workflow conventions',
      'Stripe payment integration', 'Healthcheck endpoints', 'Cosmos orrery rendering',
      'On-call playbook', 'Vacation policy 2026', 'Salary bands', 'Team retrospectives',
      'API versioning strategy', 'Frontend testing pyramid', 'Backend caching layers',
      'GraphQL vs REST', 'Kubernetes basics', 'Docker compose tutorial',
      'CI/CD pipeline tour', 'Pull request etiquette', 'Conflict resolution',
      'Remote work charter', 'Open source contributions', 'Tech radar Q2',
      'Pricing experimentation', 'Customer interview script', 'Brand guidelines',
      'Logo usage rules', 'Email templates', 'Slack channel hygiene',
      'JIRA workflow setup', 'Confluence migration plan', 'Incident response matrix',
      'Security review checklist', 'Threat modeling 101', 'PII handling rules',
      'Vendor onboarding process', 'Contract review SOP', 'Equity vesting basics', 'Wellness program'
    ];
    const authors = ['Ramzy', 'Alice', 'Bob', 'Maya', 'Yves', 'Sara', 'Léo', 'Camille'];
    const trendingIdxs = new Set([0, 3, 8, 12, 14, 16, 22, 25, 28, 31, 38, 42]);
    const staleIdxs    = new Set([5, 11, 19, 27, 33, 41, 45, 48]);
    const editingIdxs  = new Set([0, 7, 13, 30]);
    const cultIdxs     = new Set([12, 25]);   // > 1000 lectures
    const crossRefs: Array<[number, number]> = [[0, 12], [3, 9], [16, 28]];

    const articles: RuneArticle[] = [];
    for (let i = 0; i < 50; i++) {
      const cat = this.CATEGORIES[i % this.CATEGORIES.length];
      const isStale = staleIdxs.has(i);
      const isTrending = trendingIdxs.has(i);
      const isCult = cultIdxs.has(i);
      const baseReads = isCult ? 1200 + Math.floor(Math.random() * 800)
        : (isTrending ? 400 + Math.floor(Math.random() * 500)
          : (isStale ? 5 + Math.floor(Math.random() * 20)
            : 50 + Math.floor(Math.random() * 250)));
      const lastReadDays = isStale ? 200 + Math.floor(Math.random() * 200) : Math.floor(Math.random() * 30);
      const lastEditDays = isStale ? 200 + Math.floor(Math.random() * 100) : Math.floor(Math.random() * 60);
      articles.push({
        id: i + 1,
        slug: titles[i].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: titles[i],
        category: cat.name,
        categoryColor: cat.color,
        author: authors[i % authors.length],
        readCount: baseReads,
        editCount: 3 + Math.floor(Math.random() * 25),
        lastReadAt: new Date(now - lastReadDays * day),
        lastEditAt: new Date(now - lastEditDays * day),
        status: isStale ? 'archived' : (editingIdxs.has(i) ? 'draft' : 'published'),
        isStale,
        isTrending,
        isBeingEdited: editingIdxs.has(i),
        isCult,
        crossRefs: [],
      });
    }
    // Attribuer les cross-refs
    for (const [a, b] of crossRefs) {
      articles[a].crossRefs.push(articles[b].id);
      articles[b].crossRefs.push(articles[a].id);
    }

    this.articles.set(articles);
    this.buildBooks(articles);
    this.emitCeremony({ type: 'ouverture', label: 'Bibliothèque chargée · 50 articles consultables', icon: '📜' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES & ACTIONS
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('library-cathedral', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  // 📜 Nouveau article publié → l'aigle décolle solennellement
  newArticle() {
    const titles = ['New: Cathedral lighting guide', 'New: Eagle messenger protocol', 'New: Crypt archive policy'];
    const cat = this.CATEGORIES[Math.floor(Math.random() * this.CATEGORIES.length)];
    const newArt: RuneArticle = {
      id: this.articles().length + 1,
      slug: 'new-article-' + Date.now(),
      title: titles[Math.floor(Math.random() * titles.length)],
      category: cat.name,
      categoryColor: cat.color,
      author: 'Ramzy',
      readCount: 0,
      editCount: 1,
      lastReadAt: new Date(),
      lastEditAt: new Date(),
      status: 'published',
      isStale: false,
      isTrending: false,
      isBeingEdited: false,
      isCult: false,
      crossRefs: [],
    };
    this.articles.update(arr => [...arr, newArt]);
    this.buildBooks(this.articles());
    this.sendEagle();
    this.emitCeremony({ type: 'ouverture', label: 'Cérémonie d\'ouverture · ' + newArt.title, icon: '📜' });
  }

  // ⏰ Audit des poussières : nettoyer les livres stale
  auditStale() {
    const fresh = this.articles().filter(a => !a.isStale);
    const removed = this.articles().length - fresh.length;
    if (removed > 0) {
      this.articles.set(fresh);
      this.buildBooks(fresh);
      this.emitCeremony({ type: 'audit', label: `⏰ Audit · ${removed} livres dépoussiérés`, icon: '⏰' });
    }
  }

  // 🦅 Envoyer l'aigle voler dans la cathédrale
  sendEagle() {
    if (!this.eagle) return;
    this.eagleState = 'flying';
    this.eagleTime = 0;
    // Auto-return après quelques secondes
    setTimeout(() => {
      this.eagleState = 'perched';
    }, 9000);
    this.emitCeremony({ type: 'conclave', label: '🦅 L\'aigle messager s\'élève', icon: '🦅' });
  }

  // 🔍 Sphère de recherche : crée une sphère luminueuse qui voltige
  launchSearchSphere(query: string) {
    const T = (window as any).THREE;
    if (!T) return;
    // Cleanup old sphere
    if (this.searchSphere) {
      this.scene.remove(this.searchSphere);
      this.searchSphere = null;
    }
    if (this.searchSphereLight) {
      this.scene.remove(this.searchSphereLight);
      this.searchSphereLight = null;
    }
    // Trouve les livres pertinents
    const lowerQ = query.toLowerCase();
    const matches = this.articles().filter(a => a.title.toLowerCase().includes(lowerQ));
    if (matches.length === 0) {
      this.emitCeremony({ type: 'audit', label: `🔍 "${query}" : aucun résultat`, icon: '🔍' });
      return;
    }
    const target = this.articles().indexOf(matches[0]);
    const targetBook = this.bookMeshes[target];

    // Dimmer non-matches : baisser emissive
    for (const [book, art] of this.articlesByBook) {
      const isMatch = matches.some(m => m.id === art.id);
      if (book.material) {
        book.material.emissiveIntensity = isMatch ? 1.0 : 0.05;
      }
    }
    // Restore après 7s
    setTimeout(() => {
      for (const [book, art] of this.articlesByBook) {
        if (book.material && book.userData.baseEmissive !== undefined) {
          book.material.emissiveIntensity = book.userData.baseEmissive;
        }
      }
      if (this.searchSphere) { this.scene.remove(this.searchSphere); this.searchSphere = null; }
      if (this.searchSphereLight) { this.scene.remove(this.searchSphereLight); this.searchSphereLight = null; }
    }, 7000);

    // Création sphère luminueuse
    const sphereGeom = new T.SphereGeometry(0.35, 24, 18);
    const sphereMat = new T.MeshStandardMaterial({
      color: 0xfcd34d,
      emissive: 0xfcd34d,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
    });
    this.searchSphere = new T.Mesh(sphereGeom, sphereMat);
    this.searchSphere.position.set(0, 6, this.NAVE_LENGTH / 2 - 6);
    this.searchSphere.userData.tutorialId = 'search-sphere';
    this.scene.add(this.searchSphere);
    // PointLight attaché
    this.searchSphereLight = new T.PointLight(0xfcd34d, 1.6, 18, 2);
    this.searchSphereLight.position.copy(this.searchSphere.position);
    this.scene.add(this.searchSphereLight);
    this.searchSphereTarget = targetBook;
    this.searchSphereTime = 0;

    this.emitCeremony({ type: 'culte', label: `🔍 Recherche "${query}" · ${matches.length} livres illuminés`, icon: '💫' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS — invoqués par le playExample tutorial JSON
  // (chaque méthode public est appelable via narrator.invokeMethod)
  // ═══════════════════════════════════════════════════════════════════

  /** 📖 BOOK FLOAT — un livre s'élève, s'ouvre, particules dorées sortent (= article promu featured) */
  bookFloat() {
    const T = (window as any).THREE;
    if (!this.bookMeshes?.length) return;
    // Préférence : un livre tagué tutorialId='book', sinon le premier dispo
    const book = this.bookMeshes.find(b => b.userData?.tutorialId === 'book') || this.bookMeshes[0];
    if (!book) return;
    const nowMs = performance.now();
    book.userData.floatStart = nowMs;
    book.userData.floatUntil = nowMs + 5500;
    book.userData.baseY = book.userData.baseY ?? book.position.y;
    book.userData.baseEmissiveBoost = book.material?.emissiveIntensity ?? 0.4;
    // Boost émissif immédiat
    if (book.material) {
      book.material.emissiveIntensity = 1.3;
    }
    // Particules dorées qui jaillissent du livre
    const count = 80;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = book.position.x;
      positions[i * 3 + 1] = book.position.y;
      positions[i * 3 + 2] = book.position.z;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.04 + Math.random() * 0.1;
      velocities[i * 3 + 0] = Math.cos(ang) * speed;
      velocities[i * 3 + 1] = 0.08 + Math.random() * 0.15;
      velocities[i * 3 + 2] = Math.sin(ang) * speed;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xfcd34d,
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: T.AdditiveBlending,
    });
    const burst = new T.Points(geom, mat);
    burst.userData = { kind: 'bookFloat-burst', velocities, age: 0, ttl: 4.5 };
    this.cinematicBursts.push(burst);
    this.scene.add(burst);
    this.emitCeremony({ type: 'culte', label: '📖 Tome élevé · Article featured', icon: '📖' });
  }

  /** 🔍 SEARCH SPHERE LAUNCH — sphère pulse + rayons lumineux balayent les rayonnages (= search query) */
  searchSphereLaunch() {
    const T = (window as any).THREE;
    if (!T) return;
    const nowMs = performance.now();
    this.searchLaunchUntil = nowMs + 4500;
    // Si pas de sphère active, on la crée éphémère
    if (!this.searchSphere) {
      const sphereGeom = new T.SphereGeometry(0.4, 24, 18);
      const sphereMat = new T.MeshStandardMaterial({
        color: 0xfcd34d,
        emissive: 0xfcd34d,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.9,
      });
      this.searchSphere = new T.Mesh(sphereGeom, sphereMat);
      this.searchSphere.position.set(0, 7, 0);
      this.searchSphere.userData.tutorialId = 'search-sphere';
      this.scene.add(this.searchSphere);
      this.searchSphereLight = new T.PointLight(0xfcd34d, 2.2, 22, 2);
      this.searchSphereLight.position.copy(this.searchSphere.position);
      this.scene.add(this.searchSphereLight);
    }
    // Mémoriser l'état pour pulse dans animate()
    this.searchSphere.userData.launchUntil = nowMs + 4500;
    this.searchSphere.userData.launchStart = nowMs;
    // Balayage : tous les livres pulsent émissif en cascade
    const books = this.bookMeshes ?? [];
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      b.userData.sweepStart = nowMs + i * 28;     // décalage cascade
      b.userData.sweepUntil = nowMs + i * 28 + 600;
      b.userData.sweepBase = b.material?.emissiveIntensity ?? 0.3;
    }
    // Nettoyage automatique après 5s
    setTimeout(() => {
      for (const b of books) {
        if (b.material && b.userData.sweepBase !== undefined) {
          b.material.emissiveIntensity = b.userData.baseEmissive ?? b.userData.sweepBase;
        }
      }
    }, 5200);
    this.emitCeremony({ type: 'conclave', label: '🔍 Orbe Chercheuse · Balayage du Conclave', icon: '🔍' });
  }

  /** 🕸 AUDIT COBWEBS — cobwebs disparaissent en spirale (= stale docs nettoyés) */
  auditCobwebs() {
    if (!this.cobwebMeshes?.length) {
      this.emitCeremony({ type: 'audit', label: '⏰ Audit · aucun Voile à dépoussiérer', icon: '⏰' });
      return;
    }
    const nowMs = performance.now();
    this.cobwebAuditUntil = nowMs + 3200;
    // Marquer chaque cobweb avec une phase spiralée pour disparaître en cascade
    for (let i = 0; i < this.cobwebMeshes.length; i++) {
      const web = this.cobwebMeshes[i];
      web.userData.auditStart = nowMs + i * 60;
      web.userData.auditUntil = nowMs + i * 60 + 1200;
      web.userData.spiralPhase = (i / Math.max(1, this.cobwebMeshes.length)) * Math.PI * 2;
    }
    // Nettoyage final : retirer les cobwebs de la scène
    setTimeout(() => {
      for (const web of this.cobwebMeshes) {
        this.scene.remove(web);
        web.geometry?.dispose?.();
        web.material?.dispose?.();
      }
      this.cobwebMeshes = [];
      // Update les articles pour ne plus être stale
      this.articles.update(arr => arr.map(a => ({ ...a, isStale: false })));
    }, 3400);
    this.emitCeremony({ type: 'audit', label: `⏰ Audit · ${this.cobwebMeshes.length} Voiles balayés en spirale`, icon: '🕸' });
  }

  /** 🪙 GOLD THREAD WEAVE — ruban doré relie 2 livres (= nouvel article publié, cross-ref tissé) */
  goldThreadWeave() {
    const T = (window as any).THREE;
    if (!this.bookMeshes || this.bookMeshes.length < 2) return;
    // Choisir 2 livres distants : premier et dernier de la liste, plus un milieu
    const bookA = this.bookMeshes[0];
    const bookB = this.bookMeshes[Math.floor(this.bookMeshes.length / 2)];
    if (!bookA || !bookB) return;
    const start = bookA.position.clone();
    const end = bookB.position.clone();
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 3.5;
    const curve = new T.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(48);
    const geom = new T.BufferGeometry().setFromPoints(points);
    const mat = new T.LineBasicMaterial({
      color: 0xfcd34d,
      transparent: true,
      opacity: 0.0,        // démarre invisible, se révèle
      linewidth: 2,
    });
    const line = new T.Line(geom, mat);
    line.userData = {
      kind: 'cinematic-thread',
      tutorialId: 'gold-thread',
      weaveStart: performance.now(),
      weaveDuration: 2200,
      ttl: 7500,
    };
    this.cinematicLines.push(line);
    this.scene.add(line);
    // Petit halo doré aux extrémités
    for (const anchor of [bookA, bookB]) {
      const haloGeom = new T.TorusGeometry(0.35, 0.05, 8, 24);
      const haloMat = new T.MeshStandardMaterial({
        color: 0xfcd34d,
        emissive: 0xfcd34d,
        emissiveIntensity: 1.4,
        metalness: 0.9,
        roughness: 0.15,
        transparent: true,
        opacity: 0.85,
      });
      const halo = new T.Mesh(haloGeom, haloMat);
      halo.position.copy(anchor.position);
      halo.rotation.x = Math.PI / 2;
      halo.userData = {
        kind: 'cinematic-halo',
        weaveStart: performance.now(),
        ttl: 6500,
      };
      this.cinematicLines.push(halo);
      this.scene.add(halo);
    }
    this.emitCeremony({ type: 'ouverture', label: '🪙 Cordon doré tissé · Cross-référence sacrée', icon: '🪙' });
  }

  /** 🌈 VITRAUX RIPPLE — vitraux pulsent en cascade chromatique (= nouveau highlight d'une section) */
  vitrauxRipple() {
    const nowMs = performance.now();
    this.vitrauxRippleStart = nowMs;
    this.vitrauxRippleUntil = nowMs + 4200;
    // Chaque vitrail reçoit son délai propre pour la cascade
    const meshes = this.stainedGlassMeshes ?? [];
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      m.userData.rippleStart = nowMs + i * 110;
      m.userData.rippleUntil = nowMs + i * 110 + 1400;
      if (m.material) {
        m.userData.rippleBase = m.material.emissiveIntensity ?? 1.0;
      }
    }
    this.emitCeremony({ type: 'culte', label: '🌈 Iris de Lumière · Cascade chromatique', icon: '🌈' });
  }

  /** 🌅 DAWN LIGHT — faisceau de lumière dorée descend depuis la rosace (= cérémonie ouverture du jour) */
  dawnLight() {
    const T = (window as any).THREE;
    if (!T) return;
    // Cleanup ancien beam
    if (this.dawnBeam) { this.scene.remove(this.dawnBeam); this.dawnBeam = null; }
    if (this.dawnBeamLight) { this.scene.remove(this.dawnBeamLight); this.dawnBeamLight = null; }
    // Cylindre lumineux : descend du sommet de la voûte vers le centre de la nef
    const beamGeom = new T.CylinderGeometry(0.4, 2.2, this.CEILING_HEIGHT + 2, 18, 1, true);
    const beamMat = new T.MeshStandardMaterial({
      color: 0xfcd34d,
      emissive: 0xfcd34d,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.45,
      side: T.DoubleSide,
      depthWrite: false,
    });
    this.dawnBeam = new T.Mesh(beamGeom, beamMat);
    this.dawnBeam.position.set(0, (this.CEILING_HEIGHT + 2) / 2, 0);
    this.dawnBeam.userData = {
      kind: 'dawnBeam',
      startMs: performance.now(),
      ttl: 6000,
    };
    this.scene.add(this.dawnBeam);
    // Lumière ponctuelle qui descend
    this.dawnBeamLight = new T.PointLight(0xfcd34d, 3.2, 30, 1.6);
    this.dawnBeamLight.position.set(0, this.CEILING_HEIGHT - 1, 0);
    this.scene.add(this.dawnBeamLight);
    // Cleanup auto après ttl
    setTimeout(() => {
      if (this.dawnBeam) { this.scene.remove(this.dawnBeam); this.dawnBeam.geometry?.dispose?.(); this.dawnBeam.material?.dispose?.(); this.dawnBeam = null; }
      if (this.dawnBeamLight) { this.scene.remove(this.dawnBeamLight); this.dawnBeamLight = null; }
    }, 6200);
    this.emitCeremony({ type: 'ouverture', label: '🌅 Aube du Conclave · Cérémonie d\'ouverture', icon: '🌅' });
  }

  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 5, this.NAVE_LENGTH / 2 - 6);
    this.camera.lookAt(0, 5, 0);
    if (this.controls) this.controls.target.set(0, 5, 0);
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
    this.narrator.startTimeboxOnly(1800, 'Doc & ADR');
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic livre → afficher article
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
    const intersects = this.raycaster.intersectObjects(this.bookMeshes, false);
    if (intersects.length > 0) {
      const book = intersects[0].object;
      const article = this.articlesByBook.get(book);
      if (article) {
        this.selectedArticle.set(article);
        // Flash : sortir le livre légèrement
        const baseX = book.position.x;
        const side = baseX > 0 ? -1 : 1;
        book.position.x = baseX + side * 0.15;
        setTimeout(() => { book.position.x = baseX; }, 400);
        // Conclave si déjà très lu
        if (article.readCount >= 1000) {
          this.emitCeremony({ type: 'culte', label: '🌟 Article culte · ' + article.title, icon: '🌟' });
        } else if (article.readCount >= 500) {
          this.emitCeremony({ type: 'conclave', label: '🔱 Conclave · ' + article.title, icon: '🔱' });
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
    this.animTime += dt;

    // ─── Vitraux shimmering (variation d'intensité émissive) ───
    for (const mat of this.stainedGlassMats) {
      const phase = mat.userData?.shimmerPhase ?? 0;
      const base = mat.userData?.basePower ?? mat.userData?.baseEmissive ?? 1.0;
      const shimmer = base + Math.sin(this.animTime * 1.8 + phase) * 0.25 + Math.sin(this.animTime * 0.6 + phase * 1.7) * 0.15;
      if (mat.intensity !== undefined) {
        // PointLight
        mat.intensity = Math.max(0.2, shimmer);
      } else if (mat.emissiveIntensity !== undefined) {
        // Material
        mat.emissiveIntensity = Math.max(0.4, shimmer);
      }
    }

    // ─── Particules : descente lente des rayons de poussière ───
    for (const dust of this.particleGroups) {
      const positions = dust.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= dt * 0.45;  // descente lente
        if (positions[i + 1] < 0.2) positions[i + 1] = this.CEILING_HEIGHT - 0.5;
        positions[i + 0] += Math.sin(this.animTime + i) * 0.0015;
      }
      dust.geometry.attributes.position.needsUpdate = true;
      // Opacité légèrement variable
      if (dust.material) {
        dust.material.opacity = 0.4 + Math.sin(this.animTime * 0.8 + (dust.userData.phase || 0)) * 0.2;
      }
    }

    // ─── Aigle : vole, plane, plonge ───
    if (this.eagle) {
      this.eagleTime += dt;
      const wingL = this.eagle.userData?.wingL;
      const wingR = this.eagle.userData?.wingR;
      // Battement d'ailes
      const flapSpeed = this.eagleState === 'perched' ? 0 : (this.eagleState === 'swooping' ? 14 : 7);
      const flapAmp = this.eagleState === 'swooping' ? 0.9 : 0.55;
      if (wingL && wingR && this.eagleState !== 'perched') {
        wingL.rotation.z =  Math.sin(this.animTime * flapSpeed) * flapAmp;
        wingR.rotation.z = -Math.sin(this.animTime * flapSpeed) * flapAmp;
      } else if (wingL && wingR) {
        // Ailes repliées au repos
        wingL.rotation.z = 0.2;
        wingR.rotation.z = -0.2;
      }
      // Mouvement
      if (this.eagleState === 'flying') {
        // Cercle large dans la cathédrale
        const r = 8;
        const speed = 0.6;
        const angle = this.eagleTime * speed;
        this.eagle.position.x = Math.cos(angle) * r;
        this.eagle.position.z = -this.NAVE_LENGTH / 4 + Math.sin(angle) * 6;
        this.eagle.position.y = this.CEILING_HEIGHT - 4 + Math.sin(this.animTime * 1.5) * 0.6;
        // Cap dans la direction du vol
        this.eagle.rotation.y = -angle - Math.PI / 2;
        // Plonge aléatoire
        if (Math.random() < 0.003) this.eagleState = 'swooping';
      } else if (this.eagleState === 'swooping') {
        // Plongée diagonale vers une étagère, puis remonte
        const t = (this.eagleTime % 2) / 2;
        const swoopY = (this.CEILING_HEIGHT - 4) - Math.sin(t * Math.PI) * 6;
        this.eagle.position.y = swoopY;
        this.eagle.position.x += Math.sin(this.animTime * 1.2) * 0.06;
        if (t > 0.98) this.eagleState = 'flying';
      } else if (this.eagleState === 'perched') {
        // Léger balancement perché
        this.eagle.position.y = this.CEILING_HEIGHT + 4 + Math.sin(this.animTime * 1.4) * 0.05;
        this.eagle.rotation.y = Math.sin(this.animTime * 0.4) * 0.15;
      }
    }

    // ─── Clocher (légère oscillation) ───
    if (this.bellTower) {
      this.bellTower.rotation.z = Math.sin(this.animTime * 0.6) * 0.015;
      const bell = this.bellTower.userData?.bell;
      if (bell) bell.rotation.z = Math.sin(this.animTime * 1.1) * 0.08;
    }

    // ─── Halos articles culte : rotation lente + pulse ───
    for (const halo of this.cultHaloMeshes) {
      halo.rotation.z += dt * 0.6;
      if (halo.material) {
        halo.material.emissiveIntensity = 1.0 + Math.sin(this.animTime * 2 + halo.position.z) * 0.4;
      }
    }

    // ─── Fils dorés : variation d'opacité (cordon vivant) ───
    for (const t of this.goldThreads) {
      const phase = t.userData.basePhase || 0;
      if (t.material) {
        t.material.opacity = 0.45 + Math.sin(this.animTime * 1.3 + phase) * 0.25;
      }
    }

    // ─── Cobwebs : léger mouvement (toile qui frémit) ───
    for (const c of this.cobwebMeshes) {
      c.rotation.z = Math.sin(this.animTime * 0.5 + c.position.z * 0.1) * 0.02;
      if (c.material) {
        c.material.opacity = 0.28 + Math.sin(this.animTime * 0.7 + c.position.z) * 0.08;
      }
    }

    // ─── Marque-pages rouge : flottent légèrement ───
    for (const bm of this.bookmarkMeshes) {
      bm.rotation.z = Math.sin(this.animTime * 1.6 + bm.position.z) * 0.05;
    }

    // ─── Sphère de recherche : vole vers la cible en zigzag ───
    if (this.searchSphere) {
      this.searchSphereTime += dt;
      const t = Math.min(this.searchSphereTime / 4, 1);
      if (this.searchSphereTarget) {
        const targetPos = this.searchSphereTarget.position;
        const start = new (window as any).THREE.Vector3(0, 6, this.NAVE_LENGTH / 2 - 6);
        // Zigzag : interpolation linéaire + oscillation
        this.searchSphere.position.x = start.x + (targetPos.x - start.x) * t + Math.sin(this.animTime * 4) * 1.2;
        this.searchSphere.position.y = start.y + (targetPos.y - start.y) * t + Math.cos(this.animTime * 3.5) * 0.8;
        this.searchSphere.position.z = start.z + (targetPos.z - start.z) * t;
      } else {
        this.searchSphere.position.y += Math.sin(this.animTime * 3) * 0.02;
      }
      if (this.searchSphereLight) {
        this.searchSphereLight.position.copy(this.searchSphere.position);
        this.searchSphereLight.intensity = 1.4 + Math.sin(this.animTime * 5) * 0.4;
      }
      // Pulse de la sphère elle-même
      const scale = 1 + Math.sin(this.animTime * 6) * 0.12;
      this.searchSphere.scale.set(scale, scale, scale);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎬 CINEMATIC ANIMATIONS — invoqués via méthodes publiques cinematic
    // ═══════════════════════════════════════════════════════════════════
    const nowMs = performance.now();

    // ─── bookFloat : le livre s'élève + ouvre (rotation) ───
    for (const book of this.bookMeshes ?? []) {
      if (book.userData?.floatUntil && nowMs < book.userData.floatUntil) {
        const elapsed = nowMs - book.userData.floatStart;
        const totalDur = book.userData.floatUntil - book.userData.floatStart;
        const t = elapsed / totalDur;
        const baseY = book.userData.baseY;
        // Élévation : arc up→hold→down
        const liftCurve = Math.sin(Math.min(1, t * 1.5) * Math.PI) * 1.8 + Math.sin(this.animTime * 2.4) * 0.15;
        book.position.y = baseY + liftCurve;
        // Légère rotation pour suggérer "le livre s'ouvre"
        book.rotation.x = Math.sin(t * Math.PI) * 0.35;
        // Pulse émissif
        if (book.material) {
          book.material.emissiveIntensity = 1.0 + Math.sin(this.animTime * 6) * 0.4;
        }
      } else if (book.userData?.floatUntil && nowMs >= book.userData.floatUntil) {
        // Cleanup : retour à la base
        book.position.y = book.userData.baseY;
        book.rotation.x = 0;
        if (book.material && book.userData.baseEmissive !== undefined) {
          book.material.emissiveIntensity = book.userData.baseEmissive;
        }
        delete book.userData.floatUntil;
        delete book.userData.floatStart;
      }
      // ─── searchSphereLaunch : balayage cascade sur tous les livres ───
      if (book.userData?.sweepUntil && nowMs < book.userData.sweepUntil) {
        const sweepT = (nowMs - book.userData.sweepStart) / (book.userData.sweepUntil - book.userData.sweepStart);
        if (book.material && sweepT >= 0 && sweepT <= 1) {
          const pulse = Math.sin(sweepT * Math.PI);
          book.material.emissiveIntensity = (book.userData.sweepBase ?? 0.3) + pulse * 1.4;
        }
      }
    }

    // ─── searchSphereLaunch : pulse scale de la sphère + rayons brefs ───
    if (this.searchSphere?.userData?.launchUntil && nowMs < this.searchSphere.userData.launchUntil) {
      const t = (nowMs - this.searchSphere.userData.launchStart) / (this.searchSphere.userData.launchUntil - this.searchSphere.userData.launchStart);
      // Pulse breath : scale 1 → 1.8 → 1
      const breath = 1 + Math.sin(t * Math.PI * 4) * 0.5;
      this.searchSphere.scale.set(breath, breath, breath);
      if (this.searchSphere.material) {
        this.searchSphere.material.emissiveIntensity = 1.5 + Math.sin(this.animTime * 8) * 0.6;
      }
      if (this.searchSphereLight) {
        this.searchSphereLight.intensity = 2.4 + Math.sin(this.animTime * 6) * 0.8;
      }
    }

    // ─── auditCobwebs : disparition en spirale ───
    if (this.cobwebAuditUntil && nowMs < this.cobwebAuditUntil) {
      for (const web of this.cobwebMeshes) {
        if (web.userData?.auditStart === undefined || web.userData?.auditUntil === undefined) continue;
        if (nowMs < web.userData.auditStart) continue;
        const t = Math.min(1, (nowMs - web.userData.auditStart) / (web.userData.auditUntil - web.userData.auditStart));
        // Spirale : rotation + scale shrink + opacity fade
        const spiralPhase = web.userData.spiralPhase ?? 0;
        web.rotation.z = spiralPhase + t * Math.PI * 4;
        const shrink = Math.max(0, 1 - t);
        web.scale.set(shrink, shrink, shrink);
        if (web.material) {
          web.material.opacity = (web.userData.baseOpacity ?? 0.35) * shrink;
        }
      }
    }

    // ─── goldThreadWeave : ligne se révèle progressivement + halos pulsent ───
    if (this.cinematicLines.length > 0) {
      const finished: number[] = [];
      for (let i = 0; i < this.cinematicLines.length; i++) {
        const obj = this.cinematicLines[i];
        const startMs = obj.userData?.weaveStart ?? nowMs;
        const ttl = obj.userData?.ttl ?? 6000;
        const age = nowMs - startMs;
        if (age >= ttl) { finished.push(i); continue; }
        if (obj.userData?.kind === 'cinematic-thread') {
          const weaveDur = obj.userData.weaveDuration ?? 2000;
          const reveal = Math.min(1, age / weaveDur);
          const fadeOut = age > ttl * 0.7 ? (ttl - age) / (ttl * 0.3) : 1;
          if (obj.material) {
            obj.material.opacity = 0.85 * reveal * fadeOut + Math.sin(this.animTime * 3) * 0.1 * reveal;
          }
        } else if (obj.userData?.kind === 'cinematic-halo') {
          obj.rotation.z += dt * 1.4;
          const fadeOut = age > ttl * 0.7 ? (ttl - age) / (ttl * 0.3) : 1;
          if (obj.material) {
            obj.material.opacity = 0.85 * fadeOut;
            obj.material.emissiveIntensity = 1.2 + Math.sin(this.animTime * 4) * 0.5;
          }
          const breath = 1 + Math.sin(this.animTime * 3) * 0.18;
          obj.scale.set(breath, breath, breath);
        }
      }
      // Cleanup expirés (en sens inverse)
      for (let i = finished.length - 1; i >= 0; i--) {
        const obj = this.cinematicLines[finished[i]];
        this.scene.remove(obj);
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
        this.cinematicLines.splice(finished[i], 1);
      }
    }

    // ─── vitrauxRipple : cascade chromatique sur les vitraux ───
    if (this.vitrauxRippleUntil && nowMs < this.vitrauxRippleUntil) {
      for (const m of this.stainedGlassMeshes ?? []) {
        if (m.userData?.rippleStart === undefined) continue;
        if (nowMs < m.userData.rippleStart) continue;
        const t = Math.min(1, (nowMs - m.userData.rippleStart) / Math.max(1, (m.userData.rippleUntil - m.userData.rippleStart)));
        if (m.material) {
          const base = m.userData.rippleBase ?? 1.0;
          const pulse = Math.sin(t * Math.PI) * 2.2;
          m.material.emissiveIntensity = base + pulse;
        }
      }
    }

    // ─── dawnLight : faisceau qui descend depuis la voûte ───
    if (this.dawnBeam) {
      const startMs = this.dawnBeam.userData?.startMs ?? nowMs;
      const ttl = this.dawnBeam.userData?.ttl ?? 6000;
      const age = nowMs - startMs;
      const t = Math.min(1, age / ttl);
      // Fade in puis fade out
      const fadeIn = Math.min(1, age / 800);
      const fadeOut = age > ttl * 0.7 ? Math.max(0, (ttl - age) / (ttl * 0.3)) : 1;
      const aliveAlpha = 0.55 * fadeIn * fadeOut;
      if (this.dawnBeam.material) {
        this.dawnBeam.material.opacity = aliveAlpha + Math.sin(this.animTime * 4) * 0.05;
        this.dawnBeam.material.emissiveIntensity = 1.2 + Math.sin(this.animTime * 2.5) * 0.4;
      }
      // Légère rotation lente du faisceau
      this.dawnBeam.rotation.y += dt * 0.4;
      if (this.dawnBeamLight) {
        this.dawnBeamLight.intensity = 3.0 * fadeIn * fadeOut + Math.sin(this.animTime * 3) * 0.5;
      }
    }

    // ─── cinematicBursts (bookFloat dust) : update particules ───
    if (this.cinematicBursts.length > 0) {
      const done: number[] = [];
      for (let bi = 0; bi < this.cinematicBursts.length; bi++) {
        const burst = this.cinematicBursts[bi];
        burst.userData.age += dt;
        const pos = burst.geometry.attributes.position;
        const vels = burst.userData.velocities;
        for (let i = 0; i < pos.count; i++) {
          pos.array[i * 3 + 0] += vels[i * 3 + 0] * dt * 60;
          pos.array[i * 3 + 1] += vels[i * 3 + 1] * dt * 60;
          pos.array[i * 3 + 2] += vels[i * 3 + 2] * dt * 60;
          vels[i * 3 + 1] -= 0.008;   // léger gravité
        }
        pos.needsUpdate = true;
        const ratio = burst.userData.age / burst.userData.ttl;
        if (burst.material) {
          burst.material.opacity = Math.max(0, 0.95 * (1 - Math.pow(ratio, 1.4)));
        }
        if (ratio >= 1) done.push(bi);
      }
      for (let i = done.length - 1; i >= 0; i--) {
        const burst = this.cinematicBursts[done[i]];
        this.scene.remove(burst);
        burst.geometry?.dispose?.();
        burst.material?.dispose?.();
        this.cinematicBursts.splice(done[i], 1);
      }
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.animTime);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════
  fmtAgo(ts: number): string {
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'il y a quelques minutes';
    if (h < 24) return `il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `il y a ${d}j`;
    return `il y a ${Math.floor(d / 30)} mois`;
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
