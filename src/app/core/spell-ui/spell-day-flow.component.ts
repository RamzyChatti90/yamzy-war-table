// ═══════════════════════════════════════════════════════════════════
// 🌅 SPELL DAY FLOW — Timeline d'une journée Scrum
//
// Affiche une journée type d'équipe Scrum en montrant l'enchaînement
// des cérémonies/activités à travers les rooms du Royaume.
//
// Chaque étape : heure + icône + room + activité + route cliquable.
// L'utilisateur peut cliquer une étape → téléporte dans la room.
//
//   <wt-spell-day-flow
//     [open]="dayOpen()"
//     [steps]="DAILY_STEPS"
//     accent="#d54adf"
//     (close)="dayOpen.set(false)"
//     (stepClick)="goToRoom($event)" />
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener,
  Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';
import { SpellButtonComponent } from './spell-button.component';

export interface DayFlowStep {
  /** Heure formatée "08:30" */
  time: string;
  /** Icône emoji */
  icon: string;
  /** Nom de la room (Henny Penny) */
  room: string;
  /** Activité courte */
  activity: string;
  /** Description détaillée */
  body: string;
  /** Route Angular pour téléporter */
  route: string;
  /** Couleur d'accent de la room */
  accent?: string;
  /** Phase de la journée : morning / noon / afternoon / evening */
  phase?: 'morning' | 'noon' | 'afternoon' | 'evening';
}

/**
 * Sequence type d'une journée Scrum à travers TOUTES les rooms du Royaume Yamzy.
 * 19 étapes : 11 rooms thématiques + 8 workshops Scrum, étalées 08:30 → 18:30.
 */
