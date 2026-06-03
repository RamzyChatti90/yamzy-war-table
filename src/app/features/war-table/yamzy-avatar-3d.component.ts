// WAR TABLE ⚔ — Mini avatar 3D Yamzy pour le Sage panel (foreground).
// Charge YAMZY.glb, anime rotation + idle bobbing, transparent background.

import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-yamzy-avatar-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ya3d-wrap">
      <canvas #canvas></canvas>
      <div *ngIf="loadFailed" class="ya3d-fallback">🪶</div>
    </div>
  `,
  styles: [`
    .ya3d-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: block;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .ya3d-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 96px;
      color: #f5e3ad;
      filter: drop-shadow(0 4px 16px rgba(217, 154, 81, .65));
      animation: ya3d-fallback-pulse 2.4s ease-in-out infinite;
    }
    @keyframes ya3d-fallback-pulse {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.08); }
    }
  `]
})
export class YamzyAvatar3dComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  @Input() glbUrl = '/assets/agents/YAMZY.glb';
  /** Rotation idle Y. Par défaut désactivée — avatar fixe. */
  @Input() rotate = false;
  /** v1.0.17 — Bobbing vertical idle (translateY sinusoïdal). */
  @Input() bob = false;
  /** v1.0.17 — Joue les animations natives du GLB via THREE.AnimationMixer. */
  @Input() playGlbAnim = false;
  /** v1.0.177bg — Vitesse de lecture du mixer (1 = naturel). 0.85 = ralenti 15%, 1.5 = accéléré 50%.
   *  Utilisé pour caler la bubble.glb (floating alerts) sur la durée repos = 2.04s par cycle. */
  @Input() glbAnimationSpeed = 1;
  /** Tint optionnel (vert quand actif, etc.). Si null, GLB natif. */
  @Input() tintColor: string | null = null;
  /** v1.0.173 — GLB COMPAGNON : chargé EN PLUS du principal. Affiché côte-à-côte. */
  @Input() companionGlbUrl: string | null = null;
  /** v1.0.173 — Si true, joue l'animation du companion sur le modèle PRINCIPAL (retargeting par nom de bone). */
  @Input() useCompanionAnimation = false;
  /** v1.0.173 — Position du companion par rapport au modèle principal (XYZ). */
  @Input() companionOffset: [number, number, number] = [0, 0, 0];
  /** v1.0.174 — Offset Y du modèle principal (pour descendre YAMZY sur le sol). */
  @Input() modelYOffset = 0;
  /** v1.0.177z — Offsets X et Z du modèle principal (permet de déplacer YAMZY sur le plan
   *  horizontal — vers le wizzard par exemple — et le persister via les signals war-table). */
  @Input() modelXOffset = 0;
  @Input() modelZOffset = 0;
  /** v1.0.177ak — Scale uniforme du modèle principal (YAMZY). 1 = taille native, >1 plus grand. */
  @Input() modelScale = 1;
  /** v1.0.174 — Scale auto du companion : si false, garde la taille native du GLB. */
  @Input() companionAutoScale = false;
  /** v1.0.175 — Scale uniform du companion (multiplie sa taille). */
  @Input() companionScale = 1;
  /** v1.0.175 — Rotation du companion (degrees, XYZ). */
  @Input() companionRotation: [number, number, number] = [0, 0, 0];
  /** v1.0.175 — Mapping bone name : { wizzard_bone: yamzy_bone } pour retargeter l'anim. */
  @Input() boneMapping: Record<string, string> = {};
  /** v1.0.175 — Émis quand les 2 modèles sont chargés : liste des bones disponibles. */
  @Output() bonesReady = new EventEmitter<{ main: string[]; companion: string[] }>();
  /** v1.0.177ap — Liste des animations YAMZY (name + duration en sec + tracks count + a-t-il un morphTarget/weights ?). */
  @Output() animationsLoaded = new EventEmitter<Array<{ name: string; duration: number; trackCount: number; hasMorph: boolean; targets: string[] }>>();
  /** v1.0.177aq — Liste des OBJETS animés (target node names uniques) à travers toutes les anims.
   *  Pour chaque : nb d'anims qui le référencent + duration max + a-t-il un morph track ?. */
  @Output() animObjectsLoaded = new EventEmitter<Array<{ name: string; animsCount: number; maxDuration: number; hasMorph: boolean }>>();
  /** v1.0.177ap — Map clipName → cutTime (sec). Si cutTime>0 et < duration → l'anim est splittée en 2 parts.
   *  La part1 va de 0 à cutTime, la part2 va de cutTime à duration (shiftée pour démarrer à 0). */
  @Input() animSplits: Record<string, number> = {};
  /** v1.0.177ap — Mode de lecture par clip : 'original' / 'part1' / 'part2' / 'sequential' (part1→part2 en boucle). */
  @Input() animPlayMode: Record<string, 'original' | 'part1' | 'part2' | 'sequential'> = {};
  /** v1.0.177aq/as — SPLIT PAR OBJET : key = nom du target node, value = ARRAY de cutTimes (sec).
   *  Plusieurs cuts = N+1 parts. Ex: [4.16, 4.91] → 3 parts. Triés automatiquement à l'application. */
  @Input() objectSplits: Record<string, number[]> = {};
  /** v1.0.177as — Mode de lecture par objet : 'all' (= toutes parts) ou 'partN' (1-based). */
  @Input() objectPlayModes: Record<string, string> = {};
  /** v1.0.177au — SPLIT GLOBAL : s'applique à TOUTES les tracks de TOUTES les anims YAMZY.
   *  N cuts → N+1 parts. Ex: [4.16, 4.91] sur durée 8.46s → 3 parts (before_explode/repos/create_bubble). */
  @Input() globalSplits: number[] = [];
  /** v1.0.177au — Part active ('all' = tout joue, 'partN' = uniquement cette part-là). Live switch via ngOnChanges. */
  @Input() globalActivePart: string = 'all';
  /** v1.0.177aw — Trigger counter pour forcer un restart même si activePart inchangé.
   *  À chaque click "▶ Preview part X" → incrémente → action.reset() + play() pour revoir depuis le début. */
  @Input() globalPlayTrigger: number = 0;
  /** v1.0.177 — OrbitControls (drag souris pour rotation cam, scroll pour zoom) — style Blender. */
  @Input() enableOrbit = false;
  /** v1.0.177 — Mode du gizmo Blender-way : translate (G) / rotate (R) / scale (S). */
  @Input() transformMode: 'translate' | 'rotate' | 'scale' = 'translate';
  /** v1.0.177 — Target du gizmo : 'yamzy' (avatar) / 'companion' (wizzard) / null (off). */
  @Input() gizmoTarget: 'yamzy' | 'companion' | null = null;
  /** v1.0.177 — Émis quand l'utilisateur transforme le companion via le gizmo. */
  @Output() companionTransformed = new EventEmitter<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number }; // degrees
    scale: number;
  }>();
  /** v1.0.177 — Si true, les mixers d'animation sont pausés (avatar en pose statique).
   *  Utile en mode édition pour bien voir les bones sans qu'ils bougent. */
  @Input() pauseAnimations = false;
  /** v1.0.177c — Si true, affiche des sphères 3D sur chaque bone (wizzard = orange, yamzy = bleu).
   *  Click sur une sphère wizzard → rouge + gizmo attaché → drag pour la positionner sur le bone YAMZY cible. */
  @Input() showBoneSpheres = false;
  /** v1.0.177c — Émis quand l'user a snap-mappé un bone wizzard → bone YAMZY (drag + drop). */
  @Output() boneAutoMapped = new EventEmitter<{ wizzardBone: string; yamzyBone: string }>();
  /** v1.0.177ad — Émis quand l'utilisateur clique sur un bone sphère (sélection visuelle).
   *  Null si désélection (click dans le vide). */
  @Output() boneSelected = new EventEmitter<{ name: string; kind: 'wizzard' | 'yamzy' } | null>();
  /** v1.0.177d — Affiche un sol 3D (plan + grille Blender) pour visualiser la position de YAMZY au sol. */
  @Input() showFloor = false;
  /** v1.0.177o — Mapping isolé : si défini, seules ces 2 sphères (wizzard + yamzy) sont visibles.
   *  Permet de visualiser un mapping à la fois dans le viewport 3D. */
  @Input() isolatedMapping: { wizzard: string; yamzy: string } | null = null;
  /** v1.0.177g — Si true, pose le BAS de la bbox du model sur le sol (Y=-0.5) au lieu de centrer.
   *  Évite que YAMZY flotte ou s'enfonce. modelYOffset reste appliqué par-dessus. */
  @Input() groundOnFloor = true;
  /** v1.0.177s — Si false, on n'écrase PAS la position native du GLB (utile pour les GLB
   *  pré-positionnés via patch binaire : la translation bakée dans RootNode est respectée). */
  @Input() autoCenter = true;
  /** v1.0.177v — Default FALSE : YAMZY et wizzard sont indépendants dans la scène (chacun
   *  bouge séparément via le gizmo). Si true (opt-in), le wizzard devient enfant de YAMZY
   *  → déplacer YAMZY déplace aussi le wizzard (parent-child propagation).
   *  Le user a constaté qu'avec true il ne pouvait pas déplacer YAMZY indépendamment. */
  @Input() parentCompanionToModel = false;
  /** v1.0.177g — Verrouillage OrbitControls : si true, le drag souris ne tourne plus la cam.
   *  Permet de cliquer sur YAMZY/wizzard sans tourner la cam accidentellement. */
  @Input() orbitLocked = false;
  /** v1.0.177d — Émis quand l'user transforme YAMZY (le model principal) via le gizmo. */
  @Output() mainTransformed = new EventEmitter<{
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  }>();

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
  private modelBaselineY = 0; // v1.0.27 — y de centrage, sert de baseline pour le bobbing
  private disposed = false;
  private bobPhase = 0;

  /** v1.0.175 — Applique dynamiquement les changements de scale/position/rotation du companion. */
  ngOnChanges(changes: SimpleChanges): void {
    if (this.companionModel) {
      if (changes['companionOffset'] || changes['companionScale'] || changes['companionRotation']) {
        this.applyCompanionTransform();
      }
    }
    // v1.0.177t — IMPORTANT : modelYOffset change live (slider/gizmo) → re-apply à la position du model.
    // Sans ça, la position du model est figée à la valeur du chargement initial.
    if (changes['modelYOffset'] && this.model && !changes['modelYOffset'].firstChange) {
      const delta = this.modelYOffset - (changes['modelYOffset'].previousValue ?? 0);
      this.model.position.y += delta;
      this.modelBaselineY += delta;
    }
    // v1.0.177z — Idem pour X et Z
    if (changes['modelXOffset'] && this.model && !changes['modelXOffset'].firstChange) {
      const delta = this.modelXOffset - (changes['modelXOffset'].previousValue ?? 0);
      this.model.position.x += delta;
    }
    if (changes['modelZOffset'] && this.model && !changes['modelZOffset'].firstChange) {
      const delta = this.modelZOffset - (changes['modelZOffset'].previousValue ?? 0);
      this.model.position.z += delta;
    }
    // v1.0.177ak — Scale live : applique immédiatement à model.scale
    if (changes['modelScale'] && this.model && !changes['modelScale'].firstChange) {
      this.model.scale.setScalar(this.modelScale || 1);
    }
    // v1.0.177bg — Speed du mixer en live
    if (changes['glbAnimationSpeed'] && this.mixer && !changes['glbAnimationSpeed'].firstChange) {
      this.mixer.timeScale = this.glbAnimationSpeed || 1;
    }
    // v1.0.177at/au/aw — Live switching des play modes (notif arrive → switch active part)
    if (this.partActions.size > 0) {
      const triggerChanged = changes['globalPlayTrigger'] && !changes['globalPlayTrigger'].firstChange;
      const stateChanged = (changes['objectPlayModes'] && !changes['objectPlayModes'].firstChange) ||
                           (changes['globalActivePart'] && !changes['globalActivePart'].firstChange);
      if (triggerChanged || stateChanged) {
        this.applyPartActionStates(triggerChanged);
      }
    }
    // v1.0.177az — REBUILD les global parts quand les cuts changent (drag des markers timeline).
    // Debounce 80ms pour éviter rebuild × 60/sec pendant le drag.
    if (changes['globalSplits'] && !changes['globalSplits'].firstChange && this.originalClipTracks.length > 0) {
      if (this.rebuildDebounceTimer) clearTimeout(this.rebuildDebounceTimer);
      this.rebuildDebounceTimer = setTimeout(() => this.rebuildGlobalSplitParts(), 80);
    }
    // v1.0.177 — Blender-way live tweaking
    if (changes['transformMode'] && this.transformControls) {
      this.transformControls.setMode(this.transformMode);
    }
    if (changes['gizmoTarget'] && this.transformControls) {
      this.updateGizmoSelection();
    }
    if (changes['enableOrbit'] && this.enableOrbit && !this.orbitControls && this.renderer) {
      this.initOrbitControls();
    }
    // v1.0.177c — Active / désactive l'affichage des sphères-bones
    if (changes['showBoneSpheres'] && this.scene) {
      this.syncBoneSpheres();
    }
    // v1.0.177d — Active / désactive le sol 3D
    if (changes['showFloor'] && this.scene) {
      this.syncFloor();
    }
    // v1.0.177g — Verrouille / dévérouille OrbitControls
    if (changes['orbitLocked'] && this.orbitControls) {
      this.orbitControls.enabled = !this.orbitLocked;
    }
    // v1.0.177o — Isolation d'un mapping spécifique : cache toutes les autres sphères
    if (changes['isolatedMapping']) {
      this.applyIsolation();
    }
  }

  /** v1.0.177o — Cache toutes les sphères-bones sauf les 2 du mapping isolé.
   *  Si isolatedMapping=null, restaure la visibilité de toutes. */
  private applyIsolation(): void {
    const iso = this.isolatedMapping;
    const allSpheres = [...this.wizzardBoneSpheres, ...this.yamzyBoneSpheres];
    if (!iso) {
      // Pas d'isolation → toutes visibles
      for (const s of allSpheres) s.visible = true;
      return;
    }
    // Isolation : seules les 2 sphères du mapping sont visibles + grossies
    for (const s of allSpheres) {
      const name = s.userData.boneName;
      const isMatch = (s.userData.kind === 'wizzard' && name === iso.wizzard)
                   || (s.userData.kind === 'yamzy' && name === iso.yamzy);
      s.visible = isMatch;
      if (isMatch) {
        s.scale.setScalar(2.5);
        if (s.userData.kind === 'wizzard') s.material.color.setHex(0xff2233); // rouge vif
        else s.material.color.setHex(0x33ff66); // vert vif (destination)
      }
    }
  }

  /** v1.0.177aa — Centre LOCAL du companion, calculé UNE FOIS à l'init et conservé. */
  private companionInitialCenter: { x: number; y: number; z: number } | null = null;

  private applyCompanionTransform(): void {
    if (!this.companionModel) return;
    // v1.0.177aa — Bug fix : avant on faisait box.setFromObject à CHAQUE appel, qui retournait
    // le bbox EN WORLD SPACE (donc avec la position déjà déplacée par le gizmo). Le calcul
    // `-center + offset` était alors faussé → le drag était annulé à chaque update. Maintenant
    // on utilise le centre LOCAL sauvegardé à l'init du model (avant tout déplacement).
    if (!this.companionInitialCenter) {
      // Premier appel : on capture le centre local (alors que la position est à 0,0,0)
      const T = this.THREE;
      const savedPos = this.companionModel.position.clone();
      this.companionModel.position.set(0, 0, 0);
      const box = new T.Box3().setFromObject(this.companionModel);
      const center = new T.Vector3();
      box.getCenter(center);
      this.companionInitialCenter = { x: center.x, y: center.y, z: center.z };
      this.companionModel.position.copy(savedPos);
    }
    const c = this.companionInitialCenter;
    this.companionModel.position.set(
      -c.x + this.companionOffset[0],
      -c.y + this.companionOffset[1],
      -c.z + this.companionOffset[2]
    );
    this.companionModel.scale.setScalar(this.companionScale);
    this.companionModel.rotation.set(
      (this.companionRotation[0] * Math.PI) / 180,
      (this.companionRotation[1] * Math.PI) / 180,
      (this.companionRotation[2] * Math.PI) / 180
    );
  }

  async ngAfterViewInit() {
    await this.ensureThreeJS();
    if (!this.THREE || this.disposed) { this.loadFailed = true; return; }
    this.initScene();
    // v1.0.177f — Raycaster prêt DÈS le début (avant chargement GLB), pour que les clicks fonctionnent même pendant le load
    this.setupClickRaycaster();
    this.loadModel();
    // v1.0.177 — Init des controls Blender-way (lazy, async)
    if (this.enableOrbit) await this.initOrbitControls();
    await this.initTransformControls();
    if (this.gizmoTarget) this.updateGizmoSelection();
    // v1.0.177d — Sol 3D Blender
    this.syncFloor();
    this.animate();
    window.addEventListener('resize', this.onResize);
    // v1.0.177al — Observer le resize du CONTAINER (le canvas suit son parent). Sans ça,
    // changer la taille du parent via CSS (ex: FAB fullscreen) ne resize PAS le canvas.
    try {
      const canvas = this.canvasEl.nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      if (canvas.parentElement) this.resizeObserver.observe(canvas.parentElement);
    } catch (e) { /* ResizeObserver indispo (old browser) */ }
  }
  private resizeObserver: ResizeObserver | null = null;

  ngOnDestroy() {
    this.disposed = true;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    try { this.resizeObserver?.disconnect(); } catch {}
    if (this.rebuildDebounceTimer) clearTimeout(this.rebuildDebounceTimer);
    if (this.renderer) {
      try { this.renderer.dispose(); } catch {}
      try { this.renderer.forceContextLoss?.(); } catch {}
    }
    if (this.model && this.scene) {
      this.scene.remove(this.model);
      this.disposeNode(this.model);
    }
    // v1.0.173 — Companion cleanup
    if (this.companionModel && this.scene) {
      this.scene.remove(this.companionModel);
      this.disposeNode(this.companionModel);
    }
  }

  private initScene() {
    const T = this.THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || 280;
    const h = canvas.clientHeight || 280;

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);  // transparent
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(35, w / h, 0.1, 100);
    this.camera.position.set(0, 1.5, 4);

    // Lighting cinématique — chaud + glow
    const hemi = new T.HemisphereLight(0xfff5e6, 0x4a3f7a, 1.1);
    this.scene.add(hemi);
    const ambient = new T.AmbientLight(0xfff0d4, 0.85);
    this.scene.add(ambient);
    const key = new T.DirectionalLight(0xffeedd, 0.9);
    key.position.set(2, 3, 3);
    this.scene.add(key);
    const accent = new T.PointLight(0x70b944, 0.7, 12); // glow vert pour cohérence Sage panel
    accent.position.set(-2, 2, 2);
    this.scene.add(accent);

    this.clock = new T.Clock();
  }

  private loadModel() {
    if (!this.GLTFLoader) { this.loadFailed = true; return; }
    const T = this.THREE;
    const loader = new this.GLTFLoader();
    loader.load(this.glbUrl, (gltf: any) => {
      if (this.disposed) return;
      this.model = gltf.scene;

      // Center + fit
      const box = new T.Box3().setFromObject(this.model);
      const center = new T.Vector3();
      const size = new T.Vector3();
      box.getCenter(center);
      box.getSize(size);
      // v1.0.177s — autoCenter=false : on respecte la position native du GLB
      // (utile pour les GLB déjà patchés avec une translation bakée dans RootNode).
      if (this.autoCenter) {
        this.model.position.sub(center);
        if (this.groundOnFloor) {
          const FLOOR_Y = -0.5;
          this.model.position.y = FLOOR_Y + size.y / 2;
        }
      }
      // v1.0.174 — Y offset utilisateur (appliqué par-dessus le ground ou la pos native)
      this.model.position.y += this.modelYOffset;
      // v1.0.177z — X et Z offsets utilisateur (pour déplacer YAMZY sur le plan horizontal)
      this.model.position.x += this.modelXOffset;
      this.model.position.z += this.modelZOffset;
      // v1.0.177ak — Scale uniforme : multiplie la taille du modèle YAMZY
      if (this.modelScale !== 1) this.model.scale.setScalar(this.modelScale);
      // v1.0.27 — Mémorise l'y de centrage : le bobbing s'ajoutera dessus
      // au lieu d'écraser l'offset (sinon le modèle dérive vers le haut)
      this.modelBaselineY = this.model.position.y;

      // v1.0.174 — Debug : log les noms de bones du modèle principal (YAMZY)
      // v1.0.177ah — Désactive frustumCulled sur tous les meshes pour éviter que Three.js
      // cull les SkinnedMesh dont la pose animée sort de leur bbox initiale (bug classique → mains/bras qui disparaissent).
      const mainBones: string[] = [];
      let meshCountFixed = 0;
      this.model.traverse((c: any) => {
        if (c.isBone) mainBones.push(c.name);
        if (c.isMesh || c.isSkinnedMesh) { c.frustumCulled = false; meshCountFixed++; }
      });
      if (mainBones.length) console.log('[yamzy-avatar-3d] MAIN bones:', mainBones);
      if (meshCountFixed) console.log(`[yamzy-avatar-3d] 🔧 frustumCulled=false sur ${meshCountFixed} meshes (fix mains/bras qui disparaissent)`);

      // v1.0.176 — Émet TOUT DE SUITE les bones de YAMZY (compagnon vide pour l'instant) ;
      // ils seront mis à jour quand le companion finira de charger.
      this.bonesReady.emit({ main: mainBones, companion: [] });

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = maxDim / (2 * Math.tan(fov / 2));
      // Caméra droit-devant (y=0) → modèle parfaitement centré
      this.camera.position.set(0, 0, dist * 1.4);
      this.camera.lookAt(0, 0, 0);

      // v1.0.17 — Mixer activé si playGlbAnim, joue toutes les clips natives du GLB.
      if (this.playGlbAnim && gltf.animations && gltf.animations.length) {
        // v1.0.177ap — Émet la liste des anims (nom + duration + tracks + a un morph target ?)
        const animList = gltf.animations.map((c: any) => {
          const hasMorph = c.tracks.some((t: any) => {
            const p = t.name.slice(t.name.lastIndexOf('.') + 1);
            return p === 'morphTargetInfluences' || p === 'weights';
          });
          const targets = Array.from(new Set(c.tracks.map((t: any) => t.name.split('.')[0]))) as string[];
          return { name: c.name, duration: c.duration, trackCount: c.tracks.length, hasMorph, targets };
        });
        this.animationsLoaded.emit(animList);
        // v1.0.177aq — Émet la liste des OBJETS animés (target nodes uniques)
        const objMap = new Map<string, { animsCount: number; maxDuration: number; hasMorph: boolean }>();
        for (const c of gltf.animations) {
          const seenInThisClip = new Set<string>();
          for (const t of c.tracks) {
            const objName = t.name.split('.')[0];
            const prop = t.name.slice(t.name.lastIndexOf('.') + 1);
            const isMorph = prop === 'morphTargetInfluences' || prop === 'weights';
            if (!objMap.has(objName)) objMap.set(objName, { animsCount: 0, maxDuration: 0, hasMorph: false });
            const o = objMap.get(objName)!;
            if (!seenInThisClip.has(objName)) { o.animsCount++; seenInThisClip.add(objName); }
            o.maxDuration = Math.max(o.maxDuration, c.duration);
            if (isMorph) o.hasMorph = true;
          }
        }
        const objList = Array.from(objMap.entries()).map(([name, info]) => ({ name, ...info }));
        // Tri : objets avec morph en haut (la bubble surtout)
        objList.sort((a, b) => (b.hasMorph ? 1 : 0) - (a.hasMorph ? 1 : 0) || a.name.localeCompare(b.name));
        this.animObjectsLoaded.emit(objList);

        this.mixer = new T.AnimationMixer(this.model);
        // v1.0.177bg — Applique le speed dès la création
        if (this.glbAnimationSpeed !== 1) this.mixer.timeScale = this.glbAnimationSpeed;
        for (const clip of gltf.animations) {
          const filteredTracks = clip.tracks.filter((t: any) => {
            const prop = t.name.slice(t.name.lastIndexOf('.') + 1);
            return prop !== 'position'; // garde quaternion + scale, drop position
          });
          const droppedCount = clip.tracks.length - filteredTracks.length;
          // v1.0.177az — Cache des tracks filtrées pour rebuild ultérieur si cuts changent
          this.originalClipTracks.push({ clip, filteredTracks });
          // v1.0.177au — SPLIT GLOBAL prioritaire (s'applique à TOUTES les tracks de TOUTES les anims)
          if (this.globalSplits && this.globalSplits.length > 0) {
            const gCuts = this.globalSplits.slice().sort((a, b) => a - b).filter(c => c > 0 && c < clip.duration);
            if (gCuts.length > 0) {
              const bounds = [0, ...gCuts, clip.duration];
              const partsCount = bounds.length - 1;
              if (!this.partActions.has('*')) this.partActions.set('*', new Map());
              const objMap = this.partActions.get('*')!;
              for (let pi = 0; pi < partsCount; pi++) {
                const partName = `part${pi + 1}`;
                const start = bounds[pi], end = bounds[pi + 1];
                const partTracks = filteredTracks.map((t: any) => this.cropTrack(t, start, end, start, T));
                const partClip = new T.AnimationClip(`${clip.name}_global_${partName}`, end - start, partTracks);
                const action = this.mixer.clipAction(partClip);
                if (!objMap.has(partName)) objMap.set(partName, []);
                objMap.get(partName)!.push(action);
              }
              console.log(`[yamzy-avatar-3d] 🌍 Global-split "${clip.name}" → ${partsCount} parts @ [${gCuts.map(c => c.toFixed(2)).join(', ')}]`);
              continue;
            }
          }
          // v1.0.177ap — SPLIT PAR CLIP (full clip split) prioritaire si défini
          const cutTime = this.animSplits[clip.name];
          if (cutTime != null && cutTime > 0 && cutTime < clip.duration) {
            const mode = this.animPlayMode[clip.name] || 'sequential';
            const [part1, part2] = this.splitAnimClip(clip, cutTime, filteredTracks, T);
            this.applyAnimSplit(part1, part2, mode, T);
            console.log(`[yamzy-avatar-3d] ✂ Split clip "${clip.name}" @ ${cutTime.toFixed(2)}s → part1=${part1.duration.toFixed(2)}s, part2=${part2.duration.toFixed(2)}s, mode=${mode}`);
            continue;
          }
          // v1.0.177aq/as/at — SPLIT PAR OBJET MULTI-CUTS : cache les actions pour live switching
          const splitObjects = Object.keys(this.objectSplits).filter(o => {
            const arr = this.objectSplits[o];
            return Array.isArray(arr) && arr.some(c => c > 0 && c < clip.duration);
          });
          if (splitObjects.length > 0) {
            const splitableTracks: any[] = [];
            const keepTracks: any[] = [];
            for (const tk of filteredTracks) {
              const objName = tk.name.split('.')[0];
              if (splitObjects.includes(objName)) splitableTracks.push(tk);
              else keepTracks.push(tk);
            }
            if (keepTracks.length) {
              const baseClip = new T.AnimationClip(clip.name + '_baseObj', clip.duration, keepTracks);
              this.mixer.clipAction(baseClip).play();
            }
            const splitGroups: Record<string, any[]> = {};
            for (const tk of splitableTracks) {
              const objName = tk.name.split('.')[0];
              (splitGroups[objName] = splitGroups[objName] || []).push(tk);
            }
            for (const [objName, tracks] of Object.entries(splitGroups)) {
              const cuts = (this.objectSplits[objName] || []).slice()
                .sort((a, b) => a - b)
                .filter(c => c > 0 && c < clip.duration);
              const bounds = [0, ...cuts, clip.duration];
              const partsCount = bounds.length - 1;
              // v1.0.177at — Build TOUTES les parts mais cache leurs actions pour live switching
              if (!this.partActions.has(objName)) this.partActions.set(objName, new Map());
              const objMap = this.partActions.get(objName)!;
              for (let pi = 0; pi < partsCount; pi++) {
                const partName = `part${pi + 1}`;
                const start = bounds[pi], end = bounds[pi + 1];
                const partTracks = tracks.map(t => this.cropTrack(t, start, end, start, T));
                const partClip = new T.AnimationClip(`${clip.name}_${objName}_${partName}`, end - start, partTracks);
                const action = this.mixer.clipAction(partClip);
                if (!objMap.has(partName)) objMap.set(partName, []);
                objMap.get(partName)!.push(action);
              }
              console.log(`[yamzy-avatar-3d] ✂ Cached "${objName}" parts (${partsCount}) for "${clip.name}" @ [${cuts.map(c => c.toFixed(2)).join(', ')}]`);
            }
            continue;
          }
          // Aucun split → joue normalement
          const restPosedClip = new T.AnimationClip(clip.name + '_restPosed', clip.duration, filteredTracks);
          this.mixer.clipAction(restPosedClip).play();
          console.log(`[yamzy-avatar-3d] 🎬 YAMZY anim "${clip.name}" : ${droppedCount} tracks .position drop → bones gardent leurs positions Blender, rotation only`);
        }
        // v1.0.177at — Une fois TOUTES les parts construites/cachées, applique le mode initial
        if (this.partActions.size > 0) {
          this.applyPartActionStates();
        }
      }

      this.scene.add(this.model);

      // v1.0.173 — Charge le COMPANION GLB s'il est fourni
      if (this.companionGlbUrl) {
        this.loadCompanion();
      }
    }, undefined, (err: any) => {
      console.warn('[yamzy-avatar-3d] Failed to load', this.glbUrl, err);
      this.loadFailed = true;
    });
  }

  private companionModel: any = null;
  private companionMixer: any = null;
  private orbitControls: any = null;

  /** v1.0.177 — Charge le script OrbitControls depuis CDN three.js examples. */
  private async loadOrbitControlsScript(): Promise<void> {
    if ((window as any).THREE?.OrbitControls) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load OrbitControls'));
      document.head.appendChild(s);
    });
  }
  // v1.0.177d — Sol 3D + grille Blender + sélection multi-cible (avatar + wizzard) ─────
  private floorGroup: any = null;
  /** Construit un sol 3D : plan opaque + GridHelper Blender + axes XYZ. */
  private buildFloor(): void {
    if (!this.THREE || !this.scene || this.floorGroup) return;
    const T = this.THREE;
    const group = new T.Group();
    // Plan diffus (sol)
    const planeGeom = new T.PlaneGeometry(20, 20);
    const planeMat = new T.MeshBasicMaterial({
      color: 0x1a1235, transparent: true, opacity: 0.5,
      depthWrite: false, side: T.DoubleSide,
    });
    const plane = new T.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.5; // sous YAMZY au repos
    group.add(plane);
    // Grille Blender (carrés 0.5m, sub-grid 0.1m)
    const grid = new T.GridHelper(20, 40, 0x9d8ad6, 0x4a3f7a);
    grid.position.y = -0.49; // juste au-dessus du plan pour pas de z-fighting
    (grid.material as any).transparent = true;
    (grid.material as any).opacity = 0.55;
    group.add(grid);
    // Axes XYZ (rouge X, vert Y, bleu Z) à l'origine
    const axes = new T.AxesHelper(1.5);
    axes.position.y = -0.49;
    group.add(axes);
    this.scene.add(group);
    this.floorGroup = group;
  }
  private removeFloor(): void {
    if (!this.floorGroup || !this.scene) return;
    this.scene.remove(this.floorGroup);
    this.floorGroup.traverse((c: any) => {
      if (c.geometry) c.geometry.dispose?.();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose?.());
        else c.material.dispose?.();
      }
    });
    this.floorGroup = null;
  }
  private syncFloor(): void {
    if (this.showFloor && !this.floorGroup) this.buildFloor();
    else if (!this.showFloor && this.floorGroup) this.removeFloor();
  }

  /** v1.0.177 — Init OrbitControls (rotation par drag souris, zoom par scroll). Style Blender. */
  private async initOrbitControls(): Promise<void> {
    if (this.orbitControls || !this.enableOrbit) return;
    await this.loadOrbitControlsScript();
    const T = this.THREE;
    if (!T.OrbitControls) return;
    this.orbitControls = new T.OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.rotateSpeed = 0.8;
    this.orbitControls.zoomSpeed = 0.9;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.update();
  }

  private transformControls: any = null;

  /** v1.0.177 — Charge le script TransformControls depuis CDN three.js examples. */
  private async loadTransformControlsScript(): Promise<void> {
    if ((window as any).THREE?.TransformControls) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load TransformControls'));
      document.head.appendChild(s);
    });
  }
  /** v1.0.177 — Init le gizmo Blender-way (G/R/S) attaché au companion sur demande. */
  private async initTransformControls(): Promise<void> {
    if (this.transformControls) return;
    await this.loadTransformControlsScript();
    const T = this.THREE;
    if (!T.TransformControls) return;
    this.transformControls = new T.TransformControls(this.camera, this.renderer.domElement);
    if (typeof this.transformControls.setSize === 'function') this.transformControls.setSize(1.6);
    // Désactive OrbitControls pendant le drag du gizmo (sinon les deux luttent)
    this.transformControls.addEventListener('dragging-changed', (e: any) => {
      if (this.orbitControls) this.orbitControls.enabled = !e.value;
      // v1.0.177c — Fin du drag d'une sphère-bone : commit le mapping auto
      if (!e.value && this.selectedSphere) {
        this.commitBoneMapping();
      }
    });
    // Émet les transforms vers le parent (war-table) → met à jour les signals
    this.transformControls.addEventListener('objectChange', () => {
      const obj = this.transformControls.object;
      if (!obj) return;
      const payload = {
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: {
          x: (obj.rotation.x * 180) / Math.PI,
          y: (obj.rotation.y * 180) / Math.PI,
          z: (obj.rotation.z * 180) / Math.PI,
        },
        scale: obj.scale.x,
      };
      // v1.0.177d — Distingue qui est attaché : YAMZY (model) ou wizzard (companion)
      if (obj === this.model) {
        this.mainTransformed.emit(payload);
      } else if (obj === this.companionModel) {
        this.companionTransformed.emit(payload);
      } else if (obj.userData?.bone) {
        // v1.0.177af — Sphère bone : propage le déplacement au BONE réel.
        // Calcule la position locale du bone à partir de la position monde de la sphère.
        this.applySpherePosToBone(obj);
      }
    });
    this.transformControls.setMode(this.transformMode);
    // v1.0.177b — Force les axes RGB à toujours rendu PAR-DESSUS le modèle (pas cachés par les mesh).
    this.transformControls.traverse((c: any) => {
      if (c.isMesh || c.isLine || c.isSprite) {
        if (c.material) {
          c.material.depthTest = false;
          c.material.depthWrite = false;
          c.material.transparent = true;
          c.renderOrder = 999;
        }
      }
    });
    this.scene.add(this.transformControls);
    // v1.0.177b — Si le companion est déjà chargé, attache TOUT DE SUITE.
    if (this.gizmoTarget === 'companion' && this.companionModel) {
      this.transformControls.attach(this.companionModel);
    }
    // v1.0.177b — Active le raycaster click → select companion
    this.setupClickRaycaster();
  }
  /** v1.0.177ap — Coupe une AnimationClip en 2 sub-clips à cutTime (sec).
   *  Pour chaque track, garde les keyframes dans la zone et **interpole le keyframe pivot** à cutTime.
   *  Retourne [part1, part2] où part2 est shiftée pour démarrer à 0. */
  private splitAnimClip(clip: any, cutTime: number, filteredTracks: any[], T: any): [any, any] {
    const buildPart = (tracks: any[], rangeStart: number, rangeEnd: number, shiftBy: number) => {
      const partTracks: any[] = [];
      for (const t of tracks) {
        const valueSize = t.getValueSize();
        const times: number[] = [];
        const values: number[] = [];
        // Inclut les keyframes dans [rangeStart, rangeEnd]
        for (let i = 0; i < t.times.length; i++) {
          if (t.times[i] >= rangeStart && t.times[i] <= rangeEnd) {
            times.push(t.times[i] - shiftBy);
            for (let j = 0; j < valueSize; j++) values.push(t.values[i * valueSize + j]);
          }
        }
        // S'il n'y a pas de keyframe au debut/fin, interpole pour ne pas perdre l'état
        if (times.length === 0 || times[0] > 0.001) {
          // Trouve le valeur interpolée à rangeStart
          const v = this.sampleTrack(t, rangeStart, valueSize);
          times.unshift(0);
          for (let j = valueSize - 1; j >= 0; j--) values.unshift(v[j]);
        }
        if (times[times.length - 1] < rangeEnd - rangeStart - 0.001) {
          const v = this.sampleTrack(t, rangeEnd, valueSize);
          times.push(rangeEnd - rangeStart);
          for (let j = 0; j < valueSize; j++) values.push(v[j]);
        }
        partTracks.push(new t.constructor(t.name, new Float32Array(times), new Float32Array(values), t.interpolation));
      }
      return new T.AnimationClip(clip.name + (shiftBy === 0 ? '_part1' : '_part2'), rangeEnd - rangeStart, partTracks);
    };
    const part1 = buildPart(filteredTracks, 0, cutTime, 0);
    const part2 = buildPart(filteredTracks, cutTime, clip.duration, cutTime);
    return [part1, part2];
  }
  /** v1.0.177aq — Coupe une SEULE track sur [rangeStart, rangeEnd], shift par shiftBy.
   *  Garde les keyframes dans la zone + interpole le pivot à rangeStart et rangeEnd. */
  private cropTrack(t: any, rangeStart: number, rangeEnd: number, shiftBy: number, T: any): any {
    const valueSize = t.getValueSize();
    const times: number[] = [];
    const values: number[] = [];
    for (let i = 0; i < t.times.length; i++) {
      if (t.times[i] >= rangeStart && t.times[i] <= rangeEnd) {
        times.push(t.times[i] - shiftBy);
        for (let j = 0; j < valueSize; j++) values.push(t.values[i * valueSize + j]);
      }
    }
    // Interpole pour combler les bords si pas de keyframe à rangeStart/rangeEnd
    if (times.length === 0 || times[0] > 0.001) {
      const v = this.sampleTrack(t, rangeStart, valueSize);
      times.unshift(0);
      for (let j = valueSize - 1; j >= 0; j--) values.unshift(v[j]);
    }
    if (times[times.length - 1] < rangeEnd - rangeStart - 0.001) {
      const v = this.sampleTrack(t, rangeEnd, valueSize);
      times.push(rangeEnd - rangeStart);
      for (let j = 0; j < valueSize; j++) values.push(v[j]);
    }
    return new t.constructor(t.name, new Float32Array(times), new Float32Array(values), t.interpolation);
  }
  /** Échantillonne une track à un temps donné (linéaire entre 2 keyframes). */
  private sampleTrack(t: any, time: number, valueSize: number): number[] {
    const times = t.times;
    if (time <= times[0]) {
      return Array.from({ length: valueSize }, (_, j) => t.values[j]);
    }
    if (time >= times[times.length - 1]) {
      const last = times.length - 1;
      return Array.from({ length: valueSize }, (_, j) => t.values[last * valueSize + j]);
    }
    let i = 0;
    while (i < times.length - 1 && times[i + 1] < time) i++;
    const t0 = times[i], t1 = times[i + 1];
    const alpha = (time - t0) / (t1 - t0);
    return Array.from({ length: valueSize }, (_, j) => {
      const v0 = t.values[i * valueSize + j];
      const v1 = t.values[(i + 1) * valueSize + j];
      return v0 + (v1 - v0) * alpha;
    });
  }
  /** v1.0.177at — Cache des AnimationActions par objet/partName. Permet live switching sans rebuild. */
  private partActions = new Map<string, Map<string, any[]>>();
  /** v1.0.177az — Cache des tracks filtrées (sans .position) par clip → permet rebuild quand cuts changent. */
  private originalClipTracks: Array<{ clip: any; filteredTracks: any[] }> = [];
  /** v1.0.177az — Debounce timer pour rebuild (drag de marker = beaucoup de events/sec). */
  private rebuildDebounceTimer: any = null;
  /** v1.0.177az/ba — Rebuild les global-split parts depuis les originalClipTracks avec les nouveaux cuts.
   *  Appelé en debounce (80ms) quand globalSplits change. Évite uncache (risque casser mixer). */
  private rebuildVersion = 0;
  private rebuildGlobalSplitParts(): void {
    if (!this.mixer || !this.THREE || !this.originalClipTracks.length) return;
    const T = this.THREE;
    this.rebuildVersion++;
    // 1) Stop les anciens parts (mais on les laisse dans le cache mixer, sinon risque de casser internal state)
    const oldMap = this.partActions.get('*');
    if (oldMap) {
      for (const [, actions] of oldMap) {
        for (const a of actions) {
          try { a.stop(); a.enabled = false; } catch {}
        }
      }
    }
    this.partActions.delete('*');
    // 2) Rebuild si globalSplits a des cuts valides
    if (!this.globalSplits || !this.globalSplits.length) return;
    let total = 0;
    for (const { clip, filteredTracks } of this.originalClipTracks) {
      const gCuts = this.globalSplits.slice().sort((a, b) => a - b).filter(c => c > 0 && c < clip.duration);
      if (!gCuts.length) continue;
      const bounds = [0, ...gCuts, clip.duration];
      const partsCount = bounds.length - 1;
      if (!this.partActions.has('*')) this.partActions.set('*', new Map());
      const objMap = this.partActions.get('*')!;
      for (let pi = 0; pi < partsCount; pi++) {
        const partName = `part${pi + 1}`;
        const start = bounds[pi], end = bounds[pi + 1];
        const partTracks = filteredTracks.map((t: any) => this.cropTrack(t, start, end, start, T));
        // Suffix avec versionCounter pour des clips uniques à chaque rebuild
        const partClip = new T.AnimationClip(`${clip.name}_global_${partName}_v${this.rebuildVersion}`, end - start, partTracks);
        const action = this.mixer.clipAction(partClip);
        if (!objMap.has(partName)) objMap.set(partName, []);
        objMap.get(partName)!.push(action);
        total++;
      }
    }
    console.log(`[yamzy-avatar-3d] 🔁 Rebuild v${this.rebuildVersion} → ${total} new actions, cuts=[${this.globalSplits.map(c => c.toFixed(2)).join(',')}]`);
    // 3) Apply current state avec restart depuis 0
    this.applyPartActionStates(true);
  }

  /** v1.0.177at/au/aw — Applique les states play/stop selon objectPlayModes + globalActivePart.
   *  forceRestart=true → reset systématique (utile au click "▶ Preview" pour rejouer depuis le début). */
  applyPartActionStates(forceRestart = false): void {
    for (const [objName, partMap] of this.partActions) {
      const mode = objName === '*' ? (this.globalActivePart || 'all') : (this.objectPlayModes[objName] || 'all');
      for (const [partName, actions] of partMap) {
        const shouldPlay = mode === 'all' || mode === partName;
        for (const a of actions) {
          if (shouldPlay) {
            if (forceRestart || !a.isRunning()) { a.reset(); a.play(); }
          } else {
            a.stop();
          }
        }
      }
      console.log(`[yamzy-avatar-3d] 🎯 ${objName === '*' ? 'GLOBAL' : objName} mode=${mode}${forceRestart ? ' (restart)' : ''}`);
    }
  }
  /** v1.0.177ap — Joue les 2 parts selon le mode choisi. */
  private applyAnimSplit(part1: any, part2: any, mode: 'original' | 'part1' | 'part2' | 'sequential', T: any): void {
    if (mode === 'part1') {
      this.mixer.clipAction(part1).play();
    } else if (mode === 'part2') {
      this.mixer.clipAction(part2).play();
    } else if (mode === 'sequential' || mode === 'original') {
      // Play les 2 parts en boucle simultanée. Pour un VRAI sequential, on chainerait via mixer events.
      // Ici simple : joue les 2 → l'effet visuel ressemble à l'original avec un point de coupure visible.
      this.mixer.clipAction(part1).play();
      this.mixer.clipAction(part2).play();
    }
  }

  /** v1.0.177 — Attache / détache le gizmo selon gizmoTarget. */
  private updateGizmoSelection(): void {
    if (!this.transformControls) return;
    if (this.gizmoTarget === 'yamzy' && this.model) {
      this.transformControls.attach(this.model);
      console.log('[yamzy-avatar-3d] 🎯 Gizmo → YAMZY (avatar)');
    } else if (this.gizmoTarget === 'companion' && this.companionModel) {
      this.transformControls.attach(this.companionModel);
      console.log('[yamzy-avatar-3d] 🎯 Gizmo → WIZZARD (companion)');
    } else {
      this.transformControls.detach();
    }
  }
  // ─── v1.0.177b — Click raycaster : click sur le wizzard → sélectionne (gizmo attaché) ─
  private raycaster: any = null;
  private raycasterMouse: any = null;
  private clickDownPos: { x: number; y: number } | null = null;
  private readonly CLICK_THRESHOLD_PX = 10; // v1.0.177f — tolère trackpad/souris sensible
  private setupClickRaycaster(): void {
    if (this.raycaster || !this.THREE || !this.renderer) return;
    const T = this.THREE;
    this.raycaster = new T.Raycaster();
    this.raycasterMouse = new T.Vector2();
    const canvas = this.renderer.domElement;
    // v1.0.177f — pointerdown/up (cohérent avec OrbitControls + TransformControls de three.js).
    // S'assure que le canvas reçoit les pointer events même si une règle CSS hérite pointer-events: none.
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    const onDown = (e: PointerEvent) => {
      this.clickDownPos = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!this.clickDownPos) return;
      const dx = e.clientX - this.clickDownPos.x;
      const dy = e.clientY - this.clickDownPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.clickDownPos = null;
      if (dist > this.CLICK_THRESHOLD_PX) return; // c'était un drag (rotation cam)
      if (this.transformControls?.dragging) return; // drag du gizmo en cours
      this.handleCanvasClick(e);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    console.log('[yamzy-avatar-3d] 🖱 Raycaster click prêt — clicke sur YAMZY ou WIZZARD');
  }
  private handleCanvasClick(e: PointerEvent | MouseEvent): void {
    if (!this.raycaster || !this.camera || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycasterMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.raycasterMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.raycasterMouse, this.camera);

    // v1.0.177ad — En mode bone spheres : on teste BOTH wizzard et yamzy sphères.
    // La plus proche de la cam gagne, et on la "sélectionne" (highlight) sans rien d'autre.
    if (this.showBoneSpheres && (this.wizzardBoneSpheres.length > 0 || this.yamzyBoneSpheres.length > 0)) {
      const allSpheres = [...this.wizzardBoneSpheres, ...this.yamzyBoneSpheres];
      const sphereHits = this.raycaster.intersectObjects(allSpheres, false);
      if (sphereHits.length > 0) {
        const sphere = sphereHits[0].object;
        this.selectAnyBoneSphere(sphere);
        return;
      }
      // Click dans le vide en mode bones → deselect
      this.deselectBoneSphere();
      return;
    }

    // Mode normal (sans sphères) : raycast sur les models pour attacher le gizmo.
    const candidates: any[] = [];
    if (this.model) candidates.push(this.model);
    if (this.companionModel) candidates.push(this.companionModel);
    if (candidates.length === 0 || !this.transformControls) return;
    const hits = this.raycaster.intersectObjects(candidates, true);
    if (hits.length === 0) return;
    let target = hits[0].object;
    while (target && target !== this.model && target !== this.companionModel) {
      target = target.parent;
    }
    if (!target) return;
    this.transformControls.attach(target);
  }

  /** v1.0.177ad — Sélectionne UNE sphère-bone (wizzard ou yamzy) et highlight clairement. */
  private selectAnyBoneSphere(sphere: any): void {
    // Reset précédente sélection
    if (this.selectedSphere) {
      this.selectedSphere.material.color.setHex(this.selectedSphere.userData.baseColor);
      this.selectedSphere.scale.setScalar(1);
    }
    this.selectedSphere = sphere;
    // Couleur de sélection selon le type
    if (sphere.userData.kind === 'wizzard') {
      sphere.material.color.setHex(0xff2233); // rouge vif
    } else {
      sphere.material.color.setHex(0x33ff66); // vert vif
    }
    sphere.scale.setScalar(2.0);
    // Attache le gizmo à cette sphère pour permettre déplacement
    if (this.transformControls) this.transformControls.attach(sphere);
    console.log(`[yamzy-avatar-3d] 🎯 Bone sélectionné : "${sphere.userData.boneName}" (${sphere.userData.kind})`);
    // Émet l'event pour que le parent puisse afficher le nom du bone
    this.boneSelected.emit({ name: sphere.userData.boneName, kind: sphere.userData.kind });
  }
  /** v1.0.177af — Stocke la rest pose de chaque bone à l'init (clé = bone name)
   *  → utilisé comme "keyframe initiale" qu'on modifie via le drag de sphères. */
  private boneRestPose = new Map<string, { translation: number[]; rotation: number[]; scale: number[] }>();

  /** v1.0.177af — Capture la rest pose actuelle de tous les bones (AVANT que l'animation ne joue).
   *  C'est la "keyframe 0" qu'on modifie ensuite via le drag des sphères. */
  private captureRestPose(): void {
    const allBones: any[] = [];
    if (this.model) this.model.traverse((c: any) => { if (c.isBone) allBones.push(c); });
    if (this.companionModel) this.companionModel.traverse((c: any) => { if (c.isBone) allBones.push(c); });
    for (const bone of allBones) {
      if (this.boneRestPose.has(bone.name)) continue;
      this.boneRestPose.set(bone.name, {
        translation: [bone.position.x, bone.position.y, bone.position.z],
        rotation: [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w],
        scale: [bone.scale.x, bone.scale.y, bone.scale.z],
      });
    }
    console.log(`[yamzy-avatar-3d] 📸 Rest pose capturée pour ${this.boneRestPose.size} bones`);
  }

  /** v1.0.177af — Restaure la rest pose initiale (annule toutes les modifs). */
  restoreInitialRestPose(): void {
    const allBones: any[] = [];
    if (this.model) this.model.traverse((c: any) => { if (c.isBone) allBones.push(c); });
    if (this.companionModel) this.companionModel.traverse((c: any) => { if (c.isBone) allBones.push(c); });
    let restored = 0;
    for (const bone of allBones) {
      const rest = this.boneRestPose.get(bone.name);
      if (!rest) continue;
      bone.position.set(rest.translation[0], rest.translation[1], rest.translation[2]);
      bone.quaternion.set(rest.rotation[0], rest.rotation[1], rest.rotation[2], rest.rotation[3]);
      bone.scale.set(rest.scale[0], rest.scale[1], rest.scale[2]);
      restored++;
    }
    console.log(`[yamzy-avatar-3d] ↺ Rest pose restaurée pour ${restored} bones`);
  }

  /** v1.0.177af — Calcule la position locale du bone à partir de la position world de la sphère
   *  et applique au bone (la mesh attachée suivra automatiquement via la hierarchy three.js).
   *  La rest pose stockée est mise à jour → cette position devient la nouvelle "keyframe initiale". */
  private applySpherePosToBone(sphere: any): void {
    const bone = sphere.userData.bone;
    if (!bone) return;
    const T = this.THREE;
    const sphereWorld = new T.Vector3();
    sphere.getWorldPosition(sphereWorld);
    if (bone.parent) {
      const parentWorldInv = new T.Matrix4().copy(bone.parent.matrixWorld).invert();
      sphereWorld.applyMatrix4(parentWorldInv);
    }
    bone.position.copy(sphereWorld);
    // Update la rest pose stockée → nouvelle keyframe initiale
    const rest = this.boneRestPose.get(bone.name);
    if (rest) rest.translation = [bone.position.x, bone.position.y, bone.position.z];
  }

  /** v1.0.177ad — Désélection si click dans le vide en mode bones. */
  private deselectBoneSphere(): void {
    if (this.selectedSphere) {
      this.selectedSphere.material.color.setHex(this.selectedSphere.userData.baseColor);
      this.selectedSphere.scale.setScalar(1);
      this.selectedSphere = null;
    }
    if (this.transformControls) this.transformControls.detach();
    this.boneSelected.emit(null);
  }

  // ─── v1.0.177c — Bone spheres : marqueurs 3D cliquables pour chaque bone ──────
  /** Sphères orange (wizzard) — cliquables, déplacables avec le gizmo. */
  private wizzardBoneSpheres: any[] = [];
  /** Sphères bleu (YAMZY) — cibles passives, highlight quand proche du bone sélectionné. */
  private yamzyBoneSpheres: any[] = [];
  /** Sphère actuellement sélectionnée (rouge + gizmo attaché). */
  private selectedSphere: any = null;
  /** Bone YAMZY actuellement le plus proche du bone sélectionné (highlight vert clair). */
  private hoveredYamzySphere: any = null;

  /** v1.0.177c — Construit les marqueurs sphère pour tous les bones d'un model. */
  private buildBoneSpheres(model: any, color: number, kind: 'wizzard' | 'yamzy'): any[] {
    if (!this.THREE || !model) return [];
    const T = this.THREE;
    const out: any[] = [];
    model.traverse((c: any) => {
      if (!c.isBone) return;
      // Sphère par bone — petite (rayon 0.05), opaque pour bien la voir, depthTest off pour pas être cachée
      const geom = new T.SphereGeometry(0.06, 16, 12);
      const mat = new T.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85,
        depthTest: false, depthWrite: false,
      });
      const sphere = new T.Mesh(geom, mat);
      sphere.renderOrder = 998; // au-dessus du modèle, juste sous le gizmo (999)
      sphere.userData.boneName = c.name;
      sphere.userData.bone = c;
      sphere.userData.kind = kind;
      sphere.userData.baseColor = color;
      // Track la position du bone en monde (relink chaque frame)
      c.getWorldPosition(sphere.position);
      this.scene.add(sphere);
      out.push(sphere);
    });
    return out;
  }

  /** v1.0.177c — Active/désactive l'affichage des sphères-bones. */
  private syncBoneSpheres(): void {
    if (!this.THREE) return;
    // Cleanup ancien
    for (const s of this.wizzardBoneSpheres) { this.scene.remove(s); s.geometry?.dispose(); s.material?.dispose(); }
    for (const s of this.yamzyBoneSpheres) { this.scene.remove(s); s.geometry?.dispose(); s.material?.dispose(); }
    this.wizzardBoneSpheres = [];
    this.yamzyBoneSpheres = [];
    this.selectedSphere = null;
    this.hoveredYamzySphere = null;
    if (!this.showBoneSpheres) {
      // Quand on désactive, on réattache le gizmo au companion (mode par défaut)
      if (this.transformControls && this.companionModel && this.gizmoTarget === 'companion') {
        this.transformControls.attach(this.companionModel);
      }
      return;
    }
    // Build pour wizzard (orange #ff9933) + yamzy (bleu #3399ff)
    this.wizzardBoneSpheres = this.buildBoneSpheres(this.companionModel, 0xff9933, 'wizzard');
    this.yamzyBoneSpheres = this.buildBoneSpheres(this.model, 0x3399ff, 'yamzy');
    console.log(`[yamzy-avatar-3d] 🦴 Sphères-bones : ${this.wizzardBoneSpheres.length} wizzard + ${this.yamzyBoneSpheres.length} YAMZY`);
    // Detach gizmo (en attente de sélection de sphère)
    if (this.transformControls) this.transformControls.detach();
  }

  /** v1.0.177c — Sélection d'une sphère wizzard : rouge + gizmo attaché. */
  private selectBoneSphere(sphere: any): void {
    if (!sphere || sphere.userData.kind !== 'wizzard') return;
    // Reset la précédente
    if (this.selectedSphere) {
      this.selectedSphere.material.color.setHex(this.selectedSphere.userData.baseColor);
      this.selectedSphere.scale.setScalar(1);
    }
    this.selectedSphere = sphere;
    sphere.material.color.setHex(0xff2233); // rouge vif
    sphere.scale.setScalar(1.6);
    // Attache gizmo
    if (this.transformControls) {
      this.transformControls.attach(sphere);
      console.log(`[yamzy-avatar-3d] 🎯 Bone wizzard sélectionné : "${sphere.userData.boneName}" → bouge-la sur le bone YAMZY cible !`);
    }
  }

  /** v1.0.177c — Trouve le bone YAMZY le plus proche de la sphère sélectionnée. */
  private findClosestYamzyBone(sphere: any): any {
    if (!sphere || this.yamzyBoneSpheres.length === 0) return null;
    let best: any = null;
    let bestDist = Infinity;
    for (const ySphere of this.yamzyBoneSpheres) {
      const d = sphere.position.distanceTo(ySphere.position);
      if (d < bestDist) { bestDist = d; best = ySphere; }
    }
    return bestDist < 0.5 ? best : null; // seuil 0.5 unités pour éviter snap aléatoire
  }

  /** v1.0.177c — Highlight visuel du bone YAMZY le plus proche. */
  private updateClosestYamzyHighlight(): void {
    if (!this.selectedSphere) return;
    const closest = this.findClosestYamzyBone(this.selectedSphere);
    if (this.hoveredYamzySphere && this.hoveredYamzySphere !== closest) {
      this.hoveredYamzySphere.material.color.setHex(this.hoveredYamzySphere.userData.baseColor);
      this.hoveredYamzySphere.scale.setScalar(1);
    }
    if (closest && closest !== this.hoveredYamzySphere) {
      closest.material.color.setHex(0x70b944); // vert sage (couleur YAMZY)
      closest.scale.setScalar(1.6);
    }
    this.hoveredYamzySphere = closest;
  }

  /** v1.0.177c — Auto-mapping fin de drag : si on est sur un bone YAMZY, émet l'event. */
  private commitBoneMapping(): void {
    if (!this.selectedSphere || !this.hoveredYamzySphere) return;
    const wname = this.selectedSphere.userData.boneName;
    const yname = this.hoveredYamzySphere.userData.boneName;
    this.boneAutoMapped.emit({ wizzardBone: wname, yamzyBone: yname });
    console.log(`[yamzy-avatar-3d] ✅ Mapping auto : "${wname}" → "${yname}"`);
  }
  /** v1.0.173 — Charge un second GLB (compagnon), l'ajoute à la scène et applique son animation au modèle principal. */
  private loadCompanion(): void {
    if (!this.GLTFLoader || !this.companionGlbUrl) return;
    const T = this.THREE;
    const loader = new this.GLTFLoader();
    loader.load(this.companionGlbUrl, (gltf2: any) => {
      if (this.disposed) return;
      this.companionModel = gltf2.scene;

      // Position du companion au même endroit que le modèle principal + offset
      const box = new T.Box3().setFromObject(this.companionModel);
      const center = new T.Vector3();
      box.getCenter(center);
      this.companionModel.position.sub(center);
      this.companionModel.position.x += this.companionOffset[0];
      this.companionModel.position.y += this.companionOffset[1];
      this.companionModel.position.z += this.companionOffset[2];

      // v1.0.174 — Scale auto OPTIONNEL (défaut OFF pour garder la taille native du wizzard avec son staff)
      if (this.companionAutoScale && this.model) {
        const mainBox = new T.Box3().setFromObject(this.model);
        const mainSize = mainBox.getSize(new T.Vector3());
        const compSize = box.getSize(new T.Vector3());
        const scale = Math.max(mainSize.x, mainSize.y) / Math.max(compSize.x, compSize.y, 0.001);
        this.companionModel.scale.setScalar(scale);
      }

      // v1.0.177u — FUSION : le wizzard devient ENFANT de YAMZY (model) au lieu d'être
      // ajouté à la scène. Quand YAMZY bouge, le wizzard suit automatiquement.
      // Plus de "drift" indépendant entre les 2 modèles.
      const parent = (this.parentCompanionToModel && this.model) ? this.model : this.scene;
      parent.add(this.companionModel);
      console.log(`[yamzy-avatar-3d] 🔗 wizzard attaché à ${parent === this.model ? 'YAMZY (fusion enfant)' : 'la scène (indépendant)'}`);

      // v1.0.174 — Debug : log les noms de bones du companion (wizzard) pour comparer avec YAMZY
      // v1.0.177ah — Désactive frustumCulled : sinon mains/bras qui sortent du bbox initial sont cull à l'anim.
      const compBones: string[] = [];
      let compMeshFixed = 0;
      this.companionModel.traverse((c: any) => {
        if (c.isBone) compBones.push(c.name);
        if (c.isMesh || c.isSkinnedMesh) { c.frustumCulled = false; compMeshFixed++; }
      });
      if (compBones.length) console.log('[yamzy-avatar-3d] COMPANION bones:', compBones);
      if (compMeshFixed) console.log(`[yamzy-avatar-3d] 🔧 wizzard : frustumCulled=false sur ${compMeshFixed} meshes`);

      // v1.0.175 — Émet les bones pour l'UI de mapping
      const mainBonesAll: string[] = [];
      this.model?.traverse((c: any) => { if (c.isBone) mainBonesAll.push(c.name); });
      this.bonesReady.emit({ main: mainBonesAll, companion: compBones });

      // v1.0.177af — Capture la rest pose AVANT que l'animation ne joue. Cette "keyframe 0"
      // sera modifiée via le drag des sphères-bones pour repositionner le rig initial.
      this.captureRestPose();

      // v1.0.175 — Applique scale/rotation/position (override le centrage)
      this.applyCompanionTransform();

      // v1.0.177b — Companion prêt → attache le gizmo si target = companion (sinon les RGB n'apparaissent jamais).
      if (this.transformControls && this.gizmoTarget === 'companion' && !this.showBoneSpheres) {
        this.transformControls.attach(this.companionModel);
        console.log('[yamzy-avatar-3d] 🎯 Companion chargé → gizmo attaché (axes RGB visibles).');
      }
      // v1.0.177c — Build les sphères-bones maintenant que les 2 models sont là
      if (this.showBoneSpheres && this.model) {
        this.syncBoneSpheres();
      }

      if (gltf2.animations && gltf2.animations.length) {
        // Log les bones référencés dans l'animation
        const clip = gltf2.animations[0];
        const trackNames = clip.tracks.map((t: any) => t.name);
        console.log('[yamzy-avatar-3d] COMPANION anim tracks:', trackNames);

        // v1.0.174 — Joue l'anim sur le COMPANION lui-même (toujours)
        // v1.0.177y — 2 filtres :
        //   1. TOUTES les tracks .position du wizzard → wizzard reste à sa pose de bind
        //   2. TOUTES les tracks (pos + rot) sur les bones de la TIGE → la tige est complètement
        //      stationnaire (le user voyait encore la tige tourner légèrement à cause des rotations
        //      sur stick_wizardArm et Bone.020 qui pivotent la tige).
        const STAFF_BONES = ['stick_wizardArm', 'stiskTop_wizardArm', 'Bone.016_wizardArm', 'Bone.020_wizardArm', 'Bone.014_wizardArm'];
        this.companionMixer = new T.AnimationMixer(this.companionModel);
        for (const c of gltf2.animations) {
          const filteredTracks = c.tracks.filter((t: any) => {
            const dot = t.name.lastIndexOf('.');
            const bone = t.name.slice(0, dot);
            const prop = t.name.slice(dot + 1);
            if (STAFF_BONES.includes(bone)) return false; // drop TOUT sur la tige
            if (prop === 'position') return false;        // drop .position partout
            return true;
          });
          const droppedCount = c.tracks.length - filteredTracks.length;
          const stationaryClip = new T.AnimationClip(c.name + '_stationary', c.duration, filteredTracks);
          this.companionMixer.clipAction(stationaryClip).play();
          console.log(`[yamzy-avatar-3d] 🧹 Companion "${c.name}" : ${droppedCount} tracks drop (pos + staff) → tige fixe`);
        }

        // v1.0.175 — Si useCompanionAnimation : applique boneMapping pour retargeter sur YAMZY.
        if (this.useCompanionAnimation && this.model) {
          const mainBones: string[] = [];
          this.model.traverse((c: any) => { if (c.isBone) mainBones.push(c.name); });

          // v1.0.177y — RETARGETING : sur TOUS les clips du GLB (avant : uniquement clip[0], d'où
          // "2 rotations seulement" sur YAMZY). Garde uniquement .quaternion (rotation) — les
          // .position et .scale du wizzard déforment YAMZY car bind distances différentes.
          if (!this.mixer) this.mixer = new T.AnimationMixer(this.model);
          let totalRotations = 0, totalPos = 0, totalScale = 0;
          for (const sourceClip of gltf2.animations) {
            const remappedTracks: any[] = [];
            for (const track of sourceClip.tracks) {
              const dotIdx = track.name.lastIndexOf('.');
              const boneName = track.name.slice(0, dotIdx);
              const prop = track.name.slice(dotIdx + 1);
              if (prop === 'position') { totalPos++; continue; }
              if (prop === 'scale')    { totalScale++; continue; }
              const targetBone = this.boneMapping[boneName];
              if (targetBone && mainBones.includes(targetBone)) {
                const newTrack = track.clone();
                newTrack.name = `${targetBone}.${prop}`;
                remappedTracks.push(newTrack);
              } else if (mainBones.includes(boneName)) {
                remappedTracks.push(track.clone());
              }
            }
            if (remappedTracks.length > 0) {
              const newClip = new T.AnimationClip(sourceClip.name + '_retargeted', sourceClip.duration, remappedTracks);
              this.mixer.clipAction(newClip).play();
              totalRotations += remappedTracks.length;
            }
          }
          console.log(`[yamzy-avatar-3d] ✅ Retargeting all clips : ${totalRotations} rotations sur YAMZY (drop ${totalPos} pos + ${totalScale} scale)`);
        }
      }
    }, undefined, (err: any) => {
      console.warn('[yamzy-avatar-3d] Failed to load companion', this.companionGlbUrl, err);
    });
  }

  private animate = () => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    const dt = this.clock ? this.clock.getDelta() : 0.016;
    // v1.0.17 — Rotation Y idle
    if (this.model && this.rotate) {
      this.model.rotation.y += 0.005;
    }
    // v1.0.27 — Bobbing : translation Y sinusoïdale RELATIVE à la baseline
    // (avant : écrasait l'offset de centrage → modèle qui dérivait vers le haut)
    if (this.model && this.bob) {
      this.bobPhase += dt * 2.6;
      this.model.position.y = this.modelBaselineY + Math.sin(this.bobPhase) * 0.08;
    }
    // v1.0.17 — GLB animations natives via mixer (skip si pauseAnimations)
    if (this.mixer && !this.pauseAnimations) {
      this.mixer.update(dt);
    }
    // v1.0.173 — Companion mixer (skip si pauseAnimations)
    if (this.companionMixer && !this.pauseAnimations) {
      this.companionMixer.update(dt);
    }
    // v1.0.177 — OrbitControls damping update
    if (this.orbitControls) {
      this.orbitControls.update();
    }
    // v1.0.177ae — Sync les sphères-bones non-sélectionnées sur la position monde de leur bone.
    // La sphère sélectionnée (wizzard OU yamzy) est skippée pour permettre son déplacement
    // via le gizmo (sinon elle snap back chaque frame → on ne pouvait pas la bouger).
    if (this.wizzardBoneSpheres.length || this.yamzyBoneSpheres.length) {
      for (const s of [...this.wizzardBoneSpheres, ...this.yamzyBoneSpheres]) {
        if (s === this.selectedSphere) continue; // ← skip la sphère sélectionnée
        s.userData.bone.getWorldPosition(s.position);
      }
      this.updateClosestYamzyHighlight();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || 280;
    const h = canvas.clientHeight || 280;
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
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => r();
      s.onerror = () => r();
      document.head.appendChild(s);
    });
  }
}
