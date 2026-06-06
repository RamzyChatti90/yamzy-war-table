// ═══════════════════════════════════════════════════════════════════
// 🪶 NARRATOR SERVICE — Le Sage qui guide à travers les rooms
//
// • Charge le tutorial JSON pour la room courante
// • Anime la caméra (interpolation cubic-ease) vers chaque position
// • Highlight les objets 3D taggés (userData.tutorialId)
// • Diffuse les bulles texte sequentiellement
// • Sync narration ↔ caméra ↔ scène
//
// Usage dans une room :
//   constructor(private narrator: NarratorService) {}
//   // après init Three.js :
//   this.narrator.attach({ camera, controls, scene, clock, roomComponent: this, roomKey: 'git-tree-room' });
//   // pour démarrer le tour :
//   this.narrator.startTour();
//   // pour la démo animée :
//   this.narrator.startPlayExample();
// ═══════════════════════════════════════════════════════════════════
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  RoomTutorial, TutorialTourStep, TutorialExampleStep, NarratorRoomBridge,
  NarratorMode, Vec3,
} from './narrator.types';

@Injectable({ providedIn: 'root' })
export class NarratorService {
  // ═══ STATE signals (consommés par NarratorComponent UI) ═══
  /** Texte courant affiché dans la bulle (legacy / fallback) */
  currentText = signal<string>('');
  /** Mode du narrateur (Yamzy lore ou Scrum dev) */
  narratorMode = signal<NarratorMode>('yamzy');
  /** Tour actif (en train de jouer) */
  isTourActive = signal<boolean>(false);
  /** Play example actif */
  isExampleActive = signal<boolean>(false);
  /** Étape courante du tour */
  currentStepIndex = signal<number>(0);
  /** Total des étapes du tour */
  totalSteps = signal<number>(0);
  /** Étape courante de la démo (Play Example) — pour carousel manuel */
  currentExampleStepIdx = signal<number>(0);
  /** Total des étapes de la démo courante */
  totalExampleSteps = signal<number>(0);
  /** Durée totale de la démo courante en secondes (pour le timebox HUD) */
  currentDemoDuration = signal<number>(0);
  /** Nom court de la démo / cérémonie courante (pour le timebox HUD) */
  currentDemoName = signal<string>('');
  /** Mode TIMEBOX RÉEL actif (countdown HUD sans narrateur) — différent de isExampleActive */
  isTimeboxActive = signal<boolean>(false);
  /** Tutorial loaded pour la room courante */
  tutorial = signal<RoomTutorial | null>(null);
  /** Glossary entry actuellement highlightée (affichée dans le panel) */
  highlightedEntry = signal<string | null>(null);
  /** Loading state */
  isLoading = signal<boolean>(false);

  // ═══ DUAL-MESSAGE STATE (Yamzy lore → magic morph → Scrum dev) ═══
  /** Phase de l'animation dual-message courante */
  dualPhase = signal<'yamzy' | 'morph' | 'scrum' | 'idle'>('idle');
  /** Texte Yamzy lore stocké pour la transition */
  pendingYamzyText = signal<string>('');
  /** Texte Scrum dev stocké pour la transition */
  pendingScrumText = signal<string>('');
  /** Pairs de morph (yamzy → scrum) affichées pendant la phase morph */
  morphPairs = signal<Array<{ yamzy: string; scrum: string }>>([]);
  /** UI flag : true pendant le morph (déclenche l'animation visuelle) */
  isMorphing = computed(() => this.dualPhase() === 'morph');
  /** Constante : durée Yamzy avant morph (en secondes, base) */
  private readonly T_YAMZY = 4.5;
  /** Constante : durée du morph (en secondes, base) */
  private readonly T_MORPH = 1.0;
  /** Facteur de vitesse global (1.0 = vitesse base, 1.5 = 50% plus lent).
   *  Affecte T_YAMZY, T_MORPH et le tickExample atSeconds → l'utilisateur peut suivre. */
  speedFactor = signal<number>(1.5);
  /** Timers internes pour orchestrer le dual-message */
  private dualTimerYamzy: any = null;
  private dualTimerMorph: any = null;

