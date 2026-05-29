// WAR TABLE ⚔ — Splash "Planification Temporelle".
// Pattern : background-image via [style] + probe fetch HEAD silencieux.
// Image attendue : /assets/splash/war-table.png (sinon gradient cosmique fallback).

import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges,
  Input, Output, EventEmitter, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface SplashStage { pct: number; label: string; }

@Component({
  selector: 'app-war-table-splash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './war-table-splash.component.html',
  styleUrls: ['./war-table-splash.component.css'],
})
export class WarTableSplashComponent implements OnInit, OnDestroy, OnChanges {
  @Input() dataReady = false;
  @Output() ready = new EventEmitter<void>();

  progress = signal(0);
  stage = signal('OUVERTURE DU STUDIO');
  stageIdx = signal(0);
  leaving = signal(false);
  hasImage = signal(false);
  private resolvedPath: string | null = null;

  readonly stages: SplashStage[] = [
    { pct: 0,   label: 'OUVERTURE DU STUDIO' },
    { pct: 14,  label: 'CONNEXION À LA TABLE' },
    { pct: 28,  label: 'INVOCATION DES PLANNINGS' },
    { pct: 45,  label: 'MAPPING DES VALEURS' },
    { pct: 62,  label: 'ÉVALUATION DES RISQUES' },
    { pct: 78,  label: 'CALIBRAGE DE LA SPHÈRE TEMPORELLE' },
    { pct: 92,  label: 'PRÉPARATION DES CYCLES' },
    { pct: 100, label: 'PRÊT — Bienvenue, Stratège' },
  ];

  readonly particles = Array.from({ length: 24 }, () => ({
    x: Math.random() * 100, d: Math.random() * 5, u: 8 + Math.random() * 6,
  }));

  private readonly hints = [
    'Préparation des sphères armillaires…',
    'Ouverture du grimoire de planification…',
    'Calibrage du sablier des sprints…',
    'Invocation des stakeholders…',
    'Lecture des constellations Scrum…',
    'Forge des story points…',
    'Alignement des rétrospectives…',
  ];
  hint = signal(this.hints[0]);

  private completed = false;
  private timer?: any;
  private hintTimer?: any;

  ngOnInit(): void {
    this.probeImage();

    let hi = 0;
    this.hintTimer = setInterval(() => {
      hi = (hi + 1) % this.hints.length;
      this.hint.set(this.hints[hi]);
    }, 1600);

    let p = 0;
    this.timer = setInterval(() => {
      const target = this.completed ? 100 : 92;
      const step = (target - p) * 0.045 + 0.35;
      p = Math.min(target, p + step);
      this.progress.set(Math.round(p));
      let idx = 0;
      for (let i = 0; i < this.stages.length; i++) if (p >= this.stages[i].pct) idx = i;
      if (this.stageIdx() !== idx) {
        this.stageIdx.set(idx);
        this.stage.set(this.stages[idx].label);
      }
      if (p >= 100) {
        clearInterval(this.timer);
        setTimeout(() => {
          this.leaving.set(true);
          setTimeout(() => this.ready.emit(), 500);
        }, 380);
      }
    }, 70);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dataReady']?.currentValue === true) this.completed = true;
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.hintTimer) clearInterval(this.hintTimer);
  }

  private probeImage(): void {
    const path = '/assets/splash/war-table.png';
    (async () => {
      try {
        const r = await fetch(path, { method: 'HEAD', cache: 'force-cache' });
        if (r.ok) {
          this.resolvedPath = path;
          this.hasImage.set(true);
        }
      } catch { /* gradient fallback */ }
    })();
  }

  bgUrl(): string {
    const gradient = 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)';
    if (this.hasImage() && this.resolvedPath) {
      return `url('${this.resolvedPath}'), ${gradient}`;
    }
    return gradient;
  }

  playerName(): string {
    try {
      const raw = localStorage.getItem('yamzy_user_name')
        || localStorage.getItem('yamzy_login')
        || '';
      return raw || 'Stratège';
    } catch { return 'Stratège'; }
  }
}
