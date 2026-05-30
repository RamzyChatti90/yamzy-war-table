// WAR TABLE ⚔ — v1.0.82 — GLB Icon Component (réutilisable)
// Charge n'importe quel fichier .glb depuis assets/, l'affiche en 3D avec :
//   - background transparent
//   - rotation idle (option)
//   - bobbing (option)
//   - tint optionnel
//   - dispose proprement à OnDestroy
// Basé sur le pattern yamzy-avatar-3d.component.ts.

import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-yamzy-glb-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glb-wrap">
      <canvas #canvas></canvas>
      <div *ngIf="loadFailed" class="glb-fallback">{{ fallbackEmoji }}</div>
    </div>
  `,
  styles: [`
    .glb-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: block;
      overflow: hidden;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .glb-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
  `]
})
export class YamzyGlbIconComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  /** Chemin vers le GLB (ex. 'assets/cards/1_Fireball.glb'). */
  @Input() glbUrl = '';
  /** Rotation Y idle. */
  @Input() rotate = true;
  /** Vitesse de rotation (radians/frame). */
  @Input() rotateSpeed = 0.008;
  /** Bobbing vertical sinusoïdal. */
  @Input() bob = false;
  /** Camera distance multiplier (1.0 par défaut — augmente pour zoom out). */
  @Input() cameraDistance = 1.4;
  /** Emoji fallback si le GLB ne charge pas. */
  @Input() fallbackEmoji = '⚔';

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
  private modelBaselineY = 0;
  private disposed = false;
  private bobPhase = 0;
  private currentUrl = '';

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (!this.THREE || this.disposed) { this.loadFailed = true; return; }
    this.initScene();
    this.loadModel();
    this.animate();
    window.addEventListener('resize', this.onResize);
  }

  ngOnChanges(changes: SimpleChanges) {
    // Recharger le GLB si l'URL change (réutilisation du component pour différentes cartes)
    if (changes['glbUrl'] && !changes['glbUrl'].firstChange && this.scene) {
      this.reloadModel();
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
    const w = canvas.clientWidth || 120;
    const h = canvas.clientHeight || 120;

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(35, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    // Lighting — soft + glow doré
    const hemi = new T.HemisphereLight(0xfff5e6, 0x4a3f7a, 1.0);
    this.scene.add(hemi);
    const ambient = new T.AmbientLight(0xfff0d4, 0.65);
    this.scene.add(ambient);
    const key = new T.DirectionalLight(0xffeedd, 0.85);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    const accent = new T.PointLight(0xd99a51, 0.6, 10);
    accent.position.set(-2, 2, 2);
    this.scene.add(accent);

    this.clock = new T.Clock();
  }

  private loadModel() {
    if (!this.GLTFLoader || !this.glbUrl) { this.loadFailed = true; return; }
    const T = this.THREE;
    this.currentUrl = this.glbUrl;
    const loader = new this.GLTFLoader();
    loader.load(this.glbUrl, (gltf: any) => {
      if (this.disposed) return;
      this.model = gltf.scene;

      // Center + fit dans la viewport
      const box = new T.Box3().setFromObject(this.model);
      const center = new T.Vector3();
      box.getCenter(center);
      this.model.position.sub(center);
      this.modelBaselineY = this.model.position.y;

      const size = box.getSize(new T.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = maxDim / (2 * Math.tan(fov / 2));
      this.camera.position.set(0, 0, dist * this.cameraDistance);
      this.camera.lookAt(0, 0, 0);

      this.scene.add(this.model);
      this.loadFailed = false;
    }, undefined, (err: any) => {
      console.warn('[yamzy-glb-icon] Failed to load', this.glbUrl, err);
      this.loadFailed = true;
    });
  }

  private reloadModel() {
    if (this.currentUrl === this.glbUrl) return;
    if (this.model && this.scene) {
      this.scene.remove(this.model);
      this.disposeNode(this.model);
      this.model = null;
    }
    this.loadFailed = false;
    this.loadModel();
  }

  private animate = () => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    const dt = this.clock ? this.clock.getDelta() : 0.016;
    if (this.model && this.rotate) {
      this.model.rotation.y += this.rotateSpeed;
    }
    if (this.model && this.bob) {
      this.bobPhase += dt * 2.2;
      this.model.position.y = this.modelBaselineY + Math.sin(this.bobPhase) * 0.06;
    }
    if (this.mixer) this.mixer.update(dt);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || 120;
    const h = canvas.clientHeight || 120;
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
      // Évite de charger 2x le même script (cas des multiples instances)
      if (document.querySelector(`script[src="${src}"]`)) { r(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => r();
      s.onerror = () => r();
      document.head.appendChild(s);
    });
  }
}
