// ═══════════════════════════════════════════════════════════════════
// 💧 MAGIC WATER METER — Jauge globale (top-right partout)
//
// Affiche en permanence :
//   ─ 🔮 tokens consommés
//   ─ 💧 mL eau équivalente
//   ─ 🪙 $ coût cumulé
//   ─ Petite anim "goutte qui tombe" quand consumption (last action)
//
// Click → ouvre /mana-fountain (la source qui contextualise)
// ═══════════════════════════════════════════════════════════════════
import { ChangeDetectionStrategy, Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MagicWaterService } from './magic-water.service';

@Component({
  selector: 'wt-magic-water-meter',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mwm" [class.is-warning]="water.budgetWarning()" (click)="openFountain()" title="Cliquer pour voir la Mana Fountain">
      <div class="mwm-drop" [class.is-falling]="dropFalling()">💧</div>
      <div class="mwm-stats">
        <div class="mwm-row"><span class="mwm-icon">🔮</span><span class="mwm-val">{{ formatTokens(water.totalTokens()) }}</span></div>
        <div class="mwm-row"><span class="mwm-icon">💧</span><span class="mwm-val">{{ formatMl(water.totalWaterMl()) }}</span></div>
        <div class="mwm-row"><span class="mwm-icon">🪙</span><span class="mwm-val">${{ water.totalCostUsd().toFixed(3) }}</span></div>
      </div>
      <div class="mwm-budget">
        <div class="mwm-budget-bar"><div class="mwm-budget-fill" [style.width.%]="water.budgetRatio() * 100"></div></div>
        <div class="mwm-budget-label">{{ (water.budgetRatio() * 100).toFixed(0) }}% / \${{ water.monthlyBudgetUsd() }}/mo</div>
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; top: 14px; right: 14px; z-index: 9000; pointer-events: none; font-family: system-ui, sans-serif; }
    .mwm { display: flex; align-items: center; gap: 12px; padding: 8px 14px; background: rgba(8, 6, 24, 0.85); border: 1px solid rgba(213, 74, 223, 0.4); border-radius: 12px; backdrop-filter: blur(10px); pointer-events: auto; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4); }
    .mwm:hover { border-color: #d54adf; box-shadow: 0 4px 24px rgba(213, 74, 223, 0.4); transform: translateY(-1px); }
    .mwm.is-warning { border-color: #fbbf24; box-shadow: 0 0 16px rgba(251, 191, 36, 0.4); animation: pulseWarn 2s ease-in-out infinite; }
    @keyframes pulseWarn { 0%, 100% { box-shadow: 0 0 16px rgba(251, 191, 36, 0.3); } 50% { box-shadow: 0 0 24px rgba(251, 191, 36, 0.6); } }

    .mwm-drop { font-size: 22px; transition: transform 0.4s ease; }
    .mwm-drop.is-falling { animation: dropFall 0.8s ease-in; }
    @keyframes dropFall { 0% { transform: translateY(-8px) scale(1.3); opacity: 1; } 60% { transform: translateY(6px) scale(0.85); opacity: 0.7; } 100% { transform: translateY(0) scale(1); opacity: 1; } }

    .mwm-stats { display: flex; flex-direction: column; gap: 2px; min-width: 95px; }
    .mwm-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #e8eaf6; }
    .mwm-row .mwm-icon { font-size: 13px; opacity: 0.85; }
    .mwm-row .mwm-val { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: 0.3px; }

    .mwm-budget { display: flex; flex-direction: column; align-items: stretch; gap: 3px; min-width: 90px; }
    .mwm-budget-bar { width: 100%; height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; overflow: hidden; }
    .mwm-budget-fill { height: 100%; background: linear-gradient(90deg, #d54adf, #fbbf24); transition: width 0.4s ease; }
    .mwm-budget-label { font-size: 9px; opacity: 0.65; text-align: right; letter-spacing: 0.5px; font-variant-numeric: tabular-nums; }

    @media (max-width: 720px) {
      :host { top: 8px; right: 8px; }
      .mwm { padding: 6px 10px; gap: 8px; }
      .mwm-budget { min-width: 60px; }
      .mwm-row { font-size: 11px; }
    }
  `]
})
export class MagicWaterMeterComponent {
  water = inject(MagicWaterService);
  private router = inject(Router);
  dropFalling = signal<boolean>(false);
  private fallTimer: any;

  constructor() {
    // Anim "goutte tombe" à chaque nouvelle action
    effect(() => {
      const last = this.water.lastAction();
      if (last) {
        this.dropFalling.set(true);
        clearTimeout(this.fallTimer);
        this.fallTimer = setTimeout(() => this.dropFalling.set(false), 800);
      }
    });
  }

  formatTokens(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }
  formatMl(ml: number): string {
    if (ml >= 1000) return (ml / 1000).toFixed(2) + 'L';
    return ml.toFixed(1) + 'mL';
  }

  openFountain(): void {
    this.router.navigate(['/mana-fountain']);
  }
}
