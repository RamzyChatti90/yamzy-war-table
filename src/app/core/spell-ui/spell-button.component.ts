// ═══════════════════════════════════════════════════════════════════
// 🪄 SPELL BUTTON — Bouton réutilisable au style spell-caster
//
// Variants :
//   primary    — bouton magenta crystal avec glow (call-to-action)
//   secondary  — bouton avec bord gris hover-vers-accent
//   ghost      — bouton transparent underline (skip / link)
//   back       — flèche de retour discrete (top-left)
//
// Sizes : sm | md | lg
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export type SpellButtonVariant = 'primary' | 'secondary' | 'ghost' | 'back';
export type SpellButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'wt-spell-btn',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a *ngIf="routerLink as rl" class="sb"
       [class]="'sb-' + variant + ' sb-size-' + size"
       [style.--accent]="accent"
       [routerLink]="rl"
       [attr.title]="title"
       [attr.aria-label]="ariaLabel || title">
      <ng-container *ngTemplateOutlet="content"></ng-container>
    </a>
    <button *ngIf="!routerLink" type="button" class="sb"
            [class]="'sb-' + variant + ' sb-size-' + size"
            [class.is-disabled]="disabled"
            [style.--accent]="accent"
            [disabled]="disabled"
            (click)="emit($event)"
            [attr.title]="title"
            [attr.aria-label]="ariaLabel || title">
      <ng-container *ngTemplateOutlet="content"></ng-container>
    </button>
    <ng-template #content>
      <span *ngIf="icon" class="sb-icon">{{ icon }}</span>
      <span class="sb-label"><ng-content></ng-content></span>
      <em *ngIf="suffix" class="sb-suffix">{{ suffix }}</em>
    </ng-template>
  `,
  styles: [`
    :host { display: inline-flex; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sb {
      display: inline-flex; align-items: baseline; gap: 0.5em;
      font-family: "Tinos", serif;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.18s ease;
      box-sizing: border-box;
      line-height: 1.2;
    }
    .sb.is-disabled { opacity: 0.4; cursor: not-allowed; }

    /* SIZES */
    .sb-size-sm { font-size: clamp(13px, 1.5vmin, 16px); padding: 0.3em 0.9em; }
    .sb-size-md { font-size: clamp(15px, 2vmin, 20px); padding: 0.35em 1.1em; }
    .sb-size-lg { font-size: clamp(20px, 3vmin, 30px); padding: 0.4em 1.4em; }

    /* PRIMARY — magenta filled */
    .sb-primary {
      color: #fff;
      background-color: color-mix(in srgb, var(--accent) 18%, rgba(0,0,0,0.7));
      border: 2px solid var(--accent);
      box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 30%, transparent);
    }
    .sb-primary:hover:not(.is-disabled) {
      background-color: color-mix(in srgb, var(--accent) 32%, rgba(0,0,0,0.7));
      transform: translateY(-2px);
      box-shadow: 0 6px 32px color-mix(in srgb, var(--accent) 50%, transparent);
    }

    /* SECONDARY — outlined */
    .sb-secondary {
      color: #fff;
      background-color: rgba(0, 0, 0, 0.7);
      border: 2px solid #767474;
    }
    .sb-secondary:hover:not(.is-disabled) {
      border-color: var(--accent);
      box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 30%, transparent);
    }

    /* GHOST — link underline */
    .sb-ghost {
      color: #fff;
      background: transparent;
      border: none;
      text-decoration: underline;
      text-decoration-color: #767474;
      text-decoration-thickness: 2px;
      text-underline-offset: 5px;
      padding: 0.3em 0.6em;
    }
    .sb-ghost:hover:not(.is-disabled) {
      text-decoration-color: var(--accent);
      color: color-mix(in srgb, var(--accent) 70%, #fff);
    }

    /* BACK — discrete arrow chip */
    .sb-back {
      color: #fff;
      background-color: rgba(0, 0, 0, 0.55);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, #555);
      font-size: clamp(12px, 1.6vmin, 15px);
      padding: 0.32em 0.85em;
      border-radius: 999px;
      letter-spacing: 0.02em;
    }
    .sb-back:hover:not(.is-disabled) {
      border-color: var(--accent);
      background-color: color-mix(in srgb, var(--accent) 15%, rgba(0,0,0,0.55));
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent);
    }

    .sb-icon { font-size: 1.05em; }
    .sb-label { white-space: nowrap; }
    .sb-suffix {
      font-style: normal;
      font-size: 0.6em;
      opacity: 0.7;
      letter-spacing: 0.1em;
    }
  `],
})
export class SpellButtonComponent {
  @Input() variant: SpellButtonVariant = 'primary';
  @Input() size: SpellButtonSize = 'md';
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() icon?: string;
  @Input() suffix?: string;
  @Input() title?: string;
  @Input() ariaLabel?: string;
  @Input() disabled = false;
  @Input() routerLink?: string | any[];
  @Output() click = new EventEmitter<MouseEvent>();

  emit(e: MouseEvent): void {
    if (!this.disabled) this.click.emit(e);
  }
}
