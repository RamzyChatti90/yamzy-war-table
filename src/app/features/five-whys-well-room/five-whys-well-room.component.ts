// ═══════════════════════════════════════════════════════════════════
// 🪨 FIVE WHYS WELL ROOM — Le Puits des Cinq Pourquoi
//
// Workshop : Root Cause Analysis (Toyota 5 Whys method)
// Méthode : descendre 5 niveaux (Pourquoi ?) pour atteindre la racine,
// pas le symptôme. Action correctrice gravée comme rune au fond.
//
// 3D :
//   - Puits cylindrique vertical creux (pierre grise, fog au fond)
//   - 6 plateformes empilées : niveau 0 (problème) → niveau 5 (racine)
//   - Chacune avec un texte canvas + une rune
//   - Niveau 0 (sommet) : problème rouge
//   - Niveau 5 (fond) : rocher de racine + rune dorée émissive
//   - Escalier en spirale qui descend
//   - Eaux ruisselantes des murs (particles cyan)
//   - Brume légère au fond
//   - Lueur magenta/bleu au fond
//
// Anim :
//   - Rune racine pulse fort (intensité émissive)
//   - Eaux tombent en continu
//   - Brume dérive
//
// Camera 45 FOV, position (10, 5, 12) lookAt (0, -10, 0)
// OrbitControls — maxDistance 30
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { playIslandIntro } from '../../core/island-intro/island-intro';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent } from '../../core/spell-ui';

// ─── Modèles métier ───
interface WhyLevel {
  level: number;              // 0 = problème, 1..5 = pourquoi
  question: string;           // "Pourquoi ?" prompt
  answer: string;             // réponse documentée
  isRoot: boolean;            // true pour niveau 5
}

