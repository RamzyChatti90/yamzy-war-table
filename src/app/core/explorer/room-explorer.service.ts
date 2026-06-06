// ════════════════════════════════════════════════════════════════════════
// 🚶 ROOM EXPLORER SERVICE — Third-person walk (style dashboard-beta)
//
// Service GÉNÉRIQUE réutilisable dans toutes les rooms du projet.
//
// Contrôles (style 3D adventure game) :
//   • W / ↑              avance YAMZY (dans la direction où il regarde)
//   • S / ↓              recule
//   • A / ←              tourne YAMZY à gauche
//   • D / →              tourne YAMZY à droite
//   • Q / E              strafe gauche / droite (optionnel)
//   • Shift              court (vitesse ×2)
//   • Molette            zoom in/out (distance caméra)
//
// Caméra :
//   • TOUJOURS derrière YAMZY (lerp lissé, vue gaming type Zelda/AC)
//   • YAMZY au centre de l'écran
//   • S'adapte à la rotation de YAMZY automatiquement
//
// Physique :
//   • Stair climbing : raycast vertical → s'adapte au sol (escaliers/rampes)
//   • Collision murs : raycast horizontal avant chaque pas
//   • Bounds : zone rectangulaire optionnelle
//   • Anim Walk / Idle si présentes
// ════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';

export interface ExplorerOptions {
  THREE: any;
  scene: any;
  camera: any;
  /** L'objet 3D à déplacer (typiquement YAMZY chargé en THREE.Group) */
  avatar: any;
  /** Meshes contre lesquels la collision est testée (murs, meubles, sol, escaliers) */
  collisionMeshes?: any[];
  /** Vitesse de marche en unités/sec (default 0.45 — réaliste) */
  walkSpeed?: number;
  /** Multiplicateur de course quand Shift (default 2.0) */
  runMultiplier?: number;
  /** Vitesse de rotation de l'avatar (rad/sec, default 2.4) */
  turnSpeed?: number;
  /** Distance caméra ↔ avatar (default 1.4) */
  cameraDistance?: number;
  /** Hauteur caméra au-dessus du sol (default 0.7) */
  cameraHeight?: number;
  /** Lissage caméra position (default 0.12) */
  cameraLerp?: number;
  /** Lissage caméra rotation/yaw (default 0.18 — un peu plus rapide que pos) */
  cameraYawLerp?: number;
  /** Rayon de collision horizontal (default 0.18) */
  collisionRadius?: number;
  /** Hauteur max de marche d'escalier en un pas (default 0.4) */
  stepHeight?: number;
  /** Hauteur du raycast vertical au-dessus de l'avatar pour détecter le sol (default 2.0) */
  groundRayHeight?: number;
  /** Hauteur du chest pour le raycast horizontal anti-mur (default 0.3) */
  chestHeight?: number;
  /** Direction "avant" de l'avatar dans son repère local (+1 ou -1 sur Z). Default 1 */
  facingDir?: 1 | -1;
  /** Bounds rectangulaires optionnels pour limiter exploration */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
  /** AnimationMixer + actions (si l'avatar GLB embarque des clips) */
  mixer?: any;
  walkAction?: any;
  idleAction?: any;
  /** Cycle d'anims au repos — toutes jouées en boucle round-robin (Wave, Yes, Punch, Duck, ...) */
  restActions?: any[];
  /** Durée min d'attente entre deux anims du cycle (default 0.5s) */
  restGapSeconds?: number;

  // ━━━ Mode cinematic ━━━
  /** Cible initiale de l'orbite cinématique (ex: position du crystal). Si non fournie → mode 'follow' direct */
  cinematicTarget?: { x: number; y: number; z: number };
  /** Vitesse de rotation autour de la cible en mode cinematic (rad/s, default 0.18 = très lent) */
  cinematicOrbitSpeed?: number;
  /** Distance caméra ↔ cible en mode cinematic (default 2.5) */
  cinematicDistance?: number;
  /** Hauteur caméra au-dessus de la cible en mode cinematic (default 0.8) */
  cinematicHeight?: number;
  /** Secondes d'inactivité après lesquelles la caméra repasse en mode cinematic (default 6) */
  idleTimeoutSeconds?: number;
  /** Zoom min/max via molette */
  minDistance?: number;
  maxDistance?: number;
  zoomSpeed?: number;
}