export const DAILY_FLOW_STEPS: DayFlowStep[] = [
  // ─── MATIN : Démarrage + cérémonies de cadrage ────────────────────────
  { time: '08:30', icon: '☕', room: 'Lean Coffee',           activity: 'Café démocratique',     body: "On démarre la journée par un café informel. Sujets brûlants posés sur la table, dot voting pour prioriser, timer 5 min par sujet.", route: '/lean-coffee',         accent: '#6b4423', phase: 'morning' },
  { time: '08:50', icon: '🏖', room: 'Definitions Beach',    activity: 'DoR / DoD review',      body: "Rapide check des drapeaux Ready/Done plantés dans le sable. Critères d'acceptation clairs ? Tests, monitoring, docs ?", route: '/definitions-beach',   accent: '#fde68a', phase: 'morning' },
  { time: '09:00', icon: '🏝', room: 'Kanban Island',         activity: 'Daily Standup',         body: "L'équipe se rassemble. Chacun déplace ses tickets sur l'île, signale ses blocages, partage les engagements du jour.", route: '/kanban-island',       accent: '#67e8f9', phase: 'morning' },
  { time: '09:30', icon: '🍇', room: 'Refinement Orchard',    activity: 'Backlog grooming',      body: "Avant de coder, on cueille les fruits mûrs (DoR validés) et on plante les graines des prochaines stories.", route: '/refinement-orchard',  accent: '#84cc16', phase: 'morning' },
  { time: '10:00', icon: '🏔', room: 'Story Mapping',         activity: 'User journeys',         body: "Sentiers user journey + pierres user stories + ligne de release MVP. On dessine le parcours utilisateur de bout en bout.", route: '/story-trail',         accent: '#f59e0b', phase: 'morning' },
  { time: '10:30', icon: '🌳', room: 'Git Tree',              activity: 'Coding session',        body: "Direction Git Tree pour pousser le code. Chaque commit fait pousser une feuille colorée sur l'arbre des lignées.", route: '/git-tree-room',       accent: '#67e8f9', phase: 'morning' },
  { time: '11:30', icon: '🪞', room: 'PR Mirror Hall',        activity: 'Code Review',           body: "Pause review. Les miroirs reflètent les diffs — approved, changes requested, conflicts. Mergé = un nouvel artefact dans le hall.", route: '/pr-mirror-hall',      accent: '#67e8f9', phase: 'noon' },
  // ─── MIDI / DÉBUT APRÈS-MIDI : Release + audit ───────────────────────
  { time: '12:30', icon: '🏛', room: 'Library Cathedral',    activity: 'Doc & lessons',         body: "On archive la connaissance acquise : ADR, runbooks, RFC. Les vitraux gardent la lumière des décisions passées.", route: '/library-cathedral',   accent: '#a78bfa', phase: 'noon' },
  { time: '14:00', icon: '🔥', room: 'Phoenix Forge',         activity: 'Release ritual',        body: "Release planifiée ! L'athanor consume l'ancien code, l'œuf doré éclôt — une nouvelle version naît, les plumes du phénix retombent.", route: '/phoenix-forge',       accent: '#ea580c', phase: 'afternoon' },
  { time: '15:00', icon: '⚗', room: 'Alchemist Cellar',      activity: 'Audit coût IA',         body: "Audit du coût d'infra et du mana IA. Les fioles colorées affichent compute, storage, IA. Chaque sort consomme de l'eau magique.", route: '/alchemist-cellar',    accent: '#84cc16', phase: 'afternoon' },
  { time: '15:30', icon: '💧', room: 'Mana Fountain',         activity: 'Sensibilisation IA',    body: "On vérifie la consommation IA du jour : tokens + mL d'eau cooling + $. Chaque question Yamzy coûte une goutte de magie.", route: '/mana-fountain',       accent: '#d54adf', phase: 'afternoon' },
  // ─── APRÈS-MIDI : Risques + lessons learned ──────────────────────────
  { time: '16:00', icon: '🪨', room: 'Five Whys Well',        activity: 'Root cause analysis',   body: "Un incident en prod ? Direction le Puits des Cinq Pourquoi. On descend 5 niveaux pour atteindre la racine — pas le symptôme.", route: '/five-whys-well',      accent: '#475569', phase: 'afternoon' },
  { time: '16:20', icon: '⚰', room: 'Pre-mortem Crypt',     activity: 'Imagine l\'échec',       body: "Avant de lancer un gros projet, on imagine son échec dans la crypte. Sarcophages = causes, bougies = vote impact, runes = contre-mesures.", route: '/premortem-crypt',     accent: '#831843', phase: 'afternoon' },
  { time: '16:45', icon: '🌌', room: 'Star Map Risks',        activity: 'Carte des périls',      body: "On observe les constellations des risques actifs : critique (rouge), surveillance (orange), oublié (gris). Une supernova ? Action immédiate.", route: '/star-map-risks',      accent: '#f59e0b', phase: 'afternoon' },
  // ─── SOIR : Insights + retrospective ─────────────────────────────────
  { time: '17:00', icon: '🐠', room: 'Oracle Aquarium',      activity: 'Voice of customer',     body: "On écoute la voix du client. Méduses = pain points, poissons = interviews, trésors = JTBD validés.", route: '/oracle-aquarium',     accent: '#a78bfa', phase: 'evening' },
  { time: '17:20', icon: '🎴', room: 'Card Tavern',          activity: 'Pipeline commercial',    body: "Tour des cartes du destin : leads qualifiés, deals en cours, MRR. Win rate ? Cycle ?", route: '/card-tavern',         accent: '#84cc16', phase: 'evening' },
  { time: '17:40', icon: '🏔', room: 'OKR Mountain',          activity: 'OKR check-in',          body: "On vérifie la progression vers le sommet. Chaque KR a son drapeau planté à l'altitude correspondante au % d'atteinte.", route: '/okr-mountain',        accent: '#fde68a', phase: 'evening' },
  { time: '18:00', icon: '⛵', room: 'Retrospective Sailboat', activity: 'Retro de sprint',       body: "Fin de sprint, retro Sailboat. Vent (Glad), ancres (Sad), récifs (Mad), île (Actions). On vote, on décide.", route: '/retrospective-cove',  accent: '#67e8f9', phase: 'evening' },
  { time: '18:30', icon: '🔭', room: 'Telescope Island',      activity: 'Daily wrap-up',         body: "Avant de partir, un coup d'œil au télescope. Le ciel reflète l'état du projet — aurores (smooth), comètes (incidents), supernovas (releases).", route: '/telescope-island',    accent: '#f59e0b', phase: 'evening' },
];

