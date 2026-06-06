// ═══════════════════════════════════════════════════════════════════
// 🌌 STRATEGY ISLAND HUB — Le Royaume Stellaire
//
// Scène 3D : un observatoire cosmique violet flottant sous un ciel
// étoilé avec 3 bâtiments (un par room de la stratégie) et 3 portails
// vers les autres îles thématiques.
//
// Bâtiments :
//   ⛰ okr-mountain          → Pic conique étagé
//   🌌 star-map-risks        → Sphère stellaire + anneau
//   🔭 telescope-island      → Mini-observatoire dôme + télescope
//
// 3 portails autour de l'île à 120° (rayon 12, Y=2.5)
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { createPortal3D, PortalHandle, ISLANDS, getOtherIslands, IslandDef } from '../../core/portal/portal.factory';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { playIslandIntro } from '../../core/island-intro/island-intro';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { SpellTutorialOverlayComponent, TutorialStep, SpellFooterService } from '../../core/spell-ui';

interface BuildingHandle {
  group: any;
  targetRoute: string;
  hitObjects: any[];
}

@Component({
  selector: 'wt-strategy-island-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, RoomSplashComponent, SpellTutorialOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <wt-room-splash *ngIf="splashVisible()"
                    [title]="splashTitle"
                    [loreName]="splashLoreName"
                    [oneLiner]="splashOneLiner"
                    [color]="splashColor"
                    [duration]="60"
                    (onPlay)="onSplashPlay()"
                    (onEnter)="onSplashEnter()" />

    <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
                               [steps]="tutorialSteps"
                               [accent]="splashColor"
                               [title]="'Comment ça marche'"
                               (close)="closeTutorial()" />

    <div class="sih-host">
      <header class="sih-topbar">
        <div class="sih-title">
          <h1>🌌 ÎLE DE LA STRATÉGIE</h1>
          <p>Le Royaume Stellaire — la vue d&apos;avion du Mage Stratège</p>
        </div>
        <div class="sih-meta">
          <span class="sih-badge">3 ROOMS</span>
          <span class="sih-badge">3 PORTAILS</span>
        </div>
        <button class="sih-play-btn" (click)="replaySplash()" title="Rejouer la démo timeboxée">▶ Play</button>
        <button class="sih-howto-btn" (click)="openTutorial()" title="Comment ça marche">📖 Comment ça marche</button>
      </header>

      <canvas #canvas class="sih-canvas"></canvas>

      <footer class="sih-controls">
        <div class="sih-rooms-list">
          <span class="sih-list-label">ROOMS :</span>
          <a routerLink="/okr-mountain" class="sih-room-chip">⛰ OKR Mountain</a>
          <a routerLink="/star-map-risks" class="sih-room-chip">🌌 Star Map</a>
          <a routerLink="/telescope-island" class="sih-room-chip">🔭 Telescope</a>
        </div>
        <span class="sih-spacer"></span>
        <div class="sih-islands-list">
          <span class="sih-list-label">AUTRES ÎLES :</span>
          <a routerLink="/island/delivery" class="sih-island-chip" style="--accent:#86efac">🌿 Livraison</a>
          <a routerLink="/island/knowledge" class="sih-island-chip" style="--accent:#06b6d4">🏛 Savoir</a>
          <a routerLink="/island/commerce" class="sih-island-chip" style="--accent:#fbbf24">⚗ Commerce</a>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .sih-host { position: relative; width: 100%; height: 100vh; background: #2a0a4a; color: #e9d5ff; font-family: system-ui, sans-serif; }
    .sih-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: transparent; pointer-events: none; }
    .sih-topbar > * { pointer-events: auto; }
    .sih-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1.5px; color: #c4b5fd; text-shadow: 0 0 12px rgba(196,181,253,0.55); }
    .sih-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .sih-meta { display: flex; gap: 6px; font-size: 10px; }
    .sih-badge { padding: 4px 10px; background: rgba(124,58,237,0.25); border: 1px solid #a855f7; border-radius: 6px; color: #c4b5fd; letter-spacing: 1px; font-weight: 700; }
    .sih-canvas { display: block; width: 100%; height: 100%; }
    .sih-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 14px; align-items: center; background: linear-gradient(0deg, rgba(20,5,40,0.85) 0%, rgba(20,5,40,0) 100%); flex-wrap: wrap; }
    .sih-rooms-list, .sih-islands-list { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .sih-list-label { font-size: 10px; opacity: 0.6; letter-spacing: 1.5px; font-weight: 700; }
    .sih-room-chip { background: rgba(30,15,60,0.7); color: #c4b5fd; border: 1px solid #7c3aed; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .sih-room-chip:hover { background: rgba(124,58,237,0.55); box-shadow: 0 0 10px rgba(196,181,253,0.35); }
    .sih-island-chip { background: rgba(20,20,40,0.7); color: var(--accent, #fbbf24); border: 1px solid var(--accent, #fbbf24); padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .sih-island-chip:hover { background: rgba(0,0,0,0.5); box-shadow: 0 0 10px var(--accent, #fbbf24); }
    .sih-spacer { flex: 1 1 20px; }
    .sih-play-btn {
      background: rgba(0,0,0,0.65);
      color: #fff;
      border: 2px solid color-mix(in srgb, #c4b5fd 55%, transparent);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: "Tinos", serif;
      font-size: 14px;
      backdrop-filter: blur(4px);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      transition: all 0.25s ease;
      letter-spacing: 0.04em;
      font-weight: 700;
    }
    .sih-play-btn:hover {
      border-color: #c4b5fd;
      color: #ddd6fe;
      box-shadow: 0 0 16px color-mix(in srgb, #c4b5fd 55%, transparent);
      transform: translateY(-1px);
    }
    .sih-howto-btn {
      background: rgba(0,0,0,0.65);
      color: #fff;
      border: 2px solid color-mix(in srgb, var(--accent-color, #c4b5fd) 55%, transparent);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: "Tinos", serif;
      font-size: 14px;
      backdrop-filter: blur(4px);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      transition: all 0.25s ease;
    }
    .sih-howto-btn:hover {
      border-color: var(--accent-color, #c4b5fd);
      color: #d68ddc;
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent-color, #c4b5fd) 50%, transparent);
      transform: translateY(-1px);
    }
  `]
})
export class StrategyIslandHubComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;
  private router = inject(Router);
  private spellFooter = inject(SpellFooterService);

  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private rafId: number = 0;
  private disposed = false;

  private buildings: BuildingHandle[] = [];
  private portals: PortalHandle[] = [];
  private starsField: any;

  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;
  private ceremonyBus = inject(CeremonyBusService);

  private elapsed = 0;

  private readonly islandDef: IslandDef = ISLANDS.find(i => i.id === 'strategy')!;

  // 🎬 Splash & Tutorial state
  splashVisible = signal<boolean>(true);
  tutorialOpen = signal<boolean>(false);

  splashTitle = 'Stratégie';
  splashLoreName = 'Le Royaume Stellaire';
  splashOneLiner = "L'île de la vue d'avion du Mage Stratège — OKRs, risques cosmiques, télescope du futur.";
  splashColor = '#c4b5fd';
  tutorialSteps: TutorialStep[] = [
    { title: 'Bienvenue', body: 'Bienvenue sur le Royaume Stellaire. Ici règne le Mage Stratège qui scrute les étoiles pour piloter le projet à long terme.' },
    { title: 'OKR Mountain', body: '⛰ Le pic OKR Mountain te montre la progression de tes Objectifs et Key Results. Chaque drapeau à son altitude = % atteint.' },
    { title: 'Star Map des Risques', body: '🌌 La carte stellaire affiche les risques actifs comme des constellations : critique (rouge), surveillance (orange), oublié (gris).' },
    { title: 'Telescope Island', body: '🔭 Le télescope permet de scruter le futur du projet — aurores (smooth), comètes (incidents), supernovas (releases).' },
  ];

  onSplashPlay(): void { this.splashVisible.set(false); }
  onSplashEnter(): void { this.splashVisible.set(false); }
  openTutorial(): void { this.tutorialOpen.set(true); }
  closeTutorial(): void { this.tutorialOpen.set(false); }
  /** Rejoue la démo timeboxée en réaffichant le splash welcome. */
  replaySplash(): void { this.splashVisible.set(true); }

  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#c4b5fd',
      controls: [],
      hint: 'Drag = orbit · molette = zoom · clic bâtiment = entrer dans la room',
    });
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
    }
    window.removeEventListener('resize', this.onResize);
    for (const p of this.portals) p.dispose();
    this.spellFooter.clearSlots();
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

  // ═══════════════════════════════════════════════════════════════════
  // INIT SCENE
  // ═══════════════════════════════════════════════════════════════════
  private init() {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // ─── Scène : ciel cosmique violet profond ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x1a0535);
    this.scene.fog = new T.FogExp2(0x2a0a4a, 0.012);

    // ─── Caméra ───
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 250);
    this.camera.position.set(16, 14, 16);
    this.camera.lookAt(0, 2, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lights ───
    this.scene.add(new T.AmbientLight(0x4030a0, 0.4));
    const sun = new T.DirectionalLight(0xc4b5fd, 0.7);
    sun.position.set(-12, 18, 6);
    this.scene.add(sun);
    const hemi = new T.HemisphereLight(0x6d28d9, 0x0a0518, 0.45);
    this.scene.add(hemi);

    // ─── Build scene elements ───
    this.buildIsland(T);
    this.buildOceanRing(T);
    this.buildStarsField(T, 500);
    this.buildBuildings(T);
    this.buildPortals(T);

    // 🌌 Ciel universel synchronisé avec les autres îles via CeremonyBus
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 400,
      starRadius: 70,
      // (positions tweakable per island; defaults are OK for now)
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'island-strategy') return; // anti-loop
      this.sky?.pulseCeremony(c.type);
    });

    // ─── OrbitControls ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 2, 0);
      this.controls.maxDistance = 60;
      this.controls.minDistance = 6;
      this.controls.maxPolarAngle = Math.PI / 2.05;
    }

    // ─── Raycaster ───
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[StrategyIslandHub] 🌌 Scene ready · 3 buildings + 3 portals + starfield');

    // 🎬 Intro cinématique : vue d'oiseau qui zoom progressivement
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 16, y: 14, z: 16 },
      { x: 0, y: 2, z: 0 },
      3.5,
    );

    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : île violette cosmique
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any) {
    const geom = new T.CylinderGeometry(9, 9.4, 1.2, 42);
    const mat = new T.MeshStandardMaterial({
      color: 0x4c1d95,
      roughness: 0.85,
      emissive: 0x2a0a4a,
      emissiveIntensity: 0.3,
    });
    const island = new T.Mesh(geom, mat);
    island.position.y = 0.6;
    this.scene.add(island);

    // Cristaux mauves émissifs en bordure
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.25;
      const r = 7.4 + Math.random() * 1.3;
      const crystalGeom = new T.ConeGeometry(0.12 + Math.random() * 0.1, 0.6 + Math.random() * 0.4, 4);
      const crystalMat = new T.MeshStandardMaterial({
        color: 0xa855f7,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0x7c3aed,
        emissiveIntensity: 0.7,
      });
      const crystal = new T.Mesh(crystalGeom, crystalMat);
      crystal.position.set(Math.cos(a) * r, 1.35, Math.sin(a) * r);
      crystal.rotation.y = Math.random() * Math.PI * 2;
      crystal.rotation.z = (Math.random() - 0.5) * 0.3;
      this.scene.add(crystal);
    }

    // Tapis runique au centre (cercle violet émissif)
    const runeGeom = new T.CircleGeometry(3, 32);
    const runeMat = new T.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.35,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
    });
    const rune = new T.Mesh(runeGeom, runeMat);
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 1.22;
    this.scene.add(rune);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : anneau océan cosmique
  // ═══════════════════════════════════════════════════════════════════
  private buildOceanRing(T: any) {
    const geom = new T.CylinderGeometry(70, 70, 0.5, 64);
    const mat = new T.MeshStandardMaterial({
      color: 0x1e1a5a,
      roughness: 0.35,
      metalness: 0.55,
      transparent: true,
      opacity: 0.78,
      emissive: 0x0a0a3a,
      emissiveIntensity: 0.25,
    });
    const ocean = new T.Mesh(geom, mat);
    ocean.position.y = -0.2;
    this.scene.add(ocean);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : champ d'étoiles
  // ═══════════════════════════════════════════════════════════════════
  private buildStarsField(T: any, count: number) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(Math.random() * 0.95);
      const theta = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 14;
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const tint = Math.random();
      if (tint < 0.6) {
        colors[i * 3 + 0] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0;
      } else if (tint < 0.85) {
        colors[i * 3 + 0] = 0.8; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3 + 0] = 1.0; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.65;
      }
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: T.AdditiveBlending,
      vertexColors: true,
      fog: false,
    });
    this.starsField = new T.Points(geom, mat);
    this.scene.add(this.starsField);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 3 bâtiments (un par room)
  // ═══════════════════════════════════════════════════════════════════
  private buildBuildings(T: any) {
    const rooms = this.islandDef.roomRoutes;
    const builders: Array<(T: any) => any> = [
      (T) => this.buildOkrMountain(T),    // ⛰ okr-mountain
      (T) => this.buildStarMap(T),         // 🌌 star-map-risks
      (T) => this.buildTelescope(T),       // 🔭 telescope-island
    ];

    for (let i = 0; i < rooms.length; i++) {
      const angle = (i / rooms.length) * Math.PI * 2 + Math.PI / 6;
      const radius = 4.8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const group = new T.Group();
      group.position.set(x, 1.5, z);
      const meshGroup = builders[i](T);
      group.add(meshGroup);

      const label = this.makeLabel(T, rooms[i].icon + ' ' + rooms[i].name, 0xa855f7);
      label.position.set(0, 2.6, 0);
      group.add(label);

      group.userData.kind = 'building';
      group.userData.targetRoute = rooms[i].route;
      const hitObjects: any[] = [];
      meshGroup.traverse((obj: any) => {
        if (obj.isMesh) {
          obj.userData.targetRoute = rooms[i].route;
          hitObjects.push(obj);
        }
      });

      this.scene.add(group);
      this.buildings.push({ group, targetRoute: rooms[i].route, hitObjects });
    }
  }

  // ─── ⛰ OKR Mountain (cone étagé + drapeau sommet) ───
  private buildOkrMountain(T: any): any {
    const group = new T.Group();
    // Base large
    const baseGeom = new T.ConeGeometry(1.0, 1.4, 12);
    const baseMat = new T.MeshStandardMaterial({
      color: 0x5b21b6,
      roughness: 0.85,
      emissive: 0x3a1085,
      emissiveIntensity: 0.3,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.0;
    group.add(base);
    // Sommet plus fin
    const peakGeom = new T.ConeGeometry(0.45, 0.8, 10);
    const peakMat = new T.MeshStandardMaterial({
      color: 0xc4b5fd,
      roughness: 0.6,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.5,
    });
    const peak = new T.Mesh(peakGeom, peakMat);
    peak.position.y = 0.95;
    group.add(peak);
    // Drapeau sommet
    const poleGeom = new T.CylinderGeometry(0.025, 0.025, 0.5, 6);
    const poleMat = new T.MeshStandardMaterial({ color: 0x6b3a17, roughness: 0.95 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.set(0, 1.55, 0);
    group.add(pole);
    const flagGeom = new T.PlaneGeometry(0.4, 0.25);
    const flagMat = new T.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb89240,
      emissiveIntensity: 0.6,
      side: T.DoubleSide,
    });
    const flag = new T.Mesh(flagGeom, flagMat);
    flag.position.set(0.22, 1.65, 0);
    group.add(flag);
    return group;
  }

  // ─── 🌌 Star Map Risks (sphère étoilée + anneau) ───
  private buildStarMap(T: any): any {
    const group = new T.Group();
    const sphereGeom = new T.SphereGeometry(0.85, 24, 18);
    const sphereMat = new T.MeshStandardMaterial({
      color: 0x312e81,
      roughness: 0.55,
      metalness: 0.4,
      emissive: 0x4a1a85,
      emissiveIntensity: 0.5,
    });
    const sphere = new T.Mesh(sphereGeom, sphereMat);
    sphere.position.y = 0.7;
    group.add(sphere);
    // Anneau orbital (torus)
    const ringGeom = new T.TorusGeometry(1.1, 0.05, 8, 32);
    const ringMat = new T.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.7,
      metalness: 0.7,
      roughness: 0.25,
    });
    const ring = new T.Mesh(ringGeom, ringMat);
    ring.position.y = 0.7;
    ring.rotation.x = Math.PI / 2.5;
    group.add(ring);
    // Petites étoiles autour
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const starGeom = new T.SphereGeometry(0.05, 6, 4);
      const starMat = new T.MeshBasicMaterial({ color: 0xffffff });
      const star = new T.Mesh(starGeom, starMat);
      star.position.set(Math.cos(a) * 1.4, 0.7 + Math.sin(i) * 0.3, Math.sin(a) * 1.4);
      group.add(star);
    }
    return group;
  }

  // ─── 🔭 Telescope mini (dôme + télescope tube) ───
  private buildTelescope(T: any): any {
    const group = new T.Group();
    // Base hexagonale
    const baseGeom = new T.CylinderGeometry(0.7, 0.7, 0.7, 6);
    const baseMat = new T.MeshStandardMaterial({
      color: 0x4a3520,
      roughness: 0.9,
      emissive: 0x180a04,
      emissiveIntensity: 0.15,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.35;
    group.add(base);
    // Dôme
    const domeGeom = new T.SphereGeometry(0.72, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new T.MeshStandardMaterial({
      color: 0xc4b5fd,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x4a3a85,
      emissiveIntensity: 0.3,
      side: T.DoubleSide,
    });
    const dome = new T.Mesh(domeGeom, domeMat);
    dome.position.y = 0.7;
    dome.scale.y = 0.6;
    group.add(dome);
    // Tube télescope qui dépasse
    const tubeGeom = new T.CylinderGeometry(0.08, 0.08, 1.0, 12);
    const tubeMat = new T.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.4,
      metalness: 0.65,
      emissive: 0x1a1235,
      emissiveIntensity: 0.2,
    });
    const tube = new T.Mesh(tubeGeom, tubeMat);
    tube.rotation.z = Math.PI / 3;
    tube.position.set(0.3, 1.15, 0);
    group.add(tube);
    // Lentille brillante
    const lensGeom = new T.RingGeometry(0.05, 0.1, 12);
    const lensMat = new T.MeshStandardMaterial({
      color: 0xc4b5fd,
      emissive: 0xc4b5fd,
      emissiveIntensity: 1.0,
      side: T.DoubleSide,
    });
    const lens = new T.Mesh(lensGeom, lensMat);
    lens.position.set(0.72, 1.4, 0);
    lens.rotation.z = -Math.PI / 6;
    group.add(lens);
    return group;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : Labels sprites
  // ═══════════════════════════════════════════════════════════════════
  private makeLabel(T: any, text: string, color: number): any {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(20,5,40,0.85)';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);
    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(2.4, 0.45, 1);
    return sprite;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 3 portails autour de l'île
  // ═══════════════════════════════════════════════════════════════════
  private buildPortals(T: any) {
    const others = getOtherIslands('strategy');
    const radius = 12;
    const baseAngle = 0;
    for (let i = 0; i < others.length; i++) {
      const angle = baseAngle + (i / others.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotY = Math.atan2(-x, -z);
      const portal = createPortal3D(T, this.scene, {
        position: [x, 2.5, z],
        rotationY: rotY,
        targetRoute: others[i].route,
        islandLabel: others[i].name,
        color: others[i].color,
        scale: 1.0,
      });
      this.portals.push(portal);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER
  // ═══════════════════════════════════════════════════════════════════
  private handleCanvasClick(e: MouseEvent) {
    if (!this.camera || !this.raycaster) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    for (const p of this.portals) {
      const target = p.hitTest(this.raycaster);
      if (target) {
        this.router.navigate([target]);
        return;
      }
    }
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj) {
        if (obj.userData?.targetRoute) {
          this.router.navigate([obj.userData.targetRoute]);
          return;
        }
        obj = obj.parent;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANIMATE LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    for (const p of this.portals) p.tick(dt, this.elapsed);

    if (this.starsField) this.starsField.rotation.y += dt * 0.02;

    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      b.group.rotation.y = Math.sin(this.elapsed * 0.4 + i) * 0.1;
    }

    // 🌌 Animer le ciel universel (étoiles, lune, aurore, comète, filantes)
    this.sky?.tick(dt, this.elapsed);

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
