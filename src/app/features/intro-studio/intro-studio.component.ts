// ════════════════════════════════════════════════════════════════════════
// 🎬 INTRO STUDIO — Playback frame-by-frame de intro-island.glb + caméra réglable
//
// Outils pour régler l'animation et la caméra :
//   • Timeline scrubber (drag → seek dans l'anim)
//   • Play / Pause / Step ±1 frame (←/→ ou boutons)
//   • Speed (0.1× → 4×)
//   • Caméra orbit : sliders distance/yaw/pitch + readout live + cible (yamzy/boat/origin)
//   • Drag souris pour orbiter, molette pour zoomer
//   • Bouton Save → écrit en localStorage les paramètres caméra pour réutilisation /welcome
// ════════════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'wt-intro-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="is-host">
      <canvas #canvas class="is-canvas"></canvas>

      <!-- Bottom timeline bar -->
      <div class="is-timeline">
        <button class="is-btn" (click)="togglePlay()">{{ isPlaying() ? '⏸' : '▶' }}</button>
        <button class="is-btn" (click)="step(-1)" title="Frame précédente (←)">⏮ −1</button>
        <button class="is-btn" (click)="step(1)" title="Frame suivante (→)">+1 ⏭</button>
        <input type="range" class="is-slider"
               [min]="0" [max]="duration() || 1" [step]="0.01"
               [ngModel]="currentTime()"
               (input)="onSeek($event)" />
        <span class="is-time">
          {{ currentTime().toFixed(2) }}s / {{ duration().toFixed(2) }}s
          · frame {{ currentFrame() }} / {{ totalFrames() }}
        </span>
        <label class="is-speed">
          Vitesse :
          <select [ngModel]="speed()" (ngModelChange)="setSpeed($event)">
            <option [ngValue]="0.1">0.1×</option>
            <option [ngValue]="0.25">0.25×</option>
            <option [ngValue]="0.5">0.5×</option>
            <option [ngValue]="1">1×</option>
            <option [ngValue]="2">2×</option>
            <option [ngValue]="4">4×</option>
          </select>
        </label>
      </div>

      <!-- Right panel : camera controls -->
      <aside class="is-panel">
        <h3>🎥 Caméra</h3>

        <div class="is-section">
          <label>Cible (orbit center)</label>
          <select [ngModel]="target()" (ngModelChange)="setTarget($event)">
            <option value="origin">🌍 Origine (0,0,0)</option>
            <option value="islandCenter">🏝 Centre île (bbox)</option>
            <option value="yamzy" [disabled]="!hasYamzy()">🧙 YAMZY</option>
            <option value="boat" [disabled]="!hasBoat()">🚢 Boat</option>
            <option value="mouette" [disabled]="!hasMouette()">🐦 Mouette</option>
          </select>
          <div class="is-readout">
            target = ({{ targetPos().x.toFixed(1) }}, {{ targetPos().y.toFixed(1) }}, {{ targetPos().z.toFixed(1) }})
          </div>
        </div>

        <div class="is-section">
          <label>Distance : {{ orbitDistance().toFixed(2) }}</label>
          <input type="range" class="is-slider"
                 [min]="distMin()" [max]="distMax()" [step]="0.1"
                 [ngModel]="orbitDistance()"
                 (input)="setDistance($event)" />
          <!-- Saisie directe -->
          <input type="number" class="is-num-input"
                 [ngModel]="orbitDistance()"
                 (input)="setDistanceNum($event)"
                 step="0.1" placeholder="valeur exacte" />
          <!-- Preset buttons -->
          <div class="is-presets">
            <button class="is-btn-tiny" (click)="setDistanceVal(-10)">-10</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(-5)">-5</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(-1)">-1</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(0.5)">0.5</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(1)">1</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(5)">5</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(10)">10</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(50)">50</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(100)">100</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(500)">500</button>
            <button class="is-btn-tiny" (click)="setDistanceVal(distMax())">MAX</button>
          </div>
        </div>

        <div class="is-section">
          <label>Yaw : {{ (orbitYaw() * 180 / 3.14159).toFixed(0) }}°</label>
          <input type="range" class="is-slider"
                 [min]="-3.14159" [max]="3.14159" [step]="0.01"
                 [ngModel]="orbitYaw()"
                 (input)="setYaw($event)" />
        </div>

        <div class="is-section">
          <label>Pitch : {{ (orbitPitch() * 180 / 3.14159).toFixed(0) }}°</label>
          <input type="range" class="is-slider"
                 [min]="-1.4" [max]="1.4" [step]="0.01"
                 [ngModel]="orbitPitch()"
                 (input)="setPitch($event)" />
        </div>

        <div class="is-section">
          <label>FOV : {{ fov() }}°</label>
          <input type="range" class="is-slider"
                 [min]="20" [max]="90" [step]="1"
                 [ngModel]="fov()"
                 (input)="setFov($event)" />
        </div>

        <div class="is-section is-readout-block">
          <div class="is-readout">cam pos : ({{ camPos().x.toFixed(0) }}, {{ camPos().y.toFixed(0) }}, {{ camPos().z.toFixed(0) }})</div>
          <div class="is-readout">target  : ({{ targetPos().x.toFixed(0) }}, {{ targetPos().y.toFixed(0) }}, {{ targetPos().z.toFixed(0) }})</div>
        </div>

        <div class="is-section">
          <button class="is-btn is-btn-save" (click)="saveCamera()">💾 Sauver vue (localStorage)</button>
          <button class="is-btn" (click)="resetCamera()">🔄 Reset</button>
          <div class="is-flash" *ngIf="flash()">{{ flash() }}</div>
        </div>

        <div class="is-section is-helpers">
          <label><input type="checkbox" [ngModel]="showAxes()" (ngModelChange)="setShowAxes($event)"> Axes monde</label>
          <label><input type="checkbox" [ngModel]="showBboxes()" (ngModelChange)="setShowBboxes($event)"> Bboxes (yamzy/boat/mouette)</label>
        </div>

        <!-- ═══ Free Fly mode (caméra libre) ═══ -->
        <div class="is-section">
          <label>
            <input type="checkbox" [ngModel]="freeMode()" (ngModelChange)="setFreeMode($event)" />
            🛩 Mode Free Fly (caméra libre)
          </label>
          <div class="is-readout" *ngIf="freeMode()">
            ⌨ <b>W/A/S/D</b> avant/gauche/arrière/droite · <b>Q/E</b> haut/bas · <b>Shift</b> ×3 boost
          </div>
          <div class="is-readout" *ngIf="freeMode()">
            🖱 drag = orienter le regard · 🛞 wheel = avance/recule sur l'axe vue
          </div>
          <div class="is-readout" *ngIf="freeMode()">
            cam : ({{ freeCamPos().x.toFixed(0) }}, {{ freeCamPos().y.toFixed(0) }}, {{ freeCamPos().z.toFixed(0) }})
          </div>
          <label *ngIf="freeMode()">Vitesse : {{ freeSpeedSig().toFixed(0) }} u/s</label>
          <input *ngIf="freeMode()" type="range" class="is-slider"
                 [min]="10" [max]="20000" [step]="10"
                 [ngModel]="freeSpeedSig()"
                 (input)="setFreeSpeed($event)" />
          <button class="is-btn" *ngIf="freeMode()" (click)="setFreeMode(false)">↩ Retour mode Orbit</button>
        </div>

        <!-- ═══ Path Editor pour la mouette ═══ -->
        <hr class="is-sep" />
        <h3>🐦 Path mouette</h3>

        <div class="is-section">
          <label>
            <input type="checkbox" [ngModel]="pathEditMode()" (ngModelChange)="setPathEditMode($event)" />
            ✏ Mode édition (gizmo sur la mouette)
          </label>
          <div class="is-readout" *ngIf="pathEditMode()">
            🖱 Drag les flèches/anneaux du gizmo (3D)<br/>
            puis 📌 <b>Capturer</b> pour figer la position
          </div>
          <!-- Mode switcher (Blender G/R/S) -->
          <div class="is-presets" *ngIf="pathEditMode()" style="grid-template-columns: repeat(3, 1fr);">
            <button class="is-btn-tiny"
                    [style.background]="transformMode() === 'translate' ? '#d54adf' : ''"
                    (click)="setTransformMode('translate')"
                    title="Touche G">↔ Move (G)</button>
            <button class="is-btn-tiny"
                    [style.background]="transformMode() === 'rotate' ? '#d54adf' : ''"
                    (click)="setTransformMode('rotate')"
                    title="Touche R">↻ Rotate (R)</button>
            <button class="is-btn-tiny"
                    [style.background]="transformMode() === 'scale' ? '#d54adf' : ''"
                    (click)="setTransformMode('scale')"
                    title="Touche S">⤢ Scale (S)</button>
          </div>
          <div class="is-readout" *ngIf="pathEditMode()">
            Gizmo : <b>{{ transformMode() }}</b>
          </div>
        </div>

        <div class="is-section">
          <button class="is-btn is-btn-save" (click)="captureCurrentMouettePos()">
            📌 Capturer pos actuelle ({{ waypoints().length }} pts)
          </button>
          <button class="is-btn" [disabled]="waypoints().length < 2" (click)="playPath()">
            ▶ Play path
          </button>
          <button class="is-btn" [disabled]="waypoints().length === 0" (click)="clearWaypoints()">
            🗑 Vider waypoints
          </button>
        </div>

        <div class="is-section" *ngIf="waypoints().length > 0">
          <label>Waypoints ({{ waypoints().length }})</label>
          <div class="is-waypoints">
            <div *ngFor="let wp of waypoints(); let i = index" class="is-waypoint">
              <span class="is-wp-num">#{{ i }}</span>
              <span class="is-wp-pos">({{ wp.x.toFixed(0) }}, {{ wp.y.toFixed(0) }}, {{ wp.z.toFixed(0) }})</span>
              <button class="is-btn-tiny is-wp-del" (click)="removeWaypoint(i)">✕</button>
            </div>
          </div>
        </div>

        <div class="is-section">
          <label>Durée path (sec) : {{ pathDuration().toFixed(1) }}</label>
          <input type="range" class="is-slider"
                 [min]="1" [max]="60" [step]="0.5"
                 [ngModel]="pathDuration()"
                 (input)="setPathDuration($event)" />
        </div>

        <div class="is-section">
          <button class="is-btn is-btn-save" (click)="savePathToStorage()">
            💾 Sauver path (localStorage)
          </button>
          <button class="is-btn" (click)="loadPathFromStorage()">
            📂 Charger path sauvegardé
          </button>
          <div class="is-flash" *ngIf="pathFlash()">{{ pathFlash() }}</div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
    .is-host {
      position: relative;
      width: 100%; height: 100%;
      background: #0a0e1f;
      color: #fff;
      font-family: "Tinos", serif;
    }
    .is-canvas {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      display: block;
    }
    .is-timeline {
      position: fixed;
      bottom: 0; left: 0; right: 320px;
      z-index: 10;
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px;
      background: rgba(0,0,0,0.75);
      border-top: 1px solid rgba(213,74,223,0.3);
      backdrop-filter: blur(8px);
    }
    .is-slider {
      flex: 1;
      accent-color: #d54adf;
    }
    .is-btn {
      background: rgba(213,74,223,0.25);
      border: 1px solid #d54adf;
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
    }
    .is-btn:hover { background: rgba(213,74,223,0.45); }
    .is-btn-save {
      background: rgba(134,239,172,0.2);
      border-color: #86efac;
    }
    .is-time, .is-speed {
      font-family: monospace;
      font-size: 12px;
      color: #fde047;
      white-space: nowrap;
    }
    .is-speed select {
      background: rgba(0,0,0,0.5);
      color: #fff;
      border: 1px solid rgba(213,74,223,0.4);
      padding: 3px;
      border-radius: 4px;
    }
    .is-panel {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 320px;
      z-index: 11;
      padding: 16px;
      background: rgba(8,4,28,0.88);
      border-left: 1px solid rgba(213,74,223,0.4);
      backdrop-filter: blur(8px);
      overflow-y: auto;
    }
    .is-panel h3 {
      margin: 0 0 12px;
      font-family: "Henny Penny", cursive;
      color: #fde047;
      font-size: 18px;
      letter-spacing: 0.08em;
    }
    .is-section {
      margin-bottom: 14px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .is-section label {
      font-size: 12px;
      color: #c4b5fd;
      letter-spacing: 0.04em;
    }
    .is-section select {
      background: rgba(0,0,0,0.5);
      color: #fff;
      border: 1px solid rgba(213,74,223,0.4);
      padding: 5px 8px;
      border-radius: 5px;
      font-family: inherit;
      font-size: 13px;
    }
    .is-readout {
      font-family: monospace;
      font-size: 11px;
      color: #86efac;
    }
    .is-readout-block {
      padding: 8px;
      background: rgba(0,0,0,0.4);
      border-radius: 5px;
      border: 1px solid rgba(134,239,172,0.3);
    }
    .is-helpers label {
      display: flex; align-items: center; gap: 6px;
      cursor: pointer;
    }
    .is-helpers input[type=checkbox] { cursor: pointer; }
    .is-flash {
      font-size: 11px;
      color: #86efac;
      padding: 5px;
      background: rgba(134,239,172,0.12);
      border-radius: 4px;
      text-align: center;
      animation: is-flash 1.6s;
    }
    .is-num-input {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(213,74,223,0.4);
      color: #fde047;
      padding: 4px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      width: 100%;
    }
    .is-presets {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3px;
    }
    .is-btn-tiny {
      background: rgba(213,74,223,0.18);
      border: 1px solid rgba(213,74,223,0.5);
      color: #fff;
      padding: 3px 4px;
      border-radius: 3px;
      cursor: pointer;
      font-family: monospace;
      font-size: 11px;
    }
    .is-btn-tiny:hover { background: rgba(213,74,223,0.4); }
    .is-sep {
      border: none;
      border-top: 1px solid rgba(213,74,223,0.3);
      margin: 14px 0 10px;
    }
    .is-waypoints {
      max-height: 200px;
      overflow-y: auto;
      display: flex; flex-direction: column;
      gap: 3px;
      padding: 4px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
    }
    .is-waypoint {
      display: flex; align-items: center; gap: 6px;
      padding: 3px 5px;
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
      font-family: monospace;
      font-size: 10.5px;
    }
    .is-wp-num {
      color: #d54adf;
      font-weight: 800;
      min-width: 22px;
    }
    .is-wp-pos {
      flex: 1;
      color: #fde047;
    }
    .is-wp-del {
      padding: 0 4px;
      font-size: 10px;
      background: rgba(244,63,94,0.3);
      border-color: #f43f5e;
    }
    @keyframes is-flash {
      0% { opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
  `],
})
export class IntroStudioComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // Signals UI
  isPlaying = signal<boolean>(true);
  currentTime = signal<number>(0);
  duration = signal<number>(0);
  speed = signal<number>(1);
  totalFrames = signal<number>(0);
  currentFrame = signal<number>(0);
  target = signal<'origin' | 'islandCenter' | 'yamzy' | 'boat' | 'mouette'>('islandCenter');
  orbitDistance = signal<number>(1000);
  orbitYaw = signal<number>(0);
  orbitPitch = signal<number>(0.4);
  fov = signal<number>(50);
  distMin = signal<number>(1);
  distMax = signal<number>(100000);
  hasYamzy = signal<boolean>(false);
  hasBoat = signal<boolean>(false);
  hasMouette = signal<boolean>(false);
  camPos = signal<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  targetPos = signal<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  showAxes = signal<boolean>(true);
  showBboxes = signal<boolean>(true);
  flash = signal<string>('');

  // ─── Free Fly cam (mode libre, indépendant de l'orbit) ───
  freeMode = signal<boolean>(false);
  freeCamPos = signal<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  freeCamYaw = signal<number>(0);
  freeCamPitch = signal<number>(0);
  freeSpeedSig = signal<number>(1000);   // exposé pour le slider UI
  private freeKeys: Record<string, boolean> = {};
  private get freeSpeed(): number { return this.freeSpeedSig(); }
  private set freeSpeed(v: number) { this.freeSpeedSig.set(v); }

  // ─── Path editor pour la mouette ───
  pathEditMode = signal<boolean>(false);
  waypoints = signal<Array<{ x: number; y: number; z: number; qx?: number; qy?: number; qz?: number; qw?: number }>>([]);
  pathDuration = signal<number>(7);
  pathFlash = signal<string>('');
  selectedWpIdx = signal<number>(-1);   // index du waypoint sélectionné (Blender-way)
  transformMode = signal<'translate' | 'rotate' | 'scale'>('translate');
  private pathLine: any = null;
  private pathWaypointMeshes: any[] = [];
  private pathPlayback: { active: boolean; start: number; duration: number } = { active: false, start: 0, duration: 7 };
  private transformControls: any = null;

  // Three.js
  private scene: any;
  private camera: any;
  private renderer: any;
  private mixer: any = null;
  private action: any = null;
  private clock: any;
  private rafId = 0;
  private disposed = false;

  // Refs to objects
  private islandRoot: any = null;
  private yamzyNode: any = null;
  private boatNode: any = null;
  private mouetteNode: any = null;
  private axesHelper: any = null;
  private bboxHelpers: any[] = [];

  // Drag state
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  private onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    if (e.key === ' ') { e.preventDefault(); this.togglePlay(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
    const k = e.key.toLowerCase();
    // 🛩 Free Fly : WASD/QE → track frame-par-frame dans freeKeys
    if (this.freeMode() && ['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(k)) {
      e.preventDefault();
      this.freeKeys[k] = true;
      return;
    }
    // ⚡ Blender-way pour TransformControls sur waypoint sélectionné
    if (k === 'g') { e.preventDefault(); this.setTransformMode('translate'); }
    if (k === 'r') { e.preventDefault(); this.setTransformMode('rotate'); }
    if (k === 's') { e.preventDefault(); this.setTransformMode('scale'); }
    if (k === 'escape') { e.preventDefault(); this.deselectWaypoint(); }
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(k)) {
      this.freeKeys[k] = false;
    }
  };

  ngOnInit(): void { this.bootstrap(); }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    try { this.renderer?.dispose(); } catch {}
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
  }

  // ─── Controls ───
  togglePlay(): void { this.isPlaying.set(!this.isPlaying()); }
  step(frames: number): void {
    const FPS = 30;
    const t = this.currentTime() + frames / FPS;
    this.seekTo(Math.max(0, Math.min(this.duration(), t)));
    this.isPlaying.set(false);
  }
  setSpeed(s: number): void { this.speed.set(s); }
  onSeek(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.seekTo(v);
    this.isPlaying.set(false);
  }
  private seekTo(t: number): void {
    this.currentTime.set(t);
    if (this.action) {
      this.action.time = t;
      this.mixer?.update(0);
    }
    this.currentFrame.set(Math.floor(t * 30));
  }
  setTarget(t: 'origin' | 'islandCenter' | 'yamzy' | 'boat' | 'mouette'): void {
    this.target.set(t);
    this.updateTargetPos();
    this.updateDistBounds();
  }

  /** Adapte distMin à la taille de la cible (pour pouvoir zoomer près sur petite cible).
   *  ⚡ Cas spécial mouette/boat : force distance = 1 (gros plan extrême). */
  private updateDistBounds(): void {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;
    const t = this.target();

    // ⚡ Mouette / Boat : distance peut être négative (caméra de l'autre côté) → range étendu
    if (t === 'mouette' || t === 'boat') {
      this.distMin.set(-100);
      this.distMax.set(10000);
      this.orbitDistance.set(1);   // valeur par défaut, user peut changer avec presets
      console.log(`[IntroStudio] 📏 Cible "${t}" → range [-100, 10000], défaut 1`);
      return;
    }

    // Cas standards : adaptatif à la taille du target
    let targetObj: any = null;
    switch (t) {
      case 'yamzy':  targetObj = this.yamzyNode;  break;
      case 'origin': targetObj = null;            break;
      default:       targetObj = this.islandRoot;
    }
    let minBound = 0.5;
    if (targetObj) {
      targetObj.updateWorldMatrix(true, false);
      const b = new T.Box3().setFromObject(targetObj);
      if (!b.isEmpty()) {
        const s = new T.Vector3(); b.getSize(s);
        const maxS = Math.max(s.x, s.y, s.z);
        if (isFinite(maxS) && maxS > 0.001) {
          minBound = Math.max(0.5, maxS * 0.3);
        }
      }
    }
    this.distMin.set(minBound);
    if (this.orbitDistance() < minBound) this.orbitDistance.set(minBound);
    console.log(`[IntroStudio] 📏 distMin adapté à "${t}" → ${minBound.toFixed(1)} (orbitDist=${this.orbitDistance().toFixed(1)})`);
  }
  setDistance(e: Event): void { this.orbitDistance.set(parseFloat((e.target as HTMLInputElement).value)); }
  setDistanceNum(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.orbitDistance.set(v);
  }
  setDistanceVal(v: number): void { this.orbitDistance.set(v); }
  setYaw(e: Event): void { this.orbitYaw.set(parseFloat((e.target as HTMLInputElement).value)); }
  setPitch(e: Event): void { this.orbitPitch.set(parseFloat((e.target as HTMLInputElement).value)); }
  setFov(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.fov.set(v);
    if (this.camera) { this.camera.fov = v; this.camera.updateProjectionMatrix(); }
  }
  setShowAxes(b: boolean): void { this.showAxes.set(b); if (this.axesHelper) this.axesHelper.visible = b; }
  setShowBboxes(b: boolean): void { this.showBboxes.set(b); this.bboxHelpers.forEach(h => h.visible = b); }

  /** Toggle Free Fly mode. À l'activation : prend la position courante de la cam comme point de départ. */
  setFreeMode(b: boolean): void {
    if (b && !this.freeMode() && this.camera) {
      // Init : on hérite de la position + orientation actuelle de la caméra
      this.freeCamPos.set({ x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z });
      // Calcule yaw/pitch depuis le vecteur look-at actuel
      const T = (window as any).THREE;
      const dir = new T.Vector3();
      this.camera.getWorldDirection(dir);
      this.freeCamYaw.set(Math.atan2(dir.x, dir.z));
      this.freeCamPitch.set(Math.asin(dir.y));
      // Speed adaptée à la taille du GLB
      this.freeSpeed = Math.max(100, this.distMax() * 0.01);
    }
    this.freeMode.set(b);
    this.freeKeys = {};
  }

  setFreeSpeed(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) this.freeSpeedSig.set(v);
  }

  // ═════════════════════════════════════════════════════════════════
  // 🐦 Path editor pour la mouette
  // ═════════════════════════════════════════════════════════════════
  setPathEditMode(b: boolean): void {
    this.pathEditMode.set(b);
    if (!this.transformControls) return;
    if (b && this.mouetteNode) {
      // Pause l'anim pour que la mouette reste là où on la pose
      this.isPlaying.set(false);
      this.transformControls.attach(this.mouetteNode);
      this.transformControls.setMode('translate');
      this.transformMode.set('translate');
      this.flashPath('✏ Edit ON — déplace la mouette puis 📌 Capturer');
    } else {
      this.transformControls.detach();
      this.flashPath('✏ Edit OFF');
    }
  }
  setPathDuration(e: Event): void { this.pathDuration.set(parseFloat((e.target as HTMLInputElement).value)); }

  captureCurrentMouettePos(): void {
    if (!this.mouetteNode) { this.flashPath('Pas de mouette trouvée'); return; }
    const T = (window as any).THREE;
    this.mouetteNode.updateWorldMatrix(true, false);
    const p = new T.Vector3();
    this.mouetteNode.getWorldPosition(p);
    // ⚡ Capture aussi la rotation (quaternion monde) pour orienter la mouette pendant le path
    const q = new T.Quaternion();
    this.mouetteNode.getWorldQuaternion(q);
    this.addWaypoint(p.x, p.y, p.z, q.x, q.y, q.z, q.w);
  }

  private addWaypoint(x: number, y: number, z: number, qx?: number, qy?: number, qz?: number, qw?: number): void {
    this.waypoints.update(arr => [...arr, { x, y, z, qx, qy, qz, qw }]);
    this.updatePathVisuals();
    this.flashPath(`+1 waypoint (${this.waypoints().length} total)`);
  }

  removeWaypoint(i: number): void {
    this.waypoints.update(arr => arr.filter((_, idx) => idx !== i));
    this.updatePathVisuals();
  }

  clearWaypoints(): void {
    this.waypoints.set([]);
    this.updatePathVisuals();
    this.flashPath('Path vidé');
  }

  playPath(): void {
    if (this.waypoints().length < 2) return;
    this.pathPlayback = { active: true, start: this.clock?.elapsedTime ?? 0, duration: this.pathDuration() };
    this.flashPath(`▶ Play path sur ${this.pathDuration()}s`);
  }

  savePathToStorage(): void {
    try {
      localStorage.setItem('yamzy.intro.mouette.path', JSON.stringify({
        waypoints: this.waypoints(),
        duration: this.pathDuration(),
        savedAt: Date.now(),
      }));
      this.flashPath(`✓ Path sauvegardé (${this.waypoints().length} pts)`);
    } catch (e: any) {
      this.flashPath('Erreur save : ' + (e?.message || e));
    }
  }

  loadPathFromStorage(): void {
    try {
      const raw = localStorage.getItem('yamzy.intro.mouette.path');
      if (!raw) { this.flashPath('Aucun path sauvegardé'); return; }
      const p = JSON.parse(raw);
      if (Array.isArray(p.waypoints)) this.waypoints.set(p.waypoints);
      if (typeof p.duration === 'number') this.pathDuration.set(p.duration);
      this.updatePathVisuals();
      this.flashPath(`✓ Path chargé (${this.waypoints().length} pts)`);
    } catch (e: any) {
      this.flashPath('Erreur load : ' + (e?.message || e));
    }
  }

  private flashPath(msg: string): void {
    this.pathFlash.set(msg);
    setTimeout(() => this.pathFlash.set(''), 1800);
  }

  /** Met à jour uniquement la ligne magenta reliant les waypoints (PAS de sphères). */
  private updatePathVisuals(): void {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;
    if (this.pathLine) { this.scene.remove(this.pathLine); this.pathLine = null; }
    const wps = this.waypoints();
    if (wps.length >= 2) {
      const pts = wps.map(w => new T.Vector3(w.x, w.y, w.z));
      const geo = new T.BufferGeometry().setFromPoints(pts);
      const lineMat = new T.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.85, linewidth: 2 });
      this.pathLine = new T.Line(geo, lineMat);
      this.scene.add(this.pathLine);
    }
  }

  /** Sélectionne un waypoint et attache TransformControls dessus. */
  selectWaypoint(i: number): void {
    if (i < 0 || i >= this.pathWaypointMeshes.length) {
      this.deselectWaypoint();
      return;
    }
    this.selectedWpIdx.set(i);
    if (this.transformControls) {
      this.transformControls.attach(this.pathWaypointMeshes[i]);
    }
  }
  deselectWaypoint(): void {
    this.selectedWpIdx.set(-1);
    if (this.transformControls) this.transformControls.detach();
  }
  setTransformMode(m: 'translate' | 'rotate' | 'scale'): void {
    this.transformMode.set(m);
    if (this.transformControls) this.transformControls.setMode(m);
  }
  /** Sync la position du waypoint depuis le mesh manipulé par TransformControls. */
  private syncWpFromMesh(): void {
    const i = this.selectedWpIdx();
    if (i < 0 || i >= this.pathWaypointMeshes.length) return;
    const mesh = this.pathWaypointMeshes[i];
    this.waypoints.update(arr => {
      const next = [...arr];
      next[i] = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      return next;
    });
    // Reconstruit la ligne (pas les sphères, on garde les meshes)
    if (this.pathLine) {
      const T = (window as any).THREE;
      const pts = this.waypoints().map(w => new T.Vector3(w.x, w.y, w.z));
      this.pathLine.geometry.dispose();
      this.pathLine.geometry = new T.BufferGeometry().setFromPoints(pts);
    }
  }
  /** Raycast contre les sphères de waypoints. Renvoie l'index touché ou -1. */
  private raycastWaypoint(e: PointerEvent): number {
    const T = (window as any).THREE;
    if (!T || !this.camera || !this.canvasEl) return -1;
    const canvas = this.canvasEl.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.pathWaypointMeshes, false);
    if (hits.length === 0) return -1;
    return this.pathWaypointMeshes.indexOf(hits[0].object);
  }

  /** Raycast au click pour ajouter waypoint. */
  private tryAddWaypointFromClick(e: PointerEvent): void {
    const T = (window as any).THREE;
    if (!T || !this.camera || !this.islandRoot || !this.canvasEl) return;
    const canvas = this.canvasEl.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(this.islandRoot, true);
    if (hits.length === 0) { this.flashPath('Click hors map'); return; }
    const p = hits[0].point;
    this.addWaypoint(p.x, p.y, p.z);
  }
  saveCamera(): void {
    const payload = {
      target: this.target(),
      orbitDistance: this.orbitDistance(),
      orbitYaw: this.orbitYaw(),
      orbitPitch: this.orbitPitch(),
      fov: this.fov(),
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem('yamzy.welcome.camera', JSON.stringify(payload));
      this.flash.set('✓ Vue sauvegardée — utilisable dans /welcome');
      setTimeout(() => this.flash.set(''), 1600);
    } catch {}
  }
  resetCamera(): void {
    this.orbitDistance.set(this.distMax() * 0.3);
    this.orbitYaw.set(0);
    this.orbitPitch.set(0.4);
    this.target.set('islandCenter');
    this.fov.set(50);
    if (this.camera) { this.camera.fov = 50; this.camera.updateProjectionMatrix(); }
    this.updateTargetPos();
  }

  // ─── Bootstrap ───
  private async bootstrap(): Promise<void> {
    await this.loadThree();
    if (this.disposed) return;
    const T = (window as any).THREE;

    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth - 320, h = window.innerHeight - 56;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a0e1f);
    // ⚡ near = 0.001 → la caméra peut passer à travers les objets sans clip
    this.camera = new T.PerspectiveCamera(this.fov(), w / h, 0.001, 500000);
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.clock = new T.Clock();

    // Lights
    this.scene.add(new T.AmbientLight(0xffffff, 0.6));
    const sun = new T.DirectionalLight(0xffffff, 0.8);
    sun.position.set(1, 2, 1);
    this.scene.add(sun);

    // Axes monde
    this.axesHelper = new T.AxesHelper(50000);
    this.scene.add(this.axesHelper);

    // ⚡ TransformControls Blender-way (G/R/S/Esc)
    if (T.TransformControls) {
      this.transformControls = new T.TransformControls(this.camera, canvas);
      this.transformControls.setMode(this.transformMode());
      this.transformControls.setSize(0.8);
      this.transformControls.addEventListener('dragging-changed', (e: any) => {
        // Désactive l'orbit pendant le drag du gizmo
        this.isDragging = e.value ? false : this.isDragging;
      });
      this.transformControls.addEventListener('change', () => this.syncWpFromMesh());
      this.scene.add(this.transformControls);
    }

    // Load GLB
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }
    const gltf: any = await new Promise((res, rej) =>
      loader.load('/assets/conclave/models/intro-island.glb', res, undefined, rej));
    if (this.disposed) return;
    this.islandRoot = gltf.scene;
    this.scene.add(this.islandRoot);

    // ⚡ Double-side sur tous les matériaux → caméra peut être à l'intérieur d'un objet
    // et voir à la fois les faces intérieures + extérieures (pas de back-face culling)
    this.islandRoot.traverse((obj: any) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) m.side = T.DoubleSide;
    });

    // Find key nodes
    this.islandRoot.traverse((o: any) => {
      const n = o.name || '';
      if (!this.mouetteNode && /^MOUETTE/i.test(n)) this.mouetteNode = o;
      if (!this.boatNode && /^boat$/i.test(n)) this.boatNode = o;
      if (!this.yamzyNode && /CharacterArmature|^yamzy/i.test(n)) this.yamzyNode = o;
    });
    this.hasYamzy.set(!!this.yamzyNode);
    this.hasBoat.set(!!this.boatNode);
    this.hasMouette.set(!!this.mouetteNode);

    // Compute island bbox + dist bounds
    const islandBbox = new T.Box3().setFromObject(this.islandRoot);
    const islandSize = new T.Vector3(); islandBbox.getSize(islandSize);
    const maxDim = Math.max(islandSize.x, islandSize.y, islandSize.z);
    this.distMin.set(Math.max(1, maxDim * 0.001));
    this.distMax.set(maxDim * 5);
    this.orbitDistance.set(maxDim * 0.4);
    this.axesHelper.scale.setScalar(maxDim / 50000);

    // Bbox helpers for targets
    const addBbox = (obj: any, color: number) => {
      if (!obj) return;
      obj.updateWorldMatrix(true, false);
      const b = new T.Box3().setFromObject(obj);
      if (!b.isEmpty()) {
        const h = new T.Box3Helper(b, color);
        this.scene.add(h);
        this.bboxHelpers.push(h);
      }
    };
    addBbox(this.yamzyNode, 0xff8800);
    addBbox(this.boatNode, 0x00bfff);
    addBbox(this.mouetteNode, 0xffffff);

    // Anim
    if (gltf.animations?.length) {
      this.mixer = new T.AnimationMixer(this.islandRoot);
      const clip = gltf.animations[0];
      this.action = this.mixer.clipAction(clip);
      this.action.setLoop(T.LoopRepeat, Infinity);
      this.action.play();
      this.duration.set(clip.duration);
      this.totalFrames.set(Math.floor(clip.duration * 30));
      console.log(`[IntroStudio] ▶ Clip "${clip.name}" duration=${clip.duration.toFixed(2)}s, ${Math.floor(clip.duration * 30)} frames @ 30fps`);
    }

    // Load saved camera if exists
    try {
      const raw = localStorage.getItem('yamzy.welcome.camera');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.target) this.target.set(p.target);
        if (typeof p.orbitDistance === 'number') this.orbitDistance.set(p.orbitDistance);
        if (typeof p.orbitYaw === 'number') this.orbitYaw.set(p.orbitYaw);
        if (typeof p.orbitPitch === 'number') this.orbitPitch.set(p.orbitPitch);
        if (typeof p.fov === 'number') { this.fov.set(p.fov); this.camera.fov = p.fov; this.camera.updateProjectionMatrix(); }
      }
    } catch {}

    // Listeners
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);

    this.updateTargetPos();
    this.animate();
  }

  private loadThree(): Promise<void> {
    return new Promise(async (res) => {
      if (!(window as any).THREE) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
      }
      if (!(window as any).THREE?.GLTFLoader) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
        await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
      }
      if (!(window as any).THREE?.TransformControls) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js');
      }
      res();
    });
  }
  private loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error(src));
      document.head.appendChild(s);
    });
  }

  // ─── Anim loop ───
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const dt = rawDt * this.speed();
    if (this.isPlaying() && this.mixer && this.action) {
      this.mixer.update(dt);
      this.currentTime.set(this.action.time % this.duration());
      this.currentFrame.set(Math.floor(this.currentTime() * 30));
    }
    // 🐦 Playback du path mouette si actif
    if (this.pathPlayback.active && this.mouetteNode && this.waypoints().length >= 2) {
      const t = Math.min(1, (this.clock.elapsedTime - this.pathPlayback.start) / this.pathPlayback.duration);
      const wps = this.waypoints();
      const T = (window as any).THREE;
      const n = wps.length - 1;
      const segT = t * n;
      const i = Math.min(Math.floor(segT), n - 1);
      const u = segT - i;
      const a = wps[i], b = wps[i + 1];
      // Position : lerp linéaire
      const worldPos = new T.Vector3(
        a.x + (b.x - a.x) * u,
        a.y + (b.y - a.y) * u,
        a.z + (b.z - a.z) * u,
      );
      // Rotation : slerp si les 2 wps ont quaternion capturé
      const hasQ = a.qw !== undefined && b.qw !== undefined;
      let worldQuat: any = null;
      if (hasQ) {
        const qA = new T.Quaternion(a.qx, a.qy, a.qz, a.qw);
        const qB = new T.Quaternion(b.qx, b.qy, b.qz, b.qw);
        worldQuat = qA.slerp(qB, u);
      }
      if (this.mouetteNode.parent) {
        this.mouetteNode.parent.updateWorldMatrix(true, false);
        // Position monde → local
        const local = worldPos.clone();
        this.mouetteNode.parent.worldToLocal(local);
        this.mouetteNode.position.copy(local);
        // Rotation monde → local (multiplie par l'inverse du quaternion parent)
        if (worldQuat) {
          const parentQ = new T.Quaternion();
          this.mouetteNode.parent.getWorldQuaternion(parentQ);
          const localQ = parentQ.invert().multiply(worldQuat);
          this.mouetteNode.quaternion.copy(localQ);
        }
      }
      if (t >= 1) { this.pathPlayback.active = false; this.flashPath('✓ Path terminé'); }
    }
    // 🛩 Free Fly : applique WASD/QE chaque frame (utilise dt non scalé pour mvt constant)
    this.applyFreeFlyMovement(rawDt);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };

  private updateTargetPos(): void {
    const T = (window as any).THREE;
    if (!T || !this.scene) return;
    const t = this.target();
    let p: any = new T.Vector3(0, 0, 0);
    if (t === 'origin') { p.set(0, 0, 0); }
    else if (t === 'islandCenter' && this.islandRoot) {
      const b = new T.Box3().setFromObject(this.islandRoot);
      b.getCenter(p);
    } else if (t === 'yamzy' && this.yamzyNode) {
      this.yamzyNode.updateWorldMatrix(true, false);
      const b = new T.Box3().setFromObject(this.yamzyNode);
      if (!b.isEmpty()) b.getCenter(p); else this.yamzyNode.getWorldPosition(p);
    } else if (t === 'boat' && this.boatNode) {
      this.boatNode.updateWorldMatrix(true, false);
      const b = new T.Box3().setFromObject(this.boatNode);
      if (!b.isEmpty()) b.getCenter(p); else this.boatNode.getWorldPosition(p);
    } else if (t === 'mouette' && this.mouetteNode) {
      this.mouetteNode.updateWorldMatrix(true, false);
      const b = new T.Box3().setFromObject(this.mouetteNode);
      if (!b.isEmpty()) b.getCenter(p); else this.mouetteNode.getWorldPosition(p);
    }
    this.targetPos.set({ x: p.x, y: p.y, z: p.z });
  }

  private updateCamera(): void {
    if (!this.camera) return;
    // 🛩 Free Fly : caméra positionnée librement, regard dérivé de yaw/pitch
    if (this.freeMode()) {
      const p = this.freeCamPos();
      const yaw = this.freeCamYaw();
      const pitch = this.freeCamPitch();
      this.camera.position.set(p.x, p.y, p.z);
      // Vecteur de regard : sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)
      const lx = p.x + Math.sin(yaw) * Math.cos(pitch);
      const ly = p.y + Math.sin(pitch);
      const lz = p.z + Math.cos(yaw) * Math.cos(pitch);
      this.camera.lookAt(lx, ly, lz);
      this.camPos.set({ x: p.x, y: p.y, z: p.z });
      return;
    }
    // Recompute target pos for animated targets (yamzy/mouette move with anim)
    if (this.target() === 'yamzy' || this.target() === 'mouette') {
      this.updateTargetPos();
    }
    const t = this.targetPos();
    const d = this.orbitDistance();
    const yaw = this.orbitYaw();
    const pitch = this.orbitPitch();
    const x = t.x + Math.sin(yaw) * d * Math.cos(pitch);
    const y = t.y + Math.sin(pitch) * d;
    const z = t.z + Math.cos(yaw) * d * Math.cos(pitch);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(t.x, t.y, t.z);
    this.camPos.set({ x, y, z });
  }

  /** Applique le déplacement Free Fly chaque frame (WASD/QE/Shift). */
  private applyFreeFlyMovement(dt: number): void {
    if (!this.freeMode()) return;
    const k = this.freeKeys;
    if (!k['w'] && !k['a'] && !k['s'] && !k['d'] && !k['q'] && !k['e']) return;
    const yaw = this.freeCamYaw();
    const pitch = this.freeCamPitch();
    // Boost si Shift maintenu (×3)
    const speed = this.freeSpeed * (k['shift'] ? 3 : 1) * dt;
    // Forward direction
    const fwdX = Math.sin(yaw) * Math.cos(pitch);
    const fwdY = Math.sin(pitch);
    const fwdZ = Math.cos(yaw) * Math.cos(pitch);
    // Right direction (yaw + 90°, pas de pitch sur le strafe)
    const rightX = Math.sin(yaw + Math.PI / 2);
    const rightZ = Math.cos(yaw + Math.PI / 2);
    const p = this.freeCamPos();
    let nx = p.x, ny = p.y, nz = p.z;
    if (k['w']) { nx += fwdX * speed; ny += fwdY * speed; nz += fwdZ * speed; }
    if (k['s']) { nx -= fwdX * speed; ny -= fwdY * speed; nz -= fwdZ * speed; }
    if (k['d']) { nx += rightX * speed; nz += rightZ * speed; }
    if (k['a']) { nx -= rightX * speed; nz -= rightZ * speed; }
    if (k['e']) { ny += speed; }
    if (k['q']) { ny -= speed; }
    this.freeCamPos.set({ x: nx, y: ny, z: nz });
  }

  // ─── Inputs ───
  private onPointerDown = (e: PointerEvent): void => {
    const tEl = e.target as HTMLElement;
    if (tEl?.closest('.is-panel') || tEl?.closest('.is-timeline')) return;
    // Si TransformControls est en train de drag son gizmo → ne fait rien (la mouette est en cours de déplacement)
    if (this.transformControls?.dragging) return;
    // Sinon orbit cam (ou free fly look si freeMode)
    this.isDragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX; this.lastY = e.clientY;
    // 🛩 Free Fly : drag souris → ajuste yaw/pitch indépendant de l'orbit
    if (this.freeMode()) {
      this.freeCamYaw.set(this.freeCamYaw() - dx * 0.005);
      this.freeCamPitch.set(Math.max(-1.5, Math.min(1.5, this.freeCamPitch() - dy * 0.005)));
      return;
    }
    this.orbitYaw.set(this.orbitYaw() - dx * 0.005);
    this.orbitPitch.set(Math.max(-1.4, Math.min(1.4, this.orbitPitch() - dy * 0.005)));
  };
  private onPointerUp = (): void => { this.isDragging = false; };
  private onWheel = (e: WheelEvent): void => {
    const tEl = e.target as HTMLElement;
    if (tEl?.closest('.is-panel') || tEl?.closest('.is-timeline')) return;
    e.preventDefault();
    // 🛩 Free Fly : wheel = avance/recule selon le regard
    if (this.freeMode()) {
      const step = -e.deltaY * 0.5 * this.freeSpeed * 0.01;
      const yaw = this.freeCamYaw(); const pitch = this.freeCamPitch();
      const dx = Math.sin(yaw) * Math.cos(pitch) * step;
      const dy = Math.sin(pitch) * step;
      const dz = Math.cos(yaw) * Math.cos(pitch) * step;
      const p = this.freeCamPos();
      this.freeCamPos.set({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
      return;
    }
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const d = this.orbitDistance() * factor;
    this.orbitDistance.set(Math.max(this.distMin(), Math.min(this.distMax(), d)));
  };
  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth - 320, h = window.innerHeight - 56;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
