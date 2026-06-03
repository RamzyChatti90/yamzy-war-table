// ═══════════════════════════════════════════════════════════════════
// v0.1 conclave — Thunder Stats (texte avec éclairs/sparks électriques)
// Adapté du CodePen "thunder-to-text" (Anh Yêu Em! / I love you!) en
// retirant l'aspect TYPING (texte progressif). Le texte est rendu d'un
// bloc et les éclairs jaillissent en continu des pixels lumineux.
//
// Usage :
//   <wt-thunder-stats [stats]="[{value:'39',label:'tickets actifs'},...]">
//   </wt-thunder-stats>
// ═══════════════════════════════════════════════════════════════════

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ThunderStat {
  value: string;
  label: string;
}

// ─── ÉCLAIR (lightning bolt) ─────────────────────────────────────────
class Thunder {
  lifespan: number;
  maxlife: number;
  color: string;
  glow: string;
  x: number;
  y: number;
  width: number;
  direct: number;
  max: number;
  segments: { direct: number; length: number; change: number }[];

  constructor(opts: any) {
    this.lifespan = opts.lifespan ?? Math.round(Math.random() * 6 + 4);
    this.maxlife = this.lifespan;
    this.color = opts.color || '#fefefe';
    this.glow = opts.glow || '#2323fe';
    this.x = opts.x;
    this.y = opts.y;
    this.width = opts.width || 1;
    this.direct = opts.direct ?? Math.random() * Math.PI * 2;
    this.max = opts.max ?? Math.round(Math.random() * 4 + 3);
    this.segments = Array.from({ length: this.max }, () => ({
      direct: this.direct + (Math.PI * Math.random() * 0.2 - 0.1),
      // Segments COURTS (canvas petit) — original = 80-100, ici 4-10
      length: Math.random() * 6 + 4,
      change: Math.random() * 0.04 - 0.02,
    }));
  }

  update(index: number, array: Thunder[]) {
    this.segments.forEach(s => {
      s.direct += s.change;
      if (Math.random() > 0.96) s.change *= -1;
    });
    if (this.lifespan > 0) this.lifespan--;
    else array.splice(index, 1);
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.lifespan <= 0) return;
    ctx.beginPath();
    ctx.globalAlpha = this.lifespan / this.maxlife;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.glow;
    ctx.moveTo(this.x, this.y);
    let prev = { x: this.x, y: this.y };
    this.segments.forEach(s => {
      const x = prev.x + Math.cos(s.direct) * s.length;
      const y = prev.y + Math.sin(s.direct) * s.length;
      prev = { x, y };
      ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.closePath();
    ctx.shadowBlur = 0;
    // Aura lumineuse au point d'origine (étincelle jaune)
    const strength = Math.random() * 14 + 8;
    const light = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, strength);
    light.addColorStop(0, 'rgba(250, 200, 50, 0.6)');
    light.addColorStop(0.1, 'rgba(250, 200, 50, 0.2)');
    light.addColorStop(0.4, 'rgba(250, 200, 50, 0.06)');
    light.addColorStop(0.65, 'rgba(250, 200, 50, 0.01)');
    light.addColorStop(0.8, 'rgba(250, 200, 50, 0)');
    ctx.beginPath();
    ctx.fillStyle = light;
    ctx.arc(this.x, this.y, strength, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

// ─── ÉTINCELLE (spark particle) ───────────────────────────────────────
class Spark {
  x: number;
  y: number;
  v: { direct: number; weight: number; friction: number };
  a: { change: number; min: number; max: number };
  g: { direct: number; weight: number };
  width: number;
  lifespan: number;
  maxlife: number;
  color: string;
  prev: { x: number; y: number };

  constructor(opts: any) {
    this.x = opts.x;
    this.y = opts.y;
    this.v = opts.v ?? {
      direct: Math.random() * Math.PI * 2,
      weight: Math.random() * 3 + 0.5, // velocity réduite (original 14+2)
      friction: 0.88,
    };
    this.a = opts.a ?? {
      change: Math.random() * 0.4 - 0.2,
      min: this.v.direct - Math.PI * 0.4,
      max: this.v.direct + Math.PI * 0.4,
    };
    this.g = opts.g ?? {
      direct: Math.PI * 0.5 + (Math.random() * 0.4 - 0.2),
      weight: Math.random() * 0.1 + 0.1, // gravité réduite
    };
    this.width = opts.width ?? Math.random() * 1.5;
    this.lifespan = opts.lifespan ?? Math.round(Math.random() * 12 + 20);
    this.maxlife = this.lifespan;
    this.color = opts.color || '#feca32';
    this.prev = { x: this.x, y: this.y };
  }

  update(index: number, array: Spark[]) {
    this.prev = { x: this.x, y: this.y };
    this.x += Math.cos(this.v.direct) * this.v.weight;
    this.x += Math.cos(this.g.direct) * this.g.weight;
    this.y += Math.sin(this.v.direct) * this.v.weight;
    this.y += Math.sin(this.g.direct) * this.g.weight;
    if (this.v.weight > 0.2) this.v.weight *= this.v.friction;
    this.v.direct += this.a.change;
    if (this.v.direct > this.a.max || this.v.direct < this.a.min) this.a.change *= -1;
    if (this.lifespan > 0) this.lifespan--;
    if (this.lifespan <= 0) array.splice(index, 1);
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.lifespan <= 0) return;
    ctx.beginPath();
    ctx.globalAlpha = this.lifespan / this.maxlife;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.prev.x, this.prev.y);
    ctx.stroke();
    ctx.closePath();
  }
}

// ─── GERBE de SPARKS (gros impact) ────────────────────────────────────
class Particles {
  sparks: Spark[];

