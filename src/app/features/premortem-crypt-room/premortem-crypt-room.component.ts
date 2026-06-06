// ═══════════════════════════════════════════════════════════════════
// ⚰ PRE-MORTEM CRYPT ROOM — Le Caveau des Pré-Mortems
//
// Workshop scrum (Gary Klein method) : avant d'engager une release ou
// un sprint, le Mage descend dans la Crypte et imagine que le projet
// est déjà MORT. Chaque sarcophage = une cause de mort hypothétique.
// Les bougies allumées par les Compagnons votent l'impact, les runes
// gravées scellent les contre-mesures.
//
// Implémentation : Three.js procedural, pure code (no GLB).
// Pattern : héritage de yamzy-room-engine (cf. docs/YAMZY_WORLD_ROOMS/).
//
// Cérémonies détectées :
//   🚨 Sirène   = risque critique identifié (bougie pulse rouge profond)
//   🌑 Éclipse  = vote des plus probables clôturé (top 3 sarcophages glow)
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
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent, SpellPanelComponent, SpellFooterService } from '../../core/spell-ui';

// ─── Modèles métier ──────────────────────────────────────────────────
interface PremortemRisk {
  id: number;
  label: string;          // ex: "API client dépréciée"
  category: 'tech' | 'team' | 'scope' | 'external' | 'process';
  impactVotes: number;    // 0 à 5 — nombre de bougies allumées
  countermeasure?: string; // rune gravée si une mitigation est définie
}