  /** Computed : progress % du tour */
  tourProgress = computed(() => {
    const total = this.totalSteps();
    if (total === 0) return 0;
    return (this.currentStepIndex() / total) * 100;
  });

  /** Bridge actuel vers la room */
  private bridge: NarratorRoomBridge | null = null;
  /** Tour timer en cours */
  private tourTimer: any = null;
  /** Camera animation in-progress */
  private cameraAnim: {
    fromPos: any; toPos: any;
    fromLook: any; toLook: any;
    startTime: number; duration: number;
  } | null = null;
  /** Animation frame ID pour camera interp */
  private animFrameId: number = 0;
  /** Original cam pos for reset */
  private originalCameraPos: Vec3 | null = null;
  private originalCameraLookAt: Vec3 | null = null;
  /** Cached highlighted mesh refs (pour restaurer scale) */
  private highlightedMeshes = new Map<any, { originalScale: any }>();
  /** Example timer state */
  private exampleStartTime: number = 0;
  private exampleSteps: TutorialExampleStep[] = [];
  private exampleNextStepIdx: number = 0;
  private exampleFrameId: number = 0;

  constructor(private http: HttpClient) {}

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  /** Attache le service à une room (appelé après init Three.js) */
  async attach(bridge: NarratorRoomBridge): Promise<void> {
    this.bridge = bridge;
    // Save original camera state for reset
    if (bridge.camera) {
      this.originalCameraPos = [bridge.camera.position.x, bridge.camera.position.y, bridge.camera.position.z];
      if (bridge.controls?.target) {
        this.originalCameraLookAt = [bridge.controls.target.x, bridge.controls.target.y, bridge.controls.target.z];
      }
    }
    // Load tutorial JSON
    await this.loadTutorial(bridge.roomKey);
  }

  /** Détache (cleanup au ngOnDestroy de la room) */
  detach(): void {
    this.stopTour();
    this.stopPlayExample();
    this.restoreHighlights();
    this.bridge = null;
    this.tutorial.set(null);
  }

