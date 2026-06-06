// ═══════════════════════════════════════════════════════════════════
// 🏝 YAMZY SHOWCASE — Visite publique d'un projet Yamzy World
//
// Route : /showcase/:projectKey
// Quand un ami clique sur un lien partageable, il atterrit ici.
// Scène 3D minimaliste (île ronde + grand arbre + ciel étoilé)
// avec narrator auto-launched et 4 boutons de tour (Vision / Tech /
// Lore / Metrics).
//
// Mode visite : aucun bouton d'édition, juste les actions sociales
// read-only (Follow / Fork / Share / Mode anonyme).
//
// Mapping role → narrator :
//   'lore'    → narrator.startTour()              (visite guidée pas-à-pas)
//   'vision'  → narrator.startPlayExample(1)      (additionalDemos[0])
//   'tech'    → narrator.startPlayExample(2)      (additionalDemos[1])
//   'metrics' → narrator.startPlayExample(0)      (playExample principal)
//
// L'élément central de la scène est UN GRAND ARBRE procédural :
// tronc + branches + feuillage icosaédrique + 12+ fruits dorés émissifs
// + champignons rouges au pied + pluie de feuilles qui tombent. À côté
// de l'arbre, l'avatar YAMZY GLB sert de guide. Le ciel est une coupole
// dégradée violet-nuit avec 200 étoiles et 4 torches autour de l'île.
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { YamzyAvatar3dComponent } from '../war-table/yamzy-avatar-3d.component';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { SpellButtonComponent, SpellChoicesComponent, SpellChoice } from '../../core/spell-ui';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';

type ShowcaseTour = 'vision' | 'tech' | 'lore' | 'metrics';

interface ProjectMeta {
  name: string;
  subtitle: string;
  ownerName: string;
  stats: {
    commits: number;
    releases: number;
    stashes: number;
    lastRelease: string;
    lastReleaseAgo: string;
    lastCommitAgo: string;
    contributors: number;
  };
}

