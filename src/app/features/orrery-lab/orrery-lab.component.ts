import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * 🧪 ORRERY LAB — page d'isolation
 * ───────────────────────────────────────────────────────────────
 * Scène 100% THREE.js code (pas de GLB).
 * Objectif : valider la mécanique (anneaux phases, orbites, spins)
 *            avant de la porter sur le GLB orrery.glb.
 *
 * Architecture testée ici :
 *   • Sol horizontal Y=0 (XZ = plan orbital)
 *   • 4 anneaux colorés Q1/Q2/Q3/Q4 sur le sol
 *   • Cristal central (gros) au centre, spin Y, bobbing
 *   • 8 bras métalliques + mini-cristaux au bout
 *   • Chaque bras = Group qui tourne autour de Y (= orbite)
 *   • Mini = Mesh qui tourne en plus sur son axe Y (= self-spin)
 *   • Kepler : orbites internes tournent plus vite (1/√r)
 */
@Component({
  selector: 'wt-orrery-lab',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lab-page">
      <header class="lab-hud">
        <a routerLink="/orrery-viewer" class="lab-back">← Retour orrery-viewer (GLB)</a>
        <div class="lab-title">
          <h1>🧪 ORRERY LAB</h1>
          <p>Scène 3D pure (no GLB) · valide la mécanique ici avant adaptation</p>
        </div>
        <div class="lab-legend">
          <span class="dot q1"></span> Q1 Cadrage
          <span class="dot q2"></span> Q2 Build
          <span class="dot q3"></span> Q3 Test
          <span class="dot q4"></span> Q4 Release
        </div>
      </header>
      <canvas #canvas class="lab-canvas"></canvas>
      <footer class="lab-controls">
        <button (click)="toggleAxesHelper()">{{ axesVisible ? '🚫 Axes' : '🧭 Axes' }}</button>
        <button (click)="toggleGrid()">{{ gridVisible ? '🚫 Grille' : '📐 Grille' }}</button>
        <button (click)="resetCamera()">🎥 Reset caméra</button>
        <button (click)="toggleSpinOrbit()">{{ paused ? '▶ Play' : '⏸ Pause' }}</button>
        <span class="hint">Mouse drag = orbit · molette = zoom · droit-clic = pan</span>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .lab-page { position: relative; width: 100%; height: 100vh; background: #060818; color: #e8eaf6; font-family: system-ui, sans-serif; }
    .lab-hud {
      position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10;
      display: flex; justify-content: space-between; align-items: center; gap: 18px;
      background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
      pointer-events: none;
    }
    .lab-hud > * { pointer-events: auto; }
    .lab-back { color: #9ca3ff; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #3b3f55; border-radius: 8px; background: rgba(0,0,0,0.4); }
    .lab-back:hover { background: rgba(60,80,150,0.4); }
    .lab-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1px; }
    .lab-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.7; }
    .lab-legend { display: flex; gap: 12px; font-size: 11px; align-items: center; }
    .lab-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; box-shadow: 0 0 8px currentColor; }
    .lab-legend .q1 { background: #4ade80; color: #4ade80; }
    .lab-legend .q2 { background: #60a5fa; color: #60a5fa; }
    .lab-legend .q3 { background: #fb923c; color: #fb923c; }
    .lab-legend .q4 { background: #ef4444; color: #ef4444; }
    .lab-canvas { display: block; width: 100%; height: 100%; }
    .lab-controls {
      position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10;
      display: flex; gap: 8px; align-items: center;
      background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
    }
    .lab-controls button {
      background: rgba(20,25,50,0.7); color: #e8eaf6; border: 1px solid #3b3f55;
      padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px;
      font-family: system-ui, sans-serif;
    }
    .lab-controls button:hover { background: rgba(60,80,150,0.7); }
    .lab-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.6; }
  `]
})
export class OrreryLabComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  axesVisible = true;
  gridVisible = true;
  paused = false;

  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;

  private centralCrystal: any;
  private arms: any[] = [];          // pivot Group per orbit (rotates around Y)
  private minis: any[] = [];         // mini crystal Mesh (self-spin Y)
  private phaseRingsGroup: any;
  private axesHelper: any;
  private gridHelper: any;
  private controls: any;

  ngOnInit() {
    this.bootstrap();
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
  }

  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    // OrbitControls (optionnel — pour la souris)
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
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

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.renderer) this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }

  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Scene
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x060818);
    this.scene.fog = new T.FogExp2(0x060818, 0.02);

    // Camera
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Lights
    this.scene.add(new T.AmbientLight(0xffffff, 0.35));
    const dir = new T.DirectionalLight(0xffffff, 0.7);
    dir.position.set(8, 12, 6);
    this.scene.add(dir);
    const back = new T.DirectionalLight(0x6688ff, 0.3);
    back.position.set(-5, -2, -5);
    this.scene.add(back);

    // Build scene
    this.createPhaseRings(T);
    this.createCentralCrystal(T);
    this.createOrbitalSystem(T);
    this.createStarsBackground(T);

    // Helpers
    this.gridHelper = new T.GridHelper(20, 20, 0x444466, 0x222244);
    this.gridHelper.position.y = -0.02;
    this.scene.add(this.gridHelper);

    this.axesHelper = new T.AxesHelper(2);
    this.axesHelper.position.y = 0.01;
    this.scene.add(this.axesHelper);

    // OrbitControls (if available)
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxDistance = 50;
      this.controls.minDistance = 2;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[OrreryLab] 🧪 Scene ready :',
      '4 phase rings, 1 central crystal, 8 orbital arms with minis.');
    console.log('[OrreryLab] 💡 Hierarchy = scene → armPivot (rotate Y) → [rod + mini (rotate own Y)]');
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎨 4 PHASE RINGS — disques colorés concentriques (Q1 → Q4)
  // ═══════════════════════════════════════════════════════════════════
  private createPhaseRings(T: any) {
    this.phaseRingsGroup = new T.Group();
    this.phaseRingsGroup.name = 'PhaseRings';

    // Rayons choisis pour couvrir les 8 orbites (radii 1.5 → 5.0)
    const phases = [
      { inner: 0.3, outer: 2.0, color: 0x4ade80, label: 'Q1 Cadrage' },
      { inner: 2.0, outer: 3.0, color: 0x60a5fa, label: 'Q2 Build' },
      { inner: 3.0, outer: 4.0, color: 0xfb923c, label: 'Q3 Test' },
      { inner: 4.0, outer: 5.5, color: 0xef4444, label: 'Q4 Release' },
    ];

    phases.forEach(p => {
      const ring = new T.Mesh(
        new T.RingGeometry(p.inner, p.outer, 96, 1),
        new T.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: 0.35,
          side: T.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2; // flat on XZ plane (Y up)
      ring.position.y = 0;
      ring.renderOrder = -1;
      ring.userData = { phase: p.label };
      this.phaseRingsGroup.add(ring);

      // Bordure plus opaque pour bien voir les limites
      const border = new T.Mesh(
        new T.RingGeometry(p.outer - 0.02, p.outer, 96, 1),
        new T.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: 0.95,
          side: T.DoubleSide,
        })
      );
      border.rotation.x = -Math.PI / 2;
      border.position.y = 0.005;
      this.phaseRingsGroup.add(border);
    });

    this.scene.add(this.phaseRingsGroup);
    console.log('[OrreryLab] 🎨 4 phase rings created on XZ plane (Y=0)');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 💎 GROS CRISTAL CENTRAL (au centre, spin Y + bobbing)
  // ═══════════════════════════════════════════════════════════════════
  private createCentralCrystal(T: any) {
    // IcosahedronGeometry = approximation d'un crystal facetté (Ruby-like)
    const geo = new T.IcosahedronGeometry(0.9, 0);
    const mat = new T.MeshStandardMaterial({
      color: 0xe0115f,
      emissive: 0xff3366,
      emissiveIntensity: 0.7,
      roughness: 0.15,
      metalness: 0.8,
    });
    this.centralCrystal = new T.Mesh(geo, mat);
    this.centralCrystal.position.set(0, 1.0, 0);
    this.centralCrystal.name = 'CentralCrystal';
    this.scene.add(this.centralCrystal);

    // Glow light qui suit le crystal
    const glow = new T.PointLight(0xff3366, 2.5, 12);
    glow.position.copy(this.centralCrystal.position);
    this.scene.add(glow);

    // Socle (cylindre doré sous le crystal)
    const baseGeom = new T.CylinderGeometry(0.25, 0.4, 0.2, 16);
    const baseMat = new T.MeshStandardMaterial({ color: 0xddaa33, metalness: 0.95, roughness: 0.15 });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.1;
    this.scene.add(base);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🪐 SYSTÈME ORBITAL — 8 bras avec minis au bout
  //   armPivot (Group à l'origine) → tourne autour Y = orbite
  //     ├── rod (Cylindre métallique le long de +X jusqu'à r)
  //     └── mini (Icosahedron au bout, lifted Y=0.3)
  //         self-rotation Y appliquée frame-by-frame
  // ═══════════════════════════════════════════════════════════════════
  private createOrbitalSystem(T: any) {
    const radii = [1.3, 1.8, 2.4, 2.9, 3.4, 3.9, 4.4, 4.9];
    const ticketColors = [
      0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c,
      0x4dabf7, 0x9775fa, 0xf06292, 0xa3e635,
    ];

    radii.forEach((r, i) => {
      // ─── ARM PIVOT ──── à l'origine, tourne autour Y
      const armPivot = new T.Group();
      armPivot.name = `arm_${i}_r${r}`;
      armPivot.rotation.y = (i / radii.length) * Math.PI * 2; // angle départ étalé

      // ─── ROD ──── cylindre doré horizontal du centre jusqu'à r
      const rod = new T.Mesh(
        new T.CylinderGeometry(0.025, 0.035, r, 8),
        new T.MeshStandardMaterial({
          color: 0xc9a32e,
          emissive: 0x553300,
          emissiveIntensity: 0.2,
          metalness: 0.95,
          roughness: 0.25,
        })
      );
      // Cylindre par défaut aligné Y. Roté Z pour s'aligner sur X.
      rod.rotation.z = -Math.PI / 2;
      rod.position.x = r / 2; // centre du rod entre 0 et r
      rod.position.y = 0.15;
      armPivot.add(rod);

      // ─── MINI CRYSTAL ──── au bout du rod (à x=r), upright
      const miniGeo = new T.IcosahedronGeometry(0.22, 0);
      const miniMat = new T.MeshStandardMaterial({
        color: ticketColors[i],
        emissive: ticketColors[i],
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.65,
      });
      const mini = new T.Mesh(miniGeo, miniMat);
      mini.position.set(r, 0.4, 0);
      mini.name = `mini_${i}`;
      mini.userData = { orbitRadius: r };
      armPivot.add(mini);

      this.scene.add(armPivot);
      this.arms.push(armPivot);
      this.minis.push(mini);
    });

    console.log(`[OrreryLab] 🪐 ${radii.length} orbital arms created. Radii :`, radii.join(', '));
  }

  // ═══════════════════════════════════════════════════════════════════
  // ✨ FOND ÉTOILÉ
  // ═══════════════════════════════════════════════════════════════════
  private createStarsBackground(T: any) {
    const count = 600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true });
    this.scene.add(new T.Points(geom, mat));
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const dt = this.paused ? 0 : this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // GROS CRYSTAL : spin Y + bobbing
    if (this.centralCrystal) {
      this.centralCrystal.rotation.y = t * 0.4;
      this.centralCrystal.position.y = 1.0 + Math.sin(t * 1.2) * 0.08;
    }

    // ARMS : chaque bras tourne autour Y. Vitesse Kepler-like (1/√r).
    this.arms.forEach((arm, i) => {
      const r = 1.3 + i * 0.55;
      const orbitalSpeed = 0.7 / Math.sqrt(r);
      arm.rotation.y += dt * orbitalSpeed;
    });

    // MINIS : self-spin sur leur axe Y local (= vertical en world space
    //         car armPivot ne fait que tourner autour Y → axe Y du mini reste vertical)
    this.minis.forEach(mini => {
      mini.rotation.y += dt * 0.6;
    });

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // CONTROLS UI
  // ═══════════════════════════════════════════════════════════════════
  toggleAxesHelper() {
    this.axesVisible = !this.axesVisible;
    if (this.axesHelper) this.axesHelper.visible = this.axesVisible;
  }
  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    if (this.gridHelper) this.gridHelper.visible = this.gridVisible;
  }
  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) this.controls.target.set(0, 0, 0);
  }
  toggleSpinOrbit() {
    this.paused = !this.paused;
  }

  private onResize = () => {
    if (!this.canvasEl?.nativeElement || !this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