@Component({
  selector: 'wt-five-whys-well-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fw-host">
      <header class="fw-topbar">
        <wt-spell-btn variant="back" size="sm" accent="#475569" [routerLink]="'/yamzy-island'" icon="←">Yamzy Island</wt-spell-btn>
        <div class="fw-title">
          <h1>🪨 Le Puits des Cinq Pourquoi</h1>
          <p>Root Cause Analysis · 5 niveaux pour atteindre la racine</p>
        </div>
        <div class="fw-actions">
          <wt-spell-btn variant="secondary" size="sm" accent="#475569" (click)="resetCamera()" icon="🎥">Reset cam</wt-spell-btn>
          <wt-spell-btn variant="primary" size="sm" accent="#475569" (click)="openTutorial()" icon="🎓" title="Visite guidée par Yamzy">How it works</wt-spell-btn>
          <wt-spell-btn variant="primary" size="sm" accent="#475569" (click)="narrator.startPlayExample()" icon="▶" title="Démo animée">Play example</wt-spell-btn>
        </div>
      </header>

      <canvas #canvas class="fw-canvas"></canvas>

      <!-- Sidebar : liste des 5 pourquoi -->
      <aside class="fw-sidebar">
        <div class="fw-side-title">⚙️ Descente vers la racine</div>
        <div *ngFor="let lvl of levels()" class="fw-level" [class.root]="lvl.isRoot" [class.problem]="lvl.level === 0">
          <div class="fw-level-head">
            <span class="fw-level-num">{{ lvl.level === 0 ? '🪨' : lvl.isRoot ? '🛡' : '❓' }}</span>
            <strong>{{ lvl.level === 0 ? 'PROBLÈME' : lvl.isRoot ? 'RACINE' : 'POURQUOI #' + lvl.level }}</strong>
          </div>
          <div class="fw-level-q" *ngIf="lvl.level > 0 && !lvl.isRoot">{{ lvl.question }}</div>
          <div class="fw-level-a">{{ lvl.answer }}</div>
        </div>
      </aside>

      <wt-narrator></wt-narrator>

      <div *ngIf="ceremonyFlash() as f" class="fw-flash">
        <div class="fw-flash-content">
          <div class="fw-flash-icon">{{ f.icon }}</div>
          <div class="fw-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- 🎬 Splash overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Five Whys Well"
        loreName="Le Puits des Cinq Pourquoi"
        color="#475569"
        oneLiner="Root cause Toyota : descendre 5 niveaux pour atteindre la racine."
        [duration]="70"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Five Whys Well"
        loreName="Le Puits des Cinq Pourquoi"
        accent="#475569"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; position: fixed; inset: 0; }
    .fw-host { position: relative; width: 100%; height: 100%; background: #0a0e18; color: #e2e8f0; font-family: system-ui, sans-serif; overflow: hidden; }
    .fw-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

    .fw-topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .fw-topbar > * { pointer-events: auto; }
    .fw-back { color: #94a3b8; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #475569; border-radius: 8px; background: rgba(15,23,42,0.7); }
    .fw-back:hover { background: rgba(71,85,105,0.5); }
    .fw-title h1 { margin: 0; font-size: 18px; font-weight: 700; color: #cbd5e1; text-shadow: 0 0 12px rgba(148,163,184,0.5); letter-spacing: 1px; }
    .fw-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.7; font-style: italic; }
    .fw-actions { margin-left: auto; display: flex; gap: 8px; }
    .fw-actions button { background: rgba(30,41,59,0.7); color: #cbd5e1; border: 1px solid #475569; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .fw-actions button:hover { background: rgba(71,85,105,0.5); }
    .fw-actions .fw-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .fw-actions .fw-narrator:hover { background: rgba(251,191,36,0.3); }
    .fw-actions .fw-narrator.fw-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .fw-actions .fw-narrator.fw-play:hover { background: #f5b923; }

    .fw-sidebar { position: absolute; right: 16px; top: 90px; bottom: 16px; width: 320px; overflow-y: auto; background: rgba(15,23,42,0.88); border: 1px solid rgba(148,163,184,0.3); border-radius: 14px; backdrop-filter: blur(12px); padding: 16px; z-index: 8; }
    .fw-side-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; }
    .fw-level { padding: 10px 12px; margin-bottom: 8px; background: rgba(30,41,59,0.5); border-left: 3px solid #475569; border-radius: 6px; font-size: 12px; }
    .fw-level.problem { border-left-color: #ef4444; background: rgba(127,29,29,0.25); }
    .fw-level.root { border-left-color: #fbbf24; background: rgba(120,53,15,0.3); box-shadow: 0 0 14px rgba(251,191,36,0.25); }
    .fw-level-head { display: flex; gap: 8px; margin-bottom: 4px; align-items: center; font-size: 11px; opacity: 0.9; }
    .fw-level-num { font-size: 13px; }
    .fw-level-q { font-style: italic; opacity: 0.65; margin-bottom: 4px; font-size: 11px; }
    .fw-level-a { color: #f1f5f9; line-height: 1.4; }

    .fw-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(251,191,36,0.5), transparent 60%); animation: fw-flash-pulse 1.6s ease-out forwards; }
    .fw-flash-content { text-align: center; animation: fw-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .fw-flash-icon { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(251,191,36,0.8)); }
    .fw-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.6); }
    @keyframes fw-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes fw-flash-grow { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }
  `]
})
export class FiveWhysWellRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  narrator = inject(NarratorService);
  private ceremonyBus = inject(CeremonyBusService);
  private router = inject(Router);

  levels = signal<WhyLevel[]>([
    { level: 0, question: '',                                                            answer: 'Le déploiement v1.4.0 a échoué en production le 03/06 à 18h.',         isRoot: false },
    { level: 1, question: 'Pourquoi le déploiement a-t-il échoué ?',                     answer: 'Le smoke test "auth-flow" est sorti rouge.',                            isRoot: false },
    { level: 2, question: 'Pourquoi le smoke test auth-flow a-t-il échoué ?',            answer: 'Le token JWT n\'était plus signé correctement.',                        isRoot: false },
    { level: 3, question: 'Pourquoi le token n\'était-il plus signé correctement ?',     answer: 'Le secret JWT_KEY a été rotaté la veille mais le pod n\'a pas reload.', isRoot: false },
    { level: 4, question: 'Pourquoi le pod n\'a-t-il pas reload après la rotation ?',    answer: 'Le SecretManager n\'envoie pas de webhook après rotation.',             isRoot: false },
    { level: 5, question: 'Pourquoi pas de webhook ? (RACINE)',                          answer: 'Action : configurer un Reloader Operator + alarme sur rotation.',       isRoot: true  },
  ]);

  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🪨', title: 'Au sommet, le problème observable', body: 'Niveau 0 est le symptôme visible : crash, bug, perte client. Souvent on s\'arrête là, ce qui est une erreur.' },
    { icon: '❓', title: 'Cinq fois "Pourquoi ?"', body: 'Pour chaque niveau, on se demande pourquoi. Chaque réponse devient le prochain "quoi", et on creuse plus profond.' },
    { icon: '🌀', title: 'Spirale descendante', body: 'L\'escalier en spirale du puits matérialise la descente. Plus vous descendez, plus la lumière du jour s\'estompe.' },
    { icon: '🛡', title: 'La racine est protégée', body: 'Au fond, niveau 5, vous trouvez la cause racine. Ce n\'est jamais "qui" mais "quoi" du système — la vraie source.' },
    { icon: 'ᚱ', title: 'Graver la rune corrective', body: 'L\'action corrective qui s\'attaque à la racine est gravée comme une rune dorée émissive. C\'est le livrable du workshop.' },
  ];
  tutorialVoiceLines: string[] = [
    'Au sommet du puits, le symptôme visible.',
    'Cinq fois pourquoi pour creuser plus profond.',
    'La spirale descend vers l\'obscurité.',
    'La racine est protégée tout au fond.',
    'Graver la rune corrective au fond du puits.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  // ─── Three.js core ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;
  private controls: any;
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;
  private elapsed = 0;
  private ceremonyFlashTimer: any = null;

  // ─── 3D refs ───
  private wellGroup: any = null;
  private platforms: any[] = [];                  // 6 plateformes
  private runes: any[] = [];                      // 6 runes (sur chaque plateforme)
  private rootRock: any = null;                   // rocher racine (fond)
  private rootRune: any = null;                   // rune dorée émissive
  private rootGlow: any = null;                   // point light dorée
  private bottomFogPlane: any = null;             // brume fond
  private waterParticles: any = null;             // eaux ruisselantes cyan
  private waterVelocities: Float32Array = new Float32Array(0);
  private spiralStairs: any = null;               // groupe escalier spirale
  private bottomGlowLight: any = null;            // light magenta au fond

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    window.removeEventListener('resize', this.onResize);
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    this.animate();

    // 🎬 Intro cinématique : vue d'oiseau qui zoom progressivement vers le puits
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 10, y: 5, z: 12 },
      { x: 0, y: -10, z: 0 },
      3.5,
    );
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

    // Scène + fog dense pour donner la profondeur du puits
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0a0e18);
    this.scene.fog = new T.FogExp2(0x0a0e18, 0.022);

    // Caméra à 45 FOV, position bird-eye initialement, lookAt vers le fond du puits
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(10, 5, 12);
    this.camera.lookAt(0, -10, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lumière ambiante froide (couloirs souterrains)
    this.scene.add(new T.AmbientLight(0x404858, 0.5));
    // Hémisphère : haut ciel-noir bleu / bas pierre sombre
    this.scene.add(new T.HemisphereLight(0x4f5a78, 0x141820, 0.45));
    // Lumière directionnelle douce d'en haut (lune dans le puits)
    const moonLight = new T.DirectionalLight(0xcbd5e1, 0.7);
    moonLight.position.set(2, 25, 4);
    this.scene.add(moonLight);

    // Sky universel (étoiles ornement, comme demandé starCount: 500)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 500, starRadius: 90,
      moonPos: [-12, 22, -22],
      auroraPos: [0, 26, -42],
      cometPos: [22, 24, -18],
      shootingStarCount: 4,
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'five-whys-well') return;   // anti-loop
      this.sky?.pulseCeremony(c.type);
    });

    // ═══ Construction du puits ═══
    this.buildWell(T);
    this.buildPlatforms(T);
    this.buildSpiralStairs(T);
    this.buildRootRock(T);
    this.buildBottomFog(T);
    this.buildWaterParticles(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, -10, 0);
      this.controls.maxDistance = 30;
      this.controls.minDistance = 4;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🪶 Narrator Yamzy
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'five-whys-well',
    });

    console.log('[FiveWhysWell] 🪨 Well ready · 6 levels, root rock illuminated');
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : puits cylindrique creux (la paroi de pierre)
  // ═══════════════════════════════════════════════════════════════════
  private buildWell(T: any) {
    this.wellGroup = new T.Group();

    // Paroi du puits : cylindre creux ouvert (utiliser un grand cylindre + materiel double-side)
    const wellRadius = 4;
    const wellDepth = 30;       // 0 → -30 en y
    const wallGeom = new T.CylinderGeometry(wellRadius, wellRadius, wellDepth, 32, 12, true);
    const wallMat = new T.MeshStandardMaterial({
      color: 0x3f4757, roughness: 0.95, metalness: 0.08,
      emissive: 0x141820, emissiveIntensity: 0.2,
      side: T.DoubleSide,
    });
    const wall = new T.Mesh(wallGeom, wallMat);
    wall.position.y = -wellDepth / 2 + 2;
    this.wellGroup.add(wall);

    // Sol du puits (fond)
    const floor = new T.Mesh(
      new T.CylinderGeometry(wellRadius, wellRadius, 0.4, 32),
      new T.MeshStandardMaterial({ color: 0x1a1e2a, roughness: 1.0, metalness: 0.05 }),
    );
    floor.position.y = -wellDepth + 2;
    this.wellGroup.add(floor);

    // Anneau de couronnement (le rebord du puits en haut)
    const topRing = new T.Mesh(
      new T.TorusGeometry(wellRadius + 0.15, 0.4, 12, 32),
      new T.MeshStandardMaterial({ color: 0x4d556a, roughness: 0.7, metalness: 0.25 }),
    );
    topRing.position.y = 2.1;
    topRing.rotation.x = Math.PI / 2;
    this.wellGroup.add(topRing);

    // Sol extérieur autour du puits
    const ground = new T.Mesh(
      new T.RingGeometry(wellRadius + 0.3, wellRadius + 12, 32),
      new T.MeshStandardMaterial({ color: 0x222632, roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 1.9;
    this.wellGroup.add(ground);

    this.scene.add(this.wellGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 6 plateformes circulaires empilées (niveaux 0..5)
  // y = 0, -5, -10, -15, -20, -25
  // ═══════════════════════════════════════════════════════════════════
  private buildPlatforms(T: any) {
    const Y = [0, -5, -10, -15, -20, -25];
    const levels = this.levels();
    for (let i = 0; i < 6; i++) {
      const lvl = levels[i];
      const y = Y[i];
      const isProblem = i === 0;
      const isRoot = i === 5;

      // Plateforme circulaire (légèrement excentrée pour escalier)
      const platGeom = new T.CylinderGeometry(1.7, 1.8, 0.25, 24);
      const platColor = isProblem ? 0x7f1d1d : isRoot ? 0x7c2d12 : 0x3a4458;
      const platMat = new T.MeshStandardMaterial({
        color: platColor,
        roughness: 0.85, metalness: 0.15,
        emissive: isProblem ? 0xef4444 : isRoot ? 0xfbbf24 : 0x1a1e2a,
        emissiveIntensity: isProblem ? 0.4 : isRoot ? 0.6 : 0.1,
      });
      const plat = new T.Mesh(platGeom, platMat);
      // Excentré côté opposé alternant pour spirale
      const angle = (i * Math.PI / 3) + 0.4;
      const offset = 1.6;
      plat.position.set(Math.cos(angle) * offset, y, Math.sin(angle) * offset);
      plat.userData = { kind: 'platform', level: i };
      if (i === 0) plat.userData.tutorialId = 'problem-platform';
      if (isRoot) plat.userData.tutorialId = 'root-platform';
      this.wellGroup.add(plat);
      this.platforms.push(plat);

      // Label canvas au-dessus de chaque plateforme
      const labelText = isProblem ? 'PROBLÈME' : isRoot ? 'RACINE' : 'POURQUOI ' + i;
      const labelColor = isProblem ? '#ef4444' : isRoot ? '#fbbf24' : '#94a3b8';
      const label = this.makeCanvasLabel(T, labelText, labelColor);
      label.position.copy(plat.position);
      label.position.y += 1.0;
      label.userData = { kind: 'label-billboard' };
      this.wellGroup.add(label);

      // Rune circulaire au centre de la plateforme (octahedron / torus pour symbolique)
      const runeColor = isProblem ? 0xef4444 : isRoot ? 0xfbbf24 : 0x94a3b8;
      const runeMat = new T.MeshStandardMaterial({
        color: runeColor, emissive: runeColor,
        emissiveIntensity: isRoot ? 1.8 : isProblem ? 1.0 : 0.5,
        roughness: 0.4, metalness: 0.6,
      });
      const runeGeom = isRoot
        ? new T.OctahedronGeometry(0.4, 0)
        : new T.TorusGeometry(0.35, 0.1, 8, 16);
      const rune = new T.Mesh(runeGeom, runeMat);
      rune.position.copy(plat.position);
      rune.position.y += 0.4;
      if (!isRoot) rune.rotation.x = Math.PI / 2;
      rune.userData = { kind: 'rune', basePhase: Math.random() * Math.PI * 2, isRoot };
      if (isRoot) this.rootRune = rune;
      this.wellGroup.add(rune);
      this.runes.push(rune);

      // Petit halo light si rune racine
      if (isRoot) {
        const glow = new T.PointLight(0xfbbf24, 2.2, 6, 1.5);
        glow.position.copy(rune.position);
        this.rootGlow = glow;
        this.wellGroup.add(glow);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : escalier en spirale qui relie les niveaux (chains procédural)
  // ═══════════════════════════════════════════════════════════════════
  private buildSpiralStairs(T: any) {
    this.spiralStairs = new T.Group();
    const stepCount = 50;        // total marches
    const totalDepth = 25;
    const startY = 0;
    const stepGeom = new T.BoxGeometry(0.8, 0.12, 0.5);
    const stepMat = new T.MeshStandardMaterial({ color: 0x4a5468, roughness: 0.85, metalness: 0.18 });

    for (let i = 0; i < stepCount; i++) {
      const t = i / stepCount;
      const angle = t * Math.PI * 6;       // 3 tours complets
      const radius = 3.2;                  // près de la paroi
      const y = startY - t * totalDepth;
      const step = new T.Mesh(stepGeom, stepMat);
      step.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      step.rotation.y = -angle + Math.PI / 2;
      this.spiralStairs.add(step);
    }

    // Quelques chaînes pendantes (tubes décoratifs)
    for (let c = 0; c < 4; c++) {
      const ang = (c / 4) * Math.PI * 2 + 0.3;
      const chainGeom = new T.CylinderGeometry(0.06, 0.06, 28, 6);
      const chainMat = new T.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9, metalness: 0.7 });
      const chain = new T.Mesh(chainGeom, chainMat);
      chain.position.set(Math.cos(ang) * 3.6, -12, Math.sin(ang) * 3.6);
      this.spiralStairs.add(chain);
    }

    this.scene.add(this.spiralStairs);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : rocher racine au fond (au-dessous de la dernière plateforme)
  // ═══════════════════════════════════════════════════════════════════
  private buildRootRock(T: any) {
    // Rocher : IcosahedronGeometry irrégulière
    const rockGeom = new T.IcosahedronGeometry(1.4, 0);
    const rockMat = new T.MeshStandardMaterial({
      color: 0x55321a, roughness: 0.95, metalness: 0.1,
      emissive: 0x331808, emissiveIntensity: 0.3,
    });
    this.rootRock = new T.Mesh(rockGeom, rockMat);
    this.rootRock.position.set(0, -27, 0);
    this.rootRock.userData = { kind: 'root-rock' };
    this.rootRock.userData.tutorialId = 'root-rock';
    this.wellGroup.add(this.rootRock);

    // Lueur magenta/bleu au fond
    const bottomLight = new T.PointLight(0xc084fc, 1.6, 15, 1.4);
    bottomLight.position.set(0, -27.5, 0);
    this.bottomGlowLight = bottomLight;
    this.wellGroup.add(bottomLight);

    // Ring émissif d'auréole magenta/cyan
    const auraRing = new T.Mesh(
      new T.RingGeometry(2.0, 2.4, 32),
      new T.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.45, side: T.DoubleSide, blending: T.AdditiveBlending }),
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = -27.85;
    auraRing.userData = { kind: 'aura-ring' };
    this.wellGroup.add(auraRing);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : brume légère au fond (plane semi-transparent qui drifts)
  // ═══════════════════════════════════════════════════════════════════
  private buildBottomFog(T: any) {
    const fogGeom = new T.CircleGeometry(3.6, 32);
    const fogMat = new T.MeshBasicMaterial({
      color: 0x60a5fa, transparent: true, opacity: 0.18,
      blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide,
    });
    this.bottomFogPlane = new T.Mesh(fogGeom, fogMat);
    this.bottomFogPlane.rotation.x = -Math.PI / 2;
    this.bottomFogPlane.position.y = -25.5;
    this.wellGroup.add(this.bottomFogPlane);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : eaux ruisselantes des murs (Points particles cyan)
  // ═══════════════════════════════════════════════════════════════════
  private buildWaterParticles(T: any) {
    const PARTICLE_COUNT = 350;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    this.waterVelocities = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Position : sur la paroi du puits (rayon ~3.9), y entre 2 et -28
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.8 + Math.random() * 0.15;
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 2 - Math.random() * 30;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      // Couleur cyan-pale dégradée
      colors[i * 3 + 0] = 0.4 + Math.random() * 0.2;   // R
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2;   // G
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;   // B
      this.waterVelocities[i] = 0.08 + Math.random() * 0.14;
    }

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));

    const mat = new T.PointsMaterial({
      size: 0.09, vertexColors: true,
      transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true,
    });

    this.waterParticles = new T.Points(geom, mat);
    this.wellGroup.add(this.waterParticles);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper : créer un sprite-text via canvas pour les labels
  // ═══════════════════════════════════════════════════════════════════
  private makeCanvasLabel(T: any, text: string, color: string): any {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 32);

    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIE / API publique pour narrator + bus
  // ═══════════════════════════════════════════════════════════════════
  emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('five-whys-well', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  // Helper pour narrator : exposer publiquement
  public emitCeremonyPublic(c: { type: string; label: string; icon: string }) {
    this.emitCeremony(c);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 SPLASH OVERLAY HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  /** Lancer le play */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    this.narrator.startPlayExample(0);
  }

  /** Entrer (skip play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
  }

  // 🎬 Méthodes invoquées par playExample tutorial JSON
  /** Plonge la caméra vers le niveau N */
  zoomToLevel(level: number) {
    if (!this.camera) return;
    const Y = [0, -5, -10, -15, -20, -25];
    const targetY = Y[Math.min(5, Math.max(0, level))];
    if (this.controls) this.controls.target.set(0, targetY, 0);
  }

  /** Illumine la rune racine (final reveal) */
  illuminateRoot() {
    if (this.rootRune?.material) {
      this.rootRune.userData.boostUntil = performance.now() + 5000;
    }
    if (this.rootGlow) this.rootGlow.userData = { boostUntil: performance.now() + 5000 };
    this.emitCeremony({ type: 'aube', label: '🛡 Racine révélée · contre-mesure gravée', icon: '🛡' });
  }

  /** Pulse rouge sur le problème (niveau 0) */
  pulseProblem() {
    if (this.runes[0]?.material) {
      this.runes[0].userData.boostUntil = performance.now() + 3000;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;
    const nowMs = performance.now();

    // ─── Eaux ruisselantes : tombent en continu, recycle quand passent le fond ───
    if (this.waterParticles) {
      const positions = this.waterParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < this.waterVelocities.length; i++) {
        const idx = i * 3;
        positions[idx + 1] -= this.waterVelocities[i];
        // Léger swirl horizontal
        positions[idx + 0] += Math.sin(this.elapsed * 1.5 + i * 0.07) * 0.0025;
        positions[idx + 2] += Math.cos(this.elapsed * 1.8 + i * 0.09) * 0.0025;
        // Recycle quand passe le fond
        if (positions[idx + 1] < -28) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 3.8 + Math.random() * 0.15;
          positions[idx + 0] = Math.cos(angle) * radius;
          positions[idx + 1] = 2.2;
          positions[idx + 2] = Math.sin(angle) * radius;
        }
      }
      this.waterParticles.geometry.attributes.position.needsUpdate = true;
    }

    // ─── Runes : pulse subtle (more pulse if root or problem) ───
    for (const rune of this.runes) {
      const ud = rune.userData;
      const phase = ud.basePhase || 0;
      let intensity = 0.5;
      if (ud.isRoot) {
        // racine pulse fort
        intensity = 1.5 + Math.sin(this.elapsed * 3 + phase) * 0.8;
        rune.rotation.y += dt * 0.6;
        rune.rotation.x += dt * 0.3;
      } else {
        intensity = 0.4 + Math.sin(this.elapsed * 2 + phase) * 0.2;
        rune.rotation.z += dt * 0.15;
      }
      // Boost temporaire si highlight depuis narrator
      if (ud.boostUntil && nowMs < ud.boostUntil) {
        intensity *= 2.5;
      }
      if (rune.material) {
        rune.material.emissiveIntensity = intensity;
      }
    }

    // ─── Rocher racine : rotation très lente ───
    if (this.rootRock) {
      this.rootRock.rotation.y += dt * 0.12;
    }

    // ─── Brume au fond : drift opacity oscillation ───
    if (this.bottomFogPlane) {
      const op = 0.15 + Math.sin(this.elapsed * 1.4) * 0.08;
      this.bottomFogPlane.material.opacity = op;
      this.bottomFogPlane.rotation.z += dt * 0.04;
    }

    // ─── Bottom glow light pulse ───
    if (this.bottomGlowLight) {
      const ud = this.bottomGlowLight.userData;
      const base = (ud?.boostUntil && nowMs < ud.boostUntil) ? 3.0 : 1.6;
      this.bottomGlowLight.intensity = base + Math.sin(this.elapsed * 2.2) * 0.4;
    }

    // ─── Root glow light : pulse stronger ───
    if (this.rootGlow) {
      const ud = this.rootGlow.userData;
      const base = (ud?.boostUntil && nowMs < ud.boostUntil) ? 4.5 : 2.2;
      this.rootGlow.intensity = base + Math.sin(this.elapsed * 4) * 0.7;
    }

    // Sky tick
    this.sky?.tick(dt, this.elapsed);

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // CAM / UTILS
  // ═══════════════════════════════════════════════════════════════════
  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(10, 5, 12);
    this.camera.lookAt(0, -10, 0);
    if (this.controls) this.controls.target.set(0, -10, 0);
  }

  private onResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };
}