  /** Charge le tutorial JSON pour une room */
  async loadTutorial(roomKey: string): Promise<RoomTutorial | null> {
    this.isLoading.set(true);
    try {
      const url = `/assets/tutorials/${roomKey}.tutorial.json`;
      const data = await firstValueFrom(this.http.get<RoomTutorial>(url));
      this.tutorial.set(data);
      this.totalSteps.set(data.tour?.length || 0);
      console.log(`[Narrator] 📜 Tutorial loaded: ${roomKey} (${data.tour?.length || 0} étapes, ${data.glossary?.length || 0} objets)`);
      return data;
    } catch (e) {
      console.warn(`[Narrator] ⚠ Pas de tutorial pour ${roomKey} :`, e);
      // Tutorial absent : on génère un tutorial fallback minimal
      const fallback = this.generateFallbackTutorial(roomKey);
      this.tutorial.set(fallback);
      this.totalSteps.set(fallback.tour.length);
      return fallback;
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Toggle entre mode Yamzy lore et Scrum dev */
  toggleMode(): void {
    this.narratorMode.set(this.narratorMode() === 'yamzy' ? 'scrum' : 'yamzy');
  }

  setMode(m: NarratorMode): void { this.narratorMode.set(m); }

  // ═══════════════════════════════════════════════════════════════════
  // TOUR (How it works) — pas-à-pas guidé manuel/auto
  // ═══════════════════════════════════════════════════════════════════
  startTour(): void {
    const t = this.tutorial();
    if (!t || !t.tour?.length) {
      console.warn('[Narrator] ⚠ Tutorial absent ou vide');
      return;
    }
    this.isTourActive.set(true);
    this.isExampleActive.set(false);
    this.currentStepIndex.set(0);
    // Première étape : intro lore
    this.currentText.set(t.meta.introLore || `Bienvenue dans ${t.meta.name}`);
    setTimeout(() => this.runStep(0), 200);
  }

  nextStep(): void {
    if (!this.isTourActive()) return;
    const idx = this.currentStepIndex() + 1;
    const t = this.tutorial();
    if (!t || idx >= t.tour.length) {
      this.endTour();
      return;
    }
    this.currentStepIndex.set(idx);
    this.runStep(idx);
  }

  prevStep(): void {
    if (!this.isTourActive()) return;
    const idx = Math.max(0, this.currentStepIndex() - 1);
    this.currentStepIndex.set(idx);
    this.runStep(idx);
  }

  stopTour(): void {
    if (this.tourTimer) { clearTimeout(this.tourTimer); this.tourTimer = null; }
    this.cancelDualPlayback();
    this.dualPhase.set('idle');
    this.isTourActive.set(false);
    this.restoreHighlights();
    this.resetCameraToOriginal();
  }

  private runStep(idx: number): void {
    const t = this.tutorial();
    if (!t || !t.tour[idx]) return;
    const step = t.tour[idx];
    // Mode override per step (legacy)
    if (step.narratorMode) this.narratorMode.set(step.narratorMode);
    // Texte : dual-flow si yamzyText + scrumText, sinon legacy text
    if (step.yamzyText && step.scrumText) {
      this.playDualText(step.yamzyText, step.scrumText, step.morphPairs || []);
    } else {
      this.cancelDualPlayback();
      this.dualPhase.set('idle');
      this.currentText.set(step.yamzyText || step.scrumText || step.text || '');
    }
    // Camera
    if (step.camera) {
      this.animateCamera(step.camera.position, step.camera.lookAt, step.camera.duration || 2);
    }
    // Highlight
    this.restoreHighlights();
    if (step.highlight) {
      this.highlightObject(step.highlight);
      this.highlightedEntry.set(step.highlight);
    } else {
      this.highlightedEntry.set(null);
    }
    // Cérémonie
    if (step.emitCeremony) this.invokeMethod('emitCeremony', [step.emitCeremony]);
    // Invoke method
    if (step.invokeMethod) this.invokeMethod(step.invokeMethod.name, step.invokeMethod.args || []);
    // Anim cue (style jeu : pulse, glow-ring, bounce, rotate-island, etc.)
    if (step.animCue) this.invokeMethod('onAnimCue', [step.animCue]);
    else this.invokeMethod('onAnimCue', [null]); // reset entre les steps
    // Auto-next si wait > 0
    if (this.tourTimer) clearTimeout(this.tourTimer);
    if (step.wait && step.wait > 0) {
      const k = this.speedFactor();
      this.tourTimer = setTimeout(() => this.nextStep(), step.wait * 1000 * k);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DUAL-MESSAGE PLAYBACK (yamzy lore → magic morph → scrum dev)
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Orchestre le triptyque : affiche le texte Yamzy pendant T_YAMZY secondes,
   * puis lance l'animation morph (T_MORPH s) qui transforme les mots-clés,
   * puis affiche le texte Scrum.
   */
  private playDualText(yamzyText: string, scrumText: string, morphPairs: Array<{ yamzy: string; scrum: string }>): void {
    this.cancelDualPlayback();
    // Stockage pour l'UI
    this.pendingYamzyText.set(yamzyText);
    this.pendingScrumText.set(scrumText);
    this.morphPairs.set(morphPairs);
    // PHASE 1 — yamzy
    this.narratorMode.set('yamzy');
    this.currentText.set(yamzyText);
    this.dualPhase.set('yamzy');
    const k = this.speedFactor();
    // PHASE 2 — morph (après T_YAMZY × speedFactor)
    this.dualTimerYamzy = setTimeout(() => {
      this.dualPhase.set('morph');
      // PHASE 3 — scrum (après T_MORPH × speedFactor)
      this.dualTimerMorph = setTimeout(() => {
        this.narratorMode.set('scrum');
        this.currentText.set(scrumText);
        this.dualPhase.set('scrum');
      }, this.T_MORPH * 1000 * k);
    }, this.T_YAMZY * 1000 * k);
  }

  /** Annule les timers du dual-flow en cours (sans changer le texte affiché). */
  private cancelDualPlayback(): void {
    if (this.dualTimerYamzy) { clearTimeout(this.dualTimerYamzy); this.dualTimerYamzy = null; }
    if (this.dualTimerMorph) { clearTimeout(this.dualTimerMorph); this.dualTimerMorph = null; }
  }

  private endTour(): void {
    const t = this.tutorial();
    this.currentText.set(t?.closingMessage || '🪶 Tu connais désormais tous les secrets de cette Room, jeune Mage.');
    this.tourTimer = setTimeout(() => {
      this.stopTour();
      this.currentText.set('');
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLAY TIMEBOX — countdown HUD seul (vraie cérémonie chronométrée)
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Active le mode TIMEBOX RÉEL :
   * - Le HUD countdown affiche la vraie durée Scrum (ex: 5min Lean Coffee, 15min Daily)
   * - Les animations cinématiques (caméra + scène) jouent comme dans la démo guide
   * - La narration vocale est mute (`voiceMuted`) pour ne pas distraire
   * - Quand les animations finissent (~60s), le HUD continue de countdownner
   *   jusqu'à la fin du timebox de cérémonie
   */
  startTimeboxOnly(durationS: number, ceremonyName: string): void {
    this.stopTour();
    this.stopPlayExample();
    // Active le mode timebox (le HUD réagit)
    this.isTimeboxActive.set(true);
    this.timeboxMuteVoice = true;  // mute la voix narrateur pendant les anims
    // Active aussi le cinematic playExample pour avoir les animations
    const t = this.tutorial();
    if (t?.playExample) {
      // Lance le cinematic comme le mode démo, mais après on override la duration du HUD
      this.activeDemoIndex.set(0);
      this.isExampleActive.set(true);
      this.exampleStartTime = performance.now();
      this.exampleSteps = [...(t.playExample.steps || [])].sort((a, b) => a.atSeconds - b.atSeconds);
      this.exampleNextStepIdx = 0;
      this.currentExampleStepIdx.set(0);
      this.totalExampleSteps.set(this.exampleSteps.length);
      this.currentText.set('');  // pas de texte affiché
      this.tickExample();
    }
    // OVERRIDE la duration du HUD avec la durée RÉELLE de la cérémonie
    // (les animations finissent en ~60s mais le HUD continue jusqu'au timebox complet)
    this.currentDemoDuration.set(durationS);
    this.currentDemoName.set(ceremonyName);
  }

  /** Mute pour les voix pendant le mode timebox */
  private timeboxMuteVoice = false;

  /** Arrête le timebox réel — HUD disparaît + cinematic se ferme */
  stopTimebox(): void {
    this.isTimeboxActive.set(false);
    this.timeboxMuteVoice = false;
    if (this.isExampleActive()) {
      this.isExampleActive.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLAY EXAMPLE — démo animée scénarisée
  // ═══════════════════════════════════════════════════════════════════
  /** Démarre la démo principale (idx 0) ou un scénario alternatif (idx ≥ 1 → additionalDemos[idx-1]) */
  startPlayExample(demoIndex: number = 0): void {
    const t = this.tutorial();
    if (!t) return;
    const demo = demoIndex === 0 ? t.playExample : t.additionalDemos?.[demoIndex - 1];
    if (!demo) {
      console.warn(`[Narrator] ⚠ Pas de demo à l'index ${demoIndex}`);
      return;
    }
    this.activeDemoIndex.set(demoIndex);
    this.isExampleActive.set(true);
    this.isTourActive.set(false);
    this.exampleStartTime = performance.now();
    this.exampleSteps = [...(demo.steps || [])].sort((a, b) => a.atSeconds - b.atSeconds);
    this.exampleNextStepIdx = 0;
    this.currentExampleStepIdx.set(0);
    this.totalExampleSteps.set(this.exampleSteps.length);
    // Expose timebox metadata pour le SpellTimeboxHUD
    this.currentDemoDuration.set(demo.duration || 60);
    this.currentDemoName.set(demo.name || t.meta.name || 'Démo');
    if (demo.narratorMode) this.narratorMode.set(demo.narratorMode);
    this.currentText.set(demo.description);
    // Boucle de timeline
    this.tickExample();
  }

  // ═══════════════════════════════════════════════════════════════════
  // NAVIGATION MANUELLE de la démo (carousel : prev/next/jump)
  // ═══════════════════════════════════════════════════════════════════
  nextExampleStep(): void {
    if (!this.isExampleActive() || this.exampleSteps.length === 0) return;
    const target = Math.min(this.currentExampleStepIdx() + 1, this.exampleSteps.length - 1);
    this.jumpToExampleStep(target);
  }
  prevExampleStep(): void {
    if (!this.isExampleActive() || this.exampleSteps.length === 0) return;
    const target = Math.max(0, this.currentExampleStepIdx() - 1);
    this.jumpToExampleStep(target);
  }
  jumpToExampleStep(idx: number): void {
    if (!this.isExampleActive() || idx < 0 || idx >= this.exampleSteps.length) return;
    const step = this.exampleSteps[idx];
    this.currentExampleStepIdx.set(idx);
    this.exampleNextStepIdx = idx + 1;
    // Avancer la timeline interne pour que le tick continue après ce step
    const k = this.speedFactor();
    this.exampleStartTime = performance.now() - (step.atSeconds * 1000 * k);
    // Appliquer le step immediatement
    if (step.yamzyText && step.scrumText) {
      this.playDualText(step.yamzyText, step.scrumText, step.morphPairs || []);
    } else if (step.narratorText || step.yamzyText || step.scrumText) {
      this.cancelDualPlayback();
      this.dualPhase.set('idle');
      this.currentText.set(step.narratorText || step.yamzyText || step.scrumText || '');
    }
    if (step.camera) this.animateCamera(step.camera.position, step.camera.lookAt, step.camera.duration || 1.5);
    if (step.highlight) {
      this.restoreHighlights();
      this.highlightObject(step.highlight);
      this.highlightedEntry.set(step.highlight);
    }
    if (step.invokeMethod) this.invokeMethod(step.invokeMethod.name, step.invokeMethod.args || []);
    if (step.animCue) this.invokeMethod('onAnimCue', [step.animCue]);
  }

  /** Retourne la liste de toutes les demos disponibles : index 0 = playExample, 1+ = additionalDemos */
  availableDemos = computed(() => {
    const t = this.tutorial();
    if (!t) return [];
    const list: Array<{ index: number; name: string; icon: string; description: string; duration: number }> = [
      {
        index: 0,
        name: t.playExample.name || '▶ Demo principale',
        icon: t.playExample.icon || '▶',
        description: t.playExample.description,
        duration: t.playExample.duration,
      },
    ];
    (t.additionalDemos || []).forEach((d, i) => {
      list.push({
        index: i + 1,
        name: d.name || `Demo ${i + 2}`,
        icon: d.icon || '▶',
        description: d.description,
        duration: d.duration,
      });
    });
    return list;
  });

  /** Index de la démo actuellement active (0 = principale) */
  activeDemoIndex = signal<number>(0);

  stopPlayExample(): void {
    this.isExampleActive.set(false);
    if (this.exampleFrameId) cancelAnimationFrame(this.exampleFrameId);
    this.exampleFrameId = 0;
    this.cancelDualPlayback();
    this.dualPhase.set('idle');
    this.restoreHighlights();
  }

  private tickExample(): void {
    if (!this.isExampleActive()) return;
    const t = this.tutorial();
    if (!t) return;
    // Resoudre la demo active selon activeDemoIndex
    const idx = this.activeDemoIndex();
    const demo = idx === 0 ? t.playExample : t.additionalDemos?.[idx - 1];
    if (!demo) return;
    // elapsed est divisé par speedFactor → l'utilisateur perçoit le temps qui passe plus lentement
    // (step atSeconds=6 fire à real time = 6 * speedFactor = 9s si speedFactor=1.5)
    const k = this.speedFactor();
    const elapsed = ((performance.now() - this.exampleStartTime) / 1000) / k;
    // Trigger toutes les étapes < elapsed
    while (this.exampleNextStepIdx < this.exampleSteps.length &&
           this.exampleSteps[this.exampleNextStepIdx].atSeconds <= elapsed) {
      const step = this.exampleSteps[this.exampleNextStepIdx];
      // ── Texte : MUTÉ en mode timebox réel (sinon dual-flow ou legacy)
      if (this.timeboxMuteVoice) {
        // Pas de texte, pas de voix — juste animations + caméra
        this.currentText.set('');
      } else if (step.yamzyText && step.scrumText) {
        this.playDualText(step.yamzyText, step.scrumText, step.morphPairs || []);
      } else if (step.narratorText || step.yamzyText || step.scrumText) {
        this.cancelDualPlayback();
        this.dualPhase.set('idle');
        this.currentText.set(step.narratorText || step.yamzyText || step.scrumText || '');
      }
      // ── Camera + highlights + animations cinématiques (toujours actives)
      if (step.camera) this.animateCamera(step.camera.position, step.camera.lookAt, step.camera.duration || 1.5);
      if (step.highlight) {
        this.restoreHighlights();
        this.highlightObject(step.highlight);
        this.highlightedEntry.set(step.highlight);
      }
      if (step.emitCeremony) this.invokeMethod('emitCeremony', [step.emitCeremony]);
      if (step.invokeMethod) this.invokeMethod(step.invokeMethod.name, step.invokeMethod.args || []);
      // Anim cue style jeu — jouée même en timebox pour que ça bouge !
      if (step.animCue) this.invokeMethod('onAnimCue', [step.animCue]);
      else this.invokeMethod('onAnimCue', [null]);
      // Maj index courant pour le carousel
      this.currentExampleStepIdx.set(this.exampleNextStepIdx);
      this.exampleNextStepIdx++;
    }
    if (elapsed > demo.duration) {
      this.cancelDualPlayback();
      this.dualPhase.set('idle');
      this.currentText.set('✨ Démo terminée. Tu peux relancer ou explorer librement.');
      setTimeout(() => this.stopPlayExample(), 2500);
      return;
    }
    this.exampleFrameId = requestAnimationFrame(() => this.tickExample());
  }

  // ═══════════════════════════════════════════════════════════════════
  // CAMERA ANIMATION (cubic-ease)
  // ═══════════════════════════════════════════════════════════════════
  private animateCamera(targetPos?: Vec3, targetLook?: Vec3, duration: number = 2): void {
    if (!this.bridge?.camera) return;
    const cam = this.bridge.camera;
    const fromPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    const fromLook = this.bridge.controls?.target
      ? { x: this.bridge.controls.target.x, y: this.bridge.controls.target.y, z: this.bridge.controls.target.z }
      : { x: 0, y: 0, z: 0 };
    const toPos = targetPos ? { x: targetPos[0], y: targetPos[1], z: targetPos[2] } : fromPos;
    const toLook = targetLook ? { x: targetLook[0], y: targetLook[1], z: targetLook[2] } : fromLook;
    this.cameraAnim = {
      fromPos, toPos, fromLook, toLook,
      startTime: performance.now(),
      duration: duration * 1000,
    };
    // Disable OrbitControls pendant l'anim
    if (this.bridge.controls) this.bridge.controls.enabled = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.tickCameraAnim();
  }

  private tickCameraAnim(): void {
    if (!this.cameraAnim || !this.bridge?.camera) return;
    const elapsed = performance.now() - this.cameraAnim.startTime;
    const t = Math.min(1, elapsed / this.cameraAnim.duration);
    // Cubic ease-in-out
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const cam = this.bridge.camera;
    cam.position.x = this.lerp(this.cameraAnim.fromPos.x, this.cameraAnim.toPos.x, e);
    cam.position.y = this.lerp(this.cameraAnim.fromPos.y, this.cameraAnim.toPos.y, e);
    cam.position.z = this.lerp(this.cameraAnim.fromPos.z, this.cameraAnim.toPos.z, e);
    const lookX = this.lerp(this.cameraAnim.fromLook.x, this.cameraAnim.toLook.x, e);
    const lookY = this.lerp(this.cameraAnim.fromLook.y, this.cameraAnim.toLook.y, e);
    const lookZ = this.lerp(this.cameraAnim.fromLook.z, this.cameraAnim.toLook.z, e);
    cam.lookAt(lookX, lookY, lookZ);
    if (this.bridge.controls?.target) {
      this.bridge.controls.target.set(lookX, lookY, lookZ);
    }
    if (t < 1) {
      this.animFrameId = requestAnimationFrame(() => this.tickCameraAnim());
    } else {
      this.cameraAnim = null;
      // Réactive OrbitControls après l'anim
      if (this.bridge.controls) this.bridge.controls.enabled = true;
    }
  }

  private lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

  private resetCameraToOriginal(): void {
    if (!this.originalCameraPos) return;
    this.animateCamera(this.originalCameraPos, this.originalCameraLookAt || [0, 0, 0], 1.5);
  }

  // ═══════════════════════════════════════════════════════════════════
  // HIGHLIGHT — recherche objet par userData.tutorialId, scale boost
  // ═══════════════════════════════════════════════════════════════════
  private highlightObject(tutorialId: string): void {
    if (!this.bridge?.scene) return;
    const matches: any[] = [];
    this.bridge.scene.traverse((obj: any) => {
      if (obj.userData?.tutorialId === tutorialId) matches.push(obj);
    });
    if (matches.length === 0) {
      console.warn(`[Narrator] ⚠ Aucun objet trouvé pour highlight tutorialId="${tutorialId}"`);
      return;
    }
    for (const obj of matches) {
      if (!this.highlightedMeshes.has(obj)) {
        const originalScale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
        this.highlightedMeshes.set(obj, { originalScale });
        obj.scale.set(originalScale.x * 1.3, originalScale.y * 1.3, originalScale.z * 1.3);
      }
    }
  }

  private restoreHighlights(): void {
    for (const [obj, data] of this.highlightedMeshes) {
      obj.scale.set(data.originalScale.x, data.originalScale.y, data.originalScale.z);
    }
    this.highlightedMeshes.clear();
  }

  // ═══════════════════════════════════════════════════════════════════
  // INVOKE METHOD on room
  // ═══════════════════════════════════════════════════════════════════
  /** Méthodes "soft" : pas de warn si la room ne les a pas implémentées. */
  private readonly OPTIONAL_METHODS = new Set(['onAnimCue', 'emitCeremony']);
  private invokeMethod(name: string, args: any[]): void {
    if (!this.bridge?.roomComponent) return;
    const fn = (this.bridge.roomComponent as any)[name];
    if (typeof fn === 'function') {
      try {
        fn.apply(this.bridge.roomComponent, args);
      } catch (e) {
        console.warn(`[Narrator] ⚠ Erreur invoke ${name} :`, e);
      }
    } else if (!this.OPTIONAL_METHODS.has(name)) {
      console.warn(`[Narrator] ⚠ Méthode ${name} introuvable sur la room`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FALLBACK : tutorial minimal généré si pas de JSON
  // ═══════════════════════════════════════════════════════════════════
  private generateFallbackTutorial(roomKey: string): RoomTutorial {
    return {
      roomKey,
      meta: {
        name: roomKey,
        icon: '🪶',
        color: '#fbbf24',
        summary: 'Tutorial non encore rédigé pour cette room.',
        introLore: `Cette Room (${roomKey}) n'a pas encore son tutorial.json. Crée-le dans assets/tutorials/${roomKey}.tutorial.json pour activer la visite guidée.`,
      },
      glossary: [],
      tour: [
        {
          step: 1,
          narratorMode: 'yamzy',
          text: `🪶 Bienvenue dans ${roomKey}, jeune Mage. Mais je ne connais pas encore les secrets de cette Room — son tutorial est à écrire.`,
          wait: 5,
        },
      ],
      playExample: {
        duration: 5,
        description: 'Pas de démo automatique pour cette Room',
        steps: [],
      },
      closingMessage: '🪶 Reviens quand le tutorial sera prêt.',
    };
  }
}
