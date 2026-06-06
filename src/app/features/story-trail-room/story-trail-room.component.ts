// ═══════════════════════════════════════════════════════════════════
// 🏔 STORY TRAIL ROOM — La Carte des Sentiers (Story Mapping)
//
// Workshop : Story Mapping (Jeff Patton)
//   - Une grande montagne 3D au centre
//   - 3 sentiers horizontaux qui font le tour de la montagne à 3
//     altitudes (= 3 user journeys / epics)
//   - Sur chaque sentier : 5-7 "pierres" icosahédrales = user stories
//   - Couleurs des pierres par niveau release :
//       MVP    = or (#fbbf24)
//       MVP+   = cyan (#67e8f9)
//       Future = gris (#94a3b8)
//   - Une grande "ligne de release" horizontale or-émissive qui coupe
//     la montagne = release cut MVP
//   - Drapeau orange triangle au sommet sur mât = objectif final
//   - Brume basse + sol neigeux + petits sapins au pied
//
// Cérémonies :
//   🏔 Sommet  = MVP livré
//   🏴 Flag    = walking skeleton tracé
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

// ─── Modèles métier ───
type ReleaseLevel = 'mvp' | 'mvp-plus' | 'future';

interface UserStory {
  id: string;
  title: string;
  level: ReleaseLevel;
}

interface UserJourney {
  id: string;
  name: string;
  emoji: string;
  color: string;       // hex string pour UI
  trailColorHex: number; // hex int pour 3D
  altitude: number;    // 0..1 le long de la pente verticale de la montagne (0=base, 1=sommet)
  stories: UserStory[];
}

