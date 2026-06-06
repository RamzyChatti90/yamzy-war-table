// ═══════════════════════════════════════════════════════════════════
// 🏖 DEFINITIONS BEACH ROOM — La Plage des Définitions
//
// Workshop : Definition of Ready / Definition of Done
// Métaphore : plage avec 2 zones séparées par une corde — READY (gauche)
// vs DONE (droite). Chaque drapeau planté = un critère.
//
// 3D :
//   - Sable doré (cylindre large pale yellow/cream)
//   - Mer/océan au fond (plane large bleu ondulant)
//   - Corde au centre séparant les 2 zones (cylindre horizontal)
//   - 5 drapeaux READY verts (gauche)
//   - 5 drapeaux DONE bleus (droite)
//   - Petite mascotte crab procédural qui se promène
//   - Coquillages roses scattered sur la plage
//   - Lignes courbes entre certains drapeaux (links DoR↔DoD)
//   - Parasol coloré au centre
//
// Anim : drapeaux flottent au vent · vagues · crab walk
// Camera 50 FOV, position (0, 8, 14) lookAt (0, 1, 0)
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
import { SpellTutorialOverlayComponent, TutorialStep, SpellButtonComponent, SpellFooterService } from '../../core/spell-ui';

// ─── Modèles métier ───
interface BeachFlag {
  id: string;
  side: 'ready' | 'done';
  text: string;        // ex: 'critères d\'acceptation rédigés'
  icon: string;        // emoji
}

