// Cosmos Projet — Vue cosmique d'un projet sur 1 an.
//
// METAPHORE :
//   ☀️ Soleil au centre  = Projet
//   🪐 9 orbites concentriques = unités de temps (today, week, sprint, sprint+1, phase, milestones, pre-release, post-release, closure)
//   💎 Asteroid belt entre Mars et Jupiter = backlog non priorisé
//   🪐 Planètes = tickets (couleur=status, taille=storyPoints, halo=priorité, position angulaire=dueDate)
//   ⚪ Lune autour d'Earth = sous-tickets
//   💫 Comètes traversantes = milestones
//   🌑 Trou noir au coin = tickets CANCELLED (engloutis)
//   🌈 Aurore boréale en fond = sentiment global du projet
//
// INTERACTIONS :
//   - Hover planète → tooltip (titre, sprint, assignee, dueDate, SP)
//   - Click → émet ticketSelected
//   - Slider temporel en bas → modifie currentDate, l'horloge tourne
//   - Bouton NOW → revient au présent

import {
  Component, Input, Output, EventEmitter, signal, computed, OnInit, OnDestroy, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cosmos3dSceneComponent, PlacedPlanet3D } from './cosmos-3d-scene.component';
import { CosmosOrreryComponent } from './cosmos-orrery.component';

export interface CosmosTicket {
  id: string | number;
  title: string;
  status?: string;        // TODO | IN_PROGRESS | DONE | BLOCKED | CANCELLED
  storyPoints?: number;
  priority?: string;      // MUST | SHOULD | COULD | WONT
  dueDate?: string | Date;
  sprintId?: string | number;
  sprintName?: string;
  assignee?: string;
  progress?: number;      // 0-100
  hasComments?: boolean;
  hasSubtasks?: boolean;
}

export interface CosmosMilestone {
  id: string | number;
  label: string;
  date: string | Date;
  type?: 'release' | 'review' | 'kickoff' | 'closure';
}

// ═══════════════ TOP 5 WINS — Nouvelles interfaces ═══════════════

/** P3 — Membre d'équipe (lune en orbite proche du soleil) */
export interface CosmosTeamMember {
  id: string | number;
  name: string;
  avatarUrl?: string;
  capacityPct?: number;        // 0-100 : utilisé pour brightness
  isOnline?: boolean;
  color?: string;
}

/** P4 — Risque (astéroïde sombre entre les orbites) */
export interface CosmosRisk {
  id: string | number;
  label: string;
  score?: number;              // 0-100 : score de risque, contrôle la taille
  triggerDate?: string | Date; // proche de NOW = plus menaçant
  category?: string;
}

/** P4 — Dépendance entre tickets (arc lumineux) */
export interface CosmosDependency {
  fromTicketId: string | number;
  toTicketId: string | number;
  type?: 'blocks' | 'related' | 'depends_on';
}

/** P5 — Cérémonie (comète avec signature visuelle distincte) */
export interface CosmosCeremony {
  id: string | number;
  date: string | Date;
  type: 'daily' | 'planning' | 'review' | 'retro' | 'wrap-up';
  label?: string;
}

/** P1 — Sprint actif (anneau autour du soleil) */
export interface CosmosSprintActive {
  name: string;
  dayIndex?: number;
  totalDays?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  /** Pourcentage avancement du sprint (0-100) */
  progressPct?: number;
}

interface PlacedPlanet {
  ticket: CosmosTicket;
  orbitIndex: number;
  angleDeg: number;
  size: number;
  color: string;
  haloIntensity: number;
  rotationSpeedSec: number;
  glowSize: number;
}

