// ═══════════════════════════════════════════════════════════════════
// Cosmos Sun 3D — fireball.glb au centre du cosmos
//
// Charge fireball.glb via Three.js r128 (CDN), auto-scale + auto-center,
// joue les animations GLB natives via AnimationMixer.
// Background transparent → s'intègre par-dessus l'overlay couleur santé.
// ═══════════════════════════════════════════════════════════════════

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  Input, OnDestroy, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cosmos-sun-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="csun3d-wrap">
      <canvas #canvas></canvas>
      <div *ngIf="loadFailed" class="csun3d-fallback">☀</div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .csun3d-wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .csun3d-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: #ffce47;
      filter: drop-shadow(0 0 12px rgba(255, 200, 80, 0.6));
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmosSun3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  @Input() glbUrl = '/assets/agents/fireball.glb';
  /** Vitesse du mixer d'anim (1 = naturelle, >1 plus rapide → ex: velocity élevée). */
  @Input() animSpeed = 1;
  /** Rotation Y continue (en plus des anims natives) en deg/s. */
  @Input() idleRotateDegPerSec = 18;

  loadFailed = false;

  private THREE: any;
  private GLTFLoader: any;
  private DRACOLoader: any;

  private renderer: any;
  private scene: any;
  private camera: any;
  private model: any;
  private mixer: any = null;
  private clock: any;
  private rafId: any;
  private disposed = false;

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (!this.THREE) {
      this.loadFailed = true;
      return;
    }
    this.initScene();
    await this.loadModel();
    this.startLoop();
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.renderer) {
      try { this.renderer.dispose(); } catch {}
    }
  }

  // ─── Setup THREE.js scene ───────────────────────────────────────
  private initScene() {
    const THREE = this.THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || 80;
    const h = canvas.clientHeight || 80;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    if (THREE.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    /* Pas de toneMapping = matériaux emissifs (feu) restent FULL BRIGHT */

    /* Lighting généreuse : ambient FORTE pour bien éclairer le fireball même sans toneMapping */
    const amb = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(amb);
    const dir1 = new THREE.DirectionalLight(0xffeebb, 1.5);
    dir1.position.set(2, 2, 2);
    this.scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xff8844, 0.8);
    dir2.position.set(-2, -1, 1);
    this.scene.add(dir2);

    this.clock = new THREE.Clock();
  }

  // ─── Load fireball.glb ──────────────────────────────────────────
  private loadModel(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.GLTFLoader) {
        console.warn('[CosmosSun3D] GLTFLoader unavailable');
        this.loadFailed = true;
        resolve();
        return;
      }
      const loader = new this.GLTFLoader();
      // DRACOLoader si dispo (safe si le GLB n'est PAS Draco-compressed)
      if (this.DRACOLoader) {
        try {
          const draco = new this.DRACOLoader();
          draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
          loader.setDRACOLoader(draco);
        } catch (e) {
          console.warn('[CosmosSun3D] DRACOLoader setup failed:', e);
        }
      }
      loader.load(
        this.glbUrl,
        (gltf: any) => {
          this.model = gltf.scene;
          this.scene.add(this.model);
          this.autoFitModel();

          // AnimationMixer pour les animations natives du fireball
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new this.THREE.AnimationMixer(this.model);
            this.mixer.timeScale = this.animSpeed || 1;
            gltf.animations.forEach((clip: any) => {
              const action = this.mixer.clipAction(clip);
              action.setLoop(this.THREE.LoopRepeat, Infinity);
              action.play();
            });
            console.log('[CosmosSun3D] fireball loaded with',
              gltf.animations.length, 'anims:',
              gltf.animations.map((a: any) => a.name));
          } else {
            console.log('[CosmosSun3D] fireball loaded (no anims)');
          }
          resolve();
        },
        undefined,
        (err: any) => {
          console.error('[CosmosSun3D] Failed to load fireball:', err);
          this.loadFailed = true;
          resolve();
        },
      );
    });
  }

  // ─── Auto-center + auto-scale pour remplir le viewport ──────────
  private autoFitModel() {
    if (!this.model) return;
    const THREE = this.THREE;
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Centre le modèle à l'origine
    this.model.position.x -= center.x;
    this.model.position.y -= center.y;
    this.model.position.z -= center.z;
    // Scale pour que la plus grande dimension = 1.8 (viewport ~3 de profondeur)
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      /* Plus gros (2.4 unités au lieu de 1.8) pour bien remplir le viewport.
         Caméra à z=3, FOV 50° → viewport ~2.8 unités à origine. 2.4 = 85% */
      const ratio = 2.4 / maxDim;
      this.model.scale.multiplyScalar(ratio);
    }
  }

  // ─── Render loop ─────────────────────────────────────────────────
  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const dt = this.clock.getDelta();
      if (this.mixer) this.mixer.update(dt);
      // Rotation idle Y en plus des anims natives
      if (this.model && this.idleRotateDegPerSec) {
        this.model.rotation.y += (this.idleRotateDegPerSec * Math.PI / 180) * dt;
      }
      // Resize check (le canvas peut changer de taille)
      this.resizeIfNeeded();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private resizeIfNeeded() {
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== w * (window.devicePixelRatio || 1) ||
                            canvas.height !== h * (window.devicePixelRatio || 1))) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  // ─── Bootstrap Three.js r128 depuis CDN (même pattern que conclave-room) ──
  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    this.THREE = (window as any).THREE;
    if (this.THREE && !(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    if (this.THREE && !(window as any).THREE?.DRACOLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
    }
    this.GLTFLoader = (window as any).THREE?.GLTFLoader;
    this.DRACOLoader = (window as any).THREE?.DRACOLoader;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
}
