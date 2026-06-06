// ════════════════════════════════════════════════════════════════════════
// 🛠 WORLD MAP — Éditeur de zone (route /world-map/edit/:zoneKey)
//
// Workflow :
//   1. Charger l'île de fond (treasure-island.glb) en référence/contexte
//   2. Charger le GLB existant de la zone (islandGlb) s'il existe
//   3. Permettre d'IMPORTER un nouveau GLB (drag-drop ou bouton)
//   4. TransformControls Blender-way (G=translate, R=rotate, S=scale, Esc=deselect)
//   5. SAUVEGARDER :
//      • Transform locale → localStorage (lu par world-map au chargement)
//      • GLB complet (transforms appliquées) → download → user dépose dans
//        src/assets/conclave/models/island-{zoneKey}.glb
// ════════════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { getMarker, MapMarker, STORAGE_KEY_PREFIX } from './world-map.markers';
import { saveZoneGlb, loadZoneGlb, deleteZoneGlb } from './world-map.storage';

@Component({
  selector: 'wt-world-map-zone-editor',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ze-host" (dragover)="onDragOver($event)" (drop)="onDrop($event)">
      <canvas #canvas class="ze-canvas"></canvas>

      <header class="ze-topbar">
        <button class="ze-back" (click)="back()">← Retour</button>
        <div class="ze-title">
          <span class="ze-dot" [style.background]="hexColor()"></span>
          ÉDITION : {{ marker()?.label || zoneKey() }}
        </div>
        <div class="ze-status">{{ status() }}</div>
      </header>

      <aside class="ze-panel">
        <div class="ze-section">
          <div class="ze-label">📥 Source</div>
          <div class="ze-glb-path">{{ marker()?.islandGlb }}</div>
          <input #fileInput type="file" accept=".glb" hidden (change)="onFilePick($event)" />
          <button class="ze-btn ze-btn-primary" (click)="fileInput.click()">📁 Importer GLB…</button>
          <div class="ze-hint">…ou drag-drop un .glb sur la scène</div>
        </div>

        <div class="ze-section">
          <div class="ze-label">🗺 Map de référence</div>
          <button class="ze-btn" (click)="toggleReference()">
            {{ showReference() ? '🙈 Masquer' : '👁 Afficher' }} treasure-island.glb
          </button>
          <div class="ze-hint">
            Map semi-transparente, scale auto-fit identique à /world-map.<br>
            Le point coloré = ancrage marker. Ton GLB est positionné DESSUS.
          </div>
        </div>

        <div class="ze-section">
          <div class="ze-label">🎮 Mode TransformControls</div>
          <div class="ze-mode-row">
            <button class="ze-mode" [class.is-active]="mode()==='translate'" (click)="setMode('translate')">G translate</button>
            <button class="ze-mode" [class.is-active]="mode()==='rotate'"    (click)="setMode('rotate')">R rotate</button>
            <button class="ze-mode" [class.is-active]="mode()==='scale'"     (click)="setMode('scale')">S scale</button>
          </div>
          <div class="ze-hint">Raccourcis : G / R / S · Esc = deselect</div>
        </div>

        <div class="ze-section">
          <div class="ze-label">📐 Transform actuelle</div>
          <div class="ze-tr">pos : {{ posText() }}</div>
          <div class="ze-tr">rot : {{ rotText() }}</div>
          <div class="ze-tr">scl : {{ sclText() }}</div>
          <button class="ze-btn" (click)="resetTransform()">⟲ Reset transform</button>
        </div>

        <div class="ze-section">
          <div class="ze-label">💾 Sauvegarder</div>
          <button class="ze-btn ze-btn-ok" (click)="saveTransform()">💾 Sauver sur la map (GLB + transform)</button>
          <div class="ze-hint">
            Le GLB est stocké dans IndexedDB.<br>
            Visible sur <code>/world-map</code> après refresh.
          </div>
          <button class="ze-btn" (click)="clearZoneGlb()">🗑 Supprimer GLB de cette zone</button>
          <button class="ze-btn" (click)="exportGLB()">📦 Télécharger GLB (.glb)</button>
        </div>

        <div class="ze-section ze-section--info">
          <div class="ze-label">ℹ️ Marqueur Blender</div>
          <div class="ze-tr">
            Dans treasure-island.glb, ajouter un Empty nommé :<br>
            <code>{{ marker()?.blenderName }}</code>
          </div>
          <div class="ze-tr ze-muted">{{ marker()?.description }}</div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
    .ze-host {
      position: relative;
      width: 100%; height: 100%;
      background: radial-gradient(circle at 50% 40%, #1a1a2e 0%, #050617 80%);
      color: #fff;
      font-family: "Tinos", serif;
    }
    .ze-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .ze-topbar {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 20;
      display: flex; align-items: center; gap: 16px;
      padding: 10px 18px;
      background: linear-gradient(180deg, rgba(0,0,0,0.65), rgba(0,0,0,0));
      pointer-events: none;
    }
    .ze-back, .ze-mode, .ze-btn { pointer-events: auto; }
    .ze-back {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(213,74,223,0.4);
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    }
    .ze-back:hover { background: rgba(213,74,223,0.2); }
    .ze-title {
      display: flex; align-items: center; gap: 10px;
      font-family: "Henny Penny", cursive;
      font-size: 18px;
      letter-spacing: 0.08em;
    }
    .ze-dot { width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
    .ze-status { margin-left: auto; font-size: 12px; opacity: 0.8; pointer-events: auto; }
    .ze-panel {
      position: fixed;
      top: 60px; right: 16px;
      z-index: 12;
      width: 290px;
      max-height: calc(100vh - 90px);
      overflow: auto;
      display: flex; flex-direction: column;
      gap: 14px;
      background: rgba(8,10,24,0.75);
      padding: 14px;
      border-radius: 10px;
      border: 1px solid rgba(213,74,223,0.35);
      backdrop-filter: blur(8px);
    }
    .ze-section { display: flex; flex-direction: column; gap: 6px; }
    .ze-section--info { opacity: 0.85; font-size: 12px; }
    .ze-label {
      font-family: "Henny Penny", cursive;
      font-size: 12px;
      letter-spacing: 0.12em;
      color: #d54adf;
      text-transform: uppercase;
    }
    .ze-glb-path { font-size: 11px; opacity: 0.7; word-break: break-all; font-family: monospace; }
    .ze-hint { font-size: 10.5px; opacity: 0.6; }
    .ze-tr { font-size: 11px; font-family: monospace; opacity: 0.85; }
    .ze-muted { font-style: italic; opacity: 0.5; margin-top: 4px; }
    code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
    .ze-mode-row { display: flex; gap: 4px; }
    .ze-mode {
      flex: 1;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(213,74,223,0.3);
      color: #fff;
      padding: 5px 4px;
      border-radius: 5px;
      font-size: 10.5px;
      cursor: pointer;
      font-family: inherit;
    }
    .ze-mode:hover { background: rgba(213,74,223,0.15); }
    .ze-mode.is-active { background: rgba(213,74,223,0.35); border-color: #d54adf; }
    .ze-btn {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(213,74,223,0.4);
      color: #fff;
      padding: 7px 10px;
      border-radius: 5px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      transition: background 0.15s;
    }
    .ze-btn:hover { background: rgba(213,74,223,0.18); }
    .ze-btn-primary { background: rgba(213,74,223,0.25); }
    .ze-btn-ok { border-color: rgba(134,239,172,0.5); }
    .ze-btn-ok:hover { background: rgba(134,239,172,0.18); }
  `],
})
export class WorldMapZoneEditorComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  zoneKey = signal<string>('');
  marker = signal<MapMarker | undefined>(undefined);
  status = signal<string>('Chargement…');
  mode = signal<'translate' | 'rotate' | 'scale'>('translate');
  posText = signal<string>('—');
  rotText = signal<string>('—');
  sclText = signal<string>('—');

  hexColor(): string {
    const c = this.marker()?.color;
    return c == null ? '#888' : '#' + c.toString(16).padStart(6, '0');
  }

  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private transformControls: any;
  private editObj: any = null;             // L'île éditable
  /** Blob original importé/chargé — sauvegardé tel quel pour éviter le re-encodage GLTFExporter (lent sur gros GLBs). */
  private sourceBlob: Blob | null = null;
  /** treasure-island.glb chargée en référence (semi-transparente) pour comparer tailles/positions. */
  private referenceMap: any = null;
  /** Group ancré à la position WORLD du marker — parent de editObj (mirror du /world-map). */
  private editContainer: any = null;
  /** Position WORLD du marker correspondant à cette zone. */
  private markerWorldPos = { x: 0, y: 0, z: 0 };
  private rafId = 0;
  private disposed = false;

  // Toggle d'affichage de la map de référence
  showReference = signal<boolean>(true);
  toggleReference(): void {
    const v = !this.showReference();
    this.showReference.set(v);
    if (this.referenceMap) this.referenceMap.visible = v;
  }

  // Orbit (centré sur le marker une fois la map chargée)
  private orbitYaw = 0;
  private orbitPitch = 0.5;
  private orbitDistance = 1.2;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  ngOnInit(): void {
    const k = this.route.snapshot.paramMap.get('zoneKey') || '';
    this.zoneKey.set(k);
    const m = getMarker(k);
    this.marker.set(m);
    if (!m) {
      this.status.set('Zone inconnue : ' + k);
      return;
    }
    this.bootstrap();
  }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    try { this.renderer?.dispose(); } catch {}
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  back(): void {
    // ⚡ Hard navigation : bypass router + wildcard `** → conclave`
    // (history.back() pourrait revenir sur /welcome qui re-redirige)
    window.location.href = '/world-map';
  }

  setMode(m: 'translate' | 'rotate' | 'scale'): void {
    this.mode.set(m);
    if (this.transformControls) this.transformControls.setMode(m);
  }

  resetTransform(): void {
    if (!this.editObj) return;
    this.editObj.position.set(0, 0, 0);
    this.editObj.rotation.set(0, 0, 0);
    this.editObj.scale.set(1, 1, 1);
    this.refreshTransformText();
    this.status.set('⟲ Transform reset');
  }

  async saveTransform(): Promise<void> {
    if (!this.editObj || !this.marker()) {
      console.warn('[ZoneEditor] Save : pas d\'editObj ou marker');
      return;
    }
    const key = this.marker()!.key;
    console.log(`[ZoneEditor] 💾 Save zone "${key}" — début`);

    // 1. Sauve la transform (pos/rot/scl) dans localStorage
    const tr = {
      pos: [this.editObj.position.x, this.editObj.position.y, this.editObj.position.z],
      rot: [this.editObj.rotation.x, this.editObj.rotation.y, this.editObj.rotation.z],
      scl: [this.editObj.scale.x,    this.editObj.scale.y,    this.editObj.scale.z],
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(tr));
    console.log(`[ZoneEditor] ✓ Transform localStorage : pos=${tr.pos.map(v => v.toFixed(2))}, scl=${tr.scl.map(v => v.toFixed(2))}`);

    // 2. Sauve le GLB binaire — Blob brut si disponible (RAPIDE), sinon re-encode
    this.status.set('💾 Sauvegarde GLB en cours…');
    let blob: Blob | null = this.sourceBlob;
    if (blob) {
      console.log(`[ZoneEditor] ✓ Réutilisation Blob source (${(blob.size / 1024 / 1024).toFixed(2)} MB) — pas de re-encodage`);
    } else {
      console.log(`[ZoneEditor] ⚠ Pas de sourceBlob → re-encodage via GLTFExporter…`);
      const T = (window as any).THREE;
      if (!T?.GLTFExporter) { this.status.set('GLTFExporter non chargé'); return; }
      try {
        blob = await new Promise<Blob>((res, rej) => {
          const exporter = new T.GLTFExporter();
          const timeout = setTimeout(() => rej(new Error('GLTFExporter timeout 60s')), 60000);
          exporter.parse(this.editObj, (result: any) => {
            clearTimeout(timeout);
            res(new Blob([result], { type: 'model/gltf-binary' }));
          }, { binary: true });
        });
        console.log(`[ZoneEditor] ✓ GLTFExporter ok (${(blob.size / 1024).toFixed(0)} KB)`);
      } catch (e: any) {
        console.error('[ZoneEditor] Erreur GLTFExporter', e);
        this.status.set('Erreur export GLB : ' + (e?.message || e));
        return;
      }
    }

    // 3. Persiste dans IndexedDB
    try {
      await saveZoneGlb(key, blob);
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      console.log(`[ZoneEditor] ✓ IndexedDB sauvegardé pour "${key}" (${sizeMB} MB)`);
      this.status.set(`✓ Sauvegardé (${sizeMB} MB) — Ctrl+F5 sur /world-map`);
    } catch (e: any) {
      console.error('[ZoneEditor] Erreur IndexedDB', e);
      this.status.set('Erreur IndexedDB : ' + (e?.message || e));
    }
  }

  async clearZoneGlb(): Promise<void> {
    if (!this.marker()) return;
    const key = this.marker()!.key;
    try {
      await deleteZoneGlb(key);
      localStorage.removeItem(STORAGE_KEY_PREFIX + key);
      this.status.set('🗑 GLB + transform supprimés de la zone');
    } catch (e: any) {
      this.status.set('Erreur suppression : ' + (e?.message || e));
    }
  }

  exportGLB(): void {
    const T = (window as any).THREE;
    if (!this.editObj || !T?.GLTFExporter) { this.status.set('Rien à exporter ou exporter non chargé'); return; }
    const exporter = new T.GLTFExporter();
    exporter.parse(this.editObj, (result: any) => {
      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `island-${this.marker()!.key}.glb`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.status.set('📦 GLB téléchargé — dépose-le à ' + this.marker()!.islandGlb);
    }, { binary: true });
  }

  // ─── Drag-drop GLB ───
  onDragOver(e: DragEvent): void { e.preventDefault(); }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.glb')) this.loadFile(file);
  }
  onFilePick(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.loadFile(file);
  }
  private loadFile(file: File): void {
    const T = (window as any).THREE;
    console.log(`[ZoneEditor] 📥 Import ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    this.status.set(`📥 Chargement ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)…`);
    const url = URL.createObjectURL(file);
    const loader = new T.GLTFLoader();
    loader.load(url, (gltf: any) => {
      this.replaceEditObject(gltf.scene);
      this.sourceBlob = file;   // 🔑 garde le Blob brut pour sauvegarde rapide
      URL.revokeObjectURL(url);
      console.log(`[ZoneEditor] ✓ ${file.name} chargé dans la scène`);
      this.status.set(`📥 ${file.name} importé — bouge avec G/R/S puis Sauver`);
    }, undefined, (err: any) => {
      console.error('[ZoneEditor] Erreur import', err);
      this.status.set('Erreur import ' + file.name);
    });
  }

  // ─── Three.js bootstrap ───
  private async bootstrap(): Promise<void> {
    await this.loadThreeJs();
    if (this.disposed) return;
    const T = (window as any).THREE;

    this.scene = new T.Scene();
    this.scene.background = null;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace || 3001;
    this.camera = new T.PerspectiveCamera(45, w / h, 0.05, 50);
    this.clock = new T.Clock();

    // Lumière sobre (même profil que world-map)
    this.scene.add(new T.AmbientLight(0xffffff, 0.45));
    const sun = new T.DirectionalLight(0xfff0d8, 0.55);
    sun.position.set(2, 4, 2);
    this.scene.add(sun);

    // Grille de référence (sol éditeur)
    const grid = new T.GridHelper(2, 20, 0x4a4a6a, 0x2a2a3a);
    (grid.material as any).opacity = 0.25;
    (grid.material as any).transparent = true;
    this.scene.add(grid);

    // Axes 3D (mini, pour orientation)
    const axes = new T.AxesHelper(0.2);
    this.scene.add(axes);

    // 🗺 Charge la map (treasure-island.glb) en référence semi-transparente
    // + crée editContainer ancré sur le marker → IDENTIQUE à /world-map
    await this.loadReferenceMap(T);

    // TransformControls
    if (T.TransformControls) {
      this.transformControls = new T.TransformControls(this.camera, canvas);
      this.transformControls.setMode(this.mode());
      this.transformControls.setSize(0.7);
      this.transformControls.addEventListener('dragging-changed', (e: any) => {
        // Désactive l'orbite tant qu'on drag un gizmo
        this.isDragging = e.value ? false : this.isDragging;
      });
      this.transformControls.addEventListener('change', () => this.refreshTransformText());
      this.scene.add(this.transformControls);
    }

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);

    // Tentative de charger le GLB existant
    await this.tryLoadExistingZoneGlb(T);

    this.animate();
    this.status.set(this.editObj ? 'Prêt — drag les gizmos ou import un nouveau GLB' : 'Aucun GLB pour cette zone — importe-en un');
  }

  private async tryLoadExistingZoneGlb(T: any): Promise<void> {
    const m = this.marker();
    if (!m) return;
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }
    // 1. Tente IndexedDB (sauvegarde utilisateur)
    let gltf: any = null;
    try {
      const blob = await loadZoneGlb(m.key);
      if (blob) {
        console.log(`[ZoneEditor] ✓ Blob trouvé en IndexedDB (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        const url = URL.createObjectURL(blob);
        gltf = await new Promise<any>((res, rej) => loader.load(url, res, undefined, rej));
        URL.revokeObjectURL(url);
        this.sourceBlob = blob;   // 🔑 garde pour resave rapide
        this.status.set('✓ GLB chargé depuis IndexedDB');
      } else {
        console.log(`[ZoneEditor] · Aucun GLB en IndexedDB pour "${m.key}"`);
      }
    } catch (e) {
      console.warn('[ZoneEditor] Erreur lecture IndexedDB', e);
    }
    // 2. Fallback : GLB statique dans /assets/
    if (!gltf) {
      try {
        gltf = await new Promise<any>((res, rej) => loader.load(m.islandGlb, res, undefined, rej));
      } catch { /* GLB absent — l'utilisateur va en importer un */ }
    }
    if (this.disposed || !gltf) return;
    this.replaceEditObject(gltf.scene);
    // Applique la transform sauvegardée (pos/rot/scl)
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + m.key);
      if (saved && this.editObj) {
        const tr = JSON.parse(saved);
        if (Array.isArray(tr.pos)) this.editObj.position.set(tr.pos[0], tr.pos[1], tr.pos[2]);
        if (Array.isArray(tr.rot)) this.editObj.rotation.set(tr.rot[0], tr.rot[1], tr.rot[2]);
        if (Array.isArray(tr.scl)) this.editObj.scale.set(tr.scl[0], tr.scl[1], tr.scl[2]);
        this.refreshTransformText();
      }
    } catch {}
  }

  private replaceEditObject(newObj: any): void {
    if (this.editObj) {
      const oldParent = this.editObj.parent || this.scene;
      oldParent.remove(this.editObj);
      if (this.transformControls) this.transformControls.detach();
    }
    this.editObj = newObj;
    // ⚡ Parent = editContainer (ancré au marker) — pareil que /world-map
    const parent = this.editContainer || this.scene;
    parent.add(this.editObj);
    if (this.transformControls) this.transformControls.attach(this.editObj);
    this.refreshTransformText();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🗺 Charge treasure-island.glb en référence + ancre l'éditeur au marker
  // Applique le MÊME auto-fit que /world-map (scale 1/max(planeX,Z) + center Plane_2)
  // → la taille/position que tu donnes à ton GLB ici = exactement celle sur la map
  // ═══════════════════════════════════════════════════════════════════
  private async loadReferenceMap(T: any): Promise<void> {
    const m = this.marker();
    if (!m) return;
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }
    let gltf: any;
    try {
      gltf = await new Promise<any>((res, rej) =>
        loader.load('/assets/conclave/models/treasure-island.glb', res, undefined, rej));
    } catch (e) {
      console.warn('[ZoneEditor] Reference map load failed', e);
      this.fallbackContainer(T);
      return;
    }
    if (this.disposed) return;

    const island = gltf.scene;
    island.name = 'reference_treasure_island';
    this.scene.add(island);

    // Auto-fit IDENTIQUE à /world-map
    let planeNode: any = null;
    island.traverse((o: any) => { if (!planeNode && o.name === 'Plane_2') planeNode = o; });
    if (!planeNode) planeNode = island;
    island.updateWorldMatrix(true, true);
    const refBbox = new T.Box3().setFromObject(planeNode);
    const refSize = new T.Vector3(); refBbox.getSize(refSize);
    const scale = 1.0 / Math.max(refSize.x, refSize.z);
    island.scale.setScalar(scale);
    island.updateWorldMatrix(true, true);
    const finalRefBbox = new T.Box3().setFromObject(planeNode);
    const finalCenter = new T.Vector3(); finalRefBbox.getCenter(finalCenter);
    island.position.sub(finalCenter);
    island.updateWorldMatrix(true, true);

    // Cherche le marker de cette zone et récupère sa position WORLD
    let markerNode: any = null;
    island.traverse((o: any) => { if (!markerNode && o.name === m.blenderName) markerNode = o; });
    if (markerNode) {
      markerNode.updateWorldMatrix(true, false);
      const wp = new T.Vector3();
      markerNode.getWorldPosition(wp);
      this.markerWorldPos = { x: wp.x, y: wp.y, z: wp.z };
      console.log(`[ZoneEditor] ✓ ${m.blenderName} world pos = (${wp.x.toFixed(3)}, ${wp.y.toFixed(3)}, ${wp.z.toFixed(3)})`);
    } else {
      console.warn(`[ZoneEditor] ⚠ ${m.blenderName} introuvable dans le GLB — éditeur ancré à l'origine`);
    }

    // Matériaux semi-transparents pour voir l'objet édité à travers
    island.traverse((obj: any) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        mat.transparent = true;
        mat.opacity = 0.45;
        mat.depthWrite = false;
      }
    });
    this.referenceMap = island;

    // Crée le container ancré au marker
    this.editContainer = new T.Group();
    this.editContainer.position.set(this.markerWorldPos.x, this.markerWorldPos.y, this.markerWorldPos.z);
    this.editContainer.name = `edit_container_${m.key}`;
    this.scene.add(this.editContainer);

    // Petit indicateur visuel du point d'ancrage (sphère colorée)
    const dot = new T.Mesh(
      new T.SphereGeometry(0.012, 16, 12),
      new T.MeshBasicMaterial({ color: m.color }),
    );
    this.editContainer.add(dot);
  }

  /** Si la map de référence n'a pas pu être chargée → container à l'origine. */
  private fallbackContainer(T: any): void {
    this.editContainer = new T.Group();
    this.editContainer.name = 'edit_container_fallback';
    this.scene.add(this.editContainer);
  }

  private refreshTransformText(): void {
    if (!this.editObj) return;
    const p = this.editObj.position;
    const r = this.editObj.rotation;
    const s = this.editObj.scale;
    const f = (x: number) => x.toFixed(3);
    this.posText.set(`(${f(p.x)}, ${f(p.y)}, ${f(p.z)})`);
    this.rotText.set(`(${f(r.x)}, ${f(r.y)}, ${f(r.z)})`);
    this.sclText.set(`(${f(s.x)}, ${f(s.y)}, ${f(s.z)})`);
  }

  private async loadThreeJs(): Promise<void> {
    if ((window as any).THREE?.TransformControls && (window as any).THREE?.GLTFExporter) return;
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
    if (!(window as any).THREE?.GLTFExporter) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js');
    }
  }
  private loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('script load failed ' + src));
      document.head.appendChild(s);
    });
  }

  // ─── Render loop ───
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };

  private updateCamera(): void {
    if (!this.camera) return;
    const t = this.markerWorldPos;
    const x = t.x + Math.sin(this.orbitYaw) * this.orbitDistance * Math.cos(this.orbitPitch);
    const y = t.y + Math.sin(this.orbitPitch) * this.orbitDistance;
    const z = t.z + Math.cos(this.orbitYaw) * this.orbitDistance * Math.cos(this.orbitPitch);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(t.x, t.y, t.z);
  }

  // ─── Inputs ───
  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
  private onPointerDown = (e: PointerEvent): void => {
    const t = e.target as HTMLElement;
    if (t?.closest('.ze-panel') || t?.closest('.ze-topbar')) return;
    // Si le gizmo TransformControls est draggé, il s'occupe du pointer lui-même
    if (this.transformControls?.dragging) return;
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.orbitYaw -= dx * 0.005;
    this.orbitPitch -= dy * 0.005;
    this.orbitPitch = Math.max(0.1, Math.min(1.4, this.orbitPitch));
  };
  private onPointerUp = (): void => { this.isDragging = false; };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.orbitDistance = Math.max(0.4, Math.min(10, this.orbitDistance + Math.sign(e.deltaY) * 0.2));
  };
  private onKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case 'g': this.setMode('translate'); break;
      case 'r': this.setMode('rotate'); break;
      case 's': this.setMode('scale'); break;
      case 'escape': if (this.transformControls) this.transformControls.detach(); break;
    }
  };
}
