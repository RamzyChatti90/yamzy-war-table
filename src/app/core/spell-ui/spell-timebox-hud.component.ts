// ════════════════════════════════════════════════════════════════════
// ⏱ SPELL TIMEBOX HUD — Machine arcade pour le timeboxing des cérémonies
//
// Affiche un HUD style "machine spell-caster" avec :
//   - Anneau circulaire SVG qui se vide en glow magenta
//   - Countdown Henny Penny énorme au centre (MM:SS)
//   - Nom de la cérémonie en dessous
//   - Pulse rouge + son d'alerte quand < 10s
//
// Pattern :
//   <wt-spell-timebox-hud
//      [active]="playing()"
//      [durationS]="65"
//      [ceremonyName]="'Lean Coffee'"
//      [accent]="'#d54adf'"
//      (timeUp)="onTimeUp()" />
//
// Le HUD est positionné en haut-centre par défaut, fixed z-index 10400
// (sous le SpellHeader 10500 mais au-dessus de tout le reste).
// ════════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges,
  OnDestroy, Output, SimpleChanges, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'wt-spell-timebox-hud',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="active" class="stb-host" [class.is-danger]="isDanger()" [class.is-paused]="paused()" [style.--accent]="accent">
      <!-- Widget compact horizontal : icône + time + nom + controles + barre de progression -->
      <div class="stb-widget">
        <div class="stb-row">
          <span class="stb-icon">{{ paused() ? '⏸' : '⏱' }}</span>
          <span class="stb-time">{{ timeLabel() }}</span>
          <span class="stb-ceremony" *ngIf="ceremonyName">{{ ceremonyName }}</span>
          <!-- Boutons de contrôle : Pause / Replay / Terminer -->
          <div class="stb-controls">
            <button class="stb-ctrl" type="button"
                    [title]="paused() ? 'Reprendre' : 'Pause'"
                    (click)="togglePause()">{{ paused() ? '▶' : '⏸' }}</button>
            <button class="stb-ctrl" type="button"
                    title="Recommencer du début"
                    (click)="doReplay()">↺</button>
            <button class="stb-ctrl stb-ctrl-danger" type="button"
                    title="Terminer"
                    (click)="doClose()">✕</button>
          </div>
        </div>
        <!-- Barre de progression linéaire qui décroît -->
        <div class="stb-bar-track">
          <div class="stb-bar-fill" [style.width.%]="progressPct()"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      position: fixed;
      bottom: 64px;        /* juste au-dessus du SpellFooter (~50px) */
      right: 22px;
      z-index: 10400;
      pointer-events: none;   /* host transparent aux clics — */
      --accent: #d54adf;
    }
    /* — le widget lui-même est cliquable (pour les boutons pause/replay/close) */
    .stb-widget { pointer-events: auto; }
    .stb-host {
      /* Override styles.css [class$="-host"] qui matchait .stb-host et lui donnait 100vw × 100dvh */
      position: relative !important;
      width: auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      animation: stbSpawn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes stbSpawn {
      0%   { opacity: 0; transform: translateY(20px) scale(0.9); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ─── WIDGET compact bottom-right ─── */
    .stb-widget {
      position: relative;
      background: rgba(0, 0, 0, 0.78);
      border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
      border-radius: 8px;
      padding: 8px 14px 10px;
      min-width: 200px;
      backdrop-filter: blur(8px);
      box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 35%, transparent),
                  0 4px 16px rgba(0, 0, 0, 0.6);
      font-family: "Tinos", serif;
      color: #fff;
      text-shadow: 0 2px 6px rgba(0,0,0,0.9);
    }
    .is-danger .stb-widget {
      border-color: #ec5e4e !important;
      box-shadow: 0 0 22px rgba(236, 94, 78, 0.55),
                  0 0 48px rgba(236, 94, 78, 0.3),
                  0 4px 16px rgba(0, 0, 0, 0.6);
      animation: stbDangerPulse 0.6s ease-in-out infinite alternate;
    }
    @keyframes stbDangerPulse {
      from { transform: scale(1); }
      to   { transform: scale(1.04); }
    }

    /* ─── Row : icon + time + ceremony + controls ─── */
    .stb-row {
      display: flex;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
    }

    /* ─── Boutons de contrôle (Pause / Replay / Terminer) ─── */
    .stb-controls {
      display: flex;
      gap: 4px;
      margin-left: 6px;
      padding-left: 8px;
      border-left: 1px solid rgba(255, 255, 255, 0.15);
    }
    .stb-ctrl {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      color: #fff;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      font-family: "Tinos", serif;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      transition: all 0.18s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .stb-ctrl:hover {
      background: rgba(0, 0, 0, 0.6);
      border-color: var(--accent);
      color: color-mix(in srgb, var(--accent) 30%, #fff);
      box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
      transform: translateY(-1px);
    }
    .stb-ctrl-danger {
      border-color: rgba(236, 94, 78, 0.5);
    }
    .stb-ctrl-danger:hover {
      border-color: #ec5e4e;
      color: #ec5e4e;
      box-shadow: 0 0 8px rgba(236, 94, 78, 0.5);
    }
    /* En mode pause : icône ⏸ pulse pour rappeler que le timer est figé */
    .is-paused .stb-bar-fill {
      animation: stbPausedStripe 1s linear infinite;
      background: repeating-linear-gradient(45deg,
                  var(--accent) 0 8px,
                  color-mix(in srgb, var(--accent) 30%, transparent) 8px 16px);
    }
    @keyframes stbPausedStripe {
      from { background-position: 0 0; }
      to   { background-position: 16px 0; }
    }
    .is-paused .stb-time { opacity: 0.7; }
    .stb-icon {
      font-size: 16px;
      opacity: 0.9;
      align-self: center;
    }
    .stb-time {
      font-family: "Henny Penny", cursive;
      font-size: 26px;
      line-height: 1;
      letter-spacing: 0.03em;
      color: #fff;
      text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 70%, transparent),
                   0 2px 6px rgba(0,0,0,0.95);
      font-variant-numeric: tabular-nums;
    }
    .is-danger .stb-time {
      color: #ffd2cb;
      text-shadow: 0 0 14px rgba(236, 94, 78, 0.85),
                   0 2px 6px rgba(0,0,0,0.95);
    }
    .stb-ceremony {
      font-family: "Tinos", serif;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.85;
      color: color-mix(in srgb, var(--accent) 35%, #fff);
      font-weight: 700;
    }

    /* ─── Barre de progression linéaire ─── */
    .stb-bar-track {
      margin-top: 6px;
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .stb-bar-fill {
      height: 100%;
      background: linear-gradient(90deg,
                  var(--accent),
                  color-mix(in srgb, var(--accent) 40%, #d68ddc));
      box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent);
      transition: width 0.3s linear, background 0.3s ease;
      border-radius: 2px;
    }
    .is-danger .stb-bar-fill {
      background: linear-gradient(90deg, #ec5e4e, #ffd2cb);
      box-shadow: 0 0 12px rgba(236, 94, 78, 0.75);
    }

    /* Responsive : sur petit écran, widget passe à gauche pour éviter le hint */
    @media (max-width: 720px) {
      :host { right: 12px; bottom: 90px; }
      .stb-widget { min-width: 160px; padding: 6px 10px 8px; }
      .stb-time { font-size: 22px; }
    }
  `],
})
export class SpellTimeboxHudComponent implements OnChanges, OnDestroy {
  /** Activer/désactiver le HUD (true = visible et counter en cours) */
  @Input() active = false;
  /** Durée totale du timebox en secondes */
  @Input() durationS = 60;
  /** Nom de la cérémonie/room (ex: "Lean Coffee", "Sprint Planning") */
  @Input() ceremonyName = '';
  /** Couleur d'accent (matche celui de la room/island) */
  @Input() accent = '#d54adf';

  /** Émis quand le countdown atteint 0 */
  @Output() timeUp = new EventEmitter<void>();
  /** Émis quand l'utilisateur clique ✕ Terminer */
  @Output() close = new EventEmitter<void>();
  /** Émis quand l'utilisateur clique ↺ Replay */
  @Output() replay = new EventEmitter<void>();

  // ─── State du timer ───
  private remaining = signal<number>(0);
  private timerId: any = null;
  /** True si le countdown est en pause */
  paused = signal<boolean>(false);

  // Constants pour l'anneau SVG (circumference = 2 * PI * r où r=44)
  readonly circumference = 2 * Math.PI * 44;

  /** Offset du dasharray pour faire diminuer l'anneau (legacy SVG) */
  dashOffset = computed(() => {
    const pct = this.remaining() / Math.max(1, this.durationS);
    return this.circumference * (1 - pct);
  });

  /** Pourcentage de progression de la barre linéaire (100% au départ, 0% à la fin) */
  progressPct = computed(() => {
    return Math.max(0, Math.min(100, (this.remaining() / Math.max(1, this.durationS)) * 100));
  });

  /** Label "MM:SS" formaté */
  timeLabel = computed(() => {
    const s = Math.max(0, Math.ceil(this.remaining()));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  });

  /** Mode danger quand il reste < 10s */
  isDanger = computed(() => this.remaining() <= 10 && this.remaining() > 0);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active']) {
      if (this.active) this.start();
      else this.stop();
    }
    if (changes['durationS'] && this.active) {
      this.remaining.set(this.durationS);
    }
  }

  ngOnDestroy(): void { this.stop(); }

  private start(): void {
    this.stop();
    this.remaining.set(this.durationS);
    this.paused.set(false);
    this.tick();
  }

  private tick(): void {
    if (this.timerId) clearInterval(this.timerId);
    const tickMs = 100;
    this.timerId = setInterval(() => {
      if (this.paused()) return;        // figé en pause
      const next = this.remaining() - tickMs / 1000;
      if (next <= 0) {
        this.remaining.set(0);
        this.stop();
        this.timeUp.emit();
      } else {
        this.remaining.set(next);
      }
    }, tickMs);
  }

  private stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /** ⏸ / ▶ — bascule pause/resume du countdown sans le fermer */
  togglePause(): void {
    this.paused.update(v => !v);
  }

  /** ↺ — recommence le timer du début (remaining = durationS) sans le fermer */
  doReplay(): void {
    this.remaining.set(this.durationS);
    this.paused.set(false);
    this.tick();
    this.replay.emit();
  }

  /** ✕ — termine immédiatement le timer + émet l'event close pour que le parent désactive le mode */
  doClose(): void {
    this.stop();
    this.paused.set(false);
    this.close.emit();
  }
}
