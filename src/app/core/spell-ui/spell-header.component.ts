// ════════════════════════════════════════════════════════════════════
// 🪄 SPELL HEADER — Header unifié spell-caster pour TOUT Yamzy World
//
// Header transparent flottant avec :
//   • Logo Yamzy World à gauche (clic = home)
//   • Breadcrumb central : Page 1 > Page 2 > Page 3 (clic = nav)
//   • Boutons Back + Quitter à droite (style spell-caster, ignition)
//
// Inputs :
//   • crumbs?   : Array<{label, route?}> — fil d'ariane (auto si vide)
//   • backTo?   : route pour le bouton retour (default = parent crumb)
//   • showQuit? : afficher le bouton ✕ Quitter (default true)
//   • accent?   : couleur d'accent (default #d54adf magenta crystal)
//
// USAGE simple :
//   <wt-spell-header [crumbs]="[{label:'Yamzy World', route:'/welcome'},
//                               {label:'Yamzy Island', route:'/yamzy-island'}]" />
// ════════════════════════════════════════════════════════════════════
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

export interface SpellCrumb {
  label: string;
  route?: string;
  icon?: string;
}

@Component({
  selector: 'wt-spell-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,   // styles globaux pour traverser app-root + bypass any stacking context
  template: `
    <header class="shd-host" [style.--accent]="accent">
      <!-- ─── 🔙 Back button SVG icon (tout à gauche, AVANT le breadcrumb) ─── -->
      <button *ngIf="backTo || backRoute()"
              class="shd-back-icon"
              [class.is-igniting]="igniting() === 'back'"
              (click)="onBack()"
              type="button"
              title="Retour à la page précédente"
              aria-label="Retour">
        <svg viewBox="0 0 384.97 384.97" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Circle -->
          <path d="M192.485,0C86.185,0,0,86.185,0,192.485C0,298.797,86.173,384.97,192.485,384.97S384.97,298.797,384.97,192.485 C384.97,86.185,298.797,0,192.485,0z M192.485,361.282c-92.874,0-168.424-75.923-168.424-168.797S99.611,24.061,192.485,24.061 s168.424,75.55,168.424,168.424S285.359,361.282,192.485,361.282z"/>
          <!-- Chevron left -->
          <path d="M235.878,99.876c-4.704-4.74-12.319-4.74-17.011,0l-83.009,84.2c-4.572,4.62-4.584,12.56,0,17.191l82.997,84.2 c4.704,4.74,12.319,4.74,17.011,0c4.704-4.752,4.704-12.439,0-17.191l-74.528-75.61l74.54-75.61 C240.57,112.315,240.57,104.628,235.878,99.876z"/>
        </svg>
      </button>

      <!-- ─── Breadcrumb (caché si 1 seul crumb, sans icônes pour ne pas cacher la scène) ─── -->
      <nav class="shd-breadcrumb" *ngIf="crumbs && crumbs.length > 1">
        <ng-container *ngFor="let c of crumbs; let i = index; let last = last">
          <a *ngIf="c.route && !last"
             [routerLink]="c.route"
             class="shd-crumb"
             [title]="'Aller à ' + c.label">{{ c.label }}</a>
          <span *ngIf="!c.route || last" class="shd-crumb is-current">{{ c.label }}</span>
          <span *ngIf="!last" class="shd-sep">›</span>
        </ng-container>
      </nav>

      <!-- ─── Actions droite : Quit icon SVG (sans box, comme le back) ─── -->
      <div class="shd-actions">
        <button *ngIf="showQuit"
                class="shd-quit-icon"
                [class.is-igniting]="igniting() === 'quit'"
                (click)="onQuit()"
                type="button"
                title="Quitter vers l'accueil Yamzy World"
                aria-label="Quitter">
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <!-- Stick rectangles (pôle de la pancarte) -->
            <rect x="193.857" y="95.902" transform="matrix(-0.7071 -0.7071 0.7071 -0.7071 234.6735 414.1124)"
                  fill="currentColor" opacity="0.45" width="18.49" height="125.104"/>
            <rect x="247.076" y="149.209" transform="matrix(-0.7071 -0.7071 0.7071 -0.7071 416.523 489.4382)"
                  fill="currentColor" opacity="0.45" width="125.104" height="18.49"/>
            <!-- Cercle ampoule (lumière haut) -->
            <circle fill="currentColor" opacity="0.8" cx="256.003" cy="109.907" r="23.458"/>
            <!-- Pancarte EXIT (corps — pancarte VIDE, le texte "EXIT" est CSS overlay) -->
            <path fill="currentColor" opacity="0.85"
                  d="M485.252,425.551H26.748C11.975,425.551,0,413.575,0,398.803V224.446 c0-14.772,11.975-26.748,26.748-26.748h458.504c14.772,0,26.748,11.975,26.748,26.748v174.358 C512,413.575,500.025,425.551,485.252,425.551z"/>
          </svg>
          <!-- "EXIT" en CSS overlay sur la pancarte (animé : blink discret + pulse au hover) -->
          <span class="shd-quit-text" aria-hidden="true">EXIT</span>
        </button>
      </div>
    </header>
  `,
  styles: [`
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    /* ViewEncapsulation: None → styles globaux. On cible explicitement le tag. */
    wt-spell-header {
      display: block !important;
      position: fixed !important;
      top: 0 !important; left: 0 !important; right: 0 !important;
      width: 100vw !important;
      height: 60px !important;
      z-index: 10500 !important;
      pointer-events: none !important;
      --accent: #d54adf;
    }
    wt-spell-header .shd-host {
      pointer-events: none;       /* le host laisse passer les clics — */
      display: flex;
      align-items: center;
      justify-content: flex-start;  /* le back-icon est en premier (gauche) */
      gap: 16px;
      padding: 12px clamp(16px, 3vmin, 32px);
      background: transparent;
      font-family: "Tinos", serif;
      color: #fff;
      text-shadow: 0 2px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9);
      height: 60px;
      box-sizing: border-box;
    }
    /* — sauf les zones interactives (back-icon + breadcrumb + boutons) */
    wt-spell-header .shd-back-icon,
    wt-spell-header .shd-breadcrumb,
    wt-spell-header .shd-actions { pointer-events: auto; }

    /* 🔙 Back icon SVG button — juste l'icône, pas de box (pas de bordure ni de fond) */
    wt-spell-header .shd-back-icon {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      background: transparent;
      border: none;
      color: #fff;             /* SVG blanc par défaut (currentColor) */
      cursor: pointer;
      transition: color 0.25s ease, transform 0.25s ease, filter 0.25s ease;
      overflow: visible;
      flex-shrink: 0;
    }
    wt-spell-header .shd-back-icon svg {
      width: 38px;
      height: 38px;
      transition: transform 0.25s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.9));
      /* L'icône pointe DÉJÀ vers la gauche (chevron left circle), pas besoin de scaleX(-1) */
    }
    /* Hover : l'icône passe du blanc à la couleur de la room (accent) + léger swipe gauche */
    wt-spell-header .shd-back-icon:hover {
      color: var(--accent);    /* le currentColor du SVG suit cette couleur */
      filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 70%, transparent));
    }
    wt-spell-header .shd-back-icon:hover svg {
      transform: translateX(-3px);   /* léger swipe gauche au hover */
    }
    wt-spell-header .shd-back-icon:active {
      transform: scale(0.92);
    }
    /* Ignition click anim (sans box, l'anim glow est portée par le filter du SVG) */
    wt-spell-header .shd-back-icon.is-igniting {
      animation: shdBackIgnite 0.55s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }
    @keyframes shdBackIgnite {
      0%   { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
      40%  { transform: scale(1.15); }
      100% { transform: scale(1); }
    }

    /* ═══ LOGO ═══ */
    .shd-logo {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none;
      color: #fff;
      font-family: "Henny Penny", cursive;
      font-size: clamp(18px, 2.4vmin, 24px);
      letter-spacing: 0.02em;
      transition: all 0.25s ease;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .shd-logo:hover {
      color: var(--accent);
      text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 70%, transparent);
    }
    .shd-logo-glyph {
      font-size: 1.4em;
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 60%, transparent));
    }
    .shd-logo-accent { color: var(--accent); margin-left: 0.2em; }

    /* BREADCRUMB - Henny Penny + glow magenta avec !important pour battre le global Tinos */
    wt-spell-header .shd-breadcrumb {
      display: flex; align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      font-family: "Henny Penny", cursive !important;
      font-weight: 400 !important;
      font-size: clamp(18px, 3vmin, 28px) !important;
      letter-spacing: 0.02em !important;
      text-transform: none !important;
      margin-right: auto;
    }
    /* TOUS les crumbs (current ET non-current) : style identique */
    wt-spell-header .shd-crumb,
    wt-spell-header a.shd-crumb,
    wt-spell-header span.shd-crumb {
      color: #fff !important;
      text-decoration: none !important;
      padding: 2px 8px;
      border-radius: 4px;
      transition: all 0.25s ease;
      font-family: "Henny Penny", cursive !important;
      font-weight: 400 !important;
      font-size: clamp(18px, 3vmin, 28px) !important;
      letter-spacing: 0.02em !important;
      text-transform: none !important;
      display: inline-flex;
      align-items: center;
      text-shadow: 0 0 30px color-mix(in srgb, var(--accent) 55%, transparent),
                   0 0 70px color-mix(in srgb, var(--accent) 30%, transparent),
                   0 2px 6px rgba(0,0,0,0.9) !important;
    }
    wt-spell-header .shd-crumb:hover,
    wt-spell-header a.shd-crumb:hover {
      color: #fff !important;
      background: rgba(213, 74, 223, 0.12);
      text-shadow: 0 0 36px color-mix(in srgb, var(--accent) 75%, transparent),
                   0 0 80px color-mix(in srgb, var(--accent) 45%, transparent),
                   0 2px 6px rgba(0,0,0,0.9) !important;
    }
    wt-spell-header .shd-crumb.is-current { cursor: default; }
    wt-spell-header .shd-crumb.is-current:hover { background: transparent; }
    wt-spell-header .shd-sep {
      color: rgba(255,255,255,0.5) !important;
      font-family: "Henny Penny", cursive !important;
      font-size: 1em !important;
      user-select: none;
      text-shadow: 0 2px 6px rgba(0,0,0,0.9) !important;
    }

    /* ═══ ACTIONS (Quit uniquement — back est déplacé à gauche) ═══ */
    .shd-actions {
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
      margin-left: auto;   /* pousse Quit à droite même si breadcrumb caché */
    }

    /* 🚪 Quit icon SVG button — juste l'icône EXIT, pas de box (cohérent avec back) */
    wt-spell-header .shd-quit-icon {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      padding: 0;
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      transition: color 0.25s ease, transform 0.25s ease, filter 0.25s ease;
      overflow: visible;
      flex-shrink: 0;
    }
    wt-spell-header .shd-quit-icon svg {
      width: 42px;
      height: 42px;
      transition: transform 0.25s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.9));
    }
    wt-spell-header .shd-quit-icon:hover {
      color: #ec5e4e;   /* danger — currentColor du SVG suit cette teinte */
      filter: drop-shadow(0 0 10px rgba(236, 94, 78, 0.7));
    }
    wt-spell-header .shd-quit-icon:hover svg {
      transform: translateX(3px) rotate(2deg);
    }
    wt-spell-header .shd-quit-icon:active {
      transform: scale(0.92);
    }
    wt-spell-header .shd-quit-icon.is-igniting {
      animation: shdQuitIgnite 0.55s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }
    @keyframes shdQuitIgnite {
      0%   { transform: scale(1) rotate(0); }
      40%  { transform: scale(1.18) rotate(8deg); }
      100% { transform: scale(1) rotate(0); }
    }

    /* ━━━ Texte "EXIT" overlay CSS sur la pancarte SVG ━━━
       Positionné précisément sur le corps de la pancarte (y=197→425 sur viewBox 512)
       Centre du sign = 60.85% depuis le haut du SVG */
    wt-spell-header .shd-quit-text {
      position: absolute;
      top: 61%;                                  /* centre du sign rectangle */
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: "Tinos", "Trebuchet MS", serif;
      font-weight: 900;
      font-size: 9px;
      letter-spacing: 0.12em;
      color: #fff;                               /* toujours blanc — lettres EXIT lisibles */
      text-shadow: 0 0 3px rgba(255,255,255,0.5), 0 1px 1px rgba(0,0,0,0.5);
      pointer-events: none;                      /* clic passe au bouton parent */
      white-space: nowrap;
      line-height: 1;
      /* Idle : blink discret comme une vraie enseigne de sortie */
      animation: shdExitBlink 4s ease-in-out infinite;
    }
    @keyframes shdExitBlink {
      0%, 88%, 100% {
        opacity: 1;
        text-shadow: 0 0 3px rgba(255,255,255,0.5), 0 1px 1px rgba(0,0,0,0.5);
      }
      90%, 94% {
        opacity: 0.35;
        text-shadow: 0 0 1px rgba(255,255,255,0.25);
      }
      92% {
        opacity: 1;
        text-shadow: 0 0 5px rgba(255,255,255,0.7);
      }
    }
    /* Hover : pulse + glow blanc intense (comme si on activait la sortie) */
    wt-spell-header .shd-quit-icon:hover .shd-quit-text {
      animation: shdExitPulse 0.7s ease-in-out infinite alternate;
      text-shadow:
        0 0 6px rgba(255,255,255,1),
        0 0 12px rgba(255,255,255,0.7),
        0 0 18px rgba(255,255,255,0.4);
    }
    @keyframes shdExitPulse {
      from {
        transform: translate(-50%, -50%) scale(1);
        letter-spacing: 0.12em;
      }
      to {
        transform: translate(-50%, -50%) scale(1.08);
        letter-spacing: 0.16em;
      }
    }
    /* Clic ignition : flash blanc puis revient */
    wt-spell-header .shd-quit-icon.is-igniting .shd-quit-text {
      animation: shdExitFlash 0.55s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes shdExitFlash {
      0%   { opacity: 1; text-shadow: 0 0 3px rgba(255,255,255,0.5); }
      30%  { opacity: 1; text-shadow: 0 0 12px rgba(255,255,255,1), 0 0 20px rgba(255,255,255,0.8); }
      60%  { opacity: 0.6; text-shadow: 0 0 4px rgba(255,255,255,0.4); }
      100% { opacity: 1; text-shadow: 0 0 3px rgba(255,255,255,0.5); }
    }
    .shd-btn {
      position: relative;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.65);
      border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
      border-radius: 6px;
      color: #fff;
      font-family: "Tinos", serif;
      font-size: clamp(13px, 1.7vmin, 15px);
      cursor: pointer;
      transition: all 0.25s ease;
      overflow: hidden;
      backdrop-filter: blur(4px);
    }
    .shd-btn-glow {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 120%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 60%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .shd-btn:hover {
      border-color: var(--accent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent);
      transform: translateY(-1px);
      color: var(--accent);
    }
    .shd-btn:hover .shd-btn-glow { opacity: 1; }
    .shd-btn-icon { font-size: 1.1em; font-weight: 700; }
    .shd-btn-label { letter-spacing: 0.05em; }

    /* Variant Quit : tonalité subtilement rouge-magenta */
    .shd-quit {
      border-color: color-mix(in srgb, #c0392b 30%, #555);
    }
    .shd-quit:hover {
      border-color: #ec5e4e;
      box-shadow: 0 0 16px rgba(236, 94, 78, 0.45);
      color: #ec5e4e;
    }

    /* ─── Ignition click anim (spell-caster crystal burst) ─── */
    .shd-btn.is-igniting {
      animation: shdIgnite 0.55s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }
    .shd-btn.is-igniting .shd-btn-glow {
      opacity: 1;
      animation: shdGlowExpand 0.55s ease-out;
    }
    @keyframes shdIgnite {
      0%   { transform: scale(1); box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent); }
      40%  { transform: scale(1.08); box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 80%, transparent), 0 0 90px color-mix(in srgb, var(--accent) 40%, transparent); }
      100% { transform: scale(1); }
    }
    @keyframes shdGlowExpand {
      0%   { transform: scale(0.4); opacity: 0; }
      50%  { transform: scale(2.5); opacity: 1; }
      100% { transform: scale(4); opacity: 0; }
    }

    /* Responsive : labels cachés sur petits écrans */
    @media (max-width: 720px) {
      .shd-btn-label { display: none; }
      .shd-btn { padding: 8px 12px; }
      .shd-breadcrumb { font-size: 11px; gap: 6px; }
    }
  `],
})
export class SpellHeaderComponent {
  @Input() crumbs: SpellCrumb[] = [];
  @Input() backTo: string | null = null;
  @Input() showQuit = true;
  @Input() accent = '#d54adf';
  @Output() back = new EventEmitter<void>();
  @Output() quit = new EventEmitter<void>();

  igniting = signal<string | null>(null);

  constructor(private router: Router) {}

  /** Calcule la route back par défaut : avant-dernier crumb si pas explicite. */
  backRoute(): string | null {
    if (this.backTo) return this.backTo;
    if (this.crumbs.length >= 2) {
      const parent = this.crumbs[this.crumbs.length - 2];
      return parent.route || null;
    }
    return null;
  }

  onBack(): void {
    if (this.igniting()) return;
    this.igniting.set('back');
    setTimeout(() => {
      this.igniting.set(null);
      this.back.emit();
      const route = this.backRoute();
      if (route) this.router.navigate([route]);
      else window.history.back();
    }, 480);
  }

  onQuit(): void {
    if (this.igniting()) return;
    this.igniting.set('quit');
    setTimeout(() => {
      this.igniting.set(null);
      this.quit.emit();
      this.router.navigate(['/chez-yamzy']);
    }, 480);
  }
}
