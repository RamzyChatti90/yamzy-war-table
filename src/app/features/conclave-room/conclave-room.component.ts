// Conclave de VESPER — Room 3D — composant Angular standalone.
// Charge la chambre + le crystal du spell-caster, gère le rendering Three.js,
// écrans Title/Instructions/Enter en overlay HTML/CSS.
//
// Inspiré du spell-caster (https://github.com/ste-vg/spell-caster) — repris sous
// licence ISC, adapté en Angular pour intégration dans le studio Yamzy.

import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

type ConclaveScreen = 'LOADING' | 'TITLE' | 'INSTRUCTIONS' | 'ROOM';

@Component({
  selector: 'app-conclave-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conclave-room.component.html',
  styleUrls: ['./conclave-room.component.css']
})
export class ConclaveRoomComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  private router = inject(Router);

  // Signal — l'écran courant affiché en overlay sur le canvas 3D
  screen = signal<ConclaveScreen>('LOADING');

  // Three.js refs
  private THREE: any;
  private GLTFLoader: any;
  private DRACOLoader: any;
  private renderer: any;
  private scene: any;
  private camera: any;
  private clock: any;
  private animFrameId: any;
  private room: any;
  private crystal: any;
  private disposed = false;

  // Sons (ambient music + crystal hum)
  private music?: HTMLAudioElement;
  soundsEnabled = signal(false);

  // --- Lifecycle ---

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (this.THREE && !this.disposed) {
      this.initScene();
      this.loadAssets();
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
    if (this.music) { this.music.pause(); this.music = undefined; }
  }

  // --- Three.js scene setup ---

  private initScene() {
    const T = this.THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    // r128 utilise outputEncoding (pas outputColorSpace qui est r152+)
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new T.Scene();
    this.scene.background = new T.Color('#000000');

    this.camera = new T.PerspectiveCamera(35, w / h, 0.1, 100);
    // Position cinematic : depuis le dessus + recule pour voir le crystal sur la table
    this.camera.position.set(0, 0.4, 1.6);
    this.camera.lookAt(0, -0.1, 0);

    // Lighting — recette FAB Yamzy (cinematic chaleureux)
    const hemi = new T.HemisphereLight(0xfff5e6, 0x4a3f7a, 1.0);
    this.scene.add(hemi);
    const ambient = new T.AmbientLight(0xfff0d4, 0.75);
    this.scene.add(ambient);
    const key = new T.DirectionalLight(0xffeedd, 0.9);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    // Glow violet pour le crystal
    const crystalGlow = new T.PointLight(0x9b6cff, 0.7, 5);
    crystalGlow.position.set(0, 0.1, 0);
    this.scene.add(crystalGlow);

    this.clock = new T.Clock();
  }

  private loadAssets() {
    if (!this.GLTFLoader) {
      console.warn('[Conclave] GLTFLoader unavailable — skipping to TITLE');
      setTimeout(() => this.screen.set('TITLE'), 500);
      return;
    }
    const T = this.THREE;
    const loader = new this.GLTFLoader();
    // Attache un DRACOLoader (les GLB du conclave sont compressés)
    if (this.DRACOLoader) {
      const draco = new this.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }

    let pending = 2;
    const done = () => {
      pending--;
      if (pending <= 0 && !this.disposed) {
        // Tous chargés → écran title
        setTimeout(() => this.screen.set('TITLE'), 300);
      }
    };

    // Timeout fallback : si les GLB ne se chargent pas en 8s, force TITLE
    setTimeout(() => {
      if (!this.disposed && this.screen() === 'LOADING') {
        console.warn('[Conclave] timeout — forcing TITLE screen');
        this.screen.set('TITLE');
      }
    }, 8000);

    // Room (chambre du conclave)
    loader.load('/assets/conclave/models/room.glb', (gltf: any) => {
      if (this.disposed) return;
      this.room = gltf.scene;
      this.room.scale.setScalar(0.18);
      this.room.position.set(0, -0.4, -0.4);
      // Désactive frustumCulled (cohérent avec le spell-caster original)
      this.room.traverse((c: any) => { if (c.isMesh) c.frustumCulled = false; });
      this.scene.add(this.room);
      done();
    }, undefined, (err: any) => {
      console.warn('[Conclave] failed loading room', err);
      done();
    });

    // Crystal
    loader.load('/assets/conclave/models/crystal.glb', (gltf: any) => {
      if (this.disposed) return;
      this.crystal = gltf.scene;
      this.crystal.scale.setScalar(0.07);
      this.crystal.position.set(0, -0.05, 0);
      this.crystal.traverse((c: any) => { if (c.isMesh) c.frustumCulled = false; });
      this.scene.add(this.crystal);
      done();
    }, undefined, (err: any) => {
      console.warn('[Conclave] failed loading crystal', err);
      done();
    });
  }

  // --- Animation loop ---

  private animate = () => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    const t = this.clock ? this.clock.getElapsedTime() : 0;

    // Crystal bobbing + rotation lente (signature du spell-caster)
    if (this.crystal) {
      this.crystal.position.y = -0.05 + Math.sin(t * 1.2) * 0.015;
      this.crystal.rotation.y = t * 0.4;
    }
    // Rotation très lente de la chambre (effet "panoramique")
    if (this.room) {
      this.room.rotation.y = Math.sin(t * 0.05) * 0.1;
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

  // --- Screens flow ---

  onStartClick() {
    this.enableSounds();
    this.screen.set('INSTRUCTIONS');
  }
  onSkipInstructions() {
    this.enableSounds();
    this.screen.set('ROOM');
  }
  onInstructionsNext() {
    this.screen.set('ROOM');
  }
  onEnterStudio() {
    this.router.navigate(['/war-table']);
  }
  onBackToTitle() {
    this.screen.set('TITLE');
  }

  // --- Sounds ---

  private enableSounds() {
    if (this.soundsEnabled() || this.music) return;
    try {
      this.music = new Audio('/assets/conclave/sounds/music.mp3');
      this.music.loop = true;
      this.music.volume = 0.35;
      this.music.play().catch(() => {/* autoplay block */});
      this.soundsEnabled.set(true);
    } catch (e) { console.warn('[Conclave] music play failed', e); }
  }
  toggleSounds() {
    if (!this.music) { this.enableSounds(); return; }
    this.music.muted = !this.music.muted;
    this.soundsEnabled.set(!this.music.muted);
  }

  // --- Three.js loader bootstrap ---

  private async ensureThreeJS() {
    // r128 — version qui a encore examples/js/ (les r152+ ont déprécié, faut ESM)
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    this.THREE = (window as any).THREE;
    if (this.THREE && !(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    // DRACOLoader nécessaire car les GLB du conclave sont compressés avec Draco
    if (this.THREE && !(window as any).THREE?.DRACOLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
    }
    this.GLTFLoader = (window as any).THREE?.GLTFLoader;
    this.DRACOLoader = (window as any).THREE?.DRACOLoader;
    console.log('[Conclave] THREE r128:', !!this.THREE, '| GLTFLoader:', !!this.GLTFLoader, '| DRACOLoader:', !!this.DRACOLoader);
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
