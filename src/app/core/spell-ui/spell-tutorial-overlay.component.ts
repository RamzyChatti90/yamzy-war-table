// ═══════════════════════════════════════════════════════════════════
// 🎓 SPELL TUTORIAL OVERLAY — "How it works" en style welcome
//
// Reprend l'ADN du Yamzy Welcome (Henny Penny + magenta crystal +
// stagger fade) pour expliquer le fonctionnement d'une room.
//
// Inputs :
//   title       — Titre de la room
//   loreName    — Sous-titre lore
//   accent      — Couleur d'accent
//   steps       — Array d'étapes {icon, title, body, cite?}
//   currentStep — index courant (controlled)
//   voiceLines  — optionnel : tableau de strings synchronisés avec
//                 steps, joués via VoiceNarratorService
//
// Outputs :
//   stepChange  — émis au prev/next
//   close       — émis au bouton X / Escape
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener,
  Input, OnChanges, OnDestroy, Output, SimpleChanges, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceNarratorService } from '../voice-narrator/voice-narrator.service';
import { SpellSoundsService } from '../spell-sounds/spell-sounds.service';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';
import { SpellButtonComponent } from './spell-button.component';

export interface TutorialStep {
  icon?: string;
  title: string;
  body: string;
  cite?: string;
  /** Optional camera pose for this step - host listens to (cameraViewChange) */
  cameraView?: {
    position: [number, number, number];
    target:   [number, number, number];
    /** Optional zoom (FOV) override */
    fov?: number;
    /** Transition duration in ms (default 1500) */
    durationMs?: number;
  };
  /** Optional animation cue for this step - host listens to (animCueChange).
   *  Ex : 'highlight-conclave', 'spin-crystal', 'raise-islands', 'glow-east-row' */
  animCue?: string;
}

