// ═══════════════════════════════════════════════════════════════════
// 🪶 NARRATOR COMPONENT — UI overlay façon YAMZY companion
//
// Affiche :
//   • Bulle texte en bas-gauche avec avatar 🪶 Yamzy
//   • Toggle Yamzy lore / Scrum dev mode
//   • Controls Précédent / Pause / Suivant pour le tour
//   • Progress bar du tour
//   • Glossary panel à droite (objets explicables de la room)
//
// Embed dans une room :
//   <wt-narrator></wt-narrator>
// (le composant lit le state du NarratorService injecté)
// ═══════════════════════════════════════════════════════════════════
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NarratorService } from './narrator.service';
import { YamzyAvatar3dComponent } from '../../features/war-table/yamzy-avatar-3d.component';

@Component({
  selector: 'wt-narrator',
  standalone: true,
  imports: [CommonModule, YamzyAvatar3dComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Bulle narrateur (visible si tour ou example en cours) -->
    @if (narrator.isTourActive() || narrator.isExampleActive()) {
      <div class="nr-bubble"
           [class.nr-mode-scrum]="narrator.narratorMode() === 'scrum'"
           [class.nr-morphing]="narrator.isMorphing()"
           [attr.data-phase]="narrator.dualPhase()">
        <div class="nr-avatar" [class.nr-avatar-3d]="narrator.narratorMode() === 'yamzy'">
          @if (narrator.narratorMode() === 'scrum') {
            <span class="nr-avatar-emoji">📋</span>
          } @else {
            <app-yamzy-avatar-3d glbUrl="/assets/agents/YAMZY.glb" [bob]="true" [playGlbAnim]="true" [modelScale]="6" [modelYOffset]="-1.2"></app-yamzy-avatar-3d>
          }
        </div>
        <div class="nr-body">
          <div class="nr-mode-toggle">
            <button [class.active]="narrator.narratorMode() === 'yamzy'"
                    (click)="narrator.setMode('yamzy')">🪄 Yamzy</button>
            <button [class.active]="narrator.narratorMode() === 'scrum'"
                    (click)="narrator.setMode('scrum')">📋 Scrum / PM</button>
          </div>
          <div class="nr-text" [class.nr-fade-in]="narrator.dualPhase() === 'yamzy' || narrator.dualPhase() === 'scrum'">
            {{ narrator.currentText() }}
          </div>

          <!-- ✨ MORPH OVERLAY : transformation magique des mots-clés Yamzy ↔ Scrum -->
          @if (narrator.isMorphing()) {
            <div class="nr-morph-overlay">
              <div class="nr-morph-sparkles">
                @for (s of sparkles; track s) {
                  <span class="nr-sparkle" [style.--idx]="s">✨</span>
                }
              </div>
              @if (narrator.morphPairs().length > 0) {
                <div class="nr-morph-pairs">
                  @for (p of narrator.morphPairs(); track p.yamzy) {
                    <div class="nr-morph-pair">
                      <span class="nr-mp-yamzy">{{ p.yamzy }}</span>
                      <span class="nr-mp-arrow">→</span>
                      <span class="nr-mp-scrum">{{ p.scrum }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="nr-morph-default">
                  <span class="nr-mp-yamzy">🪶 Lore Yamzy</span>
                  <span class="nr-mp-arrow">→</span>
                  <span class="nr-mp-scrum">📋 Terminologie Agile</span>
                </div>
              }
            </div>
          }

          @if (narrator.isTourActive()) {
            <div class="nr-controls">
              <button (click)="narrator.prevStep()" [disabled]="narrator.currentStepIndex() === 0">← Précédent</button>
              <span class="nr-step">{{ narrator.currentStepIndex() + 1 }} / {{ narrator.totalSteps() }}</span>
              <button class="nr-next" (click)="narrator.nextStep()">Suivant →</button>
              <button class="nr-stop" (click)="narrator.stopTour()">✕ Quitter</button>
            </div>
            <div class="nr-progress">
              <div class="nr-progress-bar" [style.width.%]="narrator.tourProgress()"></div>
            </div>
          }
          @if (narrator.isExampleActive()) {
            <div class="nr-controls">
              <span class="nr-phase-badge" [attr.data-phase]="narrator.dualPhase()">
                @switch (narrator.dualPhase()) {
                  @case ('yamzy') { 🪄 Mode lore }
                  @case ('morph') { ✨ Transformation }
                  @case ('scrum') { 📋 Mode Scrum / PM }
                  @default { ⏵ Démo en cours }
                }
              </span>
              <button class="nr-stop" (click)="narrator.stopPlayExample()">✕ Arrêter la démo</button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Glossary panel (right) : liste des objets de la room avec leur description -->
    @if (showGlossary() && narrator.tutorial(); as t) {
      <aside class="nr-glossary">
        <div class="nr-gl-head">
          <span class="nr-gl-icon">{{ t.meta.icon }}</span>
          <div>
            <div class="nr-gl-name">{{ t.meta.name }}</div>
            <div class="nr-gl-lore">{{ t.meta.loreName }}</div>
          </div>
          <button class="nr-gl-close" (click)="closeGlossary()">×</button>
        </div>
        <div class="nr-gl-summary">{{ t.meta.summary }}</div>
        @if (t.glossary.length > 0) {
          <div class="nr-gl-section-title">🧰 Les éléments de la Room</div>
          @for (entry of t.glossary; track entry.tutorialId) {
            <div class="nr-gl-entry"
                 [class.is-highlighted]="narrator.highlightedEntry() === entry.tutorialId">
              <div class="nr-gl-entry-head">
                <strong class="nr-gl-entry-name">{{ entry.loreName || entry.name }}</strong>
                <span class="nr-gl-entry-scrum">↔ {{ entry.scrumName }}</span>
              </div>
              <div class="nr-gl-entry-desc">{{ entry.desc }}</div>
              <div class="nr-gl-entry-explain"
                   [class.is-yamzy]="narrator.narratorMode() === 'yamzy'">
                {{ narrator.narratorMode() === 'yamzy' ? entry.yamzyExplain : entry.scrumExplain }}
              </div>
              @if (entry.interactions?.length) {
                <div class="nr-gl-entry-actions">
                  @for (a of entry.interactions; track a) {
                    <span class="nr-gl-action">{{ a }}</span>
                  }
                </div>
              }
            </div>
          }
        }
      </aside>
    }

    <!-- Toggle glossary button -->
    @if (narrator.tutorial() && !showGlossary()) {
      <button class="nr-toggle-glossary" (click)="openGlossary()" title="Voir le glossaire des éléments">
        📖 Glossaire
      </button>
    }

    <!-- ▶ Demos menu : liste des scénarios disponibles -->
    @if (narrator.tutorial() && narrator.availableDemos().length > 1) {
      <button class="nr-demos-toggle" (click)="toggleDemosMenu()" [class.is-open]="showDemosMenu()" title="Choisir un scénario">
        🎬 {{ narrator.availableDemos().length }} scénarios
      </button>
      @if (showDemosMenu()) {
        <div class="nr-demos-menu">
          <div class="nr-demos-head">
            <strong>🎬 Scénarios disponibles</strong>
            <button class="nr-demos-close" (click)="toggleDemosMenu()">×</button>
          </div>
          @for (d of narrator.availableDemos(); track d.index) {
            <button class="nr-demos-item"
                    [class.is-active]="narrator.activeDemoIndex() === d.index && narrator.isExampleActive()"
                    (click)="playDemo(d.index)">
              <span class="nr-demos-icon">{{ d.icon }}</span>
              <span class="nr-demos-info">
                <span class="nr-demos-name">{{ d.name }}</span>
                <span class="nr-demos-desc">{{ d.description }}</span>
                <span class="nr-demos-dur">{{ d.duration }}s</span>
              </span>
            </button>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    /* ═══ Narrator bubble — ADN WELCOME (Henny Penny + magenta crystal) ═══
       Position : bottom-center, wide card façon conte welcome.
       Background : noir avec backdrop blur, bordure magenta/cyan selon mode.
       Fonts : Tinos pour le body, Henny Penny pour les labels. */
    .nr-bubble {
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: min(880px, calc(100vw - 40px));
      max-width: 880px;
      background-color: rgba(0, 0, 0, 0.78);
      border: 1px solid color-mix(in srgb, #fbbf24 50%, #333);
      border-left: 4px solid #fbbf24;
      border-radius: 4px;
      padding: clamp(16px, 2.4vmin, 24px) clamp(20px, 3vmin, 30px);
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 40px color-mix(in srgb, #fbbf24 18%, transparent),
                  0 0 0 1px rgba(251,191,36,0.12);
      z-index: 100;
      color: #f0f0f0;
      font-family: "Tinos", serif;
      animation: nr-bubble-in 0.6s ease-out;
    }
    .nr-bubble.nr-mode-scrum {
      border-color: color-mix(in srgb, #60a5fa 50%, #333);
      border-left-color: #60a5fa;
      box-shadow: 0 8px 40px color-mix(in srgb, #60a5fa 18%, transparent),
                  0 0 0 1px rgba(96,165,250,0.12);
    }
    @keyframes nr-bubble-in {
      from { transform: translate(-50%, 24px); opacity: 0; }
      to   { transform: translate(-50%, 0);    opacity: 1; }
    }
    /* On retire la flèche pointing — pas welcome */
    .nr-bubble::before { display: none; }

    .nr-avatar {
      position: absolute;
      top: -34px;
      left: 14px;
      width: 86px;
      height: 86px;
      background: radial-gradient(circle at 30% 30%, #fbbf24 0%, #b89240 80%, rgba(184,146,64,0.6) 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.2), 0 0 20px rgba(251,191,36,0.4);
      border: 2px solid #fbbf24;
      overflow: hidden;
    }
    .nr-avatar.nr-avatar-3d {
      /* Mode Yamzy : YAMZY 3D rendered inside the golden disc */
      padding: 0;
      background: radial-gradient(circle at 30% 30%, rgba(40,30,5,0.85) 0%, rgba(20,15,5,0.95) 100%);
    }
    .nr-avatar-3d app-yamzy-avatar-3d {
      display: block;
      width: 100%;
      height: 100%;
    }
    .nr-mode-scrum .nr-avatar {
      background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
      border-color: #60a5fa;
    }
    .nr-avatar-emoji {
      font-size: 32px;
      line-height: 1;
    }

    .nr-body { padding-top: 6px; }

    .nr-mode-toggle {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      margin-left: 60px;
    }
    .nr-mode-toggle button {
      background: rgba(0,0,0,0.3);
      color: rgba(255,255,255,0.5);
      border: 1px solid rgba(255,255,255,0.15);
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .nr-mode-toggle button.active {
      background: #fbbf24;
      color: #1a1500;
      border-color: #fbbf24;
    }
    .nr-mode-scrum .nr-mode-toggle button.active {
      background: #60a5fa;
      color: #0a1530;
      border-color: #60a5fa;
    }

    /* Body texte du narrator — façon welcome conte */
    .nr-text {
      font-family: "Tinos", serif;
      font-size: clamp(15px, 2vmin, 19px);
      line-height: 1.55;
      margin: 10px 0 14px;
      padding: 4px 0;
      color: #f5e3ad;
      min-height: 50px;
      transition: color 0.4s, opacity 0.3s;
      text-align: center;
    }
    .nr-mode-scrum .nr-text { color: #c7daff; }
    .nr-text.nr-fade-in { animation: nr-text-fade-in 0.6s ease-out; }
    @keyframes nr-text-fade-in {
      0%   { opacity: 0; transform: translateY(6px); filter: blur(4px); }
      100% { opacity: 1; transform: translateY(0);   filter: blur(0); }
    }

    /* ─── MORPH OVERLAY : transformation magique Yamzy ↔ Scrum ─── */
    .nr-bubble.nr-morphing {
      border-color: #c084fc !important;
      box-shadow: 0 0 0 1px rgba(192,132,252,0.4), 0 0 40px rgba(192,132,252,0.55), 0 8px 32px rgba(0,0,0,0.4) !important;
      background: linear-gradient(135deg, rgba(40,15,50,0.96) 0%, rgba(25,20,55,0.96) 50%, rgba(15,25,60,0.96) 100%) !important;
      animation: nr-morph-pulse 1s ease-in-out;
    }
    .nr-bubble.nr-morphing::before {
      border-color: #c084fc !important;
    }
    @keyframes nr-morph-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.025); }
    }
    .nr-bubble.nr-morphing .nr-avatar {
      background: linear-gradient(135deg, #fbbf24 0%, #c084fc 50%, #60a5fa 100%) !important;
      border-color: #c084fc !important;
      animation: nr-avatar-spin 1s ease-in-out;
    }
    @keyframes nr-avatar-spin {
      0%   { transform: rotate(0) scale(1); }
      50%  { transform: rotate(180deg) scale(1.15); }
      100% { transform: rotate(360deg) scale(1); }
    }

    .nr-morph-overlay {
      position: absolute;
      inset: 0;
      border-radius: 18px;
      overflow: hidden;
      pointer-events: none;
      z-index: 2;
    }
    .nr-morph-sparkles {
      position: absolute;
      inset: 0;
    }
    .nr-sparkle {
      position: absolute;
      font-size: 16px;
      opacity: 0;
      left: calc(8% + 80% * (var(--idx) % 11) / 10);
      top: calc(8% + 80% * ((var(--idx) * 7) % 11) / 10);
      animation: nr-sparkle-burst 1s ease-out forwards;
      animation-delay: calc(var(--idx) * 50ms);
      filter: drop-shadow(0 0 6px #fcd34d);
    }
    @keyframes nr-sparkle-burst {
      0%   { opacity: 0; transform: scale(0) rotate(0); }
      30%  { opacity: 1; transform: scale(1.4) rotate(120deg); }
      100% { opacity: 0; transform: scale(0.6) rotate(360deg); }
    }
    .nr-morph-pairs, .nr-morph-default {
      position: absolute;
      top: 50%;
      left: 16px;
      right: 16px;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid rgba(192,132,252,0.5);
      animation: nr-pair-appear 1s ease-out;
    }
    .nr-morph-pair, .nr-morph-default {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      line-height: 1.3;
    }
    .nr-morph-default { background: transparent; border: none; padding: 0; }
    .nr-mp-yamzy {
      color: #fcd34d;
      font-weight: 600;
      animation: nr-mp-burst-out 1s ease-in;
    }
    .nr-mp-arrow {
      color: #c084fc;
      font-weight: 700;
      font-size: 14px;
      animation: nr-mp-pulse 0.6s ease-in-out infinite alternate;
    }
    .nr-mp-scrum {
      color: #93c5fd;
      font-family: 'Consolas', monospace;
      font-weight: 600;
      font-size: 11px;
      padding: 2px 8px;
      background: rgba(96,165,250,0.15);
      border-radius: 4px;
      animation: nr-mp-burst-in 1s 0.2s ease-out backwards;
    }
    @keyframes nr-pair-appear {
      0%   { opacity: 0; transform: translateY(calc(-50% + 12px)); }
      40%  { opacity: 1; }
      100% { opacity: 1; transform: translateY(-50%); }
    }
    @keyframes nr-mp-burst-out {
      0%   { transform: scale(1); filter: blur(0); }
      100% { transform: scale(0.92); filter: blur(0.5px); opacity: 0.65; }
    }
    @keyframes nr-mp-burst-in {
      0%   { transform: scale(0.5); opacity: 0; filter: blur(4px); }
      60%  { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1);   opacity: 1; filter: blur(0); }
    }
    @keyframes nr-mp-pulse {
      0%   { transform: translateX(-3px); opacity: 0.6; }
      100% { transform: translateX(3px);  opacity: 1; }
    }

    .nr-phase-badge {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 10px;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.15);
      letter-spacing: 0.5px;
      transition: all 0.3s;
    }
    .nr-phase-badge[data-phase="yamzy"] { background: rgba(251,191,36,0.2); color: #fcd34d; border-color: rgba(251,191,36,0.4); }
    .nr-phase-badge[data-phase="morph"] { background: rgba(192,132,252,0.25); color: #e9d5ff; border-color: rgba(192,132,252,0.5); box-shadow: 0 0 12px rgba(192,132,252,0.5); }
    .nr-phase-badge[data-phase="scrum"] { background: rgba(96,165,250,0.2); color: #93c5fd; border-color: rgba(96,165,250,0.4); }

    /* Controls — façon welcome spell-btn */
    .nr-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
      justify-content: center;
    }
    .nr-controls button {
      background-color: rgba(0, 0, 0, 0.6);
      color: #f0f0f0;
      border: 2px solid #767474;
      padding: 0.3em 1em;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.6vmin, 16px);
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .nr-controls button:hover:not(:disabled) {
      border-color: #fbbf24;
      box-shadow: 0 0 14px color-mix(in srgb, #fbbf24 35%, transparent);
    }
    .nr-controls button:disabled { opacity: 0.4; cursor: not-allowed; }
    .nr-controls button.nr-next {
      background-color: color-mix(in srgb, #fbbf24 22%, rgba(0,0,0,0.6));
      border-color: #fbbf24;
      color: #fff;
      box-shadow: 0 0 18px color-mix(in srgb, #fbbf24 30%, transparent);
    }
    .nr-controls button.nr-next:hover {
      background-color: color-mix(in srgb, #fbbf24 35%, rgba(0,0,0,0.6));
      transform: translateY(-2px);
    }
    .nr-controls button.nr-stop {
      background: transparent;
      border: none;
      text-decoration: underline;
      text-decoration-color: #767474;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
      margin-left: 12px;
      padding: 0.3em 0.6em;
    }
    .nr-controls button.nr-stop:hover {
      text-decoration-color: #fbbf24;
      color: color-mix(in srgb, #fbbf24 70%, #fff);
      box-shadow: none;
    }

    /* Step counter — façon welcome "Étape X / Y" */
    .nr-step {
      font-family: "Henny Penny", cursive;
      font-size: clamp(14px, 1.9vmin, 18px);
      color: #fbbf24;
      letter-spacing: 0.02em;
      padding: 0 10px;
      text-shadow: 0 0 12px color-mix(in srgb, #fbbf24 40%, transparent);
    }
    .nr-mode-scrum .nr-step { color: #60a5fa; text-shadow: 0 0 12px color-mix(in srgb, #60a5fa 40%, transparent); }

    .nr-progress {
      margin-top: 8px;
      height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .nr-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #fbbf24 0%, #f5e3ad 100%);
      transition: width 0.4s ease-out;
    }
    .nr-mode-scrum .nr-progress-bar {
      background: linear-gradient(90deg, #60a5fa 0%, #93c5fd 100%);
    }

    /* ═══ Glossary panel — ADN spell-caster welcome ═══
       Side-drawer dark + border-left ambre + Henny Penny title + Tinos body. */
    .nr-glossary {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: clamp(360px, 32vw, 440px);
      overflow-y: auto;
      background-color: rgba(0, 0, 0, 0.86);
      border-left: 4px solid #fbbf24;
      border-top: 1px solid color-mix(in srgb, #fbbf24 30%, #333);
      border-bottom: 1px solid color-mix(in srgb, #fbbf24 30%, #333);
      padding: clamp(18px, 2.6vmin, 26px);
      backdrop-filter: blur(10px);
      z-index: 11;
      color: #f0f0f0;
      font-family: "Tinos", serif;
      box-shadow: 0 8px 40px color-mix(in srgb, #fbbf24 22%, transparent);
      animation: nrGlIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes nrGlIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .nr-gl-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, #fbbf24 28%, #222);
    }
    .nr-gl-icon { font-size: clamp(28px, 4.2vmin, 38px); }
    .nr-gl-name {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(20px, 2.7vmin, 26px);
      color: #fbbf24;
      letter-spacing: 0.02em;
      text-shadow: 0 0 16px color-mix(in srgb, #fbbf24 45%, transparent);
    }
    .nr-gl-lore {
      font-family: "Tinos", serif;
      font-size: clamp(12px, 1.6vmin, 14px);
      opacity: 0.72;
      font-style: italic;
    }
    .nr-gl-close {
      margin-left: auto;
      background: transparent;
      border: 2px solid #555;
      color: #fff;
      width: 32px; height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px; line-height: 1;
      transition: all 0.18s;
    }
    .nr-gl-close:hover {
      border-color: #fbbf24; color: #fbbf24;
      box-shadow: 0 0 14px color-mix(in srgb, #fbbf24 40%, transparent);
    }
    .nr-gl-summary {
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.75vmin, 15px);
      font-style: italic;
      opacity: 0.85;
      line-height: 1.55;
      margin-bottom: 18px;
      padding: 10px 14px;
      background-color: rgba(0,0,0,0.25);
      border-left: 3px solid #fbbf24;
    }
    .nr-gl-section-title {
      font-family: "Tinos", serif;
      font-size: clamp(11px, 1.4vmin, 13px);
      font-weight: 700;
      letter-spacing: 0.18em;
      color: #fbbf24;
      margin: 18px 0 10px;
      text-transform: uppercase;
    }
    .nr-gl-entry {
      background-color: rgba(15, 15, 25, 0.55);
      border: 1px solid rgba(255,255,255,0.06);
      border-left: 3px solid color-mix(in srgb, #fbbf24 35%, #444);
      padding: 12px 14px;
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    .nr-gl-entry.is-highlighted {
      background-color: color-mix(in srgb, #fbbf24 15%, rgba(15,15,25,0.55));
      border-left-color: #fbbf24;
      box-shadow: 0 4px 18px color-mix(in srgb, #fbbf24 30%, transparent);
      transform: translateX(-3px);
    }
    .nr-gl-entry-head { display: flex; flex-direction: column; gap: 3px; }
    .nr-gl-entry-name {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(15px, 2vmin, 18px);
      color: #fcd34d;
      letter-spacing: 0.01em;
    }
    .nr-gl-entry-scrum {
      font-family: "Tinos", serif;
      font-size: clamp(10px, 1.3vmin, 12px);
      opacity: 0.6;
      color: #93c5fd;
      font-style: italic;
    }
    .nr-gl-entry-desc {
      font-family: "Tinos", serif;
      font-size: clamp(12px, 1.6vmin, 14px);
      opacity: 0.88;
      margin-top: 8px;
      line-height: 1.5;
    }
    .nr-gl-entry-explain {
      font-family: "Tinos", serif;
      font-size: clamp(11px, 1.5vmin, 13px);
      margin-top: 10px;
      padding: 8px 10px;
      background-color: rgba(96,165,250,0.08);
      border-left: 2px solid #60a5fa;
      line-height: 1.55;
      color: #c7daff;
    }
    .nr-gl-entry-explain.is-yamzy {
      background-color: rgba(251,191,36,0.1);
      border-left-color: #fbbf24;
      color: #f5e3ad;
      font-style: italic;
    }
    .nr-gl-entry-actions {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .nr-gl-action {
      background-color: rgba(0,0,0,0.5);
      border: 1px solid color-mix(in srgb, #fbbf24 40%, #444);
      padding: 3px 9px;
      font-family: "Tinos", serif;
      font-size: clamp(10px, 1.3vmin, 12px);
      color: #fbbf24;
      letter-spacing: 0.04em;
    }

    /* Bouton toggle Glossaire — façon spell-btn ghost */
    .nr-toggle-glossary {
      position: fixed;
      top: 80px;
      right: 22px;
      background-color: rgba(0, 0, 0, 0.65);
      color: #fff;
      border: 2px solid color-mix(in srgb, #fbbf24 45%, #555);
      padding: 0.4em 1.1em;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 15px);
      cursor: pointer;
      z-index: 11;
      backdrop-filter: blur(8px);
      transition: all 0.18s ease;
    }
    .nr-toggle-glossary:hover {
      border-color: #fbbf24;
      box-shadow: 0 0 18px color-mix(in srgb, #fbbf24 40%, transparent);
      transform: translateY(-1px);
    }

    /* ─── 🎬 DEMOS MENU ─── */
    .nr-demos-toggle {
      position: fixed;
      top: 80px;
      right: 130px;
      background-color: rgba(0, 0, 0, 0.65);
      color: #fff;
      border: 2px solid color-mix(in srgb, #fbbf24 45%, #555);
      padding: 0.4em 1.1em;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 15px);
      cursor: pointer;
      z-index: 11;
      backdrop-filter: blur(8px);
      transition: all 0.18s ease;
    }
    .nr-demos-toggle:hover, .nr-demos-toggle.is-open {
      border-color: #fbbf24;
      box-shadow: 0 0 18px color-mix(in srgb, #fbbf24 40%, transparent);
      transform: translateY(-1px);
    }
    /* Demos menu = side-drawer style spell-caster */
    .nr-demos-menu {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: clamp(360px, 30vw, 420px);
      background-color: rgba(0, 0, 0, 0.86);
      border-left: 4px solid #fbbf24;
      border-top: 1px solid color-mix(in srgb, #fbbf24 30%, #333);
      border-bottom: 1px solid color-mix(in srgb, #fbbf24 30%, #333);
      padding: clamp(18px, 2.6vmin, 26px);
      backdrop-filter: blur(10px);
      z-index: 12;
      color: #f0f0f0;
      font-family: "Tinos", serif;
      box-shadow: 0 8px 40px color-mix(in srgb, #fbbf24 22%, transparent);
      overflow-y: auto;
      animation: nr-demos-in 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes nr-demos-in {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .nr-demos-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid color-mix(in srgb, #fbbf24 28%, #222);
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(20px, 2.7vmin, 26px);
      color: #fbbf24;
      letter-spacing: 0.02em;
      text-shadow: 0 0 16px color-mix(in srgb, #fbbf24 45%, transparent);
    }
    .nr-demos-close {
      background: transparent;
      border: 2px solid #555;
      color: #fff;
      width: 32px; height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px; line-height: 1;
      transition: all 0.18s;
    }
    .nr-demos-close:hover {
      border-color: #fbbf24; color: #fbbf24;
      box-shadow: 0 0 14px color-mix(in srgb, #fbbf24 40%, transparent);
    }
    .nr-demos-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      background-color: rgba(15, 15, 25, 0.55);
      border: 1px solid rgba(255,255,255,0.06);
      border-left: 3px solid color-mix(in srgb, #fbbf24 35%, #444);
      color: #f0f0f0;
      padding: 12px 14px;
      cursor: pointer;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.75vmin, 15px);
      text-align: left;
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    .nr-demos-item:hover {
      background-color: color-mix(in srgb, #fbbf24 15%, rgba(15,15,25,0.55));
      border-left-color: #fbbf24;
      box-shadow: 0 4px 18px color-mix(in srgb, #fbbf24 30%, transparent);
      transform: translateX(-3px);
    }
    .nr-demos-item.is-active {
      background-color: color-mix(in srgb, #60a5fa 18%, rgba(15,15,25,0.55));
      border-left-color: #60a5fa;
    }
    .nr-demos-icon { font-size: clamp(22px, 3.2vmin, 28px); flex-shrink: 0; }
    .nr-demos-info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
    .nr-demos-name {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(14px, 1.9vmin, 17px);
      color: #fcd34d;
      letter-spacing: 0.01em;
    }
    .nr-demos-desc {
      font-family: "Tinos", serif;
      font-size: clamp(11px, 1.5vmin, 13px);
      opacity: 0.82; line-height: 1.45;
    }
    .nr-demos-dur {
      font-family: "Tinos", serif;
      font-size: clamp(10px, 1.3vmin, 12px);
      opacity: 0.6;
      align-self: flex-end;
      letter-spacing: 0.06em;
    }
  `]
})
export class NarratorComponent {
  narrator = inject(NarratorService);
  showGlossary = signal<boolean>(false);
  showDemosMenu = signal<boolean>(false);
  /** Indices pour positionner les sparkles pendant le morph (24 étincelles aléatoires) */
  sparkles = Array.from({ length: 24 }, (_, i) => i);

  openGlossary(): void { this.showGlossary.set(true); }
  closeGlossary(): void { this.showGlossary.set(false); }
  toggleDemosMenu(): void { this.showDemosMenu.update(v => !v); }
  playDemo(idx: number): void {
    // Stop any current demo then start the selected one
    if (this.narrator.isExampleActive()) this.narrator.stopPlayExample();
    setTimeout(() => this.narrator.startPlayExample(idx), 100);
    this.showDemosMenu.set(false);
  }
}
