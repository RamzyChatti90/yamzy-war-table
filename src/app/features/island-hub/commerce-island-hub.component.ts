// ═══════════════════════════════════════════════════════════════════
// ⚗ COMMERCE ISLAND HUB — La Côte d'Ambre
//
// Scène 3D : un marché doré avec une cave d'alchimiste et une taverne
// aux cartes, 2 bâtiments + 3 portails vers les autres îles.
//
// Bâtiments :
//   ⚗ alchemist-cellar      → Cave (box socle + alambic + fioles)
//   🎴 card-tavern           → Taverne (box maison + cheminée + enseigne)
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
  flames?: any[];
}

@Component({
  selector: 'wt-commerce-island-hub',
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

    <div class="cih-host">
      <header class="cih-topbar">
        <div class="cih-title">
          <h1>⚗ ÎLE DU COMMERCE</h1>
          <p>La Côte d&apos;Ambre — budgets, leads, deals du Royaume</p>
        </div>
        <div class="cih-meta">
          <span class="cih-badge">2 ROOMS</span>
          <span class="cih-badge">3 PORTAILS</span>
        </div>
        <button class="cih-play-btn" (click)="replaySplash()" title="Rejouer la démo timeboxée">▶ Play</button>
        <button class="cih-howto-btn" (click)="openTutorial()" title="Comment ça marche">📖 Comment ça marche</button>
      </header>

      <canvas #canvas class="cih-canvas"></canvas>

      <footer class="cih-controls">
        <div class="cih-rooms-list">
          <span class="cih-list-label">ROOMS :</span>
          <a routerLink="/alchemist-cellar" class="cih-room-chip">⚗ Alchemist Cellar</a>
          <a routerLink="/card-tavern" class="cih-room-chip">🎴 Card Tavern</a>
        </div>
        <span class="cih-spacer"></span>
        <div class="cih-islands-list">
          <span class="cih-list-label">AUTRES ÎLES :</span>
          <a routerLink="/island/delivery" class="cih-island-chip" style="--accent:#86efac">🌿 Livraison</a>
          <a routerLink="/island/strategy" class="cih-island-chip" style="--accent:#a855f7">🌌 Stratégie</a>
          <a routerLink="/island/knowledge" class="cih-island-chip" style="--accent:#06b6d4">🏛 Savoir</a>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .cih-host { position: relative; width: 100%; height: 100vh; background: #4a2a05; color: #fef3c7; font-family: system-ui, sans-serif; }
    .cih-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: transparent; pointer-events: none; }
    .cih-topbar > * { pointer-events: auto; }
    .cih-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1.5px; color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.55); }
    .cih-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .cih-meta { display: flex; gap: 6px; font-size: 10px; }
    .cih-badge { padding: 4px 10px; background: rgba(251,191,36,0.25); border: 1px solid #fbbf24; border-radius: 6px; color: #fbbf24; letter-spacing: 1px; font-weight: 700; }
    .cih-canvas { display: block; width: 100%; height: 100%; }
    .cih-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 14px; align-items: center; background: linear-gradient(0deg, rgba(74,42,5,0.85) 0%, rgba(74,42,5,0) 100%); flex-wrap: wrap; }
    .cih-rooms-list, .cih-islands-list { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .cih-list-label { font-size: 10px; opacity: 0.6; letter-spacing: 1.5px; font-weight: 700; }
    .cih-room-chip { background: rgba(40,30,5,0.7); color: #fbbf24; border: 1px solid #b89240; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .cih-room-chip:hover { background: rgba(251,191,36,0.4); box-shadow: 0 0 10px rgba(251,191,36,0.35); }
    .cih-island-chip { background: rgba(20,20,40,0.7); color: var(--accent, #fbbf24); border: 1px solid var(--accent, #fbbf24); padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .cih-island-chip:hover { background: rgba(0,0,0,0.5); box-shadow: 0 0 10px var(--accent, #fbbf24); }
    .cih-spacer { flex: 1 1 20px; }
    .cih-play-btn {
      background: rgba(0,0,0,0.65);
      color: #fff;
      border: 2px solid color-mix(in srgb, #fbbf24 55%, transparent);
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
    .cih-play-btn:hover {
      border-color: #fbbf24;
      color: #fde68a;
      box-shadow: 0 0 16px color-mix(in srgb, #fbbf24 55%, transparent);
      transform: translateY(-1px);
    }
    .cih-howto-btn {
      background: rgba(0,0,0,0.65);
      color: #fff;
      border: 2px solid color-mix(in srgb, var(--accent-color, #fbbf24) 55%, transparent);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: "Tinos", serif;
      font-size: 14px;
      backdrop-filter: blur(4px);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      transition: all 0.25s ease;
    }
    .cih-howto-btn:hover {
      border-color: var(--accent-color, #fbbf24);
      color: #d68ddc;
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent-color, #fbbf24) 50%, transparent);
      transform: translateY(-1px);
    }
  `]
})
export class CommerceIslandHubComponent implements OnInit, OnDestroy {
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

  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;
  private ceremonyBus = inject(CeremonyBusService);

  private elapsed = 0;

  private readonly islandDef: IslandDef = ISLANDS.find(i => i.id === 'commerce')!;

  // 🎬 Splash & Tutorial state
  splashVisible = signal<boolean>(true);
  tutorialOpen = signal<boolean>(false);

  splashTitle = 'Commerce';
  splashLoreName = 'Le Royaume Mercantile';
  splashOneLiner = "L'île aux cartes du destin et aux oracles aquatiques — où se forge la voix du client et le pipeline commercial.";
  splashColor = '#fbbf24';
  tutorialSteps: TutorialStep[] = [
    { title: 'Bienvenue', body: 'Bienvenue sur le Royaume Mercantile. Ici la voix du client résonne dans les aquariums et le pipeline commercial se lit dans les cartes.' },
    { title: 'Card Tavern', body: '🃏 La taverne aux cartes — leads qualifiés, deals en cours, MRR. Win rate ? Cycle de vente ? Tour les cartes du destin.' },
    { title: 'Oracle Aquarium', body: '🐠 L\'étang des voix — méduses = pain points, poissons = interviews clients, trésors = JTBD validés.' },
    { title: 'Mana Fountain', body: '💧 La fontaine de Mana — chaque question Yamzy coûte des tokens, des mL d\'eau cooling, et des $.' },
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
      accent: '#fbbf24',
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

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x4a2a05);
    this.scene.fog = new T.FogExp2(0x6b4520, 0.012);

    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 250);
    this.camera.position.set(15, 13, 15);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new T.AmbientLight(0xfde047, 0.4));
    const sun = new T.DirectionalLight(0xfffbe6, 1.0);
    sun.position.set(14, 22, 8);
    this.scene.add(sun);
    const hemi = new T.HemisphereLight(0xfbbf24, 0x4a2a05, 0.55);
    this.scene.add(hemi);

    this.buildIsland(T);
    this.buildOceanRing(T);
    this.buildBuildings(T);
    this.buildPortals(T);

    // 🌌 Ciel universel synchronisé avec les autres îles via CeremonyBus
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 400,
      starRadius: 70,
      // (positions tweakable per island; defaults are OK for now)
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'island-commerce') return; // anti-loop
      this.sky?.pulseCeremony(c.type);
    });

    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 2, 0);
      this.controls.maxDistance = 60;
      this.controls.minDistance = 6;
      this.controls.maxPolarAngle = Math.PI / 2.05;
    }

    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[CommerceIslandHub] ⚗ Scene ready · 2 buildings + 3 portals');

    // 🎬 Intro cinématique : vue d'oiseau qui zoom progressivement
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 15, y: 13, z: 15 },
      { x: 0, y: 2, z: 0 },
      3.5,
    );

    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : île dorée (marché)
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any) {
    const geom = new T.CylinderGeometry(9, 9.4, 1.2, 42);
    const mat = new T.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.9,
      emissive: 0x60440a,
      emissiveIntensity: 0.18,
    });
    const island = new T.Mesh(geom, mat);
    island.position.y = 0.6;
    this.scene.add(island);

    // Tonneaux d'ambre alignés en bordure
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
      const r = 7.4;
      const barrelGeom = new T.CylinderGeometry(0.35, 0.32, 0.65, 14);
      const barrelMat = new T.MeshStandardMaterial({
        color: 0x78350f,
        roughness: 0.85,
        emissive: 0x3a1a05,
        emissiveIntensity: 0.2,
      });
      const barrel = new T.Mesh(barrelGeom, barrelMat);
      barrel.position.set(Math.cos(a) * r, 1.55, Math.sin(a) * r);
      this.scene.add(barrel);

      // Cerceau métallique sur le tonneau
      const ringGeom = new T.TorusGeometry(0.36, 0.025, 6, 18);
      const ringMat = new T.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.4,
        metalness: 0.7,
      });
      const ring = new T.Mesh(ringGeom, ringMat);
      ring.position.set(Math.cos(a) * r, 1.55, Math.sin(a) * r);
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
    }

    // Pièces d'or éparses
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 4 + Math.random() * 2.5;
      const coinGeom = new T.CylinderGeometry(0.12, 0.12, 0.04, 12);
      const coinMat = new T.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xb89240,
        emissiveIntensity: 0.7,
        metalness: 0.9,
        roughness: 0.2,
      });
      const coin = new T.Mesh(coinGeom, coinMat);
      coin.position.set(Math.cos(a) * r, 1.24, Math.sin(a) * r);
      coin.rotation.z = Math.random() * Math.PI;
      this.scene.add(coin);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : anneau océan
  // ═══════════════════════════════════════════════════════════════════
  private buildOceanRing(T: any) {
    const geom = new T.CylinderGeometry(70, 70, 0.5, 64);
    const mat = new T.MeshStandardMaterial({
      color: 0x1e6a8a,
      roughness: 0.35,
      metalness: 0.45,
      transparent: true,
      opacity: 0.78,
      emissive: 0x0a3a4a,
      emissiveIntensity: 0.18,
    });
    const ocean = new T.Mesh(geom, mat);
    ocean.position.y = -0.2;
    this.scene.add(ocean);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 2 bâtiments
  // ═══════════════════════════════════════════════════════════════════
  private buildBuildings(T: any) {
    const rooms = this.islandDef.roomRoutes;
    const builders: Array<(T: any) => { meshGroup: any; flames?: any[] }> = [
      (T) => this.buildAlchemistCellar(T),  // ⚗ alchemist-cellar
      (T) => ({ meshGroup: this.buildCardTavern(T) }),  // 🎴 card-tavern
    ];

    const positions: [number, number][] = [
      [-3.2, 0],
      [3.2, 0],
    ];

    for (let i = 0; i < rooms.length; i++) {
      const [x, z] = positions[i];
      const group = new T.Group();
      group.position.set(x, 1.5, z);
      const built = builders[i](T);
      group.add(built.meshGroup);

      const label = this.makeLabel(T, rooms[i].icon + ' ' + rooms[i].name, 0xfbbf24);
      label.position.set(0, 2.8, 0);
      group.add(label);

      group.userData.kind = 'building';
      group.userData.targetRoute = rooms[i].route;
      const hitObjects: any[] = [];
      built.meshGroup.traverse((obj: any) => {
        if (obj.isMesh) {
          obj.userData.targetRoute = rooms[i].route;
          hitObjects.push(obj);
        }
      });

      this.scene.add(group);
      this.buildings.push({ group, targetRoute: rooms[i].route, hitObjects, flames: built.flames });
    }
  }

  // ─── ⚗ Alchemist Cellar (cave + alambic + fioles) ───
  private buildAlchemistCellar(T: any): { meshGroup: any; flames: any[] } {
    const group = new T.Group();
    // Base cave (box pierre)
    const baseGeom = new T.BoxGeometry(1.7, 1.1, 1.4);
    const baseMat = new T.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.9,
      emissive: 0x1a1a1f,
      emissiveIntensity: 0.15,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.55;
    group.add(base);
    // Toit en pente
    const roofGeom = new T.ConeGeometry(1.3, 0.7, 4);
    const roofMat = new T.MeshStandardMaterial({
      color: 0x6b3a17,
      roughness: 0.8,
      emissive: 0x2a1505,
      emissiveIntensity: 0.2,
    });
    const roof = new T.Mesh(roofGeom, roofMat);
    roof.position.y = 1.45;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    // Alambic (sphère + tube)
    const flaskGeom = new T.SphereGeometry(0.28, 16, 12);
    const flaskMat = new T.MeshStandardMaterial({
      color: 0x84cc16,
      emissive: 0x84cc16,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2,
    });
    const flask = new T.Mesh(flaskGeom, flaskMat);
    flask.position.set(0, 1.5, 0.5);
    group.add(flask);
    // Tube sur le côté de l'alambic
    const tubeGeom = new T.CylinderGeometry(0.03, 0.03, 0.4, 8);
    const tubeMat = new T.MeshStandardMaterial({ color: 0x52525b, roughness: 0.5, metalness: 0.7 });
    const tube = new T.Mesh(tubeGeom, tubeMat);
    tube.rotation.z = Math.PI / 2.5;
    tube.position.set(0.3, 1.35, 0.5);
    group.add(tube);

    // Fioles colorées sur étagère devant
    const flames: any[] = [];
    const fioleColors = [0xa855f7, 0xec4899, 0xfbbf24];
    for (let i = 0; i < 3; i++) {
      const fGeom = new T.CylinderGeometry(0.07, 0.08, 0.22, 10);
      const fMat = new T.MeshStandardMaterial({
        color: fioleColors[i],
        emissive: fioleColors[i],
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.85,
      });
      const fiole = new T.Mesh(fGeom, fMat);
      fiole.position.set(-0.5 + i * 0.35, 0.4, 0.72);
      group.add(fiole);
      flames.push(fiole);
    }

    return { meshGroup: group, flames };
  }

  // ─── 🎴 Card Tavern (maison + cheminée + enseigne carte) ───
  private buildCardTavern(T: any): any {
    const group = new T.Group();
    // Base maison
    const baseGeom = new T.BoxGeometry(1.7, 1.0, 1.5);
    const baseMat = new T.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
      emissive: 0x3a1a05,
      emissiveIntensity: 0.2,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.5;
    group.add(base);
    // Toit en V (deux plans inclinés)
    const roofGeom = new T.ConeGeometry(1.25, 0.7, 4);
    const roofMat = new T.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.7,
      emissive: 0x3a0808,
      emissiveIntensity: 0.25,
    });
    const roof = new T.Mesh(roofGeom, roofMat);
    roof.position.y = 1.4;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    // Cheminée
    const chimGeom = new T.BoxGeometry(0.25, 0.5, 0.25);
    const chimMat = new T.MeshStandardMaterial({ color: 0x52525b, roughness: 0.85 });
    const chim = new T.Mesh(chimGeom, chimMat);
    chim.position.set(0.4, 1.85, 0);
    group.add(chim);
    // Enseigne carte (plane suspendu)
    const signGeom = new T.PlaneGeometry(0.45, 0.65);
    const signMat = new T.MeshStandardMaterial({
      color: 0xfffbe6,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.55,
      side: T.DoubleSide,
    });
    const sign = new T.Mesh(signGeom, signMat);
    sign.position.set(0, 1.0, 0.85);
    group.add(sign);
    // Cœur rouge sur la carte
    const heartGeom = new T.CircleGeometry(0.1, 16);
    const heartMat = new T.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.8,
      side: T.DoubleSide,
    });
    const heart = new T.Mesh(heartGeom, heartMat);
    heart.position.set(0, 1.0, 0.86);
    group.add(heart);
    // Porte
    const doorGeom = new T.PlaneGeometry(0.4, 0.6);
    const doorMat = new T.MeshStandardMaterial({
      color: 0x3a1a05,
      roughness: 0.95,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.3,
      side: T.DoubleSide,
    });
    const door = new T.Mesh(doorGeom, doorMat);
    door.position.set(-0.45, 0.3, 0.76);
    group.add(door);
    return group;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : Labels sprites
  // ═══════════════════════════════════════════════════════════════════
  private makeLabel(T: any, text: string, color: number): any {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(74,42,5,0.85)';
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
    sprite.scale.set(2.6, 0.5, 1);
    return sprite;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 3 portails autour de l'île
  // ═══════════════════════════════════════════════════════════════════
  private buildPortals(T: any) {
    const others = getOtherIslands('commerce');
    const radius = 12;
    const baseAngle = Math.PI / 6;
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

    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      b.group.rotation.y = Math.sin(this.elapsed * 0.4 + i) * 0.08;
      // Fioles brillent en pulse
      if (b.flames) {
        for (let j = 0; j < b.flames.length; j++) {
          const fiole = b.flames[j];
          fiole.material.emissiveIntensity = 0.6 + Math.sin(this.elapsed * 2 + j * 1.2) * 0.4;
        }
      }
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
