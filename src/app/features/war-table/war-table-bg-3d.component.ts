// WAR TABLE ⚔ — Background 3D Three.js (alchemy_table.glb en rotation lente).
// Plein écran, z-index 0, pointer-events:none → l'UI passe au-dessus.
// Overlay sombre semi-transparent sur le rendu pour garantir la lisibilité.

import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-war-table-bg-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <canvas #canvas></canvas>
    <div class="bg-3d-overlay"></div>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    /* v1.0.177fo : en mode 3D edit, le host passe en pointer-events:auto pour permettre orbit */
    :host(.is-3d-edit) { pointer-events: auto !important; z-index: 99100 !important; cursor: grab; }
    :host(.is-3d-edit):active { cursor: grabbing; }
    /* v1.0.177fo : en mode 3D edit, overlay disabled pour ne pas assombrir la scène */
    :host(.is-3d-edit) .bg-3d-overlay { display: none !important; }
    canvas {
      width: 100%; height: 100%;
      display: block;
    }
    .bg-3d-overlay {
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse at 25% 12%, rgba(139,127,214,.08) 0%, transparent 55%),
        radial-gradient(ellipse at 80% 85%, rgba(194,93,141,.05) 0%, transparent 50%),
        linear-gradient(180deg,
          rgba(43,37,73,.15) 0%,
          rgba(39,32,66,.22) 60%,
          rgba(33,27,58,.35) 100%);
      pointer-events: none;
    }
  `]
})
export class WarTableBg3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  @Input() glbUrl = '/assets/scenes/alchemy_table.glb';
  @Input() rotationSpeed = 0.0012;  // très lent (rad/frame ≈ 0.07°/frame)

  private THREE: any;
  private GLTFLoader: any;
  private renderer: any;
  private scene: any;
  private camera: any;
  private model: any;
  private clock: any;
  private animFrameId: any;
  private disposed = false;

  // v1.0.177fo — Mode 3D edit avec OrbitControls
  private editMode = false;
  private orbitControls: any = null;
  private initialCameraPos: any = null;  // sauvegarde pour reset
  private initialCameraTarget: any = null;
  private modelMaxDim = 5;  // utilisé pour les presets caméra

  constructor(private hostRef: ElementRef<HTMLElement>) {}

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (this.THREE && !this.disposed) {
      this.initScene();
      this.loadModel();
      this.animate();
      window.addEventListener('resize', this.onResize);
      // v1.0.177fo — Listeners pour le mode 3D edit + presets caméra
      window.addEventListener('yamzy:camera-edit-mode', this.onCameraEditMode as any);
      window.addEventListener('yamzy:camera-preset', this.onCameraPreset as any);
    }
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    // v1.0.177fo — Cleanup listeners 3D edit
    window.removeEventListener('yamzy:camera-edit-mode', this.onCameraEditMode as any);
    window.removeEventListener('yamzy:camera-preset', this.onCameraPreset as any);
    if (this.orbitControls) { try { this.orbitControls.dispose(); } catch {} }
    if (this.renderer) {
      try { this.renderer.dispose(); } catch {}
      try { this.renderer.forceContextLoss?.(); } catch {}
    }
    if (this.model && this.scene) {
      this.scene.remove(this.model);
      this.disposeNode(this.model);
    }
  }

  private initScene() {
    const T = this.THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);  // transparent
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;  // v1.0.2 : plus lumineux

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(38, w / h, 0.1, 200);
    this.camera.position.set(0, 2, 12);

    // ── Lighting v1.0.2 : doux + chaud ──
    const hemi = new T.HemisphereLight(0xfff0d4, 0x4a3f7a, 1.2);  // ciel chaud / sol violet
    hemi.position.set(0, 8, 0);
    this.scene.add(hemi);

    const ambient = new T.AmbientLight(0xfff5e6, 0.95);  // ↑ 0.5 → 0.95
    this.scene.add(ambient);

    const key = new T.DirectionalLight(0xffeedd, 0.7);   // ↓ 1.0 → 0.7 (moins dur)
    key.position.set(3, 6, 4);
    this.scene.add(key);

    const fill = new T.DirectionalLight(0xd99a51, 0.6);  // doré au lieu de violet
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);

    const rim = new T.PointLight(0xd99a51, 0.8, 50);     // ↑
    rim.position.set(0, 7, -6);
    this.scene.add(rim);

    const accent = new T.PointLight(0xc25d8d, 0.55, 35); // ↑
    accent.position.set(-5, -2, 3);
    this.scene.add(accent);

    // Top-light pour éclaircir le plateau
    const top = new T.PointLight(0xfff0d4, 0.7, 25);
    top.position.set(0, 5, 2);
    this.scene.add(top);

    this.clock = new T.Clock();
  }

  private loadModel() {
    if (!this.GLTFLoader) return;
    const T = this.THREE;
    const loader = new this.GLTFLoader();

    loader.load(this.glbUrl, (gltf: any) => {
      if (this.disposed) return;
      this.model = gltf.scene;

      // Center + fit dans le frustum de la caméra
      const box = new T.Box3().setFromObject(this.model);
      const center = new T.Vector3();
      box.getCenter(center);
      this.model.position.sub(center);

      const size = box.getSize(new T.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = maxDim / (2 * Math.tan(fov / 2));

      // Distance + hauteur caméra pour cadrage "studio depuis le ciel"
      this.camera.position.set(0, dist * 0.35, dist * 1.55);
      this.camera.lookAt(0, -dist * 0.05, 0);

      // v1.0.177fo — Sauvegarde des positions initiales pour reset + mémorise modelMaxDim
      this.initialCameraPos = this.camera.position.clone();
      this.initialCameraTarget = new T.Vector3(0, -dist * 0.05, 0);
      this.modelMaxDim = maxDim;

      this.scene.add(this.model);
      console.log('[war-table-bg-3d] ✓ alchemy_table.glb loaded');
    },
    undefined,
    (err: any) => console.warn('[war-table-bg-3d] Failed to load', this.glbUrl, err));
  }

  private animate = () => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock?.getDelta() || 0.016;

    // v1.0.177fo — En mode 3D edit, on stoppe la rotation auto + update OrbitControls
    if (this.model && !this.editMode) {
      this.model.rotation.y += this.rotationSpeed * delta * 60;  // normalisé 60fps
    }
    if (this.orbitControls && this.editMode) {
      this.orbitControls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // v1.0.177fo — Active/désactive le mode 3D edit (OrbitControls + classe host)
  private onCameraEditMode = (event: any) => {
    const enabled = !!event?.detail;
    this.editMode = enabled;
    const host = this.hostRef?.nativeElement;
    if (host) {
      if (enabled) host.classList.add('is-3d-edit');
      else host.classList.remove('is-3d-edit');
    }
    // Active/désactive OrbitControls
    if (enabled) {
      this.ensureOrbitControls();
    } else if (this.orbitControls) {
      try { this.orbitControls.enabled = false; } catch {}
    }
  }

  // v1.0.177fo — Charge OrbitControls si pas encore fait, l'attache au canvas
  private async ensureOrbitControls() {
    if (this.orbitControls) {
      this.orbitControls.enabled = true;
      return;
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    const OC = (window as any).THREE?.OrbitControls;
    if (!OC || !this.camera || !this.renderer) return;
    this.orbitControls = new OC(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.enableZoom = true;
    this.orbitControls.minDistance = this.modelMaxDim * 0.5;
    this.orbitControls.maxDistance = this.modelMaxDim * 6;
    if (this.initialCameraTarget) this.orbitControls.target.copy(this.initialCameraTarget);
    this.orbitControls.update();
  }

  // v1.0.177fo — Applique un preset de vue à la caméra ('top'|'front'|'side'|'iso'|'three_quarters'|'reset'|'save')
  private onCameraPreset = (event: any) => {
    const preset: string = event?.detail;
    if (!this.camera || !this.THREE) return;
    const T = this.THREE;
    const d = this.modelMaxDim;
    const target = this.initialCameraTarget || new T.Vector3(0, 0, 0);
    const newPos = new T.Vector3();
    switch (preset) {
      case 'top':            newPos.set(0,      d * 2.5, 0.001); break;  // 0.001 z pour éviter gimbal lock
      case 'front':          newPos.set(0,      d * 0.2, d * 2.2); break;
      case 'side':           newPos.set(d * 2.2, d * 0.2, 0); break;
      case 'iso':            newPos.set(d * 1.6, d * 1.4, d * 1.6); break;
      case 'three_quarters': newPos.set(d * 1.4, d * 0.8, d * 1.8); break;
      case 'reset':
        if (this.initialCameraPos) newPos.copy(this.initialCameraPos);
        else newPos.set(0, d * 0.4, d * 1.6);
        break;
      case 'save':
        // Sauvegarde la vue actuelle dans localStorage
        try {
          const view = {
            pos: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
            target: this.orbitControls ? {
              x: this.orbitControls.target.x, y: this.orbitControls.target.y, z: this.orbitControls.target.z
            } : { x: 0, y: 0, z: 0 }
          };
          localStorage.setItem('yamzy:camera:saved', JSON.stringify(view));
          console.log('[war-table-bg-3d] ✓ Camera view saved', view);
        } catch (e) { console.warn('[war-table-bg-3d] Save failed', e); }
        return;
      default: return;
    }
    // Anim simple vers la nouvelle position
    this.animateCameraTo(newPos, target);
  }

  // v1.0.177fo — Tween caméra vers une position cible (interpolation linéaire 30 frames)
  private animateCameraTo(newPos: any, newTarget: any) {
    if (!this.camera || !this.THREE) return;
    const startPos = this.camera.position.clone();
    const startTarget = this.orbitControls?.target?.clone() || new this.THREE.Vector3(0, 0, 0);
    const frames = 28;
    let f = 0;
    const step = () => {
      f++;
      const t = Math.min(1, f / frames);
      const ease = 1 - Math.pow(1 - t, 3);  // easeOutCubic
      this.camera.position.lerpVectors(startPos, newPos, ease);
      const tgt = new this.THREE.Vector3().lerpVectors(startTarget, newTarget, ease);
      this.camera.lookAt(tgt);
      if (this.orbitControls) {
        this.orbitControls.target.copy(tgt);
        this.orbitControls.update();
      }
      if (f < frames && !this.disposed) requestAnimationFrame(step);
    };
    step();
  }

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private disposeNode(node: any) {
    if (!node) return;
    node.traverse((child: any) => {
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
        else child.material.dispose?.();
      }
    });
  }

  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    this.THREE = (window as any).THREE;
    if (this.THREE && !(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    this.GLTFLoader = (window as any).THREE?.GLTFLoader;
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
}
