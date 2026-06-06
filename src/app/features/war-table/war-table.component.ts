// WAR TABLE ⚔ — Planning Organisator Studio (standalone app, port 4201).
// Split en 3 fichiers : .ts (classe) / .html (template) / .css (styles).

import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { WarTableApi, PosProject, PosTicket, ImportResult } from './war-table.api';
import { AuthService } from '../../core/services/auth.service';
import { WAR_TABLE_PAGES, PageDef as SharedPageDef, SUPER_CATS, SuperCat, SuperCatDef } from './war-table.pages';
import { PAGE_META, ROLE_LABELS, ScrumRole, ActionDef, PageMeta, getPageMeta } from './war-table.pages-meta';
import { WarTableSplashComponent } from './war-table-splash.component';
// v1.0.79 — Wheel Menu (Ctrl+Win) + Arcane Scrolls (Ctrl+Space) repris de Yamzy core
import { WheelMenuComponent } from '../../core/wheel-menu/wheel-menu.component';
import { ArcaneScrollComponent } from '../../core/arcane-scroll/arcane-scroll.component';
import { WarTableBg3dComponent } from './war-table-bg-3d.component';
import { YamzyAvatar3dComponent } from './yamzy-avatar-3d.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { UserMenuComponent } from '../../core/user-menu/user-menu.component';
import { WtDialogService } from '../../core/dialog/dialog.service';
import { WtDialogComponent } from '../../core/dialog/wt-dialog.component';
import { WtTooltipDirective } from '../../core/tooltip/wt-tooltip.directive';
import { TOOLTIP_GUIDE } from '../../core/tooltip/tooltip-guide';
// v0.1 conclave — Cosmos Projet : carte cosmique vivante du projet sur 1 an
import { CosmosProjetComponent, CosmosTicket, CosmosMilestone, CosmosTeamMember, CosmosRisk, CosmosDependency, CosmosCeremony, CosmosSprintActive } from '../cosmos-projet/cosmos-projet.component';
import { WtThunderStatsComponent, ThunderStat } from '../thunder-stats/thunder-stats.component';
import { WtStatShieldComponent } from '../stat-shield/stat-shield.component';

interface PageDef { id: string; label: string; icon: string; cat: string; superCat: SuperCat; card: string; }

@Component({
  selector: 'app-war-table',
  standalone: true,
  imports: [CommonModule, FormsModule, WarTableSplashComponent, WarTableBg3dComponent, YamzyAvatar3dComponent, TranslatePipe, LangSwitcherComponent, UserMenuComponent, WtDialogComponent, WtTooltipDirective, WheelMenuComponent, ArcaneScrollComponent, CosmosProjetComponent, WtThunderStatsComponent, WtStatShieldComponent],
  templateUrl: './war-table.component.html',
  styleUrls: ['./war-table.component.css'],
})
export class WarTableComponent implements OnInit, AfterViewInit, OnDestroy {
  // v1.0.177fk — FULLSCREEN HEADER : ouvre le header en plein écran avec bg transparent
  // pour voir la scène 3D derrière + active le mode edit caméra.
  headerFullscreen = signal(false);
  cameraEditMode = signal(false);
  // v1.0.177fo — Vue caméra actuellement sélectionnée dans le toolbar 3D edit.
  // Valeurs : 'iso' (défaut) | 'top' | 'front' | 'side' | 'three_quarters' | 'reset' | 'save'
  cameraPreset = signal<string>('iso');
  toggleHeaderFullscreen(event?: Event): void {
    if (event) event.stopPropagation();
    const next = !this.headerFullscreen();
    this.headerFullscreen.set(next);
    this.cameraEditMode.set(next);
    // Dispatch event au composant 3D pour activer son mode edit caméra (drag orbit)
    window.dispatchEvent(new CustomEvent('yamzy:camera-edit-mode', { detail: next }));
    // Quand on entre en mode 3D edit, on auto-déclenche la vue iso pour cadrer la scène
    if (next) {
      this.setCameraPreset('iso');
    }
  }
  // v1.0.177fo — Sélection d'un preset de vue caméra. Émet event au composant 3D.
  setCameraPreset(preset: string): void {
    // Pour 'reset' et 'save' on ne stocke pas comme preset actif
    if (preset !== 'reset' && preset !== 'save') {
      this.cameraPreset.set(preset);
    }
    window.dispatchEvent(new CustomEvent('yamzy:camera-preset', { detail: preset }));
  }
  // v1.0.177fo — ESC handler pour fermer le mode 3D edit
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.headerFullscreen()) {
      event.preventDefault();
      this.toggleHeaderFullscreen();
    }
  }

  // v1.0.177ey — FLAME TRAIL CANVAS : flamme bougie qui suit un pointeur en mouvement organique.
  // Inspiré du design "burning candle flame" — 40 points spring/friction physics, gradient color
  // de la carte, lineWidth qui dégrade vers la pointe. Animation auto via cos/sin (pas de souris).
  @ViewChild('thunderCanvas', { static: false }) thunderCanvasRef?: ElementRef<HTMLCanvasElement>;
  private thunderAnimFrame: number = 0;
  private thunderResize?: () => void;
  private thunderTrail: Array<{ x: number; y: number; dx: number; dy: number }> = [];
  private thunderPointer = { x: 0, y: 0 };
  private thunderMouseMoved = false;
  private thunderStartTime = 0;
  private thunderMouseHandler?: (e: MouseEvent) => void;
  // v1.0.177ez — Params EXACTS de l'exemple "burning candle flame" original
  private readonly THUNDER_POINTS = 40;
  private readonly THUNDER_WIDTH_FACTOR = 10;
  private readonly THUNDER_SPRING = 0.25;
  private readonly THUNDER_FRICTION = 0.5;
  // v1.0.177ey — Champs DEPRECATED (l'ancien animate_old les utilise mais n'est plus appelé).
  // Gardés pour ne pas casser la compilation TS du code mort.
  private thunderLightnings: any[] = [];
  private thunderFlames: any[] = [];
  private thunderTicker = 0;
  private thunderSpawnRate = 50;
  private thunderFlameTicker = 0;

  ngAfterViewInit(): void {
    setTimeout(() => this.setupThunderCanvas(), 200);
  }

  ngOnDestroy(): void {
    if (this.thunderAnimFrame) cancelAnimationFrame(this.thunderAnimFrame);
    if (this.thunderResize) window.removeEventListener('resize', this.thunderResize);
    if (this.thunderMouseHandler && this.thunderCanvasRef?.nativeElement?.parentElement) {
      this.thunderCanvasRef.nativeElement.parentElement.removeEventListener('mousemove', this.thunderMouseHandler);
      this.thunderCanvasRef.nativeElement.parentElement.removeEventListener('click', this.thunderMouseHandler);
    }
  }

  private setupThunderCanvas(): void {
    const canvas = this.thunderCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Init pointer + trail au resize
      this.thunderPointer.x = 0.5 * canvas.width;
      this.thunderPointer.y = 0.6 * canvas.height;
      this.thunderTrail = [];
      for (let i = 0; i < this.THUNDER_POINTS; i++) {
        this.thunderTrail.push({
          x: this.thunderPointer.x,
          y: this.thunderPointer.y,
          dx: 0, dy: 0,
        });
      }
    };
    resize();
    this.thunderResize = resize;
    window.addEventListener('resize', resize);
    // v1.0.177ff — ResizeObserver sur le parent pour gérer les changements de taille
    // quand on navigue entre pages (backlog/sprint/etc.) où le header peut changer de dimensions
    const parentEl = canvas.parentElement;
    if (parentEl && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => resize());
      ro.observe(parentEl);
    }
    this.thunderStartTime = performance.now();

    // v1.0.177fa — Tracking SOURIS : la flamme suit la souris sur tout le header
    const parentHeader = canvas.parentElement;
    if (parentHeader) {
      this.thunderMouseHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        this.thunderMouseMoved = true;
        this.thunderPointer.x = e.clientX - rect.left;
        this.thunderPointer.y = e.clientY - rect.top;
      };
      parentHeader.addEventListener('mousemove', this.thunderMouseHandler);
      parentHeader.addEventListener('click', this.thunderMouseHandler);
    }

    const randArb = (min: number, max: number) => Math.random() * (max - min) + min;
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // v1.0.177ey — animate_old DÉSACTIVÉ (jamais appelé, gardé pour réf historique).
    // @ts-ignore-next-line — le bloc utilise des champs deprecated (this.thunderLightnings, etc.)
    const animate_old = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Couleur vivid (la plus saturée des 3 couleurs de la carte)
      const vivid = this.activeCardVividColor() || '#e3eaef';

      // Update + draw chaque éclair
      for (let i = this.thunderLightnings.length - 1; i >= 0; i--) {
        const l = this.thunderLightnings[i];
        if (l.ttl <= 0) {
          this.thunderLightnings.splice(i, 1);
          continue;
        }
        // Update : étend le chemin par un nouveau point
        const last = l.path[l.path.length - 1];
        l.path.push({
          x: last.x + randArb(-l.xRange, l.xRange),
          y: last.y + randArb(0, l.yRange),
        });
        l.ttl -= 1;
        l.opacity -= 1 / Math.max(l.ttl, 1);
        if (l.opacity < 0) l.opacity = 0;

        // v1.0.177ev — Draw avec DOUBLE PASS : pass 1 = halo large flou, pass 2 = trait blanc net.
        // Effet "thunder épique" visible sur la carte et l'avatar.
        // Pass 1 : glow épais coloré
        ctx.beginPath();
        ctx.save();
        ctx.strokeStyle = vivid;
        ctx.shadowColor = vivid;
        ctx.shadowBlur = 30;
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalAlpha = l.opacity * 0.7;
        ctx.moveTo(l.x, l.y);
        for (const p of l.path) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
        ctx.closePath();
        // Pass 2 : core blanc net
        ctx.beginPath();
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = vivid;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalAlpha = l.opacity;
        ctx.moveTo(l.x, l.y);
        for (const p of l.path) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
        ctx.closePath();
      }

      // v1.0.177ew — UPDATE + DRAW des particules FLAMMES/FUMÉE/ÉNERGIE (motifs fire/smoke/energy).
      const motif = this.activeCardMotif();
      const isFlameMotif = motif === 'fire' || motif === 'smoke' || motif === 'energy';

      // v1.0.177ex — Update + draw flammes avec VRAIE FORME DE FLAMME (path 40 points,
      // adapté du SVG example fourni par l'user). Symétrique, plus large à la base, pointue au sommet,
      // oscillation horizontale via sinusoïde pour effet organique.
      for (let i = this.thunderFlames.length - 1; i >= 0; i--) {
        const f = this.thunderFlames[i];
        f.ttl -= 1;
        if (f.ttl <= 0) {
          this.thunderFlames.splice(i, 1);
          continue;
        }
        f.x += f.vx;
        f.y += f.vy;
        f.vy *= 0.985;
        const lifeRatio = f.ttl / f.maxTtl;
        const alpha = lifeRatio * 0.8;
        // Hauteur de la flamme : grandit puis rétrécit
        const flameHeight = f.radius * (1.2 - Math.abs(lifeRatio - 0.5) * 0.8);
        const w = f.radius * 0.5;  // largeur base
        const wave = Math.sin(f.y * 0.04 + f.ttl * 0.1) * w * 0.2;  // ondulation
        const fx = f.x + wave;
        const fy = f.y;
        const h = flameHeight;

        // Gradient radial vertical : blanc → c1 → c2 → transparent
        const grad = ctx.createLinearGradient(fx, fy, fx, fy - h * 3.5);
        grad.addColorStop(0, f.color2);
        grad.addColorStop(0.3, f.color1);
        grad.addColorStop(0.7, `rgba(255,255,255,${alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = motif === 'smoke' ? 'source-over' : 'screen';
        ctx.fillStyle = grad;
        // VRAIE FORME DE FLAMME : path symétrique 40 points (adapté du SVG example)
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        // Right side going up (base → top right)
        ctx.lineTo(fx + w * 0.11, fy - h * 0.2);
        ctx.lineTo(fx + w * 0.22, fy - h * 0.4);
        ctx.lineTo(fx + w * 0.33, fy - h * 0.6);
        ctx.lineTo(fx + w * 0.44, fy - h * 0.8);
        ctx.lineTo(fx + w * 0.55, fy - h * 1.0);
        ctx.lineTo(fx + w * 0.66, fy - h * 1.2);
        ctx.lineTo(fx + w * 0.77, fy - h * 1.4);
        ctx.lineTo(fx + w * 0.88, fy - h * 1.6);
        ctx.lineTo(fx + w * 1.0, fy - h * 1.8);
        // Top right curving in
        ctx.lineTo(fx + w * 1.0, fy - h * 2.0);
        ctx.lineTo(fx + w * 1.0, fy - h * 2.2);
        ctx.lineTo(fx + w * 0.88, fy - h * 2.4);
        ctx.lineTo(fx + w * 0.77, fy - h * 2.6);
        ctx.lineTo(fx + w * 0.66, fy - h * 2.8);
        ctx.lineTo(fx + w * 0.55, fy - h * 3.0);
        ctx.lineTo(fx + w * 0.44, fy - h * 3.1);
        ctx.lineTo(fx + w * 0.33, fy - h * 3.2);
        ctx.lineTo(fx + w * 0.22, fy - h * 3.3);
        ctx.lineTo(fx + w * 0.11, fy - h * 3.4);
        // POINT SUPRÊME (apex)
        ctx.lineTo(fx, fy - h * 3.5);
        // Left side coming down (mirror right)
        ctx.lineTo(fx - w * 0.11, fy - h * 3.4);
        ctx.lineTo(fx - w * 0.22, fy - h * 3.3);
        ctx.lineTo(fx - w * 0.33, fy - h * 3.2);
        ctx.lineTo(fx - w * 0.44, fy - h * 3.1);
        ctx.lineTo(fx - w * 0.55, fy - h * 3.0);
        ctx.lineTo(fx - w * 0.66, fy - h * 2.8);
        ctx.lineTo(fx - w * 0.77, fy - h * 2.6);
        ctx.lineTo(fx - w * 0.88, fy - h * 2.4);
        ctx.lineTo(fx - w * 1.0, fy - h * 2.2);
        ctx.lineTo(fx - w * 1.0, fy - h * 2.0);
        ctx.lineTo(fx - w * 1.0, fy - h * 1.8);
        ctx.lineTo(fx - w * 0.88, fy - h * 1.6);
        ctx.lineTo(fx - w * 0.77, fy - h * 1.4);
        ctx.lineTo(fx - w * 0.66, fy - h * 1.2);
        ctx.lineTo(fx - w * 0.55, fy - h * 1.0);
        ctx.lineTo(fx - w * 0.44, fy - h * 0.8);
        ctx.lineTo(fx - w * 0.33, fy - h * 0.6);
        ctx.lineTo(fx - w * 0.22, fy - h * 0.4);
        ctx.lineTo(fx - w * 0.11, fy - h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Spawn flame particles (uniquement si motif fire/smoke/energy)
      if (isFlameMotif) {
        this.thunderFlameTicker++;
        // Spawn rate : 2 particules par frame pour effet dense
        if (this.thunderFlameTicker % 2 === 0) {
          // Origine : depuis la grande carte (bottom-right Q4)
          const originX = W * 0.78 + randArb(-W * 0.12, W * 0.12);
          const originY = H * 0.85 + randArb(-H * 0.08, H * 0.08);
          // Choix des couleurs selon motif + vivid
          let c1 = vivid, c2 = vivid;
          if (motif === 'fire') {
            c1 = 'rgba(255,180,40,0.85)';
            c2 = 'rgba(220,60,20,0.65)';
          } else if (motif === 'smoke') {
            c1 = 'rgba(200,200,210,0.55)';
            c2 = 'rgba(80,80,90,0.40)';
          } else if (motif === 'energy') {
            c1 = 'rgba(120,255,180,0.75)';
            c2 = 'rgba(40,180,100,0.55)';
          }
          this.thunderFlames.push({
            x: originX,
            y: originY,
            vx: randArb(-0.6, 0.6),
            vy: randArb(-2.5, -1.2),  // monte
            radius: randArb(8, 22),
            ttl: randInt(40, 90),
            maxTtl: 90,
            color1: c1,
            color2: c2,
          });
        }
      }

      // v1.0.177ev — Spawn CIBLÉ sur la carte (bottom-right Q4) ET l'avatar (bottom-left).
      // 70% des éclairs ciblent la grande carte, 30% l'avatar YAMZY. Éclairs plus épais + plus visibles.
      if (this.thunderTicker % this.thunderSpawnRate === 0) {
        this.thunderTicker = 0;
        const targetCard = Math.random() < 0.7; // 70% carte, 30% avatar
        let x: number, y: number;
        if (targetCard) {
          // Cible la grande carte (Q4 = bottom-right) : x dans [60%-90%] W, y dans [10%-50%] H
          x = randInt(Math.floor(W * 0.55), Math.floor(W * 0.92));
          y = randInt(0, Math.floor(H * 0.35));
        } else {
          // Cible l'avatar YAMZY (bottom-left, dehors mais effet visible) : x dans [5%-25%] W, y dans [0-30%] H
          x = randInt(Math.floor(W * 0.05), Math.floor(W * 0.28));
          y = randInt(0, Math.floor(H * 0.3));
        }
        this.thunderLightnings.push({
          x, y,
          xRange: randArb(8, 30),
          yRange: randArb(15, 35),
          path: [{ x, y }],
          ttl: randInt(60, 250),
          opacity: 1,
        });
        // v1.0.177ev — Spawn plus fréquent pour intensifier l'effet thunder (deprecated)
        this.thunderSpawnRate = randInt(15, 60);
      }
      this.thunderTicker++;
      this.thunderAnimFrame = requestAnimationFrame(animate_old);
    };
    // v1.0.177ey — Le animate_old ci-dessus est DÉSACTIVÉ (gardé pour réf). On utilise le NEW animate ↓

    // ═══ NEW v1.0.177ez — COPIE-COLLÉ EXACTE du code "burning candle flame" original ═══
    // Pointeur en mouvement automatique cos/sin sur TOUTE la surface du canvas (header).
    // 40 points en trail spring/friction. Gradient orange→jaune fixe (couleur change via vivid).
    // Width factor 10 (épais comme l'original). PAS de shadowBlur (comme l'original).
    const animate = () => {
      const W = canvas.width, H = canvas.height;
      const t = performance.now() - this.thunderStartTime;
      // v1.0.177ff — Lit DIRECTEMENT les 3 couleurs hardcodées de la carte (DEFAULT_CARDS_COLORS)
      // pour garantir que la flamme prend toujours les 3 couleurs définies, pas un fallback générique.
      const card = this.effectiveDisplayedCard();
      const hardcoded = card ? WarTableComponent.DEFAULT_CARDS_COLORS[card] : null;
      const stored = card ? this.cardsColorsMap()[card] : null;
      const c1 = (stored?.[0]) || hardcoded?.[0] || '#fc5a03';
      const c2 = (stored?.[1]) || hardcoded?.[1] || '#fcca03';
      const c3 = (stored?.[2]) || hardcoded?.[2] || '#7a1d00';
      const vivid = this.activeCardVividColor() || c1;
      const motif = this.activeCardMotif();
      // v1.0.177fh — FORCE THUNDER sur page Dashboard + slide 0 du menu Dashboard (1er header).
      // Sur les autres slides/pages, logique conditionnelle (fire → flamme, autre → thunder).
      const forceThunder = this.activePage() === 'dashboard'
        || (this.navActive() === 0 && this.psEmptyCarouselIndex() === 0);
      const isFireMotif = motif === 'fire' && !forceThunder;

      ctx.clearRect(0, 0, W, H);

      if (isFireMotif) {
        // ═══ FLAMME BOUGIE (motif fire seulement) ═══
        if (!this.thunderMouseMoved) {
          this.thunderPointer.x = (0.5 + 0.3 * Math.cos(0.002 * t) * Math.sin(0.005 * t)) * W;
          this.thunderPointer.y = (0.5 + 0.2 * Math.cos(0.005 * t) + 0.1 * Math.sin(0.01 * t)) * H;
        }
        // Update du trail spring/friction
        this.thunderTrail.forEach((p, idx) => {
          const prev = idx === 0 ? this.thunderPointer : this.thunderTrail[idx - 1];
          const spring = idx === 0 ? 0.4 * this.THUNDER_SPRING : this.THUNDER_SPRING;
          p.dx += (prev.x - p.x) * spring;
          p.dy += (prev.y - p.y) * spring;
          p.dx *= this.THUNDER_FRICTION;
          p.dy *= this.THUNDER_FRICTION;
          p.x += p.dx;
          p.y += p.dy;
        });
        // Gradient 3 couleurs
        const gradient = ctx.createLinearGradient(0, 0, W, H);
        gradient.addColorStop(0, c1);
        gradient.addColorStop(0.5, c2);
        gradient.addColorStop(1, c3);
        ctx.strokeStyle = gradient;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.thunderTrail[0].x, this.thunderTrail[0].y);
        for (let i = 1; i < this.thunderTrail.length - 1; i++) {
          const xc = 0.5 * (this.thunderTrail[i].x + this.thunderTrail[i + 1].x);
          const yc = 0.5 * (this.thunderTrail[i].y + this.thunderTrail[i + 1].y);
          ctx.quadraticCurveTo(this.thunderTrail[i].x, this.thunderTrail[i].y, xc, yc);
          ctx.lineWidth = this.THUNDER_WIDTH_FACTOR * (this.THUNDER_POINTS - i);
          ctx.stroke();
        }
        ctx.lineTo(this.thunderTrail[this.thunderTrail.length - 1].x, this.thunderTrail[this.thunderTrail.length - 1].y);
        ctx.stroke();
      } else {
        // ═══ v1.0.177fj — THUNDER ÉCLAIRS SHARP : zigzag aigus, glow intense, flash blanc ═══
        for (let i = this.thunderLightnings.length - 1; i >= 0; i--) {
          const l = this.thunderLightnings[i];
          if (l.ttl <= 0) {
            this.thunderLightnings.splice(i, 1);
            continue;
          }
          // Path qui descend en zigzag aigu (forte variation X, descente rapide Y)
          const last = l.path[l.path.length - 1];
          l.path.push({
            x: last.x + (Math.random() * 2 - 1) * l.xRange,
            y: last.y + Math.random() * l.yRange + 2,
          });
          l.ttl -= 1;
          l.opacity -= 1 / Math.max(l.ttl, 1);
          if (l.opacity < 0) l.opacity = 0;

          // Pass 1 : HALO LARGE coloré (flou) — donne la couleur ambiante
          ctx.beginPath();
          ctx.save();
          ctx.strokeStyle = vivid;
          ctx.shadowColor = vivid;
          ctx.shadowBlur = 24;
          ctx.lineWidth = 8;
          ctx.lineJoin = 'miter';  // miter = angle aigu (pas round)
          ctx.lineCap = 'square';
          ctx.globalAlpha = l.opacity * 0.4;
          ctx.moveTo(l.x, l.y);
          for (const p of l.path) ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();

          // Pass 2 : INNER GLOW moyen
          ctx.beginPath();
          ctx.save();
          ctx.strokeStyle = vivid;
          ctx.shadowColor = vivid;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 4;
          ctx.lineJoin = 'miter';
          ctx.lineCap = 'square';
          ctx.globalAlpha = l.opacity * 0.7;
          ctx.moveTo(l.x, l.y);
          for (const p of l.path) ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();

          // Pass 3 : CORE BLANC ÉLECTRIQUE SHARP au milieu
          ctx.beginPath();
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'miter';
          ctx.lineCap = 'square';
          ctx.globalAlpha = l.opacity;
          ctx.moveTo(l.x, l.y);
          for (const p of l.path) ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();
        }

        // Spawn nouveaux éclairs (encore plus fréquents pour effet orage)
        this.thunderTicker++;
        if (this.thunderTicker % this.thunderSpawnRate === 0) {
          this.thunderTicker = 0;
          const x = Math.floor(W * 0.05) + Math.random() * Math.floor(W * 0.9);
          const y = Math.random() * Math.floor(H * 0.2);
          this.thunderLightnings.push({
            x, y,
            xRange: 12 + Math.random() * 30,  // zigzag plus aigu
            yRange: 25 + Math.random() * 35,  // descent plus rapide
            path: [{ x, y }],
            ttl: 35 + Math.floor(Math.random() * 80),  // ttl plus court = éclair plus net
            opacity: 1,
          });
          this.thunderSpawnRate = 8 + Math.floor(Math.random() * 25);  // spawn très fréquent
        }
      }

      this.thunderAnimFrame = requestAnimationFrame(animate);
    };
    this.thunderAnimFrame = requestAnimationFrame(animate);
  }

  api = inject(WarTableApi);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private san = inject(DomSanitizer);
  i18n = inject(I18nService);
  dialog = inject(WtDialogService);
  Math = Math;  // expose Math global au template

  /** Reste(h) = Estimation - Spent. */
  remainingHours(t: any): number {
    const est = Number(t?.estimationHours) || 0;
    const spent = Number(t?.spentHours) || 0;
    return Math.round((est - spent) * 10) / 10;
  }

  // ═══ TEAM MEMBERS v1.0.13 (avatars + identité + futur réseau Yamzy) ═══
  memberColorPalette = ['#d99a51','#70b944','#4696b9','#c25d8d','#9d8ad6','#2ea1cb','#fb923c','#22d3ee','#ec4899','#a78bfa','#f59e0b','#10b981'];
  /** Hash stable d'un nom → index palette. */
  private hashStr(s: string): number {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  memberColor(m: any): string {
    if (!m) return '#6b6396';
    if (m.colorHex) return m.colorHex;
    const name = m.memberName || m.name || '?';
    return this.memberColorPalette[this.hashStr(name) % this.memberColorPalette.length];
  }
  memberInitials(m: any): string {
    if (!m) return '?';
    if (m.initials) return m.initials.toUpperCase();
    const name = (m.memberName || m.name || '?').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }
  teamMemberEdit = signal<any | null>(null);
  teamMemberDraft: any = {};
  editTeamMember(m: any): void {
    this.teamMemberDraft = { ...m };
    this.teamMemberEdit.set(m);
  }
  closeTeamMemberEdit(): void {
    this.teamMemberEdit.set(null);
    this.teamMemberDraft = {};
  }
  saveTeamMember(): void {
    const orig = this.teamMemberEdit();
    if (!orig?.id) { this.closeTeamMemberEdit(); return; }
    // Auto-fill initials if empty
    if (!this.teamMemberDraft.initials && this.teamMemberDraft.memberName) {
      this.teamMemberDraft.initials = this.memberInitials({ memberName: this.teamMemberDraft.memberName });
    }
    if (!this.teamMemberDraft.colorHex) {
      this.teamMemberDraft.colorHex = this.memberColor({ memberName: this.teamMemberDraft.memberName });
    }
    this.api.updateCapacity(orig.id, this.teamMemberDraft).subscribe({
      next: updated => {
        this.capacity.update(arr => arr.map(x => x.id === orig.id ? updated : x));
        this.closeTeamMemberEdit();
      },
      error: err => this.dialog.alert({ title: 'Erreur', message: 'Sauvegarde échouée', kind: 'error', details: [{ label: 'Erreur', value: String(err?.message || err) }] })
    });
  }

  // ═══ TIME ALLOCATION v1.0.13 ═══
  timeAllocation = signal<any>(null);
  refreshTimeAllocation(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) { this.timeAllocation.set(null); return; }
    this.api.timeAllocation(pid).subscribe({ next: d => this.timeAllocation.set(d), error: () => this.timeAllocation.set(null) });
  }

  // ═══ YAMZY COMPANION v1.0.17 — Avatar 3D animé fixé sur la gauche, présent partout ═══
  // (Guide panel retiré sur demande utilisateur — juste le gros avatar avec toutes les anims)

  // ═══ CAROUSEL FOOTER + WHEEL v1.0.37 — breadcrumb + scroll wheel ═══
  /** Label de la page active (utilisé dans le breadcrumb HOME > xxx). */
  activePageLabel = computed(() => {
    const pageId = this.activePage();
    const page = WAR_TABLE_PAGES.find(p => p.id === pageId);
    return page ? page.label : pageId;
  });

  /** v1.0.39 — Wheel sur le carousel : navigation entre cards.
   *  Lock 600ms entre chaque scroll + settle delay 500ms avant chargement page.
   *  Donc tu peux scroller librement entre les cards et seule la dernière chargera. */
  private wheelLockTimer: any = null;
  onCarouselWheel(ev: WheelEvent): void {
    if (!this.yamzyCarouselOpen() || this.positionMode()) return;
    ev.preventDefault();
    if (this.wheelLockTimer) return;
    if (ev.deltaY > 0) this.yamzyCarouselDown();
    else if (ev.deltaY < 0) this.yamzyCarouselUp();
    this.wheelLockTimer = setTimeout(() => { this.wheelLockTimer = null; }, 600);
  }

  // ═══ CAROUSEL v1.0.44 — toujours ouvert MAIS pas d'auto-scroll. User-driven uniquement. ═══
  yamzyCarouselOpen = signal(false); // v1.0.150 — FERMÉ par défaut (carousel YAMZY plus utilisé directement)
  toggleCarousel(): void {
    if (this.positionMode()) return;
    this.yamzyCarouselOpen.update(v => !v);
    if (this.yamzyCarouselOpen()) {
      this.applyCenterAction();
      // v1.0.144 : cacher la notif quand l'user ouvre la carousel (volontairement)
      this.yamzyNotificationVisible.set(false);
      if (this.yamzyNotifTimer) clearTimeout(this.yamzyNotifTimer);
    }
  }
  // v1.0.44 — Auto-scroll retiré. Les méthodes restent en no-op pour compat appels existants.
  private startAutoScroll(): void { /* disabled */ }
  private stopAutoScroll(): void { /* disabled */ }
  private resetAutoScroll(): void { /* disabled */ }

  // ═══ PAGE PREVIEW MODE v1.0.47 — Header + cockpit visible, contenu masqué par défaut ═══
  /** Si false → mode preview (seul header + cockpit visibles). True → contenu de la page ouvert. */
  pageContentOpen = signal(false);
  openPageContent(): void { this.pageContentOpen.set(true); }
  closePageContent(): void { this.pageContentOpen.set(false); }

  /** v1.0.64 — Click sur le PS hero en mode preview ouvre le contenu de la page.
   *  Ignore les clicks sur boutons enfants (Lancer/Interrompre/Roadmap/Action page).
   *  v1.0.146 — Click avance le header carousel à la slide suivante (préviewing la prochaine page).
   *  Double-click ou click sur la grande carte = ouvre la page complète. */
  onPsHeroClick(ev: MouseEvent): void {
    // Si le click vient d'un bouton ou d'un enfant interactif, ne fait rien
    const target = ev.target as HTMLElement;
    if (target.closest('button')) return;
    if (target.closest('.wt-pro-related-card')) return;
    if (target.closest('.wt-ps-mini-row')) return;  // mini cards en bas — gérées par leur propre click
    // Uniquement en mode preview (section level + content pas ouvert + projet sélectionné)
    if (this.studioLevel() !== 'section' || this.pageContentOpen() || !this.api.selectedProjectId()) return;
    // v1.0.146 — Le click navigue le header carousel au lieu d'ouvrir la page.
    // Pour OUVRIR la page : utiliser bouton GO ou double-click.
    this.psEmptyCarouselNext();
  }

  /** v1.0.146 — Double-click sur header = ouvre la page courante (raccourci). */
  onPsHeroDblClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    if (target.closest('button')) return;
    if (this.studioLevel() !== 'section' || this.pageContentOpen() || !this.api.selectedProjectId()) return;
    this.openPageContent();
  }

  /** v1.0.65 — Wheel sur le PS hero = navigation entre slides du HEADER carousel (pas YAMZY).
   *  v1.0.146 — Réparé : wheel doit avancer psEmptyCarouselIndex, pas le carousel YAMZY.
   *  Lock 400ms entre chaque scroll. */
  private psHeroWheelLock: any = null;
  onPsHeroWheel(ev: WheelEvent): void {
    if (this.studioLevel() !== 'section' || this.pageContentOpen() || this.positionMode()) return;
    if (this.psHeroWheelLock) { ev.preventDefault(); return; }
    ev.preventDefault();
    if (ev.deltaY > 0) this.psEmptyCarouselNext();
    else if (ev.deltaY < 0) this.psEmptyCarouselPrev();
    this.psHeroWheelLock = setTimeout(() => { this.psHeroWheelLock = null; }, 250);  /* v1.0.168 — 400 → 250ms snappy */
  }

  /** v1.0.65 — Swipe tactile sur le PS hero. */
  private psHeroTouchStartY: number | null = null;
  onPsHeroTouchStart(ev: TouchEvent): void {
    if (this.studioLevel() !== 'section' || this.pageContentOpen()) return;
    this.psHeroTouchStartY = ev.touches[0]?.clientY ?? null;
  }
  onPsHeroTouchEnd(ev: TouchEvent): void {
    if (this.psHeroTouchStartY === null) return;
    const endY = ev.changedTouches[0]?.clientY ?? this.psHeroTouchStartY;
    const delta = endY - this.psHeroTouchStartY;
    this.psHeroTouchStartY = null;
    if (Math.abs(delta) < 30) return;        // ignore micro-swipes
    // v1.0.146 — Swipe navigue le HEADER carousel (pas YAMZY)
    if (delta < 0) this.psEmptyCarouselNext(); // swipe up → next slide
    else this.psEmptyCarouselPrev();           // swipe down → prev slide
  }

  /** Keyboard handlers : Escape = back, Enter = open page content */
  private setupKeyboardHandlers(): void {
    document.addEventListener('keydown', (ev: KeyboardEvent) => {
      // Ignore quand l'utilisateur tape dans un input/textarea
      const target = ev.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      // Ignore quand position mode actif (drag)
      if (this.positionMode()) return;

      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (this.pageContentOpen()) {
          this.closePageContent();          // 1er Échap : ferme le contenu
        } else if (this.studioLevel() === 'section') {
          this.returnHome();                 // 2e Échap : retour home
        }
      } else if (ev.key === 'Enter') {
        if (!this.pageContentOpen() && this.studioLevel() === 'section') {
          ev.preventDefault();
          this.openPageContent();
        }
      }
    });
  }

  // ═══ PAGE HEADER v1.0.42 — Header PS hero générique sur toutes les pages ═══
  /** Header info adapté à la page active. */
  pageHeaderInfo = computed(() => {
    const id = this.activePage();
    const proj = this.currentProject();
    const projName = proj?.name || 'Projet';
    const lang = this.i18n.lang() as 'fr' | 'en';
    const entry: any = (TOOLTIP_GUIDE as any)[id];
    const tr = entry?.[lang] || entry?.fr || null;
    const tagColor = '#3482e7';
    const info: { tag: string; tagColor: string; title: string; desc: string; tip?: string; actionLabel: string; pageId: string } = {
      tag: tr?.scrum ? `[${tr.scrum.toUpperCase()}]` : id.toUpperCase(),
      tagColor,
      title: tr?.yamzy ? `${tr.yamzy} · ${projName}` : id,
      desc: tr?.desc || `Page ${id}`,
      tip: tr?.tip,
      actionLabel: 'Mode édition 🔓',
      pageId: id,
    };
    // Per-page custom action
    if (id === 'backlog' || id === 'backlog-tma') { info.actionLabel = '+ Nouveau ticket'; info.tagColor = '#6647bf'; }
    else if (id === 'sprints' || id === 'sprint-planning') { info.actionLabel = '+ Nouveau sprint'; info.tagColor = '#4696b9'; }
    else if (id === 'risks') { info.actionLabel = '+ Nouveau risque'; info.tagColor = '#de4f5f'; }
    else if (id === 'calendrier' || id === 'agenda') { info.actionLabel = '+ Nouvel événement'; info.tagColor = '#70b944'; }
    else if (id === 'capacity') { info.actionLabel = '+ Nouveau membre'; info.tagColor = '#9d8ad6'; }
    else if (id === 'stakeholders') { info.actionLabel = '+ Stakeholder'; info.tagColor = '#d99a51'; }
    else if (id === 'tech-debt') { info.actionLabel = '+ Dette tech'; info.tagColor = '#eb8052'; }
    else if (id === 'lessons') { info.actionLabel = '+ Lesson learned'; info.tagColor = '#c25d8d'; }
    else if (id === 'roadmap') { info.actionLabel = '+ Jalon roadmap'; info.tagColor = '#9d8ad6'; }
    else if (id === 'parametres') { info.actionLabel = 'Mode édition 🔓'; info.tagColor = '#9d8ad6'; }
    // v0.1 conclave — Page Time Traveler (cosmos plein-écran + 3 panels)
    else if (id === 'time-traveler') {
      info.tag = '[TIME TRAVELER]';
      info.tagColor = '#e6b85a';
      info.title = `⏱ Time Traveler · ${projName}`;
      info.desc = 'Vision spatiotemporelle complète du projet — cosmos, équipe, risques, bookmarks';
      info.actionLabel = '+ Bookmark NOW';
    }
    return info;
  });

  /** Exécute l'action du header (varie selon la page). */
  pageHeaderAction(): void {
    const id = this.activePage();
    if (id === 'calendrier' || id === 'agenda') {
      this.openNewEvent();
      return;
    }
    // Pour les autres pages : active le mode édition (les boutons + de chaque page deviennent visibles)
    if (this.editMode) this.editMode.set(true);
  }

  // ═══ STUDIO LEVELS v1.0.30 — Home (menu) vs Section (cockpit messages) ═══
  // Niveau 1 = home : carousel affiche le menu des sections principales
  // Niveau 2 = section : carousel affiche les messages cockpit (events/alerts/tickets)
  // v1.0.146 — Default 'section' (dashboard) — le header de page doit toujours être visible
  studioLevel = signal<'home' | 'section'>('section');
  enterSection(pageId: string): void {
    this.studioLevel.set('section');
    this.setPage(pageId);
    this.yamzyCarouselIndex.set(0);
  }
  returnHome(): void {
    // v1.0.77 — Click HOME footer = retour Dashboard.
    // CRITIQUE : sur Dashboard, on ne fait PAS openPageContent() car la
    // dashboard EST le contenu (pas de section .wt-dashboard separee).
    // openPageContent => .is-content-open => fade-out anim de .wt-sk-dash
    // => ecran vide. Sur dashboard on reste en preview mode.
    this.studioLevel.set('section');
    this.setPage('dashboard');
    this.pageContentOpen.set(false);   // preview mode pour dashboard
  }

  // ═══ v1.0.144 — Header EST le carousel : N slides = N pages de la super-cat actuelle ═══
  // Slide K = page K mise en BIG CARD, les autres pages = MINIS.
  // Slide 0 part toujours sur la page active. Le nombre de slides s'adapte
  // automatiquement (3 pour Dashboard, 10 pour Sprint, etc.)
  psEmptyCarouselIndex = signal(0);

  /** Toutes les pages de la super-cat actuellement active (dans l'ordre def). */
  carouselSuperCatPages = computed<PageDef[]>(() => {
    const sc = this.activeSuperCat();
    if (!sc) return [];
    return this.pages.filter(p => p.superCat === sc);
  });

  /** Pages reordonnees : page active EN PREMIER, puis les autres dans l'ordre. */
  carouselOrderedPages = computed<PageDef[]>(() => {
    const all = this.carouselSuperCatPages();
    if (!all.length) return [];
    const active = this.activePage();
    const activeP = all.find(p => p.id === active);
    const others = all.filter(p => p.id !== active);
    return activeP ? [activeP, ...others] : all;
  });

  /** Nombre total de slides = nombre de pages de la super-cat (min 1). */
  carouselTotalSlides = computed<number>(() => Math.max(1, this.carouselOrderedPages().length));

  /** Tableau [0..N-1] pour ngFor des dots. */
  carouselDotsArray = computed<number[]>(() =>
    Array.from({ length: this.carouselTotalSlides() }, (_, i) => i)
  );

  /** Page mise en avant (big card) selon l'index carousel. */
  carouselFeaturedPage = computed<PageDef | null>(() => {
    const ordered = this.carouselOrderedPages();
    if (!ordered.length) return null;
    const idx = this.psEmptyCarouselIndex() % ordered.length;
    return ordered[idx] || null;
  });

  psEmptyCarouselNext(): void {
    const total = this.carouselTotalSlides();
    this.psEmptyCarouselIndex.update(i => (i + 1) % total);
    this.flashYamzyNotification();
  }
  psEmptyCarouselPrev(): void {
    const total = this.carouselTotalSlides();
    this.psEmptyCarouselIndex.update(i => (i - 1 + total) % total);
    this.flashYamzyNotification();
  }
  /** v1.0.146 — Helper : trouve l'index carousel pour une pageId donnée.
   *  Permet à un click mini-card de naviguer le header carousel à la slide de cette page,
   *  au lieu d'appeler setPage() qui change la page active complètement. */
  psEmptyCarouselGoToPage(pageId: string): void {
    const ordered = this.carouselOrderedPages();
    const idx = ordered.findIndex(p => p.id === pageId);
    if (idx >= 0) this.psEmptyCarouselGoTo(idx);
  }

  psEmptyCarouselGoTo(i: number): void {
    const total = this.carouselTotalSlides();
    if (i < 0 || i >= total) return;
    this.psEmptyCarouselIndex.set(i);
    // Quand on change de slide, on revient au mode "contenu de la page" (hero replié).
    this.pageInfoModalOpen.set(false);
    this.heroPanelExpanded.set(false);  // v1.0.151 — close pro-hero inline sur navigation
    this.flashYamzyNotification();
  }

  // v1.0.144 — Notification 3D flottante au-dessus de YAMZY qui apparait à chaque swipe.
  // Indique qu'un nouveau message d'info est dispo pour cette page.
  // Click icone OU YAMZY → ouvre la carousel YAMZY avec le message.
  yamzyNotificationVisible = signal(false);
  private yamzyNotifTimer: any = null;
  /** Active la notif. Reste visible jusqu'à click user (sur YAMZY ou la notif). */
  flashYamzyNotification(): void {
    this.yamzyNotificationVisible.set(true);
    if (this.yamzyNotifTimer) clearTimeout(this.yamzyNotifTimer);
    this.yamzyNotifTimer = null;
  }
  /** v1.0.152 — Click sur l'icone notif → ouvre un MINI popover à côté de la bulle
   *  avec le message. Bouton "Voir plus" dans le popover → ouvre le pro-hero inline. */
  notifMessageOpen = signal(false);
  /** Message à afficher dans le popover (1er item de yamzyCarouselCards, généralement TIP). */
  notifMessage = computed<any | null>(() => {
    const cards = this.yamzyCarouselCards();
    return cards[0] || null;
  });
  onYamzyNotifClick(ev: Event): void {
    ev.stopPropagation();
    if ((ev as any).stopImmediatePropagation) (ev as any).stopImmediatePropagation();
    if (this.yamzyNotifTimer) clearTimeout(this.yamzyNotifTimer);
    // Toggle le popover (le bubble notif reste affiché pour montrer où cliquer)
    this.notifMessageOpen.update(v => !v);
  }
  closeNotifMessage(ev?: Event): void {
    ev?.stopPropagation();
    this.notifMessageOpen.set(false);
    this.yamzyNotificationVisible.set(false);  // hide bubble notif aussi
  }
  /** Click "Voir plus →" dans le popover : ouvre le pro-hero inline (et ferme le popover). */
  openHeroPanelFromNotif(ev?: Event): void {
    ev?.stopPropagation();
    this.notifMessageOpen.set(false);
    this.yamzyNotificationVisible.set(false);
    // Force slide 1+ pour pouvoir afficher le pro-hero inline
    if (this.psEmptyCarouselIndex() === 0) this.psEmptyCarouselNext();
    this.heroPanelExpanded.set(true);
  }

  // ═══ v1.0.153 — FLOATING ALERTS : 1 icon par item du cockpit (action/réunion/ticket/alerte) ═══
  // Aléatoirement positionnées au-dessus de YAMZY. Click → mini popover style chat bubble.
  // 4 options dismiss : Fermer (popover) / Ne s'affiche plus (permanent) / Masqué (session) / Cacher (page).

  /** Items dismiss permanents (localStorage). */
  private DISMISS_KEY = 'yamzy-permanent-dismissed-v1';
  permanentlyDismissed = signal<Set<string>>(new Set(this.loadPermanentDismissed()));
  /** Items dismiss session (in-memory, reset on reload). */
  sessionDismissed = signal<Set<string>>(new Set());
  /** Items dismiss page (reset quand on change de page). */
  pageDismissed = signal<Set<string>>(new Set());
  /** Item dont le popover est ouvert (null si aucun). */
  openedAlertId = signal<string | null>(null);

  private loadPermanentDismissed(): string[] {
    try {
      const raw = localStorage.getItem(this.DISMISS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  private savePermanentDismissed(set: Set<string>): void {
    try { localStorage.setItem(this.DISMISS_KEY, JSON.stringify([...set])); } catch {}
  }

  /** Liste des items flottants : combine cockpit categories + filtre dismissed. */
  floatingAlerts = computed<Array<{ id: string; kind: string; emoji: string; color: string; title: string; subtitle: string; meta: string; pageHint: string; x: number; y: number;
    animDelay?: number; floatAmplitude?: number; driftAmplitude?: number; cycleDuration?: number; driftDuration?: number }>>(() => {
    const dismissed = new Set([
      ...this.permanentlyDismissed(),
      ...this.sessionDismissed(),
      ...this.pageDismissed(),
    ]);
    const items: any[] = [];
    const dash: any = this.dash() || {};
    const reminders: any = this.remindersData();
    const upcoming = this.upcomingEventsList?.() || [];
    // ACTION (top3)
    (dash.top3Actions || []).slice(0, 3).forEach((a: any, i: number) => {
      items.push({ id: `action-${a.id || i}`, kind: 'ACTION', emoji: '🎯', color: '#9d8ad6',
        title: a.title || a.label || 'Action', subtitle: a.subtitle || a.due || '', meta: 'Priorité haute', pageHint: 'backlog' });
    });
    // RÉUNION (upcoming events)
    upcoming.slice(0, 3).forEach((ev: any) => {
      const t = ev?.scheduledStart ? new Date(ev.scheduledStart) : null;
      const hhmm = t ? `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}` : '';
      items.push({ id: `event-${ev.id}`, kind: 'RÉUNION', emoji: '📅', color: '#4696b9',
        title: ev?.title || 'Cérémonie', subtitle: hhmm ? `Aujourd'hui à ${hhmm}` : 'À venir', meta: ev?.type || 'Sprint event', pageHint: 'agenda' });
    });
    // TICKET (top tickets)
    (dash.topTickets || []).slice(0, 3).forEach((t: any, i: number) => {
      items.push({ id: `ticket-${t.id || t.code || i}`, kind: 'TICKET', emoji: '⚡', color: '#ff8a5c',
        title: t.code || t.title || 'Ticket', subtitle: t.title || t.state || '', meta: t.state || 'À traiter', pageHint: 'backlog' });
    });
    // ALERTE (HIGH severity)
    const highAlerts = (reminders?.items || []).filter((r: any) => r.severity === 'HIGH').slice(0, 3);
    highAlerts.forEach((a: any, i: number) => {
      items.push({ id: `alert-${a.id || i}`, kind: 'ALERTE', emoji: '⚠', color: '#de4f5f',
        title: a.title || a.message || 'Alerte', subtitle: a.summary || a.description || '', meta: a.category || 'HIGH', pageHint: a.linkedPage || 'risks' });
    });
    // v1.0.177bc — NOTIF custom (ajoutées via 🔔 → spawn animée à la fin de create_bubble)
    this.customNotifs().forEach(n => items.push({ ...n }));
    // v1.0.177cc — Filtre : pas de titre OU emoji → bubble fantôme transparente → ne render PAS.
    // Sinon on voit des cercles translucides vides autour de YAMZY (ex : reminders sans label).
    const isReal = (it: any) => {
      const t = (it.title || '').trim();
      const e = (it.emoji || '').trim();
      return t.length > 0 && e.length > 0;
    };
    // v1.0.177bi — Distribution ALÉATOIRE dans un TRIANGLE pointant vers le haut,
    // base au niveau de YAMZY (épaules), apex haut au-dessus.
    return items.filter(it => !dismissed.has(it.id) && isReal(it)).map((it, i) => {
      const h1 = (i * 9301 + 49297) % 233280;
      const h2 = ((i + 1) * 47527 + 13579) % 233280;
      const h3 = ((i + 2) * 17389 + 31627) % 233280;
      let u = h1 / 233280;
      let v = h2 / 233280;
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const w = 1 - u - v;
      const rX = this.alertRadiusX();
      const rY = this.alertRadiusY();
      const Ax = 0,             Ay = -rY * 1.8;
      const Bx = -rX * 1.5,     By = -rY * 0.3;
      const Cx = +rX * 1.5,     Cy = -rY * 0.3;
      // Barycentric : P = w*A + u*B + v*C
      const px = w * Ax + u * Bx + v * Cx;
      const py = w * Ay + u * By + v * Cy;
      // Animation params (offsets uniques par bubble)
      const animDelay = (h3 / 233280) * -8;     // -8s..0 → anims démarrent décalées
      const floatAmplitude = 8 + (h2 % 100) / 10;  // 8..18px d'amplitude verticale
      const driftAmplitude = 4 + (h3 % 80) / 10;   // 4..12px d'amplitude horizontale
      const cycleDuration = 4 + (h1 % 30) / 10;    // 4..7s cycle vertical
      const driftDuration = 6 + (h2 % 40) / 10;    // 6..10s cycle horizontal
      return {
        ...it,
        x: Math.round(px),
        y: Math.round(py),
        animDelay: +animDelay.toFixed(2),
        floatAmplitude: +floatAmplitude.toFixed(1),
        driftAmplitude: +driftAmplitude.toFixed(1),
        cycleDuration: +cycleDuration.toFixed(2),
        driftDuration: +driftDuration.toFixed(2),
      };
    });
  });

  /** Item de l'alerte dont le popover est ouvert (lookup via openedAlertId). */
  openedAlert = computed(() => {
    const id = this.openedAlertId();
    if (!id) return null;
    return this.floatingAlerts().find(a => a.id === id) || null;
  });

  trackAlert = (_i: number, item: { id: string }) => item.id;

  openAlertPopover(ev: Event, item: { id: string }): void {
    ev.stopPropagation();
    if ((ev as any).stopImmediatePropagation) (ev as any).stopImmediatePropagation();
    this.openedAlertId.set(item.id);
  }
  closeAlertPopover(ev?: Event): void {
    ev?.stopPropagation();
    this.openedAlertId.set(null);
  }
  /** Dismiss : fermer (juste popover). */
  alertDismissClose(ev: Event): void { this.closeAlertPopover(ev); }
  /** Dismiss : ne s'affiche plus (permanent localStorage). */
  alertDismissPermanent(ev: Event, item: { id: string }): void {
    ev.stopPropagation();
    this.permanentlyDismissed.update(s => {
      const next = new Set(s); next.add(item.id); this.savePermanentDismissed(next); return next;
    });
    this.openedAlertId.set(null);
  }
  /** Dismiss : masqué (session, jusqu'au prochain reload). */
  alertDismissSession(ev: Event, item: { id: string }): void {
    ev.stopPropagation();
    this.sessionDismissed.update(s => { const n = new Set(s); n.add(item.id); return n; });
    this.openedAlertId.set(null);
  }
  /** Dismiss : cacher (page, jusqu'au prochain changement de page). */
  alertDismissPage(ev: Event, item: { id: string }): void {
    ev.stopPropagation();
    this.pageDismissed.update(s => { const n = new Set(s); n.add(item.id); return n; });
    this.openedAlertId.set(null);
  }
  /** Click "Voir →" : navigue à la page liée + ferme. */
  alertGoTo(ev: Event, item: { pageHint: string }): void {
    ev.stopPropagation();
    this.openedAlertId.set(null);
    if (item.pageHint) this.setPage(item.pageHint);
  }

  // v1.0.144 — Mini panel "YAMZY" : petite carte style yamzy-carousel pour tips/rappels.
  // Click YAMZY → ouvre une petite card avec un message (tip "clique sur la grande carte
  // pour découvrir ses pouvoirs"). Réutilisable pour rappels meetings, alertes, etc.
  pageInfoModalOpen = signal(false);
  togglePageInfoModal(): void { this.pageInfoModalOpen.update(v => !v); }
  openPageInfoModal(): void { this.pageInfoModalOpen.set(true); }

  // ═══════════════════════════════════════════════════════════════════════
  // v1.0.177cg — TÂCHE EN COURS (timer Start/Stop type "mode pomodoro")
  //   Le ticket sur lequel je bosse maintenant est persisté en localStorage.
  //   Le timer tourne tant que Stop n'est pas cliqué → temps additionné à spentHours.
  // ═══════════════════════════════════════════════════════════════════════
  currentWorkTicketId = signal<number | null>(null);
  currentWorkStartedAt = signal<number | null>(null);
  currentWorkElapsedSec = signal(0);
  private currentWorkTickInterval: any = null;
  /** Computed : le ticket en cours de travail (lookup par id dans la liste). */
  currentWorkTicket = computed(() => {
    const id = this.currentWorkTicketId();
    if (id == null) return null;
    return this.tickets().find(t => t.id === id) || null;
  });
  /** Computed : suggestion du ticket à attaquer maintenant si rien en cours.
   *  Heuristique : En cours avec plus de progress, sinon À faire avec priorité Must, sinon premier ticket. */
  suggestedTicket = computed(() => {
    if (this.currentWorkTicketId() != null) return null;
    const tks = this.tickets() || [];
    if (!tks.length) return null;
    const score = (t: PosTicket): number => {
      const s = (t.status || '').toLowerCase();
      const p = (t.priority || '').toLowerCase();
      let sc = 0;
      if (s.includes('cours')) sc += 1000 + (t.progressPercent || 0);
      else if (s.includes('faire') || s.includes('to do')) sc += 500;
      if (p.includes('must')) sc += 300;
      else if (p.includes('should')) sc += 200;
      else if (p.includes('could')) sc += 100;
      const days = t.deliveryDate ? (new Date(t.deliveryDate).getTime() - Date.now()) / 86400_000 : 999;
      if (days < 3 && days > 0) sc += 200;
      if (s.includes('fait') || s.includes('clos') || s.includes('done')) sc = -1;
      return sc;
    };
    const sorted = [...tks].sort((a, b) => score(b) - score(a));
    return sorted[0] && score(sorted[0]) > 0 ? sorted[0] : null;
  });
  /** Format MM:SS ou HH:MM:SS pour le timer affiché. */
  currentWorkElapsedLabel = computed<string>(() => {
    const s = this.currentWorkElapsedSec();
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });
  /** Demarre une session de travail sur un ticket. v1.0.177cj — Empêche conflit avec edit inline en cours. */
  startTicketWork(ticket: PosTicket | null): void {
    if (!ticket) return;
    // v1.0.177cj — BUG #9 : empêcher démarrage timer si édition inline en cours sur le même ticket
    if (this.ticketEditMode() && this.activeTicketId() === ticket.id) {
      alert("Termine d'abord l'édition du ticket (💾 Save / ✕ Annuler) avant de démarrer le timer.");
      return;
    }
    // v1.0.177cs — BUG : ne pas écraser une session restaurée mais dont le ticket n'est pas encore lookup
    //   (cas typique : juste après login, currentWorkTicketId() est set par restoreCurrentWork
    //    mais tickets() est vide → currentWorkTicket() retourne null → UI affiche "Start"
    //    et l'utilisateur clique sans le vouloir écrasant le timer en cours).
    const existingId = this.currentWorkTicketId();
    if (existingId != null && existingId !== ticket.id) {
      const existingTicket = this.tickets().find(t => t.id === existingId);
      if (existingTicket) {
        const ok = confirm(`⏱ Une session est déjà en cours sur "${existingTicket.title}". La sauvegarder et démarrer ${ticket.ticketId || ticket.title} ?`);
        if (!ok) return;
        this.endTicketWork();
      } else {
        // Le ticket existing n'est pas encore chargé (tickets pas encore fetched).
        // On REFUSE l'écrasement plutôt que de perdre du temps tracking.
        const ok = confirm(`⏱ Une session timer (ticket #${existingId}) est en cours de restauration. Attends ou clique OK pour l'IGNORER et démarrer la nouvelle (le temps précédent sera PERDU).`);
        if (!ok) return;
        // L'utilisateur a accepté de perdre. On clear sans tenter de save.
        try { localStorage.removeItem('yamzy.currentWork'); } catch {}
        if (this.currentWorkTickInterval) { clearInterval(this.currentWorkTickInterval); this.currentWorkTickInterval = null; }
      }
    }
    this.currentWorkTicketId.set(ticket.id);
    const now = Date.now();
    this.currentWorkStartedAt.set(now);
    this.currentWorkElapsedSec.set(0);
    try {
      localStorage.setItem('yamzy.currentWork', JSON.stringify({ ticketId: ticket.id, startedAt: now }));
    } catch {}
    // Si le ticket n'est pas deja "En cours", on le bascule (sync DB + Excel).
    const s = (ticket.status || '').toLowerCase();
    if (!s.includes('cours')) {
      this.api.updateTicket(ticket.id, { status: 'En cours', state: 'En cours' }).subscribe({
        next: () => {
          this.tickets.update(arr => arr.map(t => t.id === ticket.id ? { ...t, status: 'En cours', state: 'En cours' } : t));
        }
      });
    }
    // Tick tous les secondes pour mettre a jour l'affichage.
    if (this.currentWorkTickInterval) clearInterval(this.currentWorkTickInterval);
    this.currentWorkTickInterval = setInterval(() => {
      const started = this.currentWorkStartedAt();
      if (started != null) this.currentWorkElapsedSec.set(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    console.log(`[work] ▶ Started ${ticket.ticketId || ('#'+ticket.id)} : ${ticket.title}`);
  }
  /** Arrete la session, ajoute le temps a spentHours, log historique session. */
  endTicketWork(): void {
    const ticket = this.currentWorkTicket();
    const elapsedSec = this.currentWorkElapsedSec();
    const elapsedH = +(elapsedSec / 3600).toFixed(2);
    const startedAt = this.currentWorkStartedAt() || Date.now();
    if (this.currentWorkTickInterval) {
      clearInterval(this.currentWorkTickInterval);
      this.currentWorkTickInterval = null;
    }
    this.currentWorkTicketId.set(null);
    this.currentWorkStartedAt.set(null);
    this.currentWorkElapsedSec.set(0);
    try { localStorage.removeItem('yamzy.currentWork'); } catch {}
    if (!ticket) return;
    const newSpent = +((ticket.spentHours || 0) + elapsedH).toFixed(2);
    const newRemaining = Math.max(0, +(((ticket.remainingHours || 0) - elapsedH).toFixed(2)));
    // v1.0.177ci — Historise la session dans la description du ticket pour audit + Excel
    const startStr = new Date(startedAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const endStr = new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const sessionLog = `\n⏱ Session ${startStr} → ${endStr} : ${elapsedH}h`;
    const newDescription = (ticket.description || '') + sessionLog;
    this.api.updateTicket(ticket.id, {
      spentHours: newSpent,
      remainingHours: newRemaining,
      description: newDescription,
    }).subscribe({
      next: () => {
        this.tickets.update(arr => arr.map(t => t.id === ticket.id
          ? { ...t, spentHours: newSpent, remainingHours: newRemaining, description: newDescription } : t));
        console.log(`[work] ⏹ Stopped ${ticket.ticketId || ('#'+ticket.id)} : +${elapsedH}h → total ${newSpent}h · session loggée`);
      }
    });
  }
  /** Restaure une session en cours (appelé en ngOnInit). */
  restoreCurrentWork(): void {
    try {
      const raw = localStorage.getItem('yamzy.currentWork');
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj?.ticketId || !obj?.startedAt) return;
      this.currentWorkTicketId.set(obj.ticketId);
      this.currentWorkStartedAt.set(obj.startedAt);
      this.currentWorkElapsedSec.set(Math.floor((Date.now() - obj.startedAt) / 1000));
      if (this.currentWorkTickInterval) clearInterval(this.currentWorkTickInterval);
      this.currentWorkTickInterval = setInterval(() => {
        const started = this.currentWorkStartedAt();
        if (started != null) this.currentWorkElapsedSec.set(Math.floor((Date.now() - started) / 1000));
      }, 1000);
      console.log(`[work] ↻ Session restaurée pour ticket #${obj.ticketId} (démarrée il y a ${Math.round((Date.now()-obj.startedAt)/60000)} min)`);
    } catch {}
  }

  /** v1.0.177cs — Hook beforeunload + before-logout : auto-save la session active. */
  private installCurrentWorkAutoSaveHooks(): void {
    // 1) Avant logout (custom event dispatché par user-menu)
    window.addEventListener('yamzy:before-logout', () => {
      if (this.currentWorkTicketId() != null) {
        console.log('[work] Logout détecté → auto-save session timer');
        this.endTicketWork();
      }
    });
    // 2) Avant fermeture/refresh du browser : flush localStorage avec dernière minute
    window.addEventListener('beforeunload', () => {
      if (this.currentWorkTicketId() != null) {
        // L'API call async ne marchera pas pendant unload, mais on garde l'entry
        // intacte pour la restauration au prochain login. Pas de clear.
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // v1.0.177cb — DAILY STAND-UP per-day widget (dashboard)
  //   Chaque entrée datée stockée en localStorage : { yesterday, today, blockers }
  //   Auto-load à la date du jour. Auto-save à chaque blur.
  //   Permet de remplir avant le daily + relire après pour faire son speech.
  // ═══════════════════════════════════════════════════════════════════════
  dailyDate = signal<string>(new Date().toISOString().slice(0, 10));
  dailyEntry = signal<{ yesterday: string; today: string; blockers: string }>({
    yesterday: '', today: '', blockers: ''
  });
  /** v1.0.177cb — Charge l'entrée daily depuis localStorage, puis depuis DB (qui prime). */
  loadDaily(): void {
    const key = `yamzy.daily.${this.dailyDate()}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const obj = JSON.parse(raw);
        this.dailyEntry.set({
          yesterday: obj.yesterday || '',
          today: obj.today || '',
          blockers: obj.blockers || '',
        });
      } else {
        this.dailyEntry.set({ yesterday: '', today: '', blockers: '' });
      }
    } catch { this.dailyEntry.set({ yesterday: '', today: '', blockers: '' }); }
    // v1.0.177ci — Surcharge depuis DB si un ticket DAILY-{date} existe (source of truth)
    this.loadDailyFromDB();
  }
  /** v1.0.177cb — Update un champ + auto-save. */
  private dailySaveDebounce: any = null;
  updateDailyField(field: 'yesterday' | 'today' | 'blockers', value: string): void {
    this.dailyEntry.update(e => ({ ...e, [field]: value }));
    const key = `yamzy.daily.${this.dailyDate()}`;
    try { localStorage.setItem(key, JSON.stringify(this.dailyEntry())); } catch {}
    // v1.0.177ci — Persist DB côté backend via le ticket de daily-standup (créé si manquant)
    // pour que ça survive un change de browser + apparaisse dans Excel.
    if (this.dailySaveDebounce) clearTimeout(this.dailySaveDebounce);
    this.dailySaveDebounce = setTimeout(() => this.persistDailyToDB(), 1500);
  }
  /** v1.0.177ci — Persiste le daily du jour dans un ticket "DAILY-{date}" sur le projet.
   *  Crée le ticket s'il n'existe pas (status="Terminé", type="Tâche") puis stocke
   *  les 3 sections (Hier / Aujourd'hui / Blocages) dans description + acceptanceCriteria.
   *  → Visible sur le Kanban + Excel + accessible depuis n'importe quel browser. */
  private persistDailyToDB(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const dateStr = this.dailyDate();
    const entry = this.dailyEntry();
    const ticketId = `DAILY-${dateStr}`;
    const description = [
      '✅ HIER J\'AI FAIT :',
      entry.yesterday || '(rien)',
      '',
      '🎯 AUJOURD\'HUI JE VAIS FAIRE :',
      entry.today || '(rien)',
      '',
      '🚧 BLOCAGES :',
      entry.blockers || '(aucun)',
    ].join('\n');
    const existing = this.tickets().find(t => t.ticketId === ticketId);
    if (existing) {
      this.api.updateTicket(existing.id, { description }).subscribe({
        next: () => console.log(`[daily] 💾 ${ticketId} mis à jour en DB + Excel`),
        error: (e) => console.warn(`[daily] ⚠ Persist DB failed:`, e?.message),
      });
    } else {
      // Crée un ticket pour le daily (visible Kanban "Terminé" + Excel)
      this.api.createTicket(pid, {
        ticketId,
        title: `Daily stand-up du ${dateStr}`,
        type: 'Tâche',
        priority: 'Should',
        status: 'Terminé',
        state: 'Terminé',
        progressPercent: 100,
        startDate: dateStr,
        deliveryDate: dateStr,
        description,
        sprint: '— Daily —',
        component: 'Daily Stand-up',
      } as any).subscribe({
        next: (created) => {
          console.log(`[daily] 🆕 ${ticketId} créé en DB + Excel`);
          this.tickets.update(arr => [...arr, created]);
        },
        error: (e) => console.warn(`[daily] ⚠ Create DB failed:`, e?.message),
      });
    }
  }
  /** v1.0.177ci — Au load, on regarde si un ticket DAILY-{date} existe en DB ;
   *  si oui, on prend SON contenu de préférence à localStorage (DB = source of truth). */
  private loadDailyFromDB(): void {
    const ticketId = `DAILY-${this.dailyDate()}`;
    const existing = this.tickets().find(t => t.ticketId === ticketId);
    if (!existing?.description) return;
    const text = existing.description;
    const ySect = /✅ HIER J'AI FAIT :\s*([\s\S]*?)(?=\n🎯 AUJOURD'HUI|$)/.exec(text);
    const tSect = /🎯 AUJOURD'HUI JE VAIS FAIRE :\s*([\s\S]*?)(?=\n🚧 BLOCAGES|$)/.exec(text);
    const bSect = /🚧 BLOCAGES :\s*([\s\S]*)$/.exec(text);
    const cleaned = {
      yesterday: (ySect?.[1] || '').trim().replace(/\(rien\)/, ''),
      today: (tSect?.[1] || '').trim().replace(/\(rien\)/, ''),
      blockers: (bSect?.[1] || '').trim().replace(/\(aucun\)/, ''),
    };
    this.dailyEntry.set(cleaned);
    try { localStorage.setItem(`yamzy.daily.${this.dailyDate()}`, JSON.stringify(cleaned)); } catch {}
  }
  /** v1.0.177cb — Navigation entre dates (prev/next/today). */
  dailyPrev(): void {
    const d = new Date(this.dailyDate()); d.setDate(d.getDate() - 1);
    this.dailyDate.set(d.toISOString().slice(0, 10));
    this.loadDaily();
  }
  dailyNext(): void {
    const d = new Date(this.dailyDate()); d.setDate(d.getDate() + 1);
    this.dailyDate.set(d.toISOString().slice(0, 10));
    this.loadDaily();
  }
  dailyToday(): void {
    this.dailyDate.set(new Date().toISOString().slice(0, 10));
    this.loadDaily();
  }
  /** v1.0.177cb — Format lisible de la date courante : "lundi 2 juin 2026". */
  dailyDateLabel = computed<string>(() => {
    try {
      return new Date(this.dailyDate()).toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return this.dailyDate(); }
  });
  /** v1.0.177cb — Auto-suggère "hier j'ai fait" depuis les tickets dont le progressPercent a bougé. */
  dailySuggestYesterday(): void {
    const tks = this.tickets() || [];
    // Heuristique : tickets en cours, Fait récemment, ou avec progressPercent > 0 et delivery proche
    const active = tks.filter(t => {
      const s = (t.status || '').toLowerCase();
      return s.includes('cours') || s.includes('fait') || s.includes('clos') || (t.progressPercent || 0) > 0;
    }).slice(0, 5);
    const lines = active.map(t =>
      `- ${t.ticketId || ('#' + t.id)} (${t.title?.slice(0, 50) || ''}) → ${t.status || 'En cours'} ${t.progressPercent || 0}%`
    );
    this.updateDailyField('yesterday', (this.dailyEntry().yesterday + '\n' + lines.join('\n')).trim());
  }
  /** v1.0.177cb — Auto-suggère "aujourd'hui je vais faire" depuis les tickets en cours non finis. */
  dailySuggestToday(): void {
    const tks = this.tickets() || [];
    const planned = tks.filter(t => {
      const s = (t.status || '').toLowerCase();
      return (s.includes('cours') || s.includes('faire')) && (t.progressPercent || 0) < 100;
    })
      .sort((a, b) => (a.priority || '').localeCompare(b.priority || ''))
      .slice(0, 4);
    const lines = planned.map(t =>
      `- ${t.ticketId || ('#' + t.id)} (${t.title?.slice(0, 50) || ''}) — reste ${(t.remainingHours || 0)}h`
    );
    this.updateDailyField('today', (this.dailyEntry().today + '\n' + lines.join('\n')).trim());
  }
  /** v1.0.177cb — Auto-suggère "blocages" depuis les tickets bloqués ou risques actifs. */
  dailySuggestBlockers(): void {
    const tks = this.tickets() || [];
    const blocked = tks.filter(t => {
      const s = (t.status || '').toLowerCase();
      return s.includes('bloqu') || s.includes('block');
    });
    const lines = blocked.length === 0
      ? ['- Aucun ticket bloqué ✅']
      : blocked.map(t => `- 🛑 ${t.ticketId || ('#' + t.id)} : ${t.title}`);
    this.updateDailyField('blockers', (this.dailyEntry().blockers + '\n' + lines.join('\n')).trim());
  }

  // v1.0.150 — Pro-hero INLINE (dans le header carousel) : toggle pour afficher la section info
  // Scrum à la place du contenu de page. Click sur la carte → expand. Click fermer → collapse.
  heroPanelExpanded = signal(false);
  toggleHeroPanel(ev?: Event): void {
    ev?.stopPropagation();
    this.heroPanelExpanded.update(v => !v);
  }
  closeHeroPanel(ev?: Event): void {
    ev?.stopPropagation();
    this.heroPanelExpanded.set(false);
  }
  closePageInfoModal(): void {
    this.pageInfoModalOpen.set(false);
    this.heroPanelPageId.set(null);  // reset après close
  }

  /** Contenu de la card YAMZY tip : tip par défaut sur la page featured. */
  yamzyTipCard = computed(() => {
    const pageLabel = this.featuredPageLabel() || this.activePageLabel();
    const cat = this.activeSuperCat();
    const scColor = cat ? (this.superCats.find(s => s.id === cat)?.color || '#d99a51') : '#d99a51';
    return {
      kind: '✨ TIP',
      icon: '🃏',
      title: 'Pouvoirs de cette page',
      subtitle: 'Clique sur la grande carte du header',
      meta: pageLabel,
      color: scColor,
      gradient: `linear-gradient(135deg, ${scColor}, #6647bf)`,
    };
  });

  /** Big card : image de la page featured du slide actuel. */
  carouselDisplayedCard = computed<string | null>(() => {
    return this.carouselFeaturedPage()?.card || null;
  });

  /** Label de la big card pour alt= et tooltip. */
  carouselDisplayedCardLabel = computed<string>(() => {
    return this.carouselFeaturedPage()?.label || '';
  });

  /** Page dont le contenu doit etre affiche : sur slide 0 = activePage (normale),
   *  sur slides 1+ = page mise en avant par le carousel (preview).
   *  Les sections de page utilisent ce signal au lieu de activePage() directement. */
  displayedPage = computed<string>(() => {
    if (this.psEmptyCarouselIndex() === 0) return this.activePage();
    return this.carouselFeaturedPage()?.id || this.activePage();
  });

  /** Info enrichie de la page mise en avant (tag/title/desc/tip) — pour slides 1+ qui
   *  remplacent le contenu standard du header par celui de la page featured. */
  carouselFeaturedPageInfo = computed<{
    pageId: string; label: string; icon: string;
    tag: string; title: string; desc: string; tip?: string;
  } | null>(() => {
    const featured = this.carouselFeaturedPage();
    if (!featured) return null;
    const lang = this.i18n.lang() as 'fr' | 'en';
    const entry: any = (TOOLTIP_GUIDE as any)[featured.id];
    const tr = entry?.[lang] || entry?.fr || null;
    return {
      pageId: featured.id,
      label: featured.label,
      icon: featured.icon,
      tag: tr?.scrum ? `[${tr.scrum.toUpperCase()}]` : featured.id.toUpperCase(),
      title: tr?.yamzy || featured.label,
      desc: tr?.desc || `Page ${featured.label}`,
      tip: tr?.tip,
    };
  });

  /** Minis : toutes les pages de la super-cat sauf la page featured. */
  carouselDisplayedMinis = computed<Array<{
    page: PageDef; color: string; topPct: number; leftPct: number; rotate: number; delay: number;
  }>>(() => {
    const sc = this.activeSuperCat();
    const featured = this.carouselFeaturedPage();
    if (!sc || !featured) return [];
    const others = this.carouselSuperCatPages().filter(p => p.id !== featured.id);
    if (!others.length) return [];
    const color = this.superCats.find(s => s.id === sc)?.color || '#d99a51';
    const positions = [
      { top: 5,  left: 78, rot: -12, delay: 0    },
      { top: 12, left: 64, rot:   6, delay: 0.18 },
      { top: 22, left: 50, rot:  -7, delay: 0.36 },
      { top: 32, left: 38, rot:  10, delay: 0.54 },
      { top: 42, left: 26, rot:  -5, delay: 0.72 },
      { top: 55, left: 14, rot:   8, delay: 0.90 },
      { top: 18, left: 70, rot:   4, delay: 1.08 },
      { top: 28, left: 56, rot:  -9, delay: 1.26 },
      { top: 40, left: 42, rot:   5, delay: 1.44 },
      { top: 52, left: 28, rot:  -6, delay: 1.62 },
      { top: 68, left:  4, rot:   3, delay: 1.80 },
    ];
    return others.map((p, i) => {
      const pos = positions[i % positions.length];
      return { page: p, color, topPct: pos.top, leftPct: pos.left, rotate: pos.rot, delay: pos.delay };
    });
  });

  // ═══ YAMZY POSITION EDITOR v1.0.25 — Drag + Copy CSS coords ═══
  // Permet à l'utilisateur de positionner avatar + carousel manuellement
  // puis de copier les coords pour les communiquer à Claude.
  // Defaults rapprochés : carousel à 380 au lieu de 440 (plus proche de l'avatar)
  // v1.0.177ai — Persist fabLeft/Bottom/Size via clef dédiée wt_fab_pos_v1
  private readonly FAB_POS_KEY = 'wt_fab_pos_v1';
  private loadFabPos(): { left: number; bottom: number; size: number } {
    try {
      const raw = localStorage.getItem(this.FAB_POS_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        return {
          left: typeof v.left === 'number' ? v.left : 100,
          bottom: typeof v.bottom === 'number' ? v.bottom : 20,
          size: typeof v.size === 'number' ? v.size : 320,
        };
      }
    } catch {}
    return { left: 100, bottom: 20, size: 320 };
  }
  private fabInit = this.loadFabPos();
  fabLeft = signal(this.fabInit.left);
  fabBottom = signal(this.fabInit.bottom);
  fabSize = signal(this.fabInit.size);
  /** v1.0.177bm — Computed clamps qui ajustent fab pour rester DANS la viewport.
   *  Évite que la div FAB déborde et cause un scroll horizontal/vertical. */
  fabSizeClamped = computed(() => {
    const w = this.winWidth();
    const h = this.winHeight();
    const maxByW = Math.max(80, w - this.fabLeft() - 20);
    const maxByH = Math.max(80, h - this.fabBottom() - 20);
    return Math.min(this.fabSize(), maxByW, maxByH);
  });
  fabLeftClamped = computed(() => Math.max(0, Math.min(this.fabLeft(), this.winWidth() - 80)));
  fabBottomClamped = computed(() => Math.max(0, Math.min(this.fabBottom(), this.winHeight() - 80)));
  saveFabPos(): void {
    try {
      localStorage.setItem(this.FAB_POS_KEY, JSON.stringify({
        left: this.fabLeft(), bottom: this.fabBottom(), size: this.fabSize(),
      }));
    } catch {}
  }
  ycLeft = signal(380);    // était 440 — rapproché de 60px
  ycBottom = signal(50);
  ycWidth = signal(500);   // v1.0.145 — élargi 420→500 pour matcher design CodePen
  positionMode = signal(false);
  togglePositionMode(): void { this.positionMode.update(v => !v); }

  /** v1.0.177be — Contrôle live de la taille + offset des bubbles flottantes (cockpit/guides/notifs).
   *  Persisté dans son propre clef localStorage pour éviter conflit avec fab pos. */
  private readonly FAB_ALERT_KEY = 'wt_fab_alert_v1';
  private loadFabAlertCfg(): { size: number; offsetX: number; offsetY: number; radiusX: number; radiusY: number } {
    try {
      const raw = localStorage.getItem(this.FAB_ALERT_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        return {
          size:    typeof v.size === 'number' ? v.size : 60,
          offsetX: typeof v.offsetX === 'number' ? v.offsetX : 0,
          offsetY: typeof v.offsetY === 'number' ? v.offsetY : 0,
          radiusX: typeof v.radiusX === 'number' ? v.radiusX : 180,
          radiusY: typeof v.radiusY === 'number' ? v.radiusY : 260,
        };
      }
    } catch {}
    return { size: 60, offsetX: 0, offsetY: 0, radiusX: 180, radiusY: 260 };
  }
  private fabAlertInit = this.loadFabAlertCfg();
  alertSize = signal(this.fabAlertInit.size);
  alertOffsetX = signal(this.fabAlertInit.offsetX);
  alertOffsetY = signal(this.fabAlertInit.offsetY);
  alertRadiusX = signal(this.fabAlertInit.radiusX);
  alertRadiusY = signal(this.fabAlertInit.radiusY);
  saveFabAlertCfg(): void {
    try {
      localStorage.setItem(this.FAB_ALERT_KEY, JSON.stringify({
        size: this.alertSize(),
        offsetX: this.alertOffsetX(),
        offsetY: this.alertOffsetY(),
        radiusX: this.alertRadiusX(),
        radiusY: this.alertRadiusY(),
      }));
    } catch {}
  }
  setAlertSize(v: number): void    { this.alertSize.set(Math.max(20, Math.min(200, Math.round(v)))); this.saveFabAlertCfg(); }
  setAlertOffsetX(v: number): void { this.alertOffsetX.set(Math.round(v)); this.saveFabAlertCfg(); }
  setAlertOffsetY(v: number): void { this.alertOffsetY.set(Math.round(v)); this.saveFabAlertCfg(); }
  setAlertRadiusX(v: number): void { this.alertRadiusX.set(Math.max(50, Math.min(600, Math.round(v)))); this.saveFabAlertCfg(); }
  setAlertRadiusY(v: number): void { this.alertRadiusY.set(Math.max(50, Math.min(800, Math.round(v)))); this.saveFabAlertCfg(); }
  resetFabAlertCfg(): void {
    this.alertSize.set(60); this.alertOffsetX.set(0); this.alertOffsetY.set(0);
    this.alertRadiusX.set(180); this.alertRadiusY.set(260);
    this.saveFabAlertCfg();
  }

  // ═══ v1.0.175 — MODE ÉDITION AVATAR 3D : tunage du wizzard/tige + mapping bones ═══
  // Activé par bouton "🎭 Avatar 3D Edit" dans la topbar. Valeurs persistées en localStorage.
  // v1.0.177s — Bump v4→v5 : YAMZY.glb maintenant patché avec offset baké → yamzyY default = 0.
  private readonly AVATAR_3D_EDIT_KEY = 'wt_avatar3d_edit_v5';
  /** v1.0.177z — Defaults : yamzyX/Y/Z (avant : seul Y était persisté → bug sur le drag X/Z). */
  private readonly AVATAR_3D_DEFAULTS = {
    yamzyX: 0, yamzyY: 0, yamzyZ: 0,
    yamzyScale: 1,  // v1.0.177ak — scale uniforme du GLB YAMZY (1 = native)
    compX: 0, compY: 0, compZ: 2.423,
    compScale: 1.4,
    compRotX: 0, compRotY: 0, compRotZ: 0,
    /** Mapping wizzard → YAMZY (extrémités SEULEMENT — 14 bones).
     *  ⚠ Root / Hips / Abdomen / Spine VOLONTAIREMENT EXCLUS car l'animation du wizzard
     *  a des keyframes sur ces bones qui repositionnent YAMZY au sol (override modelYOffset).
     *  En excluant ces bones, YAMZY garde sa position custom et l'animation joue uniquement
     *  sur les membres (bras, mains, jambes, tête). */
    boneMap: {
      // Tête (Neck → Head : ces bones n'ont généralement pas de translation worldspace dans l'anim)
      'head_wizardArm': 'Neck',
      'heat_wizardArm': 'Head',
      // Bras DROITE (X négatif, suffix .R)
      'Bone.005_wizardArm': 'Shoulder.R',
      'h01.R_wizardArm': 'UpperArm.R',
      'h02.R_wizardArm': 'LowerArm.R',
      'h03.R_wizardArm': 'Fist.R',
      // Bras GAUCHE (X positif, suffix .L)
      'Bone.009_wizardArm': 'Shoulder.L',
      'h01.L_wizardArm': 'UpperArm.L',
      'h02.L_wizardArm': 'LowerArm.L',
      'h03.L_wizardArm': 'Fist.L',
      // Jambe DROITE
      'Bone.002_wizardArm': 'UpperLeg.R',
      'Bone.017_wizardArm': 'LowerLeg.R',
      // Jambe GAUCHE
      'Bone.003_wizardArm': 'UpperLeg.L',
      'Bone.015_wizardArm': 'LowerLeg.L',
    } as Record<string, string>,
  };
  avatar3dEditMode = signal(false);
  toggleAvatar3dEdit(): void { this.avatar3dEditMode.update(v => !v); }

  /** v1.0.177ai — MODE PLACEMENT YAMZY : fullscreen 3D vide, avatar SEUL (sans wizzard),
   *  click → gizmo translate, + sliders screen-space (fabLeft/Bottom/Size). */
  yamzyPlacementMode = signal(false);
  toggleYamzyPlacement(): void {
    this.yamzyPlacementMode.update(v => !v);
    // Ferme l'autre mode si on entre dans celui-ci (mutuellement exclusifs)
    if (this.yamzyPlacementMode() && this.avatar3dEditMode()) this.avatar3dEditMode.set(false);
  }
  /** v1.0.177aj — Vrais dimensions de la fenêtre, mises à jour au resize.
   *  La mini preview écran reflète l'aspect ratio RÉEL (avant : hardcodé 16:9 1800×900). */
  winWidth = signal(window.innerWidth);
  winHeight = signal(window.innerHeight);
  private installWindowResize(): void {
    const onResize = () => {
      this.winWidth.set(window.innerWidth);
      this.winHeight.set(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
  }
  /** v1.0.177aj — Click sur le FAB :
   *  - En mode placement : ne fait RIEN (le drag est déjà géré par mousedown).
   *  - Sinon : ouvre/ferme le carousel comme avant. */
  onFabClick(ev: MouseEvent): void {
    if (this.yamzyPlacementMode()) {
      ev.stopPropagation();
      return;
    }
    this.toggleCarousel();
  }
  /** v1.0.177aj — Mousedown sur le FAB en mode placement → drag direct. */
  onFabMouseDown(ev: MouseEvent): void {
    if (!this.yamzyPlacementMode()) return;
    ev.preventDefault();
    ev.stopPropagation();
    // Réutilise le système de drag existant (startDrag) en activant temporairement positionMode
    this.dragTarget = 'fab';
    this.dragStart = {
      x: ev.clientX,
      y: ev.clientY,
      origLeft: this.fabLeft(),
      origBottom: this.fabBottom(),
    };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }

  /** v1.0.177am — Resize handle drag : agrandit/réduit fabSize en suivant la souris.
   *  Le handle est en haut-droite : drag vers haut-droite agrandit, vers bas-gauche réduit. */
  private resizeStart: { x: number; y: number; origSize: number } | null = null;
  onFabResizeMouseDown(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.resizeStart = { x: ev.clientX, y: ev.clientY, origSize: this.fabSize() };
    document.addEventListener('mousemove', this.onFabResizeMove);
    document.addEventListener('mouseup', this.onFabResizeEnd);
  }
  private onFabResizeMove = (ev: MouseEvent) => {
    if (!this.resizeStart) return;
    // Drag vers la droite ou le haut → agrandit. Vers la gauche ou le bas → réduit.
    const dx = ev.clientX - this.resizeStart.x;
    const dy = this.resizeStart.y - ev.clientY;  // axe Y inversé (haut = positif)
    const delta = Math.max(dx, dy);  // sensibilité = plus grand des 2 axes
    const newSize = Math.max(80, Math.min(2000, this.resizeStart.origSize + delta));
    this.fabSize.set(Math.round(newSize));
  };
  private onFabResizeEnd = () => {
    if (this.resizeStart) this.saveFabPos();
    this.resizeStart = null;
    document.removeEventListener('mousemove', this.onFabResizeMove);
    document.removeEventListener('mouseup', this.onFabResizeEnd);
  };
  /** Slider screen handler : update + save. */
  setFabLeft(v: number): void   { this.fabLeft.set(Math.max(0, Math.round(v))); this.saveFabPos(); }
  setFabBottom(v: number): void { this.fabBottom.set(Math.max(0, Math.round(v))); this.saveFabPos(); }
  setFabSize(v: number): void   { this.fabSize.set(Math.max(80, Math.min(2000, Math.round(v)))); this.saveFabPos(); }
  /** Reset placement defaults. */
  resetYamzyPlacement(): void {
    this.fabLeft.set(100); this.fabBottom.set(20); this.fabSize.set(320);
    this.yamzyX.set(0); this.yamzyY.set(0); this.yamzyZ.set(0);
    this.yamzyScale.set(1);
    this.saveFabPos(); this.saveAvatar3dEdit();
  }

  /** v1.0.177ao — Copie les valeurs courantes du mode placement au format JSON dans le clipboard.
   *  L'utilisateur peut ensuite coller dans le chat pour que je hardcode en defaults. */
  async copyPlacementDefaults(): Promise<void> {
    const cfg = {
      yamzyX: this.yamzyX(),
      yamzyY: this.yamzyY(),
      yamzyZ: this.yamzyZ(),
      yamzyScale: this.yamzyScale(),
      fabLeft: this.fabLeft(),
      fabBottom: this.fabBottom(),
      fabSize: this.fabSize(),
    };
    const json = JSON.stringify(cfg, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      await this.dialog.alert({
        title: '📋 Defaults copiés !',
        message: 'Le JSON est dans ton presse-papier. Colle-le dans le chat pour que je le hardcode en defaults — tout le monde recevra ces valeurs à la prochaine release.',
        kind: 'success',
        details: [
          { label: 'yamzyX',     value: String(cfg.yamzyX) },
          { label: 'yamzyY',     value: String(cfg.yamzyY) },
          { label: 'yamzyZ',     value: String(cfg.yamzyZ) },
          { label: 'yamzyScale', value: String(cfg.yamzyScale) },
          { label: 'fabLeft',    value: cfg.fabLeft + 'px' },
          { label: 'fabBottom',  value: cfg.fabBottom + 'px' },
          { label: 'fabSize',    value: cfg.fabSize + 'px' },
        ],
      });
    } catch {
      await this.dialog.alert({
        title: 'Defaults (copie manuelle)',
        message: json,
        kind: 'info',
      });
    }
  }

  // Valeurs (lues au démarrage, sauvées à chaque change)
  private loadAvatar3dEdit(): {
    yamzyX: number; yamzyY: number; yamzyZ: number;
    yamzyScale: number;
    compX: number; compY: number; compZ: number;
    compScale: number;
    compRotX: number; compRotY: number; compRotZ: number;
    boneMap: Record<string, string>;
  } {
    const defaults = JSON.parse(JSON.stringify(this.AVATAR_3D_DEFAULTS));
    // v1.0.177n — Migration UNIQUE (flag pour éviter rerun à chaque reload).
    const MIGRATION_FLAG = 'wt_avatar3d_edit_migrated_v5';
    if (!localStorage.getItem(MIGRATION_FLAG)) {
      // v1.0.177s — bump v4→v5 : nettoie aussi v4 pour appliquer le nouveau default yamzyY=0
      for (const oldKey of ['wt_avatar3d_edit_v1', 'wt_avatar3d_edit_v2', 'wt_avatar3d_edit_v3', 'wt_avatar3d_edit_v4']) {
        try {
          const oldRaw = localStorage.getItem(oldKey);
          if (oldRaw) {
            const old = JSON.parse(oldRaw);
            // ⚠ Ne PAS écraser _v4 si _v4 a déjà des valeurs plus récentes
            const existingV4Raw = localStorage.getItem(this.AVATAR_3D_EDIT_KEY);
            if (!existingV4Raw) {
              localStorage.setItem(this.AVATAR_3D_EDIT_KEY, JSON.stringify({
                ...defaults,
                yamzyY: old.yamzyY ?? defaults.yamzyY,
                compX: old.compX ?? defaults.compX,
                compY: old.compY ?? defaults.compY,
                compZ: old.compZ ?? defaults.compZ,
                compScale: old.compScale ?? defaults.compScale,
                compRotX: old.compRotX ?? defaults.compRotX,
                compRotY: old.compRotY ?? defaults.compRotY,
                compRotZ: old.compRotZ ?? defaults.compRotZ,
                boneMap: defaults.boneMap,
              }));
              console.log(`[avatar3d] 🔄 Migration ${oldKey} → ${this.AVATAR_3D_EDIT_KEY}`);
            }
            localStorage.removeItem(oldKey);
          }
        } catch {}
      }
      localStorage.setItem(MIGRATION_FLAG, '1');
    }
    // Lecture v4 avec MERGE des defaults (champs manquants ← defaults)
    try {
      const raw = localStorage.getItem(this.AVATAR_3D_EDIT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const merged = { ...defaults, ...saved };
        if (!saved.boneMap || Object.keys(saved.boneMap).length === 0) {
          merged.boneMap = defaults.boneMap;
        }
        console.log(`[avatar3d] 📖 Lecture ${this.AVATAR_3D_EDIT_KEY} OK :`, {
          yamzyY: merged.yamzyY,
          comp: [merged.compX, merged.compY, merged.compZ],
          scale: merged.compScale,
          rot: [merged.compRotX, merged.compRotY, merged.compRotZ],
          boneCount: Object.keys(merged.boneMap || {}).length,
        });
        return merged;
      } else {
        console.log(`[avatar3d] 📖 ${this.AVATAR_3D_EDIT_KEY} vide → defaults appliqués`);
      }
    } catch (e) {
      console.warn(`[avatar3d] ⚠ Erreur lecture ${this.AVATAR_3D_EDIT_KEY} :`, e);
    }
    return defaults;
  }
  private a3dInit = this.loadAvatar3dEdit();
  // v1.0.177z — Ajout yamzyX et yamzyZ (avant : seul Y persisté, X/Z perdus au reload)
  yamzyX = signal(this.a3dInit.yamzyX);
  yamzyY = signal(this.a3dInit.yamzyY);
  yamzyZ = signal(this.a3dInit.yamzyZ);
  /** v1.0.177ak — Scale uniforme du GLB YAMZY (1 = native, jusqu'à 3 → 300% taille). */
  yamzyScale = signal(this.a3dInit.yamzyScale ?? 1);

  /** v1.0.177ap — SPLIT ANIMATION : cutTime (en secondes) par clipName. 0 = pas de split. */
  private readonly ANIM_SPLITS_KEY = 'wt_anim_splits_v1';
  private loadAnimSplits(): { splits: Record<string, number>; modes: Record<string, 'original' | 'part1' | 'part2' | 'sequential'> } {
    try {
      const raw = localStorage.getItem(this.ANIM_SPLITS_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        return { splits: v.splits || {}, modes: v.modes || {} };
      }
    } catch {}
    return { splits: {}, modes: {} };
  }
  private animSplitsInit = this.loadAnimSplits();
  animSplits = signal<Record<string, number>>(this.animSplitsInit.splits);
  animPlayModes = signal<Record<string, 'original' | 'part1' | 'part2' | 'sequential'>>(this.animSplitsInit.modes);
  /** Liste des animations détectées par le composant (émise via animationsLoaded). */
  animList = signal<Array<{ name: string; duration: number; trackCount: number; hasMorph: boolean; targets: string[] }>>([]);
  saveAnimSplits(): void {
    try {
      localStorage.setItem(this.ANIM_SPLITS_KEY, JSON.stringify({ splits: this.animSplits(), modes: this.animPlayModes() }));
    } catch {}
  }
  onAnimationsLoaded(list: Array<{ name: string; duration: number; trackCount: number; hasMorph: boolean; targets: string[] }>): void {
    this.animList.set(list);
    console.log('[avatar3d] 🎬 Animations chargées :', list);
  }
  /** v1.0.177aq — Liste des objets animés (target nodes uniques à travers toutes les anims). */
  animObjects = signal<Array<{ name: string; animsCount: number; maxDuration: number; hasMorph: boolean }>>([]);
  onAnimObjectsLoaded(list: Array<{ name: string; animsCount: number; maxDuration: number; hasMorph: boolean }>): void {
    this.animObjects.set(list);
    console.log('[avatar3d] 🎯 Objets animés détectés :', list);
  }
  /** v1.0.177aq/as/at/bb — SPLIT PAR OBJET MULTI-CUTS + NOMMAGE : 3 parts nommées
   *  before_explode (0→4.78s) / repos (4.78→5.80s) / create_bubble (5.80→fin).
   *  v1.0.177bb — Valeurs ajustées par l'utilisateur via la timeline interactive. */
  private readonly OBJ_SPLITS_KEY = 'wt_obj_splits_v5';
  private readonly BUBBLE_OBJECTS = ['Icosphere_0', 'Icosphere.002', 'Icosphere.005'];
  private readonly OBJ_SPLITS_DEFAULTS = {
    splits: {
      'Icosphere_0':   [4.78, 5.80],
      'Icosphere.002': [4.78, 5.80],
      'Icosphere.005': [4.78, 5.80],
    } as Record<string, number[]>,
    modes: {
      'Icosphere_0':   'part2',  // = repos par défaut
      'Icosphere.002': 'part2',
      'Icosphere.005': 'part2',
    } as Record<string, string>,
    /** v1.0.177at — Noms des parts pour chaque objet (1-based avec part names). */
    partNames: {
      'Icosphere_0':   ['before_explode', 'repos', 'create_bubble'],
      'Icosphere.002': ['before_explode', 'repos', 'create_bubble'],
      'Icosphere.005': ['before_explode', 'repos', 'create_bubble'],
    } as Record<string, string[]>,
  };
  private loadObjectSplits(): { splits: Record<string, number[]>; modes: Record<string, string>; partNames: Record<string, string[]> } {
    try {
      const raw = localStorage.getItem(this.OBJ_SPLITS_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        return { splits: v.splits || {}, modes: v.modes || {}, partNames: v.partNames || {} };
      }
    } catch {}
    return JSON.parse(JSON.stringify(this.OBJ_SPLITS_DEFAULTS));
  }
  private objSplitsInit = this.loadObjectSplits();
  objectSplits = signal<Record<string, number[]>>(this.objSplitsInit.splits);
  /** v1.0.177at — User-set modes (via UI). Combinés avec bubbleActive() pour le mode effectif. */
  userObjectPlayModes = signal<Record<string, string>>(this.objSplitsInit.modes);
  objectPartNames = signal<Record<string, string[]>>(this.objSplitsInit.partNames);
  /** v1.0.177at — État de la bubble : repos par défaut, bascule sur create_bubble à chaque notif. */
  bubbleActive = signal<'before_explode' | 'repos' | 'create_bubble'>('repos');
  /** v1.0.177au/bb — SPLIT GLOBAL appliqué à TOUTES les tracks de YAMZY (body + bubble + tout).
   *  Cuts hardcodés v1.0.177bb : [4.78s, 5.80s] (validés via timeline interactive).
   *  → 3 parts : before_explode (4.78s) / repos (1.02s) / create_bubble (2.66s).
   *  Mode actif par défaut = 'part2' (= repos pose). */
  globalSplits = signal<number[]>([4.78, 5.80]);
  globalPartNames = signal<string[]>(['before_explode', 'repos', 'create_bubble']);
  /** Le globalActivePart est mappé depuis bubbleActive (repos → part2, create_bubble → part3, etc). */
  globalActivePart = computed<string>(() => {
    const names = this.globalPartNames();
    const idx = names.indexOf(this.bubbleActive());
    return idx >= 0 ? `part${idx + 1}` : 'all';
  });
  /** v1.0.177av — Setters pour la timeline interactive. */
  setGlobalCut(cutIdx: number, value: number): void {
    const cuts = this.globalSplits().slice();
    cuts[cutIdx] = Math.max(0.01, Math.min(this.getGlobalDuration() - 0.01, value));
    this.globalSplits.set(cuts);
  }
  setGlobalActivePartByName(partName: 'before_explode' | 'repos' | 'create_bubble'): void {
    this.bubbleActive.set(partName);
    if (this.bubbleResetTimer) { clearTimeout(this.bubbleResetTimer); this.bubbleResetTimer = null; }
    this.animPlaying.set(true);  // v1.0.177ay — unpause le mixer
  }
  /** v1.0.177aw — Counter qui s'incrémente à chaque click "▶ Preview" → force le restart de la part jouée. */
  globalPlayTrigger = signal(0);
  /** v1.0.177aw — Play une part en restartant depuis le début (utile pour preview).
   *  Différent de setGlobalActivePartByName qui ne restart pas si déjà sur cette part.
   *  v1.0.177ay — Force aussi animPlaying=true (sinon le mixer est en pause par défaut). */
  previewGlobalPart(partName: string): void {
    this.bubbleActive.set(partName as 'before_explode' | 'repos' | 'create_bubble');
    if (this.bubbleResetTimer) { clearTimeout(this.bubbleResetTimer); this.bubbleResetTimer = null; }
    this.globalPlayTrigger.update(n => n + 1);
    this.animPlaying.set(true);  // ⚠ unpause le mixer (sinon les actions tournent mais le delta=0)
  }
  /** Donne la duration d'une part par son index (utile pour le bouton de preview). */
  getPartDuration(idx: number): number {
    const bounds = this.getGlobalBounds();
    if (idx < 0 || idx >= bounds.length - 1) return 0;
    return bounds[idx + 1] - bounds[idx];
  }
  /** Renomme une part du global timeline. */
  setGlobalPartName(idx: number, name: string): void {
    const names = this.globalPartNames().slice();
    names[idx] = name;
    this.globalPartNames.set(names);
  }
  /** Ajoute un cut au milieu de la part la plus large. */
  addGlobalCut(): void {
    const cuts = this.globalSplits().slice();
    const dur = this.getGlobalDuration();
    const bounds = [0, ...cuts, dur].sort((a, b) => a - b);
    let widestIdx = 0, widest = 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      const w = bounds[i + 1] - bounds[i];
      if (w > widest) { widest = w; widestIdx = i; }
    }
    const newCut = +((bounds[widestIdx] + bounds[widestIdx + 1]) / 2).toFixed(2);
    cuts.push(newCut);
    cuts.sort((a, b) => a - b);
    this.globalSplits.set(cuts);
    // Ajoute aussi un nom default à la nouvelle part
    const names = this.globalPartNames().slice();
    names.splice(widestIdx + 1, 0, 'new_part');
    this.globalPartNames.set(names);
  }
  removeGlobalCut(idx: number): void {
    const cuts = this.globalSplits().filter((_, i) => i !== idx);
    this.globalSplits.set(cuts);
    const names = this.globalPartNames().slice();
    names.splice(idx + 1, 1);
    this.globalPartNames.set(names);
  }
  /** Durée max des anims YAMZY (depuis animList ou fallback 8.458). */
  getGlobalDuration(): number {
    const list = this.animList();
    if (!list || !list.length) return 8.458;
    return Math.max(...list.map(a => a.duration));
  }
  /** Helpers pour template : bornes [0, cut1, cut2, ..., duration]. */
  getGlobalBounds(): number[] {
    return [0, ...this.globalSplits().slice().sort((a, b) => a - b), this.getGlobalDuration()];
  }
  /** Couleurs par index de part (rotation). */
  getPartColor(idx: number): string {
    const colors = ['#ff6b6b', '#51cf66', '#4dabf7', '#ffd43b', '#ce8aff', '#ff8c42'];
    return colors[idx % colors.length];
  }
  /** Pourcentage d'un temps par rapport à la durée totale (pour CSS left%). */
  pctOf(time: number): number { return (time / this.getGlobalDuration()) * 100; }
  /** Drag d'un cut marker — exposé via mousedown du template. */
  private cutDragIdx = -1;
  private cutDragStartX = 0;
  private cutDragStartValue = 0;
  private cutDragTrackWidth = 0;
  onCutMarkerMouseDown(ev: MouseEvent, cutIdx: number, trackElement: HTMLElement): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.cutDragIdx = cutIdx;
    this.cutDragStartX = ev.clientX;
    this.cutDragStartValue = this.globalSplits()[cutIdx];
    this.cutDragTrackWidth = trackElement.clientWidth;
    document.addEventListener('mousemove', this.onCutMarkerMove);
    document.addEventListener('mouseup', this.onCutMarkerEnd);
  }
  private onCutMarkerMove = (ev: MouseEvent) => {
    if (this.cutDragIdx < 0 || this.cutDragTrackWidth <= 0) return;
    const dx = ev.clientX - this.cutDragStartX;
    const dur = this.getGlobalDuration();
    const newValue = this.cutDragStartValue + (dx / this.cutDragTrackWidth) * dur;
    this.setGlobalCut(this.cutDragIdx, +newValue.toFixed(2));
  };
  private onCutMarkerEnd = () => {
    this.cutDragIdx = -1;
    document.removeEventListener('mousemove', this.onCutMarkerMove);
    document.removeEventListener('mouseup', this.onCutMarkerEnd);
  };
  /** v1.0.177at — Mode effectif = userMode mais overridé pour les bubble objects selon bubbleActive(). */
  objectPlayModes = computed<Record<string, string>>(() => {
    const userModes = this.userObjectPlayModes();
    const active = this.bubbleActive();
    const partNames = this.objectPartNames();
    const result: Record<string, string> = { ...userModes };
    for (const obj of this.BUBBLE_OBJECTS) {
      const names = partNames[obj];
      if (names?.length) {
        const idx = names.indexOf(active);
        if (idx >= 0) result[obj] = `part${idx + 1}`;
      }
    }
    return result;
  });
  saveObjectSplits(): void {
    try {
      localStorage.setItem(this.OBJ_SPLITS_KEY, JSON.stringify({
        splits: this.objectSplits(),
        modes: this.userObjectPlayModes(),
        partNames: this.objectPartNames(),
      }));
    } catch {}
  }
  /** v1.0.177at — Renomme la part i-ème d'un objet. */
  renameObjectPart(objName: string, partIdx: number, newName: string): void {
    this.objectPartNames.update(p => {
      const c = { ...p };
      const names = (c[objName] || []).slice();
      names[partIdx] = newName;
      c[objName] = names;
      return c;
    });
    this.saveObjectSplits();
  }
  /** v1.0.177at — Bouton "ajouter une notif" → bascule sur create_bubble puis retour à repos. */
  bubbleNotifPending = signal(0);
  private bubbleResetTimer: any = null;
  /** v1.0.177bc — Notifs custom ajoutées par l'utilisateur via "🔔 Add notif".
   *  Chaque item a un spawnTime → l'animation "bubble qui s'envole" dure 1.5s. */
  customNotifs = signal<Array<{ id: string; kind: string; emoji: string; color: string;
                                 title: string; subtitle: string; meta: string; pageHint: string;
                                 spawnTime: number }>>([]);
  /** v1.0.177bc — Compteur séquentiel pour générer un id unique par notif. */
  private notifCounter = 0;
  addNotification(): void {
    this.bubbleNotifPending.update(n => n + 1);
    this.bubbleActive.set('create_bubble');
    this.animPlaying.set(true);
    this.globalPlayTrigger.update(n => n + 1);
    if (this.bubbleResetTimer) clearTimeout(this.bubbleResetTimer);
    // v1.0.177bb — Durée part3 = 2.66s. À la FIN de create_bubble → spawn la bubble flottante.
    this.bubbleResetTimer = setTimeout(() => {
      this.bubbleActive.set('repos');
      this.bubbleNotifPending.set(0);
      // v1.0.177bc — Spawn une notif flottante : la bubble vient de YAMZY et s'envole vers sa position arc
      this.notifCounter++;
      const newNotif = {
        id: `custom-notif-${this.notifCounter}`,
        kind: 'NOTIF',
        emoji: '🔔',
        color: '#ff7a4a',
        title: `Nouvelle notif #${this.notifCounter}`,
        subtitle: 'Click pour voir le détail',
        meta: 'Notif live',
        pageHint: 'dashboard',
        spawnTime: this.notifCounter,  // unique value forces re-trigger d'animation CSS
      };
      this.customNotifs.update(arr => [...arr, newNotif]);
    }, 2660);
  }
  /** v1.0.177bc — Supprime une notif custom (click ✕). */
  dismissCustomNotif(id: string): void {
    this.customNotifs.update(arr => arr.filter(n => n.id !== id));
  }
  /** Helpers pour le UI multi-cuts. */
  getObjectCuts(objName: string): number[] { return this.objectSplits()[objName] || []; }
  /** Compte nb parts = cuts.length + 1. */
  getObjectPartsCount(objName: string): number { return this.getObjectCuts(objName).length + 1; }
  /** Ajoute un cut au milieu de la plus longue part (utile en init). */
  addObjectCut(objName: string, maxDuration: number): void {
    const cuts = this.getObjectCuts(objName).slice().sort((a, b) => a - b);
    const bounds = [0, ...cuts, maxDuration];
    let widestIdx = 0, widest = 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      const w = bounds[i + 1] - bounds[i];
      if (w > widest) { widest = w; widestIdx = i; }
    }
    const newCut = (bounds[widestIdx] + bounds[widestIdx + 1]) / 2;
    const newCuts = [...cuts, +newCut.toFixed(2)].sort((a, b) => a - b);
    this.objectSplits.update(s => ({ ...s, [objName]: newCuts }));
    this.saveObjectSplits();
  }
  /** Met à jour le ième cut d'un objet. */
  updateObjectCut(objName: string, cutIdx: number, value: number): void {
    const cuts = this.getObjectCuts(objName).slice();
    cuts[cutIdx] = value;
    this.objectSplits.update(s => ({ ...s, [objName]: cuts }));
    this.saveObjectSplits();
  }
  /** Supprime un cut spécifique. */
  removeObjectCut(objName: string, cutIdx: number): void {
    const cuts = this.getObjectCuts(objName).filter((_, i) => i !== cutIdx);
    this.objectSplits.update(s => ({ ...s, [objName]: cuts }));
    this.saveObjectSplits();
  }
  setObjectPlayMode(objName: string, mode: string): void {
    this.userObjectPlayModes.update(m => ({ ...m, [objName]: mode }));
    this.saveObjectSplits();
  }
  removeObjectSplit(objName: string): void {
    this.objectSplits.update(s => { const c = { ...s }; delete c[objName]; return c; });
    this.userObjectPlayModes.update(m => { const c = { ...m }; delete c[objName]; return c; });
    this.objectPartNames.update(p => { const c = { ...p }; delete c[objName]; return c; });
    this.saveObjectSplits();
  }
  /** Génère un Array N+1 de strings 'part1', 'part2', ... pour le UI. */
  getObjectPartNames(objName: string): string[] {
    const count = this.getObjectPartsCount(objName);
    return Array.from({ length: count }, (_, i) => `part${i + 1}`);
  }
  /** TrackBy index pour le *ngFor des cuts (évite recréation des sliders quand un cut change). */
  trackByIdx(idx: number): number { return idx; }
  /** Set le cutTime pour un clip ; 0 = pas de split. Force recharge du modèle pour appliquer. */
  setAnimSplit(clipName: string, cutTime: number): void {
    this.animSplits.update(s => ({ ...s, [clipName]: cutTime }));
    this.saveAnimSplits();
  }
  setAnimPlayMode(clipName: string, mode: 'original' | 'part1' | 'part2' | 'sequential'): void {
    this.animPlayModes.update(m => ({ ...m, [clipName]: mode }));
    this.saveAnimSplits();
  }
  removeAnimSplit(clipName: string): void {
    this.animSplits.update(s => { const c = { ...s }; delete c[clipName]; return c; });
    this.animPlayModes.update(m => { const c = { ...m }; delete c[clipName]; return c; });
    this.saveAnimSplits();
  }
  compX = signal(this.a3dInit.compX);
  compY = signal(this.a3dInit.compY);
  compZ = signal(this.a3dInit.compZ);
  compScale = signal(this.a3dInit.compScale);
  compRotX = signal(this.a3dInit.compRotX);
  compRotY = signal(this.a3dInit.compRotY);
  compRotZ = signal(this.a3dInit.compRotZ);
  boneMap = signal<Record<string, string>>(this.a3dInit.boneMap);

  // Computed pour bindings
  /** v1.0.177z — Offset XYZ de YAMZY (avant : seul Y était bindé). */
  yamzyOffsetArr = computed<[number, number, number]>(() => [this.yamzyX(), this.yamzyY(), this.yamzyZ()]);
  companionOffsetArr = computed<[number, number, number]>(() => [this.compX(), this.compY(), this.compZ()]);
  companionRotationArr = computed<[number, number, number]>(() => [this.compRotX(), this.compRotY(), this.compRotZ()]);

  /** v1.0.177k — Signal sauvegarde : badge qui flash dans l'UI à chaque save (visibilité). */
  lastA3dSaveTs = signal(0);
  /** v1.0.177n — Compteur de saves (diagnostic) : doit augmenter à chaque tweak. */
  private saveCount = 0;
  /** v1.0.177q — Test de santé du localStorage au démarrage. */
  private storageOk = (() => {
    try {
      const test = '__yamzy_storage_test__';
      localStorage.setItem(test, '1');
      const ok = localStorage.getItem(test) === '1';
      localStorage.removeItem(test);
      if (!ok) console.error('[avatar3d] ❌ localStorage NE FONCTIONNE PAS : valeur écrite mais relue différente');
      return ok;
    } catch (e) {
      console.error('[avatar3d] ❌ localStorage INDISPONIBLE (mode privé ?) :', e);
      return false;
    }
  })();
  saveAvatar3dEdit(): void {
    const data = {
      // v1.0.177z — Persist YAMZY X et Z aussi (avant : seul Y, donc drag X/Z perdu)
      yamzyX: this.yamzyX(), yamzyY: this.yamzyY(), yamzyZ: this.yamzyZ(),
      // v1.0.177ak — Scale GLB YAMZY persistant
      yamzyScale: this.yamzyScale(),
      compX: this.compX(), compY: this.compY(), compZ: this.compZ(),
      compScale: this.compScale(),
      compRotX: this.compRotX(), compRotY: this.compRotY(), compRotZ: this.compRotZ(),
      boneMap: this.boneMap(),
    };
    if (!this.storageOk) {
      console.warn('[avatar3d] ⚠ Save IMPOSSIBLE (localStorage KO) — valeurs uniquement en mémoire');
      return;
    }
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(this.AVATAR_3D_EDIT_KEY, serialized);
      // v1.0.177q — Vérification post-écriture pour détecter les saves silencieusement échoués
      const readback = localStorage.getItem(this.AVATAR_3D_EDIT_KEY);
      if (readback !== serialized) {
        console.error(`[avatar3d] ❌ Save VÉRIFICATION ÉCHOUÉE — écrit ${serialized.length} chars, relu ${readback?.length ?? 0}`);
      } else {
        this.saveCount++;
        if (this.saveCount <= 3 || this.saveCount % 10 === 0) {
          console.log(`[avatar3d] 💾 Save #${this.saveCount} OK → ${this.AVATAR_3D_EDIT_KEY}`, data);
        }
      }
    } catch (e) {
      console.error(`[avatar3d] ❌ Save FAILED :`, e);
    }
    this.lastA3dSaveTs.set(Date.now());
  }
  /** v1.0.177q — Force un save explicite (depuis console : `__yamzyForceSave()`). */
  forceSaveAvatar3d(): void {
    console.log('[avatar3d] 🔨 Force save manuel');
    this.saveAvatar3dEdit();
    console.log('[avatar3d] État localStorage après force-save :',
      localStorage.getItem(this.AVATAR_3D_EDIT_KEY));
  }
  /** v1.0.177n — Helper console : window.__yamzyDiag() affiche l'état complet. */
  private installDiag(): void {
    (window as any).__yamzyDiag = () => {
      const allKeys = Object.keys(localStorage).filter(k => k.includes('avatar3d'));
      const v4 = localStorage.getItem(this.AVATAR_3D_EDIT_KEY);
      console.log('─── 🩺 YAMZY Avatar3D Diagnostic ───');
      console.log('Clé active :', this.AVATAR_3D_EDIT_KEY);
      console.log('localStorage OK :', this.storageOk);
      console.log('Saves cumulés cette session :', this.saveCount);
      console.log('Toutes les clés avatar3d :', allKeys);
      console.log('Contenu localStorage v4 :', v4 ? JSON.parse(v4) : '(vide)');
      console.log('Signals en mémoire :', {
        yamzyY: this.yamzyY(),
        comp: [this.compX(), this.compY(), this.compZ()],
        scale: this.compScale(),
        rot: [this.compRotX(), this.compRotY(), this.compRotZ()],
        boneCount: Object.keys(this.boneMap()).length,
      });
      console.log('Pour reset complet, exécute :');
      console.log(`  Object.keys(localStorage).filter(k=>k.includes('avatar3d')).forEach(k=>localStorage.removeItem(k)); location.reload();`);
    };
    // v1.0.177q — Helper force-save accessible depuis la console
    (window as any).__yamzyForceSave = () => this.forceSaveAvatar3d();
    // v1.0.177q — Save automatique avant refresh / fermeture page (capture les changements en attente)
    window.addEventListener('beforeunload', () => {
      console.log('[avatar3d] 👋 beforeunload → save final');
      this.saveAvatar3dEdit();
    });
    // v1.0.177q — Heartbeat save toutes les 5s en safety net (uniquement si modal édition ouvert)
    setInterval(() => {
      if (this.avatar3dEditMode()) this.saveAvatar3dEdit();
    }, 5000);
  }

  copyAvatar3dConfig(): void {
    const cfg = JSON.stringify(this.loadAvatar3dEdit(), null, 2);
    navigator.clipboard?.writeText(cfg)
      .then(() => alert('✅ Config 3D copiée dans le presse-papier !\n\n💡 Colle dans le chat pour que je hardcode ces valeurs en defaults (tout le monde les recevra à la prochaine version).\n\n' + cfg))
      .catch(() => alert(cfg));
  }
  resetAvatar3dConfig(): void {
    if (!confirm('Reset config 3D ?')) return;
    // v1.0.177h — Reset = retour à la config par défaut validée user
    const d = this.AVATAR_3D_DEFAULTS;
    this.yamzyX.set(d.yamzyX); this.yamzyY.set(d.yamzyY); this.yamzyZ.set(d.yamzyZ);
    this.yamzyScale.set(d.yamzyScale);
    this.compX.set(d.compX); this.compY.set(d.compY); this.compZ.set(d.compZ);
    this.compScale.set(d.compScale);
    this.compRotX.set(d.compRotX); this.compRotY.set(d.compRotY); this.compRotZ.set(d.compRotZ);
    this.boneMap.set({ ...d.boneMap });
    this.saveAvatar3dEdit();
  }

  // Bone names connus (peuplés via console — l'utilisateur peut copier depuis console)
  // On garde ceux loggés au précédent run pour aider l'UI.
  yamzyBoneNames = signal<string[]>([]);
  wizzardBoneNames = signal<string[]>([]);
  /** Méthode appelable depuis la console pour peupler la liste : window.setAvatar3dBones(yamzy[], wizzard[]) */
  setBoneNames(yamzy: string[], wizzard: string[]): void {
    this.yamzyBoneNames.set(yamzy);
    this.wizzardBoneNames.set(wizzard);
    // v1.0.177o — Auto-map DÉSACTIVÉ : l'utilisateur crée son mapping manuellement
    // via l'éditeur de mapping bones (ajout/reset/suppression + isolation visuelle 3D).
  }
  updateBoneMapping(wizzardBone: string, yamzyBone: string): void {
    this.boneMap.update(m => ({ ...m, [wizzardBone]: yamzyBone }));
    this.saveAvatar3dEdit();
  }

  // ═══ v1.0.177o — ÉDITEUR DE MAPPING : CRUD + isolation 3D + stratégies de fusion ═══
  /** Index de ligne en cours d'édition (création de nouveau mapping). */
  editingNewMapping = signal<{ wizzard: string; yamzy: string } | null>(null);
  /** Mapping sélectionné pour ISOLATION dans le viewport 3D (cache les autres bones). */
  isolatedMapping = signal<{ wizzard: string; yamzy: string } | null>(null);
  /** Stratégie de fusion par mapping : 'fuse' | 'source' | 'destination'. */
  mergeStrategy = signal<Record<string, 'fuse' | 'source' | 'destination'>>({});

  /** v1.0.177o — Liste des wizzard bones NON mappés (pour info dans l'UI). */
  unmappedWizzardBones = computed(() => {
    const mapped = new Set(Object.keys(this.boneMap()));
    return this.wizzardBoneNames().filter(b => !mapped.has(b));
  });
  /** v1.0.177o — Liste des YAMZY bones non encore cible d'un mapping. */
  unmappedYamzyBones = computed(() => {
    const targets = new Set(Object.values(this.boneMap()));
    return this.yamzyBoneNames().filter(b => !targets.has(b));
  });

  /** v1.0.177o — Démarre la création d'un nouveau mapping (ligne vide en haut de la liste). */
  startAddMapping(): void {
    this.editingNewMapping.set({ wizzard: '', yamzy: '' });
  }
  /** Valide la ligne en cours d'édition et l'ajoute au boneMap. */
  commitNewMapping(): void {
    const draft = this.editingNewMapping();
    if (!draft || !draft.wizzard || !draft.yamzy) return;
    this.boneMap.update(m => ({ ...m, [draft.wizzard]: draft.yamzy }));
    this.editingNewMapping.set(null);
    this.saveAvatar3dEdit();
  }
  cancelNewMapping(): void { this.editingNewMapping.set(null); }
  updateNewMapping(field: 'wizzard' | 'yamzy', value: string): void {
    this.editingNewMapping.update(d => d ? { ...d, [field]: value } : null);
  }

  /** v1.0.177o — Supprime un mapping spécifique (l'animation de ce wizzard bone ne sera plus retargetée). */
  removeBoneMapping(wizzardBone: string): void {
    this.boneMap.update(m => {
      const copy = { ...m };
      delete copy[wizzardBone];
      return copy;
    });
    this.mergeStrategy.update(s => {
      const copy = { ...s };
      delete copy[wizzardBone];
      return copy;
    });
    // Si on isolait ce mapping, on quitte
    const iso = this.isolatedMapping();
    if (iso && iso.wizzard === wizzardBone) this.isolatedMapping.set(null);
    this.saveAvatar3dEdit();
  }
  /** v1.0.177o — Reset un mapping : restaure la valeur par défaut si elle existe, sinon supprime. */
  resetSingleMapping(wizzardBone: string): void {
    const defaultTarget = (this.AVATAR_3D_DEFAULTS.boneMap as Record<string, string>)[wizzardBone];
    if (defaultTarget) {
      this.boneMap.update(m => ({ ...m, [wizzardBone]: defaultTarget }));
    } else {
      this.removeBoneMapping(wizzardBone);
    }
    this.saveAvatar3dEdit();
  }
  /** v1.0.177o — Isole un mapping dans le viewport 3D : seuls ces 2 bones apparaissent. */
  isolateMapping(wizzardBone: string, yamzyBone: string): void {
    this.isolatedMapping.set({ wizzard: wizzardBone, yamzy: yamzyBone });
  }
  clearIsolation(): void { this.isolatedMapping.set(null); }

  /** v1.0.177o — Set la stratégie de fusion pour un mapping. */
  setMergeStrategy(wizzardBone: string, strategy: 'fuse' | 'source' | 'destination'): void {
    this.mergeStrategy.update(s => ({ ...s, [wizzardBone]: strategy }));
    this.saveAvatar3dEdit();
  }
  /** v1.0.177o — Récupère la stratégie pour un mapping (default = 'fuse'). */
  getMergeStrategy(wizzardBone: string): 'fuse' | 'source' | 'destination' {
    return this.mergeStrategy()[wizzardBone] || 'fuse';
  }

  /** v1.0.177i — Mots-clés de bone humanoïde → mots-clés YAMZY équivalents.
   *  Permet le matching fuzzy entre des conventions de naming différentes (wizzard vs YAMZY). */
  private readonly BONE_KEYWORDS: { wizard: string[]; yamzy: string[] }[] = [
    { wizard: ['root', 'hip', 'pelvis'],        yamzy: ['hip', 'root', 'pelvis'] },
    { wizard: ['spine', 'back', 'torso'],       yamzy: ['spine', 'back'] },
    { wizard: ['chest', 'upper'],                yamzy: ['chest', 'upperspine', 'spine1', 'spine2'] },
    { wizard: ['neck'],                          yamzy: ['neck'] },
    { wizard: ['head', 'skull'],                 yamzy: ['head', 'skull'] },
    { wizard: ['shoulder', 'clavicle'],          yamzy: ['shoulder', 'clavicle'] },
    { wizard: ['upperarm', 'arm'],               yamzy: ['upperarm', 'arm'] },
    { wizard: ['forearm', 'lowerarm', 'elbow'],  yamzy: ['forearm', 'lowerarm', 'elbow'] },
    { wizard: ['hand', 'wrist'],                 yamzy: ['hand', 'wrist'] },
    { wizard: ['finger', 'thumb', 'index', 'pinky'], yamzy: ['finger', 'thumb', 'index'] },
    { wizard: ['upperleg', 'thigh', 'leg'],      yamzy: ['upperleg', 'thigh'] },
    { wizard: ['lowerleg', 'shin', 'calf', 'knee'], yamzy: ['leg', 'lowerleg', 'shin', 'calf'] },
    { wizard: ['foot', 'ankle'],                 yamzy: ['foot', 'ankle'] },
    { wizard: ['toe'],                           yamzy: ['toe'] },
  ];

  /** v1.0.177i — Auto-mappe wizzard → YAMZY par mot-clé + side L/R (case-insensitive).
   *  Le résultat est appliqué au signal boneMap et sauvegardé. */
  autoMapBones(): void {
    const wizzard = this.wizzardBoneNames();
    const yamzy = this.yamzyBoneNames();
    if (!wizzard.length || !yamzy.length) {
      alert('⚠ Bones pas encore détectés. Ouvre le modal 🎭 et attends que les modèles chargent.');
      return;
    }
    const norm = (s: string) => s.toLowerCase()
      .replace(/_wizardarm/g, '').replace(/wizardarm_/g, '')
      .replace(/mixamorig[:_]/g, '')
      .replace(/[^a-z0-9]/g, '');
    const sideOf = (s: string): 'L' | 'R' | '' => {
      const lower = s.toLowerCase();
      if (/[._-]?l(eft)?\b/.test(lower) || /\bl[._-]?\d*$/.test(lower)) return 'L';
      if (/[._-]?r(ight)?\b/.test(lower) || /\br[._-]?\d*$/.test(lower)) return 'R';
      return '';
    };
    const yamzyNorm = yamzy.map(y => ({ orig: y, norm: norm(y), side: sideOf(y) }));
    const newMap: Record<string, string> = {};
    let mapped = 0;
    for (const w of wizzard) {
      const wn = norm(w);
      const wside = sideOf(w);
      // Trouve le keyword group qui matche le bone wizzard
      const group = this.BONE_KEYWORDS.find(g => g.wizard.some(kw => wn.includes(kw)));
      if (!group) continue;
      // Candidats YAMZY qui matchent un keyword YAMZY du groupe
      const candidates = yamzyNorm.filter(y => group.yamzy.some(kw => y.norm.includes(kw)));
      if (!candidates.length) continue;
      // Tie-break : préfère le même side L/R
      const best = candidates.find(c => c.side === wside && wside !== '')
                || candidates.find(c => c.side === '' || wside === '')
                || candidates[0];
      if (best) {
        newMap[w] = best.orig;
        mapped++;
      }
    }
    this.boneMap.set(newMap);
    this.saveAvatar3dEdit();
    const unmapped = wizzard.filter(w => !newMap[w]);
    console.log(`%c[autoMapBones] ✅ ${mapped}/${wizzard.length} mappés`, 'color:#70b944;font-weight:bold');
    console.log('%cWIZZARD bones complets :', 'color:#ff9933', wizzard);
    console.log('%cYAMZY bones complets :', 'color:#3399ff', yamzy);
    console.log('%cMapping résultat :', 'color:#70b944', newMap);
    if (unmapped.length) console.log('%cWIZZARD bones NON-mappés :', 'color:#de4f5f', unmapped);
    const detail = unmapped.length
      ? `\n\n${unmapped.length} bones wizzard non-mappés (chaîne IK custom probablement) :\n• ${unmapped.slice(0, 12).join('\n• ')}${unmapped.length > 12 ? `\n... +${unmapped.length - 12} autres` : ''}\n\nUtilise les dropdowns pour les mapper manuellement.`
      : '';
    alert(`✅ ${mapped} bones auto-mappés (sur ${wizzard.length} wizzard).${detail}\n\n💡 Tip : ouvre la console (F12) pour voir toutes les listes.`);
  }

  /** v1.0.177j — Copie les 2 listes de bones (wizzard + YAMZY) dans le presse-papier en JSON. */
  copyBoneLists(): void {
    const data = {
      wizzard: this.wizzardBoneNames(),
      yamzy: this.yamzyBoneNames(),
      currentMap: this.boneMap(),
    };
    const txt = JSON.stringify(data, null, 2);
    navigator.clipboard?.writeText(txt)
      .then(() => alert(`📋 Listes copiées (${data.wizzard.length} wizzard + ${data.yamzy.length} YAMZY).\n\nColle dans le chat pour un mapping custom complet.`))
      .catch(() => alert(txt));
  }

  // ═══ v1.0.177 — BLENDER-WAY EDIT MODAL : gizmo G/R/S + OrbitControls dans gros viewport ═══
  /** Mode du gizmo dans le fullscreen editor. Default = translate (touche G). */
  gizmoTransformMode = signal<'translate' | 'rotate' | 'scale'>('translate');
  setGizmoMode(m: 'translate' | 'rotate' | 'scale'): void { this.gizmoTransformMode.set(m); }
  /** v1.0.177g — Sélection explicite de l'objet : YAMZY ou Wizzard (companion). */
  gizmoTarget = signal<'yamzy' | 'companion'>('companion');
  setGizmoTarget(t: 'yamzy' | 'companion'): void { this.gizmoTarget.set(t); }
  /** v1.0.177g — Verrouille la cam (OrbitControls) pour éviter rotation accidentelle. */
  orbitLocked = signal(false);
  toggleOrbitLock(): void { this.orbitLocked.update(v => !v); }
  /** v1.0.177r — Active/désactive le retargeting de l'animation wizzard sur YAMZY.
   *  ⚠ Quand ON, l'animation force YAMZY dans la pose du wizzard à chaque frame
   *  (rotations bras/jambes overrides la pose naturelle). Désactive pour garder
   *  YAMZY dans sa pose, l'animation joue UNIQUEMENT sur le wizzard companion. */
  useRetargeting = signal(true);
  toggleRetargeting(): void { this.useRetargeting.update(v => !v); }
  /** v1.0.177 — Animation play/pause dans le viewport éditeur.
   *  Default = false (avatar figé en pose statique → on voit les bones, on positionne la tige). */
  animPlaying = signal(false);
  toggleAnim(): void { this.animPlaying.update(v => !v); }
  /** v1.0.177c — Mode "bone spheres" : affiche les sphères 3D cliquables pour mapper chaque bone wizzard → bone YAMZY visuellement. */
  boneSpheresMode = signal(false);
  toggleBoneSpheres(): void { this.boneSpheresMode.update(v => !v); }
  /** v1.0.177c — Handler : sphère wizzard a été draggée sur un bone YAMZY → enregistre le mapping. */
  onBoneAutoMapped(ev: { wizzardBone: string; yamzyBone: string }): void {
    this.boneMap.update(m => ({ ...m, [ev.wizzardBone]: ev.yamzyBone }));
    this.saveAvatar3dEdit();
  }
  /** v1.0.177d — Handler : YAMZY (le model principal) a été déplacé via le gizmo →
   *  on extrait Y pour aligner sur le sol et on sauvegarde. */
  onMainTransformed(t: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  }): void {
    // v1.0.177z — Persist X et Z aussi (avant : seul Y, donc drag YAMZY vers wizzard perdu au reload)
    this.yamzyX.set(+t.position.x.toFixed(3));
    this.yamzyY.set(+t.position.y.toFixed(3));
    this.yamzyZ.set(+t.position.z.toFixed(3));
    this.saveAvatar3dEdit();
  }
  /** Raccourcis clavier style Blender (G/R/S) — actifs seulement quand le modal fullscreen est ouvert. */
  @HostListener('window:keydown', ['$event'])
  onBlenderKey(ev: KeyboardEvent): void {
    // v1.0.177ai — Escape ferme aussi le mode placement YAMZY (avant : seulement mode bones)
    if (this.yamzyPlacementMode() && ev.key === 'Escape') {
      this.toggleYamzyPlacement(); ev.preventDefault(); return;
    }
    if (!this.avatar3dEditMode()) return;
    const tag = (ev.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (ev.key === 'g' || ev.key === 'G') { this.setGizmoMode('translate'); ev.preventDefault(); }
    else if (ev.key === 'r' || ev.key === 'R') { this.setGizmoMode('rotate'); ev.preventDefault(); }
    else if (ev.key === 's' || ev.key === 'S') { this.setGizmoMode('scale'); ev.preventDefault(); }
    else if (ev.key === 'Escape') { this.toggleAvatar3dEdit(); ev.preventDefault(); }
  }
  /** Handler : le gizmo a modifié le wizzard → push les valeurs dans les signals (sliders sync). */
  onCompanionTransformed(t: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  }): void {
    this.compX.set(+t.position.x.toFixed(3));
    this.compY.set(+t.position.y.toFixed(3));
    this.compZ.set(+t.position.z.toFixed(3));
    this.compRotX.set(Math.round(t.rotation.x));
    this.compRotY.set(Math.round(t.rotation.y));
    this.compRotZ.set(Math.round(t.rotation.z));
    this.compScale.set(+t.scale.toFixed(3));
    this.saveAvatar3dEdit();
  }

  private dragTarget: 'fab' | 'yc' | null = null;
  private dragStart = { x: 0, y: 0, origLeft: 0, origBottom: 0 };

  startDrag(target: 'fab' | 'yc', ev: MouseEvent): void {
    if (!this.positionMode()) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.dragTarget = target;
    this.dragStart = {
      x: ev.clientX,
      y: ev.clientY,
      origLeft: target === 'fab' ? this.fabLeft() : this.ycLeft(),
      origBottom: target === 'fab' ? this.fabBottom() : this.ycBottom(),
    };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }
  private onDragMove = (ev: MouseEvent) => {
    if (!this.dragTarget) return;
    const dx = ev.clientX - this.dragStart.x;
    const dy = ev.clientY - this.dragStart.y;
    const newLeft = Math.max(0, this.dragStart.origLeft + dx);
    const newBottom = Math.max(0, this.dragStart.origBottom - dy); // axe Y inversé
    if (this.dragTarget === 'fab') {
      this.fabLeft.set(Math.round(newLeft));
      this.fabBottom.set(Math.round(newBottom));
    } else {
      this.ycLeft.set(Math.round(newLeft));
      this.ycBottom.set(Math.round(newBottom));
    }
  };
  private onDragEnd = () => {
    // v1.0.177ai — Persist fab pos quand le drag se termine (avant : valeurs perdues au reload)
    if (this.dragTarget === 'fab') this.saveFabPos();
    this.dragTarget = null;
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  };

  // v1.0.93 — Cards-wrap defaults updated from user-tuned values
  cardsBottom = signal(68);   // px from bottom of en-cours
  cardsLeft = signal(300);    // px from left
  cardsRight = signal(300);   // px from right
  cardsHeight = signal(160);  // px height of the row
  cardsMiniW = signal(130);   // px width of each mini card
  cardsMiniH = signal(182);   // px height of each mini card
  cardsBigW = signal(162);    // px width of big card
  cardsBigH = signal(392);    // px height of big card
  cardsGap = signal(40);      // px gap between cards

  async copyYamzyPositions(): Promise<void> {
    // v1.0.92 — Copie UNIQUEMENT les coords des cartes (YAMZY/Carousel retires).
    const css =
      `.wt-ps-cards-wrap { bottom: ${this.cardsBottom()}px; left: ${this.cardsLeft()}px; right: ${this.cardsRight()}px; height: ${this.cardsHeight()}px; gap: ${this.cardsGap()}px; }\n` +
      `.wt-ps-mini-card.wt-ps-mini-float { width: ${this.cardsMiniW()}px; height: ${this.cardsMiniH()}px; }\n` +
      `.wt-ps-card-display { width: ${this.cardsBigW()}px; height: ${this.cardsBigH()}px; }`;
    try {
      await navigator.clipboard.writeText(css);
      await this.dialog.alert({
        title: '📋 Coordonnées copiées',
        message: 'Le CSS est dans ton presse-papier. Colle-le dans le chat avec Claude pour qu\'il fixe la position.',
        kind: 'success',
        details: [
          { label: 'YAMZY left',       value: this.fabLeft() + 'px' },
          { label: 'YAMZY bottom',     value: this.fabBottom() + 'px' },
          { label: 'YAMZY size',       value: this.fabSize() + 'px' },
          { label: 'Carousel left',    value: this.ycLeft() + 'px' },
          { label: 'Carousel bottom',  value: this.ycBottom() + 'px' },
          { label: 'Carousel width',   value: this.ycWidth() + 'px' },
        ],
      });
    } catch (e) {
      // Fallback : afficher quand même les coords si le clipboard fail
      await this.dialog.alert({
        title: 'Coordonnées (copie manuelle)',
        message: css,
        kind: 'info'
      });
    }
  }

  resetYamzyPositions(): void {
    this.fabLeft.set(100);
    this.fabBottom.set(20);
    this.fabSize.set(320);
    this.ycLeft.set(380);
    this.ycBottom.set(50);
    this.ycWidth.set(360);
    // v1.0.93 — reset cards (defaults user-tuned)
    this.cardsBottom.set(68);
    this.cardsLeft.set(300);
    this.cardsRight.set(300);
    this.cardsHeight.set(160);
    this.cardsMiniW.set(130);
    this.cardsMiniH.set(182);
    this.cardsBigW.set(162);
    this.cardsBigH.set(392);
    this.cardsGap.set(40);
  }

  // ═══ YAMZY CAROUSEL v1.0.23 — Carrousel 3D vertical à côté de l'avatar ═══
  // Inspiré du Team Carousel codepen : center/up-1/up-2/down-1/down-2/hidden
  // Affiche les "messages" que Yamzy lance : événements, alertes, tickets prio
  yamzyCarouselIndex = signal(0);

  // v1.0.144 — Le YAMZY carousel ne sert PLUS de menu de navigation (la sidebar gauche
  // fait ça maintenant). Il sert désormais à afficher des NOTIFICATIONS et MESSAGES :
  // - rappels de meetings imminents (sprint planning, daily, review, retro)
  // - alertes (tickets en retard, sprint over capacity, risks score elevé)
  // - tips contextuels selon la page courante
  // Vide par défaut → on populate via signals reminders/events plus tard.
  homeMenuCards: any[] = [];

  /** Helper : icone selon le type d'event Scrum. */
  eventIcon(type?: string): string {
    if (!type) return '📅';
    const t = type.toUpperCase();
    if (t.includes('DAILY')) return '🗣';
    if (t.includes('PLANNING')) return '🎯';
    if (t.includes('REVIEW')) return '🔍';
    if (t.includes('RETRO')) return '🔄';
    return '📅';
  }

  yamzyCarouselCards = computed<any[]>(() => {
    // v1.0.144 — Cards = notifications/messages contextuels.
    // Sources : meeting reminders + alertes + tips Yamzy.
    const cards: any[] = [];
    const pageLabel = this.featuredPageLabel() || this.activePageLabel() || 'Studio';
    const pageId = this.featuredPageId() || this.activePage();

    // === TIP page (toujours présent) ===
    cards.push({
      kind: 'TIP',
      title: 'Pouvoirs de cette page',
      subtitle: 'Clique pour découvrir le guide Scrum',
      meta: pageLabel,
      icon: '🃏',
      color: '#9d8ad6',  // v1.0.148 — violet clair (était #420285 trop sombre)
      action: { type: 'show-info', pageId },
    });

    // === RAPPELS meetings imminents (events à venir aujourd'hui) ===
    const upcoming = this.upcomingEventsList?.() || [];
    for (const ev of upcoming.slice(0, 3)) {
      const evTime = ev?.scheduledStart ? new Date(ev.scheduledStart) : null;
      const hhmm = evTime ? `${String(evTime.getHours()).padStart(2,'0')}:${String(evTime.getMinutes()).padStart(2,'0')}` : '';
      cards.push({
        kind: 'RAPPEL',
        title: ev?.title || 'Cérémonie',
        subtitle: hhmm ? `Aujourd'hui à ${hhmm}` : 'À venir',
        meta: ev?.type || 'Sprint event',
        icon: this.eventIcon(ev?.type),
        color: '#4696b9',
        action: { type: 'event', id: ev?.id },
      });
    }

    // === ALERTES HIGH severity (risques, missed, tickets en retard) ===
    const reminders: any = this.remindersData?.();
    const highAlerts = reminders?.items?.filter?.((r: any) => r.severity === 'HIGH') || [];
    for (const a of highAlerts.slice(0, 3)) {
      cards.push({
        kind: 'ALERTE',
        title: a?.title || 'Alerte',
        subtitle: a?.message || a?.summary || '',
        meta: a?.category || 'High',
        icon: '⚠',
        color: '#de4f5f',
        action: { type: 'page', page: a?.linkedPage || 'risks' },
      });
    }

    return cards;
  });

  // ═══ v1.0.177dv — MOTIFS ANIMÉS PAR CARTE ═══
  // Chaque carte est associée à un MOTIF (effet visuel) qui "déborde" sur le header
  // sous forme d'animation (particules, flux, rayons…) — comme si l'élément
  // marquant de la carte sortait de la carte pour habiller le header en background.
  //
  // Mapping persistant en localStorage sous 'wt_cards_motifs'. Liste hardcodée des
  // motifs disponibles (10 effets), chaque carte choisit le sien via dropdown.
  readonly MOTIFS_LIST: Array<{ id: string; label: string; emoji: string; description: string }> = [
    { id: 'none',      label: 'Aucun',           emoji: '∅',  description: 'Pas d\'effet — header neutre' },
    { id: 'fire',      label: 'Feu',             emoji: '🔥', description: 'Flammes ascendantes orange/rouge' },
    { id: 'water',     label: 'Eau',             emoji: '💧', description: 'Gouttes qui tombent + ondulations bleues' },
    { id: 'lightning', label: 'Éclairs',         emoji: '⚡', description: 'Décharges blanches zigzag sur fond sombre' },
    { id: 'bees',      label: 'Abeilles',        emoji: '🐝', description: 'Essaim de points jaunes en orbite' },
    { id: 'energy',    label: 'Énergie verte',   emoji: '✨', description: 'Trail vert/aurore qui sort du livre' },
    { id: 'sparks',    label: 'Étincelles',      emoji: '💫', description: 'Étincelles dorées qui montent' },
    { id: 'smoke',     label: 'Fumée',           emoji: '💨', description: 'Volutes grises qui s\'élèvent' },
    { id: 'leaves',    label: 'Feuilles',        emoji: '🍃', description: 'Feuilles qui tombent en dérive' },
    { id: 'rays',      label: 'Rayons',          emoji: '🌟', description: 'Rayons de lumière qui pulsent' },
    { id: 'cosmic',    label: 'Cosmique',        emoji: '🌌', description: 'Étoiles + nébuleuse violette' },
    { id: 'petals',    label: 'Pétales',         emoji: '🌸', description: 'Pétales roses qui flottent' },
  ];
  /** v1.0.177dw — Mapping AUTOMATIQUE par défaut : chaque carte est analysée par son nom
   * pour deviner le motif visuel marquant (élément central de l'illustration).
   * L'utilisateur peut override via le dropdown dans le modal mapping.
   * Logique d'identification : mot-clé dans le nom → motif correspondant. */
  static readonly DEFAULT_CARDS_MOTIFS: Record<string, string> = {
    // FEU 🔥 : tout ce qui contient Fire, Flame, Blood, Fireball
    '1_Fireball':         'fire',
    '20_Element_Fire':    'fire',
    '26_BloodRing':       'fire',
    // ÉCLAIRS ⚡ : Lightning
    '8_LightningWizard':  'lightning',
    '21_Element_Lightning':'lightning',
    // EAU 💧 : Water, Sea, Ocean, Dragon-water
    '13_SeaMonster':      'water',
    '18_WaterDragon':     'water',
    '19_OceanTreasure':   'water',
    '23_Element_Water':   'water',
    // ABEILLES 🐝 : Beehive, Polinization
    '10_Beehive':         'bees',
    '11_Polinization':    'bees',
    // ÉNERGIE VERTE ✨ : Book (livre qui émet du courant comme image 4), Wizard, Mimic, Hypnosis
    '27_Book':            'energy',
    '30_Wizard':          'energy',
    '12_Mimic':           'energy',
    '9_Hypnosis':         'energy',
    // PÉTALES 🌸 : Rebirth (renaissance fleurale)
    '17_Rebirth':         'petals',
    // FEUILLES 🍃 : Earth (terre)
    '25_Element_Earth':   'leaves',
    // FUMÉE 💨 : Air, StinkTrap, Mushrooms, Steal
    '22_Element_Air':     'smoke',
    '7_StinkTrap':        'smoke',
    '2_TrenchcoatMushrooms':'smoke',
    '5_Steal':            'smoke',
    // COSMIC 🌌 : Dark, Cult, Block (ténèbres)
    '24_Element_Dark':    'cosmic',
    '15_Cult':            'cosmic',
    '29_Block':           'cosmic',
    // RAYONS 🌟 : King (couronne), Monk (divin), Belltowers (lumière)
    '6_King':             'rays',
    '3_Monk':             'rays',
    '16_Belltowers':      'rays',
    // ÉTINCELLES 💫 : Coin (or), Market, RollDice
    '14_Coin':            'sparks',
    '4_Market':           'sparks',
    '28_RollDice':        'sparks',
    // (CardBack n'a pas besoin de motif spécifique)
    '0_CardBack':         'none',
  };

  private readonly CARDS_MOTIFS_KEY = 'wt_cards_motifs';
  cardsMotifsMap = signal<Record<string, string>>(this.loadCardsMotifsMap());
  private loadCardsMotifsMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.CARDS_MOTIFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  private saveCardsMotifsMap(map: Record<string, string>): void {
    try { localStorage.setItem(this.CARDS_MOTIFS_KEY, JSON.stringify(map)); } catch {}
  }
  /** Retourne le motif d'une carte : 1) override localStorage si défini, 2) défaut hardcodé, 3) 'none'. */
  getCardMotif(card: string): string {
    return this.cardsMotifsMap()[card] || WarTableComponent.DEFAULT_CARDS_MOTIFS[card] || 'none';
  }
  setCardMotif(card: string, motifId: string): void {
    this.cardsMotifsMap.update(m => {
      const next = { ...m, [card]: motifId };
      this.saveCardsMotifsMap(next);
      return next;
    });
  }
  /** Motif de la carte EFFECTIVEMENT affichée (suit le carrousel via effectiveDisplayedCard). */
  activeCardMotif = computed<string>(() => {
    const card = this.effectiveDisplayedCard();
    if (!card) return 'none';
    return this.getCardMotif(card);
  });
  /** v1.0.177dx — Icônes SVG iconographiques inspirées des motifs des cartes.
   * Chaque template prend 3 couleurs (c1=principale, c2=accent, c3=fond/contraste)
   * et génère un SVG inline (64×64). Utilisable comme background-image data:URI. */
  static readonly MOTIF_SVG_TEMPLATES: Record<string, (c1: string, c2: string, c3: string) => string> = {
    // 🔥 FIRE — flamme stylisée
    fire: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><radialGradient id='g' cx='50%' cy='80%'><stop offset='0%' stop-color='${c2}'/><stop offset='60%' stop-color='${c1}'/><stop offset='100%' stop-color='${c3}'/></radialGradient></defs><path d='M32 6 C24 18 22 28 26 36 C20 32 18 26 20 20 C12 28 10 40 16 50 C22 60 42 60 48 50 C54 40 52 28 44 20 C46 28 44 34 38 36 C42 26 40 16 32 6 Z' fill='url(#g)' stroke='${c3}' stroke-width='1.2'/></svg>`,
    // 💧 WATER — goutte
    water: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><radialGradient id='g' cx='40%' cy='40%'><stop offset='0%' stop-color='${c3}'/><stop offset='50%' stop-color='${c2}'/><stop offset='100%' stop-color='${c1}'/></radialGradient></defs><path d='M32 6 C20 26 14 38 14 46 C14 56 22 60 32 60 C42 60 50 56 50 46 C50 38 44 26 32 6 Z' fill='url(#g)' stroke='${c1}' stroke-width='1.2'/><circle cx='26' cy='32' r='4' fill='${c3}' opacity='0.7'/></svg>`,
    // ⚡ LIGHTNING — éclair zigzag
    lightning: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='${c2}'/><stop offset='100%' stop-color='${c1}'/></linearGradient></defs><circle cx='32' cy='32' r='30' fill='${c3}' opacity='0.25'/><polygon points='34,4 14,36 28,36 22,60 50,26 36,26 42,4' fill='url(#g)' stroke='${c1}' stroke-width='1.2'/></svg>`,
    // 🐝 BEES — abeille stylisée
    bees: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><ellipse cx='32' cy='38' rx='18' ry='14' fill='${c1}' stroke='${c3}' stroke-width='1.5'/><path d='M22 32 L42 32 M22 38 L42 38 M22 44 L42 44' stroke='${c3}' stroke-width='3'/><ellipse cx='22' cy='28' rx='8' ry='6' fill='${c2}' opacity='0.7' stroke='${c3}' stroke-width='0.6'/><ellipse cx='42' cy='28' rx='8' ry='6' fill='${c2}' opacity='0.7' stroke='${c3}' stroke-width='0.6'/><circle cx='28' cy='36' r='1.5' fill='${c3}'/></svg>`,
    // ✨ ENERGY — courant vert sortant
    energy: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><radialGradient id='g' cx='50%' cy='50%'><stop offset='0%' stop-color='${c3}'/><stop offset='50%' stop-color='${c2}'/><stop offset='100%' stop-color='${c1}'/></radialGradient></defs><path d='M16 32 Q24 20 32 32 Q40 44 48 32 M14 38 Q24 28 32 38 Q40 48 50 38 M16 26 Q24 16 32 26 Q40 36 48 26' stroke='url(#g)' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='32' cy='32' r='4' fill='${c3}'/></svg>`,
    // 💫 SPARKS — étincelles
    sparks: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='28' fill='${c3}' opacity='0.15'/><g fill='${c1}'><polygon points='32,8 34,28 32,30 30,28'/><polygon points='32,56 30,36 32,34 34,36'/><polygon points='8,32 28,30 30,32 28,34'/><polygon points='56,32 36,34 34,32 36,30'/><polygon points='15,15 28,28 30,30 28,28' transform='rotate(45 32 32)'/><polygon points='49,49 36,36 34,34 36,36' transform='rotate(45 32 32)'/></g><circle cx='32' cy='32' r='5' fill='${c2}'/></svg>`,
    // 💨 SMOKE — volutes
    smoke: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><radialGradient id='g' cx='50%' cy='80%'><stop offset='0%' stop-color='${c3}' stop-opacity='0.8'/><stop offset='60%' stop-color='${c1}' stop-opacity='0.5'/><stop offset='100%' stop-color='${c2}' stop-opacity='0'/></radialGradient></defs><circle cx='28' cy='48' r='10' fill='url(#g)'/><circle cx='40' cy='38' r='12' fill='url(#g)'/><circle cx='30' cy='28' r='10' fill='url(#g)'/><circle cx='40' cy='18' r='8' fill='url(#g)'/></svg>`,
    // 🍃 LEAVES — feuille
    leaves: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='${c2}'/><stop offset='100%' stop-color='${c1}'/></linearGradient></defs><path d='M12 52 Q12 20 44 12 Q52 20 52 28 Q40 52 12 52 Z' fill='url(#g)' stroke='${c3}' stroke-width='1.2'/><path d='M16 48 Q28 36 44 16' stroke='${c3}' stroke-width='1.5' fill='none' opacity='0.6'/></svg>`,
    // 🌟 RAYS — soleil rayonnant
    rays: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='${c1}' opacity='0.7'><polygon points='32,4 34,20 30,20'/><polygon points='32,60 30,44 34,44'/><polygon points='4,32 20,30 20,34'/><polygon points='60,32 44,34 44,30'/><polygon points='12,12 24,22 22,24'/><polygon points='52,52 40,42 42,40'/><polygon points='52,12 42,22 40,24' transform='translate(0)'/><polygon points='12,52 22,42 24,40'/></g><circle cx='32' cy='32' r='14' fill='${c2}' stroke='${c3}' stroke-width='1.5'/></svg>`,
    // 🌌 COSMIC — étoiles et nébuleuse
    cosmic: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><radialGradient id='g'><stop offset='0%' stop-color='${c2}'/><stop offset='100%' stop-color='${c1}'/></radialGradient></defs><circle cx='32' cy='32' r='30' fill='url(#g)'/><g fill='${c3}'><circle cx='14' cy='18' r='1.5'/><circle cx='48' cy='14' r='1'/><circle cx='52' cy='42' r='1.5'/><circle cx='18' cy='48' r='1'/><circle cx='32' cy='20' r='1.2'/><circle cx='44' cy='30' r='1'/><circle cx='22' cy='38' r='1.2'/><polygon points='38,46 39,49 42,50 39,51 38,54 37,51 34,50 37,49'/></g></svg>`,
    // 🌸 PETALS — fleur stylisée
    petals: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='${c1}' stroke='${c3}' stroke-width='0.8'><ellipse cx='32' cy='14' rx='8' ry='12'/><ellipse cx='50' cy='32' rx='12' ry='8'/><ellipse cx='32' cy='50' rx='8' ry='12'/><ellipse cx='14' cy='32' rx='12' ry='8'/></g><circle cx='32' cy='32' r='8' fill='${c2}' stroke='${c3}' stroke-width='1'/></svg>`,
    // ∅ NONE — losange neutre
    none: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='${c1}'/><stop offset='50%' stop-color='${c2}'/><stop offset='100%' stop-color='${c3}'/></linearGradient></defs><polygon points='32,8 56,32 32,56 8,32' fill='url(#g)' stroke='${c3}' stroke-width='1.2'/></svg>`,
  };

  /** v1.0.177dy — SVG ANIMÉS par motif : version full effect (particules animées via @keyframes embarqués).
   *  Chaque template prend les 3 couleurs et renvoie un SVG inline avec <style> + animations.
   *  Utilisable comme background-image data URI ou inline. Reproduit visuellement l'effet du header. */
  static readonly MOTIF_ANIMATED_SVG: Record<string, (c1: string, c2: string, c3: string) => string> = {
    fire: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.fp{fill:url(#fg);filter:blur(4px);animation:rise 2.4s ease-in-out infinite}@keyframes rise{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-25px) scale(1.1)}}.f1{animation-delay:0s}.f2{animation-delay:.3s}.f3{animation-delay:.6s}.f4{animation-delay:.15s}</style><radialGradient id='fg' cx='50%' cy='100%'><stop offset='0%' stop-color='${c2}'/><stop offset='60%' stop-color='${c1}' stop-opacity='.85'/><stop offset='100%' stop-color='${c3}' stop-opacity='0'/></radialGradient></defs><rect width='200' height='200' fill='${c3}' opacity='.3'/><ellipse class='fp f1' cx='50' cy='180' rx='25' ry='40'/><ellipse class='fp f2' cx='100' cy='180' rx='30' ry='50'/><ellipse class='fp f3' cx='150' cy='180' rx='25' ry='40'/><ellipse class='fp f4' cx='75' cy='180' rx='20' ry='35'/></svg>`,

    water: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.d{fill:${c2};animation:drop 2s linear infinite}@keyframes drop{0%{transform:translateY(-30px);opacity:0}10%{opacity:1}100%{transform:translateY(220px);opacity:.3}}.d1{animation-delay:0s}.d2{animation-delay:.4s}.d3{animation-delay:.8s}.d4{animation-delay:.2s}.d5{animation-delay:.6s}.wave{fill:${c1};opacity:.3;animation:wave 3s ease-in-out infinite}@keyframes wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}</style></defs><rect width='200' height='200' fill='${c1}' opacity='.2'/><circle class='d d1' cx='40' cy='0' r='5'/><circle class='d d2' cx='80' cy='0' r='4'/><circle class='d d3' cx='120' cy='0' r='6'/><circle class='d d4' cx='160' cy='0' r='4'/><circle class='d d5' cx='100' cy='0' r='5'/><path class='wave' d='M0 160 Q50 145 100 160 T200 160 L200 200 L0 200 Z'/><path class='wave' d='M0 175 Q50 165 100 175 T200 175 L200 200 L0 200 Z' style='animation-delay:.5s;fill:${c3};opacity:.4'/></svg>`,

    lightning: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.bg{fill:${c3};opacity:.4}.b{fill:${c2};filter:drop-shadow(0 0 6px ${c2});animation:flash 1.4s steps(1) infinite}@keyframes flash{0%,93%,100%{opacity:0}94%,96%{opacity:1}97%{opacity:0}98%{opacity:.7}}.b2{animation-delay:.5s}.b3{animation-delay:.9s}</style></defs><rect class='bg' width='200' height='200'/><polygon class='b' points='80,10 50,90 80,90 40,170 130,80 90,80 130,10'/><polygon class='b b2' points='160,5 140,60 165,60 130,140 180,55 155,55 180,5'/><polygon class='b b3' points='30,30 20,80 35,80 15,150 50,75 35,75 50,30'/></svg>`,

    bees: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.bee{animation:orbit 6s linear infinite}.bee2{animation:orbit 6s linear infinite reverse;animation-delay:-2s}.bee3{animation:orbit 6s linear infinite;animation-delay:-4s}@keyframes orbit{0%{transform:rotate(0deg) translateX(60px) rotate(0deg)}100%{transform:rotate(360deg) translateX(60px) rotate(-360deg)}}.body{fill:${c1};stroke:${c3};stroke-width:1.5}.stripe{stroke:${c3};stroke-width:2}.wing{fill:${c2};opacity:.7;animation:flap .2s ease-in-out infinite alternate}@keyframes flap{from{transform:scaleY(.6)}to{transform:scaleY(1)}}</style></defs><rect width='200' height='200' fill='${c3}' opacity='.2'/><g transform='translate(100 100)'><g class='bee'><ellipse class='body' cx='0' cy='0' rx='10' ry='7'/><line class='stripe' x1='-5' y1='-5' x2='-5' y2='5'/><line class='stripe' x1='0' y1='-6' x2='0' y2='6'/><line class='stripe' x1='5' y1='-5' x2='5' y2='5'/><ellipse class='wing' cx='-4' cy='-6' rx='5' ry='3'/><ellipse class='wing' cx='4' cy='-6' rx='5' ry='3'/></g><g class='bee2'><ellipse class='body' cx='0' cy='0' rx='8' ry='6'/><line class='stripe' x1='-4' y1='-4' x2='-4' y2='4'/><line class='stripe' x1='4' y1='-4' x2='4' y2='4'/></g><g class='bee3'><ellipse class='body' cx='0' cy='0' rx='9' ry='6'/><line class='stripe' x1='0' y1='-5' x2='0' y2='5'/></g></g></svg>`,

    energy: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.flow{fill:none;stroke-width:5;stroke-linecap:round;filter:blur(2px);animation:pulse 2.2s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.5;transform:translateY(0)}50%{opacity:1;transform:translateY(-10px)}}.f1{stroke:${c1};animation-delay:0s}.f2{stroke:${c2};animation-delay:.4s}.f3{stroke:${c3};animation-delay:.8s;opacity:.7}</style></defs><rect width='200' height='200' fill='${c1}' opacity='.15'/><path class='flow f1' d='M20 140 Q60 80 100 140 Q140 200 180 140'/><path class='flow f2' d='M20 100 Q60 40 100 100 Q140 160 180 100'/><path class='flow f3' d='M20 60 Q60 10 100 60 Q140 110 180 60'/></svg>`,

    sparks: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.sp{fill:${c1};filter:drop-shadow(0 0 4px ${c1});animation:fly 2.5s linear infinite}@keyframes fly{0%{transform:translateY(0) scale(0);opacity:0}10%{opacity:1;transform:scale(1)}90%{opacity:1}100%{transform:translateY(-220px) scale(0);opacity:0}}.s1{animation-delay:0s}.s2{animation-delay:.5s;fill:${c2}}.s3{animation-delay:1s}.s4{animation-delay:1.5s;fill:${c2}}.s5{animation-delay:2s}.s6{animation-delay:.3s;fill:${c3}}</style></defs><rect width='200' height='200' fill='${c3}' opacity='.2'/><circle class='sp s1' cx='30' cy='200' r='3'/><circle class='sp s2' cx='70' cy='200' r='4'/><circle class='sp s3' cx='110' cy='200' r='3'/><circle class='sp s4' cx='150' cy='200' r='4'/><circle class='sp s5' cx='180' cy='200' r='3'/><circle class='sp s6' cx='100' cy='200' r='5'/></svg>`,

    smoke: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.pc{fill:url(#sg);animation:rise 4s ease-in-out infinite}@keyframes rise{0%,100%{transform:translateY(0) scale(1);opacity:.3}50%{transform:translateY(-40px) scale(1.3);opacity:.7}}.p1{animation-delay:0s}.p2{animation-delay:1s}.p3{animation-delay:2s}</style><radialGradient id='sg'><stop offset='0%' stop-color='${c3}' stop-opacity='.7'/><stop offset='100%' stop-color='${c1}' stop-opacity='0'/></radialGradient></defs><rect width='200' height='200' fill='${c2}' opacity='.15'/><circle class='pc p1' cx='60' cy='180' r='40'/><circle class='pc p2' cx='100' cy='190' r='50'/><circle class='pc p3' cx='140' cy='180' r='42'/></svg>`,

    leaves: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.lf{fill:${c2};stroke:${c3};stroke-width:.8;animation:fall 5s linear infinite}@keyframes fall{0%{transform:translateY(-20px) rotate(0deg);opacity:0}10%{opacity:1}100%{transform:translateY(220px) rotate(540deg);opacity:.4}}.l1{animation-delay:0s}.l2{animation-delay:1s;fill:${c1}}.l3{animation-delay:2s}.l4{animation-delay:3s;fill:${c1}}.l5{animation-delay:4s}</style></defs><rect width='200' height='200' fill='${c1}' opacity='.15'/><ellipse class='lf l1' cx='30' cy='0' rx='10' ry='6' transform='rotate(20 30 0)'/><ellipse class='lf l2' cx='70' cy='0' rx='12' ry='7'/><ellipse class='lf l3' cx='110' cy='0' rx='10' ry='6'/><ellipse class='lf l4' cx='150' cy='0' rx='11' ry='7'/><ellipse class='lf l5' cx='180' cy='0' rx='10' ry='6'/></svg>`,

    rays: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.sun{fill:${c2};stroke:${c3};stroke-width:1.5;animation:pulse 3s ease-in-out infinite}@keyframes pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.1);opacity:1}}.ray{fill:${c1};opacity:.6;animation:rotate 12s linear infinite;transform-origin:100px 100px}@keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style></defs><rect width='200' height='200' fill='${c3}' opacity='.2'/><g class='ray'><polygon points='100,10 105,90 95,90'/><polygon points='100,190 95,110 105,110'/><polygon points='10,100 90,95 90,105'/><polygon points='190,100 110,105 110,95'/><polygon points='30,30 95,90 90,95'/><polygon points='170,170 105,110 110,105'/><polygon points='170,30 110,95 105,90'/><polygon points='30,170 90,105 95,110'/></g><circle class='sun' cx='100' cy='100' r='30'/></svg>`,

    cosmic: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.neb{fill:url(#cg);animation:breathe 6s ease-in-out infinite}@keyframes breathe{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:.85}}.star{fill:${c3};animation:twinkle 2s ease-in-out infinite}@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:1}}.s1{animation-delay:0s}.s2{animation-delay:.5s}.s3{animation-delay:1s}.s4{animation-delay:1.5s}.s5{animation-delay:.3s}.s6{animation-delay:.8s}</style><radialGradient id='cg'><stop offset='0%' stop-color='${c2}'/><stop offset='100%' stop-color='${c1}' stop-opacity='0'/></radialGradient></defs><rect width='200' height='200' fill='${c1}'/><circle class='neb' cx='100' cy='100' r='80'/><circle class='star s1' cx='40' cy='30' r='1.5'/><circle class='star s2' cx='160' cy='40' r='2'/><circle class='star s3' cx='30' cy='150' r='1.5'/><circle class='star s4' cx='170' cy='160' r='2'/><circle class='star s5' cx='100' cy='30' r='1.2'/><circle class='star s6' cx='150' cy='100' r='1.5'/></svg>`,

    petals: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><style>.pt{fill:${c1};stroke:${c3};stroke-width:.6;filter:drop-shadow(0 0 3px ${c1});animation:swirl 6s linear infinite}@keyframes swirl{0%{transform:translateY(-20px) translateX(0) rotate(0deg);opacity:0}10%{opacity:1}100%{transform:translateY(220px) translateX(20px) rotate(540deg);opacity:.3}}.p1{animation-delay:0s}.p2{animation-delay:1.2s;fill:${c2}}.p3{animation-delay:2.4s}.p4{animation-delay:3.6s;fill:${c2}}</style></defs><rect width='200' height='200' fill='${c1}' opacity='.12'/><ellipse class='pt p1' cx='40' cy='0' rx='8' ry='5' transform='rotate(20 40 0)'/><ellipse class='pt p2' cx='90' cy='0' rx='9' ry='6'/><ellipse class='pt p3' cx='130' cy='0' rx='8' ry='5'/><ellipse class='pt p4' cx='170' cy='0' rx='9' ry='6'/></svg>`,

    none: (c1, c2, c3) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='ng' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='${c1}'/><stop offset='100%' stop-color='${c3}'/></linearGradient></defs><rect width='200' height='200' fill='url(#ng)' opacity='.3'/></svg>`,
  };

  /** Génère le SVG animé d'un motif pour les 3 couleurs d'une carte. */
  getMotifAnimatedSvg(card: string): string {
    const motif = this.getCardMotif(card);
    const c1 = this.getCardColor3(card, 0) || '#d99a51';
    const c2 = this.getCardColor3(card, 1) || '#c25d8d';
    const c3 = this.getCardColor3(card, 2) || '#6647bf';
    const tpl = WarTableComponent.MOTIF_ANIMATED_SVG[motif] || WarTableComponent.MOTIF_ANIMATED_SVG['none'];
    return tpl(c1, c2, c3);
  }
  /** Data URI prêt pour [src] ou background-image. */
  getMotifAnimatedSvgDataUri(card: string): string {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(this.getMotifAnimatedSvg(card));
  }

  /** v1.0.177dx — Génère un SVG iconique pour une carte, basé sur son motif + ses 3 couleurs.
   *  Retourne le SVG brut (utilisable comme src="data:image/svg+xml;..." après encodage URL). */
  getCardIconSvg(card: string): string {
    const motif = this.getCardMotif(card);
    const c1 = this.getCardColor3(card, 0) || '#d99a51';
    const c2 = this.getCardColor3(card, 1) || '#c25d8d';
    const c3 = this.getCardColor3(card, 2) || '#6647bf';
    const tpl = WarTableComponent.MOTIF_SVG_TEMPLATES[motif] || WarTableComponent.MOTIF_SVG_TEMPLATES['none'];
    return tpl(c1, c2, c3);
  }
  /** Helper : retourne le SVG encodé en data URI pour l'attribut [src]. */
  getCardIconDataUri(card: string): string {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(this.getCardIconSvg(card));
  }
  /** Helper : retourne l'emoji du motif d'une carte. */
  getCardMotifEmoji(card: string): string {
    const motifId = this.getCardMotif(card);
    return this.MOTIFS_LIST.find(m => m.id === motifId)?.emoji || '∅';
  }

  // ═══ v1.0.177ea — GÉNÉRATEUR DE VRAIS PNG via Canvas HTML5 ═══
  // Inspiré du STYLE des cartes existantes (cadre noir épais + coins ornementaux +
  // background gradient + emoji icône avec contour blanc) ET du splash war-table.png
  // (palette mystique violet/doré/bleu nuit avec étoiles + galaxie en fond).
  // Génère un PNG haute résolution (512x768 pour cartes / 256x256 pour icônes) puis
  // déclenche le téléchargement direct via blob → user les met dans assets/cards-generated/.

  /** Dessine une carte complète style "vraie carte de tarot Yamzy" sur un canvas. */
  private drawCardPng(card: string, size: { w: number; h: number }): HTMLCanvasElement {
    const W = size.w, H = size.h;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const c1 = this.getCardColor3(card, 0) || '#d99a51';
    const c2 = this.getCardColor3(card, 1) || '#c25d8d';
    const c3 = this.getCardColor3(card, 2) || '#6647bf';
    const emoji = this.getCardMotifEmoji(card);
    const motif = this.getCardMotif(card);

    // 1) Background gradient diagonal (couleurs custom de la carte)
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2) Radial glow inspiré du splash (nébuleuse violette/dorée en background)
    const radial = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.7);
    radial.addColorStop(0, 'rgba(255,255,255,0.25)');
    radial.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    radial.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // 3) Étoiles éparses (style splash war-table.png)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const stars = [
      [0.10, 0.10, 2], [0.25, 0.15, 1.5], [0.35, 0.08, 2.5], [0.78, 0.12, 1.8],
      [0.88, 0.22, 2], [0.15, 0.30, 1.5], [0.85, 0.45, 1.8], [0.12, 0.55, 2],
      [0.92, 0.70, 1.5], [0.20, 0.78, 2], [0.78, 0.82, 1.8], [0.50, 0.05, 1.5],
    ];
    for (const [x, y, r] of stars) {
      ctx.beginPath();
      ctx.arc(W * x, H * y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4) Bordure noire épaisse style cartes (10% du width)
    const borderWidth = Math.max(8, W * 0.02);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, W - borderWidth, H - borderWidth);

    // 5) Coins ornementaux blanc (style cadre Yamzy)
    const cornerSize = W * 0.12;
    const cornerInset = borderWidth + cornerSize * 0.15;
    const cornerWidth = Math.max(3, W * 0.008);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = cornerWidth;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(cornerInset, cornerInset + cornerSize * 0.7);
    ctx.lineTo(cornerInset, cornerInset);
    ctx.lineTo(cornerInset + cornerSize * 0.7, cornerInset);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(W - cornerInset - cornerSize * 0.7, cornerInset);
    ctx.lineTo(W - cornerInset, cornerInset);
    ctx.lineTo(W - cornerInset, cornerInset + cornerSize * 0.7);
    ctx.stroke();
    // Bot-Left
    ctx.beginPath();
    ctx.moveTo(cornerInset, H - cornerInset - cornerSize * 0.7);
    ctx.lineTo(cornerInset, H - cornerInset);
    ctx.lineTo(cornerInset + cornerSize * 0.7, H - cornerInset);
    ctx.stroke();
    // Bot-Right
    ctx.beginPath();
    ctx.moveTo(W - cornerInset - cornerSize * 0.7, H - cornerInset);
    ctx.lineTo(W - cornerInset, H - cornerInset);
    ctx.lineTo(W - cornerInset, H - cornerInset - cornerSize * 0.7);
    ctx.stroke();

    // 6) Icône emoji centrale avec contour blanc épais
    const emojiSize = Math.min(W, H) * 0.55;
    ctx.font = `${emojiSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Halo blanc derrière (4 directions)
    ctx.fillStyle = '#fff';
    const ox = [-4, 4, 0, 0, -3, 3, -3, 3];
    const oy = [0, 0, -4, 4, -3, -3, 3, 3];
    for (let i = 0; i < ox.length; i++) {
      ctx.fillText(emoji, W / 2 + ox[i], H * 0.45 + oy[i]);
    }
    // Emoji principal
    ctx.fillStyle = '#fff';
    ctx.fillText(emoji, W / 2, H * 0.45);

    // 7) Bandeau bas avec le nom de la carte + motif
    const bandH = H * 0.10;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(borderWidth, H - bandH - borderWidth, W - borderWidth * 2, bandH);

    ctx.font = `bold ${H * 0.022}px Arial, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(card.replace(/_/g, ' '), W / 2, H - bandH / 2 - borderWidth - H * 0.012);

    ctx.font = `${H * 0.018}px Arial, sans-serif`;
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('• ' + motif.toUpperCase() + ' •', W / 2, H - bandH / 2 - borderWidth + H * 0.014);

    return canvas;
  }

  /** Dessine une mini-icône (256×256) du motif (sans bandeau ni bordure noire, transparent autour). */
  private drawMotifIconPng(card: string, size: number): HTMLCanvasElement {
    const S = size;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const c1 = this.getCardColor3(card, 0) || '#d99a51';
    const c2 = this.getCardColor3(card, 1) || '#c25d8d';
    const c3 = this.getCardColor3(card, 2) || '#6647bf';
    const emoji = this.getCardMotifEmoji(card);

    // Cercle gradient radial (style médaille)
    const grad = ctx.createRadialGradient(S / 2, S * 0.4, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, c2);
    grad.addColorStop(0.85, c1);
    grad.addColorStop(1, c3);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Bord blanc épais (style bulle YAMZY)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = S * 0.04;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
    ctx.stroke();

    // Emoji central avec halo
    const emojiSize = S * 0.55;
    ctx.font = `${emojiSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    ctx.fillText(emoji, S / 2, S / 2);
    return canvas;
  }

  /** Convertit un canvas en blob PNG et déclenche le téléchargement. */
  private downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, 'image/png');
    });
  }

  /** Génère TOUS les PNG des cartes (style cartoon haute résolution 512×768). */
  async generateAllCardPngs(): Promise<void> {
    const cards = this.uniqueCardsList();
    if (!confirm(`Générer ${cards.length} cartes PNG (512×768) ? Tu vas recevoir ${cards.length} téléchargements.`)) return;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const canvas = this.drawCardPng(card, { w: 512, h: 768 });
      await this.downloadCanvasPng(canvas, `${card}_yamzy.png`);
      // petit délai pour éviter le throttling navigateur
      await new Promise(r => setTimeout(r, 150));
    }
    alert(`✅ ${cards.length} cartes PNG générées dans Téléchargements/`);
  }

  /** Génère TOUTES les icônes PNG des motifs (256×256, style médaille). */
  async generateAllMotifIconPngs(): Promise<void> {
    const cards = this.uniqueCardsList();
    if (!confirm(`Générer ${cards.length} icônes PNG (256×256, style médaille) ?`)) return;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const canvas = this.drawMotifIconPng(card, 256);
      await this.downloadCanvasPng(canvas, `${card}_icon.png`);
      await new Promise(r => setTimeout(r, 120));
    }
    alert(`✅ ${cards.length} icônes PNG générées dans Téléchargements/`);
  }

  /** Génère UNE SEULE carte PNG (preview rapide). */
  async generateSingleCardPng(card: string): Promise<void> {
    const canvas = this.drawCardPng(card, { w: 512, h: 768 });
    await this.downloadCanvasPng(canvas, `${card}_yamzy.png`);
  }
  /** Génère UNE SEULE icône PNG (preview rapide). */
  async generateSingleMotifIconPng(card: string): Promise<void> {
    const canvas = this.drawMotifIconPng(card, 256);
    await this.downloadCanvasPng(canvas, `${card}_icon.png`);
  }

  /** Copie le mapping motifs dans le presse-papier (pour hardcode permanent). */
  copyAllCardMotifsMapping(): void {
    const m = this.cardsMotifsMap();
    const lines = this.uniqueCardsList().map(card => `  '${card}': '${m[card] || 'none'}'`);
    const text = `// ═══ MOTIFS PAR CARTE ═══\n{\n${lines.join(',\n')}\n}`;
    navigator.clipboard?.writeText(text)
      .then(() => alert('✅ Motifs copiés : ' + lines.length + ' cartes'))
      .catch(() => alert('❌ Erreur copie. Texte:\n' + text));
  }

  // v1.0.177du — TEMPORAIRE : modal overlay test pour le mapping des 3 couleurs.
  // À SUPPRIMER une fois testé. Permet d'ouvrir la page mapping en overlay fullscreen
  // sans passer par le routing setPage qui n'enregistre pas 'cards-mapping' dans WAR_TABLE_PAGES.
  mappingTestOpen = signal(false);
  openMappingTest(): void { this.mappingTestOpen.set(true); }
  closeMappingTest(): void { this.mappingTestOpen.set(false); }

  // v1.0.177dp — Dismiss tracking pour les bulles YAMZY (réutilisé dans le stack Planning Live).
  // Stocke une clé unique par bulle (kind+title) pour permettre à l'utilisateur de cacher
  // une bulle individuelle sans toucher au flux de yamzyCarouselCards (qui est recalculé).
  yamzyBubblesDismissed = signal<Set<string>>(new Set());
  yamzyBubbleKey(c: any): string { return (c?.kind || '?') + '|' + (c?.title || ''); }
  /** Cartes YAMZY (TIP + RAPPEL + ALERTE) NON encore fermées par l'utilisateur. */
  activeYamzyBubbles = computed<any[]>(() => {
    const all = this.yamzyCarouselCards();
    const dismissed = this.yamzyBubblesDismissed();
    return all.filter(c => !dismissed.has(this.yamzyBubbleKey(c)));
  });
  /** Marque une bulle YAMZY comme fermée (n'affecte pas la cloche). */
  dismissYamzyBubble(c: any, event?: Event): void {
    if (event) event.stopPropagation();
    const key = this.yamzyBubbleKey(c);
    const set = new Set(this.yamzyBubblesDismissed());
    set.add(key);
    this.yamzyBubblesDismissed.set(set);
  }

  // v1.0.150 — Bubbles YAMZY SUPPRIMÉES (revert demandé par user).
  // Le pro-hero info modal est maintenant déclenché par un bouton ⓘ explicite
  // dans le header carousel — voir openPageInfoModal() ci-dessus.

  /* v1.0.144 — Ancien code (section mode) désactivé, gardé pour réf :
    const cards: any[] = [];
    const allEvents = this.events() || [];
    const upcoming = this.upcomingEventsList() || [];
    const active = allEvents.find(e => e.status === 'IN_PROGRESS');
    const reminders: any = this.remindersData();
    const high = reminders ? (reminders.items || []).filter((r: any) => r.severity === 'HIGH') : [];
    const dash: any = this.dash() || {};
    const top = (dash.top3Actions || []).slice(0, 3);

    // 1) Action en cours OU prochain événement OU idle
    if (active) {
      cards.push({
        kind: 'EN COURS',
        title: active.title,
        subtitle: `Démarré · ${this.formatTime(active.actualStart || active.scheduledStart)}`,
        meta: this.eventTypeLabel(active.type),
        icon: '▶',
        color: '#6cd16c',
        gradient: 'linear-gradient(135deg, #6cd16c, #4696b9)',
        action: { type: 'event', id: active.id },
        attendees: (active.attendees || []).slice(0, 5),
      });
    } else if (upcoming[0]) {
      const inMs = new Date(upcoming[0].scheduledStart).getTime() - Date.now();
      const inMin = Math.max(0, Math.round(inMs / 60000));
      cards.push({
        kind: 'PROCHAIN',
        title: upcoming[0].title,
        subtitle: `Dans ${inMin} min · ${this.formatTime(upcoming[0].scheduledStart)}`,
        meta: this.eventTypeLabel(upcoming[0].type),
        icon: '⏰',
        color: '#d99a51',
        gradient: 'linear-gradient(135deg, #d99a51, #c25d8d)',
        action: { type: 'event', id: upcoming[0].id },
        attendees: (upcoming[0].attendees || []).slice(0, 5),
      });
    } else {
      cards.push({
        kind: 'LIBRE',
        title: 'Aucune cérémonie',
        subtitle: 'Profite ou planifie une réunion',
        meta: '+ Nouvelle réunion',
        icon: '☕',
        color: '#9d8ad6',
        gradient: 'linear-gradient(135deg, #514a7b, #3b3363)',
        action: { type: 'new-event' },
      });
    }

    // 2-4) Prochaines réunions
    const upcomingSlice = active ? upcoming.slice(0, 3) : upcoming.slice(1, 4);
    for (const ev of upcomingSlice) {
      cards.push({
        kind: 'À VENIR',
        title: ev.title,
        subtitle: this.formatDateTime(ev.scheduledStart),
        meta: this.eventTypeLabel(ev.type),
        icon: ev.type === 'DAILY' ? '🗣' : ev.type === 'PLANNING' ? '🎯' : ev.type === 'REVIEW' ? '🔍' : ev.type === 'RETRO' ? '🔄' : '📅',
        color: this.eventTypeColor(ev.type),
        gradient: `linear-gradient(135deg, ${this.eventTypeColor(ev.type)}, #3b3363)`,
        action: { type: 'event', id: ev.id },
        attendees: (ev.attendees || []).slice(0, 5),
      });
    }

    // 5) Top ticket
    if (top[0]) {
      cards.push({
        kind: 'TICKET',
        title: top[0].code || top[0].title,
        subtitle: top[0].title || top[0].state || '',
        meta: 'Priorité haute',
        icon: '⚡',
        color: '#ff8a5c',
        gradient: 'linear-gradient(135deg, #ff8a5c, #c25d8d)',
        action: { type: 'page', page: 'backlog' },
      });
    }

    // 6) Alerte HIGH
    if (high[0]) {
      cards.push({
        kind: 'ALERTE',
        title: high[0].title || high[0].message,
        subtitle: high[0].description || high[0].category,
        meta: high[0].severity || 'HIGH',
        icon: '⚠',
        color: '#de4f5f',
        gradient: 'linear-gradient(135deg, #de4f5f, #eb8052)',
        action: { type: 'page', page: high[0].page || 'risks' },
      });
    }

    return cards.slice(0, 6);
  */

  /** Calcule la position relative pour l'effet 3D (réf Team Carousel). */
  ycPos(i: number): string {
    const cards = this.yamzyCarouselCards();
    const cur = this.yamzyCarouselIndex();
    const n = cards.length;
    if (!n) return 'hidden';
    const offset = (i - cur + n) % n;
    if (offset === 0) return 'center';
    if (offset === 1) return 'down-1';
    if (offset === 2 && n >= 5) return 'down-2';
    if (offset === n - 1) return 'up-1';
    if (offset === n - 2 && n >= 5) return 'up-2';
    return 'hidden';
  }
  ycTrack(i: number, c: any): any { return c?.title || i; }
  yamzyCarouselUp(): void {
    const n = this.yamzyCarouselCards().length;
    if (!n) return;
    this.yamzyCarouselIndex.update(i => (i - 1 + n) % n);
    this.scheduleCenterAction();
    this.resetAutoScroll(); // v1.0.41 — reset timer auto-scroll
  }
  yamzyCarouselDown(): void {
    const n = this.yamzyCarouselCards().length;
    if (!n) return;
    this.yamzyCarouselIndex.update(i => (i + 1) % n);
    this.scheduleCenterAction();
    this.resetAutoScroll();
  }
  setYamzyCarouselIndex(i: number): void {
    this.yamzyCarouselIndex.set(i);
    this.applyCenterAction(); // dot click = immédiat
    this.openPageContent();    // v1.0.47 — click sur dot = sélection explicite = ouvre la page
    this.resetAutoScroll();
  }

  /** v1.0.38 — Auto-fire l'action de la card center (pas besoin de cliquer).
   *  Pour les enter-section : navigate à la page sans reset l'index. */
  private applyCenterAction(): void {
    if (this.centerActionTimer) {
      clearTimeout(this.centerActionTimer);
      this.centerActionTimer = null;
    }
    const cards = this.yamzyCarouselCards();
    const idx = this.yamzyCarouselIndex();
    const card = cards[idx];
    if (!card?.action) return;
    if (card.action.type === 'enter-section') {
      this.studioLevel.set('section');
      this.setPage(card.action.pageId);
    }
  }

  /** v1.0.39 — Settle delay : ne charge la page QU'après l'arrêt du scroll.
   *  Chaque scroll reset le timer. Quand le user s'arrête > 500ms, action fire. */
  private centerActionTimer: any = null;
  private scheduleCenterAction(): void {
    if (this.centerActionTimer) clearTimeout(this.centerActionTimer);
    this.centerActionTimer = setTimeout(() => {
      this.applyCenterAction();
      this.centerActionTimer = null;
    }, 500);
  }

  /** Click sur la card : action contextuelle.
   *  v1.0.149 — TIP : navigue le HEADER carousel à la page concernée (pas de modal),
   *  comme ça l'header affiche directement le contenu Scrum de cette page. */
  ycCardAction(card: any): void {
    if (!card?.action) return;
    if (card.action.type === 'show-info') {
      // v1.0.149 — Au lieu d'ouvrir un modal, NAVIGUE le HEADER carousel sur cette page.
      // L'utilisateur voit alors le contenu de la page directement dans le header.
      if (card.action.pageId) {
        this.psEmptyCarouselGoToPage(card.action.pageId);
        this.heroPanelPageId.set(card.action.pageId);
      }
      return;
    }
    if (card.action.type === 'event') {
      this.openEventDetail(card.action.id);
      return;
    }
    if (card.action.type === 'new-event') { this.openNewEvent(); return; }
    if (card.action.type === 'return-home') { this.returnHome(); return; }
    // Fallback compat : navigation directe si pageId présent
    const pageId = card.action.pageId || card.action.page;
    if (pageId) this.setPage(pageId);
  }
  /** v1.0.144 — Page id ciblée par le pro-hero modal (signal override pour ycCardAction). */
  heroPanelPageId = signal<string | null>(null);

  // ═══ COCKPIT WIDGET v1.0.12 (style "Chicago" — 4 onglets en carrousel) ═══
  cockpitTab = signal<'action' | 'upcoming' | 'tickets' | 'alerts'>('action');
  cockpitTabs = [
    { id: 'action',   label: 'Action',      icon: '🎯' },
    { id: 'upcoming', label: 'Réunions',    icon: '📅' },
    { id: 'tickets',  label: 'Tickets',     icon: '⚡' },
    { id: 'alerts',   label: 'Alertes',     icon: '⚠'  },
  ] as const;
  // ═══ v1.0.118 — Today timeline (dashboard widget) ═══
  /** Tick toutes les 60s pour rafraîchir l'heure courante du timeline. */
  private nowTick = signal(Date.now());
  todayDateLabel = computed<string>(() => {
    const _ = this.nowTick();
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  });
  /** Heure decimale courante (ex: 14.5 = 14h30) pour positionner le curseur. */
  todayHourDecimal = computed<number>(() => {
    const _ = this.nowTick();
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  });
  /** Events du jour triés par heure, avec hour decimal pre-calcule. */
  todayTimelineEvents = computed<any[]>(() => {
    return this.todayEvents()
      .filter(e => !!e.scheduledStart)
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
      .map(e => {
        const d = new Date(e.scheduledStart);
        return { ...e, _hour: d.getHours() + d.getMinutes() / 60 };
      });
  });
  /** Etape courante : IN_PROGRESS d'abord, sinon prochain SCHEDULED apres maintenant. */
  currentTimelineStep = computed<any | null>(() => {
    const list = this.todayTimelineEvents();
    if (!list.length) return null;
    const active = list.find(e => e.status === 'IN_PROGRESS');
    if (active) return active;
    const now = this.todayHourDecimal();
    return list.find(e => e._hour >= now - 0.25) || null; // tolerance 15 min
  });

  /** v1.0.115 — Filtre les events dont scheduledStart === today (jour courant). */
  todayEvents = computed<any[]>(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return (this.events() || []).filter(e => (e.scheduledStart || '').slice(0, 10) === today);
  });
  /** v1.0.115 — Prochains events strictement aujourd'hui (futur ou en cours). */
  todayUpcoming = computed<any[]>(() => {
    const now = Date.now();
    return this.todayEvents()
      .filter(e => {
        const t = new Date(e.scheduledStart).getTime();
        return e.status === 'SCHEDULED' && t >= now - 15 * 60 * 1000; // 15 min de tolerance pour les events "en cours"
      })
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  });

  cockpitContent = computed<any>(() => {
    const tab = this.cockpitTab();
    if (tab === 'action') {
      // v1.0.115 — Cockpit n'affiche QUE les events du jour
      const todayList = this.todayEvents();
      const active = todayList.find(e => e.status === 'IN_PROGRESS') || null;
      const next = this.todayUpcoming()[0] || null;
      if (active) {
        const startedMs = active.actualStart ? new Date(active.actualStart).getTime() : Date.now();
        const elapsedMin = Math.max(0, Math.round((Date.now() - startedMs) / 60000));
        const planned = active.scheduledEnd ? Math.round((new Date(active.scheduledEnd).getTime() - new Date(active.scheduledStart).getTime()) / 60000) : 0;
        return { kind: 'active', event: active, elapsedMin, plannedMin: planned };
      }
      if (next) {
        const inMs = new Date(next.scheduledStart).getTime() - Date.now();
        const inMin = Math.max(0, Math.round(inMs / 60000));
        return { kind: 'next', event: next, inMin };
      }
      return { kind: 'idle' };
    }
    if (tab === 'upcoming') {
      // v1.0.115 — Liste reunions = uniquement celles du jour
      return { kind: 'list', items: this.todayUpcoming().slice(0, 4) };
    }
    if (tab === 'tickets') {
      const d: any = this.dash() || {};
      const top = (d.top3Actions || []).slice(0, 4);
      return { kind: 'tickets', items: top };
    }
    // alerts
    const data: any = this.remindersData();
    const items = data ? (data.items || []).filter((r: any) => r.severity === 'HIGH').slice(0, 4) : [];
    return { kind: 'alerts', items };
  });
  cockpitMeta = computed<any>(() => {
    const sprint = this.activeSprint();
    const sprintName = sprint?.name || '—';
    const total = this.todayEvents().length; // v1.0.115 — total = events du jour
    const upcoming = this.todayUpcoming().length; // v1.0.115 — upcoming = today scheduled futurs
    return { sprintName, total, upcoming };
  });
  setCockpitTab(id: 'action' | 'upcoming' | 'tickets' | 'alerts'): void { this.cockpitTab.set(id); }

  // ═══ CALENDAR EVENTS v1.0.11 ═══
  events = signal<any[]>([]);
  upcomingEventsList = signal<any[]>([]);
  eventNotifShown = signal<Set<number>>(new Set());
  newEventOpen = signal(false);
  newEventDraft: any = { type: 'MEETING', title: '', description: '', location: '', scheduledStart: '', scheduledEnd: '' };
  eventDetailId = signal<number | null>(null);
  eventLiveNotes = '';
  private eventPollInterval: any = null;

  refreshEvents(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) { this.events.set([]); this.upcomingEventsList.set([]); return; }
    this.api.listEvents(pid).subscribe({ next: e => this.events.set(e || []) });
    this.api.upcomingEvents(pid).subscribe({ next: e => this.upcomingEventsList.set(e || []) });
  }

  /** v1.0.14 — Si aucun event en DB, demande au backend de générer pour tous les sprints
   *  qui ont des dates (idempotent — ne re-crée pas si déjà présents).
   *  v1.0.24 — Silent fallback si endpoint absent (backend pas encore rebuild). */
  private autoEnsureCalled = false;
  ensureEventsThenRefresh(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    this.refreshEvents();
    if (this.autoEnsureCalled) return;
    this.autoEnsureCalled = true;
    this.api.autoEnsureEvents(pid).subscribe({
      next: r => {
        if ((r?.created || 0) > 0) {
          this.refreshEvents();
          this.refreshTimeAllocation();
        }
      },
      error: err => {
        // v1.0.24 — 404 = backend pas encore mis à jour avec v1.0.14+, on ignore silencieusement
        if (err?.status !== 404) {
          console.warn('[ensureEvents] non-404 error, will retry next time:', err?.status);
          this.autoEnsureCalled = false; // permettre retry sur autre erreur
        }
        // 404 : on log juste un info une fois, pas une erreur
        if (err?.status === 404 && !this.autoEnsure404Logged) {
          this.autoEnsure404Logged = true;
          console.info('[ensureEvents] backend pré-v1.0.14 (sans /events/auto-ensure) — fallback OK, utilisation manuelle du bouton "🔄 Régénérer cérémonies Scrum"');
        }
      }
    });
  }
  private autoEnsure404Logged = false;

  private startEventPoll(): void {
    if (this.eventPollInterval) return;
    const checkSoon = () => {
      const pid = this.api.selectedProjectId();
      if (!pid) return;
      this.api.startingSoonEvents(pid, 5).subscribe({
        next: list => {
          const shown = new Set(this.eventNotifShown());
          for (const ev of list) {
            if (shown.has(ev.id)) continue;
            shown.add(ev.id);
            this.showEventNotification(ev);
          }
          this.eventNotifShown.set(shown);
        }
      });
    };
    this.eventPollInterval = setInterval(checkSoon, 60_000);
    setTimeout(checkSoon, 2000);
  }

  private async showEventNotification(ev: any): Promise<void> {
    const startMs = new Date(ev.scheduledStart).getTime();
    const minutes = Math.max(0, Math.round((startMs - Date.now()) / 60000));
    const action = await this.dialog.prompt({
      title: `⏰ ${this.eventTypeLabel(ev.type)} dans ${minutes} min`,
      message: `**${ev.title}**\nDébut prévu : ${this.formatDateTime(ev.scheduledStart)}`,
      kind: 'warning',
      choices: [
        { value: 'start',  label: '▶ Démarrer maintenant', kind: 'primary', hint: 'Enregistre actualStart = now' },
        { value: 'snooze', label: '⏸ Rappeler dans 5 min', kind: 'neutral', hint: 'Re-notification après 5 min' },
        { value: 'open',   label: '👁 Voir détails',       kind: 'neutral' },
      ],
      details: [
        { label: 'Type', value: ev.type },
        { label: 'Durée prévue', value: this.formatDuration(ev.scheduledStart, ev.scheduledEnd) },
      ]
    });
    if (action === 'start') this.startEventNow(ev);
    else if (action === 'snooze') {
      // v1.0.105 — chantier C : snooze permet la re-pop apres 5 min SI event toujours SCHEDULED.
      const shown = new Set(this.eventNotifShown());
      shown.delete(ev.id);
      this.eventNotifShown.set(shown);
      setTimeout(() => {
        // Verifie que l'event est toujours SCHEDULED (sinon il a ete demarre/MISSED/etc.)
        const fresh = this.events().find(e => e.id === ev.id);
        if (fresh && fresh.status === 'SCHEDULED') {
          this.showEventNotification(fresh);
        }
      }, 5 * 60 * 1000);
    } else if (action === 'open') this.openEventDetail(ev.id);
  }

  startEventNow(ev: any): void {
    this.api.startEvent(ev.id).subscribe({
      next: () => {
        this.refreshEvents();
        this.setPage('agenda');
        this.eventDetailId.set(ev.id);
      }
    });
  }
  /** v1.0.104 — Chantier A : ouvre le Wrap-up modal au lieu de terminer directement.
   *  Permet d'ajouter notes + tickets crees pendant la reunion + follow-up + presences. */
  async endEventNow(ev: any): Promise<void> {
    this.openWrapUp(ev);
  }

  // ═══ v1.0.104 — WRAP-UP MODAL (Chantier A) ═══
  /** Event en cours de wrap-up (null = modal fermee). */
  wrapUpEvent = signal<any | null>(null);
  /** Brouillon des donnees a sauver a la fermeture. */
  wrapUpDraft: {
    notes: string;
    newTickets: Array<{ title: string; type: string; priority: string; sprint: string; estimationHours: number | null; description: string }>;
    followUp: { kind: 'none' | 'meeting' | 'quick-daily'; type: string; datetime: string; durationMin: number; title: string };
    attendances: Array<{ name: string; response: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'PENDING' }>;
  } = {
    notes: '',
    newTickets: [],
    followUp: { kind: 'none', type: 'MEETING', datetime: '', durationMin: 30, title: '' },
    attendances: []
  };
  wrapUpSaving = signal(false);

  openWrapUp(ev: any): void {
    // Pre-remplit notes depuis le textarea live
    this.wrapUpDraft = {
      notes: this.eventLiveNotes || (ev.notes || ''),
      newTickets: [],
      followUp: {
        kind: 'none',
        type: ev.type === 'DAILY' ? 'DAILY' : 'MEETING',
        datetime: this.toDatetimeLocal(new Date(Date.now() + 86400_000)), // demain meme heure
        durationMin: ev.type === 'DAILY' ? 15 : 30,
        title: ''
      },
      attendances: (ev.attendees || []).map((a: any) => ({
        name: a.name,
        response: a.response || 'PENDING'
      }))
    };
    this.wrapUpEvent.set(ev);
    // Ferme le modal detail si ouvert pour eviter le double-modal
    this.eventDetailId.set(null);
  }
  cancelWrapUp(): void {
    if (this.wrapUpSaving()) return;
    this.wrapUpEvent.set(null);
  }
  addWrapUpTicket(): void {
    this.wrapUpDraft.newTickets.push({
      title: '',
      type: 'Task',
      priority: 'Medium',
      sprint: this.wrapUpEvent()?.sprintName || this.activeSprint()?.name || '',
      estimationHours: null,
      description: ''
    });
  }
  removeWrapUpTicket(idx: number): void {
    this.wrapUpDraft.newTickets.splice(idx, 1);
  }
  toggleWrapUpAttendance(idx: number): void {
    const a = this.wrapUpDraft.attendances[idx];
    const next: Record<string, 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'PENDING'> = {
      ACCEPTED: 'TENTATIVE', TENTATIVE: 'DECLINED', DECLINED: 'PENDING', PENDING: 'ACCEPTED'
    };
    a.response = next[a.response];
  }

  /** Orchestre toutes les API calls : endEvent → createTicket × N → createEvent (followup) → respondEvent × N. */
  async submitWrapUp(): Promise<void> {
    const ev = this.wrapUpEvent();
    if (!ev || this.wrapUpSaving()) return;
    const pid = this.api.selectedProjectId();
    if (!pid) { this.cancelWrapUp(); return; }
    this.wrapUpSaving.set(true);

    try {
      // 1. endEvent avec les notes finales
      await this.api.endEvent(ev.id, this.wrapUpDraft.notes).toPromise();

      // 2. Cree les tickets discutes pendant la reunion (sourceEventId = ev.id)
      const ticketsToCreate = this.wrapUpDraft.newTickets.filter(t => t.title.trim());
      for (const t of ticketsToCreate) {
        await this.api.createTicket(pid, {
          title: t.title.trim(),
          type: t.type,
          priority: t.priority,
          sprint: t.sprint,
          estimationHours: t.estimationHours ?? undefined,
          description: t.description || undefined,
          status: 'À faire',
          state: 'TODO',
          sourceEventId: ev.id
        } as any).toPromise();
      }

      // 3. Planifie le follow-up event si demande
      if (this.wrapUpDraft.followUp.kind !== 'none') {
        const fu = this.wrapUpDraft.followUp;
        const start = new Date(fu.datetime);
        const end = new Date(start.getTime() + fu.durationMin * 60_000);
        await this.api.createEvent(pid, {
          type: fu.type,
          title: fu.title.trim() || (fu.kind === 'quick-daily' ? 'Daily de suivi' : `Suivi de ${ev.title}`),
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          description: `Follow-up de l'event #${ev.id} (${ev.title})`,
          attendees: ev.attendees || null
        } as any).toPromise();
      }

      // 4. Met a jour les presences modifiees
      const originalResp: Record<string, string> = {};
      (ev.attendees || []).forEach((a: any) => { originalResp[a.name] = a.response || 'PENDING'; });
      for (const a of this.wrapUpDraft.attendances) {
        if (originalResp[a.name] !== a.response) {
          await this.api.respondEvent(ev.id, a.name, a.response).toPromise();
        }
      }

      // 5. Refresh + Excel auto-toast + close (l'Excel toast existant suffit)
      this.refreshEvents();
      this.notifyExcelChanged(pid);
      this.eventLiveNotes = '';
      this.wrapUpEvent.set(null);
    } catch (e: any) {
      console.error('[Wrap-up] echec:', e);
      await this.dialog.alert({
        title: 'Erreur Wrap-up',
        message: `La sauvegarde a echoue : ${e?.message || e}`,
        kind: 'error'
      });
    } finally {
      this.wrapUpSaving.set(false);
    }
  }
  respondToEvent(ev: any, response: 'ACCEPTED'|'DECLINED'|'TENTATIVE'): void {
    const name = this.user()?.githubLogin || 'Guest';
    this.api.respondEvent(ev.id, name, response).subscribe({ next: () => this.refreshEvents() });
  }
  deleteEventById(ev: any): void {
    this.delEntity(() => this.api.deleteEvent(ev.id));
    setTimeout(() => this.refreshEvents(), 400);
  }

  // ═══ v1.0.113 — Ticket comments (fil de discussion) ═══
  /** Ticket dont on affiche les commentaires (null = panel fermé). */
  commentsTicket = signal<any | null>(null);
  commentsList = signal<any[]>([]);
  commentsLoading = signal(false);
  commentDraft = '';
  openTicketComments(t: any): void {
    this.commentsTicket.set(t);
    this.refreshComments(t.id);
  }
  closeTicketComments(): void {
    this.commentsTicket.set(null);
    this.commentsList.set([]);
    this.commentDraft = '';
  }
  private refreshComments(ticketId: number): void {
    this.commentsLoading.set(true);
    this.api.ticketComments(ticketId).subscribe({
      next: list => { this.commentsList.set(list || []); this.commentsLoading.set(false); },
      error: () => { this.commentsList.set([]); this.commentsLoading.set(false); }
    });
  }
  submitComment(): void {
    const t = this.commentsTicket();
    const body = this.commentDraft.trim();
    if (!t || !body) return;
    const author = this.user()?.githubLogin || 'Anonymous';
    this.api.addTicketComment(t.id, { author, body }).subscribe({
      next: () => {
        this.commentDraft = '';
        this.refreshComments(t.id);
      }
    });
  }
  deleteComment(c: any): void {
    if (!c?.id) return;
    if (!confirm('Supprimer ce commentaire ?')) return;
    this.api.deleteTicketComment(c.id).subscribe({
      next: () => {
        const t = this.commentsTicket();
        if (t) this.refreshComments(t.id);
      }
    });
  }

  // v1.0.109 — Tickets nes d'un event (cluster ticketsForEvent UI).
  // Charge a la demande quand l'user ouvre le detail event ou la preview meeting-report.
  linkedTicketsByEvent = signal<Record<number, any[]>>({});
  /** Charge les tickets lies a un event et les met en cache. */
  private fetchLinkedTickets(eventId: number): void {
    if (!eventId) return;
    if (this.linkedTicketsByEvent()[eventId]) return; // deja charge
    this.api.ticketsForEvent(eventId).subscribe({
      next: (list: any[]) => {
        this.linkedTicketsByEvent.update(m => ({ ...m, [eventId]: list || [] }));
      },
      error: () => {
        this.linkedTicketsByEvent.update(m => ({ ...m, [eventId]: [] }));
      }
    });
  }
  /** Helper template : tickets lies a un event id (vide si pas encore charges). */
  linkedTickets(eventId: number | null | undefined): any[] {
    if (!eventId) return [];
    return this.linkedTicketsByEvent()[eventId] || [];
  }

  // ═══ v1.0.114 — Reschedule event (déplacer un daily / autre) ═══
  rescheduleOpen = signal(false);
  rescheduleStart = '';
  rescheduleEnd = '';
  openReschedule(ev: any): void {
    if (!ev) return;
    this.rescheduleStart = ev.scheduledStart ? this.toDatetimeLocal(new Date(ev.scheduledStart)) : '';
    this.rescheduleEnd = ev.scheduledEnd ? this.toDatetimeLocal(new Date(ev.scheduledEnd)) : '';
    this.rescheduleOpen.set(true);
  }
  cancelReschedule(): void { this.rescheduleOpen.set(false); }
  submitReschedule(): void {
    const ev = this.getEventById(this.eventDetailId());
    if (!ev || !this.rescheduleStart) { this.cancelReschedule(); return; }
    const body: any = {
      scheduledStart: new Date(this.rescheduleStart).toISOString(),
      scheduledEnd: this.rescheduleEnd ? new Date(this.rescheduleEnd).toISOString() : null
    };
    this.api.updateEvent(ev.id, body).subscribe({
      next: () => {
        this.refreshEvents();
        this.cancelReschedule();
        const pid = this.api.selectedProjectId();
        if (pid) this.notifyExcelChanged(pid);
      },
      error: (e) => {
        this.dialog.alert({ title: 'Erreur', message: `Replanification échouée : ${e?.message || e}`, kind: 'error' });
      }
    });
  }

  openEventDetail(id: number): void {
    this.eventDetailId.set(id);
    this.eventLiveNotes = (this.events().find(e => e.id === id) || {}).notes || '';
    this.fetchLinkedTickets(id); // v1.0.109 — charge les tickets lies
  }
  closeEventDetail(): void { this.eventDetailId.set(null); this.eventLiveNotes = ''; }
  getEventById(id: number | null): any { return id == null ? null : this.events().find(e => e.id === id); }

  openNewEvent(): void {
    const now = new Date();
    const inHour = new Date(now.getTime() + 3600_000);
    this.newEventDraft = {
      type: 'MEETING', title: '', description: '', location: '',
      scheduledStart: this.toDatetimeLocal(now),
      scheduledEnd: this.toDatetimeLocal(inHour),
      attendees: []
    };
    this.selectedAttendees = [];
    this.newEventOpen.set(true);
  }
  /** v1.0.15 — Ouvre la modal pour ajouter un event sur une date précise (depuis cellule du calendrier). */
  openNewEventOnDay(dateStr: string): void {
    // dateStr format "YYYY-MM-DD" — on cale à 9h par défaut, durée 1h
    const start = new Date(dateStr + 'T09:00');
    const end = new Date(dateStr + 'T10:00');
    this.newEventDraft = {
      type: 'MEETING', title: '', description: '', location: '',
      scheduledStart: this.toDatetimeLocal(start),
      scheduledEnd: this.toDatetimeLocal(end),
      attendees: []
    };
    this.selectedAttendees = [];
    this.newEventOpen.set(true);
  }
  cancelNewEvent(): void { this.newEventOpen.set(false); this.selectedAttendees = []; }

  // v1.0.13 — Multi-select attendees from team
  selectedAttendees: any[] = [];
  isAttendeeSelected(m: any): boolean { return this.selectedAttendees.some(a => a.memberId === m.id); }
  toggleAttendee(m: any): void {
    const idx = this.selectedAttendees.findIndex(a => a.memberId === m.id);
    if (idx >= 0) {
      this.selectedAttendees.splice(idx, 1);
    } else {
      this.selectedAttendees.push({
        memberId: m.id,
        name: m.memberName,
        role: m.role,
        email: m.email,
        color: this.memberColor(m),
        emoji: m.avatarEmoji,
        initials: this.memberInitials(m),
        yamzyHandle: m.yamzyHandle,
        response: 'PENDING'
      });
    }
  }

  submitNewEvent(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const draft = { ...this.newEventDraft,
      scheduledStart: new Date(this.newEventDraft.scheduledStart).toISOString(),
      scheduledEnd: new Date(this.newEventDraft.scheduledEnd).toISOString(),
      attendees: this.selectedAttendees.length ? this.selectedAttendees : null,
    };
    this.api.createEvent(pid, draft).subscribe({
      next: () => {
        this.newEventOpen.set(false);
        this.selectedAttendees = [];
        this.refreshEvents();
        this.notifyExcelChanged(pid);
      }
    });
  }

  async regenerateScrumCeremonies(): Promise<void> {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const ok = await this.dialog.confirm({
      title: 'Régénérer les cérémonies Scrum',
      message: `Crée les Daily, Sprint Planning, Review et Retro pour le sprint **EN COURS** s'ils n'existent pas déjà.`,
      kind: 'question',
      confirmLabel: '🔄 Générer'
    });
    if (!ok) return;
    this.api.regenerateScrumCeremonies(pid).subscribe({
      next: async r => {
        await this.dialog.alert({
          title: 'Régénération terminée',
          message: r.reason || `${r.created} cérémonie(s) créée(s) pour le sprint ${r.sprintName}.`,
          kind: 'success',
        });
        this.refreshEvents();
      }
    });
  }

  downloadIcal(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    window.open(this.api.icalUrl(pid), '_blank');
  }

  eventTypeLabel(type: string): string {
    const map: Record<string, string> = {
      DAILY: '📅 Daily Stand-up',
      PLANNING: '🎯 Sprint Planning',
      REVIEW: '🔍 Sprint Review',
      RETRO: '🔄 Rétrospective',
      MEETING: '👥 Réunion',
      CALL: '📞 Call',
      OTHER: '📌 Autre',
    };
    return map[type] || type;
  }
  eventTypeColor(type: string): string {
    const map: Record<string, string> = {
      DAILY: '#70b944', PLANNING: '#4696b9', REVIEW: '#d99a51',
      RETRO: '#c25d8d', MEETING: '#6647bf', CALL: '#2ea1cb', OTHER: '#8b7fd6'
    };
    return map[type] || '#8b7fd6';
  }
  eventStatusLabel(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: '○ Planifié',
      IN_PROGRESS: '▶ En cours',
      COMPLETED: '✓ Terminé',
      CANCELLED: '✕ Annulé',
      MISSED: '⚠ Manqué',
    };
    return map[status] || status;
  }
  formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  formatTime(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  formatDuration(start?: string, end?: string): string {
    if (!start || !end) return '—';
    const min = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (min < 60) return min + ' min';
    return Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0');
  }
  private toDatetimeLocal(d: Date): string {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  }
  // ═══ v1.0.106 — Chantier B : Meeting Reports (comptes-rendus reunions terminees) ═══
  meetingReportsFilter = signal<{ sprint: string; type: string; search: string }>({ sprint: '', type: '', search: '' });
  meetingReportsPreview = signal<any | null>(null);
  /** Liste des events COMPLETED ou MISSED avec notes pour la page Comptes-rendus. */
  meetingReports = computed(() => {
    const f = this.meetingReportsFilter();
    const search = f.search.toLowerCase().trim();
    return this.events()
      .filter((e: any) => e.status === 'COMPLETED' || e.status === 'MISSED')
      .filter((e: any) => !f.type || e.type === f.type)
      .filter((e: any) => !f.sprint || e.sprintName === f.sprint || String(e.sprintId) === f.sprint)
      .filter((e: any) => {
        if (!search) return true;
        return (
          (e.title || '').toLowerCase().includes(search) ||
          (e.notes || '').toLowerCase().includes(search) ||
          (e.description || '').toLowerCase().includes(search)
        );
      })
      .sort((a: any, b: any) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime());
  });
  /** Sprints disponibles pour le filtre. */
  meetingReportsSprints = computed(() => {
    const seen = new Set<string>();
    for (const e of this.events()) {
      if (e.sprintName) seen.add(e.sprintName);
    }
    return Array.from(seen).sort();
  });
  setMeetingReportsFilter(patch: Partial<{ sprint: string; type: string; search: string }>): void {
    this.meetingReportsFilter.update(f => ({ ...f, ...patch }));
  }
  openMeetingReport(ev: any): void {
    this.meetingReportsPreview.set(ev);
    if (ev?.id) this.fetchLinkedTickets(ev.id); // v1.0.109 — charge les tickets lies
  }
  closeMeetingReport(): void { this.meetingReportsPreview.set(null); }

  /** v1.0.108 — Click sur un scroll auto dans Arcane → navigation vers la source. */
  onArcaneNavigate(req: { kind: string; page: string; id?: number; ticketKey?: string }): void {
    this.studioLevel.set('section');
    this.setPage(req.page);
    this.openPageContent();
    // Si Meeting Reports : ouvrir le compte-rendu direct
    if (req.page === 'meeting-reports' && req.id) {
      const ev = this.events().find((e: any) => e.id === req.id);
      if (ev) this.openMeetingReport(ev);
    }
    // Si Agenda + id : ouvrir le detail event
    else if (req.page === 'agenda' && req.id) {
      this.openEventDetail(req.id);
    }
    // v1.0.109 — Si Backlog + ticketKey : pre-filtre le search du Backlog
    // pour mettre en avant le ticket cible (highlight visuel).
    else if (req.page === 'backlog' && req.ticketKey) {
      this.ticketFilter = req.ticketKey;
      this.focusedTicketKey.set(req.ticketKey); // pour highlight visuel temporaire
      // Auto-clear le highlight apres 4s
      setTimeout(() => {
        if (this.focusedTicketKey() === req.ticketKey) this.focusedTicketKey.set(null);
      }, 4000);
    }
  }
  /** v1.0.109 — Ticket key actuellement focus (highlight temporaire dans Backlog). */
  focusedTicketKey = signal<string | null>(null);

  eventsGroupedByDay = computed(() => {
    const list = this.events().slice().sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    const groups: Record<string, any[]> = {};
    for (const ev of list) {
      const key = (ev.scheduledStart || '').slice(0, 10);
      (groups[key] ||= []).push(ev);
    }
    return Object.entries(groups).map(([day, items]) => ({ day, items }));
  });

  // ═══ HOLIDAYS / LEAVES editor v1.0.10 ═══
  newHolidayDate = '';
  newHolidayLabel = '';
  newLeaveDate = '';
  newLeaveReason = '';

  addHoliday(): void {
    if (!this.newHolidayDate) return;
    const p = this.currentProject(); if (!p) return;
    const list = [...((p as any).holidays || []), { date: this.newHolidayDate, label: this.newHolidayLabel || '' }];
    this.persistHolidaysOrLeaves(p, 'holidays', list);
    this.newHolidayDate = ''; this.newHolidayLabel = '';
  }
  delHoliday(h: any): void {
    const p = this.currentProject(); if (!p) return;
    const list = ((p as any).holidays || []).filter((x: any) => x !== h);
    this.persistHolidaysOrLeaves(p, 'holidays', list);
  }
  addLeave(): void {
    if (!this.newLeaveDate) return;
    const p = this.currentProject(); if (!p) return;
    const list = [...((p as any).leaves || []), { date: this.newLeaveDate, reason: this.newLeaveReason || '' }];
    this.persistHolidaysOrLeaves(p, 'leaves', list);
    this.newLeaveDate = ''; this.newLeaveReason = '';
  }
  delLeave(l: any): void {
    const p = this.currentProject(); if (!p) return;
    const list = ((p as any).leaves || []).filter((x: any) => x !== l);
    this.persistHolidaysOrLeaves(p, 'leaves', list);
  }
  private persistHolidaysOrLeaves(p: any, field: 'holidays'|'leaves', list: any[]): void {
    (p as any)[field] = list;
    this.api.projects.set([...this.api.projects()]);
    this.api.updateProject(p.id, { [field]: list } as any).subscribe({
      next: () => { this.notifyExcelChanged(p.id); },
      error: (err) => console.warn('[wt] holidays/leaves patch failed', err)
    });
  }

  /** Auto-recompute sprintCapacityHours quand h/jour ou jours/sprint change. */
  recomputeSprintCapacity(): void {
    const h = Number(this.newProjectDraft.hoursPerDay) || 0;
    const d = Number(this.newProjectDraft.daysPerSprint) || 0;
    if (h > 0 && d > 0) this.newProjectDraft.sprintCapacityHours = Math.round(h * d * 10) / 10;
  }

  /** Helpers i18n exposés au template. */
  pageLabel(p: PageDef | null | undefined): string {
    if (!p) return '';
    return this.i18n.t('page.' + p.id) || p.label;
  }
  catLabel(cat: string): string {
    return this.i18n.t('cat.' + cat) || cat;
  }

  // ═══ MODE ÉDITION v1.0.4 (toggle 🔒/🔓 dans le topbar) ═══
  editMode = signal<boolean>(this.readEditMode());
  toggleEditMode(): void {
    const v = !this.editMode();
    this.editMode.set(v);
    try { localStorage.setItem('wt_edit_mode', v ? '1' : '0'); } catch {}
  }
  private readEditMode(): boolean {
    try { return localStorage.getItem('wt_edit_mode') === '1'; }
    catch { return false; }
  }

  // ═══ TOAST EXCEL AUTO-EXPORTED v1.0.4 ═══
  excelToast = signal<{ path: string; ts: number } | null>(null);
  /** Appelée après chaque save réussi : poll le path du dernier export et affiche un toast. */
  private notifyExcelChanged(projectId: number): void {
    this.api.getLastExportPath(projectId).subscribe({
      next: (r) => {
        if (r.path) {
          this.excelToast.set({ path: r.path, ts: Date.now() });
          setTimeout(() => {
            if (this.excelToast()?.ts === this.excelToast()?.ts) {
              const cur = this.excelToast();
              if (cur && Date.now() - cur.ts >= 4500) this.excelToast.set(null);
            }
          }, 5000);
        }
      },
      error: () => {}
    });
  }
  dismissExcelToast(): void { this.excelToast.set(null); }
  excelToastFileName = computed(() => {
    const t = this.excelToast();
    if (!t) return '';
    return t.path.split(/[\\/]/).pop() || t.path;
  });

  // ═══ SPRINT LAUNCH / INTERRUPT v1.0.7+ ═══
  /** État du sprint pour le bouton play : ACTIVE (interruptible) | LAUNCHABLE (lançable) | null (idle). */
  launchableInfo = signal<{
    state?: 'ACTIVE' | 'LAUNCHABLE' | 'IDLE';
    launchable: boolean;
    interruptible?: boolean;
    sprintId?: number;
    sprintName?: string;
    sprintNumber?: number;
    startDate?: string;
    endDate?: string;
    daysUntilStart?: number;
    isToday?: boolean;
    isOverdue?: boolean;
    launchedAt?: string;
    dayIndex?: number;
    totalDays?: number;
  } | null>(null);
  launchingSprint = signal(false);

  /** Tooltip plein du bouton play (3 états : ACTIVE / LAUNCHABLE / IDLE). */
  launchTooltip(): string {
    const li = this.launchableInfo();
    if (!li) return '';
    if (li.state === 'ACTIVE') {
      const day = li.dayIndex != null ? `Jour ${li.dayIndex}` + (li.totalDays ? `/${li.totalDays}` : '') : '';
      return `${li.sprintName} — EN COURS ${day} — click pour interrompre ou terminer`;
    }
    const when = li.isToday ? "AUJOURD'HUI"
               : li.isOverdue ? `${Math.abs(li.daysUntilStart || 0)} j de retard`
               : `dans ${li.daysUntilStart} j`;
    return `${li.sprintName} — ${when} — click pour lancer`;
  }

  // ═══ REMINDERS v1.0.10 ═══
  remindersData = signal<{
    items: Array<{ category: string; severity: 'HIGH'|'MEDIUM'|'LOW'; title: string; description: string; page?: string; entityKey?: string; entityId?: number; }>;
    counts: { total: number; high: number; medium: number; low: number };
  } | null>(null);
  remindersOpen = signal(false);
  remindersDismissed = signal<Set<string>>(new Set());
  private reminderPollInterval: any = null;

  /** Re-fetch les reminders pour le projet courant. */
  refreshReminders(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) { this.remindersData.set(null); return; }
    this.api.reminders(pid).subscribe({
      next: data => this.remindersData.set(data),
      error: () => this.remindersData.set(null)
    });
  }

  /** Compteurs filtrés (excluent les dismissed). */
  visibleReminders = computed(() => {
    const data = this.remindersData();
    if (!data) return [];
    const dismissed = this.remindersDismissed();
    return data.items.filter(r => !dismissed.has(this.reminderKey(r)));
  });
  visibleHigh = computed(() => this.visibleReminders().filter(r => r.severity === 'HIGH').length);
  visibleTotal = computed(() => this.visibleReminders().length);

  /** Click sur la bell : ouvre le dropdown. */
  toggleRemindersPanel(): void { this.remindersOpen.update(v => !v); }

  /** Click sur un rappel : navigue vers la page concernée et ferme le panel. */
  goToReminder(r: any): void {
    if (r.page) this.setPage(r.page);
    if (r.entityKey && r.page === 'backlog') this.ticketFilter = r.entityKey;
    this.remindersOpen.set(false);
  }

  /** Dismiss un rappel (locale, jusqu'au prochain refresh). */
  dismissReminder(r: any, event: Event): void {
    event.stopPropagation();
    const key = this.reminderKey(r);
    const set = new Set(this.remindersDismissed());
    set.add(key);
    this.remindersDismissed.set(set);
  }

  private reminderKey(r: any): string {
    return r.category + '|' + (r.entityId ?? r.entityKey ?? r.title);
  }

  /** Catégorie → label affichable. */
  reminderCategoryLabel(cat: string): string {
    const map: Record<string, string> = {
      'ticket-overdue':        '🔴 Ticket en retard',
      'ticket-blocked-stale':  '🛑 Ticket bloqué',
      'ticket-aging-wip':      '⚠ WIP qui traîne',
      'ticket-no-assignee':    '🙋 Sans assigné',
      'daily-missing-today':   '📅 Daily manquant',
      'daily-empty-yesterday': '📅 Daily vide hier',
      'risk-overdue':          '⚠ Risque non résolu',
      'techdebt-critical-noplan': '💳 Tech debt critique',
      'sprint-overrun':        '🏃 Sprint dépassé',
    };
    return map[cat] || cat;
  }

  /** Démarre le poll périodique (toutes les 2 min). */
  private startReminderPoll(): void {
    if (this.reminderPollInterval) return;
    this.reminderPollInterval = setInterval(() => this.refreshReminders(), 120_000);
  }

  /** Re-fetch l'état du sprint pour le projet courant (appelé au load + après launch/interrupt). */
  refreshLaunchable(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) { this.launchableInfo.set(null); return; }
    this.api.launchableSprint(pid).subscribe({
      next: info => {
        // Affiche le bouton seulement si ACTIVE ou LAUNCHABLE (pas IDLE)
        if (info.state === 'ACTIVE' || info.launchable) this.launchableInfo.set(info);
        else this.launchableInfo.set(null);
      },
      error: () => this.launchableInfo.set(null)
    });
  }

  /** Click sur le bouton play : décide entre lancer / interrompre / terminer selon l'état. */
  async doLaunchSprint(): Promise<void> {
    const info = this.launchableInfo();
    const pid = this.api.selectedProjectId();
    if (!info?.sprintId || !pid) return;

    // ── État ACTIVE : sprint EN_COURS → propose interrompre OU terminer ──
    if (info.state === 'ACTIVE') {
      await this.doSprintInProgress(info, pid);
      return;
    }

    // ── État LAUNCHABLE : lancer le sprint ──
    const dateLabel = info.isToday ? 'AUJOURD\'HUI'
                    : info.isOverdue ? `il y a ${Math.abs(info.daysUntilStart || 0)} jour(s) — retard`
                    : `dans ${info.daysUntilStart} jour(s)`;
    const ok = await this.dialog.confirm({
      title: `Lancer le sprint **${info.sprintName}** ?`,
      message: `Le Sage Yamzy s'apprête à activer la quête. Voici ce qui va se passer :`,
      kind: 'question',
      confirmLabel: '▶ Lancer maintenant',
      cancelLabel: 'Plus tard',
      details: [
        { label: 'Démarrage prévu', value: dateLabel },
        { label: 'Status', value: 'PLANNED → EN_COURS' },
        { label: 'Daily Stand-up', value: 'Créé pour aujourd\'hui' },
        { label: 'Tickets', value: 'ID régénérés YC-{PROJ}-S{N}-{seq}' },
        { label: 'Excel', value: 'Auto-régénéré dans ~/.yamzy/exports/' },
      ]
    });
    if (!ok) return;
    this.launchingSprint.set(true);
    this.api.launchSprint(info.sprintId).subscribe({
      next: async r => {
        this.launchingSprint.set(false);
        await this.dialog.alert({
          title: `Sprint **${r.sprintName}** lancé — Bon sprint !`,
          message: `Le Cycle est officiellement actif. Que la quête commence.`,
          kind: 'success',
          details: [
            { label: 'Status', value: `${r.previousStatus} → ${r.newStatus}` },
            { label: 'Lancé à', value: new Date(r.launchedAt).toLocaleString('fr-FR') },
            { label: 'Daily Stand-up', value: r.dailyCreated ? 'créé' : 'existait déjà' },
            { label: 'Tickets re-keyed', value: `${r.ticketKeysGenerated} (${r.keyPattern})` },
            { label: 'Excel', value: 'auto-régénéré' },
          ]
        });
        this.reloadAfterSprintAction(pid);
      },
      error: async err => {
        this.launchingSprint.set(false);
        await this.dialog.alert({
          title: 'Échec du lancement',
          message: err?.error?.message || err?.message || 'Erreur inconnue.',
          kind: 'error'
        });
      }
    });
  }

  /** Quand le sprint est EN_COURS : prompt pour choisir interrompre / terminer / annuler. */
  private async doSprintInProgress(info: any, pid: number): Promise<void> {
    const dayLabel = info.dayIndex != null
      ? `Jour ${info.dayIndex}${info.totalDays ? '/' + info.totalDays : ''}`
      : 'En cours';
    const launchedAt = info.launchedAt ? new Date(info.launchedAt).toLocaleString('fr-FR') : 'date inconnue';
    const choice = await this.dialog.prompt({
      title: `Sprint **${info.sprintName}** EN COURS`,
      message: `Le Sage attend ton signal. Quelle action souhaites-tu mener sur ce Cycle ?`,
      kind: 'question',
      details: [
        { label: 'Jour actuel', value: dayLabel },
        { label: 'Lancé le', value: launchedAt },
      ],
      choices: [
        { value: 'interrupt', label: '⏸ Interrompre', kind: 'primary',
          hint: 'Le sprint repasse en PLANNED. Tu pourras le relancer plus tard.' },
        { value: 'complete',  label: '⏹ Terminer', kind: 'danger',
          hint: 'Le sprint passe en TERMINE. endDate = aujourd\'hui. Action de clôture officielle.' },
      ],
    });
    if (choice === 'interrupt') {
      const ok = await this.dialog.confirm({
        title: `Interrompre **${info.sprintName}** ?`,
        message: `Le sprint repassera en PLANNED. Toutes les données sont conservées et tu pourras le relancer.`,
        kind: 'warning',
        confirmLabel: '⏸ Oui, interrompre',
      });
      if (!ok) return;
      this.launchingSprint.set(true);
      this.api.interruptSprint(info.sprintId).subscribe({
        next: async r => {
          this.launchingSprint.set(false);
          await this.dialog.alert({
            title: `Sprint **${r.sprintName}** interrompu`,
            message: `Tu peux le relancer plus tard via le bouton ▶ LANCER.`,
            kind: 'success',
            details: [{ label: 'Status', value: `${r.previousStatus} → ${r.newStatus}` }],
          });
          this.reloadAfterSprintAction(pid);
        },
        error: async err => {
          this.launchingSprint.set(false);
          await this.dialog.alert({ title: 'Échec interruption',
            message: err?.error?.message || err?.message || 'Erreur inconnue.', kind: 'error' });
        }
      });
    } else if (choice === 'complete') {
      const ok = await this.dialog.confirm({
        title: `Terminer **${info.sprintName}** ?`,
        message: `Le sprint sera officiellement clos. endDate = aujourd'hui si pas déjà définie.\nLe Sage Yamzy proposera ensuite le sprint suivant en lancement.`,
        kind: 'warning',
        confirmLabel: '⏹ Oui, terminer',
      });
      if (!ok) return;
      this.launchingSprint.set(true);
      this.api.completeSprint(info.sprintId).subscribe({
        next: async r => {
          this.launchingSprint.set(false);
          await this.dialog.alert({
            title: `Sprint **${r.sprintName}** terminé`,
            message: `Le Cycle est clos. Bravo pour cette quête !`,
            kind: 'success',
            details: [{ label: 'Status', value: `${r.previousStatus} → ${r.newStatus}` }],
          });
          this.reloadAfterSprintAction(pid);
        },
        error: async err => {
          this.launchingSprint.set(false);
          await this.dialog.alert({ title: 'Échec terminer',
            message: err?.error?.message || err?.message || 'Erreur inconnue.', kind: 'error' });
        }
      });
    }
  }

  private reloadAfterSprintAction(pid: number): void {
    this.refreshLaunchable();
    this.refreshActivePage();
    this.api.sprints(pid).subscribe({ next: s => this.sprints.set(s) });
    this.api.tickets(pid).subscribe({ next: t => this.tickets.set(t) });
    this.notifyExcelChanged(pid);
  }

  // ═══ NEW PROJECT MODAL v1.0.4 ═══
  newProjectOpen = signal<boolean>(false);
  newProjectDraft: Partial<PosProject> = {};
  newProjectError = signal<string>('');
  newProjectSaving = signal<boolean>(false);

  openNewProject(): void {
    this.newProjectDraft = {
      code: '', name: '',
      hoursPerDay: 8, daysPerSprint: 5, sprintCapacityHours: 40,
      status: 'En cours',
    };
    this.newProjectError.set('');
    this.newProjectOpen.set(true);
  }
  cancelNewProject(): void { this.newProjectOpen.set(false); this.newProjectError.set(''); }
  submitNewProject(): void {
    if (!this.newProjectDraft.code?.trim() || !this.newProjectDraft.name?.trim()) {
      this.newProjectError.set('Code et nom requis');
      return;
    }
    this.newProjectSaving.set(true);
    this.api.createProject(this.newProjectDraft).subscribe({
      next: (p) => {
        this.newProjectSaving.set(false);
        this.newProjectOpen.set(false);
        // Recharge la liste + sélectionne le nouveau projet
        this.api.listProjects().subscribe(list => {
          this.api.projects.set(list);
          this.selectProject(p.id);
          this.notifyExcelChanged(p.id);
        });
      },
      error: (err) => {
        this.newProjectSaving.set(false);
        this.newProjectError.set(err?.error?.message || err?.message || 'Échec création');
      }
    });
  }

  // ═══ HELPERS CRUD v1.0.4 — wrappers par entité (call from HTML buttons) ═══

  private withProject<T>(body: any, fn: (pid: number) => Observable<T>): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    fn(pid).subscribe({
      next: () => { this.refreshActivePage(); this.notifyExcelChanged(pid); },
      error: (err) => console.warn('[wt] op failed', err)
    });
  }
  private async delEntity<T>(fn: () => Observable<T>): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Supprimer cette ligne ?',
      message: 'L\'action est irréversible. Voulez-vous continuer ?',
      kind: 'warning',
      confirmLabel: '🗑 Oui, supprimer',
    });
    if (!ok) return;
    const pid = this.api.selectedProjectId();
    fn().subscribe({
      next: () => { this.refreshActivePage(); if (pid) this.notifyExcelChanged(pid); },
      error: (err) => console.warn('[wt] delete failed', err)
    });
  }
  /** Patch un champ et recharge (re-pull la page courante). */
  patchEntity(apiFn: (id: number, body: any) => Observable<any>, row: { id: number }, field: string, value: any): void {
    const pid = this.api.selectedProjectId();
    apiFn.call(this.api, row.id, { [field]: value }).subscribe({
      next: () => { if (pid) this.notifyExcelChanged(pid); },
      error: (err) => console.warn('[wt] patch failed', err)
    });
  }
  /** Refresh data for the currently active page (public so HTML calls it after ops). */
  refreshActivePage(): void { (this as any).loadPageData?.(this.activePage()); this.reloadProjectsSilent(); }
  private reloadProjectsSilent(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    this.api.tickets(pid).subscribe({ next: t => this.tickets.set(t) });
  }

  // ═══ BULK OPERATIONS v1.0.10 (Backlog) ═══
  selectedTicketIds = signal<Set<number>>(new Set());
  bulkBusy = signal(false);
  isTicketSelected(t: any): boolean { return this.selectedTicketIds().has(t.id); }
  toggleTicketSelection(t: any): void {
    const set = new Set(this.selectedTicketIds());
    if (set.has(t.id)) set.delete(t.id); else set.add(t.id);
    this.selectedTicketIds.set(set);
  }
  toggleSelectAllVisible(): void {
    const visible = this.paged(this.filteredTickets());
    const allSelected = visible.every(t => this.selectedTicketIds().has(t.id));
    const set = new Set(this.selectedTicketIds());
    if (allSelected) visible.forEach(t => set.delete(t.id));
    else visible.forEach(t => set.add(t.id));
    this.selectedTicketIds.set(set);
  }
  clearTicketSelection(): void { this.selectedTicketIds.set(new Set()); }
  selectedCount = computed(() => this.selectedTicketIds().size);

  async bulkUpdate(field: 'status'|'sprint'|'assignee'|'priority'): Promise<void> {
    const ids = Array.from(this.selectedTicketIds());
    if (!ids.length) return;
    const labels: Record<string,string> = { status: 'Statut', sprint: 'Sprint', assignee: 'Assigné', priority: 'Priorité' };
    const choices = field === 'status'
      ? [
          { value: 'À faire', label: '○ À faire', kind: 'neutral' as const },
          { value: 'En cours', label: '⚡ En cours', kind: 'primary' as const },
          { value: 'En revue', label: '👁 En revue', kind: 'primary' as const },
          { value: 'Terminé', label: '✓ Terminé', kind: 'primary' as const },
          { value: 'Bloqué', label: '🛑 Bloqué', kind: 'danger' as const },
        ]
      : field === 'priority'
        ? [
          { value: 'Must',  label: 'Must',  kind: 'danger' as const },
          { value: 'Should', label: 'Should', kind: 'primary' as const },
          { value: 'Could', label: 'Could', kind: 'neutral' as const },
          { value: "Won't", label: "Won't", kind: 'neutral' as const },
        ]
        : [];  // sprint / assignee → prompt texte (gérés en dessous)
    let chosen: string | null = null;
    if (choices.length) {
      chosen = await this.dialog.prompt({
        title: `Bulk update — ${labels[field]}`,
        message: `Modifier le **${labels[field]}** de **${ids.length} ticket(s)** sélectionné(s).`,
        kind: 'question',
        choices: choices,
      });
    } else {
      // pour sprint / assignee on demande le texte avec un confirm + JS prompt
      const v = window.prompt(`Nouveau ${labels[field]} pour ${ids.length} ticket(s) :`, '');
      if (v == null) return;
      chosen = v;
    }
    if (chosen == null) return;
    this.bulkBusy.set(true);
    this.api.bulkUpdateTickets(ids, { [field]: chosen }).subscribe({
      next: async r => {
        this.bulkBusy.set(false);
        await this.dialog.alert({
          title: 'Bulk update terminé',
          message: `${r.updated} ticket(s) mis à jour sur ${r.requested}.`,
          kind: 'success',
        });
        this.clearTicketSelection();
        const pid = this.api.selectedProjectId();
        if (pid) {
          this.api.tickets(pid).subscribe({ next: ts => this.tickets.set(ts) });
          this.notifyExcelChanged(pid);
        }
      },
      error: async err => {
        this.bulkBusy.set(false);
        await this.dialog.alert({ title: 'Échec bulk update',
          message: err?.error?.message || err?.message || 'Erreur inconnue.', kind: 'error' });
      }
    });
  }

  async bulkDelete(): Promise<void> {
    const ids = Array.from(this.selectedTicketIds());
    if (!ids.length) return;
    const ok = await this.dialog.confirm({
      title: `Supprimer ${ids.length} ticket(s) ?`,
      message: `Action **irréversible**. Tous les tickets sélectionnés et leurs métadonnées disparaîtront.`,
      kind: 'error',
      confirmLabel: '🗑 Tout supprimer',
    });
    if (!ok) return;
    this.bulkBusy.set(true);
    this.api.bulkDeleteTickets(ids).subscribe({
      next: async r => {
        this.bulkBusy.set(false);
        await this.dialog.alert({
          title: 'Bulk delete terminé',
          message: `${r.deleted} ticket(s) supprimé(s).`,
          kind: 'success',
        });
        this.clearTicketSelection();
        const pid = this.api.selectedProjectId();
        if (pid) {
          this.api.tickets(pid).subscribe({ next: ts => this.tickets.set(ts) });
          this.notifyExcelChanged(pid);
        }
      },
      error: async err => {
        this.bulkBusy.set(false);
        await this.dialog.alert({ title: 'Échec bulk delete',
          message: err?.error?.message || err?.message || 'Erreur inconnue.', kind: 'error' });
      }
    });
  }

  // ── Tickets
  addTicket(): void {
    const n = (this.tickets() || []).length + 1;
    this.withProject({}, pid => this.api.createTicket(pid, {
      ticketId: 'NEW-' + n, title: 'Nouveau ticket', type: 'Story', priority: 'Should',
      status: 'À faire', estimationHours: 0, storyPoints: 0, progressPercent: 0
    }));
  }
  delTicket(t: any): void { this.delEntity(() => this.api.deleteTicket(t.id)); }

  // ── Sprints (backend choisit le nom : "{PROJ}-S{N}" à la Yamzy)
  addSprint(): void {
    // Pas de name imposé → le backend génère "{PROJ_CLEAN}-S{N}" + goal "Itération N — {nomProjet}"
    this.withProject({}, pid => this.api.createSprint(pid, { capacityHours: 35 }));
  }
  delSprint(s: any): void { this.delEntity(() => this.api.deleteSprint(s.id)); }
  saveSprint(s: any, field: string, value: any): void { this.patchEntity(this.api.updateSprint.bind(this.api), s, field, value); }
  /** Reset & archive : renomme + sauvegarde Excel propre + delete projet. */
  async resetAndArchive(): Promise<void> {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const proj = this.currentProject();
    const code = proj?.code || '?';
    const prefix = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 6);
    const ok = await this.dialog.confirm({
      title: `RESET COMPLET du projet **${code}**`,
      message: `Cette opération clôt définitivement le projet après en avoir sauvegardé un Excel propre.`,
      kind: 'warning',
      confirmLabel: '🔄 Lancer le reset',
      details: [
        { label: 'Étape 1', value: `Rebrand "Sprint N" → "${prefix}-S{N}"` },
        { label: 'Étape 2', value: 'Sauvegarde Excel dans ~/.yamzy/exports/' },
        { label: 'Étape 3', value: 'Suppression projet (cascade tickets/sprints/risks/etc)' },
        { label: 'Réversible', value: 'Oui via ré-import du .xlsx archivé' },
      ]
    });
    if (!ok) return;
    const sure = await this.dialog.confirm({
      title: `Vraiment sûr ? **${code}** sera supprimé.`,
      message: `Dernière vérification avant action destructive.`,
      kind: 'error',
      confirmLabel: 'Oui, j\'archive et supprime',
    });
    if (!sure) return;
    this.api.resetAndArchive(pid).subscribe({
      next: async (r) => {
        await this.dialog.alert({
          title: 'Reset terminé — projet archivé',
          message: `Tu peux maintenant ré-importer l'Excel archivé via le bouton ⬆ Importer.`,
          kind: 'success',
          details: [
            { label: 'Sprints renommés', value: String(r.sprintsRenamed) },
            { label: 'Excel archivé', value: r.archivePath || '—' },
          ]
        });
        this.api.listProjects().subscribe(list => {
          this.api.projects.set(list);
          this.api.selectedProjectId.set(null);
        });
      },
      error: async (err) => await this.dialog.alert({
        title: 'Échec du reset',
        message: err?.error?.message || err?.message || 'Erreur inconnue.',
        kind: 'error'
      })
    });
  }

  /** One-click : rebrand tous les "Sprint N" existants → "{PROJ}-S{N}". */
  async rebrandSprints(): Promise<void> {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const ok = await this.dialog.confirm({
      title: 'Rebrand des sprints',
      message: `Renomme tous les sprints au format **{CODE_PROJET}-S{N}** (pattern Yamzy).`,
      kind: 'question',
      confirmLabel: '🏷 Rebrand',
      details: [
        { label: 'Pattern cible', value: '{PROJ_CLEAN}-S{N}' },
        { label: 'Idempotent', value: 'Oui — skip si déjà au bon format' },
        { label: 'Propagation', value: 'Tickets t.sprint mis à jour aussi' },
      ]
    });
    if (!ok) return;
    this.api.rebrandSprints(pid).subscribe({
      next: async (r) => {
        await this.dialog.alert({
          title: 'Rebrand terminé',
          message: `Les noms personnalisés ont été préservés.`,
          kind: 'success',
          details: [
            { label: 'Sprints renommés', value: `${r.renamed} sur ${r.total}` },
            { label: 'Tickets mis à jour', value: String((r as any).ticketsUpdated ?? '—') },
          ]
        });
        this.api.sprints(pid).subscribe({ next: s => this.sprints.set(s) });
        this.notifyExcelChanged(pid);
      },
      error: async (err) => await this.dialog.alert({
        title: 'Échec rebrand',
        message: err?.error?.message || err?.message || 'Erreur inconnue.',
        kind: 'error'
      })
    });
  }

  // ── Phases
  addPhase(): void {
    const n = (this.phases() || []).length + 1;
    this.withProject({}, pid => this.api.createPhase(pid, { name: 'Phase ' + n, plannedDays: 0, consumedDays: 0, orderIndex: n }));
  }
  delPhase(p: any): void { this.delEntity(() => this.api.deletePhase(p.id)); }
  savePhase(p: any, field: string, value: any): void { this.patchEntity(this.api.updatePhase.bind(this.api), p, field, value); }

  // ── Risks
  addRisk(): void {
    const n = (this.risks() || []).length + 1;
    this.withProject({}, pid => this.api.createRisk(pid, { riskId: 'R-' + n, description: 'Nouveau risque', type: '', probability: 'M', impact: 'M', score: 4, status: 'Ouvert' }));
  }
  delRisk(r: any): void { this.delEntity(() => this.api.deleteRisk(r.id)); }
  saveRisk(r: any, field: string, value: any): void { this.patchEntity(this.api.updateRisk.bind(this.api), r, field, value); }
  /** Recompute score = proba × impact quand l'un des deux change. */
  onRiskProbaImpactChange(r: any, field: 'probability' | 'impact', value: any): void {
    const num = Number(value);
    (r as any)[field] = num;
    const p = Number(r.probability) || 0;
    const i = Number(r.impact) || 0;
    const score = p * i;
    r.score = score;
    // Push 2 patchs : le champ modifié + score
    const pid = this.api.selectedProjectId();
    this.api.updateRisk(r.id, { [field]: num, score }).subscribe({
      next: () => { if (pid) this.notifyExcelChanged(pid); },
      error: (err) => console.warn('[wt] risk patch failed', err)
    });
  }

  // ── TechDebt
  addDebt(): void {
    const n = (this.techDebt() || []).length + 1;
    this.withProject({}, pid => this.api.createDebt(pid, { debtId: 'TD-' + n, title: 'Nouvelle dette', category: '', severity: 'Medium', estimatedCostHours: 0, status: 'Ouvert' }));
  }
  delDebt(d: any): void { this.delEntity(() => this.api.deleteDebt(d.id)); }
  saveDebt(d: any, field: string, value: any): void { this.patchEntity(this.api.updateDebt.bind(this.api), d, field, value); }

  // ── Lessons
  addLesson(): void {
    const n = (this.lessons() || []).length + 1;
    this.withProject({}, pid => this.api.createLesson(pid, { lessonId: 'L-' + n, lesson: 'Nouvelle leçon', recommendation: '', type: '' }));
  }
  delLesson(l: any): void { this.delEntity(() => this.api.deleteLesson(l.id)); }
  saveLesson(l: any, field: string, value: any): void { this.patchEntity(this.api.updateLesson.bind(this.api), l, field, value); }

  // ── ADRs
  addAdr(): void {
    const n = (this.adrs() || []).length + 1;
    this.withProject({}, pid => this.api.createAdr(pid, { adrId: 'ADR-' + n, decision: 'Nouvelle décision', rationale: '', date: new Date().toISOString().slice(0, 10) }));
  }
  delAdr(a: any): void { this.delEntity(() => this.api.deleteAdr(a.id)); }
  saveAdr(a: any, field: string, value: any): void { this.patchEntity(this.api.updateAdr.bind(this.api), a, field, value); }

  // ── Glossary
  addGlossary(): void {
    this.withProject({}, pid => this.api.createGlossary(pid, { term: 'Nouveau terme', definition: '', context: '' }));
  }
  delGlossary(g: any): void { this.delEntity(() => this.api.deleteGlossary(g.id)); }
  saveGlossary(g: any, field: string, value: any): void { this.patchEntity(this.api.updateGlossary.bind(this.api), g, field, value); }

  // ── Capacity
  addCapacity(): void {
    this.withProject({}, pid => this.api.createCapacity(pid, { memberName: 'Nouveau membre', role: '', allocationPercent: 100, hoursPerDay: 8 }));
  }
  delCapacity(c: any): void { this.delEntity(() => this.api.deleteCapacity(c.id)); }
  saveCapacity(c: any, field: string, value: any): void { this.patchEntity(this.api.updateCapacity.bind(this.api), c, field, value); }

  // ── Quarters
  addQuarter(): void {
    const n = (this.quarters() || []).length + 1;
    this.withProject({}, pid => this.api.createQuarter(pid, { quarter: 'Q' + n, theme: '', objective: '', deliverables: '', status: 'À venir' }));
  }
  delQuarter(q: any): void { this.delEntity(() => this.api.deleteQuarter(q.id)); }
  saveQuarter(q: any, field: string, value: any): void { this.patchEntity(this.api.updateQuarter.bind(this.api), q, field, value); }

  // ── Milestones
  addMilestone(): void {
    this.withProject({}, pid => this.api.createMilestone(pid, { date: new Date().toISOString().slice(0, 10), title: 'Nouveau jalon', status: 'À venir' }));
  }
  delMilestone(m: any): void { this.delEntity(() => this.api.deleteMilestone(m.id)); }
  saveMilestone(m: any, field: string, value: any): void { this.patchEntity(this.api.updateMilestone.bind(this.api), m, field, value); }

  // ── Overtime
  addOvertime(): void {
    this.withProject({}, pid => this.api.createOvertime(pid, { date: new Date().toISOString().slice(0, 10), plannedHours: 7, actualHours: 7, moodScore: 5 }));
  }
  delOvertime(o: any): void { this.delEntity(() => this.api.deleteOvertime(o.id)); }
  saveOvertime(o: any, field: string, value: any): void { this.patchEntity(this.api.updateOvertime.bind(this.api), o, field, value); }

  // ── Retros
  addRetro(): void {
    const n = (this.retros() || []).length + 1;
    this.withProject({}, pid => this.api.createRetro(pid, { sprintNumber: n, keepDoing: '', improve: '', startDoing: '', stopDoing: '' }));
  }
  delRetro(r: any): void { this.delEntity(() => this.api.deleteRetro(r.id)); }
  saveRetro(r: any, field: string, value: any): void { this.patchEntity(this.api.updateRetro.bind(this.api), r, field, value); }

  // ── Stakeholders
  addStakeholder(): void {
    this.withProject({}, pid => this.api.createStakeholder(pid, { name: 'Nouveau stakeholder', role: '' }));
  }
  delStakeholder(s: any): void { this.delEntity(() => this.api.deleteStakeholder(s.id)); }
  saveStakeholder(s: any, field: string, value: any): void { this.patchEntity(this.api.updateStakeholder.bind(this.api), s, field, value); }

  // ── Daily Standups
  addStandup(): void {
    this.withProject({}, pid => this.api.createStandup(pid, { date: new Date().toISOString().slice(0, 10), yesterday: '', today: '', blockers: '' }));
  }
  delStandup(s: any): void { this.delEntity(() => this.api.deleteStandup(s.id)); }
  saveStandup(s: any, field: string, value: any): void { this.patchEntity(this.api.updateStandup.bind(this.api), s, field, value); }
  /** Résout le nom d'un sprint via son `number`. Renvoie `name` si défini, sinon "Sprint N".
   *  Utilisé pour les vues qui n'ont que le sprintNumber (retros, feedback, vue-stakeholder). */
  sprintNameByNumber(num: number | null | undefined): string {
    if (num == null) return '';
    const sp = this.sprints().find(s => s.number === num);
    return sp?.name || ('Sprint ' + num);
  }

  /** 7 jours abrégés (calendrier) — bascule FR/EN. */
  weekdays = computed<string[]>(() => {
    this.i18n.lang(); this.i18n.version();
    return this.i18n.lang() === 'en'
      ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      : ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  });

  // ── Skin chrome (utilisateur + sprint actif + KPIs côté droit) ──
  user = computed(() => this.auth.currentUser());

  /** v1.0.177cp — Smart avatar URL :
   *  1. Si user.avatarUrl est une URL GitHub (avatars.githubusercontent.com) → l'utilise
   *  2. Sinon si user.githubLogin existe → construit `https://github.com/{login}.png`
   *     (GitHub redirige automatiquement vers la vraie photo)
   *  3. Sinon retourne avatarUrl tel quel (dicebear etc.) ou null pour fallback initiale */
  userAvatarUrl = computed<string | null>(() => {
    const u = this.user();
    if (!u) return null;
    const raw = u.avatarUrl || '';
    if (raw.includes('avatars.githubusercontent.com') || raw.includes('githubusercontent')) return raw;
    if (u.githubLogin && u.githubLogin !== 'guest' && u.githubLogin !== 'Anonymous') {
      return `https://github.com/${u.githubLogin}.png?size=200`;
    }
    return raw || null;
  });

  activeSprint = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const list = this.sprints();
    return list.find((s: any) => s.startDate && s.endDate && s.startDate <= today && s.endDate >= today) ?? list[0] ?? null;
  });

  sprintDayInfo = computed(() => {
    const s = this.activeSprint();
    if (!s?.startDate || !s?.endDate) return null;
    const start = new Date(s.startDate).getTime();
    const end = new Date(s.endDate).getTime();
    const now = Date.now();
    const total = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const day = Math.max(1, Math.min(total, Math.round((now - start) / 86400000) + 1));
    return { day, total };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // v1.0.177ch — KPI tiles V/T/C/L servent de TOGGLES des sections du cockpit
  //   V → 1ère partie (events / tickets / alerts)
  //   T → ACTUALITÉ DU PROJET (news cards)
  //   C → Pages reliées + TÂCHE EN COURS
  //   L → master switch : tout afficher / tout masquer
  // ═══════════════════════════════════════════════════════════════════════
  cockpitShow = signal<{ first: boolean; news: boolean; pagesAndWork: boolean; all: boolean }>({
    first: true, news: true, pagesAndWork: true, all: true,
  });
  private _cockpitShowLoaded = false;
  private loadCockpitShow(): void {
    if (this._cockpitShowLoaded) return;
    try {
      const raw = localStorage.getItem('yamzy.cockpitShow');
      if (raw) {
        const v = JSON.parse(raw);
        this.cockpitShow.set({
          first: v.first !== false,
          news: v.news !== false,
          pagesAndWork: v.pagesAndWork !== false,
          all: v.all !== false,
        });
      }
    } catch {}
    this._cockpitShowLoaded = true;
  }
  private saveCockpitShow(): void {
    try { localStorage.setItem('yamzy.cockpitShow', JSON.stringify(this.cockpitShow())); } catch {}
  }
  /** Toggle d'une section. La section 'all' est le master switch (force ON/OFF tout). */
  toggleCockpitSection(key: 'first' | 'news' | 'pagesAndWork' | 'all', ev?: Event): void {
    ev?.stopPropagation();
    this.loadCockpitShow();
    const cur = this.cockpitShow();
    if (key === 'all') {
      const newAll = !cur.all;
      this.cockpitShow.set({ first: newAll, news: newAll, pagesAndWork: newAll, all: newAll });
    } else {
      const next = { ...cur, [key]: !cur[key], all: true };
      // Si TOUT est devenu OFF → all aussi OFF
      if (!next.first && !next.news && !next.pagesAndWork) next.all = false;
      this.cockpitShow.set(next);
    }
    this.saveCockpitShow();
  }
  /** Map index → section. Utilisé dans le template. */
  cockpitSectionKey(index: number): 'first' | 'news' | 'pagesAndWork' | 'all' {
    return (['first', 'news', 'pagesAndWork', 'all'] as const)[index] || 'all';
  }
  /** Est-ce que la section est visible ? (utilisé pour les *ngIf). */
  isCockpitSectionVisible(key: 'first' | 'news' | 'pagesAndWork' | 'all'): boolean {
    this.loadCockpitShow();
    const c = this.cockpitShow();
    return key === 'all' ? c.all : c[key];
  }

  kpiTiles = computed(() => {
    const d = this.dash() || {};
    // touch i18n signals so tile recomputes when lang flips
    this.i18n.lang();
    this.i18n.version();
    const dayUnit = this.i18n.lang() === 'fr' ? 'j' : 'd';
    const fmt = (n: any, suf = '') => {
      if (n == null) return '—';
      const v = typeof n === 'number' ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : String(n);
      return v + suf;
    };
    return [
      { bg: '#4a8cda', label: 'V', value: fmt(d.velocity?.average ?? d.velocityAvg ?? d.velocity),     tip: this.i18n.t('dash.kpi_velocity') },
      { bg: '#de4f5f', label: 'T', value: fmt(d.throughputPerSprint ?? d.throughputPerWeek),           tip: this.i18n.t('dash.kpi_throughput') },
      { bg: '#d99b52', label: 'C', value: fmt(d.avgCycleTimeDays ?? d.cycleTimeAvg, dayUnit),          tip: this.i18n.t('dash.kpi_cycle') },
      { bg: '#6348b1', label: 'L', value: fmt(d.avgLeadTimeDays ?? d.leadTimeAvg, dayUnit),            tip: this.i18n.t('dash.kpi_lead') },
    ];
  });

  // Search FUSIONNÉE (header studio = même que skin) : pages + projets + tickets
  headerSearch = signal('');
  searchResults = computed(() => {
    const q = this.headerSearch().trim().toLowerCase();
    if (q.length < 2) return [];
    const out: any[] = [];
    // 1) Pages (sections du studio)
    for (const p of this.pages) {
      if (p.label.toLowerCase().includes(q) || p.id.includes(q) || p.cat.toLowerCase().includes(q))
        out.push({ kind: 'page', label: `${p.icon} ${p.label} · ${p.cat}`, id: p.id });
      if (out.length >= 5) break;
    }
    // 2) Projets
    for (const p of this.api.projects()) {
      if ((p.code || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q))
        out.push({ kind: 'project', label: `[${p.code}] ${p.name}`, id: p.id });
      if (out.length >= 10) break;
    }
    // 3) Tickets du projet actif
    for (const t of this.tickets()) {
      if ((t.ticketId || '').toLowerCase().includes(q) || (t.title || '').toLowerCase().includes(q))
        out.push({ kind: 'ticket', label: t.ticketId + ' — ' + t.title, id: t.id });
      if (out.length >= 16) break;
    }
    return out;
  });
  onHeaderSearchPick(r: any): void {
    this.headerSearch.set('');
    if (r.kind === 'page') {
      // v1.0.177bs — Fix : search → page ne setait QUE activePage, mais la page nécessite
      // studioLevel='section' + pageContentOpen=true pour s'afficher (sinon reste en preview/home).
      this.studioLevel.set('section');
      this.setPage(r.id);
      this.pageContentOpen.set(true);
    }
    else if (r.kind === 'project') this.selectProject(r.id);
    else {
      this.studioLevel.set('section');
      this.setPage('backlog');
      this.pageContentOpen.set(true);
      this.ticketFilter = String(r.label).split(' — ')[0];
    }
  }

  userTooltip(): string {
    const u = this.user();
    if (!u) return 'Guest';
    return `${u.name || u.githubLogin} — ${u.fantasyTitle || u.currentRole || ''}`;
  }
  initialsOf(name: string): string {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(w => w.charAt(0).toUpperCase()).join('') || '?';
  }
  memberGradient(m: any): string {
    const seed = String(m?.memberName || m?.member || m?.name || '?');
    return this.gradientFor(seed);
  }
  gradientFor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) >>> 0;
    const palettes: [string, string][] = [
      ['#6432c5', '#c25d8d'], ['#4696b9', '#70b944'], ['#eb8052', '#6647bf'],
      ['#d99b52', '#4a8cda'], ['#2ea1cb', '#a9ceb2'], ['#de4f5f', '#d99a51'],
    ];
    const [a, b] = palettes[h % palettes.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }

  // ════════════════ SKIN SIDEBAR (4 icônes + MORE drawer) ════════════════
  /** v1.0.63 — Sidebar gauche skin : 5 super-cats (Dashboard / Sprint / Planning / Reporting / Setup). */
  navLabels = computed(() => {
    this.i18n.lang(); this.i18n.version();
    return SUPER_CATS.map(sc => sc.label.toUpperCase());
  });
  /** v1.0.63 — Tuple [icon emoji, color] par super-cat pour le sidebar. */
  navSuperCatColor(i: number): string {
    return SUPER_CATS[i]?.color || '#a78bfa';
  }
  navSuperCatEmoji(i: number): string {
    return SUPER_CATS[i]?.icon || '⚔';
  }
  morePanelOpen = signal(false);

  /** v1.0.63 — Mapping page → super-cat index (0..4) pour highlight nav. */
  private superCatIndex(sc: SuperCat | null): number {
    const order: SuperCat[] = ['Dashboard', 'Sprint', 'Planning', 'Reporting', 'Setup'];
    return sc ? order.indexOf(sc) : 0;
  }
  navActive = computed(() => this.superCatIndex(this.activeSuperCat()));
  /** v1.0.157 — Couleur de la super-cat active (pour teinter le header au changement de section). */
  activeSuperCatColor = computed(() => this.navSuperCatColor(this.navActive()));

  /** Page par défaut pour chaque super-cat (1er click ouvre celle-là). */
  private readonly superCatDefaults: Record<SuperCat, string> = {
    'Dashboard': 'dashboard',
    'Sprint':    'backlog',
    'Planning':  'gantt',
    'Reporting': 'burndown',
    'Setup':     'parametres',
  };

  onNavClick(i: number): void {
    this.morePanelOpen.set(false);
    const order: SuperCat[] = ['Dashboard', 'Sprint', 'Planning', 'Reporting', 'Setup'];
    const sc = order[i];
    if (!sc) return;
    const targetPage = this.superCatDefaults[sc];
    this.setPage(targetPage);
    this.studioLevel.set('section');
    // v1.0.161 — Reste TOUJOURS en mode preview (header visible + contenu page dans carousel)
    // pour que le header se mette à jour visuellement au lieu de basculer en mode full-page.
    this.pageContentOpen.set(false);
    // Reset le hero panel + revient à slide 0 du carousel header
    this.heroPanelExpanded.set(false);
    this.psEmptyCarouselIndex.set(0);
  }

  /** Bouclier de navigation : la page DASHBOARD affiche le layout skin. */
  isDashboardSkin = computed(() => this.activePage() === 'dashboard');

  // v1.0.63 — Icônes SVG des 5 super-cats (Dashboard, Sprint, Planning, Reporting, Setup)
  private readonly navIcons = [
    // 0 Dashboard — home
    '<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>',
    // 1 Sprint — flag/target
    '<path d="M3 3a1 1 0 011-1h12a1 1 0 01.78 1.625L13.781 9l3 5.375A1 1 0 0116 16H4a1 1 0 01-1-1V3zm2 1v3h10l-2.222-3H5zm0 5v6h9.219L13 12l1.219-3H5z"/>',
    // 2 Planning — calendar grid
    '<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>',
    // 3 Reporting — chart bars
    '<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>',
    // 4 Setup — gear
    '<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>',
  ];
  navIconHtml(i: number): SafeHtml {
    return this.san.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="26" height="26">${this.navIcons[i] || ''}</svg>`);
  }
  moreIconHtml(): SafeHtml {
    return this.san.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="22" height="22"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>`);
  }

  // ════════════════ SKIN DASHBOARD EMBEDDED (Video + News + Top Selection) ═══
  projectProgress = computed(() => {
    const t = this.tickets();
    if (t.length) {
      const done = t.filter(x => /done|fait|fini|fermé|closed|terminé/i.test(x.status || '')).length;
      return Math.round((done / t.length) * 100);
    }
    const p = this.api.projects().find(x => x.id === this.api.selectedProjectId());
    if (p?.allocatedDays && p.allocatedDays > 0) return Math.round(100 * (p.consumedDays || 0) / p.allocatedDays);
    return 0;
  });

  selectedProjectInfo = computed(() =>
    this.api.projects().find(p => p.id === this.api.selectedProjectId()) ?? null);

  projectGradient = computed(() => {
    const p = this.selectedProjectInfo();
    return p ? this.gradientFor(p.code || p.name || '?')
             : 'linear-gradient(135deg,#3a6ea5,#c9a06a 60%,#2b2549)';
  });

  /** Flux d'activité récente (last ticket / last version / last risk / last tech debt). */
  newsList = computed<any[]>(() => {
    const items: any[] = [];
    const sorted = this.tickets().slice().sort((a, b) => (b.id || 0) - (a.id || 0));
    if (sorted[0]) items.push({
      title: sorted[0].ticketId + ' — ' + (sorted[0].title || '').slice(0, 28),
      subTitle: 'Statut: ' + (sorted[0].status || '—'),
      thumb: this.gradientFor(sorted[0].ticketId || 't'),
      tags: [{ text: (sorted[0].type || 'tâche').toLowerCase().slice(0, 8), color: '#d94b87' }],
      page: 'backlog',
    });
    const v = this.versions()[0];
    if (v) items.push({
      title: '🕒 ' + String(v.label || 'Snapshot').slice(0, 28),
      subTitle: 'Version — ' + String(v.createdAt || '').slice(0, 10),
      thumb: 'linear-gradient(135deg,#4696b9,#70b944)',
      tags: [{ text: 'version', color: '#4696b9' }],
      page: null, action: 'versions',
    });
    const r = this.risks()[0];
    if (r) items.push({
      title: '⚠ ' + String(r.title || r.description || 'Risque').slice(0, 28),
      subTitle: 'Sévérité: ' + (r.severity || r.impact || '—'),
      thumb: 'linear-gradient(135deg,#de4f5f,#eb8052)',
      tags: [{ text: 'risque', color: '#de4f5f' }],
      page: 'risks',
    });
    const d = this.techDebt()[0];
    if (d) items.push({
      title: '🔧 ' + String(d.title || d.description || 'Tech debt').slice(0, 28),
      subTitle: 'Effort: ' + (d.effort || d.cost || '—'),
      thumb: 'linear-gradient(135deg,#6647bf,#d99a51)',
      tags: [{ text: 'dette', color: '#6647bf' }],
      page: 'tech-debt',
    });
    return items;
  });

  onNewsClick(n: any): void {
    if (n.action === 'versions') this.versionsOpen.set(true);
    else if (n.page) this.setPage(n.page);
  }

  // Top Selection : 4 chips de filtre — labels réactifs FR/EN
  catActiveSkin = signal(1);
  catsSkin = computed(() => {
    this.i18n.lang(); this.i18n.version();
    return [
      this.i18n.t('dash.cat_all'),
      this.i18n.t('dash.cat_active'),
      this.i18n.t('dash.cat_archived'),
      this.i18n.t('dash.cat_templates'),
    ];
  });
  filteredProjectsSkin = computed(() => {
    const c = this.catActiveSkin();
    const all = this.api.projects();
    if (c === 0) return all;
    if (c === 1) return all.filter(p => !/archiv|fermé|closed/i.test(p.status || ''));
    if (c === 2) return all.filter(p =>  /archiv|fermé|closed/i.test(p.status || ''));
    return [];
  });
  progressOfProject(p: PosProject): number {
    if (p.allocatedDays && p.allocatedDays > 0) return Math.round(100 * (p.consumedDays || 0) / p.allocatedDays);
    return 0;
  }
  projectCardGradient(p: PosProject): string { return this.gradientFor(p.code || p.name || '?'); }
  selectProjectCard(p: PosProject): void {
    this.selectProject(p.id);
    this.setPage('backlog');
  }

  private readonly catSkinIcons = [
    '<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM13 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/>',
    '<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>',
    '<path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd"/>',
    '<path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>',
  ];
  catSkinIconHtml(i: number): SafeHtml {
    return this.san.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">${this.catSkinIcons[i] || ''}</svg>`);
  }

  // ─── 43 pages en 5 super-cats + 15 sous-cats — source unique partagée avec le skin ───
  readonly pages: PageDef[] = WAR_TABLE_PAGES;
  readonly categories = [...new Set(this.pages.map(p => p.cat))];
  /** v1.0.61 — 5 grandes catégories de navigation. */
  readonly superCats: SuperCatDef[] = SUPER_CATS;
  /** Sous-cats par super-cat (ordre préservé). */
  subCatsForSuperCat(sc: SuperCat): string[] {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of this.pages) {
      if (p.superCat === sc && !seen.has(p.cat)) { seen.add(p.cat); list.push(p.cat); }
    }
    return list;
  }
  /** Pages d'une super-cat (filtrées par recherche). */
  pagesInSuperCat(sc: SuperCat): PageDef[] {
    const f = this.search.toLowerCase().trim();
    return this.pages.filter(p => p.superCat === sc && (!f || p.label.toLowerCase().includes(f)));
  }
  /** Pages dans une super-cat + sous-cat. */
  pagesInSubCat(sc: SuperCat, cat: string): PageDef[] {
    const f = this.search.toLowerCase().trim();
    return this.pages.filter(p => p.superCat === sc && p.cat === cat && (!f || p.label.toLowerCase().includes(f)));
  }
  /** État d'ouverture des super-cats (1 ouverte par défaut : Dashboard). */
  openSuperCats = signal<Set<SuperCat>>(new Set<SuperCat>(['Dashboard']));
  isSuperCatOpen(sc: SuperCat): boolean {
    if (this.search.trim()) return this.pagesInSuperCat(sc).length > 0;
    return this.openSuperCats().has(sc);
  }
  toggleSuperCat(sc: SuperCat): void {
    const s = new Set(this.openSuperCats());
    s.has(sc) ? s.delete(sc) : s.add(sc);
    this.openSuperCats.set(s);
  }
  /** Super-cat de la page active (pour highlight). */
  activeSuperCat = computed<SuperCat | null>(() => {
    const p = this.pages.find(p => p.id === this.activePage());
    return p ? p.superCat : null;
  });

  // ═══ v1.0.125 — Profile + Settings pages (modals page-style) ═══
  profilePageOpen = signal(false);
  settingsPageOpen = signal(false);
  /** Logout : clear JWT + redirect /login. */
  logoutUser(): void {
    if (!confirm('Se déconnecter du studio ?')) return;
    this.auth.clearSession();
    this.router.navigate(['/login']);
  }

  // ═══ v1.0.117 — Tabs Page Hero : Guide (Scrum.org info) vs Action (contenu page) ═══
  // v1.0.120 — Default 'action' pour que l'user voie le contenu de suite (table, calendrier…).
  // Le tab 'guide' est disponible mais explicite (decouverte Scrum.org).
  heroTab = signal<'guide' | 'action'>('action');
  setHeroTab(t: 'guide' | 'action'): void { this.heroTab.set(t); }
  /** Quand on switch de page, on revient au tab par defaut (Action). */
  resetHeroTab(): void { this.heroTab.set('action'); }

  // ═══ v1.0.111 — PAGE HERO GAMING ═══
  /** Metadata enrichies de la page active. */
  activePageMeta = computed<PageMeta>(() => getPageMeta(this.activePage()));
  /** Pages liees (relatedPages dans PAGE_META) avec leur card + label resolus. */
  relatedPagesResolved = computed(() => {
    const meta = this.activePageMeta();
    return (meta.relatedPages || [])
      .map(pid => WAR_TABLE_PAGES.find(p => p.id === pid))
      .filter((p): p is PageDef => !!p)
      .map(p => ({
        id: p.id,
        label: p.label,
        icon: p.icon,
        card: p.card,
        color: this.superCats.find(s => s.id === p.superCat)?.color || '#d99a51',
      }));
  });
  /** Labels role -> { label, icon, color } (helper template). */
  roleInfo(role: ScrumRole) { return ROLE_LABELS[role]; }
  /** Active actions (filtre selon editMode). */
  activeQuickActions = computed<ActionDef[]>(() => {
    return (this.activePageMeta().quickActions || []).filter(a => !a.edit || this.editMode());
  });

  // ═══ v1.0.144 — Versions "featured" : utilisent carouselFeaturedPage() pour
  // afficher dans le slot du carousel le pro-hero correspondant à la page mise en
  // avant (pas la page active). Sur slide 0 on retombe sur la page active.
  featuredPageId = computed<string>(() =>
    // Priorité : heroPanelPageId (set par click sur une card YAMZY) > carousel featured > active page
    this.heroPanelPageId() || this.carouselFeaturedPage()?.id || this.activePage()
  );
  featuredPageLabel = computed<string>(() => {
    const id = this.featuredPageId();
    return this.pages.find(p => p.id === id)?.label || this.activePageLabel();
  });
  featuredPageCard = computed<string | null>(() => {
    const id = this.featuredPageId();
    return this.pages.find(p => p.id === id)?.card || this.activePageCard();
  });
  featuredPageMeta = computed<PageMeta>(() => getPageMeta(this.featuredPageId()));
  featuredRelatedPagesResolved = computed(() => {
    const meta = this.featuredPageMeta();
    return (meta.relatedPages || [])
      .map(pid => WAR_TABLE_PAGES.find(p => p.id === pid))
      .filter((p): p is PageDef => !!p)
      .map(p => ({
        id: p.id,
        label: p.label,
        icon: p.icon,
        card: p.card,
        color: this.superCats.find(s => s.id === p.superCat)?.color || '#d99a51',
      }));
  });
  featuredQuickActions = computed<ActionDef[]>(() =>
    (this.featuredPageMeta().quickActions || []).filter(a => !a.edit || this.editMode())
  );
  featuredPageHeaderInfo = computed(() => {
    const id = this.featuredPageId();
    const lang = this.i18n.lang() as 'fr' | 'en';
    const entry: any = (TOOLTIP_GUIDE as any)[id];
    const tr = entry?.[lang] || entry?.fr || null;
    return {
      tag: tr?.scrum ? `[${tr.scrum.toUpperCase()}]` : id.toUpperCase(),
      tagColor: '#3482e7',
    };
  });

  /** Map des actionId vers les vraies methodes du composant.
   *  Si une action n'a pas de mapping, on tente un fallback intelligent. */
  executeAction(actionId: string): void {
    switch (actionId) {
      // Tickets
      case 'add-ticket':        this.addTicket(); break;
      case 'bulk-edit':         this.editMode.set(true); break;
      case 'export-excel':      this.doExport(); break;
      case 'refinement':        this.ticketFilter = ''; this.editMode.set(true); break;
      // Sprints
      case 'add-sprint':        if (this.editMode) this.editMode.set(true); break;
      case 'launch-sprint':     if (this.launchableInfo()) this.doLaunchSprint(); else this.setPage('sprints'); break;
      case 'reset-archive':     this.resetAndArchive(); break;
      case 'regen-ceremonies':  this.regenerateScrumCeremonies(); break;
      case 'rebrand-sprints':   this.rebrandSprints(); break;
      // Events / Calendrier
      case 'new-event':         this.openNewEvent(); break;
      case 'start-planning':
      case 'start-review':
      case 'start-retro':
      case 'start-daily':       this.openNewEvent(); break;
      case 'export-ical':       this.downloadIcal(); break;
      // Risks / Lessons
      case 'add-risk':          this.editMode.set(true); this.setPage('risks'); break;
      case 'add-lesson':        this.editMode.set(true); this.setPage('lessons'); break;
      case 'add-debt':          this.editMode.set(true); this.setPage('tech-debt'); break;
      // Stakeholders
      case 'add-stake':         this.editMode.set(true); this.setPage('stakeholders'); break;
      // Setup / Config
      case 'edit-config':
      case 'edit-dod':
      case 'edit-dor':
      case 'edit-ticket':
      case 'edit-allocation':
      case 'create-template':
      case 'create-project':
      case 'configure-widgets':
      case 'customize-template':
      case 'customize':         this.editMode.set(true); break;
      // Capacity / Team
      case 'add-member':        this.editMode.set(true); this.setPage('capacity'); break;
      // Recherche / filtres
      case 'search-reports':
      case 'filter-reports':    this.setPage('meeting-reports'); break;
      case 'show-blockers':     this.ticketFilter = 'BLOQUE'; break;
      case 'show-cfd':
      case 'show-velocity':     this.setPage('cfd-velocity'); break;
      // Roadmap / phases
      case 'open-roadmap':      this.setPage('roadmap'); break;
      case 'add-milestone':     this.editMode.set(true); this.setPage('roadmap'); break;
      // Onboarding
      case 'open-tour':
      case 'show-shortcuts':    this.setPage('mode-emploi'); break;
      // Language
      case 'language':          this.i18n.setLang(this.i18n.lang() === 'fr' ? 'en' : 'fr'); break;
      // Defaults / unmapped : juste set edit mode
      default:
        console.info('[PageHeroAction] action non mappee :', actionId, '- mode edition active');
        this.editMode.set(true);
    }
  }

  /** v1.0.81 — Carte Yamzy de la page active (nom de fichier sans extension). */
  activePageCard = computed<string | null>(() => {
    const p = this.pages.find(p => p.id === this.activePage());
    return p?.card || null;
  });

  // ═══ v1.0.99 — CARD COLOR PICKER (EyeDropper API) ═══
  // Chaque carte est mappee a une couleur custom (extraite via pipette du PNG).
  // Cette couleur sert au background gradient anime de .wt-ps-header.
  // Mapping persiste en localStorage + bouton "Copy" pour que l'user me communique
  // la valeur finale, que je hardcode ensuite dans CARD_COLOR_MAP (mapping permanent).
  /** Mapping permanent (hardcode) carte → couleur de base. Sera enrichi au fur et a mesure. */
  static readonly CARD_COLOR_MAP: Record<string, string> = {
    // Hardcoder ici les couleurs que l'user me communique (via Copy color)
    // Format : 'NomCarte': '#hexcolor'
  };
  /** Couleurs custom (localStorage, override le mapping permanent). */
  cardColors = signal<Record<string, string>>(this.loadCardColors());

  // ═══ v1.0.169 — Mapping 3 couleurs PAR CARTE (utilisé pour le gradient du header) ═══
  // Chaque carte a un tableau [c1, c2, c3] qui devient --card-c1/c2/c3 dans le header.
  // Stocké dans localStorage sous 'wt_cards_colors_3map'. Copie en bulk via copyAllCardColorsMapping().
  private readonly CARDS_COLORS_MAP_KEY = 'wt_cards_colors_3map';
  cardsColorsMap = signal<Record<string, string[]>>(this.loadCardsColorsMap());

  private loadCardsColorsMap(): Record<string, string[]> {
    try {
      const raw = localStorage.getItem(this.CARDS_COLORS_MAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  private saveCardsColorsMap(map: Record<string, string[]>): void {
    try { localStorage.setItem(this.CARDS_COLORS_MAP_KEY, JSON.stringify(map)); } catch {}
  }

  /** Liste TRIÉE de toutes les cartes uniques utilisées dans WAR_TABLE_PAGES. */
  uniqueCardsList = computed<string[]>(() => {
    const set = new Set<string>();
    this.pages.forEach((p: any) => { if (p.card) set.add(p.card); });
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a.split('_')[0], 10);
      const nb = parseInt(b.split('_')[0], 10);
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
    });
  });

  /** v1.0.177dx — Mapping AUTOMATIQUE des 3 couleurs principales par carte.
   * Analyse manuelle du thème visuel (élément + ambiance) de chaque illustration.
   * Override possible via localStorage (interface mapping). */
  static readonly DEFAULT_CARDS_COLORS: Record<string, [string, string, string]> = {
    // 🃏 0 — Dos de carte : violet sombre doré
    '0_CardBack':           ['#d99a51', '#6647bf', '#1a1430'],
    // 🔥 1 — Fireball : feu vif
    '1_Fireball':           ['#ff5722', '#ff9800', '#7a1d00'],
    // 🍄 2 — Champignons trenchcoat : brun, vert spore, jaune
    '2_TrenchcoatMushrooms':['#8b5a2b', '#7cb342', '#f9a825'],
    // 🧎 3 — Monk : brun moine, beige, blanc divin
    '3_Monk':               ['#6d4c41', '#d7ccc8', '#fff8e1'],
    // 🛒 4 — Market : doré, brun, vert pièces
    '4_Market':             ['#ffc107', '#795548', '#43a047'],
    // 🥷 5 — Steal : noir, rouge sombre, gris
    '5_Steal':              ['#1a1a1a', '#b71c1c', '#616161'],
    // 👑 6 — King : rouge royal, doré, noir cape
    '6_King':               ['#c62828', '#ffd54f', '#1a1a1a'],
    // ☠ 7 — StinkTrap : vert puanteur, jaune, brun
    '7_StinkTrap':          ['#7cb342', '#fdd835', '#5d4037'],
    // ⚡ 8 — LightningWizard : bleu, blanc, gris orage
    '8_LightningWizard':    ['#1e88e5', '#ffffff', '#37474f'],
    // 🌀 9 — Hypnosis : violet, magenta, blanc spirale
    '9_Hypnosis':           ['#8e24aa', '#e91e63', '#ffffff'],
    // 🐝 10 — Beehive : jaune ruche, brun, noir
    '10_Beehive':           ['#fbc02d', '#6d4c41', '#1a1a1a'],
    // 🌼 11 — Polinization : jaune, vert, bleu fleur
    '11_Polinization':      ['#fdd835', '#43a047', '#2196f3'],
    // 🦷 12 — Mimic : brun coffre, vert acide, rouge dents
    '12_Mimic':             ['#5d4037', '#7cb342', '#d32f2f'],
    // 🐉 13 — SeaMonster : bleu marine, vert sombre, blanc écume
    '13_SeaMonster':        ['#1565c0', '#1b5e20', '#e0f7fa'],
    // 🪙 14 — Coin : or, bronze, brun
    '14_Coin':              ['#ffc107', '#bf6e0c', '#5d4037'],
    // 🩸 15 — Cult : rouge sang, noir, doré rituel
    '15_Cult':              ['#b71c1c', '#1a1a1a', '#d99a51'],
    // 🔔 16 — Belltowers : doré cloche, gris pierre, bleu ciel
    '16_Belltowers':        ['#d4a017', '#9e9e9e', '#90caf9'],
    // 🌸 17 — Rebirth : rose, vert clair, blanc renaissance
    '17_Rebirth':           ['#ec407a', '#aed581', '#fff8e1'],
    // 🐲 18 — WaterDragon : bleu profond, cyan, blanc écume
    '18_WaterDragon':       ['#01579b', '#4dd0e1', '#e1f5fe'],
    // 💎 19 — OceanTreasure : bleu turquoise, doré, blanc nacre
    '19_OceanTreasure':     ['#00838f', '#ffd54f', '#e0f2f1'],
    // 🔥 20 — Element Fire : rouge orange jaune vif
    '20_Element_Fire':      ['#d32f2f', '#ff6f00', '#ffd600'],
    // ⚡ 21 — Element Lightning : jaune électrique, bleu, blanc
    '21_Element_Lightning': ['#fff176', '#1976d2', '#ffffff'],
    // 💨 22 — Element Air : blanc, gris clair, bleu pâle
    '22_Element_Air':       ['#eceff1', '#b0bec5', '#bbdefb'],
    // 💧 23 — Element Water : bleu profond, cyan vif, blanc
    '23_Element_Water':     ['#0277bd', '#26c6da', '#e1f5fe'],
    // 🌑 24 — Element Dark : violet sombre, noir, mauve fumé
    '24_Element_Dark':      ['#311b92', '#1a1a1a', '#7b1fa2'],
    // 🌍 25 — Element Earth : brun, vert mousse, ocre
    '25_Element_Earth':     ['#6d4c41', '#558b2f', '#d4a017'],
    // 💍 26 — BloodRing : rouge sang, noir cape, doré anneau
    '26_BloodRing':         ['#b71c1c', '#1a1a1a', '#d99a51'],
    // 📖 27 — Book : vert émeraude, doré, vieux papier
    '27_Book':              ['#1b5e20', '#d99a51', '#fff8e1'],
    // 🎲 28 — RollDice : blanc, noir, rouge points
    '28_RollDice':          ['#fafafa', '#1a1a1a', '#c62828'],
    // 🧱 29 — Block : gris pierre, brun, gris foncé
    '29_Block':             ['#9e9e9e', '#6d4c41', '#424242'],
    // 🧙 30 — Wizard : violet magique, doré, bleu étoiles
    '30_Wizard':            ['#7b1fa2', '#ffd54f', '#1976d2'],
  };

  /** Retourne la couleur stockée pour une carte à un index donné (0/1/2) :
   *  1) override localStorage, 2) défaut hardcodé v1.0.177dx, 3) null. */
  getCardColor3(card: string, idx: number): string | null {
    return this.cardsColorsMap()[card]?.[idx]
        || WarTableComponent.DEFAULT_CARDS_COLORS[card]?.[idx]
        || null;
  }

  /** Définit une couleur dans le mapping et sauvegarde dans localStorage. */
  setCardColor3(card: string, idx: number, color: string): void {
    this.cardsColorsMap.update(m => {
      const next = { ...m };
      next[card] = next[card] ? [...next[card]] : ['', '', ''];
      next[card][idx] = color;
      this.saveCardsColorsMap(next);
      return next;
    });
  }

  /** Pipette EyeDropper pour une carte donnée — remplit le 1er slot vide ou le slot indiqué. */
  async pickCardColor3(card: string, idx: number, ev: Event): Promise<void> {
    ev.stopPropagation();
    const w = window as any;
    if (!w.EyeDropper) {
      alert('⚠ Pipette non supportée par ce navigateur (utilise Chrome ou Edge).');
      return;
    }
    try {
      const ed = new w.EyeDropper();
      const result = await ed.open();
      this.setCardColor3(card, idx, result.sRGBHex);
    } catch { /* user cancelled */ }
  }

  /** Copie tout le mapping (STATUTS + CARTES) au format lisible dans le presse-papier. */
  copyAllCardColorsMapping(): void {
    const m = this.cardsColorsMap();
    // Statuts (4 hard-codés)
    const statusLines = this.statusHeaders.map(st => {
      const colors = m['__status_' + st.id] || st.defaultColors;
      return `  'is-${st.id}': ['${colors[0]}', '${colors[1]}', '${colors[2]}']`;
    });
    // Cartes (30 PNG)
    const cardLines = this.uniqueCardsList().map(card => {
      const colors = m[card] || ['', '', ''];
      return `  '${card}': ['${colors[0] || ''}', '${colors[1] || ''}', '${colors[2] || ''}']`;
    });
    const text = `// ═══ STATUTS (hard-codés .wt-ps-header.is-*) ═══\n{\n${statusLines.join(',\n')}\n}\n\n// ═══ CARTES PNG ═══\n{\n${cardLines.join(',\n')}\n}`;
    navigator.clipboard?.writeText(text)
      .then(() => alert('✅ Mapping copié : ' + statusLines.length + ' statuts + ' + cardLines.length + ' cartes'))
      .catch(() => alert('❌ Erreur copie. Texte:\n' + text));
  }

  /** Reset complet du mapping (avec confirmation). */
  resetAllCardColorsMapping(): void {
    if (!confirm('Réinitialiser TOUT le mapping des couleurs ?')) return;
    this.cardsColorsMap.set({});
    this.saveCardsColorsMap({});
  }

  // ═══ v1.0.170 — Mapping pour les 4 STATUTS hard-codés du header (is-launchable / is-today / etc.) ═══
  // Synchronisé avec wt-ps-header.is-* dans le CSS. Permet aussi de mapper 3 couleurs par statut.
  readonly statusHeaders: Array<{ id: string; label: string; description: string; defaultColors: string[] }> = [
    { id: 'launchable', label: 'LAUNCHABLE (UPCOMING)', description: 'Sprint prêt à être lancé', defaultColors: ['#70b944', '#3a3c47', '#000000'] },
    { id: 'today',      label: 'LAUNCHABLE TODAY',      description: 'Sprint à lancer aujourd\'hui', defaultColors: ['#d99a51', '#3a3c47', '#000000'] },
    { id: 'overdue',    label: 'LAUNCHABLE OVERDUE',    description: 'Sprint en retard',           defaultColors: ['#de4f5f', '#3a3c47', '#000000'] },
    { id: 'active',     label: 'ACTIVE',                description: 'Sprint en cours',            defaultColors: ['#2ea1cb', '#3a3c47', '#000000'] },
  ];

  getStatusColor3(statusId: string, idx: number): string | null {
    const m = this.cardsColorsMap();
    return m['__status_' + statusId]?.[idx] || null;
  }
  setStatusColor3(statusId: string, idx: number, color: string): void {
    this.setCardColor3('__status_' + statusId, idx, color);
  }
  async pickStatusColor3(statusId: string, idx: number, ev: Event): Promise<void> {
    return this.pickCardColor3('__status_' + statusId, idx, ev);
  }

  /** Couleur de la carte active (null si pas de couleur custom). */
  activeCardColor = computed<string | null>(() => {
    const card = this.activePageCard();
    if (!card) return null;
    return this.cardColors()[card] || WarTableComponent.CARD_COLOR_MAP[card] || null;
  });
  // ═══ v1.0.177eo/er — Liste DYNAMIQUE des pages de la SECTION courante (= carrousel courant).
  // Chaque super-cat (Dashboard, Sprint, Planning…) a ses propres pages.
  // Affichées comme boutons icônes circulaires utilisant le PNG ORIGINAL de la carte.
  dashboardRadialPages = computed<Array<{ page: any; iconSrc: string }>>(() => {
    const ordered = this.carouselOrderedPages();
    return ordered.map(page => ({
      page,
      // v1.0.177er — utilise le PNG ORIGINAL de la carte (pas le SVG généré)
      iconSrc: page.card ? `assets/cards/${page.card}.png` : '',
    })).filter(item => !!item.iconSrc);
  });

  /** v1.0.177ek — Couleur la plus VIVE/SATUREE des 3 (c1/c2/c3) pour l'éclat magique dangereux.
   *  Compare en HSL : score = saturation × (1 - |luminance - 0.55|) pour éviter le pur blanc/noir.
   *  Utilisée pour le lens flare + sparkles magiques (pour qu'ils soient visibles même si c1 est sombre). */
  activeCardVividColor = computed<string>(() => {
    const g = this.activeCardGradient();
    if (!g) return '#d99a51';
    const candidates = [g.c1, g.c2, g.c3].filter(c => c && c.startsWith('#'));
    if (!candidates.length) return '#d99a51';
    let bestColor = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      const hsl = this.hexToHsl(c);
      // Score = saturation pondérée par proximité d'une luminance vibrante (0.5-0.6)
      const lumPenalty = Math.abs(hsl.l - 0.55);
      const score = hsl.s * (1 - lumPenalty);
      if (score > bestScore) {
        bestScore = score;
        bestColor = c;
      }
    }
    return bestColor;
  });

  /** v1.0.177eh — Carte EFFECTIVEMENT affichée (suit le CARROUSEL).
   *  Sur slide 0 → activePageCard (page courante normale)
   *  Sur slide 1+ → carouselDisplayedCard (page featured du carrousel)
   *  Utilisée par les couleurs ET le motif du header pour qu'ils suivent le carrousel. */
  effectiveDisplayedCard = computed<string | null>(() => {
    if (this.psEmptyCarouselIndex() === 0) return this.activePageCard();
    return this.carouselDisplayedCard() || this.activePageCard();
  });

  /** v1.0.177eb/ee/eh — 3 couleurs pour le gradient header. MERGE SLOT-PAR-SLOT.
   *  v1.0.177eh — utilise effectiveDisplayedCard pour suivre le carrousel. */
  activeCardGradient = computed<{ c1: string; c2: string; c3: string } | null>(() => {
    const card = this.effectiveDisplayedCard();
    if (!card) return null;
    const stored = this.cardsColorsMap()[card] || ['', '', ''];
    const dflt = WarTableComponent.DEFAULT_CARDS_COLORS[card] || ['', '', ''];
    // Merge slot-par-slot : override individuel ou défaut hardcodé
    const c1 = stored[0] || dflt[0];
    const c2 = stored[1] || dflt[1];
    const c3 = stored[2] || dflt[2];
    if (c1 && c2 && c3) return { c1, c2, c3 };
    // Fallback : ancien système 1-couleur + derive
    const base = this.activeCardColor();
    if (!base) return null;
    return this.deriveGradientColors(base);
  });

  private loadCardColors(): Record<string, string> {
    try {
      const raw = localStorage.getItem('wt_card_colors');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  private saveCardColors(map: Record<string, string>): void {
    try { localStorage.setItem('wt_card_colors', JSON.stringify(map)); } catch {}
  }

  /** Convertit hex (#rrggbb) → HSL. */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m || m.length < 3) return { h: 0, s: 0, l: 0.5 };
    const [r, g, b] = m.slice(0, 3).map(x => parseInt(x, 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let s = 0, h = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = ((b - r) / d + 2);
      else h = ((r - g) / d + 4);
      h *= 60;
    }
    return { h, s, l };
  }
  /** HSL → hex (#rrggbb). */
  private hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if      (h <  60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
  /** A partir d'une couleur base, derive 3 stops complementaires pour le gradient. */
  private deriveGradientColors(base: string): { c1: string; c2: string; c3: string } {
    const hsl = this.hexToHsl(base);
    // c1 = teinte +25°, plus lumineuse (highlight gold-like)
    const c1 = this.hslToHex(hsl.h + 25, Math.min(1, hsl.s + 0.1), Math.min(0.85, hsl.l + 0.18));
    // c2 = couleur base exacte (le centre du gradient, 43%)
    const c2 = base;
    // c3 = teinte -30°, plus sombre + plus saturee (purple-like depth)
    const c3 = this.hslToHex(hsl.h - 30, Math.min(1, hsl.s + 0.15), Math.max(0.18, hsl.l - 0.22));
    return { c1, c2, c3 };
  }

  /** v1.0.100 — Toast inline non-bloquant pour confirmer la couleur (header reste visible). */
  colorToast = signal<{ card: string; color: string } | null>(null);
  private colorToastTimer: any = null;
  private showColorToast(card: string, color: string): void {
    if (this.colorToastTimer) clearTimeout(this.colorToastTimer);
    this.colorToast.set({ card, color });
    this.colorToastTimer = setTimeout(() => {
      this.colorToast.set(null);
      this.colorToastTimer = null;
    }, 4500);
  }
  dismissColorToast(): void {
    if (this.colorToastTimer) { clearTimeout(this.colorToastTimer); this.colorToastTimer = null; }
    this.colorToast.set(null);
  }
  /** Copie le mapping de la carte active dans le presse-papier (depuis le toast). */
  async copyColorMapping(): Promise<void> {
    const t = this.colorToast();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(`'${t.card}': '${t.color}',`);
    } catch {}
  }

  /** v1.0.100 — Applique une couleur a la carte active (live, sans modal). */
  private applyCardColor(color: string, opts: { showToast: boolean; copyClipboard: boolean }): void {
    const card = this.activePageCard();
    if (!card) return;
    const map = { ...this.cardColors(), [card]: color };
    this.cardColors.set(map);
    this.saveCardColors(map);
    if (opts.copyClipboard) {
      try { navigator.clipboard.writeText(`'${card}': '${color}',`); } catch {}
    }
    if (opts.showToast) this.showColorToast(card, color);
  }

  /** v1.0.100 — Handler du <input type="color"> : preview LIVE pendant que l'user
   *  glisse dans la roue chromatique. Sauvegarde a chaque event 'input'. */
  onColorInputChange(ev: Event): void {
    ev.stopPropagation();
    const color = (ev.target as HTMLInputElement).value;
    this.applyCardColor(color, { showToast: false, copyClipboard: false });
  }
  /** Quand l'user FERME la color box, on copy + toast (action finale). */
  onColorInputCommit(ev: Event): void {
    ev.stopPropagation();
    const color = (ev.target as HTMLInputElement).value;
    this.applyCardColor(color, { showToast: true, copyClipboard: true });
  }

  /** Ouvre la pipette EyeDropper (Chrome/Edge 95+) pour extraire une couleur.
   *  v1.0.100 — Plus de modal bloquant. Toast inline non-bloquant + copy auto. */
  async pickHeaderColor(ev: Event): Promise<void> {
    ev.stopPropagation();
    ev.preventDefault();
    const card = this.activePageCard();
    if (!card) return;
    const Eye = (window as any).EyeDropper;
    if (!Eye) {
      // Fallback : trigger le <input type="color"> a la place
      const input = document.querySelector('.wt-ps-color-input') as HTMLInputElement;
      if (input) input.click();
      return;
    }
    try {
      const eyeDropper = new Eye();
      const result = await eyeDropper.open();
      const color = result.sRGBHex as string;
      this.applyCardColor(color, { showToast: true, copyClipboard: true });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('[EyeDropper]', e);
    }
  }

  /** Reset la couleur custom de la carte active (revient au gradient default). */
  resetHeaderColor(ev: Event): void {
    ev.stopPropagation();
    const card = this.activePageCard();
    if (!card) return;
    const map = { ...this.cardColors() };
    delete map[card];
    this.cardColors.set(map);
    this.saveCardColors(map);
    this.dismissColorToast();
  }

  /** v1.0.98 — Mini cartes dispersées en TRIANGLE diagonal (top-right → bot-left).
   *  Chaque mini reçoit top%/left% absolute pour se positionner DANS le triangle
   *  formé par la diagonale du header. Le big card occupe le coin bot-right. */
  superCatFloatingMinis = computed(() => {
    const cards = this.superCatPagesCards().filter(c => !c.isActive);
    // Positions absolute en % du container .wt-ps-mini-row.
    // x+y ≈ 100% (sur la diagonale) avec variance + rotation random.
    const positions = [
      { top: 5,  left: 78, rot: -12, delay: 0    },
      { top: 12, left: 64, rot:   6, delay: 0.18 },
      { top: 22, left: 50, rot:  -7, delay: 0.36 },
      { top: 32, left: 38, rot:  10, delay: 0.54 },
      { top: 42, left: 26, rot:  -5, delay: 0.72 },
      { top: 55, left: 14, rot:   8, delay: 0.90 },
      { top: 18, left: 70, rot:   4, delay: 1.08 },
      { top: 28, left: 56, rot:  -9, delay: 1.26 },
      { top: 40, left: 42, rot:   5, delay: 1.44 },
      { top: 52, left: 28, rot:  -6, delay: 1.62 },
      { top: 68, left: 4,  rot:   3, delay: 1.80 },
    ];
    return cards.map((c, i) => {
      const p = positions[i % positions.length];
      return { ...c, topPct: p.top, leftPct: p.left, rotate: p.rot, delay: p.delay };
    });
  });

  /** v1.0.73 — Helpers pour le breadcrumb footer (HOME > Super-cat > Page). */
  superCatLabel(sc: SuperCat): string {
    return this.superCats.find(s => s.id === sc)?.label || sc;
  }
  superCatColor(sc: SuperCat): string {
    return this.superCats.find(s => s.id === sc)?.color || '#d99a51';
  }
  superCatIndexFor(sc: SuperCat): number {
    const order: SuperCat[] = ['Dashboard', 'Sprint', 'Planning', 'Reporting', 'Setup'];
    return order.indexOf(sc);
  }

  /** v1.0.70 — Pages de la super-cat active, regroupées par sous-cat,
   *  pour affichage dans le cockpit (cards cliquables après ACTUALITÉ DU PROJET). */
  superCatPagesCards = computed<{ page: PageDef; isActive: boolean; color: string }[]>(() => {
    const sc = this.activeSuperCat();
    if (!sc) return [];
    const scDef = this.superCats.find(s => s.id === sc);
    const color = scDef?.color || '#d99a51';
    const active = this.activePage();
    return this.pages
      .filter(p => p.superCat === sc)
      .map(p => ({ page: p, isActive: p.id === active, color }));
  });
  /** Pages déjà implémentées (sinon placeholder). */
  readonly implemented = new Set([
    'dashboard', 'backlog', 'backlog-tma', 'sprints', 'burndown', 'gantt', 'risks', 'tech-debt', 'lessons',
    'phases', 'capacity', 'roadmap', 'overtime', 'retros', 'knowledge', 'cfd-velocity', 'dependances',
    'projets', 'detail-tickets', 'vue-reviewer', 'vue-sprint', 'sprint-review', 'sprint-planning',
    'calendrier', 'agenda', 'dod', 'dor', 'templates', 'parametres', 'mode-emploi', 'routine', 'checkup',
    'daily', 'nouveau-projet', 'regen-alloc', 'dashboard-param', 'dashboard-legacy', 'vue-stakeholder',
    'stakeholders', 'export-stakeholder', 'allocation', 'charge', 'listes',
  ]);

  activePage = signal<string>('dashboard');
  openCats = signal<Set<string>>(new Set(['Dashboards', 'Backlogs', 'Cérémonies', 'Métriques']));

  // ═══════════════ TIME TRAVELER MODE ═══════════════
  // Ouvre une page consacrée au cosmos en plein écran depuis le dashboard.
  timeTravelerOpen = signal(false);
  timeTravelerSpeed = signal<number>(1);                    // 0.5x / 1x / 2x / 5x / 10x
  timeTravelerBookmarks = signal<Array<{date: string; label: string}>>([]);

  openTimeTraveler() {
    this.timeTravelerOpen.set(true);
  }
  closeTimeTraveler() {
    this.timeTravelerOpen.set(false);
  }
  setTimeTravelerSpeed(speed: number) {
    this.timeTravelerSpeed.set(speed);
  }
  addTimeTravelerBookmark() {
    const list = this.timeTravelerBookmarks();
    const date = new Date().toISOString().slice(0, 10);
    this.timeTravelerBookmarks.set([
      ...list,
      { date, label: `Bookmark ${list.length + 1}` },
    ]);
  }
  removeTimeTravelerBookmark(i: number) {
    const list = [...this.timeTravelerBookmarks()];
    list.splice(i, 1);
    this.timeTravelerBookmarks.set(list);
  }
  search = '';
  ticketFilter = '';

  // Import state
  importOpen = signal(false);
  dragging = signal(false);
  pickedFile = signal<File | null>(null);
  importing = signal(false);
  importError = signal<string | null>(null);
  importResult = signal<ImportResult | null>(null);

  // Data signals
  dash = signal<any>(null);
  tickets = signal<PosTicket[]>([]);
  sprints = signal<any[]>([]);

  // v0.1 conclave — Cosmos Projet : adaptation des PosTicket → CosmosTicket
  cosmosTickets = computed<CosmosTicket[]>(() => {
    return this.tickets().map(t => ({
      id: t.id ?? t.ticketId,
      title: t.title || `Ticket ${t.ticketId}`,
      status: t.status || t.state || 'À faire',
      storyPoints: t.storyPoints,
      priority: t.priority || 'Could',
      dueDate: t.deliveryDate || t.startDate,
      sprintId: t.sprint,
      sprintName: t.sprint,
      assignee: t.assignee,
      progress: t.progressPercent,
    }));
  });
  // Milestones : extraits des sprints (fin de chaque sprint = milestone)
  cosmosMilestones = computed<CosmosMilestone[]>(() => {
    return this.sprints()
      .filter(s => s.endDate)
      .map(s => ({
        id: s.id ?? s.sprintId ?? s.name,
        label: `Fin ${s.name || s.sprintId}`,
        date: s.endDate,
        type: 'release' as const,
      }));
  });
  cosmosProjectHealth = computed(() => {
    const all = this.tickets();
    if (!all.length) return 75;
    const done = all.filter(t => (t.status || '').toUpperCase() === 'DONE').length;
    const blocked = all.filter(t => (t.status || '').toUpperCase() === 'BLOCKED').length;
    const pct = (done / all.length) * 100 - (blocked / all.length) * 50;
    return Math.max(20, Math.min(100, Math.round(pct + 50)));
  });
  cosmosVelocity = computed(() => {
    return this.tickets()
      .filter(t => (t.status || '').toUpperCase() === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  });
  /** v0.1 conclave — Stats prêtes pour le composant THUNDER (texte avec éclairs).
   *  Chaque stat = { value, label } affiché sur 2 lignes verticales dans le canvas. */
  thunderStats = computed<ThunderStat[]>(() => [
    { value: String(this.tickets().length), label: 'tickets actifs' },
    { value: String(this.cosmosVelocity()), label: 'velocity (SP)' },
    { value: `${this.cosmosProjectHealth()}%`, label: 'santé' },
  ]);

  // ════════════════ TOP 5 WINS — Données enrichies pour le cosmos ════════════════

  /** P1 — Budget total = somme des SP de tous les tickets */
  cosmosBudgetTotal = computed(() => {
    return this.tickets().reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  });
  /** P1 — Budget consommé = somme des SP des DONE */
  cosmosBudgetSpent = computed(() => {
    return this.tickets()
      .filter(t => (t.status || '').toUpperCase() === 'DONE' ||
                   (t.status || '').toLowerCase().includes('termin'))
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  });
  /** P1 — Sprint actif → anneau autour du soleil avec progression */
  cosmosSprintActive = computed<CosmosSprintActive | null>(() => {
    const li = this.launchableInfo();
    if (!li || li.state !== 'ACTIVE') return null;
    return {
      name: li.sprintName || 'Sprint actif',
      dayIndex: li.dayIndex,
      totalDays: li.totalDays,
      progressPct: li.dayIndex && li.totalDays
        ? Math.round((li.dayIndex / li.totalDays) * 100)
        : 0,
    };
  });

  /** P3 — Membres équipe → lunes proche du soleil
   *  On dérive de la liste unique des assignees présents dans les tickets,
   *  avec capacité = nb tickets assignés / max d'assignés. */
  cosmosTeamMembers = computed<CosmosTeamMember[]>(() => {
    const counts = new Map<string, number>();
    this.tickets().forEach(t => {
      const a = (t.assignee || '').trim();
      if (a) counts.set(a, (counts.get(a) || 0) + 1);
    });
    if (counts.size === 0) return [];
    const max = Math.max(...counts.values());
    const palette = ['#7adfd0', '#d699e6', '#a3d68b', '#e6ad7a', '#e692a8',
                     '#8b9fea', '#c5e3a1', '#d6b46c', '#5fb3d6', '#fb923c'];
    let i = 0;
    return Array.from(counts.entries()).map(([name, n]) => ({
      id: name,
      name,
      capacityPct: Math.round((n / max) * 100),
      isOnline: i++ < 3,                         // les 3 premiers "online" par défaut
      color: palette[(i - 1) % palette.length],
    }));
  });

  /** P4 — Risques → astéroïdes. Si this.risks() vide, dérivé des tickets BLOCKED. */
  cosmosRisks = computed<CosmosRisk[]>(() => {
    const raw = this.risks() || [];
    if (raw.length > 0) {
      return raw.map((r: any, i: number) => ({
        id: r.id ?? r.riskId ?? i,
        label: r.title || r.description || `Risque ${i + 1}`,
        score: r.score ?? r.impact ?? 50,
        triggerDate: r.dueDate || r.triggerDate,
        category: r.category,
      }));
    }
    // Fallback : tickets BLOCKED deviennent des "risques" visuels
    return this.tickets()
      .filter(t => (t.status || '').toUpperCase().includes('BLOCK') ||
                   (t.status || '').toLowerCase().includes('bloqu'))
      .map(t => ({
        id: 'blocked-' + (t.id ?? t.ticketId),
        label: t.title || 'Ticket bloqué',
        score: 80,
        triggerDate: t.deliveryDate,
        category: 'blocker',
      }));
  });

  /** P4 — Dépendances entre tickets — si pas de data, déduit MUST priority → liens vers SHOULD */
  cosmosDependencies = computed<CosmosDependency[]>(() => {
    const all = this.tickets();
    const musts = all.filter(t => (t.priority || '').toUpperCase() === 'MUST').slice(0, 5);
    const shoulds = all.filter(t => (t.priority || '').toUpperCase() === 'SHOULD').slice(0, 10);
    const deps: CosmosDependency[] = [];
    // Crée des arcs visuels : chaque MUST "bloque" 1 SHOULD (illustration)
    musts.forEach((m, i) => {
      const s = shoulds[i];
      if (s && m.id != null && s.id != null) {
        deps.push({
          fromTicketId: m.id,
          toTicketId: s.id,
          type: 'blocks',
        });
      }
    });
    return deps;
  });

  /** P5 — Cérémonies → comètes par type. Dérivé d'une liste de cérémonies standard
   *  réparties sur l'année (à brancher au calendrier réel quand dispo). */
  cosmosCeremonies = computed<CosmosCeremony[]>(() => {
    const y = new Date().getFullYear();
    const list: CosmosCeremony[] = [];
    // 1 daily par sprint (12 sprints) → 12 dailies au total (1 par mois)
    for (let m = 0; m < 12; m++) {
      list.push({ id: `daily-${m}`, type: 'daily', date: new Date(y, m, 15), label: 'Daily standup' });
    }
    // 1 planning au début de chaque trimestre
    [0, 3, 6, 9].forEach(m => list.push({ id: `plan-${m}`, type: 'planning', date: new Date(y, m, 1), label: 'Sprint planning' }));
    // 1 review fin de chaque trimestre
    [2, 5, 8, 11].forEach(m => list.push({ id: `rev-${m}`, type: 'review', date: new Date(y, m, 28), label: 'Sprint review' }));
    // 1 retro chaque semestre
    [5, 11].forEach(m => list.push({ id: `retro-${m}`, type: 'retro', date: new Date(y, m, 30), label: 'Rétrospective' }));
    // 1 wrap-up fin d'année
    list.push({ id: 'wrap-fin', type: 'wrap-up', date: new Date(y, 11, 20), label: 'Wrap-up final' });
    return list;
  });

  onCosmosTicketSelected(t: CosmosTicket) {
    console.log('[Cosmos] Ticket sélectionné :', t);
    // TODO : ouvrir le ticket dans le panel
  }

  /** v1.0.177bo/bp — KANBAN BOARD : colonnes par état avec drag&drop + sync Excel.
   *  v1.0.177bp — `key` = bucket statusKey() pour matching robuste, `state` = valeur DB envoyée à l'API. */
  readonly KANBAN_COLUMNS = [
    { key: 'todo',    state: 'À faire',  label: '📥 À faire',  i18nKey: 'kanban.col_todo',    color: '#6647bf' },
    { key: 'wip',     state: 'En cours', label: '⚡ En cours', i18nKey: 'kanban.col_wip',     color: '#4696b9' },
    { key: 'review',  state: 'En revue', label: '🔍 En revue', i18nKey: 'kanban.col_review',  color: '#d99a51' },
    { key: 'test',    state: 'En test',  label: '🧪 En test',  i18nKey: 'kanban.col_test',    color: '#c25d8d' },
    { key: 'blocked', state: 'Bloqué',   label: '🛑 Bloqué',   i18nKey: 'kanban.col_blocked', color: '#de4f5f' },
    { key: 'done',    state: 'Terminé',  label: '✅ Terminé',  i18nKey: 'kanban.col_done',    color: '#70b944' },
  ];
  /** v1.0.177bt — Vue Kanban : filtre temporel sur les tickets. */
  kanbanView = signal<'all' | 'day' | 'week' | 'month'>('all');
  kanbanCursor = signal<Date>(new Date());
  setKanbanView(v: 'all' | 'day' | 'week' | 'month'): void {
    this.kanbanView.set(v);
    if (v !== 'all') this.kanbanCursor.set(new Date());  // reset au today
  }
  kanbanPrev(): void {
    const d = new Date(this.kanbanCursor());
    const v = this.kanbanView();
    if (v === 'day') d.setDate(d.getDate() - 1);
    else if (v === 'week') d.setDate(d.getDate() - 7);
    else if (v === 'month') d.setMonth(d.getMonth() - 1);
    this.kanbanCursor.set(d);
  }
  kanbanNext(): void {
    const d = new Date(this.kanbanCursor());
    const v = this.kanbanView();
    if (v === 'day') d.setDate(d.getDate() + 1);
    else if (v === 'week') d.setDate(d.getDate() + 7);
    else if (v === 'month') d.setMonth(d.getMonth() + 1);
    this.kanbanCursor.set(d);
  }
  kanbanToday(): void { this.kanbanCursor.set(new Date()); }
  /** Bornes [start, end] de la période courante selon la vue. Null si 'all'. */
  kanbanPeriodRange = computed<{ start: Date; end: Date } | null>(() => {
    const v = this.kanbanView();
    if (v === 'all') return null;
    const cur = new Date(this.kanbanCursor());
    const start = new Date(cur), end = new Date(cur);
    if (v === 'day') {
      start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    } else if (v === 'week') {
      // Lundi = jour 1 (getDay: 0=Dim..6=Sam) → on shift au lundi
      const dow = (start.getDay() + 6) % 7;  // 0=Lundi
      start.setDate(start.getDate() - dow); start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime()); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
    } else if (v === 'month') {
      start.setDate(1); start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);  // dernier jour du mois
    }
    return { start, end };
  });
  /** Label de la période courante pour le UI (ex "Aujourd'hui · 2 juin 2026", "Sem. du 2 juin", "Juin 2026"). */
  kanbanPeriodLabel = computed<string>(() => {
    const v = this.kanbanView();
    if (v === 'all') return '';
    const r = this.kanbanPeriodRange();
    if (!r) return '';
    const cur = this.kanbanCursor();
    if (v === 'day') {
      return cur.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (v === 'week') {
      const s = r.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const e = r.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return `Sem. du ${s} au ${e}`;
    }
    return cur.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  });
  /** Compte combien de tickets sont dans la période courante (avec ou sans date). */
  kanbanFilteredCount = computed(() => {
    const r = this.kanbanPeriodRange();
    if (!r) return this.tickets().length;
    return this.tickets().filter(t => this.ticketInRange(t, r.start, r.end)).length;
  });
  /** v1.0.177ce — Filtre intuitif "qu'est-ce que je travaille à cette date" :
   *   - Pour AUJOURD'HUI ou un JOUR FUTUR : on liste tout ce qui est non-clos
   *     (À faire / En cours / À revoir / Bloqué) — c'est le plan de charge.
   *   - Pour un JOUR PASSÉ : on liste les tickets dont la période d'activité
   *     [startDate, deliveryDate] chevauchait cette date.
   *   - Tickets sans aucune date → considérés actifs si non-clos.
   */
  private ticketInRange(t: PosTicket, start: Date, end: Date): boolean {
    const status = (t.status || t.state || '').toLowerCase();
    const isClosed = status.includes('fait') || status.includes('clos') ||
                     status.includes('done') || status.includes('terminé') ||
                     status.includes('termin');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureOrToday = end >= today;

    const parse = (s?: string) => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const tStart = parse(t.startDate);
    const tEnd = parse(t.deliveryDate);

    // ── PLAN DE CHARGE : aujourd'hui ou futur → tous les tickets non-clos sont "à travailler"
    if (isFutureOrToday && !isClosed) return true;

    // ── HISTORIQUE : passé OU ticket clos → on regarde le chevauchement réel des dates
    if (tStart && tEnd) return tStart <= end && tEnd >= start;
    if (tStart && !tEnd) return tStart >= start && tStart <= end;
    if (!tStart && tEnd) return tEnd >= start && tEnd <= end;

    // ── Pas de date du tout : ticket clos → exclu du passé ; sinon déjà géré au-dessus
    return false;
  }
  /** ═══ v1.0.177bu — TICKET DETAIL : page dynamique consultation/édition + sync DB+Excel ═══ */
  activeTicketId = signal<number | null>(null);
  activeTicket = computed<PosTicket | null>(() => {
    const id = this.activeTicketId();
    if (id == null) return null;
    return this.tickets().find(t => t.id === id) || null;
  });
  ticketEditMode = signal(false);
  ticketDraft = signal<Partial<PosTicket>>({});
  ticketSaving = signal(false);
  /** v1.0.177bw — Modal style MS Planner overlay sur le header, PAS une page séparée. */
  ticketModalOpen = signal(false);
  /** Ouvre le modal de détail pour ce ticket. Appelé depuis click Kanban / cloche. */
  openTicketDetail(ticketId: number): void {
    this.activeTicketId.set(ticketId);
    this.ticketEditMode.set(false);
    const t = this.tickets().find(tk => tk.id === ticketId);
    this.ticketDraft.set(t ? { ...t } : {});
    // v1.0.177bx — Affichage INLINE dans le header (PAS de modal séparé).
    this.ticketModalOpen.set(true);
    // v1.0.177by — Charge les commentaires sans ouvrir l'ancien modal commentaires
    // (openTicketComments() positionne commentsTicket qui declenche le vieux modal).
    if (t) this.refreshCommentsPublic(t.id);
  }
  /** v1.0.177bx — Ferme le ticket detail inline et reset tout l'etat. */
  closeTicketModal(): void {
    this.ticketModalOpen.set(false);
    this.ticketEditMode.set(false);
    this.activeTicketId.set(null);
    this.commentsList.set([]);
    this.commentDraft = '';
  }
  /** v1.0.177by — Refresh comments sans toucher au signal commentsTicket
   *  (qui declencherait l'ancien modal wt-comments-modal). */
  refreshCommentsPublic(ticketId: number): void {
    this.commentsLoading.set(true);
    this.api.ticketComments(ticketId).subscribe({
      next: list => { this.commentsList.set(list || []); this.commentsLoading.set(false); },
      error: () => { this.commentsList.set([]); this.commentsLoading.set(false); }
    });
  }
  /** v1.0.177ca — Export Excel du Kanban selon la vue active (tous/jour/semaine/mois).
   *  Génère un .xls (SpreadsheetML 2003) avec :
   *   - Feuille "Synthese" : stats par colonne
   *   - 1 feuille par colonne (A faire, En cours, En revue, Fait, Bloque)
   *   - Filtre selon kanbanView() : pas de filtre si 'all', sinon kanbanPeriodRange(). */
  exportKanbanExcel(): void {
    const view = this.kanbanView();
    const range = this.kanbanPeriodRange();
    const proj = this.selectedProjectInfo();
    const label = view === 'all' ? 'Tous' : this.kanbanPeriodLabel();

    const esc = (v: any): string => {
      if (v == null) return '';
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // Récupère les tickets par colonne en respectant le filtre période
    const ticketsByCol: Record<string, PosTicket[]> = {};
    let totalCount = 0;
    let totalSP = 0;
    let totalHours = 0;
    for (const col of this.KANBAN_COLUMNS) {
      const tks = this.kanbanTicketsByState(col.key);
      ticketsByCol[col.key] = tks;
      totalCount += tks.length;
      totalSP += tks.reduce((s, t) => s + (t.storyPoints || 0), 0);
      totalHours += tks.reduce((s, t) => s + (t.spentHours || 0), 0);
    }

    // ── Feuille SYNTHESE ──
    const synthHeader =
      `<Row ss:StyleID="hdr">` +
      `<Cell><Data ss:Type="String">Colonne</Data></Cell>` +
      `<Cell><Data ss:Type="String">Tickets</Data></Cell>` +
      `<Cell><Data ss:Type="String">Story Points</Data></Cell>` +
      `<Cell><Data ss:Type="String">Heures consommées</Data></Cell>` +
      `<Cell><Data ss:Type="String">Progression moyenne (%)</Data></Cell>` +
      `</Row>`;
    const synthRows = this.KANBAN_COLUMNS.map(col => {
      const tks = ticketsByCol[col.key];
      const sp = tks.reduce((s, t) => s + (t.storyPoints || 0), 0);
      const hrs = tks.reduce((s, t) => s + (t.spentHours || 0), 0);
      const avg = tks.length === 0 ? 0 : Math.round(tks.reduce((s, t) => s + (t.progressPercent || 0), 0) / tks.length);
      return `<Row>` +
        `<Cell><Data ss:Type="String">${esc(col.label)}</Data></Cell>` +
        `<Cell><Data ss:Type="Number">${tks.length}</Data></Cell>` +
        `<Cell><Data ss:Type="Number">${sp}</Data></Cell>` +
        `<Cell><Data ss:Type="Number">${hrs}</Data></Cell>` +
        `<Cell><Data ss:Type="Number">${avg}</Data></Cell>` +
        `</Row>`;
    }).join('\n');
    const synthTotal =
      `<Row ss:StyleID="total">` +
      `<Cell><Data ss:Type="String">TOTAL</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${totalCount}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${totalSP}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${totalHours}</Data></Cell>` +
      `<Cell><Data ss:Type="String">—</Data></Cell>` +
      `</Row>`;

    const synthInfo =
      `<Row><Cell ss:StyleID="lbl"><Data ss:Type="String">Projet</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(proj?.name || proj?.code || '—')}</Data></Cell></Row>` +
      `<Row><Cell ss:StyleID="lbl"><Data ss:Type="String">Vue</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(view.toUpperCase())}</Data></Cell></Row>` +
      `<Row><Cell ss:StyleID="lbl"><Data ss:Type="String">Période</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(label || 'Aucun filtre')}</Data></Cell></Row>` +
      `<Row><Cell ss:StyleID="lbl"><Data ss:Type="String">Exporté le</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(new Date().toLocaleString('fr-FR'))}</Data></Cell></Row>` +
      `<Row></Row>`;

    // ── Feuille par colonne ──
    const colHeader =
      `<Row ss:StyleID="hdr">` +
      `<Cell><Data ss:Type="String">Ticket ID</Data></Cell>` +
      `<Cell><Data ss:Type="String">Titre</Data></Cell>` +
      `<Cell><Data ss:Type="String">Type</Data></Cell>` +
      `<Cell><Data ss:Type="String">Priorité</Data></Cell>` +
      `<Cell><Data ss:Type="String">Sprint</Data></Cell>` +
      `<Cell><Data ss:Type="String">Assigné</Data></Cell>` +
      `<Cell><Data ss:Type="String">SP</Data></Cell>` +
      `<Cell><Data ss:Type="String">Estim. (h)</Data></Cell>` +
      `<Cell><Data ss:Type="String">Consommées (h)</Data></Cell>` +
      `<Cell><Data ss:Type="String">Restantes (h)</Data></Cell>` +
      `<Cell><Data ss:Type="String">Progression (%)</Data></Cell>` +
      `<Cell><Data ss:Type="String">Date début</Data></Cell>` +
      `<Cell><Data ss:Type="String">Date livraison</Data></Cell>` +
      `<Cell><Data ss:Type="String">Composant</Data></Cell>` +
      `<Cell><Data ss:Type="String">Description</Data></Cell>` +
      `</Row>`;

    const colSheets = this.KANBAN_COLUMNS.map(col => {
      const tks = ticketsByCol[col.key];
      const rows = tks.length === 0
        ? `<Row><Cell ss:MergeAcross="14"><Data ss:Type="String">(aucun ticket)</Data></Cell></Row>`
        : tks.map(t =>
            `<Row>` +
            `<Cell><Data ss:Type="String">${esc(t.ticketId || ('#' + t.id))}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.title)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.type)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.priority)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.sprint)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.assignee)}</Data></Cell>` +
            `<Cell><Data ss:Type="Number">${t.storyPoints || 0}</Data></Cell>` +
            `<Cell><Data ss:Type="Number">${t.estimationHours || 0}</Data></Cell>` +
            `<Cell><Data ss:Type="Number">${t.spentHours || 0}</Data></Cell>` +
            `<Cell><Data ss:Type="Number">${t.remainingHours || 0}</Data></Cell>` +
            `<Cell><Data ss:Type="Number">${t.progressPercent || 0}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.startDate)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.deliveryDate)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.component)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(t.description)}</Data></Cell>` +
            `</Row>`
          ).join('\n');
      // Nom de feuille : Excel limite a 31 chars + interdit certains caracteres
      const sheetName = `${col.label} (${tks.length})`.replace(/[\\\/\*\[\]\?:]/g, '_').slice(0, 31);
      return `<Worksheet ss:Name="${esc(sheetName)}">\n` +
        ' <Table>\n' +
        '  <Column ss:Width="90"/>\n' +
        '  <Column ss:Width="240"/>\n' +
        '  <Column ss:Width="70"/>\n' +
        '  <Column ss:Width="80"/>\n' +
        '  <Column ss:Width="100"/>\n' +
        '  <Column ss:Width="100"/>\n' +
        '  <Column ss:Width="50"/>\n' +
        '  <Column ss:Width="80"/>\n' +
        '  <Column ss:Width="100"/>\n' +
        '  <Column ss:Width="90"/>\n' +
        '  <Column ss:Width="100"/>\n' +
        '  <Column ss:Width="90"/>\n' +
        '  <Column ss:Width="100"/>\n' +
        '  <Column ss:Width="120"/>\n' +
        '  <Column ss:Width="300"/>\n' +
        colHeader + '\n' +
        rows + '\n' +
        ' </Table>\n' +
        '</Worksheet>\n';
    }).join('');

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      ' xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
      '<Styles>\n' +
      '  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n' +
      '  <Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#6C5CE7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\n' +
      '  <Style ss:ID="lbl"><Font ss:Bold="1" ss:Color="#1E1840"/><Interior ss:Color="#E8E3F8" ss:Pattern="Solid"/></Style>\n' +
      '  <Style ss:ID="total"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="12"/><Interior ss:Color="#4A3CA8" ss:Pattern="Solid"/></Style>\n' +
      '  <Style ss:ID="title"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="14"/><Interior ss:Color="#1E1840" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\n' +
      '</Styles>\n' +
      '<Worksheet ss:Name="Synthèse">\n' +
      ' <Table>\n' +
      '  <Column ss:Width="160"/>\n' +
      '  <Column ss:Width="100"/>\n' +
      '  <Column ss:Width="120"/>\n' +
      '  <Column ss:Width="140"/>\n' +
      '  <Column ss:Width="160"/>\n' +
      `  <Row ss:StyleID="title"><Cell ss:MergeAcross="4"><Data ss:Type="String">KANBAN ${esc((proj?.code || '').toUpperCase())} — ${esc(view.toUpperCase())}</Data></Cell></Row>\n` +
      '  <Row></Row>\n' +
      synthInfo + '\n' +
      synthHeader + '\n' +
      synthRows + '\n' +
      synthTotal + '\n' +
      ' </Table>\n' +
      '</Worksheet>\n' +
      colSheets +
      '</Workbook>';

    const bom = '﻿';
    const blob = new Blob([bom + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodTag = view === 'all' ? 'tous'
      : view === 'day' ? 'jour'
      : view === 'week' ? 'semaine'
      : 'mois';
    const cur = this.kanbanCursor();
    const dateTag = view === 'all' ? new Date().toISOString().slice(0, 10) : cur.toISOString().slice(0, 10);
    const projTag = (proj?.code || 'PROJ').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `kanban-${projTag}-${periodTag}-${dateTag}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    console.log(`[kanban] 📥 Excel exporté : ${a.download} (${totalCount} tickets, vue=${view})`);
  }

  /** v1.0.177bz — Export Excel d'un seul ticket avec tous ses champs + commentaires.
   *  Génère un .xls (SpreadsheetML XML 2003) ouvert nativement par Excel.
   *  Pas de dep externe — XML inline encodé UTF-8. */
  exportTicketExcel(): void {
    const t = this.activeTicket();
    if (!t) return;
    const proj = this.selectedProjectInfo();
    const comments = this.commentsList() || [];

    const esc = (v: any): string => {
      if (v == null) return '';
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    const rowS = (label: string, value: any): string =>
      `<Row><Cell ss:StyleID="lbl"><Data ss:Type="String">${esc(label)}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(value ?? '')}</Data></Cell></Row>`;
    const rowN = (label: string, value: any): string =>
      `<Row><Cell ss:StyleID="lbl"><Data ss:Type="String">${esc(label)}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${Number(value || 0)}</Data></Cell></Row>`;
    const sectionHeader = (title: string): string =>
      `<Row ss:StyleID="section"><Cell ss:MergeAcross="1"><Data ss:Type="String">${esc(title)}</Data></Cell></Row>`;

    // Sheet 1 : Ticket info
    const ticketRows = [
      sectionHeader('=== IDENTIFICATION ==='),
      rowS('Projet', proj?.name || proj?.code || '—'),
      rowS('Ticket ID', t.ticketId || `#${t.id}`),
      rowS('Titre', t.title),
      rowS('Type', t.type),
      rowS('Composant', t.component),
      rowS('Phase', t.phase),
      sectionHeader('=== STATUT & PRIORITE ==='),
      rowS('Statut', t.status || t.state),
      rowS('Priorité', t.priority),
      rowS('Sprint', t.sprint),
      rowS('Assigné à', t.assignee),
      sectionHeader('=== DATES ==='),
      rowS('Date début', t.startDate),
      rowS('Date livraison', t.deliveryDate),
      rowN('Retard (jours)', t.delayDays),
      rowN('Cycle Time (jours)', t.cycleTimeDays),
      rowN('Lead Time (jours)', t.leadTimeDays),
      sectionHeader('=== EFFORT ==='),
      rowN('Story Points', t.storyPoints),
      rowN('Estimation (h)', t.estimationHours),
      rowN('Heures consommées', t.spentHours),
      rowN('Heures restantes', t.remainingHours),
      rowN('Progression (%)', t.progressPercent),
      sectionHeader('=== CONTENU ==='),
      rowS('Description', t.description),
      rowS("Critères d'acceptation", t.acceptanceCriteria),
      rowS('Dépendances', t.dependencies),
      sectionHeader('=== REVIEW ==='),
      rowS('Verdict review', t.reviewVerdict),
      rowS('Commentaire reviewer', t.reviewerComment),
      rowS('PR Link', t.prLink),
    ].join('\n');

    // Sheet 2 : Commentaires
    const commentsRows = comments.length === 0
      ? `<Row><Cell><Data ss:Type="String">(aucun commentaire)</Data></Cell></Row>`
      : [
          `<Row ss:StyleID="hdr">` +
          `<Cell><Data ss:Type="String">Auteur</Data></Cell>` +
          `<Cell><Data ss:Type="String">Date</Data></Cell>` +
          `<Cell><Data ss:Type="String">Commentaire</Data></Cell></Row>`,
          ...comments.map(c =>
            `<Row>` +
            `<Cell><Data ss:Type="String">${esc(c.author)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(c.createdAt)}</Data></Cell>` +
            `<Cell><Data ss:Type="String">${esc(c.body)}</Data></Cell></Row>`
          )
        ].join('\n');

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      ' xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
      '<Styles>\n' +
      '  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n' +
      '  <Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#6C5CE7" ss:Pattern="Solid"/></Style>\n' +
      '  <Style ss:ID="lbl"><Font ss:Bold="1" ss:Color="#1E1840"/><Interior ss:Color="#E8E3F8" ss:Pattern="Solid"/></Style>\n' +
      '  <Style ss:ID="section"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="12"/><Interior ss:Color="#4A3CA8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\n' +
      '</Styles>\n' +
      `<Worksheet ss:Name="Ticket ${esc(t.ticketId || t.id)}">\n` +
      ' <Table>\n' +
      '  <Column ss:Width="180"/>\n' +
      '  <Column ss:Width="420"/>\n' +
      ticketRows + '\n' +
      ' </Table>\n' +
      '</Worksheet>\n' +
      `<Worksheet ss:Name="Commentaires (${comments.length})">\n` +
      ' <Table>\n' +
      '  <Column ss:Width="120"/>\n' +
      '  <Column ss:Width="140"/>\n' +
      '  <Column ss:Width="380"/>\n' +
      commentsRows + '\n' +
      ' </Table>\n' +
      '</Worksheet>\n' +
      '</Workbook>';

    const bom = '﻿';
    const blob = new Blob([bom + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeId = (t.ticketId || `T${t.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `ticket-${safeId}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    console.log(`[ticket-detail] 📥 Excel exporté : ticket-${safeId}.xls (${comments.length} commentaires)`);
  }

  /** v1.0.177by — Submit pour l'inline detail. Utilise activeTicket() au lieu de
   *  commentsTicket() (qui n'est plus set par openTicketDetail). */
  submitCommentInline(): void {
    const t = this.activeTicket();
    const body = (this.commentDraft || '').trim();
    if (!t || !body) return;
    const author = this.user()?.githubLogin || 'Anonymous';
    this.api.addTicketComment(t.id, { author, body }).subscribe({
      next: () => {
        this.commentDraft = '';
        this.refreshCommentsPublic(t.id);
      }
    });
  }
  /** Toggle entre lecture et édition. */
  toggleTicketEdit(): void {
    const wasEditing = this.ticketEditMode();
    // v1.0.177cj — BUG #9 : empêcher édition si timer tourne sur ce ticket (sinon
    // les champs spentHours/description bougent en arrière-plan et écrasent le draft)
    if (!wasEditing && this.currentWorkTicketId() === this.activeTicketId()) {
      const yes = confirm('Un timer tourne sur ce ticket. Pour éditer, je dois d\'abord arrêter le timer (le temps sera sauvegardé). OK ?');
      if (!yes) return;
      this.endTicketWork();
    }
    this.ticketEditMode.set(!wasEditing);
    if (!wasEditing) {
      // Entre en édition : copie le ticket courant comme draft
      const t = this.activeTicket();
      this.ticketDraft.set(t ? { ...t } : {});
    }
  }
  /** Met à jour un field du draft. */
  updateTicketDraft<K extends keyof PosTicket>(field: K, value: PosTicket[K]): void {
    this.ticketDraft.update(d => ({ ...d, [field]: value }));
  }
  /** Save le draft via api.updateTicket → refetch + sync Excel auto. */
  saveTicketDraft(): void {
    const t = this.activeTicket();
    const draft = this.ticketDraft();
    if (!t || !draft) return;
    // Build le patch (uniquement les champs qui ont changé)
    const patch: Partial<PosTicket> = {};
    for (const key of Object.keys(draft) as (keyof PosTicket)[]) {
      if (key === 'id' || key === 'projectId') continue;
      if (draft[key] !== t[key]) (patch as any)[key] = draft[key];
    }
    if (Object.keys(patch).length === 0) {
      this.ticketEditMode.set(false);
      console.log('[ticket-detail] No changes to save');
      return;
    }
    this.ticketSaving.set(true);
    this.api.updateTicket(t.id, patch).subscribe({
      next: (updated) => {
        // Sync local
        this.tickets.update(arr => arr.map(tk => tk.id === t.id ? { ...tk, ...updated } : tk));
        this.ticketEditMode.set(false);
        this.ticketSaving.set(false);
        // Refetch pour cohérence (rangs etc)
        const pid = this.api.selectedProjectId();
        if (pid) setTimeout(() => this.api.tickets(pid).subscribe({ next: ts => this.tickets.set(ts) }), 250);
        console.log(`[ticket-detail] ✅ Saved #${t.id} :`, patch);
      },
      error: (err) => {
        this.ticketSaving.set(false);
        console.error(`[ticket-detail] ❌ Save failed :`, err);
        alert(`Échec sauvegarde : ${err?.message || err?.statusText || err}`);
      },
    });
  }
  /** Cancel : revert le draft + sort de l'édition. */
  cancelTicketEdit(): void {
    const t = this.activeTicket();
    this.ticketDraft.set(t ? { ...t } : {});
    this.ticketEditMode.set(false);
  }
  /** v1.0.177ci — Statuts alignés sur la spec OT-SYS (accents + "En test" ajouté). */
  readonly TICKET_STATUSES = ['À faire', 'En cours', 'En revue', 'En test', 'Bloqué', 'Terminé'];
  /** v1.0.177ci — Priorités : Must/Should/Could (3 seulement, "Won't" retiré). */
  readonly TICKET_PRIORITIES = ['Must', 'Should', 'Could'];
  /** v1.0.177ci — Types alignés sur la spec : Story / Tâche / Bug (en français, capitalisés). */
  readonly TICKET_TYPES = ['Story', 'Tâche', 'Bug'];

  /** Returns tickets dont le bucket statusKey matche la clé donnée + filtre période si activée. */
  kanbanTicketsByState(colKey: string): PosTicket[] {
    const all = this.tickets() || [];
    const r = this.kanbanPeriodRange();
    return all
      .filter(t => this.statusKey(t.status || t.state) === colKey)
      .filter(t => r === null ? true : this.ticketInRange(t, r.start, r.end))
      .sort((a, b) => (a.rankIndex || 0) - (b.rankIndex || 0));
  }
  /** v1.0.177bq — Debug : compte les tickets par statusKey + log les valeurs brutes uniques. */
  kanbanDebugInfo = computed(() => {
    const tk = this.tickets() || [];
    const buckets: Record<string, number> = { todo: 0, wip: 0, review: 0, done: 0, blocked: 0 };
    const rawStatuses = new Set<string>();
    for (const t of tk) {
      const raw = (t.status || t.state || '');
      rawStatuses.add(raw);
      const k = this.statusKey(raw);
      buckets[k] = (buckets[k] || 0) + 1;
    }
    return { total: tk.length, buckets, rawStatuses: [...rawStatuses] };
  });
  private kanbanDraggedTicketId: number | null = null;
  /** Handler dragstart : mémorise l'id du ticket déplacé. */
  onKanbanDragStart(ev: DragEvent, ticketId: number): void {
    this.kanbanDraggedTicketId = ticketId;
    ev.dataTransfer?.setData('text/plain', String(ticketId));
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
    (ev.target as HTMLElement)?.classList.add('is-dragging');
  }
  onKanbanDragEnd(ev: DragEvent): void {
    (ev.target as HTMLElement)?.classList.remove('is-dragging');
    this.kanbanDraggedTicketId = null;
  }
  /** Handler dragover sur une colonne : autorise le drop. */
  onKanbanDragOver(ev: DragEvent): void {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    (ev.currentTarget as HTMLElement)?.classList.add('is-drag-over');
  }
  onKanbanDragLeave(ev: DragEvent): void {
    (ev.currentTarget as HTMLElement)?.classList.remove('is-drag-over');
  }
  /** Handler drop : met à jour le ticket via API + refetch + Excel auto-export trigger.
   *  v1.0.177bp — Envoie BOTH `status` ET `state` (le backend peut utiliser l'un ou l'autre),
   *  + matche par bucket key (statusKey) pour éviter no-op si valeur DB différente. */
  onKanbanDrop(ev: DragEvent, newState: string): void {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement)?.classList.remove('is-drag-over');
    const idStr = ev.dataTransfer?.getData('text/plain') || String(this.kanbanDraggedTicketId);
    const tid = Number(idStr);
    if (!tid) return;
    const ticket = this.tickets().find(t => t.id === tid);
    if (!ticket) return;
    const currentKey = this.statusKey(ticket.status || ticket.state);
    const newKey = this.statusKey(newState);
    if (currentKey === newKey) {
      console.log(`[kanban] ↺ Ticket #${tid} déjà en "${newState}" (key=${currentKey})`);
      return;
    }
    const oldStatus = ticket.status;
    const oldState = ticket.state;
    const oldProgress = ticket.progressPercent;
    const oldSpent = ticket.spentHours;
    const oldRemaining = ticket.remainingHours;
    // v1.0.177ci — AUTO-SYNC progression selon nouveau statut (évite incohérences en Excel) :
    //   Terminé  → progressPercent=100, remainingHours=0 (rien à finir)
    //   À faire  → progressPercent=0,   spentHours=0 (rien commencé)
    //   En cours → garde la valeur courante (sauf si à 0 → met à 5% pour signaler "démarré")
    //   Autres   → on touche pas
    const patch: any = { status: newState, state: newState };
    if (newKey === 'done') {
      patch.progressPercent = 100;
      patch.remainingHours = 0;
    } else if (newKey === 'todo') {
      patch.progressPercent = 0;
      patch.spentHours = 0;
    } else if (newKey === 'wip' && (ticket.progressPercent || 0) === 0) {
      patch.progressPercent = 5;
    }
    // Optimistic update local : MET À JOUR status + state + progression
    this.tickets.update(arr => arr.map(t =>
      t.id === tid ? { ...t, ...patch } : t));
    // Sync API : envoie tous les champs patchés
    this.api.updateTicket(tid, patch).subscribe({
      next: (updated) => {
        console.log(`[kanban] ✅ Ticket #${tid} sync : status="${updated.status}" progress=${updated.progressPercent}%`);
        // Refetch en différé pour cohérence (rangs, etc.) sans race conditions
        const pid = this.api.selectedProjectId();
        if (pid) setTimeout(() => this.api.tickets(pid).subscribe({ next: ts => this.tickets.set(ts) }), 250);
      },
      error: (err) => {
        // Rollback : restore old values
        this.tickets.update(arr => arr.map(t =>
          t.id === tid ? { ...t, status: oldStatus, state: oldState, progressPercent: oldProgress, spentHours: oldSpent, remainingHours: oldRemaining } : t));
        console.error(`[kanban] ❌ Échec update ticket #${tid} → revert :`, err);
        alert(`Échec mise à jour ticket : ${err?.message || err?.statusText || err}`);
      },
    });
  }
  burndown = signal<any>(null);
  risks = signal<any[]>([]);
  techDebt = signal<any[]>([]);
  lessons = signal<any[]>([]);
  // Pages additionnelles
  phases = signal<any[]>([]);
  capacity = signal<any[]>([]);
  quarters = signal<any[]>([]);
  milestones = signal<any[]>([]);
  overtime = signal<any[]>([]);
  retros = signal<any[]>([]);
  adrs = signal<any[]>([]);
  glossary = signal<any[]>([]);
  cfd = signal<any[]>([]);
  velocity = signal<any[]>([]);
  deps = signal<any[]>([]);
  dodDorList = signal<any[]>([]);
  checklistList = signal<any[]>([]);
  stakeholdersList = signal<any[]>([]);
  stakeholderFb = signal<any[]>([]);
  standupsList = signal<any[]>([]);
  allProjects = signal<PosProject[]>([]);
  sprintFilter = signal<string>('');
  // Inline edit state
  savingId = signal<number | null>(null);
  savedId = signal<number | null>(null);
  readonly TYPES = ['Story', 'Bug', 'Spike', 'Task', 'Tâche'];
  readonly PRIORITIES = ['Must', 'Should', 'Could', "Won't"];
  readonly STATUSES = ['À faire', 'En cours', 'En revue', 'Terminé', 'Bloqué'];

  // Tickets groupés par sprint (Vue par Sprint)
  ticketsBySprint = computed(() => {
    const groups: Record<string, PosTicket[]> = {};
    for (const t of this.tickets()) {
      const k = t.sprint || 'Backlog';
      (groups[k] ||= []).push(t);
    }
    return Object.entries(groups).map(([sprint, list]) => ({ sprint, tickets: list }));
  });

  // DoD / DoR par défaut (21 / 15 critères) — affichés en checklist
  readonly DOD = [
    { sec: 'Code', items: ['Code écrit et fonctionnel', 'Conventions de nommage respectées', 'Pas de code mort/commenté', 'Revue de code effectuée'] },
    { sec: 'Sécurité', items: ['Pas de secrets en dur', 'Inputs validés', 'Dépendances sans vulnérabilité connue', 'Logs sans données sensibles'] },
    { sec: 'Déploiement', items: ['Build CI vert', 'Déployé en env de test', 'Variables externalisées', 'Rollback documenté'] },
    { sec: 'Documentation', items: ['README à jour', 'Changelog mis à jour', 'ADR si décision structurante', 'API documentée'] },
    { sec: 'Review', items: ['Tests unitaires passent', 'Critères d’acceptation validés', 'Démo faite au PO', 'Pas de régression'] },
  ];
  readonly DOR = [
    { sec: 'Clarté', items: ['User story claire (As/Want/So)', 'Valeur métier identifiée', 'Pas d’ambiguïté'] },
    { sec: 'Critères', items: ['Critères d’acceptation Gherkin', 'Cas limites listés', 'Definition of Done applicable'] },
    { sec: 'Dépendances', items: ['Dépendances identifiées', 'Pas de blocage amont', 'Accès/droits disponibles'] },
    { sec: 'Estimation', items: ['Story points estimés', 'Découpé si > 13 SP', 'Tenable dans un sprint'] },
    { sec: 'Design', items: ['Maquettes si UI', 'Contrat d’API défini', 'Impacts archi évalués'] },
  ];
  readonly TICKET_TEMPLATES = [
    { name: 'User Story', icon: '📗', body: 'En tant que <rôle>, je veux <action> afin de <bénéfice>.\n\nCritères (Gherkin):\nGiven <contexte>\nWhen <action>\nThen <résultat>' },
    { name: 'Bug', icon: '🐞', body: 'Symptôme:\nÉtapes de repro:\n1.\n2.\nComportement attendu:\nComportement observé:\nEnvironnement:' },
    { name: 'Spike', icon: '🔬', body: 'Question à investiguer:\nTimebox: <Xh>\nLivrable: note de décision / POC\nCritère de fin:' },
    { name: 'Tâche', icon: '🔧', body: 'Objectif:\nÉtapes:\n- \nDefinition of Done:' },
  ];

  stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * 100, y: Math.random() * 100, d: Math.random() * 4, u: 3 + Math.random() * 4,
  }));

  currentPageDef = computed(() => this.pages.find(p => p.id === this.activePage()) || null);
  isPlaceholder = computed(() => !this.implemented.has(this.activePage()));

  filteredTickets = computed(() => {
    const f = this.ticketFilter.toLowerCase().trim();
    if (!f) return this.tickets();
    return this.tickets().filter(t =>
      (t.title || '').toLowerCase().includes(f) || (t.ticketId || '').toLowerCase().includes(f));
  });

  // ════════════════ SPLASH SCREEN ════════════════
  /** true tant que le splash est affiché. Devient false quand le splash a fini son fade. */
  splashVisible = signal(true);
  /** Le parent set true quand les données réelles sont chargées. */
  splashDataReady = signal(false);
  private splashStartTs = Date.now();
  private readonly splashMinMs = 2800;

  /** Callback du splash après son fade-out — c'est là qu'on démonte le splash. */
  onSplashReady(): void { this.splashVisible.set(false); }

  /** Marque "données prêtes" en respectant un temps mini d'affichage du splash. */
  private markSplashReady(): void {
    if (this.splashDataReady()) return;
    const elapsed = Date.now() - this.splashStartTs;
    const wait = Math.max(0, this.splashMinMs - elapsed);
    setTimeout(() => this.splashDataReady.set(true), wait);
  }

  ngOnInit(): void {
    // v1.0.177n — Helper diagnostic console (window.__yamzyDiag())
    this.installDiag();
    // v1.0.177aj — Tracking dynamique de la taille de la fenêtre pour la mini preview placement
    this.installWindowResize();
    // v1.0.177cb — Charge le daily du jour depuis localStorage
    this.loadDaily();
    // v1.0.177cg — Restaure une session de travail en cours (timer ticket) si elle existait avant le reload
    this.restoreCurrentWork();
    // v1.0.177cs — Installe les hooks d'auto-save de la session timer (logout, beforeunload)
    this.installCurrentWorkAutoSaveHooks();
    // v1.0.177cu — Filet de sécurité : si JWT en localStorage mais user() null → force le rechargement
    //   (cas où AuthService a été construit AVANT le stockage du JWT, et n'a jamais hydraté)
    if (this.auth.isAuthenticated() && !this.auth.currentUser()) {
      console.log('[WAR TABLE] User null malgré JWT présent → force loadCurrentUser');
      this.auth.loadCurrentUser().subscribe({
        next: (u: any) => console.log('[WAR TABLE] ✓ User hydraté via filet :', u?.githubLogin),
        error: (e) => console.warn('[WAR TABLE] ⚠ Hydratation filet failed :', e?.status, e?.message),
      });
    }
    this.reloadProjects();
    // Filet de sécurité : même si la BDD est vide ou hors-ligne, on ferme le splash après 6s max.
    setTimeout(() => this.markSplashReady(), 6000);
    // v1.0.44 — Charge la 1ère page (Dashboard) sans démarrer d'auto-scroll
    setTimeout(() => this.applyCenterAction(), 800);
    // v1.0.47 — Setup keyboard handlers : Escape = back, Enter = open page content
    this.setupKeyboardHandlers();
    // v1.0.118 — Tick toutes les 60s pour rafraîchir le timeline du jour (current step + cursor)
    setInterval(() => this.nowTick.set(Date.now()), 60_000);

    // Réagit aux navigations venant de /war-table-skin
    // ?section=backlog → navigue ; ?import=1 → ouvre le modal d'import
    this.route.queryParams.subscribe(qp => {
      if (qp['import'] === '1') this.importOpen.set(true);
      const section = qp['section'];
      if (!section) return;
      const map: Record<string, string> = {
        projects: 'projets', backlog: 'backlog', analytics: 'dashboard-param',
        roadmap: 'roadmap', risks: 'risks', techdebt: 'tech-debt',
        daily: 'daily', sprints: 'sprints', dashboard: 'dashboard',
      };
      const target = map[section] || section;
      if (this.pages.some(p => p.id === target)) this.setPage(target);
      if (section === 'versions') this.versionsOpen.set(true);
    });
  }

  private reloadProjects(autoSelect = true): void {
    this.api.listProjects().subscribe({
      next: ps => {
        this.api.projects.set(ps);
        if (autoSelect && ps.length && !this.api.selectedProjectId()) {
          this.selectProject(ps[0].id);
        } else {
          // Pas de projet à charger → splash peut se fermer dès le min d'affichage.
          this.markSplashReady();
        }
      },
      error: () => {
        // Erreur (anonyme, hors-ligne) → on ouvre quand même.
        this.markSplashReady();
      }
    });
  }

  selectProject(id: number): void {
    this.api.selectedProjectId.set(id);
    this.autoEnsureCalled = false; // reset per-project flag
    this.loadActiveData();
    this.refreshLaunchable();
    this.refreshReminders();
    this.startReminderPoll();
    this.refreshEvents();
    this.startEventPoll();
    this.refreshTimeAllocation();
    // v1.0.14 — fire auto-ensure immediately on project selection too
    setTimeout(() => this.ensureEventsThenRefresh(), 800);
  }

  /** Change de page + lazy-load des données spécifiques. */
  setPage(id: string): void {
    this.activePage.set(id);
    this.currentPage.set(0);      // reset pagination quand on change de page
    // v1.0.72 — Sync yamzyCarouselIndex avec la nouvelle page si elle est dans
    // le menu carousel (sinon le scroll suivant repartirait d'un mauvais index).
    const idx = this.homeMenuCards.findIndex(c => c.pageId === id);
    if (idx >= 0) this.yamzyCarouselIndex.set(idx);
    // v1.0.117/120 — Sur changement de page, retour au tab Action (contenu de la page)
    this.heroTab.set('action');
    // v1.0.153 — Reset les dismiss "Cacher" (page-scope) au changement de page
    this.pageDismissed.set(new Set());
    this.openedAlertId.set(null);
    this.loadPageData(id);
  }

  // ════════════════ PAGINATION (lazy par défaut sur tous les tableaux) ════════
  /** Taille de page globale (default 5 — l'utilisateur peut élargir). */
  pageSize = signal(5);
  /** Page courante (0-indexée). Reset sur changement de page studio. */
  currentPage = signal(0);

  /** Renvoie la tranche correspondant à la page courante. */
  paged<T>(arr: T[] | null | undefined): T[] {
    if (!arr) return [];
    const sz = this.pageSize();
    const start = this.currentPage() * sz;
    return arr.slice(start, start + sz);
  }

  /** Nombre total de pages pour cette liste. */
  totalPages(arr: any[] | null | undefined): number {
    const len = arr?.length || 0;
    return Math.max(1, Math.ceil(len / this.pageSize()));
  }

  /** Navigation paginée (clampée). */
  goToPage(n: number, arr: any[]): void {
    const max = this.totalPages(arr) - 1;
    this.currentPage.set(Math.max(0, Math.min(max, n)));
  }

  /** Range "X–Y sur Z" lisible. */
  pageRange(arr: any[] | null | undefined): string {
    const len = arr?.length || 0;
    if (!len) return '0';
    const sz = this.pageSize();
    const from = this.currentPage() * sz + 1;
    const to = Math.min(len, (this.currentPage() + 1) * sz);
    return `${from}–${to} sur ${len}`;
  }

  // Charge les données de base (dashboard + tickets + sprints toujours, + risks + capacity pour le chrome skin).
  // Tracking : on compte les 5 chargements pour marquer splashDataReady=true à la fin.
  private loadActiveData(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    let done = 0;
    const total = 5;
    const tick = () => { if (++done >= total) this.markSplashReady(); };
    this.api.dashboard(pid).subscribe({ next: d => { this.dash.set(d); tick(); }, error: () => tick() });
    this.api.tickets(pid).subscribe({ next: t => { this.tickets.set(t); tick(); }, error: () => tick() });
    this.api.sprints(pid).subscribe({ next: s => { this.sprints.set(s); tick(); }, error: () => tick() });
    // Pré-charge pour le chrome skin (badge bell + capacity sur sidebar right)
    this.api.risks(pid).subscribe({ next: r => { this.risks.set(r); tick(); }, error: () => tick() });
    this.api.capacity(pid).subscribe({ next: c => { this.capacity.set(c); tick(); }, error: () => tick() });
    this.loadPageData(this.activePage());
  }

  /** Lazy-load les données propres à la page active. */
  private loadPageData(page: string): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const g = <T>(obs: any, sig: any) => obs.subscribe({ next: (v: T) => sig.set(v), error: () => {} });
    switch (page) {
      case 'burndown': g(this.api.burndown(pid), this.burndown); break;
      case 'risks': g(this.api.risks(pid), this.risks); break;
      case 'tech-debt': g(this.api.techDebt(pid), this.techDebt); break;
      case 'lessons': g(this.api.lessons(pid), this.lessons); break;
      case 'phases': g(this.api.phases(pid), this.phases); break;
      case 'capacity': g(this.api.capacity(pid), this.capacity); break;
      case 'roadmap': g(this.api.quarters(pid), this.quarters); g(this.api.milestones(pid), this.milestones); break;
      case 'overtime': g(this.api.overtime(pid), this.overtime); break;
      case 'retros': g(this.api.retros(pid), this.retros); break;
      case 'knowledge': g(this.api.adrs(pid), this.adrs); g(this.api.glossary(pid), this.glossary); break;
      case 'cfd-velocity': g(this.api.cfd(pid), this.cfd); g(this.api.velocity(pid), this.velocity); break;
      case 'dependances': g(this.api.dependencies(pid), this.deps); break;
      case 'projets': this.api.listProjects().subscribe({ next: (v:any) => this.allProjects.set(v), error: () => {} }); break;
      case 'dod': g(this.api.dodDor(pid, 'DoD'), this.dodDorList); break;
      case 'dor': g(this.api.dodDor(pid, 'DoR'), this.dodDorList); break;
      case 'agenda': this.ensureEventsThenRefresh(); break;
      case 'calendrier': this.ensureEventsThenRefresh(); break;
      case 'checkup': g(this.api.checklist(pid), this.checklistList); break;
      case 'stakeholders': case 'vue-stakeholder': case 'export-stakeholder':
        g(this.api.stakeholders(pid), this.stakeholdersList);
        g(this.api.stakeholderFeedback(pid), this.stakeholderFb);
        g(this.api.dashboard(pid), this.dash); break;
      case 'dashboard-param': case 'dashboard-legacy': case 'dashboard':
        g(this.api.dashboard(pid), this.dash); break;
      case 'allocation': case 'charge': g(this.api.phases(pid), this.phases); break;
      case 'daily': g(this.api.standups(pid), this.standupsList); break;
      default: break;
    }
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  pagesInCat(cat: string): PageDef[] {
    const f = this.search.toLowerCase().trim();
    return this.pages.filter(p => p.cat === cat && (!f || p.label.toLowerCase().includes(f)));
  }
  isCatOpen(cat: string): boolean {
    if (this.search.trim()) return this.pagesInCat(cat).length > 0;
    return this.openCats().has(cat);
  }
  toggleCat(cat: string): void {
    const s = new Set(this.openCats());
    s.has(cat) ? s.delete(cat) : s.add(cat);
    this.openCats.set(s);
  }

  // ─── Import ────────────────────────────────────────────────────────────────
  onFilePick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.pickedFile.set(f);
  }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.pickedFile.set(f);
  }
  doImport(): void {
    const f = this.pickedFile();
    if (!f) return;
    this.importing.set(true);
    this.importError.set(null);
    this.importResult.set(null);
    this.api.importExcel(f).subscribe({
      next: res => {
        this.importing.set(false);
        this.importResult.set(res);
        this.reloadProjects(false);
        // Sélectionne le projet importé
        setTimeout(() => {
          this.api.listProjects().subscribe(ps => {
            this.api.projects.set(ps);
            if (ps.length) this.selectProject(ps[0].id);
          });
        }, 300);
      },
      error: e => {
        this.importing.set(false);
        this.importError.set(e?.error?.message || e?.message || "Échec de l'import");
      }
    });
  }

  // ─── Helpers UI ──────────────────────────────────────────────────────────
  statusKey(status?: string): string {
    const s = (status || '').toLowerCase().trim();
    // v1.0.177bq — Ajoute 'revoir' + v1.0.177ci — Ajoute 'test' (manquait) + accents normalisés
    // ORDRE IMPORTANT : 'test' avant 'review' pour ne pas mismatch "test review"
    if (s.includes('termin') || s.includes('done') || s.includes('fait') || s.includes('clos')) return 'done';
    if (s.includes('bloq') || s.includes('block')) return 'blocked';
    if (s.includes('test') || s.includes('qa') || s.includes('recette')) return 'test';
    if (s.includes('revoir') || s.includes('revue') || s.includes('review')) return 'review';
    if (s.includes('cours') || s.includes('progress') || s === 'wip' || s.includes('in_progress')) return 'wip';
    return 'todo';
  }
  rowClass(t: PosTicket): string {
    const k = this.statusKey(t.status);
    return k === 'done' ? 'row-done' : (k === 'blocked' ? 'row-blocked' : '');
  }
  barPct(v: number, total: number): number {
    if (!total) return 0;
    return Math.max(0, Math.min(100, (v / total) * 100));
  }
  ganttLeft(t: PosTicket): number {
    // position approximative basée sur l'index de rang (simplifié)
    const all = this.tickets();
    if (!all.length) return 0;
    const i = all.indexOf(t);
    return Math.min(90, (i / all.length) * 90);
  }
  ganttWidth(t: PosTicket): number {
    const est = t.estimationHours || 4;
    return Math.max(3, Math.min(20, est / 2));
  }

  // ─── Helpers pages additionnelles ─────────────────────────────────────────
  currentProject = computed(() => {
    const id = this.api.selectedProjectId();
    return this.api.projects().find(p => p.id === id) || null;
  });

  tmaTickets = computed(() => this.tickets().filter(t => (t.ticketId || '').toUpperCase().startsWith('TMA')));

  objEntries(o: any): [string, any][] { return o ? Object.entries(o) : []; }

  moodEmoji(score?: number): string {
    if (score == null) return '—';
    return ['😣','😟','😐','🙂','😄'][Math.max(0, Math.min(4, score - 1))] + ' ' + score;
  }

  planTickets = computed(() => {
    const f = this.sprintFilter();
    if (!f) return this.tickets();
    return this.tickets().filter(t => (t.sprint || '') === f);
  });
  planTotalHours = computed(() =>
    Math.round(this.planTickets().reduce((s, t) => s + (t.estimationHours || 0), 0) * 10) / 10);

  ticketsByDate = computed(() => {
    const groups: Record<string, PosTicket[]> = {};
    for (const t of this.tickets()) {
      if (!t.deliveryDate) continue;
      (groups[t.deliveryDate] ||= []).push(t);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, list]) => ({ date, tickets: list }));
  });

  // ─── Vraie grille calendrier mensuelle (comme l'Excel) ────────────────────
  private readonly SPRINT_PALETTE = ['#a78bfa','#60a5fa','#34d399','#fbbf24','#f472b6','#22d3ee','#fb923c','#c084fc'];
  sprintColor(sprint?: string): string {
    if (!sprint) return '#6b6396';
    const m = sprint.match(/(\d+)/);
    const n = m ? parseInt(m[1]) : 0;
    return this.SPRINT_PALETTE[n % this.SPRINT_PALETTE.length];
  }
  sprintLegend = computed(() => {
    const seen = new Set<string>();
    const out: { label: string; color: string }[] = [];
    for (const t of this.tickets()) {
      const s = t.sprint || '';
      if (s && !seen.has(s)) { seen.add(s); out.push({ label: s, color: this.sprintColor(s) }); }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  });

  private parseDate(s?: string): Date | null {
    if (!s) return null;
    const d = new Date(s.length > 10 ? s.substring(0, 10) : s);
    return isNaN(d.getTime()) ? null : d;
  }

  /** v1.0.13 — Couleurs par type d'event (fallback si pas de colorHex). */
  eventTypeColorMap: Record<string, string> = {
    DAILY:    '#70b944',  // vert
    PLANNING: '#4696b9',  // bleu
    REVIEW:   '#d99a51',  // or Yamzy
    RETRO:    '#c25d8d',  // rose
    MEETING:  '#9d8ad6',  // violet
    CALL:     '#2ea1cb',  // cyan
    OTHER:    '#6b6396',  // gris
  };
  eventLegend = computed(() => {
    const seen = new Set<string>();
    const out: { type: string; label: string; color: string }[] = [];
    for (const e of this.events()) {
      const t = e.type || 'OTHER';
      if (seen.has(t)) continue;
      seen.add(t);
      out.push({ type: t, label: this.eventTypeLabel(t), color: this.eventTypeColorMap[t] || '#6b6396' });
    }
    return out;
  });

  /** v1.0.13 — Détection locale de collisions sur une liste d'events (paires overlapping). */
  private detectCollisions(list: any[]): Set<number> {
    const ids = new Set<number>();
    const sorted = [...list].sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const aStart = new Date(a.scheduledStart).getTime();
      const aEnd = new Date(a.scheduledEnd).getTime();
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const bStart = new Date(b.scheduledStart).getTime();
        const bEnd = new Date(b.scheduledEnd).getTime();
        if (bStart >= aEnd) break;
        if (aStart < bEnd && bStart < aEnd) {
          ids.add(a.id); ids.add(b.id);
        }
      }
    }
    return ids;
  }

  // ═══ v1.0.58 — Calendrier view switcher (jour / mois / année) ═══
  /** Vue active du calendrier — switch UI. */
  calendarView = signal<'day' | 'month' | 'year'>('month');
  /** Date "curseur" — point central de la vue. Init à aujourd'hui. */
  calendarCursor = signal<Date>(new Date());

  setCalendarView(v: 'day' | 'month' | 'year'): void { this.calendarView.set(v); }
  calendarToday(): void { this.calendarCursor.set(new Date()); }
  calendarPrev(): void {
    const c = new Date(this.calendarCursor());
    const v = this.calendarView();
    if (v === 'day') c.setDate(c.getDate() - 1);
    else if (v === 'month') c.setMonth(c.getMonth() - 1);
    else c.setFullYear(c.getFullYear() - 1);
    this.calendarCursor.set(c);
  }
  calendarNext(): void {
    const c = new Date(this.calendarCursor());
    const v = this.calendarView();
    if (v === 'day') c.setDate(c.getDate() + 1);
    else if (v === 'month') c.setMonth(c.getMonth() + 1);
    else c.setFullYear(c.getFullYear() + 1);
    this.calendarCursor.set(c);
  }
  /** Label header selon vue (ex. "Lundi 02 juin 2026" / "Juin 2026" / "2026"). */
  calendarCursorLabel = computed(() => {
    const c = this.calendarCursor();
    const v = this.calendarView();
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    if (v === 'day') return `${days[c.getDay()]} ${c.getDate()} ${months[c.getMonth()].toLowerCase()} ${c.getFullYear()}`;
    if (v === 'month') return `${months[c.getMonth()]} ${c.getFullYear()}`;
    return `${c.getFullYear()}`;
  });

  /** Vue JOUR : événements du jour curseur, triés par heure. */
  calendarDayEvents = computed(() => {
    const cur = this.calendarCursor();
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    const events = (this.events() || []).filter(ev => ev.scheduledStart && ev.scheduledStart.substring(0,10) === dateStr);
    const collisionIds = this.detectCollisions(events);
    return events
      .map(ev => ({
        id: ev.id, type: ev.type, title: ev.title,
        time: this.formatTime(ev.scheduledStart),
        endTime: this.formatTime(ev.scheduledEnd),
        color: ev.colorHex || this.eventTypeColorMap[ev.type] || '#6b6396',
        collision: collisionIds.has(ev.id),
        attendees: (ev.attendees || []),
        status: ev.status,
      }))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  });

  /** Vue MOIS : un seul mois (celui du curseur) en grille. */
  calendarMonthView = computed(() => {
    const cur = this.calendarCursor();
    const tickets = this.tickets().filter(t => t.deliveryDate || t.startDate);
    const events = this.events() || [];
    const collisionIds = this.detectCollisions(events);
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const todayStr = new Date().toISOString().substring(0, 10);
    const year = cur.getFullYear(), month = cur.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells: any[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = (new Date(year, month, d).getDay() + 6) % 7;
      const dayTickets = tickets.filter(t => {
        const s = this.parseDate(t.startDate);
        const e = this.parseDate(t.deliveryDate) || s;
        const st = s || e;
        if (!st || !e) return false;
        const cell = new Date(dateStr);
        return cell >= new Date(st.toISOString().substring(0,10)) && cell <= new Date(e.toISOString().substring(0,10));
      });
      const dayEvents = events
        .filter(ev => ev.scheduledStart && ev.scheduledStart.substring(0, 10) === dateStr)
        .map(ev => ({
          id: ev.id, type: ev.type, title: ev.title,
          time: this.formatTime(ev.scheduledStart),
          color: ev.colorHex || this.eventTypeColorMap[ev.type] || '#6b6396',
          collision: collisionIds.has(ev.id),
          attendeesCount: (ev.attendees || []).length,
          attendees: (ev.attendees || []).slice(0, 4),
          status: ev.status,
        }))
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      cells.push({
        day: d, weekend: dow >= 5, isToday: dateStr === todayStr,
        tickets: dayTickets, events: dayEvents,
        hasCollision: dayEvents.some(e => e.collision),
        dateStr,
      });
    }
    return { label: `${monthNames[month]} ${year}`, cells };
  });

  /** Vue ANNÉE : 12 mini-mois avec compte d'événements / mois. */
  calendarYearView = computed(() => {
    const cur = this.calendarCursor();
    const events = this.events() || [];
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const year = cur.getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const monthEvents = events.filter(ev => {
        if (!ev.scheduledStart) return false;
        const d = new Date(ev.scheduledStart);
        return d.getFullYear() === year && d.getMonth() === m;
      });
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const firstDow = (new Date(year, m, 1).getDay() + 6) % 7;
      const cells: any[] = [];
      for (let i = 0; i < firstDow; i++) cells.push({ day: null });
      for (let d = 1; d <= daysInMonth; d++) {
        const has = monthEvents.some(ev => {
          const dt = new Date(ev.scheduledStart!);
          return dt.getDate() === d;
        });
        cells.push({ day: d, hasEvent: has });
      }
      return { idx: m, label: monthNames[m], year, count: monthEvents.length, cells };
    });
  });

  /** Click sur un mini-mois en vue année → switch en vue mois sur ce mois. */
  goToMonth(monthIdx: number, year: number): void {
    this.calendarCursor.set(new Date(year, monthIdx, 1));
    this.calendarView.set('month');
  }
  /** Click sur une case en vue mois → switch en vue jour sur cette date. */
  goToDay(dateStr: string): void {
    this.calendarCursor.set(new Date(dateStr));
    this.calendarView.set('day');
  }

  calendarMonths = computed(() => {
    const tickets = this.tickets().filter(t => t.deliveryDate || t.startDate);
    const events = this.events() || [];
    if (!tickets.length && !events.length) return [];
    // Plage de dates : min(ticket/event start) → max
    let min: Date | null = null, max: Date | null = null;
    for (const t of tickets) {
      const s = this.parseDate(t.startDate) || this.parseDate(t.deliveryDate);
      const e = this.parseDate(t.deliveryDate) || this.parseDate(t.startDate);
      if (s && (!min || s < min)) min = s;
      if (e && (!max || e > max)) max = e;
    }
    for (const ev of events) {
      const s = ev.scheduledStart ? new Date(ev.scheduledStart) : null;
      const e = ev.scheduledEnd ? new Date(ev.scheduledEnd) : null;
      if (s && (!min || s < min)) min = s;
      if (e && (!max || e > max)) max = e;
    }
    if (!min || !max) return [];

    // Détection collisions (set d'ids en collision)
    const collisionIds = this.detectCollisions(events);

    const months: any[] = [];
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const todayStr = new Date().toISOString().substring(0, 10);
    let cur = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth(), 1);
    let guard = 0;
    while (cur <= end && guard++ < 36) {
      const year = cur.getFullYear(), month = cur.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
      const cells: any[] = [];
      for (let i = 0; i < firstDow; i++) cells.push({ day: null });
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dow = (new Date(year, month, d).getDay() + 6) % 7;
        const dayTickets = tickets.filter(t => {
          const s = this.parseDate(t.startDate);
          const e = this.parseDate(t.deliveryDate) || s;
          const st = s || e;
          if (!st || !e) return false;
          const cell = new Date(dateStr);
          return cell >= new Date(st.toISOString().substring(0,10)) && cell <= new Date(e.toISOString().substring(0,10));
        });
        const dayEvents = events
          .filter(ev => ev.scheduledStart && ev.scheduledStart.substring(0, 10) === dateStr)
          .map(ev => ({
            id: ev.id,
            type: ev.type,
            title: ev.title,
            time: this.formatTime(ev.scheduledStart),
            color: ev.colorHex || this.eventTypeColorMap[ev.type] || '#6b6396',
            collision: collisionIds.has(ev.id),
            attendeesCount: (ev.attendees || []).length,
            attendees: (ev.attendees || []).slice(0, 4),
            status: ev.status,
          }))
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        cells.push({
          day: d, weekend: dow >= 5, isToday: dateStr === todayStr,
          tickets: dayTickets, events: dayEvents,
          hasCollision: dayEvents.some(e => e.collision),
          dateStr,
        });
      }
      months.push({ label: `${monthNames[month]} ${year}`, cells });
      cur = new Date(year, month + 1, 1);
    }
    return months;
  });

  /** Modèle Gantt : barres temporelles positionnées par dates, colorées par sprint. */
  ganttModel = computed(() => {
    const tickets = this.tickets().filter(t => t.startDate || t.deliveryDate);
    if (!tickets.length) return { months: [], rows: [], todayPct: -1 };
    let min: Date | null = null, max: Date | null = null;
    const parsed = tickets.map(t => {
      const s = this.parseDate(t.startDate) || this.parseDate(t.deliveryDate)!;
      const e = this.parseDate(t.deliveryDate) || this.parseDate(t.startDate)!;
      return { t, s, e };
    });
    for (const { s, e } of parsed) {
      if (s && (!min || s < min)) min = s;
      if (e && (!max || e > max)) max = e;
    }
    if (!min || !max) return { months: [], rows: [], todayPct: -1 };
    const span = Math.max(1, (max.getTime() - min.getTime()) / 86400000); // jours
    const pct = (d: Date) => ((d.getTime() - min!.getTime()) / 86400000) / span * 100;
    const monthNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
    // Mois de la timeline avec largeur proportionnelle
    const months: any[] = [];
    let cur = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth(), 1);
    let guard = 0;
    while (cur <= end && guard++ < 48) {
      const mStart = new Date(Math.max(cur.getTime(), min.getTime()));
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const mEnd = new Date(Math.min(next.getTime(), max.getTime()));
      const w = Math.max(0, (mEnd.getTime() - mStart.getTime()) / 86400000) / span * 100;
      months.push({ label: `${monthNames[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, widthPct: w });
      cur = next;
    }
    const rows = parsed.map(({ t, s, e }) => {
      const left = pct(s);
      const width = Math.max(1.5, pct(e) - left);
      return {
        ticketId: t.ticketId, title: t.title, sprint: t.sprint,
        startDate: t.startDate, endDate: t.deliveryDate,
        leftPct: left, widthPct: width, color: this.sprintColor(t.sprint),
      };
    });
    const now = new Date();
    const todayPct = (now >= min && now <= max) ? pct(now) : -1;
    return { months, rows, todayPct };
  });

  printExport(): void { window.print(); }

  // ── DoD/DoR + Checklist (groupage + toggle persisté) ──
  private groupBySection(list: any[]): { section: string; items: any[] }[] {
    const groups: Record<string, any[]> = {};
    for (const c of list) (groups[c.section || 'Général'] ||= []).push(c);
    return Object.entries(groups).map(([section, items]) => ({ section, items }));
  }
  dodDorBySection = computed(() => this.groupBySection(this.dodDorList()));
  dodDorDone = computed(() => this.dodDorList().filter(c => c.isValidated).length);
  checklistBySection = computed(() => this.groupBySection(this.checklistList()));
  checklistDone = computed(() => this.checklistList().filter(c => c.isChecked).length);

  toggleDod(c: any, checked: boolean): void {
    c.isValidated = checked;
    this.dodDorList.set([...this.dodDorList()]);
    this.api.toggleDodDor(c.id, checked).subscribe({ error: () => {} });
  }
  toggleCheck(c: any, checked: boolean): void {
    c.isChecked = checked;
    this.checklistList.set([...this.checklistList()]);
    this.api.toggleChecklist(c.id, checked).subscribe({ error: () => {} });
  }

  // ── Stakeholders helpers ──
  isToday(dateStr?: string): boolean {
    if (!dateStr) return false;
    return dateStr.substring(0, 10) === new Date().toISOString().substring(0, 10);
  }
  stakeholderName(id: number): string {
    return this.stakeholdersList().find(s => s.id === id)?.name || '—';
  }
  avgScore(stakeholderId: number): number | null {
    const fb = this.stakeholderFb().filter(f => f.stakeholderId === stakeholderId && f.score != null);
    if (!fb.length) return null;
    return Math.round(fb.reduce((s, f) => s + f.score, 0) / fb.length);
  }
  scoreColor(score?: number): string {
    if (score == null) return '#8b80c0';
    if (score >= 8) return '#6ee7b7';
    if (score >= 5) return '#fcd34d';
    return '#fca5a5';
  }

  // ─── Versioning + delete planning ─────────────────────────────────────────
  versionsOpen = signal(false);
  versions = signal<any[]>([]);
  newVersionLabel = '';

  toggleVersions(): void {
    const open = !this.versionsOpen();
    this.versionsOpen.set(open);
    if (open) this.reloadVersions();
  }
  private reloadVersions(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    this.api.listVersions(pid).subscribe({ next: v => this.versions.set(v || []), error: () => {} });
  }
  saveVersion(): void {
    const pid = this.api.selectedProjectId();
    if (!pid) return;
    const label = this.newVersionLabel.trim() || ('Sauvegarde ' + new Date().toLocaleString('fr-FR'));
    this.api.saveVersion(pid, label).subscribe({
      next: () => { this.newVersionLabel = ''; this.reloadVersions(); },
      error: () => {}
    });
  }
  async restoreVersion(v: any): Promise<void> {
    const ok = await this.dialog.confirm({
      title: `Restaurer la version **${v.label}** ?`,
      message: `L'état actuel du planning sera remplacé. Pense à le sauvegarder d'abord si besoin.`,
      kind: 'warning',
      confirmLabel: '↩ Restaurer',
      details: [
        { label: 'Source', value: v.source || 'SNAPSHOT' },
        { label: 'Quêtes', value: String(v.ticketCount || 0) },
        { label: 'Créée le', value: v.createdAt ? new Date(v.createdAt).toLocaleString('fr-FR') : '—' },
      ]
    });
    if (!ok) return;
    this.api.restoreVersion(v.id).subscribe({
      next: () => { this.reloadVersions(); this.loadActiveData(); },
      error: () => {}
    });
  }
  async deleteVersion(v: any): Promise<void> {
    const ok = await this.dialog.confirm({
      title: `Supprimer la version **${v.label}** ?`,
      message: `Ce snapshot sera perdu définitivement.`,
      kind: 'warning',
      confirmLabel: '🗑 Supprimer',
    });
    if (!ok) return;
    this.api.deleteVersion(v.id).subscribe({ next: () => this.reloadVersions(), error: () => {} });
  }

  /** Supprime le planning courant. */
  async deletePlanning(): Promise<void> {
    const pid = this.api.selectedProjectId();
    const proj = this.currentProject();
    if (!pid || !proj) return;
    const ok = await this.dialog.confirm({
      title: `Supprimer le planning **${proj.code} · ${proj.name}** ?`,
      message: `Toutes les données associées seront perdues définitivement. Action **irréversible**.`,
      kind: 'error',
      confirmLabel: '🗑 Supprimer définitivement',
      details: [
        { label: 'Code', value: proj.code },
        { label: 'Sera supprimé', value: 'quêtes, sprints, versions, risks, etc.' },
      ]
    });
    if (!ok) return;
    this.api.deleteProject(pid).subscribe({
      next: () => {
        this.api.selectedProjectId.set(null);
        this.api.listProjects().subscribe(ps => {
          this.api.projects.set(ps);
          if (ps.length) this.selectProject(ps[0].id);
        });
      },
      error: () => {}
    });
  }

  exporting = signal(false);
  /** Télécharge le .xlsx régénéré depuis la DB. */
  doExport(): void {
    const pid = this.api.selectedProjectId();
    if (!pid || this.exporting()) return;
    this.exporting.set(true);
    this.api.exportExcel(pid).subscribe({
      next: blob => {
        this.exporting.set(false);
        const code = this.currentProject()?.code || 'project';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WAR_TABLE_${code}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      },
      error: () => { this.exporting.set(false); }
    });
  }

  /** Sauvegarde inline d'un champ ticket → PUT /api/pos/tickets/:id (optimiste). */
  saveField(t: PosTicket, field: keyof PosTicket, raw: any): void {
    let value: any = raw;
    if (field === 'estimationHours' || field === 'progressPercent' || field === 'spentHours') {
      value = raw === '' || raw == null ? null : Number(raw);
    }
    // Optimistic local update
    (t as any)[field] = value;
    this.savingId.set(t.id);
    this.savedId.set(null);
    const patch: any = {}; patch[field] = value;
    this.api.updateTicket(t.id, patch).subscribe({
      next: (updated) => {
        // Recalc story points depuis le backend (Fibonacci)
        if (updated?.storyPoints != null) t.storyPoints = updated.storyPoints;
        this.savingId.set(null);
        this.savedId.set(t.id);
        setTimeout(() => { if (this.savedId() === t.id) this.savedId.set(null); }, 1500);
        // Rafraîchit le dashboard (KPIs) après un changement de statut/estimation
        if (field === 'status' || field === 'estimationHours' || field === 'progressPercent') {
          const pid = this.api.selectedProjectId();
          if (pid) this.api.dashboard(pid).subscribe({ next: d => this.dash.set(d), error: () => {} });
        }
      },
      error: () => { this.savingId.set(null); }
    });
  }

  isGuidePage = computed(() => {
    const guides = ['mode-emploi', 'routine', 'nouveau-projet', 'regen-alloc', 'listes'];
    return guides.includes(this.activePage());
  });

  guideContent(): string {
    switch (this.activePage()) {
      case 'mode-emploi': return `
        <h3>📖 Mode d'emploi — WAR TABLE</h3>
        <ol>
          <li><b>Importe</b> ton classeur Excel via le bouton ⬆ en haut à droite.</li>
          <li>WAR TABLE crée ton <b>Realm</b> (projet) + toutes ses <b>quêtes</b> (tickets), sprints, risques…</li>
          <li>Navigue les 42 pages via la sidebar gauche, organisées en 15 catégories.</li>
          <li>Les KPIs (Cycle/Lead time, Throughput, Story Points) sont calculés automatiquement.</li>
          <li>Sélectionne un autre projet via le sélecteur REALM en haut.</li>
        </ol>`;
      case 'routine': return `
        <h3>📅 Routine quotidienne</h3>
        <ul>
          <li><b>Matin</b> : consulte le Dashboard Global + le Daily Stand-up.</li>
          <li><b>Journée</b> : avance tes quêtes, mets à jour leur statut dans le Backlog.</li>
          <li><b>Soir</b> : note tes heures (Heures Sup) et tes blocages.</li>
          <li><b>Fin de sprint</b> : Sprint Review + Rétrospective.</li>
        </ul>`;
      case 'checkup': return `
        <h3>🚀 Check-up lancement (J-1)</h3>
        <ul>
          <li>☐ Environnement de dev installé</li><li>☐ Accès aux outils/plateformes</li>
          <li>☐ Backlog initial rempli</li><li>☐ Sprint 1 planifié</li>
          <li>☐ Équipe + capacités définies</li><li>☐ Risques initiaux identifiés</li>
          <li>☐ Definition of Done validée</li><li>☐ Repo Git créé</li>
        </ul>`;
      case 'daily': return `
        <h3>🗣 Daily Stand-up</h3>
        <p>Chaque jour, réponds aux 3 questions :</p>
        <ul><li><b>Hier</b> : qu'ai-je terminé ?</li><li><b>Aujourd'hui</b> : sur quoi je travaille ?</li>
        <li><b>Blocages</b> : qu'est-ce qui me ralentit ?</li></ul>
        <p class="wt-muted">Saisie persistée à venir — pour l'instant suis tes tickets dans le Backlog.</p>`;
      case 'nouveau-projet': return `
        <h3>🆕 Nouveau projet</h3>
        <p>Pour créer un nouveau Realm : importe un nouveau classeur Excel avec un <b>code projet</b> différent
        dans l'onglet <i>Projets</i>. Chaque code = un projet distinct sur la WAR TABLE.</p>`;
      case 'regen-alloc': return `
        <h3>🔄 Régénérer l'allocation</h3>
        <p>L'allocation jour-par-jour est recalculée à chaque import depuis les phases et la capacité.
        Réimporte ton Excel mis à jour pour rafraîchir.</p>`;
      case 'listes': return `
        <h3>🔒 Listes de référence</h3>
        <p><b>Statuts</b> : À faire · En cours · En revue · Terminé · Bloqué</p>
        <p><b>Types</b> : Story · Bug · Spike · Task</p>
        <p><b>Priorités</b> : Must · Should · Could · Won't</p>
        <p><b>Story Points</b> (Fibonacci) : 1 · 2 · 3 · 5 · 8 · 13 · 21</p>`;
      default: return '';
    }
  }
}