@Component({
  selector: 'wt-definitions-beach-room',
  standalone: true,
  imports: [CommonModule, RouterLink, NarratorComponent, RoomSplashComponent, SpellTutorialOverlayComponent, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="db-host">
      <header class="db-topbar">
        <div class="db-title">
          <h1>🏖 La Plage des Définitions</h1>
          <p>DoR / DoD · drapeaux Ready & Done plantés dans le sable</p>
        </div>
      </header>

      <canvas #canvas class="db-canvas"></canvas>

      <!-- Sidebar : Ready + Done -->
      <aside class="db-sidebar">
        <div class="db-side-section">
          <div class="db-side-title ready">🏳 READY · DoR</div>
          <div *ngFor="let f of readyFlags()" class="db-flag-row ready">
            <span class="db-icon">{{ f.icon }}</span>
            <span class="db-text">{{ f.text }}</span>
          </div>
        </div>
        <div class="db-side-section">
          <div class="db-side-title done">🏳 DONE · DoD</div>
          <div *ngFor="let f of doneFlags()" class="db-flag-row done">
            <span class="db-icon">{{ f.icon }}</span>
            <span class="db-text">{{ f.text }}</span>
          </div>
        </div>
        <div class="db-hint">Chaque drapeau planté = un critère validé. Liens = DoR ↔ DoD complémentaires.</div>
      </aside>

      <wt-narrator></wt-narrator>

      <div *ngIf="ceremonyFlash() as f" class="db-flash">
        <div class="db-flash-content">
          <div class="db-flash-icon">{{ f.icon }}</div>
          <div class="db-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- 🎬 Splash overlay -->
      <wt-spell-tutorial-overlay *ngIf="tutorialOpen()"
        title="Definitions Beach"
        loreName="La Plage des Définitions"
        accent="#fde68a"
        [steps]="tutorialSteps"
        [currentStep]="tutorialStep()"
        [voiceLines]="tutorialVoiceLines"
        (stepChange)="tutorialStep.set($event)"
        (close)="tutorialOpen.set(false)" />

      <wt-room-splash *ngIf="splashVisible()"
        title="Definitions Beach"
        loreName="La Plage des Définitions"
        color="#fde68a"
        oneLiner="DoR/DoD : drapeaux Ready/Done plantés dans le sable, liens, export markdown."
        [duration]="60"
        [timeboxDurationS]="600"
        [timeboxLabel]="'Play'"
        (onPlay)="onSplashPlay()"
        (onPlayTimebox)="onSplashTimebox()"
        (onEnter)="onSplashEnter()" />
    </div>
  `,
  styles: [`
    :host { display: block; position: fixed; inset: 0; }
    .db-host { position: relative; width: 100%; height: 100dvh; max-height: 100dvh; background: #87ceeb; color: #1e293b; font-family: "Tinos", serif; overflow: hidden; }
    .db-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

    .db-topbar { position: absolute; top: 60px; left: 0; right: 0; padding: 14px 22px; z-index: 10; display: flex; align-items: center; gap: 18px; background: linear-gradient(180deg, rgba(13,32,55,0.65) 0%, rgba(13,32,55,0) 100%); pointer-events: none; color: #f8fafc; }
    .db-topbar > * { pointer-events: auto; }
    .db-back { color: #fde68a; text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid #fbbf24; border-radius: 8px; background: rgba(120,53,15,0.45); }
    .db-back:hover { background: rgba(251,191,36,0.4); }
    .db-title h1 { margin: 0; font-family: "Henny Penny", cursive; font-weight: 400; font-size: 18px; color: #fff; text-shadow: 0 0 12px rgba(13,32,55,0.7); letter-spacing: 1px; }
    .db-title p { margin: 2px 0 0; font-size: 11px; opacity: 0.85; font-style: italic; }
    .db-actions { margin-left: auto; display: flex; gap: 8px; }
    .db-actions button { background: rgba(15,23,42,0.6); color: #f1f5f9; border: 1px solid rgba(253, 230, 138, 0.45); padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    .db-actions button:hover { background: rgba(15,23,42,0.85); }
    .db-actions .db-narrator { background: rgba(40,30,5,0.7); border-color: #b89240; color: #fbbf24; font-weight: 600; }
    .db-actions .db-narrator:hover { background: rgba(251,191,36,0.3); }
    .db-actions .db-narrator.db-play { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .db-actions .db-narrator.db-play:hover { background: #f5b923; }

    .db-sidebar { position: absolute; right: 16px; top: 90px; bottom: 16px; width: 340px; overflow-y: auto; background: rgba(254, 252, 232, 0.95); border: 1px solid rgba(251, 191, 36, 0.5); border-radius: 14px; backdrop-filter: blur(10px); padding: 16px; z-index: 8; color: #422006; box-shadow: 0 8px 28px rgba(0,0,0,0.18); }
    .db-side-section { margin-bottom: 16px; }
    .db-side-title { font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; padding: 6px 10px; border-radius: 8px; }
    .db-side-title.ready { background: rgba(34,197,94,0.18); color: #15803d; border-left: 4px solid #22c55e; }
    .db-side-title.done { background: rgba(59,130,246,0.18); color: #1d4ed8; border-left: 4px solid #3b82f6; }
    .db-flag-row { display: flex; gap: 10px; align-items: flex-start; padding: 7px 10px; margin: 6px 0; border-radius: 8px; background: rgba(255,255,255,0.7); border: 1px solid transparent; font-size: 12px; }
    .db-flag-row.ready { border-color: rgba(34,197,94,0.35); }
    .db-flag-row.done { border-color: rgba(59,130,246,0.35); }
    .db-icon { font-size: 14px; }
    .db-text { line-height: 1.4; }
    .db-hint { margin-top: 10px; font-size: 11px; opacity: 0.65; font-style: italic; padding: 8px; border-top: 1px dashed rgba(120,53,15,0.3); }

    .db-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(253,230,138,0.55), transparent 60%); animation: db-flash-pulse 1.6s ease-out forwards; }
    .db-flash-content { text-align: center; animation: db-flash-grow 1.6s cubic-bezier(0.16, 1, 0.3, 1); }
    .db-flash-icon { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(253,230,138,0.8)); }
    .db-flash-label { font-size: 22px; margin-top: 8px; color: #422006; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 10px rgba(254,243,199,0.9); }
    @keyframes db-flash-pulse { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes db-flash-grow { 0% { transform: scale(0.4); opacity: 0; } 18% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }
  `]
})
export class DefinitionsBeachRoomComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);
  private ceremonyBus = inject(CeremonyBusService);
  private router = inject(Router);

  readyFlags = signal<BeachFlag[]>([
    { id: 'r1', side: 'ready', icon: '📜', text: 'Critères d\'acceptation rédigés et compris' },
    { id: 'r2', side: 'ready', icon: '🎯', text: 'Objectif business clarifié + KPI mesurable' },
    { id: 'r3', side: 'ready', icon: '📦', text: 'Dépendances identifiées et débloquées' },
    { id: 'r4', side: 'ready', icon: '📏', text: 'Estimation Fibonacci consensuelle ≤ 8 points' },
    { id: 'r5', side: 'ready', icon: '🎨', text: 'Maquette / wireframe validé Product' },
  ]);

  doneFlags = signal<BeachFlag[]>([
    { id: 'd1', side: 'done', icon: '✅', text: 'Tests unitaires verts (coverage > 80%)' },
    { id: 'd2', side: 'done', icon: '🧪', text: 'Tests E2E green sur la branche' },
    { id: 'd3', side: 'done', icon: '👀', text: 'Code review approved (≥ 1 reviewer)' },
    { id: 'd4', side: 'done', icon: '📚', text: 'Documentation à jour (README / changelog)' },
    { id: 'd5', side: 'done', icon: '🚀', text: 'Déployé en staging + validation Product' },
  ]);

  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  splashVisible = signal<boolean>(true);

  // 🎓 Tutorial overlay state
  tutorialOpen = signal<boolean>(false);
  tutorialStep = signal<number>(0);
  tutorialSteps: TutorialStep[] = [
    { icon: '🏖', title: 'Une plage, deux drapeaux', body: 'La plage abrite deux fanions plantés dans le sable : à gauche la Definition of Ready (DoR), à droite la Definition of Done (DoD).' },
    { icon: '🚩', title: 'DoR = "prête à entrer en sprint"', body: 'Le drapeau Ready liste les critères qu\'une story doit cocher avant d\'entrer en backlog sprint : claire, estimée, testable.' },
    { icon: '🏁', title: 'DoD = "vraiment terminée"', body: 'Le drapeau Done liste ce qui rend une story livrable : tests verts, code review, doc à jour, déployée en staging.' },
    { icon: '🪵', title: 'Cliquez un critère pour l\'éditer', body: 'Chaque critère est une planche de bois flotté. Cliquez pour modifier, faites glisser pour réordonner, double-clic pour supprimer.' },
    { icon: '📋', title: 'Export markdown vers l\'équipe', body: 'Le bouton Exporter génère un fichier .md avec vos DoR/DoD à coller dans le wiki ou le README du repo.' },
  ];
  tutorialVoiceLines: string[] = [
    'Deux drapeaux plantés sur la plage : Ready et Done.',
    'La DoR définit ce qui rentre en sprint.',
    'La DoD définit ce qui est vraiment livré.',
    'Cliquez les planches pour éditer les critères.',
    'Exportez en markdown pour le wiki.',
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
  private sand: any = null;
  private ocean: any = null;
  private oceanBasePos: Float32Array | null = null;
  private readyFlagMeshes: any[] = [];
  private doneFlagMeshes: any[] = [];
  private ropeGroup: any = null;
  private crab: any = null;
  private umbrella: any = null;
  private shells: any[] = [];
  private linkCurves: any[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    this.bootstrap();
    this.spellFooter.setSlots({
      accent: '#fde68a',
      controls: [
        { icon: '🎥', label: 'Reset cam', action: () => this.resetCamera() },
        { icon: '📤', label: 'Export markdown', action: () => this.exportMarkdown() },
        { icon: '🎓', label: 'How it works', variant: 'primary', action: () => this.openTutorial(), title: 'Visite guidée par Yamzy' },
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
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init();
    this.animate();

    // 🎬 Intro cinématique : arrivée depuis la mer
    playIslandIntro(
      this.camera,
      this.controls,
      { x: 0, y: 8, z: 14 },
      { x: 0, y: 1, z: 0 },
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

    // Scène claire, ciel bleu / coucher de soleil doré
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x87ceeb);
    this.scene.fog = new T.FogExp2(0xfde68a, 0.012);

    // Caméra 50 FOV
    this.camera = new T.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 1, 0);

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights : soleil chaud + ambient
    this.scene.add(new T.AmbientLight(0xfde68a, 0.6));
    const sun = new T.DirectionalLight(0xfff7e0, 1.2);
    sun.position.set(8, 14, 4);
    this.scene.add(sun);
    this.scene.add(new T.HemisphereLight(0x87ceeb, 0xfde68a, 0.5));

    // Sky universel (étoiles atténuées en journée mais présentes)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 500, starRadius: 90,
      moonPos: [-22, 24, -28],
      auroraPos: [0, 28, -45],
      cometPos: [22, 20, -16],
      shootingStarCount: 4,
    });
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'definitions-beach') return;     // anti-loop
      this.sky?.pulseCeremony(c.type);
    });

    // ═══ Construction de la plage ═══
    this.buildSand(T);
    this.buildOcean(T);
    this.buildRopeBarrier(T);
    this.buildFlags(T);
    this.buildShells(T);
    this.buildUmbrella(T);
    this.buildCrab(T);
    this.buildLinks(T);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, 1, 0);
      this.controls.maxDistance = 32;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI / 2.1;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    // 🪶 Narrator
    this.narrator.attach({
      camera: this.camera,
      controls: this.controls,
      scene: this.scene,
      clock: this.clock,
      roomComponent: this,
      roomKey: 'definitions-beach',
    });

    console.log('[DefinitionsBeach] 🏖 Beach ready · 5 READY + 5 DONE flags, crab walking');
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : sol sable doré (cylindre large pale yellow)
  // ═══════════════════════════════════════════════════════════════════
  private buildSand(T: any) {
    const sandGeom = new T.CylinderGeometry(15, 15, 0.6, 64);
    const sandMat = new T.MeshStandardMaterial({
      color: 0xfde68a, roughness: 0.92, metalness: 0.05,
      emissive: 0x422006, emissiveIntensity: 0.04,
    });
    this.sand = new T.Mesh(sandGeom, sandMat);
    this.sand.position.y = 0;
    this.scene.add(this.sand);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : océan au fond (plane large bleu ondulant)
  // ═══════════════════════════════════════════════════════════════════
  private buildOcean(T: any) {
    const oceanGeom = new T.PlaneGeometry(80, 50, 40, 25);
    const oceanMat = new T.MeshStandardMaterial({
      color: 0x2563eb, roughness: 0.3, metalness: 0.4,
      emissive: 0x1e3a8a, emissiveIntensity: 0.18,
      transparent: true, opacity: 0.88,
    });
    this.ocean = new T.Mesh(oceanGeom, oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(0, 0.25, -22);
    this.scene.add(this.ocean);

    // Save base positions pour ondulation vagues
    this.oceanBasePos = new Float32Array(oceanGeom.attributes.position.array);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : corde au centre séparant les zones
  // ═══════════════════════════════════════════════════════════════════
  private buildRopeBarrier(T: any) {
    this.ropeGroup = new T.Group();

    // Poteaux gauche et droite
    const postMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const postGeom = new T.CylinderGeometry(0.12, 0.15, 1.5, 8);
    const leftPost = new T.Mesh(postGeom, postMat);
    leftPost.position.set(-8, 1.05, 0);
    this.ropeGroup.add(leftPost);
    const rightPost = new T.Mesh(postGeom, postMat);
    rightPost.position.set(8, 1.05, 0);
    this.ropeGroup.add(rightPost);

    // Corde principale = cylindre allongé légèrement courbé (twisted via texture/segments)
    const ropeGeom = new T.CylinderGeometry(0.08, 0.08, 16, 8, 1);
    const ropeMat = new T.MeshStandardMaterial({ color: 0xb8825c, roughness: 0.95 });
    const rope = new T.Mesh(ropeGeom, ropeMat);
    rope.position.set(0, 1.45, 0);
    rope.rotation.z = Math.PI / 2;
    rope.userData = { kind: 'rope' };
    rope.userData.tutorialId = 'rope';
    this.ropeGroup.add(rope);

    // Étiquettes READY (gauche) et DONE (droite) sous forme de sprites
    const readyLabel = this.makeCanvasLabel(T, 'READY', '#15803d');
    readyLabel.position.set(-6, 2.4, 0);
    readyLabel.scale.set(3, 0.8, 1);
    this.ropeGroup.add(readyLabel);

    const doneLabel = this.makeCanvasLabel(T, 'DONE', '#1d4ed8');
    doneLabel.position.set(6, 2.4, 0);
    doneLabel.scale.set(3, 0.8, 1);
    this.ropeGroup.add(doneLabel);

    this.scene.add(this.ropeGroup);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : drapeaux READY (gauche, verts) + DONE (droite, bleus)
  // ═══════════════════════════════════════════════════════════════════
  private buildFlags(T: any) {
    const readyFlags = this.readyFlags();
    const doneFlags = this.doneFlags();

    // READY (gauche, x négatif)
    for (let i = 0; i < readyFlags.length; i++) {
      const angle = (i / readyFlags.length) * Math.PI * 0.7 - Math.PI * 0.35;
      const x = -5 + Math.sin(angle) * 4;
      const z = -1.5 + i * 1.2;
      const flag = this.makeFlag(T, 0x22c55e, x, z, i === 0 ? 'ready-flag' : undefined);
      flag.userData.side = 'ready';
      flag.userData.index = i;
      this.readyFlagMeshes.push(flag);
      this.scene.add(flag);
    }

    // DONE (droite, x positif)
    for (let i = 0; i < doneFlags.length; i++) {
      const angle = (i / doneFlags.length) * Math.PI * 0.7 - Math.PI * 0.35;
      const x = 5 - Math.sin(angle) * 4;
      const z = -1.5 + i * 1.2;
      const flag = this.makeFlag(T, 0x3b82f6, x, z, i === 0 ? 'done-flag' : undefined);
      flag.userData.side = 'done';
      flag.userData.index = i;
      this.doneFlagMeshes.push(flag);
      this.scene.add(flag);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper : crée un drapeau (mât + bannière plane)
  // ═══════════════════════════════════════════════════════════════════
  private makeFlag(T: any, color: number, x: number, z: number, tutorialId?: string): any {
    const flagGroup = new T.Group();

    // Mât (cylindre vertical bois)
    const poleGeom = new T.CylinderGeometry(0.05, 0.06, 2.4, 8);
    const poleMat = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const pole = new T.Mesh(poleGeom, poleMat);
    pole.position.y = 1.2;
    flagGroup.add(pole);

    // Bannière (plane)
    const banGeom = new T.PlaneGeometry(0.9, 0.5, 8, 4);
    const banMat = new T.MeshStandardMaterial({
      color, roughness: 0.55,
      emissive: color, emissiveIntensity: 0.25,
      side: T.DoubleSide,
    });
    const banner = new T.Mesh(banGeom, banMat);
    banner.position.set(0.45, 1.9, 0);
    banner.userData = { kind: 'banner', basePhase: Math.random() * Math.PI * 2 };
    flagGroup.add(banner);
    flagGroup.userData = { banner, kind: 'flag' };
    if (tutorialId) flagGroup.userData.tutorialId = tutorialId;

    // Pointe du mât (boule dorée)
    const tip = new T.Mesh(
      new T.SphereGeometry(0.08, 12, 8),
      new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.5 }),
    );
    tip.position.y = 2.45;
    flagGroup.add(tip);

    flagGroup.position.set(x, 0.3, z);
    return flagGroup;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : coquillages scattered (petits cones roses)
  // ═══════════════════════════════════════════════════════════════════
  private buildShells(T: any) {
    const colors = [0xfda4af, 0xfdba74, 0xfef3c7, 0xfecdd3, 0xfed7aa];
    for (let i = 0; i < 18; i++) {
      const c = colors[i % colors.length];
      const shellGeom = new T.ConeGeometry(0.18, 0.32, 6);
      const shellMat = new T.MeshStandardMaterial({
        color: c, roughness: 0.7, metalness: 0.15,
        emissive: c, emissiveIntensity: 0.1,
      });
      const shell = new T.Mesh(shellGeom, shellMat);
      // Position : éparpillés sur la plage (évite la corde au centre)
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 8;
      shell.position.set(
        Math.cos(angle) * radius,
        0.32,
        Math.sin(angle) * radius - 1,
      );
      shell.rotation.y = Math.random() * Math.PI * 2;
      shell.rotation.z = (Math.random() - 0.5) * 0.6;
      shell.userData = { kind: 'shell' };
      if (i === 0) shell.userData.tutorialId = 'shell';
      this.shells.push(shell);
      this.scene.add(shell);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : parasol coloré au centre (proche corde)
  // ═══════════════════════════════════════════════════════════════════
  private buildUmbrella(T: any) {
    this.umbrella = new T.Group();

    // Mât
    const mast = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.06, 3.5, 8),
      new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 }),
    );
    mast.position.y = 1.7;
    this.umbrella.add(mast);

    // Cône supérieur (parasol) — bandes alternées colorées via group
    const colors = [0xef4444, 0xfde68a, 0x3b82f6, 0xfde68a, 0xef4444, 0xfde68a, 0x22c55e, 0xfde68a];
    for (let i = 0; i < colors.length; i++) {
      const wedgeGeom = new T.ConeGeometry(1.6, 0.9, 3, 1, false,
        (i / colors.length) * Math.PI * 2,
        (1 / colors.length) * Math.PI * 2,
      );
      const wedgeMat = new T.MeshStandardMaterial({
        color: colors[i], roughness: 0.6,
        emissive: colors[i], emissiveIntensity: 0.12,
        side: T.DoubleSide,
      });
      const wedge = new T.Mesh(wedgeGeom, wedgeMat);
      wedge.position.y = 3.4;
      this.umbrella.add(wedge);
    }

    // Pointe dorée
    const tip = new T.Mesh(
      new T.SphereGeometry(0.12, 12, 8),
      new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6 }),
    );
    tip.position.y = 3.95;
    this.umbrella.add(tip);

    this.umbrella.position.set(0, 0.3, 3.5);
    this.umbrella.userData = { kind: 'umbrella' };
    this.umbrella.userData.tutorialId = 'umbrella';
    this.scene.add(this.umbrella);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : crab procédural qui se promène
  // ═══════════════════════════════════════════════════════════════════
  private buildCrab(T: any) {
    this.crab = new T.Group();

    // Corps (box écrasée rouge)
    const bodyGeom = new T.BoxGeometry(0.5, 0.22, 0.4);
    const bodyMat = new T.MeshStandardMaterial({
      color: 0xef4444, roughness: 0.55, metalness: 0.2,
      emissive: 0x7f1d1d, emissiveIntensity: 0.18,
    });
    const body = new T.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.15;
    this.crab.add(body);

    // 2 yeux (sphères noires sur tiges blanches)
    for (let i = -1; i <= 1; i += 2) {
      const stem = new T.Mesh(
        new T.CylinderGeometry(0.025, 0.025, 0.16, 6),
        new T.MeshStandardMaterial({ color: 0xffffff }),
      );
      stem.position.set(i * 0.12, 0.32, -0.15);
      this.crab.add(stem);
      const eye = new T.Mesh(
        new T.SphereGeometry(0.05, 8, 6),
        new T.MeshStandardMaterial({ color: 0x000000, emissive: 0x222222 }),
      );
      eye.position.set(i * 0.12, 0.42, -0.15);
      this.crab.add(eye);
    }

    // 2 pinces (cones)
    for (let i = -1; i <= 1; i += 2) {
      const claw = new T.Mesh(
        new T.ConeGeometry(0.1, 0.25, 6),
        bodyMat,
      );
      claw.position.set(i * 0.32, 0.18, -0.3);
      claw.rotation.x = -Math.PI / 3;
      claw.rotation.z = i * 0.4;
      this.crab.add(claw);
    }

    this.crab.position.set(0, 0.3, 4);
    this.crab.userData = { kind: 'crab', walkPhase: 0, walkRadius: 5 };
    this.crab.userData.tutorialId = 'crab';
    this.scene.add(this.crab);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD : liens courbes entre certains drapeaux DoR ↔ DoD
  // ═══════════════════════════════════════════════════════════════════
  private buildLinks(T: any) {
    // Liens : Ready 0 ↔ Done 0, Ready 2 ↔ Done 3, Ready 4 ↔ Done 1
    const pairs: [number, number][] = [[0, 0], [2, 3], [4, 1]];
    for (const [r, d] of pairs) {
      const ready = this.readyFlagMeshes[r];
      const done = this.doneFlagMeshes[d];
      if (!ready || !done) continue;

      // Courbe Bézier passant en altitude
      const start = ready.position.clone();
      start.y += 2.2;
      const end = done.position.clone();
      end.y += 2.2;
      const mid = start.clone().lerp(end, 0.5);
      mid.y += 1.8;

      const curve = new T.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(30);
      const geom = new T.BufferGeometry().setFromPoints(points);
      const mat = new T.LineBasicMaterial({
        color: 0xfbbf24, transparent: true, opacity: 0.55,
        linewidth: 2,
      });
      const line = new T.Line(geom, mat);
      line.userData = { kind: 'link', readyIdx: r, doneIdx: d };
      this.linkCurves.push(line);
      this.scene.add(line);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helper : sprite-text via canvas
  // ═══════════════════════════════════════════════════════════════════
  private makeCanvasLabel(T: any, text: string, color: string): any {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 36px system-ui, sans-serif';
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
    sprite.scale.set(2.5, 0.7, 1);
    return sprite;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÉRÉMONIE / API publique pour narrator + bus
  // ═══════════════════════════════════════════════════════════════════
  emitCeremony(c: { type: string; label: string; icon: string }) {
    this.ceremonyBus.publishFromRoom('definitions-beach', c);
    this.ceremonyFlash.set(c);
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1600);
  }

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

  /** ⏱ Lance le mode TIMEBOX RÉEL — HUD countdown avec la vraie durée Scrum, sans narration. */
  onSplashTimebox(): void {
    this.splashVisible.set(false);
    this.narrator.startTimeboxOnly(600, 'DoR/DoD review');
  }

  // 🎬 Méthodes invoquées par playExample tutorial JSON
  /** Plante un drapeau READY index N (pulse highlight) */
  plantReadyFlag(index: number) {
    const f = this.readyFlagMeshes[index];
    if (!f) return;
    f.userData.plantBoost = performance.now() + 2500;
    this.emitCeremony({ type: 'flag', label: '🏳 DoR planté · ' + (this.readyFlags()[index]?.text || 'critère ready'), icon: '🏳' });
  }

  /** Plante un drapeau DONE index N */
  plantDoneFlag(index: number) {
    const f = this.doneFlagMeshes[index];
    if (!f) return;
    f.userData.plantBoost = performance.now() + 2500;
    this.emitCeremony({ type: 'flag', label: '🏳 DoD planté · ' + (this.doneFlags()[index]?.text || 'critère done'), icon: '🏳' });
  }

  /** Trace un lien DoR↔DoD (highlight courbe) */
  highlightLink(readyIdx: number, doneIdx: number) {
    const link = this.linkCurves.find(l => l.userData?.readyIdx === readyIdx && l.userData?.doneIdx === doneIdx);
    if (link) {
      link.userData.boostUntil = performance.now() + 3500;
    }
    this.emitCeremony({ type: 'flag', label: '⛓ Lien DoR ↔ DoD tracé', icon: '⛓' });
  }

  /** Export markdown (vrai trigger côté UI ou simulation) */
  exportMarkdown() {
    const lines: string[] = [];
    lines.push('# Definition of Ready (DoR) / Definition of Done (DoD)');
    lines.push('');
    lines.push('## 🏳 DoR — Definition of Ready');
    for (const f of this.readyFlags()) lines.push(`- ${f.icon} ${f.text}`);
    lines.push('');
    lines.push('## 🏳 DoD — Definition of Done');
    for (const f of this.doneFlags()) lines.push(`- ${f.icon} ${f.text}`);
    lines.push('');
    lines.push('_Generated by Definitions Beach · Yamzy World_');
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'definitions.md';
    a.click();
    URL.revokeObjectURL(url);
    this.emitCeremony({ type: 'flag', label: '📤 DoR/DoD exporté en markdown', icon: '📤' });
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

    // ─── Vagues : ondulation du plane océan ───
    if (this.ocean && this.oceanBasePos) {
      const arr = this.ocean.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const baseX = this.oceanBasePos[i];
        const baseY = this.oceanBasePos[i + 1];
        // z is the height (since plane was rotated)
        arr[i + 2] = Math.sin(baseX * 0.25 + this.elapsed * 1.2) * 0.35
                   + Math.cos(baseY * 0.18 + this.elapsed * 0.9) * 0.25;
      }
      this.ocean.geometry.attributes.position.needsUpdate = true;
      this.ocean.geometry.computeVertexNormals();
    }

    // ─── Drapeaux : flottent au vent (banner rotates + pulse if planted) ───
    const allFlags = [...this.readyFlagMeshes, ...this.doneFlagMeshes];
    for (const f of allFlags) {
      const banner = f.userData?.banner;
      if (banner) {
        const phase = banner.userData?.basePhase || 0;
        // Rotation : agitation au vent
        banner.rotation.y = Math.sin(this.elapsed * 2 + phase) * 0.3;
        banner.scale.x = 1 + Math.sin(this.elapsed * 2.5 + phase) * 0.1;
      }
      // Boost si fraîchement planté
      if (f.userData?.plantBoost && nowMs < f.userData.plantBoost) {
        const remaining = (f.userData.plantBoost - nowMs) / 2500;
        f.scale.setScalar(1 + remaining * 0.4);
      } else {
        f.scale.setScalar(1);
      }
    }

    // ─── Crab : walk en cercle autour de la plage ───
    if (this.crab) {
      const ud = this.crab.userData;
      ud.walkPhase += dt * 0.4;
      const r = ud.walkRadius;
      this.crab.position.x = Math.cos(ud.walkPhase) * r;
      this.crab.position.z = Math.sin(ud.walkPhase) * r * 0.7 + 1.5;
      // Le crab regarde dans son sens de marche
      this.crab.rotation.y = -ud.walkPhase + Math.PI / 2;
      // Petit bobbing (boitement crabesque)
      this.crab.position.y = 0.3 + Math.abs(Math.sin(this.elapsed * 6)) * 0.06;
    }

    // ─── Coquillages : très subtle rotation / shimmer ───
    for (const shell of this.shells) {
      shell.rotation.y += dt * 0.05;
    }

    // ─── Liens DoR↔DoD : opacity pulse, boost if highlighted ───
    for (const link of this.linkCurves) {
      if (!link.material) continue;
      const ud = link.userData;
      const base = (ud?.boostUntil && nowMs < ud.boostUntil) ? 1.0 : 0.45;
      link.material.opacity = base + Math.sin(this.elapsed * 2.5) * 0.1;
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
    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 1, 0);
    if (this.controls) this.controls.target.set(0, 1, 0);
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
