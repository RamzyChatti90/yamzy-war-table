// ═══════════════════════════════════════════════════════════════════
// Cosmos 3D Scene — Vue THREE.js du cosmos projet
//   • Soleil = sphère emissive au centre
//   • 9 orbites = anneaux 3D horizontaux
//   • Planètes = sphères colorées positionnées sur les orbites (X, Z)
//   • Caméra cinéma : survole la scène, change de pose aléatoirement
//   • Étoiles de fond = particules
// ═══════════════════════════════════════════════════════════════════

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  Input, OnChanges, OnDestroy, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PlacedPlanet3D {
  id: string | number;
  orbitIndex: number;
  angleDeg: number;
  size: number;
  color: string;
}

@Component({
  selector: 'cosmos-3d-scene',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #canvas class="cosmos3d-canvas"></canvas>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .cosmos3d-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cosmos3dSceneComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  @Input() planets: PlacedPlanet3D[] = [];
  @Input() orbitsSize: number[] = [80, 110, 145, 185, 230, 300, 380, 470, 560];
  @Input() sunColor = '#ffaa44';
  @Input() projectHealth = 75;

  private THREE: any;
  private renderer: any;
  private scene: any;
  private camera: any;
  private clock: any;
  private rafId: any = 0;
  private disposed = false;
  private ready = false;

  // Scene objects
  private sun: any;
  private sunLight: any;
  private orbitRings: any[] = [];
  private planetMeshes = new Map<string, any>();
  private stars: any;

  // Camera tour
  private cameraTargetPos: any;
  private cameraTargetLook: any;
  private cameraTourTimer: any = null;

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (!this.THREE || this.disposed) return;
    this.cameraTargetPos = new this.THREE.Vector3(0, 250, 600);
    this.cameraTargetLook = new this.THREE.Vector3(0, 0, 0);
    this.initScene();
    this.createStars();
    this.createSun();
    this.createOrbits();
    this.rebuildPlanets();
    this.startCameraTour();
    this.ready = true;
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.ready && (changes['planets'] || changes['orbitsSize'])) {
      this.rebuildPlanets();
    }
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.cameraTourTimer) clearTimeout(this.cameraTourTimer);
    if (this.renderer) {
      try { this.renderer.dispose(); } catch {}
    }
  }

  // ─── Three.js scene setup ─────────────────────────────────────────
  private initScene() {
    const T = this.THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    if (T.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = T.sRGBEncoding;
    }

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(55, w / h, 0.1, 3000);
    this.camera.position.set(0, 250, 600);
    this.camera.lookAt(0, 0, 0);

    // Lighting global doux (le soleil émet la majorité de la lumière)
    const amb = new T.AmbientLight(0x445566, 0.45);
    this.scene.add(amb);

    this.clock = new T.Clock();
  }

  // ─── Soleil au centre ─────────────────────────────────────────────
  private createSun() {
    const T = this.THREE;
    const geo = new T.SphereGeometry(18, 48, 48);
    const mat = new T.MeshBasicMaterial({
      color: new T.Color(this.sunColor),
    });
    this.sun = new T.Mesh(geo, mat);
    this.scene.add(this.sun);

    // Halo glow extérieur (sphere transparente plus grande)
    const haloGeo = new T.SphereGeometry(26, 32, 32);
    const haloMat = new T.MeshBasicMaterial({
      color: new T.Color(this.sunColor),
      transparent: true,
      opacity: 0.18,
      side: T.BackSide,
    });
    const halo = new T.Mesh(haloGeo, haloMat);
    this.sun.add(halo);

    // PointLight pour éclairer les planètes
    this.sunLight = new T.PointLight(0xffcc88, 2.2, 1500, 1.6);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);
  }

  // ─── 9 orbites concentriques (anneaux horizontaux) ───────────────
  private createOrbits() {
    const T = this.THREE;
    this.orbitsSize.forEach(diameter => {
      const radius = diameter / 2;
      const geo = new T.RingGeometry(radius - 0.4, radius + 0.4, 96);
      const mat = new T.MeshBasicMaterial({
        color: 0x4a8cd6,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.28,
      });
      const ring = new T.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;   // horizontal
      this.scene.add(ring);
      this.orbitRings.push(ring);
    });
  }

  // ─── Planètes (sphères positionnées sur orbites) ─────────────────
  private rebuildPlanets() {
    const T = this.THREE;
    // Cleanup old
    this.planetMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.planetMeshes.clear();

    (this.planets || []).forEach(p => {
      const orbitDiameter = this.orbitsSize[p.orbitIndex] || 200;
      const orbitRadius = orbitDiameter / 2;
      const angleRad = (p.angleDeg - 90) * Math.PI / 180;

      const planetRadius = (p.size || 5) * 0.45;
      const geo = new T.SphereGeometry(planetRadius, 16, 16);
      const mat = new T.MeshStandardMaterial({
        color: new T.Color(p.color || '#a3b8d0'),
        emissive: new T.Color(p.color || '#a3b8d0'),
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.1,
      });
      const mesh = new T.Mesh(geo, mat);

      mesh.position.set(
        Math.cos(angleRad) * orbitRadius,
        0,
        Math.sin(angleRad) * orbitRadius,
      );

      // Store initial angle for orbit rotation
      mesh.userData = {
        orbitRadius,
        baseAngle: angleRad,
        rotationSpeed: 0.02 + (Math.random() * 0.04),  // 0.02-0.06 rad/s
      };

      this.scene.add(mesh);
      this.planetMeshes.set(String(p.id), mesh);
    });
  }

  // ─── Champ d'étoiles en fond ─────────────────────────────────────
  private createStars() {
    const T = this.THREE;
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 600 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
    });
    this.stars = new T.Points(geo, mat);
    this.scene.add(this.stars);
  }

  // ─── Caméra cinéma : 8 poses, change toutes les 7-10s ────────────
  private readonly cameraPoses: Array<{ pos: [number, number, number]; look: [number, number, number] }> = [
    { pos: [0,    250, 600],  look: [0, 0, 0]  },     // wide top-down
    { pos: [400,  120, 350],  look: [0, 0, 0]  },     // right side close
    { pos: [-400, 180, 350],  look: [0, 0, 0]  },     // left side close
    { pos: [0,    480, 80],   look: [0, 0, 0]  },     // top-down dive
    { pos: [0,    50,  450],  look: [0, 50, 0] },     // low approach
    { pos: [350,  300, -350], look: [0, 0, 0]  },     // back-right
    { pos: [-350, 300, -350], look: [0, 0, 0]  },     // back-left
    { pos: [200,  100, 400],  look: [50, 0, 50] },    // off-center planet hover
  ];

  private startCameraTour() {
    const T = this.THREE;
    const cycle = () => {
      const pose = this.cameraPoses[Math.floor(Math.random() * this.cameraPoses.length)];
      this.cameraTargetPos = new T.Vector3(pose.pos[0], pose.pos[1], pose.pos[2]);
      this.cameraTargetLook = new T.Vector3(pose.look[0], pose.look[1], pose.look[2]);
      const nextDelay = 7000 + Math.random() * 3000;
      this.cameraTourTimer = setTimeout(cycle, nextDelay);
    };
    this.cameraTourTimer = setTimeout(cycle, 2000);
  }

  // ─── Boucle animation ────────────────────────────────────────────
  private animate = () => {
    if (this.disposed) return;
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // Resize check
    this.resizeIfNeeded();

    // Camera lerp vers la pose cible (smooth)
    this.camera.position.lerp(this.cameraTargetPos, 0.012);
    const currentLook = new this.THREE.Vector3();
    currentLook.copy(this.cameraTargetLook);
    this.camera.lookAt(currentLook);

    // Soleil tourne lentement sur lui-même
    if (this.sun) this.sun.rotation.y += dt * 0.3;

    // Stars en rotation très lente
    if (this.stars) this.stars.rotation.y += dt * 0.005;

    // Planètes tournent autour du soleil (orbite)
    this.planetMeshes.forEach(mesh => {
      const ud = mesh.userData;
      const angle = ud.baseAngle + t * ud.rotationSpeed;
      mesh.position.x = Math.cos(angle) * ud.orbitRadius;
      mesh.position.z = Math.sin(angle) * ud.orbitRadius;
      mesh.rotation.y += dt * 0.5;   // spin propre
    });

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.animate);
  };

  private resizeIfNeeded() {
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (w > 0 && h > 0 &&
        (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr))) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  // ─── Three.js r128 bootstrap (CDN pattern) ──────────────────────
  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    this.THREE = (window as any).THREE;
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
