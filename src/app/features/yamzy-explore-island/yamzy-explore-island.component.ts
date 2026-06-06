// ════════════════════════════════════════════════════════════════════════
// 🏝 YAMZY EXPLORE ISLAND — mode walkable au clavier (port du dashboard-beta)
//
// Le code de marche/clavier/caméra/wall-fade est UN PORT DIRECT du
// `dashboard-beta.component.ts` (méthodes lib*). Voir cette source pour la
// référence d'origine. La seule différence : ce composant est standalone et
// charge en priorité le GLB sauvegardé via /world-map/edit/yamzy (IndexedDB).
//
// Contrôles : Z/W/↑ avance · S/↓ recule · Q/A/← tourne gauche · D/→ tourne droite
// ════════════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { loadZoneGlb } from '../world-map/world-map.storage';

@Component({
  selector: 'wt-yamzy-explore-island',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="db-library-overlay">
      <canvas #libCanvas class="db-library-canvas"></canvas>
      <div class="db-library-header">
        <div class="db-library-title">
          <span class="db-library-icon">🏝</span>
          <span class="db-library-name">{{ sceneTitle() }}</span>
        </div>
        <div class="db-library-actions">
          <button class="db-library-btn db-library-btn-close" (click)="closeLibrary()">✕</button>
        </div>
      </div>
      <div class="db-library-hint">
        🖱 <b>Drag</b> caméra · 🛞 <b>Molette</b> zoom · <b>Ctrl+Molette</b> avance · ⌨ <b>Z/Q/S/D</b> · 🖱 <b>Click</b> téléporte
      </div>

      <aside class="db-side-panel">
        <div class="db-side-section">
          <div class="db-side-label">💾 Position spawn</div>
          <button class="db-side-btn db-side-btn-ok" (click)="saveDefault()">💾 Sauver position par défaut</button>
          <button class="db-side-btn" (click)="resetSpawn()">🔄 Reset spawn (origine)</button>
        </div>

        <div class="db-side-section">
          <div class="db-side-label">📏 Taille avatar vs île</div>
          <div class="db-side-scale-row">
            <button class="db-side-btn db-side-btn-step" (click)="bumpScale(-1)">−</button>
            <span class="db-side-scale-val">{{ avatarScaleSig().toFixed(3) }}×</span>
            <button class="db-side-btn db-side-btn-step" (click)="bumpScale(1)">+</button>
          </div>
          <button class="db-side-btn" (click)="resetScale()">Reset taille</button>
        </div>

        <div class="db-side-flash" *ngIf="savedFlash()">{{ savedFlash() }}</div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
    /* ═══ Library 3D overlay (port dashboard-beta) ═══ */
    .db-library-overlay {
      position: fixed; inset: 0;
      z-index: 9998;
      background: #050b1f;
      animation: db-lib-fade 0.4s ease;
    }
    @keyframes db-lib-fade { from { opacity: 0; } to { opacity: 1; } }
    .db-library-canvas {
      position: absolute; inset: 0;
      width: 100% !important; height: 100% !important;
      display: block;
      cursor: grab;
    }
    .db-library-canvas:active { cursor: grabbing; }

    .db-library-header {
      position: fixed; top: 18px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 18px;
      padding: 12px 24px;
      background: rgba(8,4,28,0.92);
      border: 2px solid rgba(253,224,71,0.55);
      border-radius: 50px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.6),
                  0 0 30px rgba(253,224,71,0.25);
      z-index: 10;
    }
    .db-library-title { display: flex; align-items: center; gap: 10px; }
    .db-library-icon {
      font-size: 26px;
      filter: drop-shadow(0 0 8px rgba(253,224,71,0.6));
    }
    .db-library-name {
      font-family: 'Henny Penny', 'Pirata One', serif;
      font-size: 22px;
      letter-spacing: 0.08em;
      color: #fde047;
      text-shadow: 0 0 10px rgba(253,224,71,0.5);
    }
    .db-library-actions {
      display: flex; gap: 8px;
      padding-left: 18px;
      border-left: 2px solid rgba(167,139,250,0.4);
    }
    .db-library-btn {
      padding: 8px 16px;
      background: rgba(102,126,234,0.3);
      border: 2px solid #667eea;
      color: white;
      border-radius: 22px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.04em;
      transition: all 0.2s;
    }
    .db-library-btn:hover {
      background: rgba(102,126,234,0.6);
      transform: translateY(-1px);
    }
    .db-library-btn-close {
      background: rgba(244,63,94,0.3);
      border-color: #f43f5e;
      padding: 8px 14px;
      font-size: 16px;
    }
    .db-library-btn-close:hover { background: rgba(244,63,94,0.6); }

    .db-library-hint {
      position: fixed; bottom: 30px; left: 50%;
      transform: translateX(-50%);
      padding: 8px 18px;
      background: rgba(20,25,45,0.78);
      border: 1px solid rgba(167,139,250,0.4);
      border-radius: 18px;
      font-size: 12px;
      color: #c4b5fd;
      letter-spacing: 0.05em;
      z-index: 10;
      pointer-events: none;
      backdrop-filter: blur(6px);
    }
    .db-library-hint b {
      color: #fde047;
      font-weight: 800;
      padding: 0 2px;
    }
    /* ═══ Side panel : Save spawn + scale ═══ */
    .db-side-panel {
      position: fixed;
      top: 90px; right: 20px;
      z-index: 11;
      display: flex; flex-direction: column;
      gap: 14px;
      padding: 14px;
      background: rgba(8,4,28,0.85);
      border: 1.5px solid rgba(167,139,250,0.45);
      border-radius: 12px;
      backdrop-filter: blur(8px);
      min-width: 220px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.5);
    }
    .db-side-section { display: flex; flex-direction: column; gap: 6px; }
    .db-side-label {
      font-family: 'Henny Penny', cursive;
      font-size: 12px;
      letter-spacing: 0.1em;
      color: #c4b5fd;
      text-transform: uppercase;
    }
    .db-side-btn {
      background: rgba(0,0,0,0.45);
      border: 1px solid rgba(167,139,250,0.45);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      transition: background 0.15s, transform 0.1s;
    }
    .db-side-btn:hover { background: rgba(167,139,250,0.18); }
    .db-side-btn:active { transform: scale(0.97); }
    .db-side-btn-ok { border-color: rgba(134,239,172,0.6); }
    .db-side-btn-ok:hover { background: rgba(134,239,172,0.18); }
    .db-side-scale-row {
      display: flex; align-items: center; gap: 6px;
    }
    .db-side-btn-step {
      flex: 0 0 36px;
      font-size: 16px; font-weight: 800;
      padding: 4px 0;
    }
    .db-side-scale-val {
      flex: 1; text-align: center;
      font-family: monospace; font-size: 13px;
      color: #fde047;
    }
    .db-side-flash {
      font-size: 11px;
      color: #86efac;
      padding: 6px;
      background: rgba(134,239,172,0.1);
      border-radius: 4px;
      text-align: center;
      animation: db-flash-fade 1.6s ease;
    }
    @keyframes db-flash-fade {
      0% { opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
  `],
})
export class YamzyExploreIslandComponent implements OnInit, OnDestroy {
  @ViewChild('libCanvas', { static: true }) libCanvasRef!: ElementRef<HTMLCanvasElement>;
  private router = inject(Router);

  sceneTitle = signal<string>('YAMZY ISLAND');
  /** Taille de l'avatar — exposée à l'UI pour ajustement live (+/-). */
  avatarScaleSig = signal<number>(0.075);
  /** Feedback visuel court (sauve / scale). */
  savedFlash = signal<string>('');

  // ═══════════════════════════════════════════════════════════════════
  // PORT DASHBOARD-BETA — tous les champs lib* (cf. dashboard-beta.component.ts)
  // ═══════════════════════════════════════════════════════════════════
  private libRenderer?: any;
  private libScene?: any;
  private libCamera?: any;
  private libControls?: any;
  private libModel?: any;
  private libClock?: any;
  private libAnimFrame?: number;
  // ─── Avatar YAMZY contrôlable au clavier ───
  private libAvatar?: any;
  private libAvatarMixer?: any;
  private libIdleAction?: any;
  private libWalkAction?: any;
  private libCurrentAnim: 'idle' | 'walk' = 'idle';
  private libKeys: Record<string, boolean> = {};
  private libKeyDown?: (e: KeyboardEvent) => void;
  private libKeyUp?: (e: KeyboardEvent) => void;
  private libResize?: () => void;
  private libAvatarYaw = 0;
  private readonly LIB_WALK_SPEED = 5.5;
  private readonly LIB_TURN_SPEED = 2.6;
  // ─── Caméra contrôlée à la souris (drag) — décorrélée du yaw avatar ───
  private camYaw = 0;             // orbite horizontale (drag X)
  private camPitchOffset = 0;     // tweak vertical (drag Y) — range [-0.4, 0.4]
  private libAvatarFeetOffset = 0;
  private libFadedMaterials: Map<any, { originalOpacity: number; originalTransparent: boolean }> = new Map();

  // ─── Zoom molette + téléportation clic (extensions au port dashboard-beta) ───
  private camZoomMul = 1.0;                       // multiplicateur distance caméra (wheel)
  // 🔍 Plage très large : ZOOM_MIN bas pour vraiment se coller à l'avatar, ZOOM_MAX 100 pour voir tout le plan
  private static readonly ZOOM_MIN = 0.05;
  private static readonly ZOOM_MAX = 100.0;
  private static readonly ZOOM_STEP = 1.20;       // 20% par cran de molette
  private libWheel?: (e: WheelEvent) => void;
  private libClick?: (e: MouseEvent) => void;
  // Détecte click vs drag pour éviter de téléporter en plein orbit
  private mouseDownX = 0;
  private mouseDownY = 0;
  private mouseMoved = false;
  private libMouseDown?: (e: MouseEvent) => void;
  private libMouseMove?: (e: MouseEvent) => void;
  /** localStorage key — sauvegarde la position de l'avatar entre refreshes. */
  private static readonly SPAWN_STORAGE_KEY = 'yamzy.explore.yamzy.spawn';
  private static readonly SCALE_STORAGE_KEY = 'yamzy.explore.yamzy.avatarScale';
  private static readonly DEFAULT_AVATAR_SCALE = 0.075;

  // Config courante (équivalent walkSceneConfig)
  private walkScene = {
    title: 'YAMZY ISLAND',
    icon: '🏝',
    glb: '/assets/scenes/carnival_island.glb',  // fallback
    libraryScale: 60,
    avatarScale: 0.075,
  };

  ngOnInit(): void {
    // Récupère la taille d'avatar sauvegardée AVANT le bootstrap
    try {
      const s = parseFloat(localStorage.getItem(YamzyExploreIslandComponent.SCALE_STORAGE_KEY) || '');
      if (!isNaN(s) && s > 0) this.avatarScaleSig.set(s);
    } catch {}
    this.bootstrap();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 💾 SAVE / RESET position + scale (boutons UI)
  // ═══════════════════════════════════════════════════════════════════
  saveDefault(): void {
    this.saveAvatarSpawn();
    this.flashSaved(`✓ Position sauvegardée (${this.libAvatar?.position.x.toFixed(1)}, ${this.libAvatar?.position.y.toFixed(1)}, ${this.libAvatar?.position.z.toFixed(1)})`);
  }
  resetSpawn(): void {
    try { localStorage.removeItem(YamzyExploreIslandComponent.SPAWN_STORAGE_KEY); } catch {}
    if (this.libAvatar) {
      const T = (window as any).THREE;
      const floorY = this.findLibraryFloorY(T, 0, 0);
      this.libAvatar.position.set(0, floorY + this.libAvatarFeetOffset, 0);
      this.libAvatarYaw = Math.PI;
      this.libAvatar.rotation.y = this.libAvatarYaw;
    }
    this.flashSaved('🔄 Spawn réinitialisé à l\'origine');
  }
  bumpScale(direction: -1 | 1): void {
    const cur = this.avatarScaleSig();
    const STEP = 1.15;
    const next = direction > 0 ? cur * STEP : cur / STEP;
    const clamped = Math.max(0.005, Math.min(5.0, next));
    this.avatarScaleSig.set(clamped);
    this.applyAvatarScale();
    this.flashSaved(`📏 Taille avatar : ${clamped.toFixed(3)}×`);
  }
  resetScale(): void {
    this.avatarScaleSig.set(YamzyExploreIslandComponent.DEFAULT_AVATAR_SCALE);
    try { localStorage.removeItem(YamzyExploreIslandComponent.SCALE_STORAGE_KEY); } catch {}
    this.applyAvatarScale();
    this.flashSaved('🔄 Taille avatar réinitialisée');
  }
  private flashSaved(msg: string): void {
    this.savedFlash.set(msg);
    setTimeout(() => this.savedFlash.set(''), 1600);
  }

  private applyAvatarScale(): void {
    if (!this.libAvatar) return;
    const T = (window as any).THREE;
    const scale = this.avatarScaleSig();
    this.libAvatar.scale.set(scale, scale, scale);
    // Recompute feet offset for the new scale (bbox changed)
    const avBox = new T.Box3().setFromObject(this.libAvatar);
    this.libAvatarFeetOffset = -avBox.min.y;
    // ⚡ Sky raycast (depuis Y=200) — marche pour TOUT scale, pas dépendant de position.y
    const floorY = this.findLibraryFloorY(T, this.libAvatar.position.x, this.libAvatar.position.z);
    this.libAvatar.position.y = floorY + this.libAvatarFeetOffset;
    // Persiste
    try { localStorage.setItem(YamzyExploreIslandComponent.SCALE_STORAGE_KEY, String(scale)); } catch {}
    // ⚡ Snap caméra direct (sans lerp) : sinon elle met du temps à rattraper et passe par des positions foireuses
    this.snapCameraToAvatar();
    // ⚡ Reset opacity de tous les meshes fadés (la caméra a téléporté, la liste est obsolète)
    for (const [mat, saved] of this.libFadedMaterials.entries()) {
      mat.opacity = saved.originalOpacity;
      mat.transparent = saved.originalTransparent;
      mat.depthWrite = true;
    }
    this.libFadedMaterials.clear();
    console.log(`[YamzyExplore] 📏 Avatar scale=${scale.toFixed(4)} → feetOffset=${this.libAvatarFeetOffset.toFixed(3)}, y=${this.libAvatar.position.y.toFixed(2)}`);
  }

  /** Place la caméra immédiatement à sa target (utilisé après gros changements). */
  private snapCameraToAvatar(): void {
    if (!this.libAvatar || !this.libCamera) return;
    const avHeight = 6 * this.avatarScaleSig();
    const camDistance = Math.max(1.5, avHeight * 2.5 * this.camZoomMul);
    const camHeight = Math.max(0.5, (avHeight * 1.6 + camDistance * this.camPitchOffset) * this.camZoomMul);
    const offX = -Math.sin(this.camYaw) * camDistance;
    const offZ = -Math.cos(this.camYaw) * camDistance;
    this.libCamera.position.set(
      this.libAvatar.position.x + offX,
      this.libAvatar.position.y + camHeight,
      this.libAvatar.position.z + offZ,
    );
    this.libCamera.lookAt(
      this.libAvatar.position.x,
      this.libAvatar.position.y + 0.6,
      this.libAvatar.position.z,
    );
  }

  ngOnDestroy(): void { this.closeLibrary(); }

  closeLibrary(): void {
    // ⚡ Ne sauvegarde PAS automatiquement : sinon ça écrase la position par défaut
    // (le bouton "💾 Sauver" est la SEULE manière de persister)
    if (this.libAnimFrame) cancelAnimationFrame(this.libAnimFrame);
    this.libAnimFrame = undefined;
    if (this.libRenderer) {
      try { this.libRenderer.dispose(); } catch {}
      this.libRenderer = undefined;
    }
    const canvas = this.libCanvasRef?.nativeElement;
    if (this.libKeyDown) window.removeEventListener('keydown', this.libKeyDown);
    if (this.libKeyUp)   window.removeEventListener('keyup',   this.libKeyUp);
    if (this.libResize)  window.removeEventListener('resize',  this.libResize);
    if (canvas) {
      if (this.libWheel)     canvas.removeEventListener('wheel',     this.libWheel);
      if (this.libMouseDown) canvas.removeEventListener('mousedown', this.libMouseDown);
      if (this.libMouseMove) canvas.removeEventListener('mousemove', this.libMouseMove);
      if (this.libClick)     canvas.removeEventListener('click',     this.libClick);
    }
    this.libKeyDown = undefined;
    this.libKeyUp = undefined;
    this.libResize = undefined;
    this.libWheel = undefined;
    this.libMouseDown = undefined;
    this.libMouseMove = undefined;
    this.libClick = undefined;
    this.libKeys = {};
    if (this.libAvatarMixer) {
      try { this.libAvatarMixer.stopAllAction(); } catch {}
      this.libAvatarMixer = undefined;
    }
    this.libIdleAction = undefined;
    this.libWalkAction = undefined;
    this.libAvatar = undefined;
    this.libScene = undefined;
    this.libCamera = undefined;
    this.libControls = undefined;
    this.libModel = undefined;
    // Quitte vers /world-map
    if (!this.isNavigating) { this.isNavigating = true; window.location.href = '/world-map'; }
  }
  private isNavigating = false;

  // ═══════════════════════════════════════════════════════════════════
  // Bootstrap : sélectionne le GLB (IndexedDB > assets) puis initLibraryScene
  // ═══════════════════════════════════════════════════════════════════
  private async bootstrap(): Promise<void> {
    await this.ensureThree();

    // 1. Tente le GLB IndexedDB sauvegardé par /world-map/edit/yamzy
    let glbUrl: string | null = null;
    try {
      const blob = await loadZoneGlb('yamzy');
      if (blob) {
        glbUrl = URL.createObjectURL(blob);
        this.sceneTitle.set('YAMZY ISLAND (custom)');
        console.log(`[YamzyExplore] ✓ GLB chargé depuis IndexedDB (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    } catch (e) {
      console.warn('[YamzyExplore] Erreur lecture IndexedDB', e);
    }
    // 2. Fallback : island-yamzy.glb statique
    if (!glbUrl) {
      try {
        const head = await fetch('/assets/conclave/models/island-yamzy.glb', { method: 'HEAD' });
        if (head.ok) {
          glbUrl = '/assets/conclave/models/island-yamzy.glb';
          console.log(`[YamzyExplore] ✓ Fallback /assets/conclave/models/island-yamzy.glb`);
        }
      } catch {}
    }
    // 3. Dernier recours : carnival_island
    if (!glbUrl) {
      glbUrl = '/assets/scenes/carnival_island.glb';
      this.sceneTitle.set('CARNIVAL ISLAND (default)');
      console.log(`[YamzyExplore] ⚠ Fallback /assets/scenes/carnival_island.glb`);
    }

    this.walkScene.glb = glbUrl;
    this.initLibraryScene();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📦 PORT — ensureThree + buildLoader (cf. dashboard-beta lignes 6806-6848)
  // ═══════════════════════════════════════════════════════════════════
  private async ensureThree(): Promise<any> {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    if (!(window as any).THREE?.DRACOLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    return (window as any).THREE;
  }
  private loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('script load failed ' + src));
      document.head.appendChild(s);
    });
  }
  private buildLoader(T: any): any {
    const loader = new T.GLTFLoader();
    try {
      if (T.DRACOLoader) {
        const draco = new T.DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(draco);
      }
    } catch (e) {
      console.warn('[YamzyExplore] Draco setup failed (continuing without)', e);
    }
    return loader;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📦 PORT — initLibraryScene (cf. dashboard-beta lignes 9007-9092)
  // ═══════════════════════════════════════════════════════════════════
  private async initLibraryScene(): Promise<void> {
    if (!this.libCanvasRef) { console.warn('[library] canvas ref non prêt'); return; }
    const T = await this.ensureThree();
    if (!T) return;

    const canvas = this.libCanvasRef.nativeElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.libRenderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.libRenderer.setSize(w, h, false);
    this.libRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.libRenderer.setClearColor(0x0a0e27, 1);
    this.libRenderer.outputEncoding = T.sRGBEncoding;
    this.libRenderer.toneMapping = T.ACESFilmicToneMapping;
    this.libRenderer.toneMappingExposure = 1.3;

    this.libScene = new T.Scene();
    // Far plane large pour permettre zoom out extrême (ZOOM_MAX=100 → ~112 units pour scale 60)
    this.libCamera = new T.PerspectiveCamera(50, w / h, 0.1, 2000);
    this.libCamera.position.set(0, 8, 12);
    this.libClock = new T.Clock();

    // ─── Lighting RPG ────
    this.libScene.add(new T.AmbientLight(0xffe4b5, 1.2));
    const sun = new T.DirectionalLight(0xfff0c8, 1.8);
    sun.position.set(8, 12, 6);
    this.libScene.add(sun);
    const hemi = new T.HemisphereLight(0xffd9a0, 0x4a3c2a, 0.8);
    this.libScene.add(hemi);
    const torch1 = new T.PointLight(0xff8844, 2.5, 18);
    torch1.position.set(-5, 3, -5);
    this.libScene.add(torch1);
    const torch2 = new T.PointLight(0x66aaff, 1.8, 18);
    torch2.position.set(5, 3, 5);
    this.libScene.add(torch2);
    const torch3 = new T.PointLight(0xa855f7, 1.5, 16);
    torch3.position.set(-5, 2.5, 5);
    this.libScene.add(torch3);

    if (T.OrbitControls) {
      this.libControls = new T.OrbitControls(this.libCamera, canvas);
      this.libControls.enableDamping = true;
      this.libControls.dampingFactor = 0.08;
      this.libControls.minDistance = 1.5;
      this.libControls.maxDistance = 25;
      this.libControls.target.set(0, 1.5, 0);
      this.libControls.enabled = false;
      this.libControls.update();
    }

    const loader = this.buildLoader(T);
    const cfg = this.walkScene;
    const targetSize = cfg.libraryScale ?? 18;
    loader.load(cfg.glb, (gltf: any) => {
      const m = gltf.scene;
      const box = new T.Box3().setFromObject(m);
      const size = box.getSize(new T.Vector3());
      const center = box.getCenter(new T.Vector3());
      const maxD = Math.max(size.x, size.y, size.z) || 1;
      const scale = targetSize / maxD;
      m.scale.setScalar(scale);
      box.setFromObject(m);
      box.getCenter(center);
      m.position.sub(center);
      m.position.y -= box.min.y - center.y;
      this.libScene.add(m);
      this.libModel = m;
      console.log(`[walkscene] ✓ "${cfg.title}" loaded — scale ${scale.toFixed(3)}, size ${(size.x*scale).toFixed(1)}x${(size.y*scale).toFixed(1)}x${(size.z*scale).toFixed(1)}`);
      this.loadLibraryAvatar(T, loader);
    }, undefined, (err: any) => {
      console.warn('[walkscene] GLB load failed', cfg.glb, err);
      this.loadLibraryAvatar(T, loader);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📦 PORT — loadLibraryAvatar (cf. dashboard-beta lignes 9243-9307)
  // ═══════════════════════════════════════════════════════════════════
  private loadLibraryAvatar(T: any, loader: any): void {
    // ⚡ YAMZY_chez.glb = avatar Chez Yamzy original (dashboard-beta)
    // ≠ YAMZY.glb (patché war-table avec offset baké pour cockpit)
    loader.load('/assets/agents/YAMZY_chez.glb', (gltf: any) => {
      const av = gltf.scene;
      // ⚡ Lit la taille du signal (potentiellement chargée depuis localStorage)
      const avScale = this.avatarScaleSig();
      av.scale.set(avScale, avScale, avScale);
      av.position.set(0, 0, 0);
      av.rotation.y = Math.PI;

      const avBox = new T.Box3().setFromObject(av);
      this.libAvatarFeetOffset = -avBox.min.y;
      const floorY = this.findLibraryFloorY(T, 0, 0);
      av.position.y = floorY + this.libAvatarFeetOffset;
      console.log(`[library] avatar placed at y=${av.position.y.toFixed(2)} (floor=${floorY.toFixed(2)} + feetOffset=${this.libAvatarFeetOffset.toFixed(2)})`);

      this.libScene.add(av);
      this.libAvatar = av;
      this.libAvatarYaw = av.rotation.y;
      // ⚡ Caméra démarre derrière l'avatar (alignée sur son yaw initial)
      this.camYaw = av.rotation.y;
      // ⚡ Restaure la position sauvegardée MAINTENANT (avatar est prêt — le load est async)
      this.restoreAvatarSpawn();
      // ⚡ Snap caméra immédiat sur la transform restaurée (sinon lerp visible)
      this.snapCameraToAvatar();

      if (gltf.animations?.length) {
        this.libAvatarMixer = new T.AnimationMixer(av);
        const clips = gltf.animations;
        const names = clips.map((a: any) => `"${a.name}" (${a.duration.toFixed(1)}s)`).join(', ');
        console.log(`[library] Avatar animations dispo : ${names}`);
        const idleClip = clips.find((c: any) => /idle/i.test(c.name)) || clips[0];
        // Walk regex étendu + fallback : prend n'importe quelle anim ≠ idle
        const walkClip = clips.find((c: any) => /walk|run|move|step|march|loco/i.test(c.name))
                       || clips.find((c: any) => c !== idleClip);
        if (idleClip) {
          this.libIdleAction = this.libAvatarMixer.clipAction(idleClip);
          this.libIdleAction.setLoop(T.LoopRepeat, Infinity);
          this.libIdleAction.setEffectiveWeight(1);
          this.libIdleAction.play();
          console.log(`[library] ▶ idle = "${idleClip.name}"`);
        }
        if (walkClip && walkClip !== idleClip) {
          this.libWalkAction = this.libAvatarMixer.clipAction(walkClip);
          this.libWalkAction.setLoop(T.LoopRepeat, Infinity);
          this.libWalkAction.setEffectiveWeight(0);
          this.libWalkAction.play();
          console.log(`[library] ▶ walk = "${walkClip.name}"`);
        } else {
          console.warn(`[library] ⚠ Pas de clip "walk" séparé trouvé dans YAMZY_chez.glb → idle joué en continu`);
        }
      }
    }, undefined, (err: any) => {
      console.warn('[library] avatar GLB load failed', err);
    });

    this.libKeyDown = (e: KeyboardEvent) => { this.libKeys[e.key.toLowerCase()] = true; };
    this.libKeyUp   = (e: KeyboardEvent) => { this.libKeys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', this.libKeyDown);
    window.addEventListener('keyup',   this.libKeyUp);

    // ─── Wheel : ZOOM par défaut (Ctrl/Shift pour avancer dans l'île) ───
    this.libWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!e.ctrlKey && !e.shiftKey) {
        // Mode zoom (par défaut, comportement naturel)
        const factor = e.deltaY > 0 ? YamzyExploreIslandComponent.ZOOM_STEP : 1 / YamzyExploreIslandComponent.ZOOM_STEP;
        this.camZoomMul = Math.max(
          YamzyExploreIslandComponent.ZOOM_MIN,
          Math.min(YamzyExploreIslandComponent.ZOOM_MAX, this.camZoomMul * factor),
        );
        console.log(`[YamzyExplore] 🛞 zoom=${this.camZoomMul.toFixed(2)}× (camDistance≈${(6 * this.avatarScaleSig() * 2.5 * this.camZoomMul).toFixed(1)} u)`);
        return;
      }
      // Mode déplacement (Ctrl/Shift maintenu) : avance/recule l'avatar dans la dir caméra
      if (!this.libAvatar) return;
      const T = (window as any).THREE;
      const avHeight = 6 * this.avatarScaleSig();
      const stepDist = avHeight * 0.6;
      const sign = e.deltaY > 0 ? -1 : 1;   // wheel up → forward, wheel down → backward
      const dx = sign * stepDist * Math.sin(this.camYaw);
      const dz = sign * stepDist * Math.cos(this.camYaw);
      const newX = this.libAvatar.position.x + dx;
      const newZ = this.libAvatar.position.z + dz;
      const currentY = this.libAvatar.position.y - this.libAvatarFeetOffset;
      const validFloorY = this.isValidWalkPosition(T, newX, newZ, currentY);
      if (validFloorY !== null) {
        this.libAvatar.position.x = newX;
        this.libAvatar.position.z = newZ;
        this.libAvatar.position.y = validFloorY + this.libAvatarFeetOffset;
        this.libAvatarYaw = Math.atan2(dx, dz);
        this.libAvatar.rotation.y = this.libAvatarYaw;
      }
    };
    const canvas = this.libCanvasRef!.nativeElement;
    canvas.addEventListener('wheel', this.libWheel, { passive: false });

    // ─── Click pour téléporter l'avatar sur le sol pointé ───
    this.libMouseDown = (e: MouseEvent) => {
      this.mouseDownX = e.clientX;
      this.mouseDownY = e.clientY;
      this.mouseMoved = false;
    };
    this.libMouseMove = (e: MouseEvent) => {
      if (Math.abs(e.clientX - this.mouseDownX) > 4 || Math.abs(e.clientY - this.mouseDownY) > 4) {
        this.mouseMoved = true;
      }
      // Bouton enfoncé (e.buttons & 1) → orbite caméra
      if ((e.buttons & 1) && this.mouseMoved) {
        this.camYaw -= e.movementX * 0.005;
        this.camPitchOffset = Math.max(-0.4, Math.min(0.4, this.camPitchOffset - e.movementY * 0.003));
      }
    };
    this.libClick = (e: MouseEvent) => {
      if (this.mouseMoved) return;   // c'était un drag, pas un click
      this.teleportAvatarToClick(e);
    };
    canvas.addEventListener('mousedown', this.libMouseDown);
    canvas.addEventListener('mousemove', this.libMouseMove);
    canvas.addEventListener('click', this.libClick);

    // (restore appelé dans le callback gltf — pas ici car loader.load est async)

    this.libResize = () => {
      if (!this.libCanvasRef || !this.libRenderer || !this.libCamera) return;
      const c = this.libCanvasRef.nativeElement;
      const W = c.clientWidth || window.innerWidth;
      const H = c.clientHeight || window.innerHeight;
      this.libRenderer.setSize(W, H, false);
      this.libCamera.aspect = W / H;
      this.libCamera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.libResize);

    this.animateLibrary();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📦 PORT — animateLibrary (cf. dashboard-beta lignes 9310-9408)
  // ═══════════════════════════════════════════════════════════════════
  private animateLibrary(): void {
    if (!this.libRenderer || !this.libScene || !this.libCamera) return;
    const dt = this.libClock?.getDelta() || 0;
    if (this.libAvatarMixer) this.libAvatarMixer.update(dt);

    let moving = false;
    if (this.libAvatar) {
      const k = this.libKeys;
      // ⚡ Direction relative à la CAMÉRA (souris) — style 3rd person RPG
      // Z/W/↑ = forward (vers où regarde la cam), S/↓ = backward
      // Q/A/← = strafe gauche, D/→ = strafe droite
      const fwd     = (k['z'] || k['w'] || k['arrowup'])    ? 1 : 0;
      const bwd     = (k['s'] || k['arrowdown'])             ? 1 : 0;
      const strafeL = (k['q'] || k['a'] || k['arrowleft'])  ? 1 : 0;
      const strafeR = (k['d'] || k['arrowright'])           ? 1 : 0;

      const moveZ = fwd - bwd;
      const moveX = strafeR - strafeL;

      if (moveZ !== 0 || moveX !== 0) {
        // ⚡ Vitesse proportionnelle à la taille de l'avatar (signal live)
        const avHeight = 6 * this.avatarScaleSig();
        const speed = avHeight * 4;
        // Vecteur direction monde (forward cam + perpendiculaire pour strafe)
        const cosY = Math.cos(this.camYaw);
        const sinY = Math.sin(this.camYaw);
        const dirX = moveZ * sinY + moveX * cosY;
        const dirZ = moveZ * cosY - moveX * sinY;
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        const dist = speed * dt;
        const dx = (dirX / len) * dist;
        const dz = (dirZ / len) * dist;

        const T = (window as any).THREE;
        const newX = this.libAvatar.position.x + dx;
        const newZ = this.libAvatar.position.z + dz;
        const currentY = this.libAvatar.position.y - this.libAvatarFeetOffset;

        const validFloorY = this.isValidWalkPosition(T, newX, newZ, currentY);
        if (validFloorY !== null) {
          this.libAvatar.position.x = newX;
          this.libAvatar.position.z = newZ;
          const targetY = validFloorY + this.libAvatarFeetOffset;
          this.libAvatar.position.y += (targetY - this.libAvatar.position.y) * 0.30;

          // ⚡ Avatar tourne vers sa vraie direction de mouvement (lerp doux)
          const targetYaw = Math.atan2(dirX, dirZ);
          let deltaYaw = targetYaw - this.libAvatarYaw;
          // Wrap [-π, π] pour éviter les rotations longues
          while (deltaYaw >  Math.PI) deltaYaw -= 2 * Math.PI;
          while (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;
          this.libAvatarYaw += deltaYaw * 0.20;
          this.libAvatar.rotation.y = this.libAvatarYaw;

          moving = true;
        }
      }
    }

    if (this.libIdleAction && this.libWalkAction) {
      const target: 'idle' | 'walk' = moving ? 'walk' : 'idle';
      if (target !== this.libCurrentAnim) {
        this.libCurrentAnim = target;
        const fadeT = 0.2;
        if (target === 'walk') {
          this.libWalkAction.enabled = true;
          this.libIdleAction.crossFadeTo(this.libWalkAction, fadeT, false);
          this.libWalkAction.setEffectiveWeight(1);
        } else {
          this.libWalkAction.crossFadeTo(this.libIdleAction, fadeT, false);
          this.libIdleAction.setEffectiveWeight(1);
        }
      }
    }

    if (this.libAvatar && this.libCamera) {
      // ⚡ Caméra suit la taille live de l'avatar
      const avHeight = 6 * this.avatarScaleSig();
      // ⚡ Zoom molette : multiplie distance + hauteur
      const camDistance = Math.max(1.5, avHeight * 2.5 * this.camZoomMul);
      // Hauteur modulée par camPitchOffset (drag Y)
      const camHeight   = Math.max(0.5, (avHeight * 1.6 + camDistance * this.camPitchOffset) * this.camZoomMul);
      // ⚡ Caméra orbitée par la souris (camYaw), pas par l'avatar
      const offX = -Math.sin(this.camYaw) * camDistance;
      const offZ = -Math.cos(this.camYaw) * camDistance;
      const targetX = this.libAvatar.position.x + offX;
      const targetY = this.libAvatar.position.y + camHeight;
      const targetZ = this.libAvatar.position.z + offZ;
      this.libCamera.position.x += (targetX - this.libCamera.position.x) * 0.10;
      this.libCamera.position.y += (targetY - this.libCamera.position.y) * 0.10;
      this.libCamera.position.z += (targetZ - this.libCamera.position.z) * 0.10;
      this.libCamera.lookAt(
        this.libAvatar.position.x,
        this.libAvatar.position.y + 0.6,
        this.libAvatar.position.z,
      );
      this.fadeWallsBlockingCamera();
    }

    if (this.libControls?.enabled) this.libControls.update();
    this.libRenderer.render(this.libScene, this.libCamera);
    this.libAnimFrame = requestAnimationFrame(() => this.animateLibrary());
  }

  // ═══════════════════════════════════════════════════════════════════
  // ⚡ Téléportation par click + persistance position spawn (extension)
  // ═══════════════════════════════════════════════════════════════════
  private teleportAvatarToClick(e: MouseEvent): void {
    const T = (window as any).THREE;
    if (!T || !this.libAvatar || !this.libCamera || !this.libModel || !this.libCanvasRef) return;
    const canvas = this.libCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, this.libCamera);
    const hits = ray.intersectObject(this.libModel, true);
    if (!hits.length) { console.log('[YamzyExplore] Click hors map — pas de téléport'); return; }
    // Cherche le premier hit qui est une surface "sol" (normale vers le haut)
    let target = null as any;
    for (const h of hits) {
      const n = h.face?.normal;
      if (n) {
        const worldNormal = n.clone().transformDirection(h.object.matrixWorld);
        if (worldNormal.y > 0.5 && !this.isWaterMesh(h.object)) { target = h; break; }
      }
    }
    if (!target) target = hits[0];
    this.libAvatar.position.set(
      target.point.x,
      target.point.y + this.libAvatarFeetOffset,
      target.point.z,
    );
    console.log(`[YamzyExplore] 🎯 Téléport à (${target.point.x.toFixed(2)}, ${target.point.y.toFixed(2)}, ${target.point.z.toFixed(2)})`);
    // ⚡ Téléport ne sauvegarde PAS — clique 💾 si tu veux rendre ce point permanent
  }

  private saveAvatarSpawn(): void {
    if (!this.libAvatar) return;
    try {
      // ⚡ Sauve la position des PIEDS (Y indépendant du scale courant) + transform caméra complète
      const payload = {
        x: this.libAvatar.position.x,
        feetY: this.libAvatar.position.y - this.libAvatarFeetOffset,
        z: this.libAvatar.position.z,
        yaw: this.libAvatarYaw,
        scale: this.avatarScaleSig(),
        camYaw: this.camYaw,
        camPitchOffset: this.camPitchOffset,
        camZoomMul: this.camZoomMul,
        savedAt: Date.now(),
      };
      localStorage.setItem(YamzyExploreIslandComponent.SPAWN_STORAGE_KEY, JSON.stringify(payload));
      console.log(`[YamzyExplore] 💾 SAVE — pieds=(${payload.x.toFixed(2)}, ${payload.feetY.toFixed(2)}, ${payload.z.toFixed(2)}), yaw=${payload.yaw.toFixed(2)}, zoom=${payload.camZoomMul.toFixed(2)}×`);
    } catch (e) {
      console.error('[YamzyExplore] Erreur saveAvatarSpawn', e);
    }
  }

  private restoreAvatarSpawn(): void {
    if (!this.libAvatar) return;
    try {
      const raw = localStorage.getItem(YamzyExploreIslandComponent.SPAWN_STORAGE_KEY);
      if (!raw) { console.log(`[YamzyExplore] · Pas de spawn sauvegardé (utilise default)`); return; }
      const s = JSON.parse(raw);
      if (typeof s.x === 'number' && typeof s.z === 'number') {
        // Position pieds → position pivot = feetY + feetOffset_courant
        const feetY = typeof s.feetY === 'number' ? s.feetY
                    : (typeof s.y === 'number' ? s.y - this.libAvatarFeetOffset : 0);
        this.libAvatar.position.set(s.x, feetY + this.libAvatarFeetOffset, s.z);
      }
      if (typeof s.yaw === 'number') {
        this.libAvatarYaw = s.yaw;
        this.libAvatar.rotation.y = s.yaw;
      }
      // ⚡ Restaure aussi la transform caméra (sinon zoom & orientation perdus au refresh)
      if (typeof s.camYaw === 'number') this.camYaw = s.camYaw;
      else if (typeof s.yaw === 'number') this.camYaw = s.yaw;
      if (typeof s.camPitchOffset === 'number') this.camPitchOffset = s.camPitchOffset;
      if (typeof s.camZoomMul === 'number') this.camZoomMul = s.camZoomMul;
      console.log(`[YamzyExplore] ✓ RESTORE — pivot=(${this.libAvatar.position.x.toFixed(2)}, ${this.libAvatar.position.y.toFixed(2)}, ${this.libAvatar.position.z.toFixed(2)}), yaw=${this.libAvatarYaw.toFixed(2)}, zoom=${this.camZoomMul.toFixed(2)}×`);
    } catch (e) {
      console.error('[YamzyExplore] Erreur restoreAvatarSpawn', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📦 PORT — fadeWallsBlockingCamera (cf. dashboard-beta lignes 9098-9155)
  // ⚡ Adapté : skip si caméra LOIN (sinon ça fade toute l'île en exploration)
  // ═══════════════════════════════════════════════════════════════════
  private fadeWallsBlockingCamera(): void {
    const T = (window as any).THREE;
    if (!T || !this.libCamera || !this.libAvatar || !this.libModel) return;

    const camPos = this.libCamera.position.clone();
    const targetPos = this.libAvatar.position.clone();
    targetPos.y += 1.0;
    const dir = targetPos.clone().sub(camPos);
    const dist = dir.length();
    dir.normalize();

    // ⚡ Skip si caméra LOIN (zoom out / scale up) — utile uniquement en proche indoor
    const avHeight = 6 * this.avatarScaleSig();
    const maxFadeDist = Math.max(avHeight * 8, 6);
    if (dist > maxFadeDist) {
      // Restaure tous les meshes précédemment fadés et sors
      for (const [mat, saved] of this.libFadedMaterials.entries()) {
        mat.opacity = saved.originalOpacity;
        mat.transparent = saved.originalTransparent;
        mat.depthWrite = true;
      }
      this.libFadedMaterials.clear();
      return;
    }

    const ray = new T.Raycaster(camPos, dir, 0, dist);
    const hits = ray.intersectObject(this.libModel, true);
    const blocking = new Set<any>();
    for (const h of hits) {
      const n = h.face?.normal;
      if (n) {
        const worldNormal = n.clone().transformDirection(h.object.matrixWorld);
        if (worldNormal.y > 0.6) continue;
      }
      blocking.add(h.object);
    }

    for (const mesh of blocking) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        if (!this.libFadedMaterials.has(m)) {
          this.libFadedMaterials.set(m, {
            originalOpacity: m.opacity ?? 1,
            originalTransparent: m.transparent ?? false,
          });
        }
        m.transparent = true;
        m.opacity = 0.18;
        m.depthWrite = false;
      }
    }

    for (const [mat, saved] of this.libFadedMaterials.entries()) {
      let stillBlocking = false;
      for (const mesh of blocking) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (mats.includes(mat)) { stillBlocking = true; break; }
      }
      if (!stillBlocking) {
        mat.opacity = saved.originalOpacity;
        mat.transparent = saved.originalTransparent;
        mat.depthWrite = true;
        this.libFadedMaterials.delete(mat);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📦 PORT — floor detection (cf. dashboard-beta lignes 9157-9237)
  // ═══════════════════════════════════════════════════════════════════
  private findLibraryFloorY(T: any, worldX: number, worldZ: number, fromY?: number): number {
    const r = this.findLibraryFloorHit(T, worldX, worldZ, fromY);
    return r ? r.y : (fromY ?? 0);
  }

  private findLibraryFloorHit(T: any, worldX: number, worldZ: number, fromY?: number)
      : { y: number; mesh: any } | null {
    if (!this.libModel) return null;

    if (fromY !== undefined) {
      const ray = new T.Raycaster(
        new T.Vector3(worldX, fromY + 1.5, worldZ),
        new T.Vector3(0, -1, 0),
        0, 50,
      );
      const hits = ray.intersectObject(this.libModel, true);
      for (const h of hits) {
        const n = h.face?.normal;
        if (!n) continue;
        const worldNormal = n.clone().transformDirection(h.object.matrixWorld);
        if (worldNormal.y > 0.5) return { y: h.point.y, mesh: h.object };
      }
      return null;
    }

    const ray = new T.Raycaster(
      new T.Vector3(worldX, 200, worldZ),
      new T.Vector3(0, -1, 0),
      0, 500,
    );
    const hits = ray.intersectObject(this.libModel, true);
    if (!hits.length) return null;
    for (const h of hits) {
      const n = h.face?.normal;
      if (!n) continue;
      const worldNormal = n.clone().transformDirection(h.object.matrixWorld);
      if (worldNormal.y > 0.5) return { y: h.point.y, mesh: h.object };
    }
    return { y: hits[0].point.y, mesh: hits[0].object };
  }

  private isWaterMesh(mesh: any): boolean {
    if (!mesh) return false;
    const re = /water|sea|ocean|lake|river|wave|liquide|liquid|eau/i;
    if (mesh.name && re.test(mesh.name)) return true;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat?.name && re.test(mat.name)) return true;
    if (mat?.color) {
      const c = mat.color;
      if (c.b > 0.5 && c.r < 0.3 && c.g < 0.6) return true;
    }
    return false;
  }

  private isValidWalkPosition(T: any, newX: number, newZ: number, currentY: number)
      : number | null {
    const hit = this.findLibraryFloorHit(T, newX, newZ, currentY);
    if (!hit) {
      const skyHit = this.findLibraryFloorHit(T, newX, newZ);
      if (!skyHit) return null;
      if (skyHit.y < currentY - 2.5) return null;
      if (this.isWaterMesh(skyHit.mesh)) return null;
      return skyHit.y;
    }
    if (this.isWaterMesh(hit.mesh)) return null;
    return hit.y;
  }
}
