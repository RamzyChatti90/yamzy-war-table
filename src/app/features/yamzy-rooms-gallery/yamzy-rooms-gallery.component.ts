// ═══════════════════════════════════════════════════════════════════
// 🏝 YAMZY ROOMS GALLERY — La Vitrine des Scènes
//
// Page d'accueil : cards pour chaque room + island + studio maker.
// Design IDENTIQUE au YAMZY STUDIO MAKER (même topbar, mêmes couleurs).
// Chaque card a un bouton "Go to" qui navigue comme si on cliquait
// sur le bâtiment depuis l'île.
// ═══════════════════════════════════════════════════════════════════
import {
  AfterViewInit, ChangeDetectionStrategy, Component, effect, ElementRef, OnDestroy,
  ViewChild, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SpellButtonComponent, SpellChoicesComponent, SpellChoice, SpellFooterService } from '../../core/spell-ui';

type GalleryFilter = 'all' | 'hub' | 'studio' | 'room' | 'workshop';

interface SceneCard {
  key: string;
  route: string;
  icon: string;
  name: string;
  loreName: string;
  color: string;
  description: string;
  category: 'hub' | 'studio' | 'room' | 'workshop';
  status?: 'ready' | 'beta' | 'planned';
}

@Component({
  selector: 'wt-yamzy-rooms-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink, SpellButtonComponent, SpellChoicesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'yrg-bg-host' },
  template: `
    <div class="yrg-host">
      <!-- 🌌 Canvas 3D ambient (stars + crystal flottant — DNA Yamzy World) -->
      <canvas #bgCanvas class="yrg-bg-canvas"></canvas>

      <!-- ═══ TOPBAR Studio Maker (sans back, le SpellHeader global le gère) ═══ -->
      <header class="yrg-topbar">
        <div class="yrg-brand">
          <span class="yrg-brand-icon">🏝</span>
          <span class="yrg-brand-text">YAMZY WORLD</span>
        </div>
        <nav class="yrg-nav">
          <wt-spell-choices
            [choices]="filterChoices"
            [selected]="filter()"
            accent="#d54adf"
            (selectedChange)="setFilter($event)" />
        </nav>
        <div class="yrg-actions">
          <!-- 🎓 Guide animé (graduation cap SVG) -->
          <a class="yrg-svg-icon yrg-guide-btn"
             routerLink="/showcase/yamzy-world"
             title="Visite guidée animée — Yamzy raconte le projet"
             aria-label="Guide animé">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </a>

          <!-- 🏝 Vue île 3D (palm tree island SVG) -->
          <a class="yrg-svg-icon yrg-island-btn"
             routerLink="/yamzy-island"
             title="Vue île 3D — Le Conclave"
             aria-label="Vue île 3D">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <!-- Palmier -->
              <path d="M12 22V12"/>
              <path d="M12 12c0-3-2-5-5-5 0 3 2 5 5 5z"/>
              <path d="M12 12c0-3 2-5 5-5 0 3-2 5-5 5z"/>
              <path d="M12 12c-1.5 0-3-1-3-3 1.5 0 3 1 3 3z"/>
              <path d="M12 12c1.5 0 3-1 3-3-1.5 0-3 1-3 3z"/>
              <!-- Ile (vague) -->
              <path d="M2 20c2-1 4-1 6 0s4 1 6 0 4-1 6 0 4 1 4 0"/>
            </svg>
          </a>

          <!-- 🏗 Studio Maker (tools / wrench SVG) -->
          <a class="yrg-svg-icon yrg-studio-btn"
             routerLink="/yamzy-studio-maker"
             title="Studio Maker — Créer une scène"
             aria-label="Studio Maker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <!-- Clé à molette croisée + tournevis -->
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </a>
        </div>
      </header>

      <!-- ═══ MAIN — Hero + Grid de cards ═══ -->
      <main class="yrg-main">
        <section class="yrg-hero">
          <h1 class="yrg-hero-title">Le Conclave des 13 Rooms</h1>
          <p class="yrg-hero-subtitle">
            Choisis ta destination — chaque scène est une mécanique 3D unique de manipulation de la data.
          </p>
        </section>

        <section class="yrg-grid">
          @for (card of filtered(); track card.key) {
            <article class="yrg-card" [style.--accent]="card.color" [attr.data-cat]="card.category">
              <div class="yrg-card-bar"></div>
              <div class="yrg-card-icon-wrap">
                <div class="yrg-card-icon-halo"></div>
                <span class="yrg-card-icon">{{ card.icon }}</span>
              </div>
              <div class="yrg-card-name">{{ card.name }}</div>
              <div class="yrg-card-lore">{{ card.loreName }}</div>
              <div class="yrg-card-desc">{{ card.description }}</div>
              <div class="yrg-card-meta">
                <span class="yrg-card-cat">{{ catLabel(card.category) }}</span>
                @if (card.status === 'beta') { <span class="yrg-card-beta">BETA</span> }
              </div>
              <button class="yrg-card-cta" (click)="goTo(card)">
                Go to → <span class="yrg-card-cta-arrow">↗</span>
              </button>
            </article>
          }
        </section>
      </main>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed; inset: 0;
      width: 100vw; height: 100vh; height: 100dvh;
      overflow: hidden;       /* page jamais scrollable, seulement les cards à l'intérieur */
    }
    .yrg-bg-canvas {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      display: block;
      z-index: 0;
      pointer-events: none;
    }

    /* Variables = Studio Maker palette */
    .yrg-host { display: flex; flex-direction: column; height: 100%; max-height: 100dvh; background: transparent; color: #e8eaf6; font-family: system-ui, sans-serif; font-size: 13px; overflow: hidden; position: relative; z-index: 1; }

    /* ═══ TOPBAR (identique Studio Maker) ═══ */
    /* Topbar en panneau de verre : semi-opaque pour que les filtres + actions soient bien visibles contre la scène 3D */
    .yrg-topbar { display: flex; align-items: center; gap: 14px; padding: 10px 22px; background: rgba(7, 4, 26, 0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid rgba(213,74,223,0.35); flex: 0 0 auto; min-height: 56px; flex-wrap: wrap; margin-top: 60px; box-shadow: 0 4px 16px rgba(0,0,0,0.45); }
    /* Override des chips spell-choices via ::ng-deep (pierce View Encapsulation) */
    .yrg-topbar ::ng-deep .sc-chip { background-color: rgba(0,0,0,0.45) !important; border-color: rgba(213,74,223,0.5) !important; backdrop-filter: blur(4px); }
    .yrg-topbar ::ng-deep .sc-chip:hover { border-color: #d54adf !important; background-color: rgba(0,0,0,0.65) !important; box-shadow: 0 0 12px rgba(213,74,223,0.45) !important; transform: translateY(-1px); }
    .yrg-topbar ::ng-deep .sc-chip.is-active { background-color: rgba(213,74,223,0.18) !important; border-color: #d54adf !important; color: #fff !important; box-shadow: 0 0 16px rgba(213,74,223,0.55) !important; }
    .yrg-brand { display: flex; align-items: center; gap: 10px; }
    .yrg-brand-icon { font-size: 28px; filter: drop-shadow(0 0 8px rgba(251,191,36,0.4)); }
    .yrg-brand-text { font-weight: 800; letter-spacing: 2px; color: #fbbf24; font-size: 16px; }
    .yrg-nav { display: flex; gap: 4px; margin-left: 12px; }
    .yrg-nav button { background: rgba(20,25,50,0.7); color: #e8eaf6; border: 1px solid #3b3f55; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; }
    .yrg-nav button:hover { background: rgba(60,80,150,0.5); }
    .yrg-nav button.active { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .yrg-actions { display: flex; gap: 4px; margin-left: auto; align-items: center; }

    /* ━━━ SVG icon buttons (cohérent avec SpellHeader / hub) ━━━ */
    .yrg-svg-icon {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      text-decoration: none;
      transition: color 0.25s ease, transform 0.25s ease, filter 0.25s ease;
      overflow: visible;
    }
    .yrg-svg-icon svg {
      width: 28px;
      height: 28px;
      transition: transform 0.25s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.9));
    }
    .yrg-svg-icon:hover svg { transform: scale(1.12); }
    .yrg-svg-icon:active { transform: scale(0.92); }

    /* 🎓 Guide animé : violet clair (sagesse) */
    .yrg-guide-btn:hover {
      color: #c084fc;
      filter: drop-shadow(0 0 10px rgba(192, 132, 252, 0.7));
    }
    /* 🏝 Vue île : magenta crystal */
    .yrg-island-btn:hover {
      color: #d54adf;
      filter: drop-shadow(0 0 10px rgba(213, 74, 223, 0.7));
    }
    /* 🏗 Studio Maker : doré-construction */
    .yrg-studio-btn:hover {
      color: #fbbf24;
      filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.7));
    }
    .yrg-studio-btn:hover svg { transform: scale(1.12) rotate(-15deg); }
    .yrg-quick-primary:hover { background: #f5b923; }
    .yrg-quick-guide {
      background: linear-gradient(135deg, rgba(168,85,247,0.4) 0%, rgba(96,165,250,0.4) 100%);
      color: #e9d5ff;
      border-color: #c084fc;
      font-weight: 700;
      box-shadow: 0 0 12px rgba(192,132,252,0.35);
      position: relative;
      overflow: hidden;
    }
    .yrg-quick-guide::after {
      content: '✨';
      position: absolute;
      right: 6px;
      top: 3px;
      font-size: 8px;
      opacity: 0.7;
      animation: yrg-sparkle 2s ease-in-out infinite;
    }
    @keyframes yrg-sparkle {
      0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
      50% { transform: scale(1.4) rotate(180deg); opacity: 1; }
    }
    .yrg-quick-guide:hover {
      background: linear-gradient(135deg, rgba(168,85,247,0.6) 0%, rgba(96,165,250,0.6) 100%);
      box-shadow: 0 0 18px rgba(192,132,252,0.6), 0 2px 8px rgba(0,0,0,0.4);
    }

    /* ═══ MAIN ═══ */
    .yrg-main { flex: 1 1 auto; min-height: 0; padding: 28px 32px 60px; max-width: 1400px; width: 100%; margin: 0 auto; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; }

    .yrg-hero { text-align: center; margin-bottom: 32px; }
    .yrg-hero-title { font-size: 38px; font-weight: 800; letter-spacing: 1.5px; color: #fbbf24; margin: 0 0 8px; text-shadow: 0 0 24px rgba(251,191,36,0.3); }
    .yrg-hero-subtitle { font-size: 14px; color: #cbd5e1; opacity: 0.85; max-width: 700px; margin: 0 auto; line-height: 1.6; }

    /* ═══ GRID Cards ═══ */
    .yrg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }

    .yrg-card {
      position: relative;
      background: linear-gradient(135deg, rgba(20,25,50,0.7) 0%, rgba(30,35,65,0.7) 100%);
      border: 1px solid #2a3055;
      border-radius: 16px;
      padding: 22px 18px 18px;
      display: flex; flex-direction: column; gap: 6px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(6px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .yrg-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent, #fbbf24);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--accent, #fbbf24);
    }
    .yrg-card-bar {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: var(--accent, #fbbf24);
      border-radius: 16px 16px 0 0;
      box-shadow: 0 0 16px var(--accent, #fbbf24);
    }
    .yrg-card-icon-wrap { position: relative; width: 80px; height: 80px; margin: 8px auto 10px; display: flex; align-items: center; justify-content: center; }
    .yrg-card-icon-halo {
      position: absolute; inset: 0; border-radius: 50%;
      background: radial-gradient(circle, var(--accent, #fbbf24) 0%, transparent 70%);
      opacity: 0.25;
      filter: blur(8px);
    }
    .yrg-card-icon { position: relative; font-size: 56px; line-height: 1; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4)); }
    .yrg-card-name { font-size: 16px; font-weight: 800; letter-spacing: 1px; color: var(--accent, #fbbf24); text-align: center; }
    .yrg-card-lore { font-size: 11px; color: #cbd5e1; opacity: 0.75; text-align: center; font-style: italic; }
    .yrg-card-desc { font-size: 12px; color: #cbd5e1; opacity: 0.85; line-height: 1.5; text-align: center; margin: 8px 0 6px; min-height: 36px; }
    .yrg-card-meta { display: flex; justify-content: center; gap: 6px; margin-bottom: 12px; }
    .yrg-card-cat { font-size: 9px; padding: 2px 8px; background: rgba(0,0,0,0.4); border: 1px solid #3a4070; border-radius: 4px; color: #93c5fd; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }
    .yrg-card-beta { font-size: 9px; padding: 2px 8px; background: rgba(160,80,20,0.4); border: 1px solid #ea580c; border-radius: 4px; color: #fdba74; letter-spacing: 1px; font-weight: 700; }
    .yrg-card-cta {
      background: var(--accent, #fbbf24);
      color: #1a1500;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
      font-family: inherit;
    }
    .yrg-card-cta:hover {
      filter: brightness(1.1);
      box-shadow: 0 4px 16px var(--accent, #fbbf24);
      transform: translateY(-1px);
    }
    .yrg-card-cta-arrow { font-size: 14px; transition: transform 0.2s; }
    .yrg-card:hover .yrg-card-cta-arrow { transform: translate(2px, -2px); }

    /* ═══ Variations par catégorie ═══ */
    .yrg-card[data-cat="hub"] { background: linear-gradient(135deg, rgba(40,40,70,0.85) 0%, rgba(40,30,5,0.4) 100%); }
    .yrg-card[data-cat="studio"] { background: linear-gradient(135deg, rgba(20,40,80,0.7) 0%, rgba(30,50,90,0.7) 100%); }
  `]
})
export class YamzyRoomsGalleryComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bgCanvas', { static: true }) bgCanvasRef!: ElementRef<HTMLCanvasElement>;
  private router = inject(Router);
  private spellFooter = inject(SpellFooterService);
  filter = signal<GalleryFilter>('all');
  setFilter(v: GalleryFilter) { this.filter.set(v); }

  constructor() {
    // 🪄 Pousse les stats vers le SpellFooter global, réactif au filtre courant.
    effect(() => {
      const shown = this.filtered().length;
      const total = this.cards.length;
      this.spellFooter.setSlots({
        accent: '#d54adf',
        controls: [],
        hint: `${shown} / ${total} scènes · 💡 Astuce : tu peux aussi explorer l'île en 3D depuis 🏝 Vue île`,
      });
    });
  }

  // ─── Three.js ambient scene (stars + crystal flottant) ──────────────
  private bgScene: any;
  private bgCamera: any;
  private bgRenderer: any;
  private bgClock: any;
  private bgRafId: number = 0;
  private bgDisposed = false;
  private bgCrystal: any;
  private bgStars: any;

  async ngAfterViewInit(): Promise<void> {
    await this.ensureThree();
    if (this.bgDisposed) return;
    this.initBgScene();
    this.animateBg();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    this.bgDisposed = true;
    cancelAnimationFrame(this.bgRafId);
    window.removeEventListener('resize', this.onResize);
    try {
      if (this.bgRenderer) { this.bgRenderer.dispose(); }
      if (this.bgCrystal?.geometry) this.bgCrystal.geometry.dispose();
      if (this.bgCrystal?.material) this.bgCrystal.material.dispose();
    } catch {}
    this.spellFooter.clearSlots();
  }

  private async ensureThree(): Promise<void> {
    if ((window as any).THREE) return;
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }

  private initBgScene(): void {
    const T = (window as any).THREE;
    const canvas = this.bgCanvasRef.nativeElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    this.bgScene = new T.Scene();
    this.bgScene.background = new T.Color(0x07041a);  // nuit violette profonde
    this.bgScene.fog = new T.FogExp2(0x07041a, 0.015);

    // Camera
    this.bgCamera = new T.PerspectiveCamera(40, w / h, 0.1, 200);
    this.bgCamera.position.set(0, 1.5, 6);
    this.bgCamera.lookAt(0, 0, 0);

    // Renderer
    this.bgRenderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.bgRenderer.setSize(w, h, false);
    this.bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.bgRenderer.outputEncoding = T.sRGBEncoding;
    this.bgRenderer.toneMapping = T.ACESFilmicToneMapping;
    this.bgRenderer.toneMappingExposure = 1.3;

    this.bgClock = new T.Clock();

    // Lights
    const ambient = new T.AmbientLight(0x4a3a8a, 0.55);
    this.bgScene.add(ambient);
    const point1 = new T.PointLight(0xd54adf, 1.8, 18);
    point1.position.set(0, 1.5, 0);
    this.bgScene.add(point1);
    const point2 = new T.PointLight(0x9b6cff, 0.8, 14);
    point2.position.set(-3, 2, 1);
    this.bgScene.add(point2);

    // ⭐ 300 étoiles statiques (BufferGeometry points)
    const starsGeom = new T.BufferGeometry();
    const positions = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const r = 50 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    starsGeom.setAttribute('position', new T.BufferAttribute(positions, 3));
    const starsMat = new T.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85, sizeAttenuation: true });
    this.bgStars = new T.Points(starsGeom, starsMat);
    this.bgScene.add(this.bgStars);

    // 💎 Crystal icosahedron magenta émissif au centre
    const crystalGeom = new T.IcosahedronGeometry(1.05, 0);
    const crystalMat = new T.MeshStandardMaterial({
      color: 0xd54adf,
      emissive: 0xd54adf,
      emissiveIntensity: 0.55,
      metalness: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });
    this.bgCrystal = new T.Mesh(crystalGeom, crystalMat);
    this.bgCrystal.position.set(0, 0.4, 0);
    this.bgScene.add(this.bgCrystal);

    // Halo cristal (sphère plus grande, transparente)
    const haloGeom = new T.SphereGeometry(2.2, 24, 24);
    const haloMat = new T.MeshBasicMaterial({
      color: 0xd54adf,
      transparent: true,
      opacity: 0.07,
      side: T.BackSide,
    });
    const halo = new T.Mesh(haloGeom, haloMat);
    halo.position.copy(this.bgCrystal.position);
    this.bgScene.add(halo);

    // Ground island (cylindre plat sombre)
    const islandGeom = new T.CylinderGeometry(4, 4.5, 0.4, 32);
    const islandMat = new T.MeshStandardMaterial({
      color: 0x1a1530, emissive: 0x0a0420, emissiveIntensity: 0.2,
      metalness: 0.3, roughness: 0.8,
    });
    const island = new T.Mesh(islandGeom, islandMat);
    island.position.set(0, -1.5, 0);
    this.bgScene.add(island);
  }

  private animateBg = (): void => {
    if (this.bgDisposed || !this.bgRenderer) return;
    const dt = this.bgClock.getDelta();
    const t = this.bgClock.elapsedTime;
    // Crystal rotation lente
    if (this.bgCrystal) {
      this.bgCrystal.rotation.y += dt * 0.4;
      this.bgCrystal.rotation.x += dt * 0.15;
      this.bgCrystal.position.y = 0.4 + Math.sin(t * 0.6) * 0.18;  // float vertical
      this.bgCrystal.material.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.15;  // pulse
    }
    // Stars rotation tres lente
    if (this.bgStars) {
      this.bgStars.rotation.y += dt * 0.015;
    }
    this.bgRenderer.render(this.bgScene, this.bgCamera);
    this.bgRafId = requestAnimationFrame(this.animateBg);
  };

  private onResize = (): void => {
    if (!this.bgRenderer || !this.bgCanvasRef) return;
    const canvas = this.bgCanvasRef.nativeElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    this.bgCamera.aspect = w / h;
    this.bgCamera.updateProjectionMatrix();
    this.bgRenderer.setSize(w, h, false);
  };


  filterChoices: SpellChoice<GalleryFilter>[] = [
    { value: 'all',      label: 'Tout' },
    { value: 'hub',      label: 'Hubs',      icon: '🏝' },
    { value: 'studio',   label: 'Studios',   icon: '🏗' },
    { value: 'room',     label: 'Rooms',     icon: '🚪' },
    { value: 'workshop', label: 'Workshops', icon: '💧' },
  ];

  cards: SceneCard[] = [
    // Hubs
    { key: 'island',         route: '/yamzy-island',       icon: '🏝', name: 'YAMZY ISLAND',      loreName: 'Le Conclave',                       color: '#fbbf24', description: 'Vue isométrique 3D de l\'île avec les 11 rooms cliquables. Mode play / mode edit avec gizmo Blender.', category: 'hub', status: 'ready' },
    { key: 'studio-maker',   route: '/yamzy-studio-maker', icon: '🏗', name: 'STUDIO MAKER',      loreName: 'L\'Atelier Universel',              color: '#86efac', description: 'Éditeur 3D pour créer des rooms : librairie templates + inspector + GLB import/export + tutorial form-builder.', category: 'studio', status: 'beta' },
    // Island Hubs — 4 îles thématiques avec portails
    { key: 'island-delivery',  route: '/island/delivery',  icon: '🌿', name: 'ÎLE LIVRAISON',     loreName: 'L\'Archipel des Œuvres',            color: '#86efac', description: 'Hub des 4 rooms du flux de livraison : Git Tree, PR Mirror, Kanban, Phoenix Forge. 3 portails vers les autres îles.', category: 'hub', status: 'ready' },
    { key: 'island-strategy',  route: '/island/strategy',  icon: '🌌', name: 'ÎLE STRATÉGIE',     loreName: 'Le Royaume Stellaire',              color: '#a855f7', description: 'Hub des 3 rooms de la stratégie : OKR Mountain, Star Map Risks, Telescope Island. 3 portails magiques.', category: 'hub', status: 'ready' },
    { key: 'island-knowledge', route: '/island/knowledge', icon: '🏛', name: 'ÎLE SAVOIR',        loreName: 'Le Sanctuaire des Voix',            color: '#06b6d4', description: 'Hub des 2 rooms du savoir : Library Cathedral + Oracle Aquarium. Étang + bibliothèque + 3 portails.', category: 'hub', status: 'ready' },
    { key: 'island-commerce',  route: '/island/commerce',  icon: '⚗', name: 'ÎLE COMMERCE',      loreName: 'La Côte d\'Ambre',                  color: '#fbbf24', description: 'Hub des 2 rooms du commerce : Alchemist Cellar + Card Tavern. Tonneaux d\'or + 3 portails.', category: 'hub', status: 'ready' },
    // Rooms — alignées sur le Hub Island
    { key: 'conclave',          route: '/conclave',            icon: '💎', name: 'CONCLAVE VESPER',   loreName: 'Le studio du stratège',             color: '#d99a51', description: 'Orrery 3D où chaque ticket orbite. 42 pages Scrum, cérémonies par alignement géométrique.', category: 'room', status: 'ready' },
    { key: 'orrery-viewer',     route: '/orrery-viewer',       icon: '🔭', name: 'ORRERY VIEWER',     loreName: 'Le Planétarium des Sprints',        color: '#a3b8d0', description: 'Vue standalone fullscreen du Cosmos × Crystal avec sliders + timeline 60s + demo project.', category: 'room', status: 'ready' },
    { key: 'git-tree',          route: '/git-tree-room',       icon: '🌳', name: 'GIT TREE',          loreName: 'L\'Arbre des Lignées',              color: '#15803d', description: 'Chêne 3D où chaque branche git est une vraie branche, feuilles=commits, fruits=releases.', category: 'room', status: 'ready' },
    { key: 'kanban-island',     route: '/kanban-island',       icon: '🏝', name: 'KANBAN ISLAND',     loreName: 'L\'Archipel des Quêtes',            color: '#7dd3fc', description: 'Île 3D où les tickets voyagent de la plage au sommet. Marée=deadline, volcan=release.', category: 'room', status: 'ready' },
    { key: 'pr-mirror-hall',    route: '/pr-mirror-hall',      icon: '🪞', name: 'PR MIRROR HALL',    loreName: 'La Galerie des Vérités',            color: '#a3e9ff', description: 'Hall circulaire avec 8 miroirs PR + statues reviewers + tapis rouge mergeable.', category: 'room', status: 'ready' },
    { key: 'phoenix-forge',     route: '/phoenix-forge',       icon: '🔥', name: 'PHOENIX FORGE',     loreName: 'L\'Atelier des Renaissances',       color: '#ea580c', description: 'Athanor + phénix vivant + 600 flame particles. Releases = œufs qui éclosent.', category: 'room', status: 'ready' },
    { key: 'okr-mountain',      route: '/okr-mountain',        icon: '⛰', name: 'OKR MOUNTAIN',      loreName: 'L\'Ascension du Sommet',            color: '#a855f7', description: 'Montagne 3D avec sentier spiral + cordée + 4 météos. Sommet = objective trimestriel.', category: 'room', status: 'ready' },
    { key: 'library-cathedral', route: '/library-cathedral',   icon: '🏛', name: 'LIBRARY CATHEDRAL', loreName: 'La Bibliothèque du Conclave',       color: '#0891b2', description: '50 livres procéduraux + vitraux + aigle messager + sphère de recherche luminueuse.', category: 'room', status: 'ready' },
    { key: 'star-map-risks',    route: '/star-map-risks',      icon: '🌌', name: 'STAR MAP RISKS',    loreName: 'La Carte Céleste des Périls',       color: '#8b1a1a', description: 'Planétarium 3D + constellations=risques + comètes + éclipses + supernovas.', category: 'room', status: 'ready' },
    { key: 'oracle-aquarium',   route: '/oracle-aquarium',     icon: '🐠', name: 'ORACLE AQUARIUM',   loreName: 'L\'Étang des Voix',                 color: '#a855f7', description: '30 poissons-interviews + 3 méduses pain points + trésor persona + aigle pêcheur.', category: 'room', status: 'ready' },
    { key: 'alchemist-cellar',  route: '/alchemist-cellar',    icon: '⚗', name: 'ALCHEMIST CELLAR',  loreName: 'La Cave aux Fioles',                color: '#84cc16', description: '18 fioles colorées + athanor central + cristaux distillés + hibou alerte budget.', category: 'room', status: 'ready' },
    { key: 'card-tavern',       route: '/card-tavern',         icon: '🎴', name: 'CARD TAVERN',       loreName: 'La Taverne aux Cartes',             color: '#fbbf24', description: 'Taverne médiévale + cartes prospects + aubergiste NPC + carte aux trésors murale.', category: 'room', status: 'ready' },
    { key: 'telescope-island',  route: '/telescope-island',    icon: '🔭', name: 'TELESCOPE ISLAND',  loreName: 'L\'Observatoire des Phénomènes',    color: '#c4b5fd', description: 'Île + observatoire + télescope pivotable. Le ciel reflète TOUS les événements projet : comète, éclipse, aurora, supernova, nébula...', category: 'room', status: 'ready' },
    // ─── 💧 Workshops Scrum ───
    { key: 'mana-fountain',     route: '/mana-fountain',       icon: '💧', name: 'MANA FOUNTAIN',     loreName: 'La Source qui mesure la magie',     color: '#d54adf', description: 'Sensibilisation IA / Eau / $ : chaque sort consomme tokens + mL d\'eau + dollars. Jauge live, budget mensuel, équivalences.', category: 'workshop', status: 'ready' },
    { key: 'retro-cove',        route: '/retrospective-cove',  icon: '⛵', name: 'RETRO SAILBOAT',    loreName: 'Le Cercle du Rétroviseur',          color: '#67e8f9', description: 'Sprint retrospective format Sailboat : vent (Glad), ancres (Sad), récifs (Mad), île objectif.', category: 'workshop', status: 'ready' },
    { key: 'premortem-crypt',   route: '/premortem-crypt',     icon: '⚰', name: 'PRE-MORTEM CRYPT',  loreName: 'Le Caveau des Pré-Mortems',         color: '#831843', description: 'Imaginer les scénarios d\'échec : sarcophages = causes de mort, bougies = vote impact, runes = contre-mesures.', category: 'workshop', status: 'ready' },
    { key: 'story-trail',       route: '/story-trail',         icon: '🏔', name: 'STORY MAPPING',     loreName: 'La Carte des Sentiers',             color: '#f59e0b', description: 'Story Mapping Jeff Patton : sentiers user journey + pierres user stories + ligne de release MVP.', category: 'workshop', status: 'ready' },
    { key: 'lean-coffee',       route: '/lean-coffee',         icon: '☕', name: 'LEAN COFFEE',       loreName: 'La Brûlerie Lean',                  color: '#6b4423', description: 'Agenda démocratique : tasses-sujets qui se déplacent To Discuss → Discussing → Discussed → Action.', category: 'workshop', status: 'ready' },
    { key: 'refinement-orchard',route: '/refinement-orchard',  icon: '🍇', name: 'REFINEMENT ORCHARD',loreName: 'Le Verger des Affinages',           color: '#84cc16', description: 'Backlog grooming : fruits = tickets, mûrissent quand DoR OK. Cueillir, scinder, estimer.', category: 'workshop', status: 'ready' },
    { key: 'five-whys-well',    route: '/five-whys-well',      icon: '🪨', name: 'FIVE WHYS WELL',    loreName: 'Le Puits des Cinq Pourquoi',        color: '#475569', description: 'Root cause analysis : descendre 5 niveaux pour atteindre la racine. Toyota method.', category: 'workshop', status: 'ready' },
    { key: 'definitions-beach', route: '/definitions-beach',   icon: '🏖', name: 'DEFINITIONS BEACH', loreName: 'La Plage des Définitions',          color: '#fde68a', description: 'DoR / DoD : drapeaux Ready/Done plantés dans le sable, liens entre eux, export markdown.', category: 'workshop', status: 'ready' },
    // Bonus
    { key: 'orrery-lab',     route: '/orrery-lab',     icon: '🧪', name: 'ORRERY LAB',     loreName: 'Le Laboratoire des Mécaniques',  color: '#60a5fa', description: 'Scène 3D pure (no GLB) pour valider les mécaniques avant de les porter à la prod.', category: 'studio', status: 'beta' },
  ];

  // Computed via signal — re-runs quand filter() change
  filtered = computed(() => {
    const f = this.filter();
    if (f === 'all') return this.cards;
    return this.cards.filter(c => c.category === f);
  });

  catLabel(c: string): string {
    switch (c) {
      case 'hub': return '🏝 HUB';
      case 'studio': return '🏗 STUDIO';
      case 'room': return '🚪 ROOM';
      case 'workshop': return '💧 WORKSHOP';
      default: return c;
    }
  }

  goTo(card: SceneCard) {
    this.router.navigate([card.route]);
  }
}