@Component({
  selector: 'wt-story-trail-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="st-host">
      <header class="st-topbar">
        <div class="st-title">
          <h1>🏔 La Carte des Sentiers — Story Mapping</h1>
          <p>
            {{ journeys().length }} sentiers user journey ·
            {{ totalStories() }} pierres user stories ·
            ligne MVP horizontale
          </p>
        </div>
        <div class="st-legend">
          <span class="dot mvp"></span>MVP (or)
          <span class="dot mvpplus"></span>MVP+ (cyan)
          <span class="dot future"></span>Future (gris)
          <span class="dot release"></span>Release cut
        </div>
      </header>

      <canvas #canvas class="st-canvas"></canvas>

      <!-- 🪶 Narrator overlay -->
      <wt-narrator></wt-narrator>

      <!-- Flash cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="st-flash" [attr.data-type]="f.type">
        <div class="st-flash-content">
          <div class="st-flash-icon">{{ f.icon }}</div>
          <div class="st-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Sidebar : 3 user journeys + leurs stories par niveau -->
      <aside class="st-sidebar">
        <div class="st-sidebar-head">📋 User Journeys</div>
        <div *ngFor="let j of journeys()" class="st-journey" [style.--jcolor]="j.color">
          <div class="st-journey-head">
            <span class="st-journey-emoji">{{ j.emoji }}</span>
            <strong class="st-journey-name">{{ j.name }}</strong>
          </div>
          <div class="st-journey-level">
            <div class="st-level-tag mvp">MVP</div>
            <ul>
              <li *ngFor="let s of storiesOf(j, 'mvp')">{{ s.title }}</li>
            </ul>
          </div>
          <div class="st-journey-level">
            <div class="st-level-tag mvpplus">MVP+</div>
            <ul>
              <li *ngFor="let s of storiesOf(j, 'mvp-plus')">{{ s.title }}</li>
            </ul>
          </div>
          <div class="st-journey-level">
            <div class="st-level-tag future">Future</div>
            <ul>
              <li *ngFor="let s of storiesOf(j, 'future')">{{ s.title }}</li>
            </ul>
          </div>
        </div>
      </aside>

      <!-- Panel story sélectionnée (clic pierre) -->
      <div *ngIf="selectedStory() as s" class="st-panel">
        <button class="st-panel-close" (click)="selectedStory.set(null)">×</button>
        <div class="st-panel-head">
          <strong class="st-panel-id">🪨 {{ s.id }}</strong>
          <span class="st-panel-level" [attr.data-level]="s.level">{{ levelLabel(s.level) }}</span>
        </div>
        <div class="st-panel-title">{{ s.title }}</div>
        <div class="st-panel-journey" *ngIf="journeyOfStory(s) as j">
          {{ j.emoji }} <em>{{ j.name }}</em>
        </div>
      </div>

      <!-- 🎬 Splash welcome overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Story Mapping"
        loreName="La Carte des Sentiers"
        color="#f59e0b"
        oneLiner="Story Mapping Jeff Patton : sentiers user journey + pierres user stories."
        [duration]="75"
        [timeboxDurationS]="3600"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Story Mapping"
        loreName="La Carte des Sentiers"
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
    .st-host {
      position: relative; width: 100%; height: 100vh; color: #f1f5f9;
      font-family: "Tinos", serif;
      background: linear-gradient(180deg, #1e293b 0%, #475569 60%, #94a3b8 100%);
    }

    .st-topbar { position: absolute; top: 60px; left: 0; right: 320px; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .st-topbar > * { pointer-events: auto; }
    .st-back { color: #fde68a; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #f59e0b; border-radius: 8px; background: rgba(60,40,5,0.45); }
    .st-back:hover { background: rgba(245,158,11,0.35); }
    .st-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1px; color: #fde68a; text-shadow: 0 0 12px rgba(245,158,11,0.5); }
    .st-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .st-legend { display: flex; gap: 10px; font-size: 11px; align-items: center; flex-wrap: wrap; }
    .st-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .st-legend .mvp     { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
    .st-legend .mvpplus { background: #67e8f9; box-shadow: 0 0 6px #67e8f9; }
    .st-legend .future  { background: #94a3b8; }
    .st-legend .release { background: #facc15; box-shadow: 0 0 8px #facc15; }

    .st-canvas { display: block; width: 100%; height: 100%; }
    .st-controls { position: absolute; bottom: 0; left: 0; right: 320px; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%); flex-wrap: wrap; }
    .st-controls button { background: rgba(60,40,5,0.7); color: #fde68a; border: 1px solid #f59e0b; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .st-controls button:hover { background: rgba(245,158,11,0.45); }
    .st-controls .st-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .st-controls .st-narrator:hover { background: rgba(251,191,36,0.3); }
    .st-controls .st-narrator.st-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .st-controls .st-narrator.st-play:hover { background: #f5b923; }
    .st-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Sidebar journeys */
    .st-sidebar { position: absolute; top: 60px; right: 0; bottom: 0; width: 320px; padding: 18px 14px; background: rgba(18,14,8,0.92); border-left: 1px solid rgba(245,158,11,0.3); backdrop-filter: blur(8px); overflow-y: auto; z-index: 9; font-size: 12px; }
    .st-sidebar-head { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #fbbf24; text-transform: uppercase; margin-bottom: 12px; }
    .st-journey { margin-bottom: 14px; padding: 10px 12px; background: rgba(35,25,8,0.5); border: 1px solid var(--jcolor, #f59e0b); border-radius: 10px; }
    .st-journey-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .st-journey-emoji { font-size: 18px; }
    .st-journey-name { color: var(--jcolor, #fde68a); font-size: 13px; }
    .st-journey-level { margin: 6px 0; }
    .st-level-tag { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; }
    .st-level-tag.mvp     { background: #fbbf24; color: #1a1500; }
    .st-level-tag.mvpplus { background: #67e8f9; color: #002433; }
    .st-level-tag.future  { background: #94a3b8; color: #1a1f29; }
    .st-journey-level ul { list-style: none; padding: 0; margin: 0; }
    .st-journey-level li { font-size: 11px; padding: 3px 0; opacity: 0.85; line-height: 1.4; }
    .st-journey-level li::before { content: "🪨 "; opacity: 0.6; }

    /* Flash cérémonie */
    .st-flash { position: absolute; inset: 0 320px 0 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: st-flash-pulse 1.6s ease-out forwards; }
    .st-flash[data-type="sommet"] { background: radial-gradient(circle at center, rgba(251,191,36,0.65), transparent 65%); }
    .st-flash[data-type="flag"]   { background: radial-gradient(circle at center, rgba(245,158,11,0.55), transparent 60%); }
    .st-flash[data-type="release"]{ background: radial-gradient(circle at center, rgba(250,204,21,0.7), transparent 70%); }
    .st-flash-content { text-align: center; animation: st-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .st-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,200,80,0.8)); }
    .st-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.6); }
    @keyframes st-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes st-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    /* Panel story */
    .st-panel { position: absolute; left: 22px; bottom: 70px; width: 280px; padding: 14px; background: rgba(25,18,8,0.94); border: 1px solid #f59e0b; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; box-shadow: 0 0 20px rgba(245,158,11,0.25); }
    .st-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(253,230,138,0.4); border-radius: 50%; color: #fde68a; cursor: pointer; }
    .st-panel-head { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
    .st-panel-id { color: #fbbf24; font-family: monospace; font-size: 11px; }
    .st-panel-level { font-size: 10px; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; font-weight: 700; }
    .st-panel-level[data-level="mvp"]      { background: #fbbf24; color: #1a1500; }
    .st-panel-level[data-level="mvp-plus"] { background: #67e8f9; color: #002433; }
    .st-panel-level[data-level="future"]   { background: #94a3b8; color: #1a1f29; }
    .st-panel-title { color: #fde68a; margin: 8px 0; line-height: 1.4; font-weight: 600; }
    .st-panel-journey { font-size: 11px; opacity: 0.75; }
  `]
})
export class StoryTrailRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── Services ───
  narrator = inject(NarratorService);
  private ceremonyBus = inject(CeremonyBusService);
  private spellFooter = inject(SpellFooterService);

  // ─── State signals ───
  journeys = signal<UserJourney[]>([]);
  selectedStory = signal<UserStory | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  releaseCutActive = signal<boolean>(true);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🗺', title: 'Story mapping de Jeff Patton', body: 'La carte des sentiers transpose le story mapping en 3D. Les chemins représentent les parcours utilisateurs.' },
    { icon: '🚶', title: 'Backbone = grandes étapes', body: 'Le sentier principal qui traverse le terrain est le backbone : les grandes étapes du parcours utilisateur, lues de gauche à droite.' },
    { icon: '🪨', title: 'Pierres = user stories', body: 'Les pierres plantées le long du chemin sont les user stories. Plus elles sont près du sentier, plus elles sont essentielles.' },
    { icon: '🏴', title: 'Drapeau orange = MVP', body: 'Le drapeau triangulaire orange en haut d\'un mât marque le MVP : l\'objectif final minimal pour livrer de la valeur.' },
    { icon: '❄', title: 'Brume basse = walking skeleton', body: 'La brume au sol matérialise la première ligne de release : le walking skeleton. Tout ce qui dépasse la brume y participe.' },
  ];
  tutorialVoiceLines: string[] = [
    'La carte des sentiers, c\'est du story mapping.',
    'Le backbone trace les grandes étapes du parcours.',
    'Chaque pierre est une user story.',
    'Le drapeau orange marque le MVP.',
    'La brume basse, c\'est le walking skeleton.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  // ─── Three.js refs ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;
  private elapsed = 0;
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;

  // Scene objects
  private mountain: any;
  private trailMeshes: any[] = [];        // 3 tubes horizontaux
  private stoneMeshes: any[] = [];        // toutes les pierres user stories
  private storyByStone = new Map<any, UserStory>();
  private releaseLine: any;                // grande ligne horizontale or-émissive
  private summitFlag: any;                 // groupe drapeau + mât
  private summitClothMesh: any;            // le tissu (pour anim)
  private trees: any[] = [];               // petits sapins au pied
  private snowPoints: any = null;          // particles neige
  private snowGroundMesh: any;             // sol neigeux

  // Lumières
  private ambientLight: any;
  private sunLight: any;

  // Interaction
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private ceremonyFlashTimer: any = null;

  // ───────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#f59e0b',
      hint: 'Drag = orbit · molette = zoom · clic pierre = user story',
      controls: [
        { icon: '🎬', label: 'Demo Story Map', action: () => this.loadDemo() },
        { icon: '🦴', label: 'Walking skeleton', action: () => this.traceWalkingSkeleton() },
        { icon: '🏁', label: 'Cut release MVP', action: () => this.cutRelease() },
        { icon: '🏴', label: 'Drapeau sommet', action: () => this.plantSummitFlag() },
        { icon: '🎥', label: 'Reset cam', action: () => this.resetCamera() },
        { icon: '🎓', label: 'How it works', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée par Yamzy' },
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
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
    }
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap(): Promise<void> {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    this.loadDemo();
  }

  private async ensureThreeJS(): Promise<void> {
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
  private init(): void {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scène + ciel hivernal
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x142033);
    this.scene.fog = new T.FogExp2(0x8aa6c8, 0.025);  // brume basse

    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(12, 10, 16);
    this.camera.lookAt(0, 4, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lumières
    this.ambientLight = new T.AmbientLight(0xc9d6e8, 0.55);
    this.scene.add(this.ambientLight);
    this.sunLight = new T.DirectionalLight(0xfff1d0, 0.95);
    this.sunLight.position.set(14, 22, 10);
    this.scene.add(this.sunLight);
    const hemi = new T.HemisphereLight(0xb6c4d6, 0x556677, 0.45);
    this.scene.add(hemi);

    // Ciel universel (étoiles, lune, aurore)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 500,
      starRadius: 85,
      moonPos: [-20, 22, -22],
      auroraPos: [0, 26, -40],
      cometPos: [18, 22, -18],
      shootingStarCount: 4,
    });
    // Anti-loop : ne pas re-pulser nos propres cérémonies
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'story-trail') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Sol neigeux
    this.snowGroundMesh = new T.Mesh(
      new T.PlaneGeometry(80, 80, 1, 1),
      new T.MeshStandardMaterial({
        color: 0xeaf0f8, roughness: 0.85, emissive: 0x1a2030, emissiveIntensity: 0.1,
      })
    );
    this.snowGroundMesh.rotation.x = -Math.PI / 2;
    this.snowGroundMesh.position.y = -0.05;
    this.scene.add(this.snowGroundMesh);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 4, 0);
      this.controls.maxDistance = 60;
      this.controls.minDistance = 4;
      this.controls.maxPolarAngle = Math.PI / 2.05;
    }

    // Raycaster pour clic pierre
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🎬 Intro cinématique : vue d'oiseau qui zoom vers la position finale
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 12, y: 10, z: 16 },
      { x: 0, y: 4, z: 0 },
      3.5,
    );

    console.log('[StoryTrail] 🏔 Scene ready');

    // 🪶 Attache Narrator Yamzy
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'story-trail',
    });

    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD SCENE
  // ═══════════════════════════════════════════════════════════════
  private buildScene(): void {
    const T = (window as any).THREE;
    this.disposeBuiltMeshes();

    this.buildMountain(T);
    this.buildTrailsAndStones(T);
    this.buildReleaseLine(T);
    this.buildSummitFlag(T);
    this.buildTrees(T);
    this.buildSnowParticles(T);

    console.log(`[StoryTrail] ⛰ Built: ${this.trailMeshes.length} trails, ${this.stoneMeshes.length} stones, ${this.trees.length} trees`);
  }

  // ─── Montagne : triangle prism stylisé en strates ───
  private buildMountain(T: any): void {
    const mountainGroup = new T.Group();
    const baseRadius = 7;
    const totalHeight = 11;
    const levels = 5;

    for (let i = 0; i < levels; i++) {
      const t = i / levels;
      const rBot = baseRadius * (1 - t * 0.85);
      const hSeg = totalHeight / levels;
      // Cone à 3 segments radial = effet "triangle prism stylisé"
      const radialSegments = 6;
      const geom = new T.ConeGeometry(rBot, hSeg * 1.6, radialSegments, 2, true);
      // Léger noise pour casser la régularité
      const posAttr = geom.attributes.position;
      for (let j = 0; j < posAttr.count; j++) {
        const x = posAttr.getX(j);
        const z = posAttr.getZ(j);
        const noise = (Math.sin(x * 1.5) + Math.cos(z * 1.5)) * 0.15;
        posAttr.setX(j, x + noise);
        posAttr.setZ(j, z + noise);
      }
      geom.computeVertexNormals();

      // Couleur : neige en haut, gris-marron en bas
      const isSnow = i >= levels - 2;
      const color = isSnow ? 0xf2f6fb : (i === 0 ? 0x6a7d6e : 0x82786c);
      const mat = new T.MeshStandardMaterial({
        color,
        roughness: isSnow ? 0.4 : 0.95,
        emissive: isSnow ? 0x445566 : 0x000000,
        emissiveIntensity: isSnow ? 0.15 : 0,
        flatShading: true,
      });
      const cone = new T.Mesh(geom, mat);
      cone.position.y = i * hSeg * 1.4 + hSeg / 2;
      mountainGroup.add(cone);
    }
    mountainGroup.userData.tutorialId = 'mountain';
    this.mountain = mountainGroup;
    this.scene.add(mountainGroup);
  }

  // ─── 3 sentiers horizontaux + pierres user stories ───
  private buildTrailsAndStones(T: any): void {
    const journeys = this.journeys();
    const baseRadius = 7;
    const totalHeight = 11;

    journeys.forEach((journey, jIdx) => {
      // Altitude verticale (Y) sur la montagne — entre 1.0 et 8.5
      const y = 1.0 + journey.altitude * 7.5;
      // Rayon horizontal du sentier (rétrécit avec l'altitude)
      const altRatio = journey.altitude;
      const trailRadius = baseRadius * (1 - altRatio * 0.7) + 0.45;

      // ─ Sentier (TorusGeometry horizontal posé sur la pente) ─
      const tubeRadius = 0.12;
      const torusGeom = new T.TorusGeometry(trailRadius, tubeRadius, 8, 60);
      const trailMat = new T.MeshStandardMaterial({
        color: journey.trailColorHex,
        emissive: journey.trailColorHex,
        emissiveIntensity: 0.45,
        roughness: 0.6,
      });
      const trail = new T.Mesh(torusGeom, trailMat);
      trail.position.y = y;
      trail.rotation.x = Math.PI / 2;  // horizontal
      trail.userData.tutorialId = jIdx === 0 ? 'trail' : undefined;
      trail.userData.journey = journey;
      trail.userData.kind = 'trail';
      this.trailMeshes.push(trail);
      this.scene.add(trail);

      // ─ Pierres user stories le long du sentier ─
      const stories = journey.stories;
      const stoneCount = stories.length;
      stories.forEach((story, sIdx) => {
        // Angle sur le cercle (réparti sur ~270° pour laisser un espace côté caméra)
        const spread = Math.PI * 1.55;  // ~280°
        const offset = -Math.PI * 0.78;
        const angle = offset + (sIdx / Math.max(1, stoneCount - 1)) * spread;
        const x = Math.cos(angle) * trailRadius;
        const z = Math.sin(angle) * trailRadius;

        // Couleur par niveau release
        const stoneColor = this.colorForLevel(story.level);
        const icoSize = 0.32;
        const icoGeom = new T.IcosahedronGeometry(icoSize, 0);
        const stoneMat = new T.MeshStandardMaterial({
          color: stoneColor,
          emissive: stoneColor,
          emissiveIntensity: story.level === 'future' ? 0.15 : 0.55,
          roughness: 0.45,
          metalness: 0.3,
          flatShading: true,
        });
        const stone = new T.Mesh(icoGeom, stoneMat);
        stone.position.set(x, y + 0.05, z);
        stone.userData = {
          kind: 'stone',
          storyId: story.id,
          baseY: y + 0.05,
          phase: (sIdx + jIdx * 0.5) * 0.7,
        };
        if (jIdx === 0 && sIdx === 0) stone.userData.tutorialId = 'stone';
        if (story.level === 'mvp' && jIdx === 0) stone.userData.tutorialId = stone.userData.tutorialId ?? 'stone-mvp';

        this.stoneMeshes.push(stone);
        this.storyByStone.set(stone, story);
        this.scene.add(stone);

        // Label canvas (sprite texturé)
        const sprite = this.makeLabelSprite(T, story.title, stoneColor);
        sprite.position.set(x, y + 0.85, z);
        sprite.scale.set(2.0, 0.5, 1);
        this.scene.add(sprite);
        // attache le sprite au stone pour animations couplées
        stone.userData.label = sprite;
      });
    });
  }

  private colorForLevel(level: ReleaseLevel): number {
    switch (level) {
      case 'mvp':      return 0xfbbf24;  // or
      case 'mvp-plus': return 0x67e8f9;  // cyan
      case 'future':   return 0x94a3b8;  // gris
    }
  }

  private makeLabelSprite(T: any, text: string, colorHex: number): any {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(15, 12, 8, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const r = (colorHex >> 16) & 0xff, g = (colorHex >> 8) & 0xff, b = colorHex & 0xff;
    ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Tronque si trop long
    const truncated = text.length > 22 ? text.slice(0, 20) + '...' : text;
    ctx.fillText(truncated, canvas.width / 2, canvas.height / 2);
    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    return new T.Sprite(mat);
  }

  // ─── Grande ligne de release : torus horizontal or-émissif ───
  private buildReleaseLine(T: any): void {
    // Position altitudinale = juste au-dessus du sentier MVP (le plus bas)
    const journeys = this.journeys();
    if (journeys.length === 0) return;
    const baseRadius = 7;
    // Ligne au niveau "MVP cut" = entre MVP et MVP+ (juste au dessus sentier 0)
    const releaseY = 1.0 + 0.18 * 7.5 + 0.4;  // un poil au-dessus du sentier bas
    const releaseRadius = baseRadius * 1.05;  // un peu plus large que la montagne

    const torusGeom = new T.TorusGeometry(releaseRadius, 0.18, 12, 80);
    const mat = new T.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.releaseLine = new T.Mesh(torusGeom, mat);
    this.releaseLine.position.y = releaseY;
    this.releaseLine.rotation.x = Math.PI / 2;
    this.releaseLine.userData.tutorialId = 'release-line';
    this.releaseLine.userData.kind = 'releaseLine';
    this.scene.add(this.releaseLine);
  }

  // ─── Drapeau orange triangle au sommet sur mât ───
  private buildSummitFlag(T: any): void {
    const summitY = 11 * 1.4 + 0.5;  // approx top de la montagne
    const group = new T.Group();
    group.position.set(0, summitY, 0);

    // Mât
    const poleGeom = new T.CylinderGeometry(0.05, 0.07, 2.2, 8);
    const poleMat = new T.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.y = 1.1;
    group.add(pole);

    // Pointe dorée
    const tipGeom = new T.ConeGeometry(0.1, 0.25, 8);
    const tipMat = new T.MeshStandardMaterial({
      color: 0xfbbf24, metalness: 0.85, roughness: 0.2,
      emissive: 0xfbbf24, emissiveIntensity: 0.45,
    });
    const tip = new T.Mesh(tipGeom, tipMat);
    tip.position.y = 2.32;
    group.add(tip);

    // Drapeau triangle orange (cloth)
    // Plane triangulaire personnalisé via BufferGeometry
    const flagGeom = new T.BufferGeometry();
    const v = new Float32Array([
       0.0, 0.0, 0.0,
       1.1, -0.25, 0.0,
       0.0, -0.7, 0.0,
    ]);
    flagGeom.setAttribute('position', new T.BufferAttribute(v, 3));
    flagGeom.setIndex([0, 1, 2]);
    flagGeom.computeVertexNormals();
    const flagMat = new T.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.55,
      side: T.DoubleSide,
      roughness: 0.6,
    });
    const cloth = new T.Mesh(flagGeom, flagMat);
    cloth.position.set(0.04, 2.05, 0);
    cloth.userData.kind = 'flagCloth';
    group.add(cloth);
    this.summitClothMesh = cloth;

    group.userData.tutorialId = 'summit-flag';
    this.summitFlag = group;
    this.scene.add(group);
  }

  // ─── Petits sapins au pied de la montagne ───
  private buildTrees(T: any): void {
    // Disposition en couronne autour de la montagne
    const treeCount = 14;
    const ringRadius = 11;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const jitter = 0.7;
      const r = ringRadius + (((i * 17) % 100) / 100 - 0.5) * jitter * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const treeGroup = new T.Group();

      // Tronc
      const trunkGeom = new T.CylinderGeometry(0.08, 0.12, 0.4, 6);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.95 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.2;
      treeGroup.add(trunk);

      // Feuillage (3 cônes empilés = sapin)
      const foliageMat = new T.MeshStandardMaterial({
        color: 0x1f5037, roughness: 0.9,
        emissive: 0x0a1f15, emissiveIntensity: 0.1,
        flatShading: true,
      });
      for (let k = 0; k < 3; k++) {
        const conRadius = 0.55 - k * 0.13;
        const conHeight = 0.65;
        const cone = new T.Mesh(new T.ConeGeometry(conRadius, conHeight, 6), foliageMat);
        cone.position.y = 0.5 + k * 0.45;
        treeGroup.add(cone);
      }

      // Neige sur la tête (petit cone blanc au sommet)
      const snowCap = new T.Mesh(
        new T.ConeGeometry(0.18, 0.18, 6),
        new T.MeshStandardMaterial({ color: 0xf8fbff, roughness: 0.5 })
      );
      snowCap.position.y = 1.95;
      treeGroup.add(snowCap);

      treeGroup.position.set(x, 0, z);
      // Légère échelle aléatoire
      const sc = 0.85 + (((i * 31) % 30) / 30) * 0.3;
      treeGroup.scale.setScalar(sc);
      this.trees.push(treeGroup);
      this.scene.add(treeGroup);
    }
  }

  // ─── Neige qui tombe (particles) ───
  private buildSnowParticles(T: any): void {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xffffff,
      size: 0.16,
      transparent: true,
      opacity: 0.85,
    });
    this.snowPoints = new T.Points(geom, mat);
    this.scene.add(this.snowPoints);
  }

  // ═══════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════
  loadDemo(): void {
    this.journeys.set([
      {
        id: 'j1',
        name: 'Découverte produit',
        emoji: '🔍',
        color: '#facc15',
        trailColorHex: 0xfbbf24,
        altitude: 0.18,  // sentier le plus bas
        stories: [
          { id: 'US-101', title: 'Landing page',            level: 'mvp' },
          { id: 'US-102', title: 'Inscription email',       level: 'mvp' },
          { id: 'US-103', title: 'Tour produit guidé',      level: 'mvp' },
          { id: 'US-104', title: 'SEO sitemap',             level: 'mvp-plus' },
          { id: 'US-105', title: 'Témoignages clients',     level: 'mvp-plus' },
          { id: 'US-106', title: 'A/B testing landing',     level: 'future' },
        ],
      },
      {
        id: 'j2',
        name: 'Onboarding & activation',
        emoji: '🚀',
        color: '#67e8f9',
        trailColorHex: 0x22d3ee,
        altitude: 0.50,  // sentier du milieu
        stories: [
          { id: 'US-201', title: 'Wizard 3 étapes',         level: 'mvp' },
          { id: 'US-202', title: 'Email de bienvenue',      level: 'mvp' },
          { id: 'US-203', title: 'Première action guidée',  level: 'mvp' },
          { id: 'US-204', title: 'Personnalisation profil', level: 'mvp-plus' },
          { id: 'US-205', title: 'Recommandations IA',      level: 'future' },
          { id: 'US-206', title: 'Quiz onboarding',         level: 'future' },
        ],
      },
      {
        id: 'j3',
        name: 'Achat & paiement',
        emoji: '💳',
        color: '#a78bfa',
        trailColorHex: 0xa78bfa,
        altitude: 0.78,  // sentier le plus haut
        stories: [
          { id: 'US-301', title: 'Catalogue produits',      level: 'mvp' },
          { id: 'US-302', title: 'Panier basique',          level: 'mvp' },
          { id: 'US-303', title: 'Stripe checkout',         level: 'mvp' },
          { id: 'US-304', title: 'Codes promo',             level: 'mvp-plus' },
          { id: 'US-305', title: 'Wishlist',                level: 'mvp-plus' },
          { id: 'US-306', title: 'Abonnement récurrent',    level: 'future' },
          { id: 'US-307', title: 'Paiement crypto',         level: 'future' },
        ],
      },
    ]);
    this.buildScene();
  }

  totalStories(): number {
    return this.journeys().reduce((s, j) => s + j.stories.length, 0);
  }

  storiesOf(journey: UserJourney, level: ReleaseLevel): UserStory[] {
    return journey.stories.filter(s => s.level === level);
  }

  journeyOfStory(story: UserStory): UserJourney | undefined {
    return this.journeys().find(j => j.stories.some(s => s.id === story.id));
  }

  levelLabel(level: ReleaseLevel): string {
    if (level === 'mvp')      return 'MVP';
    if (level === 'mvp-plus') return 'MVP+';
    return 'Future';
  }

  // ═══════════════════════════════════════════════════════════════
  // CINEMATIC METHODS (invoked by playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════

  /** 🏁 CUT RELEASE — la ligne de release s'illumine intensément 4s */
  cutRelease(): void {
    if (this.releaseLine) {
      this.releaseLine.userData.flashUntil = performance.now() + 4000;
    }
    // Pulse aussi toutes les pierres MVP
    for (const stone of this.stoneMeshes) {
      const story = this.storyByStone.get(stone);
      if (story?.level === 'mvp') {
        stone.userData.pulseUntil = performance.now() + 3000;
      }
    }
    this.emitCeremony({ type: 'flag', label: '🏁 Release MVP coupée · ligne tracée', icon: '🏁' });
  }

  /** 🦴 WALKING SKELETON — fait briller une story MVP par journey (chemin minimum vers le sommet) */
  traceWalkingSkeleton(): void {
    // Pour chaque journey, prend la 1ère story MVP et la pulse
    const journeys = this.journeys();
    for (const journey of journeys) {
      const firstMvp = journey.stories.find(s => s.level === 'mvp');
      if (!firstMvp) continue;
      const stone = [...this.storyByStone.entries()].find(([_, s]) => s.id === firstMvp.id)?.[0];
      if (stone) {
        stone.userData.pulseUntil = performance.now() + 5000;
      }
    }
    this.emitCeremony({ type: 'flag', label: '🦴 Walking skeleton tracé · chemin minimum vers sommet', icon: '🦴' });
  }

  /** 🏴 PLANT SUMMIT FLAG — drapeau brille intensément + ceremony sommet */
  plantSummitFlag(): void {
    if (this.summitClothMesh) {
      this.summitClothMesh.userData.triumphFlash = performance.now() + 5000;
    }
    this.emitCeremony({ type: 'sommet', label: '🏔 Sommet conquis · objectif final atteint', icon: '🏔' });
  }

  /** Helper : appelée par tutorial JSON pour révéler un sentier */
  revealTrail(idx: number): void {
    if (idx < 0 || idx >= this.trailMeshes.length) return;
    const trail = this.trailMeshes[idx];
    trail.userData.revealUntil = performance.now() + 3500;
  }

  /** Helper : appelée par tutorial JSON pour révéler le sentier #1 */
  revealTrail1(): void { this.revealTrail(0); }
  revealTrail2(): void { this.revealTrail(1); }
  revealTrail3(): void { this.revealTrail(2); }

  /** Highlight all MVP stones (lit them up) */
  illuminateMvp(): void {
    for (const stone of this.stoneMeshes) {
      const story = this.storyByStone.get(stone);
      if (story?.level === 'mvp') {
        stone.userData.pulseUntil = performance.now() + 4500;
      }
    }
    this.emitCeremony({ type: 'flag', label: '✨ Pierres MVP illuminées', icon: '✨' });
  }

  /** Méthode publique pour permettre au narrator (JSON) d'émettre une cérémonie */
  emitCeremonyPublic(c: { type: string; label: string; icon: string }): void {
    this.emitCeremony(c);
  }

  resetCamera(): void {
    if (!this.camera) return;
    this.camera.position.set(12, 10, 16);
    this.camera.lookAt(0, 4, 0);
    if (this.controls) this.controls.target.set(0, 4, 0);
  }

  // ─── Raycaster : clic pierre → ouvre side panel ───
  private handleCanvasClick(e: MouseEvent): void {
    if (!this.camera || !this.raycaster) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.stoneMeshes, false);
    if (hits.length > 0) {
      const story = this.storyByStone.get(hits[0].object);
      if (story) {
        this.selectedStory.set(story);
        // pulse visuel
        hits[0].object.userData.pulseUntil = performance.now() + 1500;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CEREMONIES
  // ═══════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }): void {
    this.ceremonyBus.publishFromRoom('story-trail', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════
  private disposeBuiltMeshes(): void {
    if (this.mountain) { this.scene.remove(this.mountain); this.mountain = null; }
    for (const t of this.trailMeshes) this.scene.remove(t);
    this.trailMeshes = [];
    for (const s of this.stoneMeshes) {
      if (s.userData?.label) this.scene.remove(s.userData.label);
      this.scene.remove(s);
    }
    this.stoneMeshes = [];
    this.storyByStone.clear();
    if (this.releaseLine) { this.scene.remove(this.releaseLine); this.releaseLine = null; }
    if (this.summitFlag) { this.scene.remove(this.summitFlag); this.summitFlag = null; }
    for (const tree of this.trees) this.scene.remove(tree);
    this.trees = [];
    if (this.snowPoints) { this.scene.remove(this.snowPoints); this.snowPoints = null; }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;
    const nowMs = performance.now();

    // ─ Pierres : bob subtle + labels suivent + pulse cinematic ─
    for (const stone of this.stoneMeshes) {
      const ud = stone.userData;
      const phase = ud.phase || 0;
      // Bob vertical
      const bobY = Math.sin(this.elapsed * 1.4 + phase) * 0.06;
      stone.position.y = ud.baseY + bobY;
      // Rotation lente
      stone.rotation.y = this.elapsed * 0.25 + phase;
      stone.rotation.x = Math.sin(this.elapsed * 0.4 + phase) * 0.15;

      // Pulse (cinematic / click)
      if (ud.pulseUntil && nowMs < ud.pulseUntil) {
        const t = (ud.pulseUntil - nowMs) / 1500;
        const intensity = 1.2 + Math.sin(this.elapsed * 10) * 0.4;
        if (stone.material) stone.material.emissiveIntensity = 0.55 + intensity;
        const sc = 1.0 + Math.sin(this.elapsed * 8) * 0.18;
        stone.scale.setScalar(sc);
      } else if (ud.pulseUntil) {
        delete ud.pulseUntil;
        stone.scale.setScalar(1.0);
        if (stone.material) {
          const story = this.storyByStone.get(stone);
          stone.material.emissiveIntensity = story?.level === 'future' ? 0.15 : 0.55;
        }
      }

      // Label : suit la pierre
      if (ud.label) {
        ud.label.position.y = ud.baseY + 0.85 + bobY * 0.5;
      }
    }

    // ─ Sentiers : glow pulse subtle + reveal cinematic ─
    for (const trail of this.trailMeshes) {
      const ud = trail.userData;
      if (ud.revealUntil && nowMs < ud.revealUntil) {
        const t = 1 - (ud.revealUntil - nowMs) / 3500;
        const phaseIntensity = 1.4 + Math.sin(this.elapsed * 6) * 0.6;
        if (trail.material) trail.material.emissiveIntensity = 0.45 + phaseIntensity;
      } else if (ud.revealUntil) {
        delete ud.revealUntil;
        if (trail.material) trail.material.emissiveIntensity = 0.45;
      } else {
        // pulse normal très subtle
        if (trail.material) {
          trail.material.emissiveIntensity = 0.45 + Math.sin(this.elapsed * 1.8) * 0.1;
        }
      }
    }

    // ─ Ligne de release : pulse permanent + flash cinematic ─
    if (this.releaseLine) {
      const ud = this.releaseLine.userData;
      if (ud.flashUntil && nowMs < ud.flashUntil) {
        const intensity = 2.0 + Math.sin(this.elapsed * 12) * 0.8;
        if (this.releaseLine.material) this.releaseLine.material.emissiveIntensity = intensity;
        const sc = 1.0 + Math.sin(this.elapsed * 6) * 0.04;
        this.releaseLine.scale.set(sc, sc, 1);
      } else {
        if (ud.flashUntil) delete ud.flashUntil;
        if (this.releaseLine.material) {
          this.releaseLine.material.emissiveIntensity = 1.0 + Math.sin(this.elapsed * 2.2) * 0.15;
        }
        this.releaseLine.scale.set(1, 1, 1);
      }
    }

    // ─ Drapeau du sommet : ondule rotation Y + triumphFlash cinematic ─
    if (this.summitClothMesh) {
      this.summitClothMesh.rotation.y = Math.sin(this.elapsed * 2.0) * 0.4;
      const ud = this.summitClothMesh.userData;
      if (ud.triumphFlash && nowMs < ud.triumphFlash) {
        if (this.summitClothMesh.material) {
          this.summitClothMesh.material.emissiveIntensity = 1.8 + Math.sin(this.elapsed * 9) * 0.6;
        }
      } else if (ud.triumphFlash) {
        delete ud.triumphFlash;
        if (this.summitClothMesh.material) this.summitClothMesh.material.emissiveIntensity = 0.55;
      }
    }

    // ─ Neige qui tombe ─
    if (this.snowPoints) {
      const pos = this.snowPoints.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 0.08;
        let x = pos.getX(i) + Math.sin(this.elapsed + i * 0.13) * 0.012;
        if (y < -1) { y = 24; x = (Math.random() - 0.5) * 50; }
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }

    // ─ Petits sapins : tiny sway ─
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      tree.rotation.z = Math.sin(this.elapsed * 0.9 + i * 0.5) * 0.025;
    }

    // Sky tick
    this.sky?.tick(dt, this.elapsed);

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
    this.narrator.startTimeboxOnly(3600, 'Story Mapping');
  }
}
