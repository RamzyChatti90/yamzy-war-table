// ═══════════════════════════════════════════════════════════════════
// Stat Shield — COPIE 1:1 du CodePen original (animation + visuel + structure)
// + adaptation Angular pour passer value/label en @Input.
//
// Tout est en CSS pur fidèle au source :
//   • Float anim (4.5s infinite, transform 3D complexe)
//   • Border-radius shield shape (rounded top, pointy bottom)
//   • :before clip-path bottom-left triangle, slide-in on :checked
//   • :after clip-path top triangle, slide-in on :checked
//   • Transition: all 144ms cubic-bezier(0.390, 0.575, 0.565, 1.000)
//
// Aucune SVG, aucun canvas, aucune anim JS — strictement CSS comme CodePen.
// ═══════════════════════════════════════════════════════════════════

import {
  ChangeDetectionStrategy, Component, HostBinding, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'wt-stat-shield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="shield-host">
      <input type="checkbox"
             class="control"
             [id]="controlId"
             [checked]="isActive"
             (change)="onToggleChange($event)">
      <label class="shield"
             [attr.for]="controlId"
             [attr.data-value]="value"
             [attr.data-label]="labelUpper">
      </label>
      <!-- DIV overlay du CodePen — affiche le label au repos, fade out au click -->
      <div class="shield-overlay" [attr.data-text]="labelUpper"></div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 100%;
      height: 100%;
      font-family: 'Exo 2', 'Poppins', sans-serif;
      font-weight: 700;
    }

    /* ═══ COPIE 1:1 DU CODEPEN ═══ */
    .shield-host {
      position: relative;
      width: 100%;
      height: 100%;
      perspective: 144px;
      perspective-origin: bottom;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    *,
    *:before,
    *:after {
      -webkit-tap-highlight-color: rgba(255, 255, 255, 0);
    }

    .shield,
    .shield:before,
    .shield:after {
      display: block;
      border-radius: 10% 10% 50% 50% / 10% 10% 90% 90%;
      background: #000;
      width: 100%;
      height: 100%;
      position: absolute;
      cursor: pointer;
      will-change: background;
      transform-style: preserve-3d;
      outline: 1px solid transparent;
    }

    .shield {
      animation: float 4.5s cubic-bezier(0.390, 0.575, 0.565, 1.000) infinite;
      /* Couleur ROUGE de la carte (au lieu du bleu CodePen) */
      background: linear-gradient(to top, rgba(192, 57, 43, 1) 0%, rgba(192, 57, 43, .13) 100%);
    }

    @keyframes float {
      0% { transform: none; }
      50% {
        transform: translate3d(-1%, -3%, 0) scaleX(1.02) scaleY(.98)
                   skewY(-2deg) rotateX(-1deg) rotateY(1deg) rotateZ(-1deg);
      }
    }

    .control:checked + .shield {
      background: linear-gradient(to bottom, rgba(192, 57, 43, .34) 0%, rgba(192, 57, 43, 0.67) 55%);
    }

    .shield:before {
      content: '';
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      -webkit-clip-path: polygon(0 0, 50% 50%, 50% 100%, 0 100%);
              clip-path: polygon(0 0, 50% 50%, 50% 100%, 0 100%);
      /* Offset RÉDUIT (CodePen original = -13%, 8%, scale .89, -3deg) — moins de mouvement */
      transform: translate3d(-4%, 3%, 0) scale(.96) rotateZ(-1deg);
      transition: all 144ms cubic-bezier(0.390, 0.575, 0.565, 1.000);
      /* Gradient DORÉ (gold de la King card) */
      background: linear-gradient(to top, rgba(230, 184, 90, .55) 0%, rgba(230, 184, 90, 1) 55%);
      text-align: left;
      line-height: 100%;
      color: #fff;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      /* SHIELD FERMÉ par défaut : triangles invisibles */
      opacity: 0;
    }

    .control:checked + .shield:before {
      transform: none;
      opacity: 1;
      transition-delay: 10ms;
      content: attr(data-value);
      font-size: 32px;
      font-weight: 900;
    }

    .shield:after {
      content: '';
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      -webkit-clip-path: polygon(50% 0%, 100% 0, 50% 50%, 0 0);
              clip-path: polygon(50% 0%, 100% 0, 50% 50%, 0 0);
      /* Offset RÉDUIT (CodePen original = -21%, scale .89, 3deg) — moins de mouvement */
      transform: translateY(-7%) scale(.96) rotateZ(1deg) rotateY(-1deg);
      transition: all 144ms cubic-bezier(0.390, 0.575, 0.565, 1.000);
      background: linear-gradient(to bottom, rgba(230, 184, 90, .89) 0%, rgba(230, 184, 90, 1) 89%);
      text-align: center;
      line-height: 55px;
      color: #fff;
      letter-spacing: .5px;
      font-style: italic;
      /* SHIELD FERMÉ par défaut : triangles invisibles */
      opacity: 0;
    }

    .control:checked + .shield:after {
      transform: none;
      opacity: 1;
      background: linear-gradient(to bottom, rgba(230, 184, 90, .89) 0%, rgba(230, 184, 90, .34) 100%);
      content: attr(data-label);
      font-size: 14px;
    }

    .control {
      display: none;
    }

    /* ═══ DIV overlay du CodePen (le <div></div> à côté du label) ═══
       Affiche le LABEL en grand au centre à l'init. Au :checked → fade out.
       Pattern : div:after { content: 'shield' } → ici contenu attr(data-text). */
    .shield-overlay {
      position: absolute;
      width: 100%;
      height: 100%;
      left: 0;
      top: 0;
      pointer-events: none;
      opacity: 1;
      z-index: 5;       /* au-dessus du label shield, sous les triangles :checked */
      transition: opacity 89ms cubic-bezier(0.390, 0.575, 0.565, 1.000);
    }
    .shield-overlay::after {
      content: attr(data-text);
      display: block;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      transform-style: preserve-3d;
      transition: all 144ms cubic-bezier(0.390, 0.575, 0.565, 1.000),
                  opacity 89ms cubic-bezier(0.390, 0.575, 0.565, 1.000);
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
    }
    /* :checked → le texte au centre s'efface (laisse place aux triangles + valeur) */
    .control:checked ~ .shield-overlay {
      opacity: 0;
    }
    .control:checked ~ .shield-overlay::after {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.6);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WtStatShieldComponent {
  @Input() value: string | number = '';
  @Input() label = '';

  /** ID unique pour associer input ↔ label (compteur global) */
  private static _idCounter = 0;
  controlId = 'stat-shield-ctrl-' + (++WtStatShieldComponent._idCounter);

  /** SHIELD FERMÉ par défaut. Le texte LABEL est visible. Au click → label
   *  fade out, triangles slide in avec VALEUR + LABEL. (pattern CodePen div). */
  @HostBinding('class.is-active') isActive = false;

  get labelUpper(): string {
    return (this.label || '').toUpperCase();
  }

  onToggleChange(e: Event) {
    this.isActive = (e.target as HTMLInputElement).checked;
    console.log('[SHIELD]', this.label, 'toggle → active=', this.isActive);
  }
}