@Component({
  selector: 'wt-premortem-crypt-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent, SpellPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pmc-host">
      <header class="pmc-topbar">
        <div class="pmc-title">
          <h1>⚰ Le Caveau des Pré-Mortems</h1>
          <p>Workshop d'imagination des scénarios d'échec — {{ risks().length }} sarcophages · {{ countLitCandles() }} bougies allumées · {{ countRunes() }} runes gravées</p>
        </div>
        <div class="pmc-legend">
          <span class="dot tech"></span>tech
          <span class="dot team"></span>équipe
          <span class="dot scope"></span>scope
          <span class="dot external"></span>externe
          <span class="dot process"></span>process
        </div>
      </header>

      <canvas #canvas class="pmc-canvas"></canvas>

      <!-- Sidebar : liste des 6 risques pré-mortem -->
      <aside class="pmc-sidebar">
        <div class="pmc-side-title">📜 Causes d'échec hypothétiques</div>
        <div *ngFor="let r of risks(); let i = index"
             class="pmc-risk-card"
             [class.active]="selectedRisk()?.id === r.id"
             [attr.data-cat]="r.category"
             (click)="selectRisk(r)">
          <div class="pmc-risk-head">
            <span class="pmc-risk-num">#{{ i + 1 }}</span>
            <span class="pmc-risk-label">{{ r.label }}</span>
          </div>
          <div class="pmc-risk-meta">
            <span class="pmc-risk-votes">🕯 {{ r.impactVotes }}/5</span>
            <span *ngIf="r.countermeasure" class="pmc-risk-rune" title="{{ r.countermeasure }}">ᚱ rune</span>
          </div>
        </div>

        <div class="pmc-side-title pmc-side-title-mt">⚱ Cérémonies</div>
        <button class="pmc-btn" (click)="ceremonyEclipse()">🌑 Vote des plus probables</button>
        <button class="pmc-btn pmc-btn-danger" (click)="ceremonySiren()">🚨 Risque critique</button>
        <button class="pmc-btn" (click)="resetCamera()">🎥 Reset cam</button>
      </aside>

      <!-- 🪶 Narrator Yamzy overlay (bulle + glossary) -->
      <wt-narrator></wt-narrator>

      <!-- Flash overlay cérémonie -->
      <div *ngIf="ceremonyFlash() as f" class="pmc-flash" [attr.data-type]="f.type">
        <div class="pmc-flash-content">
          <div class="pmc-flash-icon">{{ f.icon }}</div>
          <div class="pmc-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- Panel risk (clic sarcophage) -->
      <wt-spell-panel
        [open]="!!selectedRisk()"
        title="Sarcophage de l'échec"
        icon="⚰"
        accent="#831843"
        side="right"
        size="sm"
        (close)="selectedRisk.set(null)">
        <ng-container *ngIf="selectedRisk() as r">
          <div class="pmc-panel-head">
            <strong class="pmc-panel-id">⚰ Risque #{{ r.id }}</strong>
            <span class="pmc-panel-cat" [attr.data-cat]="r.category">{{ r.category }}</span>
          </div>
          <div class="pmc-panel-msg">{{ r.label }}</div>
          <div class="pmc-panel-votes">🕯 Impact voté : <strong>{{ r.impactVotes }}/5</strong></div>
          <div *ngIf="r.countermeasure" class="pmc-panel-rune">
            <span class="pmc-rune-glyph">ᚱ</span> Contre-mesure : <em>{{ r.countermeasure }}</em>
          </div>
          <div *ngIf="!r.countermeasure" class="pmc-panel-empty">Aucune contre-mesure définie. La rune reste à graver.</div>
        </ng-container>
      </wt-spell-panel>

      <!-- 🎬 Splash welcome overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Pre-mortem Crypt"
        loreName="Le Caveau des Pré-Mortems"
        color="#831843"
        oneLiner="Imaginer les scénarios d'échec : sarcophages, bougies vote, runes contre-mesures."
        [duration]="80"
        [timeboxDurationS]="3600"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Pre-mortem Crypt"
        loreName="Le Caveau des Pré-Mortems"
        accent="#831843"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; overflow: hidden; }
    .pmc-host { position: relative; width: 100%; height: 100vh; background: #08030a; color: #e8d8ef; font-family: 'Tinos', system-ui, serif; }

    .pmc-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
    .pmc-topbar > * { pointer-events: auto; }
    .pmc-back { color: #d8b4fe; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #831843; border-radius: 8px; background: rgba(40,10,40,0.6); }
    .pmc-back:hover { background: rgba(131,24,67,0.55); }
    .pmc-title h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 1.5px; color: #d8b4fe; text-shadow: 0 0 14px rgba(168,85,247,0.6); font-family: 'Henny Penny', cursive; }
    .pmc-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.7; }
    .pmc-legend { display: flex; gap: 10px; font-size: 11px; align-items: center; }
    .pmc-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .pmc-legend .dot.tech     { background: #60a5fa; }
    .pmc-legend .dot.team     { background: #fb7185; }
    .pmc-legend .dot.scope    { background: #fbbf24; }
    .pmc-legend .dot.external { background: #a78bfa; }
    .pmc-legend .dot.process  { background: #34d399; }

    .pmc-canvas { display: block; width: 100%; height: 100%; }

    .pmc-sidebar { position: absolute; top: 90px; right: 16px; width: 290px; max-height: calc(100vh - 160px); overflow-y: auto; background: rgba(20, 8, 25, 0.92); border: 1px solid rgba(168,85,247,0.4); border-radius: 14px; backdrop-filter: blur(10px); padding: 14px; z-index: 8; }
    .pmc-side-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #d8b4fe; text-transform: uppercase; margin-bottom: 10px; }
    .pmc-side-title-mt { margin-top: 16px; }
    .pmc-risk-card { padding: 8px 10px; margin-bottom: 6px; background: rgba(40, 15, 50, 0.7); border-left: 3px solid #831843; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
    .pmc-risk-card:hover { background: rgba(60, 25, 70, 0.85); transform: translateX(2px); }
    .pmc-risk-card.active { background: rgba(131, 24, 67, 0.6); border-left-color: #d8b4fe; box-shadow: 0 0 14px rgba(168,85,247,0.4); }
    .pmc-risk-card[data-cat="tech"]     { border-left-color: #60a5fa; }
    .pmc-risk-card[data-cat="team"]     { border-left-color: #fb7185; }
    .pmc-risk-card[data-cat="scope"]    { border-left-color: #fbbf24; }
    .pmc-risk-card[data-cat="external"] { border-left-color: #a78bfa; }
    .pmc-risk-card[data-cat="process"]  { border-left-color: #34d399; }
    .pmc-risk-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
    .pmc-risk-num { font-size: 10px; opacity: 0.6; font-variant-numeric: tabular-nums; }
    .pmc-risk-label { font-size: 12px; flex: 1; color: #e8d8ef; }
    .pmc-risk-meta { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.75; }
    .pmc-risk-votes { color: #fb923c; }
    .pmc-risk-rune  { color: #d8b4fe; font-style: italic; }

    .pmc-btn { display: block; width: 100%; padding: 7px 10px; margin-bottom: 6px; background: rgba(40, 15, 50, 0.7); border: 1px solid rgba(168,85,247,0.35); border-radius: 8px; color: #e8d8ef; cursor: pointer; font-family: inherit; font-size: 11px; text-align: left; transition: all 0.15s; }
    .pmc-btn:hover { background: rgba(131, 24, 67, 0.45); border-color: #d8b4fe; }
    .pmc-btn-danger { border-color: rgba(220, 38, 38, 0.5); }
    .pmc-btn-danger:hover { background: rgba(220, 38, 38, 0.25); border-color: #fb7185; }

    .pmc-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 22px; z-index: 10; display: flex; gap: 8px; align-items: center; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); }
    .pmc-controls button { background: rgba(40, 15, 50, 0.75); color: #e8d8ef; border: 1px solid #831843; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit; }
    .pmc-controls button:hover { background: rgba(131, 24, 67, 0.55); box-shadow: 0 0 10px rgba(168,85,247,0.35); }
    .pmc-controls .pmc-narrator { background: rgba(40, 25, 60, 0.75); border-color: #a78bfa; color: #d8b4fe; font-weight: 600; }
    .pmc-controls .pmc-narrator:hover { background: rgba(168, 85, 247, 0.25); }
    .pmc-controls .pmc-narrator.pmc-play { background: #a78bfa; color: #1a0a25; border-color: #a78bfa; }
    .pmc-controls .pmc-narrator.pmc-play:hover { background: #9370db; }
    .pmc-controls .hint { margin-left: auto; font-size: 11px; opacity: 0.55; }

    /* Flash cérémonie */
    .pmc-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; animation: pmc-flash-pulse 1.6s ease-out forwards; }
    .pmc-flash[data-type="siren"]   { background: radial-gradient(circle at center, rgba(220,38,38,0.7), transparent 60%); animation: pmc-flash-siren 1.6s ease-out forwards; }
    .pmc-flash[data-type="eclipse"] { background: radial-gradient(circle at center, rgba(131,24,67,0.7), transparent 60%); }
    .pmc-flash-content { text-align: center; animation: pmc-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .pmc-flash-icon  { font-size: 104px; line-height: 1; filter: drop-shadow(0 0 32px rgba(168,85,247,0.9)); }
    .pmc-flash-label { font-size: 22px; margin-top: 10px; color: #fff; font-weight: 700; letter-spacing: 1.5px; text-shadow: 0 0 14px rgba(0,0,0,0.7); }
    @keyframes pmc-flash-pulse { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes pmc-flash-siren { 0% { opacity: 0; } 10% { opacity: 1; } 30% { opacity: 0.3; } 50% { opacity: 1; } 70% { opacity: 0.3; } 100% { opacity: 0; } }
    @keyframes pmc-flash-grow  { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }

    /* Panels */
    .pmc-panel { position: absolute; left: 22px; top: 90px; width: 300px; padding: 14px; background: rgba(20, 8, 25, 0.94); border: 1px solid #a78bfa; border-radius: 12px; backdrop-filter: blur(8px); z-index: 9; font-size: 12px; box-shadow: 0 0 22px rgba(168,85,247,0.25); }
    .pmc-panel-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: transparent; border: 1px solid rgba(216, 180, 254, 0.4); border-radius: 50%; color: #d8b4fe; cursor: pointer; }
    .pmc-panel-head { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
    .pmc-panel-id { color: #d8b4fe; font-family: monospace; }
    .pmc-panel-cat { font-size: 10px; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
    .pmc-panel-cat[data-cat="tech"]     { background: #1e3a8a; color: #bfdbfe; }
    .pmc-panel-cat[data-cat="team"]     { background: #7f1d1d; color: #fecaca; }
    .pmc-panel-cat[data-cat="scope"]    { background: #7c2d12; color: #fed7aa; }
    .pmc-panel-cat[data-cat="external"] { background: #581c87; color: #ddd6fe; }
    .pmc-panel-cat[data-cat="process"]  { background: #14532d; color: #bbf7d0; }
    .pmc-panel-msg { color: #e8d8ef; margin: 8px 0; line-height: 1.5; font-size: 13px; }
    .pmc-panel-votes { font-size: 11px; opacity: 0.85; margin-bottom: 8px; }
    .pmc-panel-rune { font-size: 11px; padding: 8px; background: rgba(40, 25, 60, 0.6); border-radius: 6px; border-left: 2px solid #d8b4fe; }
    .pmc-rune-glyph { color: #fbbf24; font-weight: 700; font-size: 14px; margin-right: 4px; }
    .pmc-panel-empty { font-size: 11px; opacity: 0.55; font-style: italic; margin-top: 6px; }
  `]
})
export class PremortemCryptRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ─── État réactif (signals) ───
  risks = signal<PremortemRisk[]>([]);
  selectedRisk = signal<PremortemRisk | null>(null);
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '⚰', title: 'Pré-mortem = imaginer l\'échec', body: 'Avant d\'engager une release, on imagine que le projet est déjà mort. Chaque sarcophage = une cause hypothétique d\'échec.' },
    { icon: '🕯', title: 'Bougies = votes d\'impact', body: 'Chaque compagnon allume des bougies (0 à 5) sur le sarcophage qu\'il juge le plus probable. Plus de bougies = plus de gravité.' },
    { icon: '🌑', title: 'Éclipse = vote clôturé', body: 'Quand le vote est terminé, l\'éclipse plonge la crypte dans la pénombre. Les 3 sarcophages les plus votés se mettent à briller.' },
    { icon: 'ᚱ', title: 'Runes = contre-mesures', body: 'Pour chaque risque top 3, on grave une rune (action préventive). Ces runes deviennent les action items à embarquer.' },
    { icon: '🚨', title: 'Sirène = risque critique', body: 'Quand un risque atteint un consensus de gravité maximale, la sirène hurle et la bougie pulse en rouge profond.' },
  ];
  tutorialVoiceLines: string[] = [
    'Imaginez que le projet est déjà mort.',
    'Allumez les bougies selon l\'impact perçu.',
    'L\'éclipse révèle les trois pires scénarios.',
    'Gravez une rune pour chaque contre-mesure.',
    'La sirène hurle pour les risques critiques.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  // ─── Services injectés ───
  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);
  private router = inject(Router);

  // ─── Three.js core ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;
  private controls: any;
  private raycaster: any;
  private mouse: any;
  private clickHandler: any;
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;

  // ─── Refs 3D ───
  private sarcophages: any[] = [];                     // 6 groupes (corps + dalle + bougie + rune)
  private risksBySarcophage = new Map<any, PremortemRisk>();
  private brumeParticles: any = null;
  private brumeVelocities: Float32Array = new Float32Array(0);
  private torchLights: any[] = [];                     // 8 torches violettes murales
  private candleFlames: any[] = [];                    // toutes les bougies
  private centralSeal: any = null;                     // sceau circulaire au sol
  private sealRing: any = null;
  private columns: any[] = [];

  // ─── Animation state ───
  private elapsed = 0;
  private ceremonyFlashTimer: any = null;
  private eclipseGlowUntil = 0;

  // Méthode publique pour le narrator (emit ceremony from JSON tutorial)
  public emitCeremonyPublic(c: { type: string; label: string; icon: string }) {
    this.emitCeremony(c);
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#831843',
      hint: 'Drag = orbit · molette = zoom · clic sarcophage = détail',
      controls: [
        { icon: '🎬', label: 'Demo pré-mortem', action: () => this.loadDemo() },
        { icon: '🎓', label: 'Tutorial', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée par Yamzy' },
        { icon: '▶', label: 'Play example', variant: 'primary', action: () => this.narrator.startPlayExample(), title: 'Démo animée' },
      ],
    });
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
    }
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    this.loadDemo();
    // Intro cinématique : vue d'oiseau qui descend dans la crypte
    playIslandIntro(this.camera, this.controls, { x: 6, y: 5, z: 10 }, { x: 0, y: 1, z: 0 }, 3.5);
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

    // Scène + fog épais violacé pour ambiance crypte
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x08030a);
    this.scene.fog = new T.FogExp2(0x140a1a, 0.04);

    // Caméra : position cinématique sur la crypte
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(6, 5, 10);
    this.camera.lookAt(0, 1, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lumière ambiante violacée très sombre (crypte fermée)
    this.scene.add(new T.AmbientLight(0x2a1a3a, 0.4));
    // Hémisphère mauve/cendres
    this.scene.add(new T.HemisphereLight(0x6a4a8a, 0x140a1a, 0.35));

    // Sky ornaments — étoiles réduites car crypte fermée (vue depuis l'extérieur)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 400, starRadius: 90,
      moonPos: [-22, 28, -25],
      auroraPos: [0, 32, -45],
      cometPos: [25, 28, -20],
      shootingStarCount: 3,
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'premortem-crypt') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Construction de la crypte
    this.buildFloor(T);
    this.buildCentralSeal(T);
    this.buildColumns(T);
    this.buildSarcophages(T);
    this.buildWallTorches(T);
    this.buildBrumeParticles(T);

    // OrbitControls — maxPolarAngle = 1.5 (peut pas passer sous le sol)
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 1, 0);
      this.controls.maxDistance = 30;
      this.controls.minDistance = 3;
      this.controls.maxPolarAngle = 1.5;
    }

    // Raycaster pour interactions (sarcophages cliquables)
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.handleCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[PremortemCrypt] ⚰ Crypte prête — que les pré-mortems éclairent les chemins');
    // 🪶 Attach Narrator Yamzy → charge le tutorial JSON et permet 🎓 / ▶
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'premortem-crypt',
    });
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sol en pierre sombre (cylindre large)
  // ═══════════════════════════════════════════════════════════════════
  private buildFloor(T: any) {
    const floor = new T.Mesh(
      new T.CylinderGeometry(14, 14, 0.4, 64),
      new T.MeshStandardMaterial({ color: 0x1f1419, roughness: 0.95, metalness: 0.05 }),
    );
    floor.position.y = -0.2;
    this.scene.add(floor);

    // Plafond voûté (cylindre inversé sombre)
    const ceiling = new T.Mesh(
      new T.CylinderGeometry(14, 14, 0.3, 32),
      new T.MeshStandardMaterial({ color: 0x0a0510, roughness: 1.0 }),
    );
    ceiling.position.y = 8;
    this.scene.add(ceiling);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sceau circulaire doré au centre du sol
  // ═══════════════════════════════════════════════════════════════════
  private buildCentralSeal(T: any) {
    // Disque doré principal
    const sealGeom = new T.CircleGeometry(1.8, 48);
    const sealMat = new T.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.85,
      side: T.DoubleSide,
    });
    this.centralSeal = new T.Mesh(sealGeom, sealMat);
    this.centralSeal.rotation.x = -Math.PI / 2;
    this.centralSeal.position.y = 0.02;
    this.centralSeal.userData.tutorialId = 'seal';
    this.scene.add(this.centralSeal);

    // Anneau extérieur (Torus)
    const ringGeom = new T.TorusGeometry(2.0, 0.06, 12, 64);
    const ringMat = new T.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.0,
      roughness: 0.25,
      metalness: 0.9,
    });
    this.sealRing = new T.Mesh(ringGeom, ringMat);
    this.sealRing.rotation.x = -Math.PI / 2;
    this.sealRing.position.y = 0.04;
    this.scene.add(this.sealRing);

    // Anneau intérieur (Torus plus petit)
    const innerRing = new T.Mesh(
      new T.TorusGeometry(1.1, 0.03, 8, 48),
      ringMat,
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.045;
    this.scene.add(innerRing);

    // Light point pour glow au sceau
    const sealLight = new T.PointLight(0xfbbf24, 0.9, 8, 1.6);
    sealLight.position.set(0, 0.5, 0);
    sealLight.userData = { kind: 'seal-light', basePhase: 0 };
    this.scene.add(sealLight);
    this.torchLights.push(sealLight);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 4 colonnes en pierre aux coins
  // ═══════════════════════════════════════════════════════════════════
  private buildColumns(T: any) {
    const colMat = new T.MeshStandardMaterial({
      color: 0x2a1d28,
      roughness: 0.95,
      metalness: 0.08,
    });
    const positions: [number, number][] = [
      [-8, -8], [8, -8], [-8, 8], [8, 8],
    ];
    for (const [x, z] of positions) {
      const col = new T.Mesh(
        new T.CylinderGeometry(0.55, 0.65, 8, 12),
        colMat,
      );
      col.position.set(x, 4, z);
      this.scene.add(col);
      this.columns.push(col);

      // Chapiteau (boîte au sommet)
      const cap = new T.Mesh(
        new T.BoxGeometry(1.4, 0.4, 1.4),
        colMat,
      );
      cap.position.set(x, 8.2, z);
      this.scene.add(cap);

      // Base
      const base = new T.Mesh(
        new T.BoxGeometry(1.5, 0.5, 1.5),
        colMat,
      );
      base.position.set(x, 0.05, z);
      this.scene.add(base);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 6 sarcophages alignés en 2 rangées de 3
  // Chaque sarcophage = box rectangulaire + dalle couverture + plaque + bougie
  // ═══════════════════════════════════════════════════════════════════
  private buildSarcophages(T: any) {
    // Nettoyer les anciens
    this.sarcophages.forEach(g => this.scene.remove(g));
    this.sarcophages = [];
    this.candleFlames = [];
    this.risksBySarcophage.clear();

    const risks = this.risks();
    const positions: Array<{ x: number; z: number; rotY: number }> = [
      // Rangée gauche (z=-3)
      { x: -4.5, z: -3, rotY: Math.PI / 2 },
      { x:  0.0, z: -3, rotY: Math.PI / 2 },
      { x:  4.5, z: -3, rotY: Math.PI / 2 },
      // Rangée droite (z=3)
      { x: -4.5, z:  3, rotY: -Math.PI / 2 },
      { x:  0.0, z:  3, rotY: -Math.PI / 2 },
      { x:  4.5, z:  3, rotY: -Math.PI / 2 },
    ];

    const stoneMat = new T.MeshStandardMaterial({
      color: 0x3a2a35,
      roughness: 0.95,
      metalness: 0.1,
    });
    const slabMat = new T.MeshStandardMaterial({
      color: 0x2a1a25,
      roughness: 0.9,
      metalness: 0.12,
    });

    for (let i = 0; i < 6; i++) {
      const pos = positions[i];
      const r = risks[i];
      const group = new T.Group();
      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = pos.rotY;

      // Corps du sarcophage (box rectangulaire)
      const body = new T.Mesh(
        new T.BoxGeometry(2.2, 0.9, 1.0),
        stoneMat,
      );
      body.position.y = 0.45;
      group.add(body);

      // Dalle (couverture plus fine et légèrement plus large)
      const slab = new T.Mesh(
        new T.BoxGeometry(2.35, 0.18, 1.1),
        slabMat,
      );
      slab.position.y = 0.99;
      group.add(slab);

      // Plaque gravée sur la dalle (petit plan doré assombri)
      const plaque = new T.Mesh(
        new T.PlaneGeometry(0.8, 0.3),
        new T.MeshStandardMaterial({
          color: 0xa8855a,
          emissive: 0x4a2a18,
          emissiveIntensity: 0.6,
          roughness: 0.55,
          metalness: 0.7,
          side: T.DoubleSide,
        }),
      );
      plaque.rotation.x = -Math.PI / 2;
      plaque.position.y = 1.085;
      plaque.position.x = -0.7;
      group.add(plaque);

      // Bougie (petit cylindre crème) — toujours présente, éteinte ou allumée
      const candleBody = new T.Mesh(
        new T.CylinderGeometry(0.08, 0.08, 0.32, 12),
        new T.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.85 }),
      );
      candleBody.position.set(0.6, 1.24, 0);
      group.add(candleBody);

      // Mèche + flamme (petit cône émissif) — visible seulement si impactVotes > 0
      const litVotes = r?.impactVotes ?? 0;
      const candleColor = litVotes >= 4 ? 0xdc2626 : litVotes >= 2 ? 0xfb923c : 0xfbbf24;
      const flame = new T.Mesh(
        new T.ConeGeometry(0.08, 0.22, 8),
        new T.MeshBasicMaterial({
          color: candleColor,
          transparent: true,
          opacity: 0.95,
        }),
      );
      flame.position.set(0.6, 1.52, 0);
      flame.userData = {
        kind: 'candle-flame',
        basePhase: Math.random() * Math.PI * 2,
        votes: litVotes,
      };
      flame.visible = litVotes > 0;
      group.add(flame);
      this.candleFlames.push(flame);

      // Petite light pour le glow de la bougie (si allumée)
      if (litVotes > 0) {
        const candleLight = new T.PointLight(candleColor, 0.5 + litVotes * 0.15, 3.5, 1.8);
        candleLight.position.set(0.6, 1.6, 0);
        candleLight.userData = { kind: 'candle-light', basePhase: Math.random() * Math.PI * 2, baseIntensity: 0.5 + litVotes * 0.15 };
        group.add(candleLight);
        this.torchLights.push(candleLight);
      }

      // Runes gravées sur le côté du sarcophage (si contre-mesure définie)
      if (r?.countermeasure) {
        const runePlane = new T.Mesh(
          new T.PlaneGeometry(0.6, 0.4),
          new T.MeshStandardMaterial({
            color: 0xd8b4fe,
            emissive: 0xa78bfa,
            emissiveIntensity: 0.9,
            roughness: 0.4,
            metalness: 0.5,
            transparent: true,
            opacity: 0.85,
            side: T.DoubleSide,
          }),
        );
        runePlane.position.set(0, 0.55, 0.51);
        runePlane.userData = { kind: 'rune', basePhase: Math.random() * Math.PI * 2 };
        group.add(runePlane);
      }

      // Tagging
      group.userData = { kind: 'sarcophage', index: i };
      if (i === 0) {
        // Premier sarcophage = tutorialId pour le glossary
        group.userData.tutorialId = 'sarcophage';
        slab.userData.tutorialId = 'sarcophage';
        body.userData.tutorialId = 'sarcophage';
      }
      if (i === 1) flame.userData.tutorialId = 'candle';
      if (i === 2 && r?.countermeasure) {
        // runePlane est déjà ajouté plus haut, on tag son parent
      }

      this.scene.add(group);
      this.sarcophages.push(group);
      if (r) this.risksBySarcophage.set(group, r);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : 8 torches violettes murales (cones violets émissifs)
  // ═══════════════════════════════════════════════════════════════════
  private buildWallTorches(T: any) {
    // 8 positions autour du périmètre
    const torchPositions: Array<[number, number]> = [
      [-12, 0], [12, 0], [0, -12], [0, 12],
      [-9, -9], [9, -9], [-9, 9], [9, 9],
    ];
    for (const [x, z] of torchPositions) {
      // Support : petit cylindre noir
      const holder = new T.Mesh(
        new T.CylinderGeometry(0.08, 0.12, 0.45, 8),
        new T.MeshStandardMaterial({ color: 0x141014, roughness: 0.85, metalness: 0.4 }),
      );
      holder.position.set(x, 5.2, z);
      this.scene.add(holder);

      // Flamme : cône violet émissif
      const flame = new T.Mesh(
        new T.ConeGeometry(0.22, 0.6, 10),
        new T.MeshBasicMaterial({
          color: 0xa78bfa,
          transparent: true,
          opacity: 0.92,
        }),
      );
      flame.position.set(x, 5.7, z);
      this.scene.add(flame);

      // Lumière violette flickering
      const light = new T.PointLight(0xa78bfa, 1.4, 14, 1.6);
      light.position.set(x, 5.75, z);
      light.userData = { kind: 'torch', phase: Math.random() * Math.PI * 2, base: 1.4, flame };
      this.scene.add(light);
      this.torchLights.push(light);

      // Tag le premier pour glossary
      if (x === -12 && z === 0) {
        flame.userData = { ...flame.userData, tutorialId: 'torch' };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : brume particles ground level (Points cyan-purple)
  // ═══════════════════════════════════════════════════════════════════
  private buildBrumeParticles(T: any) {
    const PARTICLE_COUNT = 500;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    this.brumeVelocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Dispersion sur le sol entre -12 et 12
      positions[i * 3 + 0] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = 0.05 + Math.random() * 1.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
      // Couleur dégradée cyan → purple
      const tint = Math.random();
      colors[i * 3 + 0] = 0.35 + tint * 0.4;       // R : 0.35..0.75
      colors[i * 3 + 1] = 0.3 + (1 - tint) * 0.5;  // G : 0.3..0.8
      colors[i * 3 + 2] = 0.7 + tint * 0.3;        // B : 0.7..1.0
      // Vélocités lentes (drift)
      this.brumeVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.015;
      this.brumeVelocities[i * 3 + 1] = 0.003 + Math.random() * 0.008;
      this.brumeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.015;
    }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: T.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.brumeParticles = new T.Points(geom, mat);
    this.brumeParticles.userData.tutorialId = 'brume';
    this.scene.add(this.brumeParticles);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════
  loadDemo() {
    const samples: PremortemRisk[] = [
      { id: 1, label: 'API client dépréciée sans migration', category: 'tech',     impactVotes: 4, countermeasure: 'Plan B : pinner version + roadmap migration sur 2 sprints' },
      { id: 2, label: 'Charge cognitive équipe (burnout)',   category: 'team',     impactVotes: 5, countermeasure: 'Cap WIP à 3 par dev + 1 sprint cooldown / Q' },
      { id: 3, label: 'Scope creep stakeholder',             category: 'scope',    impactVotes: 3, countermeasure: 'Sprint goal verrouillé + comité tri en milieu de sprint' },
      { id: 4, label: 'Dépendance externe instable',         category: 'external', impactVotes: 2 },
      { id: 5, label: 'Process review trop long',            category: 'process',  impactVotes: 1 },
      { id: 6, label: 'Onboarding nouveau dev sous-estimé',  category: 'team',     impactVotes: 0 },
    ];
    this.risks.set(samples);

    const T = (window as any).THREE;
    if (T) this.buildSarcophages(T);

    this.emitCeremony({ type: 'eclipse', label: '⚰ Crypte chargée · 6 sarcophages à veiller', icon: '⚰' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SIDEBAR interactions
  // ═══════════════════════════════════════════════════════════════════
  selectRisk(r: PremortemRisk) {
    this.selectedRisk.set(r);
    // Camera plonge vers le sarcophage
    const idx = this.risks().findIndex(x => x.id === r.id);
    if (idx >= 0 && this.sarcophages[idx] && this.camera) {
      const target = this.sarcophages[idx].position;
      // Léger zoom (pas un teleport — controls reprennent ensuite)
      if (this.controls) {
        this.controls.target.set(target.x, 1.0, target.z);
      }
    }
  }

  countLitCandles(): number {
    return this.risks().filter(r => r.impactVotes > 0).length;
  }
  countRunes(): number {
    return this.risks().filter(r => !!r.countermeasure).length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIES
  // ═══════════════════════════════════════════════════════════════════
  private emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('premortem-crypt', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

  ceremonySiren() {
    this.emitCeremony({ type: 'siren', label: '🚨 Risque critique identifié', icon: '🚨' });
  }

  ceremonyEclipse() {
    this.eclipseGlowUntil = performance.now() + 4500;
    this.emitCeremony({ type: 'eclipse', label: '🌑 Vote des plus probables clôturé', icon: '🌑' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎬 CINEMATIC METHODS (invoqués par playExample tutorial JSON)
  // ═══════════════════════════════════════════════════════════════════

  /** 🕯 Allumer la bougie du sarcophage N (0-indexed) */
  lightCandleAt(index: number) {
    const T = (window as any).THREE;
    if (index < 0 || index >= this.sarcophages.length) return;
    const risks = [...this.risks()];
    if (!risks[index]) return;
    risks[index] = { ...risks[index], impactVotes: Math.min(5, (risks[index].impactVotes || 0) + 2) };
    this.risks.set(risks);
    if (T) this.buildSarcophages(T);
  }

  /** 🕯 Allumer la 1ère bougie (raccourci playExample) */
  lightFirstCandle() { this.lightCandleAt(0); this.emitCeremony({ type: 'siren', label: '🕯 Bougie #1 allumée · API change', icon: '🕯' }); }
  /** 🕯 Allumer la 2ème bougie (raccourci playExample) */
  lightSecondCandle() { this.lightCandleAt(1); this.emitCeremony({ type: 'siren', label: '🕯 Bougie #2 allumée · burnout', icon: '🕯' }); }
  /** 🕯 Allumer la 3ème bougie (raccourci playExample) */
  lightThirdCandle() { this.lightCandleAt(2); this.emitCeremony({ type: 'siren', label: '🕯 Bougie #3 allumée · scope creep', icon: '🕯' }); }

  /** 🌑 Vote des plus probables : top 3 bougies passent à 5 et pulsent */
  voteTopThree() {
    const risks = [...this.risks()];
    // Trier par votes décroissants et passer le top 3 à 5
    const sorted = [...risks].sort((a, b) => (b.impactVotes || 0) - (a.impactVotes || 0));
    const top3Ids = new Set(sorted.slice(0, 3).map(r => r.id));
    const updated = risks.map(r => top3Ids.has(r.id) ? { ...r, impactVotes: 5 } : r);
    this.risks.set(updated);
    const T = (window as any).THREE;
    if (T) this.buildSarcophages(T);
    this.eclipseGlowUntil = performance.now() + 5000;
    this.emitCeremony({ type: 'eclipse', label: '🌑 Top 3 risques sélectionnés · vote clos', icon: '🌑' });
  }

  /** ᚱ Graver les runes de contre-mesures sur les top 3 sarcophages */
  carveRunes() {
    const risks = [...this.risks()];
    const sorted = [...risks].sort((a, b) => (b.impactVotes || 0) - (a.impactVotes || 0));
    const top3Ids = new Set(sorted.slice(0, 3).map(r => r.id));
    const mitigations = [
      'Plan de mitigation par étapes documenté',
      'Détection précoce + alerte stakeholder',
      'Owner désigné + check-in hebdo',
    ];
    let mi = 0;
    const updated = risks.map(r => {
      if (top3Ids.has(r.id) && !r.countermeasure) {
        return { ...r, countermeasure: mitigations[mi++] || mitigations[0] };
      }
      return r;
    });
    this.risks.set(updated);
    const T = (window as any).THREE;
    if (T) this.buildSarcophages(T);
    this.emitCeremony({ type: 'eclipse', label: 'ᚱ Runes de contre-mesures gravées', icon: 'ᚱ' });
  }

  /** 📋 Export liste finale (juste un flash) */
  finalizeList() {
    this.emitCeremony({ type: 'eclipse', label: '📋 Liste finale exportable', icon: '📋' });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAYCASTER : clic sarcophage → fiche risque
  // ═══════════════════════════════════════════════════════════════════
  private handleCanvasClick(e: MouseEvent) {
    if (!this.camera || !this.raycaster) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Recursif pour attraper les enfants (corps/dalle dans le group)
    const allChildren: any[] = [];
    for (const g of this.sarcophages) {
      g.traverse((obj: any) => { if (obj.isMesh) allChildren.push(obj); });
    }
    const hits = this.raycaster.intersectObjects(allChildren, false);
    if (hits.length > 0) {
      // Remonter au group parent
      let obj = hits[0].object;
      while (obj && !obj.userData?.kind) obj = obj.parent;
      if (obj && obj.userData?.kind === 'sarcophage') {
        const risk = this.risksBySarcophage.get(obj);
        if (risk) {
          this.selectedRisk.set(risk);
          // Petit pulse de scale
          obj.scale.set(1.06, 1.06, 1.06);
          setTimeout(() => obj.scale.set(1, 1, 1), 220);
        }
      }
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

    // ─── Bougies : flicker (scale + opacity) ───
    for (const flame of this.candleFlames) {
      if (!flame.visible) continue;
      const ud = flame.userData;
      const phase = ud.basePhase || 0;
      const flicker = 0.85 + Math.sin(this.elapsed * 9 + phase) * 0.12 + (Math.random() - 0.5) * 0.1;
      flame.scale.setScalar(flicker);
      if (flame.material) {
        flame.material.opacity = 0.8 + Math.sin(this.elapsed * 6 + phase) * 0.15;
      }
    }

    // ─── Brume : drift lent + recycle ───
    if (this.brumeParticles) {
      const pos = this.brumeParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 0] += this.brumeVelocities[i * 3 + 0] + Math.sin(this.elapsed * 0.4 + i * 0.08) * 0.002;
        pos[i * 3 + 1] += this.brumeVelocities[i * 3 + 1];
        pos[i * 3 + 2] += this.brumeVelocities[i * 3 + 2] + Math.cos(this.elapsed * 0.35 + i * 0.07) * 0.002;
        // Recycle : si trop haut ou trop loin, retombe au sol
        if (pos[i * 3 + 1] > 2.5) {
          pos[i * 3 + 0] = (Math.random() - 0.5) * 22;
          pos[i * 3 + 1] = 0.05;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 22;
        }
      }
      this.brumeParticles.geometry.attributes.position.needsUpdate = true;
    }

    // ─── Sceau : pulse breathing ───
    if (this.centralSeal && this.centralSeal.material) {
      const pulse = 0.6 + Math.sin(this.elapsed * 1.5) * 0.25;
      this.centralSeal.material.emissiveIntensity = pulse;
      const scale = 1 + Math.sin(this.elapsed * 1.5) * 0.04;
      this.centralSeal.scale.set(scale, 1, scale);
    }
    if (this.sealRing) {
      this.sealRing.rotation.z = this.elapsed * 0.25;
    }

    // ─── Torches & lights : flickering + breathing ───
    for (const light of this.torchLights) {
      const ud = light.userData;
      if (ud?.kind === 'torch') {
        const flicker = ud.base + Math.sin(this.elapsed * 7 + ud.phase) * 0.35 + Math.random() * 0.15 - 0.075;
        light.intensity = Math.max(0.3, flicker);
        if (ud.flame) {
          ud.flame.scale.setScalar(0.85 + Math.random() * 0.25);
        }
      } else if (ud?.kind === 'candle-light') {
        const base = ud.baseIntensity || 0.7;
        light.intensity = base + Math.sin(this.elapsed * 8 + ud.basePhase) * 0.25 + Math.random() * 0.15;
      } else if (ud?.kind === 'seal-light') {
        light.intensity = 0.7 + Math.sin(this.elapsed * 2) * 0.3;
      }
    }

    // ─── Eclipse glow : tous les sarcophages pulsent en violet ───
    if (this.eclipseGlowUntil > nowMs) {
      const t = (this.eclipseGlowUntil - nowMs) / 4500;
      for (const g of this.sarcophages) {
        const risk = this.risksBySarcophage.get(g);
        if (risk && risk.impactVotes >= 4) {
          g.traverse((obj: any) => {
            if (obj.isMesh && obj.material?.emissive) {
              obj.material.emissiveIntensity = 0.4 + Math.sin(this.elapsed * 5) * 0.3 * t;
            }
          });
        }
      }
    }

    // ─── Runes : pulsation magique ───
    for (const g of this.sarcophages) {
      g.traverse((obj: any) => {
        if (obj.userData?.kind === 'rune' && obj.material) {
          obj.material.emissiveIntensity = 0.7 + Math.sin(this.elapsed * 3 + obj.userData.basePhase) * 0.4;
        }
      });
    }

    this.sky?.tick(dt, this.elapsed);
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ═══════════════════════════════════════════════════════════════════
  // CAM / UTILS
  // ═══════════════════════════════════════════════════════════════════
  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(6, 5, 10);
    this.camera.lookAt(0, 1, 0);
    if (this.controls) this.controls.target.set(0, 1, 0);
  }

  private onResize = () => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** Lancer le play */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    this.narrator.startPlayExample(0);
  }

  /** Entrer (skip play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
  }

  /** ⏱ Lance le mode TIMEBOX RÉEL — HUD countdown avec la vraie durée Scrum, sans narration. */
  onSplashTimebox(): void {
    this.splashVisible.set(false);
    this.narrator.startTimeboxOnly(3600, 'Pre-mortem');
  }
}
