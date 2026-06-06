// ════════════════════════════════════════════════════════════════════
// 🎚 SPELL FOOTER — Footer global unifié style spell-caster
//
// Injecté UNE SEULE FOIS dans app.component.html.
// Lit ses slots depuis SpellFooterService alimenté par chaque room.
// Caché auto si aucune action ni hint.
//
// Style identique aux boutons SpellHeader (transparent + violet crystal +
// Tinos + text-shadow), positionné fixed bottom: 0.
// ════════════════════════════════════════════════════════════════════
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpellFooterService } from './spell-footer.service';

@Component({
  selector: 'wt-spell-footer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <footer *ngIf="hasContent() && !footer.splashActive()" class="sfo-host" [style.--accent]="footer.slots().accent">
      <!-- Boutons d'action de la room -->
      <div class="sfo-controls" *ngIf="footer.slots().controls.length > 0">
        <button *ngFor="let c of footer.slots().controls"
                class="sfo-btn"
                [class.sfo-btn-primary]="c.variant === 'primary'"
                [class.sfo-btn-danger]="c.variant === 'danger'"
                [disabled]="!!c.disabled"
                [attr.title]="c.title || c.label"
                (click)="c.action()">
          <span class="sfo-btn-icon" *ngIf="c.icon">{{ c.icon }}</span>
          <span class="sfo-btn-label">{{ c.label }}</span>
        </button>
      </div>

      <!-- Hint texte à droite -->
      <span class="sfo-hint" *ngIf="footer.slots().hint">{{ footer.slots().hint }}</span>
    </footer>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&display=swap");

    wt-spell-footer {
      display: block;
      position: fixed !important;
      bottom: 0 !important; left: 0 !important; right: 0 !important;
      width: 100vw !important;
      z-index: 10400 !important;
      pointer-events: none !important;
      --accent: #d54adf;
    }
    wt-spell-footer .sfo-host {
      /* Override styles.css [class$="-host"] qui matchait .sfo-host et lui donnait height: 100dvh */
      width: auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      position: static !important;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px clamp(16px, 3vmin, 32px);
      background: transparent;
      font-family: "Tinos", serif;
      color: #fff;
      text-shadow: 0 2px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9);
    }
    wt-spell-footer .sfo-controls,
    wt-spell-footer .sfo-hint {
      pointer-events: auto;
    }
    /* ─── Controls (rangée de boutons) ─── */
    wt-spell-footer .sfo-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    wt-spell-footer .sfo-btn {
      position: relative;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px;
      background: rgba(0, 0, 0, 0.65);
      border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
      border-radius: 6px;
      color: #fff;
      font-family: "Tinos", serif;
      font-size: clamp(12px, 1.6vmin, 14px);
      cursor: pointer;
      transition: all 0.22s ease;
      overflow: hidden;
      backdrop-filter: blur(4px);
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      letter-spacing: 0.04em;
    }
    wt-spell-footer .sfo-btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: color-mix(in srgb, var(--accent) 25%, #fff);
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent);
      transform: translateY(-1px);
    }
    wt-spell-footer .sfo-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    /* Variants */
    wt-spell-footer .sfo-btn-primary {
      background: color-mix(in srgb, var(--accent) 20%, rgba(0,0,0,0.65));
      border-color: var(--accent);
      font-weight: 700;
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 35%, transparent);
    }
    wt-spell-footer .sfo-btn-primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent) 35%, rgba(0,0,0,0.65));
      box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 55%, transparent);
    }
    wt-spell-footer .sfo-btn-danger {
      border-color: color-mix(in srgb, #ec5e4e 50%, transparent);
    }
    wt-spell-footer .sfo-btn-danger:hover:not(:disabled) {
      border-color: #ec5e4e;
      color: #ec5e4e;
      box-shadow: 0 0 16px rgba(236, 94, 78, 0.45);
    }
    wt-spell-footer .sfo-btn-icon { font-size: 1.1em; }
    wt-spell-footer .sfo-btn-label { font-family: "Tinos", serif; }

    /* ─── Hint texte ─── */
    wt-spell-footer .sfo-hint {
      font-family: "Tinos", serif;
      font-size: clamp(11px, 1.4vmin, 13px);
      color: rgba(255, 255, 255, 0.72);
      letter-spacing: 0.06em;
      max-width: 50%;
      text-align: right;
    }

    /* Responsive : sur petits écrans, label des btn caché + controls scrollable */
    @media (max-width: 720px) {
      wt-spell-footer .sfo-host { flex-direction: column; gap: 8px; padding: 10px 16px; }
      wt-spell-footer .sfo-controls { width: 100%; overflow-x: auto; flex-wrap: nowrap; }
      wt-spell-footer .sfo-hint { display: none; }
    }
  `],
})
export class SpellFooterComponent {
  footer = inject(SpellFooterService);

  /** Affichage conditionnel : caché si aucune action ni hint */
  hasContent = computed(() => {
    const s = this.footer.slots();
    return s.controls.length > 0 || (s.hint && s.hint.length > 0);
  });
}
