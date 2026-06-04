// ═══════════════════════════════════════════════════════════════════
// 🎬 ROOM SPLASH — Overlay welcoming réutilisable pour TOUTES les rooms
//
// Reprend l'ADN exact du Yamzy World Entry (welcome) :
//   - Fonts : Henny Penny cursive (titre) + Tinos serif (body)
//   - Palette : noir + magenta crystal (#d54adf)
//   - 2 boutons : ▶ Lancer le play / 🌍 Entrer
//   - Voice persona selector (créature/sage/lutin) + 🔊 Test
//   - data-fade staggered animations
//   - Fade in/out smooth quand splashVisible toggle
//
// Usage dans une room :
//   <wt-room-splash *ngIf="splashVisible()"
//                   [title]="'Retrospective Sailboat'"
//                   [loreName]="'Le Cercle du Rétroviseur'"
//                   [color]="'#67e8f9'"
//                   [oneLiner]="'Sprint retro Sailboat — vent, ancres, récifs, île.'"
//                   [duration]="75"
//                   (onPlay)="onSplashPlay()"
//                   (onEnter)="onSplashEnter()" />
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
  inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceNarratorService, VoicePersona } from '../voice-narrator/voice-narrator.service';
import { SpellSoundsService } from '../spell-sounds/spell-sounds.service';

