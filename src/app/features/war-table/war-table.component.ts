// WAR TABLE ⚔ — Planning Organisator Studio (standalone app, port 4201).
// Split en 3 fichiers : .ts (classe) / .html (template) / .css (styles).

import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { WarTableApi, PosProject, PosTicket, ImportResult } from './war-table.api';
import { AuthService } from '../../core/services/auth.service';
import { WAR_TABLE_PAGES, PageDef as SharedPageDef } from './war-table.pages';
import { WarTableSplashComponent } from './war-table-splash.component';
import { WarTableBg3dComponent } from './war-table-bg-3d.component';
import { YamzyAvatar3dComponent } from './yamzy-avatar-3d.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { WtDialogService } from '../../core/dialog/dialog.service';
import { WtDialogComponent } from '../../core/dialog/wt-dialog.component';
import { WtTooltipDirective } from '../../core/tooltip/wt-tooltip.directive';
import { TOOLTIP_GUIDE } from '../../core/tooltip/tooltip-guide';

interface PageDef { id: string; label: string; icon: string; cat: string; }

@Component({
  selector: 'app-war-table',
  standalone: true,
  imports: [CommonModule, FormsModule, WarTableSplashComponent, WarTableBg3dComponent, YamzyAvatar3dComponent, TranslatePipe, LangSwitcherComponent, WtDialogComponent, WtTooltipDirective],
  templateUrl: './war-table.component.html',
  styleUrls: ['./war-table.component.css'],
})
export class WarTableComponent implements OnInit {
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

