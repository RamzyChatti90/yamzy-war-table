// ═══════════════════════════════════════════════════════════════════
// 🔥 PHOENIX FORGE ROOM — L'Atelier des Renaissances
//
// Mécanique data unique : une forge alchimique 3D où un phénix veille
// sur l'athanor central. Chaque release est un rituel mystique.
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🐦 Renaissance      = release published (phénix renaît, flash doré)
//   💀 Mort prématurée  = rollback (cendres, flash gris)
//   🌟 Comète           = major version (étoile filante blanche)
//   🚨 Sirène           = hotfix urgent (flash rouge pulsant)
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
import { SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent, TutorialStep, SpellFooterService } from '../../core/spell-ui';

// ─── Modèles métier ───
interface PlannedRelease {
  version: string;             // ex: 'v1.4.0'
  semverKind: 'major' | 'minor' | 'patch' | 'hotfix';
  plannedFor: Date;
  status: 'planned' | 'building' | 'live';
  ticketCount: number;
}

interface ForgeCommit {
  sha: string;
  author: string;
  message: string;
  timestamp: number;
  authorColor: string;
}

interface SmokeTest {
  suite: string;
  passed: boolean | null;       // null = pending
  durationMs: number;
}

interface PastRelease {
  version: string;
  deployedAt: Date;
  semverKind: 'major' | 'minor' | 'patch' | 'hotfix';
}