  constructor(opts: any) {
    const max = opts.max ?? Math.round(Math.random() * 4 + 3);
    this.sparks = Array.from({ length: max }, () => new Spark(opts));
  }

  update() {
    this.sparks.forEach((s, i) => s.update(i, this.sparks));
  }

  render(ctx: CanvasRenderingContext2D) {
    this.sparks.forEach(s => s.render(ctx));
  }
}

// ─── TEXTE-FOUDRE (texte rendu pixels + émission continue) ────────────
class ThunderText {
  size: number;
  copy: string;
  color: string;
  font: string;
  bound: { width: number; height: number };
  x: number;
  y: number;
  data: ImageData;

  constructor(opts: any) {
    const pool = document.createElement('canvas');
    const buffer = pool.getContext('2d')!;
    this.size = opts.size ?? 20;
    this.copy = opts.copy + ' ';
    this.color = opts.color || '#cd96fe';
    this.font = opts.font || `800 ${this.size}px Poppins, sans-serif`;

    // Mesure et dim canvas exact au texte
    buffer.font = this.font;
    const measure = buffer.measureText(this.copy);
    this.bound = {
      width: Math.max(1, Math.ceil(measure.width) + 4),
      height: Math.max(1, Math.ceil(this.size * 1.4)),
    };
    pool.width = this.bound.width;
    pool.height = this.bound.height;

    // Re-set font après resize canvas (le resize reset le contexte)
    buffer.fillStyle = '#000000';
    buffer.fillRect(0, 0, pool.width, pool.height);
    buffer.font = this.font;
    buffer.strokeStyle = this.color;
    buffer.lineWidth = 1.2;
    buffer.strokeText(this.copy, 0, this.size);

    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.data = buffer.getImageData(0, 0, this.bound.width, this.bound.height);
  }

  // IMPORTANT : pas de progressive index — on échantillonne des pixels
  // aléatoires en continu (texte déjà tracé d'un bloc)
  update(thunder: Thunder[], particles: Particles[]) {
    const data = this.data.data;
    const W = this.data.width;
    const H = this.data.height;
    // ~4 candidates par frame
    for (let n = 0; n < 4; n++) {
      const px = Math.floor(Math.random() * W);
      const py = Math.floor(Math.random() * H);
      const i = (py * W + px) * 4;
      const bitmap = data[i] + data[i + 1] + data[i + 2] + data[i + 3];
      if (bitmap > 255 && Math.random() > 0.4) {
        const x = this.x + px;
        const y = this.y + py;
        if (thunder.length < 30) {
          thunder.push(new Thunder({ x, y }));
        }
        if (particles.length < 25 && Math.random() > 0.5) {
          particles.push(new Particles({ x, y }));
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.putImageData(this.data, this.x, this.y);
  }
}

// ─── COMPOSANT ANGULAR ────────────────────────────────────────────────
@Component({
  selector: 'wt-thunder-stats',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #canvas class="thunder-canvas"></canvas>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      pointer-events: none;
    }
    .thunder-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WtThunderStatsComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() stats: ThunderStat[] = [];
  @Input() valueSize = 22;
  @Input() labelSize = 9;
  @Input() valueColor = '#cd96fe';   // violet (comme l'exemple)
  @Input() labelColor = '#feca32';   // jaune-doré
  @Input() canvasWidth = 200;
  @Input() canvasHeight = 200;

  private ctx!: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private texts: ThunderText[] = [];
  private thunder: Thunder[] = [];
  private particles: Particles[] = [];
  private rafId = 0;
  private destroyed = false;
  private initialized = false;

  constructor(private zone: NgZone) {}

  ngAfterViewInit() {
    this.initCanvas();
    this.initialized = true;
    this.zone.runOutsideAngular(() => this.loop());
  }

  ngOnChanges(c: SimpleChanges) {
    if (this.initialized && c['stats']) {
      this.rebuildTexts();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
  }

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    this.w = Math.max(this.canvasWidth, rect.width || this.canvasWidth);
    this.h = Math.max(this.canvasHeight, rect.height || this.canvasHeight);
    canvas.width = this.w * dpr;
    canvas.height = this.h * dpr;
    canvas.style.width = this.w + 'px';
    canvas.style.height = this.h + 'px';
    this.ctx.scale(dpr, dpr);
    this.rebuildTexts();
  }

  private rebuildTexts() {
    // 6 lignes verticales : value / label / value / label / value / label
    let y = 6;
    const lines: { text: string; size: number; color: string }[] = [];
    this.stats.forEach(stat => {
      lines.push({ text: stat.value, size: this.valueSize, color: this.valueColor });
      lines.push({ text: stat.label, size: this.labelSize, color: this.labelColor });
    });

    this.texts = lines.map(line => {
      const t = new ThunderText({
        copy: line.text,
        size: line.size,
        color: line.color,
        x: 8,
        y,
      });
      y += t.bound.height + (line.size === this.labelSize ? 6 : 2);
      return t;
    });
  }

  private loop = () => {
    if (this.destroyed) return;
    this.update();
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update() {
    this.texts.forEach(t => t.update(this.thunder, this.particles));
    this.thunder.forEach((l, i) => l.update(i, this.thunder));
    this.particles.forEach(p => p.update());
  }

  private render() {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.globalCompositeOperation = 'screen';
    this.texts.forEach(t => t.render(ctx));
    this.thunder.forEach(l => l.render(ctx));
    this.particles.forEach(p => p.render(ctx));
  }
}
