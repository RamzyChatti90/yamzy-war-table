// ═══════════════════════════════════════════════════════════════════
// 🌿 DELIVERY ISLAND HUB — L'Archipel des Œuvres
//
// Scène 3D : une île de prairie-forêt verdoyante avec 4 bâtiments
// (un par room du flux de livraison) et 3 portails magiques vers
// les 3 autres îles thématiques (strategy, knowledge, commerce).
//
// Bâtiments :
//   🌳 git-tree-room        → Tree mesh (cylinder + cone)
//   🪞 pr-mirror-hall       → Mirror hall (box + plane reflectant)
//   🏝 kanban-island        → Mini island (sphere + flag)
//   🔥 phoenix-forge        → Forge (box + chimney)
//
// 3 portails autour de l'île à 120° (rayon 12, Y=2.5)
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SpellButtonComponent } from '../../core/spell-ui';
import { createPortal3D, PortalHandle, ISLANDS, getOtherIslands, IslandDef } from '../../core/portal/portal.factory';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { playIslandIntro } from '../../core/island-intro/island-intro';

interface BuildingHandle {
  group: any;
  targetRoute: string;
  hitObjects: any[];
}

@Component({
  selector: 'wt-delivery-island-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dih-host">
      <header class="dih-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#67e8f9"
                      routerLink="/yamzy-rooms"
                      icon="←"
                      title="Retour à la galerie Yamzy Rooms">Yamzy Rooms</wt-spell-btn>
        <div class="dih-title">
          <h1>🌿 ÎLE DE LA LIVRAISON</h1>
          <p>L&apos;Archipel des Œuvres — le flux quotidien du Royaume</p>
        </div>
        <div class="dih-meta">
          <span class="dih-badge">4 ROOMS</span>
          <span class="dih-badge">3 PORTAILS</span>
        </div>
      </header>

      <canvas #canvas class="dih-canvas"></canvas>

      <footer class="dih-controls">
        <div class="dih-rooms-list">
          <span class="dih-list-label">ROOMS :</span>
          <a routerLink="/git-tree-room" class="dih-room-chip">🌳 Git Tree</a>
          <a routerLink="/pr-mirror-hall" class="dih-room-chip">🪞 PR Mirror</a>
          <a routerLink="/kanban-island" class="dih-room-chip">🏝 Kanban</a>
          <a routerLink="/phoenix-forge" class="dih-room-chip">🔥 Phoenix</a>
        </div>
        <span class="dih-spacer"></span>
        <div class="dih-islands-list">
          <span class="dih-list-label">AUTRES ÎLES :</span>
          <a routerLink="/island/strategy" class="dih-island-chip" style="--accent:#a855f7">🌌 Stratégie</a>
          <a routerLink="/island/knowledge" class="dih-island-chip" style="--accent:#06b6d4">🏛 Savoir</a>
          <a routerLink="/island/commerce" class="dih-island-chip" style="--accent:#fbbf24">⚗ Commerce</a>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .dih-host { position: relative; width: 100%; height: 100vh; background: #052e16; color: #d1fae5; font-family: system-ui, sans-serif; }
    .dih-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(5,46,22,0.85) 0%, rgba(5,46,22,0) 100%); pointer-events: none; }
    .dih-topbar > * { pointer-events: auto; }
    .dih-back { color: #86efac; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #16a34a; border-radius: 8px; background: rgba(20,60,30,0.6); }
    .dih-back:hover { background: rgba(34,197,94,0.4); }
    .dih-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1.5px; color: #86efac; text-shadow: 0 0 12px rgba(134,239,172,0.55); }
    .dih-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .dih-meta { display: flex; gap: 6px; font-size: 10px; }
    .dih-badge { padding: 4px 10px; background: rgba(34,197,94,0.2); border: 1px solid #16a34a; border-radius: 6px; color: #86efac; letter-spacing: 1px; font-weight: 700; }
    .dih-canvas { display: block; width: 100%; height: 100%; }
    .dih-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 14px; align-items: center; background: linear-gradient(0deg, rgba(5,46,22,0.85) 0%, rgba(5,46,22,0) 100%); flex-wrap: wrap; }
    .dih-rooms-list, .dih-islands-list { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .dih-list-label { font-size: 10px; opacity: 0.6; letter-spacing: 1.5px; font-weight: 700; }
    .dih-room-chip { background: rgba(20,60,30,0.7); color: #86efac; border: 1px solid #16a34a; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .dih-room-chip:hover { background: rgba(34,197,94,0.4); box-shadow: 0 0 10px rgba(134,239,172,0.35); }
    .dih-island-chip { background: rgba(20,20,40,0.7); color: var(--accent, #fbbf24); border: 1px solid var(--accent, #fbbf24); padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .dih-island-chip:hover { background: rgba(0,0,0,0.5); box-shadow: 0 0 10px var(--accent, #fbbf24); }
    .dih-spacer { flex: 1 1 20px; }
  `]
})
export class DeliveryIslandHubComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;
  private router = inject(Router);

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

  private readonly islandDef: IslandDef = ISLANDS.find(i => i.id === 'delivery')!;

  ngOnInit() {
    this.bootstrap();
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

    // ─── Scène : ciel jour vert pastel ───
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x6ad28e);
    this.scene.fog = new T.FogExp2(0x86efac, 0.012);

    // ─── Caméra ───
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 250);
    this.camera.position.set(16, 14, 16);
    this.camera.lookAt(0, 2, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lights ───
    this.scene.add(new T.AmbientLight(0xa8d8a8, 0.5));
    const sun = new T.DirectionalLight(0xfffbe6, 1.0);
    sun.position.set(15, 22, 10);
    this.scene.add(sun);
    const hemi = new T.HemisphereLight(0xc8f8d8, 0x1a4020, 0.55);
    this.scene.add(hemi);

    // ─── Build scene elements ───
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
      if (c.sourceRoom === 'island-delivery') return; // anti-loop
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

    console.log('[DeliveryIslandHub] 🌿 Scene ready · 4 buildings + 3 portals');

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
  // BUILD : île verte centrale
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any) {
    // Disque principal (cylindre plat)
    const geom = new T.CylinderGeometry(9, 9.4, 1.2, 42);
    const mat = new T.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.85,
      emissive: 0x103018,
      emissiveIntensity: 0.18,
    });
    const island = new T.Mesh(geom, mat);
    island.position.y = 0.6;
    this.scene.add(island);

    // Petites touffes d'herbe + cailloux + fleurs en bordure
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.25;
      const r = 7.2 + Math.random() * 1.4;
      const isFlower = Math.random() > 0.6;
      const tuftGeom = new T.IcosahedronGeometry(0.16 + Math.random() * 0.14, 0);
      const tuftMat = new T.MeshStandardMaterial({
        color: isFlower ? 0xfde047 : 0x65a065,
        roughness: 0.8,
        emissive: isFlower ? 0x60440a : 0x0e2010,
        emissiveIntensity: 0.22,
      });
      const tuft = new T.Mesh(tuftGeom, tuftMat);
      tuft.position.set(Math.cos(a) * r, 1.25, Math.sin(a) * r);
      this.scene.add(tuft);
    }

    // Quelques arbres décoratifs en arrière-plan de l'île
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const r = 4.5 + Math.random() * 1.6;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const trunkGeom = new T.CylinderGeometry(0.1, 0.14, 0.6, 8);
      const trunkMat = new T.MeshStandardMaterial({ color: 0x6b3a17, roughness: 0.95 });
      const trunk = new T.Mesh(trunkGeom, trunkMat);
      trunk.position.set(x, 1.5, z);
      this.scene.add(trunk);
      const leafGeom = new T.ConeGeometry(0.55, 1.2, 8);
      const leafMat = new T.MeshStandardMaterial({
        color: 0x16a34a,
        roughness: 0.7,
        emissive: 0x0a3a18,
        emissiveIntensity: 0.25,
      });
      const leaf = new T.Mesh(leafGeom, leafMat);
      leaf.position.set(x, 2.25, z);
      this.scene.add(leaf);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : anneau océan
  // ═══════════════════════════════════════════════════════════════════
  private buildOceanRing(T: any) {
    const geom = new T.CylinderGeometry(70, 70, 0.5, 64);
    const mat = new T.MeshStandardMaterial({
      color: 0x1e7a8a,
      roughness: 0.35,
      metalness: 0.45,
      transparent: true,
      opacity: 0.78,
      emissive: 0x0a3a4a,
      emissiveIntensity: 0.18,
    });
    const ocean = new T.Mesh(geom, mat);
    ocean.position.y = -0.2;
    ocean.userData.kind = 'ocean';
    this.scene.add(ocean);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 4 bâtiments (un par room)
  // ═══════════════════════════════════════════════════════════════════
  private buildBuildings(T: any) {
    const rooms = this.islandDef.roomRoutes;
    const builders: Array<(T: any) => any> = [
      (T) => this.buildGitTree(T),       // 🌳 git-tree-room
      (T) => this.buildPrMirror(T),       // 🪞 pr-mirror-hall
      (T) => this.buildKanbanMini(T),     // 🏝 kanban-island
      (T) => this.buildPhoenixForge(T),   // 🔥 phoenix-forge
    ];

    for (let i = 0; i < rooms.length; i++) {
      const angle = (i / rooms.length) * Math.PI * 2 + Math.PI / 4;
      const radius = 5.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const group = new T.Group();
      group.position.set(x, 1.5, z);
      const meshGroup = builders[i](T);
      group.add(meshGroup);

      // Label sprite au-dessus
      const label = this.makeLabel(T, rooms[i].icon + ' ' + rooms[i].name, 0x86efac);
      label.position.set(0, 2.4, 0);
      group.add(label);

      group.userData.kind = 'building';
      group.userData.targetRoute = rooms[i].route;
      // Marquer tous les meshes enfants
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

  // ─── 🌳 Git Tree (tronc + cone feuilles) ───
  private buildGitTree(T: any): any {
    const group = new T.Group();
    const trunkGeom = new T.CylinderGeometry(0.15, 0.22, 1.1, 10);
    const trunkMat = new T.MeshStandardMaterial({ color: 0x5a3514, roughness: 0.95 });
    const trunk = new T.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.0;
    group.add(trunk);
    const leafGeom = new T.ConeGeometry(0.85, 1.8, 12);
    const leafMat = new T.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.7,
      emissive: 0x0a3a18,
      emissiveIntensity: 0.35,
    });
    const leaf = new T.Mesh(leafGeom, leafMat);
    leaf.position.y = 1.35;
    group.add(leaf);
    // Quelques fruits rouges (releases)
    for (let i = 0; i < 4; i++) {
      const fruitGeom = new T.SphereGeometry(0.1, 8, 6);
      const fruitMat = new T.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7a1010,
        emissiveIntensity: 0.5,
      });
      const fruit = new T.Mesh(fruitGeom, fruitMat);
      const a = (i / 4) * Math.PI * 2;
      fruit.position.set(Math.cos(a) * 0.55, 1.0 + Math.random() * 0.4, Math.sin(a) * 0.55);
      group.add(fruit);
    }
    return group;
  }

  // ─── 🪞 PR Mirror Hall (box socle + plane miroir) ───
  private buildPrMirror(T: any): any {
    const group = new T.Group();
    // Socle
    const baseGeom = new T.BoxGeometry(1.4, 0.4, 1.4);
    const baseMat = new T.MeshStandardMaterial({ color: 0x52525b, roughness: 0.6, metalness: 0.4 });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.2;
    group.add(base);
    // Cadre miroir (deux box vertical + un horizontal)
    const frameMat = new T.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.7 });
    const sideL = new T.Mesh(new T.BoxGeometry(0.1, 1.7, 0.1), frameMat);
    sideL.position.set(-0.6, 1.25, 0);
    group.add(sideL);
    const sideR = new T.Mesh(new T.BoxGeometry(0.1, 1.7, 0.1), frameMat);
    sideR.position.set(0.6, 1.25, 0);
    group.add(sideR);
    const top = new T.Mesh(new T.BoxGeometry(1.3, 0.1, 0.1), frameMat);
    top.position.set(0, 2.05, 0);
    group.add(top);
    // Miroir (plane brillant)
    const mirrorGeom = new T.PlaneGeometry(1.1, 1.5);
    const mirrorMat = new T.MeshStandardMaterial({
      color: 0xa3e9ff,
      emissive: 0xa3e9ff,
      emissiveIntensity: 0.8,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.85,
    });
    const mirror = new T.Mesh(mirrorGeom, mirrorMat);
    mirror.position.set(0, 1.25, 0.05);
    group.add(mirror);
    return group;
  }

  // ─── 🏝 Kanban Mini (sphère island + drapeau) ───
  private buildKanbanMini(T: any): any {
    const group = new T.Group();
    // Mini-île hémisphère sable
    const sandGeom = new T.SphereGeometry(0.85, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const sandMat = new T.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 });
    const sand = new T.Mesh(sandGeom, sandMat);
    sand.position.y = 0;
    group.add(sand);
    // Mât drapeau
    const poleGeom = new T.CylinderGeometry(0.04, 0.04, 1.5, 6);
    const poleMat = new T.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.95 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.set(0, 0.75, 0);
    group.add(pole);
    // Drapeau (plane bleu)
    const flagGeom = new T.PlaneGeometry(0.7, 0.4);
    const flagMat = new T.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0c5a7c,
      emissiveIntensity: 0.4,
      side: T.DoubleSide,
    });
    const flag = new T.Mesh(flagGeom, flagMat);
    flag.position.set(0.38, 1.25, 0);
    group.add(flag);
    // Mini volcan (cone derrière)
    const volGeom = new T.ConeGeometry(0.35, 0.7, 10);
    const volMat = new T.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 });
    const vol = new T.Mesh(volGeom, volMat);
    vol.position.set(-0.4, 0.35, -0.3);
    group.add(vol);
    return group;
  }

  // ─── 🔥 Phoenix Forge (box atelier + cheminée) ───
  private buildPhoenixForge(T: any): any {
    const group = new T.Group();
    const baseGeom = new T.BoxGeometry(1.6, 1.1, 1.4);
    const baseMat = new T.MeshStandardMaterial({
      color: 0x431407,
      roughness: 0.95,
      emissive: 0x701a07,
      emissiveIntensity: 0.2,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.55;
    group.add(base);
    // Cheminée
    const chimGeom = new T.CylinderGeometry(0.22, 0.28, 1.2, 8);
    const chimMat = new T.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.85 });
    const chim = new T.Mesh(chimGeom, chimMat);
    chim.position.set(0.4, 1.7, 0);
    group.add(chim);
    // Flamme au sommet
    const flameGeom = new T.ConeGeometry(0.22, 0.55, 8);
    const flameMat = new T.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xf97316,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.92,
    });
    const flame = new T.Mesh(flameGeom, flameMat);
    flame.position.set(0.4, 2.55, 0);
    group.add(flame);
    // Porte rougeoyante
    const doorGeom = new T.PlaneGeometry(0.55, 0.7);
    const doorMat = new T.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.2,
    });
    const door = new T.Mesh(doorGeom, doorMat);
    door.position.set(-0.4, 0.5, 0.71);
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
    ctx.fillStyle = 'rgba(10,40,20,0.85)';
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
    const T_ = T;
    const others = getOtherIslands('delivery');
    const radius = 12;
    const baseAngle = 0;
    for (let i = 0; i < others.length; i++) {
      const angle = baseAngle + (i / others.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotY = Math.atan2(-x, -z); // face le centre
      const portal = createPortal3D(T_, this.scene, {
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
  // RAYCASTER : clic bâtiment ou portail
  // ═══════════════════════════════════════════════════════════════════
  private handleCanvasClick(e: MouseEvent) {
    if (!this.camera || !this.raycaster) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // D'abord, test portails
    for (const p of this.portals) {
      const target = p.hitTest(this.raycaster);
      if (target) {
        this.router.navigate([target]);
        return;
      }
    }
    // Puis, test bâtiments
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

    // Tick portals
    for (const p of this.portals) p.tick(dt, this.elapsed);

    // Subtle bobbing des bâtiments
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      b.group.rotation.y = Math.sin(this.elapsed * 0.5 + i) * 0.08;
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
