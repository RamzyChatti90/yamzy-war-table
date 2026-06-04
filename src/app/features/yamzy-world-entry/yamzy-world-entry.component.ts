// ═══════════════════════════════════════════════════════════════════
// 🌍 YAMZY WORLD ENTRY — Splash & Voice-Guided Tour
//
// Pattern repris du Spell-Caster (xstate → onStateChange switch) mais
// allégé en signals Angular natifs :
//
//   IDLE → LOADING → SPLASH → TOUR → DONE
//
// SPLASH :
//   ─ Vue isométrique de l'île entière vue de loin (caméra haute)
//   ─ Titre "YAMZY WORLD" + sous-titre poétique
//   ─ 2 boutons : "▶ Lancer le conte" / "🌍 Entrer dans le monde"
//
// TOUR :
//   ─ Yamzy avatar (mignonne créature) apparaît avec bulle
//   ─ Pour chaque étape : voix-d'abord, puis animation 3D (caméra/scene)
//   ─ Le narrateur parle, on attend `onend`, puis on lance l'anim suivante
//
// Pas de nouveaux GLB — seul YAMZY.glb est réutilisé, et toute l'île
// est procédurale (cylindres + arbres + tours = design pur Three.js).
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { VoiceNarratorService, VoicePersona } from '../../core/voice-narrator/voice-narrator.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { SpellSoundsService } from '../../core/spell-sounds/spell-sounds.service';
import { YamzyAvatar3dComponent } from '../war-table/yamzy-avatar-3d.component';
import { SpellDayFlowComponent } from '../../core/spell-ui';

type EntryPhase = 'idle' | 'loading' | 'splash' | 'tour' | 'done';

/**
 * Le conte = une suite de "pages" : chaque page a un texte vocal et
 * une fonction d'animation 3D qui se joue APRÈS la fin de la voix.
 */
interface ConteStep {
  text: string;
  animate: () => Promise<void>;
}