const DEFAULTS = {
  walkSpeed: 0.45,
  runMultiplier: 2.0,
  turnSpeed: 2.4,
  cameraDistance: 1.4,
  cameraHeight: 0.7,
  cameraLerp: 0.12,
  cameraYawLerp: 0.18,
  collisionRadius: 0.18,
  stepHeight: 0.4,
  groundRayHeight: 2.0,
  chestHeight: 0.3,
  facingDir: 1 as 1 | -1,
  minDistance: 0.7,
  maxDistance: 4.0,
  zoomSpeed: 0.25,
  restGapSeconds: 0.5,
  // Cinematic mode defaults
  cinematicOrbitSpeed: 0.18,
  cinematicDistance: 2.5,
  cinematicHeight: 0.8,
  idleTimeoutSeconds: 6,
};

@Injectable({ providedIn: 'root' })
export class RoomExplorerService {
  private opts: (ExplorerOptions & typeof DEFAULTS) | null = null;
  private keys = {
    forward: false, backward: false,
    turnLeft: false, turnRight: false,
    strafeLeft: false, strafeRight: false,
    run: false,
  };
  private currentCameraDistance = 1.4;
  private targetCameraDistance = 1.4;
  private isWalking = false;
  /** Yaw caméra (orbite horizontale autour de l'avatar) — pilotée par la souris ET par A/D */
  private cameraYaw = 0;
  /** Pitch caméra (angle vertical) — pilotée par drag souris vertical */
  private cameraPitch = 0.25;   // ~14° en plongée par défaut
  /** Drag souris en cours ? */
  private isPointerDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  /** Index courant dans le cycle des rest anims */
  private restIdx = 0;
  /** Temps restant pour l'anim de repos courante */
  private restTimer = 0;
  /** Action de repos actuellement en cours */
  private currentRestAction: any = null;
  // ━━━ Mode cinematic ━━━
  /** Mode actuel de la caméra : 'cinematic' = orbite, 'follow' = 3ème personne */
  private cameraMode: 'cinematic' | 'follow' = 'cinematic';
  /** Angle de rotation autour de la cible en mode cinematic */
  private cinematicAngle = 0;
  /** Compteur d'inactivité (sec sans mvt) */
  private idleTimer = 0;
  /** A-t-on déjà bougé YAMZY au moins une fois ? (après ça l'orbit cible = avatar, plus le crystal) */
  private hasInteracted = false;
  /** Hauteur de l'avatar calculée depuis sa bbox (pour centrer la caméra dessus) */
  private avatarHeight = 0.5;
  /** Centre Y de l'avatar relatif à sa position (pour le lookAt) */
  private avatarCenterY = 0.25;
  /** Cache des meshes visibles de l'avatar pour recompute du centre chaque frame */
  private avatarMeshes: any[] = [];
  /** Vector3 réutilisable pour le centre live de l'avatar */
  private _avatarCenter: any = null;
  /** Box3 réutilisable pour le bbox live */
  private _avatarBbox: any = null;
  /** Bone de référence pour centrer la cam (Hips/Spine/Body_1/etc.) — résolu à l'init */
  private centerBone: any = null;

  // ━━━ Mode debug caméra (l'utilisateur ajuste les valeurs en live) ━━━
  /** Si vrai, affiche un panneau debug et permet de bouger la cam au clavier */
  private debugMode = false;
  private debugOverlay: HTMLDivElement | null = null;
  /** Offset Y supplémentaire pour le lookAt (ajustable en debug, persisté) */
  public debugLookAtY = 0;
  /** Multiplicateur sur cameraHeight (ajustable, default 1) */
  public debugHeightMul = 1;
  /** Multiplicateur sur cameraDistance (ajustable, default 1) */
  public debugDistMul = 1;
  /** Offset X latéral de la caméra (ajustable) */
  public debugLateralX = 0;

