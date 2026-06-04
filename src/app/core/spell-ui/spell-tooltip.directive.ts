// ═══════════════════════════════════════════════════════════════════
// 🔮 SPELL TOOLTIP — Directive au style spell-caster
//
// Tooltip flottant au hover/focus, style welcome (Tinos + accent + glow).
// Usage :
//
//   <button [wtTooltip]="'Description du sort'"
//           [wtTooltipAccent]="'#67e8f9'"
//           [wtTooltipPlacement]="'top'">Action</button>
// ═══════════════════════════════════════════════════════════════════
import {
  Directive, ElementRef, HostListener, Input, OnDestroy, Renderer2,
} from '@angular/core';
import { SPELL_DEFAULT_ACCENT } from './spell-tokens';

export type SpellTooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

@Directive({
  selector: '[wtTooltip]',
  standalone: true,
})
export class SpellTooltipDirective implements OnDestroy {
  @Input('wtTooltip') text = '';
  @Input() wtTooltipAccent: string = SPELL_DEFAULT_ACCENT;
  @Input() wtTooltipPlacement: SpellTooltipPlacement = 'top';
  /** Délai d'affichage en ms */
  @Input() wtTooltipDelay = 250;

  private tipEl: HTMLElement | null = null;
  private showTimer: any = null;

  constructor(private host: ElementRef<HTMLElement>, private r: Renderer2) {}

  @HostListener('mouseenter') @HostListener('focus') onEnter(): void {
    if (!this.text) return;
    clearTimeout(this.showTimer);
    this.showTimer = setTimeout(() => this.show(), this.wtTooltipDelay);
  }
  @HostListener('mouseleave') @HostListener('blur') onLeave(): void {
    clearTimeout(this.showTimer);
    this.hide();
  }

  private show(): void {
    if (this.tipEl) return;
    const tip = this.r.createElement('div') as HTMLElement;
    this.r.addClass(tip, 'spell-tooltip');
    tip.textContent = this.text;
    this.r.setStyle(tip, 'position', 'fixed');
    this.r.setStyle(tip, 'z-index', '9800');
    this.r.setStyle(tip, 'background-color', 'rgba(0,0,0,0.92)');
    this.r.setStyle(tip, 'color', '#f5f5f5');
    this.r.setStyle(tip, 'font-family', '"Tinos", serif');
    this.r.setStyle(tip, 'font-size', '13px');
    this.r.setStyle(tip, 'padding', '7px 12px');
    this.r.setStyle(tip, 'border', `1px solid ${this.wtTooltipAccent}`);
    this.r.setStyle(tip, 'border-left', `3px solid ${this.wtTooltipAccent}`);
    this.r.setStyle(tip, 'box-shadow', `0 4px 18px color-mix(in srgb, ${this.wtTooltipAccent} 35%, transparent)`);
    this.r.setStyle(tip, 'pointer-events', 'none');
    this.r.setStyle(tip, 'max-width', '280px');
    this.r.setStyle(tip, 'line-height', '1.4');
    this.r.setStyle(tip, 'opacity', '0');
    this.r.setStyle(tip, 'transition', 'opacity 0.15s ease-out');
    this.r.setStyle(tip, 'white-space', 'normal');
    this.r.appendChild(document.body, tip);

    // Position
    const r = this.host.nativeElement.getBoundingClientRect();
    const tipR = tip.getBoundingClientRect();
    const gap = 8;
    let top = 0, left = 0;
    switch (this.wtTooltipPlacement) {
      case 'top':    top = r.top - tipR.height - gap; left = r.left + r.width / 2 - tipR.width / 2; break;
      case 'bottom': top = r.bottom + gap;             left = r.left + r.width / 2 - tipR.width / 2; break;
      case 'left':   top = r.top + r.height / 2 - tipR.height / 2; left = r.left - tipR.width - gap; break;
      case 'right':  top = r.top + r.height / 2 - tipR.height / 2; left = r.right + gap; break;
    }
    // Clamp dans viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tipR.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tipR.height - 8));
    this.r.setStyle(tip, 'top', `${top}px`);
    this.r.setStyle(tip, 'left', `${left}px`);
    // Fade in
    requestAnimationFrame(() => this.r.setStyle(tip, 'opacity', '1'));
    this.tipEl = tip;
  }

  private hide(): void {
    if (this.tipEl) {
      const el = this.tipEl;
      this.tipEl = null;
      this.r.setStyle(el, 'opacity', '0');
      setTimeout(() => { try { this.r.removeChild(document.body, el); } catch {} }, 200);
    }
  }

  ngOnDestroy(): void { clearTimeout(this.showTimer); this.hide(); }
}