@Component({
  selector: 'wt-spell-day-flow',
  standalone: true,
  imports: [CommonModule, RouterLink, SpellButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="open" class="sdf-host" [style.--accent]="accent" role="dialog" aria-modal="true">
      <div class="sdf-backdrop" (click)="emitClose()"></div>
      <div class="sdf-card">
        <button class="sdf-close" (click)="emitClose()" aria-label="Fermer">×</button>

        <header class="sdf-head">
          <div class="sdf-suptitle">— UNE JOURNÉE DANS LE ROYAUME —</div>
          <h1 class="sdf-title">Journée Demo</h1>
          <p class="sdf-subtitle">L'enchaînement des cérémonies Scrum à travers les rooms du Royaume Yamzy. Clique sur une étape pour t'y téléporter.</p>
        </header>

        <div class="sdf-timeline-wrap">
        <ol class="sdf-timeline">
          <li *ngFor="let step of steps; let i = index"
              class="sdf-step"
              [class]="'sdf-phase-' + (step.phase || 'morning')"
              [style.--step-accent]="step.accent || accent">
            <div class="sdf-time">{{ step.time }}</div>
            <div class="sdf-marker">
              <span class="sdf-icon">{{ step.icon }}</span>
              <div class="sdf-line" *ngIf="i < steps.length - 1"></div>
            </div>
            <a [routerLink]="step.route" (click)="emitStep(step, i)" class="sdf-content">
              <div class="sdf-room">{{ step.room }}</div>
              <div class="sdf-activity">{{ step.activity }}</div>
              <p class="sdf-body">{{ step.body }}</p>
              <span class="sdf-cta">Visiter cette room →</span>
            </a>
          </li>
        </ol>
        </div>

        <footer class="sdf-foot">
          <wt-spell-btn variant="ghost" size="sm" [accent]="accent" (click)="emitClose()">Fermer</wt-spell-btn>
          <wt-spell-btn variant="primary" size="md" [accent]="accent" [routerLink]="steps[0]?.route || '/yamzy-island'" (click)="emitClose()">
            ▶ Commencer la journée
          </wt-spell-btn>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");
    :host { display: contents; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sdf-host {
      position: fixed; inset: 0; z-index: 9650;
      display: grid; place-items: center;
      padding: 4vmin;
      animation: sdfFade 0.4s ease-out;
    }
    @keyframes sdfFade { from { opacity: 0; } to { opacity: 1; } }
    .sdf-backdrop {
      position: absolute; inset: 0;
      background-color: rgba(0,0,0,0.88);
      backdrop-filter: blur(10px);
    }
    .sdf-card {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      overflow-y: auto;
      padding: clamp(20px, 4vmin, 56px) clamp(20px, 6vmin, 80px);
      background-color: rgba(0,0,0,0.92);
      border: none;
      border-top: 4px solid var(--accent);
      color: #f0f0f0;
      font-family: "Tinos", serif;
      animation: sdfCard 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      box-sizing: border-box;
    }
    @keyframes sdfCard { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .sdf-close {
      position: fixed; top: 22px; right: 22px;
      background: rgba(0,0,0,0.5); border: 2px solid #555; color: #fff;
      width: 46px; height: 46px; border-radius: 50%;
      font-size: 26px; line-height: 1; cursor: pointer;
      transition: all 0.18s;
      z-index: 10;
      backdrop-filter: blur(6px);
    }
    .sdf-close:hover { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent); }

    /* Header */
    .sdf-head { text-align: center; margin-bottom: clamp(20px, 3vmin, 40px); max-width: 1100px; margin-left: auto; margin-right: auto; }
    .sdf-suptitle {
      font-size: clamp(11px, 1.5vmin, 14px);
      letter-spacing: 0.4em;
      color: var(--accent);
      text-transform: uppercase;
      opacity: 0.9;
      margin-bottom: 12px;
    }
    .sdf-title {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(34px, 7vmin, 56px);
      margin: 0 0 12px;
      color: #fff;
      text-shadow: 0 0 30px color-mix(in srgb, var(--accent) 55%, transparent),
                   0 0 70px color-mix(in srgb, var(--accent) 30%, transparent);
    }
    .sdf-subtitle {
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.8vmin, 16px);
      line-height: 1.5;
      opacity: 0.85;
      max-width: 540px;
      margin: 0 auto;
    }

    /* Timeline */
    .sdf-timeline-wrap { max-width: 1100px; margin: 0 auto; }
    .sdf-timeline {
      list-style: none; margin: 0; padding: 0;
    }
    .sdf-step {
      display: grid;
      grid-template-columns: 70px 40px 1fr;
      gap: 16px;
      align-items: start;
      --step-accent: var(--accent);
    }
    .sdf-time {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(15px, 2vmin, 18px);
      color: var(--step-accent);
      padding-top: 16px;
      text-align: right;
      letter-spacing: 0.04em;
      text-shadow: 0 0 10px color-mix(in srgb, var(--step-accent) 35%, transparent);
    }
    .sdf-marker {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      padding-top: 14px;
    }
    .sdf-icon {
      width: 36px; height: 36px;
      display: grid; place-items: center;
      font-size: 20px;
      border: 2px solid var(--step-accent);
      border-radius: 50%;
      background-color: rgba(0,0,0,0.7);
      box-shadow: 0 0 16px color-mix(in srgb, var(--step-accent) 45%, transparent);
      z-index: 2;
    }
    .sdf-line {
      flex: 1;
      width: 2px;
      background: linear-gradient(to bottom,
        var(--step-accent) 0%,
        color-mix(in srgb, var(--step-accent) 30%, transparent) 100%);
      min-height: 30px;
      margin-top: 6px;
    }
    .sdf-content {
      display: block;
      padding: 12px 16px 18px;
      background-color: rgba(15, 15, 25, 0.4);
      border: 1px solid rgba(255,255,255,0.06);
      border-left: 3px solid var(--step-accent);
      color: inherit;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      margin-bottom: 14px;
    }
    .sdf-content:hover {
      background-color: color-mix(in srgb, var(--step-accent) 12%, rgba(15,15,25,0.4));
      box-shadow: 0 4px 18px color-mix(in srgb, var(--step-accent) 30%, transparent);
      transform: translateX(-3px);
    }
    .sdf-room {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      font-size: clamp(16px, 2.2vmin, 20px);
      color: var(--step-accent);
      letter-spacing: 0.02em;
    }
    .sdf-activity {
      font-family: "Tinos", serif;
      font-style: italic;
      font-size: clamp(12px, 1.6vmin, 14px);
      opacity: 0.7;
      margin-top: 2px;
    }
    .sdf-body {
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 15px);
      line-height: 1.5;
      margin: 10px 0 8px;
      opacity: 0.92;
    }
    .sdf-cta {
      font-family: "Tinos", serif;
      font-size: 0.85em;
      color: var(--step-accent);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .sdf-content:hover .sdf-cta { opacity: 1; }

    /* Phase tints */
    .sdf-phase-morning   { /* accent par défaut */ }
    .sdf-phase-noon      { /* highlighted moment */ }
    .sdf-phase-afternoon { /* heat of action */ }
    .sdf-phase-evening   { /* wrap-up */ }

    /* Footer */
    .sdf-foot {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid color-mix(in srgb, var(--accent) 22%, #222);
    }
  `],
})
export class SpellDayFlowComponent {
  @Input() open = false;
  @Input() steps: DayFlowStep[] = DAILY_FLOW_STEPS;
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Output() close = new EventEmitter<void>();
  @Output() stepClick = new EventEmitter<DayFlowStep>();

  emitClose(): void { this.close.emit(); }
  emitStep(s: DayFlowStep, i: number): void { this.stepClick.emit(s); }

  @HostListener('document:keydown.escape') onEsc(): void {
    if (this.open) this.emitClose();
  }
}