  // ═══ YAMZY POSITION EDITOR v1.0.25 — Drag + Copy CSS coords ═══
  // Permet à l'utilisateur de positionner avatar + carousel manuellement
  // puis de copier les coords pour les communiquer à Claude.
  // Defaults rapprochés : carousel à 380 au lieu de 440 (plus proche de l'avatar)
  fabLeft = signal(100);
  fabBottom = signal(20);
  fabSize = signal(320);
  ycLeft = signal(380);    // était 440 — rapproché de 60px
  ycBottom = signal(50);
  ycWidth = signal(360);   // était 380 — légèrement réduit pour rapprochement visuel
  positionMode = signal(false);
  togglePositionMode(): void { this.positionMode.update(v => !v); }

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
    this.dragTarget = null;
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  };

  async copyYamzyPositions(): Promise<void> {
    const css =
      `.wt-yamzy-fab { left: ${this.fabLeft()}px; bottom: ${this.fabBottom()}px; width: ${this.fabSize()}px; height: ${this.fabSize()}px; }\n` +
      `.wt-yc { left: ${this.ycLeft()}px; bottom: ${this.ycBottom()}px; width: ${this.ycWidth()}px; }`;
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
  }

  // ═══ YAMZY CAROUSEL v1.0.23 — Carrousel 3D vertical à côté de l'avatar ═══
  // Inspiré du Team Carousel codepen : center/up-1/up-2/down-1/down-2/hidden
  // Affiche les "messages" que Yamzy lance : événements, alertes, tickets prio
  yamzyCarouselIndex = signal(0);
  yamzyCarouselCards = computed<any[]>(() => {
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
  });

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
  }
  yamzyCarouselDown(): void {
    const n = this.yamzyCarouselCards().length;
    if (!n) return;
    this.yamzyCarouselIndex.update(i => (i + 1) % n);
  }
  setYamzyCarouselIndex(i: number): void { this.yamzyCarouselIndex.set(i); }

  /** Click sur la card : action contextuelle. */
  ycCardAction(card: any): void {
    if (!card?.action) return;
    if (card.action.type === 'event') this.openEventDetail(card.action.id);
    else if (card.action.type === 'new-event') this.openNewEvent();
    else if (card.action.type === 'page') this.setPage(card.action.page);
  }

  // ═══ COCKPIT WIDGET v1.0.12 (style "Chicago" — 4 onglets en carrousel) ═══
  cockpitTab = signal<'action' | 'upcoming' | 'tickets' | 'alerts'>('action');
  cockpitTabs = [
    { id: 'action',   label: 'Action',      icon: '🎯' },
    { id: 'upcoming', label: 'Réunions',    icon: '📅' },
    { id: 'tickets',  label: 'Tickets',     icon: '⚡' },
    { id: 'alerts',   label: 'Alertes',     icon: '⚠'  },
  ] as const;
  cockpitContent = computed<any>(() => {
    const tab = this.cockpitTab();
    if (tab === 'action') {
      const all = this.events() || [];
      const active = all.find(e => e.status === 'IN_PROGRESS') || null;
      const next = (this.upcomingEventsList() || [])[0] || null;
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
      return { kind: 'list', items: (this.upcomingEventsList() || []).slice(0, 4) };
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
    const total = this.events()?.length || 0;
    const upcoming = this.upcomingEventsList()?.length || 0;
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
      const shown = new Set(this.eventNotifShown());
      shown.delete(ev.id);
      this.eventNotifShown.set(shown);
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
  async endEventNow(ev: any): Promise<void> {
    this.api.endEvent(ev.id, this.eventLiveNotes).subscribe({
      next: async () => {
        this.refreshEvents();
        this.eventDetailId.set(null);
        this.eventLiveNotes = '';
        await this.dialog.alert({
          title: 'Événement terminé',
          message: `**${ev.title}** a été marqué comme COMPLETED.`,
          kind: 'success',
          details: [
            { label: 'Durée prévue', value: this.formatDuration(ev.scheduledStart, ev.scheduledEnd) },
            { label: 'Durée réelle', value: this.formatDuration(ev.actualStart || ev.scheduledStart, new Date().toISOString()) },
          ]
        });
      }
    });
  }
  respondToEvent(ev: any, response: 'ACCEPTED'|'DECLINED'|'TENTATIVE'): void {
    const name = this.user()?.githubLogin || 'Guest';
    this.api.respondEvent(ev.id, name, response).subscribe({ next: () => this.refreshEvents() });
  }
  deleteEventById(ev: any): void {
    this.delEntity(() => this.api.deleteEvent(ev.id));
    setTimeout(() => this.refreshEvents(), 400);
  }

  openEventDetail(id: number): void {
    this.eventDetailId.set(id);
    this.eventLiveNotes = (this.events().find(e => e.id === id) || {}).notes || '';
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
      hoursPerDay: 7, daysPerSprint: 5, sprintCapacityHours: 35,
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
    this.withProject({}, pid => this.api.createCapacity(pid, { memberName: 'Nouveau membre', role: '', allocationPercent: 100, hoursPerDay: 7 }));
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
    if (r.kind === 'page') this.setPage(r.id);
    else if (r.kind === 'project') this.selectProject(r.id);
    else { this.setPage('backlog'); this.ticketFilter = String(r.label).split(' — ')[0]; }
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
  /** Sidebar gauche skin : 0=Dashboard, 1=Plannings, 2=Backlog, 3=Analytics.
   *  Réactif au switch FR/EN via signals. */
  navLabels = computed(() => {
    this.i18n.lang(); this.i18n.version();
    return [
      this.i18n.t('nav.dashboard'),
      this.i18n.t('nav.plannings'),
      this.i18n.t('nav.backlog'),
      this.i18n.t('nav.analytics'),
    ];
  });
  morePanelOpen = signal(false);

  /** Mapping page → section (calcule l'icône active selon la page courante). */
  private readonly pageToSection: Record<string, number> = {
    // 1 = PLANNINGS
    'projets':1,'phases':1,'capacity':1,'allocation':1,'charge':1,'parametres':1,
    'calendrier':1,'sprints':1,'sprint-planning':1,'sprint-review':1,'roadmap':1,
    'gantt':1,'mode-emploi':1,'routine':1,'nouveau-projet':1,'regen-alloc':1,
    // 2 = BACKLOG
    'backlog':2,'backlog-tma':2,'detail-tickets':2,'vue-reviewer':2,'vue-sprint':2,
    'dod':2,'dor':2,'templates':2,'daily':2,'retros':2,'listes':2,
    // 3 = ANALYTICS
    'dashboard-param':3,'dashboard-legacy':3,'vue-stakeholder':3,'stakeholders':3,
    'export-stakeholder':3,'burndown':3,'cfd-velocity':3,'risks':3,'tech-debt':3,
    'lessons':3,'dependances':3,'knowledge':3,'overtime':3,'checkup':3,
    // 0 = DASHBOARD (default)
    'dashboard':0,
  };
  navActive = computed(() => this.pageToSection[this.activePage()] ?? 0);

  onNavClick(i: number): void {
    this.morePanelOpen.set(false);
    const defaults = ['dashboard', 'projets', 'backlog', 'dashboard-param'];
    this.setPage(defaults[i]);
  }

  /** Bouclier de navigation : la page DASHBOARD affiche le layout skin. */
  isDashboardSkin = computed(() => this.activePage() === 'dashboard');

  // ── Icônes SVG (réplique skin) ──
  private readonly navIcons = [
    '<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>',
    '<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>',
    '<path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>',
    '<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>',
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

  // ─── 42 pages en 15 catégories — source unique partagée avec le skin ───
  readonly pages: PageDef[] = WAR_TABLE_PAGES;
  readonly categories = [...new Set(this.pages.map(p => p.cat))];
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
    this.reloadProjects();
    // Filet de sécurité : même si la BDD est vide ou hors-ligne, on ferme le splash après 6s max.
    setTimeout(() => this.markSplashReady(), 6000);

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
    const s = (status || '').toLowerCase();
    if (s.includes('termin') || s.includes('done')) return 'done';
    if (s.includes('cours') || s.includes('progress')) return 'wip';
    if (s.includes('bloq') || s.includes('block')) return 'blocked';
    if (s.includes('revue') || s.includes('review')) return 'review';
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
