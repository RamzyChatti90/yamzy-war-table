import { Injectable, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface WheelAction {
  label: string;
  icon: string;
  color: string;
  action: () => void;
  agentId?: string;
  /** FIX 2026-05-12 — Si défini, l'item ouvre un sous-niveau de la wheel
   *  avec ces actions au lieu d'exécuter `action()`. Permet aux composants
   *  d'enregistrer des menus en arbre (ex : ARCHITECT → "Change view" →
   *  [Project / Branche / Ticket]). */
  children?: WheelAction[];
}

export interface PendingMessage {
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  preview: string;
  count: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class WheelMenuService {
  private _actions: WheelAction[] = [];
  currentRoute = '';

  /** FIX 2026-05-12 — Si défini, remplace le bouton ⚙️ Customize (toujours dernier
   *  dans la wheel main level) par cette action custom. Utilisé par ARCHITECT pour
   *  mettre "Change view" à la place du bouton settings. À reset (=null) au destroy
   *  de la mission pour rétablir le comportement par défaut. */
  customizeOverride: WheelAction | null = null;

  /** Current project context — set by sidebar when projectId changes */
  currentProjectId: number | null = null;

  /** Emitted by sidebar "Agents IA" button click */
  openTrigger = new EventEmitter<{ x: number; y: number }>();

  /** Emitted when a 422 MAX_FAVORITES response is received anywhere */
  maxFavoritesError = new EventEmitter<string>();

  /** Emitted when a new message arrives — triggers green flash */
  newMessageNotify = new EventEmitter<PendingMessage>();

  /** Pending (unread) messages per agent — drives wheel badge */
  pendingMessages: Map<string, PendingMessage> = new Map();

  constructor(private router: Router) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.currentRoute = e.urlAfterRedirects || e.url;
      this._actions = [];
    });
  }

  triggerOpen(x: number, y: number) {
    this.openTrigger.emit({ x, y });
  }

  /** Call this from any component that gets a 422 MAX_FAVORITES toggle response */
  notifyMaxFavorites(message: string) {
    this.maxFavoritesError.emit(message);
  }

  /** Call this when ANY message arrives (agent reply, flow result, notification) */
  notifyNewMessage(agentId: string, agentName: string, agentIcon: string, agentColor: string, preview: string) {
    const existing = this.pendingMessages.get(agentId);
    const msg: PendingMessage = {
      agentId, agentName, agentIcon, agentColor, preview,
      count: (existing?.count || 0) + 1,
      timestamp: Date.now()
    };
    this.pendingMessages.set(agentId, msg);
    this.newMessageNotify.emit(msg);
  }

  /** Call when user opens the chat for an agent — clears its badge */
  clearPending(agentId: string) {
    this.pendingMessages.delete(agentId);
  }

  /** Total unread count across all agents */
  get totalPending(): number {
    return Array.from(this.pendingMessages.values()).reduce((s, m) => s + m.count, 0);
  }

  /** Most recent pending message (for wheel first-level badge) */
  get latestPending(): PendingMessage | null {
    let latest: PendingMessage | null = null;
    this.pendingMessages.forEach(m => {
      if (!latest || m.timestamp > latest.timestamp) latest = m;
    });
    return latest;
  }

  register(actions: WheelAction[]) { this._actions = actions; }
  clear() { this._actions = []; }
  get actions(): WheelAction[] { return this._actions; }
  // ── Handoff notifications ─────────────────────────────────────────
  pendingHandoffs: any[] = [];

  notifyHandoff(data: any) {
    this.pendingHandoffs.push(data);
    this.newMessageNotify.emit();
  }

  notifyHandoffAccepted(data: any) {
    this.pendingHandoffs = this.pendingHandoffs.filter(h => h.handoffId !== data.handoffId);
    this.newMessageNotify.emit();
    // Navigate to conversation
    window.dispatchEvent(new CustomEvent('carnival:handoff-accepted', { detail: data }));
  }

  notifyHandoffFallback(data: any) {
    this.pendingHandoffs = this.pendingHandoffs.filter(h => h.handoffId !== data.handoffId);
    this.newMessageNotify.emit();
    window.dispatchEvent(new CustomEvent('carnival:handoff-fallback', { detail: data }));
  }

  clearHandoff(handoffId: number) {
    this.pendingHandoffs = this.pendingHandoffs.filter(h => h.handoffId !== handoffId);
  }

}
