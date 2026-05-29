// Switcher FR / EN — petit pill compact pour le topbar.
// Click ⇒ bascule l'autre langue. Persist via I18nService.

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService, Lang } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="wt-lang-switch" role="group" aria-label="Language">
      <button *ngFor="let l of i18n.available"
              class="wt-lang-btn"
              [class.active]="i18n.lang() === l.code"
              (click)="i18n.setLang(l.code)"
              [title]="'lang.switch_to' | t:{ lang: l.label }"
              [attr.aria-pressed]="i18n.lang() === l.code">
        <span class="wt-lang-flag">{{ l.flag }}</span>
        <span class="wt-lang-code">{{ l.code.toUpperCase() }}</span>
      </button>
    </div>
  `,
  styles: [`
    .wt-lang-switch {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: rgba(43, 37, 73, 0.55);
      border: 1px solid rgba(217, 154, 81, 0.25);
      border-radius: 999px;
      padding: 3px;
      backdrop-filter: blur(6px);
    }
    .wt-lang-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      color: #c8bce6;
      border: none;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: background .18s ease, color .18s ease, transform .12s ease;
    }
    .wt-lang-btn:hover {
      color: #fff;
      background: rgba(217, 154, 81, 0.18);
    }
    .wt-lang-btn.active {
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      color: #1d172e;
      box-shadow: 0 2px 8px rgba(217, 154, 81, 0.35);
    }
    .wt-lang-btn:active { transform: scale(0.96); }
    .wt-lang-flag { font-size: 13px; line-height: 1; }
    .wt-lang-code { font-size: 10.5px; }
  `]
})
export class LangSwitcherComponent {
  i18n = inject(I18nService);
}
