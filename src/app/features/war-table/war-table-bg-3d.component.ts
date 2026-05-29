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

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (this.THREE && !this.disposed) {
      this.initScene();
      this.loadModel();
      this.animate();
      window.addEventListener('resize', this.onResize);
    }
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
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

    if (this.model) {
      this.model.rotation.y += this.rotationSpeed * delta * 60;  // normalisé 60fps
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
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