@Component({
  selector: 'wt-yamzy-showcase',
  standalone: true,
  imports: [
    CommonModule, RouterLink, NarratorComponent, YamzyAvatar3dComponent,
    SpellButtonComponent, SpellChoicesComponent, RoomSplashComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ys-host">
      <!-- 🎬 SPLASH welcome (style spell-caster, contexte visite read-only) -->
      <wt-room-splash *ngIf="splashVisible()"
                      [title]="'L\\'Île de ' + ownerName()"
                      [loreName]="projectMeta().name"
                      [oneLiner]="projectMeta().subtitle + ' — Visite guidée par Yamzy, mode lecture seule.'"
                      [color]="'#d54adf'"
                      [duration]="60"
                      (onPlay)="onSplashPlay()"
                      (onEnter)="onSplashEnter()" />

      <!-- ─── TOP BAR : banner owner + tour selector + actions read-only
           (le ← Retour est géré par le SpellHeader global, pas de doublon ici) ─── -->
      <header class="ys-topbar">
        <div class="ys-banner">
          <span class="ys-avatar-glb">
            <app-yamzy-avatar-3d
              glbUrl="/assets/agents/YAMZY.glb"
              [bob]="true"
              [playGlbAnim]="true"
              [modelScale]="6"
              [modelYOffset]="-1.2">
            </app-yamzy-avatar-3d>
          </span>
          <div class="ys-banner-text">
            <div class="ys-greeting">👋 Tu visites l&apos;Île de <strong>{{ ownerName() }}</strong></div>
            <div class="ys-subtitle">{{ projectMeta().subtitle }}</div>
          </div>
        </div>

        <nav class="ys-tour-selector">
          <wt-spell-choices
            [choices]="tourChoices"
            [selected]="currentTour()"
            accent="#d54adf"
            (selectedChange)="switchTour($event)" />
        </nav>

        <div class="ys-actions">
          <wt-spell-btn variant="secondary" size="sm" accent="#d54adf"
                        icon="👁" title="Suivre ce projet (lecture seule)">Suivre</wt-spell-btn>
          <wt-spell-btn variant="secondary" size="sm" accent="#d54adf"
                        icon="🍴" title="Forker pour créer ta propre île">Forker</wt-spell-btn>
          <wt-spell-btn variant="secondary" size="sm" accent="#d54adf"
                        icon="🔗" title="Copier le lien de partage">Partager</wt-spell-btn>
          <wt-spell-btn variant="secondary" size="sm" accent="#67e8f9"
                        icon="🕶" title="Mode visiteur anonyme">Anonyme</wt-spell-btn>
        </div>
      </header>

      <!-- ─── CANVAS 3D plein écran ─── -->
      <canvas #canvas class="ys-canvas"></canvas>

      <!-- ─── SIDE PANEL droit : stats du projet (read-only) ─── -->
      <aside class="ys-side-panel">
        <header class="ys-sp-head">
          <span class="ys-sp-icon">📊</span>
          <span class="ys-sp-title">Stats du projet</span>
        </header>
        <div class="ys-stats">
          <div class="ys-stat-row"><span>🌳</span><span class="ys-sl">{{ projectMeta().stats.commits }}</span><span class="ys-st">commits</span></div>
          <div class="ys-stat-row"><span>🍎</span><span class="ys-sl">{{ projectMeta().stats.releases }}</span><span class="ys-st">releases (fruits dorés)</span></div>
          <div class="ys-stat-row"><span>🍄</span><span class="ys-sl">{{ projectMeta().stats.stashes }}</span><span class="ys-st">stash</span></div>
          <div class="ys-stat-row ys-divider"></div>
          <div class="ys-stat-row"><span>🌟</span><span class="ys-sl">{{ projectMeta().stats.lastRelease }}</span><span class="ys-st">(il y a {{ projectMeta().stats.lastReleaseAgo }})</span></div>
          <div class="ys-stat-row"><span>✨</span><span class="ys-sl ys-active">Actif</span><span class="ys-st">commit il y a {{ projectMeta().stats.lastCommitAgo }}</span></div>
          <div class="ys-stat-row"><span>👥</span><span class="ys-sl">{{ projectMeta().stats.contributors }}</span><span class="ys-st">contributeur</span></div>
        </div>
        <footer class="ys-sp-foot">
          <span class="ys-readonly">🔒 Mode visiteur — read-only</span>
        </footer>
      </aside>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Hint en bas -->
      <div class="ys-hint">
        Mouse drag = orbit · molette = zoom · Yamzy te raconte cette île
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .ys-host { position: relative; width: 100%; height: 100vh; background: #07041a; color: #fbd2a0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .ys-canvas { display: block; width: 100%; height: 100%; }

    /* ─── TOP BAR : sous la ligne SpellHeader (top: 60px) ─── */
    .ys-topbar {
      position: absolute; top: 60px; left: 0; right: 420px; z-index: 10;
      padding: 12px 22px;
      display: flex; align-items: center; gap: 18px;
      background: transparent;
      pointer-events: none;
      flex-wrap: wrap;
    }
    .ys-topbar > * { pointer-events: auto; }

    /* ─── BANNER — Spell-caster ADN ─── */
    .ys-banner {
      flex: 0 1 auto;
      display: flex; align-items: center; gap: 14px;
      padding: 10px 18px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(213, 74, 223, 0.25);
      border-left: 3px solid #d54adf;
      border-radius: 10px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 0 24px rgba(213, 74, 223, 0.18);
      font-family: "Tinos", serif;
    }
    .ys-avatar-glb {
      width: 56px; height: 56px; flex: 0 0 56px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 40%, rgba(213, 74, 223, 0.35) 0%, transparent 70%);
      overflow: hidden;
      display: block;
    }
    .ys-banner-text { display: flex; flex-direction: column; line-height: 1.3; }
    .ys-greeting {
      font-family: "Tinos", serif;
      font-size: 14px;
      color: #f9f9f9;
    }
    .ys-greeting strong {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: 18px;
      color: #d54adf;
      text-shadow: 0 0 12px rgba(213, 74, 223, 0.7);
      margin-left: 4px;
    }
    .ys-subtitle {
      font-family: "Tinos", serif;
      font-size: 12px;
      font-style: italic;
      opacity: 0.8;
      color: #e9d5ff;
      margin-top: 2px;
    }

    .ys-tour-selector { flex: 0 0 auto; display: flex; }
    .ys-actions { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; }

    /* ─── SIDE PANEL ─── */
    .ys-side-panel {
      position: absolute; right: 22px; top: 110px; z-index: 9;
      width: 280px;
      padding: 14px 16px;
      border: 1px solid rgba(251,191,36,0.35); border-radius: 14px;
      background: linear-gradient(135deg, rgba(15,20,40,0.92) 0%, rgba(30,15,50,0.92) 100%);
      box-shadow: 0 0 22px rgba(0,0,0,0.45);
      backdrop-filter: blur(8px);
    }
    .ys-sp-head {
      display: flex; align-items: center; gap: 8px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(251,191,36,0.2);
      margin-bottom: 10px;
    }
    .ys-sp-icon { font-size: 18px; }
    .ys-sp-title { font-size: 13px; font-weight: 700; color: #fde68a; letter-spacing: 0.5px; }

    .ys-stats { display: flex; flex-direction: column; gap: 8px; }
    .ys-stat-row {
      display: grid; grid-template-columns: 22px auto 1fr;
      gap: 8px; align-items: center; font-size: 12px;
    }
    .ys-stat-row .ys-sl { font-weight: 700; color: #fbbf24; }
    .ys-stat-row .ys-sl.ys-active { color: #4ade80; }
    .ys-stat-row .ys-st { opacity: 0.75; color: #fcd5b0; font-size: 11px; }
    .ys-divider {
      height: 1px; background: rgba(251,191,36,0.18);
      grid-template-columns: 1fr !important;
      padding: 0; margin: 2px 0;
    }

    .ys-sp-foot {
      margin-top: 12px; padding-top: 8px;
      border-top: 1px solid rgba(251,191,36,0.2);
    }
    .ys-readonly {
      font-size: 11px; opacity: 0.7;
      color: #bae6fd;
    }

    /* ─── HINT ─── */
    .ys-hint {
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      font-size: 11px; opacity: 0.55; color: #fde68a;
      pointer-events: none; z-index: 5;
    }

    /* ─── Responsive — masque side panel sur petits écrans ─── */
    @media (max-width: 980px) {
      .ys-side-panel { display: none; }
    }
    @media (max-width: 720px) {
      .ys-topbar { flex-wrap: wrap; gap: 8px; padding: 8px 12px; }
      .ys-banner { order: 5; flex-basis: 100%; }
    }
  `]
})
export class YamzyShowcaseComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── Injections ───
  narrator = inject(NarratorService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ceremonyBus = inject(CeremonyBusService);
  private unsubCeremony: (() => void) | null = null;

  // ─── Tour selector choices (spell-choices) ───
  readonly tourChoices: SpellChoice<ShowcaseTour>[] = [
    { value: 'vision',  label: 'Vision',  icon: '🌟', title: 'Tour Vision — pourquoi ce projet existe' },
    { value: 'tech',    label: 'Tech',    icon: '🏗', title: 'Tour Tech — l\'architecture' },
    { value: 'lore',    label: 'Lore',    icon: '🪶', title: 'Tour Lore — visite guidée pas-à-pas' },
    { value: 'metrics', label: 'Metrics', icon: '⚗', title: 'Tour Metrics — la saga complète' },
  ];

  // ─── State signals ───
  splashVisible = signal<boolean>(true);   // 🎬 splash welcome au chargement
  projectKey = signal<string>('yamzy-world');
  currentTour = signal<ShowcaseTour>('lore');
  ownerName = signal<string>('RamzyChatti90');

  /** Clic "▶ Lancer le play" → ferme le splash + démarre la visite guidée narrée (lore). */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    this.currentTour.set('lore');
    // Lance le tour explicitement après un court délai pour laisser l'anim de fermeture
    setTimeout(() => {
      if (!this.disposed) this.launchTour('lore');
    }, 300);
  }
  /** Clic "🌍 Entrer dans la room" → ferme le splash, PAS de narration, exploration libre. */
  onSplashEnter(): void {
    this.splashVisible.set(false);
    // Pas de launchTour() — l'utilisateur explore librement
  }
  projectMeta = signal<ProjectMeta>({
    name: 'yamzy-world',
    subtitle: 'Sprint board 3D + portfolio social',
    ownerName: 'RamzyChatti90',
    stats: {
      commits: 247,
      releases: 12,
      stashes: 1,
      lastRelease: 'v1.0.143',
      lastReleaseAgo: '4h',
      lastCommitAgo: '12 min',
      contributors: 1,
    },
  });

  // ─── Three.js core ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private rafId: number = 0;
  private disposed = false;

  // ─── Refs 3D ───
  private island: any;
  private tree: any;
  private trunk: any;
  private foliage: any;
  private fruits: any[] = [];
  private leaves: any;        // Points field (falling leaves)
  private leafBasePositions: Float32Array | null = null;
  private leafFallSpeeds: Float32Array | null = null;
  private starsField: any;
  private skyDome: any;
  private torchLights: any[] = [];
  private torchFlames: any[] = [];

  // ─── Animation state ───
  private windTime = 0;
  private elapsed = 0;

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit(): void {
    // Lit :projectKey depuis l'URL (par défaut 'yamzy-world')
    const keyParam = this.route.snapshot.paramMap.get('projectKey');
    if (keyParam) {
      this.projectKey.set(keyParam);
      // Met à jour le subtitle si la key n'est pas celle par défaut
      const meta = this.projectMeta();
      this.projectMeta.set({ ...meta, name: keyParam });
    }
    // Lit ?tour=... depuis le query string (default 'lore')
    const tourParam = this.route.snapshot.queryParamMap.get('tour') as ShowcaseTour | null;
    if (tourParam && this.isValidTour(tourParam)) {
      this.currentTour.set(tourParam);
    }
    // Démarre la scène 3D
    this.bootstrap();
    // 🌌 S'abonne au bus universel — chaque cérémonie d'une autre room
    // déclenche une étoile filante colorée dans le ciel showcase aussi
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'showcase') return;
      this.pulseSkyCeremony(c.type);
    });
  }

  /**
   * 🌠 Spawn d'une étoile filante colorée pour réagir à une cérémonie globale.
   * Mappage type → couleur RGB (même palette que sky-ornaments.ts).
   */
  private pulseSkyCeremony(ceremonyType: string): void {
    if (!this.shootingStars?.length) return;
    let color: [number, number, number] = [1, 1, 0.85];
    switch (ceremonyType) {
      case 'renaissance': case 'release': case 'harvest': case 'comet':
        color = [1.0, 0.7, 0.4]; break;
      case 'major-release': case 'supernova':
        color = [1.0, 0.5, 0.8]; break;
      case 'eclipse': case 'siren':
        color = [0.4, 0.1, 0.1]; break;
      case 'death': case 'rollback': case 'incident': case 'storm': case 'feu': case 'solar-storm':
        color = [1.0, 0.3, 0.1]; break;
      case 'debarquement': case 'fall': case 'pruning': case 'meteor':
        color = [0.8, 0.85, 1.0]; break;
      case 'sommet': case 'flag': case 'aurora':
        color = [0.5, 1.0, 0.6]; break;
      case 'aube': case 'dawn': case 'bloom': case 'nebula':
        color = [0.9, 0.6, 1.0]; break;
      case 'solstice': case 'crescent':
        color = [1.0, 0.9, 0.5]; break;
      case 'conjunction':
        color = [0.7, 1.0, 1.0]; break;
    }
    const free = this.shootingStars.find((s: any) => !s.userData.active);
    if (!free) return;
    const ud = free.userData;
    ud.active = true;
    ud.progress = 0;
    const sx = -40 + Math.random() * 80;
    const sy = 30 + Math.random() * 18;
    const sz = -50 + Math.random() * 30;
    ud.startPos = { x: sx, y: sy, z: sz };
    ud.endPos = {
      x: sx + 25 + Math.random() * 15,
      y: sy - 18 - Math.random() * 10,
      z: sz + 5 + Math.random() * 8,
    };
    free.position.set(sx, sy, sz);
    free.rotation.z = Math.atan2(ud.endPos.y - ud.startPos.y, ud.endPos.x - ud.startPos.x);
    // Teinte cérémonielle
    const colorAttr = free.geometry.attributes.color;
    const arr = colorAttr.array as Float32Array;
    for (let i = 0; i < 15; i++) {
      const fade = 1 - i / 15;
      arr[i * 3 + 0] = color[0] * fade;
      arr[i * 3 + 1] = color[1] * fade;
      arr[i * 3 + 2] = color[2] * fade;
    }
    colorAttr.needsUpdate = true;
  }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    this.narrator.detach();
    if (this.renderer) {
      try { this.renderer.dispose(); } catch { /* noop */ }
    }
    window.removeEventListener('resize', this.onResize);
  }

  private isValidTour(t: string): t is ShowcaseTour {
    return t === 'vision' || t === 'tech' || t === 'lore' || t === 'metrics';
  }

  // ═══════════════════════════════════════════════════════════════════
  // BOOTSTRAP — load Three.js puis init scene + auto-launch narrator
  // ═══════════════════════════════════════════════════════════════════
  private async bootstrap(): Promise<void> {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    // Attache le narrator avec roomKey = 'showcase-yamzy-world' (= clé du tutorial JSON)
    // Note : on utilise toujours 'showcase-yamzy-world' pour le MVP (le tutorial existe).
    // Dans le futur, ce sera 'showcase-' + projectKey() avec génération dynamique.
    const roomKey = `showcase-${this.projectKey() === 'yamzy-world' ? 'yamzy-world' : this.projectKey()}`;
    await this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey,
    });
    // ⚠ Auto-launch désactivé : le narrator démarre seulement quand l'utilisateur
    // clique "▶ Lancer le play" sur le splash (cf. onSplashPlay).
    // Si jamais le splash est sauté/désactivé manuellement, on lance après 600ms.
    setTimeout(() => {
      if (!this.disposed && !this.splashVisible()) this.launchTour(this.currentTour());
    }, 600);
  }

  private async ensureThreeJS(): Promise<void> {
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
  private init(): void {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // ─── Scène ─── nuit douce + brume violette
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x07041a);
    this.scene.fog = new T.FogExp2(0x100828, 0.008);

    // ─── Caméra ─── vue de face de l'île, légère plongée
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 280);
    this.camera.position.set(0, 8, 24);
    this.camera.lookAt(0, 4, 0);

    // ─── Renderer ───
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ─── Lights ───
    this.scene.add(new T.AmbientLight(0x6a5a9e, 0.45));
    const moon = new T.DirectionalLight(0xc4b5fd, 0.7);
    moon.position.set(-14, 22, 8);
    this.scene.add(moon);
    const hemi = new T.HemisphereLight(0x8b5cf6, 0x10172a, 0.35);
    this.scene.add(hemi);

    // ─── Build scene ───
    this.buildSkyDome(T);
    this.buildOceanRing(T);
    this.buildIsland(T);
    this.buildTree(T);
    this.buildMushrooms(T);
    this.buildFallingLeaves(T);
    this.buildTorches(T);
    this.buildStarsField(T, 500);

    // ─── OrbitControls ───
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 4, 0);
      this.controls.maxDistance = 60;
      this.controls.minDistance = 6;
      this.controls.maxPolarAngle = Math.PI / 2.05;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[YamzyShowcase] 🏝 Scene ready · projectKey=%s · tour=%s', this.projectKey(), this.currentTour());

    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sky dome (sphère renversée, dégradé violet-bleu nuit)
  // ═══════════════════════════════════════════════════════════════════
  private buildSkyDome(T: any): void {
    const geom = new T.SphereGeometry(110, 32, 24);
    const colors = new Float32Array(geom.attributes.position.count * 3);
    const top = new T.Color(0x0a0420);
    const horizon = new T.Color(0x2a1452);
    for (let i = 0; i < geom.attributes.position.count; i++) {
      const y = geom.attributes.position.getY(i);
      const t = Math.max(0, Math.min(1, (y + 110) / 220));
      const c = horizon.clone().lerp(top, t);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.MeshBasicMaterial({
      color: 0x0a0420,
      vertexColors: true,
      side: T.BackSide,
      fog: false,
    });
    this.skyDome = new T.Mesh(geom, mat);
    this.skyDome.userData.tutorialId = 'sky';
    this.scene.add(this.skyDome);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : anneau océan bleu translucide (CylinderGeometry rayon ext 60)
  // ═══════════════════════════════════════════════════════════════════
  private buildOceanRing(T: any): void {
    const geom = new T.CylinderGeometry(60, 60, 0.4, 64);
    const mat = new T.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.4,
      metalness: 0.55,
      transparent: true,
      opacity: 0.85,
      emissive: 0x0a1e4a,
      emissiveIntensity: 0.18,
    });
    const ocean = new T.Mesh(geom, mat);
    ocean.position.y = -0.05;
    ocean.userData.kind = 'ocean';
    this.scene.add(ocean);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : île ronde verte au centre (rayon 12, hauteur 0.8, herbe vif)
  // ═══════════════════════════════════════════════════════════════════
  private buildIsland(T: any): void {
    const geom = new T.CylinderGeometry(12, 12, 0.8, 48);
    const mat = new T.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.85,
      emissive: 0x0a2a14,
      emissiveIntensity: 0.2,
    });
    this.island = new T.Mesh(geom, mat);
    this.island.position.y = 0.4;
    this.island.userData.tutorialId = 'island';
    this.scene.add(this.island);

    // Petites touffes d'herbe en bordure (icosphères vert vif)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + Math.random() * 0.25;
      const r = 9.5 + Math.random() * 2.0;
      const tuftGeom = new T.IcosahedronGeometry(0.22 + Math.random() * 0.14, 0);
      const tuftMat = new T.MeshStandardMaterial({
        color: 0x65d680,
        roughness: 0.8,
        emissive: 0x103a18,
        emissiveIntensity: 0.25,
      });
      const tuft = new T.Mesh(tuftGeom, tuftMat);
      tuft.position.set(Math.cos(a) * r, 0.85, Math.sin(a) * r);
      this.scene.add(tuft);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : LE GRAND ARBRE PROCÉDURAL au centre de l'île
  //   • Tronc cylindre épais (rayon 1.2, hauteur 8, brun 0x6b4423)
  //   • 5 branches secondaires (cylindres inclinés)
  //   • Boule de feuillage (IcosahedronGeometry rayon 4, vert vif émissif)
  //   • 14 fruits dorés (petites sphères émissives or 0xfacc15)
  // ═══════════════════════════════════════════════════════════════════
  private buildTree(T: any): void {
    const treeGroup = new T.Group();
    treeGroup.position.set(0, 0.8, 0);

    // ── Tronc principal ──
    const trunkGeom = new T.CylinderGeometry(1.0, 1.4, 8.0, 12);
    const trunkMat = new T.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.95,
      emissive: 0x1f1208,
      emissiveIntensity: 0.18,
    });
    this.trunk = new T.Mesh(trunkGeom, trunkMat);
    this.trunk.position.y = 4.0;
    this.trunk.userData.tutorialId = 'trunk';
    treeGroup.add(this.trunk);

    // ── 5 branches secondaires inclinées partant du milieu/haut du tronc ──
    const branchConfigs: Array<{ angleY: number; tilt: number; len: number; height: number }> = [
      { angleY: 0,                tilt: 0.55, len: 3.4, height: 6.0 },
      { angleY: Math.PI * 0.4,    tilt: 0.45, len: 3.0, height: 6.4 },
      { angleY: Math.PI * 0.8,    tilt: 0.6,  len: 3.6, height: 5.8 },
      { angleY: Math.PI * 1.2,    tilt: 0.5,  len: 3.2, height: 6.2 },
      { angleY: Math.PI * 1.6,    tilt: 0.4,  len: 2.8, height: 6.6 },
    ];
    const branchPositions: Array<{ x: number; y: number; z: number }> = [];
    for (const cfg of branchConfigs) {
      const bGeom = new T.CylinderGeometry(0.18, 0.32, cfg.len, 8);
      const bMat = new T.MeshStandardMaterial({
        color: 0x6b4423,
        roughness: 0.95,
        emissive: 0x1f1208,
        emissiveIntensity: 0.18,
      });
      const branch = new T.Mesh(bGeom, bMat);
      // Pose le pivot du cylindre au bas → centre déplacé sur len/2
      branch.geometry.translate(0, cfg.len / 2, 0);
      // Position au tronc
      branch.position.set(0, cfg.height, 0);
      // Rotation : incline puis tourne autour de Y
      branch.rotation.z = cfg.tilt;
      branch.rotation.y = cfg.angleY;
      branch.userData.tutorialId = 'branch';
      treeGroup.add(branch);
      // Calcule la position du bout de la branche (pour y accrocher fruits)
      const tipLocal = new T.Vector3(0, cfg.len, 0);
      tipLocal.applyEuler(new T.Euler(0, cfg.angleY, cfg.tilt));
      branchPositions.push({
        x: tipLocal.x,
        y: cfg.height + tipLocal.y,
        z: tipLocal.z,
      });
    }

    // ── Boule de feuillage : grand icosaèdre vert vif émissif ──
    const foliageGeom = new T.IcosahedronGeometry(4.0, 1);
    const foliageMat = new T.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.75,
      emissive: 0x0e6b3b,
      emissiveIntensity: 0.35,
      flatShading: true,
    });
    this.foliage = new T.Mesh(foliageGeom, foliageMat);
    this.foliage.position.y = 8.5;
    this.foliage.userData.tutorialId = 'leaf';
    treeGroup.add(this.foliage);
    // 2 grumeaux secondaires de feuillage pour casser la sphère parfaite
    for (let i = 0; i < 3; i++) {
      const clumpGeom = new T.IcosahedronGeometry(1.8 + Math.random() * 0.7, 0);
      const clumpMat = new T.MeshStandardMaterial({
        color: 0x16a34a,
        roughness: 0.78,
        emissive: 0x0a4a25,
        emissiveIntensity: 0.32,
        flatShading: true,
      });
      const clump = new T.Mesh(clumpGeom, clumpMat);
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      clump.position.set(Math.cos(a) * 3.0, 8.0 + Math.random() * 1.2, Math.sin(a) * 3.0);
      clump.userData.tutorialId = 'leaf';
      treeGroup.add(clump);
    }

    // ── 14 fruits dorés émissifs (sphères or 0xfacc15) accrochés au feuillage + branches ──
    // 8 dans la sphère de feuillage à des positions aléatoires sur la surface
    for (let i = 0; i < 8; i++) {
      const fruitGeom = new T.SphereGeometry(0.28, 12, 10);
      const fruitMat = new T.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfacc15,
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.55,
      });
      const fruit = new T.Mesh(fruitGeom, fruitMat);
      // Position aléatoire à la surface de la boule de feuillage
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 4.0;
      fruit.position.set(
        Math.sin(phi) * Math.cos(theta) * r,
        8.5 + Math.cos(phi) * r * 0.8,
        Math.sin(phi) * Math.sin(theta) * r,
      );
      fruit.userData.tutorialId = 'fruit';
      fruit.userData.phase = Math.random() * Math.PI * 2;
      treeGroup.add(fruit);
      this.fruits.push(fruit);
    }
    // 6 fruits accrochés aux bouts des 5 branches (1-2 par branche)
    for (let i = 0; i < 6; i++) {
      const tip = branchPositions[i % branchPositions.length];
      const fruitGeom = new T.SphereGeometry(0.26, 12, 10);
      const fruitMat = new T.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfacc15,
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.55,
      });
      const fruit = new T.Mesh(fruitGeom, fruitMat);
      fruit.position.set(
        tip.x + (Math.random() - 0.5) * 0.6,
        tip.y - 0.2 + (Math.random() - 0.3) * 0.4,
        tip.z + (Math.random() - 0.5) * 0.6,
      );
      fruit.userData.tutorialId = 'fruit';
      fruit.userData.phase = Math.random() * Math.PI * 2;
      treeGroup.add(fruit);
      this.fruits.push(fruit);
    }

    this.tree = treeGroup;
    this.tree.userData.tutorialId = 'tree';
    this.scene.add(treeGroup);

    console.log('[YamzyShowcase] 🌳 Tree built — %d fruits, %d branches', this.fruits.length, branchConfigs.length);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 2 champignons rouges au pied de l'arbre
  // ═══════════════════════════════════════════════════════════════════
  private buildMushrooms(T: any): void {
    for (let i = 0; i < 2; i++) {
      const group = new T.Group();
      const a = (i / 2) * Math.PI * 2 + Math.PI / 3;
      const r = 2.2 + Math.random() * 0.8;
      group.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);

      // Pied du champignon (cylindre fin blanc cassé)
      const stemGeom = new T.CylinderGeometry(0.08, 0.1, 0.45, 8);
      const stemMat = new T.MeshStandardMaterial({
        color: 0xfefce8,
        roughness: 0.9,
      });
      const stem = new T.Mesh(stemGeom, stemMat);
      stem.position.y = 0.22;
      group.add(stem);

      // Chapeau (demi-sphère rouge à pois blancs… juste rouge pour simplifier)
      const capGeom = new T.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new T.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.6,
        emissive: 0x4a0a0a,
        emissiveIntensity: 0.3,
      });
      const cap = new T.Mesh(capGeom, capMat);
      cap.position.y = 0.45;
      cap.scale.y = 0.85;
      group.add(cap);

      group.userData.tutorialId = 'mushroom';
      this.scene.add(group);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : Particules de feuilles qui tombent (Points field 50)
  // ═══════════════════════════════════════════════════════════════════
  private buildFallingLeaves(T: any): void {
    const count = 50;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 4.5;
      positions[i * 3 + 0] = Math.cos(a) * r;
      positions[i * 3 + 1] = 6.0 + Math.random() * 6.0;
      positions[i * 3 + 2] = Math.sin(a) * r;
      // Couleurs : mélange vert + or
      const v = Math.random();
      if (v < 0.7) {
        colors[i * 3 + 0] = 0.4 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
        colors[i * 3 + 2] = 0.3 + Math.random() * 0.2;
      } else {
        colors[i * 3 + 0] = 0.98;
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 0.32;
      }
      speeds[i] = 0.35 + Math.random() * 0.55;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      vertexColors: true,
      fog: false,
    });
    this.leaves = new T.Points(geom, mat);
    this.leafBasePositions = new Float32Array(positions);
    this.leafFallSpeeds = speeds;
    this.scene.add(this.leaves);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 4 torches autour de l'île (point lights chaleureuses + flicker)
  // ═══════════════════════════════════════════════════════════════════
  private buildTorches(T: any): void {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(angle) * 9.0;
      const z = Math.sin(angle) * 9.0;

      // Poteau (cylindre brun fin)
      const poleGeom = new T.CylinderGeometry(0.08, 0.1, 1.4, 6);
      const poleMat = new T.MeshStandardMaterial({ color: 0x3f2a14, roughness: 0.95 });
      const pole = new T.Mesh(poleGeom, poleMat);
      pole.position.set(x, 1.5, z);
      this.scene.add(pole);

      // Flamme (cône orange émissif)
      const flameGeom = new T.ConeGeometry(0.2, 0.55, 8);
      const flameMat = new T.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xf97316,
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.92,
      });
      const flame = new T.Mesh(flameGeom, flameMat);
      flame.position.set(x, 2.4, z);
      this.scene.add(flame);
      this.torchFlames.push(flame);

      // Lumière ponctuelle chaleureuse flickering
      const light = new T.PointLight(0xff9b54, 0.9, 9, 1.8);
      light.position.set(x, 2.55, z);
      light.userData.phase = Math.random() * Math.PI * 2;
      this.scene.add(light);
      this.torchLights.push(light);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 200 étoiles (Points field au-dessus de l'horizon)
  // ═══════════════════════════════════════════════════════════════════
  private buildStarsField(T: any, count: number): void {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Hémisphère supérieure
      const phi = Math.acos(Math.random() * 0.95);
      const theta = Math.random() * Math.PI * 2;
      const r = 85 + Math.random() * 18;
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      // Tint blanc / bleu pâle / ambre pâle
      const tint = Math.random();
      if (tint < 0.65) {
        colors[i * 3 + 0] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0;
      } else if (tint < 0.88) {
        colors[i * 3 + 0] = 0.78; colors[i * 3 + 1] = 0.88; colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3 + 0] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.7;
      }
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 1.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1.0,
      blending: T.AdditiveBlending,
      vertexColors: true,
      fog: false,
    });
    this.starsField = new T.Points(geom, mat);
    this.starsField.userData.tutorialId = 'star';
    this.scene.add(this.starsField);
    // Construction des phénomènes ambiants qui reflètent l'état du projet
    this.buildAmbientCelestial(T);
  }

  /**
   * 🌌 PHÉNOMÈNES CÉLESTES AMBIANTS — Reflètent l'état du projet :
   *  - 🌙 Croissant de lune doré (projet actif, repo vivant)
   *  - 🌌 Aurora boréale verte/violette (sprint en cours / sain)
   *  - ☄ Traînée de comète résiduelle (release récente, il y a 4h)
   *  - 🌠 Étoiles filantes périodiques (commits qui arrivent)
   */
  private ambientMoon: any;
  private ambientAurora: any;
  private ambientCometTrail: any;
  private shootingStars: any[] = [];

  private buildAmbientCelestial(T: any) {
    // ─── 🌙 GRANDE LUNE DORÉE (haut, bien visible) ───
    const moonGeom = new T.SphereGeometry(4.5, 32, 24);
    const moonMat = new T.MeshBasicMaterial({
      color: 0xfff4a3,
      transparent: false,
      fog: false,
    });
    this.ambientMoon = new T.Mesh(moonGeom, moonMat);
    this.ambientMoon.position.set(-22, 16, -18);
    this.scene.add(this.ambientMoon);
    // Halo autour de la lune (additif, non-affecté par fog)
    const haloGeom = new T.SphereGeometry(7, 24, 16);
    const haloMat = new T.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.35,
      blending: T.AdditiveBlending, fog: false, depthWrite: false,
    });
    const halo = new T.Mesh(haloGeom, haloMat);
    halo.position.copy(this.ambientMoon.position);
    this.scene.add(halo);
    // Halo extérieur plus diffus
    const halo2 = new T.Mesh(
      new T.SphereGeometry(10, 20, 14),
      new T.MeshBasicMaterial({
        color: 0xfacc15, transparent: true, opacity: 0.15,
        blending: T.AdditiveBlending, fog: false, depthWrite: false,
      })
    );
    halo2.position.copy(this.ambientMoon.position);
    this.scene.add(halo2);
    this.ambientMoon.userData.halo = halo;
    this.ambientMoon.userData.halo2 = halo2;
    // Light de la lune (douce, dorée)
    const moonLight = new T.PointLight(0xfde047, 1.2, 80, 1.2);
    moonLight.position.copy(this.ambientMoon.position);
    this.scene.add(moonLight);

    // ─── 🌌 AURORA BORÉALE (bande verte/violette ondulante au fond) ───
    const auroraGeom = new T.PlaneGeometry(80, 28, 24, 6);
    const auroraMat = new T.MeshBasicMaterial({
      color: 0x6ee7b7, transparent: true, opacity: 0.7,
      blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false,
      fog: false,
    });
    this.ambientAurora = new T.Mesh(auroraGeom, auroraMat);
    this.ambientAurora.position.set(0, 24, -38);
    this.ambientAurora.userData.basePositions = (() => {
      const arr = new Float32Array(auroraGeom.attributes.position.array.length);
      arr.set(auroraGeom.attributes.position.array);
      return arr;
    })();
    this.scene.add(this.ambientAurora);
    // Couche violet
    const aurora2 = new T.Mesh(auroraGeom.clone(), new T.MeshBasicMaterial({
      color: 0xc084fc, transparent: true, opacity: 0.55,
      blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false,
      fog: false,
    }));
    aurora2.position.set(0, 28, -42);
    this.scene.add(aurora2);
    this.ambientAurora.userData.partner = aurora2;
    aurora2.userData.basePositions = (() => {
      const arr = new Float32Array(aurora2.geometry.attributes.position.array.length);
      arr.set(aurora2.geometry.attributes.position.array);
      return arr;
    })();
    // Couche cyan en arrière-plan
    const aurora3 = new T.Mesh(auroraGeom.clone(), new T.MeshBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.45,
      blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false,
      fog: false,
    }));
    aurora3.position.set(0, 32, -46);
    this.scene.add(aurora3);
    aurora2.userData.partner = aurora3;
    aurora3.userData.basePositions = (() => {
      const arr = new Float32Array(aurora3.geometry.attributes.position.array.length);
      arr.set(aurora3.geometry.attributes.position.array);
      return arr;
    })();

    // ─── ☄ TRAÎNÉE DE COMÈTE RÉSIDUELLE (release il y a 4h) ───
    const cometGroup = new T.Group();
    const cometHead = new T.Mesh(
      new T.SphereGeometry(0.9, 12, 8),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, fog: false })
    );
    cometGroup.add(cometHead);
    // Halo de tête
    const cometHalo = new T.Mesh(
      new T.SphereGeometry(1.6, 16, 10),
      new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, fog: false, depthWrite: false })
    );
    cometGroup.add(cometHalo);
    // Tail = 60 petits points dégradés
    const tailCount = 60;
    const tailPos = new Float32Array(tailCount * 3);
    const tailCol = new Float32Array(tailCount * 3);
    for (let i = 0; i < tailCount; i++) {
      tailPos[i * 3 + 0] = -i * 0.55;
      tailPos[i * 3 + 1] = -i * 0.08;
      tailPos[i * 3 + 2] = 0;
      const fade = 1 - i / tailCount;
      tailCol[i * 3 + 0] = 1.0 * fade;
      tailCol[i * 3 + 1] = 0.85 * fade;
      tailCol[i * 3 + 2] = 0.5 * fade;
    }
    const tailGeom = new T.BufferGeometry();
    tailGeom.setAttribute('position', new T.BufferAttribute(tailPos, 3));
    tailGeom.setAttribute('color', new T.BufferAttribute(tailCol, 3));
    const tailMat = new T.PointsMaterial({
      size: 1.0, vertexColors: true, transparent: true, opacity: 0.9,
      blending: T.AdditiveBlending, sizeAttenuation: true, fog: false,
    });
    cometGroup.add(new T.Points(tailGeom, tailMat));
    cometGroup.position.set(15, 18, -18);
    cometGroup.rotation.z = -0.35;
    this.ambientCometTrail = cometGroup;
    this.scene.add(cometGroup);

    // ─── 🌠 5 ÉTOILES FILANTES (apparitions sporadiques) ───
    for (let s = 0; s < 5; s++) {
      const shootGeom = new T.BufferGeometry();
      const shootPos = new Float32Array(15 * 3);
      const shootCol = new Float32Array(15 * 3);
      for (let i = 0; i < 15; i++) {
        shootPos[i * 3 + 0] = -i * 0.45;
        shootPos[i * 3 + 1] = -i * 0.18;
        shootPos[i * 3 + 2] = 0;
        const fade = 1 - i / 15;
        shootCol[i * 3 + 0] = 1.0 * fade;
        shootCol[i * 3 + 1] = 1.0 * fade;
        shootCol[i * 3 + 2] = 0.85 * fade;
      }
      shootGeom.setAttribute('position', new T.BufferAttribute(shootPos, 3));
      shootGeom.setAttribute('color', new T.BufferAttribute(shootCol, 3));
      const shootMat = new T.PointsMaterial({
        size: 0.8, vertexColors: true, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, sizeAttenuation: true, fog: false,
      });
      const shoot = new T.Points(shootGeom, shootMat);
      shoot.userData = {
        nextSpawnAt: this.windTime + s * 6 + Math.random() * 4,
        active: false,
        progress: 0,
        startPos: { x: 0, y: 0, z: 0 },
        endPos: { x: 0, y: 0, z: 0 },
      };
      this.shootingStars.push(shoot);
      this.scene.add(shoot);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TOUR SWITCHING (Vision / Tech / Lore / Metrics)
  // ═══════════════════════════════════════════════════════════════════
  switchTour(tour: ShowcaseTour): void {
    if (tour === this.currentTour()) {
      // Re-trigger the same tour
      this.launchTour(tour);
      return;
    }
    this.currentTour.set(tour);
    // Update l'URL avec ?tour=...
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tour },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    // Stop any current narration
    this.narrator.stopTour();
    this.narrator.stopPlayExample();
    // Lance la nouvelle après une petite pause pour laisser le cleanup s'achever
    setTimeout(() => {
      if (!this.disposed) this.launchTour(tour);
    }, 200);
  }

  /**
   * Mapping role → narrator method :
   *   'vision'  → additionalDemos[0] (idx 1, PO voice — "Tour Vision")
   *   'tech'    → additionalDemos[1] (idx 2, Architecte voice — "Tour Tech")
   *   'lore'    → tour full (visite guidée pas-à-pas, dual-flow)
   *   'metrics' → playExample principal (idx 0, saga complète 65s)
   */
  private launchTour(tour: ShowcaseTour): void {
    switch (tour) {
      case 'vision':
        this.narrator.startPlayExample(1);
        break;
      case 'tech':
        this.narrator.startPlayExample(2);
        break;
      case 'metrics':
        this.narrator.startPlayExample(0);
        break;
      case 'lore':
      default:
        this.narrator.startTour();
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.windTime += dt;
    this.elapsed += dt;

    // ─── Étoiles scintillent ───
    if (this.starsField?.material) {
      this.starsField.material.opacity = 0.85 + Math.sin(this.windTime * 1.2) * 0.1;
    }

    // ─── 🌙 LUNE : rotation très lente + halos pulsants ───
    if (this.ambientMoon) {
      this.ambientMoon.rotation.y += dt * 0.05;
      const halo = this.ambientMoon.userData.halo;
      const halo2 = this.ambientMoon.userData.halo2;
      if (halo?.material) {
        halo.material.opacity = 0.32 + Math.sin(this.windTime * 0.7) * 0.10;
        const s = 1 + Math.sin(this.windTime * 0.5) * 0.05;
        halo.scale.setScalar(s);
      }
      if (halo2?.material) {
        halo2.material.opacity = 0.13 + Math.sin(this.windTime * 0.5 + 0.5) * 0.06;
      }
    }

    // ─── 🌌 AURORA : ondulation des vertices (3 couches : verte + violette + cyan) ───
    if (this.ambientAurora) {
      const layers: any[] = [];
      let cur = this.ambientAurora;
      while (cur) {
        layers.push(cur);
        cur = cur.userData?.partner;
      }
      for (const layer of layers) {
        const geom = layer.geometry;
        const pos = geom.attributes.position;
        const arr = pos.array as Float32Array;
        const base = layer.userData.basePositions as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          const x = base[i];
          arr[i + 1] = base[i + 1] + Math.sin(this.windTime * 0.6 + x * 0.18) * 1.6;
          arr[i + 2] = base[i + 2] + Math.cos(this.windTime * 0.45 + x * 0.12) * 1.0;
        }
        pos.needsUpdate = true;
        if (layer.material) {
          layer.material.opacity = 0.22 + Math.sin(this.windTime * 0.5) * 0.10;
        }
      }
    }

    // ─── ☄ COMÈTE RÉSIDUELLE : drift lent + pulse ───
    if (this.ambientCometTrail) {
      this.ambientCometTrail.position.x += dt * 0.4;
      this.ambientCometTrail.position.y -= dt * 0.08;
      // Recycle quand elle sort du cadre
      if (this.ambientCometTrail.position.x > 60) {
        this.ambientCometTrail.position.set(28, 24, -38);
      }
      const headMesh = this.ambientCometTrail.children[0];
      if (headMesh?.material) {
        headMesh.material.opacity = 0.7 + Math.sin(this.windTime * 1.5) * 0.2;
      }
    }

    // ─── 🌠 ÉTOILES FILANTES : spawn périodique + traversée + fade ───
    for (const shoot of this.shootingStars) {
      const ud = shoot.userData;
      if (!ud.active && this.windTime >= ud.nextSpawnAt) {
        // SPAWN
        ud.active = true;
        ud.progress = 0;
        const sx = -40 + Math.random() * 80;
        const sy = 30 + Math.random() * 18;
        const sz = -50 + Math.random() * 30;
        ud.startPos = { x: sx, y: sy, z: sz };
        ud.endPos = {
          x: sx + 25 + Math.random() * 15,
          y: sy - 18 - Math.random() * 10,
          z: sz + 5 + Math.random() * 8,
        };
        shoot.position.set(sx, sy, sz);
        // Orient comet tail vers le sens de déplacement
        const dx = ud.endPos.x - ud.startPos.x;
        const dy = ud.endPos.y - ud.startPos.y;
        shoot.rotation.z = Math.atan2(dy, dx);
      }
      if (ud.active) {
        ud.progress += dt * 0.55; // ~1.8s par traversée
        const t = Math.min(1, ud.progress);
        shoot.position.x = ud.startPos.x + (ud.endPos.x - ud.startPos.x) * t;
        shoot.position.y = ud.startPos.y + (ud.endPos.y - ud.startPos.y) * t;
        shoot.position.z = ud.startPos.z + (ud.endPos.z - ud.startPos.z) * t;
        // Fade-in puis fade-out
        const op = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
        if (shoot.material) shoot.material.opacity = Math.max(0, Math.min(1, op)) * 0.95;
        if (t >= 1) {
          ud.active = false;
          ud.nextSpawnAt = this.windTime + 4 + Math.random() * 6;
          if (shoot.material) shoot.material.opacity = 0;
        }
      }
    }

    // ─── Torches flickering (lumière + flamme) ───
    for (let i = 0; i < this.torchLights.length; i++) {
      const light = this.torchLights[i];
      const phase = light.userData.phase || 0;
      light.intensity = 0.85 + Math.sin(this.windTime * 6 + phase) * 0.3 + Math.random() * 0.08;
      const flame = this.torchFlames[i];
      if (flame) {
        flame.scale.y = 0.9 + Math.sin(this.windTime * 7 + phase) * 0.2;
        flame.scale.x = 0.95 + Math.cos(this.windTime * 6 + phase) * 0.1;
      }
    }

    // ─── Arbre : léger sway du feuillage ───
    if (this.foliage) {
      this.foliage.rotation.y = Math.sin(this.windTime * 0.25) * 0.04;
      this.foliage.position.x = Math.sin(this.windTime * 0.4) * 0.1;
    }
    if (this.tree) {
      this.tree.rotation.z = Math.sin(this.windTime * 0.3) * 0.012;
    }

    // ─── Fruits dorés : léger glow pulsant + bobbing ───
    for (let i = 0; i < this.fruits.length; i++) {
      const f = this.fruits[i];
      const phase = f.userData.phase || 0;
      if (f.material) {
        f.material.emissiveIntensity = 1.2 + Math.sin(this.windTime * 1.6 + phase) * 0.4;
      }
    }

    // ─── Feuilles qui tombent : descente + spirale + respawn ───
    if (this.leaves && this.leafBasePositions && this.leafFallSpeeds) {
      const pos = this.leaves.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const base = this.leafBasePositions;
      for (let i = 0; i < this.leafFallSpeeds.length; i++) {
        const speed = this.leafFallSpeeds[i];
        arr[i * 3 + 1] -= speed * dt;
        // Petite spirale horizontale
        arr[i * 3 + 0] = base[i * 3 + 0] + Math.sin(this.windTime * 1.2 + i * 0.4) * 0.4;
        arr[i * 3 + 2] = base[i * 3 + 2] + Math.cos(this.windTime * 0.9 + i * 0.4) * 0.4;
        // Respawn en haut si tombée au sol
        if (arr[i * 3 + 1] < 1.0) {
          arr[i * 3 + 1] = 11.0 + Math.random() * 2.0;
          base[i * 3 + 0] = arr[i * 3 + 0];
          base[i * 3 + 2] = arr[i * 3 + 2];
        }
      }
      pos.needsUpdate = true;
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // RESIZE
  // ═══════════════════════════════════════════════════════════════════
  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
