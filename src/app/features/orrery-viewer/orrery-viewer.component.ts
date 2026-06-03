// ═══════════════════════════════════════════════════════════════════
// Orrery Viewer — page indépendante fullscreen.
//
// Réutilise <cosmos-orrery> en mode standalone : un fond noir étoilé,
// le GLB mécanique du système solaire animé, le cristal flottant +
// particules à la place du soleil, et le click → panel d'info.
// Aucune dépendance au projet ni au backend — accessible publiquement
// via /orrery-viewer pour usage en démo / capture / partage.
// ═══════════════════════════════════════════════════════════════════

import {
  ChangeDetectionStrategy, Component, signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CosmosOrreryComponent, OrreryTicket } from '../cosmos-projet/cosmos-orrery.component';

@Component({
  selector: 'orrery-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule, CosmosOrreryComponent],
  template: `
    <div class="ov-host">
      <!-- Sky de fond -->
      <div class="ov-sky"></div>

      <!-- Scène GLB en plein cadre -->
      <cosmos-orrery #orrery class="ov-stage"
                     glbUrl="/assets/agents/orrery.glb"
                     [animSpeed]="1"
                     [projectVelocity]="velocity()"
                     [projectHealth]="health()"
                     [tickets]="tickets()"
                     (planetClick)="onClick($event)">
      </cosmos-orrery>

      <!-- HUD topbar -->
      <header class="ov-topbar">
        <div class="ov-brand">
          <span class="ov-brand-icon">🔭</span>
          <span class="ov-brand-text">Orrery Viewer</span>
        </div>
        <div class="ov-status">
          GLB · {{ tickets().length }} tickets test · vitesse anim ×{{ animSpeed.toFixed(2) }}
        </div>
        <a class="ov-back" routerLink="/war-table" title="Retour Conclave">← Conclave</a>
      </header>

      <!-- Controls bottom -->
      <footer class="ov-controls">
        <label class="ov-ctrl">
          <span>Vitesse anim</span>
          <input type="range" min="0.1" max="3" step="0.05"
                 [value]="animSpeed"
                 (input)="onAnimSpeed($event)">
          <span class="ov-ctrl-val">{{ animSpeed.toFixed(2) }}×</span>
        </label>
        <label class="ov-ctrl">
          <span>Santé projet</span>
          <input type="range" min="0" max="100" step="1"
                 [value]="health()"
                 (input)="onHealth($event)">
          <span class="ov-ctrl-val">{{ health() }}%</span>
        </label>
        <label class="ov-ctrl">
          <span>Velocity (SP)</span>
          <input type="range" min="5" max="100" step="1"
                 [value]="velocity()"
                 (input)="onVelocity($event)">
          <span class="ov-ctrl-val">{{ velocity() }}</span>
        </label>
        <label class="ov-ctrl">
          <span>Durée projet</span>
          <input type="range" min="5" max="60" step="1"
                 [value]="projectDurationSec()"
                 (input)="onProjectDuration($event)">
          <span class="ov-ctrl-val">{{ projectDurationSec() }}s</span>
        </label>
        <button class="ov-btn ov-btn-play" (click)="playTimeline()" title="Simule la timeline du projet : fusion séquentielle des groupes">
          ▶ Play
        </button>
        <button class="ov-btn" (click)="reshuffleTickets()" title="Tirer un nouveau set d'astres">
          🎲 Reshuffle
        </button>
        <button class="ov-btn ov-btn-danger" (click)="explodeCrystal()" title="Crystal Explode (random scatter)">
          💥 Explode
        </button>
        <button class="ov-btn" (click)="reformCrystal()" title="Crystal Reform (retour à WHOLE après explode classique)">
          🔧 Reform
        </button>
      </footer>

      <!-- Panel info au click sur astre -->
      <div *ngIf="selected() as t" class="ov-panel">
        <button class="ov-panel-close" (click)="selected.set(null)">×</button>
        <div class="ov-panel-head">
          <span class="ov-panel-dot" [style.background]="t.color || '#a3b8d0'"></span>
          <strong class="ov-panel-title">{{ t.title || ('Astre #' + t.id) }}</strong>
          <span class="ov-panel-status" *ngIf="t.status">{{ t.status }}</span>
        </div>
        <div class="ov-panel-row" *ngIf="t.storyPoints !== undefined"><span>Story Points</span><strong>{{ t.storyPoints }}</strong></div>
        <div class="ov-panel-row" *ngIf="t.date"><span>Date</span><strong>{{ t.date }}</strong></div>
        <div class="ov-panel-row" *ngIf="t.description"><span>Description</span><strong>{{ t.description }}</strong></div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #04030e;
      color: #e8e0d0;
      font-family: 'Inter', system-ui, sans-serif;
      overflow: hidden;
    }
    .ov-host {
      position: absolute;
      inset: 0;
    }
    .ov-sky {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 30%, rgba(155, 108, 255, 0.16), transparent 45%),
        radial-gradient(circle at 80% 70%, rgba(94, 182, 218, 0.12), transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.6), #04030e 80%);
      z-index: 0;
    }
    .ov-stage {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: block;
    }
    .ov-topbar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 14px 22px;
      background: linear-gradient(to bottom, rgba(8, 6, 20, 0.85), transparent);
      pointer-events: none;
    }
    .ov-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: auto;
    }
    .ov-brand-icon {
      font-size: 20px;
      filter: drop-shadow(0 0 4px rgba(230, 184, 90, 0.6));
    }
    .ov-brand-text {
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #ffd778;
      font-size: 14px;
    }
    .ov-status {
      flex: 1;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.55);
      letter-spacing: 0.3px;
    }
    .ov-back {
      pointer-events: auto;
      padding: 6px 14px;
      background: rgba(230, 184, 90, 0.08);
      color: #e6b85a;
      border: 1px solid rgba(230, 184, 90, 0.35);
      border-radius: 4px;
      font-size: 11px;
      text-decoration: none;
      transition: background 140ms;
    }
    .ov-back:hover {
      background: rgba(230, 184, 90, 0.2);
      color: #fff;
    }
    .ov-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 14px 22px;
      background: linear-gradient(to top, rgba(8, 6, 20, 0.85), transparent);
    }
    .ov-ctrl {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      max-width: 220px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.65);
    }
    .ov-ctrl > span:first-child {
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .ov-ctrl input {
      accent-color: #e6b85a;
      cursor: pointer;
    }
    .ov-ctrl-val {
      color: #ffd778;
      font-weight: 600;
      font-size: 11px;
    }
    .ov-btn {
      padding: 8px 16px;
      background: rgba(230, 184, 90, 0.12);
      color: #ffd778;
      border: 1px solid rgba(230, 184, 90, 0.4);
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: background 140ms;
    }
    .ov-btn:hover {
      background: rgba(230, 184, 90, 0.24);
      color: #fff;
    }
    .ov-btn-danger {
      background: rgba(230, 90, 90, 0.18);
      color: #ff8a8a;
      border-color: rgba(230, 90, 90, 0.5);
    }
    .ov-btn-danger:hover {
      background: rgba(230, 90, 90, 0.32);
      color: #fff;
    }
    .ov-btn-play {
      background: linear-gradient(135deg, rgba(127, 219, 111, 0.25), rgba(94, 182, 218, 0.25));
      color: #b6f5a5;
      border-color: rgba(127, 219, 111, 0.55);
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .ov-btn-play:hover {
      background: linear-gradient(135deg, rgba(127, 219, 111, 0.4), rgba(94, 182, 218, 0.4));
      color: #fff;
      box-shadow: 0 0 12px rgba(127, 219, 111, 0.4);
    }
    .ov-panel {
      position: absolute;
      top: 70px;
      right: 22px;
      z-index: 20;
      min-width: 280px;
      max-width: 360px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(15, 14, 35, 0.95) 0%, rgba(28, 22, 50, 0.95) 100%);
      border: 1px solid rgba(230, 184, 90, 0.45);
      border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5), 0 0 16px rgba(155, 108, 255, 0.18);
      backdrop-filter: blur(8px);
      animation: ov-panel-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes ov-panel-in {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    .ov-panel-close {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 22px;
      height: 22px;
      background: transparent;
      border: 1px solid rgba(230, 184, 90, 0.4);
      border-radius: 50%;
      color: #e6b85a;
      cursor: pointer;
    }
    .ov-panel-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding-right: 24px;
    }
    .ov-panel-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      box-shadow: 0 0 8px currentColor;
    }
    .ov-panel-title {
      color: #ffd778;
      font-size: 12px;
      flex: 1;
    }
    .ov-panel-status {
      font-size: 9px;
      padding: 2px 6px;
      background: rgba(230, 184, 90, 0.18);
      color: #e6b85a;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .ov-panel-row {
      display: flex;
      gap: 8px;
      font-size: 10px;
      padding: 3px 0;
      border-bottom: 1px dotted rgba(255, 255, 255, 0.06);
    }
    .ov-panel-row > span {
      color: rgba(255, 255, 255, 0.5);
      min-width: 80px;
    }
    .ov-panel-row > strong {
      color: #fff;
      font-weight: 500;
      flex: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrreryViewerComponent {
  @ViewChild('orrery') orrery?: CosmosOrreryComponent;

  animSpeed = 1;
  velocity = signal<number>(30);
  health = signal<number>(75);
  selected = signal<OrreryTicket | null>(null);

  projectDurationSec = signal<number>(20);

  explodeCrystal() { this.orrery?.explodeCrystal(); }
  reformCrystal() { this.orrery?.reformCrystal(); }
  playTimeline() { this.orrery?.playProjectTimeline(this.projectDurationSec()); }
  onProjectDuration(ev: Event) {
    this.projectDurationSec.set(parseInt((ev.target as HTMLInputElement).value, 10));
  }

  // Mini set de tickets de démo (pour voir les couleurs sur les planètes)
  private demoColors = ['#e64a4a', '#ffaa44', '#ffd778', '#7fdb6f', '#5eb6da', '#9b6cff', '#ff6cff', '#a3b8d0'];
  tickets = signal<OrreryTicket[]>(this.generateDemo(8));

  reshuffleTickets() {
    const n = 4 + Math.floor(Math.random() * 8);  // 4-12 astres
    this.tickets.set(this.generateDemo(n));
  }

  private generateDemo(n: number): OrreryTicket[] {
    const titles = [
      'Cadrage MuleSoft', 'Migration API', 'Refactor auth', 'Tests E2E',
      'Optimisation perf', 'Doc tech', 'Refonte UI', 'Sprint planning',
      'Code review', 'Bug triage', 'Spike technique', 'Release v1',
    ];
    // ~20% DONE, ~30% IN_PROGRESS, ~50% TODO → garde la majorité orbitante
    const statuses = ['TODO', 'TODO', 'IN_PROGRESS', 'IN_PROGRESS', 'TODO', 'DONE', 'BLOCKED', 'TODO'];
    const out: OrreryTicket[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        id: 'demo-' + i,
        title: titles[i % titles.length],
        color: this.demoColors[i % this.demoColors.length],
        storyPoints: 1 + Math.floor(Math.random() * 13),
        status: statuses[i % statuses.length],
        visible: true,
        date: this.randomDateOfYear(),
      });
    }
    return out;
  }

  private randomDateOfYear(): string {
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const y = new Date().getFullYear();
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  onAnimSpeed(ev: Event) {
    const v = parseFloat((ev.target as HTMLInputElement).value);
    this.animSpeed = v;
  }
  onHealth(ev: Event) {
    this.health.set(parseInt((ev.target as HTMLInputElement).value, 10));
  }
  onVelocity(ev: Event) {
    this.velocity.set(parseInt((ev.target as HTMLInputElement).value, 10));
  }
  onClick(payload: { ticket: OrreryTicket | null; pairIndex: number }) {
    if (!payload?.ticket) {
      this.selected.set({
        id: 'astre-' + payload.pairIndex,
        title: `Astre #${payload.pairIndex + 1}`,
        description: 'Aucun ticket attribué à cette planète.',
        color: '#6b7a8c',
        status: 'EMPTY',
      });
      return;
    }
    const cur = this.selected();
    if (cur && String(cur.id) === String(payload.ticket.id)) {
      this.selected.set(null);
    } else {
      this.selected.set(payload.ticket);
    }
  }
}