  // bound handlers
  private onKeyDownBound = (e: KeyboardEvent) => this.onKeyDown(e);
  private onKeyUpBound = (e: KeyboardEvent) => this.onKeyUp(e);
  private onWheelBound = (e: WheelEvent) => this.onWheel(e);
  private onPointerDownBound = (e: PointerEvent) => this.onPointerDown(e);
  private onPointerMoveBound = (e: PointerEvent) => this.onPointerMove(e);
  private onPointerUpBound = (e: PointerEvent) => this.onPointerUp(e);
  private onContextMenuBound = (e: MouseEvent) => e.preventDefault();

  init(opts: ExplorerOptions): void {
    this.opts = { ...DEFAULTS, ...opts } as any;
    this.currentCameraDistance = this.opts!.cameraDistance;
    this.targetCameraDistance = this.opts!.cameraDistance;
    this.cameraYaw = opts.avatar.rotation.y;
    // Mode initial : cinematic si une cible est fournie (focus sur crystal), sinon follow
    this.cameraMode = this.opts!.cinematicTarget ? 'cinematic' : 'follow';
    this.hasInteracted = false;
    this.idleTimer = 0;
    this.cinematicAngle = 0;

    // 🦴 Trouve un BONE de référence pour centrer la cam (rendu skinned correct)
    // Les bbox des meshes ne reflètent PAS la position visible du SkinnedMesh
    // (qui dépend des bones via le shader). On centre donc la cam sur un bone.
    try {
      const T = opts.THREE;
      this.avatarMeshes = [];
      opts.avatar.traverse((obj: any) => {
        if (obj.isMesh && obj.geometry) this.avatarMeshes.push(obj);
      });
      this._avatarBbox = new T.Box3();
      this._avatarCenter = new T.Vector3();

      // Candidates ordonnés par préférence : Hips/Spine sont au centre du corps
      const candidates = ['Hips', 'Spine', 'Torso', 'Abdomen', 'Body_1', 'Body', 'Pelvis', 'Root'];
      this.centerBone = null;
      for (const name of candidates) {
        opts.avatar.traverse((obj: any) => {
          if (this.centerBone) return;
          if (obj.name === name) this.centerBone = obj;
        });
        if (this.centerBone) break;
      }

      // Calcule la position centrale via le bone (si trouvé)
      opts.avatar.updateWorldMatrix(true, true);
      if (this.centerBone) {
        this.centerBone.updateWorldMatrix(true, false);
        this.centerBone.getWorldPosition(this._avatarCenter);
        // Estime la hauteur en cherchant aussi "Head" pour mesurer Hips→Head
        let headBone: any = null;
        opts.avatar.traverse((obj: any) => {
          if (!headBone && obj.name === 'Head') headBone = obj;
        });
        if (headBone) {
          const headPos = new T.Vector3();
          headBone.getWorldPosition(headPos);
          this.avatarHeight = Math.max(0.2, Math.abs(headPos.y - this._avatarCenter.y) * 2);
        } else {
          this.avatarHeight = 0.5;
        }
        console.log(`[RoomExplorer] 🦴 Centre via bone "${this.centerBone.name}" — pos=(${this._avatarCenter.x.toFixed(2)}, ${this._avatarCenter.y.toFixed(2)}, ${this._avatarCenter.z.toFixed(2)}), height≈${this.avatarHeight.toFixed(2)}`);
      } else {
        // Fallback : prend la position de l'avatar lui-même
        opts.avatar.getWorldPosition(this._avatarCenter);
        this.avatarHeight = 0.5;
        console.warn('[RoomExplorer] ⚠ Aucun bone de référence trouvé — utilise avatar.position');
      }
      this.avatarCenterY = this.avatarHeight * 0.5;
    } catch (e) {
      console.warn('[RoomExplorer] Could not measure avatar', e);
      this.avatarHeight = 0.4;
      this.avatarCenterY = 0.2;
    }
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('wheel', this.onWheelBound, { passive: false });
    window.addEventListener('pointerdown', this.onPointerDownBound);
    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('contextmenu', this.onContextMenuBound);

    // 🎭 Démarre immédiatement le cycle d'anims au repos (Wave, Yes, Punch, etc.)
    const restActions = this.opts!.restActions;
    if (restActions && restActions.length > 0) {
      this.restIdx = 0;
      this.currentRestAction = restActions[0];
      try {
        this.currentRestAction.reset().fadeIn(0.3).play();
        this.restTimer = (this.currentRestAction.getClip()?.duration || 2) + this.opts!.restGapSeconds;
        console.log(`[RoomExplorer] 🎭 Rest cycle started — ${restActions.length} anims`);
      } catch (e) { console.warn('[RoomExplorer] Could not start rest action', e); }
    } else if (this.opts!.idleAction) {
      try { this.opts!.idleAction.reset().fadeIn(0.3).play(); } catch {}
    }
    console.log(`[RoomExplorer] ✓ Initialized — mode=${this.cameraMode} (cinematic if crystalTarget provided)`);
  }

