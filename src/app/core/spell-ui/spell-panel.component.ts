// ═══════════════════════════════════════════════════════════════════
// 🪟 SPELL PANEL — Side-drawer générique au style spell-caster
//
// Drawer flottant qui slide depuis un côté (right/left/top/bottom).
// Usage canonique pour : Glossaire, Demo notes, Scénarios, Settings,
// Pre-mortem causes, Story journeys, etc.
//
//   <wt-spell-panel
//     [open]="showGlossary()"
//     title="Glossaire"
//     icon="📖"
//     accent="#67e8f9"
//     side="right"
//     (close)="showGlossary.set(false)">
//     <!-- contenu projeté ici -->
//   </wt-spell-panel>
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener,
  Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export type SpellPanelSide = 'right' | 'left' | 'top' | 'bottom';
export type SpellPanelSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'wt-spell-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="open" class="sp-host"
         [class]="'sp-side-' + side + ' sp-size-' + size"
         [style.--accent]="accent"
         role="dialog" aria-modal="false">
      <div class="sp-backdrop" *ngIf="backdrop" (click)="emitClose()"></div>
      <aside class="sp-drawer">
        <header class="sp-head">
          <h2 class="sp-title">
            <span *ngIf="icon" class="sp-icon">{{ icon }}</span>
            {{ title }}
          </h2>
          <button class="sp-close" (click)="emitClose()" aria-label="Fermer">×</button>
        </header>
        <p *ngIf="subtitle" class="sp-subtitle">{{ subtitle }}</p>
        <div class="sp-body">
          <ng-content></ng-content>
        </div>
        <footer *ngIf="footerSlot" class="sp-foot">
          <ng-content select="[slot=footer]"></ng-content>
        </footer>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: contents; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sp-host {
      position: fixed; inset: 0; z-index: 9400;
      pointer-events: none;
      --accent: ${SPELL_DEFAULT_ACCENT};
    }
    .sp-backdrop {
      pointer-events: auto;
      position: absolute; inset: 0;
      background-color: rgba(0,0,0,0.4);
      backdrop-filter: blur(2px);
      animation: spBackdropIn 0.25s ease-out;
    }
    @keyframes spBackdropIn { from { opacity: 0; } to { opacity: 1; } }

    .sp-drawer {
      pointer-events: auto;
      position: absolute;
      background-color: rgba(0, 0, 0, 0.86);
      border: 1px solid color-mix(in srgb, var(--accent) 45%, #333);
      backdrop-filter: blur(10px);
      color: #f0f0f0;
      font-family: "Tinos", serif;
      box-shadow: 0 8px 40px color-mix(in srgb, var(--accent) 22%, transparent);
      display: flex; flex-direction: column;
      animation: spDrawerIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    /* Sides */
    .sp-side-right .sp-drawer { top: 0; right: 0; bottom: 0; border-left: 4px solid var(--accent); }
    .sp-side-left  .sp-drawer { top: 0; left: 0; bottom: 0; border-right: 4px solid var(--accent); }
    .sp-side-top    .sp-drawer { top: 0; left: 0; right: 0; border-bottom: 4px solid var(--accent); }
    .sp-side-bottom .sp-drawer { bottom: 0; left: 0; right: 0; border-top: 4px solid var(--accent); }
    /* Sizes */
    .sp-side-right.sp-size-sm .sp-drawer { width: 320px; }
    .sp-side-right.sp-size-md .sp-drawer { width: 420px; }
    .sp-side-right.sp-size-lg .sp-drawer { width: 540px; }
    .sp-side-right.sp-size-xl .sp-drawer { width: 720px; }
    .sp-side-left.sp-size-sm .sp-drawer { width: 320px; }
    .sp-side-left.sp-size-md .sp-drawer { width: 420px; }
    .sp-side-left.sp-size-lg .sp-drawer { width: 540px; }
    .sp-side-left.sp-size-xl .sp-drawer { width: 720px; }
    .sp-side-top.sp-size-sm .sp-drawer    { height: 200px; }
    .sp-side-top.sp-size-md .sp-drawer    { height: 320px; }
    .sp-side-bottom.sp-size-sm .sp-drawer { height: 200px; }
    .sp-side-bottom.sp-size-md .sp-drawer { height: 320px; }

    @keyframes spDrawerIn {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .sp-side-left   .sp-drawer { animation-name: spDrawerInLeft; }
    .sp-side-top    .sp-drawer { animation-name: spDrawerInTop; }
    .sp-side-bottom .sp-drawer { animation-name: spDrawerInBottom; }
    @keyframes spDrawerInLeft   { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes spDrawerInTop    { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spDrawerInBottom { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .sp-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: clamp(14px, 2.2vmin, 22px) clamp(18px, 2.8vmin, 26px);
      border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, #222);
    }
    .sp-title {
      margin: 0;
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(20px, 2.6vmin, 28px);
      color: var(--accent);
      letter-spacing: 0.02em;
      text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent);
      display: inline-flex; align-items: baseline; gap: 0.4em;
    }
    .sp-icon { font-size: 0.9em; }
    .sp-close {
      background: transparent; border: 2px solid #555; color: #fff;
      width: 34px; height: 34px; border-radius: 50%;
      font-size: 22px; line-height: 1; cursor: pointer;
      transition: all 0.18s;
    }
    .sp-close:hover {
      border-color: var(--accent); color: var(--accent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .sp-subtitle {
      margin: 0;
      padding: 12px clamp(18px, 2.8vmin, 26px) 0;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 15px);
      font-style: italic;
      opacity: 0.78;
    }
    .sp-body {
      flex: 1; overflow-y: auto;
      padding: clamp(14px, 2.2vmin, 22px) clamp(18px, 2.8vmin, 26px);
      font-family: "Tinos", serif;
      font-size: clamp(14px, 1.9vmin, 17px);
      line-height: 1.5;
    }
    .sp-foot {
      padding: clamp(12px, 1.8vmin, 18px) clamp(18px, 2.8vmin, 26px);
      border-top: 1px solid color-mix(in srgb, var(--accent) 25%, #222);
      display: flex; gap: 10px; justify-content: flex-end;
    }
  `],
})
export class SpellPanelComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() side: SpellPanelSide = 'right';
  @Input() size: SpellPanelSize = 'md';
  @Input() backdrop = false;     // par défaut : pas de backdrop opaque (3D reste visible)
  @Input() footerSlot = false;
  @Output() close = new EventEmitter<void>();

  emitClose(): void { this.close.emit(); }

  @HostListener('document:keydown.escape') onEsc(): void {
    if (this.open) this.emitClose();
  }
}
