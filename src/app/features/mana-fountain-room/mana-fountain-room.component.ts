// ═══════════════════════════════════════════════════════════════════
// 💧 MANA FOUNTAIN ROOM — La source du Royaume
//
// La pièce-clé de la sensibilisation IA / Eau. Conçue pour rendre
// visible et tangible la consommation d'eau magique (= tokens IA).
//
// 3D :
//   - Fontaine circulaire en pierre au centre
//   - Colonne d'eau lumineuse au-dessus (niveau = budget restant)
//   - 4 statuettes autour : token / mL / $ / CO₂
//   - Gouttes qui tombent en boucle (intensité = rate de conso)
//   - Reflet de l'eau au sol
//
// UI panel :
//   - Stats live + équivalences pédagogiques
//   - Budget mensuel ajustable
//   - Bouton "Reset sprint" pour redémarrer compteurs
//   - Historique des dernières actions
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MagicWaterService, PRESETS } from '../../core/magic-water/magic-water.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { RoomSplashComponent } from '../../core/room-splash/room-splash.component';
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent } from '../../core/spell-ui';

@Component({
  selector: 'wt-mana-fountain-room',
  standalone: true,
  imports: [CommonModule, RouterLink, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mfr-host">
      <canvas #canvas class="mfr-canvas"></canvas>

      <!-- Topbar -->
      <header class="mfr-top">
        <wt-spell-btn variant="back" size="sm" accent="#d54adf" [routerLink]="'/yamzy-island'" icon="←">Yamzy Island</wt-spell-btn>
        <div class="mfr-title">
          <h1>💧 La Fontaine de Mana</h1>
          <p>La source qui mesure ce que coûte la magie</p>
        </div>
      </header>

      <!-- Panel stats principales -->
      <aside class="mfr-stats">
        <div class="mfr-section">
          <div class="mfr-section-title">📊 Consommation totale</div>
          <div class="mfr-big">
            <div class="mfr-big-row"><span class="mfr-big-icon">🔮</span><span class="mfr-big-val">{{ formatTokens(water.totalTokens()) }}</span><span class="mfr-big-unit">tokens</span></div>
            <div class="mfr-big-row"><span class="mfr-big-icon">💧</span><span class="mfr-big-val">{{ formatMl(water.totalWaterMl()) }}</span><span class="mfr-big-unit">eau cooling</span></div>
            <div class="mfr-big-row"><span class="mfr-big-icon">🪙</span><span class="mfr-big-val">\${{ water.totalCostUsd().toFixed(3) }}</span><span class="mfr-big-unit">coût IA</span></div>
            <div class="mfr-big-row"><span class="mfr-big-icon">🌍</span><span class="mfr-big-val">{{ water.totalCo2G().toFixed(1) }}g</span><span class="mfr-big-unit">CO₂</span></div>
          </div>
        </div>

        <div class="mfr-section">
          <div class="mfr-section-title">🌍 Équivalences</div>
          <div class="mfr-equiv">
            <div>🚿 {{ (equivalents().showers * 1000).toFixed(2) }} ‰ d'une douche</div>
            <div>🍶 {{ equivalents().bottles.toFixed(2) }} bouteilles 50cL</div>
            <div>🌊 {{ (equivalents().pools * 1_000_000).toFixed(2) }} ppm d'une piscine</div>
          </div>
        </div>

        <div class="mfr-section">
          <div class="mfr-section-title">💸 Budget mensuel</div>
          <div class="mfr-budget-bar"><div class="mfr-budget-fill" [style.width.%]="water.budgetRatio() * 100"></div></div>
          <div class="mfr-budget-text">{{ (water.budgetRatio() * 100).toFixed(0) }}% de \${{ water.monthlyBudgetUsd() }}</div>
          <div class="mfr-budget-edit">
            <label>Plafond mensuel ($) :</label>
            <input type="number" [value]="water.monthlyBudgetUsd()" (input)="setBudget($event)" min="0.5" step="0.5" />
          </div>
        </div>

        <div class="mfr-section">
          <div class="mfr-section-title">🎯 Actions</div>
          <button class="mfr-btn" (click)="simulateAction('question-ad-hoc')">+ Question Yamzy (~$0.007)</button>
          <button class="mfr-btn" (click)="simulateAction('refinement-ia')">+ Refinement IA (~$0.013)</button>
          <button class="mfr-btn" (click)="simulateAction('tour-vocal-yamzy')">+ Tour vocal (~$0.060)</button>
          <button class="mfr-btn mfr-btn-danger" (click)="resetAll()">🔄 Reset sprint</button>
        </div>
      </aside>

      <!-- Historique récent -->
      <aside class="mfr-history">
        <div class="mfr-section-title">⏱ Historique récent</div>
        <div *ngFor="let a of recentActions(); let i = index" class="mfr-history-item">
          <span class="mfr-h-icon">💧</span>
          <span class="mfr-h-action">{{ a.action }}</span>
          <span class="mfr-h-cost">{{ ((a.tokens + (a.tokensOut ?? 0)) * 0.000003).toFixed(4) }}$</span>
        </div>
        <div *ngIf="recentActions().length === 0" class="mfr-history-empty">
          Aucune consommation pour l'instant.
          <br>Toutes les actions IA apparaîtront ici en live.
        </div>
      </aside>

      <!-- Manifesto bottom -->
      <footer class="mfr-manifesto">
        <em>« Chaque sort lancé dans le Royaume puise dans cette source. Voir la goutte tomber, c'est se souvenir qu'aucune magie n'est gratuite. »</em>
      </footer>

      <!-- 🎬 Splash welcome overlay -->
      <wt-room-splash *ngIf="splashVisible()"
        title="Mana Fountain"
        loreName="La Source qui mesure la magie"
        color="#d54adf"
        oneLiner="Sensibilisation IA/Eau/$ : chaque sort consomme tokens + mL d'eau + dollars."
        [duration]="60"
        (onPlay)="onSplashPlay()"
        (onEnter)="onSplashEnter()" />

      <!-- 🎓 Tutorial overlay (How it works) -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Mana Fountain"
        loreName="La Source qui mesure la magie"
        accent="#d54adf"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />
    </div>
  `,
  styles: [`
    :host { display: block; position: fixed; inset: 0; }
    .mfr-host { position: relative; width: 100%; height: 100%; background: #02010a; color: #e8eaf6; font-family: 'Tinos', serif; overflow: hidden; }
    .mfr-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

    .mfr-top { position: absolute; top: 16px; left: 22px; right: 380px; z-index: 5; display: flex; align-items: center; gap: 18px; pointer-events: none; }
    .mfr-top > * { pointer-events: auto; }
    .mfr-back { color: #d68ddc; text-decoration: none; font-size: 13px; padding: 7px 12px; border: 1px solid #d54adf; border-radius: 8px; background: rgba(20, 10, 35, 0.7); backdrop-filter: blur(8px); }
    .mfr-back:hover { background: rgba(213, 74, 223, 0.2); }
    .mfr-title h1 { margin: 0; font-family: 'Henny Penny', cursive; font-size: 32px; color: #d54adf; text-shadow: 0 0 20px rgba(213, 74, 223, 0.5); }
    .mfr-title p { margin: 4px 0 0; font-size: 13px; opacity: 0.75; font-style: italic; }

    .mfr-stats { position: absolute; top: 16px; right: 16px; width: 350px; max-height: calc(100vh - 220px); overflow-y: auto; background: rgba(15, 8, 30, 0.88); border: 1px solid rgba(213, 74, 223, 0.4); border-radius: 14px; backdrop-filter: blur(12px); padding: 16px; z-index: 8; }
    .mfr-section { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid rgba(213, 74, 223, 0.15); }
    .mfr-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .mfr-section-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #d54adf; text-transform: uppercase; margin-bottom: 10px; }

    .mfr-big { display: flex; flex-direction: column; gap: 8px; }
    .mfr-big-row { display: flex; align-items: baseline; gap: 8px; }
    .mfr-big-icon { font-size: 18px; width: 22px; }
    .mfr-big-val { font-size: 22px; font-weight: 700; color: #f9f9f9; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; }
    .mfr-big-unit { font-size: 11px; opacity: 0.55; letter-spacing: 1px; }

    .mfr-equiv > div { font-size: 12px; margin: 4px 0; opacity: 0.85; }

    .mfr-budget-bar { width: 100%; height: 8px; background: rgba(255, 255, 255, 0.08); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .mfr-budget-fill { height: 100%; background: linear-gradient(90deg, #d54adf, #fbbf24); transition: width 0.4s ease; }
    .mfr-budget-text { font-size: 12px; opacity: 0.8; margin-bottom: 10px; font-variant-numeric: tabular-nums; }
    .mfr-budget-edit { display: flex; gap: 8px; align-items: center; }
    .mfr-budget-edit label { font-size: 11px; opacity: 0.65; flex: 1; }
    .mfr-budget-edit input { width: 70px; padding: 4px 8px; background: rgba(20, 10, 35, 0.8); border: 1px solid #d54adf; border-radius: 6px; color: #e8eaf6; font-size: 13px; font-family: inherit; }

    .mfr-btn { display: block; width: 100%; padding: 8px 12px; margin-bottom: 6px; background: rgba(20, 10, 35, 0.7); border: 1px solid rgba(213, 74, 223, 0.35); border-radius: 8px; color: #e8eaf6; cursor: pointer; font-family: inherit; font-size: 12px; text-align: left; transition: all 0.15s; }
    .mfr-btn:hover { background: rgba(213, 74, 223, 0.2); border-color: #d54adf; }
    .mfr-btn-danger { border-color: rgba(255, 80, 80, 0.4); margin-top: 10px; }
    .mfr-btn-danger:hover { background: rgba(255, 80, 80, 0.18); border-color: #ff5050; }

    .mfr-history { position: absolute; bottom: 60px; left: 22px; width: 320px; max-height: 280px; overflow-y: auto; background: rgba(15, 8, 30, 0.88); border: 1px solid rgba(213, 74, 223, 0.4); border-radius: 14px; backdrop-filter: blur(12px); padding: 14px; z-index: 8; }
    .mfr-history-item { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 12px; border-bottom: 1px solid rgba(213, 74, 223, 0.08); }
    .mfr-history-item:last-child { border-bottom: none; }
    .mfr-h-icon { font-size: 13px; }
    .mfr-h-action { flex: 1; opacity: 0.85; }
    .mfr-h-cost { font-variant-numeric: tabular-nums; opacity: 0.65; color: #fbbf24; }
    .mfr-history-empty { font-size: 12px; opacity: 0.6; text-align: center; font-style: italic; padding: 12px; line-height: 1.6; }

    .mfr-manifesto { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 24px; background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%); text-align: center; font-size: 13px; opacity: 0.75; z-index: 6; pointer-events: none; }
    .mfr-manifesto em { color: #d68ddc; }
  `]
})
export class ManaFountainRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  water = inject(MagicWaterService);
  private router = inject(Router);
  private ceremonyBus = inject(CeremonyBusService);

  // ─── 3D refs ───
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private rafId = 0;
  private disposed = false;
  private elapsed = 0;
  private sky: SkyOrnamentsHandle | null = null;
  private unsubCeremony: (() => void) | null = null;

  // Éléments de la fontaine
  private fountain: any;
  private waterColumn: any;
  private waterDroplets: any[] = [];
  private waterColumnBase: Float32Array | null = null;

  recentActions = computed(() => this.water.getHistory().slice(-12).reverse());
  equivalents = computed(() => this.water.equivalents());
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '💧', title: 'Une goutte = un sort IA lancé', body: 'Chaque appel à un LLM (question, refinement, voix narrator) fait tomber une goutte. La fontaine mesure votre consommation magique.' },
    { icon: '🔮', title: 'Tokens, eau, dollars, CO₂', body: 'Quatre compteurs : tokens consommés, millilitres d\'eau cooling datacenter, dollars dépensés, grammes de CO₂ émis.' },
    { icon: '🚿', title: 'Équivalences concrètes', body: 'Vos tokens deviennent des fractions de douche, bouteilles d\'eau, ou ppm de piscine. Le but : rendre l\'IA tangible.' },
    { icon: '💸', title: 'Budget mensuel + jauge', body: 'Définissez un plafond mensuel. La barre se remplit à mesure que vous consommez. Au-delà de 80%, alerte.' },
    { icon: '📜', title: 'Manifesto en bas', body: '"Aucune magie n\'est gratuite." Le but de cette room est éducatif : sensibiliser à l\'impact écologique et financier de l\'IA.' },
  ];
  tutorialVoiceLines: string[] = [
    'Une goutte tombe à chaque sort IA lancé.',
    'On mesure tokens, eau, dollars, et CO₂.',
    'Vos tokens deviennent des fractions de douche.',
    'Une jauge surveille votre budget mensuel.',
    'Aucune magie n\'est gratuite.',
  ];

  openTutorial(): void {
    this.tutorialStep.set(0);
    this.tutorialOpen.set(true);
  }

  ngOnInit(): void {
    this.bootstrap();
  }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    window.removeEventListener('resize', this.onResize);
  }

  private async bootstrap(): Promise<void> {
    await this.ensureThree();
    if (this.disposed) return;
    this.initScene();
    this.animate();
  }

  private async ensureThree(): Promise<void> {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
  }
  private loadScript(src: string): Promise<void> {
    return new Promise(r => { const s = document.createElement('script'); s.src = src; s.onload = () => r(); s.onerror = () => r(); document.head.appendChild(s); });
  }

  private initScene(): void {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x02010a);
    this.scene.fog = new T.FogExp2(0x0a0820, 0.008);

    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(8, 8, 12);
    this.camera.lookAt(0, 1.5, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights
    this.scene.add(new T.AmbientLight(0x6a4a8a, 0.55));
    const key = new T.DirectionalLight(0xd68ddc, 1.0);
    key.position.set(6, 10, 8);
    this.scene.add(key);
    this.scene.add(new T.HemisphereLight(0xd54adf, 0x1a0a30, 0.5));

    // Sky universel synchronisé
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 600, starRadius: 80,
      moonPos: [-22, 28, -25],
      auroraPos: [0, 32, -45],
      cometPos: [25, 28, -20],
      shootingStarCount: 5,
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'mana-fountain') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Sol (plateforme pierre)
    const floor = new T.Mesh(
      new T.CylinderGeometry(20, 20, 0.4, 64),
      new T.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.9, metalness: 0.1 })
    );
    floor.position.y = -0.3;
    this.scene.add(floor);

    // ═══ FONTAINE CENTRALE ═══
    this.buildFountain(T);

    // ═══ 4 STATUETTES (token, eau, $, CO₂) ═══
    this.buildStatues(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 1.5, 0);
      this.controls.maxDistance = 30;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI / 2.1;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);
  }

  private buildFountain(T: any): void {
    this.fountain = new T.Group();
    // Vasque inférieure (large)
    const lowerBowl = new T.Mesh(
      new T.CylinderGeometry(3.5, 3.0, 0.6, 32),
      new T.MeshStandardMaterial({ color: 0x4a3a6a, roughness: 0.85, metalness: 0.15 })
    );
    lowerBowl.position.y = 0.3;
    this.fountain.add(lowerBowl);
    // Vasque intérieure (creuse)
    const inner = new T.Mesh(
      new T.CylinderGeometry(2.8, 2.8, 0.5, 32),
      new T.MeshStandardMaterial({ color: 0x6a4a8a, roughness: 0.8 })
    );
    inner.position.y = 0.4;
    this.fountain.add(inner);
    // Eau dans la vasque (cercle bleu-violet émissif)
    const water = new T.Mesh(
      new T.CircleGeometry(2.7, 32),
      new T.MeshStandardMaterial({ color: 0xa3e9ff, emissive: 0xa3e9ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, side: T.DoubleSide })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.6;
    this.fountain.add(water);
    (this.fountain as any).userData.waterSurface = water;
    // Piédestal central (colonne)
    const pedestal = new T.Mesh(
      new T.CylinderGeometry(0.8, 1.0, 2.5, 16),
      new T.MeshStandardMaterial({ color: 0x4a3a6a, roughness: 0.85 })
    );
    pedestal.position.y = 1.85;
    this.fountain.add(pedestal);
    // Vasque supérieure
    const upperBowl = new T.Mesh(
      new T.CylinderGeometry(1.5, 1.2, 0.4, 24),
      new T.MeshStandardMaterial({ color: 0x6a4a8a, roughness: 0.75 })
    );
    upperBowl.position.y = 3.2;
    this.fountain.add(upperBowl);

    // Colonne d'eau lumineuse (au-dessus, niveau = budget restant)
    const colHeight = 4;
    const colGeom = new T.CylinderGeometry(0.35, 0.18, colHeight, 16, 24, true);
    const colMat = new T.MeshBasicMaterial({
      color: 0xa3e9ff, transparent: true, opacity: 0.55,
      blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false,
    });
    this.waterColumn = new T.Mesh(colGeom, colMat);
    this.waterColumn.position.y = 5.4;
    this.fountain.add(this.waterColumn);
    // Save base positions pour ondulation
    this.waterColumnBase = new Float32Array(colGeom.attributes.position.array);

    // Light au-dessus de la colonne (glow magenta+cyan)
    const colLight = new T.PointLight(0xd68ddc, 1.5, 12);
    colLight.position.y = 5.4;
    this.fountain.add(colLight);

    // Gouttes qui tombent en continu (particules)
    for (let i = 0; i < 24; i++) {
      const drop = new T.Mesh(
        new T.SphereGeometry(0.05, 8, 6),
        new T.MeshBasicMaterial({ color: 0xa3e9ff, transparent: true, opacity: 0.85 })
      );
      drop.userData = {
        baseAngle: (i / 24) * Math.PI * 2,
        radius: 0.25 + Math.random() * 0.5,
        speed: 1.5 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
      };
      this.waterDroplets.push(drop);
      this.fountain.add(drop);
    }

    this.scene.add(this.fountain);
  }

  private buildStatues(T: any): void {
    const items = [
      { angle: 0,         color: 0xd54adf, symbol: '🔮', label: 'TOKEN' },     // tokens
      { angle: Math.PI/2, color: 0xa3e9ff, symbol: '💧', label: 'ML' },        // eau mL
      { angle: Math.PI,   color: 0xfbbf24, symbol: '🪙', label: 'COST' },      // $
      { angle: 3*Math.PI/2, color: 0x86efac, symbol: '🌍', label: 'CO2' },     // CO₂
    ];
    const R = 7;
    for (const it of items) {
      const g = new T.Group();
      g.position.set(Math.cos(it.angle) * R, 0, Math.sin(it.angle) * R);
      // Piédestal
      const ped = new T.Mesh(
        new T.CylinderGeometry(0.5, 0.7, 1.0, 8),
        new T.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.9 })
      );
      ped.position.y = 0.5;
      g.add(ped);
      // Statuette (sphère iconique colorée)
      const stat = new T.Mesh(
        new T.IcosahedronGeometry(0.5, 0),
        new T.MeshStandardMaterial({ color: it.color, emissive: it.color, emissiveIntensity: 0.8, roughness: 0.3 })
      );
      stat.position.y = 1.4;
      stat.userData.spin = true;
      g.add(stat);
      // Halo
      const halo = new T.Mesh(
        new T.RingGeometry(0.8, 1.0, 24),
        new T.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.4, side: T.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.06;
      g.add(halo);
      // Light glow
      const light = new T.PointLight(it.color, 0.7, 5);
      light.position.y = 1.6;
      g.add(light);
      this.scene.add(g);
    }
  }

  // Animation loop
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // Ondulation eau dans la vasque
    const ws = (this.fountain as any)?.userData?.waterSurface;
    if (ws) {
      ws.material.opacity = 0.75 + Math.sin(this.elapsed * 2) * 0.1;
    }

    // Colonne d'eau : ondulation + hauteur = budget restant
    if (this.waterColumn && this.waterColumnBase) {
      const remainingPct = 1 - this.water.budgetRatio();
      this.waterColumn.scale.y = 0.3 + remainingPct * 1.2;
      this.waterColumn.position.y = 5.4 - (1 - this.waterColumn.scale.y) * 1.5;
      const pos = this.waterColumn.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const baseX = this.waterColumnBase[i];
        const baseZ = this.waterColumnBase[i + 2];
        arr[i] = baseX + Math.sin(this.elapsed * 3 + baseX * 4) * 0.04;
        arr[i + 2] = baseZ + Math.cos(this.elapsed * 2 + baseZ * 4) * 0.04;
      }
      pos.needsUpdate = true;
    }

    // Gouttes qui tournent autour de la fontaine + tombent
    for (const d of this.waterDroplets) {
      const ud = d.userData;
      const t = (this.elapsed * ud.speed + ud.phase) % 4;
      const angle = ud.baseAngle + this.elapsed * 0.3;
      const r = ud.radius + 0.5;
      d.position.x = Math.cos(angle) * r;
      d.position.z = Math.sin(angle) * r;
      d.position.y = 5.2 - t * 1.0;
      if (d.position.y < 0.8) d.position.y = 5.4;
    }

    // Statuettes : spin
    this.scene.traverse((obj: any) => {
      if (obj.userData?.spin) obj.rotation.y = this.elapsed * 0.5;
    });

    this.sky?.tick(dt, this.elapsed);
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  // ─── Actions UI ───
  setBudget(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) this.water.setMonthlyBudget(v);
  }
  resetAll(): void {
    if (confirm('Reset complet de la consommation eau magique ? Cette action est irréversible.')) {
      this.water.reset();
    }
  }
  simulateAction(p: keyof typeof PRESETS): void {
    this.water.consumePreset(p, 'mana-fountain');
    // Aussi publish au bus pour faire scintiller le ciel des autres îles
    this.ceremonyBus.publish({
      type: 'aube',
      label: `IA: ${p}`,
      icon: '💧',
      sourceRoom: 'mana-fountain',
    });
  }
  formatTokens(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }
  formatMl(ml: number): string {
    if (ml >= 1000) return (ml / 1000).toFixed(2) + ' L';
    return ml.toFixed(1) + ' mL';
  }

  /** Lancer le play */
  onSplashPlay(): void {
    this.splashVisible.set(false);
    // mana-fountain has no narrator — start internal demo if available, else just hide
  }

  /** Entrer (skip play) */
  onSplashEnter(): void {
    this.splashVisible.set(false);
  }
}
