// ═══════════════════════════════════════════════════════════════════
// 🪄 SPELL MESSAGE — Panneau messages (présentation/démo/lore/info)
//
// Variants :
//   lore      — citation italique en bas de room (cite + author)
//   demo      — banner inline avec accent + démos hooks
//   info      — info box neutre
//   success/warn/error — colorés par token mais en lecture seulement
//
// Avatar optionnel à gauche (img URL) + actions slot pour boutons.
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export type SpellMessageVariant = 'lore' | 'demo' | 'info' | 'success' | 'warn' | 'error';

@Component({
  selector: 'wt-spell-msg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sm" [class]="'sm-' + variant" [style.--accent]="accent">
      <div *ngIf="avatar" class="sm-avatar">
        <img [src]="avatar" [alt]="speaker || ''" />
      </div>
      <div class="sm-body">
        <header *ngIf="speaker || tag" class="sm-head">
          <span *ngIf="speaker" class="sm-speaker">{{ speaker }}</span>
          <span *ngIf="tag" class="sm-tag">{{ tag }}</span>
        </header>
        <p class="sm-text"><ng-content></ng-content></p>
        <footer *ngIf="cite" class="sm-cite">— {{ cite }}</footer>
      </div>
      <div class="sm-actions">
        <ng-content select="[slot=actions]"></ng-content>
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sm {
      display: flex; gap: clamp(10px, 1.6vmin, 18px);
      padding: clamp(12px, 2vmin, 20px) clamp(16px, 2.6vmin, 28px);
      background-color: rgba(0, 0, 0, 0.72);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, #333);
      border-left: 4px solid var(--accent);
      color: #f0f0f0;
      font-family: "Tinos", serif;
      font-size: clamp(14px, 1.8vmin, 18px);
      line-height: 1.45;
      backdrop-filter: blur(6px);
      box-shadow: 0 4px 24px color-mix(in srgb, var(--accent) 18%, transparent);
      align-items: flex-start;
    }
    .sm-avatar {
      flex: 0 0 auto; width: clamp(40px, 5vmin, 56px); height: clamp(40px, 5vmin, 56px);
      border-radius: 50%; overflow: hidden;
      border: 2px solid var(--accent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 50%, transparent);
    }
    .sm-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .sm-body { flex: 1 1 auto; min-width: 0; }
    .sm-head { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
    .sm-speaker {
      font-family: "Henny Penny", cursive;
      color: var(--accent);
      font-size: 1.1em;
      letter-spacing: 0.02em;
    }
    .sm-tag {
      font-size: 0.75em;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      opacity: 0.65;
      border: 1px solid currentColor;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .sm-text { margin: 0; word-wrap: break-word; }
    .sm-cite {
      margin-top: 8px;
      font-style: italic;
      opacity: 0.7;
      font-size: 0.85em;
    }
    .sm-actions { flex: 0 0 auto; display: flex; gap: 8px; }

    /* Variants */
    .sm-lore {
      font-style: italic;
      background-color: rgba(0, 0, 0, 0.55);
    }
    .sm-demo {
      border-left-width: 6px;
    }
    .sm-success { border-color: color-mix(in srgb, #84cc16 70%, #333); border-left-color: #84cc16; }
    .sm-warn    { border-color: color-mix(in srgb, #f59e0b 70%, #333); border-left-color: #f59e0b; }
    .sm-error   { border-color: color-mix(in srgb, #ef4444 70%, #333); border-left-color: #ef4444; }
  `],
})
export class SpellMessageComponent {
  @Input() variant: SpellMessageVariant = 'info';
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() speaker?: string;
  @Input() tag?: string;
  @Input() avatar?: string;
  @Input() cite?: string;
}
