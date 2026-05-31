import { Component, OnInit, HostListener, Input } from '@angular/core';
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
    /* v1.0.80 — Critical CSS pour war-table (Tailwind absent).
       Mappe les classes Tailwind utilisées vers du CSS natif. */
    :host .as-overlay {
      position: fixed; inset: 0; z-index: 99990;
      background: rgba(0, 0, 0, .55); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      animation: as-fade-in .25s ease-out;
    }
    @keyframes as-fade-in { from { opacity: 0; } to { opacity: 1; } }
    :host .as-panel {
      width: 92vw; max-width: 1200px; height: 85vh;
      background: #fff; border-radius: 24px;
      display: flex; flex-direction: column; overflow: hidden;
      border: 1px solid rgba(0, 0, 0, .1);
      box-shadow: 0 25px 60px rgba(0, 0, 0, .5);
    }
    :host .as-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 28px; border-bottom: 1px solid #f1f1f4;
    }
    :host .as-h-left { display: flex; align-items: center; gap: 12px; }
    :host .as-h-right { display: flex; align-items: center; gap: 12px; }
    :host .as-title { font-size: 18px; font-weight: 900; color: #111; margin: 0; letter-spacing: -.01em; }
    :host .as-sub { font-size: 11px; color: #5412fc; font-weight: 600; margin: 2px 0 0; }
    :host .as-cats { display: flex; gap: 4px; }
    :host .as-cat-btn {
      padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 700;
      border: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280;
      cursor: pointer; transition: all .15s;
    }
    :host .as-cat-btn:hover { border-color: #5412fc; color: #5412fc; }
    :host .as-cat-btn.is-active { background: #5412fc; color: #fff; border-color: #5412fc; }
    :host .as-new-btn {
      padding: 8px 16px; background: #5412fc; color: #fff; font-size: 11px;
      font-weight: 700; border-radius: 12px; border: none; cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,.1);
    }
    :host .as-new-btn:hover { background: #4309d9; }
    :host .as-close-btn {
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      border-radius: 8px; background: transparent; color: #9ca3af;
      border: none; cursor: pointer; font-size: 18px;
    }
    :host .as-close-btn:hover { color: #4b5563; background: #f3f4f6; }
    :host .as-body {
      flex: 1; overflow-y: auto; padding: 24px 28px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; align-content: start;
    }
    :host .as-card {
      border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      min-height: 180px; cursor: pointer; transition: all .2s;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
    }
    :host .as-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,.14); }
    :host .as-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    :host .as-card-title-input, :host .as-card-title {
      font-size: 14px; font-weight: 800; color: #1f2937;
      background: transparent; border: none; outline: none; flex: 1;
      font-family: inherit; padding: 0;
    }
    :host .as-card-actions { display: flex; gap: 4px; }
    :host .as-card-btn {
      width: 24px; height: 24px; border-radius: 6px; border: none;
      background: rgba(0,0,0,.06); cursor: pointer; font-size: 12px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    :host .as-card-btn:hover { background: rgba(0,0,0,.12); }
    :host .as-card-pre {
      flex: 1; font-family: 'Courier New', monospace; font-size: 12px;
      color: #374151; white-space: pre-wrap; word-break: break-word;
      margin: 0; line-height: 1.5;
    }
    :host .as-card-textarea {
      flex: 1; font-family: 'Courier New', monospace; font-size: 12px;
      background: transparent; border: 1px dashed rgba(0,0,0,.2); border-radius: 8px;
      padding: 8px; resize: none; outline: none; color: #374151;
    }
    :host .as-card-foot { display: flex; gap: 6px; align-items: center; }
    :host .as-card-foot select {
      font-size: 10px; padding: 3px 6px; border-radius: 6px;
      border: 1px solid rgba(0,0,0,.1); background: rgba(255,255,255,.7);
    }
    :host .as-color-yellow { background: #fef3c7; border: 1px solid #fde68a; }
    :host .as-color-blue { background: #dbeafe; border: 1px solid #bfdbfe; }
    :host .as-color-pink { background: #fce7f3; border: 1px solid #fbcfe8; }
    :host .as-color-green { background: #dcfce7; border: 1px solid #bbf7d0; }
    :host .as-color-purple { background: #ede9fe; border: 1px solid #ddd6fe; }
    :host .as-empty { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #9ca3af; }
    /* v1.0.107 — Card auto-generee depuis WAR TABLE (read-only) */
    :host .as-card-auto {
      position: relative;
      border-style: dashed !important;
      border-width: 1.5px !important;
    }
    :host .as-auto-badge {
      position: absolute;
      top: 6px; right: 8px;
      font-size: 8px; font-weight: 900;
      letter-spacing: 0.10em;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      pointer-events: none;
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
               [style.outline]="s.pinned ? '2px solid #5412fc' : 'none'">

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
            <p style="font-size:14px; margin:0 0 16px">No scrolls yet. Create your first arcane note!</p>
            <button (click)="addScroll()" class="as-new-btn">＋ New Scroll</button>
          </div>
        </div>

        <!-- Footer hint -->
        <div style="text-align:center; padding:10px 0; font-size:10px; color:#9ca3af; border-top:1px solid #f3f4f6">
          <code style="background:#f3f4f6; padding:2px 6px; border-radius:4px; font-size:9px">Ctrl+Space</code> pour toggle ·
          Double-click pour éditer · 📋 pour copier
        </div>
      </div>
    </div>

    <!-- Copied toast -->
    <div *ngIf="copied" style="position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:99999; padding:8px 16px; background:#111827; color:#fff; font-size:12px; font-weight:700; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.3)">
      📋 Copied to clipboard!
    </div>
  `
})
export class ArcaneScrollComponent implements OnInit {
  /** v1.0.107 — Chantier D : si fourni, on enrichit l'arcane avec un feed
   *  auto-genere depuis /api/pos/projects/{pid}/arcane-feed (read-only). */
  @Input() posProjectId?: number | null;

  open = false;
  scrolls: Scroll[] = [];
  autoScrolls: Scroll[] = []; // v1.0.107 — feed auto (read-only)
  filterCat = 'all';
  copied = false;

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

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      this.open = !this.open;
      if (this.open) this.load();
    }
    if (e.key === 'Escape' && this.open) this.open = false;
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
