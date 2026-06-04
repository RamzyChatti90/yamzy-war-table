import { Component, OnInit, OnDestroy, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Scroll {
  id?: number;
  title: string;
  content: string;
  color: string;
  category: string;
  pinned: boolean;
  editing?: boolean;
  // v1.0.107/108 — Chantier D : scrolls auto-generes depuis POS DB
  isAuto?: boolean;
  autoKind?: string;        // meeting-notes | upcoming-event | my-todo
  autoMetadata?: any;       // { eventId, ticketId, ... }
}

@Component({
  selector: 'app-arcane-scroll',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    /* ── Spell-caster ADN : Henny Penny + Tinos + magenta #d54adf ─── */
    @import url("https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap");

    :host {
      --as-accent: #d54adf;
      --as-bg: rgba(0, 0, 0, 0.86);
      --as-font-body: "Tinos", serif;
      --as-font-title: "Henny Penny", cursive;
      --as-ink: #f0e6f5;
      --as-ink-soft: rgba(240, 230, 245, 0.72);
      --as-ink-faded: rgba(240, 230, 245, 0.5);
    }

    /* v1.0.80 — Critical CSS pour war-table (Tailwind absent). */
    :host .as-overlay {
      position: fixed; inset: 0; z-index: 99990;
      background: rgba(0, 0, 0, .55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      animation: as-fade-in .25s ease-out;
      font-family: var(--as-font-body);
    }
    @keyframes as-fade-in { from { opacity: 0; } to { opacity: 1; } }
    :host .as-panel {
      width: 92vw; max-width: 1200px; height: 85vh;
      background-color: var(--as-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px;
      display: flex; flex-direction: column; overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--as-accent) 45%, #333);
      border-left: 4px solid var(--as-accent);
      box-shadow: 0 8px 40px color-mix(in srgb, var(--as-accent) 22%, transparent);
      color: var(--as-ink);
    }
    :host .as-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 28px;
      border-bottom: 1px solid color-mix(in srgb, var(--as-accent) 30%, transparent);
    }
    :host .as-h-left { display: flex; align-items: center; gap: 12px; }
    :host .as-h-right { display: flex; align-items: center; gap: 12px; }
    :host .as-title {
      font-family: var(--as-font-title);
      font-size: 28px; font-weight: 400;
      color: var(--as-accent);
      margin: 0; letter-spacing: 0.02em;
      text-shadow: 0 0 18px color-mix(in srgb, var(--as-accent) 50%, transparent);
    }
    :host .as-sub {
      font-family: var(--as-font-body);
      font-size: 12px;
      color: var(--as-ink-soft);
      font-weight: 400; font-style: italic;
      margin: 2px 0 0;
    }
    :host .as-cats { display: flex; gap: 4px; }
    :host .as-cat-btn {
      font-family: var(--as-font-body);
      padding: 5px 11px; border-radius: 8px;
      font-size: 12px; font-weight: 700;
      border: 1px solid color-mix(in srgb, var(--as-accent) 30%, #333);
      background: rgba(0, 0, 0, 0.4);
      color: var(--as-ink-soft);
      cursor: pointer; transition: all .15s;
      backdrop-filter: blur(6px);
    }
    :host .as-cat-btn:hover {
      border-color: var(--as-accent);
      color: var(--as-accent);
      box-shadow: 0 0 12px color-mix(in srgb, var(--as-accent) 30%, transparent);
    }
    :host .as-cat-btn.is-active {
      background: color-mix(in srgb, var(--as-accent) 80%, #000);
      color: #fff;
      border-color: var(--as-accent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--as-accent) 50%, transparent);
    }
    :host .as-new-btn {
      font-family: var(--as-font-title);
      padding: 8px 18px;
      background: color-mix(in srgb, var(--as-accent) 85%, #000);
      color: #fff; font-size: 14px;
      font-weight: 400; border-radius: 12px;
      border: 1px solid var(--as-accent);
      border-left: 4px solid var(--as-accent);
      cursor: pointer; letter-spacing: 0.04em;
      box-shadow: 0 4px 20px color-mix(in srgb, var(--as-accent) 35%, transparent);
      transition: all .18s;
    }
    :host .as-new-btn:hover {
      background: var(--as-accent);
      box-shadow: 0 6px 26px color-mix(in srgb, var(--as-accent) 55%, transparent);
      transform: translateY(-1px);
    }
    :host .as-close-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; background: transparent;
      color: var(--as-ink-faded);
      border: 1px solid color-mix(in srgb, var(--as-accent) 20%, transparent);
      cursor: pointer; font-size: 18px;
      transition: all .15s;
    }
    :host .as-close-btn:hover {
      color: var(--as-accent);
      background: rgba(0,0,0,.35);
      border-color: var(--as-accent);
    }
    :host .as-body {
      flex: 1; overflow-y: auto; padding: 24px 28px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; align-content: start;
    }
    :host .as-card {
      border-radius: 16px; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      min-height: 180px; cursor: pointer; transition: all .2s;
      background-color: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
      border: 1px solid color-mix(in srgb, var(--as-accent) 25%, #333);
      border-left: 4px solid var(--as-accent);
      color: var(--as-ink);
      box-shadow: 0 4px 20px color-mix(in srgb, var(--as-accent) 12%, transparent);
    }
    :host .as-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 32px color-mix(in srgb, var(--as-accent) 35%, transparent);
      border-color: color-mix(in srgb, var(--as-accent) 60%, #333);
    }
    :host .as-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    :host .as-card-title-input, :host .as-card-title {
      font-family: var(--as-font-title);
      font-size: 17px; font-weight: 400;
      color: var(--as-accent);
      background: transparent; border: none; outline: none; flex: 1;
      padding: 0; letter-spacing: 0.02em;
      text-shadow: 0 0 10px color-mix(in srgb, var(--as-accent) 35%, transparent);
    }
    :host .as-card-actions { display: flex; gap: 4px; }
    :host .as-card-btn {
      width: 24px; height: 24px; border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--as-accent) 20%, transparent);
      background: rgba(0,0,0,.4);
      cursor: pointer; font-size: 12px;
      color: var(--as-ink-soft);
      display: inline-flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    :host .as-card-btn:hover {
      background: rgba(0,0,0,.65);
      border-color: var(--as-accent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--as-accent) 35%, transparent);
    }
    :host .as-card-pre {
      flex: 1;
      font-family: var(--as-font-body);
      font-size: 13px; font-weight: 400;
      color: var(--as-ink-soft);
      white-space: pre-wrap; word-break: break-word;
      margin: 0; line-height: 1.65;
    }
    :host .as-card-textarea {
      flex: 1;
      font-family: var(--as-font-body);
      font-size: 13px;
      background: rgba(0,0,0,.35);
      border: 1px dashed color-mix(in srgb, var(--as-accent) 40%, transparent);
      border-radius: 8px;
      padding: 8px; resize: none; outline: none;
      color: var(--as-ink);
    }
    :host .as-card-foot { display: flex; gap: 6px; align-items: center; }
    :host .as-card-foot select {
      font-family: var(--as-font-body);
      font-size: 11px; padding: 3px 6px; border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--as-accent) 30%, #333);
      background: rgba(0,0,0,.6);
      color: var(--as-ink);
    }
    /* Accent-toned color variants on dark substrate */
    :host .as-color-yellow {
      background-color: rgba(0, 0, 0, 0.55);
      border-left-color: #fcd34d;
      box-shadow: 0 4px 20px color-mix(in srgb, #fcd34d 18%, transparent);
    }
    :host .as-color-blue {
      background-color: rgba(0, 0, 0, 0.55);
      border-left-color: #60a5fa;
      box-shadow: 0 4px 20px color-mix(in srgb, #60a5fa 18%, transparent);
    }
    :host .as-color-pink {
      background-color: rgba(0, 0, 0, 0.55);
      border-left-color: #f472b6;
      box-shadow: 0 4px 20px color-mix(in srgb, #f472b6 18%, transparent);
    }
    :host .as-color-green {
      background-color: rgba(0, 0, 0, 0.55);
      border-left-color: #4ade80;
      box-shadow: 0 4px 20px color-mix(in srgb, #4ade80 18%, transparent);
    }
    :host .as-color-purple {
      background-color: rgba(0, 0, 0, 0.55);
      border-left-color: #c084fc;
      box-shadow: 0 4px 20px color-mix(in srgb, #c084fc 18%, transparent);
    }
    :host .as-empty {
      grid-column: 1 / -1; text-align: center;
      padding: 60px 20px;
      color: var(--as-ink-faded);
      font-family: var(--as-font-body);
      font-size: 14px;
    }
    /* v1.0.107 — Card auto-generee depuis WAR TABLE (read-only) */
    :host .as-card-auto {
      position: relative;
      border-style: dashed !important;
      border-width: 1.5px !important;
    }
    :host .as-auto-badge {
      position: absolute;
      top: 6px; right: 8px;
      font-family: var(--as-font-body);
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.12em;
      padding: 2px 7px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--as-accent) 75%, #000);
      color: #fff;
      pointer-events: none;
      box-shadow: 0 0 8px color-mix(in srgb, var(--as-accent) 45%, transparent);
    }
    :host .as-pre-auto { font-style: italic; }
  `],
  template: `
    <!-- Full screen overlay — Ctrl+Space -->
    <div *ngIf="open" class="as-overlay" (click)="close($event)">
      <div class="as-panel" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="as-header">
          <div class="as-h-left">
            <span style="font-size:28px">📜</span>
            <div>
              <h2 class="as-title">Arcane Scrolls</h2>
              <p class="as-sub">Your personal grimoire — notes, secrets & incantations</p>
            </div>
          </div>
          <div class="as-h-right">
            <div class="as-cats">
              <button *ngFor="let c of categories" (click)="filterCat=c.id"
                      class="as-cat-btn" [class.is-active]="filterCat===c.id">
                {{c.icon}} {{c.label}}
              </button>
            </div>
            <button (click)="addScroll()" class="as-new-btn">＋ New Scroll</button>
            <button (click)="open=false" class="as-close-btn">✕</button>
          </div>
        </div>

        <!-- Scrolls Grid -->
        <div class="as-body">
          <div *ngFor="let s of filtered(); trackBy: trackById"
               class="as-card"
               [class.as-color-yellow]="s.color==='yellow'"
               [class.as-color-blue]="s.color==='blue'"
               [class.as-color-pink]="s.color==='pink'"
               [class.as-color-green]="s.color==='green'"
               [class.as-color-purple]="s.color==='purple'"
               [class.as-card-auto]="s.isAuto"
               [style.outline]="s.pinned ? '2px solid #5412fc' : 'none'"
               (click)="onAutoCardClick(s, $event)">

            <!-- v1.0.107 — Badge AUTO sur les scrolls auto-generes -->
            <span *ngIf="s.isAuto" class="as-auto-badge" title="Auto-sync depuis WAR TABLE">🔄 AUTO</span>

            <!-- Card Header -->
            <div class="as-card-head">
              <span style="cursor:pointer; font-size:14px" (click)="togglePin(s)" [title]="s.pinned ? 'Unpin' : 'Pin'">{{s.pinned ? '📌' : '📍'}}</span>
              <span *ngIf="!s.editing" class="as-card-title" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{{s.title}}</span>
              <input *ngIf="s.editing && !s.isAuto" [(ngModel)]="s.title" class="as-card-title-input" placeholder="Title...">
              <div class="as-card-actions">
                <button *ngIf="!s.editing && !s.isAuto" (click)="s.editing=true" class="as-card-btn" title="Edit">✏️</button>
                <button *ngIf="s.editing && !s.isAuto" (click)="saveScroll(s)" class="as-card-btn" title="Save">💾</button>
                <button (click)="copyContent(s)" class="as-card-btn" title="Copy">📋</button>
                <button *ngIf="!s.isAuto" (click)="deleteScroll(s)" class="as-card-btn" title="Delete">🗑</button>
              </div>
            </div>

            <!-- Card Body -->
            <pre *ngIf="!s.editing" class="as-card-pre" [class.as-pre-auto]="s.isAuto" (dblclick)="!s.isAuto && (s.editing=true)">{{s.content || (s.isAuto ? '(read-only auto-feed)' : 'Double-click to edit...')}}</pre>
            <textarea *ngIf="s.editing && !s.isAuto" [(ngModel)]="s.content" class="as-card-textarea"
                      placeholder="Your notes, commands, credentials..." rows="6"></textarea>

            <!-- Card Footer -->
            <div class="as-card-foot">
              <select *ngIf="s.editing" [(ngModel)]="s.color">
                <option value="yellow">🟡 Yellow</option>
                <option value="blue">🔵 Blue</option>
                <option value="pink">🩷 Pink</option>
                <option value="green">🟢 Green</option>
                <option value="purple">🟣 Purple</option>
              </select>
              <select *ngIf="s.editing" [(ngModel)]="s.category">
                <option value="notes">📝 Notes</option>
                <option value="credentials">🔑 Credentials</option>
                <option value="commands">⌨️ Commands</option>
                <option value="links">🔗 Links</option>
              </select>
              <span *ngIf="!s.editing" style="font-size:10px; color:#9ca3af; font-weight:600">{{catIcon(s.category)}} {{s.category}}</span>
            </div>
          </div>

          <!-- Empty state -->
          <div *ngIf="!filtered().length" class="as-empty">
            <div style="font-size:48px; margin-bottom:12px">📜</div>
            <p style="font-family:'Henny Penny',cursive; font-size:18px; margin:0 0 16px; color:#d54adf; text-shadow:0 0 12px rgba(213,74,223,0.4); letter-spacing:0.03em">No scrolls yet. Create your first arcane note!</p>
            <button (click)="addScroll()" class="as-new-btn">＋ New Scroll</button>
          </div>
        </div>

        <!-- Footer hint -->
        <div style="text-align:center; padding:10px 0; font-family:'Tinos',serif; font-size:11px; color:rgba(240,230,245,0.55); border-top:1px solid rgba(213,74,223,0.25); background:rgba(0,0,0,0.3)">
          <code style="background:rgba(213,74,223,0.18); padding:2px 6px; border-radius:4px; font-size:10px; color:#f0e6f5; font-family:'Tinos',serif">Ctrl+Space</code> pour toggle ·
          Double-click pour éditer · 📋 pour copier
        </div>
      </div>
    </div>

    <!-- Copied toast -->
    <div *ngIf="copied" style="position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:99999; padding:10px 18px; background:rgba(0,0,0,0.86); color:#fff; font-family:'Tinos',serif; font-size:13px; font-weight:700; border-radius:12px; border:1px solid color-mix(in srgb, #d54adf 45%, #333); border-left:4px solid #d54adf; backdrop-filter:blur(10px); box-shadow:0 8px 40px color-mix(in srgb, #d54adf 22%, transparent)">
      📋 Copied to clipboard!
    </div>
  `
})
export class ArcaneScrollComponent implements OnInit, OnDestroy {
  /** v1.0.107 — Chantier D : si fourni, on enrichit l'arcane avec un feed
   *  auto-genere depuis /api/pos/projects/{pid}/arcane-feed (read-only). */
  @Input() posProjectId?: number | null;
  /** v1.0.108 — Emit quand l'user clique sur un scroll auto pour naviguer
   *  vers la source (backlog/agenda). Le parent peut fermer l'arcane et router. */
  @Output() navigateRequest = new EventEmitter<{ kind: string; page: string; id?: number; ticketKey?: string }>();

  open = false;
  scrolls: Scroll[] = [];
  autoScrolls: Scroll[] = []; // v1.0.107 — feed auto (read-only)
  filterCat = 'all';
  copied = false;
  private refreshTimer: any = null; // v1.0.108 — auto-reload toutes 60s tant qu'ouvert

  categories = [
    { id: 'all', icon: '✦', label: 'All' },
    // v1.0.107 — categories auto-generees apparaissent en premier
    { id: 'Notes reunions',      icon: '📝', label: 'Notes reunions' },
    { id: 'Ceremonies a venir',  icon: '⏰', label: 'A venir' },
    { id: 'Mes TODOs',           icon: '✅', label: 'Mes TODOs' },
    // categories manuelles d'origine
    { id: 'notes', icon: '📝', label: 'Notes' },
    { id: 'credentials', icon: '🔑', label: 'Credentials' },
    { id: 'commands', icon: '⌨️', label: 'Commands' },
    { id: 'links', icon: '🔗', label: 'Links' }
  ];

  colorMap: Record<string, string> = {
    yellow: '#fef9c3', blue: '#dbeafe', pink: '#fce7f3', green: '#dcfce7', purple: '#ede9fe'
  };
  borderMap: Record<string, string> = {
    yellow: '#fde047', blue: '#93c5fd', pink: '#f9a8d4', green: '#86efac', purple: '#c4b5fd'
  };

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.stopAutoRefresh(); }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      this.open = !this.open;
      if (this.open) {
        this.load();
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    }
    if (e.key === 'Escape' && this.open) {
      this.open = false;
      this.stopAutoRefresh();
    }
  }

  /** v1.0.108 — Auto-refresh des scrolls auto toutes les 60s tant qu'ouvert. */
  private startAutoRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      if (this.open) this.load();
    }, 60_000);
  }
  private stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** v1.0.108 — Click sur un scroll auto = navigue vers la source. */
  onAutoCardClick(s: Scroll, ev: MouseEvent) {
    if (!s.isAuto) return;
    // Ignore le click si c'est sur un bouton (📋 copy, 📌 pin)
    if ((ev.target as HTMLElement).closest('button')) return;
    const meta = s.autoMetadata || {};
    let page = 'agenda';
    if (s.autoKind === 'my-todo') page = 'backlog';
    else if (s.autoKind === 'meeting-notes') page = 'meeting-reports';
    else if (s.autoKind === 'upcoming-event') page = 'agenda';
    this.navigateRequest.emit({
      kind: s.autoKind || '',
      page,
      id: meta.ticketId || meta.eventId,
      ticketKey: meta.ticketKey
    });
    // Ferme l'arcane apres click
    this.open = false;
    this.stopAutoRefresh();
  }

  load() {
    // Scrolls manuels
    this.http.get<Scroll[]>(environment.apiUrl + '/arcane-scrolls').subscribe({
      next: s => this.scrolls = s,
      error: () => {}
    });
    // v1.0.107 — Feed auto (Notes reunions + Ceremonies a venir + Mes TODOs)
    if (this.posProjectId) {
      this.http.get<any[]>(environment.apiUrl + '/pos/projects/' + this.posProjectId + '/arcane-feed').subscribe({
        next: items => {
          this.autoScrolls = (items || []).map(item => ({
            title: item.title,
            content: item.content,
            color: item.color,
            category: item.category,
            pinned: !!item.pinned,
            isAuto: true,
            autoKind: item.kind,
            autoMetadata: item.metadata
          }));
        },
        error: () => { this.autoScrolls = []; }
      });
    } else {
      this.autoScrolls = [];
    }
  }

  filtered(): Scroll[] {
    // v1.0.107 — Combine auto (en premier) + manuels. Pinned remontent en haut.
    const combined = [...this.autoScrolls, ...this.scrolls];
    const list = this.filterCat === 'all'
      ? combined
      : combined.filter(s => s.category === this.filterCat);
    return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }

  addScroll() {
    const s: Scroll = { title: 'New Scroll', content: '', color: 'yellow', category: 'notes', pinned: false, editing: true };
    this.http.post<Scroll>(environment.apiUrl + '/arcane-scrolls', s).subscribe({
      next: saved => { this.scrolls.unshift({ ...saved, editing: true }); }
    });
  }

  saveScroll(s: Scroll) {
    if (!s.id) return;
    s.editing = false;
    this.http.put(environment.apiUrl + '/arcane-scrolls/' + s.id, {
      title: s.title, content: s.content, color: s.color, category: s.category, pinned: s.pinned
    }).subscribe();
  }

  deleteScroll(s: Scroll) {
    if (!s.id) return;
    this.http.delete(environment.apiUrl + '/arcane-scrolls/' + s.id).subscribe({
      next: () => { this.scrolls = this.scrolls.filter(x => x.id !== s.id); }
    });
  }

  togglePin(s: Scroll) {
    s.pinned = !s.pinned;
    if (s.id) {
      this.http.put(environment.apiUrl + '/arcane-scrolls/' + s.id, { pinned: s.pinned }).subscribe({
        next: () => this.load()
      });
    }
  }

  copyContent(s: Scroll) {
    navigator.clipboard.writeText(s.content || s.title).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  catIcon(cat: string): string {
    const c = this.categories.find(x => x.id === cat);
    return c ? c.icon : '📝';
  }

  trackById(i: number, s: Scroll) { return s.id; }

  close(e: Event) {
    if (e.target === e.currentTarget) this.open = false;
  }
}
