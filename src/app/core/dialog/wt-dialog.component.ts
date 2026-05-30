// WAR TABLE ⚔ — Wt-Dialog : panel custom au style studio (glassmorphism + cosmic gradient).
// Style inspiré de la "Top Selection / Tips 4 Watching" du dashboard skin.

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WtDialogService } from './dialog.service';

@Component({
  selector: 'app-wt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="svc.state().open"
         class="wtd-backdrop"
         (click)="onBackdropClick()">
      <div class="wtd-panel"
           [attr.data-kind]="svc.state().kind"
           (click)="$event.stopPropagation()">

        <!-- ── Header avec rune + titre ── -->
        <div class="wtd-header">
          <div class="wtd-rune">
            <span [ngSwitch]="svc.state().kind">
              <span *ngSwitchCase="'success'">✓</span>
              <span *ngSwitchCase="'error'">✕</span>
              <span *ngSwitchCase="'warning'">⚠</span>
              <span *ngSwitchCase="'question'">⚔</span>
              <span *ngSwitchDefault>💫</span>
            </span>
          </div>
          <div class="wtd-title-wrap">
            <div class="wtd-kind-tag">
              <span [ngSwitch]="svc.state().kind">
                <span *ngSwitchCase="'success'">SUCCÈS</span>
                <span *ngSwitchCase="'error'">ERREUR</span>
                <span *ngSwitchCase="'warning'">AVERTISSEMENT</span>
                <span *ngSwitchCase="'question'">DÉCISION</span>
                <span *ngSwitchDefault>INFO</span>
              </span>
            </div>
            <div class="wtd-title">{{ svc.state().title }}</div>
          </div>
        </div>

        <!-- ── Message principal ── -->
        <div class="wtd-message" [innerHTML]="formatMessage(svc.state().message)"></div>

        <!-- ── Détails (mini-cards) ── -->
        <div *ngIf="svc.state().details?.length" class="wtd-details">
          <div *ngFor="let d of svc.state().details" class="wtd-detail-row">
            <span class="wtd-detail-label">{{ d.label }}</span>
            <span class="wtd-detail-value">{{ d.value }}</span>
          </div>
        </div>

        <!-- ── Choix (Tips-style) pour prompt ── -->
        <div *ngIf="svc.state().type === 'prompt' && svc.state().choices?.length" class="wtd-choices">
          <button *ngFor="let c of svc.state().choices"
                  class="wtd-choice"
                  [attr.data-kind]="c.kind || 'primary'"
                  (click)="svc._resolve(c.value)">
            <div class="wtd-choice-marker"></div>
            <div class="wtd-choice-body">
              <div class="wtd-choice-label">{{ c.label }}</div>
              <div *ngIf="c.hint" class="wtd-choice-hint">{{ c.hint }}</div>
            </div>
            <div class="wtd-choice-arrow">›</div>
          </button>
        </div>

        <!-- ── Boutons (alert / confirm) ── -->
        <div *ngIf="svc.state().type !== 'prompt'" class="wtd-actions">
          <button *ngIf="svc.state().type === 'confirm'"
                  class="wtd-btn wtd-btn-cancel"
                  (click)="svc._resolve(false)">
            {{ svc.state().cancelLabel }}
          </button>
          <button class="wtd-btn wtd-btn-primary"
                  [attr.data-kind]="svc.state().kind"
                  (click)="svc._resolve(svc.state().type === 'confirm' ? true : undefined)">
            {{ svc.state().confirmLabel }}
          </button>
        </div>

        <!-- ── Bouton cancel pour prompt ── -->
        <div *ngIf="svc.state().type === 'prompt'" class="wtd-actions wtd-actions-prompt">
          <button class="wtd-btn wtd-btn-cancel" (click)="svc._resolve(null)">
            {{ svc.state().cancelLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ═══ Backdrop ═══ */
    .wtd-backdrop {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 11, 32, 0.65);
      backdrop-filter: blur(8px);
      animation: wtd-fade-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      padding: 20px;
    }
    @keyframes wtd-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ═══ Panel ═══ */
    .wtd-panel {
      width: min(560px, 100%);
      max-height: 90vh;
      overflow-y: auto;
      background:
        linear-gradient(160deg, rgba(54, 44, 96, 0.95), rgba(33, 27, 58, 0.95));
      border: 1px solid rgba(217, 154, 81, 0.45);
      border-radius: 18px;
      box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset,
        0 60px 100px -40px rgba(110, 71, 191, 0.45);
      padding: 24px 24px 22px;
      animation: wtd-slide-in 0.34s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }
    @keyframes wtd-slide-in {
      from { opacity: 0; transform: translateY(20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .wtd-panel::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 22% 18%, rgba(255, 255, 255, 0.08), transparent 50%),
        radial-gradient(circle at 78% 82%, rgba(217, 154, 81, 0.10), transparent 55%);
    }
    .wtd-panel > * { position: relative; z-index: 1; }

    /* Variants par kind */
    .wtd-panel[data-kind="success"] { border-color: rgba(112, 185, 68, 0.65); }
    .wtd-panel[data-kind="error"]   { border-color: rgba(222, 79, 95, 0.65); }
    .wtd-panel[data-kind="warning"] { border-color: rgba(217, 154, 81, 0.75); }
    .wtd-panel[data-kind="question"]{ border-color: rgba(70, 150, 185, 0.65); }

    /* ═══ Header ═══ */
    .wtd-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
    }
    .wtd-rune {
      width: 52px; height: 52px;
      min-width: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(217, 154, 81, 0.30), rgba(110, 71, 191, 0.30));
      border: 1px solid rgba(217, 154, 81, 0.45);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      color: #ffe5b8;
      filter: drop-shadow(0 2px 8px rgba(217, 154, 81, 0.45));
    }
    .wtd-panel[data-kind="success"]  .wtd-rune {
      background: linear-gradient(135deg, rgba(112, 185, 68, 0.35), rgba(46, 161, 203, 0.30));
      border-color: rgba(112, 185, 68, 0.65);
      color: #b6e08a;
    }
    .wtd-panel[data-kind="error"]    .wtd-rune {
      background: linear-gradient(135deg, rgba(222, 79, 95, 0.35), rgba(110, 71, 191, 0.30));
      border-color: rgba(222, 79, 95, 0.65);
      color: #ffb1b8;
    }
    .wtd-panel[data-kind="warning"]  .wtd-rune {
      background: linear-gradient(135deg, rgba(217, 154, 81, 0.45), rgba(222, 79, 95, 0.25));
      border-color: rgba(217, 154, 81, 0.75);
      color: #ffd991;
    }
    .wtd-panel[data-kind="question"] .wtd-rune {
      background: linear-gradient(135deg, rgba(70, 150, 185, 0.35), rgba(110, 71, 191, 0.30));
      border-color: rgba(70, 150, 185, 0.65);
      color: #a9ceb2;
    }

    .wtd-title-wrap { flex: 1; min-width: 0; }
    .wtd-kind-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      color: rgba(255, 255, 255, 0.55);
      margin-bottom: 2px;
      font-family: 'Poppins', sans-serif;
    }
    .wtd-title {
      font-size: 19px;
      font-weight: 800;
      color: #fff;
      line-height: 1.25;
      letter-spacing: 0.005em;
      font-family: 'Poppins', sans-serif;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }

    /* ═══ Message ═══ */
    .wtd-message {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.88);
      line-height: 1.55;
      margin: 14px 0 16px;
      white-space: pre-line;
    }
    .wtd-message strong, .wtd-message b {
      color: #ffe5b8;
      font-family: 'Courier New', monospace;
      font-weight: 800;
      background: rgba(0, 0, 0, 0.25);
      padding: 0 6px;
      border-radius: 4px;
    }
    .wtd-message em, .wtd-message i {
      color: #c8bce6;
      font-style: italic;
    }

    /* ═══ Détails (mini cards) ═══ */
    .wtd-details {
      display: grid;
      gap: 6px;
      margin: 14px 0 18px;
      padding: 12px 14px;
      background: rgba(15, 11, 32, 0.55);
      border: 1px solid rgba(139, 127, 214, 0.22);
      border-radius: 10px;
    }
    .wtd-detail-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      font-size: 12px;
      padding: 3px 0;
      border-bottom: 1px solid rgba(139, 127, 214, 0.10);
    }
    .wtd-detail-row:last-child { border-bottom: none; }
    .wtd-detail-label {
      color: rgba(200, 188, 230, 0.7);
      font-weight: 600;
      letter-spacing: 0.03em;
      flex: 1;
      text-transform: uppercase;
      font-size: 10.5px;
    }
    .wtd-detail-value {
      color: #ffe5b8;
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 13px;
    }

    /* ═══ Choix Tips-style ═══ */
    .wtd-choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 16px 0 12px;
    }
    .wtd-choice {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: rgba(43, 37, 73, 0.65);
      border: 1px solid rgba(139, 127, 214, 0.30);
      border-radius: 12px;
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: all .18s ease;
      color: #fff;
      font-family: inherit;
    }
    .wtd-choice:hover {
      transform: translateX(3px);
      border-color: rgba(217, 154, 81, 0.65);
      background: rgba(54, 44, 96, 0.85);
      box-shadow: 0 4px 16px rgba(217, 154, 81, 0.20);
    }
    .wtd-choice:active { transform: scale(0.99); }
    .wtd-choice-marker {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      box-shadow: 0 0 12px rgba(217, 154, 81, 0.65);
      flex-shrink: 0;
    }
    .wtd-choice[data-kind="danger"] .wtd-choice-marker {
      background: linear-gradient(135deg, #de4f5f, #c25d8d);
      box-shadow: 0 0 12px rgba(222, 79, 95, 0.65);
    }
    .wtd-choice[data-kind="neutral"] .wtd-choice-marker {
      background: rgba(200, 188, 230, 0.45);
      box-shadow: none;
    }
    .wtd-choice-body { flex: 1; min-width: 0; }
    .wtd-choice-label {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.01em;
      line-height: 1.3;
    }
    .wtd-choice-hint {
      font-size: 11.5px;
      color: rgba(200, 188, 230, 0.78);
      margin-top: 3px;
      line-height: 1.4;
    }
    .wtd-choice-arrow {
      font-size: 22px;
      color: rgba(217, 154, 81, 0.65);
      font-weight: 800;
      transition: transform .14s ease;
    }
    .wtd-choice:hover .wtd-choice-arrow {
      transform: translateX(4px);
      color: #ffe5b8;
    }

    /* ═══ Actions (boutons) ═══ */
    .wtd-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }
    .wtd-actions-prompt { justify-content: flex-end; }
    .wtd-btn {
      padding: 11px 22px;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      font-family: 'Poppins', sans-serif;
      transition: transform .12s, box-shadow .18s, background .18s;
    }
    .wtd-btn:active { transform: scale(0.96); }
    .wtd-btn-cancel {
      background: rgba(43, 37, 73, 0.85);
      color: rgba(200, 188, 230, 0.85);
      border: 1px solid rgba(139, 127, 214, 0.30);
    }
    .wtd-btn-cancel:hover {
      background: rgba(54, 44, 96, 0.95);
      color: #fff;
      border-color: rgba(139, 127, 214, 0.55);
    }
    .wtd-btn-primary {
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      color: #1d172e;
      box-shadow: 0 4px 16px rgba(217, 154, 81, 0.45);
    }
    .wtd-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(217, 154, 81, 0.65);
    }
    .wtd-btn-primary[data-kind="success"] {
      background: linear-gradient(135deg, #70b944, #4696b9);
      color: #fff;
      box-shadow: 0 4px 16px rgba(112, 185, 68, 0.45);
    }
    .wtd-btn-primary[data-kind="error"] {
      background: linear-gradient(135deg, #de4f5f, #c25d8d);
      color: #fff;
      box-shadow: 0 4px 16px rgba(222, 79, 95, 0.45);
    }
    .wtd-btn-primary[data-kind="warning"] {
      background: linear-gradient(135deg, #d99a51, #de4f5f);
      color: #1d172e;
      box-shadow: 0 4px 16px rgba(217, 154, 81, 0.50);
    }

    /* Responsive */
    @media (max-width: 640px) {
      .wtd-panel { padding: 18px 18px 16px; border-radius: 14px; }
      .wtd-title { font-size: 17px; }
      .wtd-rune { width: 44px; height: 44px; font-size: 22px; }
    }
  `]
})
export class WtDialogComponent {
  svc = inject(WtDialogService);

  onBackdropClick(): void {
    const s = this.svc.state();
    if (s.type === 'alert') this.svc._resolve(undefined);
    else if (s.type === 'confirm') this.svc._resolve(false);
    else this.svc._resolve(null);
  }

  /** Convertit simples \n + **bold** + *italic* en HTML pour le message. */
  formatMessage(msg: string): string {
    if (!msg) return '';
    // Échappe HTML basique
    let safe = msg
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // **bold**, *italic*
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Newlines → <br>
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }
}
