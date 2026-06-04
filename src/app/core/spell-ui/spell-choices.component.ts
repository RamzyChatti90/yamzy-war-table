// ═══════════════════════════════════════════════════════════════════
// 🪄 SPELL CHOICES — Rangée de choix/chips au style spell-caster
//
// Usage générique : voice persona, language, role, layer toggle, etc.
// Émet selectedChange(value) à chaque sélection.
//
// <wt-spell-choices
//   [choices]="[{value:'fr',label:'Français'},{value:'en',label:'English'}]"
//   [selected]="lang()"
//   [accent]="'#67e8f9'"
//   (selectedChange)="lang.set($event)" />
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export interface SpellChoice<T = string> {
  value: T;
  label: string;
  icon?: string;
  title?: string;
}

@Component({
  selector: 'wt-spell-choices',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="sc" [style.--accent]="accent" [attr.role]="'radiogroup'">
      <li *ngFor="let c of choices; trackBy: trackByValue">
        <button class="sc-chip"
                [class.is-active]="c.value === selected"
                type="button"
                [attr.role]="'radio'"
                [attr.aria-checked]="c.value === selected"
                [attr.title]="c.title || c.label"
                (click)="pick(c.value)">
          <span *ngIf="c.icon" class="sc-icon">{{ c.icon }}</span>
          {{ c.label }}
        </button>
      </li>
    </ul>
  `,
  styles: [`
    :host { display: inline-flex; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sc {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-direction: row;
      gap: clamp(8px, 1vmin, 14px);
      flex-wrap: wrap; align-items: center;
    }
    .sc-chip {
      background: transparent;
      border: 2px solid #3e3e3e;
      color: #fff;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 17px);
      padding: 0.25em 0.8em;
      cursor: pointer;
      transition: all 0.18s ease;
      display: inline-flex; align-items: center; gap: 0.4em;
    }
    .sc-chip:hover { border-color: var(--accent); }
    .sc-chip.is-active {
      border-color: var(--accent);
      background-color: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .sc-icon { font-size: 1.1em; }
  `],
})
export class SpellChoicesComponent<T = string> {
  @Input() choices: SpellChoice<T>[] = [];
  @Input() selected?: T;
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Output() selectedChange = new EventEmitter<T>();

  pick(v: T): void { this.selectedChange.emit(v); }
  trackByValue = (_: number, c: SpellChoice<T>) => c.value as any;
}
