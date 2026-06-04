// ═══════════════════════════════════════════════════════════════════
// 🔔 SPELL TOAST — Notification coin-d'écran au style spell-caster
//
// Toast éphémère (auto-dismiss après duration ms) ou persistant (duration=0).
//
//   <wt-spell-toast
//     [open]="toastVisible()"
//     variant="success"
//     icon="✨"
//     title="Sort lancé !"
//     message="La cérémonie est réussie."
//     [duration]="3000"
//     (close)="toastVisible.set(false)" />
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input,
  OnChanges, Output, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export type SpellToastVariant = 'info' | 'success' | 'warn' | 'error' | 'celebration';
export type SpellToastPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';

const VARIANT_ACCENT: Record<SpellToastVariant, string> = {
  info: '#67e8f9',
  success: '#84cc16',
  warn: '#f59e0b',
  error: '#ef4444',
  celebration: '#d54adf',
};

@Component({
  selector: 'wt-spell-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="open" class="st-host" [class]="'st-pos-' + position"
         [style.--accent]="effectiveAccent"
         role="status" aria-live="polite">
      <span *ngIf="icon" class="st-icon">{{ icon }}</span>
      <div class="st-body">
        <strong *ngIf="title" class="st-title">{{ title }}</strong>
        <span *ngIf="message" class="st-msg">{{ message }}</span>
      </div>
      <button class="st-close" (click)="close.emit()" aria-label="Fermer">×</button>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .st-host {
      position: fixed; z-index: 9750;
      display: flex; align-items: center; gap: 12px;
      padding: 14px 20px;
      max-width: 480px;
      background-color: rgba(0, 0, 0, 0.88);
      border: 1px solid color-mix(in srgb, var(--accent) 60%, #333);
      border-left: 4px solid var(--accent);
      backdrop-filter: blur(8px);
      color: #f0f0f0;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 16px);
      box-shadow: 0 6px 24px color-mix(in srgb, var(--accent) 30%, transparent);
      animation: stIn 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes stIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .st-pos-top-right    { top: 24px; right: 24px; }
    .st-pos-top-center   { top: 24px; left: 50%; transform: translateX(-50%); }
    .st-pos-bottom-right { bottom: 24px; right: 24px; }
    .st-pos-bottom-center{ bottom: 24px; left: 50%; transform: translateX(-50%); }

    .st-icon { font-size: 1.4em; }
    .st-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .st-title {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      color: var(--accent);
      letter-spacing: 0.02em;
      font-size: 1.1em;
    }
    .st-msg { opacity: 0.9; line-height: 1.4; }
    .st-close {
      background: transparent; border: none; color: #aaa;
      cursor: pointer; font-size: 18px;
      transition: color 0.18s;
    }
    .st-close:hover { color: var(--accent); }
  `],
})
export class SpellToastComponent implements OnChanges {
  @Input() open = false;
  @Input() variant: SpellToastVariant = 'info';
  @Input() title?: string;
  @Input() message?: string;
  @Input() icon?: string;
  @Input() position: SpellToastPosition = 'top-right';
  @Input() duration = 3000;   // ms ; 0 = persistant
  @Input() accent?: SpellAccent;
  @Output() close = new EventEmitter<void>();

  private timer?: any;

  get effectiveAccent(): string {
    return this.accent || VARIANT_ACCENT[this.variant];
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['open'] && this.open && this.duration > 0) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.close.emit(), this.duration);
    }
    if (ch['open'] && !this.open && this.timer) {
      clearTimeout(this.timer); this.timer = undefined;
    }
  }
}
