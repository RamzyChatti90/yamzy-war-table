// WAR TABLE v1.0.14 — Tooltip narratif Yamzy Guide + Scrum Guide.
//
// Usage :
//   <button wtTooltip="dashboard">...</button>
//   <a wtTooltip="backlog" wtTooltipPos="right">...</a>
//
// Le contenu vient de TOOLTIP_GUIDE (FR/EN), structuré comme :
//   { scrum: "Backlog", yamzy: "Carnet de Quêtes", desc: "..." }
//
// La narration mixe les deux univers : "Dans Scrum on appelle ça
// Backlog ; dans Yamzy, c'est ton Carnet de Quêtes — la liste de
// toutes les missions à accomplir."

import { Directive, ElementRef, HostListener, Input, Renderer2, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { TOOLTIP_GUIDE } from './tooltip-guide';

@Directive({
  selector: '[wtTooltip]',
  standalone: true,
})
export class WtTooltipDirective {
  @Input('wtTooltip') tooltipKey = '';
  @Input('wtTooltipPos') position: 'top' | 'right' | 'bottom' | 'left' = 'top';
  private host = inject(ElementRef<HTMLElement>);
  private r = inject(Renderer2);
  private i18n = inject(I18nService);
  private el: HTMLElement | null = null;
  private timeout: any = null;

  @HostListener('mouseenter') onEnter() {
    if (!this.tooltipKey) return;
    this.timeout = setTimeout(() => this.show(), 350);
  }
  @HostListener('mouseleave') onLeave() {
    if (this.timeout) { clearTimeout(this.timeout); this.timeout = null; }
    this.hide();
  }
  @HostListener('click') onClick() { this.onLeave(); }

  private show(): void {
    const lang = this.i18n.lang();
    const entry = (TOOLTIP_GUIDE[this.tooltipKey] || {}) as any;
    const tr = entry[lang] || entry.fr || null;
    if (!tr) return;

    this.el = this.r.createElement('div');
    this.r.addClass(this.el, 'wt-tooltip');
    this.r.addClass(this.el, 'wt-tooltip-' + this.position);

    const html = `
      <div class="wt-tooltip-header">
        <span class="wt-tooltip-yamzy">⚔ ${this.escape(tr.yamzy)}</span>
        <span class="wt-tooltip-divider">·</span>
        <span class="wt-tooltip-scrum">Scrum: ${this.escape(tr.scrum)}</span>
      </div>
      <div class="wt-tooltip-body">${this.escape(tr.desc)}</div>
      ${tr.tip ? `<div class="wt-tooltip-tip">💡 ${this.escape(tr.tip)}</div>` : ''}
    `;
    this.el!.innerHTML = html;
    document.body.appendChild(this.el!);
    this.position_();
  }

  private position_(): void {
    if (!this.el) return;
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = this.el.getBoundingClientRect();
    let top = 0, left = 0;
    const margin = 10;
    switch (this.position) {
      case 'right':
        top = hostRect.top + hostRect.height / 2 - tipRect.height / 2;
        left = hostRect.right + margin;
        break;
      case 'bottom':
        top = hostRect.bottom + margin;
        left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
        break;
      case 'left':
        top = hostRect.top + hostRect.height / 2 - tipRect.height / 2;
        left = hostRect.left - tipRect.width - margin;
        break;
      default: // top
        top = hostRect.top - tipRect.height - margin;
        left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
    }
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));
    this.r.setStyle(this.el, 'top', top + 'px');
    this.r.setStyle(this.el, 'left', left + 'px');
    this.r.setStyle(this.el, 'opacity', '1');
  }

  private hide(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private escape(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