@Component({
  selector: 'wt-spell-tutorial-overlay',
  standalone: true,
  imports: [CommonModule, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ═══ TUTORIAL CONTE — façon welcome : texte qui flotte sur le 3D,
         caméra/scène visibles derrière, pas de cards-sections. ═══ -->
    <div class="sto-host" [style.--accent]="accent" role="dialog" aria-modal="false">
      <!-- Vignette discrète bas+haut pour lisibilité texte sans cacher la scène -->
      <div class="sto-vignette"></div>

      <button class="sto-close" (click)="emitClose()" aria-label="Fermer">×</button>

      <!-- Bandeau FULLSCREEN 3 zones : header / body / footer -->
      <div class="sto-banner" [attr.data-step]="currentStep">

        <!-- ═══ HEADER : suptitle + title + page counter ═══ -->
        <header class="sto-header">
          <div class="sto-suptitle">— {{ loreName }} —</div>
          <h1 class="sto-title">{{ title }}</h1>
          <p class="sto-step-counter">Page {{ currentStep + 1 }} / {{ steps.length }}</p>
        </header>

        <!-- ═══ BODY : texte central + citation ═══ -->
        <section class="sto-content">
          <p class="sto-body">{{ currentStepObj?.body }}</p>
          <p *ngIf="currentStepObj?.cite" class="sto-cite">— {{ currentStepObj?.cite }}</p>
        </section>

        <!-- ═══ FOOTER : carousel nav + actions ═══ -->
        <footer class="sto-footer">
          <nav class="sto-nav">
            <button class="sto-arrow" [disabled]="currentStep === 0" (click)="prev()" aria-label="Précédent">←</button>
            <div class="sto-dots">
              <span *ngFor="let s of steps; let i = index"
                    class="sto-dot"
                    [class.is-active]="i === currentStep"
                    (click)="jump(i)"></span>
            </div>
            <button class="sto-arrow" [disabled]="currentStep === steps.length - 1" (click)="next()" aria-label="Suivant">→</button>
          </nav>

          <ul class="sto-actions">
            <li><button class="sto-link" (click)="replayVoice()">🔊 Re-jouer</button></li>
            <li><button class="sto-link" (click)="emitClose()">Fermer</button></li>
          </ul>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");
    :host {
      position: fixed; inset: 0; z-index: 9600;
      pointer-events: none; /* on rend les events au banner uniquement */
      --accent: ${SPELL_DEFAULT_ACCENT};
      --font-body: "Tinos", serif;
      --font-heading: "Henny Penny", cursive;
    }
    .sto-host {
      position: absolute; inset: 0;
      animation: stoFadeIn 0.6s ease-out;
    }
    @keyframes stoFadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ═══ Vignette : assombrissement façon welcome conte —
       fond global semi-opaque pour focus sur le texte centré,
       3D scene reste visible mais en sourdine. */
    .sto-vignette {
      position: absolute; inset: 0;
      background-color: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(4px);
      pointer-events: none;
    }

    .sto-close {
      pointer-events: auto;
      position: absolute; top: 18px; right: 22px;
      background: rgba(0,0,0,0.5); border: 2px solid #555; color: #fff;
      font-size: 28px; line-height: 1; width: 42px; height: 42px;
      border-radius: 50%; cursor: pointer; transition: all 0.18s;
      z-index: 2;
    }
    .sto-close:hover { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent); }

    /* ═══ Banner FULLSCREEN — vraiment responsive ═══
       3 zones distribuees : header pinned top, footer pinned bottom,
       contenu central qui prend tout l'espace restant. Adapte a
       toute taille d'ecran (mobile, desktop, large). */
    .sto-banner {
      pointer-events: auto;
      position: fixed;                  /* viewport-relative, pas parent */
      inset: 0;                         /* fullscreen */
      width: 100vw;
      height: 100vh;
      height: 100dvh;                   /* dynamic viewport - mobile-safe */
      padding: clamp(16px, 3.5vmin, 48px) clamp(20px, 5vmin, 70px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;   /* header top / body center / footer bottom */
      align-items: stretch;
      text-align: center;
      color: #f9f9f9;
      font-family: var(--font-body);
      animation: stoBannerIn 0.7s ease-out;
      box-sizing: border-box;
      overflow: hidden;                 /* pas de scroll global */
    }
    @keyframes stoBannerIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ─── Zone HEADER (pinned top) ─── */
    .sto-header {
      display: flex;
      flex-direction: column;
      gap: clamp(6px, 1.2vmin, 14px);
      align-items: center;
      flex-shrink: 0;                   /* ne se compresse jamais */
    }

    /* ─── Zone CONTENT (flex grow, centre) ─── */
    .sto-content {
      flex: 1 1 auto;
      min-height: 0;                    /* permet flex-shrink + overflow */
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: clamp(8px, 1.6vmin, 18px);
      padding: clamp(8px, 2vmin, 24px) 0;
      overflow-y: auto;                 /* scroll interne si texte trop long */
      overflow-x: hidden;
    }
    /* Scrollbar discrete */
    .sto-content::-webkit-scrollbar { width: 4px; }
    .sto-content::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--accent) 40%, transparent);
      border-radius: 4px;
    }

    /* ─── Zone FOOTER (pinned bottom) ─── */
    .sto-footer {
      display: flex;
      flex-direction: column;
      gap: clamp(6px, 1.2vmin, 14px);
      align-items: center;
      flex-shrink: 0;                   /* ne se compresse jamais */
    }

    .sto-suptitle {
      font-size: clamp(13px, 1.8vmin, 17px);
      letter-spacing: 0.4em;
      color: var(--accent);
      text-transform: uppercase;
    }
    /* Titre conte : Henny Penny - clamp serre pour pas deborder petits ecrans */
    .sto-title {
      font-family: var(--font-heading);
      font-weight: 400;
      font-size: clamp(36px, 8vmin, 110px);
      line-height: 1;
      margin: 0;
      color: #fff;
      text-shadow: 0 0 40px color-mix(in srgb, var(--accent) 60%, transparent),
                   0 0 100px color-mix(in srgb, var(--accent) 32%, transparent),
                   0 2px 14px rgba(0,0,0,0.9);
      max-width: 100%;
      word-break: break-word;
    }
    .sto-step-counter {
      font-size: clamp(12px, 1.5vmin, 15px);
      opacity: 0.75;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    /* Body text : Tinos serif - clamp serre pour fit petits ecrans */
    .sto-body {
      font-family: var(--font-body);
      font-size: clamp(15px, 2.4vmin, 26px);
      line-height: 1.5;
      max-width: min(900px, 90vw);
      margin: 0 auto;
      color: #f5f5f5;
      text-shadow: 0 2px 8px rgba(0,0,0,0.9);
      animation: stoBodyChange 0.5s ease-out;
    }
    @keyframes stoBodyChange { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .sto-cite {
      font-family: var(--font-body);
      font-style: italic;
      opacity: 0.78;
      margin-top: 8px;
      font-size: 0.92em;
      text-shadow: 0 2px 6px rgba(0,0,0,0.8);
    }

    /* Navigation discrète : flèches + dots, pas de gros boutons */
    .sto-nav {
      display: flex; align-items: center; justify-content: center;
      gap: 14px;
      margin-top: 14px;
    }
    .sto-arrow {
      background-color: rgba(0,0,0,0.55);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, #444);
      color: #fff;
      width: 36px; height: 36px;
      border-radius: 50%;
      font-size: 18px; line-height: 1;
      cursor: pointer;
      transition: all 0.18s;
    }
    .sto-arrow:hover:not(:disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 50%, transparent);
      color: var(--accent);
    }
    .sto-arrow:disabled { opacity: 0.3; cursor: not-allowed; }

    .sto-dots {
      display: flex; gap: 7px; align-items: center;
    }
    .sto-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background-color: rgba(255,255,255,0.35); cursor: pointer;
      transition: all 0.18s;
    }
    .sto-dot:hover { background-color: color-mix(in srgb, var(--accent) 70%, #fff); }
    .sto-dot.is-active {
      background-color: var(--accent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 70%, transparent);
      transform: scale(1.35);
    }

    /* Liens ghost discrets */
    .sto-actions {
      list-style: none; margin: 12px 0 0; padding: 0;
      display: flex; gap: 18px; justify-content: center;
    }
    .sto-link {
      background: transparent; border: none;
      color: rgba(255,255,255,0.7);
      font-family: var(--font-body);
      font-size: clamp(12px, 1.5vmin, 14px);
      text-decoration: underline;
      text-decoration-color: rgba(255,255,255,0.3);
      text-underline-offset: 4px;
      cursor: pointer;
      padding: 4px 6px;
      transition: all 0.18s;
    }
    .sto-link:hover {
      color: var(--accent);
      text-decoration-color: var(--accent);
    }
  `],
})
export class SpellTutorialOverlayComponent implements OnChanges, OnDestroy {
  @Input() title = 'Tutoriel';
  @Input() loreName = 'Comment ça marche';
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() steps: TutorialStep[] = [];
  @Input() currentStep = 0;
  @Input() voiceLines?: string[];
  @Input() autoSpeak = true;
  @Output() stepChange = new EventEmitter<number>();
  @Output() close = new EventEmitter<void>();
  /** Émis quand le step change ET qu'une cameraView est définie sur ce step. */
  @Output() cameraViewChange = new EventEmitter<NonNullable<TutorialStep['cameraView']>>();
  /** Émis quand le step change ET qu'un animCue est défini sur ce step. */
  @Output() animCueChange = new EventEmitter<string>();

  private voice = inject(VoiceNarratorService);
  private sounds = inject(SpellSoundsService);

  get currentStepObj(): TutorialStep | undefined { return this.steps[this.currentStep]; }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['currentStep'] || (ch['steps'] && this.steps.length > 0)) {
      this.speakIfEnabled();
      this.emitCameraView();
      this.emitAnimCue();
    }
  }

  private emitCameraView(): void {
    const cv = this.currentStepObj?.cameraView;
    if (cv) this.cameraViewChange.emit(cv);
  }
  private emitAnimCue(): void {
    const cue = this.currentStepObj?.animCue;
    if (cue) this.animCueChange.emit(cue);
  }

  ngOnDestroy(): void {
    this.voice.cancel();
  }

  prev(): void {
    if (this.currentStep > 0) {
      this.sounds.play('ping-1', { volume: 0.3 });
      this.stepChange.emit(this.currentStep - 1);
    }
  }
  next(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.sounds.play('ping-2', { volume: 0.3 });
      this.stepChange.emit(this.currentStep + 1);
    }
  }
  jump(i: number): void {
    if (i !== this.currentStep && i >= 0 && i < this.steps.length) {
      this.stepChange.emit(i);
    }
  }
  emitClose(): void {
    this.voice.cancel();
    this.close.emit();
  }
  replayVoice(): void { this.speakIfEnabled(true); }

  private speakIfEnabled(force = false): void {
    if (!force && !this.autoSpeak) return;
    const line = this.voiceLines?.[this.currentStep];
    if (line) {
      this.voice.cancel();
      this.voice.speak(line).catch(() => {});
    }
  }

  @HostListener('document:keydown.escape') onEsc() { this.emitClose(); }
  @HostListener('document:keydown.arrowleft') onLeft() { this.prev(); }
  @HostListener('document:keydown.arrowright') onRight() { this.next(); }
}
