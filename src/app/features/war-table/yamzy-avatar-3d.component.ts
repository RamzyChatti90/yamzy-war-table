// WAR TABLE ⚔ — Mini avatar 3D Yamzy pour le Sage panel (foreground).
// Charge YAMZY.glb, anime rotation + idle bobbing, transparent background.

import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-yamzy-avatar-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ya3d-wrap">
      <canvas #canvas></canvas>
      <div *ngIf="loadFailed" class="ya3d-fallback">⚔</div>
    </div>
  `,
  styles: [`
    .ya3d-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: block;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .ya3d-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 72px;
      color: #b6e08a;
      filter: drop-shadow(0 4px 16px rgba(112, 185, 68, .65));
    }
  `]
})
export class YamzyAvatar3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  @Input() glbUrl = '/assets/agents/YAMZY.glb';
  @Input() rotate = true;
  /** Tint optionnel (vert quand actif, etc.). Si null, GLB natif. */
  @Input() tintColor: string | null = null;

  loadFailed = false;

  private THREE: any;
  private GLTFLoader: any;
  private renderer: any;
  private scene: any;
  private camera: any;
  private model: any;
  private clock: any;
  private mixer: any = null;
  private animFrameId: any;
  private disposed = false;
  private bobPhase = 0;

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (!this.THREE || this.disposed) { this.loadFailed = true; return; }
    this.initScene();
    this.loadModel();
    this.animate();
    window.addEventListener('resize', this.onResize);
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
    const w = canvas.clientWidth || 280;
    const h = canvas.clientHeight || 280;

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);  // transparent
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(35, w / h, 0.1, 100);
    this.camera.position.set(0, 1.5, 4);

    // Lighting cinématique — chaud + glow
    const hemi = new T.HemisphereLight(0xfff5e6, 0x4a3f7a, 1.1);
    this.scene.add(hemi);
    const ambient = new T.AmbientLight(0xfff0d4, 0.85);
    this.scene.add(ambient);
    const key = new T.DirectionalLight(0xffeedd, 0.9);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    const accent = new T.PointLight(0x70b944, 0.7, 12); // glow vert pour cohérence Sage panel
    accent.position.set(-2, 2, 2);
    this.scene.add(accent);

    this.clock = new T.Clock();
  }

  private loadModel() {
    if (!this.GLTFLoader) { this.loadFailed = true; return; }
    const T = this.THREE;
    const loader = new this.GLTFLoader();
    loader.load(this.glbUrl, (gltf: any) => {
      if (this.disposed) return;
      this.model = gltf.scene;

      // Center + fit
      const box = new T.Box3().setFromObject(this.model);
      const center = new T.Vector3();
      box.getCenter(center);
      this.model.position.sub(center);

      const size = box.getSize(new T.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = maxDim / (2 * Math.tan(fov / 2));
      this.camera.position.set(0, dist * 0.35, dist * 1.85);
      this.camera.lookAt(0, 0, 0);

      // Anim mixer (si le GLB a une animation idle)
      if (gltf.animations && gltf.animations.length) {
        this.mixer = new T.AnimationMixer(this.model);
        this.mixer.clipAction(gltf.animations[0]).play();
      }

      this.scene.add(this.model);
    }, undefined, (err: any) => {
      console.warn('[yamzy-avatar-3d] Failed to load', this.glbUrl, err);
      this.loadFailed = true;
    });
  }

  private animate = () => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock?.getDelta() || 0.016;
    this.bobPhase += delta * 1.2;

    if (this.model) {
      if (this.rotate) {
        this.model.rotation.y += 0.005;
      }
      // Idle bobbing : remonte/redescend doucement
      this.model.position.y = Math.sin(this.bobPhase) * 0.06;
    }
    if (this.mixer) this.mixer.update(delta);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || 280;
    const h = canvas.clientHeight || 280;
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