@Component({
  selector: 'wt-room-splash',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-host" [style.--accent]="color">
      <div class="rs-content">
        <!-- Lore name comme supitle -->
        <div class="rs-suptitle" data-fade>— {{ loreName }} —</div>

        <!-- Title in Henny Penny -->
        <h1 class="rs-title" data-fade>{{ title }}</h1>

        <!-- One-liner subtitle -->
        <p class="rs-subtitle" data-fade>{{ oneLiner }}</p>

        <!-- Action buttons (style spell-caster) -->
        <div class="rs-actions" data-fade>
          <button class="rs-btn-primary" (click)="play()" [attr.aria-label]="'Lancer le play de ' + title">
            ▶ Lancer le play
            <em class="rs-btn-duration">~ {{ duration }}s</em>
          </button>
          <button class="rs-btn-secondary" (click)="enter()" [attr.aria-label]="'Entrer dans ' + title">
            🌍 Entrer dans la room
          </button>
        </div>

        <!-- Voice persona selector + test -->
        <ul class="rs-voice-row" data-fade>
          <li><button class="rs-voice" [class.is-active]="voice.persona() === 'cute-creature'" (click)="pickVoice('cute-creature')">🐭 Mignonne</button></li>
          <li><button class="rs-voice" [class.is-active]="voice.persona() === 'old-sage'" (click)="pickVoice('old-sage')">🧙 Vieux sage</button></li>
          <li><button class="rs-voice" [class.is-active]="voice.persona() === 'enthusiastic-elf'" (click)="pickVoice('enthusiastic-elf')">🧚 Lutin</button></li>
          <li><button class="rs-voice rs-voice-test" (click)="testVoice()">🔊 Test</button></li>
        </ul>

        <!-- Secondary mini buttons -->
        <ul class="rs-button-row" data-fade>
          <li><button class="rs-simple" (click)="enter()">Passer le play et explorer</button></li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      position: fixed; inset: 0; z-index: 9500;
      --accent: #d54adf;
      --font-body: "Tinos", serif;
      --font-heading: "Henny Penny", cursive;
    }

    .rs-host {
      position: absolute; inset: 0;
      background-color: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(10px);
      display: grid;
      grid-template-areas: "content";
      animation: rsFadeIn 0.6s ease-out;
    }
    @keyframes rsFadeIn { from { opacity: 0; } to { opacity: 1; } }

    .rs-content {
      grid-area: content;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 0 5vmin;
      max-width: 900px;
      margin: 0 auto;
      text-align: center;
      color: #f9f9f9;
      font-family: var(--font-body);
    }
    .rs-content > *:not(:last-child) { margin-bottom: clamp(20px, 4vmin, 36px); }

    .rs-suptitle {
      font-size: clamp(13px, 1.8vmin, 17px);
      letter-spacing: 0.4em;
      color: var(--accent);
      opacity: 0.9;
      text-transform: uppercase;
    }

    .rs-title {
      font-family: var(--font-heading);
      font-weight: 400;
      font-size: clamp(48px, 12vmin, 110px);
      line-height: 1;
      letter-spacing: 0.02em;
      color: #fff;
      text-shadow: 0 0 30px color-mix(in srgb, var(--accent) 50%, transparent),
                   0 0 80px color-mix(in srgb, var(--accent) 25%, transparent);
      margin: 0;
    }

    .rs-subtitle {
      font-size: clamp(17px, 2.4vmin, 24px);
      line-height: 1.45;
      max-width: 640px;
      opacity: 0.92;
      margin: 0 auto;
    }

    .rs-actions {
      display: flex; gap: clamp(12px, 1.6vmin, 22px);
      flex-wrap: wrap; justify-content: center;
    }

    .rs-btn-primary, .rs-btn-secondary {
      --border-color: var(--accent);
      background-color: rgba(0, 0, 0, 0.7);
      border: 2px solid var(--border-color);
      color: #fff;
      font-family: var(--font-body);
      font-size: clamp(20px, 3vmin, 30px);
      padding: 0.4em 1.4em;
      cursor: pointer;
      transition: all 0.18s ease;
      display: inline-flex; align-items: baseline; gap: 0.5em;
    }
    .rs-btn-primary {
      background-color: color-mix(in srgb, var(--accent) 18%, rgba(0,0,0,0.7));
      box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 30%, transparent);
    }
    .rs-btn-primary:hover {
      background-color: color-mix(in srgb, var(--accent) 32%, rgba(0,0,0,0.7));
      transform: translateY(-2px);
      box-shadow: 0 6px 32px color-mix(in srgb, var(--accent) 50%, transparent);
    }
    .rs-btn-secondary { --border-color: #767474; }
    .rs-btn-secondary:hover { --border-color: var(--accent); }
    .rs-btn-duration {
      font-style: normal;
      font-size: 0.6em;
      opacity: 0.7;
      letter-spacing: 0.1em;
    }

    .rs-voice-row, .rs-button-row {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-direction: row;
      gap: clamp(8px, 1vmin, 14px);
      justify-content: center; flex-wrap: wrap;
    }

    .rs-voice {
      background: transparent;
      border: 2px solid #3e3e3e;
      color: #fff;
      font-family: var(--font-body);
      font-size: clamp(13px, 1.7vmin, 17px);
      padding: 0.25em 0.8em;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .rs-voice:hover { border-color: var(--accent); }
    .rs-voice.is-active {
      border-color: var(--accent);
      background-color: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .rs-voice-test {
      border-color: color-mix(in srgb, var(--accent) 60%, #fff);
      color: color-mix(in srgb, var(--accent) 60%, #fff);
    }

    .rs-simple {
      background: transparent;
      border: none;
      color: #fff;
      font-family: var(--font-body);
      font-size: clamp(14px, 1.7vmin, 18px);
      text-decoration: underline;
      text-decoration-color: #767474;
      text-decoration-thickness: 2px;
      text-underline-offset: 5px;
      cursor: pointer;
      padding: 4px 8px;
      transition: all 0.18s;
    }
    .rs-simple:hover {
      text-decoration-color: var(--accent);
      color: color-mix(in srgb, var(--accent) 70%, #fff);
    }

    /* Stagger fade-in via data-fade */
    [data-fade] {
      opacity: 0;
      transform: translateY(20px);
      animation: rsFade 0.8s ease-out forwards;
    }
    [data-fade]:nth-child(1) { animation-delay: 0.0s; }
    [data-fade]:nth-child(2) { animation-delay: 0.15s; }
    [data-fade]:nth-child(3) { animation-delay: 0.30s; }
    [data-fade]:nth-child(4) { animation-delay: 0.45s; }
    [data-fade]:nth-child(5) { animation-delay: 0.60s; }
    [data-fade]:nth-child(6) { animation-delay: 0.75s; }
    @keyframes rsFade {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class RoomSplashComponent {
  /** Titre principal de la room (affiché en Henny Penny énorme) */
  @Input() title = 'Yamzy Room';
  /** Lore name affiché en supitle */
  @Input() loreName = '';
  /** Couleur d'accent (CSS color string) — par défaut crystal magenta */
  @Input() color = '#d54adf';
  /** One-liner descriptif sous le titre */
  @Input() oneLiner = '';
  /** Durée estimée du play en secondes (affichée sur le bouton) */
  @Input() duration = 60;

  /** Émis quand l'utilisateur clique "Lancer le play" */
  @Output() onPlay = new EventEmitter<void>();
  /** Émis quand l'utilisateur clique "Entrer dans la room" (skip play) */
  @Output() onEnter = new EventEmitter<void>();

  voice = inject(VoiceNarratorService);
  sounds = inject(SpellSoundsService);

  play(): void {
    // Premier interaction = autorisation Web Speech + Web Audio API
    this.sounds.play('ping-1', { volume: 0.4 });
    this.onPlay.emit();
  }

  enter(): void {
    this.sounds.play('ping-2', { volume: 0.35 });
    this.onEnter.emit();
  }

  pickVoice(p: VoicePersona): void {
    this.voice.setPersona(p);
  }

  testVoice(): void {
    this.voice.testVoice();
  }
}
