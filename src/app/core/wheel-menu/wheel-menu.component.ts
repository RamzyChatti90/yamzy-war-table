import {
  Component, OnDestroy, ChangeDetectorRef, HostListener, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WheelMenuService, WheelAction, PendingMessage } from './wheel-menu.service';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
// v1.0.79 — Stripped for war-table : FlowLaunchModalComponent + AgentIconComponent
// non importés (deps Yamzy core). On garde la UI radiale + arcane scrolls + sub-wheels.
// Fallback : agent icon = emoji from item.action.icon.
type FlowLaunchResult = any;

interface OrbitalItem {
  action: WheelAction;
  angle: number;
  angleDeg: number;
  tx: number;
  ty: number;
  visible: boolean;
}

// Flow status → icon
const FLOW_ICON: Record<string, string> = {
  ACTIVE: '🟢', DRAFT: '🟡', ARCHIVED: '⬜'
};
const FLOW_COLOR: Record<string, string> = {
  ACTIVE: '#10b981', DRAFT: '#f59e0b', ARCHIVED: '#6b7280'
};

@Component({
  selector: 'app-wheel-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    /* ── Spell-caster ADN : Henny Penny + Tinos + magenta #d54adf ─── */
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      --wm-accent: #d54adf;
      --wm-bg: rgba(0, 0, 0, 0.86);
      --wm-font-body: "Tinos", serif;
      --wm-font-title: "Henny Penny", cursive;
    }

    /* ── Backdrop ─────────────────────────────── */
    .wm-backdrop {
      position:fixed; inset:0; z-index:99985;
      background:rgba(0,0,0,.55);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      animation:wm-fade .2s ease both;
    }
    @keyframes wm-fade { from{opacity:0} to{opacity:1} }

    /* ── Pulse rings ──────────────────────────── */
    .wm-ring {
      position:fixed; border-radius:50%;
      pointer-events:none; z-index:99986;
      transform:translate(-50%,-50%);
      animation:wm-ring 2.6s ease-out infinite;
    }
    @keyframes wm-ring {
      0%  { transform:translate(-50%,-50%) scale(.5);  opacity:.6; }
      65% { transform:translate(-50%,-50%) scale(1.9); opacity:0;  }
      100%{ opacity:0; }
    }

    /* ── Hub ──────────────────────────────────── */
    .wm-hub {
      position:fixed; z-index:99998; border-radius:50%;
      pointer-events:all; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transform:translate(-50%,-50%);
      animation:wm-hub-in .32s cubic-bezier(.34,1.56,.64,1) both;
      transition:box-shadow .2s, background .25s, filter .2s;
      font-family: var(--wm-font-title);
    }
    @keyframes wm-hub-in {
      from{transform:translate(-50%,-50%) scale(0);opacity:0}
      to  {transform:translate(-50%,-50%) scale(1);opacity:1}
    }
    .wm-hub:hover { filter:brightness(1.2) drop-shadow(0 0 12px var(--wm-accent)); }

    /* ── Connector dashes ─────────────────────── */
    .wm-line {
      position:fixed; z-index:99987; height:1px;
      pointer-events:none; transform-origin:0 50%;
      opacity:0; transition:opacity .28s ease .18s;
    }
    .wm-line.on { opacity:1; }

    /* ── Orbital items ────────────────────────── */
    .wm-orb {
      position:fixed; z-index:99999;
      display:flex; flex-direction:column; align-items:center; gap:5px;
      cursor:pointer; pointer-events:all; user-select:none;
      transform:translate(-50%,-50%)
               translate(var(--tx,0px),var(--ty,0px))
               scale(var(--s,0));
      opacity:var(--op,0);
      transition:transform .44s cubic-bezier(.34,1.56,.64,1), opacity .3s ease;
      font-family: var(--wm-font-body);
    }
    .wm-orb.on { --s:1; --op:1; }

    .wm-avatar {
      width:52px; height:52px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:22px; border:2.5px solid transparent;
      background-color: var(--wm-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition:transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
    }
    .wm-orb:hover .wm-avatar, .wm-orb.hov .wm-avatar {
      transform:scale(1.28);
      box-shadow:0 6px 22px color-mix(in srgb, var(--wm-accent) 45%, transparent);
    }

    .wm-label {
      font-family: var(--wm-font-body);
      font-size:11px; font-weight:700; color:#fff;
      background-color: var(--wm-bg);
      border:1px solid color-mix(in srgb, var(--wm-accent) 45%, #333);
      border-left:4px solid var(--wm-accent);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      padding:4px 10px; border-radius:8px;
      white-space:nowrap; opacity:0; pointer-events:none;
      transform:translateY(5px);
      transition:opacity .15s, transform .15s;
      max-width:120px; overflow:hidden; text-overflow:ellipsis; text-align:center;
      box-shadow: 0 4px 20px color-mix(in srgb, var(--wm-accent) 22%, transparent);
      letter-spacing: 0.02em;
    }
    .wm-orb:hover .wm-label, .wm-orb.hov .wm-label {
      opacity:1; transform:translateY(0);
    }

    /* ── Empty state hint ─────────────────────── */
    .wm-hint {
      position:fixed; z-index:99999;
      transform:translate(-50%,-50%);
      font-family: var(--wm-font-title);
      color: color-mix(in srgb, var(--wm-accent) 80%, #fff);
      font-size:14px; font-weight:400;
      text-align:center; pointer-events:none; white-space:nowrap;
      animation:wm-fade .3s ease both;
      text-shadow: 0 0 12px color-mix(in srgb, var(--wm-accent) 60%, transparent);
      letter-spacing: 0.04em;
    }

    /* ── Max favorites toast ──────────────────── */
    .wm-toast {
      position:fixed; z-index:100000;
      bottom:32px; left:50%; transform:translateX(-50%);
      background-color: var(--wm-bg);
      border:1px solid color-mix(in srgb, var(--wm-accent) 45%, #333);
      border-left:4px solid var(--wm-accent);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      color:#fff; border-radius:16px;
      padding:14px 20px 16px;
      max-width:340px; width:90vw;
      box-shadow:0 8px 40px color-mix(in srgb, var(--wm-accent) 22%, transparent);
      animation:wm-fade .25s ease both;
      font-family: var(--wm-font-body);
    }
    .wm-toast-title {
      font-family: var(--wm-font-title);
      font-size:16px; font-weight:400;
      color: var(--wm-accent);
      margin-bottom:4px;
      letter-spacing: 0.03em;
    }
    .wm-toast-msg   { font-size:13px; color:rgba(255,255,255,.85); line-height:1.6; font-family: var(--wm-font-body); }
    .wm-toast-close {
      position:absolute; top:10px; right:12px;
      background:none; border:none; color:rgba(255,255,255,.5);
      font-size:16px; cursor:pointer; line-height:1;
    }
    .wm-toast-close:hover { color: var(--wm-accent); }
  `],
  template: `
<!-- Wheel Edit Mode Panel -->
<div *ngIf="editMode" class="wm-edit-panel" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100001;
  background-color:rgba(0,0,0,0.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border:1px solid color-mix(in srgb, #d54adf 45%, #333);border-left:4px solid #d54adf;
  border-radius:20px;box-shadow:0 8px 40px color-mix(in srgb, #d54adf 22%, transparent);
  padding:24px;width:380px;max-height:80vh;overflow-y:auto;color:#f0e6f5;font-family:'Tinos',serif;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h3 style="margin:0;font-family:'Henny Penny',cursive;font-size:22px;font-weight:400;color:#d54adf;letter-spacing:0.03em;text-shadow:0 0 14px color-mix(in srgb, #d54adf 45%, transparent)">⚙️ Personnaliser la Wheel</h3>
    <button (click)="editMode=false" style="background:none;border:none;font-size:18px;cursor:pointer;color:rgba(240,230,245,0.6)">✕</button>
  </div>
  <div *ngFor="let cat of wheelCategories" style="margin-bottom:12px">
    <p style="font-family:'Henny Penny',cursive;font-size:13px;font-weight:400;color:#d54adf;text-transform:uppercase;margin:0 0 6px;letter-spacing:0.08em;opacity:0.85">{{cat}}</p>
    <div *ngFor="let item of allWheelItems; let i = index">
      <div *ngIf="item.category === cat" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;margin-bottom:4px;border:1px solid color-mix(in srgb, #d54adf 20%, transparent)"
        [style.background]="item.enabled ? 'rgba(213,74,223,0.18)' : 'rgba(255,255,255,0.04)'">
        <span style="font-size:16px">{{item.icon}}</span>
        <span style="flex:1;font-family:'Tinos',serif;font-size:13px;font-weight:700;color:#f0e6f5">{{item.label}}</span>
        <button (click)="moveItem(i,-1)" style="background:none;border:none;cursor:pointer;font-size:11px;color:rgba(240,230,245,0.55)">↑</button>
        <button (click)="moveItem(i,1)" style="background:none;border:none;cursor:pointer;font-size:11px;color:rgba(240,230,245,0.55)">↓</button>
        <label style="position:relative;width:36px;height:20px;cursor:pointer">
          <input type="checkbox" [(ngModel)]="item.enabled" style="display:none">
          <span [style.background]="item.enabled ? '#d54adf' : 'rgba(255,255,255,0.18)'" style="position:absolute;inset:0;border-radius:10px;transition:0.2s"></span>
          <span [style.left]="item.enabled ? '18px' : '2px'" style="position:absolute;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>
        </label>
      </div>
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:16px">
    <button (click)="saveWheelConfig()" style="flex:1;padding:9px;background:color-mix(in srgb, #d54adf 85%, #000);color:#fff;border:1px solid #d54adf;border-left:4px solid #d54adf;border-radius:10px;font-family:'Henny Penny',cursive;font-weight:400;font-size:14px;letter-spacing:0.04em;cursor:pointer;box-shadow:0 4px 18px color-mix(in srgb, #d54adf 35%, transparent)">
      💾 Sauvegarder
    </button>
    <button (click)="resetWheelConfig()" style="padding:9px 14px;background:rgba(255,255,255,0.06);color:#f0e6f5;border:1px solid color-mix(in srgb, #d54adf 30%, #333);border-radius:10px;font-family:'Tinos',serif;font-size:13px;font-weight:700;cursor:pointer">
      🔄 Reset
    </button>
  </div>
</div>
<div *ngIf="editMode" (click)="editMode=false" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:100000"></div>

<ng-container *ngIf="visible">
  <div class="wm-backdrop" (click)="close()"></div>

  <!-- Pulse rings -->
  <div *ngFor="let r of rings; let i=index"
    class="wm-ring"
    [style.left]="cx+'px'" [style.top]="cy+'px'"
    [style.width]="r.size+'px'" [style.height]="r.size+'px'"
    [style.border]="'1.5px solid rgba(213,74,223,'+r.op+')'"
    [style.animation-delay]="(i*.32)+'s'">
  </div>

  <!-- Connector lines -->
  <div *ngFor="let item of items"
    class="wm-line" [class.on]="item.visible"
    [style.left]="cx+'px'" [style.top]="cy+'px'"
    [style.width]="(radius-28)+'px'"
    [style.transform]="'rotate('+item.angleDeg+'deg)'"
    [style.background]="'linear-gradient(to right,'+hubColor+'55,transparent)'">
  </div>

  <!-- Hub -->
  <div class="wm-hub"
    [style.left]="cx+'px'" [style.top]="cy+'px'"
    [style.width]="'60px'" [style.height]="'60px'"
    [style.background]="level>0 ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg,'+hubColor+','+hubColor+'bb)'"
    [style.border]="level>0 ? '2px solid rgba(255,255,255,.22)' : 'none'"
    [style.box-shadow]="level>0 ? '0 4px 20px rgba(0,0,0,.3)' : '0 0 0 5px rgba(213,74,223,.2),0 8px 40px rgba(213,74,223,.45)'"
    (click)="onHubClick()">
    <!-- Back arrow -->
    <svg *ngIf="level>0" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,.9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    <!-- Main icon -->
    <span *ngIf="level===0" style="font-size:24px">✦</span>

  </div>

  <!-- Empty state (no favorites) -->
  <div *ngIf="items.length===0 && !loading"
    class="wm-hint"
    [style.left]="cx+'px'"
    [style.top]="(cy+90)+'px'">
    Aucun favori — ajoutez-en depuis la liste 📋
  </div>

  <!-- Loading spinner -->
  <div *ngIf="loading"
    class="wm-hint"
    [style.left]="cx+'px'"
    [style.top]="(cy+90)+'px'">
    Chargement...
  </div>

  <!-- Orbital items -->
  <div *ngFor="let item of items; let i=index"
    class="wm-orb" [class.on]="item.visible" [class.hov]="hovIdx===i"
    [style.left]="cx+'px'" [style.top]="cy+'px'"
    [style.--tx]="item.tx+'px'" [style.--ty]="item.ty+'px'"
    [style.transition-delay]="item.visible ? (i*42)+'ms' : '0ms'"
    (mouseenter)="hovIdx=i" (mouseleave)="hovIdx=-1"
    (click)="triggerItem(item)">
    <div class="wm-avatar"
      [style.background]="item.action.color+'26'"
      [style.borderColor]="item.action.color"
      [style.box-shadow]="hovIdx===i ? '0 0 22px '+item.action.color+'80' : 'none'">
      <!-- v1.0.79 — war-table : pas de app-agent-icon, fallback emoji -->
      <span style="font-size:24px">{{item.action.icon || '✦'}}</span>
      <!-- Badge on pending agent item -->
      <div *ngIf="item.action.label.includes('💬')"
        style="position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;
               border-radius:9px;background:#22c55e;border:2px solid #1a0540;
               display:flex;align-items:center;justify-content:center;
               font-size:9px;font-weight:800;color:#fff;padding:0 3px;
               animation:badge-pulse 1.5s ease-in-out infinite;z-index:2;">
        {{wheelSvc.totalPending}}
      </div>
    </div>
    <div class="wm-label">{{item.action.label.replace(' 💬','')}}</div>
  </div>
</ng-container>

<!-- v1.0.79 — Flow launch modal retiré (deps Yamzy core non importée dans war-table) -->

<!-- Handoff request modal -->
<div *ngIf="handoffModal"
  style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-family:'Tinos',serif;">
  <div style="background-color:rgba(0,0,0,0.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid color-mix(in srgb, #d54adf 45%, #333);border-left:4px solid #d54adf;border-radius:20px;padding:28px;max-width:380px;width:90%;box-shadow:0 8px 40px color-mix(in srgb, #d54adf 22%, transparent);color:#f0e6f5;">
    <div style="font-size:28px;text-align:center;margin-bottom:12px;">🔀</div>
    <div style="font-family:'Henny Penny',cursive;color:#d54adf;font-size:20px;font-weight:400;text-align:center;margin-bottom:6px;letter-spacing:0.03em;text-shadow:0 0 14px color-mix(in srgb, #d54adf 45%, transparent);">
      Demande de mise en relation
    </div>
    <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:1px solid color-mix(in srgb, #d54adf 25%, transparent);border-radius:12px;padding:12px;margin:14px 0;">
      <img *ngIf="handoffModal.requesterAvatar" [src]="handoffModal.requesterAvatar"
        style="width:40px;height:40px;border-radius:50%;border:2px solid #d54adf;">
      <div *ngIf="!handoffModal.requesterAvatar"
        style="width:40px;height:40px;border-radius:50%;background:color-mix(in srgb, #d54adf 80%, #000);display:flex;align-items:center;justify-content:center;font-size:18px;">👤</div>
      <div>
        <div style="color:#fff;font-family:'Tinos',serif;font-weight:700;font-size:14px;">{{handoffModal.requesterName}}</div>
        <div style="color:rgba(240,230,245,0.65);font-family:'Tinos',serif;font-style:italic;font-size:12px;">{{handoffModal.projectName}}</div>
      </div>
    </div>
    <div style="color:rgba(240,230,245,0.82);font-family:'Tinos',serif;font-size:13px;line-height:1.6;margin-bottom:16px;background:rgba(255,255,255,.04);border:1px solid color-mix(in srgb, #d54adf 18%, transparent);border-radius:10px;padding:10px;">
      {{handoffModal.summary}}
    </div>
    <div *ngIf="handoffModal.expiresAt" style="color:#f59e0b;font-family:'Tinos',serif;font-size:11px;font-weight:700;text-align:center;margin-bottom:14px;">
      ⏰ Expire dans 5 minutes
    </div>
    <div style="display:flex;gap:10px;">
      <button (click)="acceptHandoff(handoffModal.handoffId)"
        style="flex:1;padding:12px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:12px;color:#fff;font-family:'Henny Penny',cursive;font-weight:400;font-size:15px;letter-spacing:0.04em;cursor:pointer;box-shadow:0 4px 18px rgba(34,197,94,0.35);">
        ✅ Répondre
      </button>
      <button (click)="declineHandoff(handoffModal.handoffId)"
        style="flex:1;padding:12px;background:rgba(255,255,255,.08);border:1px solid color-mix(in srgb, #d54adf 30%, #333);border-radius:12px;color:rgba(240,230,245,0.7);font-family:'Tinos',serif;font-weight:700;font-size:13px;cursor:pointer;">
        ❌ Pas disponible
      </button>
    </div>
  </div>
</div>

<!-- Max favorites toast -->
<div *ngIf="maxToast" class="wm-toast">
  <button class="wm-toast-close" (click)="maxToast=null">×</button>
  <div class="wm-toast-title">⭐ Limite de favoris atteinte</div>
  <div class="wm-toast-msg">{{maxToast}}</div>
</div>
`,
})
export class WheelMenuComponent implements OnDestroy {

  visible  = false;
  cx = 0; cy = 0;
  radius   = 130;
  hovIdx   = -1;
  level    = 0;
  hubColor = '#d54adf';
  loading  = false;
  maxToast: string | null = null;
  editMode = false;
  wheelConfig: any[] | null = null; // null = not loaded yet

  rings = [
    { size: 80,  op: 0.28 },
    { size: 145, op: 0.16 },
    { size: 210, op: 0.08 },
  ];

  items: OrbitalItem[] = [];

  private sub: Subscription;
  private ctrlDown = false;
  private metaDown = false;
  private toastTimer: any;

  constructor(
    private svc:  WheelMenuService,
    private cdr:  ChangeDetectorRef,
    private zone: NgZone,
    private router: Router,
    private http: HttpClient
  ) {
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => { this.forceClose(); this.cdr.detectChanges(); });

    // Load wheel config from DB
    this.loadWheelConfig();

    // Subscribe to new messages → re-render badge + refresh wheel if open
    this.svc.newMessageNotify.subscribe(() => {
      if (this.visible && this.level === 0) {
        // Reload main level to show the pending agent
        this.loadItems(this.getMainActions());
        this.explode();
      }
      this.cdr.detectChanges();
    });

    this.svc.openTrigger.subscribe(({ x, y }) => {
      if (this.visible) { this.close(); }
      else { this.openMainAt(x, y); }
    });

    // Listen for MAX_FAVORITES errors from any toggle call
    this.svc.maxFavoritesError.subscribe(msg => this.showMaxToast(msg));
  }

  ngOnDestroy() { this.sub.unsubscribe(); clearTimeout(this.toastTimer); }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Control') this.ctrlDown = true;
    if (e.key === 'Meta')    this.metaDown = true;
    if (this.ctrlDown && this.metaDown && !this.visible) {
      e.preventDefault();
      this.openMainAt(window.innerWidth / 2, window.innerHeight / 2);
    }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Control') this.ctrlDown = false;
    if (e.key === 'Meta')    this.metaDown = false;
  }

  @HostListener('document:keydown.escape')
  onEsc() { if (this.level > 0) { this.goBack(); } else { this.close(); } }

  // ── Open main wheel ────────────────────────────────────────
  private openMainAt(x: number, y: number) {
    this.cx = x; this.cy = y;
    this.level = 0;
    this.hubColor = '#d54adf';
    this.loadItems(this.getMainActions());
    this.visible = true;
    document.body.style.userSelect = 'none';
    this.cdr.detectChanges();
    this.explode();
  }

  // ── Main wheel actions ─────────────────────────────────────
  private getMainActions(): WheelAction[] {
    const route = this.router.url;
    const registered = this.svc.actions;
    const actions: WheelAction[] = [];

    // ── Pending handoff requests — shown first, urgent ──────────────
    for (const h of (this.svc.pendingHandoffs || []).slice(0, 2)) {
      actions.push({
        label: `💬 ${h.requesterName || 'Quelqu\'un'}`,
        icon: '🔀',
        color: '#f59e0b',
        action: () => this.openHandoffModal(h)
      });
    }

    // ── Pending message — always first if exists (agent OR war room) ──
    const pending = this.svc.latestPending;
    if (pending) {
      const isWarRoom = pending.agentId.startsWith('WAR_ROOM_');
      actions.push({
        label: pending.agentName + ' 💬',
        icon:  pending.agentIcon,
        color: '#22c55e',
        action: () => {
          this.svc.clearPending(pending.agentId);
          if (isWarRoom) {
            const pid = pending.agentId.replace('WAR_ROOM_', '');
            this.router.navigate(['/projects', pid, 'war-room']);
            this.close();
          } else {
            this.openChatWith(pending.agentId);
            this.close();
          }
        }
      });
    }

    // ── War Room notification badge — only shown if there's a pending message ──
    const pid = this.svc.currentProjectId
      || (route.match(/\/projects\/(\d+)/)?.[1] ? +route.match(/\/projects\/(\d+)/)![1] : null);
    const pendingIsWarRoom = pending?.agentId?.startsWith('WAR_ROOM_');
    if (pid && !pendingIsWarRoom) {
      const warPending = this.svc.pendingMessages.get('WAR_ROOM_' + pid);
      if (warPending && !route.includes('/war-room')) {
        actions.push({
          label: `⚔️ War Room (${warPending.count})`,
          icon:  '⚔️',
          color: '#22c55e',
          action: () => {
            this.svc.clearPending('WAR_ROOM_' + pid);
            this.router.navigate(['/projects', pid, 'war-room']);
            this.close();
          }
        });
      }
    }

    // ── Dynamic items from wheelConfig (or defaults) ──
    const activeIds = this.wheelConfig
      ? this.wheelConfig.map((c: any) => c.id)
      : ['agents', 'flows', 'warroom', 'soulstone']; // defaults if no config saved

    const itemActions: Record<string, WheelAction> = {
      agents:    { label: 'Reality Weavers',  icon: '🤖', color: '#5412fc', action: () => this.openAgentsWheel() },
      flows:     { label: 'Spell Weaver',     icon: '✨', color: '#0ea5e9', action: () => this.openFlowsWheel() },
      warroom:   { label: 'War Room',         icon: '⚔️', color: '#4f46e5', action: () => { const p = this.svc.currentProjectId; if(p) this.router.navigate(['/projects',p,'war-room']); this.close(); } },
      analytics: { label: 'Analytics IA',     icon: '📊', color: '#10b981', action: () => { this.router.navigate(['/analytics']); this.close(); } },
      arcantrace: { label: 'Arcane Trace',    icon: '🔍', color: '#6366f1', action: () => { this.router.navigate(['/debug-studio']); this.close(); } },
      kanban:    { label: 'Cycle of Harmony', icon: '📋', color: '#f59e0b', action: () => { const p = this.svc.currentProjectId; if(p) this.router.navigate(['/projects',p]); this.close(); } },
      pipeline:  { label: 'Process Architect',icon: '🔁', color: '#8b5cf6', action: () => { this.router.navigate(['/pipeline-builder']); this.close(); } },
      spellweav: { label: 'Spell Forge',      icon: '🔮', color: '#6366f1', action: () => { this.router.navigate(['/flow-builder']); this.close(); } },
      sageforge: { label: 'Sage Forge',       icon: '🧙', color: '#14b8a6', action: () => { this.router.navigate(['/agent-builder']); this.close(); } },
      realmhub:  { label: 'Realm Hub',        icon: '🌐', color: '#ec4899', action: () => { this.router.navigate(['/realm']); this.close(); } },
      planning:  { label: 'Rite of Preparation', icon: '📅', color: '#f97316', action: () => { const p = this.svc.currentProjectId; if(p) this.router.navigate(['/sprint-planning',p]); else this.router.navigate(['/sprint-planning']); this.close(); } },
      convos:    { label: 'Sage Council',     icon: '💬', color: '#7c3aed', action: () => { this.router.navigate(['/conversations']); this.close(); } },
      architect: { label: 'Architect Oracle', icon: '🏛', color: '#f59e0b', action: () => window.dispatchEvent(new CustomEvent('carnival:open-architect')) },
      decrees:   { label: 'Sacred Decrees',   icon: '📜', color: '#d97706', action: () => { this.router.navigate(['/action-registry']); this.close(); } },
      realm:     { label: 'Realm Importer',   icon: '🌀', color: '#0891b2', action: () => { this.router.navigate(['/realm-importer']); this.close(); } },
      soulstone: { label: 'Soul Stone',       icon: '💎', color: '#a855f7', action: () => this.openSoulStoneWheel() },
    };

    for (const id of activeIds) {
      if (itemActions[id]) actions.push(itemActions[id]);
    }

    // FIX 2026-05-12 — Customize peut être remplacé par une action custom
    // (ex : ARCHITECT met "Change view" à cette place). Si pas de override,
    // on garde le bouton Customize standard.
    const customizeAction: WheelAction = this.svc.customizeOverride || {
      label: '⚙️ Customize', icon: '⚙️', color: '#6b7280',
      action: () => { this.toggleEditMode(); this.close(); }
    };
    actions.push(customizeAction);

    return [...registered, ...actions];
  }

  // ── Agents sub-wheel ───────────────────────────────────────
  private openAgentsWheel() {
    this.level = 1;
    this.hubColor = '#d54adf';
    this.loading = true;
    this.cdr.detectChanges();

    // Load favorite custom agents from API, then merge with CARNIVAL built-ins
    const projId = this.svc.currentProjectId;
    const projParam = projId ? `?projectId=${projId}` : '';
    this.http.get<any[]>(`${environment.apiUrl}/favorites/agent-details${projParam}`)
      .subscribe({
        next: favorites => {
          this.loading = false;
          const builtIn: WheelAction[] = [
            { label: 'YAMZY — The Conductor',  icon: '⚡', color: '#5412fc', agentId: 'YAMZY',      action: () => this.openChatWith('YAMZY') },
            { label: 'Aura — Vision Keeper',   icon: '👁', color: '#6366f1', agentId: 'AURA',       action: () => this.openChatWith('AURA') },
            { label: 'Nexus — Shield Master',  icon: '🛡', color: '#0ea5e9', agentId: 'NEXUS',      action: () => this.openChatWith('NEXUS') },
            { label: 'Forge — Reality Weaver',  icon: '🔨', color: '#10b981', agentId: 'FORGE',      action: () => this.openChatWith('FORGE') },
            { label: 'Architect — Oracle',      icon: '🏛', color: '#f59e0b', agentId: 'ARCHITECT',  action: () => this.openChatWith('ARCHITECT') },
            { label: 'Sentinel — The Reviewer', icon: '🔬', color: '#ec4899', agentId: 'SENTINEL',   action: () => this.openChatWith('SENTINEL') },
            { label: 'Bug Hunter — The Tracker',icon: '🐛', color: '#ef4444', agentId: 'BUG_HUNTER', action: () => this.openChatWith('BUG_HUNTER') },
          ];

          // Custom favorite agents — sorted by name
          const customAgents: WheelAction[] = (favorites || [])
            .filter((a: any) => a.activated)
            .map((a: any) => ({
              label: a.name,
              icon:  a.icon || '🤖',
              color: '#7c3aed',
              action: () => this.openCustomAgentChat(a.id, a.name, a.icon || '🤖')
            }));

          // Merge: custom favorites first (starred), then built-ins
          const agentList: WheelAction[] = [...customAgents, ...builtIn];

          // Promote pending message agent to top
          const pendingNow = this.svc.latestPending;
          if (pendingNow) {
            const alreadyIn = agentList.some((a: WheelAction) => a.label.startsWith(pendingNow.agentName));
            const pendingAction: WheelAction = {
              label: pendingNow.agentName + ' 💬',
              icon: pendingNow.agentIcon, color: '#22c55e',
              action: () => { this.svc.clearPending(pendingNow.agentId); this.openChatWith(pendingNow.agentId); }
            };
            if (!alreadyIn) agentList.unshift(pendingAction);
            else {
              const idx = agentList.findIndex((a: WheelAction) => a.label.startsWith(pendingNow.agentName));
              agentList[idx] = { ...agentList[idx], label: agentList[idx].label + ' 💬', color: '#22c55e' };
            }
          }
          this.swapItems(agentList);
          this.explode();
        },
        error: () => {
          this.loading = false;
          // Fallback: built-in only
          this.swapItems([
            { label: 'YAMZY — The Conductor',  icon: '⚡', color: '#5412fc', agentId: 'YAMZY',      action: () => this.openChatWith('YAMZY') },
            { label: 'Aura — Vision Keeper',   icon: '👁', color: '#6366f1', agentId: 'AURA',       action: () => this.openChatWith('AURA') },
            { label: 'Nexus — Shield Master',  icon: '🛡', color: '#0ea5e9', agentId: 'NEXUS',      action: () => this.openChatWith('NEXUS') },
            { label: 'Forge — Reality Weaver',  icon: '🔨', color: '#10b981', agentId: 'FORGE',      action: () => this.openChatWith('FORGE') },
            { label: 'Architect — Oracle',      icon: '🏛', color: '#f59e0b', agentId: 'ARCHITECT',  action: () => this.openChatWith('ARCHITECT') },
            { label: 'Sentinel — The Reviewer', icon: '🔬', color: '#ec4899', agentId: 'SENTINEL',   action: () => this.openChatWith('SENTINEL') },
            { label: 'Bug Hunter — The Tracker',icon: '🐛', color: '#ef4444', agentId: 'BUG_HUNTER', action: () => this.openChatWith('BUG_HUNTER') },
          ]);
          this.explode();
        }
      });
  }
// ── Flows sub-wheel — loads favorites from API ─────────────
  private openFlowsWheel() {
    this.level = 1;
    this.hubColor = '#0ea5e9';

    // Step 1: implode current items
    this.items.forEach(item => { item.visible = false; });
    this.loading = true;
    this.cdr.detectChanges();

    // Step 2: after implode animation, fetch favorites and explode
    setTimeout(() => {
      this.items = [];
      this.cdr.detectChanges();

      const flowProjId = this.svc.currentProjectId;
      const flowProjQ = flowProjId ? `?projectId=${flowProjId}` : '';
      this.http.get<any[]>(`${environment.apiUrl}/favorites/flow-details${flowProjQ}`)
        .subscribe({
          next: flows => {
            this.loading = false;
            if (!flows || flows.length === 0) {
              this.items = [];
              this.cdr.detectChanges();
              return;
            }
            const actions: WheelAction[] = flows.map(f => ({
              label:  f.name,
              icon:   f.icon || FLOW_ICON[f.status] || '🔀',
              color:  FLOW_COLOR[f.status] || '#0ea5e9',
              action: () => this.openFlowLaunch(f.id)
            }));
            this.loadItems(actions);
            this.cdr.detectChanges();
            this.explode();
          },
          error: () => {
            this.loading = false;
            this.items = [];
            this.cdr.detectChanges();
          }
        });
    }, 260);
  }

  // ── Soul Stone — LLM Switcher ───────────────────────────
  private openSoulStoneWheel() {
    this.level = 1;
    this.hubColor = '#a855f7';
    this.items.forEach(item => { item.visible = false; });
    this.loading = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.items = [];
      this.cdr.detectChanges();

      this.http.get<any>(`${environment.apiUrl}/llm-config`).subscribe({
        next: (current: any) => {
          this.http.get<any[]>(`${environment.apiUrl}/llm-config/providers`).subscribe({
            next: (providers: any[]) => {
              this.loading = false;
              const actions: WheelAction[] = [];

              actions.push({
                label: '⚡ ' + (current.model || 'Not configured'),
                icon: '💎', color: '#a855f7',
                action: () => { this.router.navigate(['/agents']); this.close(); }
              });

              for (const p of (providers || [])) {
                const isActive = current.provider === p.id;
                actions.push({
                  label: p.name + (isActive ? ' ✓' : p.configured ? ' ●' : ''),
                  icon: p.icon || '🤖',
                  color: isActive ? '#22c55e' : (p.configured ? '#3b82f6' : '#6b7280'),
                  action: () => {
                    if (!isActive) {
                      if (!p.configured && p.id !== 'OLLAMA') {
                        this.showMaxToast('⚠ ' + p.name + ' not configured.');
                        return;
                      }
                      this.http.post<any>(`${environment.apiUrl}/llm-config/switch/${p.id}`, {}).subscribe({
                        next: (r: any) => {
                          this.showMaxToast('💎 Switched to ' + p.name);
                          this.goBack();
                        },
                        error: (e: any) => { this.showMaxToast('⚠ Configure it first.'); }
                      });
                    } else {
                      this.showMaxToast('Already using ' + p.name);
                      this.close();
                    }
                  }
                });
              }

              actions.push({
                label: '⚙️ Full Config',
                icon: '⚙️', color: '#6b7280',
                action: () => { this.router.navigate(['/agents']); this.close(); }
              });

              this.loadItems(actions);
              this.cdr.detectChanges();
              this.explode();
            },
            error: () => { this.loading = false; this.items = []; this.cdr.detectChanges(); }
          });
        },
        error: () => { this.loading = false; this.items = []; this.cdr.detectChanges(); }
      });
    }, 260);
  }

  // ── Back to main ───────────────────────────────────────────
  private goBack() {
    this.level = 0;
    this.hubColor = '#d54adf';
    this.swapItems(this.getMainActions());
  }

  onHubClick() {
    if (this.level > 0) { this.goBack(); }
    else { this.close(); }
  }

  // ── Max favorites toast ────────────────────────────────────
  showMaxToast(msg: string) {
    this.maxToast = msg;
    this.cdr.detectChanges();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.maxToast = null;
      this.cdr.detectChanges();
    }, 6000);
  }

  // ── Helpers ────────────────────────────────────────────────
  private swapItems(actions: WheelAction[]) {
    this.items.forEach(item => { item.visible = false; });
    this.cdr.detectChanges();
    setTimeout(() => {
      this.loadItems(actions);
      this.cdr.detectChanges();
      if (actions.length) this.explode();
    }, 260);
  }

  private loadItems(actions: WheelAction[]) {
    this.hovIdx = -1;
    const n = actions.length;
    if (n === 0) { this.items = []; return; }
    const maxR = Math.min(this.cx, this.cy, window.innerWidth - this.cx, window.innerHeight - this.cy) - 50;
    this.radius = Math.min(n <= 4 ? 118 : n <= 6 ? 138 : 160, maxR);
    this.items = actions.map((action, i) => {
      const angle = (2 * Math.PI * i / n) - Math.PI / 2;
      return { action, angle, angleDeg: angle * 180 / Math.PI, tx: 0, ty: 0, visible: false };
    });
  }

  private explode() {
    requestAnimationFrame(() => {
      this.items.forEach((item, i) => {
        setTimeout(() => {
          item.tx = Math.cos(item.angle) * this.radius;
          item.ty = Math.sin(item.angle) * this.radius;
          item.visible = true;
          this.cdr.detectChanges();
        }, i * 42);
      });
    });
  }

  close() {
    this.items.forEach(item => { item.visible = false; item.tx = 0; item.ty = 0; });
    this.cdr.detectChanges();
    setTimeout(() => {
      this.visible = false;
      this.level = 0;
      this.items = [];
      this.loading = false;
      document.body.style.userSelect = '';
      this.cdr.detectChanges();
    }, 300);
  }

  // ── Flow launch modal (from wheel) ───────────────────────────────
  wheelLaunchVisible  = false;
  wheelLaunchFlowId: number | null = null;

  openFlowLaunch(flowId: number) {
    this.close();  // close wheel first
    setTimeout(() => {
      this.wheelLaunchFlowId  = flowId;
      this.wheelLaunchVisible = true;
      this.cdr.detectChanges();
    }, 320);
  }

  onWheelLaunchClosed() {
    this.wheelLaunchVisible = false;
    this.wheelLaunchFlowId  = null;
  }

  get wheelSvc() { return this.svc; }

  // ── Handoff modal ─────────────────────────────────────────────────
  handoffModal: any = null;

  openHandoffModal(handoff: any) {
    this.handoffModal = handoff;
    this.close();
  }

  acceptHandoff(handoffId: number) {
    this.http.post<any>(`${environment.apiUrl}/handoff/${handoffId}/accept`, {})
      .subscribe({
        next: r => {
          this.svc.clearHandoff(handoffId);
          this.handoffModal = null;
          if (r.conversationId) {
            this.router.navigate(['/conversations'], { queryParams: { conv: r.conversationId } });
          }
        },
        error: () => { this.handoffModal = null; }
      });
  }

  declineHandoff(handoffId: number) {
    this.http.post<any>(`${environment.apiUrl}/handoff/${handoffId}/decline`, {})
      .subscribe({
        next: () => { this.svc.clearHandoff(handoffId); this.handoffModal = null; },
        error: () => { this.handoffModal = null; }
      });
  }

  private forceClose() {
    this.items.forEach(item => { item.visible = false; item.tx = 0; item.ty = 0; });
    this.cdr.detectChanges();
    this.visible = false; this.level = 0; this.items = []; this.loading = false;
    document.body.style.userSelect = '';
  }

  triggerItem(item: OrbitalItem) {
    // FIX 2026-05-12 — Action avec children → ouvre un sous-niveau de la wheel
    // avec ces enfants (générique, utilisable par n'importe quel composant via
    // WheelAction.children). Ne ferme PAS la wheel. Le hub central revient à
    // sa fonction "back" automatiquement quand level > 0 (onHubClick).
    if (item.action.children && item.action.children.length) {
      this.level = 1;
      this.hubColor = item.action.color || '#5412fc';
      this.swapItems(item.action.children);
      return;
    }
    // Items that open sub-menus should NOT close the wheel first
    const subMenuLabels = ['Reality Weavers', 'Spell Weaver', 'Soul Stone', 'Agents IA', 'Flows'];
    const isGroup = subMenuLabels.some(l => item.action.label.includes(l));
    if (isGroup) {
      item.action.action();
    } else {
      this.close();
      setTimeout(() => item.action.action(), 200);
    }
  }

  private openChatWith(sage: string) {
    this.svc.clearPending(sage);
    window.dispatchEvent(new CustomEvent('carnival:open-chat', { detail: { sage } }));
  }

  private openCustomAgentChat(agentId: number, agentName: string, agentIcon: string) {
    this.svc.clearPending('custom:' + agentId);
    window.dispatchEvent(new CustomEvent('carnival:open-chat', {
      detail: { sage: 'custom:' + agentId, agentId, agentName, agentIcon, isCustom: true }
    }));
    this.close();
  }

  private clickSelector(sel: string) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) el.click();
  }

  // ── Wheel Customization ──────────────────────────────────
  allWheelItems = [
    { id: 'agents',    icon: '🤖', label: 'Agents IA',        category: 'Core',  enabled: true },
    { id: 'flows',     icon: '🔀', label: 'Flows',            category: 'Core',  enabled: true },
    { id: 'warroom',   icon: '⚔️', label: 'War Room',          category: 'Core',  enabled: true },
    { id: 'soulstone', icon: '💎', label: 'Soul Stone (LLM)',  category: 'Core',  enabled: true },
    { id: 'analytics', icon: '📊', label: 'Analytics IA',    category: 'Nav',   enabled: false },
    { id: 'arcantrace', icon: '🔍', label: 'Arcane Trace',   category: 'Nav',   enabled: false },
    { id: 'kanban',    icon: '📋', label: 'Kanban Board',      category: 'Nav',   enabled: false },
    { id: 'pipeline',  icon: '🔁', label: 'Pipeline Builder',  category: 'Nav',   enabled: false },
    { id: 'spellweav', icon: '✨', label: 'Spell Weaver',      category: 'Nav',   enabled: false },
    { id: 'sageforge', icon: '🧙', label: 'Sage Forge',        category: 'Nav',   enabled: false },
    { id: 'realmhub',  icon: '🌐', label: 'Realm Hub',         category: 'Nav',   enabled: false },
    { id: 'planning',  icon: '📅', label: 'Sprint Planning',   category: 'Nav',   enabled: false },
    { id: 'convos',    icon: '💬', label: 'Conversations',     category: 'Outils', enabled: false },
    { id: 'architect', icon: '🏛', label: 'Architect',         category: 'Outils', enabled: false },
  ];

  loadWheelConfig() {
    const jwt = localStorage.getItem('yamzy_jwt');
    if (!jwt) return;
    this.http.get<any>(`${environment.apiUrl}/users/me/wheel-config`,
      { headers: { Authorization: 'Bearer ' + jwt } })
      .subscribe({
        next: (r: any) => {
          if (r?.items && typeof r.items === 'string') {
            try { this.wheelConfig = JSON.parse(r.items); } catch { this.wheelConfig = null; }
          } else if (Array.isArray(r?.items)) {
            this.wheelConfig = r.items;
          }
        },
        error: () => {}
      });
  }

  saveWheelConfig() {
    const jwt = localStorage.getItem('yamzy_jwt');
    if (!jwt) return;
    const items = this.allWheelItems.filter(i => i.enabled).map(i => ({ id: i.id, icon: i.icon, label: i.label }));
    this.http.put(`${environment.apiUrl}/users/me/wheel-config`,
      { items },
      { headers: { Authorization: 'Bearer ' + jwt } })
      .subscribe({ next: () => {
        this.wheelConfig = items;
        this.editMode = false;
        if (this.visible) this.loadItems(this.getMainActions());
        this.cdr.detectChanges();
      }, error: () => {} });
  }

  resetWheelConfig() {
    const jwt = localStorage.getItem('yamzy_jwt');
    if (!jwt) return;
    this.http.delete(`${environment.apiUrl}/users/me/wheel-config`,
      { headers: { Authorization: 'Bearer ' + jwt } })
      .subscribe({ next: () => {
        this.wheelConfig = null;
        this.allWheelItems.forEach(i => i.enabled = ['agents','flows','warroom','soulstone'].includes(i.id));
        this.editMode = false;
        if (this.visible) this.loadItems(this.getMainActions());
        this.cdr.detectChanges();
      }, error: () => {} });
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    if (this.editMode) {
      // Sync allWheelItems with current config
      if (this.wheelConfig) {
        const ids = this.wheelConfig.map((c: any) => c.id);
        this.allWheelItems.forEach(i => i.enabled = ids.includes(i.id));
      } else {
        this.allWheelItems.forEach(i => i.enabled = ['agents','flows','warroom','soulstone'].includes(i.id));
      }
    }
    this.cdr.detectChanges();
  }

  moveItem(idx: number, dir: number) {
    const j = idx + dir;
    if (j < 0 || j >= this.allWheelItems.length) return;
    [this.allWheelItems[idx], this.allWheelItems[j]] = [this.allWheelItems[j], this.allWheelItems[idx]];
  }

  get wheelCategories(): string[] {
    return [...new Set(this.allWheelItems.map(i => i.category))];
  }
}
