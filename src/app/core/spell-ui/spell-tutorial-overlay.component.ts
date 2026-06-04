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

      <!-- Bandeau bas-centré façon welcome conte -->
      <div class="sto-banner" [attr.data-step]="currentStep">
        <div class="sto-suptitle">— {{ loreName }} —</div>
        <h1 class="sto-title">{{ title }}</h1>
        <p class="sto-step-counter">Page {{ currentStep + 1 }} / {{ steps.length }}</p>

        <p class="sto-body">{{ currentStepObj?.body }}</p>
        <p *ngIf="currentStepObj?.cite" class="sto-cite">— {{ currentStepObj?.cite }}</p>

        <!-- Navigation discrète façon welcome -->
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

    /* ═══ Banner conte : CENTRÉ pleine page (façon welcome) ═══
       Le texte occupe le centre vertical+horizontal de l'écran,
       comme le conte du welcome quand on lance "Lancer le conte". */
    .sto-banner {
      pointer-events: auto;
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: min(880px, calc(100vw - 60px));
      max-width: 880px;
      padding: 0 4vmin;
      text-align: center;
      color: #f9f9f9;
      font-family: var(--font-body);
      animation: stoBannerIn 0.7s ease-out;
    }
    @keyframes stoBannerIn {
      from { opacity: 0; transform: translate(-50%, calc(-50% + 30px)); }
      to   { opacity: 1; transform: translate(-50%, -50%); }
    }
    .sto-banner > *:not(:last-child) { margin-bottom: clamp(14px, 2vmin, 22px); }

    .sto-suptitle {
      font-size: clamp(13px, 1.8vmin, 17px);
      letter-spacing: 0.4em;
      color: var(--accent);
      text-transform: uppercase;
    }
    /* Titre conte : Henny Penny XXL façon welcome (très grand, central) */
    .sto-title {
      font-family: var(--font-heading);
      font-weight: 400;
      font-size: clamp(40px, 9vmin, 90px);
      line-height: 1; margin: 0;
      color: #fff;
      text-shadow: 0 0 30px color-mix(in srgb, var(--accent) 55%, transparent),
                   0 0 80px color-mix(in srgb, var(--accent) 28%, transparent),
                   0 2px 10px rgba(0,0,0,0.85);
    }
    .sto-step-counter {
      font-size: clamp(12px, 1.5vmin, 15px);
      opacity: 0.75;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    /* Body text : Tinos serif XL, façon welcome conte */
    .sto-body {
      font-family: var(--font-body);
      font-size: clamp(17px, 2.6vmin, 24px);
      line-height: 1.55;
      max-width: 720px;
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

  private voice = inject(VoiceNarratorService);
  private sounds = inject(SpellSoundsService);

  get currentStepObj(): TutorialStep | undefined { return this.steps[this.currentStep]; }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['currentStep'] || (ch['steps'] && this.steps.length > 0)) {
      this.speakIfEnabled();
    }
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
