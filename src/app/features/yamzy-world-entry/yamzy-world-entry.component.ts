// ═══════════════════════════════════════════════════════════════════
// 🌍 YAMZY WORLD ENTRY — Splash & Voice-Guided Tour
//
// Pattern repris du Spell-Caster (xstate → onStateChange switch) mais
// allégé en signals Angular natifs :
//
//   IDLE → LOADING → SPLASH → TOUR → DONE
//
// SPLASH :
//   ─ Vue isométrique de l'île entière vue de loin (caméra haute)
//   ─ Titre "YAMZY WORLD" + sous-titre poétique
//   ─ 2 boutons : "▶ Lancer le conte" / "🌍 Entrer dans le monde"
//
// TOUR :
//   ─ Yamzy avatar (mignonne créature) apparaît avec bulle
//   ─ Pour chaque étape : voix-d'abord, puis animation 3D (caméra/scene)
//   ─ Le narrateur parle, on attend `onend`, puis on lance l'anim suivante
//
// Pas de nouveaux GLB — seul YAMZY.glb est réutilisé, et toute l'île
// est procédurale (cylindres + arbres + tours = design pur Three.js).
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { VoiceNarratorService, VoicePersona } from '../../core/voice-narrator/voice-narrator.service';
import { buildSkyOrnaments, SkyOrnamentsHandle } from '../../core/sky-ornaments/sky-ornaments';
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
import { SpellSoundsService } from '../../core/spell-sounds/spell-sounds.service';
import { YamzyAvatar3dComponent } from '../war-table/yamzy-avatar-3d.component';
import { SpellDayFlowComponent } from '../../core/spell-ui';
import { RoomExplorerService } from '../../core/explorer/room-explorer.service';

type EntryPhase = 'idle' | 'loading' | 'splash' | 'tour' | 'done' | 'map';

/**
 * Le conte = une suite de "pages" : chaque page a un texte vocal et
 * une fonction d'animation 3D qui se joue APRÈS la fin de la voix.
 */
interface ConteStep {
  text: string;
  animate: () => Promise<void>;
}