@Component({
  selector: 'wt-phoenix-forge-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellButtonComponent, SpellPanelComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pf-host">
      <header class="pf-topbar">
        <div class="pf-title">
          <h1>🔥 PHOENIX FORGE</h1>
          <p>L'Atelier des Renaissances — {{ plannedReleases().length }} œufs · {{ commits().length }} commits depuis dernière release · {{ pastReleases().length }} cendres</p>
        </div>
        <div class="pf-legend">
          <span class="dot egg"></span>release planifiée
          <span class="dot feather"></span>commit
          <span class="dot crystal"></span>smoke test
          <span class="dot ash"></span>release passée
        </div>
      </header>

      <canvas #canvas class="pf-canvas"></canvas>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="pf-flash" [attr.data-type]="f.type">
        <div class="pf-flash-content">
          <div class="pf-flash-icon">{{ f.icon }}</div>
          <div class="pf-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel commit (clic plume) -->
      <wt-spell-panel
        [open]="!!selectedCommit()"
        title="Détail du commit"
        icon="🪶"
        accent="#67e8f9"
        side="right"
        size="sm"
        (close)="selectedCommit.set(null)">
        <ng-container *ngIf="selectedCommit() as c">
          <div class="pf-panel-head">
            <strong class="pf-panel-sha">{{ c.sha.slice(0, 7) }}</strong>
            <span class="pf-panel-author" [style.color]="c.authorColor">🪶 {{ c.author }}</span>
          </div>
          <div class="pf-panel-msg">{{ c.message }}</div>
          <div class="pf-panel-time">{{ fmtAgo(c.timestamp) }}</div>
        </ng-container>
      </wt-spell-panel>

      <!-- Panel release planifiée (clic œuf) -->
      <wt-spell-panel
        [open]="!!selectedRelease()"
        title="Œuf de release"
        icon="🥚"
        accent="#67e8f9"
        side="right"
        size="sm"
        (close)="selectedRelease.set(null)">
        <ng-container *ngIf="selectedRelease() as r">
          <div class="pf-panel-head">
            <strong class="pf-panel-version">🥚 {{ r.version }}</strong>
            <span class="pf-panel-kind" [attr.data-kind]="r.semverKind">{{ r.semverKind }}</span>
          </div>
          <div class="pf-panel-msg">{{ r.ticketCount }} tickets · status : <em>{{ r.status }}</em></div>
          <div class="pf-panel-time">Planifié pour {{ r.plannedFor | date:'mediumDate' }}</div>
        </ng-container>
      </wt-spell-panel>

      <!-- 🎬 Splash overlay (welcome screen avant entrée) -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Phoenix Forge"
        loreName="L'Atelier des Renaissances"
        color="#ea580c"
        oneLiner="Athanor + phénix vivant + 600 flammes. Chaque release = un œuf qui éclôt."
        [duration]="75"
        [timeboxDurationS]="1800"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Phoenix Forge"
        loreName="L'Atelier des Renaissances"
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
    .pf-host { position: relative; width: 100%; height: 100vh; background: #0d0a14; color: #fde6c8; font-family: "Tinos", serif; }

    .pf-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .pf-topbar > * { pointer-events: auto; }
    .pf-back { color: #fdba74; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #ea580c; border-radius: 8px; background: rgba(60,20,0,0.5); }
    .pf-back:hover { background: rgba(234,88,12,0.45); }
    .pf-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; letter-spacing: 1.5px; color: #fdba74; text-shadow: 0 0 12px rgba(234,88,12,0.6); }
    .pf-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.75; }
    .pf-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; }
    .pf-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .pf-legend .egg     { background: #facc15; box-shadow: 0 0 8px #facc15; }
    .pf-legend .feather { background: #ea580c; }
    .pf-legend .crystal { background: #84cc16; box-shadow: 0 0 6px #84cc16; }
    .pf-legend .ash     { background: #57534e; }

    .pf-canvas { display: block; width: 100%; height: 100%; }
    .pf-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%); }
    .pf-controls button { background: rgba(60,25,5,0.7); color: #fde6c8; border: 1px solid #ea580c; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .pf-controls button:hover { background: rgba(234,88,12,0.55); box-shadow: 0 0 10px rgba(234,88,12,0.4); }
    .pf-controls .pf-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .pf-controls .pf-narrator:hover { background: rgba(251,191,36,0.3); }
    .pf-controls .pf-narrator.pf-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .pf-controls .pf-narrator.pf-play:hover { background: #f5b923; }
    .pf-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }

    /* Flash cérémonie */
    .pf-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: pf-flash-pulse 1.6s ease-out forwards; }
    .pf-flash[data-type="renaissance"] { background: radial-gradient(circle at center, rgba(250,204,21,0.7), transparent 65%); }
    .pf-flash[data-type="death"]       { background: radial-gradient(circle at center, rgba(120,120,120,0.55), transparent 60%); }
    .pf-flash[data-type="comet"]       { background: radial-gradient(circle at center, rgba(255,255,255,0.85), transparent 70%); }
    .pf-flash[data-type="siren"]       { background: radial-gradient(circle at center, rgba(220,38,38,0.7), transparent 60%); animation: pf-flash-siren 1.6s ease-out forwards; }
    .pf-flash-content { text-align: center; animation: pf-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .pf-flash-icon  { font-size: 104px; line-height: 1; filter: drop-shadow(0 0 32px rgba(255,180,80,0.9)); }
    .pf-flash-label { font-size: 24px; margin-top: 10px; color: #fff; font-weight: 700; letter-spacing: 1.5px; text-shadow: 0 0 14px rgba(0,0,0,0.6); }
    @keyframes pf-flash-pulse { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes pf-flash-siren { 0% { opacity: 0; } 10% { opacity: 1; } 30% { opacity: 0.3; } 50% { opacity: 1; } 70% { opacity: 0.3; } 100% { opacity: 0; } }
    @keyframes pf-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }

    /* Panels */
    .pf-panel { position: absolute; right: 22px; top: 80px; width: 290px; padding: 14px; background: rgba(25,15,8,0.94); border: 1px solid #ea580c; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; box-shadow: 0 0 20px rgba(234,88,12,0.25); }
    .pf-panel-release { top: auto; bottom: 80px; }
    .pf-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(253, 186, 116, 0.4); border-radius: 50%; color: #fdba74; cursor: pointer; }
    .pf-panel-head { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
    .pf-panel-sha { color: #facc15; font-family: monospace; }
    .pf-panel-version { color: #facc15; font-size: 14px; }
    .pf-panel-author { font-weight: 600; }
    .pf-panel-kind { font-size: 10px; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
    .pf-panel-kind[data-kind="major"]  { background: #7c2d12; color: #fed7aa; }
    .pf-panel-kind[data-kind="minor"]  { background: #14532d; color: #bbf7d0; }
    .pf-panel-kind[data-kind="patch"]  { background: #1e3a8a; color: #bfdbfe; }
    .pf-panel-kind[data-kind="hotfix"] { background: #7f1d1d; color: #fecaca; }
    .pf-panel-msg { color: #fde6c8; margin: 8px 0; line-height: 1.4; }
    .pf-panel-time { font-size: 10px; opacity: 0.65; }
  `]
})
export class PhoenixForgeRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── État réactif (signals) ───
  plannedReleases = signal<PlannedRelease[]>([]);
  commits = signal<ForgeCommit[]>([]);
  smokeTests = signal<SmokeTest[]>([]);
  pastReleases = signal<PastRelease[]>([]);
  selectedCommit = signal<ForgeCommit | null>(null);
  selectedRelease = signal<PlannedRelease | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🔥', title: 'L\'athanor brûle vos commits', body: 'L\'athanor central forge votre code. Chaque commit est une braise qui rejoint la flamme.' },
    { icon: '🥚', title: 'Œuf de phénix = release en préparation', body: 'L\'œuf doré au centre couve. Sa chaleur augmente à chaque feature mergée. Quand il craque, la release est prête.' },
    { icon: '🦅', title: 'Le phénix s\'envole à chaque deploy', body: 'Quand vous déployez, le phénix renaît de ses cendres et traverse l\'atelier en flammes. Cinématique grandiose.' },
    { icon: '💀', title: 'Cendres = hot-fixes', body: 'Au sol, les cendres représentent les incidents. Plus elles s\'accumulent, plus l\'atelier est sombre — il faut nettoyer.' },
    { icon: '⚒', title: '600 flammes = particules CI', body: 'Les 600 flammes dansantes sont vos pipelines CI/CD. Vert = build OK, rouge = échec à investiguer.' },
  ];
  tutorialVoiceLines: string[] = [
    'L\'athanor forge votre code à partir des commits.',
    'L\'œuf de phénix couve la prochaine release.',
    'Le phénix renaît à chaque déploiement.',
    'Les cendres représentent les hot-fixes.',
    'Six cents flammes pour vos pipelines CI.',
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
  private rafId: number = 0;
  private disposed = false;
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;

  // 🪶 Narrator Yamzy : injecté dans le footer + overlay <wt-narrator>
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);

  // Méthode publique pour le narrator (emit ceremony from JSON tutorial)
  public emitCeremonyPublic(c: { type: string; label: string; icon: string }) {
    this.emitCeremony(c);
  }

  // ─── Refs 3D ───
  private athanor: any;                       // four central
  private athanorGlow: any;                   // disque lumineux au sommet
  private phoenix: any;                       // groupe (corps + ailes)
  private phoenixBody: any;
  private phoenixWingLeft: any;
  private phoenixWingRight: any;
  private phoenixTail: any;
  private flameParticles: any;                // Points (particules de feu)
  private flameVelocities: Float32Array = new Float32Array(0);
  private burstParticles: any = null;         // particules dorées lors du rituel
  private burstVelocities: Float32Array = new Float32Array(0);
  private burstLife: number = 0;
  private eggMeshes: any[] = [];              // 5 œufs sur la mantelpiece
  private eggTemplate: any | null = null;     // Faberge GLB chargé une seule fois (cloned 5x)
  private GLTFLoader: any;                    // Loader GLTF chargé via CDN
  private featherMeshes: any[] = [];          // ~30 plumes au sol
  private crystalMeshes: any[] = [];          // 5 stalactites
  private ashMeshes: any[] = [];              // tas de cendres
  private torchLights: any[] = [];            // lumières flickering
  private commitsByFeather = new Map<any, ForgeCommit>();
  private releasesByEgg = new Map<any, PlannedRelease>();

  // ─── Animation state ───
  private elapsed = 0;
  private wingFlapPhase = 0;
  private ritualPhase: number = 0;            // 0=idle, sinon timer décroissant
  private ritualBaseY = 0;
  private ceremonyFlashTimer: any = null;
  /** Embers spawned by emberDrift() — animés + GC quand age > ttl */
  private driftingEmbers: any[] = [];

  // 🌀 Portail vers l'Island Hub
  private router = inject(Router);
  private portal: PortalHandle | null = null;

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#67e8f9',
      hint: 'Drag = orbit · molette = zoom · clic plume = commit · clic œuf = release',
      controls: [
        { icon: '🎬', label: 'Demo project', action: () => this.loadDemo() },
        { icon: '🐦', label: 'Release ritual', action: () => this.triggerReleaseRitual() },
        { icon: '⚡', label: 'Hotfix express', action: () => this.triggerHotfix() },
        { icon: '🔧', label: 'Rollback last', action: () => this.rollbackLast() },
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
    await this.loadEggTemplate();
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
    if (!(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    this.GLTFLoader = (window as any).THREE?.GLTFLoader;
  }

  /**
   * Charge DEUX GLB et les compose en un seul template :
   *   - faberge.glb     → on garde le SUPPORT (base/socle) et on retire la partie œuf
   *   - easter-egg.glb  → on prend l'œuf et on le pose à la place du précédent
   *
   * Heuristique pour identifier "l'œuf" dans faberge.glb : c'est la mesh
   * dont le bounding-box center Y est le plus haut (les Fabergés ont
   * typiquement la base en bas et l'œuf au-dessus).
   *
   * Le template combiné est mis en cache dans this.eggTemplate et cloné
   * par buildEggs() pour chaque release. Fallback silencieux si l'une des
   * deux GLB ne charge pas.
   */
  private async loadEggTemplate(): Promise<void> {
    if (this.eggTemplate || !this.GLTFLoader) return;
    const T = (window as any).THREE;
    const loader = new this.GLTFLoader();

    const loadGLB = (path: string): Promise<any> => new Promise((resolve, reject) => {
      loader.load(path, (gltf: any) => resolve(gltf.scene), undefined, reject);
    });

    try {
      const [supportGlb, eggGlb] = await Promise.all([
        loadGLB('assets/phoenix-forge/models/faberge.glb'),
        loadGLB('assets/phoenix-forge/models/easter-egg.glb'),
      ]);
      supportGlb.updateMatrixWorld(true);
      eggGlb.updateMatrixWorld(true);

      // ─── 1) Localiser la mesh "œuf" dans faberge.glb (top center Y) ───
      let topMesh: any = null;
      let topCenterY = -Infinity;
      supportGlb.traverse((child: any) => {
        if (child.isMesh) {
          const bbox = new T.Box3().setFromObject(child);
          const centerY = (bbox.min.y + bbox.max.y) / 2;
          if (centerY > topCenterY) { topCenterY = centerY; topMesh = child; }
        }
      });

      // Position & dimension cible pour le nouvel œuf
      let targetCenter = new T.Vector3(0, 0.6, 0);
      let targetBottom = 0.2;
      let targetMaxDim = 0.7;

      if (topMesh) {
        const oldBbox = new T.Box3().setFromObject(topMesh);
        const oldSize = oldBbox.getSize(new T.Vector3());
        targetCenter = oldBbox.getCenter(new T.Vector3());
        targetBottom = oldBbox.min.y;
        targetMaxDim = Math.max(oldSize.x, oldSize.y, oldSize.z) || targetMaxDim;
        // Retire l'œuf d'origine du support
        if (topMesh.parent) topMesh.parent.remove(topMesh);
        console.log('[PhoenixForge] 🥚 Egg mesh detached from faberge support:', topMesh.name || '(unnamed)');
      } else {
        console.warn('[PhoenixForge] No top mesh detected in faberge.glb — placing new egg at default position');
      }

      // ─── 2) Re-scale + position du nouvel œuf pour matcher l'ancien ───
      const newBbox = new T.Box3().setFromObject(eggGlb);
      const newSize = newBbox.getSize(new T.Vector3());
      const newCenter = newBbox.getCenter(new T.Vector3());
      const newBottom = newBbox.min.y;
      const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z) || 1;
      const eggScale = targetMaxDim / newMaxDim;
      eggGlb.scale.setScalar(eggScale);
      eggGlb.position.set(
        targetCenter.x - newCenter.x * eggScale,
        targetBottom - newBottom * eggScale,
        targetCenter.z - newCenter.z * eggScale,
      );

      // ─── 3) Combine support + œuf dans un Group ──────────────────────
      const combined = new T.Group();
      combined.add(supportGlb);
      combined.add(eggGlb);
      this.eggTemplate = combined;
      console.log('[PhoenixForge] 🥚 Eggs composed — Faberge support + Atheistic Easter egg loaded');
    } catch (err) {
      console.warn('[PhoenixForge] Failed to load egg GLBs — falling back to procedural eggs', err);
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

    // Scène + fog épais pour ambiance forge
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0d0a14);
    this.scene.fog = new T.FogExp2(0x180a08, 0.028);

    // Caméra : un peu en hauteur pour bien voir l'athanor
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(0, 5, 16);
    this.camera.lookAt(0, 3, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lumière ambiante chaude (rouge sombre forge)
    this.scene.add(new T.AmbientLight(0x4a1a08, 0.45));
    // Hémisphère feu/cendres
    this.scene.add(new T.HemisphereLight(0xea580c, 0x1a0a05, 0.35));

    // Le sol en pierre sombre
    const groundGeom = new T.PlaneGeometry(40, 40, 8, 8);
    const groundMat = new T.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 1.0, metalness: 0.05 });
    const ground = new T.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    this.scene.add(ground);

    // Construction de la forge
    this.buildStoneWalls(T);
    this.buildAthanor(T);
    this.buildPhoenix(T);
    this.buildFlameParticles(T);
    this.buildEggs(T);
    this.buildTorches(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 3, 0);
      this.controls.maxDistance = 40;
      this.controls.minDistance = 3;
    }

    // Raycaster pour interactions (plumes + œufs)
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🌀 PORTAIL vers l'Island Hub (Île de la Livraison)
    const island = getIslandForRoom('/phoenix-forge');
    if (island) {
      this.portal = createPortal3D(T, this.scene, {
        position: [-10, 4, -8],
        targetRoute: island.route,
        islandLabel: island.name,
        color: island.color,
      });
    }

    console.log('[PhoenixForge] 🔥 Forge ready — let the rituals begin');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'phoenix-forge',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : décor de pierre (murs + plafond stalactites placeholder)
  // ═══════════════════════════════════════════════════════════════════
  private buildStoneWalls(T: any) {
    const wallMat = new T.MeshStandardMaterial({ color: 0x2a1d18, roughness: 0.95, metalness: 0.1 });
    const wallH = 12;
    const wallSpan = 30;
    // Mur arrière
    const back = new T.Mesh(new T.BoxGeometry(wallSpan, wallH, 0.5), wallMat);
    back.position.set(0, wallH / 2, -wallSpan / 2);
    this.scene.add(back);
    // Mur gauche
    const left = new T.Mesh(new T.BoxGeometry(0.5, wallH, wallSpan), wallMat);
    left.position.set(-wallSpan / 2, wallH / 2, 0);
    this.scene.add(left);
    // Mur droit
    const right = new T.Mesh(new T.BoxGeometry(0.5, wallH, wallSpan), wallMat);
    right.position.set(wallSpan / 2, wallH / 2, 0);
    this.scene.add(right);
    // Plafond sombre
    const ceiling = new T.Mesh(new T.BoxGeometry(wallSpan, 0.5, wallSpan),
      new T.MeshStandardMaterial({ color: 0x140a08, roughness: 1.0 }));
    ceiling.position.set(0, wallH, 0);
    this.scene.add(ceiling);

    // Mantelpiece (étagère pour les œufs) — devant le mur arrière
    const mantel = new T.Mesh(new T.BoxGeometry(10, 0.3, 1.2),
      new T.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.85 }));
    mantel.position.set(0, 5.5, -wallSpan / 2 + 0.8);
    this.scene.add(mantel);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : athanor (le four central)
  // ═══════════════════════════════════════════════════════════════════
  private buildAthanor(T: any) {
    // Corps en pierre/métal foncé
    const bodyGeom = new T.CylinderGeometry(1.6, 1.9, 3.2, 24, 4);
    const bodyMat = new T.MeshStandardMaterial({
      color: 0x3a2218, roughness: 0.65, metalness: 0.45,
      emissive: 0x1a0a04, emissiveIntensity: 0.4,
    });
    this.athanor = new T.Mesh(bodyGeom, bodyMat);
    this.athanor.position.y = 1.6;
    this.scene.add(this.athanor);

    // Anneau au sommet de l'athanor (où sortent les flammes)
    const rimGeom = new T.TorusGeometry(1.55, 0.18, 12, 32);
    const rimMat = new T.MeshStandardMaterial({
      color: 0xea580c, emissive: 0xea580c, emissiveIntensity: 1.2,
      roughness: 0.3, metalness: 0.8,
    });
    const rim = new T.Mesh(rimGeom, rimMat);
    rim.position.y = 3.2;
    rim.rotation.x = Math.PI / 2;
    rim.userData.tutorialId = 'athanor';
    this.athanor.userData.tutorialId = 'athanor';
    this.scene.add(rim);

    // Disque lumineux pulsant au sommet (la bouche du feu)
    const glowGeom = new T.CircleGeometry(1.45, 32);
    const glowMat = new T.MeshBasicMaterial({
      color: 0xffaa33, transparent: true, opacity: 0.85,
      side: T.DoubleSide,
    });
    this.athanorGlow = new T.Mesh(glowGeom, glowMat);
    this.athanorGlow.position.y = 3.22;
    this.athanorGlow.rotation.x = -Math.PI / 2;
    this.scene.add(this.athanorGlow);

    // Point light au-dessus de l'athanor : c'est elle qui éclaire la pièce
    const fireLight = new T.PointLight(0xff7733, 4.5, 22, 1.5);
    fireLight.position.set(0, 4, 0);
    fireLight.userData.kind = 'forge-light';
    this.scene.add(fireLight);
    this.torchLights.push(fireLight);

    // Base de support (pied de l'athanor)
    const baseGeom = new T.CylinderGeometry(2.3, 2.5, 0.4, 24);
    const baseMat = new T.MeshStandardMaterial({ color: 0x261410, roughness: 0.9 });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.2;
    this.scene.add(base);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : phénix abstrait (corps + ailes étirées + queue)
  // ═══════════════════════════════════════════════════════════════════
  private buildPhoenix(T: any) {
    const goldMat = new T.MeshStandardMaterial({
      color: 0xfacc15, emissive: 0xea580c, emissiveIntensity: 0.8,
      roughness: 0.25, metalness: 0.7,
    });

    this.phoenix = new T.Group();
    this.phoenix.position.set(0, 7.5, 0);
    this.phoenix.userData.tutorialId = 'phoenix';
    this.ritualBaseY = this.phoenix.position.y;

    // ─── Corps : losange étiré (deux cônes dos à dos) ───
    const bodyGeom = new T.ConeGeometry(0.35, 1.2, 8);
    this.phoenixBody = new T.Mesh(bodyGeom, goldMat);
    this.phoenixBody.rotation.x = Math.PI / 2;
    this.phoenix.add(this.phoenixBody);
    // Deuxième cône pour finir la forme (la tête)
    const headCone = new T.Mesh(new T.ConeGeometry(0.32, 0.7, 8), goldMat);
    headCone.position.z = 0.85;
    headCone.rotation.x = -Math.PI / 2;
    this.phoenix.add(headCone);

    // ─── Aile gauche : grand triangle étiré ───
    const wingShape = new T.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.2, 0.3);
    wingShape.lineTo(2.6, -0.05);
    wingShape.lineTo(1.4, -0.4);
    wingShape.lineTo(0, -0.15);
    wingShape.closePath();
    const wingGeom = new T.ShapeGeometry(wingShape);
    this.phoenixWingLeft = new T.Mesh(wingGeom, goldMat);
    this.phoenixWingLeft.rotation.y = -Math.PI / 2;
    this.phoenixWingLeft.rotation.z = 0.15;
    this.phoenixWingLeft.position.set(-0.2, 0.1, 0);
    this.phoenix.add(this.phoenixWingLeft);
    // Aile droite (miroir)
    this.phoenixWingRight = new T.Mesh(wingGeom, goldMat);
    this.phoenixWingRight.rotation.y = Math.PI / 2;
    this.phoenixWingRight.rotation.z = -0.15;
    this.phoenixWingRight.position.set(0.2, 0.1, 0);
    this.phoenix.add(this.phoenixWingRight);

    // ─── Queue : long triangle vers l'arrière ───
    const tailShape = new T.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.4, -1.8);
    tailShape.lineTo(0, -1.5);
    tailShape.lineTo(0.4, -1.8);
    tailShape.closePath();
    const tailGeom = new T.ShapeGeometry(tailShape);
    this.phoenixTail = new T.Mesh(tailGeom, goldMat);
    this.phoenixTail.rotation.x = -Math.PI / 8;
    this.phoenixTail.position.set(0, -0.05, -0.6);
    this.phoenix.add(this.phoenixTail);

    // Lumière dorée portée par le phénix (suit ses mouvements)
    const phoenixLight = new T.PointLight(0xfacc15, 2.2, 12, 1.8);
    phoenixLight.position.set(0, 0, 0);
    this.phoenix.add(phoenixLight);

    this.scene.add(this.phoenix);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : particules de feu (Points geometry) montant dans l'athanor
  // ═══════════════════════════════════════════════════════════════════
  private buildFlameParticles(T: any) {
    const PARTICLE_COUNT = 600;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    this.flameVelocities = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.3;
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 1.6 + Math.random() * 1.6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      // Couleur dégradée rouge → orange → jaune selon vitesse
      const heat = Math.random();
      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 0.3 + heat * 0.6;     // 0.3..0.9
      colors[i * 3 + 2] = heat * 0.3;            // 0..0.3
      this.flameVelocities[i] = 0.04 + Math.random() * 0.09;
    }

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));

    const mat = new T.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: T.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.flameParticles = new T.Points(geom, mat);
    this.scene.add(this.flameParticles);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : œufs sur la mantelpiece (5 sphères allongées)
  // ═══════════════════════════════════════════════════════════════════
  private buildEggs(T: any) {
    // Nettoyer les anciens
    this.eggMeshes.forEach(e => this.scene.remove(e));
    this.eggMeshes = [];
    this.releasesByEgg.clear();

    const releases = this.plannedReleases();
    const count = Math.max(1, releases.length);
    const span = 8;
    const stepX = span / (count + 1);

    // Taille cible de chaque œuf dans la scène (≈ ancien ellipsoïde 0.7 high)
    const TARGET_HEIGHT = 0.9;

    for (let i = 0; i < count; i++) {
      const isLive = releases[i]?.status === 'live' || releases[i]?.status === 'building';
      let egg: any;

      if (this.eggTemplate) {
        // ─── GLB Fabergé : clone profond + tint live ────────────────
        egg = this.eggTemplate.clone(true);
        // Mesure bounding box et rescale pour TARGET_HEIGHT
        const bbox = new T.Box3().setFromObject(egg);
        const size = bbox.getSize(new T.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = TARGET_HEIGHT / maxDim;
        egg.scale.setScalar(scale);
        // Re-centre verticalement : le pivot du GLB n'est pas forcément en bas
        const center = bbox.getCenter(new T.Vector3()).multiplyScalar(scale);
        egg.position.sub(center);
        // Material per-instance (sinon tint affecte tous les œufs)
        egg.traverse((child: any) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            if (isLive) {
              if (child.material.emissive) {
                child.material.emissive = new T.Color(0xfacc15);
                child.material.emissiveIntensity = 0.85;
              }
            }
          }
        });
      } else {
        // ─── Fallback procédural (ellipsoïde) ───────────────────────
        const eggGeom = new T.SphereGeometry(0.35, 24, 18);
        eggGeom.scale(0.85, 1.25, 0.85);
        const eggMat = new T.MeshStandardMaterial({
          color: isLive ? 0xfacc15 : 0xc9b89b,
          emissive: isLive ? 0xfacc15 : 0x261810,
          emissiveIntensity: isLive ? 1.2 : 0.15,
          roughness: 0.4, metalness: 0.5,
        });
        egg = new T.Mesh(eggGeom, eggMat);
      }

      const x = -span / 2 + stepX * (i + 1);
      egg.position.set(x, 6.05, -14.3);
      egg.userData = { kind: 'egg', basePhase: Math.random() * Math.PI * 2, baseY: 6.05, isLive };
      if (i === 0) egg.userData.tutorialId = 'egg';
      this.scene.add(egg);
      this.eggMeshes.push(egg);
      if (releases[i]) this.releasesByEgg.set(egg, releases[i]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : plumes au sol (small quads, color = author tint)
  // ═══════════════════════════════════════════════════════════════════
  private buildFeathers(T: any) {
    this.featherMeshes.forEach(f => this.scene.remove(f));
    this.featherMeshes = [];
    this.commitsByFeather.clear();

    const cmts = this.commits();
    for (let i = 0; i < cmts.length; i++) {
      const c = cmts[i];
      // Petit "quad" représentant une plume : PlaneGeometry posée presque à plat
      const featherGeom = new T.PlaneGeometry(0.42, 0.16);
      const featherMat = new T.MeshStandardMaterial({
        color: c.authorColor,
        emissive: c.authorColor,
        emissiveIntensity: 0.35,
        roughness: 0.55,
        side: T.DoubleSide,
        transparent: true, opacity: 0.92,
      });
      const feather = new T.Mesh(featherGeom, featherMat);
      // Position : éparpillées dans un anneau autour de l'athanor (rayon 3..8)
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 5.5;
      const baseY = 0.06 + Math.random() * 0.04;
      feather.position.set(
        Math.cos(angle) * radius,
        baseY,
        Math.sin(angle) * radius,
      );
      feather.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
      feather.rotation.z = Math.random() * Math.PI * 2;
      feather.userData = {
        kind: 'feather',
        basePos: feather.position.clone(),
        windPhase: Math.random() * Math.PI * 2,
        baseRotZ: feather.rotation.z,
      };
      if (i === 0) feather.userData.tutorialId = 'feather';
      this.scene.add(feather);
      this.featherMeshes.push(feather);
      this.commitsByFeather.set(feather, c);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : cristaux stalactites au plafond (smoke tests)
  // ═══════════════════════════════════════════════════════════════════
  private buildCrystals(T: any) {
    this.crystalMeshes.forEach(c => this.scene.remove(c));
    this.crystalMeshes = [];

    const tests = this.smokeTests();
    const count = Math.max(1, tests.length);
    const span = 7;
    const stepX = span / (count + 1);

    for (let i = 0; i < count; i++) {
      const status = tests[i]?.passed;
      let color = 0x6b6b6b;       // gris par défaut (pending)
      let emissive = 0x1a1a1a;
      if (status === true)  { color = 0x84cc16; emissive = 0x365314; }
      if (status === false) { color = 0xdc2626; emissive = 0x7f1d1d; }

      // Cône pointant vers le bas (stalactite)
      const crystalGeom = new T.ConeGeometry(0.28, 1.4, 6);
      const crystalMat = new T.MeshStandardMaterial({
        color, emissive, emissiveIntensity: 0.7,
        roughness: 0.25, metalness: 0.6,
        transparent: true, opacity: 0.92,
      });
      const crystal = new T.Mesh(crystalGeom, crystalMat);
      const x = -span / 2 + stepX * (i + 1);
      crystal.position.set(x, 10.7, -1.5);
      crystal.rotation.z = Math.PI;     // pointe en bas
      crystal.userData = { kind: 'crystal' };
      if (i === 0) crystal.userData.tutorialId = 'crystal';
      this.scene.add(crystal);
      this.crystalMeshes.push(crystal);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : tas de cendres au pied de l'athanor (releases passées)
  // ═══════════════════════════════════════════════════════════════════
  private buildAshes(T: any) {
    this.ashMeshes.forEach(a => this.scene.remove(a));
    this.ashMeshes = [];

    const past = this.pastReleases();
    for (let i = 0; i < past.length; i++) {
      // Petit dôme bumpy gris (sphère écrasée)
      const ashGeom = new T.SphereGeometry(0.55, 12, 8);
      ashGeom.scale(1.2, 0.35, 1.2);
      const ashMat = new T.MeshStandardMaterial({
        color: 0x4a4441, roughness: 0.98, metalness: 0.02,
        emissive: 0x2a1408, emissiveIntensity: 0.15,
      });
      const ash = new T.Mesh(ashGeom, ashMat);
      // Position : éparpillés autour de la base de l'athanor
      const angle = (i / past.length) * Math.PI * 2 + 0.3;
      const r = 2.6 + (i % 2) * 0.6;
      ash.position.set(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);
      ash.userData = { kind: 'ash', version: past[i].version };
      if (i === 0) ash.userData.tutorialId = 'ash';
      this.scene.add(ash);
      this.ashMeshes.push(ash);

      // Petite braise rougeoyante au sommet (flickering point light)
      const ember = new T.PointLight(0xff5522, 0.4, 1.5, 2.0);
      ember.position.copy(ash.position);
      ember.position.y += 0.2;
      ember.userData = { kind: 'ember', phase: Math.random() * Math.PI * 2 };
      this.scene.add(ember);
      this.torchLights.push(ember);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : torches murales (4 coins) — PointLight flickering
  // ═══════════════════════════════════════════════════════════════════
  private buildTorches(T: any) {
    const torchPositions = [
      { x: -12, y: 6, z: -14 },
      { x:  12, y: 6, z: -14 },
      { x: -12, y: 6, z:  10 },
      { x:  12, y: 6, z:  10 },
    ];
    for (const p of torchPositions) {
      // Support de torche : petit cylindre métallique noir
      const holderGeom = new T.CylinderGeometry(0.08, 0.12, 0.4, 8);
      const holderMat = new T.MeshStandardMaterial({ color: 0x141414, roughness: 0.8, metalness: 0.6 });
      const holder = new T.Mesh(holderGeom, holderMat);
      holder.position.set(p.x, p.y, p.z);
      this.scene.add(holder);
      // Petite boule de feu au-dessus
      const flameGeom = new T.SphereGeometry(0.18, 8, 6);
      const flameMat = new T.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.95 });
      const flame = new T.Mesh(flameGeom, flameMat);
      flame.position.set(p.x, p.y + 0.3, p.z);
      this.scene.add(flame);
      // Lumière chaude flickering
      const torch = new T.PointLight(0xff8833, 1.6, 12, 1.5);
      torch.position.set(p.x, p.y + 0.35, p.z);
      torch.userData = { kind: 'torch', phase: Math.random() * Math.PI * 2, base: 1.6, flame };
      this.scene.add(torch);
      this.torchLights.push(torch);
    }
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
    this.narrator.startTimeboxOnly(1800, 'Release ritual');
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const now = Date.now();
    const day = 86400000;

    // 5 releases planifiées (œufs)
    const plans: PlannedRelease[] = [
      { version: 'v1.4.0', semverKind: 'minor', plannedFor: new Date(now + 7 * day),  status: 'building', ticketCount: 12 },
      { version: 'v1.5.0', semverKind: 'minor', plannedFor: new Date(now + 21 * day), status: 'planned',  ticketCount: 18 },
      { version: 'v1.6.0', semverKind: 'minor', plannedFor: new Date(now + 35 * day), status: 'planned',  ticketCount: 9  },
      { version: 'v1.7.0', semverKind: 'minor', plannedFor: new Date(now + 60 * day), status: 'planned',  ticketCount: 22 },
      { version: 'v2.0.0', semverKind: 'major', plannedFor: new Date(now + 95 * day), status: 'planned',  ticketCount: 47 },
    ];
    this.plannedReleases.set(plans);

    // 30 commits (plumes)
    const authors = [
      { name: 'Ramzy', color: '#fdba74' },
      { name: 'Alice', color: '#fbbf24' },
      { name: 'Bob',   color: '#fb7185' },
      { name: 'Maya',  color: '#c084fc' },
      { name: 'Yves',  color: '#60a5fa' },
    ];
    const messages = [
      'feat: athanor flame particles',
      'fix: phoenix wing flap timing',
      'refactor: extract egg builder',
      'docs: update CHANGELOG',
      'test: smoke tests release v1.4',
      'style: warm orange palette',
      'perf: reduce particle count',
      'chore: bump three.js to r128',
      'feat: ceremony flash overlay',
      'fix: torch flicker drift',
    ];
    const commits: ForgeCommit[] = [];
    for (let i = 0; i < 30; i++) {
      const a = authors[i % authors.length];
      commits.push({
        sha: this.fakeSha('commit-' + i),
        author: a.name,
        message: messages[i % messages.length],
        timestamp: now - i * 2.5 * 3600000,
        authorColor: a.color,
      });
    }
    this.commits.set(commits);

    // 5 smoke tests (cristaux)
    const tests: SmokeTest[] = [
      { suite: 'auth-flow',     passed: true,  durationMs: 4200 },
      { suite: 'pos-crud',      passed: true,  durationMs: 6800 },
      { suite: 'extensions',    passed: false, durationMs: 3100 },
      { suite: 'orrery-render', passed: true,  durationMs: 9200 },
      { suite: 'phoenix-forge', passed: null,  durationMs: 0    },
    ];
    this.smokeTests.set(tests);

    // 3 past releases (cendres)
    const past: PastRelease[] = [
      { version: 'v1.3.2', deployedAt: new Date(now - 5 * day),  semverKind: 'patch' },
      { version: 'v1.3.1', deployedAt: new Date(now - 12 * day), semverKind: 'patch' },
      { version: 'v1.3.0', deployedAt: new Date(now - 30 * day), semverKind: 'minor' },
    ];
    this.pastReleases.set(past);

    const T = (window as any).THREE;
    if (T) {
      this.buildEggs(T);
      this.buildFeathers(T);
      this.buildCrystals(T);
      this.buildAshes(T);
    }

    this.emitCeremony({ type: 'renaissance', label: 'Forge chargée · 5 œufs en gestation', icon: '🔥' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES + RITUELS
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('phoenix-forge', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  // 🐦 Le phénix plonge dans l'athanor, explosion de particules dorées
  triggerReleaseRitual() {
    if (this.ritualPhase > 0) return; // déjà en cours
    this.ritualPhase = 2.4;            // durée totale du rituel (s)
    this.spawnGoldenBurst((window as any).THREE);
    this.emitCeremony({ type: 'renaissance', label: '🐦 Renaissance · v1.4.0 publiée', icon: '🐦' });

    // Marquer la première release planifiée comme live
    const plans = [...this.plannedReleases()];
    if (plans.length > 0) {
      plans[0] = { ...plans[0], status: 'live' };
      this.plannedReleases.set(plans);
      this.buildEggs((window as any).THREE);
    }
  }

  triggerHotfix() {
    if (this.ritualPhase > 0) return;
    this.ritualPhase = 1.6;
    this.spawnGoldenBurst((window as any).THREE, 0xdc2626);
    this.emitCeremony({ type: 'siren', label: '🚨 Hotfix express en cours', icon: '🚨' });
  }

  rollbackLast() {
    const past = this.pastReleases();
    if (past.length === 0) return;
    this.emitCeremony({ type: 'death', label: `💀 Rollback vers ${past[0].version}`, icon: '💀' });
  }

  // 🌟 Comète (major) — déclenché automatiquement si la prochaine release est major
  triggerComet() {
    this.emitCeremony({ type: 'comet', label: '🌟 Comète · v2.0.0 majeure', icon: '🌟' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS (invoqués par playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════════

  /** 🪶 Toutes les plumes (commits) convergent vers l'athanor en arc */
  feathersConverge() {
    const now = performance.now();
    for (const f of this.featherMeshes) {
      f.userData.convergeStart = now;
      f.userData.convergeFrom = { x: f.position.x, y: f.position.y, z: f.position.z };
      f.userData.convergeDur = 1800 + Math.random() * 800;
    }
    this.emitCeremony({ type: 'renaissance', label: '🪶 Plumes convergent · Build agrège les commits', icon: '🪶' });
  }

  /** 🔥 ATHANOR BUILD — augmente l'intensité de la lumière de la forge */
  dawnBuild() {
    if (this.torchLights.length > 0) {
      const fireLight = this.torchLights[0]; // forge-light is first
      if (fireLight.userData?.kind === 'forge-light') {
        fireLight.userData.boostUntil = performance.now() + 5000;
      }
    }
    if (this.athanorGlow) {
      this.athanorGlow.userData.intensify = performance.now() + 5000;
    }
    this.emitCeremony({ type: 'renaissance', label: '🔥 Build pipeline · Athanor s\'embrase', icon: '🔨' });
  }

  /** 💎 SMOKE TESTS PASS — illumine les cristaux en vert un par un */
  crystalAuditPass() {
    const T = (window as any).THREE;
    const crystals = this.crystalMeshes.slice();
    crystals.forEach((c, idx) => {
      setTimeout(() => {
        const mat = c.material;
        const isLast = idx === crystals.length - 1;
        if (isLast) {
          // Dernier reste rouge pour montrer un fail
          mat.color = new T.Color(0xdc2626);
          mat.emissive = new T.Color(0x7f1d1d);
          mat.emissiveIntensity = 1.5;
          this.emitCeremony({ type: 'death', label: '💔 Smoke test failed · phoenix-forge suite', icon: '💔' });
        } else {
          mat.color = new T.Color(0x84cc16);
          mat.emissive = new T.Color(0x365314);
          mat.emissiveIntensity = 1.4;
        }
      }, idx * 600);
    });
  }

  /** 🥚 EGG CRACK — premier œuf (live) cliqnote avec pulse de scale */
  eggCrack() {
    if (this.eggMeshes.length === 0) return;
    const T = (window as any).THREE;
    const egg = this.eggMeshes[0];
    // Pulse scale + emissive boost
    let count = 0;
    const it = setInterval(() => {
      const t = count / 12;
      egg.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.6);
      if (egg.material) {
        egg.material.emissiveIntensity = 1.5 + Math.sin(t * Math.PI * 2) * 1.5;
        egg.material.color = new T.Color(0xffd700);
      }
      count++;
      if (count >= 12) {
        clearInterval(it);
        egg.scale.set(1, 1, 1);
      }
    }, 100);
    this.emitCeremony({ type: 'renaissance', label: '🥚 Œuf doré · v1.4.0 prête à éclore', icon: '🥚' });
  }

  /** 🌫 EMBER DRIFT — embers visibles dans la pièce (atmosphère retrospective) */
  emberDrift() {
    const T = (window as any).THREE;
    // Spawn embers floating up
    const count = 80;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = 1.5 + Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      velocities[i] = 0.01 + Math.random() * 0.02;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xff7700, size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: T.AdditiveBlending });
    const embers = new T.Points(geom, mat);
    embers.userData = { kind: 'ember-drift', velocities, ttl: 6, age: 0 };
    this.scene.add(embers);
    if (!this.driftingEmbers) this.driftingEmbers = [];
    this.driftingEmbers.push(embers);
    this.emitCeremony({ type: 'renaissance', label: '🌫 Cendres tournoient · Retrospective', icon: '🌫' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PARTICULES DORÉES (burst lors du rituel)
  // ═══════════════════════════════════════════════════════════════════
  private spawnGoldenBurst(T: any, colorOverride?: number) {
    if (this.burstParticles) {
      this.scene.remove(this.burstParticles);
      this.burstParticles.geometry.dispose();
      this.burstParticles.material.dispose();
    }
    const BURST_COUNT = 250;
    const positions = new Float32Array(BURST_COUNT * 3);
    const colors = new Float32Array(BURST_COUNT * 3);
    this.burstVelocities = new Float32Array(BURST_COUNT * 3);

    const baseColor = colorOverride ?? 0xfacc15;
    const baseR = ((baseColor >> 16) & 0xff) / 255;
    const baseG = ((baseColor >> 8) & 0xff) / 255;
    const baseB = (baseColor & 0xff) / 255;

    for (let i = 0; i < BURST_COUNT; i++) {
      // Partent de l'athanor (centre, hauteur 3.5)
      positions[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = 3.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      // Vélocités explosives dans toutes directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.04 + Math.random() * 0.18;
      this.burstVelocities[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      this.burstVelocities[i * 3 + 1] = Math.cos(phi) * speed + 0.05;
      this.burstVelocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      // Couleur dorée variable
      const tint = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 0] = baseR * tint;
      colors[i * 3 + 1] = baseG * tint;
      colors[i * 3 + 2] = baseB * tint;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.32, vertexColors: true, transparent: true, opacity: 1.0,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.burstParticles = new T.Points(geom, mat);
    this.scene.add(this.burstParticles);
    this.burstLife = 2.0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic plume → commit, clic œuf → release
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

    // D'abord les œufs (priorité)
    const eggHits = this.raycaster.intersectObjects(this.eggMeshes, false);
    if (eggHits.length > 0) {
      const release = this.releasesByEgg.get(eggHits[0].object);
      if (release) {
        this.selectedRelease.set(release);
        this.selectedCommit.set(null);
        eggHits[0].object.scale.set(1.25, 1.25, 1.25);
        setTimeout(() => eggHits[0].object.scale.set(1, 1, 1), 220);
      }
      return;
    }
    // Puis les plumes
    const featherHits = this.raycaster.intersectObjects(this.featherMeshes, false);
    if (featherHits.length > 0) {
      const commit = this.commitsByFeather.get(featherHits[0].object);
      if (commit) {
        this.selectedCommit.set(commit);
        this.selectedRelease.set(null);
        featherHits[0].object.scale.set(1.8, 1.8, 1.8);
        setTimeout(() => featherHits[0].object.scale.set(1, 1, 1), 220);
      }
      return;
    }
    // Puis les cendres (rollback)
    const ashHits = this.raycaster.intersectObjects(this.ashMeshes, false);
    if (ashHits.length > 0) {
      const v = ashHits[0].object.userData?.version;
      if (v) this.emitCeremony({ type: 'death', label: `💀 Rollback vers ${v}`, icon: '💀' });
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
    this.wingFlapPhase += dt;

    // ─── Flammes : montent + recycle vers le bas ───
    if (this.flameParticles) {
      const positions = this.flameParticles.geometry.attributes.position.array as Float32Array;
      const colors = this.flameParticles.geometry.attributes.color.array as Float32Array;
      for (let i = 0; i < this.flameVelocities.length; i++) {
        const idx = i * 3;
        positions[idx + 1] += this.flameVelocities[i];
        // Léger swirl horizontal
        positions[idx + 0] += Math.sin(this.elapsed * 2 + i * 0.1) * 0.003;
        positions[idx + 2] += Math.cos(this.elapsed * 2.3 + i * 0.13) * 0.003;
        // Recycle quand trop haut
        if (positions[idx + 1] > 5.5) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 1.3;
          positions[idx + 0] = Math.cos(angle) * radius;
          positions[idx + 1] = 1.7;
          positions[idx + 2] = Math.sin(angle) * radius;
          // Refresh la couleur (chaud en bas)
          const heat = Math.random();
          colors[idx + 0] = 1.0;
          colors[idx + 1] = 0.3 + heat * 0.6;
          colors[idx + 2] = heat * 0.3;
        }
      }
      this.flameParticles.geometry.attributes.position.needsUpdate = true;
      this.flameParticles.geometry.attributes.color.needsUpdate = true;
    }

    // ─── Disque lumineux au sommet de l'athanor : pulse ───
    if (this.athanorGlow) {
      const pulse = 0.7 + Math.sin(this.elapsed * 3.5) * 0.2;
      this.athanorGlow.material.opacity = pulse;
      const scale = 1 + Math.sin(this.elapsed * 4) * 0.08;
      this.athanorGlow.scale.set(scale, scale, 1);
    }

    // ─── Phénix : bobbing + rotation lente + battements d'ailes occasionnels ───
    if (this.phoenix) {
      // Bobbing vertical
      this.phoenix.position.y = this.ritualBaseY + Math.sin(this.elapsed * 1.1) * 0.3;
      // Rotation lente autour de l'axe Y
      this.phoenix.rotation.y += dt * 0.35;
      // Battement d'ailes : Y scale oscillation (battement plus marqué toutes les ~3s)
      const flap = 0.6 + Math.abs(Math.sin(this.wingFlapPhase * 1.8)) * 0.5;
      const flapY = 1.0 + Math.sin(this.wingFlapPhase * 2.5) * 0.25;
      if (this.phoenixWingLeft)  { this.phoenixWingLeft.scale.y = flapY; this.phoenixWingLeft.scale.x = flap; }
      if (this.phoenixWingRight) { this.phoenixWingRight.scale.y = flapY; this.phoenixWingRight.scale.x = flap; }
      // Queue ondule
      if (this.phoenixTail) {
        this.phoenixTail.rotation.z = Math.sin(this.elapsed * 1.5) * 0.15;
      }

      // ─── Rituel en cours : plonger dans l'athanor puis remonter ───
      if (this.ritualPhase > 0) {
        const t = 1 - (this.ritualPhase / 2.4);   // 0 → 1
        if (t < 0.45) {
          // Descente vers le four
          this.phoenix.position.y = this.ritualBaseY - (this.ritualBaseY - 3.3) * (t / 0.45);
          this.phoenix.scale.setScalar(1 - t * 0.4);
        } else if (t < 0.55) {
          // Disparition au cœur du feu
          this.phoenix.scale.setScalar(0.05);
          this.phoenix.position.y = 3.3;
        } else {
          // Renaissance : remontée avec spike de scale
          const u = (t - 0.55) / 0.45;
          this.phoenix.position.y = 3.3 + (this.ritualBaseY - 3.3) * u;
          const spike = 1 + Math.sin(u * Math.PI) * 0.5;
          this.phoenix.scale.setScalar(spike);
        }
        this.ritualPhase -= dt;
        if (this.ritualPhase <= 0) {
          this.phoenix.scale.setScalar(1);
          this.phoenix.position.y = this.ritualBaseY;
        }
      }
    }

    // ─── Œufs : bobbing subtil + glow pulsant si live ───
    for (const egg of this.eggMeshes) {
      const phase = egg.userData.basePhase || 0;
      egg.position.y = (egg.userData.baseY ?? 6.05) + Math.sin(this.elapsed * 1.4 + phase) * 0.04;
      egg.rotation.z = Math.sin(this.elapsed * 0.8 + phase) * 0.05;
      // Si live, glow pulse — supporte Mesh (fallback) ET Group (GLB Fabergé/Easter)
      const pulse = 1.0 + Math.sin(this.elapsed * 4) * 0.4;
      if (egg.material) {
        // Cas Mesh : matériau direct
        if (egg.material.emissiveIntensity > 0.5) {
          egg.material.emissiveIntensity = pulse;
        }
      } else if (egg.userData.isLive) {
        // Cas Group GLB : traverser et booster tous les enfants Mesh
        egg.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissiveIntensity > 0.3) {
            child.material.emissiveIntensity = pulse;
          }
        });
      }
    }

    // ─── Plumes : vent oscillation Y + drift X (sauf si convergence en cours) ───
    const nowMs = performance.now();
    for (const feather of this.featherMeshes) {
      // Mode convergence (feathersConverge) : interpoler vers l'athanor
      if (feather.userData.convergeStart) {
        const start = feather.userData.convergeStart;
        const dur = feather.userData.convergeDur || 2000;
        const elapsed = nowMs - start;
        const t = Math.min(1, elapsed / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const from = feather.userData.convergeFrom;
        const targetY = 3.3;
        const arcPeak = Math.max(from.y, targetY) + 2.5;
        const yLerp = from.y + (targetY - from.y) * e;
        const arc = (arcPeak - Math.max(from.y, targetY)) * (4 * t * (1 - t));
        feather.position.set(
          from.x + (0 - from.x) * e,
          yLerp + arc,
          from.z + (0 - from.z) * e,
        );
        feather.rotation.z += dt * 8; // spin pendant le vol
        if (feather.material) feather.material.opacity = Math.max(0.05, 0.92 - t * 0.7);
        if (t >= 1) {
          // Quand arrivé : fade out + reset basePos
          feather.visible = false;
          delete feather.userData.convergeStart;
        }
        continue;
      }
      const phase = feather.userData.windPhase || 0;
      const base = feather.userData.basePos;
      if (base) {
        feather.position.y = base.y + Math.abs(Math.sin(this.elapsed * 1.5 + phase)) * 0.25;
        feather.position.x = base.x + Math.sin(this.elapsed * 0.8 + phase) * 0.12;
        feather.rotation.z = feather.userData.baseRotZ + Math.sin(this.elapsed * 1.3 + phase) * 0.3;
      }
    }

    // ─── Cristaux : subtle rotation + glow ───
    for (const c of this.crystalMeshes) {
      c.rotation.y += dt * 0.4;
    }

    // ─── Torches & embers : flickering ───
    for (const light of this.torchLights) {
      const ud = light.userData;
      if (ud?.kind === 'torch') {
        const flicker = ud.base + Math.sin(this.elapsed * 8 + ud.phase) * 0.4 + Math.random() * 0.2 - 0.1;
        light.intensity = Math.max(0.3, flicker);
        if (ud.flame) {
          ud.flame.scale.setScalar(0.85 + Math.random() * 0.3);
        }
      } else if (ud?.kind === 'ember') {
        light.intensity = 0.3 + Math.sin(this.elapsed * 6 + ud.phase) * 0.2 + Math.random() * 0.15;
      } else if (ud?.kind === 'forge-light') {
        const boost = (ud.boostUntil && nowMs < ud.boostUntil) ? 3.0 : 0;
        light.intensity = 3.8 + boost + Math.sin(this.elapsed * 5) * 0.7;
      }
    }

    // ─── Athanor glow boost (dawnBuild) ───
    if (this.athanorGlow?.userData?.intensify && nowMs < this.athanorGlow.userData.intensify) {
      this.athanorGlow.material.opacity = Math.min(1.0, this.athanorGlow.material.opacity + 0.05);
      const scale = 1.4 + Math.sin(this.elapsed * 5) * 0.15;
      this.athanorGlow.scale.set(scale, scale, 1);
    }

    // ─── Drifting embers (emberDrift) — montent + recycle/dispose ───
    if (this.driftingEmbers.length > 0) {
      const doneIdx: number[] = [];
      for (let ei = 0; ei < this.driftingEmbers.length; ei++) {
        const e = this.driftingEmbers[ei];
        e.userData.age += dt;
        const pos = e.geometry.attributes.position;
        const vels = e.userData.velocities;
        for (let i = 0; i < pos.count; i++) {
          pos.array[i * 3 + 1] += vels[i];
          pos.array[i * 3 + 0] += Math.sin(this.elapsed * 1.5 + i * 0.1) * 0.005;
          pos.array[i * 3 + 2] += Math.cos(this.elapsed * 1.7 + i * 0.12) * 0.005;
          if (pos.array[i * 3 + 1] > 10) pos.array[i * 3 + 1] = 1.5;
        }
        pos.needsUpdate = true;
        e.material.opacity = Math.max(0, 0.9 * (1 - e.userData.age / e.userData.ttl));
        if (e.userData.age >= e.userData.ttl) doneIdx.push(ei);
      }
      for (let i = doneIdx.length - 1; i >= 0; i--) {
        const e = this.driftingEmbers[doneIdx[i]];
        this.scene.remove(e);
        e.geometry?.dispose();
        e.material?.dispose();
        this.driftingEmbers.splice(doneIdx[i], 1);
      }
    }

    // ─── Burst doré (rituel) : update positions + fade ───
    if (this.burstParticles && this.burstLife > 0) {
      const positions = this.burstParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < this.burstVelocities.length / 3; i++) {
        positions[i * 3 + 0] += this.burstVelocities[i * 3 + 0];
        positions[i * 3 + 1] += this.burstVelocities[i * 3 + 1];
        positions[i * 3 + 2] += this.burstVelocities[i * 3 + 2];
        // Gravité légère
        this.burstVelocities[i * 3 + 1] -= 0.0015;
      }
      this.burstParticles.geometry.attributes.position.needsUpdate = true;
      this.burstLife -= dt;
      this.burstParticles.material.opacity = Math.max(0, this.burstLife / 2.0);
      if (this.burstLife <= 0) {
        this.scene.remove(this.burstParticles);
        this.burstParticles.geometry.dispose();
        this.burstParticles.material.dispose();
        this.burstParticles = null;
      }
    }

    // 🌀 Portail tick
    if (this.portal) {
      this.portal.tick(dt, this.elapsed);
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // CAM / UTILS
  // ═══════════════════════════════════════════════════════════════════
  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 5, 16);
    this.camera.lookAt(0, 3, 0);
    if (this.controls) this.controls.target.set(0, 3, 0);
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