  update(deltaTime: number): void {
    if (!this.opts) return;
    const o = this.opts;
    const T = o.THREE;
    const a = o.avatar;
    const cam = o.camera;

    // ━━━ DASHBOARD-BETA STYLE : A/D tourne avatar, W/S avance/recule ━━━
    // ─── 1. ROTATION AVATAR (A/D ou flèches gauche/droite) ───
    if (this.keys.turnLeft)  a.rotation.y += o.turnSpeed * deltaTime;
    if (this.keys.turnRight) a.rotation.y -= o.turnSpeed * deltaTime;

    // ─── 2. MOUVEMENT FORWARD/BACK dans la direction où l'avatar regarde ───
    const avatarYaw = a.rotation.y;
    const move = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const moveDir = new T.Vector3();
    if (move !== 0) {
      // ⚠ EXACT dashboard-beta : sin(yaw) pour X, cos(yaw) pour Z
      moveDir.set(Math.sin(avatarYaw) * move, 0, Math.cos(avatarYaw) * move);
    }
    // Strafe Q/E optionnel (perpendiculaire à l'avatar)
    if (this.keys.strafeLeft || this.keys.strafeRight) {
      const strafeDir = (this.keys.strafeRight ? 1 : 0) - (this.keys.strafeLeft ? 1 : 0);
      moveDir.x += Math.cos(avatarYaw) * strafeDir;
      moveDir.z += -Math.sin(avatarYaw) * strafeDir;
    }

    const isMoving = moveDir.lengthSq() > 0;
    const speed = o.walkSpeed * (this.keys.run ? o.runMultiplier : 1);

    if (isMoving) {
      moveDir.normalize();
      const moveDelta = moveDir.clone().multiplyScalar(speed * deltaTime);
      const tentativePos = a.position.clone().add(moveDelta);

      // ─── 2a. Bounds check ───
      let blocked = false;
      if (o.bounds) {
        if (tentativePos.x < o.bounds.minX || tentativePos.x > o.bounds.maxX ||
            tentativePos.z < o.bounds.minZ || tentativePos.z > o.bounds.maxZ) {
          blocked = true;
        }
      }

      // ─── 2b. Collision horizontale (raycast antémural au niveau du chest) ───
      if (!blocked && o.collisionMeshes && o.collisionMeshes.length > 0) {
        const rcOrigin = a.position.clone();
        rcOrigin.y += o.chestHeight;
        const rc = new T.Raycaster(rcOrigin, moveDir.clone(), 0, o.collisionRadius + speed * deltaTime);
        const hits = rc.intersectObjects(o.collisionMeshes, true);
        if (hits.length > 0) blocked = true;
      }

      // Applique seulement le mouvement horizontal (X/Z) — Y géré par stair climbing
      if (!blocked) {
        a.position.x = tentativePos.x;
        a.position.z = tentativePos.z;
      }
      // Pas de rotation automatique : A/D contrôle déjà la rotation

      // ─── 2c. Anim WALK ───
      if (o.mixer && o.walkAction && !this.isWalking) {
        o.walkAction.reset().fadeIn(0.18).play();
        // Coupe le cycle rest si actif
        if (this.currentRestAction) this.currentRestAction.fadeOut(0.18);
        if (o.idleAction) o.idleAction.fadeOut(0.18);
        this.isWalking = true;
      }
      // Accélère/ralentit l'anim selon la vitesse réelle
      if (o.walkAction) {
        o.walkAction.timeScale = (this.keys.run ? o.runMultiplier : 1) * 0.9;
      }
    } else {
      // ─── Au repos : cycle d'anims (Wave, Yes, Punch, Duck, etc.) ───
      if (o.mixer && o.restActions && o.restActions.length > 0) {
        // Si on vient juste de s'arrêter, redémarre le cycle
        if (this.isWalking) {
          if (o.walkAction) o.walkAction.fadeOut(0.18);
          this.restIdx = 0;
          this.currentRestAction = o.restActions[this.restIdx];
          this.currentRestAction.reset().fadeIn(0.25).play();
          this.restTimer = (this.currentRestAction.getClip()?.duration || 2) + o.restGapSeconds;
          this.isWalking = false;
        } else {
          // En cycle : décrémente timer, passe à l'anim suivante quand 0
          this.restTimer -= deltaTime;
          if (this.restTimer <= 0) {
            const prev = this.currentRestAction;
            this.restIdx = (this.restIdx + 1) % o.restActions.length;
            this.currentRestAction = o.restActions[this.restIdx];
            this.currentRestAction.reset().fadeIn(0.3).play();
            if (prev && prev !== this.currentRestAction) prev.fadeOut(0.3);
            this.restTimer = (this.currentRestAction.getClip()?.duration || 2) + o.restGapSeconds;
          }
        }
      } else if (o.mixer && o.idleAction && this.isWalking) {
        // Fallback simple idle si pas de restActions
        o.idleAction.reset().fadeIn(0.18).play();
        if (o.walkAction) o.walkAction.fadeOut(0.18);
        this.isWalking = false;
      }
    }

    // ─── 3. STAIR CLIMBING — raycast vertical pour épouser le sol ───
    if (o.collisionMeshes && o.collisionMeshes.length > 0) {
      const rcOrigin = a.position.clone();
      rcOrigin.y += o.groundRayHeight;
      const downRc = new T.Raycaster(rcOrigin, new T.Vector3(0, -1, 0), 0, o.groundRayHeight + 1.0);
      const groundHits = downRc.intersectObjects(o.collisionMeshes, true);
      if (groundHits.length > 0) {
        const groundY = groundHits[0].point.y;
        const dy = groundY - a.position.y;
        // Step plafonné : si l'escalier monte trop d'un coup, on bloque (évite de téléporter sur des meubles)
        if (Math.abs(dy) <= o.stepHeight * 1.5) {
          // Smooth climb : plus rapide en montée, plus lent en descente
          const lerpFactor = dy > 0 ? Math.min(1, deltaTime * 12) : Math.min(1, deltaTime * 6);
          a.position.y += dy * lerpFactor;
        } else if (dy < -o.stepHeight * 1.5) {
          // Chute libre adoucie si l'avatar est très haut au-dessus du sol
          a.position.y += dy * Math.min(1, deltaTime * 4);
        }
      }
    }

    // ─── 4. CAMERA — switch entre 'cinematic' (orbite) et 'follow' (3ème personne) ───

    // Détection input : a-t-on une touche de mouvement active ?
    const anyInput = this.keys.forward || this.keys.backward ||
                     this.keys.turnLeft || this.keys.turnRight ||
                     this.keys.strafeLeft || this.keys.strafeRight;

    // State machine : interaction → follow, inactivité → cinematic
    if (anyInput || isMoving) {
      // L'utilisateur agit → mode follow
      this.cameraMode = 'follow';
      this.idleTimer = 0;
      this.hasInteracted = true;
    } else {
      // Inactif : compte les secondes
      this.idleTimer += deltaTime;
      if (this.idleTimer >= o.idleTimeoutSeconds && this.cameraMode === 'follow') {
        // Bascule en mode cinematic après le timeout
        this.cameraMode = 'cinematic';
      }
    }

    // ━━━ Recompute le centre des meshes visibles de YAMZY (live, chaque frame) ━━━
    this.recomputeAvatarBbox(T);
    const avatarCenterWorld = this._avatarCenter;   // Vector3 du vrai centre 3D de YAMZY

    // Décay du cameraYaw offset quand on ne drag pas → cam revient derrière l'avatar
    if (!this.isPointerDown && Math.abs(this.cameraYaw) > 0.001) {
      this.cameraYaw *= 0.95;   // décay exponentiel ~13% par frame
      if (Math.abs(this.cameraYaw) < 0.001) this.cameraYaw = 0;
    }

    if (this.cameraMode === 'cinematic') {
      // ━━━ ORBITE LENTE AUTOUR DE LA CIBLE ━━━
      // Cible = crystal initial (si pas encore interagi) sinon centre live de l'avatar
      const target = this.hasInteracted
        ? avatarCenterWorld.clone()
        : new T.Vector3(o.cinematicTarget!.x, o.cinematicTarget!.y, o.cinematicTarget!.z);

      this.cinematicAngle += o.cinematicOrbitSpeed * deltaTime;
      const x = Math.sin(this.cinematicAngle) * o.cinematicDistance;
      const z = Math.cos(this.cinematicAngle) * o.cinematicDistance;
      const desiredCamPos = new T.Vector3(
        target.x + x,
        target.y + o.cinematicHeight,
        target.z + z,
      );
      cam.position.lerp(desiredCamPos, o.cameraLerp);
      cam.lookAt(target);
      this.cameraYaw = a.rotation.y;
    } else {
      // ━━━ CAMERA DASHBOARD-BETA : TOUJOURS DERRIÈRE L'AVATAR ━━━
      // Position calculée depuis avatar.rotation.y (PAS depuis un cameraYaw indépendant)
      // + mouse drag adds extra yaw offset (look-around without changing avatar facing)
      this.currentCameraDistance += (this.targetCameraDistance - this.currentCameraDistance) * o.cameraLerp;
      const finalDistance = this.currentCameraDistance * this.debugDistMul;
      const finalHeight = o.cameraHeight * this.debugHeightMul;

      // Yaw effectif = avatar.rotation.y + offset de drag souris
      const effectiveYaw = a.rotation.y + this.cameraYaw;

      // EXACT dashboard-beta formula
      const offX = -Math.sin(effectiveYaw) * finalDistance * Math.cos(this.cameraPitch);
      const offZ = -Math.cos(effectiveYaw) * finalDistance * Math.cos(this.cameraPitch);
      const offY = finalHeight + Math.sin(this.cameraPitch) * finalDistance;

      // Position cible = avatar center + offset
      const targetX = avatarCenterWorld.x + offX + this.debugLateralX;
      const targetY = avatarCenterWorld.y + offY;
      const targetZ = avatarCenterWorld.z + offZ;

      // Lerp 0.10 (smooth follow exact dashboard-beta)
      cam.position.x += (targetX - cam.position.x) * 0.10;
      cam.position.y += (targetY - cam.position.y) * 0.10;
      cam.position.z += (targetZ - cam.position.z) * 0.10;

      // LookAt centre YAMZY + offset debug
      cam.lookAt(
        avatarCenterWorld.x,
        avatarCenterWorld.y + this.debugLookAtY,
        avatarCenterWorld.z,
      );

      // Update debug overlay si actif
      if (this.debugMode && this.debugOverlay) this.updateDebugOverlay();
    }
  }

