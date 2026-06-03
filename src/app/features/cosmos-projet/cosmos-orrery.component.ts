// ═══════════════════════════════════════════════════════════════════
// Cosmos Orrery — vue 3D mécanique animée du orrery.glb
//
// PIPELINE :
//   1) Charge orrery.glb + joue Take 01 (anims natives)
//   2) Analyse mécanique : classe chaque mesh par forme + position
//        sun      = mesh sphérique central (le plus gros + le + centré)
//        planets  = meshes sphériques en orbite (sphere-like, dist > seuil)
//        supports = bras métalliques (elongated, aspect > 2)
//        static   = base/socle (le reste)
//   3) Pair chaque planet à son support métallique le + proche
//   4) Mappe les tickets projet sur (planet+support) :
//        - couleur du ticket → planet.material + support tinté métallique
//        - scale → storyPoints (légère variation)
//        - cache si filtre NOW exclut
//   5) Velocity projet → mixer.timeScale (anim plus rapide/lente)
//   6) Santé projet → couleur soleil (vert/jaune/rouge)
// ═══════════════════════════════════════════════════════════════════

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Ticket projet minimal pour mapper sur une planète. */
export interface OrreryTicket {
  id: string | number;
  title?: string;
  description?: string;
  color?: string;        // hex couleur de la planète
  storyPoints?: number;  // scale planète (1 = neutre)
  status?: string;
  visible?: boolean;     // false → planète cachée
  date?: Date | string;  // pour bucketer par anneau (segment de l'année)
}

/** Rôle assigné à un mesh lors de l'analyse mécanique. */
type MeshRole = 'sun' | 'planet' | 'support' | 'ring' | 'static';

