// ═══════════════════════════════════════════════════════════════════
// 🔮 SPELL MODAL — Dialog centré au style spell-caster
//
// Modal centré pour confirmations, formulaires, alertes.
// Backdrop avec backdrop-blur. Header Henny Penny + body Tinos.
//
//   <wt-spell-modal
//     [open]="confirmDelete()"
//     title="Confirmer la suppression"
//     icon="⚠"
//     accent="#ef4444"
//     (close)="confirmDelete.set(false)">
//     <p>Cette action est irréversible.</p>
//     <div slot="actions">
//       <wt-spell-btn variant="secondary" (click)="cancel()">Annuler</wt-spell-btn>
//       <wt-spell-btn variant="primary" accent="#ef4444" (click)="confirm()">Supprimer</wt-spell-btn>
//     </div>
//   </wt-spell-modal>
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener,
  Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export type SpellModalSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'wt-spell-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="open" class="sm-host" [style.--accent]="accent" role="dialog" aria-modal="true">
      <div class="sm-backdrop" (click)="dismissOnBackdrop && emitClose()"></div>
      <div class="sm-dialog" [class]="'sm-size-' + size">
        <header class="sm-head">
          <h2 class="sm-title">
            <span *ngIf="icon" class="sm-icon">{{ icon }}</span>
            {{ title }}
          </h2>
          <button class="sm-close" (click)="emitClose()" aria-label="Fermer">×</button>
        </header>
        <div class="sm-body">
          <ng-content></ng-content>
        </div>
        <footer class="sm-actions">
          <ng-content select="[slot=actions]"></ng-content>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sm-host {
      position: fixed; inset: 0; z-index: 9700;
      display: grid; place-items: center;
      animation: smFade 0.25s ease-out;
      --accent: ${SPELL_DEFAULT_ACCENT};
    }
    @keyframes smFade { from { opacity: 0; } to { opacity: 1; } }
    .sm-backdrop {
      position: absolute; inset: 0;
      background-color: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
    }
    .sm-dialog {
      position: relative;
      background-color: rgba(15, 15, 25, 0.96);
      border: 1px solid color-mix(in srgb, var(--accent) 45%, #333);
      border-top: 4px solid var(--accent);
      color: #f0f0f0;
      font-family: "Tinos", serif;
      box-shadow: 0 16px 60px color-mix(in srgb, var(--accent) 28%, transparent);
      max-width: 92vw;
      max-height: 90vh;
      display: flex; flex-direction: column;
      animation: smDialogIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes smDialogIn {
      from { opacity: 0; transform: scale(0.94) translateY(20px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .sm-size-sm { width: 420px; }
    .sm-size-md { width: 580px; }
    .sm-size-lg { width: 780px; }

    .sm-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: clamp(16px, 2.4vmin, 22px) clamp(20px, 3vmin, 28px);
      border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, #222);
    }
    .sm-title {
      margin: 0;
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(22px, 3vmin, 32px);
      color: var(--accent);
      letter-spacing: 0.02em;
      text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 45%, transparent);
      display: inline-flex; align-items: baseline; gap: 0.4em;
    }
    .sm-icon { font-size: 0.9em; }
    .sm-close {
      background: transparent; border: 2px solid #555; color: #fff;
      width: 34px; height: 34px; border-radius: 50%;
      font-size: 22px; line-height: 1; cursor: pointer;
      transition: all 0.18s;
    }
    .sm-close:hover {
      border-color: var(--accent); color: var(--accent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .sm-body {
      flex: 1; overflow-y: auto;
      padding: clamp(18px, 2.6vmin, 26px) clamp(20px, 3vmin, 28px);
      font-size: clamp(14px, 1.9vmin, 17px);
      line-height: 1.55;
    }
    .sm-actions {
      padding: clamp(12px, 1.8vmin, 18px) clamp(20px, 3vmin, 28px);
      border-top: 1px solid color-mix(in srgb, var(--accent) 25%, #222);
      display: flex; gap: 10px; justify-content: flex-end;
    }
    .sm-actions:empty { display: none; }
  `],
})
export class SpellModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() icon?: string;
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() size: SpellModalSize = 'md';
  @Input() dismissOnBackdrop = true;
  @Output() close = new EventEmitter<void>();

  emitClose(): void { this.close.emit(); }
  @HostListener('document:keydown.escape') onEsc(): void {
    if (this.open) this.emitClose();
  }
}
