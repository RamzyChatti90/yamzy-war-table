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
  ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit,
  Output, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceNarratorService, VoicePersona } from '../voice-narrator/voice-narrator.service';
import { SpellSoundsService } from '../spell-sounds/spell-sounds.service';
import { SpellFooterService } from '../spell-ui/spell-footer.service';

@Component({
  selector: 'wt-room-splash',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- 🎬 Layout 3-zones fullscreen : HEADER pinned top / CONTENT flex:1 / FOOTER pinned bottom -->
    <div class="rs-host" [style.--accent]="color">
      <!-- ─── HEADER : lore badge + room icon (laisse 60px en haut pour le SpellHeader global) ─── -->
      <header class="rs-header" data-fade>
        <span class="rs-suptitle">— {{ loreName }} —</span>
      </header>

      <!-- ─── CONTENT : Body fullscreen avec padding lat. 5vmin (titre + subtitle + actions) ─── -->
      <div class="rs-content">
        <h1 class="rs-title" data-fade>{{ title }}</h1>
        <p class="rs-subtitle" data-fade>{{ oneLiner }}</p>
        <div class="rs-actions" data-fade>
          <!-- ▶ Play (TIMEBOX RÉEL) — exécute la cérémonie avec son vrai timeboxing -->
          <button *ngIf="timeboxDurationS > 0"
                  class="rs-btn-primary rs-btn-timebox" (click)="playTimebox()"
                  [attr.aria-label]="'Lancer le timebox réel de ' + title"
                  title="Exécute la cérémonie en temps réel avec son timebox">
            ▶ {{ timeboxLabel }}
            <em class="rs-btn-duration">⏱ {{ formatTimeboxDuration() }}</em>
          </button>
          <!-- 🌍 Entrer dans la room (exploration libre, ancien comportement) -->
          <button class="rs-btn-secondary" (click)="enter()" [attr.aria-label]="'Entrer dans ' + title">
            🌍 Entrer dans la room
          </button>
          <!-- ▶ Play demo (narrator cinematic, ancien "Lancer le play" renommé) -->
          <button class="rs-btn-secondary rs-btn-demo" (click)="play()"
                  [attr.aria-label]="'Lancer la démo cinématique de ' + title"
                  title="Démo cinématique avec narration Yamzy">
            ▶ Play demo
            <em class="rs-btn-duration">⏱ {{ duration }}s</em>
          </button>
        </div>
      </div>

      <!-- ─── FOOTER : voice selector + skip link (pinned bas) ─── -->
      <footer class="rs-footer" data-fade>
        <ul class="rs-voice-row">
          <li><button class="rs-voice" [class.is-active]="voice.persona() === 'cute-creature'" (click)="pickVoice('cute-creature')">🐭 Mignonne</button></li>
          <li><button class="rs-voice" [class.is-active]="voice.persona() === 'old-sage'" (click)="pickVoice('old-sage')">🧙 Vieux sage</button></li>
          <li><button class="rs-voice" [class.is-active]="voice.persona() === 'enthusiastic-elf'" (click)="pickVoice('enthusiastic-elf')">🧚 Lutin</button></li>
          <li><button class="rs-voice rs-voice-test" (click)="testVoice()">🔊 Test</button></li>
        </ul>
        <button class="rs-simple" (click)="enter()">Passer le play et explorer</button>
      </footer>
    </div>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;          /* mobile-safe viewport unit */
      z-index: 9500;
      overflow: hidden;        /* 🔒 jamais de scroll au niveau host */
      --accent: #d54adf;
      --font-body: "Tinos", serif;
      --font-heading: "Henny Penny", cursive;
    }

    /* ═══ Layout 3 zones fullscreen — header pinned top / content flex:1 / footer pinned bottom ═══ */
    .rs-host {
      position: absolute; inset: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(10px);
      display: flex; flex-direction: column;
      animation: rsFadeIn 0.6s ease-out;
      color: #f9f9f9;
      font-family: var(--font-body);
      overflow: hidden;        /* 🔒 le host ne scrolle JAMAIS */
    }
    @keyframes rsFadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* HEADER — au-dessus du body, laisse 64px en haut pour le SpellHeader global */
    .rs-header {
      flex: 0 0 auto;
      padding: clamp(70px, 9vmin, 100px) 5vmin clamp(8px, 1.5vmin, 16px);
      display: flex;
      align-items: center; justify-content: center;
      text-align: center;
    }

    /* CONTENT — Body fullscreen avec padding lat. 5vmin (le titre + actions s'étalent dessus)
       Seule zone scrollable : si la data dépasse, elle scrolle INTERNE — le host reste fixe. */
    .rs-content {
      flex: 1 1 auto;
      min-height: 0;              /* 🔑 important pour flex children scrollables */
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 0 5vmin;
      text-align: center;
      gap: clamp(20px, 4vmin, 36px);
      width: 100%;
      box-sizing: border-box;
      overflow-y: auto;           /* scroll interne uniquement ici */
    }

    /* FOOTER — voice + skip pinned bas */
    .rs-footer {
      flex: 0 0 auto;
      padding: clamp(10px, 1.6vmin, 18px) 5vmin clamp(20px, 3vmin, 36px);
      display: flex; flex-direction: column;
      align-items: center;
      gap: clamp(10px, 1.4vmin, 16px);
    }

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
    /* ⏱ Timebox button (PRIMARY style mais plus dramatique avec halo pulsing) */
    .rs-btn-timebox {
      animation: rsTimeboxPulse 2.2s ease-in-out infinite alternate;
    }
    @keyframes rsTimeboxPulse {
      from { box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 30%, transparent); }
      to   { box-shadow: 0 0 36px color-mix(in srgb, var(--accent) 60%, transparent),
                          0 0 80px color-mix(in srgb, var(--accent) 25%, transparent); }
    }
    /* ▶ Demo button (secondary mais avec petite touche d'accent pour distinguer) */
    .rs-btn-demo {
      --border-color: color-mix(in srgb, var(--accent) 35%, #555);
    }
    .rs-btn-demo:hover { --border-color: var(--accent); }
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
export class RoomSplashComponent implements OnInit, OnDestroy {
  /** Titre principal de la room (affiché en Henny Penny énorme) */
  @Input() title = 'Yamzy Room';
  /** Lore name affiché en supitle */
  @Input() loreName = '';
  /** Couleur d'accent (CSS color string) — par défaut crystal magenta */
  @Input() color = '#d54adf';
  /** One-liner descriptif sous le titre */
  @Input() oneLiner = '';
  /** Durée du PLAY DEMO (narrator cinematic) en secondes — affichée sur le bouton demo */
  @Input() duration = 60;
  /** Durée RÉELLE de la cérémonie pour le timebox (ex: 300 = 5 min Lean Coffee, 900 = 15 min Daily) — 0 = pas de bouton timebox */
  @Input() timeboxDurationS = 0;
  /** Label du bouton timebox (défault "Play") */
  @Input() timeboxLabel = 'Play';

  /** Émis quand l'utilisateur clique "▶ Play demo" (cinematic narrator) */
  @Output() onPlay = new EventEmitter<void>();
  /** Émis quand l'utilisateur clique "🌍 Entrer dans la room" (skip = exploration libre) */
  @Output() onEnter = new EventEmitter<void>();
  /** Émis quand l'utilisateur clique "▶ Play" timebox (vraie cérémonie chronométrée) */
  @Output() onPlayTimebox = new EventEmitter<void>();

  voice = inject(VoiceNarratorService);
  sounds = inject(SpellSoundsService);
  private spellFooter = inject(SpellFooterService);

  /** Pendant que le splash est monté → on cache le SpellFooter pour éviter le chevauchement avec les boutons du splash. */
  ngOnInit(): void { this.spellFooter.splashActive.set(true); }
  ngOnDestroy(): void { this.spellFooter.splashActive.set(false); }

  play(): void {
    this.sounds.play('ping-1', { volume: 0.4 });
    this.onPlay.emit();
  }

  enter(): void {
    this.sounds.play('ping-2', { volume: 0.35 });
    this.onEnter.emit();
  }

  /** Lance la cérémonie en mode timebox réel (countdown HUD sans narration) */
  playTimebox(): void {
    this.sounds.play('ping-2', { volume: 0.45 });
    this.onPlayTimebox.emit();
  }

  /** Formate la durée du timebox en MM:SS pour l'affichage */
  formatTimeboxDuration(): string {
    const m = Math.floor(this.timeboxDurationS / 60);
    const s = this.timeboxDurationS % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}min`;
    return `${m}min${s}s`;
  }

  pickVoice(p: VoicePersona): void {
    this.voice.setPersona(p);
  }

  testVoice(): void {
    this.voice.testVoice();
  }
}