@Component({
  selector: 'cosmos-orrery',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="orrery-wrap">
      <canvas #canvas class="orrery-canvas"></canvas>
      <div *ngIf="loadFailed" class="orrery-fallback">⚙ Orrery loading failed</div>
      <div class="orrery-debug" *ngIf="debugInfo">
        <div>{{ debugInfo }}</div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      pointer-events: none;
    }
    .orrery-wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .orrery-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .orrery-fallback {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: #e6b85a;
    }
    .orrery-debug {
      position: absolute;
      top: 8px; left: 8px;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.6);
      color: #7aff7a;
      font-family: 'Consolas', monospace;
      font-size: 10px;
      border-radius: 4px;
      max-width: 360px;
      pointer-events: none;
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmosOrreryComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  @Input() glbUrl = '/assets/agents/orrery.glb';
  @Input() animSpeed = 1;
  /** Couleur uniforme appliquée à la grande sphère du GLB (texture strippée).
   *  Si null → pas de patch.
   *  Si 'auto' → on extrait la couleur dorée déjà présente dans le GLB (rings/supports).
   *  Sinon → la valeur hex passée en input. */
  @Input() bigSphereSolidColor: string | null = 'auto';
  /** Velocity projet (SP/sprint). 30 = vitesse anim normale. 60 = 2x plus rapide. */
  @Input() projectVelocity: number | null = null;
  /** Santé projet (0-100). Drive la couleur de teinte du soleil. */
  @Input() projectHealth = 75;
  /** Couleur custom du soleil (override l'heuristique de santé). */
  @Input() sunColor: string | null = null;
  /** Tickets projet à mapper sur les planètes (ordre = priorité d'affichage) */
  @Input() tickets: OrreryTicket[] = [];
  /** URL du cristal de jeu qui remplace le soleil du GLB. */
  @Input() crystalUrl = '/assets/conclave/models/crystal.glb';

  /** Émis quand l'utilisateur clique sur une planète. Payload = ticket assigné (ou null). */
  @Output() planetClick = new EventEmitter<{ ticket: OrreryTicket | null; pairIndex: number }>();

  loadFailed = false;
  debugInfo = '';

  // ═══ ANALYSE MÉCANIQUE — caches des rôles identifiés ═══
  private sunMesh: any = null;           // mesh central = soleil (caché si cristal chargé)
  private planetMeshes: any[] = [];      // meshes sphériques en orbite
  private supportMeshes: any[] = [];     // bras métalliques
  private ringMeshes: any[] = [];        // anneaux orbitaux (= segments d'année)
  private staticMeshes: any[] = [];      // base / socle / autres
  private planetSupportPairs: Array<{ planet: any; support: any | null; }> = [];
  // Matériaux d'origine pour pouvoir reset si besoin
  private originalMaterials = new WeakMap<any, any>();

  // ═══ CRISTAL — remplace le soleil du GLB ═══
  private crystal: any = null;            // racine THREE.Object3D du cristal chargé
  private crystalBaseY = 0;               // position Y de base pour le bobbing
  private crystalGlow: any = null;        // PointLight purple/santé qui entoure le cristal
  // ═══ State machine du cristal (fidèle au Crystal.js de spell-caster + extension projet) ═══
  // WHOLE = entier (= projet 100% fini), EXPLODING = scatter aléatoire, BROKEN = morceaux dispersés,
  // REFORMING = retour vers WHOLE, ORBITING = groupes orbitent (projet en cours, N groupes = N tickets)
  private crystalState: 'WHOLE' | 'EXPLODING' | 'BROKEN' | 'REFORMING' | 'ORBITING' = 'WHOLE';
  /** Mini-cristaux : 1 clone Ruby = 1 ticket. Orbitent autour du gros, fusionnent au play. */
  private crystalMiniInstances: Array<{
    mesh: any;               // clone du Ruby mesh
    ticket: OrreryTicket;
    orbit: { radius: number; speed: number; basePhase: number; inclination: number };
    fused: boolean;          // true = a déjà fusionné au gros cristal
    baseScale: number;       // taille de base (% du Ruby original)
    spinSpeed: { x: number; y: number; z: number };
  }> = [];
  private crystalRuby: any = null;        // mesh "Ruby" = le cristal entier
  private crystalSmashItems: Array<{      // morceaux qui s'éclatent
    mesh: any;
    home: { position: any; rotation: any; scale: any };
    random: { x: number; y: number; z: number };
  }> = [];
  private crystalBrokenSpin = 0;          // 0..1, contrôle la vitesse de spin des morceaux
  private explodeSound: HTMLAudioElement | null = null;
  private reformSound: HTMLAudioElement | null = null;
  // ═══ Système de tweens manuels (substitut GSAP) ═══
  private tweens: Array<{
    target: any; prop: string; from: number; to: number;
    duration: number; elapsed: number; ease: (t: number) => number; onComplete?: () => void;
  }> = [];
  // ═══ Particules type CrystalEnergyEmitter (spell-caster) ═══
  private crystalParticles: any = null;   // THREE.Points
  private particleData: Array<{ lifeRemaining: number; velocity: any }> = [];
  private readonly PARTICLE_COUNT = 60;

  // ═══ Raycaster pour click sur planètes ═══
  private raycaster: any = null;
  private mouseNDC: any = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  /** Nombre d'anneaux détectés = nombre de segments dans l'année (12 = mois, 4 = trimestres, etc.) */
  get yearSegmentCount(): number { return this.ringMeshes.length || 12; }

  private THREE: any;
  private GLTFLoader: any;
  private DRACOLoader: any;

  private renderer: any;
  private scene: any;
  private camera: any;
  private model: any;
  private mixer: any = null;
  private clock: any;
  private rafId: any = 0;
  private disposed = false;

  // Camera tour
  private cameraTargetPos: any;
  private cameraTargetLook: any;
  private cameraTimer: any = null;

  async ngAfterViewInit() {
    console.log('[Orrery] 🚀 ngAfterViewInit START — glbUrl:', this.glbUrl);
    await this.ensureThreeJS();
    console.log('[Orrery] THREE ready?', !!this.THREE, '— GLTFLoader?', !!this.GLTFLoader);
    if (!this.THREE) { this.loadFailed = true; console.error('[Orrery] THREE failed to load'); return; }
    this.cameraTargetPos = new this.THREE.Vector3(0, 8, 18);
    this.cameraTargetLook = new this.THREE.Vector3(0, 0, 0);
    this.initScene();
    await this.loadModel();
    this.startCameraTour();
    this.startLoop();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Re-applique les inputs dynamiques quand ils changent en live
    if (this.mixer && (changes['animSpeed'] || changes['projectVelocity'])) {
      this.applyVelocityToMixer();
    }
    if (this.sunMesh && (changes['projectHealth'] || changes['sunColor'])) {
      this.applySunColor();
    }
    if (this.planetMeshes.length > 0 && changes['tickets']) {
      this.applyTicketsToPlanets();
    }
    // Re-divise le cristal si tickets change (et cristal déjà chargé)
    if (this.crystal && changes['tickets']) {
      this.divideCrystalForTickets();
    }
  }

  private applyVelocityToMixer() {
    const v = this.projectVelocity ?? 30;
    const speedFromVelocity = Math.max(0.2, Math.min(3, v / 30));
    if (this.mixer) {
      this.mixer.timeScale = (this.animSpeed || 1) * speedFromVelocity;
    }
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.cameraTimer) clearTimeout(this.cameraTimer);
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    this.cleanupMiniCrystals();
    if (this.renderer) {
      try { this.renderer.dispose(); } catch {}
    }
  }

  /** Couleur soleil selon santé (rouge=mauvais, jaune=moyen, vert=bon) ou override custom */
  private healthToColor(): string {
    if (this.sunColor) return this.sunColor;
    const h = Math.max(0, Math.min(100, this.projectHealth));
    if (h >= 70) return '#7fdb6f';        // vert (sain)
    if (h >= 40) return '#ffaa44';        // jaune (modéré)
    return '#e64a4a';                     // rouge (critique)
  }

  /** Applique la couleur santé au soleil (uniquement si pas de cristal — le cristal garde sa couleur native du jeu) */
  private applySunColor() {
    if (!this.THREE) return;
    // Si le cristal est chargé : on GARDE ses matériaux natifs (identiques au jeu).
    // La santé projet se reflète dans la couleur de la PointLight ambient.
    if (this.crystal) {
      if (this.crystalGlow) {
        const colorHex = this.healthToColor();
        this.crystalGlow.color.set(colorHex);
      }
      return;
    }
    // Pas de cristal → teinte le mesh soleil du GLB par défaut
    if (this.sunMesh) {
      this.tintMesh(this.sunMesh, this.healthToColor(), 0.7);
    }
  }

  /**
   * Charge crystal.glb et le positionne EXACTEMENT à la place du soleil identifié.
   * Cache le sunMesh du GLB une fois le cristal en place.
   */
  private loadCrystalReplacement() {
    if (!this.GLTFLoader || !this.THREE) return;
    if (!this.sunMesh) {
      console.warn('[Orrery] 💎 Pas de soleil identifié → pas de remplacement cristal');
      return;
    }
    const loader = new this.GLTFLoader();
    if (this.DRACOLoader) {
      try {
        const draco = new this.DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(draco);
      } catch {}
    }
    // Position monde + taille du soleil → on aligne le cristal dessus
    const sunWorldPos = new this.THREE.Vector3();
    this.sunMesh.getWorldPosition(sunWorldPos);
    if (!this.sunMesh.geometry.boundingBox) this.sunMesh.geometry.computeBoundingBox();
    const sunBox = this.sunMesh.geometry.boundingBox;
    const sunWorldScale = new this.THREE.Vector3();
    this.sunMesh.getWorldScale(sunWorldScale);
    const sunSize = sunBox.getSize(new this.THREE.Vector3());
    const sunRadius = Math.max(sunSize.x * sunWorldScale.x, sunSize.y * sunWorldScale.y, sunSize.z * sunWorldScale.z) / 2;

    loader.load(this.crystalUrl, (gltf: any) => {
      if (this.disposed) return;
      this.crystal = gltf.scene;
      // Auto-fit du cristal pour qu'il fasse la même taille que le soleil
      const cBox = new this.THREE.Box3().setFromObject(this.crystal);
      const cSize = cBox.getSize(new this.THREE.Vector3());
      const cMaxDim = Math.max(cSize.x, cSize.y, cSize.z) || 1;
      const targetDim = sunRadius * 2.2;       // un peu + gros que le soleil pour l'effet
      const ratio = targetDim / cMaxDim;
      this.crystal.scale.set(ratio, ratio, ratio);
      // Place le cristal à la position world du soleil
      this.crystal.position.copy(sunWorldPos);
      this.crystalBaseY = sunWorldPos.y;
      this.crystal.traverse((c: any) => { if (c.isMesh) c.frustumCulled = false; });
      // ═══ Identifie Ruby (cristal entier) + smash items (morceaux) ═══
      this.crystalRuby = null;
      this.crystalSmashItems = [];
      this.crystal.traverse((item: any) => {
        if (!item.isMesh) return;
        // Match "Ruby" insensitive au case
        if (/^ruby$/i.test(item.name || '')) {
          this.crystalRuby = item;
        } else {
          this.crystalSmashItems.push({
            mesh: item,
            home: {
              position: item.position.clone(),
              rotation: item.rotation.clone(),
              scale: item.scale.clone(),
            },
            random: {
              x: Math.random() * 2 - 1,
              y: Math.random() * 2 - 1,
              z: Math.random() * 2 - 1,
            },
          });
          item.visible = false;  // pieces hidden initialement
        }
      });
      // Fallback si "Ruby" pas trouvé : 1er mesh = ruby, autres = pieces
      if (!this.crystalRuby && this.crystalSmashItems.length > 0) {
        this.crystalRuby = this.crystalSmashItems[0].mesh;
        this.crystalRuby.visible = true;
        this.crystalSmashItems.shift();
      }
      console.log('[Orrery] 💎 Crystal anatomy → ruby:', this.crystalRuby?.name || 'none',
                  '| smash pieces:', this.crystalSmashItems.length);
      // Ajoute à la scène ROOT (pas au model, pour éviter d'être impacté par l'anim Take 01)
      this.scene.add(this.crystal);
      // Cache le soleil du GLB
      this.sunMesh.visible = false;
      // PointLight purple/santé autour du cristal (signature spell-caster : 0x9b6cff)
      this.crystalGlow = new this.THREE.PointLight(0x9b6cff, 1.2, sunRadius * 8);
      this.crystalGlow.position.copy(sunWorldPos);
      this.scene.add(this.crystalGlow);
      // Applique la santé sur la couleur de la light (pas sur les matériaux du cristal)
      this.applySunColor();
      // Crée les particules autour du cristal (style CrystalEnergyEmitter)
      this.createCrystalParticles(sunWorldPos, targetDim * 0.4);
      // Load les sons pour explode/reform
      this.loadCrystalSounds();
      // Division automatique en groupes si des tickets sont déjà présents
      if (this.tickets && this.tickets.length > 0) {
        this.divideCrystalForTickets();
      }
      console.log('[Orrery] 💎 Crystal ready — click pour exploder, Play pour simuler timeline');
    }, undefined, (err: any) => {
      console.warn('[Orrery] 💎 Crystal load failed (sun GLB stays visible):', err);
    });
  }

  /** Charge les sons crystal-explode et crystal-reform du jeu spell-caster. */
  private loadCrystalSounds() {
    try {
      this.explodeSound = new Audio('/assets/conclave/sounds/crystal-explode.mp3');
      this.explodeSound.volume = 0.5;
      this.reformSound = new Audio('/assets/conclave/sounds/crystal-reform.mp3');
      this.reformSound.volume = 0.5;
    } catch (e) {
      console.warn('[Orrery] Failed to load crystal sounds:', e);
    }
  }

  // ═══════════════════ EXPLODE / REFORM ═══════════════════════════
  // Reproduction fidèle de explodeAnimation() + rewindAnimation() de Crystal.js
  // duration=3s explode, duration=2s reform.
  // Pendant BROKEN : chaque morceau tourne autour d'un axe aléatoire.

  /** Power4.out = 1 - (1-t)^4 — décélération forte (fidèle GSAP) */
  private power4Out = (t: number) => 1 - Math.pow(1 - t, 4);
  /** Power2.inOut — accélère puis décélère */
  private power2InOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /** Ajoute un tween : target[prop] passe de sa valeur actuelle à `to` en `duration` sec. */
  private addTween(target: any, prop: string, to: number, duration: number, ease: (t: number) => number, onComplete?: () => void) {
    this.tweens.push({ target, prop, from: target[prop], to, duration, elapsed: 0, ease, onComplete });
  }

  /** Update tous les tweens actifs. Appelé dans la loop avec dt en secondes. */
  private updateTweens(dt: number) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += dt;
      const t = Math.min(1, tw.elapsed / tw.duration);
      tw.target[tw.prop] = tw.from + (tw.to - tw.from) * tw.ease(t);
      if (t >= 1) {
        this.tweens.splice(i, 1);
        tw.onComplete?.();
      }
    }
  }

  /**
   * EXPLODE — fidèle au Crystal.js du jeu :
   *   - Hide Ruby, show smash items
   *   - Each piece animates outward to a random position over 3s with power4.out
   *   - Pieces spin around their random axis at brokenSpin rate (0.25)
   *   - Sound crystal-explode au déclenchement
   *   - Après 80% du duration, passe à BROKEN
   */
  public explodeCrystal() {
    if (this.crystalState !== 'WHOLE' || !this.crystalRuby) return;
    console.log('[Orrery] 💥 EXPLODE');
    this.crystalState = 'EXPLODING';
    this.crystalRuby.visible = false;
    this.crystalSmashItems.forEach(it => { it.mesh.visible = true; });
    if (this.explodeSound) {
      try { this.explodeSound.currentTime = 0; this.explodeSound.play().catch(() => {}); } catch {}
    }
    const duration = 3;
    // Power4.out positionne chaque morceau à une cible random (range fidèle au jeu : -5..5, -1..4, -4..4)
    this.crystalSmashItems.forEach(it => {
      const tx = Math.random() * 10 - 5;
      const ty = Math.random() * 5 - 1;
      const tz = Math.random() * 8 - 4;
      this.addTween(it.mesh.position, 'x', tx, duration, this.power4Out);
      this.addTween(it.mesh.position, 'y', ty, duration, this.power4Out);
      this.addTween(it.mesh.position, 'z', tz, duration, this.power4Out);
    });
    this.crystalBrokenSpin = 1;
    // Après 80% → BROKEN
    setTimeout(() => {
      if (this.crystalState === 'EXPLODING') this.crystalState = 'BROKEN';
    }, duration * 0.8 * 1000);
  }

  /**
   * REFORM — fidèle au rewindAnimation() :
   *   - Pieces retour à leur position/rotation initiale en 2s avec power2.inOut
   *   - Sound crystal-reform après 200ms
   *   - À la fin : ruby visible, pieces cachées, state=WHOLE
   */
  public reformCrystal() {
    if (this.crystalState !== 'BROKEN' || !this.crystalRuby) return;
    console.log('[Orrery] 🔧 REFORM');
    this.crystalState = 'REFORMING';
    this.crystalBrokenSpin = 0;
    setTimeout(() => {
      if (this.reformSound) {
        try { this.reformSound.currentTime = 0; this.reformSound.play().catch(() => {}); } catch {}
      }
    }, 200);
    const duration = 2;
    this.crystalSmashItems.forEach(it => {
      this.addTween(it.mesh.position, 'x', it.home.position.x, duration, this.power2InOut);
      this.addTween(it.mesh.position, 'y', it.home.position.y, duration, this.power2InOut);
      this.addTween(it.mesh.position, 'z', it.home.position.z, duration, this.power2InOut);
      this.addTween(it.mesh.rotation, 'x', it.home.rotation.x, duration, this.power2InOut);
      this.addTween(it.mesh.rotation, 'y', it.home.rotation.y, duration, this.power2InOut);
      this.addTween(it.mesh.rotation, 'z', it.home.rotation.z, duration, this.power2InOut);
    });
    setTimeout(() => {
      if (this.crystalState !== 'REFORMING') return;
      this.crystalState = 'WHOLE';
      if (this.crystalRuby) this.crystalRuby.visible = true;
      this.crystalSmashItems.forEach(it => { it.mesh.visible = false; });
      console.log('[Orrery] 💎 Crystal back to WHOLE');
    }, duration * 1000);
  }

  // ═══════════════════ PROJET → CRYSTAL DIVISION ═══════════════════════════
  // Concept : le cristal entier = projet 100% fini.
  // Tickets non-DONE → groupes orbitants. Tickets DONE → groupes déjà fusionnés.
  // Play → fusion séquentielle de chaque groupe sur la durée → cristal complet à la fin.

  /**
   * Concept : N mini-cristaux (clones du Ruby) orbitent autour du gros Ruby central.
   * Chaque mini = 1 ticket. Le Ruby central commence petit (taille = doneCount/N).
   *   - Tickets DONE → leur mini est DÉJÀ fusionné (n'apparaît pas, contribue au Ruby central)
   *   - Tickets en cours → leur mini orbite avec couleur et position
   * Play → chaque mini fly to center + scale 0, et le Ruby central grossit jusqu'à 1.
   */
  public divideCrystalForTickets() {
    if (!this.crystal || !this.crystalRuby || !this.THREE) return;
    const T = this.THREE;
    const tickets = this.tickets || [];
    const N = tickets.length;
    if (N === 0) return;
    // Cleanup minis existants
    this.cleanupMiniCrystals();
    // Cache TOUS les smash items (on ne les utilise plus dans ce mode)
    this.crystalSmashItems.forEach(it => { it.mesh.visible = false; });
    // Compte les tickets déjà DONE — contribue à la taille initiale du Ruby central
    const doneCount = tickets.filter(t => t.status === 'DONE' || t.status === 'CLOSED').length;
    const donePct = doneCount / N;
    // Ruby central : visible et scale = doneCount/N (au moins 0.001 sinon invisible)
    this.crystalRuby.visible = donePct > 0.001;
    this.crystalRuby.scale.set(Math.max(0.001, donePct), Math.max(0.001, donePct), Math.max(0.001, donePct));
    // Force la mise à jour de la world matrix pour avoir getWorldScale correct
    this.crystal.updateMatrixWorld(true);
    // Calcul de la taille des minis en WORLD scale (sinon ils sont microscopiques)
    const rubyWorldScale = new T.Vector3();
    this.crystalRuby.getWorldScale(rubyWorldScale);
    // Fallback : si getWorldScale retourne 0 ou pas fiable, prend crystal.scale × 1
    const effectiveRubyScale = rubyWorldScale.x > 0.001 ? rubyWorldScale.x : (this.crystal.scale.x || 1);
    const miniWorldScale = Math.max(0.05, effectiveRubyScale * 0.32);
    // ⚠ Rayon d'orbite = bbox de la SCÈNE entière fitee à 12 → orbit radius en world ≈ 3-7
    //    (totalement indépendant du rubyWorldScale qui peut être petit)
    const orbitBaseRadius = 3.5;  // unités WORLD, visible quel que soit le scale du crystal
    console.log('[Orrery] 💎 Ruby world scale:', rubyWorldScale.x.toFixed(3),
                '→ effective:', effectiveRubyScale.toFixed(3),
                '→ mini scale:', miniWorldScale.toFixed(3),
                '→ orbit radius base:', orbitBaseRadius.toFixed(3),
                '(WORLD units, fixed)');

    // Crée N mini-cristaux (clones du Ruby) pour chaque ticket NON-done
    let placed = 0;
    const pendingCount = N - doneCount;
    for (let i = 0; i < N; i++) {
      const ticket = tickets[i];
      const isDone = ticket.status === 'DONE' || ticket.status === 'CLOSED';
      if (isDone) continue;  // déjà compté dans doneCount → ne crée pas de mini
      const mini = this.crystalRuby.clone(true);
      // Clone le matériau pour pouvoir le teinter individuellement sans affecter le Ruby
      try { mini.material = this.crystalRuby.material.clone(); } catch {}
      // ⚠ Ajout au scene root (pas au crystal) pour orbiter en WORLD space
      mini.scale.set(miniWorldScale, miniWorldScale, miniWorldScale);
      mini.visible = true;
      mini.frustumCulled = false;
      // Force frustumCulled=false sur TOUS les enfants du clone (si Ruby est composé)
      mini.traverse((c: any) => { if (c.isMesh) c.frustumCulled = false; });
      this.scene.add(mini);
      // Optionnel : teinte le mini avec la couleur du ticket pour identification visuelle
      if (ticket.color && mini.material) {
        try {
          const col = new T.Color(ticket.color);
          if (mini.material.color) mini.material.color.lerp(col, 0.4);
          if (mini.material.emissive) {
            mini.material.emissive.copy(col).multiplyScalar(0.3);
            if ('emissiveIntensity' in mini.material) mini.material.emissiveIntensity = 0.5;
          }
          mini.material.needsUpdate = true;
        } catch {}
      }
      const orbit = {
        radius: orbitBaseRadius + (placed % 3) * (orbitBaseRadius * 0.4) + Math.random() * 0.3,
        speed: 0.4 + (placed % 5) * 0.1 + Math.random() * 0.15,
        basePhase: (placed / Math.max(1, pendingCount)) * Math.PI * 2,
        inclination: 0.2 + Math.random() * 0.35,
      };
      // Position initiale sur l'orbite (sinon ils spawnent à (0,0,0) et restent là si t=0)
      const cx = this.crystal.position.x;
      const cy = this.crystal.position.y;
      const cz = this.crystal.position.z;
      mini.position.set(
        cx + Math.cos(orbit.basePhase) * orbit.radius,
        cy + Math.sin(orbit.basePhase * 0.5) * orbit.radius * orbit.inclination,
        cz + Math.sin(orbit.basePhase) * orbit.radius,
      );
      this.crystalMiniInstances.push({
        mesh: mini,
        ticket,
        orbit,
        fused: false,
        baseScale: miniWorldScale,
        spinSpeed: {
          x: 0.3 + Math.random() * 0.4,
          y: 0.8 + Math.random() * 0.5,
          z: 0.2 + Math.random() * 0.3,
        },
      });
      placed++;
    }
    if (this.crystalMiniInstances.length === 0) {
      // Aucun ticket pending → cristal au complet
      this.crystalRuby.visible = true;
      this.crystalRuby.scale.set(1, 1, 1);
      this.crystalState = 'WHOLE';
    } else {
      this.crystalState = 'ORBITING';
    }
    console.log('[Orrery] 💎 Mini-crystals créés —', this.crystalMiniInstances.length,
                'orbitent,', doneCount, 'déjà fusés. Ruby scale:', donePct.toFixed(2));
  }

  /** Cleanup des mini-cristaux clones (mémoire + scene graph) */
  private cleanupMiniCrystals() {
    this.crystalMiniInstances.forEach(m => {
      try {
        if (this.scene) this.scene.remove(m.mesh);
        m.mesh.geometry?.dispose?.();
        m.mesh.material?.dispose?.();
      } catch {}
    });
    this.crystalMiniInstances = [];
  }

  /**
   * Joue la timeline projet : chaque mini-cristal pending fly to center + scale 0
   * séquentiellement sur durationSec. Le Ruby central grossit à chaque fusion.
   */
  public playProjectTimeline(durationSec: number = 20) {
    const pending = this.crystalMiniInstances.filter(m => !m.fused);
    if (pending.length === 0) {
      console.log('[Orrery] 🎉 Projet déjà terminé — Ruby au complet');
      if (this.crystalRuby) {
        this.crystalRuby.visible = true;
        this.addTween(this.crystalRuby.scale, 'x', 1, 0.6, this.power2InOut);
        this.addTween(this.crystalRuby.scale, 'y', 1, 0.6, this.power2InOut);
        this.addTween(this.crystalRuby.scale, 'z', 1, 0.6, this.power2InOut);
        try { this.reformSound?.play().catch(() => {}); } catch {}
      }
      return;
    }
    console.log('[Orrery] 🎬 Play timeline — durée', durationSec, 's,', pending.length, 'mini-crystals à fusionner');
    pending.forEach((mini, i) => {
      const delayMs = (i / pending.length) * durationSec * 1000;
      setTimeout(() => {
        if (this.disposed || mini.fused) return;
        this.fuseMiniCrystal(mini, 1.5);
      }, delayMs);
    });
  }

  /**
   * Fusion d'un mini-cristal : tween position vers (0,0,0) + scale vers 0.
   * Le Ruby central grossit progressivement (scale += 1/N).
   * À la fin → mini caché, vérifie si tous fusés → state=WHOLE.
   */
  private fuseMiniCrystal(mini: any, durationSec: number) {
    if (mini.fused) return;
    mini.fused = true;
    console.log('[Orrery] 🔧 Fuse mini →', mini.ticket?.title || mini.ticket?.id);
    try { this.reformSound?.play().catch(() => {}); } catch {}
    // Tween position du mini vers le centre WORLD du crystal
    const cx = this.crystal?.position.x ?? 0;
    const cy = this.crystal?.position.y ?? 0;
    const cz = this.crystal?.position.z ?? 0;
    this.addTween(mini.mesh.position, 'x', cx, durationSec, this.power2InOut);
    this.addTween(mini.mesh.position, 'y', cy, durationSec, this.power2InOut);
    this.addTween(mini.mesh.position, 'z', cz, durationSec, this.power2InOut);
    // Scale mini → 0
    this.addTween(mini.mesh.scale, 'x', 0.001, durationSec, this.power2InOut);
    this.addTween(mini.mesh.scale, 'y', 0.001, durationSec, this.power2InOut);
    this.addTween(mini.mesh.scale, 'z', 0.001, durationSec, this.power2InOut);
    // Ruby central : grossit de 1/N (clamp à 1)
    if (this.crystalRuby) {
      this.crystalRuby.visible = true;
      const N = this.tickets.length || 1;
      const inc = 1 / N;
      const newScale = Math.min(1, this.crystalRuby.scale.x + inc);
      this.addTween(this.crystalRuby.scale, 'x', newScale, durationSec, this.power2InOut);
      this.addTween(this.crystalRuby.scale, 'y', newScale, durationSec, this.power2InOut);
      this.addTween(this.crystalRuby.scale, 'z', newScale, durationSec, this.power2InOut);
    }
    setTimeout(() => {
      if (this.disposed) return;
      mini.mesh.visible = false;
      // Si tous fusés → Ruby plein, state=WHOLE
      if (this.crystalMiniInstances.every(m => m.fused)) {
        if (this.crystalRuby) {
          this.addTween(this.crystalRuby.scale, 'x', 1, 0.6, this.power2InOut);
          this.addTween(this.crystalRuby.scale, 'y', 1, 0.6, this.power2InOut);
          this.addTween(this.crystalRuby.scale, 'z', 1, 0.6, this.power2InOut);
        }
        this.crystalState = 'WHOLE';
        console.log('[Orrery] 🎉 PROJECT 100% COMPLETE — crystal fully formed');
      }
    }, durationSec * 1000);
  }

  /**
   * Crée un système de particules autour du cristal (style CrystalEnergyEmitter du spell-caster).
   * Couleurs purple/magenta drift, texture canvas radial, additive blending.
   */
  private createCrystalParticles(center: any, spawnRadius: number) {
    if (!this.THREE) return;
    const T = this.THREE;
    // Texture canvas radial (soft glow)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0,   'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 200, 255, 0.85)');
      grad.addColorStop(0.7, 'rgba(155, 108, 255, 0.35)');
      grad.addColorStop(1,   'rgba(155, 108, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;

    // Pool de particules — positions + couleurs RGB par vertex
    const positions = new Float32Array(this.PARTICLE_COUNT * 3);
    const colors = new Float32Array(this.PARTICLE_COUNT * 3);
    this.particleData = [];
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      this.particleData.push({
        lifeRemaining: Math.random() * 1.5,  // staggered pour ne pas tout spawner d'un coup
        velocity: this.randomParticleVelocity(spawnRadius),
      });
      positions[i * 3]     = center.x;
      positions[i * 3 + 1] = center.y;
      positions[i * 3 + 2] = center.z;
      // CrystalEnergyEmitter : r=0.8, g=random, b=1
      colors[i * 3]     = 0.8;
      colors[i * 3 + 1] = Math.random();
      colors[i * 3 + 2] = 1.0;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      map: tex,
      size: spawnRadius * 0.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1,
      blending: T.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });
    this.crystalParticles = new T.Points(geo, mat);
    this.scene.add(this.crystalParticles);
  }

  /** Vélocité aléatoire : direction sphérique uniforme, légère préférence vers le haut */
  private randomParticleVelocity(spawnRadius: number): any {
    const T = this.THREE;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 0.7);  // bias upward
    const speed = spawnRadius * (0.6 + Math.random() * 0.8);
    return new T.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.cos(phi) * speed * 1.3,                    // plus de boost vertical
      Math.sin(phi) * Math.sin(theta) * speed,
    );
  }

  /**
   * Met à jour les particules dans la loop : drift + fade + respawn quand vie épuisée.
   */
  private updateCrystalParticles(dt: number) {
    if (!this.crystalParticles || !this.crystal) return;
    const positions = this.crystalParticles.geometry.attributes.position.array as Float32Array;
    const colors = this.crystalParticles.geometry.attributes.color.array as Float32Array;
    const cx = this.crystal.position.x;
    const cy = this.crystal.position.y;
    const cz = this.crystal.position.z;
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const data = this.particleData[i];
      data.lifeRemaining -= dt;
      if (data.lifeRemaining <= 0) {
        // Respawn au centre du cristal avec nouvelle vélocité + nouvelle couleur green random
        positions[i * 3]     = cx;
        positions[i * 3 + 1] = cy;
        positions[i * 3 + 2] = cz;
        data.velocity = this.randomParticleVelocity(0.4);
        data.lifeRemaining = 1.0 + Math.random() * 0.8;
        colors[i * 3 + 1] = Math.random();
      } else {
        positions[i * 3]     += data.velocity.x * dt;
        positions[i * 3 + 1] += data.velocity.y * dt;
        positions[i * 3 + 2] += data.velocity.z * dt;
        // Drag (ralentit progressivement)
        data.velocity.multiplyScalar(0.97);
      }
    }
    this.crystalParticles.geometry.attributes.position.needsUpdate = true;
    this.crystalParticles.geometry.attributes.color.needsUpdate = true;
  }

  /**
   * Setup raycaster sur le canvas. Au clic, trouve la planète touchée et émet @Output() planetClick.
   * Deux passes :
   *   1) Intersection précise (rayon vs geometry)
   *   2) Fallback : distance min entre rayon et centre du planet (+ tolérance liée à sa taille)
   */
  private setupClickHandler() {
    if (!this.THREE || this.clickHandler) return;
    const T = this.THREE;
    this.raycaster = new T.Raycaster();
    this.mouseNDC = new T.Vector2();
    const canvas = this.canvasEl.nativeElement;
    this.clickHandler = (event: MouseEvent) => {
      if (!this.camera || !this.scene) return;
      const rect = canvas.getBoundingClientRect();
      this.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);

      // ═══ PRIORITÉ 1 : click sur mini-cristal → emit ticket info ═══
      if (this.crystalMiniInstances.length > 0) {
        const miniTargets = this.crystalMiniInstances
          .filter(m => !m.fused && m.mesh.visible)
          .map(m => m.mesh);
        if (miniTargets.length > 0) {
          const miniHits = this.raycaster.intersectObjects(miniTargets, true);
          if (miniHits.length > 0) {
            const hitMesh = miniHits[0].object;
            const mini = this.crystalMiniInstances.find(m =>
              m.mesh === hitMesh || this.isDescendant(hitMesh, m.mesh));
            if (mini) {
              const idx = this.crystalMiniInstances.indexOf(mini);
              console.log('[Orrery] 💎 Mini-crystal hit — ticket:', mini.ticket.title);
              this.planetClick.emit({ ticket: mini.ticket, pairIndex: idx });
              return;
            }
          }
        }
      }
      // ═══ PRIORITÉ 2 : click sur Ruby central (ou cristal entier) → explode/reform ═══
      if (this.crystal) {
        const crystalTargets: any[] = [];
        if (this.crystalRuby?.visible) crystalTargets.push(this.crystalRuby);
        this.crystalSmashItems.forEach(it => { if (it.mesh.visible) crystalTargets.push(it.mesh); });
        if (crystalTargets.length > 0) {
          const crystalHits = this.raycaster.intersectObjects(crystalTargets, true);
          if (crystalHits.length > 0) {
            console.log('[Orrery] 💎 Crystal hit — state:', this.crystalState);
            if (this.crystalState === 'WHOLE') this.explodeCrystal();
            else if (this.crystalState === 'BROKEN') this.reformCrystal();
            return;
          }
        }
      }

      const intersects = this.raycaster.intersectObjects(this.planetMeshes, true);
      console.log('[Orrery] 🖱 click — NDC', this.mouseNDC.x.toFixed(2), this.mouseNDC.y.toFixed(2),
                  '| planets in pool:', this.planetMeshes.length,
                  '| direct intersects:', intersects.length);
      let pairIndex = -1;
      let hitInfo = '';
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        pairIndex = this.planetSupportPairs.findIndex(p =>
          p.planet === hit || this.isDescendant(hit, p.planet),
        );
        hitInfo = 'direct';
      } else {
        // FALLBACK : distance entre rayon et centre de chaque planète
        let nearestDist = Infinity;
        let nearestIndex = -1;
        const wp = new T.Vector3();
        this.planetSupportPairs.forEach((pair, i) => {
          pair.planet.getWorldPosition(wp);
          const d = this.raycaster.ray.distanceToPoint(wp);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIndex = i;
          }
        });
        // Tolérance = ~2 unités (taille typique d'une planète après scale du modèle)
        if (nearestIndex >= 0 && nearestDist < 2.0) {
          pairIndex = nearestIndex;
          hitInfo = `fallback dist=${nearestDist.toFixed(2)}`;
        } else {
          console.log('[Orrery] click missed — nearest planet at dist', nearestDist.toFixed(2), '(threshold 2.0)');
        }
      }
      if (pairIndex >= 0) {
        const ticket = this.tickets[pairIndex] || null;
        console.log('[Orrery] ✅ Hit pair', pairIndex, `(${hitInfo})`, '→ ticket:', ticket?.title || '(none)');
        this.planetClick.emit({ ticket, pairIndex });
      }
    };
    canvas.addEventListener('click', this.clickHandler);
    // Force pointer-events sur le canvas (et sur le host parent pour être sûr)
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'pointer';
    // Force le parent host à laisser passer les clics au canvas (mais autoriser le canvas seulement)
    const hostElement = canvas.closest('cosmos-orrery') as HTMLElement;
    if (hostElement) {
      hostElement.style.pointerEvents = 'none';
    }
    console.log('[Orrery] 🖱 Click handler installed. Planets pool size:', this.planetMeshes.length);
  }

  private isDescendant(child: any, parent: any): boolean {
    let p = child;
    while (p) {
      if (p === parent) return true;
      p = p.parent;
    }
    return false;
  }

  /**
   * Teinte un mesh avec une couleur donnée. Garde le matériel d'origine en cache.
   * @param mesh        le mesh THREE.Mesh
   * @param colorHex    hex string ("#aabbcc")
   * @param emissive    intensité emissive (0 = pas de glow, 1 = très brillant)
   * @param metallic    si true, garde un look métallique (pour les supports)
   */
  private tintMesh(mesh: any, colorHex: string, emissive = 0.3, metallic = false) {
    if (!mesh || !this.THREE) return;
    const T = this.THREE;
    // Clone le matériau au premier touch (sinon plusieurs meshes partageant le mat se teintent ensemble)
    if (!this.originalMaterials.has(mesh)) {
      this.originalMaterials.set(mesh, mesh.material);
      try { mesh.material = mesh.material.clone(); } catch {}
    }
    const mat = mesh.material;
    if (!mat) return;
    const col = new T.Color(colorHex);
    if (mat.color) mat.color.copy(col);
    if (mat.emissive) {
      mat.emissive.copy(col).multiplyScalar(emissive);
      if ('emissiveIntensity' in mat) mat.emissiveIntensity = emissive;
    }
    if (metallic) {
      if ('metalness' in mat) mat.metalness = 0.85;
      if ('roughness' in mat) mat.roughness = 0.3;
    }
    mat.needsUpdate = true;
  }

  /**
   * Mappe les tickets sur les paires (planet+support).
   *   Mode RING (anneaux détectés + tickets datés) :
   *     Bucket les tickets par date → planet[i] reçoit le 1er ticket du bucket[i].
   *   Mode INDEX (fallback) :
   *     planet[i] reçoit tickets[i] (ordre brut).
   */
  private applyTicketsToPlanets() {
    if (!this.THREE || this.planetSupportPairs.length === 0) return;
    const pairs = this.planetSupportPairs;
    const tickets = this.tickets || [];

    // Décision du mode : ring-based si on a des anneaux ET au moins un ticket daté
    const hasRings = this.ringMeshes.length > 0;
    const hasDates = tickets.some(t => !!t.date);
    const ringMode = hasRings && hasDates;

    let chosenPerPair: (OrreryTicket | undefined)[];
    if (ringMode) {
      // Bucket tickets par anneau, puis assigne pair[i] = 1er ticket du bucket dont
      // l'index correspond le mieux à la position radiale de la planète.
      const N = this.ringMeshes.length;
      const buckets = this.bucketTicketsByRing();
      // Distance radiale de chaque pair planète au centre, normalisée [0..1]
      const dists = pairs.map(p => {
        const wp = new this.THREE.Vector3();
        p.planet.getWorldPosition(wp);
        return wp.length();
      });
      const minD = Math.min(...dists, 0);
      const maxD = Math.max(...dists, 1);
      const range = Math.max(0.001, maxD - minD);
      chosenPerPair = pairs.map((_, i) => {
        // Map la position radiale du planet[i] vers un index de ring [0..N-1]
        const ratio = (dists[i] - minD) / range;
        const ringIdx = Math.min(N - 1, Math.max(0, Math.floor(ratio * N)));
        return buckets[ringIdx]?.[0];
      });
      console.log('[Orrery] 🎫 Ring-mode mapping —', N, 'anneaux, tickets bucketés par date');
    } else {
      // Mode index brut
      chosenPerPair = pairs.map((_, i) => tickets[i]);
      console.log('[Orrery] 🎫 Index-mode mapping —', tickets.length, 'tickets en ordre brut');
    }

    pairs.forEach((pair, i) => {
      const ticket = chosenPerPair[i];
      const visible = ticket?.visible !== false;

      if (ticket) {
        // Planète prend la couleur du ticket avec un glow doux
        const color = ticket.color || '#a3b8d0';
        this.tintMesh(pair.planet, color, 0.45, false);
        // Support : on NE TOUCHE PAS le matériau natif (laisser le métal du GLB)
        // → préserve l'éclairage de la pièce. Le mapping s'opère uniquement via la planète.
        const sp = Math.max(1, Math.min(13, ticket.storyPoints || 3));
        const scaleFactor = 0.7 + (sp / 13) * 0.6;
        pair.planet.scale.set(scaleFactor, scaleFactor, scaleFactor);
      } else {
        // Pas de ticket : restore matériau d'origine (si on avait teinté précédemment)
        this.restoreOriginalMaterial(pair.planet);
        pair.planet.scale.set(1, 1, 1);
      }

      pair.planet.visible = visible;
      if (pair.support) pair.support.visible = visible;
    });
  }

  /** Restaure le matériau d'origine d'un mesh (si on l'avait remplacé via tintMesh) */
  private restoreOriginalMaterial(mesh: any) {
    if (!mesh) return;
    const orig = this.originalMaterials.get(mesh);
    if (orig && mesh.material !== orig) {
      try { mesh.material.dispose(); } catch {}
      mesh.material = orig;
      this.originalMaterials.delete(mesh);
    }
  }

  /** Assombrit une couleur hex (mix avec noir) */
  private darkenColor(hex: string, factor: number): string {
    const c = parseInt(hex.replace('#', ''), 16);
    const r = Math.floor(((c >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((c >> 8) & 0xff) * (1 - factor));
    const b = Math.floor((c & 0xff) * (1 - factor));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

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
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(0, 8, 18);
    this.camera.lookAt(0, 0, 0);

    // Lighting cinema doux (le GLB peut avoir ses propres matériaux PBR)
    const amb = new T.AmbientLight(0xffffff, 1.2);
    this.scene.add(amb);
    const key = new T.DirectionalLight(0xffeedd, 1.4);
    key.position.set(5, 8, 5);
    this.scene.add(key);
    const fill = new T.DirectionalLight(0x88aaff, 0.6);
    fill.position.set(-5, -2, 5);
    this.scene.add(fill);

    // Stars background
    const starGeo = new T.BufferGeometry();
    const starPos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const r = 80 + Math.random() * 120;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      starPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
      starPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      starPos[i * 3 + 2] = r * Math.cos(p);
    }
    starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    const stars = new T.Points(starGeo, new T.PointsMaterial({
      color: 0xffffff, size: 0.4, sizeAttenuation: true,
      transparent: true, opacity: 0.75,
    }));
    this.scene.add(stars);

    this.clock = new T.Clock();
  }

  private loadModel(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.GLTFLoader) {
        this.loadFailed = true;
        resolve();
        return;
      }
      const loader = new this.GLTFLoader();
      if (this.DRACOLoader) {
        try {
          const draco = new this.DRACOLoader();
          draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
          loader.setDRACOLoader(draco);
        } catch {}
      }
      loader.load(
        this.glbUrl,
        (gltf: any) => {
          this.model = gltf.scene;
          this.scene.add(this.model);

          // Auto-fit le modèle
          const box = new this.THREE.Box3().setFromObject(this.model);
          const size = box.getSize(new this.THREE.Vector3());
          const center = box.getCenter(new this.THREE.Vector3());
          this.model.position.x -= center.x;
          this.model.position.y -= center.y;
          this.model.position.z -= center.z;
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const ratio = 12 / maxDim;
            this.model.scale.multiplyScalar(ratio);
          }

          // ═══ DUMP COMPLET : hiérarchie + animations + tracks ═══
          this.dumpModelInfo(gltf);

          // AnimationMixer pour jouer les anims natives
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new this.THREE.AnimationMixer(this.model);
            // Velocity-driven : 30 SP = vitesse normale, 60 SP = 2x plus rapide
            const v = this.projectVelocity ?? 30;
            const speedFromVelocity = Math.max(0.2, Math.min(3, v / 30));
            this.mixer.timeScale = (this.animSpeed || 1) * speedFromVelocity;
            gltf.animations.forEach((clip: any) => {
              const action = this.mixer.clipAction(clip);
              action.setLoop(this.THREE.LoopRepeat, Infinity);
              action.play();
            });
            this.debugInfo = `✓ ${gltf.animations.length} anim(s) playing`;
            console.log('[Orrery] ✓ Loaded with', gltf.animations.length, 'animations, timeScale:', this.mixer.timeScale.toFixed(2));
          } else {
            this.debugInfo = '✓ Loaded (no native animations)';
            console.log('[Orrery] ✓ Loaded (no native animations)');
          }

          // ═══ ANALYSE MÉCANIQUE : sun / planets / supports / static ═══
          this.analyzeStructure();
          this.applySunColor();
          this.applyTicketsToPlanets();
          // ═══ CRISTAL : remplace le soleil du GLB ═══
          this.loadCrystalReplacement();
          // ═══ CLICK : raycaster sur planètes ═══
          this.setupClickHandler();

          resolve();
        },
        undefined,
        (err: any) => {
          console.error('[Orrery] Failed to load orrery.glb:', err);
          this.loadFailed = true;
          resolve();
        },
      );
    });
  }

  /**
   * ═══ ANALYSE MÉCANIQUE du GLB ═══
   *
   * Walk tous les meshes, mesure géo + position monde, et classe :
   *   - SUN      = mesh sphérique le + central (aspect~1 + dist~0 + gros volume)
   *   - PLANET   = mesh sphérique en orbite (aspect~1, dist > seuil)
   *   - SUPPORT  = mesh elongé/rod (aspect > 2, typiquement les bras métalliques)
   *   - STATIC   = autres (base, socle, déco)
   *
   * Puis pair chaque PLANET avec son SUPPORT le + proche (par distance world).
   * Stocke les résultats dans this.sunMesh / planetMeshes / supportMeshes / planetSupportPairs.
   * Expose aussi `window.orreryAnalysis` pour debug.
   */
  private analyzeStructure() {
    if (!this.model || !this.THREE) return;
    const T = this.THREE;

    // 1. Collecte mesures par mesh
    interface MeshInfo {
      mesh: any;
      name: string;
      worldPos: any;
      distFromOrigin: number;
      size: any;          // Vector3 dims
      maxDim: number;
      midDim: number;
      minDim: number;
      volume: number;
      aspect: number;     // maxDim/minDim — élevé = elongé
      isSphereLike: boolean;
      isRingLike: boolean;
      isCentered: boolean;
      role: MeshRole;
    }
    const infos: MeshInfo[] = [];

    this.model.updateMatrixWorld(true);
    this.model.traverse((obj: any) => {
      if (!obj.isMesh || !obj.geometry) return;
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      const bb = obj.geometry.boundingBox;
      const size = bb ? bb.getSize(new T.Vector3()) : new T.Vector3(1, 1, 1);
      // Applique le scale world pour avoir des dims réelles dans la scène
      const worldScale = new T.Vector3();
      obj.getWorldScale(worldScale);
      const sx = Math.abs(size.x * worldScale.x);
      const sy = Math.abs(size.y * worldScale.y);
      const sz = Math.abs(size.z * worldScale.z);
      const sortedDims = [sx, sy, sz].sort((a, b) => a - b);
      const minDim = sortedDims[0] || 0.001;
      const midDim = sortedDims[1] || 0.001;
      const maxDim = sortedDims[2] || 0.001;
      const volume = sx * sy * sz;
      const aspect = maxDim / minDim;
      const worldPos = new T.Vector3();
      obj.getWorldPosition(worldPos);
      const distFromOrigin = worldPos.length();
      // Sphère-like : les 3 dims sont proches (aspect <= 2)
      const isSphereLike = aspect <= 2.0;
      // Ring-like (anneau plat) : 2 grandes dims équivalentes + 1 petite (épaisseur)
      //   maxDim ≈ midDim (ratio < 1.3) ET minDim << midDim (ratio < 0.3) ET radius significatif
      const isRingLike =
        (maxDim / midDim) < 1.35 &&
        (minDim / midDim) < 0.35 &&
        midDim > 0.5;
      // Centered : très proche de l'origine (typiquement quelques % du modèle entier)
      const isCentered = distFromOrigin < 1.5;
      infos.push({
        mesh: obj, name: obj.name || '(unnamed)',
        worldPos, distFromOrigin,
        size: new T.Vector3(sx, sy, sz), maxDim, midDim, minDim, volume, aspect,
        isSphereLike, isRingLike, isCentered,
        role: 'static',
      });
    });

    // 2. Classification
    // SUN = sphère-like centrée la + grosse (et pas un anneau qui par coïncidence serait sphère-like)
    const sunCandidates = infos
      .filter(i => i.isSphereLike && i.isCentered && !i.isRingLike)
      .sort((a, b) => b.volume - a.volume);
    const sunInfo = sunCandidates[0] || null;
    if (sunInfo) sunInfo.role = 'sun';

    // RINGS = anneaux orbitaux (plats, deux dims équivalentes + une fine)
    //         triés par radius (max dim / 2) : inner → outer
    const ringInfos = infos
      .filter(i => i.isRingLike && i !== sunInfo)
      .sort((a, b) => a.maxDim - b.maxDim);
    ringInfos.forEach(r => r.role = 'ring');

    // PLANETS = sphère-like + non-centré + PAS un anneau, triés par dist (inner → outer)
    const planetInfos = infos
      .filter(i => i.isSphereLike && !i.isCentered && !i.isRingLike && i !== sunInfo)
      .sort((a, b) => a.distFromOrigin - b.distFromOrigin);
    planetInfos.forEach(p => p.role = 'planet');

    // SUPPORTS = elongated + PAS un anneau (déjà classés)
    const supportInfos = infos
      .filter(i => !i.isSphereLike && !i.isRingLike && i.aspect > 2.0)
      .sort((a, b) => a.distFromOrigin - b.distFromOrigin);
    supportInfos.forEach(s => s.role = 'support');

    // 3. Pairing planet ↔ support le + proche
    const pairs: Array<{ planet: any; support: any | null }> = [];
    const usedSupports = new Set<any>();
    planetInfos.forEach(p => {
      let nearest: MeshInfo | null = null;
      let nearestDist = Infinity;
      for (const s of supportInfos) {
        if (usedSupports.has(s)) continue;
        const d = p.worldPos.distanceTo(s.worldPos);
        if (d < nearestDist) {
          nearest = s;
          nearestDist = d;
        }
      }
      if (nearest) usedSupports.add(nearest);
      pairs.push({ planet: p.mesh, support: nearest?.mesh || null });
    });

    // 4. Stockage
    this.sunMesh = sunInfo?.mesh || null;
    this.planetMeshes = planetInfos.map(p => p.mesh);
    this.supportMeshes = supportInfos.map(s => s.mesh);
    this.ringMeshes = ringInfos.map(r => r.mesh);
    this.staticMeshes = infos.filter(i => i.role === 'static').map(i => i.mesh);
    this.planetSupportPairs = pairs;

    // 5. Log + expose
    const N = this.ringMeshes.length;
    const segmentLabel = N === 12 ? 'mois' : N === 4 ? 'trimestres' : N === 52 ? 'semaines' : N === 24 ? 'demi-mois' : `${N} segments`;
    console.log('═══════════════════════════════════════════════');
    console.log('[Orrery] 🔬 ANALYSE MÉCANIQUE');
    console.log('═══════════════════════════════════════════════');
    console.log('  ☀ SUN     :', sunInfo ? `${sunInfo.name} (vol=${sunInfo.volume.toFixed(2)}, dist=${sunInfo.distFromOrigin.toFixed(2)})` : 'NONE');
    console.log('  🪐 PLANETS  :', planetInfos.length);
    console.log('  🔩 SUPPORTS :', supportInfos.length);
    console.log('  💍 RINGS    :', ringInfos.length, `→ année divisée en ${segmentLabel}`);
    console.log('  📦 STATIC   :', this.staticMeshes.length);
    console.log('  🔗 PAIRS    :', pairs.length, '(planet ↔ support)');
    console.table(infos.map(i => ({
      name: i.name,
      role: i.role,
      dist: +i.distFromOrigin.toFixed(2),
      vol: +i.volume.toFixed(2),
      aspect: +i.aspect.toFixed(2),
      dims: `${i.size.x.toFixed(1)}×${i.size.y.toFixed(1)}×${i.size.z.toFixed(1)}`,
    })));
    console.log('═══════════════════════════════════════════════');
    console.log('[Orrery] 💡 Besoin :', this.tickets.length, 'tickets → On a', pairs.length, 'paires planet+support');
    if (this.tickets.length > pairs.length) {
      console.warn('[Orrery] ⚠ Plus de tickets que de planètes dans le GLB.', (this.tickets.length - pairs.length), 'tickets ignorés.');
    } else if (pairs.length > this.tickets.length) {
      console.log('[Orrery] ℹ', (pairs.length - this.tickets.length), 'planète(s) en plus → couleur neutre.');
    }
    if (N > 0) {
      // Distribution des tickets par segment de l'année (basée sur ticket.date)
      const buckets = this.bucketTicketsByRing();
      console.log('[Orrery] 📅 Distribution tickets par anneau (segment d\'année) :');
      console.table(buckets.map((b, i) => ({
        ring: `R${i}`,
        segment: this.segmentLabel(i, N),
        ticketCount: b.length,
        sample: b.slice(0, 3).map(t => t.title || t.id).join(', '),
      })));
    }
    (window as any).orreryAnalysis = {
      sun: this.sunMesh,
      planets: this.planetMeshes,
      supports: this.supportMeshes,
      rings: this.ringMeshes,
      pairs,
      static: this.staticMeshes,
      allInfos: infos,
      yearSegments: N,
    };
  }

  /**
   * Range les tickets par anneau selon leur date (segment de l'année 0..N-1).
   * - Si pas de date → segment 0 par défaut.
   * - segment = floor((dayOfYear / 365.25) * N)
   * Retourne un tableau de N buckets.
   */
  private bucketTicketsByRing(): OrreryTicket[][] {
    const N = this.ringMeshes.length;
    if (N <= 0) return [];
    const buckets: OrreryTicket[][] = Array.from({ length: N }, () => []);
    for (const t of this.tickets || []) {
      const idx = this.dateToRingIndex(t.date, N);
      buckets[idx].push(t);
    }
    return buckets;
  }

  /** Convertit une date en index d'anneau [0..N-1] selon le jour de l'année. */
  private dateToRingIndex(date: Date | string | undefined, N: number): number {
    if (!date || N <= 0) return 0;
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return 0;
    // Jour de l'année (0..365)
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = (d.getTime() - start.getTime()) / 86400000;
    const fraction = Math.max(0, Math.min(1, diff / 365.25));
    return Math.min(N - 1, Math.floor(fraction * N));
  }

  /** Label humain pour un segment (ex: "Janvier" si N=12, "Q1" si N=4, etc.) */
  private segmentLabel(index: number, N: number): string {
    if (N === 12) {
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      return months[index] || `M${index + 1}`;
    }
    if (N === 4) return `Q${index + 1}`;
    if (N === 52) return `S${index + 1}`;
    // Fallback : range de jours
    const startDay = Math.floor((index / N) * 365);
    const endDay = Math.floor(((index + 1) / N) * 365);
    return `J${startDay}-${endDay}`;
  }

  /**
   * Patch le matériau de la grande sphère (= le dôme étoilé bleu) pour qu'elle prenne
   * une couleur unie. Si bigSphereSolidColor === 'auto', extrait la couleur dorée
   * déjà présente dans le GLB (rings/supports). Sinon utilise la valeur hex passée.
   */
  private patchBigSphereMaterial() {
    if (!this.model || !this.THREE || !this.bigSphereSolidColor) return;
    const T = this.THREE;
    // 1. Trouve la grande sphère = le mesh texturé le + volumineux du GLB
    const candidates: Array<{ mesh: any; volume: number; name: string }> = [];
    this.model.traverse((obj: any) => {
      if (!obj.isMesh || !obj.geometry || !obj.material) return;
      if (!obj.material.map) return;  // skip les non-texturés
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      const size = obj.geometry.boundingBox.getSize(new T.Vector3());
      const volume = Math.abs(size.x * size.y * size.z);
      candidates.push({ mesh: obj, volume, name: obj.name || '(unnamed)' });
    });
    if (candidates.length === 0) {
      console.log('[Orrery] 🟡 Aucun mesh texturé → skip patch dôme');
      return;
    }
    candidates.sort((a, b) => b.volume - a.volume);
    const dome = candidates[0].mesh;
    console.log('[Orrery] 🟡 Grande sphère détectée:', candidates[0].name, 'volume:', candidates[0].volume.toFixed(2));

    // 2. Détermine la couleur finale
    let finalColor: any;
    if (this.bigSphereSolidColor === 'auto') {
      // Extrait la couleur dorée native d'un mesh non-texturé warm-toned (R > G > B, R > 0.5)
      let goldHex = '#d4a017';  // fallback générique
      let found = false;
      this.model.traverse((obj: any) => {
        if (found) return;
        if (!obj.isMesh || !obj.material || !obj.material.color) return;
        if (obj.material.map) return;
        if (obj === dome) return;
        const c = obj.material.color;
        // Critère doré : rouge dominant, vert moyen, bleu faible
        if (c.r > 0.5 && c.g > 0.3 && c.r > c.g && c.g > c.b && c.b < 0.4) {
          finalColor = c.clone();
          goldHex = '#' + c.getHexString();
          found = true;
        }
      });
      if (!found) {
        finalColor = new T.Color(goldHex);
        console.log('[Orrery] 🟡 Pas de doré natif trouvé → fallback', goldHex);
      } else {
        console.log('[Orrery] 🟡 Couleur dorée extraite du GLB:', goldHex);
      }
    } else {
      finalColor = new T.Color(this.bigSphereSolidColor);
      console.log('[Orrery] 🟡 Couleur custom:', this.bigSphereSolidColor);
    }

    // 3. Remplace le matériau par un MeshStandardMaterial uniforme
    //    DoubleSide → fonctionne que la dome soit vue de l'intérieur ou de l'extérieur
    const newMat = new T.MeshStandardMaterial({
      color: finalColor,
      roughness: 0.7,
      metalness: 0.2,
      side: T.DoubleSide,
    });
    try { dome.material.dispose(); } catch {}
    dome.material = newMat;
    console.log('[Orrery] 🟡 Dôme étoilé → couleur dorée uniforme appliquée ✓');
  }

  /** Dump COMPLET du modèle pour qu'on identifie les nodes (planètes/orbites/soleil) */
  private dumpModelInfo(gltf: any) {
    console.log('═══════════════════════════════════════════════');
    console.log('[Orrery] 🌍 GLB STRUCTURE — pour identifier les nodes');
    console.log('═══════════════════════════════════════════════');

    // 1. Hiérarchie complète des objets
    const nodes: { name: string; type: string; depth: number; pos: any; scale: any }[] = [];
    const walk = (obj: any, depth = 0) => {
      nodes.push({
        name: obj.name || '(unnamed)',
        type: obj.type,
        depth,
        pos: `(${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`,
        scale: `(${obj.scale.x.toFixed(2)}, ${obj.scale.y.toFixed(2)}, ${obj.scale.z.toFixed(2)})`,
      });
      obj.children.forEach((c: any) => walk(c, depth + 1));
    };
    walk(this.model);
    console.log('🌳 HIÉRARCHIE (', nodes.length, 'nodes):');
    console.table(nodes);

    // 2. Liste des animations + leurs tracks
    if (gltf.animations && gltf.animations.length > 0) {
      console.log('\n🎬 ANIMATIONS (', gltf.animations.length, '):');
      gltf.animations.forEach((clip: any, i: number) => {
        console.log(`  [${i}] "${clip.name}" — duration ${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks`);
        // Print track NAMES en clair (pour identifier les nodes animés)
        const trackNames = clip.tracks.map((t: any) => t.name);
        console.log('    🎯 TRACK NAMES (les nodes animés) :');
        trackNames.forEach((n: string, idx: number) => console.log(`      [${idx}] ${n}`));
        // Aussi en JSON pour copy-paste facile
        console.log('    📋 JSON :', JSON.stringify(trackNames, null, 2));
      });
    }

    // 4. Liste des nodes ROOT du modèle (probablement les "pivots" des planètes)
    console.log('\n🪐 NODES RACINE du modèle (probables pivots de planètes) :');
    const rootNodes = this.model.children.map((c: any, i: number) => `[${i}] ${c.name} (${c.type})`);
    rootNodes.forEach((n: string) => console.log('  ' + n));

    // 5. EXPOSE gltf au global window pour debug en console
    (window as any).orreryGltf = gltf;
    (window as any).orreryModel = this.model;
    console.log('\n💡 DEBUG : tu peux taper en console :');
    console.log('   • orreryGltf.animations[0].tracks.map(t => t.name)  → liste des targets');
    console.log('   • orreryModel.children.map(c => c.name)             → liste des racines');
    console.log('   • orreryModel.getObjectByName("NomDuNode")          → accès direct');

    // 3. Liste des meshes uniques (pour matériaux)
    const meshes: any[] = [];
    this.model.traverse((obj: any) => {
      if (obj.isMesh) {
        meshes.push({
          name: obj.name,
          material: obj.material?.type,
          color: obj.material?.color?.getHexString?.() || 'n/a',
          emissive: obj.material?.emissive?.getHexString?.() || 'n/a',
        });
      }
    });
    console.log('\n🎨 MESHES (', meshes.length, '):');
    console.table(meshes);

    console.log('═══════════════════════════════════════════════');
  }

  // Caméra cinéma : 6 poses qui survolent l'orrery
  private readonly cameraPoses: Array<{ pos: [number, number, number]; look: [number, number, number] }> = [
    { pos: [0,   8, 18], look: [0, 0, 0] },     // wide front
    { pos: [12,  6, 14], look: [0, 0, 0] },     // right
    { pos: [-12, 6, 14], look: [0, 0, 0] },     // left
    { pos: [0,  20, 5],  look: [0, 0, 0] },     // top-down
    { pos: [10, 3, -10], look: [0, 0, 0] },     // back-right
    { pos: [0,   1, 22], look: [0, 0, 0] },     // low-front
  ];

  private startCameraTour() {
    const T = this.THREE;
    const cycle = () => {
      const pose = this.cameraPoses[Math.floor(Math.random() * this.cameraPoses.length)];
      this.cameraTargetPos = new T.Vector3(pose.pos[0], pose.pos[1], pose.pos[2]);
      this.cameraTargetLook = new T.Vector3(pose.look[0], pose.look[1], pose.look[2]);
      const next = 6000 + Math.random() * 3000;
      this.cameraTimer = setTimeout(cycle, next);
    };
    this.cameraTimer = setTimeout(cycle, 2000);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const dt = this.clock.getDelta();
      const t = this.clock.getElapsedTime();
      if (this.mixer) this.mixer.update(dt);
      // Update tweens (explode/reform animations)
      this.updateTweens(dt);
      // Cristal : bobbing + rotation lente en WHOLE ou ORBITING (le bobbing reste léger)
      if (this.crystal) {
        if (this.crystalState === 'WHOLE') {
          this.crystal.position.y = this.crystalBaseY + Math.sin(t * 1.2) * 0.08;
          this.crystal.rotation.y = t * 0.4;
        } else if (this.crystalState === 'ORBITING') {
          // Bobbing réduit (les groupes orbitent autour, pas trop de mouvement parent)
          this.crystal.position.y = this.crystalBaseY + Math.sin(t * 0.8) * 0.03;
        }
        // La glow light suit le cristal (toujours)
        if (this.crystalGlow) {
          this.crystalGlow.position.copy(this.crystal.position);
          // Pulsation : forte si EXPLODING (flash), normale sinon
          if (this.crystalState === 'EXPLODING') {
            this.crystalGlow.intensity = 3.5;
          } else if (this.crystalState === 'BROKEN') {
            this.crystalGlow.intensity = 0.4 + Math.sin(t * 4) * 0.2;
          } else {
            this.crystalGlow.intensity = 1.0 + Math.sin(t * 2.5) * 0.25;
          }
        }
        // Spin des morceaux brisés (BROKEN state — classique)
        if (this.crystalBrokenSpin > 0 && this.crystalState === 'BROKEN') {
          const rotateFactor = 0.25;
          this.crystalSmashItems.forEach(it => {
            it.mesh.rotation.x += dt * it.random.x * rotateFactor * this.crystalBrokenSpin;
            it.mesh.rotation.y += dt * it.random.y * rotateFactor * this.crystalBrokenSpin;
            it.mesh.rotation.z += dt * it.random.z * rotateFactor * this.crystalBrokenSpin;
          });
        }
        // ═══ Orbital motion des MINI-CRISTAUX (ORBITING state) — en WORLD space ═══
        if (this.crystalState === 'ORBITING' && this.crystalMiniInstances.length > 0) {
          // Centre = position WORLD courante du crystal (suit son bobbing)
          const cx = this.crystal.position.x;
          const cy = this.crystal.position.y;
          const cz = this.crystal.position.z;
          this.crystalMiniInstances.forEach(m => {
            if (m.fused) return;
            // Skip si en cours de fusion (tween actif sur sa position ou scale)
            const isFusing = this.tweens.some(tw => tw.target === m.mesh.position || tw.target === m.mesh.scale);
            if (isFusing) return;
            const angle = m.orbit.basePhase + m.orbit.speed * t;
            // Position WORLD = centre du crystal + offset orbital
            m.mesh.position.x = cx + Math.cos(angle) * m.orbit.radius;
            m.mesh.position.z = cz + Math.sin(angle) * m.orbit.radius;
            m.mesh.position.y = cy + Math.sin(angle * 0.5) * m.orbit.radius * m.orbit.inclination;
            // Rotation propre du mini-cristal (vertical + autres axes pour vivacité)
            m.mesh.rotation.x += dt * m.spinSpeed.x;
            m.mesh.rotation.y += dt * m.spinSpeed.y;
            m.mesh.rotation.z += dt * m.spinSpeed.z;
            // Léger pulse de scale pour la respiration
            const breath = 1 + Math.sin(t * 1.5 + m.orbit.basePhase) * 0.08;
            m.mesh.scale.set(m.baseScale * breath, m.baseScale * breath, m.baseScale * breath);
          });
        }
        // Update particules (sauf en EXPLODING/BROKEN pour éviter conflit visuel)
        if (this.crystalState === 'WHOLE' || this.crystalState === 'REFORMING') {
          this.updateCrystalParticles(dt);
        }
      }
      // Camera smooth lerp
      this.camera.position.lerp(this.cameraTargetPos, 0.015);
      this.camera.lookAt(this.cameraTargetLook);
      // Resize check
      this.resizeIfNeeded();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private resizeIfNeeded() {
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== w * (window.devicePixelRatio || 1) ||
                            canvas.height !== h * (window.devicePixelRatio || 1))) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    this.THREE = (window as any).THREE;
    if (this.THREE && !(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    if (this.THREE && !(window as any).THREE?.DRACOLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
    }
    this.GLTFLoader = (window as any).THREE?.GLTFLoader;
    this.DRACOLoader = (window as any).THREE?.DRACOLoader;
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
