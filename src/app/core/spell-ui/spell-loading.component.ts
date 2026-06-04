// ═══════════════════════════════════════════════════════════════════
// ⏳ SPELL LOADING — Spinner avec texte au style spell-caster
//
// Affiche un indicateur de chargement avec halo magique + texte
// "Invocation en cours…" ou personnalisé. Façon welcome loading phase.
//
//   <wt-spell-loading
//     [open]="isLoading()"
//     title="Invocation des éclats"
//     subtitle="Chargement du cristal…"
//     accent="#d54adf"
//     [progress]="progressPct()" />   <!-- 0–100, optionnel -->
// ═══════════════════════════════════════════════════════════════════
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

@Component({
  selector: 'wt-spell-loading',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="open" class="sl-host" [class.sl-fullscreen]="fullscreen"
         [style.--accent]="accent"
         role="status" aria-live="polite">
      <div class="sl-card">
        <div class="sl-orb" aria-hidden="true">
          <div class="sl-orb-core"></div>
          <div class="sl-orb-ring sl-ring-1"></div>
          <div class="sl-orb-ring sl-ring-2"></div>
          <div class="sl-orb-ring sl-ring-3"></div>
        </div>
        <h2 *ngIf="title" class="sl-title">{{ title }}</h2>
        <p *ngIf="subtitle" class="sl-subtitle">{{ subtitle }}</p>
        <div *ngIf="progress !== undefined && progress !== null" class="sl-bar">
          <div class="sl-bar-fill" [style.width.%]="progress"></div>
        </div>
        <p *ngIf="progress !== undefined && progress !== null" class="sl-pct">{{ progress | number:'1.0-0' }} %</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sl-host {
      position: fixed; inset: 0; z-index: 9550;
      display: grid; place-items: center;
      background-color: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(10px);
      animation: slFadeIn 0.35s ease-out;
    }
    .sl-host:not(.sl-fullscreen) { position: absolute; }
    @keyframes slFadeIn { from { opacity: 0; } to { opacity: 1; } }

    .sl-card {
      text-align: center;
      max-width: 480px;
      padding: 0 4vmin;
      color: #f0f0f0;
      font-family: "Tinos", serif;
    }
    .sl-card > *:not(:last-child) { margin-bottom: 16px; }

    /* Orb spinner — halo magique */
    .sl-orb {
      position: relative;
      width: clamp(70px, 12vmin, 110px);
      height: clamp(70px, 12vmin, 110px);
      margin: 0 auto 18px;
    }
    .sl-orb-core {
      position: absolute; inset: 30%;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, var(--accent) 0%, transparent 70%);
      box-shadow: 0 0 30px color-mix(in srgb, var(--accent) 70%, transparent);
      animation: slPulse 1.6s ease-in-out infinite;
    }
    .sl-orb-ring {
      position: absolute; inset: 0;
      border: 2px solid transparent;
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: slSpin 2.4s linear infinite;
    }
    .sl-ring-2 { inset: 12%; animation-duration: 3.2s; animation-direction: reverse; opacity: 0.7; }
    .sl-ring-3 { inset: 24%; animation-duration: 4s; opacity: 0.5; }
    @keyframes slSpin  { to { transform: rotate(360deg); } }
    @keyframes slPulse { 50% { transform: scale(1.15); opacity: 0.85; } }

    .sl-title {
      margin: 0;
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(22px, 3.4vmin, 34px);
      color: var(--accent);
      text-shadow: 0 0 24px color-mix(in srgb, var(--accent) 50%, transparent);
    }
    .sl-subtitle {
      margin: 0;
      font-size: clamp(13px, 1.8vmin, 17px);
      opacity: 0.78;
      font-style: italic;
    }

    .sl-bar {
      width: 100%; height: 5px;
      background-color: rgba(255,255,255,0.1);
      border-radius: 99px;
      overflow: hidden;
    }
    .sl-bar-fill {
      height: 100%;
      background: linear-gradient(90deg,
        color-mix(in srgb, var(--accent) 65%, #fff) 0%,
        var(--accent) 100%);
      box-shadow: 0 0 12px var(--accent);
      transition: width 0.35s ease-out;
    }
    .sl-pct {
      margin: 0;
      font-size: clamp(12px, 1.6vmin, 14px);
      letter-spacing: 0.08em;
      color: var(--accent);
    }
  `],
})
export class SpellLoadingComponent {
  @Input() open = false;
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() progress?: number | null;
  @Input() fullscreen = true;
}