@Component({
  selector: 'app-cosmos-projet',
  standalone: true,
  imports: [CommonModule, FormsModule, Cosmos3dSceneComponent, CosmosOrreryComponent],
  templateUrl: './cosmos-projet.component.html',
  styleUrls: ['./cosmos-projet.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmosProjetComponent implements OnInit, OnDestroy {
  // --- Inputs ---
  @Input() projectName = '';
  @Input() projectCode = '';
  @Input() set tickets(v: CosmosTicket[] | null | undefined) { this._tickets.set(v || []); }
  @Input() set milestones(v: CosmosMilestone[] | null | undefined) { this._milestones.set(v || []); }
  /** Sentiment global du projet 0-100 (vert => sain, rouge => danger). */
  @Input() projectHealth = 75;
  /** Velocity actuelle (story points livrés sur la dernière période) */
  @Input() velocityNow = 0;

  // ═══════════════ TOP 5 WINS — Nouveaux Inputs ═══════════════

  /** P1 — Budget projet total (jours.homme ou autre unité homogène) */
  @Input() budgetTotal?: number;
  /** P1 — Budget consommé (mêmes unités que budgetTotal) */
  @Input() budgetSpent?: number;
  /** P1 — Sprint actif (anneau autour du soleil) */
  @Input() sprintActive: CosmosSprintActive | null = null;

  /** P3 — Membres de l'équipe → lunes en orbite proche */
  @Input() set teamMembers(v: CosmosTeamMember[] | null | undefined) { this._team.set(v || []); }

  /** P4 — Risques projet → astéroïdes sombres */
  @Input() set risks(v: CosmosRisk[] | null | undefined) { this._risks.set(v || []); }

  /** P4 — Dépendances entre tickets → arcs lumineux entre planètes */
  @Input() set dependencies(v: CosmosDependency[] | null | undefined) { this._deps.set(v || []); }

  /** P5 — Cérémonies (dailies, reviews, retros, wrap-ups) → comètes par type */
  @Input() set ceremonies(v: CosmosCeremony[] | null | undefined) { this._ceremonies.set(v || []); }

  // --- Outputs ---
  @Output() ticketSelected = new EventEmitter<CosmosTicket>();
  @Output() milestoneSelected = new EventEmitter<CosmosMilestone>();

  // --- Signals internes ---
  private _tickets = signal<CosmosTicket[]>([]);
  private _milestones = signal<CosmosMilestone[]>([]);
  // TOP 5 WINS — nouveaux signals internes
  private _team = signal<CosmosTeamMember[]>([]);
  private _risks = signal<CosmosRisk[]>([]);
  private _deps = signal<CosmosDependency[]>([]);
  private _ceremonies = signal<CosmosCeremony[]>([]);
  currentDate = signal<Date>(new Date());
  isPlaying = signal(true);
  hoveredTicketId = signal<string | number | null>(null);
  filterMode = signal<'all' | 'mine' | 'blocked' | 'this-week'>('all');
  myUserName = signal<string>('me'); // À brancher au vrai utilisateur

  // --- Computed signals ---

  /** Année courante affichée */
  currentYear = computed(() => this.currentDate().getFullYear());

  /** Fraction de l'année (0-1) — utile pour l'aiguille NOW */
  yearFraction = computed(() => {
    const d = this.currentDate();
    const start = new Date(d.getFullYear(), 0, 1).getTime();
    const end = new Date(d.getFullYear() + 1, 0, 1).getTime();
    return (d.getTime() - start) / (end - start);
  });

  /** Angle de l'aiguille NOW (0° = 1er janv, 360° = 31 déc) */
  nowAngleDeg = computed(() => this.yearFraction() * 360);

  /** Filtrage des tickets */
  filteredTickets = computed(() => {
    const all = this._tickets();
    const mode = this.filterMode();
    if (mode === 'all') return all;
    if (mode === 'mine') return all.filter(t => t.assignee === this.myUserName());
    if (mode === 'blocked') return all.filter(t => t.status === 'BLOCKED');
    if (mode === 'this-week') {
      const now = this.currentDate();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return all.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= now && d <= weekLater;
      });
    }
    return all;
  });

  /** Placement des planètes (calcul ORBIT + ANGLE + COULEUR + TAILLE pour chaque ticket) */
  placedPlanets = computed<PlacedPlanet[]>(() => {
    return this.filteredTickets().map(t => this.placeTicket(t));
  });

  /** Tickets CANCELLED → engloutis dans le trou noir */
  cancelledTickets = computed(() => {
    return this._tickets().filter(t => t.status === 'CANCELLED');
  });

  /** Milestones formattés avec leur angle */
  placedMilestones = computed(() => {
    return this._milestones().map(m => {
      const date = new Date(m.date);
      const yearStart = new Date(date.getFullYear(), 0, 1).getTime();
      const yearEnd = new Date(date.getFullYear() + 1, 0, 1).getTime();
      const fraction = (date.getTime() - yearStart) / (yearEnd - yearStart);
      return {
        milestone: m,
        angleDeg: fraction * 360,
        type: m.type || 'release',
      };
    });
  });

  /** Couleur de l'aurore selon la santé du projet */
  auroraColor = computed(() => {
    const h = Math.max(0, Math.min(100, this.projectHealth));
    if (h > 70) return { from: '#1b6e3a', to: '#0c4d2b' };  // vert sain
    if (h > 40) return { from: '#a07e2c', to: '#5d4a1b' };  // jaune attention
    return { from: '#a73026', to: '#5d1c17' };              // rouge danger
  });

  /** Vélocité visuelle — pulsation du soleil plus forte si haute velocity */
  sunPulseSpeed = computed(() => {
    return Math.max(1.5, 4 - (this.velocityNow / 20));
  });

  // ═══════════════════════ TOP 5 WINS ═══════════════════════

  /** P1 — Couleur du noyau du soleil = santé projet (vert/jaune/orange/rouge) */
  sunHealthColor = computed(() => {
    const h = this.projectHealth;
    if (h > 75) return '#3ec77d';   // vert sain
    if (h > 50) return '#f9b700';   // jaune attention
    if (h > 25) return '#e6803a';   // orange danger
    return '#e84538';               // rouge critique
  });
  /** P1 — Couleur de la corona (halo extérieur) — variante claire de la santé */
  sunCoronaColor = computed(() => {
    const h = this.projectHealth;
    if (h > 75) return 'rgba(110, 247, 165, 0.6)';
    if (h > 50) return 'rgba(255, 220, 100, 0.6)';
    if (h > 25) return 'rgba(255, 170, 100, 0.6)';
    return 'rgba(255, 100, 90, 0.6)';
  });
  /** P1 — Taille relative du soleil (40%-100%) selon budget restant */
  sunSizePct = computed(() => {
    if (!this.budgetTotal || this.budgetTotal === 0) return 100;
    const remaining = Math.max(0, this.budgetTotal - (this.budgetSpent || 0));
    return Math.max(40, Math.min(100, (remaining / this.budgetTotal) * 100));
  });
  /** P1 — Le sprint actif est-il en cours ? (utilisé pour afficher l'anneau) */
  hasSprintActive = computed(() => !!this.sprintActive);
  /** P1 — Pourcentage de progression du sprint actif (0-100) */
  sprintProgressPct = computed(() => {
    const s = this.sprintActive;
    if (!s) return 0;
    if (typeof s.progressPct === 'number') return Math.max(0, Math.min(100, s.progressPct));
    if (s.dayIndex && s.totalDays) return Math.max(0, Math.min(100, (s.dayIndex / s.totalDays) * 100));
    return 0;
  });

  /** P2 — Path SVG du burndown réel (trace derrière l'aiguille NOW)
   *  Une spirale qui suit l'avancement réel des sprints depuis le début de l'année. */
  burndownRealPath = computed(() => {
    // On échantillonne 24 points de l'année jusqu'à NOW
    const frac = this.yearFraction();
    const points = 60;
    const upTo = Math.floor(frac * points);
    if (upTo < 1) return '';
    // Spirale qui converge vers le centre selon l'avancement réel
    const cx = 0, cy = 0;
    const maxR = 280; // orbite ~Backlog
    const minR = 60;
    const all = this._tickets();
    const totalSP = all.reduce((s, t) => s + (t.storyPoints || 1), 0) || 1;
    let d = '';
    for (let i = 0; i <= upTo; i++) {
      const t = i / points;       // 0..1 de l'année
      const angle = t * 360 - 90; // commence à 12h
      // Pour chaque échantillon : combien de SP déjà DONE à cette date
      const sampleDate = new Date(this.currentDate().getFullYear(), 0, 1);
      sampleDate.setTime(sampleDate.getTime() + t * 365 * 24 * 60 * 60 * 1000);
      const doneSP = all.filter(tk =>
        (tk.status || '').toUpperCase() === 'DONE' &&
        tk.dueDate && new Date(tk.dueDate) <= sampleDate
      ).reduce((s, tk) => s + (tk.storyPoints || 1), 0);
      const burned = doneSP / totalSP;            // 0..1
      const r = maxR - (maxR - minR) * burned;
      const rad = angle * Math.PI / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  });
  /** P2 — Path SVG du burndown idéal (où on DEVRAIT être) */
  burndownIdealPath = computed(() => {
    const cx = 0, cy = 0;
    const maxR = 280;
    const minR = 60;
    let d = '';
    const points = 60;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = t * 360 - 90;
      const r = maxR - (maxR - minR) * t;
      const rad = angle * Math.PI / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  });

  /** P3 — Membres équipe → lunes placées en orbite proche du soleil (rayon 50px) */
  placedMoons = computed(() => {
    const team = this._team();
    const n = team.length;
    if (n === 0) return [];
    return team.map((m, i) => {
      const angleDeg = (i * 360 / n) + 20; // décalage de 20° pour ne pas chevaucher l'aiguille NOW
      const cap = (m.capacityPct ?? 70) / 100;
      return {
        member: m,
        angleDeg,
        orbitRadius: 52,           // entre le soleil (~25px rayon) et orbite 0 (40px rayon)
        brightness: Math.max(0.3, cap),
        size: 8 + cap * 4,         // 8-12 px
        color: m.color || (m.isOnline ? '#7adfd0' : '#778'),
      };
    });
  });

  /** P4 — Risques → astéroïdes sombres entre orbites Sprint+1 et Backlog (rayon 90-150) */
  placedAsteroids = computed(() => {
    return this._risks().map((r, idx) => {
      // Hash stable de l'id pour distribution déterministe
      const seed = String(r.id || idx).split('').reduce((a, c) => a + c.charCodeAt(0), idx);
      const angleDeg = (seed * 53) % 360;
      const radius = 90 + ((seed * 31) % 60);  // 90..150 px
      const score = r.score ?? 50;
      // Si triggerDate proche de NOW → astéroïde plus gros + rouge
      let urgency = 0;
      if (r.triggerDate) {
        const days = (new Date(r.triggerDate).getTime() - this.currentDate().getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0 && days < 30) urgency = 1 - (days / 30);
      }
      return {
        risk: r,
        angleDeg,
        orbitRadius: radius,
        size: 5 + (score / 12) + urgency * 4,  // 5-12 px
        urgency,
      };
    });
  });

  /** P4 — Dépendances → arcs SVG entre planètes (calculés en cartésien) */
  depArcs = computed(() => {
    const planets = this.placedPlanets();
    const planetMap = new Map<string, PlacedPlanet>();
    planets.forEach(p => planetMap.set(String(p.ticket.id), p));
    const arcs: { x1: number; y1: number; x2: number; y2: number; type: string }[] = [];
    this._deps().forEach(d => {
      const from = planetMap.get(String(d.fromTicketId));
      const to = planetMap.get(String(d.toTicketId));
      if (!from || !to) return;
      const a = this.polarToXY(from);
      const b = this.polarToXY(to);
      arcs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, type: d.type || 'depends_on' });
    });
    return arcs;
  });

  /** P5 — Cérémonies placées avec leur signature visuelle */
  placedCeremonies = computed(() => {
    return this._ceremonies().map(c => {
      const d = new Date(c.date);
      const yStart = new Date(d.getFullYear(), 0, 1).getTime();
      const yEnd = new Date(d.getFullYear() + 1, 0, 1).getTime();
      const frac = (d.getTime() - yStart) / (yEnd - yStart);
      return {
        ceremony: c,
        angleDeg: frac * 360,
      };
    });
  });

  /** Convertit (orbitIndex + angleDeg) → coordonnées cartésiennes (centre=0,0) */
  private polarToXY(p: PlacedPlanet) {
    const r = this.orbitsSize[p.orbitIndex] / 2;
    const rad = (p.angleDeg - 90) * Math.PI / 180;
    return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
  }

  /** v0.1 conclave — Toggle entre mode 3D simple (procédural) et Orrery (GLB) */
  cosmos3dMode = signal<'simple' | 'orrery'>('orrery');
  toggleCosmos3dMode() {
    this.cosmos3dMode.set(this.cosmos3dMode() === 'simple' ? 'orrery' : 'simple');
  }

  /** v0.1 conclave — Format des planètes pour le rendu Three.js 3D */
  planets3d = computed<PlacedPlanet3D[]>(() => {
    return this.placedPlanets().map(p => ({
      id: p.ticket.id,
      orbitIndex: p.orbitIndex,
      angleDeg: p.angleDeg,
      size: p.size,
      color: p.color,
    }));
  });

  /** Ticket sélectionné via click sur planète orrery (affiche un panel en header). */
  selectedOrreryTicket = signal<any | null>(null);

  /** Handler du click planète orrery — ouvre/ferme le panel info. */
  onOrreryPlanetClick(payload: { ticket: any | null; pairIndex: number }) {
    console.log('[Cosmos] onOrreryPlanetClick payload:', payload);
    if (!payload) return;
    // Cas 1 : click sur astre sans ticket → panel "empty"
    if (!payload.ticket) {
      this.selectedOrreryTicket.set({
        id: 'astre-' + payload.pairIndex,
        title: `Astre #${payload.pairIndex + 1}`,
        description: 'Aucun ticket assigné à cette planète. Ajoute-en un dans le backlog pour la voir s\'animer.',
        color: '#6b7a8c',
        status: 'EMPTY',
      });
      return;
    }
    // Cas 2 : toggle si re-click sur le même ticket
    const current = this.selectedOrreryTicket();
    if (current && String(current.id) === String(payload.ticket.id)) {
      this.selectedOrreryTicket.set(null);
    } else {
      const fullTicket = this._tickets().find(t => String(t.id) === String(payload.ticket.id));
      this.selectedOrreryTicket.set(fullTicket || payload.ticket);
    }
  }

  closeOrreryPanel() {
    this.selectedOrreryTicket.set(null);
  }

  /** Format minimal des tickets à mapper sur le GLB orrery (1 ticket = 1 paire planet+support). */
  orreryTickets = computed(() => {
    return this.placedPlanets().map(p => ({
      id: p.ticket.id,
      title: p.ticket.title,
      color: p.color,
      storyPoints: p.ticket.storyPoints ?? 3,
      status: p.ticket.status,
      visible: true,
      // ⇣ Date du ticket → utilisée par l'orrery pour bucketer sur l'anneau correspondant
      date: p.ticket.dueDate || undefined,
    }));
  });

  // ═══════════════ CINEMA CAMERA — Vue 3D qui suit les astres aléatoirement ═══════════════
  /** Transform CSS appliqué à la cosmos-scene pour simuler la caméra 3D */
  cameraTransform = signal<string>('rotateX(0) rotateY(0) scale(1)');
  /** Durée de la transition courante en secondes (varie pour effet organique) */
  cameraTransitionSec = signal<number>(5);
  private cameraTimer: any = null;

  /** Poses de caméra prédéfinies — voyage à travers le cosmos */
  private readonly cameraPoses = [
    { rx:   0, ry:   0, s: 1.00, label: 'wide-view'        },
    { rx: -15, ry:  25, s: 1.45, label: 'top-right-zoom'   },
    { rx:  12, ry: -20, s: 1.50, label: 'bottom-left-tilt' },
    { rx: -28, ry:   0, s: 1.65, label: 'top-dive'         },
    { rx:   0, ry:  40, s: 1.35, label: 'right-pan'        },
    { rx:  18, ry:   0, s: 1.70, label: 'bottom-dive'      },
    { rx: -10, ry: -32, s: 1.40, label: 'top-left'         },
    { rx:   8, ry:  30, s: 1.55, label: 'bottom-right'     },
    { rx: -22, ry:  18, s: 1.60, label: 'top-right-deep'   },
    { rx:   0, ry:   0, s: 1.20, label: 'soft-zoom'        },
  ];

  /** Démarre la tournée cinéma — change de pose toutes les 6-9s aléatoirement */
  private startCameraTour() {
    const cycle = () => {
      // Choisit une pose aléatoire (≠ de la précédente pour éviter répétition)
      const idx = Math.floor(Math.random() * this.cameraPoses.length);
      const pose = this.cameraPoses[idx];
      // Durée transition variable 4-7s pour effet organique
      const transitionSec = 4 + Math.random() * 3;
      this.cameraTransitionSec.set(transitionSec);
      this.cameraTransform.set(
        `rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) scale(${pose.s})`
      );
      // Prochain changement dans 6-9s
      const nextDelay = 6000 + Math.random() * 3000;
      this.cameraTimer = setTimeout(cycle, nextDelay);
    };
    // Première pose après 2s
    this.cameraTimer = setTimeout(cycle, 2000);
  }

  ngOnInit() {
    // v0.1 conclave — Log debug : afficher les status uniques des tickets pour aider le mapping
    setTimeout(() => {
      const uniqueStatuses = Array.from(new Set(this._tickets().map(t => t.status || '(null)')));
      const uniqueSprints = Array.from(new Set(this._tickets().map(t => t.sprintName || t.sprintId || '(null)')));
      const uniquePriorities = Array.from(new Set(this._tickets().map(t => t.priority || '(null)')));
      console.log('[Cosmos] Tickets:', this._tickets().length,
        '\n  Status uniques:', uniqueStatuses,
        '\n  Sprints uniques:', uniqueSprints,
        '\n  Priorités uniques:', uniquePriorities,
        '\n  Sample ticket:', this._tickets()[0]);
    }, 1000);
    // Avance automatique du temps si isPlaying (1 réelle seconde = X jours)
    let lastTime = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (this.isPlaying()) {
        // 1 réelle seconde = 12 heures projet (1 an projet = 730 sec ≈ 12 min)
        const newDate = new Date(this.currentDate().getTime() + dt * 12 * 60 * 60 * 1000);
        // Reboucle à la fin de l'année
        if (newDate.getFullYear() > this.currentDate().getFullYear() + 1) {
          newDate.setFullYear(this.currentDate().getFullYear());
          newDate.setMonth(0); newDate.setDate(1);
        }
        this.currentDate.set(newDate);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // ═══ Démarre la caméra cinéma qui suit les astres aléatoirement ═══
    this.startCameraTour();
  }

  ngOnDestroy() {
    if (this.cameraTimer) clearTimeout(this.cameraTimer);
  }

  // --- Placement logic ---

  private placeTicket(t: CosmosTicket): PlacedPlanet {
    // 1. Orbite selon urgence
    const orbitIndex = this.computeOrbit(t);
    // 2. Angle selon dueDate (0° = 1er janvier)
    const angleDeg = this.computeAngle(t);
    // 3. Couleur selon status
    const color = this.computeColor(t);
    // 4. Taille selon storyPoints
    const size = this.computeSize(t);
    // 5. Halo selon priority
    const haloIntensity = this.computeHalo(t);
    // 6. Vitesse selon progress
    const rotationSpeedSec = this.computeRotationSpeed(t);
    return {
      ticket: t,
      orbitIndex,
      angleDeg,
      size,
      color,
      haloIntensity,
      rotationSpeedSec,
      glowSize: size * (haloIntensity * 2 + 2),
    };
  }

  private computeOrbit(t: CosmosTicket): number {
    // 0 = Mercury (today) → 8 = Pluto (closure)
    if (!t.dueDate) return 5; // backlog non daté → asteroid belt
    const due = new Date(t.dueDate);
    const now = this.currentDate();
    const days = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 0) return 0;     // overdue → orbite intérieure (urgent)
    if (days < 1)   return 0;   // today
    if (days < 7)   return 1;   // week
    if (days < 14)  return 2;   // sprint
    if (days < 28)  return 3;   // sprint+1
    if (days < 90)  return 4;   // phase
    if (days < 180) return 6;   // pre-release
    if (days < 270) return 7;   // post-release
    return 8;                   // closure
  }

  private computeAngle(t: CosmosTicket): number {
    if (!t.dueDate) {
      // Pas de date → position aléatoire stable (basée sur l'id pour cohérence)
      const seed = typeof t.id === 'string'
        ? t.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
        : Number(t.id) || 0;
      return (seed * 137.5) % 360; // spiral d'or pour distribution même
    }
    const due = new Date(t.dueDate);
    const yearStart = new Date(due.getFullYear(), 0, 1).getTime();
    const yearEnd = new Date(due.getFullYear() + 1, 0, 1).getTime();
    const fraction = (due.getTime() - yearStart) / (yearEnd - yearStart);
    return fraction * 360;
  }

  private computeColor(t: CosmosTicket): string {
    // v0.1 conclave — mapping flexible : accepte FR + EN + variants
    const s = (t.status || '').toString().toUpperCase().trim()
      .replace(/[ÀÁÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E')
      .replace(/[ÍÎÏ]/g, 'I').replace(/[ÒÓÔÖ]/g, 'O').replace(/[ÙÚÛÜ]/g, 'U');
    // Status terminés (vert)
    if (s.includes('DONE') || s.includes('TERMIN') || s.includes('CLOSED') || s.includes('FERME') || s === 'OK' || s === 'COMPLETED') {
      return '#3ec77d';
    }
    // Status bloqués (rouge)
    if (s.includes('BLOCK') || s.includes('BLOQU') || s.includes('STUCK')) {
      return '#e84538';
    }
    // Status review (violet)
    if (s.includes('REVIEW') || s.includes('REVUE') || s.includes('VALIDATION')) {
      return '#9b6cff';
    }
    // Status en cours (jaune)
    if (s.includes('PROGRESS') || s.includes('COURS') || s.includes('DOING') || s.includes('WIP') || s.includes('STARTED')) {
      return '#f9b700';
    }
    // Status annulés (noir)
    if (s.includes('CANCEL') || s.includes('ANNUL') || s.includes('DROPPED') || s.includes('REJECT')) {
      return '#1a0a0a';
    }
    // v0.1 conclave — FALLBACK : varie la couleur selon le SPRINT du ticket (pour
    // éviter que tous les TODO soient gris). Chaque sprint = une couleur unique.
    return this.colorForSprint(t.sprintName || t.sprintId);
  }

  /** Génère une couleur stable par sprint via hash → palette HSL */
  private colorForSprint(sprint: string | number | undefined): string {
    if (!sprint) return '#a3b8d0';
    const str = String(sprint);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    // Palette froide / chaude pour chaque sprint
    const palette = ['#5fb3d6', '#d699e6', '#a3d68b', '#e6ad7a', '#e692a8',
                     '#8b9fea', '#c5e3a1', '#d6b46c', '#7adfd0', '#e3a6c4'];
    return palette[Math.abs(hash) % palette.length];
  }

  private computeSize(t: CosmosTicket): number {
    const sp = t.storyPoints ?? 1;
    return Math.max(5, Math.min(22, 5 + sp * 1.4));
  }

  private computeHalo(t: CosmosTicket): number {
    switch (t.priority) {
      case 'MUST':   return 1.0;
      case 'SHOULD': return 0.6;
      case 'COULD':  return 0.3;
      case 'WONT':   return 0;
      default:       return 0.4;
    }
  }

  private computeRotationSpeed(t: CosmosTicket): number {
    // Tickets en cours tournent plus vite, terminés plus lentement
    if (t.status === 'IN_PROGRESS') {
      const progress = t.progress ?? 50;
      return Math.max(8, 30 - progress / 3);
    }
    if (t.status === 'DONE') return 120;     // figés lents
    if (t.status === 'BLOCKED') return 300;  // quasi immobiles
    // Sinon orbite "standard"
    const orbitSpeeds = [7.19, 18.45, 30, 56.42, 179.93, 99, 355.78, 882.84, 2512.6];
    return orbitSpeeds[this.computeOrbit(t)] || 30;
  }

  // --- Interactions ---

  onPlanetHover(ticketId: string | number | null) {
    this.hoveredTicketId.set(ticketId);
  }
  onPlanetClick(t: CosmosTicket) {
    this.ticketSelected.emit(t);
  }
  onMilestoneClick(m: CosmosMilestone) {
    this.milestoneSelected.emit(m);
  }
  goToNow() {
    this.currentDate.set(new Date());
  }
  togglePlay() {
    this.isPlaying.update(v => !v);
  }
  setFilterMode(mode: 'all' | 'mine' | 'blocked' | 'this-week') {
    this.filterMode.set(mode);
  }
  onSliderInput(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    // Slider 0-100 → fraction de l'année
    const year = this.currentYear();
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    const newTime = yearStart + (value / 100) * (yearEnd - yearStart);
    this.currentDate.set(new Date(newTime));
    this.isPlaying.set(false);
  }

  // --- Helpers pour le template ---

  hoveredPlanet = computed<PlacedPlanet | null>(() => {
    const id = this.hoveredTicketId();
    if (id === null) return null;
    return this.placedPlanets().find(p => p.ticket.id === id) || null;
  });

  /** Diamètre des orbites (px) */
  orbitsSize = [80, 110, 145, 185, 230, 300, 380, 470, 560];
  /** Nom des orbites */
  orbitsName = ['Today', 'Week', 'Sprint', 'Sprint+1', 'Phase', 'Backlog', 'Pre-Release', 'Post-Release', 'Closure'];

  trackByTicketId = (i: number, p: PlacedPlanet) => p.ticket.id;
  trackByMilestoneId = (i: number, m: any) => m.milestone.id;

  /** Formatte une date en JJ/MM */
  fmtDate(d: Date | string | undefined): string {
    if (!d) return '—';
    const date = new Date(d);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  /** Month label pour les marques sur le cadran */
  monthLabel(i: number): string {
    return ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'][i];
  }
}
