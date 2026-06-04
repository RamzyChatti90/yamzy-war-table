// ═══════════════════════════════════════════════════════════════════
// 🏛 KNOWLEDGE ISLAND HUB — Le Sanctuaire des Voix
//
// Scène 3D : une île cyan avec une bibliothèque cathédrale et un
// étang aquarium oraculaire, 2 bâtiments + 3 portails vers les
// autres îles.
//
// Bâtiments :
//   🏛 library-cathedral     → Cathédrale (box socle + cone toit)
//   🐠 oracle-aquarium       → Étang (sphère bleue + poisson nageant)
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
  fish?: any;
}

@Component({
  selector: 'wt-knowledge-island-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kih-host">
      <header class="kih-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#a78bfa"
                      routerLink="/yamzy-rooms"
                      icon="←"
                      title="Retour à la galerie Yamzy Rooms">Yamzy Rooms</wt-spell-btn>
        <div class="kih-title">
          <h1>🏛 ÎLE DU SAVOIR</h1>
          <p>Le Sanctuaire des Voix — capter et conserver la sagesse</p>
        </div>
        <div class="kih-meta">
          <span class="kih-badge">2 ROOMS</span>
          <span class="kih-badge">3 PORTAILS</span>
        </div>
      </header>

      <canvas #canvas class="kih-canvas"></canvas>

      <footer class="kih-controls">
        <div class="kih-rooms-list">
          <span class="kih-list-label">ROOMS :</span>
          <a routerLink="/library-cathedral" class="kih-room-chip">🏛 Library Cathedral</a>
          <a routerLink="/oracle-aquarium" class="kih-room-chip">🐠 Oracle Aquarium</a>
        </div>
        <span class="kih-spacer"></span>
        <div class="kih-islands-list">
          <span class="kih-list-label">AUTRES ÎLES :</span>
          <a routerLink="/island/delivery" class="kih-island-chip" style="--accent:#86efac">🌿 Livraison</a>
          <a routerLink="/island/strategy" class="kih-island-chip" style="--accent:#a855f7">🌌 Stratégie</a>
          <a routerLink="/island/commerce" class="kih-island-chip" style="--accent:#fbbf24">⚗ Commerce</a>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .kih-host { position: relative; width: 100%; height: 100vh; background: #042f4a; color: #cffafe; font-family: system-ui, sans-serif; }
    .kih-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(4,47,74,0.85) 0%, rgba(4,47,74,0) 100%); pointer-events: none; }
    .kih-topbar > * { pointer-events: auto; }
    .kih-back { color: #67e8f9; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #06b6d4; border-radius: 8px; background: rgba(8,60,90,0.6); }
    .kih-back:hover { background: rgba(6,182,212,0.4); }
    .kih-title h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1.5px; color: #67e8f9; text-shadow: 0 0 12px rgba(103,232,249,0.55); }
    .kih-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    .kih-meta { display: flex; gap: 6px; font-size: 10px; }
    .kih-badge { padding: 4px 10px; background: rgba(6,182,212,0.25); border: 1px solid #06b6d4; border-radius: 6px; color: #67e8f9; letter-spacing: 1px; font-weight: 700; }
    .kih-canvas { display: block; width: 100%; height: 100%; }
    .kih-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 14px; align-items: center; background: linear-gradient(0deg, rgba(4,47,74,0.85) 0%, rgba(4,47,74,0) 100%); flex-wrap: wrap; }
    .kih-rooms-list, .kih-islands-list { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .kih-list-label { font-size: 10px; opacity: 0.6; letter-spacing: 1.5px; font-weight: 700; }
    .kih-room-chip { background: rgba(8,60,90,0.7); color: #67e8f9; border: 1px solid #06b6d4; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .kih-room-chip:hover { background: rgba(6,182,212,0.45); box-shadow: 0 0 10px rgba(103,232,249,0.35); }
    .kih-island-chip { background: rgba(20,20,40,0.7); color: var(--accent, #fbbf24); border: 1px solid var(--accent, #fbbf24); padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
    .kih-island-chip:hover { background: rgba(0,0,0,0.5); box-shadow: 0 0 10px var(--accent, #fbbf24); }
    .kih-spacer { flex: 1 1 20px; }
  `]
})
export class KnowledgeIslandHubComponent implements OnInit, OnDestroy {
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

  private readonly islandDef: IslandDef = ISLANDS.find(i => i.id === 'knowledge')!;

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

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x042f4a);
    this.scene.fog = new T.FogExp2(0x064e74, 0.012);

    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 250);
    this.camera.position.set(15, 13, 15);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new T.AmbientLight(0x60a8c8, 0.5));
    const sun = new T.DirectionalLight(0xe6f3ff, 0.9);
    sun.position.set(12, 20, 8);
    this.scene.add(sun);
    const hemi = new T.HemisphereLight(0x67e8f9, 0x0a3a4a, 0.55);
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
      if (c.sourceRoom === 'island-knowledge') return; // anti-loop
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

    console.log('[KnowledgeIslandHub] 🏛 Scene ready · 2 buildings + 3 portals');

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
  // BUILD : île pierre + eau
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any) {
    const geom = new T.CylinderGeometry(9, 9.4, 1.2, 42);
    const mat = new T.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      emissive: 0x0a3a4a,
      emissiveIntensity: 0.18,
    });
    const island = new T.Mesh(geom, mat);
    island.position.y = 0.6;
    this.scene.add(island);

    // Dalles de marbre (cubes blancs) au sol
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 6.5;
      const dalleGeom = new T.BoxGeometry(0.6, 0.08, 0.6);
      const dalleMat = new T.MeshStandardMaterial({
        color: 0xcffafe,
        roughness: 0.5,
        emissive: 0x1a4a4a,
        emissiveIntensity: 0.15,
      });
      const dalle = new T.Mesh(dalleGeom, dalleMat);
      dalle.position.set(Math.cos(a) * r, 1.24, Math.sin(a) * r);
      dalle.rotation.y = a;
      this.scene.add(dalle);
    }

    // Petits piliers Ioniques en bordure
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
      const r = 7.8;
      const pillarGeom = new T.CylinderGeometry(0.15, 0.18, 0.9, 12);
      const pillarMat = new T.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.7,
        emissive: 0x1a3a4a,
        emissiveIntensity: 0.12,
      });
      const pillar = new T.Mesh(pillarGeom, pillarMat);
      pillar.position.set(Math.cos(a) * r, 1.65, Math.sin(a) * r);
      this.scene.add(pillar);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : anneau océan
  // ═══════════════════════════════════════════════════════════════════
  private buildOceanRing(T: any) {
    const geom = new T.CylinderGeometry(70, 70, 0.5, 64);
    const mat = new T.MeshStandardMaterial({
      color: 0x0c7490,
      roughness: 0.35,
      metalness: 0.45,
      transparent: true,
      opacity: 0.82,
      emissive: 0x0a4a64,
      emissiveIntensity: 0.2,
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
    const builders: Array<(T: any) => { meshGroup: any; fish?: any }> = [
      (T) => ({ meshGroup: this.buildLibraryCathedral(T) }), // 🏛 library-cathedral
      (T) => this.buildOracleAquarium(T),                     // 🐠 oracle-aquarium
    ];

    // 2 bâtiments → positions opposées
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

      const label = this.makeLabel(T, rooms[i].icon + ' ' + rooms[i].name, 0x06b6d4);
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
      this.buildings.push({ group, targetRoute: rooms[i].route, hitObjects, fish: built.fish });
    }
  }

  // ─── 🏛 Library Cathedral (socle + toit + vitrail) ───
  private buildLibraryCathedral(T: any): any {
    const group = new T.Group();
    // Socle large
    const baseGeom = new T.BoxGeometry(1.8, 1.4, 1.5);
    const baseMat = new T.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.7,
      emissive: 0x1a3a4a,
      emissiveIntensity: 0.18,
    });
    const base = new T.Mesh(baseGeom, baseMat);
    base.position.y = 0.7;
    group.add(base);
    // Toit (cone)
    const roofGeom = new T.ConeGeometry(1.3, 1.2, 4);
    const roofMat = new T.MeshStandardMaterial({
      color: 0x0891b2,
      roughness: 0.5,
      metalness: 0.4,
      emissive: 0x0a4a64,
      emissiveIntensity: 0.35,
    });
    const roof = new T.Mesh(roofGeom, roofMat);
    roof.position.y = 2.0;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    // Vitrail rond (cercle émissif sur la face)
    const vitGeom = new T.CircleGeometry(0.35, 24);
    const vitMat = new T.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.2,
      side: T.DoubleSide,
    });
    const vit = new T.Mesh(vitGeom, vitMat);
    vit.position.set(0, 1.0, 0.76);
    group.add(vit);
    // Croix au sommet
    const crossVertGeom = new T.BoxGeometry(0.06, 0.5, 0.06);
    const crossMat = new T.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.8,
    });
    const crossVert = new T.Mesh(crossVertGeom, crossMat);
    crossVert.position.y = 2.85;
    group.add(crossVert);
    const crossHorGeom = new T.BoxGeometry(0.3, 0.06, 0.06);
    const crossHor = new T.Mesh(crossHorGeom, crossMat);
    crossHor.position.y = 2.9;
    group.add(crossHor);
    return group;
  }

  // ─── 🐠 Oracle Aquarium (étang sphère + poisson) ───
  private buildOracleAquarium(T: any): { meshGroup: any; fish: any } {
    const group = new T.Group();
    // Vasque (cylindre court)
    const basinGeom = new T.CylinderGeometry(1.2, 1.1, 0.5, 24);
    const basinMat = new T.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.7,
      metalness: 0.3,
    });
    const basin = new T.Mesh(basinGeom, basinMat);
    basin.position.y = 0.25;
    group.add(basin);
    // Eau (cylindre transparent légèrement plus petit)
    const waterGeom = new T.CylinderGeometry(1.1, 1.0, 0.3, 24);
    const waterMat = new T.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.5,
    });
    const water = new T.Mesh(waterGeom, waterMat);
    water.position.y = 0.45;
    group.add(water);

    // Poisson : ellipsoid + queue triangulaire
    const fishGroup = new T.Group();
    const bodyGeom = new T.SphereGeometry(0.18, 12, 8);
    const bodyMat = new T.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 0.6,
      roughness: 0.5,
    });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.scale.set(1.6, 1, 1);
    fishGroup.add(body);
    const tailGeom = new T.ConeGeometry(0.12, 0.22, 6);
    const tail = new T.Mesh(tailGeom, bodyMat);
    tail.position.set(-0.35, 0, 0);
    tail.rotation.z = Math.PI / 2;
    fishGroup.add(tail);
    fishGroup.position.set(0.6, 0.55, 0);
    group.add(fishGroup);

    // Bulles (Points blanches au-dessus de l'eau)
    const bubblePos = new Float32Array(20 * 3);
    for (let i = 0; i < 20; i++) {
      bubblePos[i * 3 + 0] = (Math.random() - 0.5) * 1.6;
      bubblePos[i * 3 + 1] = 0.5 + Math.random() * 0.8;
      bubblePos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    const bubbleGeom = new T.BufferGeometry();
    bubbleGeom.setAttribute('position', new T.BufferAttribute(bubblePos, 3));
    const bubbleMat = new T.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: T.AdditiveBlending,
    });
    const bubbles = new T.Points(bubbleGeom, bubbleMat);
    group.add(bubbles);

    return { meshGroup: group, fish: fishGroup };
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : Labels sprites
  // ═══════════════════════════════════════════════════════════════════
  private makeLabel(T: any, text: string, color: number): any {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(4,47,74,0.85)';
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
    const others = getOtherIslands('knowledge');
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
      // Poisson nage en cercle
      if (b.fish) {
        const r = 0.55;
        b.fish.position.x = Math.cos(this.elapsed * 1.2) * r;
        b.fish.position.z = Math.sin(this.elapsed * 1.2) * r;
        b.fish.rotation.y = -this.elapsed * 1.2 + Math.PI / 2;
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
