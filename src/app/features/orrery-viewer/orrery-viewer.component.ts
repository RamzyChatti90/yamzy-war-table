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
  ChangeDetectionStrategy, Component, OnDestroy, signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CosmosOrreryComponent, OrreryTicket, OrreryCeremonyEvent } from '../cosmos-projet/cosmos-orrery.component';

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
                     [projectStartDate]="projectStart()"
                     [projectEndDate]="projectEnd()"
                     [simulatedTime]="simulatedTime()"
                     [useDeterministicTrajectory]="true"
                     (planetClick)="onClick($event)"
                     (ceremonyDetected)="onCeremony($event)">
      </cosmos-orrery>

      <!-- 🔮 Badge cérémonie (D) -->
      <div *ngIf="currentCeremony() as c" class="ov-ceremony" [attr.data-type]="c.type">
        <div class="ov-ceremony-icon">{{ ceremonyIcon(c.type) }}</div>
        <div class="ov-ceremony-text">
          <div class="ov-ceremony-label">{{ c.label }}</div>
          <div class="ov-ceremony-meta">{{ c.ticketIds.length }} ticket(s) · {{ fmtTime(c.timestamp) }}</div>
        </div>
      </div>

      <!-- ⚡ Flash full-screen sur cérémonie (1.4s pulse coloré) -->
      <div *ngIf="ceremonyFlash() as f" class="ov-flash" [attr.data-type]="f.type">
        <div class="ov-flash-content">
          <div class="ov-flash-icon">{{ f.icon }}</div>
          <div class="ov-flash-label">{{ f.label }}</div>
        </div>
      </div>

      <!-- 📅 AXE DE DATE TIMELINE — affiche start / today / end + sprints + curseur -->
      <div class="ov-timeline" *ngIf="tickets().length > 0">
        <div class="ov-tl-track">
          <!-- Sprints background : 3 zones colorées -->
          <div class="ov-tl-sprint" style="left:0%; width:33.33%" data-sprint="1">
            <span class="ov-tl-sprint-label">Sprint 1 · Cadrage</span>
          </div>
          <div class="ov-tl-sprint" style="left:33.33%; width:33.33%" data-sprint="2">
            <span class="ov-tl-sprint-label">Sprint 2 · Build</span>
          </div>
          <div class="ov-tl-sprint" style="left:66.66%; width:33.34%" data-sprint="3">
            <span class="ov-tl-sprint-label">Sprint 3 · Release</span>
          </div>
          <!-- Markers cérémonies attendues (3 par sprint approx) -->
          <div *ngFor="let m of timelineMarkers()" class="ov-tl-marker"
               [style.left.%]="m.pct"
               [attr.data-type]="m.type"
               [title]="m.label + ' · J' + m.day">
            <span class="ov-tl-marker-icon">{{ ceremonyIcon(m.type) }}</span>
          </div>
          <!-- Curseur today : position du simulatedTime -->
          <div class="ov-tl-cursor" [style.left.%]="cursorPct()"></div>
        </div>
        <div class="ov-tl-axis">
          <span class="ov-tl-tick" style="left:0%">{{ fmtShortDate(projectStart()) }}</span>
          <span class="ov-tl-tick" style="left:33.33%">{{ fmtShortDate(addDays(projectStart(), 30)) }}</span>
          <span class="ov-tl-tick" style="left:66.66%">{{ fmtShortDate(addDays(projectStart(), 60)) }}</span>
          <span class="ov-tl-tick ov-tl-tick-end" style="left:100%">{{ fmtShortDate(projectEnd()) }}</span>
          <span class="ov-tl-today" [style.left.%]="cursorPct()">{{ fmtShortDate(simulatedTime()) }}</span>
        </div>
      </div>

      <!-- HUD topbar -->
      <header class="ov-topbar">
        <div class="ov-brand">
          <span class="ov-brand-icon">🔭</span>
          <span class="ov-brand-text">Orrery Viewer</span>
        </div>
        <div class="ov-status">
          GLB · {{ tickets().length }} tickets · {{ activeCeremoniesCount() }} cérémonies déclenchées
        </div>
        <button class="ov-back" (click)="loadDemoProject()" title="Charge un projet exemple de 90 jours + lance le replay 60s">
          🎬 Demo projet
        </button>
        <button class="ov-back" (click)="showDocs.set(!showDocs())" title="Voir le schéma du système">
          📖 Comment ça marche
        </button>
        <a class="ov-back" routerLink="/yamzy-rooms" title="Retour Yamzy Rooms">← Yamzy Rooms</a>
      </header>

      <!-- 📖 Drawer documentation -->
      <div *ngIf="showDocs()" class="ov-docs-backdrop" (click)="showDocs.set(false)">
        <div class="ov-docs" (click)="$event.stopPropagation()">
          <button class="ov-docs-close" (click)="showDocs.set(false)">×</button>
          <h2 class="ov-docs-title">🌌 Cosmos × Crystal — Comment ça marche</h2>
          <p class="ov-docs-intro">
            Chaque ticket est un <strong>mini-cristal</strong> qui suit une trajectoire déterministe
            (calculée depuis ses dates). Les cérémonies Scrum sont détectées comme des
            <strong>alignements géométriques</strong>. Le Ruby central grossit à mesure que les tickets
            fusionnent — c'est le burndown en 3D.
          </p>
          <img src="/assets/COSMOS_CRYSTAL_SYSTEM.svg" alt="Schéma Cosmos Crystal" class="ov-docs-svg"/>
          <h3 class="ov-docs-h3">Les 6 cérémonies — exemples visuels</h3>
          <div class="ov-docs-grid">
            <div *ngFor="let c of ceremoniesDoc" class="ov-docs-card" [attr.data-type]="c.type">
              <div class="ov-docs-card-icon">{{ c.icon }}</div>
              <div class="ov-docs-card-name">{{ c.name }}</div>
              <div class="ov-docs-card-trig">{{ c.trigger }}</div>
              <div class="ov-docs-card-visu">{{ c.visual }}</div>
            </div>
          </div>
          <h3 class="ov-docs-h3">▶ Demo project — comment l'utiliser</h3>
          <ol class="ov-docs-list">
            <li>Clique <strong>🎬 Demo projet</strong> en haut → charge un projet de 90 jours (3 sprints, 12 tickets, 2 dépendances)</li>
            <li>Le replay 60 s démarre automatiquement</li>
            <li>Observe le slider Temps glisser de start → end</li>
            <li>Les badges cérémonie pop au bon moment : 🌅 Planning → 🌞 Daily → 🌖 Review → 🌑 Retro → ⊕ Éclipse → 🎉 Release</li>
            <li>Le Ruby central grossit à chaque fusion → atteint 100% quand tout est livré</li>
          </ol>
        </div>
      </div>

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
        <!-- 🎚 Slider TEMPS PROJET (étape B) -->
        <label class="ov-ctrl ov-ctrl-wide">
          <span>Temps projet · {{ fmtDate(simulatedTime()) }}</span>
          <input type="range" min="0" max="1000" step="1"
                 [value]="timelineSlider()"
                 (input)="onTimelineSlider($event)">
          <span class="ov-ctrl-val">{{ (timelineSlider() / 10).toFixed(1) }}%</span>
        </label>
        <button class="ov-btn ov-btn-play" (click)="toggleReplay()" title="Replay : auto-scrub start → end en 30 s">
          {{ isReplaying() ? '⏸ Pause' : '▶ Replay' }}
        </button>
        <button class="ov-btn" (click)="resetToNow()" title="Revenir à l'instant présent">
          ⊙ NOW
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
    /* Slider temps projet : plus large */
    .ov-ctrl-wide { max-width: 380px; flex: 2; }
    /* 🔮 Badge cérémonie centré en haut */
    .ov-ceremony {
      position: absolute;
      top: 76px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 25;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 22px;
      background: linear-gradient(135deg, rgba(15, 11, 32, 0.95), rgba(28, 22, 50, 0.95));
      border: 2px solid rgba(230, 184, 90, 0.7);
      border-radius: 30px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 24px rgba(230, 184, 90, 0.35);
      animation: ov-ceremony-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
      backdrop-filter: blur(8px);
    }
    @keyframes ov-ceremony-pop {
      0%   { opacity: 0; transform: translateX(-50%) scale(0.6); }
      60%  { opacity: 1; transform: translateX(-50%) scale(1.08); }
      100% { opacity: 1; transform: translateX(-50%) scale(1);    }
    }
    .ov-ceremony-icon {
      font-size: 30px;
      filter: drop-shadow(0 0 8px currentColor);
    }
    .ov-ceremony-text { display: flex; flex-direction: column; }
    .ov-ceremony-label {
      font-size: 14px;
      font-weight: 700;
      color: #ffd778;
      letter-spacing: 0.5px;
    }
    .ov-ceremony-meta {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.55);
      margin-top: 2px;
    }
    /* Couleurs par type */
    .ov-ceremony[data-type='planning'] { border-color: #5eb6da; }
    .ov-ceremony[data-type='daily']    { border-color: #ffd778; }
    .ov-ceremony[data-type='review']   { border-color: #ff6cff; }
    .ov-ceremony[data-type='retro']    { border-color: #9b6cff; }
    .ov-ceremony[data-type='eclipse']  { border-color: #e64a4a; box-shadow: 0 0 28px rgba(230, 74, 74, 0.5); }
    .ov-ceremony[data-type='release']  { border-color: #7fdb6f; }

    /* 📖 Drawer documentation */
    .ov-docs-backdrop {
      position: absolute;
      inset: 0;
      z-index: 80;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 30px;
      overflow-y: auto;
      animation: ov-fade-in 200ms ease-out;
    }
    @keyframes ov-fade-in { from { opacity: 0 } to { opacity: 1 } }
    .ov-docs {
      position: relative;
      max-width: 1100px;
      width: 100%;
      padding: 36px 44px;
      background: linear-gradient(135deg, rgba(15, 11, 32, 0.98), rgba(28, 22, 50, 0.98));
      border: 1px solid rgba(230, 184, 90, 0.4);
      border-radius: 14px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
      color: #e8e0d0;
    }
    .ov-docs-close {
      position: absolute;
      top: 14px;
      right: 16px;
      width: 32px;
      height: 32px;
      border: 1px solid rgba(230, 184, 90, 0.4);
      background: transparent;
      color: #e6b85a;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }
    .ov-docs-close:hover { background: rgba(230, 184, 90, 0.15); color: #fff; }
    .ov-docs-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffd778;
      margin: 0 0 14px;
      letter-spacing: 0.3px;
    }
    .ov-docs-intro {
      font-size: 13px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.78);
      margin: 0 0 20px;
    }
    .ov-docs-intro strong { color: #ffd778; }
    .ov-docs-svg {
      width: 100%;
      max-height: 660px;
      object-fit: contain;
      background: #0a0820;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      margin-bottom: 22px;
    }
    .ov-docs-h3 {
      font-size: 14px;
      font-weight: 700;
      color: #ffd778;
      margin: 22px 0 12px;
      letter-spacing: 0.4px;
    }
    .ov-docs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    @media (max-width: 800px) { .ov-docs-grid { grid-template-columns: 1fr; } }
    .ov-docs-card {
      padding: 12px 14px;
      background: rgba(15, 11, 32, 0.6);
      border-left: 3px solid #5eb6da;
      border-radius: 6px;
    }
    .ov-docs-card[data-type='planning'] { border-left-color: #5eb6da; }
    .ov-docs-card[data-type='daily']    { border-left-color: #ffd778; }
    .ov-docs-card[data-type='review']   { border-left-color: #ff6cff; }
    .ov-docs-card[data-type='retro']    { border-left-color: #9b6cff; }
    .ov-docs-card[data-type='eclipse']  { border-left-color: #e64a4a; }
    .ov-docs-card[data-type='release']  { border-left-color: #7fdb6f; }
    .ov-docs-card-icon {
      font-size: 22px;
      margin-bottom: 4px;
    }
    .ov-docs-card-name {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .ov-docs-card-trig {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.55);
      margin-bottom: 2px;
    }
    .ov-docs-card-visu {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.75);
      font-style: italic;
    }
    .ov-docs-list {
      font-size: 12px;
      line-height: 1.65;
      color: rgba(255, 255, 255, 0.78);
      padding-left: 22px;
      margin: 6px 0 6px;
    }
    .ov-docs-list strong { color: #ffd778; }
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
    /* ═══ ⚡ FLASH OVERLAY full-screen (cérémonie) ═══ */
    .ov-flash {
      position: absolute;
      inset: 0;
      z-index: 50;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ov-flash-pulse 1.4s ease-out forwards;
    }
    .ov-flash[data-type="planning"] { background: radial-gradient(circle at center, rgba(96, 165, 250, 0.45), transparent 60%); }
    .ov-flash[data-type="daily"]    { background: radial-gradient(circle at center, rgba(255, 215, 120, 0.5), transparent 65%); }
    .ov-flash[data-type="review"]   { background: radial-gradient(circle at center, rgba(255, 154, 81, 0.5), transparent 60%); }
    .ov-flash[data-type="retro"]    { background: radial-gradient(circle at center, rgba(155, 108, 255, 0.55), transparent 60%); }
    .ov-flash[data-type="eclipse"]  { background: radial-gradient(circle at center, rgba(0, 0, 0, 0.55), transparent 70%); }
    .ov-flash[data-type="release"]  { background: radial-gradient(circle at center, rgba(255, 255, 255, 0.7), transparent 80%); }
    .ov-flash-content {
      text-align: center;
      animation: ov-flash-grow 1.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ov-flash-icon  { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,255,255,0.7)); }
    .ov-flash-label { font-size: 22px; margin-top: 8px; color: #fff; font-weight: 700; letter-spacing: 1px; text-shadow: 0 0 12px rgba(0,0,0,0.5); }
    @keyframes ov-flash-pulse {
      0%   { opacity: 0; }
      18%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes ov-flash-grow {
      0%   { transform: scale(0.4); opacity: 0; }
      18%  { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* ═══ 📅 TIMELINE AXE DATE (bottom HUD, juste au-dessus des controls) ═══ */
    .ov-timeline {
      position: absolute;
      left: 24px;
      right: 24px;
      bottom: 78px;  /* au-dessus des .ov-controls (≈60px) */
      z-index: 9;
      pointer-events: none;
    }
    .ov-tl-track {
      position: relative;
      height: 36px;
      background: rgba(10, 12, 30, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      overflow: hidden;
      backdrop-filter: blur(6px);
    }
    .ov-tl-sprint {
      position: absolute;
      top: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px dashed rgba(255, 255, 255, 0.1);
    }
    .ov-tl-sprint[data-sprint="1"] { background: linear-gradient(90deg, rgba(74,222,128,0.15), rgba(74,222,128,0.05)); }
    .ov-tl-sprint[data-sprint="2"] { background: linear-gradient(90deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05)); }
    .ov-tl-sprint[data-sprint="3"] { background: linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05)); }
    .ov-tl-sprint-label {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.55);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .ov-tl-marker {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      cursor: help;
    }
    .ov-tl-marker-icon {
      font-size: 14px;
      filter: drop-shadow(0 0 4px rgba(0,0,0,0.8));
    }
    .ov-tl-marker[data-type="planning"]::before,
    .ov-tl-marker[data-type="daily"]::before,
    .ov-tl-marker[data-type="review"]::before,
    .ov-tl-marker[data-type="retro"]::before,
    .ov-tl-marker[data-type="eclipse"]::before,
    .ov-tl-marker[data-type="release"]::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      opacity: 0.4;
    }
    .ov-tl-marker[data-type="planning"]::before { background: #60a5fa; }
    .ov-tl-marker[data-type="daily"]::before    { background: #ffd778; }
    .ov-tl-marker[data-type="review"]::before   { background: #fb923c; }
    .ov-tl-marker[data-type="retro"]::before    { background: #9b6cff; }
    .ov-tl-marker[data-type="eclipse"]::before  { background: #000; box-shadow: 0 0 0 1px rgba(255,255,255,0.5); }
    .ov-tl-marker[data-type="release"]::before  { background: #fff; box-shadow: 0 0 12px rgba(255,255,255,0.8); }
    .ov-tl-cursor {
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 2px;
      background: #fff;
      box-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5);
      pointer-events: none;
      transition: left 0.15s linear;
    }
    .ov-tl-cursor::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(255,255,255,0.8);
    }
    .ov-tl-axis {
      position: relative;
      height: 18px;
      margin-top: 6px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.65);
    }
    .ov-tl-tick {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      white-space: nowrap;
    }
    .ov-tl-tick-end { transform: translateX(-100%); }
    .ov-tl-today {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      color: #fff;
      font-weight: 700;
      background: rgba(255,255,255,0.95);
      color: #04030e;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transition: left 0.15s linear;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrreryViewerComponent implements OnDestroy {
  @ViewChild('orrery') orrery?: CosmosOrreryComponent;

  animSpeed = 1;
  velocity = signal<number>(30);
  health = signal<number>(75);
  selected = signal<OrreryTicket | null>(null);

  // ═══ Timeline scrubbing (étape B) ═══
  projectStart = signal<Date>(new Date(Date.now() - 30 * 86400000));
  projectEnd = signal<Date>(new Date(Date.now() + 30 * 86400000));
  /** Position 0..1000 du slider. 0 = projectStart, 1000 = projectEnd. */
  timelineSlider = signal<number>(500);
  /** Temps simulé courant (Date), dérivé du slider */
  simulatedTime = signal<Date>(new Date());

  // ═══ Cérémonies détectées (étape D) ═══
  currentCeremony = signal<OrreryCeremonyEvent | null>(null);
  private ceremonyTimer: any = null;

  // ═══ Replay mode (étape H) ═══
  isReplaying = signal<boolean>(false);
  private replayHandle: any = null;
  private replayDurationMs = 30000;  // 30s pour parcourir tout le projet
  private replayStartedAt = 0;

  ngOnDestroy() {
    if (this.replayHandle) cancelAnimationFrame(this.replayHandle);
    if (this.ceremonyTimer) clearTimeout(this.ceremonyTimer);
  }

  onTimelineSlider(ev: Event) {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    this.timelineSlider.set(v);
    this.updateSimulatedTime();
  }

  private updateSimulatedTime() {
    const ratio = this.timelineSlider() / 1000;
    const startMs = this.projectStart().getTime();
    const endMs = this.projectEnd().getTime();
    const simMs = startMs + ratio * (endMs - startMs);
    this.simulatedTime.set(new Date(simMs));
    if (!this.isReplaying()) this.orrery?.resetCeremonyHistory();
  }

  resetToNow() {
    const startMs = this.projectStart().getTime();
    const endMs = this.projectEnd().getTime();
    const ratio = Math.max(0, Math.min(1, (Date.now() - startMs) / (endMs - startMs)));
    this.timelineSlider.set(Math.round(ratio * 1000));
    this.simulatedTime.set(new Date());
    this.orrery?.resetCeremonyHistory();
  }

  toggleReplay() {
    if (this.isReplaying()) {
      this.isReplaying.set(false);
      if (this.replayHandle) cancelAnimationFrame(this.replayHandle);
      return;
    }
    this.isReplaying.set(true);
    this.replayStartedAt = performance.now();
    this.timelineSlider.set(0);
    this.orrery?.resetCeremonyHistory();
    const tick = () => {
      if (!this.isReplaying()) return;
      const elapsed = performance.now() - this.replayStartedAt;
      const ratio = Math.min(1, elapsed / this.replayDurationMs);
      this.timelineSlider.set(Math.round(ratio * 1000));
      this.updateSimulatedTime();
      if (ratio >= 1) {
        this.isReplaying.set(false);
      } else {
        this.replayHandle = requestAnimationFrame(tick);
      }
    };
    this.replayHandle = requestAnimationFrame(tick);
  }

  onCeremony(ev: OrreryCeremonyEvent) {
    this.currentCeremony.set(ev);
    this.activeCeremoniesCount.update(n => n + 1);
    if (this.ceremonyTimer) clearTimeout(this.ceremonyTimer);
    this.ceremonyTimer = setTimeout(() => this.currentCeremony.set(null), 3000);
    // ⚡ Flash overlay : full-screen pulse coloré par cérémonie
    this.ceremonyFlash.set({ type: ev.type, label: ev.label, icon: this.ceremonyIcon(ev.type) });
    if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
    this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1400);
  }

  ceremonyIcon(type: string): string {
    switch (type) {
      case 'planning': return '🌅';
      case 'daily':    return '🌞';
      case 'review':   return '🌖';
      case 'retro':    return '🌑';
      case 'eclipse':  return '⊕';
      case 'release':  return '🎉';
      default:         return '🔮';
    }
  }

  fmtDate(d: Date): string {
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  }
  fmtShortDate(d: Date): string {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  fmtTime(ms: number): string {
    return new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  addDays(d: Date, n: number): Date {
    return new Date(d.getTime() + n * 86400000);
  }

  /** Cursor position % en fonction de simulatedTime entre projectStart et projectEnd */
  cursorPct(): number {
    const s = this.projectStart().getTime();
    const e = this.projectEnd().getTime();
    const t = this.simulatedTime().getTime();
    if (e <= s) return 0;
    return Math.max(0, Math.min(100, ((t - s) / (e - s)) * 100));
  }

  /** Markers cérémonies attendues — calculés depuis projectStart sur 90 jours
   *  S1 : Planning J0 + Daily J7 + Daily J14 + Daily J21 + Review J27 + Retro J29
   *  S2 : Planning J30 + Daily J37 + Daily J44 + Daily J51 + Review J57 + Retro J59
   *  S3 : Planning J60 + Daily J67 + Daily J74 + Review J87 + Retro J89 + Release J90
   */
  timelineMarkers(): Array<{ pct: number; day: number; type: string; label: string }> {
    return [
      { day: 0,  type: 'planning', label: 'Planning S1' },
      { day: 7,  type: 'daily',    label: 'Daily S1.1' },
      { day: 14, type: 'daily',    label: 'Daily S1.2' },
      { day: 21, type: 'eclipse',  label: 'Éclipse (dépendance)' },
      { day: 27, type: 'review',   label: 'Review S1' },
      { day: 29, type: 'retro',    label: 'Retro S1' },
      { day: 30, type: 'planning', label: 'Planning S2' },
      { day: 44, type: 'daily',    label: 'Daily S2' },
      { day: 51, type: 'eclipse',  label: 'Éclipse S2' },
      { day: 57, type: 'review',   label: 'Review S2' },
      { day: 59, type: 'retro',    label: 'Retro S2' },
      { day: 60, type: 'planning', label: 'Planning S3' },
      { day: 74, type: 'daily',    label: 'Daily S3' },
      { day: 87, type: 'review',   label: 'Review S3' },
      { day: 89, type: 'retro',    label: 'Retro S3' },
      { day: 90, type: 'release',  label: 'Release v1.0' },
    ].map(m => ({ ...m, pct: (m.day / 90) * 100 }));
  }

  explodeCrystal() { this.orrery?.explodeCrystal(); }
  reformCrystal() { this.orrery?.reformCrystal(); }

  // ═══ Documentation panel ═══
  showDocs = signal<boolean>(false);
  activeCeremoniesCount = signal<number>(0);

  ceremoniesDoc = [
    { type: 'planning', icon: '🌅', name: 'Sprint Planning',
      trigger: 'Tous les tickets du sprint à progress ≈ 0',
      visual: 'Une grappe de minis groupés au point de départ de l\'orbite' },
    { type: 'daily',    icon: '🌞', name: 'Daily Standup',
      trigger: '≥ 2 minis passent près du Sun',
      visual: 'Pulse jaune autour des minis du jour' },
    { type: 'review',   icon: '🌖', name: 'Sprint Review',
      trigger: 'Progress moyen du sprint ≥ 90%',
      visual: 'Minis convergent vers le Ruby, arc final' },
    { type: 'retro',    icon: '🌑', name: 'Sprint Retro',
      trigger: 'Tous les minis du sprint fusés',
      visual: 'Sprint éteint, Ruby grossit visiblement' },
    { type: 'eclipse',  icon: '⊕',  name: 'Éclipse (blocage)',
      trigger: 'A bloque B + leurs angles voisins',
      visual: 'Halo rouge, badge alarmant' },
    { type: 'release',  icon: '🎉', name: 'Release / Wrap-up',
      trigger: 'Tous les minis fusés',
      visual: 'Ruby à scale 1, fanfare visuelle' },
  ];

  // ═══ Demo project ═══
  // Projet 3 MOIS exact (90j) : Mar 2026 → Mai 2026 — 3 sprints × 10 tickets = 30
  loadDemoProject() {
    // Démarre 1er du mois courant pour des dates rondes lisibles dans le HUD
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = startDate.getTime();
    const end = start + 90 * 86400000;  // exactement 90 jours = 3 mois standards
    this.projectStart.set(new Date(start));
    this.projectEnd.set(new Date(end));
    // Curseur au début pour que le play se voie de start
    this.simulatedTime.set(new Date(start));
    this.timelineSlider.set(0);
    const tickets = this.buildDemoProject(start, end);
    this.tickets.set(tickets);
    // Lance le replay 60s (90 jours → 60s = 1.5 j/s)
    if (this.replayHandle) cancelAnimationFrame(this.replayHandle);
    this.replayDurationMs = 60000;
    this.isReplaying.set(false);  // toggle re-set
    setTimeout(() => this.toggleReplay(), 200);
    // Fermer la doc si ouverte
    this.showDocs.set(false);
    this.activeCeremoniesCount.set(0);
    this.ceremonyFlash.set(null);
  }

  /** Build un projet exemple : 3 sprints × 10 tickets = 30 sur 90 jours.
   *  Sprint 1 (DONE) : sprint achevé pour voir le Ruby grossir au démarrage.
   *  Sprint 2 (IN_PROGRESS/TODO) : sprint en cours pendant le replay.
   *  Sprint 3 (TODO) : sprint final, tickets se fusionnent vers la fin.
   *  Dependencies : crée 4 éclipses dans le projet. */
  private buildDemoProject(startMs: number, endMs: number): OrreryTicket[] {
    const totalMs = endMs - startMs;
    const sprintMs = totalMs / 3;           // 30 jours/sprint
    const ticketsPerSprint = 10;
    const out: OrreryTicket[] = [];
    // 30 titres réalistes pour 3 mois de dev SaaS
    const projectTitles = [
      // Sprint 1 — Cadrage / setup
      'Cadrage besoin métier', 'Spec fonctionnelle', 'Architecture cible', 'Setup CI/CD',
      'Maquettes Figma', 'POC stack technique', 'Modèle données draft', 'Découpage MVP',
      'Présentation comité', 'Lancement sprint 2',
      // Sprint 2 — Build
      'API endpoints v1', 'Auth OAuth2', 'Frontend layout', 'Modèle entités',
      'Migrations DB', 'Composants UI core', 'Service métier 1', 'Tests unitaires API',
      'Integration backend', 'Code review sprint',
      // Sprint 3 — Test + Release
      'Tests E2E Cypress', 'Optimisation perfs', 'Audit sécurité', 'Documentation API',
      'Bug fixes UAT', 'Release notes', 'Préparation prod', 'Smoke tests prod',
      'Go-live communication', 'Release v1.0',
    ];
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < ticketsPerSprint; i++) {
        const idx = s * ticketsPerSprint + i;
        // Étalement temporel : ticket démarre au jour `i/10 * sprintDur` du sprint
        const tStart = startMs + s * sprintMs + (i / ticketsPerSprint) * sprintMs * 0.6;
        const tDue   = startMs + s * sprintMs + ((i + 1) / ticketsPerSprint) * sprintMs * 0.9;
        // Sprint 1 entièrement DONE (Ruby grandit dès le début)
        // Sprint 2 et 3 : alternance pour pattern visuel varié
        const isDone = s === 0;
        const status: OrreryTicket['status'] = isDone
          ? 'DONE'
          : (i < 2 ? 'IN_PROGRESS' : (i === ticketsPerSprint - 1 ? 'BLOCKED' : 'TODO'));
        // Dépendances pour éclipses : 1 par sprint, sur tickets pivots
        const hasDeps = (i === 4 || i === 7);
        out.push({
          id: 'demo-' + idx,
          title: projectTitles[idx],
          color: this.demoColors[idx % this.demoColors.length],
          storyPoints: 1 + ((idx * 3) % 8),
          status,
          visible: true,
          startDate: new Date(tStart),
          dueDate: new Date(tDue),
          sprint: 'S' + (s + 1),
          priority: 1 + (i % 4),
          // Éclipses : tickets pivots dépendent du précédent dans le même sprint
          dependsOn: hasDeps && i > 0 ? ['demo-' + (idx - 1)] : undefined,
          fusedAt: isDone ? new Date(tDue - 86400000) : undefined,
        });
      }
    }
    const days = (totalMs / 86400000).toFixed(0);
    console.log(`[Viewer] 🎬 Demo project 3 mois — ${out.length} tickets sur ${days}j (${out.filter(t => t.status === 'DONE').length} DONE, ${out.filter(t => t.dependsOn).length} avec deps)`);
    return out;
  }

  /** v1.0.177-sim : flash overlay pour cérémonies (key 'planning'|'daily'|'review'|'retro'|'eclipse'|'release', null = off) */
  ceremonyFlash = signal<{ type: string; label: string; icon: string } | null>(null);
  private ceremonyFlashTimer: any = null;

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
    const statuses = ['TODO', 'TODO', 'IN_PROGRESS', 'IN_PROGRESS', 'TODO', 'DONE', 'BLOCKED', 'TODO'];
    const out: OrreryTicket[] = [];
    // Project window : déjà settée dans les signals
    const startMs = this.projectStart().getTime();
    const endMs = this.projectEnd().getTime();
    const totalMs = endMs - startMs;
    const ticketsPerSprint = Math.ceil(n / 3);  // 3 sprints
    for (let i = 0; i < n; i++) {
      const sprintIdx = Math.floor(i / ticketsPerSprint);
      const sprintStartMs = startMs + (sprintIdx / 3) * totalMs;
      const sprintEndMs = startMs + ((sprintIdx + 1) / 3) * totalMs;
      const within = (i % ticketsPerSprint) / ticketsPerSprint;
      const tStart = sprintStartMs + within * (sprintEndMs - sprintStartMs) * 0.5;
      const tDue = sprintStartMs + within * (sprintEndMs - sprintStartMs) * 0.5 + (sprintEndMs - sprintStartMs) * 0.4;
      out.push({
        id: 'demo-' + i,
        title: titles[i % titles.length],
        color: this.demoColors[i % this.demoColors.length],
        storyPoints: 1 + Math.floor(Math.random() * 13),
        status: statuses[i % statuses.length],
        visible: true,
        startDate: new Date(tStart),
        dueDate: new Date(tDue),
        sprint: 'S' + (sprintIdx + 1),
        priority: 1 + (i % 5),
        // Quelques dépendances : un ticket sur 4 dépend du précédent (pour générer éclipses)
        dependsOn: i > 0 && i % 4 === 0 ? ['demo-' + (i - 1)] : undefined,
        // Statut DONE : fusedAt déjà settée
        fusedAt: statuses[i % statuses.length] === 'DONE' ? new Date(tDue - 86400000) : undefined,
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