@Component({
  selector: 'wt-yamzy-world-entry',
  standalone: true,
  imports: [CommonModule, RouterLink, YamzyAvatar3dComponent, SpellDayFlowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ywe-app" [attr.data-state]="phase()" [style.--loaded]="loadingProgress() / 100">
      <!-- 🌌 Canvas 3D (île + crystal + ciel) -->
      <canvas #canvas class="ywe-canvas"></canvas>

      <!-- ─── Screens (un par phase, contrôlés par data-state CSS) ─── -->
      <div class="ywe-screens">

        <!-- LOADING : Titre + barre fine magenta -->
        <div *ngIf="phase() === 'loading'" data-screen="LOADING" class="ywe-screen ywe-loading">
          <div class="ywe-content">
            <span>{{ loadingMessage() }}</span>
            <div class="ywe-loading-bar"></div>
          </div>
        </div>

        <!-- TITLE_SCREEN : h1 Yamzy World + bouton Lancer le conte + button-row -->
        <div *ngIf="phase() === 'splash'" data-screen="TITLE_SCREEN" class="ywe-screen ywe-title">
          <div class="ywe-content">
            <h1 data-fade>Yamzy<br/>World</h1>
            <button data-send="next" data-fade (click)="startTour()">Lancer le conte</button>
            <ul class="ywe-button-row">
              <li><button data-fade class="ywe-simple ywe-day-btn" (click)="openDayDemo()">🌅 Journée Demo</button></li>
              <li><button data-fade class="ywe-simple" (click)="enterWorld()">Entrer directement</button></li>
              <li><button data-fade class="ywe-simple" (click)="skipToConclave()">Conclave VESPER</button></li>
              <li><button data-fade class="ywe-simple" (click)="goShowcase()">Vitrine du Mage</button></li>
            </ul>
            <!-- 🎙 Sélecteur de voix -->
            <ul class="ywe-button-row ywe-voice-row">
              <li><button data-fade class="ywe-voice" [class.is-active]="voice.persona() === 'cute-creature'" (click)="pickVoice('cute-creature')">🐭 Mignonne</button></li>
              <li><button data-fade class="ywe-voice" [class.is-active]="voice.persona() === 'old-sage'" (click)="pickVoice('old-sage')">🧙 Vieux sage</button></li>
              <li><button data-fade class="ywe-voice" [class.is-active]="voice.persona() === 'enthusiastic-elf'" (click)="pickVoice('enthusiastic-elf')">🧚 Lutin</button></li>
              <li><button data-fade class="ywe-voice ywe-voice-test" (click)="testVoice()">🔊 Test</button></li>
            </ul>
          </div>
        </div>

        <!-- INSTRUCTIONS (le conte) : h3 + p + skip -->
        <div *ngIf="phase() === 'tour'" data-screen="INSTRUCTIONS" class="ywe-screen ywe-instructions">
          <div class="ywe-content">
            <h3 data-fade>{{ getStepTitle() }}</h3>
            <p data-fade class="ywe-speaking" [class.is-active]="voice.speaking()">{{ tourText() }}</p>
            <div class="ywe-step-meta">Page {{ tourIndex() + 1 }} / {{ totalSteps() }}</div>
            <button data-fade class="ywe-simple ywe-skip-btn" (click)="enterWorld()">Passer le conte ✕</button>
          </div>
        </div>

        <!-- DONE : h1 + bouton enter -->
        <div *ngIf="phase() === 'done'" data-screen="DONE" class="ywe-screen ywe-done">
          <div class="ywe-content">
            <h2 data-fade>Le conte<br/>est conté</h2>
            <button data-fade (click)="enterWorld()">Entrer dans le monde</button>
            <ul class="ywe-button-row">
              <li><button data-fade class="ywe-simple" (click)="phase.set('splash')">Recommencer</button></li>
            </ul>
          </div>
        </div>

      </div>

      <!-- 🌅 DAY FLOW : timeline d'une journée Scrum à travers les rooms -->
      <wt-spell-day-flow
        [open]="dayDemoOpen()"
        accent="#d54adf"
        (close)="dayDemoOpen.set(false)" />
    </div>
  `,
  styles: [`
    /* ═══ Spell-Caster DNA — fonts, palette, layout ═══ */
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      display:block;
      position:fixed;
      inset:0;
      --font-body: "Tinos", serif;
      --font-heading: "Henny Penny", cursive;
      --color-black: black;
      --color-black-alpha: rgba(0, 0, 0, 0.7);
      --color-white: white;
      --color-grey: #767474;
      --color-grey-dark: #3e3e3e;
      --color-crystal: #d54adf;
      --color-crystal-light: #d68ddc;
    }

    .ywe-app {
      position:relative; width:100%; height:100%;
      background-color: var(--color-black);
      color:#f9f9f9;
      font-family: var(--font-body);
      font-weight: 400;
      font-size: clamp(20px, 4vmin, 26px);
      line-height: 110%;
      overflow:hidden;
    }
    .ywe-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; z-index:1; }

    /* ─── Screens overlay ─── */
    .ywe-screens {
      position:absolute; inset:0; z-index:5;
      display:grid;
      grid-template-areas: "content";
      pointer-events:none;
    }
    .ywe-screen {
      grid-area:content;
      display:flex; align-items:center; justify-content:center;
      padding:0 5vmin;
      pointer-events:none;
    }
    .ywe-content {
      text-align:center;
      display:flex; align-items:center; justify-content:center; flex-direction:column;
      pointer-events:auto;
      max-width:850px;
    }
    .ywe-content > *:not(:last-child) { margin-bottom: clamp(20px, 5vmin, 50px); }

    /* ─── Typo : Henny Penny pour h1/h2/h3 ─── */
    h1, h2, h3, h4 { font-family: var(--font-heading); font-weight:400; margin:0; line-height:1; color:#fff; }
    h1 { font-size: clamp(30px, 14vmin, 130px); }
    h2 { font-size: clamp(30px, 11vmin, 100px); }
    h3 { font-size: clamp(24px, 6.5vmin, 60px); }
    p { max-width:600px; margin:0; font-family: var(--font-body); }

    /* ─── Boutons style spell-caster ─── */
    button {
      color: var(--color-white); pointer-events:all; cursor:pointer;
      font-family: var(--font-body); font-weight:400;
    }
    button:not(.ywe-simple) {
      --border-color: var(--color-grey);
      background-color: var(--color-black-alpha);
      border: 2px solid var(--border-color);
      font-size: 30px;
      padding: 0.2em 1.4em;
    }
    button:not(.ywe-simple):hover, button:not(.ywe-simple):active {
      --border-color: var(--color-crystal);
    }
    button.ywe-simple {
      background:transparent; border:none;
      text-decoration: underline;
      text-decoration-color: var(--color-grey);
      text-decoration-thickness: 2px;
      text-underline-offset: 5px;
      font-size: 20px;
      padding:0;
    }
    button.ywe-simple:hover {
      text-decoration-color: var(--color-crystal);
      color: var(--color-crystal-light);
    }

    /* ─── Button-row (ligne horizontale d'actions secondaires) ─── */
    .ywe-button-row {
      list-style:none; margin:0; padding:0;
      display:flex; flex-direction:row; gap:0.7em; flex-wrap:wrap; justify-content:center;
    }

    /* ─── Sélecteur de voix (button-row spécifique) ─── */
    .ywe-voice-row { margin-top: 0.5em; }
    .ywe-voice {
      background:transparent !important;
      border: 2px solid var(--color-grey-dark) !important;
      font-size: 18px !important;
      padding: 0.1em 0.8em !important;
      color: var(--color-white);
      transition: all 0.2s ease;
    }
    .ywe-voice:hover { border-color: var(--color-crystal) !important; }
    .ywe-voice.is-active {
      border-color: var(--color-crystal) !important;
      color: var(--color-crystal-light);
      background-color: rgba(213, 74, 223, 0.12) !important;
      box-shadow: 0 0 12px rgba(213, 74, 223, 0.3);
    }
    .ywe-voice-test { border-color: var(--color-crystal-light) !important; color: var(--color-crystal-light); }

    /* ─── Loading bar : très fine, magenta cristal ─── */
    .ywe-loading-bar {
      width:260px; height:2px;
      background-color: var(--color-grey-dark);
      overflow:hidden; position:relative;
    }
    .ywe-loading-bar::after {
      content:""; position:absolute; inset:0;
      background-color: var(--color-crystal);
      transform-origin: left center;
      transform: scaleX(var(--loaded, 0));
      transition: transform 0.3s ease-out;
    }
    .ywe-loading .ywe-content span { font-size:18px; opacity:0.8; letter-spacing:1px; }

    /* ─── Instructions screen (le conte) ─── */
    .ywe-instructions .ywe-content { max-width:780px; }
    .ywe-instructions p {
      font-size: clamp(18px, 2.6vmin, 26px);
      line-height: 1.4;
      transition: color 0.3s ease;
    }
    .ywe-speaking.is-active { color: var(--color-crystal-light); text-shadow: 0 0 16px rgba(213, 74, 223, 0.4); }
    .ywe-step-meta { font-size:14px; opacity:0.5; letter-spacing:2px; font-variant-numeric: tabular-nums; }
    .ywe-skip-btn { margin-top: 1.5em; }

    /* 🌅 Day Demo button — accent magenta crystal pour le faire ressortir */
    .ywe-day-btn {
      color: var(--color-crystal-light) !important;
      text-decoration-color: var(--color-crystal) !important;
      font-weight: 700;
      text-shadow: 0 0 18px rgba(213, 74, 223, 0.55);
    }
    .ywe-day-btn:hover {
      text-decoration-color: var(--color-crystal-light) !important;
      text-shadow: 0 0 28px rgba(213, 74, 223, 0.85);
    }

    /* ─── Done screen ─── */
    .ywe-done h2 { color: var(--color-crystal-light); text-shadow: 0 0 30px rgba(213, 74, 223, 0.5); }

    /* ─── Fade-in animation par data-fade ─── */
    [data-fade] {
      opacity:0; transform: translateY(20px);
      animation: yweFade 0.8s ease-out forwards;
    }
    [data-fade]:nth-child(1) { animation-delay: 0s; }
    [data-fade]:nth-child(2) { animation-delay: 0.2s; }
    [data-fade]:nth-child(3) { animation-delay: 0.4s; }
    [data-fade]:nth-child(4) { animation-delay: 0.6s; }
    [data-fade]:nth-child(5) { animation-delay: 0.8s; }
    @keyframes yweFade {
      from { opacity:0; transform: translateY(20px); }
      to { opacity:1; transform: translateY(0); }
    }

    /* ─── Title screen : h1 énorme avec Henny Penny ─── */
    .ywe-title h1 {
      letter-spacing: 0.02em;
      text-shadow: 0 0 30px rgba(213, 74, 223, 0.45), 0 0 80px rgba(213, 74, 223, 0.2);
    }
  `]
})
export class YamzyWorldEntryComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ═══════════════════════════════════════════════════════════════════
  // STATE (signals au lieu de xstate — pattern allégé)
  // ═══════════════════════════════════════════════════════════════════
  phase = signal<EntryPhase>('idle');
  loadingProgress = signal<number>(0);
  loadingMessage = signal<string>('Invocation des étoiles…');
  tourIndex = signal<number>(0);
  tourText = signal<string>('');
  totalSteps = signal<number>(0);

  // Injection services
  voice = inject(VoiceNarratorService);
  sounds = inject(SpellSoundsService);
  private router = inject(Router);
  private ceremonyBus = inject(CeremonyBusService);

  // ═══════════════════════════════════════════════════════════════════
  // 3D refs
  // ═══════════════════════════════════════════════════════════════════
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private rafId: number = 0;
  private disposed = false;
  private elapsed = 0;
  private sky: SkyOrnamentsHandle | null = null;
  private islandRoot: any;
  private unsubCeremony: (() => void) | null = null;
  private tourAbortController: { aborted: boolean } = { aborted: false };

  ngOnInit(): void {
    // Choix de persona par défaut (créature mignonne, choix utilisateur)
    this.voice.setPersona('cute-creature');
    this.bootstrap();
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.tourAbortController.aborted = true;
    this.voice.cancel();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    window.removeEventListener('resize', this.onResize);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE MACHINE LITE — onPhaseChange (équivalent du onStateChange)
  // ═══════════════════════════════════════════════════════════════════
  private async bootstrap(): Promise<void> {
    this.phase.set('loading');
    this.loadingMessage.set('Invocation des étoiles…');
    this.loadingProgress.set(5);

    // 1) Charge Three.js depuis CDN (réel + progress)
    await this.loadThreeJs((p, msg) => {
      this.loadingProgress.set(5 + p * 0.55);  // 5..60%
      if (msg) this.loadingMessage.set(msg);
    });
    if (this.disposed) return;

    // 2) Initialise la scène 3D (île + ciel)
    this.loadingMessage.set("Façonnage de l'île…");
    this.loadingProgress.set(65);
    await this.delay(120);
    if (this.disposed) return;
    this.initScene();
    this.loadingProgress.set(85);

    // 3) Démarre la voix : warmup (charge les voix async, sans parler)
    this.loadingMessage.set('Réveil de Yamzy…');
    await this.delay(180);
    if (this.disposed) return;
    this.loadingProgress.set(100);

    // 4) Bascule sur SPLASH
    await this.delay(300);
    if (this.disposed) return;
    this.phase.set('splash');
    this.animate();  // démarre la boucle de rendu
  }

  // ─────────────────────────────────────────────────────────────────────
  // ACTIONS depuis l'UI (boutons)
  // ─────────────────────────────────────────────────────────────────────
  async startTour(): Promise<void> {
    if (this.phase() !== 'splash') return;
    this.phase.set('tour');
    this.tourAbortController = { aborted: false };
    // 🎵 Lance la musique du spell-caster + ping de transition
    this.sounds.play('ping-1', { volume: 0.4 });
    this.sounds.startMusic();
    // 🎬 Transition cinématique : caméra recule + crystal lift + island reveal
    await this.revealIslandFromCrystal();
    await this.runConte();
  }

  /**
   * 🎬 SPLASH → TOUR transition cinématique.
   *
   * Au SPLASH : crystal seul à (0,0,0), caméra (0,0.5,8) — vue serrée.
   * Au TOUR : crystal soulevé à (0,5,0) sur l'île, caméra (0,25,40) vue d'ensemble.
   *
   * Pendant la transition :
   *  - Crystal monte de (0,0,0) à (0,5,0) (4s)
   *  - Caméra recule de (0,0.5,8) à (0,25,40) (4s)
   *  - islandRoot.visible = true (révèle l'île)
   *  - 10 énergies (CrystalEnergyEmitter style) jaillissent du crystal vers chaque temple
   *  - portal sound joue au moment de la transition
   */
  private async revealIslandFromCrystal(): Promise<void> {
    const islandRoot = this.islandRoot;
    if (!islandRoot) return;
    // Reveal l'île + le ciel + l'héritage du crystal (fruits, étincelles, halo)
    islandRoot.visible = true;
    const lineageGroup = (this as any).lineageGroup;
    if (lineageGroup) lineageGroup.visible = true;
    // 💡 LIGHT SWAP : fade-out lights chaudes splash → fade-in daylight tour
    // + fade exposure 1.2 → 0.95 (moins clair, daylight balancé)
    const splashLights = (this as any).splashLights as any[];
    const tourLights = (this as any).tourLights as Array<{ light: any; target: number }>;
    const splashIntensities = splashLights ? splashLights.map(l => l.intensity) : [];
    const startExposure = this.renderer.toneMappingExposure ?? 1.2;
    const endExposure = 0.95;
    const swapDuration = 2.5;
    const swapStart = this.elapsed;
    const fadeLights = () => {
      if (this.disposed || this.tourAbortController.aborted) return;
      const dt = this.elapsed - swapStart;
      const t = Math.min(1, dt / swapDuration);
      // Splash lights fade out
      if (splashLights) {
        for (let i = 0; i < splashLights.length; i++) {
          splashLights[i].intensity = splashIntensities[i] * (1 - t);
        }
      }
      // Tour lights fade in
      if (tourLights) {
        for (const tl of tourLights) {
          tl.light.intensity = tl.target * t;
        }
      }
      // Exposure fade
      this.renderer.toneMappingExposure = startExposure + (endExposure - startExposure) * t;
      if (t < 1) requestAnimationFrame(fadeLights);
    };
    fadeLights();
    if (this.sky) {
      if (this.sky.starsField) this.sky.starsField.visible = true;
      if (this.sky.moon) this.sky.moon.visible = true;
      this.sky.setAuroraVisible(true);
      if (this.sky.cometTrail) this.sky.cometTrail.visible = true;
      this.sky.shootingStars.forEach((s: any) => s.visible = true);
    }
    this.sounds.play('portal', { volume: 0.45 });
    // EXACT spell-caster startPositions vs FAR view final
    const startCamPos = { x: 0, y: 0.4, z: 1.6 };
    const endCamPos = { x: 0, y: 25, z: 40 };
    const startLookAt = { x: 0, y: -0.1, z: 0 };
    const endLookAt = { x: 0, y: 4, z: 0 };
    // Crystal était sur la table à (0, -0.05, 0) scale 0.07
    // → on le pousse à (0, 5, 0) scale ~4 (sur l'île, vu de loin)
    const startCryPos = { x: 0, y: -0.05, z: 0 };
    const endCryPos = { x: 0, y: 5, z: 0 };
    const startCryScale = 0.07;
    const endCryScale = 4.0;
    const duration = 4.0;
    const startTime = this.elapsed;
    const crystal = (this as any).crystal;
    const crystalScene = (this as any).crystalScene;
    const roomGlb = (this as any).roomGlb;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    return new Promise(resolve => {
      const update = () => {
        if (this.disposed || this.tourAbortController.aborted) { resolve(); return; }
        const dt = this.elapsed - startTime;
        const t = Math.min(1, dt / duration);
        const k = ease(t);
        // Camera position + lookAt interpolés
        this.camera.position.set(
          startCamPos.x + (endCamPos.x - startCamPos.x) * k,
          startCamPos.y + (endCamPos.y - startCamPos.y) * k,
          startCamPos.z + (endCamPos.z - startCamPos.z) * k,
        );
        const lx = startLookAt.x + (endLookAt.x - startLookAt.x) * k;
        const ly = startLookAt.y + (endLookAt.y - startLookAt.y) * k;
        const lz = startLookAt.z + (endLookAt.z - startLookAt.z) * k;
        if (this.controls) { this.controls.target.set(lx, ly, lz); this.controls.update(); }
        else { this.camera.lookAt(lx, ly, lz); }
        // Crystal lift + scale up
        if (crystal) {
          crystal.position.set(
            startCryPos.x + (endCryPos.x - startCryPos.x) * k,
            startCryPos.y + (endCryPos.y - startCryPos.y) * k,
            startCryPos.z + (endCryPos.z - startCryPos.z) * k,
          );
        }
        if (crystalScene) {
          const s = startCryScale + (endCryScale - startCryScale) * k;
          crystalScene.scale.setScalar(s);
        }
        // Room.glb fade out (opacity sur tous les materials)
        if (roomGlb && k > 0.1) {
          const op = Math.max(0, 1 - (k - 0.1) * 1.3);
          roomGlb.traverse((c: any) => {
            if (c.isMesh && c.material) {
              c.material.transparent = true;
              c.material.opacity = op;
            }
          });
          if (op <= 0.05) roomGlb.visible = false;
        }
        if (t < 1) requestAnimationFrame(update);
        else {
          this.spawnEnergyFlows();
          resolve();
        }
      };
      update();
    });
  }

  /**
   * 💧 Énergie qui coule du crystal vers chaque temple (eau qui coule dans le vide).
   * 10 particules tubes / streaks émissives qui font un arc du crystal vers chaque temple.
   * Particules persistantes, animées dans la boucle render.
   */
  private spawnEnergyFlows(): void {
    const T = (window as any).THREE;
    if (!T || !this.islandRoot) return;
    const crystal = (this as any).crystal;
    if (!crystal) return;
    const flows: any[] = [];
    // 10 temples sont placés à rayon 18 autour du centre
    const R = 18;
    const colors = [0xd54adf, 0xd68ddc, 0xff6ec7, 0xb392f7, 0xd54adf, 0xd68ddc, 0xff6ec7, 0xb392f7, 0xd54adf, 0xd68ddc];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const target = new T.Vector3(Math.cos(angle) * R, 1.5, Math.sin(angle) * R);
      // 30 points dans le flux (path crystal → temple)
      const pointCount = 30;
      const positions = new Float32Array(pointCount * 3);
      const colorsArr = new Float32Array(pointCount * 3);
      const c = new T.Color(colors[i]);
      for (let j = 0; j < pointCount; j++) {
        positions[j * 3] = 0; positions[j * 3 + 1] = 5; positions[j * 3 + 2] = 0;
        colorsArr[j * 3] = c.r; colorsArr[j * 3 + 1] = c.g; colorsArr[j * 3 + 2] = c.b;
      }
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.BufferAttribute(positions, 3));
      geom.setAttribute('color', new T.BufferAttribute(colorsArr, 3));
      const mat = new T.PointsMaterial({
        size: 0.45, vertexColors: true, transparent: true, opacity: 0.85,
        blending: T.AdditiveBlending, sizeAttenuation: true, fog: false,
      });
      const pts = new T.Points(geom, mat);
      pts.userData = {
        flow: true,
        target,
        offset: i * 0.3,
        speed: 0.55 + (i % 3) * 0.1,
      };
      this.scene.add(pts);
      flows.push(pts);
    }
    (this as any).energyFlows = flows;
    console.log('[YamzyEntry] 💧 10 energy flows spawned');
  }

  enterWorld(): void {
    this.voice.cancel();
    this.tourAbortController.aborted = true;
    // Mémorise la visite (skip auto à la prochaine fois)
    try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
    this.router.navigate(['/yamzy-island']);
  }

  /** Change la voix de Yamzy (persona) */
  pickVoice(p: VoicePersona): void {
    this.voice.setPersona(p);
  }
  /** Test rapide de la voix avec la persona courante */
  testVoice(): void {
    this.voice.testVoice();
  }

  /**
   * Titre fantasy par page du conte (affiché comme h3 dans les instructions).
   * Pattern inspiré du spell-caster ("Protect the crystal", "Face the onslaught", …)
   */
  getStepTitle(): string {
    const titles = [
      'Il était une fois…',
      "Le disque de jade",
      "Le Cristal des Lignées",
      'Dix temples en cercle',
      "L'Archipel & la Galerie",
      "La Forge du Phénix",
      "La Montagne des Sommets",
      'Les sages de l\'ouest',
      "Voix, fioles & cartes",
      'Onze portes, une île',
      'Les sept ateliers',
      "💧 La Fontaine de Mana",
      'Le ciel-horloge',
      "Aurore, comète & filante",
      'Supernova & éclipse',
      'Bonne route, Mage',
    ];
    return titles[this.tourIndex()] ?? 'Le conte';
  }
  skipToConclave(): void {
    try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
    this.router.navigate(['/conclave']);
  }
  goShowcase(): void {
    try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
    this.router.navigate(['/showcase/yamzy-world']);
  }

  // ─── Demo Day overlay ────────────────────────────────────────────
  dayDemoOpen = signal<boolean>(false);
  openDayDemo(): void {
    this.sounds.play('ping-1', { volume: 0.35 });
    this.dayDemoOpen.set(true);
  }

  // ═══════════════════════════════════════════════════════════════════
  // LE CONTE : suite séquentielle de pages (voix → onend → anim → next)
  // ═══════════════════════════════════════════════════════════════════
  private async runConte(): Promise<void> {
    // ───────────────────────────────────────────────────────────────────
    // 🌙 LE CONTE DE YAMZY — 14 pages cinématiques, 3 actes
    //
    //   Acte I : Prologue (pages 1-3)      → poser l'univers
    //   Acte II : Le Tour des Temples (4-10) → présenter les 11 rooms par geste
    //   Acte III : Le Pacte du Ciel (11-14)  → cérémonies enchaînées + invitation
    // ───────────────────────────────────────────────────────────────────
    const steps: ConteStep[] = [
      // ═══════════ ACTE I — PROLOGUE ═══════════
      {
        // Très haut, vue d'oiseau — l'île respire dans le noir
        text: "Il était une fois… un royaume sans cartes ni roi, où les jours se mesuraient en cérémonies et les nuits en étoiles tombées. On l'appelait le Royaume des Mages.",
        animate: () => this.animateCamera({ x: 0, y: 38, z: 42 }, { x: 0, y: 2, z: 0 }, 5.5),
      },
      {
        // Plongée douce vers l'île — révèle le crystal central
        text: "Au centre de tout, une île verte, ronde comme un disque de jade, posée sur un océan qui ne dort jamais. Sur cette île flotte un cristal — le Cristal des Lignées — et ses éclats dorés sont les œuvres des Mages.",
        animate: () => this.animateCamera({ x: 5, y: 40, z: 50 }, { x: 0, y: 6, z: 0 }, 5.0),
      },
      {
        // Approche du halo, éclats orbitants
        text: "Chaque éclat qui orbite là-haut, scintillant comme une lanterne, est une release. Chaque étincelle qui tombe est un commit. Le cristal se souvient de tout, même de ce qu'aucun journal n'écrira jamais.",
        animate: () => this.animateCamera({ x: -8, y: 18, z: 28 }, { x: 0, y: 6, z: 0 }, 4.5),
      },

      // ═══════════ ACTE II — LE TOUR DES TEMPLES ═══════════
      {
        // Pivot vers les temples — vue d'ensemble en orbite
        text: "Autour du cristal, dix temples dansent en cercle. Chacun garde un secret du métier de Mage. Suis-moi, je vais te les nommer un par un, comme un berger appelle ses brebis au crépuscule.",
        animate: () => this.animateCamera({ x: 28, y: 22, z: 0 }, { x: 0, y: 4, z: 0 }, 5.0),
      },
      {
        // Pan vers temple 1 et 2 (côté est)
        text: "Voici l'Archipel des Quêtes — là où les tickets prennent forme d'îles flottantes. Et voilà la Galerie des Vérités, où chaque pull request se contemple dans un miroir avant d'être scellée.",
        animate: () => this.animateCamera({ x: 22, y: 14, z: 14 }, { x: 8, y: 2, z: 8 }, 4.5),
      },
      {
        // Pan vers Phoenix Forge + spawn comète orange
        text: "Et là, regarde — la Forge du Phénix s'illumine. Chaque fois qu'un Mage du Royaume publie une release, une comète orange traverse le ciel. Vois… une vient de naître.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'renaissance', label: 'Release v1.0.143', icon: '🐦', sourceRoom: 'phoenix-forge' });
          await this.delay(400);
          await this.animateCamera({ x: 18, y: 12, z: -2 }, { x: 14, y: 3, z: -6 }, 4.5);
        },
      },
      {
        // Pan vers OKR Mountain + spawn aurore verte
        text: "Au nord se dresse la Montagne des Sommets. Quand un Compagnon plante un drapeau au pic, une aurore verte caresse ses pentes pour mille battements de cœur. Une vient de fleurir, là, juste pour toi.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'sommet', label: 'OKR Q1 atteint', icon: '⛰', sourceRoom: 'okr-mountain' });
          await this.delay(400);
          await this.animateCamera({ x: -16, y: 10, z: 8 }, { x: -10, y: 3, z: 0 }, 4.5);
        },
      },
      {
        // Library Cathedral + Star Map (côté ouest)
        text: "À l'ouest reposent les sages. La Bibliothèque du Conclave garde les leçons apprises — toutes celles qu'on aurait préféré apprendre plus tôt. À côté, la Carte Céleste des Périls signale les risques qui rôdent.",
        animate: () => this.animateCamera({ x: -22, y: 14, z: -10 }, { x: -10, y: 2, z: -6 }, 4.5),
      },
      {
        // Oracle Aquarium + Alchemist Cellar + Card Tavern
        text: "Plus loin, l'Étang des Voix Oracle écoute la communauté. La Cave aux Fioles distille les coûts en gemmes d'optimisation. Et la Taverne aux Cartes du Destin tire au sort les estimations.",
        animate: () => this.animateCamera({ x: -18, y: 12, z: -16 }, { x: -8, y: 2, z: -12 }, 4.5),
      },
      {
        // Retour vue large pour montrer l'unité
        text: "Onze temples, un seul Royaume. Onze portes, une seule île. Et toi, Mage, tu peux les visiter dans l'ordre qui te chante — il n'y a pas de bon chemin, il n'y a que le tien.",
        animate: () => this.animateCamera({ x: 0, y: 30, z: 38 }, { x: 0, y: 4, z: 0 }, 5.0),
      },

      // ═══════════ ACTE II-bis — LES WORKSHOPS DU SCRUM ═══════════
      {
        // Workshops Scrum mentionnés brièvement
        text: "Aux ateliers, sept ruelles bordent la grande place : la fontaine de Mana, le navire des rétrospectives, le caveau des pré-mortems, le verger des affinages, le puits des cinq pourquoi, la brûlerie des cafés lean, et la plage des définitions. Sept manières de tenir conseil entre Mages.",
        animate: () => this.animateCamera({ x: 12, y: 18, z: 16 }, { x: 6, y: 2, z: 6 }, 5.0),
      },
      {
        // Page-clé : sensibilisation eau / IA / $
        text: "Mais souviens-toi, voyageur — au cœur de la place trône une fontaine de Mana. Chaque sort lancé puise dans sa source. Cette eau, c'est celle qui refroidit les datacenters où vit la magie de l'IA. Chaque goutte coûte des tokens, des centimes, et des millilitres bien réels. Voir la goutte tomber, c'est se souvenir qu'aucune magie n'est gratuite.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'aube', label: 'Goutte de mana', icon: '💧', sourceRoom: 'welcome' });
          await this.animateCamera({ x: 0, y: 14, z: 22 }, { x: 0, y: 3, z: 6 }, 5.0);
        },
      },

      // ═══════════ ACTE III — LE PACTE DU CIEL ═══════════
      {
        // Camera lève les yeux vers le ciel + spawn 3 cérémonies cascade
        text: "Lève les yeux. Le ciel n'est pas un décor — c'est la grande horloge du Royaume. Chaque battement d'aile d'un Mage, où qu'il soit, fait scintiller une étoile ici. Regarde…",
        animate: async () => {
          // Cascade de 3 cérémonies pour démontrer la richesse du ciel
          this.ceremonyBus.publish({ type: 'flag', label: 'Drapeau planté', icon: '🏳', sourceRoom: 'okr-mountain' });
          await this.delay(450);
          this.ceremonyBus.publish({ type: 'bloom', label: 'Nouvelle branche', icon: '🌸', sourceRoom: 'git-tree' });
          await this.delay(450);
          this.ceremonyBus.publish({ type: 'aube', label: 'Daily stand-up', icon: '🌅', sourceRoom: 'kanban-island' });
          await this.animateCamera({ x: 0, y: 22, z: 22 }, { x: 0, y: 22, z: -10 }, 4.0);
        },
      },
      {
        // Plongée vers fond ciel — montrer aurora
        text: "L'aurore que tu vois là-haut respire au rythme du sprint. Cette traînée de comète, c'est une release d'il y a quelques heures qui hante encore les nues. Et cette étoile filante qui passe… vient de naître d'un drapeau planté.",
        animate: () => this.animateCamera({ x: -6, y: 28, z: 30 }, { x: -8, y: 30, z: -30 }, 4.5),
      },
      {
        // Spawn d'une dernière cérémonie majeure + retour caméra splash
        text: "Quand un Mage relâche une version majeure — une supernova rose éclate. Quand une éclipse rouge tombe, c'est qu'un incident est en cours. Le ciel pleure, danse, prie. Il n'oublie jamais.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'supernova', label: 'Release majeure v2.0', icon: '🌟', sourceRoom: 'phoenix-forge' });
          await this.delay(400);
          await this.animateCamera({ x: 5, y: 35, z: 42 }, { x: 0, y: 8, z: 0 }, 5.0);
        },
      },
      {
        // Fin : recul cinématique + invitation finale
        text: "Maintenant tu sais. Le Royaume est à toi — il n'attend qu'un nom pour s'animer. Pose une intention, écris un commit, plante un drapeau. Chaque geste posé ici devient un fragment de ton conte. Bonne route, Mage.",
        animate: () => this.animateCamera({ x: 0, y: 45, z: 55 }, { x: 0, y: 2, z: 0 }, 6.0),
      },
    ];

    this.totalSteps.set(steps.length);

    for (let i = 0; i < steps.length; i++) {
      if (this.tourAbortController.aborted || this.disposed) break;
      const step = steps[i];
      this.tourIndex.set(i);
      this.tourText.set(step.text);
      // 1) Voix d'abord (séquentiel — attend onend)
      await this.voice.speak(step.text);
      if (this.tourAbortController.aborted || this.disposed) break;
      // 2) Animation 3D ensuite
      await step.animate();
    }

    if (!this.tourAbortController.aborted && !this.disposed) {
      this.phase.set('done');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCÈNE 3D — Île procédurale + ciel universel
  // ═══════════════════════════════════════════════════════════════════
  private async loadThreeJs(progress: (pct: number, msg?: string) => void): Promise<void> {
    progress(10, 'Téléchargement de Three.js…');
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    progress(35, 'Préparation des contrôles…');
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    progress(55, 'Chargement du loader GLB…');
    if (!(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    progress(75, 'Décodeur Draco…');
    if (!(window as any).THREE?.DRACOLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
    }
    progress(100, 'Three.js prêt');
  }

  /**
   * Charge le room.glb (chambre du Conclave / spell-caster room).
   * Path: /assets/conclave/models/room.glb (déjà bundlé)
   */
  private loadRoomGlb(T: any): Promise<any | null> {
    const GLTFLoader = T.GLTFLoader;
    const DRACOLoader = T.DRACOLoader;
    if (!GLTFLoader) return Promise.resolve(null);
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      if (DRACOLoader) {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(draco);
      }
      loader.load('/assets/conclave/models/room.glb',
        (gltf: any) => {
          gltf.scene.traverse((c: any) => {
            if (c.isMesh) c.frustumCulled = false;
          });
          resolve(gltf.scene);
        },
        undefined,
        (err: any) => { console.warn('[YamzyEntry] room.glb load failed', err); resolve(null); }
      );
    });
  }

  /**
   * Charge le crystal GLB EXACT du spell-caster / conclave.
   * Path: /assets/conclave/models/crystal.glb (déjà bundlé)
   */
  private loadCrystalGlb(T: any): Promise<any | null> {
    const GLTFLoader = T.GLTFLoader;
    const DRACOLoader = T.DRACOLoader;
    if (!GLTFLoader) {
      console.warn('[YamzyEntry] GLTFLoader unavailable, fallback to icosahedron');
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      if (DRACOLoader) {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(draco);
      }
      loader.load('/assets/conclave/models/crystal.glb',
        (gltf: any) => {
          gltf.scene.traverse((c: any) => {
            if (c.isMesh) c.frustumCulled = false;
          });
          resolve(gltf.scene);
        },
        undefined,
        (err: any) => {
          console.warn('[YamzyEntry] crystal.glb load failed', err);
          resolve(null);
        }
      );
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise(r => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => r(); s.onerror = () => r();
      document.head.appendChild(s);
    });
  }

  private initScene(): void {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new T.Scene();
    // ═══ EXACT spell-caster / conclave-room setup ═══
    this.scene.background = new T.Color('#000000');

    // 📷 Caméra spell-caster (EXACTEMENT comme conclave-room.component.ts)
    // FAR étendu à 350 pour permettre les vues hautes de l'île pendant le tour
    this.camera = new T.PerspectiveCamera(35, w / h, 0.1, 350);
    this.camera.position.set(0, 0.4, 1.6);
    this.camera.lookAt(0, -0.1, 0);

    // Renderer cinematic (recette FAB Yamzy)
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // ═══ LIGHTING — 2 sets selon la phase ═══
    // SPLASH (chambre du Conclave, candlelit) : lights chaudes spell-caster
    const splashHemi = new T.HemisphereLight(0xfff5e6, 0x4a3f7a, 1.0);
    this.scene.add(splashHemi);
    const splashAmb = new T.AmbientLight(0xfff0d4, 0.75);
    this.scene.add(splashAmb);
    const splashKey = new T.DirectionalLight(0xffeedd, 0.9);
    splashKey.position.set(2, 3, 3);
    this.scene.add(splashKey);
    // Glow violet pour le crystal (signature spell-caster)
    const crystalGlow = new T.PointLight(0x9b6cff, 0.7, 5);
    crystalGlow.position.set(0, 0.1, 0);
    this.scene.add(crystalGlow);
    (this as any).crystalGlow = crystalGlow;
    (this as any).splashLights = [splashHemi, splashAmb, splashKey];

    // TOUR (île de jour, daylight neutre) : lights froides/balanced, OFF par défaut
    const tourHemi = new T.HemisphereLight(0xb8d8ff, 0x3a5a3a, 0.0);
    this.scene.add(tourHemi);
    const tourAmb = new T.AmbientLight(0xffffff, 0.0);
    this.scene.add(tourAmb);
    const tourSun = new T.DirectionalLight(0xfff8e7, 0.0);
    tourSun.position.set(20, 35, 18);
    this.scene.add(tourSun);
    const tourFill = new T.DirectionalLight(0xc8d8ff, 0.0); // light du nord froide
    tourFill.position.set(-15, 22, -10);
    this.scene.add(tourFill);
    (this as any).tourLights = [
      { light: tourHemi, target: 0.35 },
      { light: tourAmb, target: 0.20 },
      { light: tourSun, target: 0.55 },
      { light: tourFill, target: 0.18 },
    ];

    // Ciel universel (créé mais caché pendant SPLASH = chambre fermée)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 800,
      starRadius: 110,
      moonPos: [-25, 38, -20],
      auroraPos: [0, 42, -55],
      cometPos: [28, 32, -25],
      shootingStarCount: 7,
    });
    // Cache toutes les composantes célestes pendant SPLASH
    if (this.sky) {
      if (this.sky.starsField) this.sky.starsField.visible = false;
      if (this.sky.moon) this.sky.moon.visible = false;
      this.sky.setAuroraVisible(false);
      if (this.sky.cometTrail) this.sky.cometTrail.visible = false;
      this.sky.shootingStars.forEach((s: any) => s.visible = false);
    }

    // Subscribe au CeremonyBus (les pulses du conte feront briller le ciel)
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'welcome') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Construit l'île procédurale
    this.islandRoot = new T.Group();
    this.scene.add(this.islandRoot);
    this.buildIsland(T);
    // 🌫 Cache l'île pendant SPLASH — seul le crystal sera visible
    // (le crystal est dans this.scene direct, pas dans islandRoot)
    this.islandRoot.visible = false;

    // OrbitControls — désactivés pendant SPLASH (caméra figée comme spell-caster TITLE)
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, -0.1, 0); // EXACT spell-caster lookAt
      this.controls.enabled = false;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Île procédurale : disque vert + océan + 11 mini-temples symbolisant les rooms.
   * Pas de GLB — Three.js pur, design proche du yamzy-island-hub mais aérien.
   */
  private buildIsland(T: any): void {
    // Disque île
    const islandRadius = 25;
    const island = new T.Mesh(
      new T.CylinderGeometry(islandRadius, islandRadius + 2, 1.2, 64),
      new T.MeshStandardMaterial({ color: 0x5d9168, roughness: 0.95 })
    );
    island.position.y = -0.6;
    this.islandRoot.add(island);

    // Plage
    const beach = new T.Mesh(
      new T.RingGeometry(islandRadius - 1, islandRadius + 1.5, 64),
      new T.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.95, side: T.DoubleSide })
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 0.06;
    this.islandRoot.add(beach);

    // Océan
    const ocean = new T.Mesh(
      new T.PlaneGeometry(180, 180, 64, 64),
      new T.MeshStandardMaterial({ color: 0x1a3a6e, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.85 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1.8;
    this.islandRoot.add(ocean);
    const oceanBase = new Float32Array(ocean.geometry.attributes.position.array);
    (ocean as any).userData.basePos = oceanBase;
    (this as any).ocean = ocean;

    // ═══════════════════════════════════════════════════════════════
    // 💎 ROOM + CRYSTAL — EXACT spell-caster / conclave-room recipe
    //
    // SPLASH state:
    //   - room.glb scale 0.18 position (0, -0.4, -0.4)   ← chambre du Conclave
    //   - crystal.glb scale 0.07 position (0, -0.05, 0)  ← crystal sur la table
    //   - camera (0, 0.4, 1.6) lookAt (0, -0.1, 0)
    //
    // TOUR state:
    //   - room.glb fade out + hide
    //   - crystal scale up to ~4 + move to (0, 5, 0) on island
    //   - islandRoot.visible = true
    //   - camera flies back to (0, 25, 40)
    // ═══════════════════════════════════════════════════════════════
    const crystalGroup = new T.Group();
    // SPLASH position EXACT spell-caster — crystal sur la table de la chambre
    crystalGroup.position.set(0, -0.05, 0);
    this.scene.add(crystalGroup);
    (this as any).crystal = crystalGroup;

    // ═══════════════════════════════════════════════════════════════
    // 🍂 HÉRITAGE DE L'ARBRE — fruits orbitaux + étincelles + halo
    // L'arbre disparu a légué : ses fruits dorés (releases), ses
    // feuilles qui tombent (commits), son halo lumineux (sagesse).
    // Tout devient enfant du crystalGroup pour suivre ses mouvements.
    // ═══════════════════════════════════════════════════════════════
    const lineageGroup = new T.Group();
    crystalGroup.add(lineageGroup);
    (this as any).lineageGroup = lineageGroup;

    // 🍇 7 fruits dorés orbitant le crystal (= releases tagged)
    const fruits: any[] = [];
    for (let i = 0; i < 7; i++) {
      const fruit = new T.Mesh(
        new T.SphereGeometry(0.4, 12, 8),
        new T.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.8,
          transparent: true, opacity: 0.95,
        })
      );
      fruit.userData = {
        baseAngle: (i / 7) * Math.PI * 2,
        radius: 3.2 + (i % 3) * 0.5,
        speed: 0.25 + (i % 4) * 0.06,
        yPhase: i * 0.7,
        yAmp: 0.6 + (i % 3) * 0.4,
      };
      // Halo additif autour de chaque fruit
      const fruitHalo = new T.Mesh(
        new T.SphereGeometry(0.65, 10, 8),
        new T.MeshBasicMaterial({
          color: 0xfde047, transparent: true, opacity: 0.35,
          blending: T.AdditiveBlending, depthWrite: false,
        })
      );
      fruit.add(fruitHalo);
      lineageGroup.add(fruit);
      fruits.push(fruit);
    }
    (this as any).crystalFruits = fruits;

    // 🌟 Étincelles qui tombent depuis le crystal (= commits)
    const sparkCount = 60;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkSpeeds = new Float32Array(sparkCount);
    const sparkBaseY = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 4;
      sparkPos[i * 3 + 0] = Math.cos(angle) * r;
      sparkPos[i * 3 + 1] = 6 + Math.random() * 4;
      sparkPos[i * 3 + 2] = Math.sin(angle) * r;
      sparkSpeeds[i] = 1.0 + Math.random() * 1.5;
      sparkBaseY[i] = sparkPos[i * 3 + 1];
    }
    const sparkGeom = new T.BufferGeometry();
    sparkGeom.setAttribute('position', new T.BufferAttribute(sparkPos, 3));
    const sparkMat = new T.PointsMaterial({
      size: 0.18, color: 0xfde047, transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, sizeAttenuation: true,
    });
    const sparks = new T.Points(sparkGeom, sparkMat);
    sparks.userData = { speeds: sparkSpeeds, baseY: sparkBaseY };
    lineageGroup.add(sparks);
    (this as any).crystalSparks = sparks;

    // ✨ Aura discrète autour du crystal (halo additif, taille modérée)
    const auraInner = new T.Mesh(
      new T.SphereGeometry(1.4, 24, 16),
      new T.MeshBasicMaterial({
        color: 0xd54adf, transparent: true, opacity: 0.10,
        blending: T.AdditiveBlending, depthWrite: false,
      })
    );
    const auraOuter = new T.Mesh(
      new T.SphereGeometry(2.0, 20, 14),
      new T.MeshBasicMaterial({
        color: 0xd68ddc, transparent: true, opacity: 0.05,
        blending: T.AdditiveBlending, depthWrite: false,
      })
    );
    lineageGroup.add(auraInner);
    lineageGroup.add(auraOuter);
    (this as any).crystalAura = [auraInner, auraOuter];

    // 💍 3 anneaux d'orbite (rappel des éclats qui circulent)
    const rings: any[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(
        new T.TorusGeometry(3.2 + i * 0.45, 0.04, 8, 64),
        new T.MeshStandardMaterial({
          color: 0xd68ddc, emissive: 0xd68ddc, emissiveIntensity: 0.7,
          transparent: true, opacity: 0.65,
        })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.35;
      ring.userData = { spinSpeed: 0.2 + i * 0.12, axis: i % 2 === 0 ? 'y' : 'z' };
      lineageGroup.add(ring);
      rings.push(ring);
    }
    (this as any).crystalRings = rings;

    // Lineage est CACHÉ pendant SPLASH (room visible only) ; révélé en TOUR
    lineageGroup.visible = false;

    // Texture matcap PNG officielle (sera appliquée au GLB)
    const matcapTexture = new T.TextureLoader().load('/assets/conclave/crystal-matcap.png');
    const matcapMaterial = new T.MeshMatcapMaterial({
      matcap: matcapTexture,
      side: T.DoubleSide,
    });
    (this as any).matcapMaterial = matcapMaterial;

    // Charge le room.glb (chambre du Conclave)
    this.loadRoomGlb(T).then((roomScene: any) => {
      if (this.disposed) return;
      if (roomScene) {
        roomScene.scale.setScalar(0.18);
        roomScene.position.set(0, -0.4, -0.4);
        this.scene.add(roomScene);
        (this as any).roomGlb = roomScene;
        console.log('[YamzyEntry] ✓ room.glb loaded');
      }
    });

    // Charge le crystal.glb
    this.loadCrystalGlb(T).then((crystalScene: any) => {
      if (this.disposed) return;
      if (crystalScene) {
        // EXACT spell-caster : scale 0.07, matcap material appliqué partout
        crystalScene.scale.setScalar(0.07);
        crystalScene.userData.spin = true;
        crystalScene.traverse((c: any) => {
          if (c.isMesh) {
            c.material = matcapMaterial;
            c.frustumCulled = false;
          }
        });
        crystalGroup.add(crystalScene);
        (this as any).crystalScene = crystalScene;
        console.log('[YamzyEntry] ✓ crystal.glb + matcap.png loaded');
        this.sounds.play('crystal-reform', { volume: 0.55 });
      }
    });

    // 10 mini-temples autour (un par room — sans détailler)
    const ROOMS = [
      { angle: 0.00, color: 0x15803d, shape: 'tree' },     // git-tree
      { angle: 0.10, color: 0x7dd3fc, shape: 'cone' },     // kanban-island
      { angle: 0.20, color: 0xa3e9ff, shape: 'box' },      // pr-mirror-hall
      { angle: 0.30, color: 0xea580c, shape: 'flame' },    // phoenix-forge
      { angle: 0.40, color: 0xa855f7, shape: 'mountain' }, // okr-mountain
      { angle: 0.50, color: 0x0891b2, shape: 'cathedral' },// library
      { angle: 0.60, color: 0x8b1a1a, shape: 'dome' },     // star-map
      { angle: 0.70, color: 0xa855f7, shape: 'tank' },     // oracle
      { angle: 0.80, color: 0x84cc16, shape: 'tower' },    // alchemist
      { angle: 0.90, color: 0xfbbf24, shape: 'inn' },      // card-tavern
    ];
    const R = 18;
    for (const room of ROOMS) {
      const a = room.angle * Math.PI * 2;
      const pos = new T.Vector3(Math.cos(a) * R, 0.5, Math.sin(a) * R);
      this.spawnRoomToken(T, pos, room.color, room.shape);
    }
  }

  private spawnRoomToken(T: any, pos: any, color: number, shape: string): void {
    const group = new T.Group();
    group.position.copy(pos);
    const mat = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    // Socle commun
    group.add(new T.Mesh(
      new T.CylinderGeometry(1.4, 1.6, 0.3, 12),
      new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, metalness: 0.5 })
    ));
    // Forme iconique
    let main: any;
    switch (shape) {
      case 'tree':
        main = new T.Mesh(new T.ConeGeometry(0.9, 1.6, 8), mat); break;
      case 'cone':
        main = new T.Mesh(new T.ConeGeometry(1.0, 1.5, 12), mat); break;
      case 'box':
        main = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 1.4), mat); break;
      case 'flame':
        main = new T.Mesh(new T.ConeGeometry(0.6, 1.6, 6), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 })); break;
      case 'mountain':
        main = new T.Mesh(new T.ConeGeometry(1.2, 2.0, 8), mat); break;
      case 'cathedral': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.BoxGeometry(1.3, 1.4, 1.3), mat));
        const spire = new T.Mesh(new T.ConeGeometry(0.55, 1.4, 4), mat);
        spire.position.y = 1.4;
        g.add(spire);
        main = g;
        break;
      }
      case 'dome': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.CylinderGeometry(0.9, 0.95, 1.2, 12), new T.MeshStandardMaterial({ color: 0x4a4f60, roughness: 0.85 })));
        const dome = new T.Mesh(new T.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        dome.position.y = 0.6;
        g.add(dome);
        main = g;
        break;
      }
      case 'tank':
        main = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 1.4), new T.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.55, transmission: 0.6 }));
        break;
      case 'tower': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.CylinderGeometry(0.6, 0.8, 1.8, 8), new T.MeshStandardMaterial({ color: 0x6a7080 })));
        const roof = new T.Mesh(new T.ConeGeometry(0.7, 0.8, 8), mat);
        roof.position.y = 1.4;
        g.add(roof);
        main = g;
        break;
      }
      case 'inn': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.BoxGeometry(1.5, 1.0, 1.3), new T.MeshStandardMaterial({ color: 0x8b6b3e })));
        const roof = new T.Mesh(new T.ConeGeometry(1.2, 0.9, 4), mat);
        roof.position.y = 0.95; roof.rotation.y = Math.PI / 4;
        g.add(roof);
        main = g;
        break;
      }
      default:
        main = new T.Mesh(new T.SphereGeometry(0.8, 16, 12), mat);
    }
    main.position.y = 1.0;
    group.add(main);
    // Halo
    const halo = new T.Mesh(
      new T.RingGeometry(1.6, 1.9, 32),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: T.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.18;
    halo.userData.isHalo = true;
    group.add(halo);
    this.islandRoot.add(group);
  }

  /**
   * Animation caméra fluide (lerp pos + target). Retourne Promise qui résout à la fin.
   */
  private animateCamera(toPos: { x: number, y: number, z: number }, toTarget: { x: number, y: number, z: number }, durationS: number): Promise<void> {
    return new Promise(resolve => {
      const startPos = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
      const startTarget = { x: this.controls?.target?.x ?? 0, y: this.controls?.target?.y ?? 0, z: this.controls?.target?.z ?? 0 };
      const startTime = this.elapsed;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);  // easeOutCubic

      const update = () => {
        if (this.disposed || this.tourAbortController.aborted) { resolve(); return; }
        const dt = this.elapsed - startTime;
        const t = Math.min(1, dt / durationS);
        const k = ease(t);
        this.camera.position.set(
          startPos.x + (toPos.x - startPos.x) * k,
          startPos.y + (toPos.y - startPos.y) * k,
          startPos.z + (toPos.z - startPos.z) * k,
        );
        if (this.controls) {
          this.controls.target.set(
            startTarget.x + (toTarget.x - startTarget.x) * k,
            startTarget.y + (toTarget.y - startTarget.y) * k,
            startTarget.z + (toTarget.z - startTarget.z) * k,
          );
          this.controls.update();
        } else {
          this.camera.lookAt(toTarget.x, toTarget.y, toTarget.z);
        }
        if (t < 1) requestAnimationFrame(update);
        else resolve();
      };
      update();
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // Ocean waves
    const ocean = (this as any).ocean;
    if (ocean) {
      const pos = ocean.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const base = (ocean as any).userData.basePos as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        arr[i * 3 + 1] = Math.sin(x * 0.12 + this.elapsed * 0.7) * 0.35 + Math.cos(z * 0.15 + this.elapsed * 0.5) * 0.28;
      }
      pos.needsUpdate = true;
    }

    // 💎 Crystal — EXACT spell-caster anim
    //   crystalScene (le GLB) : rotation.y += t*0.4, rotation.x = cos(t)*0.1, rotation.z = cos(t)*0.07
    //   crystalGroup (le wrapper) : position.y bobbing autour de la position de base
    //   ATTENTION : on n'override pas la position pendant revealIslandFromCrystal (qui lerp aussi y)
    const crystalScene = (this as any).crystalScene;
    if (crystalScene) {
      crystalScene.rotation.y = this.elapsed * 0.4;
      crystalScene.rotation.x = Math.cos(this.elapsed) * 0.1;
      crystalScene.rotation.z = Math.cos(this.elapsed) * 0.07;
    }

    // 🍇 LINEAGE (héritage de l'arbre disparu) — fruits orbitaux, étincelles, halo, anneaux
    const lineageGroup = (this as any).lineageGroup;
    if (lineageGroup && lineageGroup.visible) {
      // Fruits dorés orbitant le crystal
      const fruits = (this as any).crystalFruits as any[];
      if (fruits) {
        for (const f of fruits) {
          const ud = f.userData;
          const angle = ud.baseAngle + this.elapsed * ud.speed;
          f.position.x = Math.cos(angle) * ud.radius;
          f.position.z = Math.sin(angle) * ud.radius;
          f.position.y = 0 + Math.sin(this.elapsed * 0.8 + ud.yPhase) * ud.yAmp;
          // Pulse de l'emissive
          if (f.material) {
            f.material.emissiveIntensity = 1.6 + Math.sin(this.elapsed * 2 + ud.yPhase) * 0.4;
          }
        }
      }
      // Étincelles qui tombent (commits)
      const sparks = (this as any).crystalSparks;
      if (sparks) {
        const pos = sparks.geometry.attributes.position;
        const arr = pos.array as Float32Array;
        const speeds = sparks.userData.speeds as Float32Array;
        const baseY = sparks.userData.baseY as Float32Array;
        for (let i = 0; i < speeds.length; i++) {
          arr[i * 3 + 1] -= speeds[i] * dt;
          // Respawn en haut quand atteint le bas
          if (arr[i * 3 + 1] < -2) {
            arr[i * 3 + 1] = baseY[i];
          }
        }
        pos.needsUpdate = true;
        if (sparks.material) {
          sparks.material.opacity = 0.75 + Math.sin(this.elapsed * 1.3) * 0.15;
        }
      }
      // Aura pulsante (discrète)
      const aura = (this as any).crystalAura as any[];
      if (aura) {
        aura[0].material.opacity = 0.10 + Math.sin(this.elapsed * 1.1) * 0.04;
        aura[0].scale.setScalar(1 + Math.sin(this.elapsed * 0.7) * 0.04);
        aura[1].material.opacity = 0.05 + Math.sin(this.elapsed * 0.9 + 1.5) * 0.025;
        aura[1].scale.setScalar(1 + Math.sin(this.elapsed * 0.5 + 0.8) * 0.03);
      }
      // Anneaux qui orbitent
      const rings = (this as any).crystalRings as any[];
      if (rings) {
        for (const r of rings) {
          if (r.userData.axis === 'y') r.rotation.y += dt * r.userData.spinSpeed;
          else r.rotation.z += dt * r.userData.spinSpeed;
        }
      }
    }

    // 🏠 Room.glb rotation TRÈS lente (effet panoramique, EXACT conclave-room)
    const roomGlb = (this as any).roomGlb;
    if (roomGlb && roomGlb.visible) {
      roomGlb.rotation.y = Math.sin(this.elapsed * 0.05) * 0.1;
    }

    // Halos pulsing
    if (this.islandRoot) {
      this.islandRoot.traverse((obj: any) => {
        if (obj.userData?.isHalo && obj.material) {
          obj.material.opacity = 0.3 + Math.sin(this.elapsed * 1.6 + obj.position.x * 0.1) * 0.15;
        }
      });
    }

    // 💧 ÉNERGIE qui coule du crystal vers les temples (eau dans le vide)
    const flows = (this as any).energyFlows;
    if (flows) {
      for (const pts of flows) {
        const ud = pts.userData;
        const target = ud.target;
        const positions = pts.geometry.attributes.position.array as Float32Array;
        const count = positions.length / 3;
        // Chaque point se déplace le long d'un arc parabolique de crystal vers target
        // Pour faire l'effet "eau qui coule", chaque point a un offset progressif
        for (let j = 0; j < count; j++) {
          // Phase qui cycle : 0..1 le long du trajet, basée sur elapsed + index
          const phase = ((this.elapsed * ud.speed + j * 0.03 + ud.offset) % 1);
          // Position interpolée crystal → target avec un arc (parabolic up then down)
          const t = phase;
          const ax = 0 + (target.x - 0) * t;
          const az = 0 + (target.z - 0) * t;
          // Arc : y = start_y + sin(π*t) * arc_height
          const ay = 5 + Math.sin(Math.PI * t) * 6 - t * 3.5;
          positions[j * 3] = ax;
          positions[j * 3 + 1] = ay;
          positions[j * 3 + 2] = az;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        // Pulse opacity
        if (pts.material) {
          pts.material.opacity = 0.7 + Math.sin(this.elapsed * 3 + ud.offset * 6) * 0.2;
        }
      }
    }

    // Sky universel
    this.sky?.tick(dt, this.elapsed);

    // Auto-rotation lente pendant splash (effet "monde qui respire")
    if (this.phase() === 'splash' && this.islandRoot) {
      this.islandRoot.rotation.y += dt * 0.04;
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Utility delay
  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