  // ━━━ Debug camera mode : ajustement live avec clavier ━━━
  toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    if (this.debugMode) this.createDebugOverlay();
    else this.removeDebugOverlay();
  }

  private createDebugOverlay(): void {
    if (this.debugOverlay) return;
    const div = document.createElement('div');
    div.id = 'room-explorer-debug';
    div.style.cssText = `
      position: fixed; top: 80px; right: 16px; z-index: 99999;
      background: rgba(0,0,0,0.86); color: #fff;
      border: 1px solid #d54adf; border-radius: 8px;
      padding: 14px 18px; font-family: "Tinos", serif; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      min-width: 280px;
    `;
    document.body.appendChild(div);
    this.debugOverlay = div;
    this.updateDebugOverlay();
  }

  private updateDebugOverlay(): void {
    if (!this.debugOverlay || !this.opts) return;
    const o = this.opts;
    const c = this._avatarCenter;
    this.debugOverlay.innerHTML = `
      <div style="color:#d54adf;font-weight:bold;margin-bottom:8px;letter-spacing:0.08em;">
        🎥 CAMERA DEBUG (Tab pour fermer)
      </div>
      <div style="font-size:11px;line-height:1.6;">
        <div><b>cameraHeight</b> base=${o.cameraHeight.toFixed(2)} × mul=${this.debugHeightMul.toFixed(2)} = <span style="color:#fbbf24">${(o.cameraHeight*this.debugHeightMul).toFixed(3)}</span></div>
        <div><b>cameraDistance</b> base=${o.cameraDistance.toFixed(2)} × mul=${this.debugDistMul.toFixed(2)} = <span style="color:#fbbf24">${(o.cameraDistance*this.debugDistMul).toFixed(3)}</span></div>
        <div><b>lookAtY offset</b> = <span style="color:#fbbf24">${this.debugLookAtY.toFixed(3)}</span></div>
        <div><b>lateralX</b> = <span style="color:#fbbf24">${this.debugLateralX.toFixed(3)}</span></div>
        <hr style="border:none;border-top:1px solid #444;margin:6px 0;">
        <div><b>avatar center</b> = (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})</div>
        <div><b>avatar height</b> = ${this.avatarHeight.toFixed(3)}</div>
        <hr style="border:none;border-top:1px solid #444;margin:6px 0;">
        <div style="font-size:10px;color:#aaa;line-height:1.4;">
          <b style="color:#d54adf;">⌨ Touches :</b><br>
          • <b>I</b>/<b>K</b> : height + / − (0.05)<br>
          • <b>J</b>/<b>L</b> : distance + / − (0.05)<br>
          • <b>U</b>/<b>O</b> : lookAtY + / − (0.05)<br>
          • <b>N</b>/<b>M</b> : lateralX + / − (0.05)<br>
          • <b>R</b> : reset tout<br>
          • <b>C</b> : copier les valeurs<br>
        </div>
      </div>
    `;
  }

  private removeDebugOverlay(): void {
    if (this.debugOverlay) {
      this.debugOverlay.remove();
      this.debugOverlay = null;
    }
  }

  /** Reset tous les ajustements debug à zéro */
  resetDebugAdjustments(): void {
    this.debugHeightMul = 1;
    this.debugDistMul = 1;
    this.debugLookAtY = 0;
    this.debugLateralX = 0;
  }

  /** Copie les valeurs ajustées dans le presse-papier sous forme de config */
  copyDebugConfig(): void {
    if (!this.opts) return;
    const o = this.opts;
    const config = `// Camera config calibrée par debug mode :
cameraHeight:   ${(o.cameraHeight * this.debugHeightMul).toFixed(3)},
cameraDistance: ${(o.cameraDistance * this.debugDistMul).toFixed(3)},
// Si lookAtY ≠ 0 ou lateralX ≠ 0, ajoute dans le code :
// debugLookAtY: ${this.debugLookAtY.toFixed(3)},
// debugLateralX: ${this.debugLateralX.toFixed(3)},`;
    navigator.clipboard?.writeText(config).then(
      () => {
        console.log('[RoomExplorer] ✓ Config copiée dans le presse-papier :\n' + config);
        if (this.debugOverlay) {
          const toast = document.createElement('div');
          toast.textContent = '✓ Copié !';
          toast.style.cssText = 'position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;';
          this.debugOverlay.appendChild(toast);
          setTimeout(() => toast.remove(), 1500);
        }
      },
      err => console.error('[RoomExplorer] Erreur copy', err),
    );
  }

  /** Recompute le centre live de l'avatar — utilise centerBone si dispo, sinon bbox */
  private recomputeAvatarBbox(T: any): void {
    if (this.centerBone) {
      // ✓ Méthode robuste : position du bone Hips (suit l'animation)
      this.centerBone.updateWorldMatrix(true, false);
      this.centerBone.getWorldPosition(this._avatarCenter);
      // Ajoute un offset pour viser le centre du torse (au-dessus des hanches)
      this._avatarCenter.y += this.avatarHeight * 0.15;
      return;
    }
    // Fallback : bbox des meshes (peut être faux pour SkinnedMesh)
    if (!this.avatarMeshes.length) return;
    this._avatarBbox.makeEmpty();
    for (const m of this.avatarMeshes) {
      m.updateWorldMatrix(true, false);
      const mb = new T.Box3().setFromObject(m);
      this._avatarBbox.union(mb);
    }
    this._avatarBbox.getCenter(this._avatarCenter);
    const size = new T.Vector3(); this._avatarBbox.getSize(size);
    if (size.y > 0.02 && size.y < 8) this.avatarHeight = size.y;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('wheel', this.onWheelBound);
    window.removeEventListener('pointerdown', this.onPointerDownBound);
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('contextmenu', this.onContextMenuBound);
    this.removeDebugOverlay();
    this.opts = null;
  }

  // ━━━ Pointer (souris) ━━━
  private onPointerDown(e: PointerEvent): void {
    if (!this.opts) return;
    // bouton gauche OU droit → drag caméra
    if (e.button !== 0 && e.button !== 2) return;
    this.isPointerDown = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }
  private onPointerMove(e: PointerEvent): void {
    if (!this.opts || !this.isPointerDown) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    // Drag horizontal : ajoute un yaw offset (look-around sans tourner l'avatar)
    // cameraYaw n'est PLUS la valeur absolue, c'est un OFFSET par rapport à avatar.rotation.y
    this.cameraYaw -= dx * 0.005;
    // Drag vertical : pitch
    this.cameraPitch -= dy * 0.005;
    const maxPitch = Math.PI * 0.45;
    const minPitch = -Math.PI * 0.25;
    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));
  }
  private onPointerUp(_e: PointerEvent): void {
    this.isPointerDown = false;
    // Quand l'user relâche, on REVIENT progressivement à derrière l'avatar
    // (le yaw offset cameraYaw va décay vers 0 — fait dans update())
  }

  // ─── Handlers ───
  private onKeyDown(e: KeyboardEvent): void {
    if (!this.opts) return;
    // ━━━ Debug mode toggle ━━━
    if (e.code === 'Tab') {
      e.preventDefault();
      this.toggleDebugMode();
      return;
    }
    // ━━━ Touches debug actives quand debugMode est ON ━━━
    if (this.debugMode) {
      const step = e.shiftKey ? 0.01 : 0.05;
      switch (e.code) {
        case 'KeyI': this.debugHeightMul += step; this.updateDebugOverlay(); return;
        case 'KeyK': this.debugHeightMul = Math.max(0, this.debugHeightMul - step); this.updateDebugOverlay(); return;
        case 'KeyJ': this.debugDistMul = Math.max(0.1, this.debugDistMul - step); this.updateDebugOverlay(); return;
        case 'KeyL': this.debugDistMul += step; this.updateDebugOverlay(); return;
        case 'KeyU': this.debugLookAtY += step; this.updateDebugOverlay(); return;
        case 'KeyO': this.debugLookAtY -= step; this.updateDebugOverlay(); return;
        case 'KeyN': this.debugLateralX -= step; this.updateDebugOverlay(); return;
        case 'KeyM': this.debugLateralX += step; this.updateDebugOverlay(); return;
        case 'KeyR': this.resetDebugAdjustments(); this.updateDebugOverlay(); return;
        case 'KeyC': this.copyDebugConfig(); return;
      }
    }
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = true; break;
      case 'KeyS': case 'ArrowDown':  this.keys.backward = true; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.turnLeft = true; break;
      case 'KeyD': case 'ArrowRight': this.keys.turnRight = true; break;
      case 'KeyQ':                    this.keys.strafeLeft = true; break;
      case 'KeyE':                    this.keys.strafeRight = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.run = true; break;
    }
  }
  private onKeyUp(e: KeyboardEvent): void {
    if (!this.opts) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = false; break;
      case 'KeyS': case 'ArrowDown':  this.keys.backward = false; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.turnLeft = false; break;
      case 'KeyD': case 'ArrowRight': this.keys.turnRight = false; break;
      case 'KeyQ':                    this.keys.strafeLeft = false; break;
      case 'KeyE':                    this.keys.strafeRight = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.run = false; break;
    }
  }
  private onWheel(e: WheelEvent): void {
    if (!this.opts) return;
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    this.targetCameraDistance = Math.max(this.opts.minDistance, Math.min(this.opts.maxDistance,
      this.targetCameraDistance + dir * this.opts.zoomSpeed));
  }
}