@Component({
  selector: 'wt-yamzy-world-entry',
  standalone: true,
  imports: [CommonModule, RouterLink, YamzyAvatar3dComponent, SpellDayFlowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ywe-app" [attr.data-state]="phase()" [style.--loaded]="loadingProgress() / 100">
      <!-- 🐦 Intro plein écran : île + mouette qui vole (en arrière-plan derrière le panneau) -->
      @if (showIntro()) {
        <canvas #introCanvas class="ywe-intro-canvas" [class.is-fading]="introFading()"></canvas>
      }

      <!-- ⏭ SKIP MOUETTE — saute l'anim mouette + fly-to-boat, lance directement le navigation boat -->
      @if (showIntro() && mouettePhase()) {
        <button type="button" class="ywe-intro-skip" (click)="onSkipMouette()">
          ⏭ Skip anim mouette
        </button>
      }

      <!-- 🌌 Canvas 3D (île + crystal + ciel) -->
      <canvas #canvas class="ywe-canvas"></canvas>



      <!-- ─── Screens (un par phase, contrôlés par data-state CSS) ─── -->
      <!-- ⚡ UI MASQUÉE — scène 3D pleine vue uniquement -->
      <div class="ywe-screens" style="display: none;">

        <!-- LOADING : Titre + barre fine magenta -->
        <div *ngIf="phase() === 'loading'" data-screen="LOADING" class="ywe-screen ywe-loading">
          <div class="ywe-content">
            <span>{{ loadingMessage() }}</span>
            <div class="ywe-loading-bar"></div>
          </div>
        </div>

        <!-- TITLE_SCREEN : h1 Yamzy World + menu catégorisé (3 piliers) -->
        <div *ngIf="phase() === 'splash'" data-screen="TITLE_SCREEN" class="ywe-screen ywe-title">
          <div class="ywe-content ywe-content-menu">
            <h1 data-fade>Yamzy<br/>World</h1>

            <!-- ═══ MENU PRINCIPAL — 3 catégories style spell-caster ═══ -->
            <div class="ywe-menu" data-fade>
              <!-- Catégorie 1 : Découvrir -->
              <section class="ywe-cat" data-cat="discover">
                <header class="ywe-cat-head">
                  <span class="ywe-cat-icon">🎭</span>
                  <h3 class="ywe-cat-title">Découvrir</h3>
                  <span class="ywe-cat-sub">Le conte du Mage</span>
                </header>
                <ul class="ywe-cat-torches">
                  <li>
                    <button class="ywe-torch ywe-torch-primary"
                            [class.is-igniting]="igniting() === 'tour'"
                            (click)="igniteThen('tour', startTour.bind(this))">
                      <span class="ywe-torch-flame">🔥</span>
                      <span class="ywe-torch-label">Lancer le conte</span>
                      <span class="ywe-torch-spark"></span>
                    </button>
                  </li>
                  <li>
                    <button class="ywe-torch"
                            [class.is-igniting]="igniting() === 'day'"
                            (click)="igniteThen('day', openDayDemo.bind(this))">
                      <span class="ywe-torch-flame">🔥</span>
                      <span class="ywe-torch-label">🌅 Journée Demo</span>
                      <span class="ywe-torch-spark"></span>
                    </button>
                  </li>
                </ul>
              </section>

              <!-- Catégorie 2 : Le Conclave -->
              <section class="ywe-cat" data-cat="conclave">
                <header class="ywe-cat-head">
                  <span class="ywe-cat-icon">⚔️</span>
                  <h3 class="ywe-cat-title">Le Conclave</h3>
                  <span class="ywe-cat-sub">Pilotage VESPER</span>
                </header>
                <ul class="ywe-cat-torches">
                  <li>
                    <button class="ywe-torch ywe-torch-primary"
                            [class.is-igniting]="igniting() === 'conclave'"
                            (click)="igniteThen('conclave', skipToConclave.bind(this))">
                      <span class="ywe-torch-flame">🔥</span>
                      <span class="ywe-torch-label">Conclave VESPER</span>
                      <span class="ywe-torch-spark"></span>
                    </button>
                  </li>
                  <li>
                    <button class="ywe-torch"
                            [class.is-igniting]="igniting() === 'showcase'"
                            (click)="igniteThen('showcase', goShowcase.bind(this))">
                      <span class="ywe-torch-flame">🔥</span>
                      <span class="ywe-torch-label">Vitrine du Mage</span>
                      <span class="ywe-torch-spark"></span>
                    </button>
                  </li>
                </ul>
              </section>

              <!-- Catégorie 3 : Explorer le monde -->
              <section class="ywe-cat" data-cat="world">
                <header class="ywe-cat-head">
                  <span class="ywe-cat-icon">🌍</span>
                  <h3 class="ywe-cat-title">Explorer</h3>
                  <span class="ywe-cat-sub">Île & Rooms</span>
                </header>
                <ul class="ywe-cat-torches">
                  <li>
                    <button class="ywe-torch ywe-torch-primary"
                            [class.is-igniting]="igniting() === 'enter'"
                            (click)="igniteThen('enter', enterWorld.bind(this))">
                      <span class="ywe-torch-flame">🔥</span>
                      <span class="ywe-torch-label">Entrer dans l'île</span>
                      <span class="ywe-torch-spark"></span>
                    </button>
                  </li>
                  <li>
                    <button class="ywe-torch"
                            [class.is-igniting]="igniting() === 'rooms'"
                            (click)="igniteThen('rooms', goRooms.bind(this))">
                      <span class="ywe-torch-flame">🔥</span>
                      <span class="ywe-torch-label">Yamzy Rooms</span>
                      <span class="ywe-torch-spark"></span>
                    </button>
                  </li>
                </ul>
              </section>
            </div>

            <!-- ═══ 🏝 PASSERELLE — Les 11 Rooms du Conclave ═══ -->
            <section class="ywe-rooms-passerelle" data-fade>
              <header class="ywe-pass-head">
                <span class="ywe-pass-icon">🏝</span>
                <h3 class="ywe-pass-title">Les Rooms du Conclave</h3>
                <span class="ywe-pass-sub">Entrée directe — choisis ta salle</span>
              </header>
              <div class="ywe-rooms-grid">
                <a *ngFor="let r of passerelleRooms" [routerLink]="r.route"
                   class="ywe-room-tile"
                   [style.--tile-accent]="r.color"
                   [title]="r.lore">
                  <span class="ywe-room-icon">{{ r.icon }}</span>
                  <span class="ywe-room-name">{{ r.name }}</span>
                </a>
              </div>
            </section>

            <!-- 🎙 Sélecteur de voix (compact, sous le menu) -->
            <ul class="ywe-button-row ywe-voice-row" data-fade>
              <li><button class="ywe-voice" [class.is-active]="voice.persona() === 'cute-creature'" (click)="pickVoice('cute-creature')">🐭 Mignonne</button></li>
              <li><button class="ywe-voice" [class.is-active]="voice.persona() === 'old-sage'" (click)="pickVoice('old-sage')">🧙 Vieux sage</button></li>
              <li><button class="ywe-voice" [class.is-active]="voice.persona() === 'enthusiastic-elf'" (click)="pickVoice('enthusiastic-elf')">🧚 Lutin</button></li>
              <li><button class="ywe-voice ywe-voice-test" (click)="testVoice()">🔊 Test</button></li>
            </ul>
          </div>
        </div>

        <!-- INSTRUCTIONS (le conte) : h3 + p + skip -->
        <div *ngIf="phase() === 'tour'" data-screen="INSTRUCTIONS" class="ywe-screen ywe-instructions">
          <div class="ywe-content">
            <h3 data-fade>{{ getStepTitle() }}</h3>
            <p data-fade class="ywe-speaking" [class.is-active]="voice.speaking()">{{ tourText() }}</p>
            <div class="ywe-step-meta">Page {{ tourIndex() + 1 }} / {{ totalSteps() }}</div>
            <button data-fade class="ywe-simple ywe-skip-btn" (click)="enterWorld()">Passer le conte ✕</button>
          </div>
        </div>

        <!-- DONE : h1 + bouton enter -->
        <div *ngIf="phase() === 'done'" data-screen="DONE" class="ywe-screen ywe-done">
          <div class="ywe-content">
            <h2 data-fade>Le conte<br/>est conté</h2>
            <button data-fade (click)="enterWorld()">Entrer dans le monde</button>
            <ul class="ywe-button-row">
              <li><button data-fade class="ywe-simple" (click)="phase.set('splash')">Recommencer</button></li>
            </ul>
          </div>
        </div>

      </div>

      <!-- 🌅 DAY FLOW : timeline d'une journée Scrum à travers les rooms -->
      <wt-spell-day-flow
        [open]="dayDemoOpen()"
        accent="#d54adf"
        (close)="dayDemoOpen.set(false)" />
    </div>
  `,
  styles: [`
    /* ═══ Spell-Caster DNA — fonts, palette, layout ═══ */
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      display:block;
      position:fixed;
      inset:0;
      --font-body: "Tinos", serif;
      --font-heading: "Henny Penny", cursive;
      --color-black: black;
      --color-black-alpha: rgba(0, 0, 0, 0.7);
      --color-white: white;
      --color-grey: #767474;
      --color-grey-dark: #3e3e3e;
      --color-crystal: #d54adf;
      --color-crystal-light: #d68ddc;
    }

    .ywe-app {
      position:relative; width:100%; height:100%;
      background-color: var(--color-black);
      color:#f9f9f9;
      font-family: var(--font-body);
      font-weight: 400;
      font-size: clamp(20px, 4vmin, 26px);
      line-height: 110%;
      overflow:hidden;
    }
    .ywe-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; z-index:1; }

    /* 🐦 Intro plein écran (mouette qui vole en arrière-plan derrière le panneau) */
    .ywe-intro-canvas {
      position: fixed; inset: 0;
      width: 100vw; height: 100vh;
      display: block;
      z-index: 3;            /* sous le panneau (.ywe-screens à z-index 5) mais au-dessus du main canvas (1) */
      background: #050618;
      transition: opacity 1.2s ease;
      opacity: 1;
    }
    .ywe-intro-canvas.is-fading { opacity: 0; pointer-events: none; }
    .ywe-intro-skip {
      position: fixed;
      bottom: 32px;
      right: 32px;
      z-index: 10000;
      background: rgba(0,0,0,0.55);
      color: #fff;
      border: 1px solid rgba(213,74,223,0.55);
      padding: 8px 18px;
      border-radius: 8px;
      font-family: "Tinos", serif;
      font-size: 14px;
      letter-spacing: 0.1em;
      cursor: pointer;
      backdrop-filter: blur(6px);
      transition: all 0.2s ease;
    }
    .ywe-intro-skip:hover {
      background: rgba(213,74,223,0.25);
      border-color: #d54adf;
      box-shadow: 0 0 12px rgba(213,74,223,0.5);
    }
    /* Variante "Entrer dans le Conclave" — plus grand, magenta plein, glow pulse */
    .ywe-intro-enter {
      font-size: 16px;
      padding: 12px 28px;
      background: linear-gradient(135deg, rgba(213,74,223,0.45), rgba(170,40,180,0.55));
      border: 2px solid #d54adf;
      color: #fff;
      letter-spacing: 0.18em;
      animation: yweIntroEnterPulse 1.8s ease-in-out infinite;
      box-shadow: 0 0 18px rgba(213,74,223,0.55);
    }
    @keyframes yweIntroEnterPulse {
      0%, 100% { box-shadow: 0 0 14px rgba(213,74,223,0.45); transform: translateY(0); }
      50%      { box-shadow: 0 0 28px rgba(213,74,223,0.85); transform: translateY(-2px); }
    }
    /* Hint texte au centre-bas — pointer-events: none pour ne pas bloquer les drags */
    .ywe-intro-hint {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      color: #fff;
      font-family: "Tinos", serif;
      font-size: 14px;
      letter-spacing: 0.08em;
      background: rgba(0,0,0,0.6);
      padding: 8px 18px;
      border-radius: 6px;
      border: 1px solid rgba(213,74,223,0.4);
      backdrop-filter: blur(6px);
      animation: yweIntroHintFadeIn 0.6s ease-out;
      pointer-events: none;          /* ne bloque ni clic ni wheel */
      user-select: none;
    }
    @keyframes yweIntroHintFadeIn {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }

    /* ─── Screens overlay ─── */
    .ywe-screens {
      position:absolute; inset:0; z-index:5;
    }
    /* En mode intro + exploration : passe par-dessus le canvas intro (z-index 9999) */
    .ywe-screens.is-intro-overlay {
      z-index: 10005;
      pointer-events: auto;
      display:grid;
      grid-template-areas: "content";
      pointer-events:none;
    }
    .ywe-screen {
      grid-area:content;
      display:flex; align-items:center; justify-content:center;
      padding:0 5vmin;
      pointer-events:none;
    }
    .ywe-content {
      text-align:center;
      display:flex; align-items:center; justify-content:center; flex-direction:column;
      pointer-events:auto;
      max-width:850px;
    }
    .ywe-content > *:not(:last-child) { margin-bottom: clamp(20px, 5vmin, 50px); }

    /* ─── Typo : Henny Penny pour h1/h2/h3 ─── */
    h1, h2, h3, h4 { font-family: var(--font-heading); font-weight:400; margin:0; line-height:1; color:#fff; }
    h1 { font-size: clamp(30px, 14vmin, 130px); }
    h2 { font-size: clamp(30px, 11vmin, 100px); }
    h3 { font-size: clamp(24px, 6.5vmin, 60px); }
    p { max-width:600px; margin:0; font-family: var(--font-body); }

    /* ─── Boutons style spell-caster ─── */
    button {
      color: var(--color-white); pointer-events:all; cursor:pointer;
      font-family: var(--font-body); font-weight:400;
    }
    button:not(.ywe-simple) {
      --border-color: var(--color-grey);
      background-color: var(--color-black-alpha);
      border: 2px solid var(--border-color);
      font-size: 30px;
      padding: 0.2em 1.4em;
    }
    button:not(.ywe-simple):hover, button:not(.ywe-simple):active {
      --border-color: var(--color-crystal);
    }
    button.ywe-simple {
      background:transparent; border:none;
      text-decoration: underline;
      text-decoration-color: var(--color-grey);
      text-decoration-thickness: 2px;
      text-underline-offset: 5px;
      font-size: 20px;
      padding:0;
    }
    button.ywe-simple:hover {
      text-decoration-color: var(--color-crystal);
      color: var(--color-crystal-light);
    }

    /* ─── Button-row (ligne horizontale d'actions secondaires) ─── */
    .ywe-button-row {
      list-style:none; margin:0; padding:0;
      display:flex; flex-direction:row; gap:0.7em; flex-wrap:wrap; justify-content:center;
    }

    /* ─── Sélecteur de voix (button-row spécifique) ─── */
    .ywe-voice-row { margin-top: 0.5em; }
    .ywe-voice {
      background:transparent !important;
      border: 2px solid var(--color-grey-dark) !important;
      font-size: 18px !important;
      padding: 0.1em 0.8em !important;
      color: var(--color-white);
      transition: all 0.2s ease;
    }
    .ywe-voice:hover { border-color: var(--color-crystal) !important; }
    .ywe-voice.is-active {
      border-color: var(--color-crystal) !important;
      color: var(--color-crystal-light);
      background-color: rgba(213, 74, 223, 0.12) !important;
      box-shadow: 0 0 12px rgba(213, 74, 223, 0.3);
    }
    .ywe-voice-test { border-color: var(--color-crystal-light) !important; color: var(--color-crystal-light); }

    /* ─── Loading bar : très fine, magenta cristal ─── */
    .ywe-loading-bar {
      width:260px; height:2px;
      background-color: var(--color-grey-dark);
      overflow:hidden; position:relative;
    }
    .ywe-loading-bar::after {
      content:""; position:absolute; inset:0;
      background-color: var(--color-crystal);
      transform-origin: left center;
      transform: scaleX(var(--loaded, 0));
      transition: transform 0.3s ease-out;
    }
    .ywe-loading .ywe-content span { font-size:18px; opacity:0.8; letter-spacing:1px; }

    /* ─── Instructions screen (le conte) ─── */
    .ywe-instructions .ywe-content { max-width:780px; }
    .ywe-instructions p {
      font-size: clamp(18px, 2.6vmin, 26px);
      line-height: 1.4;
      transition: color 0.3s ease;
    }
    .ywe-speaking.is-active { color: var(--color-crystal-light); text-shadow: 0 0 16px rgba(213, 74, 223, 0.4); }
    .ywe-step-meta { font-size:14px; opacity:0.5; letter-spacing:2px; font-variant-numeric: tabular-nums; }
    .ywe-skip-btn { margin-top: 1.5em; }

    /* 🌅 Day Demo button — accent magenta crystal pour le faire ressortir */
    .ywe-day-btn {
      color: var(--color-crystal-light) !important;
      text-decoration-color: var(--color-crystal) !important;
      font-weight: 700;
      text-shadow: 0 0 18px rgba(213, 74, 223, 0.55);
    }
    .ywe-day-btn:hover {
      text-decoration-color: var(--color-crystal-light) !important;
      text-shadow: 0 0 28px rgba(213, 74, 223, 0.85);
    }

    /* ═══ 🔥 SPELL-CASTER TORCH BUTTONS ═══
       Chaque bouton = une torche du Conclave. Hover = flamme s'embrase
       et grandit. Click = ignition crystal-burst (sparks + glow expand). */
    .ywe-torches { gap: 1.2em; }
    .ywe-torch {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      padding: 0.45em 1.1em !important;
      border: 1px solid color-mix(in srgb, var(--color-crystal) 45%, transparent) !important;
      border-radius: 0 !important;
      background-color: rgba(0, 0, 0, 0.6) !important;
      backdrop-filter: blur(4px);
      text-decoration: none !important;
      color: var(--color-white) !important;
      font-size: 18px !important;
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
      font-family: var(--font-body);
      cursor: pointer;
      transition: all 0.28s ease;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(213,74,223,0.08),
                  inset 0 -1px 6px rgba(213,74,223,0.08);
    }
    .ywe-torch::before {
      /* Halo crystal au repos (très subtil) */
      content: ""; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 110%, rgba(213,74,223,0.25), transparent 60%);
      opacity: 0.35;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .ywe-torch-flame {
      display: inline-block;
      font-size: 0.85em;
      opacity: 0.35;
      filter: saturate(0.4) brightness(0.7);
      transform-origin: 50% 100%;
      transition: all 0.28s ease;
      text-shadow: 0 0 0 transparent;
    }
    .ywe-torch-label {
      letter-spacing: 0.04em;
      transition: text-shadow 0.28s ease;
    }
    .ywe-torch-spark {
      position: absolute; top: -2px; right: -2px;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--color-crystal-light);
      opacity: 0;
      box-shadow: 0 0 8px var(--color-crystal), 0 0 18px var(--color-crystal-light);
      pointer-events: none;
    }
    /* ─── HOVER : la torche s'embrase ─── */
    .ywe-torch:hover {
      border-color: var(--color-crystal) !important;
      box-shadow: 0 0 18px rgba(213,74,223,0.35),
                  inset 0 -2px 16px rgba(213,74,223,0.25);
      transform: translateY(-2px);
    }
    .ywe-torch:hover::before { opacity: 0.9; }
    .ywe-torch:hover .ywe-torch-flame {
      opacity: 1;
      filter: saturate(1.5) brightness(1.3);
      animation: ywe-flame-flicker 1.2s ease-in-out infinite alternate;
      text-shadow: 0 0 12px rgba(213,74,223,0.7), 0 0 24px rgba(213,74,223,0.45);
    }
    .ywe-torch:hover .ywe-torch-label {
      text-shadow: 0 0 14px rgba(213,74,223,0.75);
      color: var(--color-crystal-light);
    }
    @keyframes ywe-flame-flicker {
      0%   { transform: scale(1) skewX(-2deg); }
      25%  { transform: scale(1.1, 1.15) skewX(3deg); }
      55%  { transform: scale(0.95, 1.2) skewX(-1deg); }
      80%  { transform: scale(1.05, 1.1) skewX(2deg); }
      100% { transform: scale(1) skewX(0); }
    }

    /* ─── CLICK : Ignition crystal burst ─── */
    .ywe-torch.is-igniting {
      border-color: var(--color-crystal-light) !important;
      animation: ywe-torch-ignite 0.7s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }
    .ywe-torch.is-igniting::before {
      opacity: 1;
      background: radial-gradient(ellipse at 50% 50%, rgba(213,74,223,0.85), rgba(213,74,223,0.35) 35%, transparent 70%);
      animation: ywe-torch-halo-expand 0.7s ease-out;
    }
    .ywe-torch.is-igniting .ywe-torch-flame {
      opacity: 1;
      filter: saturate(2) brightness(1.6);
      animation: ywe-flame-burst 0.7s cubic-bezier(0.16, 1, 0.3, 1);
      text-shadow: 0 0 22px rgba(213,74,223,1), 0 0 45px rgba(213,74,223,0.8);
    }
    .ywe-torch.is-igniting .ywe-torch-label {
      color: #fff !important;
      text-shadow: 0 0 18px rgba(213,74,223,1), 0 0 35px rgba(213,74,223,0.7);
      animation: ywe-label-flash 0.7s ease-out;
    }
    .ywe-torch.is-igniting .ywe-torch-spark {
      animation: ywe-spark-burst 0.6s ease-out;
    }
    @keyframes ywe-torch-ignite {
      0%   { transform: scale(1); box-shadow: 0 0 18px rgba(213,74,223,0.35); }
      35%  { transform: scale(1.06); box-shadow: 0 0 60px rgba(213,74,223,0.95), 0 0 120px rgba(213,74,223,0.5); }
      75%  { transform: scale(1.02); }
      100% { transform: scale(1); box-shadow: 0 0 32px rgba(213,74,223,0.55); }
    }
    @keyframes ywe-torch-halo-expand {
      0%   { transform: scale(0.3); opacity: 0; }
      40%  { transform: scale(2.2); opacity: 1; }
      100% { transform: scale(4); opacity: 0; }
    }
    @keyframes ywe-flame-burst {
      0%   { transform: scale(0.8) translateY(0); }
      40%  { transform: scale(1.8) translateY(-4px); }
      100% { transform: scale(1) translateY(0); }
    }
    @keyframes ywe-label-flash {
      0%   { letter-spacing: 0.04em; }
      40%  { letter-spacing: 0.12em; }
      100% { letter-spacing: 0.04em; }
    }
    @keyframes ywe-spark-burst {
      0%   { opacity: 1; transform: scale(0.5); }
      50%  { opacity: 1; transform: scale(3); box-shadow: 0 0 20px var(--color-crystal-light), 0 0 40px var(--color-crystal); }
      100% { opacity: 0; transform: scale(5); }
    }

    /* Flash global sur tout l'écran pendant l'ignition (subtil) */
    .ywe-torch.is-igniting::after {
      content: "";
      position: fixed; inset: 0; pointer-events: none;
      background: radial-gradient(circle at 50% 60%, rgba(213,74,223,0.18), transparent 50%);
      animation: ywe-screen-pulse 0.7s ease-out;
      z-index: -1;
    }
    @keyframes ywe-screen-pulse {
      0%   { opacity: 0; }
      40%  { opacity: 1; }
      100% { opacity: 0; }
    }

    /* ═══ 🎴 MENU CATÉGORISÉ — 3 piliers du Mage ═══
       Chaque catégorie = un panneau noir semi-transparent avec
       bordure crystal magenta. Hover = la bordure s'embrase. */
    .ywe-content-menu { max-width: 1180px !important; gap: 32px; }
    .ywe-menu {
      display: grid;
      grid-template-columns: repeat(3, minmax(240px, 1fr));
      gap: clamp(14px, 2vmin, 24px);
      width: 100%;
      align-items: stretch;
    }
    .ywe-cat {
      position: relative;
      display: flex; flex-direction: column;
      padding: clamp(14px, 2vmin, 22px);
      background: transparent;
      border: 1px solid color-mix(in srgb, var(--color-crystal) 35%, transparent);
      transition: all 0.35s ease;
      overflow: hidden;
    }
    .ywe-cat::before {
      /* halo cristal subtil en bas (style pilier illuminé) */
      content: "";
      position: absolute; left: 0; right: 0; bottom: 0;
      height: 50%;
      background: radial-gradient(ellipse at 50% 100%, rgba(213,74,223,0.18), transparent 70%);
      pointer-events: none;
      opacity: 0.7;
      transition: opacity 0.35s ease;
    }
    .ywe-cat::after {
      /* fine ligne magenta haut, comme un trait runic */
      content: "";
      position: absolute; left: 12%; right: 12%; top: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--color-crystal), transparent);
      opacity: 0.5;
    }
    .ywe-cat:hover {
      border-color: var(--color-crystal);
      box-shadow: 0 0 24px rgba(213,74,223,0.32);
      transform: translateY(-3px);
    }
    .ywe-cat:hover::before { opacity: 1; }

    .ywe-cat-head {
      display: flex; flex-direction: column; align-items: center;
      gap: 4px;
      margin-bottom: clamp(12px, 1.8vmin, 18px);
      text-align: center;
    }
    .ywe-cat-icon {
      font-size: clamp(32px, 5vmin, 48px);
      filter: drop-shadow(0 0 12px rgba(213, 74, 223, 0.45));
      animation: yweCatIconFloat 4s ease-in-out infinite alternate;
    }
    @keyframes yweCatIconFloat {
      0%   { transform: translateY(0); }
      100% { transform: translateY(-4px); }
    }
    .ywe-cat-title {
      font-family: var(--font-heading);
      font-size: clamp(20px, 2.8vmin, 30px);
      color: var(--color-crystal-light);
      text-shadow: 0 0 14px rgba(213, 74, 223, 0.55);
      margin: 0;
    }
    .ywe-cat-sub {
      font-size: clamp(11px, 1.4vmin, 14px);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.55);
      font-family: var(--font-body);
    }

    .ywe-cat-torches {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-direction: column; gap: 10px;
      width: 100%;
      align-items: stretch;
      pointer-events: auto;
    }
    .ywe-cat-torches .ywe-torch {
      width: 100%;
      justify-content: center;
      font-size: clamp(14px, 1.8vmin, 17px) !important;
      pointer-events: auto;
      position: relative;
      z-index: 2;
    }

    /* La torche PRIMARY = action principale de la catégorie (plus grosse, plus glow) */
    .ywe-torch-primary {
      border-color: var(--color-crystal) !important;
      background-color: rgba(213, 74, 223, 0.18) !important;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .ywe-torch-primary .ywe-torch-flame {
      opacity: 0.7;
      filter: saturate(1) brightness(1);
    }
    .ywe-torch-primary:hover {
      box-shadow: 0 0 26px rgba(213, 74, 223, 0.55) !important;
    }

    /* Responsive : sur tablette/mobile, menu en colonne unique */
    @media (max-width: 880px) {
      .ywe-menu { grid-template-columns: 1fr; gap: 12px; }
      .ywe-cat { padding: 14px; }
    }

    /* ═══ 🏝 PASSERELLE — 11 Rooms du Conclave ═══ */
    .ywe-rooms-passerelle {
      width: 100%;
      padding: clamp(16px, 2.5vmin, 26px);
      background: transparent;
      border: 1px solid color-mix(in srgb, var(--color-crystal) 28%, transparent);
      position: relative;
    }
    .ywe-rooms-passerelle::before {
      content: ""; position: absolute; left: 12%; right: 12%; top: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--color-crystal), transparent);
      opacity: 0.5;
    }
    .ywe-pass-head {
      display: flex; align-items: center; justify-content: center;
      gap: 12px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .ywe-pass-icon {
      font-size: clamp(24px, 4vmin, 36px);
      filter: drop-shadow(0 0 10px rgba(213,74,223,0.5));
    }
    .ywe-pass-title {
      font-family: var(--font-heading);
      font-size: clamp(20px, 3vmin, 32px);
      color: var(--color-crystal-light);
      text-shadow: 0 0 14px rgba(213, 74, 223, 0.55);
      margin: 0;
    }
    .ywe-pass-sub {
      font-size: clamp(11px, 1.4vmin, 14px);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.5);
      font-family: var(--font-body);
    }

    .ywe-rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
      pointer-events: auto;
    }
    .ywe-room-tile { pointer-events: auto; position: relative; z-index: 2; }
    .ywe-room-tile {
      --tile-accent: #d54adf;
      position: relative;
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      border: 1px solid color-mix(in srgb, var(--tile-accent) 50%, transparent);
      color: rgba(255, 255, 255, 0.95);
      text-decoration: none;
      font-family: var(--font-body);
      font-size: clamp(12px, 1.5vmin, 14px);
      transition: all 0.28s ease;
      overflow: hidden;
      text-shadow: 0 2px 6px rgba(0,0,0,0.85);
    }
    .ywe-room-tile::before {
      content: ""; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 120%, color-mix(in srgb, var(--tile-accent) 25%, transparent), transparent 60%);
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .ywe-room-tile:hover {
      border-color: var(--tile-accent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--tile-accent) 50%, transparent);
      color: #fff;
      transform: translateY(-2px);
    }
    .ywe-room-tile:hover::before { opacity: 1; }
    .ywe-room-icon {
      font-size: 1.4em;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tile-accent) 60%, transparent));
    }
    .ywe-room-name {
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* SpellHeader laisse de la place en haut au screen splash */
    .ywe-title { padding-top: 80px !important; }
    .ywe-instructions { padding-top: 80px !important; }
    .ywe-done { padding-top: 80px !important; }

    /* ─── Done screen ─── */
    .ywe-done h2 { color: var(--color-crystal-light); text-shadow: 0 0 30px rgba(213, 74, 223, 0.5); }

    /* ─── Fade-in animation par data-fade ─── */
    [data-fade] {
      opacity:0; transform: translateY(20px);
      animation: yweFade 0.8s ease-out forwards;
    }
    [data-fade]:nth-child(1) { animation-delay: 0s; }
    [data-fade]:nth-child(2) { animation-delay: 0.2s; }
    [data-fade]:nth-child(3) { animation-delay: 0.4s; }
    [data-fade]:nth-child(4) { animation-delay: 0.6s; }
    [data-fade]:nth-child(5) { animation-delay: 0.8s; }
    @keyframes yweFade {
      from { opacity:0; transform: translateY(20px); }
      to { opacity:1; transform: translateY(0); }
    }

    /* ─── Title screen : h1 énorme avec Henny Penny ─── */
    .ywe-title h1 {
      letter-spacing: 0.02em;
      text-shadow: 0 0 30px rgba(213, 74, 223, 0.45), 0 0 80px rgba(213, 74, 223, 0.2);
    }
  `]
})
export class YamzyWorldEntryComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;

  // ═══════════════════════════════════════════════════════════════════
  // STATE (signals au lieu de xstate — pattern allégé)
  // ═══════════════════════════════════════════════════════════════════
  phase = signal<EntryPhase>('idle');
  loadingProgress = signal<number>(0);
  loadingMessage = signal<string>('Invocation des étoiles…');
  tourIndex = signal<number>(0);
  tourText = signal<string>('');
  totalSteps = signal<number>(0);
  // 🐦 Intro mouette plein écran — SHOWN APRÈS le chargement complet (réveil de Yamzy)
  showIntro = signal<boolean>(false);
  introFading = signal<boolean>(false);
  /** Signal : l'anim mouette est terminée, on est en mode exploration libre */
  introCanExplore = signal<boolean>(false);
  /** ⏭ Signal UI : true tant que l'anim mouette tourne (cache le bouton skip après) */
  mouettePhase = signal<boolean>(true);
  /** Référence au canvas intro */
  @ViewChild('introCanvas') introCanvasEl?: ElementRef<HTMLCanvasElement>;
  /** Flag pour skip l'intro (clic bouton) */
  private introSkipRequested = false;
  /** ⏭ Flag : skip UNIQUEMENT la partie mouette (anim native + fly-to-boat).
   *  Le boat sailing + arrival se joue ensuite normalement. */
  private skipMouetteFlag = false;

  /** 🎮 GTA-style boat drive : touches pressées + état vitesse */
  private boatDriveKeys = new Set<string>();
  private boatDriveEnabled = false;
  private boatVelocity = 0;

  /** Handler du bouton "Skip anim mouette" — saute à la phase boat sailing direct */
  onSkipMouette(): void {
    if (!this.showIntro() || !this.mouettePhase()) return;
    console.log('[YamzyEntry] ⏭ Skip mouette demandé — saut direct vers phase boat sailing');
    this.skipMouetteFlag = true;
    this.mouettePhase.set(false);
  }

  // Injection services
  voice = inject(VoiceNarratorService);
  sounds = inject(SpellSoundsService);
  private router = inject(Router);
  private ceremonyBus = inject(CeremonyBusService);
  // 🚶 Explorer service : déplacement YAMZY avec WASD + collision
  private explorer = inject(RoomExplorerService);

  // ═══════════════════════════════════════════════════════════════════
  // 3D refs
  // ═══════════════════════════════════════════════════════════════════
  private scene: any;
  private camera: any;
  private renderer: any;
  private clock: any;
  private controls: any;
  private rafId: number = 0;
  private disposed = false;
  private elapsed = 0;
  private sky: SkyOrnamentsHandle | null = null;
  private islandRoot: any;
  private unsubCeremony: (() => void) | null = null;
  private tourAbortController: { aborted: boolean } = { aborted: false };

  ngOnInit(): void {
    // Choix de persona par défaut (créature mignonne, choix utilisateur)
    this.voice.setPersona('cute-creature');
    this.runFullEntryFlow();
  }

  /** Orchestrateur : bootstrap + pré-fetch intro GLB + intro mouette en arrière-plan + panneau visible */
  private async runFullEntryFlow(): Promise<void> {
    // 1) Pré-fetch intro-island.glb en parallèle (warm browser cache)
    const introFetchPromise = fetch('/assets/conclave/models/intro-island.glb', { cache: 'force-cache' })
      .then(r => r.arrayBuffer())
      .then(buf => {
        console.log(`[YamzyEntry] ✓ intro-island.glb pré-chargé (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`);
        return buf;
      })
      .catch((e) => { console.warn('[YamzyEntry] intro pre-fetch failed', e); return null; });

    // 2) Bootstrap Three.js MINIMAL — pas besoin de la chambre/YAMZY/crystal vu qu'on va vers /world-map
    this.bootstrapMinimalForIntro();

    // 3) Attend SEULEMENT que le GLB intro mouette soit prêt (pas besoin d'attendre la chambre)
    this.loadingMessage.set('Yamzy se réveille…');
    await introFetchPromise;
    console.log('[YamzyEntry] ✓ GLB mouette prêt — lancement intro');

    // 4) Lance l'intro mouette (panneau Yamzy World en overlay HTML + mouette derrière)
    try {
      this.showIntro.set(true);
      this.phase.set('splash');
      await new Promise(r => setTimeout(r, 60));
      await this.playIslandIntro();
      // 5) Scène cinématique : reste sur place après l'arrivée du boat (pas de navigation)
      console.log('[YamzyEntry] ✓ Intro terminée — scène libre (YAMZY explore l\'île)');
    } catch (e) {
      console.warn('[YamzyEntry] Intro mouette failed/skipped', e);
      this.showIntro.set(false);
    }
  }

  /**
   * 🎯 STUDIO YAMZY — TransformControls Blender-way SUR L'AVATAR UNIQUEMENT.
   * Activé après l'arrivée du boat. Permet de déplacer/scaler/tourner YAMZY librement
   * comme dans Blender (G/R/S/Esc + touche C pour copier).
   * Pas de click-switch — focus exclusif sur l'avatar.
   */
  private async attachYamzyTransformControls(T: any, camera: any, renderer: any, yamzyNode: any, scene: any): Promise<void> {
    if (!T.TransformControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js');
    }
    if (!T.TransformControls) {
      console.warn('[YamzyEntry] ⚠ TransformControls non chargé');
      return;
    }
    // ⚡ YAMZY est FIGÉ (position + rotation + scale) — pas de gizmo dessus
    // Le studio agit UNIQUEMENT sur le water_waves group (translate + scale seulement)
    let waterTarget: any = null;
    scene.traverse((c: any) => {
      if (!waterTarget && c.name === '__WATER_WAVES__') waterTarget = c;
    });
    if (!waterTarget) {
      console.warn('[YamzyEntry] ⚠ __WATER_WAVES__ introuvable — abort studio water');
      return;
    }
    const transformControls = new T.TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');     // ⚡ démarre en translate (Blender G)
    transformControls.setSize(1.5);
    transformControls.attach(waterTarget);      // ⚡ attaché à l'EAU, pas YAMZY
    scene.add(transformControls);
    transformControls.addEventListener('dragging-changed', (e: any) => {
      (this as any).__transformDragging = e.value;
    });
    // ⚡ Cache les handles multi-axes : garde QUE les 3 axes X/Y/Z (style Blender pur)
    // ⚡ Force les axes à toujours s'afficher AU-DESSUS de tout (depthTest=false) → cliquables même cachés par boat
    const hiddenNames = new Set(['XY', 'YZ', 'XZ', 'XYZ', 'E', 'XYZE']);
    const fixGizmoVisibility = () => {
      transformControls.traverse((c: any) => {
        // Cache les handles multi-axes
        if (c.name && hiddenNames.has(c.name)) {
          c.visible = false;
          if (c.geometry && c.scale) c.scale.set(0, 0, 0);
        }
        // Force tous les meshes du gizmo à être always-on-top (depthTest=false) + renderOrder élevé
        if (c.isMesh && c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const m of mats) {
            m.depthTest = false;
            m.depthWrite = false;
            m.transparent = true;
          }
          c.renderOrder = 9999;   // au-dessus de TOUT le rendu
        }
      });
    };
    fixGizmoVisibility();
    transformControls.addEventListener('change', fixGizmoVisibility);
    const hideMultiAxisHandles = fixGizmoVisibility;   // alias pour compat clavier

    console.log('[YamzyEntry] 🎯 STUDIO WATER actif — G=translate · S=scale · C=copier · Esc=détacher (YAMZY figé, pas modifiable)');

    // Keyboard : SEULEMENT G (translate) et S (scale) sur water · R désactivé · C / Esc
    const onKey = (e: KeyboardEvent) => {
      const tEl = e.target as HTMLElement;
      if (tEl && (tEl.tagName === 'INPUT' || tEl.tagName === 'TEXTAREA' || tEl.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if (k === 'g') {
        if (!transformControls.object) transformControls.attach(waterTarget);
        transformControls.setMode('translate');
        hideMultiAxisHandles();
        console.log('[YamzyEntry] 🎯 water mode TRANSLATE (G) — 3 axes XYZ');
      } else if (k === 's') {
        if (!transformControls.object) transformControls.attach(waterTarget);
        transformControls.setMode('scale');
        hideMultiAxisHandles();
        console.log('[YamzyEntry] 🎯 water mode SCALE (S) — 3 axes XYZ');
      } else if (k === 'escape') {
        transformControls.detach();
        console.log('[YamzyEntry] 🎯 détaché (Esc) — presse G ou S pour ré-attacher water');
      } else if (k === 'c') {
        const obj = transformControls.object || waterTarget;
        const data = {
          name: obj.name || 'water',
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
          scale:    { x: obj.scale.x,    y: obj.scale.y,    z: obj.scale.z },
          scaleUniform: obj.scale.x,
        };
        const txt = JSON.stringify(data, null, 2);
        console.log('[YamzyEntry] 📋 Transforms water :', data);
        console.log(`[YamzyEntry] 📋 Scale uniforme = ${data.scaleUniform.toFixed(6)}`);
        try {
          navigator.clipboard.writeText(txt).then(
            () => console.log('[YamzyEntry] ✓ Transforms water copiés dans le presse-papier (Ctrl+V pour coller)'),
            () => console.warn('[YamzyEntry] ⚠ Clipboard refused — copie manuelle depuis le log')
          );
        } catch {
          console.warn('[YamzyEntry] ⚠ Clipboard API indisponible — copie manuelle depuis le log');
        }
      }
    };
    window.addEventListener('keydown', onKey);
  }

  /** Bootstrap minimal pour l'intro : juste Three.js, pas de scène lourde (chambre/YAMZY/crystal/map).
   *  La vraie map est sur /world-map (composant dédié léger). */
  private async bootstrapMinimalForIntro(): Promise<void> {
    this.phase.set('loading');
    this.loadingMessage.set('Invocation des étoiles…');
    this.loadingProgress.set(5);
    await this.loadThreeJs((p, m) => {
      this.loadingProgress.set(p);
      if (m) this.loadingMessage.set(m);
    });
    this.loadingProgress.set(100);
  }

  /** Polling : résout quand YAMZY est dans la scène + explorer prêt (legacy — plus utilisé) */
  private waitUntilYamzyReady(timeoutMs = 30000): Promise<void> {
    return new Promise((resolve) => {
      if ((this as any).yamzyExplorer) { resolve(); return; }
      const start = performance.now();
      const id = setInterval(() => {
        if (this.disposed) { clearInterval(id); resolve(); return; }
        if ((this as any).yamzyExplorer) {
          clearInterval(id);
          resolve();
        } else if (performance.now() - start > timeoutMs) {
          clearInterval(id);
          resolve();
        }
      }, 100);
    });
  }

  /** Skip pendant l'anim mouette → fade direct vers la chambre 3D + map 3D sur la table */
  skipIntro(): void {
    this.introSkipRequested = true;
    console.log('[YamzyEntry] ⏩ Skip → fade vers chambre + map 3D');
  }

  /** Helper pour les actions du menu — ferme l'intro overlay si elle est encore visible */
  private dismissIntroOverlay(): void {
    if (!this.showIntro()) return;
    this.introSkipRequested = true;
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.tourAbortController.aborted = true;
    this.voice.cancel();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubCeremony) this.unsubCeremony();
    if (this.sky) this.sky.dispose();
    if (this.renderer) { try { this.renderer.dispose(); } catch {} }
    window.removeEventListener('resize', this.onResize);
    // 🚶 Cleanup explorer (retire keyboard/mouse listeners)
    try { this.explorer.dispose(); } catch {}
    // 🗺 Cleanup world map listeners
    try { (this as any)._worldMapCleanup?.(); } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🐦 INTRO MOUETTE — plein écran avant le welcome
  //
  // Charge intro-island.glb (île + mouette qui vole), play "Base Stack"
  // animation, caméra suit le node MOUETTE_DEF. À la fin de l'anim
  // (ou skip user), fade out → hide canvas → resolve.
  // ═══════════════════════════════════════════════════════════════════
  private async playIslandIntro(): Promise<void> {
    // Attend que Angular ait rendu le canvas
    await new Promise(r => setTimeout(r, 50));
    const T = (window as any).THREE;
    if (!T?.GLTFLoader) { this.showIntro.set(false); return; }
    const canvas = this.introCanvasEl?.nativeElement;
    if (!canvas) { this.showIntro.set(false); return; }

    const w = window.innerWidth, h = window.innerHeight;
    // ⚡ PERFS : antialias OFF + pixelRatio 1 (au lieu de 2 sur Retina) → ×4 moins de pixels à fragmenter
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = T.SRGBColorSpace || 3001;
    renderer.toneMapping = T.ACESFilmicToneMapping || 0;
    renderer.toneMappingExposure = 1.05;

    const scene = new T.Scene();
    scene.background = new T.Color(0x6db4f0);     // sky blue
    // ⚡ Fog désactivé — éclate les distances sur scène à grande échelle (mouette à -1947)
    // scene.fog = new T.Fog(0x6db4f0, 30, 120);

    // ⚡ PERFS : near=0.1 + far=20000 → précision z-buffer ×2500 meilleure que near=0.001/far=500000
    const camera = new T.PerspectiveCamera(45, w / h, 0.1, 20000);
    camera.position.set(0, 8, 22);
    camera.lookAt(0, 0, 0);

    // Lights cohérentes avec daylight
    scene.add(new T.AmbientLight(0xffffff, 0.55));
    const dir = new T.DirectionalLight(0xffffff, 1.1);
    dir.position.set(15, 25, 15);
    scene.add(dir);
    const hemi = new T.HemisphereLight(0x9bd8ff, 0x4a6b3a, 0.6);
    scene.add(hemi);

    // Load le GLB
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }
    let gltf: any;
    try {
      gltf = await new Promise<any>((res, rej) => {
        loader.load('/assets/conclave/models/intro-island.glb', res, undefined, rej);
      });
    } catch (e) {
      console.warn('[YamzyEntry] intro-island.glb load failed', e);
      this.showIntro.set(false);
      try { renderer.dispose(); } catch {}
      return;
    }

    scene.add(gltf.scene);
    console.log('[YamzyEntry] ✓ intro-island.glb loaded — playing mouette intro');

    // ⚡ Fix 2 problèmes courants sur SkinnedMesh :
    //   1) DoubleSide → cam peut être très proche sans back-face culling
    //   2) frustumCulled = false → empêche YAMZY de disparaître quand bones bougent
    //      (la bbox du bind pose ne suit pas le squelette animé → culled à tort)
    let skinnedCount = 0;
    gltf.scene.traverse((obj: any) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.side = T.DoubleSide;
        }
        if (obj.isSkinnedMesh) {
          obj.frustumCulled = false;   // ⚡ FIX flicker apparition/disparition
          skinnedCount++;
        }
      }
    });
    console.log(`[YamzyEntry] 🔧 ${skinnedCount} SkinnedMesh(es) → frustumCulled désactivé`);

    // Calcule le centre de l'île pour le mode exploration libre après l'anim
    const islandBbox = new T.Box3().setFromObject(gltf.scene);
    const islandCenter = new T.Vector3();
    islandBbox.getCenter(islandCenter);

    // ━━━ Mode exploration libre (post-anim) : orbit + zoom souris ━━━
    let exploreYaw = 0;
    let explorePitch = 0.35;
    let exploreDistance = 1;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    // Bornes basées sur la taille de l'île (bbox)
    const islandSize = new T.Vector3();
    islandBbox.getSize(islandSize);
    const maxDim = Math.max(islandSize.x, islandSize.y, islandSize.z);
    // ⚡ Zoom range très large — gros plan extrême possible + zoom out total
    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = maxDim * 50;
    console.log(`[YamzyEntry] Explore mode bounds — distance [${ZOOM_MIN.toFixed(1)} → ${ZOOM_MAX.toFixed(1)}]`);

    const onIntroPointerDown = (e: PointerEvent) => {
      if (!this.introCanExplore()) return;
      // Ignore les clics sur les boutons UI (la cible vérifie si on est sur le canvas)
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'BUTTON' || target.closest('button'))) return;
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };
    const onIntroPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      exploreYaw -= dx * 0.005;
      explorePitch -= dy * 0.005;
      explorePitch = Math.max(-0.4, Math.min(1.4, explorePitch));   // -23° à +80°
    };
    const onIntroPointerUp = () => { isDragging = false; };
    const onIntroWheel = (e: WheelEvent) => {
      if (!this.introCanExplore()) return;
      e.preventDefault();
      // Step proportionnel à la distance actuelle (zoom logarithmique)
      const step = Math.max(1, exploreDistance * 0.1);
      exploreDistance = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, exploreDistance + Math.sign(e.deltaY) * step));
    };
    // ⚠ Listeners sur WINDOW (pas canvas) pour que les boutons UI ne bloquent pas la molette
    window.addEventListener('pointerdown', onIntroPointerDown);
    window.addEventListener('pointermove', onIntroPointerMove);
    window.addEventListener('pointerup', onIntroPointerUp);
    window.addEventListener('wheel', onIntroWheel, { passive: false });

    // Trouve les nodes clés : mouette, boat, yamzy, keel, mouletteBoat, water
    let mouette: any = null;
    let boatNode: any = null;
    let yamzyNode: any = null;
    let keelNode: any = null;
    let mouletteBoatNode: any = null;
    let waterNode: any = null;
    let chezYamzyNode: any = null;       // ⚡ "chezYamzy" = vraie destination du boat (là où YAMZY habite)
    // ⚡ Angle de la "proue" (où YAMZY se tient) dans le repère LOCAL XZ de boatNode.
    // Calculé après le chargement de boad.glb + application de la rotation figée.
    // Utilisé pour corriger l'orientation du boat pendant le sailing :
    //   yawTarget = atan2(dirX, dirZ) - bowOffsetAngle
    let bowOffsetAngle = 0;
    let bowOffsetMeasured = false;
    let keelCandidates: any[] = [];
    gltf.scene.traverse((obj: any) => {
      const n = obj.name || '';
      if (!mouette && /^MOUETTE/i.test(n)) mouette = obj;
      if (!boatNode && /^boat$/i.test(n)) boatNode = obj;
      if (!yamzyNode && /^yamzy$/i.test(n)) yamzyNode = obj;
      if (!mouletteBoatNode && /^moulette$/i.test(n)) mouletteBoatNode = obj;
      if (!chezYamzyNode && /^chezYamzy$/i.test(n)) chezYamzyNode = obj;
      if (!waterNode && /^(water|eau|sea|ocean)([._]\d+|_0)?$/i.test(n)) waterNode = obj;
      if (/keel[._]?\d+/i.test(n)) keelCandidates.push(obj);
    });
    keelNode = keelCandidates.find(o => !/_0$/i.test(o.name)) || keelCandidates[0] || null;
    // ⚡ Priorité destination boat : chezYamzy (vraie maison) > Keel.000 (fallback)
    const boatDestNode = chezYamzyNode || keelNode;
    if (mouette) console.log(`[YamzyEntry] 🐦 Mouette node "${mouette.name}" trouvée`);
    else console.warn('[YamzyEntry] ⚠ Aucun node "MOUETTE..." trouvé dans le GLB');
    if (boatNode) console.log(`[YamzyEntry] 🚢 Boat node "${boatNode.name}" trouvé`);
    if (yamzyNode) console.log(`[YamzyEntry] 🧙 YAMZY node "${yamzyNode.name}" trouvé`);
    if (chezYamzyNode) console.log(`[YamzyEntry] 🏠 chezYamzy trouvé — destination boat`);
    else if (keelNode) console.log(`[YamzyEntry] ⚓ Keel node "${keelNode.name}" trouvé (fallback destination boat)`);
    else console.warn(`[YamzyEntry] ⚠ Aucun node Keel.* trouvé (${keelCandidates.length} candidats matchés)`);
    if (mouletteBoatNode) console.log(`[YamzyEntry] 🪺 Mouette du boat (point d'atterrissage) trouvé`);
    else console.warn(`[YamzyEntry] ⚠ Node "moulette" du boat non trouvé`);
    if (waterNode) console.log(`[YamzyEntry] 🌊 Water mesh "${waterNode.name}" trouvé — sera utilisé pour seaLevel`);
    else console.log(`[YamzyEntry] ℹ Pas de mesh "water" → seaLevel calculé depuis le boat`);

    // 🛡 OBSTACLES : collecte tous les meshes de l'île pour collision raycast
    //   On exclut : water (le bateau est dessus), markers vides, mouette (mobile)
    //   Le boad et YAMZY ne sont pas dans cette scène (loaded après) → pas inclus
    const __boatObstacles: any[] = [];
    gltf.scene.traverse((c: any) => {
      if (!c.isMesh && !c.isSkinnedMesh) return;
      const name = (c.name || '').toLowerCase();
      // Skip water, mouette, et les meshes des markers boat/yamzy
      if (name.includes('water') || name.includes('mouette') || name.includes('moulette')) return;
      // boatNode children are hidden but stay in scene → skip them
      let ancestor = c.parent;
      while (ancestor) {
        if (ancestor === boatNode) return;   // skip everything under boat marker
        ancestor = ancestor.parent;
      }
      __boatObstacles.push(c);
    });
    (this as any).__boatObstacles = __boatObstacles;
    console.log(`[YamzyEntry] 🛡 ${__boatObstacles.length} obstacles collectés pour collision raycast`);

    // ══════════════════════════════════════════════════════════════
    // 🚢 CHARGEMENT BOAD.GLB (vrai bateau) + 🧙 YAMZY_chez (inside boat)
    // ══════════════════════════════════════════════════════════════
    // Le node "boat" de intro-island = MARKER vide pour positionner le boad.glb
    // Le node "yamzy" DANS boad.glb = MARKER pour positionner YAMZY_chez.glb
    let yamzyMixer: any = null;
    if (boatNode) {
      // Hide le mesh du boat marker (placeholder, on va mettre boad.glb à la place)
      boatNode.traverse((c: any) => {
        if (c !== boatNode && (c.isMesh || c.isSkinnedMesh)) c.visible = false;
      });
      const boadLoader = new T.GLTFLoader();
      boadLoader.load('/assets/conclave/models/boad.glb', (boadGltf: any) => {
        const boadScene = boadGltf.scene;
        boadScene.name = '__BOAD_LOADED__';
        // ⚡ Scale FIGÉ par l'utilisateur via TransformControls (touche C → presse-papier)
        const boadScale = 14.76273275210006;
        boadScene.scale.setScalar(boadScale);
        // ⚡ Position + rotation FINALES FIGÉES par l'utilisateur via TransformControls (touche C)
        // Offset du boad dans le repère local du boatNode marker, à la destination chezYamzy
        boadScene.position.set(-20.96248777909281, 0, 19.852647959974426);
        boadScene.rotation.set(-3.141592653589793, -0.36881034126351064, -3.141592653589793);
        console.log(`[YamzyEntry] 📏 boad.glb scale=${boadScale}, pos=(-20.96, 0, 19.85), rot=(-π, -0.37, -π) — finale figée`);
        // Ajoute boad.glb comme CHILD du marker boat → bouge naturellement quand on déplace boatNode
        boatNode.add(boadScene);
        // 🎥 Stocke réf pour que la cam puisse cibler le BOAD VISIBLE (pas le marker boatNode)
        (this as any).__boadRef = boadScene;
        // Fix SkinnedMeshes + materials
        boadScene.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) m.side = T.DoubleSide;
          }
        });
        console.log(`[YamzyEntry] ✓ boad.glb chargé — child of boat marker`);

        // Cherche le marker "yamzy" À L'INTÉRIEUR de boad.glb (= position de la PROUE)
        let yamzyMarkerInBoad: any = null;
        boadScene.traverse((c: any) => {
          if (!yamzyMarkerInBoad && /^yamzy$/i.test(c.name||'')) yamzyMarkerInBoad = c;
        });
        if (!yamzyMarkerInBoad) {
          console.warn('[YamzyEntry] ⚠ Pas de marker "yamzy" dans boad.glb');
          return;
        }

        // 🎯 IDENTIFIE LA PROUE — calcul de bowOffsetAngle :
        //   La proue = position du marker yamzy DANS boad.glb (= centre boad → marker)
        //   ⚠ IMPORTANT : on prend la direction marker - BOADSCENE (PAS boatNode!) :
        //     boadScene a un offset (-7.57, 0, 26.06) dans boatNode → si on utilisait boatNode
        //     comme référence, l'offset dominerait et fausserait la direction (~-15° au lieu de ~148°).
        //   Avec boadScene comme référence, on obtient la VRAIE direction de la proue dans le repère local.
        boatNode.updateMatrixWorld(true);
        const savedYaw = boatNode.rotation.y;
        boatNode.rotation.y = 0;
        boatNode.updateMatrixWorld(true);
        const markerWorld = new T.Vector3();
        yamzyMarkerInBoad.getWorldPosition(markerWorld);
        const boadWorld = new T.Vector3();
        boadScene.getWorldPosition(boadWorld);  // ⚡ Référence = centre du BOAD, pas boatNode !
        const bowVec = markerWorld.sub(boadWorld);
        bowVec.y = 0;
        if (bowVec.lengthSq() > 0.0001) {
          bowOffsetAngle = Math.atan2(bowVec.x, bowVec.z);
          bowOffsetMeasured = true;
          console.log(`[YamzyEntry] 🏴‍☠ Proue identifiée : direction local (${bowVec.x.toFixed(3)}, ${bowVec.z.toFixed(3)}) → angle ${(bowOffsetAngle * 180 / Math.PI).toFixed(1)}° (centre boad → marker yamzy)`);
        } else {
          console.warn(`[YamzyEntry] ⚠ Marker yamzy trop proche du centre boad — pas de direction de proue détectée`);
        }
        // Restaure la rotation initiale
        boatNode.rotation.y = savedYaw;
        boatNode.updateMatrixWorld(true);
        // Position locale du marker yamzy dans son parent (dans boad.glb)
        const markerLocalPos = yamzyMarkerInBoad.position.clone();
        const markerLocalQuat = yamzyMarkerInBoad.quaternion.clone();
        const markerParent = yamzyMarkerInBoad.parent;
        yamzyMarkerInBoad.visible = false;
        console.log(`[YamzyEntry] 🪺 yamzy marker dans boad.glb trouvé — pos (${markerLocalPos.x.toFixed(2)}, ${markerLocalPos.y.toFixed(2)}, ${markerLocalPos.z.toFixed(2)})`);
        // Charge YAMZY_chez.glb et l'attache au yamzy marker DANS boad.glb
        const yamzyLoader = new T.GLTFLoader();
        yamzyLoader.load('/assets/agents/YAMZY_chez.glb', (yGltf: any) => {
          const yScene = yGltf.scene;
          // ⚡ Scale FIGÉ par l'utilisateur via TransformControls (touche C → presse-papier)
          // Valeur captée depuis la scène : 0.007768307006898549 (scale uniforme dans l'espace local du marker)
          const scale = 0.007768307006898549;
          yScene.scale.setScalar(scale);
          console.log(`[YamzyEntry] 📏 YAMZY scale = ${scale} (figé par TransformControls)`);
          // Position locale = position du marker yamzy dans son parent (au sein de boad.glb)
          // ⚡ Position FIGÉE par utilisateur via TransformControls (touche C)
          //    Override la position du marker par les valeurs captées
          yScene.position.set(0.06056299672653985, 0.04826793589796303, -0.01967491435079073);
          // ⚡ Rotation FIGÉE par utilisateur via TransformControls (touche C)
          //    Override le quaternion natif du marker par les valeurs Euler captées
          yScene.rotation.set(-3.141592653589791, -1.4879423066363795, -3.141592653589791);
          yScene.name = '__YAMZY_LOADED__';
          // ⚡ Parent au parent du marker (= dans boad.glb → YAMZY suit le boad → suit le boat marker)
          (markerParent || boadScene).add(yScene);
        // Anim Idle si présente
        if (yGltf.animations && yGltf.animations.length) {
          yamzyMixer = new T.AnimationMixer(yScene);
          const idleClip = yGltf.animations.find((a: any) => /idle/i.test(a.name||'')) || yGltf.animations[0];
          if (idleClip) {
            const idleAction = yamzyMixer.clipAction(idleClip);
            idleAction.setLoop(T.LoopRepeat, Infinity);
            idleAction.play();
            console.log(`[YamzyEntry] 🧙 YAMZY_chez Idle "${idleClip.name}" (loop ∞) — durée ${idleClip.duration.toFixed(2)}s`);
          }
        }
        // ⚡ PERFS : on garde frustumCulled=true (default) → cull si hors écran (×5 FPS quand cam pas sur YAMZY)
        // Au lieu de fix YAMZY disparition, on étend manuellement la boundingSphere ×2
        yScene.traverse((obj: any) => {
          if (obj.isSkinnedMesh) {
            obj.frustumCulled = true;
            // Élargit la boundingSphere pour éviter culling pendant l'anim
            if (obj.geometry && obj.geometry.boundingSphere) {
              obj.geometry.boundingSphere.radius *= 2.5;
            }
          }
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) m.side = T.DoubleSide;
          }
        });
        // ⚡ La référence yamzyNode pointe désormais sur le vrai YAMZY chargé
        yamzyNode = yScene;
        console.log(`[YamzyEntry] ✓ YAMZY_chez.glb chargé — scale=${scale.toFixed(3)}, parent=boat, pos local (${markerLocalPos.x.toFixed(0)}, ${markerLocalPos.y.toFixed(0)}, ${markerLocalPos.z.toFixed(0)})`);
        }, undefined, (err: any) => {
          console.warn('[YamzyEntry] ⚠ YAMZY_chez.glb load failed', err);
        });
      }, undefined, (err: any) => {
        console.warn('[YamzyEntry] ⚠ boad.glb load failed', err);
      });
    }

    // ══════════════════════════════════════════════════════════════
    // 🌊 SYSTÈME DE NAVIGATION MARITIME
    // ══════════════════════════════════════════════════════════════
    // Niveau de la mer (seaLevel) :
    //   - Priorité 1 : Y monde du mesh "water" du GLB (si fourni par Blender)
    //   - Fallback : Y monde du boat (où il flotte naturellement)
    let seaLevel = 0;
    if (waterNode) {
      waterNode.updateWorldMatrix(true, false);
      // Box3 du mesh water → on prend le centre Y (ou max.y si surface horizontale)
      const wBox = new T.Box3().setFromObject(waterNode);
      if (!wBox.isEmpty()) {
        // La surface haute du mesh = max.y (l'eau est généralement une nappe horizontale)
        seaLevel = wBox.max.y;
      } else {
        const wp = new T.Vector3();
        waterNode.getWorldPosition(wp);
        seaLevel = wp.y;
      }
      console.log(`[YamzyEntry] 🌊 seaLevel = ${seaLevel.toFixed(2)} (depuis mesh water du GLB)`);
    } else if (boatNode) {
      boatNode.updateWorldMatrix(true, false);
      const bp = new T.Vector3();
      boatNode.getWorldPosition(bp);
      seaLevel = bp.y;
      console.log(`[YamzyEntry] 🌊 seaLevel = ${seaLevel.toFixed(2)} (fallback depuis boat)`);
    }

    // 🌊 Mer INFINIE CONTINUE — un seul plan géant avec shader procédural pour les vagues
    //   - On masque le mesh water natif (intro-island.glb)
    //   - On crée UN seul PlaneGeometry (pas de tuiles, pas de seams visibles)
    //   - Vagues via custom vertex shader (sin/cos sur position + uniform time)
    //   - Scale figé par utilisateur via TransformControls (touche C) → contrôle la fréquence des vagues
    //   - Position figée par utilisateur → centré là où le boat navigue
    if (waterNode) {
      waterNode.visible = false;
      console.log('[YamzyEntry] 🌊 Mesh water natif du GLB masqué — remplacé par plan infini avec shader');
    }
    {
      // 🎯 Valeurs figées par utilisateur (gizmo TransformControls → touche C)
      const USER_TILE_SCALE = 0.053193622136361786;
      const USER_GROUP_POS_X = 0;
      const USER_GROUP_POS_Y = -197.94667405165978;
      const USER_GROUP_POS_Z = 161.85048623570117;

      // 🌊 PLAN INFINI — taille massive × scale utilisateur = couverture quasi-infinie
      //   500 000 unités × 0.036 = 18 000 monde en X, × 0.063 = 31 500 en Z
      //   ⚡ Segments DIVISÉS PAR ~3 (300 au lieu de 1000) → 11× moins de vertices = 90 K
      //   Évite lag pendant drive (était 28M évaluations de vagues par frame → maintenant 2.5M)
      const PLANE_SIZE = 500000;
      const PLANE_SEGMENTS = 300;
      const planeGeo = new T.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS);
      planeGeo.rotateX(-Math.PI / 2);

      // 🎨 envMap : gradient ciel clair → mer profonde pour reflets style screenshot référence
      let waterEnvMap: any = null;
      try {
        const pmremGen = new T.PMREMGenerator(renderer);
        const envScene = new T.Scene();
        const envGeo = new T.SphereGeometry(50, 32, 16);
        const colors: number[] = [];
        const positions = envGeo.attributes['position'];
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i);
          const t = (y + 50) / 100;
          // En bas : bleu marine, en haut : ciel clair
          colors.push(0.2 + t * 0.6, 0.4 + t * 0.45, 0.55 + t * 0.4);
        }
        envGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        const envMat0 = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide });
        envScene.add(new T.Mesh(envGeo, envMat0));
        waterEnvMap = pmremGen.fromScene(envScene).texture;
        pmremGen.dispose();
        console.log('[YamzyEntry] 🌊 envMap procédural généré (ciel→mer)');
      } catch (e) {
        console.warn('[YamzyEntry] ⚠ PMREMGenerator failed', e);
      }

      // 🌊 MATÉRIAU PARFAIT — version validée avant les essais GLB
      //   Bleu lisible, opaque, légère self-illumination, reflets ciel via envMap
      //   ⚡ FrontSide (et non DoubleSide) → l'eau n'est visible QUE par-dessus, pas par-dessous
      const planeMat = new T.MeshStandardMaterial({
        color: 0x3a6a8a,
        metalness: 0.45,
        roughness: 0.18,
        emissive: 0x051528,
        emissiveIntensity: 0.15,
        side: T.FrontSide,           // ← rend uniquement la face du dessus
        transparent: false,
      });
      if (waterEnvMap) {
        planeMat.envMap = waterEnvMap;
        planeMat.envMapIntensity = 1.8;
      }

      // ⚡ Shader Gerstner-style — 6 vagues directionnelles superposées (style ocean)
      //    Chaque vague a sa propre direction → pattern organique non périodique (vraie mer)
      //    Échelles variées (low/mid/high freq) → grandes vagues + ridelles
      let waterShaderRef: any = null;
      planeMat.onBeforeCompile = (shader: any) => {
        shader.uniforms['uTime'] = { value: 0 };

        // Inject uniforms + fonction wave Gerstner-style (6 directionnelles)
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
uniform float uTime;

// Vagues directionnelles superposées → pattern océan organique
// Amplitudes RÉDUITES ×10 (vagues plus petites, mer plus calme)
float waveFn(vec2 p, float t) {
  float h = 0.0;
  // Grandes vagues (basses fréquences) → houle douce
  h += sin(dot(p, vec2( 0.95,  0.31)) * 0.035 + t * 0.8) * 1.2;
  h += sin(dot(p, vec2( 0.66, -0.75)) * 0.045 + t * 1.0) * 1.0;
  // Vagues moyennes
  h += sin(dot(p, vec2(-0.50,  0.87)) * 0.08  + t * 1.4) * 0.6;
  h += sin(dot(p, vec2( 0.31,  0.95)) * 0.11  + t * 1.6) * 0.45;
  // Petites vagues (ridelles et chops)
  h += sin(dot(p, vec2(-0.91, -0.42)) * 0.18  + t * 2.1) * 0.2;
  h += cos(dot(p, vec2( 0.62,  0.78)) * 0.27  + t * 2.7) * 0.12;
  // Sparkles ultra-fines (chatoiement)
  h += sin(dot(p, vec2( 0.77, -0.64)) * 0.55  + t * 3.5) * 0.04;
  return h;
}`,
        );

        // Normales recalculées en finite difference (lumière + reflets sur les pentes)
        shader.vertexShader = shader.vertexShader.replace(
          '#include <beginnormal_vertex>',
          `vec3 objectNormal;
{
  vec2 p = vec2(position.x, position.z);
  float h = waveFn(p, uTime);
  float eps = 1.5;   // plus grand → normales plus douces (moins de bruit haute fréquence)
  float hx = waveFn(p + vec2(eps, 0.0), uTime);
  float hz = waveFn(p + vec2(0.0, eps), uTime);
  vec3 dx = vec3(eps, hx - h, 0.0);
  vec3 dz = vec3(0.0, hz - h, eps);
  objectNormal = normalize(cross(dz, dx));
}
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif`,
        );

        // Élévation appliquée au vertex
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
transformed.y += waveFn(vec2(position.x, position.z), uTime);`,
        );

        waterShaderRef = shader;
      };

      // ⚡ PLAN PROCÉDURAL = source principale d'eau (continu, pas de seams)
      // Le GLB tilé en-dessous était trop bloc/discontinu → on revient au shader
      const waterPlane = new T.Mesh(planeGeo, planeMat);
      waterPlane.name = '__WATER_WAVES__';   // nom attendu par TransformControls + getter pour studio
      // ⚡ Position + scale FIGÉS par utilisateur via TransformControls (touche C) — Y collé au seaLevel
      waterPlane.position.set(0, -208.597659550242, 163.8830311182667);
      waterPlane.scale.set(0.036236838731633365, 0.06296575699385906, 0.06296575699385906);
      scene.add(waterPlane);
      (this as any).__waterShader = () => waterShaderRef;

      // 🌊 GLB tilé DÉSACTIVÉ — les tuiles GLB restent visibles par bloc, pas de raccord propre
      // On utilise EXCLUSIVEMENT le plan procédural ci-dessus (continuous, infinite)
      // Code gardé en commentaire au cas où on veut le réactiver plus tard.
      /*
      const waterGroup = new T.Group();
      waterGroup.name = '__WATER_WAVES_GLB__';
      waterGroup.position.set(0, -204.07438534178397, 163.8830311182667);
      waterGroup.scale.set(0.036236838731633365, 0.06296575699385906, 0.06296575699385906);
      scene.add(waterGroup);

      console.log(`[YamzyEntry] 🌊 Chargement water_wave_for_ar.glb (1.2 MB) — sera tilé sur la zone…`);
      const arLoader = new T.GLTFLoader();
      arLoader.load('/assets/conclave/models/water_wave_for_ar.glb', (arGltf: any) => {
        const masterAR = arGltf.scene;
        // Audit matériaux pour log
        const arAudit: any[] = [];
        masterAR.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              arAudit.push({ mesh: obj.name, type: m.type, color: m.color ? `#${m.color.getHexString()}` : 'none', hasMap: !!m.map });
            }
          }
        });
        console.log(`[YamzyEntry] 🔍 water_wave_for_ar.glb matériaux (${arAudit.length}) :`, arAudit);

        // ⚡ Patch matériaux UNE FOIS sur le master → applique les valeurs water_waves.glb auditées
        //    Ces props seront partagées par tous les clones (les mats sont des refs)
        masterAR.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              m.side = T.DoubleSide;
              // Applique les valeurs EXACTES auditées du water_waves.glb
              if (m.color) m.color = new T.Color(0x091112);
              if (m.metalness !== undefined) m.metalness = 0.832;
              if (m.roughness !== undefined) m.roughness = 0.051;
              if (m.emissive !== undefined) {
                m.emissive = new T.Color(0x0a2042);
                if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.25;
              }
              if (waterEnvMap && 'envMap' in m) {
                m.envMap = waterEnvMap;
                if (m.envMapIntensity !== undefined) m.envMapIntensity = 1.8;
              }
              m.needsUpdate = true;
            }
          }
        });

        // Calcule la taille native d'une tuile — séparée par axe pour gérer GLB rectangulaires
        const arBbox = new T.Box3().setFromObject(masterAR);
        const arSize = new T.Vector3(); arBbox.getSize(arSize);
        const arX = arSize.x || 1;
        const arZ = arSize.z || 1;
        console.log(`[YamzyEntry] 🌊 GLB native size XZ : (${arX.toFixed(1)}, ${arZ.toFixed(1)}) — espacement adapté par axe`);

        // 🌊 Grille DENSE — espacement par axe + overlap 1% pour cacher les seams
        const TILE_SCALE_AR = 1.0;
        const SEAM_OVERLAP = 0.99;    // 1% overlap entre tuiles → cache les bordures
        const tileSizeX = arX * TILE_SCALE_AR * SEAM_OVERLAP;
        const tileSizeZ = arZ * TILE_SCALE_AR * SEAM_OVERLAP;
        const GRID_N_AR = 20;         // 20×20 = 400 tuiles (vs 81 avant) → coverage 4-5× plus large
        const halfGrid = (GRID_N_AR - 1) / 2;
        const mixers: any[] = [];
        for (let i = 0; i < GRID_N_AR; i++) {
          for (let j = 0; j < GRID_N_AR; j++) {
            const tile = masterAR.clone(true);
            tile.scale.setScalar(TILE_SCALE_AR);
            // ⚡ Espacement DIFFÉRENT pour X et Z → cohérent avec la forme native du GLB
            const offsetX = (i - halfGrid) * tileSizeX;
            const offsetZ = (j - halfGrid) * tileSizeZ;
            tile.position.set(offsetX, 0, offsetZ);
            waterGroup.add(tile);
            // Anim si le GLB en a
            if (arGltf.animations && arGltf.animations.length > 0) {
              const m = new T.AnimationMixer(tile);
              arGltf.animations.forEach((clip: any) => {
                const action = m.clipAction(clip);
                action.setLoop(T.LoopRepeat, Infinity);
                action.play();
              });
              mixers.push(m);
            }
          }
        }
        (this as any).__waterMixers = mixers;
        const coverageX = (GRID_N_AR * tileSizeX).toFixed(0);
        const coverageZ = (GRID_N_AR * tileSizeZ).toFixed(0);
        console.log(`[YamzyEntry] 🌊✓ water_wave_for_ar.glb : grille ${GRID_N_AR}×${GRID_N_AR} = ${GRID_N_AR*GRID_N_AR} tuiles · tile=(${tileSizeX.toFixed(1)}×${tileSizeZ.toFixed(1)})u · couverture=(${coverageX}×${coverageZ})u · ${mixers.length} mixers actifs`);
      }, undefined, (err: any) => {
        console.warn('[YamzyEntry] ⚠ water_wave_for_ar.glb load failed — plan procédural seul', err);
      });
      */

      console.log(`[YamzyEntry] 🌊✓ Plan PROCÉDURAL principal ${PLANE_SIZE}u × ${PLANE_SIZE}u positionné à (0, -204.1, 163.9) avec scale (${0.036.toFixed(3)}, ${0.063.toFixed(3)}, ${0.063.toFixed(3)})`);
    }
    // ⚠ NOTE : le chargement de water_waves.glb (163 MB) n'est PLUS nécessaire
    // (on génère les vagues procéduralement). On le garde commenté au cas où on veut le réactiver.
    /* DÉSACTIVÉ — gardé pour ref :
    {
      const islandBbox = new T.Box3().setFromObject(gltf.scene);
      const islandSize = new T.Vector3(); islandBbox.getSize(islandSize);
      const targetSeaSize = Math.max(islandSize.x, islandSize.z) * 3;
      const seaCenter = new T.Vector3();
      islandBbox.getCenter(seaCenter);
      console.log(`[YamzyEntry] 🌊 Chargement water_waves.glb (~163 MB) — target ${targetSeaSize.toFixed(0)} unités, seaLevel=${seaLevel.toFixed(1)}`);
      const waveLoader = new T.GLTFLoader();
      waveLoader.load('/assets/conclave/models/water_waves.glb', (waveGltf: any) => {
        const masterScene = waveGltf.scene;
        // 🔍 AUDIT matériaux — log ce qu'il y a réellement pour debug
        const materialAudit: any[] = [];
        masterScene.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              materialAudit.push({
                meshName: obj.name,
                matType: m.type,
                color: m.color ? `#${m.color.getHexString()}` : 'none',
                hasMap: !!m.map,
                hasNormalMap: !!m.normalMap,
                hasEnvMap: !!m.envMap,
                emissive: m.emissive ? `#${m.emissive.getHexString()}` : 'none',
                opacity: m.opacity ?? 1,
                transparent: m.transparent,
                metalness: m.metalness,
                roughness: m.roughness,
              });
            }
          }
        });
        console.log(`[YamzyEntry] 🔍 water_waves.glb matériaux audit (${materialAudit.length}) :`);
        materialAudit.forEach((m, i) => {
          console.log(`  [${i}] mesh="${m.meshName}" type=${m.matType} color=${m.color} emissive=${m.emissive} opacity=${m.opacity} transp=${m.transparent} metal=${m.metalness} rough=${m.roughness} hasMap=${m.hasMap} hasNormalMap=${m.hasNormalMap} hasEnvMap=${m.hasEnvMap}`);
        });
        console.table(materialAudit);

        // 🌊 GÉNÈRE UN ENVMAP PROCÉDURAL — ciel gradient bleu pour donner des reflets à la mer
        //    Le GLB utilise MeshStandardMaterial avec metalness 0.83 + roughness 0.05 + AUCUN envMap
        //    → sans environment map, le matériau réfléchit RIEN → noir total
        //    → on génère un envMap simple via PMREMGenerator pour qu'il ait des reflets bleus
        let waterEnvMap: any = null;
        try {
          const pmremGen = new T.PMREMGenerator(renderer);
          // Mini-scène d'environnement : sphère intérieure avec gradient ciel→horizon
          const envScene = new T.Scene();
          const envGeo = new T.SphereGeometry(50, 32, 16);
          // Matériau avec gradient vertical (vertex colors) pour ciel → mer
          envGeo.setAttribute('color', new T.Float32BufferAttribute(
            (() => {
              const colors: number[] = [];
              const positions = envGeo.attributes['position'];
              for (let i = 0; i < positions.count; i++) {
                const y = positions.getY(i);
                const t = (y + 50) / 100;   // 0 (bottom) → 1 (top)
                // Mer profonde en bas → ciel bleu clair en haut
                const r = 0.05 + t * 0.55;
                const g = 0.15 + t * 0.6;
                const b = 0.35 + t * 0.55;
                colors.push(r, g, b);
              }
              return colors;
            })(), 3,
          ));
          const envMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide });
          envScene.add(new T.Mesh(envGeo, envMat));
          waterEnvMap = pmremGen.fromScene(envScene).texture;
          pmremGen.dispose();
          console.log('[YamzyEntry] 🌊 envMap procédural généré pour water_waves (ciel→mer gradient)');
        } catch (e) {
          console.warn('[YamzyEntry] ⚠ PMREMGenerator failed — pas d\'envMap', e);
        }

        // ⚡ Patch matériaux — adapte le shader "ocean" du GLB pour qu'il rende correctement
        //    sans dépendre uniquement de l'envMap (qu'il n'a pas de base)
        masterScene.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              m.side = T.DoubleSide;
              // Le GLB utilise color #091112 (~ noir) avec metal 0.83 / rough 0.05
              // → SANS envMap c'est noir → on rééquilibre vers un PBR "eau" lisible
              m.color = new T.Color(0x1a3a5e);          // bleu eau base (au lieu de #091112)
              m.metalness = 0.45;                        // moins métallique (était 0.83)
              m.roughness = 0.22;                        // un peu plus diffus (était 0.05)
              m.emissive = new T.Color(0x0a2042);        // self-illum bleu foncé
              m.emissiveIntensity = 0.5;
              m.transparent = true;
              m.opacity = 0.88;
              if (waterEnvMap) {
                m.envMap = waterEnvMap;
                m.envMapIntensity = 1.4;                 // les reflets ciel apparaissent
              }
              m.needsUpdate = true;
            }
          }
        });

        // Calcule la taille native du mesh (avec son scale natif)
        const waveBbox = new T.Box3().setFromObject(masterScene);
        const waveSize = new T.Vector3(); waveBbox.getSize(waveSize);
        const waveMaxXZ = Math.max(waveSize.x, waveSize.z) || 1;
        // ⚡ VALEURS UTILISATEUR — captées via gizmo (touche C) sur le groupe water :
        //    scale uniforme = 0.0532, position = (0, -197.95, 161.85)
        //    On applique ces valeurs directement par tuile pour matcher visuellement.
        const USER_TILE_SCALE = 0.053193622136361786;
        const USER_GROUP_POS_X = 0;
        const USER_GROUP_POS_Y = -197.94667405165978;
        const USER_GROUP_POS_Z = 161.85048623570117;
        const tileScale = USER_TILE_SCALE;
        const tileTargetSize = waveMaxXZ * tileScale;
        // 🌊 GRILLE DENSE — 20×20 = 400 tuiles pour couvrir la zone autour de l'île
        //    Tuiles touchent exactement (pas de gap) + très petit overlap pour cacher seams
        //    Couverture ≈ 20 × tile = ~3700 unités (autour du boat + au-dessus de l'île)
        const GRID_N = 20;
        const halfGrid = (GRID_N - 1) / 2;
        const SEAM_OVERLAP = 0.98;   // tuiles légèrement chevauchent (98% spacing) → masque les bordures
        const waterGroup = new T.Group();
        waterGroup.name = '__WATER_WAVES__';
        // ⚡ Position FIGÉE par TransformControls — placée à travers/autour de l'île
        waterGroup.position.set(USER_GROUP_POS_X, USER_GROUP_POS_Y, USER_GROUP_POS_Z);
        scene.add(waterGroup);
        const mixers: any[] = [];
        for (let i = 0; i < GRID_N; i++) {
          for (let j = 0; j < GRID_N; j++) {
            const tile = masterScene.clone(true);
            tile.scale.setScalar(tileScale);
            const offsetX = (i - halfGrid) * tileTargetSize * SEAM_OVERLAP;
            const offsetZ = (j - halfGrid) * tileTargetSize * SEAM_OVERLAP;
            // Position LOCALE dans le groupe (le groupe a déjà la position user)
            tile.position.set(offsetX, 0, offsetZ);
            waterGroup.add(tile);
            // Anims : mixer par tuile (synchronisés au temps 0)
            if (waveGltf.animations && waveGltf.animations.length > 0) {
              const m = new T.AnimationMixer(tile);
              waveGltf.animations.forEach((clip: any) => {
                const action = m.clipAction(clip);
                action.setLoop(T.LoopRepeat, Infinity);
                action.play();
              });
              mixers.push(m);
            }
          }
        }
        (this as any).__waterMixers = mixers;
        const totalCoverage = (GRID_N * tileTargetSize).toFixed(0);
        console.log(`[YamzyEntry] 🌊✓ water_waves.glb : grille ${GRID_N}×${GRID_N} = ${GRID_N*GRID_N} tuiles, scale ×${tileScale.toFixed(3)}, tile=${tileTargetSize.toFixed(1)}u, couverture=${totalCoverage}u, ${mixers.length} mixers actifs, seaLevel=${seaLevel.toFixed(1)}`);
      }, (xhr: any) => {
        if (xhr.total) {
          const pct = (xhr.loaded / xhr.total * 100).toFixed(0);
          if (pct === '25' || pct === '50' || pct === '75' || pct === '100') {
            console.log(`[YamzyEntry] 🌊 water_waves.glb : ${pct}%`);
          }
        }
      }, (err: any) => {
        console.warn('[YamzyEntry] ⚠ water_waves.glb load failed — fallback plan procédural', err);
        // Fallback : si le GLB ne charge pas, on remet le plan procédural simple
        const seaGeo = new T.PlaneGeometry(targetSeaSize, targetSeaSize, 64, 64);
        seaGeo.rotateX(-Math.PI / 2);
        const seaMat = new T.MeshStandardMaterial({
          color: 0x1e90ff, transparent: true, opacity: 0.55,
          roughness: 0.25, metalness: 0.3, side: T.DoubleSide,
        });
        const seaMesh = new T.Mesh(seaGeo, seaMat);
        seaMesh.position.set(seaCenter.x, seaLevel + 0.01, seaCenter.z);
        seaMesh.name = '__SEA_PLANE_FALLBACK__';
        scene.add(seaMesh);
      });
    }
    */

    // ⚡ Collecte d'obstacles + raycast retirés → path direct boat→Keel (perfs ×10)
    const obstacles: any[] = [];   // gardé vide pour compat debug log

    /** Génère un chemin de navigation simple boat → target (courbe douce sans raycast).
     *  Simplifié : 4 waypoints sur une trajectoire en arc → rapide + visuellement OK. */
    const buildBoatPath = (from: any, to: any): any[] => {
      const dx = to.x - from.x, dz = to.z - from.z;
      const totalDist = Math.hypot(dx, dz);
      // Léger sway latéral pour donner un effet de virage naturel
      const perpX = -dz / (totalDist || 1), perpZ = dx / (totalDist || 1);
      const sway = totalDist * 0.05;   // 5% de la distance en latéral
      const points = [
        from.clone(),
        new T.Vector3(from.x + dx * 0.30 + perpX * sway, seaLevel, from.z + dz * 0.30 + perpZ * sway),
        new T.Vector3(from.x + dx * 0.65, seaLevel, from.z + dz * 0.65),
        to.clone(),
      ];
      return points;
    };

    console.log('[YamzyEntry] 🐦 Flow : anim mouette → fly-to-boat (path custom si présent) → fin');

    // Setup mixer + play animation
    const mixer = new T.AnimationMixer(gltf.scene);
    let mainAction: any = null;
    let animDuration = 8;
    if (gltf.animations && gltf.animations.length) {
      const clip = gltf.animations[0];
      mainAction = mixer.clipAction(clip);
      // ⚡ LoopOnce + clamp → l'anim joue 1 fois, à la fin on bascule en fly-to-boat
      mainAction.setLoop(T.LoopOnce, 1);
      mainAction.clampWhenFinished = true;
      mainAction.play();
      animDuration = clip.duration || 8;
      console.log(`[YamzyEntry] Mouette anim "${clip.name}" duration=${animDuration.toFixed(2)}s`);

      // ⚡ Joue aussi YAMZY Idle en boucle (anim "Base Stack" n'a aucun channel YAMZY)
      const yamzyIdleClip = gltf.animations.find((a: any) => /CharacterArmature\|Idle\b/i.test(a.name||''));
      if (yamzyIdleClip) {
        const yamzyAction = mixer.clipAction(yamzyIdleClip);
        yamzyAction.setLoop(T.LoopRepeat, Infinity);
        yamzyAction.play();
        console.log(`[YamzyEntry] 🧙 YAMZY anim "${yamzyIdleClip.name}" (loop ∞) — durée ${yamzyIdleClip.duration.toFixed(2)}s`);
      } else {
        console.warn('[YamzyEntry] ⚠ Aucun clip "CharacterArmature|Idle" trouvé');
      }
    }

    // ⚡ Path animation system : scan les Empties `anim_<id>_<n>` ajoutés dans Blender
    // et anime auto les meshes correspondants. Cf. world-map/path-animation.ts.
    const { extractAnimationPaths, autoAttachPathAnimators } = await import('../world-map/path-animation');
    const animPaths = extractAnimationPaths(gltf.scene, T);
    const pathAnimators = autoAttachPathAnimators(gltf.scene, animPaths, {
      durationSec: animDuration,    // synchronisé sur la durée de l'anim principale
      loop: 'repeat',
      faceForward: true,            // oiseaux/objets s'orientent dans leur direction
    });
    console.log(`[YamzyEntry] ✓ ${pathAnimators.length} path animator(s) actifs (sur ${animPaths.size} paths)`);

    // Animation loop (RAF)
    const clock = new T.Clock();
    let stopped = false;
    // 🐦 Fly-to-boat — déclenché à la fin de l'anim native
    let flyToBoatTriggered = false;
    let flyStartElapsed = 0;
    let flyFromWorld: any = null;
    let flyToWorld: any = null;
    let flyFinished = false;
    let FLY_TO_BOAT_DURATION_SEC = 7;
    // ⚓ Phase boat navigation vers Keel.000 (commence quand flyFinished)
    let boatSailing = false;
    let boatArrived = false;            // ⚡ devient true quand boat atteint Keel.000 → débloque menu UI
    let boatSailingStart = 0;
    let boatPath: any[] | null = null;
    let boatStartLocal: any = null;
    let boatStartWorld: any = null;
    let boatTargetWorld: any = null;
    // ⚡ Passagers du boat — bougent avec lui (YAMZY est sur le bateau)
    // On stocke YAMZY dans l'espace LOCAL du boat → quand boat translate/rotate, YAMZY suit naturellement
    let yamzyOffsetInBoat: any = null;        // Vector3 — position locale dans le boat
    let yamzyQuatInBoat: any = null;          // Quaternion — rotation locale dans le boat
    const BOAT_SAIL_DURATION_SEC = 25;   // ⚡ Plus lent : 25s au lieu de 12s pour mieux profiter du voyage
    // ⚡ Path mouette 100% procédural — généré au trigger (plus de localStorage)
    let savedPath: Array<{ x: number; y: number; z: number }> | null = null;
    console.log(`[YamzyEntry] 🐦 Mouette → boat : trajectoire 100% procédurale (durée ${FLY_TO_BOAT_DURATION_SEC}s)`);
    const animLoop = () => {
      if (stopped) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      mixer.update(dt);
      // ⚡ Update aussi le mixer YAMZY chargé séparément
      if (yamzyMixer) yamzyMixer.update(dt);
      // ⚡ Update du shader procédural des vagues (plan infini)
      const waterShaderGetter = (this as any).__waterShader as (() => any) | undefined;
      if (waterShaderGetter) {
        const sh = waterShaderGetter();
        if (sh && sh.uniforms && sh.uniforms['uTime']) {
          sh.uniforms['uTime'].value = clock.elapsedTime;
        }
      }
      // Backward-compat : ancien système de mixers (grille de tuiles, désactivé)
      const waterMxs = (this as any).__waterMixers as any[] | undefined;
      if (waterMxs && waterMxs.length) {
        for (const m of waterMxs) m.update(dt);
      }
      const waterMx = (this as any).__waterMixer;
      if (waterMx) waterMx.update(dt);
      // ⚡ Met à jour les path animators (objets définis par Empties anim_*_<n>)
      for (const a of pathAnimators) a.update(clock.elapsedTime);

      // ⏭ SKIP MOUETTE — clic bouton "Skip anim mouette" → saute direct à flyFinished
      // On stoppe le mixer, on téléporte la mouette sur le boat (à mouletteBoatNode),
      // puis on laisse la suite (boat sailing) se déclencher normalement.
      if (this.skipMouetteFlag && !flyFinished && mouette && boatNode) {
        try {
          mixer.stopAllAction();
          if (mainAction) { mainAction.stop(); mainAction.enabled = false; }
        } catch {}
        // Cible monde = mouletteBoatNode (point d'atterrissage) ou centre du boat
        const target = new T.Vector3();
        if (mouletteBoatNode) {
          mouletteBoatNode.updateWorldMatrix(true, false);
          mouletteBoatNode.getWorldPosition(target);
        } else {
          boatNode.updateWorldMatrix(true, false);
          const boatBox = new T.Box3().setFromObject(boatNode);
          if (!boatBox.isEmpty()) boatBox.getCenter(target);
          else boatNode.getWorldPosition(target);
        }
        // Pose la mouette à cette position (converti world → local)
        if (mouette.parent) {
          mouette.parent.updateWorldMatrix(true, false);
          const local = target.clone();
          mouette.parent.worldToLocal(local);
          mouette.position.copy(local);
        }
        // Force l'état "fly terminé" pour que le prochain bloc démarre boat sailing
        flyToBoatTriggered = true;
        flyFinished = true;
        flyFromWorld = target.clone();
        flyToWorld = target.clone();
        // Init exploration cam — distance PROCHE de YAMZY (boat world ~4 units, YAMZY ~0.5 units)
        // 6 unités = ~1.5× boat → YAMZY bien visible sur le boat
        exploreDistance = 6;
        explorePitch = 0.25;
        exploreYaw = 0;
        this.introCanExplore.set(true);
        this.skipMouetteFlag = false;
        console.log('[YamzyEntry] ⏭✓ Mouette téléportée sur boat — boat sailing va démarrer (exploreDistance=6)');
      }

      // 🐦 Détecte fin de l'anim native → génère une trajectoire procédurale CONTINUE vers le boat
      if (mainAction && !mainAction.isRunning() && !flyToBoatTriggered && mouette && boatNode) {
        flyToBoatTriggered = true;
        flyStartElapsed = clock.elapsedTime;

        // 📐 1) Position de départ = position monde actuelle de la mouette (où l'anim native l'a laissée)
        flyFromWorld = new T.Vector3();
        mouette.getWorldPosition(flyFromWorld);

        // 📐 2) Direction de vol au moment de la fin de l'anim native = vecteur forward de la mouette
        // (la rotation track du GLB encode son orientation → on en extrait la direction de continuité)
        const mouetteWorldQuat = new T.Quaternion();
        mouette.getWorldQuaternion(mouetteWorldQuat);
        // Forward Blender export = -Z local. Transformé par la rotation actuelle = direction monde de vol
        const flyForward = new T.Vector3(0, 0, -1).applyQuaternion(mouetteWorldQuat).normalize();

        // 📐 3) Cible = node "moulette" enfant du boat (point d'atterrissage exact)
        //         Sinon fallback sur centre du boat
        flyToWorld = new T.Vector3();
        if (mouletteBoatNode) {
          mouletteBoatNode.updateWorldMatrix(true, false);
          mouletteBoatNode.getWorldPosition(flyToWorld);
        } else {
          boatNode.updateWorldMatrix(true, false);
          const boatBox = new T.Box3().setFromObject(boatNode);
          if (!boatBox.isEmpty()) boatBox.getCenter(flyToWorld);
          else boatNode.getWorldPosition(flyToWorld);
        }

        // 📐 4) Génère une trajectoire procédurale fluide :
        //   - Démarre exactement à flyFromWorld
        //   - Continue dans la direction flyForward pendant 20% de la distance (continuité de vol)
        //   - Monte en arc (apex au milieu) pour donner l'effet de planer
        //   - Descend doucement vers le boat
        const totalDist = flyFromWorld.distanceTo(flyToWorld);
        const arcHeight = Math.max(50, totalDist * 0.12);
        savedPath = [];
        savedPath.push({ x: flyFromWorld.x, y: flyFromWorld.y, z: flyFromWorld.z });
        // wp1 : continuité de la direction de vol (20% en avant + petit lift)
        const wp1 = flyFromWorld.clone().addScaledVector(flyForward, totalDist * 0.20);
        wp1.y += arcHeight * 0.4;
        savedPath.push({ x: wp1.x, y: wp1.y, z: wp1.z });
        // wp2 : apex de l'arc (mi-chemin, hauteur max)
        const wp2 = flyFromWorld.clone().lerp(flyToWorld, 0.50);
        wp2.y += arcHeight;
        savedPath.push({ x: wp2.x, y: wp2.y, z: wp2.z });
        // wp3 : amorce descente (80% chemin)
        const wp3 = flyFromWorld.clone().lerp(flyToWorld, 0.80);
        wp3.y += arcHeight * 0.35;
        savedPath.push({ x: wp3.x, y: wp3.y, z: wp3.z });
        // wp4 : arrivée boat
        savedPath.push({ x: flyToWorld.x, y: flyToWorld.y, z: flyToWorld.z });

        // Désactive le mixer pour que la mouette suive notre code (pas l'anim qui clamp)
        try {
          mixer.stopAllAction();
          mainAction.stop();
          mainAction.enabled = false;
        } catch {}
        console.log(`[YamzyEntry] 🐦 Fly START [PROCEDURAL ${savedPath.length} pts] → boat (${flyToWorld.x.toFixed(0)}, ${flyToWorld.y.toFixed(0)}, ${flyToWorld.z.toFixed(0)}), forward=(${flyForward.x.toFixed(2)}, ${flyForward.y.toFixed(2)}, ${flyForward.z.toFixed(2)}), arc=${arcHeight.toFixed(0)}, ${FLY_TO_BOAT_DURATION_SEC}s`);
      }
      // Phase de vol — multi-segment path OU lerp simple + arc
      if (flyToBoatTriggered && flyFromWorld && flyToWorld && mouette && !flyFinished) {
        const t = Math.min(1, (clock.elapsedTime - flyStartElapsed) / FLY_TO_BOAT_DURATION_SEC);
        let target: any;
        let worldQuat: any = null;
        if (savedPath && savedPath.length >= 2) {
          // Multi-segment le long des waypoints
          const n = savedPath.length - 1;
          const segT = t * n;
          const i = Math.min(Math.floor(segT), n - 1);
          const u = segT - i;
          const ease = u * u * (3 - 2 * u);
          const a = savedPath[i], b = savedPath[i + 1];
          target = new T.Vector3(
            a.x + (b.x - a.x) * ease,
            a.y + (b.y - a.y) * ease,
            a.z + (b.z - a.z) * ease,
          );
        } else {
          // Fallback : straight + arc
          const ease = t * t * (3 - 2 * t);
          target = flyFromWorld.clone().lerp(flyToWorld, ease);
          const arc = Math.sin(t * Math.PI) * Math.max(50, flyFromWorld.distanceTo(flyToWorld) * 0.1);
          target.y += arc;
        }
        if (mouette.parent) {
          mouette.parent.updateWorldMatrix(true, false);
          const local = target.clone();
          mouette.parent.worldToLocal(local);
          mouette.position.copy(local);
          if (worldQuat) {
            const parentQ = new T.Quaternion();
            mouette.parent.getWorldQuaternion(parentQ);
            const localQ = parentQ.invert().multiply(worldQuat);
            mouette.quaternion.copy(localQ);
          }
        }
        if (t >= 1) {
          flyFinished = true;
          // ⚡ Active le mode exploration libre (drag + wheel zoom autorisés)
          // Distance PROCHE de YAMZY pour cinématique 3rd person bien lisible (boat world ~4u, YAMZY ~0.5u)
          exploreDistance = 1;
          explorePitch = 0.25;
          exploreYaw = 0;
          this.introCanExplore.set(true);
          this.mouettePhase.set(false);  // ⏭ cache le bouton skip (phase mouette terminée)
          console.log(`[YamzyEntry] 🐦✓ Mouette arrivée — démarrage boat + exploration libre activée (exploreDistance=6)`);
          console.log(`[YamzyEntry] 🔍 DEBUG états trigger boat → flyFinished=${flyFinished} boatNode=${!!boatNode} keelNode=${!!keelNode} seaLevel=${seaLevel.toFixed(1)} obstacles=${obstacles.length}`);
        }
      }

      // ⚓ Démarre la navigation du boat UNE SEULE FOIS (after mouette arrived)
      if (flyFinished && !boatSailing && !boatArrived && boatNode && boatDestNode) {
        boatSailing = true;
        boatSailingStart = clock.elapsedTime;
        // Snapshot position locale + monde du boat au moment du démarrage
        boatStartLocal = boatNode.position.clone();
        boatNode.updateWorldMatrix(true, false);
        boatStartWorld = new T.Vector3();
        boatNode.getWorldPosition(boatStartWorld);
        // ⚡ Cible monde = chezYamzy (vraie maison) ou Keel.000 (fallback)
        boatDestNode.updateWorldMatrix(true, false);
        boatTargetWorld = new T.Vector3();
        boatDestNode.getWorldPosition(boatTargetWorld);
        boatTargetWorld.y = seaLevel;
        boatStartWorld.y = seaLevel;
        boatPath = buildBoatPath(boatStartWorld, boatTargetWorld);
        // ⚡ YAMZY déjà parenté au boat (via boatNode.add(yScene)) → suit auto, rien à faire ici
        const destName = chezYamzyNode ? 'chezYamzy' : 'Keel.000';
        console.log(`[YamzyEntry] ⚓ Boat START → ${destName} (${boatTargetWorld.x.toFixed(0)}, ${boatTargetWorld.z.toFixed(0)}), ${boatPath.length} waypoints, ${BOAT_SAIL_DURATION_SEC}s. YAMZY embarqué.`);
      }

      // ⚓ Phase de navigation du boat (multi-segment lerp + orientation vers direction de mouvement)
      if (boatSailing && boatPath && boatPath.length >= 2 && boatNode) {
        const t = Math.min(1, (clock.elapsedTime - boatSailingStart) / BOAT_SAIL_DURATION_SEC);
        // Smoothstep global
        const tEase = t * t * (3 - 2 * t);
        const n = boatPath.length - 1;
        const segT = tEase * n;
        const i = Math.min(Math.floor(segT), n - 1);
        const u = segT - i;
        const a = boatPath[i], b = boatPath[i + 1];
        const worldTarget = new T.Vector3(
          a.x + (b.x - a.x) * u,
          seaLevel,
          a.z + (b.z - a.z) * u,
        );
        // Direction du mouvement (oriente la PROUE du boat vers le mouvement)
        // bowOffsetAngle = angle de la proue (= marker yamzy) dans le repère local de boatNode
        // À yaw θ, la proue pointe dans direction monde = bowOffsetAngle + θ
        // → on veut bowOffsetAngle + θ = atan2(dirX, dirZ) → θ = atan2(dirX, dirZ) - bowOffsetAngle
        const dirX = b.x - a.x, dirZ = b.z - a.z;
        const yawTarget = bowOffsetMeasured
          ? Math.atan2(dirX, dirZ) - bowOffsetAngle
          : Math.atan2(dirX, dirZ) + Math.PI;  // fallback ancien comportement si boad pas chargé
        // Convertit world → local pour assigner à boat.position
        if (boatNode.parent) {
          boatNode.parent.updateWorldMatrix(true, false);
          const local = worldTarget.clone();
          boatNode.parent.worldToLocal(local);
          boatNode.position.copy(local);
          // Orientation : convertit yaw monde → local quaternion
          const worldQuat = new T.Quaternion().setFromEuler(new T.Euler(0, yawTarget, 0, 'YXZ'));
          const parentQ = new T.Quaternion();
          boatNode.parent.getWorldQuaternion(parentQ);
          const localQ = parentQ.invert().multiply(worldQuat);
          boatNode.quaternion.slerp(localQ, 0.08);   // rotation douce
        }
        // Petit bobbing vertical pour donner l'illusion de flotter
        boatNode.position.y += Math.sin(clock.elapsedTime * 1.5) * 0.3;

        // ⚡ YAMZY est CHILD du boat (parenté dans la scène 3D) → transform hérité auto
        // Pas besoin de code manuel : Three.js applique la transform du boat à YAMZY naturellement

        if (t >= 1) {
          console.log('[YamzyEntry] ⚓✓ Boat arrivé — 🎥 FREE CAM mode (drag souris = orbit · wheel = zoom · L = log)');
          boatSailing = false;
          boatArrived = true;
          // ⚡ FREE CAM activé par défaut → la cam ne suit pas YAMZY
          //    L'user positionne avec la souris (drag = orbit, wheel = zoom)
          (this as any).__freeCamMode = true;
          // Distance initiale = 5 (vue large pour explorer)
          exploreDistance = 5;
          explorePitch = 0.30;
          // ⚡ TransformControls/Studio DÉSACTIVÉ — tout validé, pas besoin d'éditer
          // this.attachYamzyTransformControls(T, camera, renderer, yamzyNode, scene);
          // 🎮 ACTIVE MODE DRIVE GTA — keyboard WASD/ZQSD/flèches pour piloter le boat
          this.boatDriveEnabled = true;
          this.boatVelocity = 0;
          // 🖱 Tracker position curseur souris (X) → steering automatique
          //   Curseur à droite de l'écran = bateau tourne à droite, gauche = gauche
          (this as any).__mouseSteerX = 0;
          const onMouseMove = (e: MouseEvent) => {
            if (!boatArrived || !this.boatDriveEnabled) return;
            const w = window.innerWidth;
            const centerX = w / 2;
            // -1 (gauche extrême) → +1 (droite extrême), zone morte 10% au centre
            const offset = (e.clientX - centerX) / centerX;
            const deadzone = 0.10;
            let steer = 0;
            if (offset > deadzone) steer = (offset - deadzone) / (1 - deadzone);
            else if (offset < -deadzone) steer = (offset + deadzone) / (1 - deadzone);
            (this as any).__mouseSteerX = Math.max(-1, Math.min(1, steer));
          };
          window.addEventListener('mousemove', onMouseMove);
          const onDriveDown = (e: KeyboardEvent) => {
            const tEl = e.target as HTMLElement;
            if (tEl && (tEl.tagName === 'INPUT' || tEl.tagName === 'TEXTAREA' || tEl.tagName === 'SELECT')) return;
            const k = e.key.toLowerCase();
            // 🚫 Empêche le navigateur de scroller la page sur les flèches
            if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
              e.preventDefault();
            }
            this.boatDriveKeys.add(k);
            // 📋 Touche L = log cam state (pos + lookAt + boat pos + exploreYaw/Pitch/Distance)
            if (k === 'l') {
              const camPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
              const bp = new T.Vector3();
              if (boatNode) boatNode.getWorldPosition(bp);
              const yamzyPos = new T.Vector3();
              if (yamzyNode) yamzyNode.getWorldPosition(yamzyPos);
              const camDir = new T.Vector3();
              camera.getWorldDirection(camDir);
              const data = {
                camera: {
                  position: camPos,
                  direction: { x: camDir.x, y: camDir.y, z: camDir.z },
                  fov: camera.fov,
                  near: camera.near,
                  far: camera.far,
                },
                boat: { position: { x: bp.x, y: bp.y, z: bp.z } },
                yamzy: { position: { x: yamzyPos.x, y: yamzyPos.y, z: yamzyPos.z } },
                orbit: {
                  yaw: (this as any).__camLoggedYaw || 0,
                  pitch: (this as any).__camLoggedPitch || 0,
                  distance: (this as any).__camLoggedDistance || 0,
                },
              };
              const txt = JSON.stringify(data, null, 2);
              console.log('[YamzyEntry] 📋 CAM LOG :', data);
              try {
                navigator.clipboard.writeText(txt).then(
                  () => console.log('[YamzyEntry] ✓ Cam state copié dans le presse-papier (Ctrl+V pour coller)'),
                  () => {}
                );
              } catch {}
            }
            // 🎮 Touche V = toggle FREE CAM (mouse orbit) ↔ GTA CAM
            if (k === 'v') {
              (this as any).__freeCamMode = !((this as any).__freeCamMode);
              const mode = (this as any).__freeCamMode ? 'FREE (souris)' : 'GTA (drive)';
              console.log(`[YamzyEntry] 🎥 Mode cam : ${mode}`);
            }
          };
          const onDriveUp = (e: KeyboardEvent) => this.boatDriveKeys.delete(e.key.toLowerCase());
          window.addEventListener('keydown', onDriveDown);
          window.addEventListener('keyup', onDriveUp);
          console.log('[YamzyEntry] 🎮 Drive actif · Touches : WASD/ZQSD drive · L = log cam · V = toggle Free Cam (souris)');
        }
      }

      // 🎮 MODE GTA DRIVE — quand boatArrived, le user pilote le boat au clavier + souris
      if (this.boatDriveEnabled && boatArrived && boatNode) {
        const keys = this.boatDriveKeys;
        // Configuration physique — vitesse réduite pour navigation contrôlée
        const MAX_SPEED = 20;
        const MAX_REVERSE = -10;
        const DRAG = 0.92;
        const TURN_RATE = 1.4;
        // Détecte les touches (WASD anglais + ZQSD français + flèches)
        const forward = keys.has('w') || keys.has('z') || keys.has('arrowup');
        const backward = keys.has('s') || keys.has('arrowdown');
        const left = keys.has('a') || keys.has('q') || keys.has('arrowleft');
        const right = keys.has('d') || keys.has('arrowright');
        // ⚡ Velocity smoothe vers target via lerp exponentiel → pas de saccade au démarrage
        let targetVel = 0;
        if (forward) targetVel = MAX_SPEED;
        else if (backward) targetVel = MAX_REVERSE;
        else targetVel = this.boatVelocity * DRAG;
        const accelLerp = 1 - Math.exp(-dt * 2.5);
        this.boatVelocity = this.boatVelocity + (targetVel - this.boatVelocity) * accelLerp;
        if (Math.abs(this.boatVelocity) < 0.02) this.boatVelocity = 0;
        // Steering (effectif seulement si on bouge) — clavier ET souris combinés
        if (Math.abs(this.boatVelocity) > 0.1) {
          // ⚡ Signes CORRIGÉS : gauche tourne à gauche, droite à droite
          //   Math : flipper UN seul des signes pour break la symétrie de double-flip
          let steerInput = 0;
          if (left) steerInput -= 1;
          if (right) steerInput += 1;
          if (!isDragging) {
            const mouseSteer = (this as any).__mouseSteerX || 0;
            steerInput += mouseSteer;     // ⚡ += pour cohérence : curseur droite (+) → steerInput +, rotation.y +
          }
          steerInput = Math.max(-1, Math.min(1, steerInput));
          const turnPower = (this.boatVelocity / MAX_SPEED) * TURN_RATE * dt * steerInput;
          boatNode.rotation.y += turnPower;   // ⚡ += (flip de -= → +=) → gauche/droite cohérents avec la perspective driver
        }
        // Applique la vélocité dans la direction de REGARD de YAMZY (W = avance là où YAMZY regarde)
        const driveDir = new T.Vector3();
        if (yamzyNode) {
          yamzyNode.getWorldDirection(driveDir);
          driveDir.y = 0;
          if (driveDir.lengthSq() < 0.001) {
            const worldYaw = boatNode.rotation.y + bowOffsetAngle;
            driveDir.set(Math.sin(worldYaw), 0, Math.cos(worldYaw));
          } else driveDir.normalize();
        } else {
          const worldYaw = boatNode.rotation.y + bowOffsetAngle;
          driveDir.set(Math.sin(worldYaw), 0, Math.cos(worldYaw));
        }
        // 🛡 NAVIGATION INTELLIGENTE : raycast avant de bouger pour éviter de traverser des objets
        //   ⚡ Throttle : raycast 1 frame sur 3 → ~3× moins de coût CPU sans impact visuel
        (this as any).__collisionFrameCount = ((this as any).__collisionFrameCount || 0) + 1;
        const shouldRaycast = ((this as any).__collisionFrameCount % 3) === 0;
        const obstacles = (this as any).__boatObstacles as any[];
        let canMove = true;
        if (shouldRaycast && obstacles && obstacles.length && Math.abs(this.boatVelocity) > 0.1) {
          // Position de départ du ray = position monde du boad VISIBLE (pas le marker)
          const rayOrigin = new T.Vector3();
          const boadRef2 = (this as any).__boadRef;
          if (boadRef2) boadRef2.getWorldPosition(rayOrigin);
          else boatNode.getWorldPosition(rayOrigin);
          rayOrigin.y = seaLevel + 0.3;   // un poil au-dessus de l'eau (évite de raycast sous l'eau)
          // Direction = sens du mouvement (driveDir si avant, -driveDir si arrière)
          const rayDir = new T.Vector3(driveDir.x, 0, driveDir.z);
          if (this.boatVelocity < 0) rayDir.negate();
          rayDir.normalize();
          const raycaster = new T.Raycaster(rayOrigin, rayDir);
          // Distance de détection : proportionnelle à la vitesse + buffer fixe (taille du boat ~4u)
          const COLLISION_BUFFER = 2.5;
          const lookAheadDist = Math.abs(this.boatVelocity) * dt * 60 * 0.5 + COLLISION_BUFFER;
          raycaster.far = lookAheadDist;
          const hits = raycaster.intersectObjects(obstacles, false);
          if (hits.length > 0 && hits[0].distance < COLLISION_BUFFER) {
            // Obstacle DEVANT → stoppe brusquement (kick back)
            this.boatVelocity *= -0.3;   // petit rebond
            canMove = false;
          }
        }
        // Applique le déplacement uniquement si pas de collision imminente
        if (canMove) {
          boatNode.position.x += driveDir.x * this.boatVelocity * dt;
          boatNode.position.z += driveDir.z * this.boatVelocity * dt;
        }
        // ⚡ FLOTTAISON SUR LES VAGUES : reproduit la fonction waveFn() du shader GLSL côté CPU
        //   Le boat suit exactement la surface de l'eau au niveau (boat.x, boat.z) → plus de "submergé"
        const WP_X = 0;                                  // water plane position X
        const WP_Z = 163.8830311182667;                  // water plane position Z
        const WP_SCALE_X = 0.036236838731633365;         // water plane scale X
        const WP_SCALE_Z = 0.06296575699385906;          // water plane scale Z (= scale Y du plan = amplitude factor)
        const lx = (boatNode.position.x - WP_X) / WP_SCALE_X;
        const lz = (boatNode.position.z - WP_Z) / WP_SCALE_Z;
        const t = clock.elapsedTime;
        const dot2 = (px: number, py: number, dx: number, dy: number) => px * dx + py * dy;
        let waveH = 0;
        waveH += Math.sin(dot2(lx, lz,  0.95,  0.31) * 0.035 + t * 0.8) * 1.2;
        waveH += Math.sin(dot2(lx, lz,  0.66, -0.75) * 0.045 + t * 1.0) * 1.0;
        waveH += Math.sin(dot2(lx, lz, -0.50,  0.87) * 0.08  + t * 1.4) * 0.6;
        waveH += Math.sin(dot2(lx, lz,  0.31,  0.95) * 0.11  + t * 1.6) * 0.45;
        waveH += Math.sin(dot2(lx, lz, -0.91, -0.42) * 0.18  + t * 2.1) * 0.2;
        waveH += Math.cos(dot2(lx, lz,  0.62,  0.78) * 0.27  + t * 2.7) * 0.12;
        waveH += Math.sin(dot2(lx, lz,  0.77, -0.64) * 0.55  + t * 3.5) * 0.04;
        const waterSurfaceY = seaLevel + waveH * WP_SCALE_Z;   // converti local h → world Y
        const BOAT_FLOAT_OFFSET = 0.4;                          // boat repose 0.4u au-dessus → jamais submergé
        boatNode.position.y = waterSurfaceY + BOAT_FLOAT_OFFSET;
      }

      // ━━━ Caméra ━━━
      // PHASE 1 (anim + fly) : orbit autour de la mouette à distance 0.8
      // PHASE 2 (après fly) : suit YAMZY pendant sailing, puis orbit YAMZY après arrival
      if (flyFinished && (yamzyNode || boatNode)) {
        // ⚡ Cible cam :
        //   - boatSailing : suit YAMZY_chez s'il est chargé (name='__YAMZY_LOADED__')
        //     sinon fallback boatNode (yamzyNode pourrait être le marker statique de l'intro-island)
        //   - sinon (après arrival) : orbit autour de yamzyNode (toujours le YAMZY_chez à ce moment-là)
        const isYamzyChezLoaded = yamzyNode && yamzyNode.name === '__YAMZY_LOADED__';
        // ⚡ Cible cam : YAMZY (priorité) — la cam suit l'avatar partout
        //   Fallback boad visible si yamzy pas chargé, fallback final boatNode
        const boadVisible = (this as any).__boadRef;
        const camTarget = yamzyNode || boadVisible || boatNode;
        const yc = new T.Vector3();
        camTarget.getWorldPosition(yc);
        if (camera.far < exploreDistance * 3) {
          camera.far = exploreDistance * 3;
          camera.updateProjectionMatrix();
        }
        // ⚡ 2 modes de cam selon la phase :
        if (boatSailing && boatNode && !isDragging) {
          // 🎬 CINÉMATIQUE pendant navigation : DERRIÈRE le dos de YAMZY
          //    Utilise la direction de regard de YAMZY (pas la bow direction)
          const yamzyForward = new T.Vector3();
          if (yamzyNode) {
            yamzyNode.getWorldDirection(yamzyForward);
            yamzyForward.y = 0;
            if (yamzyForward.lengthSq() < 0.001) yamzyForward.set(0, 0, 1);
            else yamzyForward.normalize();
          } else {
            const worldYaw = boatNode.rotation.y + bowOffsetAngle;
            yamzyForward.set(Math.sin(worldYaw), 0, Math.cos(worldYaw));
          }
          const D = exploreDistance;
          const H = D * 0.4;
          // Cam derrière le dos
          const desiredCamPos = new T.Vector3(
            yc.x - yamzyForward.x * D,
            yc.y + H,
            yc.z - yamzyForward.z * D,
          );
          // Regard dans le sens du regard de YAMZY
          const lookAhead = new T.Vector3(
            yc.x + yamzyForward.x * D * 1.5,
            yc.y + H * 0.3,
            yc.z + yamzyForward.z * D * 1.5,
          );
          camera.position.lerp(desiredCamPos, 0.6);
          camera.lookAt(lookAhead);
        } else if (this.boatDriveEnabled && boatArrived && boatNode && !(this as any).__freeCamMode && !isDragging) {
          // 🎮 CAM GTA-STYLE : DERRIÈRE le dos de YAMZY (utilise sa vraie direction de regard)
          //   Position cam = YAMZY world pos (yc) - yamzyForward × D → toujours derrière son dos
          //   lookAt = yc + yamzyForward × 2D → on regarde dans le sens du regard de YAMZY
          // ⚡ targetPos = position de YAMZY (pas du boat) → cam mappée sur l'avatar
          const targetPos = new T.Vector3().copy(yc);
          // Direction de regard de YAMZY en monde (priorité) → fallback bow direction
          const yamzyForward = new T.Vector3();
          if (yamzyNode) {
            yamzyNode.getWorldDirection(yamzyForward);
            yamzyForward.y = 0;
            if (yamzyForward.lengthSq() < 0.001) yamzyForward.set(0, 0, 1);
            else yamzyForward.normalize();
          } else {
            // Fallback : bow direction
            const worldYaw = boatNode.rotation.y + bowOffsetAngle;
            yamzyForward.set(Math.sin(worldYaw), 0, Math.cos(worldYaw));
          }
          const D = exploreDistance;
          const H = D * 0.4;
          // Cam DERRIÈRE le dos (opposé de la direction de regard)
          const desiredCamPos = new T.Vector3(
            targetPos.x - yamzyForward.x * D,
            targetPos.y + H,
            targetPos.z - yamzyForward.z * D,
          );
          // Regard DEVANT YAMZY (dans le sens de son regard)
          const lookAhead = new T.Vector3(
            targetPos.x + yamzyForward.x * D * 2,
            targetPos.y + H * 0.3,
            targetPos.z + yamzyForward.z * D * 2,
          );
          camera.position.lerp(desiredCamPos, 0.85);
          camera.lookAt(lookAhead);
        } else {
          // 🎮 ORBIT user-controlled (drag souris = yaw/pitch, wheel = zoom)
          // ⚡ Auto-rotation DÉSACTIVÉE après boat arrived (mode édition stable)
          if (!isDragging && !boatArrived) exploreYaw += dt * 0.08;
          const desiredCamPos = new T.Vector3(
            yc.x + Math.sin(exploreYaw) * exploreDistance * Math.cos(explorePitch),
            yc.y + Math.sin(explorePitch) * exploreDistance,
            yc.z + Math.cos(exploreYaw) * exploreDistance * Math.cos(explorePitch),
          );
          // ⚡ Lerp adaptatif :
          //   - boatSailing : 0.5 (suit le boat qui bouge à 12s/destination)
          //   - drive arrivé : 0.45 (orbit pendant que le boat bouge au clavier → cam doit suivre)
          //   - sinon : 0.15 (orbit standard, smooth)
          const lerpFactor = boatSailing ? 0.5
                          : (this.boatDriveEnabled && boatArrived ? 0.45 : 0.15);
          camera.position.lerp(desiredCamPos, lerpFactor);
          camera.lookAt(yc);
          // 📋 Stocke les valeurs orbit pour le log clavier (touche L)
          (this as any).__camLoggedYaw = exploreYaw;
          (this as any).__camLoggedPitch = explorePitch;
          (this as any).__camLoggedDistance = exploreDistance;
        }
      } else if (mouette) {
        // ━━━ Cam ULTRA-PROCHE de la mouette (distance EXACTE 0.5) ━━━
        // Lerp rapide (0.4) → suit la mouette même pendant le fly-to-boat à grande vitesse
        const mouettePos = new T.Vector3();
        mouette.getWorldPosition(mouettePos);
        const D = 0.5;
        const yawCam = clock.elapsedTime * 0.4;
        const pitchCam = 0.25;
        const desiredCamPos = new T.Vector3(
          mouettePos.x + Math.sin(yawCam) * D * Math.cos(pitchCam),
          mouettePos.y + Math.sin(pitchCam) * D,
          mouettePos.z + Math.cos(yawCam) * D * Math.cos(pitchCam),
        );
        camera.position.lerp(desiredCamPos, 0.4);
        camera.lookAt(mouettePos);
      }
      // ⚡ CLAMP : la cam ne descend JAMAIS sous le niveau de l'eau
      //   Empêche de voir l'envers du plan d'eau / la zone vide sous la surface
      const minCamY = seaLevel + 0.5;   // 0.5u au-dessus de l'eau
      if (camera.position.y < minCamY) camera.position.y = minCamY;

      renderer.render(scene, camera);
      requestAnimationFrame(animLoop);
    };
    animLoop();

    // ⚡ L'intro tourne en boucle infinie. Skip = fade out. Sinon safety timeout (30 min).
    const start = performance.now();
    const maxIdleWaitMs = 30 * 60 * 1000;
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const elapsed = (performance.now() - start);
        // ⚡ Résout :
        //   - boatArrived = true (boat à Keel.000 → menu UI peut s'afficher)
        //   - OU skip user
        //   - OU safety timeout (30 min)
        if (boatArrived || this.introSkipRequested || elapsed >= maxIdleWaitMs) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 80);
    });

    // ⚡ Boat arrivé à Keel.000 → on GARDE la scène 3D visible (pas de fade, pas de cleanup)
    // → la cam reste sur YAMZY, le user peut explorer (drag + wheel)
    // → animLoop continue de tourner pour les anims YAMZY Idle + bobbing
    console.log('[YamzyEntry] ✓ Boat arrivé — scène libre maintenue, YAMZY explore l\'île');
    // Si le user a skip pendant l'anim native (avant boat arrived), là on cleanup quand même
    if (this.introSkipRequested && !boatArrived) {
      window.removeEventListener('pointerdown', onIntroPointerDown);
      window.removeEventListener('pointermove', onIntroPointerMove);
      window.removeEventListener('pointerup', onIntroPointerUp);
      window.removeEventListener('wheel', onIntroWheel);
      this.introFading.set(true);
      await new Promise(r => setTimeout(r, 600));
      stopped = true;
      try {
        gltf.scene.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
            else obj.material.dispose?.();
          }
        });
        renderer.dispose();
      } catch {}
      this.showIntro.set(false);
      this.introCanExplore.set(false);
      console.log('[YamzyEntry] ✓ Intro skipped — cleanup');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🗺 STANDALONE WORLD MAP — charge treasure-island.glb (île animée)
  // (utilisée comme scène finale après l'intro mouette)
  // ═══════════════════════════════════════════════════════════════════
  private buildStandaloneWorldMap(T: any): void {
    // Lumières doré-soleil pour l'île au trésor
    const ambient = new T.AmbientLight(0xfff0c8, 0.6);
    this.scene.add(ambient);
    const keyLight = new T.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);
    const hemi = new T.HemisphereLight(0x9bd8ff, 0xc28a4a, 0.5);
    this.scene.add(hemi);

    // Charge le GLB de l'île au trésor
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) {
      const draco = new T.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(draco);
    }
    loader.load('/assets/conclave/models/treasure-island.glb', (gltf: any) => {
      if (this.disposed) return;
      const island = gltf.scene;
      island.name = 'treasure_island_map';
      this.scene.add(island);

      // 🎯 IDENTIFICATION DE LA STRUCTURE DU GLB
      //   Plane_2 (bbox 1.73 × 0.54 × 2.00) = surface principale de l'île — RÉFÉRENCE
      //   Sphere_10 = fantôme (anim translation) — NE PAS CONFONDRE avec nos markers
      //   Cube_4 = coffre au trésor (rotation + scale anim)
      let planeNode: any = null;
      island.traverse((obj: any) => {
        if (!planeNode && obj.name === 'Plane_2') planeNode = obj;
      });
      if (!planeNode) {
        console.warn('[YamzyEntry] ⚠ Plane_2 introuvable dans le GLB — fallback sur scene bbox');
        planeNode = island;
      } else {
        console.log('[YamzyEntry] ✓ Plane_2 trouvé — utilisé comme RÉFÉRENCE d\'ancrage');
      }

      // Auto-fit : scale pour que l'île tienne dans 1.0 unité (basé sur Plane_2)
      island.updateWorldMatrix(true, true);
      const refBbox = new T.Box3().setFromObject(planeNode);
      const refSize = new T.Vector3(); refBbox.getSize(refSize);
      const refMaxDim = Math.max(refSize.x, refSize.z);   // dim horizontale max
      const TARGET_SIZE = 1.0;
      const scale = TARGET_SIZE / refMaxDim;
      island.scale.setScalar(scale);
      island.updateWorldMatrix(true, true);

      // Re-center sur Plane_2 (et non sur le scene global qui inclut le coffre décalé)
      const newRefBbox = new T.Box3().setFromObject(planeNode);
      const newRefCenter = new T.Vector3(); newRefBbox.getCenter(newRefCenter);
      island.position.sub(newRefCenter);
      island.updateWorldMatrix(true, true);

      // Recompute final bbox de Plane_2 après scale + centrage → coordonnées world
      const finalBbox = new T.Box3().setFromObject(planeNode);
      const finalSize = new T.Vector3(); finalBbox.getSize(finalSize);
      const finalCenter = new T.Vector3(); finalBbox.getCenter(finalCenter);
      const surfaceTopY = finalBbox.max.y;
      console.log(`[YamzyEntry] ✓ Plane_2 final bbox — size=(${finalSize.x.toFixed(2)}, ${finalSize.y.toFixed(2)}, ${finalSize.z.toFixed(2)}), top=${surfaceTopY.toFixed(2)}, center=(${finalCenter.x.toFixed(2)}, ${finalCenter.y.toFixed(2)}, ${finalCenter.z.toFixed(2)})`);

      // Setup mixer pour jouer l'animation (Cube_4 rotation + Sphere_10 fantôme)
      if (gltf.animations && gltf.animations.length) {
        const mixer = new T.AnimationMixer(island);
        for (const clip of gltf.animations) {
          mixer.clipAction(clip).play();
        }
        (this as any).treasureIslandMixer = mixer;
        console.log(`[YamzyEntry] ✓ Treasure island anim (cube spin + ghost float) — ${gltf.animations.length} clip(s)`);
      }

      // Ajoute les 7 drapeaux RELATIFS à Plane_2 bbox (pas de sphères pour ne pas confondre avec le fantôme)
      this.addFlagMarkers(T, finalCenter, finalSize, surfaceTopY);
    },
    undefined,
    (err: any) => {
      console.error('[YamzyEntry] treasure-island.glb load failed', err);
    });
  }

  /** Pose 7 DRAPEAUX (mast + flag) sur la surface de l'île, positions relatives à Plane_2 bbox.
   *  Format des markers volontairement différent des sphères pour ne pas se confondre
   *  avec le fantôme (Sphere_10) du GLB. */
  private addFlagMarkers(T: any, planeCenter: any, planeSize: any, surfaceTopY: number): void {
    const halfX = planeSize.x / 2;
    const halfZ = planeSize.z / 2;

    // Coordonnées normalisées (-1 à +1) sur la surface de Plane_2
    // Layout : YAMZY centre, 4 sous-îles cardinales, WORKSHOPS+STUDIOS au sud
    const ZONES = [
      { key: 'yamzy',     label: 'YAMZY',     nx:  0.0,  nz:  0.0,  color: 0xd54adf, route: '/yamzy-island',       icon: '💎' },
      { key: 'strategy',  label: 'STRATEGY',  nx: -0.55, nz: -0.65, color: 0xc4b5fd, route: '/island/strategy',    icon: '🌌' },
      { key: 'knowledge', label: 'KNOWLEDGE', nx:  0.55, nz: -0.65, color: 0x06b6d4, route: '/island/knowledge',   icon: '🏛' },
      { key: 'delivery',  label: 'DELIVERY',  nx: -0.75, nz:  0.0,  color: 0x86efac, route: '/island/delivery',    icon: '🌿' },
      { key: 'commerce',  label: 'COMMERCE',  nx:  0.75, nz:  0.0,  color: 0xfbbf24, route: '/island/commerce',    icon: '⚗' },
      { key: 'workshops', label: 'WORKSHOPS', nx: -0.40, nz:  0.65, color: 0x10b981, route: '/yamzy-rooms',        icon: '🪴' },
      { key: 'studios',   label: 'STUDIOS',   nx:  0.40, nz:  0.65, color: 0xb87333, route: '/yamzy-studio-maker', icon: '🏗' },
    ];

    const FLAG_HEIGHT = 0.18;          // hauteur totale du drapeau
    const MAST_RADIUS = 0.006;
    const FLAG_W = 0.10;
    const FLAG_H = 0.06;

    const overlayGroup = new T.Group();
    overlayGroup.name = 'world_map_flags';
    overlayGroup.position.set(0, 0, 0);
    this.scene.add(overlayGroup);

    const clickableIslands: any[] = [];
    for (const z of ZONES) {
      const flagGroup = new T.Group();
      // Position world = plane center + (nx × halfX, surface, nz × halfZ)
      const worldX = planeCenter.x + z.nx * halfX;
      const worldZ = planeCenter.z + z.nz * halfZ;
      flagGroup.position.set(worldX, surfaceTopY, worldZ);
      flagGroup.userData = { zone: z, baseY: surfaceTopY };

      // 🪵 Mât (cylindre vertical brun)
      const mast = new T.Mesh(
        new T.CylinderGeometry(MAST_RADIUS, MAST_RADIUS, FLAG_HEIGHT, 6),
        new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, metalness: 0.1 }),
      );
      mast.position.y = FLAG_HEIGHT / 2;
      flagGroup.add(mast);

      // 🚩 Drapeau (plane rectangulaire colorée, décalé sur le côté du mât)
      const flag = new T.Mesh(
        new T.PlaneGeometry(FLAG_W, FLAG_H),
        new T.MeshStandardMaterial({
          color: z.color, emissive: z.color, emissiveIntensity: 0.5,
          metalness: 0.2, roughness: 0.5,
          side: T.DoubleSide,
        }),
      );
      flag.position.set(FLAG_W / 2 + MAST_RADIUS, FLAG_HEIGHT - FLAG_H / 2 - 0.005, 0);
      flagGroup.add(flag);
      (flagGroup.userData as any).flagMesh = flag;

      // Boule au sommet du mât (petite, pour décoration — pas confondue avec le fantôme)
      const top = new T.Mesh(
        new T.SphereGeometry(0.012, 8, 6),
        new T.MeshStandardMaterial({
          color: z.color, emissive: z.color, emissiveIntensity: 0.8,
          metalness: 0.6, roughness: 0.3,
        }),
      );
      top.position.y = FLAG_HEIGHT;
      flagGroup.add(top);

      // Anneau pulsant à la base du mât (au sol)
      const ring = new T.Mesh(
        new T.RingGeometry(0.04, 0.055, 24),
        new T.MeshBasicMaterial({
          color: z.color, side: T.DoubleSide,
          transparent: true, opacity: 0.65,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.002;
      flagGroup.add(ring);
      (flagGroup.userData as any).pulseRing = ring;

      overlayGroup.add(flagGroup);
      clickableIslands.push(flagGroup);
    }
    (this as any).worldMapIslands = clickableIslands;
    (this as any).worldMapElapsed = 0;
    (this as any).worldMapGroup = overlayGroup;

    console.log(`[YamzyEntry] ✓ ${ZONES.length} drapeaux posés sur Plane_2 (relatif à bbox)`);

    // Setup raycaster pour hover + click
    this.setupWorldMapInteractions(T);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🗺 WORLD MAP — parchemin 3D avec les 8 zones cliquables sur la table
  //
  // Layout cible :
  //   STRATEGY ↖     ↗ KNOWLEDGE
  //   DELIVERY ←  YAMZY  → COMMERCE
  //              WORKSHOPS
  //                STUDIOS
  // ═══════════════════════════════════════════════════════════════════
  private buildWorldMap(T: any, roomScene: any): void {
    // 1. Trouve la table/pedestal/socle (utilise le même anchor que le crystal)
    let pedestal: any = null;
    roomScene.traverse((obj: any) => {
      if (pedestal) return;
      const n = (obj.name || '').toLowerCase();
      if (/^(table|pedestal|altar|socle|support)/i.test(n)) pedestal = obj;
    });
    if (!pedestal) {
      console.warn('[YamzyEntry] World map : pas de pedestal/table trouvé');
      return;
    }
    pedestal.updateWorldMatrix(true, true);
    const tableBbox = new T.Box3().setFromObject(pedestal);
    const tableCenter = new T.Vector3();
    tableBbox.getCenter(tableCenter);
    const tableTopY = tableBbox.max.y;
    const tableWidth = Math.min(tableBbox.max.x - tableBbox.min.x, tableBbox.max.z - tableBbox.min.z);

    // 2. Crée le groupe map à côté du crystal (offset Z pour ne pas chevaucher)
    const mapGroup = new T.Group();
    mapGroup.position.set(tableCenter.x, tableTopY + 0.005, tableCenter.z);
    // On positionne légèrement décalé pour qu'on voit à la fois crystal ET map
    this.scene.add(mapGroup);
    (this as any).worldMapGroup = mapGroup;

    const mapSize = Math.max(0.25, tableWidth * 0.75);

    // 3. Parchemin (plane texturé beige avec emissive douce)
    const parchmentMat = new T.MeshStandardMaterial({
      color: 0xe8d4a8,
      roughness: 0.92,
      metalness: 0.0,
      emissive: 0x4a3018,
      emissiveIntensity: 0.06,
      side: T.DoubleSide,
    });
    const parchment = new T.Mesh(new T.PlaneGeometry(mapSize, mapSize), parchmentMat);
    parchment.rotation.x = -Math.PI / 2;
    mapGroup.add(parchment);

    // Bordure dorée du parchemin
    const borderGeom = new T.EdgesGeometry(new T.PlaneGeometry(mapSize, mapSize));
    const borderLine = new T.LineSegments(borderGeom, new T.LineBasicMaterial({ color: 0xb89240, linewidth: 2 }));
    borderLine.rotation.x = -Math.PI / 2;
    borderLine.position.y = 0.001;
    mapGroup.add(borderLine);

    // 4. Configuration des 8 zones (positions normalisées sur le parchemin de [-0.5, 0.5])
    const r = mapSize * 0.32;     // rayon orbite des îles autour du centre
    const ZONES = [
      { key: 'yamzy',     label: 'YAMZY',     pos: [0, 0],                   color: 0xd54adf, route: '/yamzy-island',    icon: '💎', height: 0.04 },
      { key: 'strategy',  label: 'STRATEGY',  pos: [-r * 0.7, -r * 0.7],     color: 0xc4b5fd, route: '/island/strategy', icon: '🌌', height: 0.035 },
      { key: 'knowledge', label: 'KNOWLEDGE', pos: [ r * 0.7, -r * 0.7],     color: 0x06b6d4, route: '/island/knowledge',icon: '🏛', height: 0.035 },
      { key: 'delivery',  label: 'DELIVERY',  pos: [-r,        0],           color: 0x86efac, route: '/island/delivery', icon: '🌿', height: 0.035 },
      { key: 'commerce',  label: 'COMMERCE',  pos: [ r,        0],           color: 0xfbbf24, route: '/island/commerce', icon: '⚗',  height: 0.035 },
      { key: 'workshops', label: 'WORKSHOPS', pos: [-r * 0.5,  r * 0.85],    color: 0x10b981, route: '/yamzy-rooms?filter=workshop', icon: '🪴', height: 0.03 },
      { key: 'studios',   label: 'STUDIOS',   pos: [ r * 0.5,  r * 0.85],    color: 0xb87333, route: '/yamzy-studio-maker',  icon: '🏗', height: 0.03 },
    ];

    const clickableIslands: any[] = [];
    for (const z of ZONES) {
      const islandGroup = new T.Group();
      islandGroup.position.set(z.pos[0], 0.002, z.pos[1]);
      islandGroup.userData = { zone: z, baseY: 0.002 };

      // Cône (île) avec base disque + sommet
      const coneRadius = mapSize * 0.05;
      const cone = new T.Mesh(
        new T.ConeGeometry(coneRadius, z.height, 8, 1),
        new T.MeshStandardMaterial({
          color: z.color,
          emissive: z.color,
          emissiveIntensity: 0.35,
          metalness: 0.4,
          roughness: 0.45,
        }),
      );
      cone.position.y = z.height / 2;
      islandGroup.add(cone);

      // Base (disque plat sur le parchemin)
      const base = new T.Mesh(
        new T.CylinderGeometry(coneRadius * 1.4, coneRadius * 1.4, 0.003, 16),
        new T.MeshStandardMaterial({
          color: z.color,
          emissive: z.color,
          emissiveIntensity: 0.5,
          metalness: 0.3,
          roughness: 0.6,
          transparent: true,
          opacity: 0.7,
        }),
      );
      base.position.y = 0.0015;
      islandGroup.add(base);

      // Anneau pulsant autour (effet "magique")
      const ringGeom = new T.RingGeometry(coneRadius * 1.5, coneRadius * 1.9, 24);
      const ringMat = new T.MeshBasicMaterial({
        color: z.color,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const ring = new T.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.001;
      islandGroup.add(ring);
      (islandGroup.userData as any).pulseRing = ring;

      mapGroup.add(islandGroup);
      clickableIslands.push(islandGroup);
    }
    (this as any).worldMapIslands = clickableIslands;
    (this as any).worldMapElapsed = 0;

    // Lumière pour les îles
    const mapLight = new T.PointLight(0xfff0c8, 0.6, mapSize * 4, 2);
    mapLight.position.set(0, mapSize * 0.5, 0);
    mapGroup.add(mapLight);

    // 5. Raycaster pour hover + click
    this.setupWorldMapInteractions(T);

    console.log(`[YamzyEntry] ✓ World Map sur la table (size=${mapSize.toFixed(2)}, 7 zones cliquables)`);
  }

  /** Focalise la caméra sur la World Map pour qu'elle soit bien visible à l'arrivée */
  private focusCameraOnWorldMap(T: any): void {
    const mapGroup = (this as any).worldMapGroup;
    if (!mapGroup || !this.camera) return;
    // Position caméra légèrement au-dessus + en biais pour voir le parchemin et les 7 zones
    const targetPos = mapGroup.position.clone();
    const offset = new T.Vector3(0, 0.4, 0.55);
    this.camera.position.copy(targetPos).add(offset);
    this.camera.lookAt(targetPos);
    console.log('[YamzyEntry] 🎯 Caméra focalisée sur la World Map');
  }

  /** Setup raycaster pour hover et click sur les zones */
  private setupWorldMapInteractions(T: any): void {
    const raycaster = new T.Raycaster();
    const mouse = new T.Vector2();
    let hoveredZone: any = null;

    const updateMouseFromEvent = (event: MouseEvent) => {
      const canvas = this.canvasEl.nativeElement;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onHover = (event: MouseEvent) => {
      updateMouseFromEvent(event);
      raycaster.setFromCamera(mouse, this.camera);
      const islands = (this as any).worldMapIslands || [];
      const intersects = raycaster.intersectObjects(islands, true);
      let newHover: any = null;
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.zone) obj = obj.parent;
        if (obj?.userData?.zone) newHover = obj;
      }
      if (newHover !== hoveredZone) {
        // reset old
        if (hoveredZone) hoveredZone.scale.set(1, 1, 1);
        // set new
        if (newHover) {
          newHover.scale.set(1.5, 1.5, 1.5);
          document.body.style.cursor = 'pointer';
        } else {
          document.body.style.cursor = 'default';
        }
        hoveredZone = newHover;
      }
    };

    const onClick = (event: MouseEvent) => {
      updateMouseFromEvent(event);
      raycaster.setFromCamera(mouse, this.camera);
      const islands = (this as any).worldMapIslands || [];
      const intersects = raycaster.intersectObjects(islands, true);
      if (intersects.length === 0) return;
      let obj = intersects[0].object;
      while (obj && !obj.userData?.zone) obj = obj.parent;
      if (obj?.userData?.zone) {
        const zone = obj.userData.zone;
        console.log(`[YamzyEntry] 🗺 Click on zone "${zone.label}" → ${zone.route}`);
        // Stocke pour navigation après éventuel cleanup
        try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
        this.router.navigateByUrl(zone.route);
      }
    };

    const canvas = this.canvasEl.nativeElement;
    canvas.addEventListener('pointermove', onHover);
    canvas.addEventListener('click', onClick);
    (this as any)._worldMapCleanup = () => {
      canvas.removeEventListener('pointermove', onHover);
      canvas.removeEventListener('click', onClick);
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🚶 SPAWN YAMZY EXPLORER — extrait YAMZY du room.glb + init service
  //
  // Le nouveau room.glb intègre YAMZY (node "yamzy") + toutes ses animations
  // (Walk, Idle, Run, Jump, etc.). On extrait YAMZY de la hiérarchie de la
  // room pour pouvoir le déplacer librement en world space, on attache un
  // AnimationMixer aux clips embedded, et on initialise l'explorer.
  // ═══════════════════════════════════════════════════════════════════
  private async spawnYamzyExplorer(T: any, roomScene: any): Promise<void> {
    try {
      // 1. Trouve le node "yamzy" dans la room
      let yamzy: any = null;
      roomScene.traverse((obj: any) => {
        if (yamzy) return;
        const n = (obj.name || '').toLowerCase();
        if (n === 'yamzy' || n === 'yamzy_rig' || n === 'character') yamzy = obj;
      });
      if (!yamzy) {
        console.warn('[YamzyEntry] Pas de node "yamzy" dans room.glb → explorer désactivé');
        return;
      }

      // 2. Détache YAMZY de la hiérarchie room → attache à scene en préservant le world transform
      roomScene.updateWorldMatrix(true, true);
      this.scene.attach(yamzy);    // THREE.Object3D.attach() préserve le world matrix
      yamzy.userData.isYamzyExplorer = true;
      (this as any).yamzyExplorer = yamzy;
      console.log('[YamzyEntry] ✓ YAMZY extracted from room.glb → world pos:', yamzy.position);

      // 3. Identifie les meshes appartenant à YAMZY (à exclure des collision meshes)
      const yamzyMeshes = new Set<any>();
      yamzy.traverse((obj: any) => { if (obj.isMesh) yamzyMeshes.add(obj); });

      // 4. Collision meshes = TOUS les meshes du room.glb SAUF ceux de YAMZY
      const collisionMeshes: any[] = [];
      roomScene.traverse((obj: any) => {
        if (obj.isMesh && !yamzyMeshes.has(obj)) collisionMeshes.push(obj);
      });
      console.log(`[YamzyEntry] ✓ Collision meshes: ${collisionMeshes.length} (yamzy meshes excluded)`);

      // 5. Bounds = bbox de la room en world (avec marge)
      const roomBbox = new T.Box3().setFromObject(roomScene);
      const margin = 0.15;
      const bounds = {
        minX: roomBbox.min.x + margin, maxX: roomBbox.max.x - margin,
        minZ: roomBbox.min.z + margin, maxZ: roomBbox.max.z - margin,
      };

      // 6. AnimationMixer + 3 catégories : Walk (mouvement) / Idle (fallback) / Rest cycle (toutes les autres)
      const animations: any[] = roomScene.userData?.animations || [];
      let mixer: any = null;
      let walkAction: any = null;
      let idleAction: any = null;
      const restActions: any[] = [];
      if (animations.length) {
        mixer = new T.AnimationMixer(yamzy);
        for (const clip of animations) {
          const name = clip.name || '';
          // Ignore les clips non-YAMZY (Take 001.001, etc.)
          if (!/^CharacterArmature\|/i.test(name)) continue;
          const tail = name.replace(/^CharacterArmature\|/i, '');
          // Walk exact (priorité sur Run pour le mouvement)
          if (/^Walk$/i.test(tail)) {
            walkAction = mixer.clipAction(clip);
          }
          // Idle exact (fallback simple)
          else if (/^Idle$/i.test(tail)) {
            idleAction = mixer.clipAction(clip);
            // L'Idle fait aussi partie du cycle rest pour qu'il revienne entre les autres anims
            restActions.push(idleAction);
          }
          // TOUTES les autres : Wave, Yes, No, Punch, Duck, HitReact, Jump, Idle_Gun, Idle_Shoot, Run, ...
          // Skip Walk_Gun / Walk_Shoot / Run_Gun / Run_Shoot (variants du walk/run)
          else if (!/^(Walk_|Run_)/i.test(tail)) {
            restActions.push(mixer.clipAction(clip));
          }
        }
        const restNames = restActions.map(a => a.getClip()?.name).join(', ');
        console.log(`[YamzyEntry] ✓ AnimationMixer ${animations.length} clips
                          walk=${walkAction?.getClip()?.name || '(none)'}
                          idle=${idleAction?.getClip()?.name || '(none)'}
                          rest cycle (${restActions.length}) = ${restNames}`);
        (this as any).yamzyMixer = mixer;
      }

      // 7. Désactive OrbitControls (la caméra est maintenant pilotée par l'explorer)
      if (this.controls) {
        this.controls.enabled = false;
        this.controls.autoRotate = false;
      }

      // 8. INIT explorer service (3ème personne FOLLOW direct — pas de cinematic)
      // → la caméra suit YAMZY DÈS l'init et le centre exactement à l'écran
      this.explorer.init({
        THREE: T,
        scene: this.scene,
        camera: this.camera,
        avatar: yamzy,
        collisionMeshes,
        bounds,
        walkSpeed: 0.4,
        runMultiplier: 2.2,
        turnSpeed: 2.6,
        cameraDistance: 1.2,      // distance derrière YAMZY (proche pour rester dans la pièce)
        cameraHeight: 0.15,       // 15cm au-dessus du centre de YAMZY (léger plongée)
        cameraLerp: 0.15,
        cameraYawLerp: 0.18,
        collisionRadius: 0.10,
        stepHeight: 0.18,
        groundRayHeight: 1.5,
        chestHeight: 0.18,
        facingDir: 1,
        minDistance: 0.6,
        maxDistance: 3.0,
        zoomSpeed: 0.15,
        mixer, walkAction, idleAction,
        restActions,
        restGapSeconds: 0.4,
        // ⚠ Pas de cinematicTarget → l'explorer démarre en mode 'follow' direct
        // (pas d'orbite autour du crystal qui bloquait la cam)
      });
      console.log('[YamzyEntry] ✓ Explorer initialized — FOLLOW direct dès le début, YAMZY centré à l\'écran');

      // 🗺 Build la World Map sur la table + focus caméra dessus (à la fin du setup)
      try {
        this.buildWorldMap(T, roomScene);
        // Focus caméra sur la table avec la map (Override l'explorer pour ce moment)
        this.focusCameraOnWorldMap(T);
      } catch (e) { console.warn('[YamzyEntry] World map failed', e); }
    } catch (e) {
      console.error('[YamzyEntry] spawnYamzyExplorer error', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE MACHINE LITE — onPhaseChange (équivalent du onStateChange)
  // ═══════════════════════════════════════════════════════════════════
  private async bootstrap(): Promise<void> {
    this.phase.set('loading');
    this.loadingMessage.set('Invocation des étoiles…');
    this.loadingProgress.set(5);

    // 1) Charge Three.js depuis CDN (réel + progress)
    await this.loadThreeJs((p, msg) => {
      this.loadingProgress.set(5 + p * 0.55);  // 5..60%
      if (msg) this.loadingMessage.set(msg);
    });
    if (this.disposed) return;

    // 2) Initialise la scène 3D (île + ciel)
    this.loadingMessage.set("Façonnage de l'île…");
    this.loadingProgress.set(65);
    await this.delay(120);
    if (this.disposed) return;
    this.initScene();
    this.loadingProgress.set(85);

    // 3) Démarre la voix : warmup (charge les voix async, sans parler)
    this.loadingMessage.set('Réveil de Yamzy…');
    await this.delay(180);
    if (this.disposed) return;
    this.loadingProgress.set(100);

    // 4) Bascule sur SPLASH
    await this.delay(300);
    if (this.disposed) return;
    this.phase.set('splash');
    this.animate();  // démarre la boucle de rendu
  }

  // ─────────────────────────────────────────────────────────────────────
  // ACTIONS depuis l'UI (boutons)
  // ─────────────────────────────────────────────────────────────────────
  async startTour(): Promise<void> {
    if (this.phase() !== 'splash') return;
    this.phase.set('tour');
    this.tourAbortController = { aborted: false };
    // 🎵 Lance la musique du spell-caster + ping de transition
    this.sounds.play('ping-1', { volume: 0.4 });
    this.sounds.startMusic();
    // 🎬 Transition cinématique : caméra recule + crystal lift + island reveal
    await this.revealIslandFromCrystal();
    await this.runConte();
  }

  /**
   * 🎬 SPLASH → TOUR transition cinématique.
   *
   * Au SPLASH : crystal seul à (0,0,0), caméra (0,0.5,8) — vue serrée.
   * Au TOUR : crystal soulevé à (0,5,0) sur l'île, caméra (0,25,40) vue d'ensemble.
   *
   * Pendant la transition :
   *  - Crystal monte de (0,0,0) à (0,5,0) (4s)
   *  - Caméra recule de (0,0.5,8) à (0,25,40) (4s)
   *  - islandRoot.visible = true (révèle l'île)
   *  - 10 énergies (CrystalEnergyEmitter style) jaillissent du crystal vers chaque temple
   *  - portal sound joue au moment de la transition
   */
  private async revealIslandFromCrystal(): Promise<void> {
    const islandRoot = this.islandRoot;
    if (!islandRoot) return;
    // Reveal l'île + le ciel + l'héritage du crystal (fruits, étincelles, halo)
    islandRoot.visible = true;
    const lineageGroup = (this as any).lineageGroup;
    if (lineageGroup) lineageGroup.visible = true;
    // 💡 LIGHT SWAP : fade-out lights chaudes splash → fade-in daylight tour
    // + fade exposure 1.2 → 0.95 (moins clair, daylight balancé)
    const splashLights = (this as any).splashLights as any[];
    const tourLights = (this as any).tourLights as Array<{ light: any; target: number }>;
    const splashIntensities = splashLights ? splashLights.map(l => l.intensity) : [];
    const startExposure = this.renderer.toneMappingExposure ?? 1.2;
    const endExposure = 0.95;
    const swapDuration = 2.5;
    const swapStart = this.elapsed;
    const fadeLights = () => {
      if (this.disposed || this.tourAbortController.aborted) return;
      const dt = this.elapsed - swapStart;
      const t = Math.min(1, dt / swapDuration);
      // Splash lights fade out
      if (splashLights) {
        for (let i = 0; i < splashLights.length; i++) {
          splashLights[i].intensity = splashIntensities[i] * (1 - t);
        }
      }
      // Tour lights fade in
      if (tourLights) {
        for (const tl of tourLights) {
          tl.light.intensity = tl.target * t;
        }
      }
      // Exposure fade
      this.renderer.toneMappingExposure = startExposure + (endExposure - startExposure) * t;
      if (t < 1) requestAnimationFrame(fadeLights);
    };
    fadeLights();
    if (this.sky) {
      if (this.sky.starsField) this.sky.starsField.visible = true;
      if (this.sky.moon) this.sky.moon.visible = true;
      this.sky.setAuroraVisible(true);
      if (this.sky.cometTrail) this.sky.cometTrail.visible = true;
      this.sky.shootingStars.forEach((s: any) => s.visible = true);
    }
    this.sounds.play('portal', { volume: 0.45 });
    // EXACT spell-caster startPositions vs FAR view final
    const startCamPos = { x: 0, y: 0.4, z: 1.6 };
    const endCamPos = { x: 0, y: 25, z: 40 };
    const startLookAt = { x: 0, y: -0.1, z: 0 };
    const endLookAt = { x: 0, y: 4, z: 0 };
    // Crystal était sur la table à (0, -0.05, 0) scale 0.07
    // → on le pousse à (0, 5, 0) scale ~4 (sur l'île, vu de loin)
    const startCryPos = { x: 0, y: -0.05, z: 0 };
    const endCryPos = { x: 0, y: 5, z: 0 };
    const startCryScale = 0.07;
    const endCryScale = 4.0;
    const duration = 4.0;
    const startTime = this.elapsed;
    const crystal = (this as any).crystal;
    const crystalScene = (this as any).crystalScene;
    const roomGlb = (this as any).roomGlb;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    return new Promise(resolve => {
      const update = () => {
        if (this.disposed || this.tourAbortController.aborted) { resolve(); return; }
        const dt = this.elapsed - startTime;
        const t = Math.min(1, dt / duration);
        const k = ease(t);
        // Camera position + lookAt interpolés
        this.camera.position.set(
          startCamPos.x + (endCamPos.x - startCamPos.x) * k,
          startCamPos.y + (endCamPos.y - startCamPos.y) * k,
          startCamPos.z + (endCamPos.z - startCamPos.z) * k,
        );
        const lx = startLookAt.x + (endLookAt.x - startLookAt.x) * k;
        const ly = startLookAt.y + (endLookAt.y - startLookAt.y) * k;
        const lz = startLookAt.z + (endLookAt.z - startLookAt.z) * k;
        if (this.controls) { this.controls.target.set(lx, ly, lz); this.controls.update(); }
        else { this.camera.lookAt(lx, ly, lz); }
        // Crystal lift + scale up
        if (crystal) {
          crystal.position.set(
            startCryPos.x + (endCryPos.x - startCryPos.x) * k,
            startCryPos.y + (endCryPos.y - startCryPos.y) * k,
            startCryPos.z + (endCryPos.z - startCryPos.z) * k,
          );
        }
        if (crystalScene) {
          const s = startCryScale + (endCryScale - startCryScale) * k;
          crystalScene.scale.setScalar(s);
        }
        // Room.glb fade out (opacity sur tous les materials)
        if (roomGlb && k > 0.1) {
          const op = Math.max(0, 1 - (k - 0.1) * 1.3);
          roomGlb.traverse((c: any) => {
            if (c.isMesh && c.material) {
              c.material.transparent = true;
              c.material.opacity = op;
            }
          });
          if (op <= 0.05) roomGlb.visible = false;
        }
        if (t < 1) requestAnimationFrame(update);
        else {
          this.spawnEnergyFlows();
          resolve();
        }
      };
      update();
    });
  }

  /**
   * 💧 Énergie qui coule du crystal vers chaque temple (eau qui coule dans le vide).
   * 10 particules tubes / streaks émissives qui font un arc du crystal vers chaque temple.
   * Particules persistantes, animées dans la boucle render.
   */
  private spawnEnergyFlows(): void {
    const T = (window as any).THREE;
    if (!T || !this.islandRoot) return;
    const crystal = (this as any).crystal;
    if (!crystal) return;
    const flows: any[] = [];
    // 10 temples sont placés à rayon 18 autour du centre
    const R = 18;
    const colors = [0xd54adf, 0xd68ddc, 0xff6ec7, 0xb392f7, 0xd54adf, 0xd68ddc, 0xff6ec7, 0xb392f7, 0xd54adf, 0xd68ddc];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const target = new T.Vector3(Math.cos(angle) * R, 1.5, Math.sin(angle) * R);
      // 30 points dans le flux (path crystal → temple)
      const pointCount = 30;
      const positions = new Float32Array(pointCount * 3);
      const colorsArr = new Float32Array(pointCount * 3);
      const c = new T.Color(colors[i]);
      for (let j = 0; j < pointCount; j++) {
        positions[j * 3] = 0; positions[j * 3 + 1] = 5; positions[j * 3 + 2] = 0;
        colorsArr[j * 3] = c.r; colorsArr[j * 3 + 1] = c.g; colorsArr[j * 3 + 2] = c.b;
      }
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.BufferAttribute(positions, 3));
      geom.setAttribute('color', new T.BufferAttribute(colorsArr, 3));
      const mat = new T.PointsMaterial({
        size: 0.45, vertexColors: true, transparent: true, opacity: 0.85,
        blending: T.AdditiveBlending, sizeAttenuation: true, fog: false,
      });
      const pts = new T.Points(geom, mat);
      pts.userData = {
        flow: true,
        target,
        offset: i * 0.3,
        speed: 0.55 + (i % 3) * 0.1,
      };
      this.scene.add(pts);
      flows.push(pts);
    }
    (this as any).energyFlows = flows;
    console.log('[YamzyEntry] 💧 10 energy flows spawned');
  }

  enterWorld(): void {
    this.voice.cancel();
    this.tourAbortController.aborted = true;
    this.dismissIntroOverlay();
    // Mémorise la visite (skip auto à la prochaine fois)
    try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
    this.router.navigate(['/yamzy-island']);
  }

  /** Change la voix de Yamzy (persona) */
  pickVoice(p: VoicePersona): void {
    this.voice.setPersona(p);
  }
  /** Test rapide de la voix avec la persona courante */
  testVoice(): void {
    this.voice.testVoice();
  }

  /**
   * Titre fantasy par page du conte (affiché comme h3 dans les instructions).
   * Pattern inspiré du spell-caster ("Protect the crystal", "Face the onslaught", …)
   */
  getStepTitle(): string {
    const titles = [
      'Il était une fois…',
      "Le disque de jade",
      "Le Cristal des Lignées",
      'Dix temples en cercle',
      "L'Archipel & la Galerie",
      "La Forge du Phénix",
      "La Montagne des Sommets",
      'Les sages de l\'ouest',
      "Voix, fioles & cartes",
      'Onze portes, une île',
      'Les sept ateliers',
      "💧 La Fontaine de Mana",
      'Le ciel-horloge',
      "Aurore, comète & filante",
      'Supernova & éclipse',
      'Bonne route, Mage',
    ];
    return titles[this.tourIndex()] ?? 'Le conte';
  }
  skipToConclave(): void {
    this.dismissIntroOverlay();
    try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
    this.router.navigate(['/conclave']);
  }
  goShowcase(): void {
    this.dismissIntroOverlay();
    try { localStorage.setItem('yamzy-welcome-seen', '1'); } catch {}
    this.router.navigate(['/showcase/yamzy-world']);
  }

  // ─── Demo Day overlay ────────────────────────────────────────────
  dayDemoOpen = signal<boolean>(false);
  openDayDemo(): void {
    this.sounds.play('ping-1', { volume: 0.35 });
    this.dayDemoOpen.set(true);
  }

  // ─── 🔥 Torch ignition cinématique (spell-caster style) ────────────
  igniting = signal<string | null>(null);

  /**
   * Camera positions (pose + lookAt) par bouton — chaque clic envoie la caméra
   * vers une torche/coin du décor pendant que la torche s'allume.
   * Coordonnées calibrées sur la scène room.glb scale 0.18 position (0, -0.4, -0.4).
   */
  private readonly TORCH_VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number]; color: number }> = {
    // 🎭 Découvrir — torche gauche
    tour:      { pos: [-0.9, 0.55, 1.1], target: [-0.45, 0.30, -0.10], color: 0xff8844 },
    day:       { pos: [-0.7, 0.45, 1.3], target: [-0.30, 0.20, -0.10], color: 0xfbbf24 },
    // ⚔️ Conclave — porte centrale (crystal)
    conclave:  { pos: [ 0.0, 0.50, 1.0], target: [ 0.00, 0.10, -0.20], color: 0xd54adf },
    showcase:  { pos: [ 0.2, 0.45, 1.2], target: [ 0.10, 0.20, -0.10], color: 0xc084fc },
    // 🌍 Explorer — torche droite
    enter:     { pos: [ 0.9, 0.55, 1.1], target: [ 0.45, 0.30, -0.10], color: 0x60a5fa },
    rooms:     { pos: [ 0.7, 0.45, 1.3], target: [ 0.30, 0.20, -0.10], color: 0x22c55e },
  };

  /**
   * Joue le cinematic spell-caster : la caméra vole vers la torche correspondante,
   * la flamme s'allume (PointLight ignite + flash CSS), puis l'action s'exécute.
   * Pattern repris du spell-caster originel : info → camera fly → torch light → enter.
   */
  igniteThen(key: string, action: () => void): void {
    if (this.igniting() !== null) return; // anti double-clic
    this.igniting.set(key);
    // ─── Son ───
    try { this.sounds.play('ping-2', { volume: 0.45 }); } catch {}
    try { this.sounds.play('torch-1', { volume: 0.45 }); } catch {}

    const view = this.TORCH_VIEWS[key];
    if (!view || !this.camera) {
      // Pas de cinematic disponible — fallback simple
      setTimeout(() => { this.igniting.set(null); action(); }, 720);
      return;
    }

    // ─── 🔥 Spawn TORCH IGNITION dramatique : sphère lumineuse + light + flash écran ───
    let torchLight: any = null;
    let torchOrb: any = null;
    try {
      const T = (window as any).THREE;
      if (T && this.scene) {
        // 1️⃣ Sphère lumineuse VISIBLE = la flamme de la torche
        const orbGeom = new T.SphereGeometry(0.08, 16, 16);
        const orbMat = new T.MeshBasicMaterial({
          color: view.color,
          transparent: true,
          opacity: 0,
        });
        torchOrb = new T.Mesh(orbGeom, orbMat);
        torchOrb.position.set(view.target[0], view.target[1] + 0.15, view.target[2]);
        this.scene.add(torchOrb);

        // 2️⃣ PointLight INTENSE pour éclairer toute la scène
        torchLight = new T.PointLight(view.color, 0, 8, 1.5);
        torchLight.position.set(view.target[0], view.target[1] + 0.15, view.target[2]);
        this.scene.add(torchLight);

        // 3️⃣ Ramp up RAPIDE + flicker (effet "torche qui prend feu")
        const t0 = performance.now();
        const rampUp = () => {
          if (!torchLight) return;
          const dt = (performance.now() - t0) / 500; // 500ms ignition
          const k = Math.min(1, dt);
          // Flicker organique
          const flick = 0.85 + 0.15 * Math.sin(dt * 60);
          torchLight.intensity = k * 12 * flick;             // intensité MAX 12 (très brillant)
          if (torchOrb) {
            torchOrb.material.opacity = k;
            torchOrb.scale.setScalar(0.5 + k * 1.5 * flick);  // l'orbe grossit
          }
          if (k < 1.5) requestAnimationFrame(rampUp);
        };
        rampUp();
      }
    } catch (e) { console.warn('[YamzyEntry] torch ignite failed', e); }

    // ─── 4️⃣ Flash écran CSS (radial pulse couleur torche) ───
    this.spawnScreenFlash(view.color);

    // ─── 5️⃣ Animate camera vers la torche pendant ~900ms ───
    this.animateCamera(
      { x: view.pos[0], y: view.pos[1], z: view.pos[2] },
      { x: view.target[0], y: view.target[1], z: view.target[2] },
      0.9
    ).then(() => {
      // Cleanup light + sphere + exécute l'action
      if (torchLight && this.scene) {
        this.scene.remove(torchLight);
        torchLight.dispose && torchLight.dispose();
      }
      if (torchOrb && this.scene) {
        this.scene.remove(torchOrb);
        torchOrb.geometry && torchOrb.geometry.dispose();
        torchOrb.material && torchOrb.material.dispose();
      }
      this.igniting.set(null);
      action();
    });
  }

  /** Spawn un flash écran radial coloré (CSS) qui pulse pendant 700ms — sensation de torche allumée. */
  private spawnScreenFlash(threeColor: number): void {
    if (typeof document === 'undefined') return;
    const hex = '#' + threeColor.toString(16).padStart(6, '0');
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 9999;
      background: radial-gradient(circle at 50% 55%, ${hex}99 0%, ${hex}44 25%, transparent 60%);
      opacity: 0;
      animation: yweTorchFlash 0.7s ease-out forwards;
    `;
    // Inject keyframes if not present
    if (!document.getElementById('ywe-torch-flash-kf')) {
      const style = document.createElement('style');
      style.id = 'ywe-torch-flash-kf';
      style.textContent = `@keyframes yweTorchFlash {
        0%   { opacity: 0; transform: scale(0.6); }
        25%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.4); }
      }`;
      document.head.appendChild(style);
    }
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);
  }

  /** Navigation vers la galerie Yamzy Rooms (utilisé par le menu catégorisé). */
  goRooms(): void {
    this.dismissIntroOverlay();
    this.router.navigate(['/yamzy-rooms']);
  }

  /** Liste des 11 rooms principales — passerelle directe depuis le welcome */
  passerelleRooms = [
    { route: '/conclave',          name: 'Conclave VESPER', icon: '💎', color: '#d54adf', lore: 'Le studio du stratège' },
    { route: '/git-tree-room',     name: 'Git Tree',        icon: '🌳', color: '#22c55e', lore: 'L\'Arbre des Lignées' },
    { route: '/kanban-island',     name: 'Kanban Island',   icon: '🏝', color: '#0ea5e9', lore: 'L\'Archipel des Quêtes' },
    { route: '/pr-mirror-hall',    name: 'PR Mirror Hall',  icon: '🔮', color: '#a78bfa', lore: 'La Galerie des Vérités' },
    { route: '/phoenix-forge',     name: 'Phoenix Forge',   icon: '🔥', color: '#f97316', lore: 'L\'Atelier des Renaissances' },
    { route: '/okr-mountain',      name: 'OKR Mountain',    icon: '🏔', color: '#f3f4f6', lore: 'L\'Ascension du Sommet' },
    { route: '/library-cathedral', name: 'Library Cathedral', icon: '📚', color: '#92400e', lore: 'La Bibliothèque du Conclave' },
    { route: '/star-map-risks',    name: 'Star Map Risks',  icon: '⭐', color: '#ef4444', lore: 'La Carte des Périls' },
    { route: '/oracle-aquarium',   name: 'Oracle Aquarium', icon: '🐟', color: '#3b82f6', lore: 'L\'Étang des Voix' },
    { route: '/alchemist-cellar',  name: 'Alchemist Cellar', icon: '🧪', color: '#84cc16', lore: 'La Cave aux Fioles' },
    { route: '/card-tavern',       name: 'Card Tavern',     icon: '🃏', color: '#fbbf24', lore: 'La Taverne aux Cartes' },
  ];

  /** Sous-titre dynamique pour le breadcrumb du SpellHeader, dépend de la phase. */
  currentSubtitle(): string {
    const p = this.phase();
    if (p === 'tour') return 'Le conte';
    if (p === 'done') return 'Fin du conte';
    return 'Accueil';
  }

  // ═══════════════════════════════════════════════════════════════════
  // LE CONTE : suite séquentielle de pages (voix → onend → anim → next)
  // ═══════════════════════════════════════════════════════════════════
  private async runConte(): Promise<void> {
    // ───────────────────────────────────────────────────────────────────
    // 🌙 LE CONTE DE YAMZY — 14 pages cinématiques, 3 actes
    //
    //   Acte I : Prologue (pages 1-3)      → poser l'univers
    //   Acte II : Le Tour des Temples (4-10) → présenter les 11 rooms par geste
    //   Acte III : Le Pacte du Ciel (11-14)  → cérémonies enchaînées + invitation
    // ───────────────────────────────────────────────────────────────────
    const steps: ConteStep[] = [
      // ═══════════ ACTE I — PROLOGUE ═══════════
      {
        // Très haut, vue d'oiseau — l'île respire dans le noir
        text: "Il était une fois… un royaume sans cartes ni roi, où les jours se mesuraient en cérémonies et les nuits en étoiles tombées. On l'appelait le Royaume des Mages.",
        animate: () => this.animateCamera({ x: 0, y: 38, z: 42 }, { x: 0, y: 2, z: 0 }, 5.5),
      },
      {
        // Plongée douce vers l'île — révèle le crystal central
        text: "Au centre de tout, une île verte, ronde comme un disque de jade, posée sur un océan qui ne dort jamais. Sur cette île flotte un cristal — le Cristal des Lignées — et ses éclats dorés sont les œuvres des Mages.",
        animate: () => this.animateCamera({ x: 5, y: 40, z: 50 }, { x: 0, y: 6, z: 0 }, 5.0),
      },
      {
        // Approche du halo, éclats orbitants
        text: "Chaque éclat qui orbite là-haut, scintillant comme une lanterne, est une release. Chaque étincelle qui tombe est un commit. Le cristal se souvient de tout, même de ce qu'aucun journal n'écrira jamais.",
        animate: () => this.animateCamera({ x: -8, y: 18, z: 28 }, { x: 0, y: 6, z: 0 }, 4.5),
      },

      // ═══════════ ACTE II — LE TOUR DES TEMPLES ═══════════
      {
        // Pivot vers les temples — vue d'ensemble en orbite
        text: "Autour du cristal, dix temples dansent en cercle. Chacun garde un secret du métier de Mage. Suis-moi, je vais te les nommer un par un, comme un berger appelle ses brebis au crépuscule.",
        animate: () => this.animateCamera({ x: 28, y: 22, z: 0 }, { x: 0, y: 4, z: 0 }, 5.0),
      },
      {
        // Pan vers temple 1 et 2 (côté est)
        text: "Voici l'Archipel des Quêtes — là où les tickets prennent forme d'îles flottantes. Et voilà la Galerie des Vérités, où chaque pull request se contemple dans un miroir avant d'être scellée.",
        animate: () => this.animateCamera({ x: 22, y: 14, z: 14 }, { x: 8, y: 2, z: 8 }, 4.5),
      },
      {
        // Pan vers Phoenix Forge + spawn comète orange
        text: "Et là, regarde — la Forge du Phénix s'illumine. Chaque fois qu'un Mage du Royaume publie une release, une comète orange traverse le ciel. Vois… une vient de naître.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'renaissance', label: 'Release v1.0.143', icon: '🐦', sourceRoom: 'phoenix-forge' });
          await this.delay(400);
          await this.animateCamera({ x: 18, y: 12, z: -2 }, { x: 14, y: 3, z: -6 }, 4.5);
        },
      },
      {
        // Pan vers OKR Mountain + spawn aurore verte
        text: "Au nord se dresse la Montagne des Sommets. Quand un Compagnon plante un drapeau au pic, une aurore verte caresse ses pentes pour mille battements de cœur. Une vient de fleurir, là, juste pour toi.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'sommet', label: 'OKR Q1 atteint', icon: '⛰', sourceRoom: 'okr-mountain' });
          await this.delay(400);
          await this.animateCamera({ x: -16, y: 10, z: 8 }, { x: -10, y: 3, z: 0 }, 4.5);
        },
      },
      {
        // Library Cathedral + Star Map (côté ouest)
        text: "À l'ouest reposent les sages. La Bibliothèque du Conclave garde les leçons apprises — toutes celles qu'on aurait préféré apprendre plus tôt. À côté, la Carte Céleste des Périls signale les risques qui rôdent.",
        animate: () => this.animateCamera({ x: -22, y: 14, z: -10 }, { x: -10, y: 2, z: -6 }, 4.5),
      },
      {
        // Oracle Aquarium + Alchemist Cellar + Card Tavern
        text: "Plus loin, l'Étang des Voix Oracle écoute la communauté. La Cave aux Fioles distille les coûts en gemmes d'optimisation. Et la Taverne aux Cartes du Destin tire au sort les estimations.",
        animate: () => this.animateCamera({ x: -18, y: 12, z: -16 }, { x: -8, y: 2, z: -12 }, 4.5),
      },
      {
        // Retour vue large pour montrer l'unité
        text: "Onze temples, un seul Royaume. Onze portes, une seule île. Et toi, Mage, tu peux les visiter dans l'ordre qui te chante — il n'y a pas de bon chemin, il n'y a que le tien.",
        animate: () => this.animateCamera({ x: 0, y: 30, z: 38 }, { x: 0, y: 4, z: 0 }, 5.0),
      },

      // ═══════════ ACTE II-bis — LES WORKSHOPS DU SCRUM ═══════════
      {
        // Workshops Scrum mentionnés brièvement
        text: "Aux ateliers, sept ruelles bordent la grande place : la fontaine de Mana, le navire des rétrospectives, le caveau des pré-mortems, le verger des affinages, le puits des cinq pourquoi, la brûlerie des cafés lean, et la plage des définitions. Sept manières de tenir conseil entre Mages.",
        animate: () => this.animateCamera({ x: 12, y: 18, z: 16 }, { x: 6, y: 2, z: 6 }, 5.0),
      },
      {
        // Page-clé : sensibilisation eau / IA / $
        text: "Mais souviens-toi, voyageur — au cœur de la place trône une fontaine de Mana. Chaque sort lancé puise dans sa source. Cette eau, c'est celle qui refroidit les datacenters où vit la magie de l'IA. Chaque goutte coûte des tokens, des centimes, et des millilitres bien réels. Voir la goutte tomber, c'est se souvenir qu'aucune magie n'est gratuite.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'aube', label: 'Goutte de mana', icon: '💧', sourceRoom: 'welcome' });
          await this.animateCamera({ x: 0, y: 14, z: 22 }, { x: 0, y: 3, z: 6 }, 5.0);
        },
      },

      // ═══════════ ACTE III — LE PACTE DU CIEL ═══════════
      {
        // Camera lève les yeux vers le ciel + spawn 3 cérémonies cascade
        text: "Lève les yeux. Le ciel n'est pas un décor — c'est la grande horloge du Royaume. Chaque battement d'aile d'un Mage, où qu'il soit, fait scintiller une étoile ici. Regarde…",
        animate: async () => {
          // Cascade de 3 cérémonies pour démontrer la richesse du ciel
          this.ceremonyBus.publish({ type: 'flag', label: 'Drapeau planté', icon: '🏳', sourceRoom: 'okr-mountain' });
          await this.delay(450);
          this.ceremonyBus.publish({ type: 'bloom', label: 'Nouvelle branche', icon: '🌸', sourceRoom: 'git-tree' });
          await this.delay(450);
          this.ceremonyBus.publish({ type: 'aube', label: 'Daily stand-up', icon: '🌅', sourceRoom: 'kanban-island' });
          await this.animateCamera({ x: 0, y: 22, z: 22 }, { x: 0, y: 22, z: -10 }, 4.0);
        },
      },
      {
        // Plongée vers fond ciel — montrer aurora
        text: "L'aurore que tu vois là-haut respire au rythme du sprint. Cette traînée de comète, c'est une release d'il y a quelques heures qui hante encore les nues. Et cette étoile filante qui passe… vient de naître d'un drapeau planté.",
        animate: () => this.animateCamera({ x: -6, y: 28, z: 30 }, { x: -8, y: 30, z: -30 }, 4.5),
      },
      {
        // Spawn d'une dernière cérémonie majeure + retour caméra splash
        text: "Quand un Mage relâche une version majeure — une supernova rose éclate. Quand une éclipse rouge tombe, c'est qu'un incident est en cours. Le ciel pleure, danse, prie. Il n'oublie jamais.",
        animate: async () => {
          this.ceremonyBus.publish({ type: 'supernova', label: 'Release majeure v2.0', icon: '🌟', sourceRoom: 'phoenix-forge' });
          await this.delay(400);
          await this.animateCamera({ x: 5, y: 35, z: 42 }, { x: 0, y: 8, z: 0 }, 5.0);
        },
      },
      {
        // Fin : recul cinématique + invitation finale
        text: "Maintenant tu sais. Le Royaume est à toi — il n'attend qu'un nom pour s'animer. Pose une intention, écris un commit, plante un drapeau. Chaque geste posé ici devient un fragment de ton conte. Bonne route, Mage.",
        animate: () => this.animateCamera({ x: 0, y: 45, z: 55 }, { x: 0, y: 2, z: 0 }, 6.0),
      },
    ];

    this.totalSteps.set(steps.length);

    for (let i = 0; i < steps.length; i++) {
      if (this.tourAbortController.aborted || this.disposed) break;
      const step = steps[i];
      this.tourIndex.set(i);
      this.tourText.set(step.text);
      // 1) Voix d'abord (séquentiel — attend onend)
      await this.voice.speak(step.text);
      if (this.tourAbortController.aborted || this.disposed) break;
      // 2) Animation 3D ensuite
      await step.animate();
    }

    if (!this.tourAbortController.aborted && !this.disposed) {
      this.phase.set('done');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCÈNE 3D — Île procédurale + ciel universel
  // ═══════════════════════════════════════════════════════════════════
  private async loadThreeJs(progress: (pct: number, msg?: string) => void): Promise<void> {
    progress(10, 'Téléchargement de Three.js…');
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    progress(35, 'Préparation des contrôles…');
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    progress(55, 'Chargement du loader GLB…');
    if (!(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    progress(75, 'Décodeur Draco…');
    if (!(window as any).THREE?.DRACOLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js');
    }
    progress(100, 'Three.js prêt');
  }

  /**
   * Charge le room.glb (chambre du Conclave / spell-caster room).
   * Path: /assets/conclave/models/room.glb (déjà bundlé)
   */
  private loadRoomGlb(T: any): Promise<any | null> {
    const GLTFLoader = T.GLTFLoader;
    const DRACOLoader = T.DRACOLoader;
    if (!GLTFLoader) return Promise.resolve(null);
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      if (DRACOLoader) {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(draco);
      }
      loader.load('/assets/conclave/models/room.glb',
        (gltf: any) => {
          gltf.scene.traverse((c: any) => {
            if (c.isMesh) c.frustumCulled = false;
          });
          // 📌 Stash les animations sur scene.userData pour pouvoir les exploiter plus tard
          // (le nouveau room.glb embarque YAMZY + ses animations Walk/Idle/Run/...)
          gltf.scene.userData.animations = gltf.animations || [];
          resolve(gltf.scene);
        },
        undefined,
        (err: any) => { console.warn('[YamzyEntry] room.glb load failed', err); resolve(null); }
      );
    });
  }

  /**
   * Charge le crystal GLB EXACT du spell-caster / conclave.
   * Path: /assets/conclave/models/crystal.glb (déjà bundlé)
   */
  private loadCrystalGlb(T: any): Promise<any | null> {
    const GLTFLoader = T.GLTFLoader;
    const DRACOLoader = T.DRACOLoader;
    if (!GLTFLoader) {
      console.warn('[YamzyEntry] GLTFLoader unavailable, fallback to icosahedron');
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      if (DRACOLoader) {
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(draco);
      }
      loader.load('/assets/conclave/models/crystal.glb',
        (gltf: any) => {
          gltf.scene.traverse((c: any) => {
            if (c.isMesh) c.frustumCulled = false;
          });
          resolve(gltf.scene);
        },
        undefined,
        (err: any) => {
          console.warn('[YamzyEntry] crystal.glb load failed', err);
          resolve(null);
        }
      );
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise(r => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => r(); s.onerror = () => r();
      document.head.appendChild(s);
    });
  }

  private initScene(): void {
    const T = (window as any).THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new T.Scene();
    // ═══ EXACT spell-caster / conclave-room setup ═══
    this.scene.background = new T.Color('#000000');

    // 📷 Caméra spell-caster (EXACTEMENT comme conclave-room.component.ts)
    // FAR étendu à 350 pour permettre les vues hautes de l'île pendant le tour
    this.camera = new T.PerspectiveCamera(35, w / h, 0.1, 350);
    // Vue initiale éloignée pour voir le crystal en entier + le contexte de la chambre
    this.camera.position.set(0, 0.9, 3.2);
    this.camera.lookAt(0, -0.1, 0);

    // Renderer cinematic (recette FAB Yamzy)
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // ═══ LIGHTING — 2 sets selon la phase ═══
    // SPLASH (chambre du Conclave, candlelit) : lights chaudes spell-caster
    const splashHemi = new T.HemisphereLight(0xfff5e6, 0x4a3f7a, 1.0);
    this.scene.add(splashHemi);
    const splashAmb = new T.AmbientLight(0xfff0d4, 0.75);
    this.scene.add(splashAmb);
    const splashKey = new T.DirectionalLight(0xffeedd, 0.9);
    splashKey.position.set(2, 3, 3);
    this.scene.add(splashKey);
    // Glow violet pour le crystal (signature spell-caster)
    const crystalGlow = new T.PointLight(0x9b6cff, 0.7, 5);
    crystalGlow.position.set(0, 0.1, 0);
    this.scene.add(crystalGlow);
    (this as any).crystalGlow = crystalGlow;
    (this as any).splashLights = [splashHemi, splashAmb, splashKey];

    // TOUR (île de jour, daylight neutre) : lights froides/balanced, OFF par défaut
    const tourHemi = new T.HemisphereLight(0xb8d8ff, 0x3a5a3a, 0.0);
    this.scene.add(tourHemi);
    const tourAmb = new T.AmbientLight(0xffffff, 0.0);
    this.scene.add(tourAmb);
    const tourSun = new T.DirectionalLight(0xfff8e7, 0.0);
    tourSun.position.set(20, 35, 18);
    this.scene.add(tourSun);
    const tourFill = new T.DirectionalLight(0xc8d8ff, 0.0); // light du nord froide
    tourFill.position.set(-15, 22, -10);
    this.scene.add(tourFill);
    (this as any).tourLights = [
      { light: tourHemi, target: 0.35 },
      { light: tourAmb, target: 0.20 },
      { light: tourSun, target: 0.55 },
      { light: tourFill, target: 0.18 },
    ];

    // Ciel universel (créé mais caché pendant SPLASH = chambre fermée)
    this.sky = buildSkyOrnaments(T, this.scene, {
      starCount: 800,
      starRadius: 110,
      moonPos: [-25, 38, -20],
      auroraPos: [0, 42, -55],
      cometPos: [28, 32, -25],
      shootingStarCount: 7,
    });
    // Cache toutes les composantes célestes pendant SPLASH
    if (this.sky) {
      if (this.sky.starsField) this.sky.starsField.visible = false;
      if (this.sky.moon) this.sky.moon.visible = false;
      this.sky.setAuroraVisible(false);
      if (this.sky.cometTrail) this.sky.cometTrail.visible = false;
      this.sky.shootingStars.forEach((s: any) => s.visible = false);
    }

    // Subscribe au CeremonyBus (les pulses du conte feront briller le ciel)
    this.unsubCeremony = this.ceremonyBus.subscribe((c) => {
      if (c.sourceRoom === 'welcome') return;
      this.sky?.pulseCeremony(c.type);
    });

    // Construit l'île procédurale
    this.islandRoot = new T.Group();
    this.scene.add(this.islandRoot);
    this.buildIsland(T);
    // 🌫 Cache l'île pendant SPLASH — seul le crystal sera visible
    // (le crystal est dans this.scene direct, pas dans islandRoot)
    this.islandRoot.visible = false;

    // OrbitControls — ACTIVÉS pour permettre scroll/zoom dans la room
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(0, -0.1, 0);     // EXACT spell-caster lookAt (sera relocalisé sur le crystal après auto-anchor)
      this.controls.enabled = true;
      // Zoom : portée élargie — peut maintenant voir le crystal de loin
      this.controls.enableZoom = true;
      this.controls.minDistance = 0.8;          // ne pas zoomer dedans le crystal
      this.controls.maxDistance = 6.0;          // peut s'éloigner pour voir toute la chambre
      this.controls.zoomSpeed = 0.6;
      // Rotation : permet de regarder autour mais limite l'angle vertical
      this.controls.enableRotate = true;
      this.controls.rotateSpeed = 0.4;
      this.controls.minPolarAngle = Math.PI * 0.15;
      this.controls.maxPolarAngle = Math.PI * 0.72;
      this.controls.enablePan = false;
      // ━━━ Auto-rotation cinématique autour du crystal ━━━
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.4;      // ~150s pour un tour complet — très cinématique
      // Pause auto-rotate quand l'user interagit (drag/scroll) puis reprend après 4s
      let autoRotateTimer: any = null;
      this.controls.addEventListener('start', () => {
        this.controls.autoRotate = false;
        if (autoRotateTimer) clearTimeout(autoRotateTimer);
      });
      this.controls.addEventListener('end', () => {
        if (autoRotateTimer) clearTimeout(autoRotateTimer);
        autoRotateTimer = setTimeout(() => {
          if (!this.disposed) this.controls.autoRotate = true;
        }, 4000);
      });
      (this as any).autoRotateTimer = autoRotateTimer;
    }

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Île procédurale : disque vert + océan + 11 mini-temples symbolisant les rooms.
   * Pas de GLB — Three.js pur, design proche du yamzy-island-hub mais aérien.
   */
  private buildIsland(T: any): void {
    // Disque île
    const islandRadius = 25;
    const island = new T.Mesh(
      new T.CylinderGeometry(islandRadius, islandRadius + 2, 1.2, 64),
      new T.MeshStandardMaterial({ color: 0x5d9168, roughness: 0.95 })
    );
    island.position.y = -0.6;
    this.islandRoot.add(island);

    // Plage
    const beach = new T.Mesh(
      new T.RingGeometry(islandRadius - 1, islandRadius + 1.5, 64),
      new T.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.95, side: T.DoubleSide })
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 0.06;
    this.islandRoot.add(beach);

    // Océan
    const ocean = new T.Mesh(
      new T.PlaneGeometry(180, 180, 64, 64),
      new T.MeshStandardMaterial({ color: 0x1a3a6e, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.85 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1.8;
    this.islandRoot.add(ocean);
    const oceanBase = new Float32Array(ocean.geometry.attributes.position.array);
    (ocean as any).userData.basePos = oceanBase;
    (this as any).ocean = ocean;

    // ═══════════════════════════════════════════════════════════════
    // 💎 ROOM + CRYSTAL — EXACT spell-caster / conclave-room recipe
    //
    // SPLASH state:
    //   - room.glb scale 0.18 position (0, -0.4, -0.4)   ← chambre du Conclave
    //   - crystal.glb scale 0.07 position (0, -0.05, 0)  ← crystal sur la table
    //   - camera (0, 0.4, 1.6) lookAt (0, -0.1, 0)
    //
    // TOUR state:
    //   - room.glb fade out + hide
    //   - crystal scale up to ~4 + move to (0, 5, 0) on island
    //   - islandRoot.visible = true
    //   - camera flies back to (0, 25, 40)
    // ═══════════════════════════════════════════════════════════════
    const crystalGroup = new T.Group();
    // SPLASH position EXACT spell-caster — crystal sur la table de la chambre
    crystalGroup.position.set(0, -0.05, 0);
    this.scene.add(crystalGroup);
    (this as any).crystal = crystalGroup;

    // ═══════════════════════════════════════════════════════════════
    // 🍂 HÉRITAGE DE L'ARBRE — fruits orbitaux + étincelles + halo
    // L'arbre disparu a légué : ses fruits dorés (releases), ses
    // feuilles qui tombent (commits), son halo lumineux (sagesse).
    // Tout devient enfant du crystalGroup pour suivre ses mouvements.
    // ═══════════════════════════════════════════════════════════════
    const lineageGroup = new T.Group();
    crystalGroup.add(lineageGroup);
    (this as any).lineageGroup = lineageGroup;

    // 🍇 7 fruits dorés orbitant le crystal (= releases tagged)
    const fruits: any[] = [];
    for (let i = 0; i < 7; i++) {
      const fruit = new T.Mesh(
        new T.SphereGeometry(0.4, 12, 8),
        new T.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.8,
          transparent: true, opacity: 0.95,
        })
      );
      fruit.userData = {
        baseAngle: (i / 7) * Math.PI * 2,
        radius: 3.2 + (i % 3) * 0.5,
        speed: 0.25 + (i % 4) * 0.06,
        yPhase: i * 0.7,
        yAmp: 0.6 + (i % 3) * 0.4,
      };
      // Halo additif autour de chaque fruit
      const fruitHalo = new T.Mesh(
        new T.SphereGeometry(0.65, 10, 8),
        new T.MeshBasicMaterial({
          color: 0xfde047, transparent: true, opacity: 0.35,
          blending: T.AdditiveBlending, depthWrite: false,
        })
      );
      fruit.add(fruitHalo);
      lineageGroup.add(fruit);
      fruits.push(fruit);
    }
    (this as any).crystalFruits = fruits;

    // 🌟 Étincelles qui tombent depuis le crystal (= commits)
    const sparkCount = 60;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkSpeeds = new Float32Array(sparkCount);
    const sparkBaseY = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 4;
      sparkPos[i * 3 + 0] = Math.cos(angle) * r;
      sparkPos[i * 3 + 1] = 6 + Math.random() * 4;
      sparkPos[i * 3 + 2] = Math.sin(angle) * r;
      sparkSpeeds[i] = 1.0 + Math.random() * 1.5;
      sparkBaseY[i] = sparkPos[i * 3 + 1];
    }
    const sparkGeom = new T.BufferGeometry();
    sparkGeom.setAttribute('position', new T.BufferAttribute(sparkPos, 3));
    const sparkMat = new T.PointsMaterial({
      size: 0.18, color: 0xfde047, transparent: true, opacity: 0.85,
      blending: T.AdditiveBlending, sizeAttenuation: true,
    });
    const sparks = new T.Points(sparkGeom, sparkMat);
    sparks.userData = { speeds: sparkSpeeds, baseY: sparkBaseY };
    lineageGroup.add(sparks);
    (this as any).crystalSparks = sparks;

    // ✨ Aura discrète autour du crystal (halo additif, taille modérée)
    const auraInner = new T.Mesh(
      new T.SphereGeometry(1.4, 24, 16),
      new T.MeshBasicMaterial({
        color: 0xd54adf, transparent: true, opacity: 0.10,
        blending: T.AdditiveBlending, depthWrite: false,
      })
    );
    const auraOuter = new T.Mesh(
      new T.SphereGeometry(2.0, 20, 14),
      new T.MeshBasicMaterial({
        color: 0xd68ddc, transparent: true, opacity: 0.05,
        blending: T.AdditiveBlending, depthWrite: false,
      })
    );
    lineageGroup.add(auraInner);
    lineageGroup.add(auraOuter);
    (this as any).crystalAura = [auraInner, auraOuter];

    // 💍 3 anneaux d'orbite (rappel des éclats qui circulent)
    const rings: any[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(
        new T.TorusGeometry(3.2 + i * 0.45, 0.04, 8, 64),
        new T.MeshStandardMaterial({
          color: 0xd68ddc, emissive: 0xd68ddc, emissiveIntensity: 0.7,
          transparent: true, opacity: 0.65,
        })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.35;
      ring.userData = { spinSpeed: 0.2 + i * 0.12, axis: i % 2 === 0 ? 'y' : 'z' };
      lineageGroup.add(ring);
      rings.push(ring);
    }
    (this as any).crystalRings = rings;

    // Lineage est CACHÉ pendant SPLASH (room visible only) ; révélé en TOUR
    lineageGroup.visible = false;

    // Texture matcap PNG officielle (sera appliquée au GLB)
    const matcapTexture = new T.TextureLoader().load('/assets/conclave/crystal-matcap.png');
    const matcapMaterial = new T.MeshMatcapMaterial({
      matcap: matcapTexture,
      side: T.DoubleSide,
    });
    (this as any).matcapMaterial = matcapMaterial;

    // 🗺 NOUVEAU FLOW : on ne charge PLUS la chambre ni YAMZY.
    //    À la place, on construit la WORLD MAP 3D directement comme scène finale
    //    (parchemin + 7 zones cliquables flottant dans l'espace, fond noir + ciel).
    setTimeout(() => {
      if (this.disposed) return;
      try {
        this.buildStandaloneWorldMap(T);
        // Focus caméra sur la map
        this.camera.position.set(0, 0.5, 1.2);
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
        // ⚡ Signal "ready" pour que waitUntilYamzyReady() résolve
        (this as any).yamzyExplorer = { _isMapMode: true };
        console.log('[YamzyEntry] ✓ World Map standalone construite (mode map only)');
      } catch (e) {
        console.error('[YamzyEntry] Erreur build standalone map', e);
      }
    }, 50);

    // Charge le crystal.glb
    this.loadCrystalGlb(T).then((crystalScene: any) => {
      if (this.disposed) return;
      if (crystalScene) {
        // EXACT spell-caster : scale 0.07, matcap material appliqué partout
        crystalScene.scale.setScalar(0.07);
        crystalScene.userData.spin = true;
        crystalScene.traverse((c: any) => {
          if (c.isMesh) {
            c.material = matcapMaterial;
            c.frustumCulled = false;
          }
        });
        crystalGroup.add(crystalScene);
        (this as any).crystalScene = crystalScene;
        console.log('[YamzyEntry] ✓ crystal.glb + matcap.png loaded');
        this.sounds.play('crystal-reform', { volume: 0.55 });
      }
    });

    // 10 mini-temples autour (un par room — sans détailler)
    const ROOMS = [
      { angle: 0.00, color: 0x15803d, shape: 'tree' },     // git-tree
      { angle: 0.10, color: 0x7dd3fc, shape: 'cone' },     // kanban-island
      { angle: 0.20, color: 0xa3e9ff, shape: 'box' },      // pr-mirror-hall
      { angle: 0.30, color: 0xea580c, shape: 'flame' },    // phoenix-forge
      { angle: 0.40, color: 0xa855f7, shape: 'mountain' }, // okr-mountain
      { angle: 0.50, color: 0x0891b2, shape: 'cathedral' },// library
      { angle: 0.60, color: 0x8b1a1a, shape: 'dome' },     // star-map
      { angle: 0.70, color: 0xa855f7, shape: 'tank' },     // oracle
      { angle: 0.80, color: 0x84cc16, shape: 'tower' },    // alchemist
      { angle: 0.90, color: 0xfbbf24, shape: 'inn' },      // card-tavern
    ];
    const R = 18;
    for (const room of ROOMS) {
      const a = room.angle * Math.PI * 2;
      const pos = new T.Vector3(Math.cos(a) * R, 0.5, Math.sin(a) * R);
      this.spawnRoomToken(T, pos, room.color, room.shape);
    }
  }

  private spawnRoomToken(T: any, pos: any, color: number, shape: string): void {
    const group = new T.Group();
    group.position.copy(pos);
    const mat = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    // Socle commun
    group.add(new T.Mesh(
      new T.CylinderGeometry(1.4, 1.6, 0.3, 12),
      new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, metalness: 0.5 })
    ));
    // Forme iconique
    let main: any;
    switch (shape) {
      case 'tree':
        main = new T.Mesh(new T.ConeGeometry(0.9, 1.6, 8), mat); break;
      case 'cone':
        main = new T.Mesh(new T.ConeGeometry(1.0, 1.5, 12), mat); break;
      case 'box':
        main = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 1.4), mat); break;
      case 'flame':
        main = new T.Mesh(new T.ConeGeometry(0.6, 1.6, 6), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 })); break;
      case 'mountain':
        main = new T.Mesh(new T.ConeGeometry(1.2, 2.0, 8), mat); break;
      case 'cathedral': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.BoxGeometry(1.3, 1.4, 1.3), mat));
        const spire = new T.Mesh(new T.ConeGeometry(0.55, 1.4, 4), mat);
        spire.position.y = 1.4;
        g.add(spire);
        main = g;
        break;
      }
      case 'dome': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.CylinderGeometry(0.9, 0.95, 1.2, 12), new T.MeshStandardMaterial({ color: 0x4a4f60, roughness: 0.85 })));
        const dome = new T.Mesh(new T.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        dome.position.y = 0.6;
        g.add(dome);
        main = g;
        break;
      }
      case 'tank':
        main = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 1.4), new T.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.55, transmission: 0.6 }));
        break;
      case 'tower': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.CylinderGeometry(0.6, 0.8, 1.8, 8), new T.MeshStandardMaterial({ color: 0x6a7080 })));
        const roof = new T.Mesh(new T.ConeGeometry(0.7, 0.8, 8), mat);
        roof.position.y = 1.4;
        g.add(roof);
        main = g;
        break;
      }
      case 'inn': {
        const g = new T.Group();
        g.add(new T.Mesh(new T.BoxGeometry(1.5, 1.0, 1.3), new T.MeshStandardMaterial({ color: 0x8b6b3e })));
        const roof = new T.Mesh(new T.ConeGeometry(1.2, 0.9, 4), mat);
        roof.position.y = 0.95; roof.rotation.y = Math.PI / 4;
        g.add(roof);
        main = g;
        break;
      }
      default:
        main = new T.Mesh(new T.SphereGeometry(0.8, 16, 12), mat);
    }
    main.position.y = 1.0;
    group.add(main);
    // Halo
    const halo = new T.Mesh(
      new T.RingGeometry(1.6, 1.9, 32),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: T.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.18;
    halo.userData.isHalo = true;
    group.add(halo);
    this.islandRoot.add(group);
  }

  /**
   * Animation caméra fluide (lerp pos + target). Retourne Promise qui résout à la fin.
   */
  private animateCamera(toPos: { x: number, y: number, z: number }, toTarget: { x: number, y: number, z: number }, durationS: number): Promise<void> {
    return new Promise(resolve => {
      const startPos = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
      const startTarget = { x: this.controls?.target?.x ?? 0, y: this.controls?.target?.y ?? 0, z: this.controls?.target?.z ?? 0 };
      const startTime = this.elapsed;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);  // easeOutCubic

      const update = () => {
        if (this.disposed || this.tourAbortController.aborted) { resolve(); return; }
        const dt = this.elapsed - startTime;
        const t = Math.min(1, dt / durationS);
        const k = ease(t);
        this.camera.position.set(
          startPos.x + (toPos.x - startPos.x) * k,
          startPos.y + (toPos.y - startPos.y) * k,
          startPos.z + (toPos.z - startPos.z) * k,
        );
        if (this.controls) {
          this.controls.target.set(
            startTarget.x + (toTarget.x - startTarget.x) * k,
            startTarget.y + (toTarget.y - startTarget.y) * k,
            startTarget.z + (toTarget.z - startTarget.z) * k,
          );
          this.controls.update();
        } else {
          this.camera.lookAt(toTarget.x, toTarget.y, toTarget.z);
        }
        if (t < 1) requestAnimationFrame(update);
        else resolve();
      };
      update();
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // Ocean waves
    const ocean = (this as any).ocean;
    if (ocean) {
      const pos = ocean.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const base = (ocean as any).userData.basePos as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        arr[i * 3 + 1] = Math.sin(x * 0.12 + this.elapsed * 0.7) * 0.35 + Math.cos(z * 0.15 + this.elapsed * 0.5) * 0.28;
      }
      pos.needsUpdate = true;
    }

    // 💎 Crystal — EXACT spell-caster anim
    //   crystalScene (le GLB) : rotation.y += t*0.4, rotation.x = cos(t)*0.1, rotation.z = cos(t)*0.07
    //   crystalGroup (le wrapper) : position.y bobbing autour de la position de base
    //   ATTENTION : on n'override pas la position pendant revealIslandFromCrystal (qui lerp aussi y)
    const crystalScene = (this as any).crystalScene;
    if (crystalScene) {
      crystalScene.rotation.y = this.elapsed * 0.4;
      crystalScene.rotation.x = Math.cos(this.elapsed) * 0.1;
      crystalScene.rotation.z = Math.cos(this.elapsed) * 0.07;
    }

    // 🍇 LINEAGE (héritage de l'arbre disparu) — fruits orbitaux, étincelles, halo, anneaux
    const lineageGroup = (this as any).lineageGroup;
    if (lineageGroup && lineageGroup.visible) {
      // Fruits dorés orbitant le crystal
      const fruits = (this as any).crystalFruits as any[];
      if (fruits) {
        for (const f of fruits) {
          const ud = f.userData;
          const angle = ud.baseAngle + this.elapsed * ud.speed;
          f.position.x = Math.cos(angle) * ud.radius;
          f.position.z = Math.sin(angle) * ud.radius;
          f.position.y = 0 + Math.sin(this.elapsed * 0.8 + ud.yPhase) * ud.yAmp;
          // Pulse de l'emissive
          if (f.material) {
            f.material.emissiveIntensity = 1.6 + Math.sin(this.elapsed * 2 + ud.yPhase) * 0.4;
          }
        }
      }
      // Étincelles qui tombent (commits)
      const sparks = (this as any).crystalSparks;
      if (sparks) {
        const pos = sparks.geometry.attributes.position;
        const arr = pos.array as Float32Array;
        const speeds = sparks.userData.speeds as Float32Array;
        const baseY = sparks.userData.baseY as Float32Array;
        for (let i = 0; i < speeds.length; i++) {
          arr[i * 3 + 1] -= speeds[i] * dt;
          // Respawn en haut quand atteint le bas
          if (arr[i * 3 + 1] < -2) {
            arr[i * 3 + 1] = baseY[i];
          }
        }
        pos.needsUpdate = true;
        if (sparks.material) {
          sparks.material.opacity = 0.75 + Math.sin(this.elapsed * 1.3) * 0.15;
        }
      }
      // Aura pulsante (discrète)
      const aura = (this as any).crystalAura as any[];
      if (aura) {
        aura[0].material.opacity = 0.10 + Math.sin(this.elapsed * 1.1) * 0.04;
        aura[0].scale.setScalar(1 + Math.sin(this.elapsed * 0.7) * 0.04);
        aura[1].material.opacity = 0.05 + Math.sin(this.elapsed * 0.9 + 1.5) * 0.025;
        aura[1].scale.setScalar(1 + Math.sin(this.elapsed * 0.5 + 0.8) * 0.03);
      }
      // Anneaux qui orbitent
      const rings = (this as any).crystalRings as any[];
      if (rings) {
        for (const r of rings) {
          if (r.userData.axis === 'y') r.rotation.y += dt * r.userData.spinSpeed;
          else r.rotation.z += dt * r.userData.spinSpeed;
        }
      }
    }

    // 🏠 Room.glb rotation TRÈS lente (effet panoramique, EXACT conclave-room)
    const roomGlb = (this as any).roomGlb;
    if (roomGlb && roomGlb.visible) {
      roomGlb.rotation.y = Math.sin(this.elapsed * 0.05) * 0.1;
    }

    // Halos pulsing
    if (this.islandRoot) {
      this.islandRoot.traverse((obj: any) => {
        if (obj.userData?.isHalo && obj.material) {
          obj.material.opacity = 0.3 + Math.sin(this.elapsed * 1.6 + obj.position.x * 0.1) * 0.15;
        }
      });
    }

    // 💧 ÉNERGIE qui coule du crystal vers les temples (eau dans le vide)
    const flows = (this as any).energyFlows;
    if (flows) {
      for (const pts of flows) {
        const ud = pts.userData;
        const target = ud.target;
        const positions = pts.geometry.attributes.position.array as Float32Array;
        const count = positions.length / 3;
        // Chaque point se déplace le long d'un arc parabolique de crystal vers target
        // Pour faire l'effet "eau qui coule", chaque point a un offset progressif
        for (let j = 0; j < count; j++) {
          // Phase qui cycle : 0..1 le long du trajet, basée sur elapsed + index
          const phase = ((this.elapsed * ud.speed + j * 0.03 + ud.offset) % 1);
          // Position interpolée crystal → target avec un arc (parabolic up then down)
          const t = phase;
          const ax = 0 + (target.x - 0) * t;
          const az = 0 + (target.z - 0) * t;
          // Arc : y = start_y + sin(π*t) * arc_height
          const ay = 5 + Math.sin(Math.PI * t) * 6 - t * 3.5;
          positions[j * 3] = ax;
          positions[j * 3 + 1] = ay;
          positions[j * 3 + 2] = az;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        // Pulse opacity
        if (pts.material) {
          pts.material.opacity = 0.7 + Math.sin(this.elapsed * 3 + ud.offset * 6) * 0.2;
        }
      }
    }

    // Sky universel
    this.sky?.tick(dt, this.elapsed);

    // Auto-rotation lente pendant splash (effet "monde qui respire")
    if (this.phase() === 'splash' && this.islandRoot) {
      this.islandRoot.rotation.y += dt * 0.04;
    }

    // 🚶 Met à jour l'explorer (déplacement YAMZY + caméra follow)
    try { this.explorer.update(dt); } catch {}
    // YAMZY animation mixer (walk/idle)
    const yamzyMixer = (this as any).yamzyMixer;
    if (yamzyMixer) { try { yamzyMixer.update(dt); } catch {} }

    // 🏝 Anim du GLB treasure island (cube qui tourne, sphère/fantôme qui flotte)
    const islandMixer = (this as any).treasureIslandMixer;
    if (islandMixer) { try { islandMixer.update(dt); } catch {} }

    // 🗺 Anim de la World Map (pulse rings + hover bobbing)
    const wmIslands = (this as any).worldMapIslands;
    if (wmIslands && wmIslands.length) {
      (this as any).worldMapElapsed = ((this as any).worldMapElapsed || 0) + dt;
      const t = (this as any).worldMapElapsed;
      for (let i = 0; i < wmIslands.length; i++) {
        const isl = wmIslands[i];
        // Léger bobbing vertical (chaque île phase décalée)
        isl.position.y = isl.userData.baseY + Math.sin(t * 1.5 + i * 0.8) * 0.003;
        // Anneau pulsant
        const ring = isl.userData.pulseRing;
        if (ring) {
          const s = 1 + Math.sin(t * 2 + i * 0.5) * 0.15;
          ring.scale.set(s, s, 1);
          ring.material.opacity = 0.4 + Math.sin(t * 2 + i * 0.5) * 0.2;
        }
      }
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Utility delay
  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private onResize = (): void => {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
