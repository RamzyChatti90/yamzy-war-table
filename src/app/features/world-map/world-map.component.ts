// ════════════════════════════════════════════════════════════════════════
// 🗺 WORLD MAP — Page dédiée /world-map
//
// Charge treasure-island.glb (île animée avec coffre + fantôme),
// pose 7 drapeaux cliquables sur la surface (Plane_2 = référence).
// Lumière SOBRE (le GLB a son éclairage baked-in dans les textures).
// Animation native du GLB jouée en loop infini.
// ════════════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MAP_MARKERS, MapMarker, STORAGE_KEY_PREFIX } from './world-map.markers';
import { loadZoneGlb } from './world-map.storage';

@Component({
  selector: 'wt-world-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wm-host">
      <canvas #canvas class="wm-canvas"></canvas>
      <div class="wm-hint">🖱 Drag pour orbiter · 🛞 Molette pour zoomer · Clic sur un drapeau pour entrer</div>
      <div class="wm-edit-panel">
        <div class="wm-edit-title">✏️ Éditer une zone</div>
        <button *ngFor="let m of markers" class="wm-edit-btn"
                [style.borderColor]="hexColor(m.color)"
                (click)="editZone(m)">
          <span class="wm-edit-dot" [style.background]="hexColor(m.color)"></span>
          {{ m.label }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
    .wm-host {
      position: relative;
      width: 100%; height: 100%;
      background: radial-gradient(circle at 50% 40%, #1a1a2e 0%, #050617 80%);
      color: #fff;
      font-family: "Tinos", serif;
    }
    .wm-canvas {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      display: block;
    }
    .wm-hint {
      position: fixed;
      bottom: 24px; left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      font-size: 13px;
      letter-spacing: 0.06em;
      background: rgba(0,0,0,0.55);
      padding: 8px 18px;
      border-radius: 6px;
      border: 1px solid rgba(213,74,223,0.4);
      backdrop-filter: blur(6px);
      pointer-events: none;
    }
    .wm-edit-panel {
      position: fixed;
      top: 24px; right: 24px;
      z-index: 12;
      display: flex; flex-direction: column;
      gap: 6px;
      background: rgba(8,10,24,0.7);
      padding: 14px;
      border-radius: 10px;
      border: 1px solid rgba(213,74,223,0.35);
      backdrop-filter: blur(8px);
      min-width: 180px;
    }
    .wm-edit-title {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #d54adf;
      margin-bottom: 4px;
      font-family: "Henny Penny", cursive;
    }
    .wm-edit-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px;
      background: rgba(0,0,0,0.4);
      border: 1px solid;
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      font-family: "Tinos", serif;
    }
    .wm-edit-btn:hover {
      background: rgba(255,255,255,0.12);
      transform: translateX(-2px);
    }
    .wm-edit-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      box-shadow: 0 0 6px currentColor;
    }
  `],
})
export class WorldMapComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;
  private router = inject(Router);

  /** Liste partagée des marqueurs (utilisée par le panneau ✏️) */
  readonly markers: ReadonlyArray<MapMarker> = MAP_MARKERS;
  hexColor(c: number): string { return '#' + c.toString(16).padStart(6, '0'); }
  editZone(m: MapMarker): void { this.router.navigateByUrl(`/world-map/edit/${m.key}`); }

  private scene: any;
  /** Racine de treasure-island.glb (avec scale+centrage appliqués). Utilisée pour ajouter
   *  des îles en `useNativePos` comme enfants → ils héritent du même référentiel. */
  private islandRoot: any = null;
  private camera: any;
  private renderer: any;
  private clock: any;
  private mixer: any = null;
  private mainAction: any = null;
  private clickableFlags: any[] = [];
  private elapsed = 0;
  private rafId = 0;
  private disposed = false;

  // ─── Cinematic mouette : suivi caméra + lerp vers boat à la fin ───
  private mouetteNode: any = null;
  private mouettePhase: 'native' | 'flyToBoat' | 'done' = 'native';
  private flyStartElapsed = 0;
  private flyFromWorld: any = null;
  private flyToWorld: any = null;
  private readonly FLY_TO_BOAT_DURATION = 8;     // secondes pour aller au boat
  private readonly CINEMATIC_CAM_FOLLOW = true;
  /** Fraction de l'écran que la mouette doit occuper (0.40 = 40% du plus petit côté). */
  private readonly CINEMATIC_SCREEN_FRACTION = 0.40;
  private cinematicCamSnapped = false;           // flag : caméra a été snappée au 1er frame
  private mouetteSize = 0.1;                     // taille auto-calculée (max bbox) du node mouette
  /** Multiplicateur appliqué à la taille de la mouette pour la distance caméra. */
  private readonly CINEMATIC_DIST_RATIO = 4.0;
  /** Élévation caméra au-dessus de la mouette (en fraction de sa taille). */
  private readonly CINEMATIC_HEIGHT_RATIO = 1.0;

  // Orbit controls (manuel)
  private orbitYaw = 0;
  private orbitPitch = 0.45;
  private orbitDistance = 2.0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  ngOnInit(): void { this.bootstrap(); }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    try { this.renderer?.dispose(); } catch {}
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
  }

  private async bootstrap(): Promise<void> {
    await this.loadThreeJs();
    if (this.disposed) return;
    const T = (window as any).THREE;

    // Scene + camera + renderer
    this.scene = new T.Scene();
    this.scene.background = null;     // transparent (let CSS gradient show)
    this.scene.fog = null;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace || 3001;
    this.camera = new T.PerspectiveCamera(45, w / h, 0.05, 50);
    this.clock = new T.Clock();

    // 🌗 LUMIÈRE SOBRE — le GLB Sketchfab a son éclairage baked dans ses textures
    const ambient = new T.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);
    const sun = new T.DirectionalLight(0xfff0d8, 0.45);
    sun.position.set(2, 4, 2);
    this.scene.add(sun);

    // Setup event listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });

    // Charge le GLB
    await this.loadTreasureIsland(T);

    // Démarre la boucle de rendu
    this.animate();
  }

  private async loadThreeJs(): Promise<void> {
    if ((window as any).THREE?.GLTFLoader) return;
    await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
  }
  private loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('script load failed ' + src));
      document.head.appendChild(s);
    });
  }

  private async loadTreasureIsland(T: any): Promise<void> {
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }
    const gltf: any = await new Promise<any>((res, rej) => {
      loader.load('/assets/conclave/models/treasure-island.glb', res, undefined, rej);
    });
    if (this.disposed) return;

    const island = gltf.scene;
    island.name = 'treasure_island';
    this.islandRoot = island;   // ⚡ exposé pour les îles useNativePos (enfants)
    this.scene.add(island);

    // 🎯 Identification : Plane_2 = surface principale (référence)
    let planeNode: any = null;
    island.traverse((obj: any) => {
      if (!planeNode && obj.name === 'Plane_2') planeNode = obj;
    });
    if (!planeNode) {
      console.warn('[WorldMap] Plane_2 introuvable — fallback scene bbox');
      planeNode = island;
    } else {
      console.log('[WorldMap] ✓ Plane_2 identifié (réf ancrage)');
    }

    // Auto-fit : scale + centrage sur Plane_2 (PAS scene global qui inclut le coffre décalé)
    island.updateWorldMatrix(true, true);
    const refBbox = new T.Box3().setFromObject(planeNode);
    const refSize = new T.Vector3(); refBbox.getSize(refSize);
    const scale = 1.0 / Math.max(refSize.x, refSize.z);
    island.scale.setScalar(scale);
    island.updateWorldMatrix(true, true);

    const finalRefBbox = new T.Box3().setFromObject(planeNode);
    const finalCenter = new T.Vector3(); finalRefBbox.getCenter(finalCenter);
    island.position.sub(finalCenter);
    island.updateWorldMatrix(true, true);

    // 🔎 Cherche les Empties nommés `marker_{key}` dans le GLB
    // ⚡ Aucune manipulation : on prend EXACTEMENT la position WORLD du marker.
    const namedMarkers = new Map<string, any>();
    for (const m of MAP_MARKERS) {
      let node: any = null;
      island.traverse((obj: any) => {
        if (!node && obj.name === m.blenderName) node = obj;
      });
      if (node) {
        node.updateWorldMatrix(true, false);
        const worldPos = new T.Vector3();
        node.getWorldPosition(worldPos);
        namedMarkers.set(m.key, worldPos);
        console.log(`[WorldMap] ✓ ${m.blenderName} → (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
      }
    }

    // 🎬 Animation NATIVE du GLB — LOOP INFINI
    if (gltf.animations && gltf.animations.length) {
      this.mixer = new T.AnimationMixer(island);
      for (const clip of gltf.animations) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(T.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.reset();
        action.play();
        if (!this.mainAction) this.mainAction = action;
        console.log(`[WorldMap] ▶ Action "${clip.name}" duration=${clip.duration.toFixed(2)}s loop=Repeat ∞`);
      }
    }

    // 🐦 Identifie la mouette/ghost animée (Sphere_10 dans treasure-island.glb).
    // Sera utilisée pour : 1) suivi caméra cinématique, 2) lerp vers boat à la fin.
    island.traverse((obj: any) => {
      if (this.mouetteNode) return;
      if (/^Sphere_10|MOUETTE|mouette/i.test(obj.name || '')) this.mouetteNode = obj;
    });
    if (this.mouetteNode) {
      // ⚡ Calcule auto la taille (max bbox) pour déterminer la distance caméra
      this.mouetteNode.updateWorldMatrix(true, true);
      const bbox = new T.Box3().setFromObject(this.mouetteNode);
      const size = new T.Vector3(); bbox.getSize(size);
      const maxBbox = Math.max(size.x, size.y, size.z);
      if (!bbox.isEmpty() && isFinite(maxBbox) && maxBbox > 0.001) {
        this.mouetteSize = maxBbox;
      } else {
        // Fallback : scale du node (utile si node sans mesh visible direct)
        const ws = new T.Vector3();
        this.mouetteNode.getWorldScale(ws);
        this.mouetteSize = Math.max(0.05, Math.max(ws.x, ws.y, ws.z) * 0.5);
      }
      console.log(`[WorldMap] 🐦 Mouette "${this.mouetteNode.name}" — size=${this.mouetteSize.toFixed(3)} → cam dist=${(this.mouetteSize * this.CINEMATIC_DIST_RATIO).toFixed(3)}`);
    } else {
      console.log(`[WorldMap] ⚠ Pas de mouette/Sphere_10 trouvée — cinematic camera désactivée`);
    }

    // 1. Charge d'abord les îles → renvoie l'ensemble des zones qui en ont une
    // 2. Pose un drapeau UNIQUEMENT pour les zones SANS île
    const zonesWithIsland = await this.loadZoneIslands(T, namedMarkers);
    this.addFlagMarkers(T, namedMarkers, zonesWithIsland);

    // Setup camera
    this.updateCamera();
  }

  private addFlagMarkers(
    T: any, namedMarkers: Map<string, any>, zonesWithIsland: Set<string>,
  ): void {
    const FLAG_HEIGHT = 0.18;
    const overlayGroup = new T.Group();
    overlayGroup.name = 'flag_markers';
    this.scene.add(overlayGroup);

    const MARKER_SCALE = 0.8;
    let count = 0;
    for (const z of MAP_MARKERS) {
      const worldPos = namedMarkers.get(z.key);
      if (!worldPos) continue;   // pas de marker dans le GLB → pas de drapeau
      if (zonesWithIsland.has(z.key)) continue;   // île présente → pas de drapeau (île remplace visuellement)
      const fg = new T.Group();
      // ⚡ Position EXACTE du marker, aucune manip (X, Y, Z directs)
      fg.position.copy(worldPos);
      fg.scale.setScalar(MARKER_SCALE);
      fg.userData = { zone: z };
      count++;

      // Mât bois brun
      const mast = new T.Mesh(
        new T.CylinderGeometry(0.006, 0.006, FLAG_HEIGHT, 6),
        new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 }),
      );
      mast.position.y = FLAG_HEIGHT / 2;
      fg.add(mast);

      // Drapeau coloré
      const flag = new T.Mesh(
        new T.PlaneGeometry(0.10, 0.06),
        new T.MeshStandardMaterial({
          color: z.color, emissive: z.color, emissiveIntensity: 0.55,
          side: T.DoubleSide,
        }),
      );
      flag.position.set(0.056, FLAG_HEIGHT - 0.035, 0);
      fg.add(flag);

      // Petite bille décorative au sommet
      const top = new T.Mesh(
        new T.SphereGeometry(0.012, 8, 6),
        new T.MeshStandardMaterial({
          color: z.color, emissive: z.color, emissiveIntensity: 0.8,
        }),
      );
      top.position.y = FLAG_HEIGHT;
      fg.add(top);

      // Anneau pulsant à la base
      const ring = new T.Mesh(
        new T.RingGeometry(0.04, 0.055, 24),
        new T.MeshBasicMaterial({
          color: z.color, side: T.DoubleSide, transparent: true, opacity: 0.6,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.002;
      fg.add(ring);
      (fg.userData as any).pulseRing = ring;

      overlayGroup.add(fg);
      this.clickableFlags.push(fg);
    }
    console.log(`[WorldMap] ✓ ${count} drapeaux posés aux positions des markers`);
  }

  // ═════════════════════════════════════════════════════════════════
  // 🏝 Charge le GLB d'île par zone à la position EXACTE du marker
  // Priorité : IndexedDB (sauvegardé par l'éditeur) → /assets/ statique
  // Applique transform (pos/rot/scl) sauvegardée par l'éditeur si présente.
  // Retourne l'ensemble des clés de zones qui ont effectivement une île.
  // ═════════════════════════════════════════════════════════════════
  private async loadZoneIslands(T: any, namedMarkers: Map<string, any>): Promise<Set<string>> {
    const loaded = new Set<string>();
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }

    for (const m of MAP_MARKERS) {
      if (this.disposed) return loaded;
      const worldPos = namedMarkers.get(m.key);
      // useNativePos : on n'a PAS besoin de marker_<key>, on garde la transform native du GLB
      if (!m.useNativePos && !worldPos) continue;   // pas de marker → pas d'île

      // 1. Tente IndexedDB (sauvegardé par l'éditeur)
      let gltf: any = null;
      let source = '';
      try {
        const blob = await loadZoneGlb(m.key);
        if (blob) {
          const url = URL.createObjectURL(blob);
          gltf = await new Promise<any>((res, rej) => loader.load(url, res, undefined, rej));
          URL.revokeObjectURL(url);
          source = 'IndexedDB';
        }
      } catch {}
      // 2. Fallback : GLB statique
      if (!gltf) {
        try {
          gltf = await new Promise<any>((res, rej) => loader.load(m.islandGlb, res, undefined, rej));
          source = m.islandGlb;
        } catch { /* GLB absent → skip */ }
      }
      if (!gltf || this.disposed) continue;

      const obj = gltf.scene;
      obj.name = `zone_island_${m.key}`;

      if (m.useNativePos) {
        // ⚡ useNativePos : GLB déjà positionné/scalé dans Blender → on l'ajoute comme
        // ENFANT de treasure-island root pour hériter du scale+centrage auto-fit.
        // → la transform du GLB est interprétée dans le même repère que treasure-island.
        const parent = this.islandRoot ?? this.scene;
        obj.userData = { zone: m };
        this.clickableFlags.push(obj);
        parent.add(obj);
        loaded.add(m.key);
        console.log(`[WorldMap] ✓ Zone '${m.key}' (${source}) — native pos, ajoutée comme enfant de ${parent === this.islandRoot ? 'treasure_island' : 'scene'}`);
        continue;
      }

      // ⚡ Default : container ancré sur le marker (position WORLD du Empty)
      // L'éditeur travaille avec origin = marker, donc la transform sauvegardée
      // s'applique en LOCAL dans le container.
      const container = new T.Group();
      container.position.copy(worldPos);
      container.name = `zone_container_${m.key}`;

      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + m.key);
        if (saved) {
          const tr = JSON.parse(saved);
          if (Array.isArray(tr.pos)) obj.position.set(tr.pos[0], tr.pos[1], tr.pos[2]);
          if (Array.isArray(tr.rot)) obj.rotation.set(tr.rot[0], tr.rot[1], tr.rot[2]);
          if (Array.isArray(tr.scl)) obj.scale.set(tr.scl[0], tr.scl[1], tr.scl[2]);
        }
      } catch {}

      container.add(obj);
      container.userData = { zone: m };
      this.clickableFlags.push(container);

      this.scene.add(container);
      loaded.add(m.key);
      console.log(`[WorldMap] ✓ Zone '${m.key}' (${source}) au marker (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`);
    }
    return loaded;
  }

  // ─── Boucle de rendu ───
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;

    // ⚡ Anim native du GLB (coffre + fantôme)
    if (this.mixer) this.mixer.update(dt);

    // 🐦 Cinematic mouette : phase native → fly-to-boat → done
    this.updateMouetteCinematic();

    // ⚡ Pulse visuel des anneaux uniquement — AUCUNE modif de position des markers
    for (let i = 0; i < this.clickableFlags.length; i++) {
      const ring = this.clickableFlags[i].userData.pulseRing;
      if (ring) {
        const s = 1 + Math.sin(this.elapsed * 2 + i * 0.5) * 0.15;
        ring.scale.set(s, s, 1);
        ring.material.opacity = 0.4 + Math.sin(this.elapsed * 2 + i * 0.5) * 0.2;
      }
    }

    // Update camera orbit
    this.updateCamera();

    this.renderer.render(this.scene, this.camera);
  };

  // ═════════════════════════════════════════════════════════════════
  // 🐦 Cinematic mouette (phase: native → flyToBoat → done)
  // ═════════════════════════════════════════════════════════════════
  private updateMouetteCinematic(): void {
    if (!this.mouetteNode) return;
    const T = (window as any).THREE;

    // Phase 1 → 2 : transition quand l'anim native finit
    if (this.mouettePhase === 'native' && this.mainAction && !this.mainAction.isRunning()) {
      // Cherche le boat dans la scène
      const boat = this.scene.getObjectByName('zone_island_boat');
      if (boat) {
        this.flyFromWorld = new T.Vector3();
        this.mouetteNode.getWorldPosition(this.flyFromWorld);
        this.flyToWorld = new T.Vector3();
        boat.getWorldPosition(this.flyToWorld);
        // Cible un peu au-dessus du boat (pour pas planter dedans)
        this.flyToWorld.y += 0.05;
        this.flyStartElapsed = this.elapsed;
        this.mouettePhase = 'flyToBoat';
        console.log(`[WorldMap] 🐦 Phase fly-to-boat — from (${this.flyFromWorld.x.toFixed(2)}, ${this.flyFromWorld.y.toFixed(2)}, ${this.flyFromWorld.z.toFixed(2)}) → to (${this.flyToWorld.x.toFixed(2)}, ${this.flyToWorld.y.toFixed(2)}, ${this.flyToWorld.z.toFixed(2)})`);
      } else {
        // Pas de boat → on arrête simplement
        this.mouettePhase = 'done';
        console.log(`[WorldMap] 🐦 Anim native finie, pas de zone_island_boat → done`);
      }
    }

    // Phase 2 : lerp mouette world → boat (avec arc en S)
    if (this.mouettePhase === 'flyToBoat' && this.flyFromWorld && this.flyToWorld) {
      const t = Math.min(1, (this.elapsed - this.flyStartElapsed) / this.FLY_TO_BOAT_DURATION);
      const ease = t * t * (3 - 2 * t);   // smoothstep
      const targetWorld = this.flyFromWorld.clone().lerp(this.flyToWorld, ease);
      // Petit arc vertical pour pas voler en ligne droite
      const arc = Math.sin(t * Math.PI) * 0.15;
      targetWorld.y += arc;
      // Convertit world → parent local pour set position
      const parent = this.mouetteNode.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        const local = targetWorld.clone();
        parent.worldToLocal(local);
        this.mouetteNode.position.copy(local);
      }
      if (t >= 1) {
        this.mouettePhase = 'done';
        console.log(`[WorldMap] 🐦 Mouette arrivée au boat`);
      }
    }
  }

  private updateCamera(): void {
    if (!this.camera) return;
    // 🎥 Caméra cinématique : suit la mouette pendant phases native + flyToBoat
    if (this.CINEMATIC_CAM_FOLLOW && this.mouetteNode && this.mouettePhase !== 'done') {
      const T = (window as any).THREE;
      const mouetteWorld = new T.Vector3();
      this.mouetteNode.getWorldPosition(mouetteWorld);
      // ⚡ Distance AUTO calculée depuis : taille bbox + FOV caméra + ratio écran
      // Formule perspective : un objet de taille S est visible à 100% à distance
      // d = S / (2 × tan(fov/2)). On vise une fraction f de l'écran → d = S / (2 × f × tan(fov/2)).
      // On compare vertical et horizontal pour ne pas couper le sujet quand l'aspect ratio est extrême.
      const fovRad = this.camera.fov * Math.PI / 180;
      const aspect = this.camera.aspect || 1;
      const tanHalfFov = Math.tan(fovRad / 2);
      const f = this.CINEMATIC_SCREEN_FRACTION;
      const distVert = this.mouetteSize / (2 * f * tanHalfFov);
      const distHoriz = this.mouetteSize / (2 * f * tanHalfFov * aspect);
      const dist = Math.max(distVert, distHoriz, this.mouetteSize * 1.5);   // min safety
      const camPitch = 0.30;
      const camYaw = this.elapsed * 0.25;
      const desired = new T.Vector3(
        mouetteWorld.x + Math.sin(camYaw) * dist * Math.cos(camPitch),
        mouetteWorld.y + Math.sin(camPitch) * dist + this.mouetteSize * 0.3,
        mouetteWorld.z + Math.cos(camYaw) * dist * Math.cos(camPitch),
      );
      // ⚡ 1er frame de cinematic : snap direct (sinon lerp depuis la position de zoom user prend une éternité)
      if (!this.cinematicCamSnapped) {
        this.camera.position.copy(desired);
        this.cinematicCamSnapped = true;
      }
      // Near/far recalculés à CHAQUE frame (mouetteSize peut changer si bbox réévaluée)
      this.camera.near = Math.max(0.0005, dist * 0.01);
      this.camera.far  = Math.max(50, dist * 100);
      this.camera.updateProjectionMatrix();
      if (this.cinematicCamSnapped) {
        this.camera.position.lerp(desired, 0.15);
      }
      this.camera.lookAt(mouetteWorld);
      return;
    }
    // Mode normal : orbit manuel autour de l'origine
    const x = Math.sin(this.orbitYaw) * this.orbitDistance * Math.cos(this.orbitPitch);
    const y = Math.sin(this.orbitPitch) * this.orbitDistance;
    const z = Math.cos(this.orbitYaw) * this.orbitDistance * Math.cos(this.orbitPitch);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0.1, 0);
  }

  // ─── Souris/touch ───
  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
  private onPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement;
    if (target?.tagName === 'BUTTON') return;
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.orbitYaw -= dx * 0.005;
    this.orbitPitch -= dy * 0.005;
    this.orbitPitch = Math.max(0.1, Math.min(1.4, this.orbitPitch));
  };
  private onPointerUp = (): void => {
    this.isDragging = false;
    // Tente un raycast click sur les drapeaux (si on a peu bougé)
    this.tryClickFlag();
  };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // ⚡ Zoom quasi infini : pas multiplicatif (×1.15 / ÷1.15) → courbe exponentielle
    // Plage 0.005 → 1000 unités. Détails fins de l'île au min, vue panoramique au max.
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    this.orbitDistance = Math.max(0.005, Math.min(1000, this.orbitDistance * factor));
    // Adapte near/far dynamiquement (sinon clipping z-fighting au max zoom)
    if (this.camera) {
      this.camera.near = Math.max(0.0005, this.orbitDistance * 0.005);
      this.camera.far  = Math.max(100, this.orbitDistance * 25);
      this.camera.updateProjectionMatrix();
    }
  };

  private tryClickFlag(): void {
    const T = (window as any).THREE;
    if (!T || !this.camera) return;
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const mouse = new T.Vector2(
      ((this.lastMouseX - rect.left) / rect.width) * 2 - 1,
      -((this.lastMouseY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hits = ray.intersectObjects(this.clickableFlags, true);
    if (hits.length === 0) return;
    let obj = hits[0].object;
    while (obj && !obj.userData?.zone) obj = obj.parent;
    if (obj?.userData?.zone) {
      const zone = obj.userData.zone;
      console.log(`[WorldMap] 🗺 Click → ${zone.label} → ${zone.route}`);
      this.router.navigateByUrl(zone.route);
    }
  }
}
