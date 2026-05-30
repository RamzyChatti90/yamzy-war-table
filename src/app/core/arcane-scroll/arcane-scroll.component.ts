import { Component, OnInit, HostListener } from '@angular/core';
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
}

@Component({
  selector: 'app-arcane-scroll',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Full screen overlay — Ctrl+Space -->
    <div *ngIf="open" class="fixed inset-0 z-[99990] bg-black/30 backdrop-blur-sm flex items-center justify-center animate-fade-in" (click)="close($event)">
      <div class="w-[92vw] max-w-[1200px] h-[85vh] bg-white rounded-3xl flex flex-col overflow-hidden border border-gray-200 shadow-2xl" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <span class="text-3xl">📜</span>
            <div>
              <h2 class="text-lg font-black text-gray-900 tracking-tight">Arcane Scrolls</h2>
              <p class="text-[11px] text-[#5412fc] font-semibold">Your personal grimoire — notes, secrets & incantations</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Category filters -->
            <div class="flex gap-1">
              <button *ngFor="let c of categories" (click)="filterCat=c.id"
                class="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer"
                [class]="filterCat===c.id ? 'bg-[#5412fc] text-white border-[#5412fc]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-[#5412fc] hover:text-[#5412fc]'">
                {{c.icon}} {{c.label}}
              </button>
            </div>
            <button (click)="addScroll()" class="px-4 py-2 bg-[#5412fc] text-white text-[11px] font-bold rounded-xl hover:bg-[#4309d9] border-none cursor-pointer shadow-sm">＋ New Scroll</button>
            <button (click)="open=false" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 border-none bg-transparent cursor-pointer text-lg">✕</button>
          </div>
        </div>

        <!-- Scrolls Grid -->
        <div class="flex-1 overflow-y-auto p-6 grid gap-4" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));align-content:start;">
          <div *ngFor="let s of filtered(); trackBy: trackById"
            class="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg border-[1.5px]"
            [style.background]="colorMap[s.color]"
            [style.border-color]="borderMap[s.color]"
            [class.ring-2]="s.pinned" [class.ring-indigo-300]="s.pinned">

            <!-- Card Header -->
            <div class="flex items-center gap-2">
              <span class="cursor-pointer text-xs" (click)="togglePin(s)" [title]="s.pinned ? 'Unpin' : 'Pin'">{{s.pinned ? '📌' : '📍'}}</span>
              <span *ngIf="!s.editing" class="text-[13px] font-extrabold text-gray-800 flex-1 truncate">{{s.title}}</span>
              <input *ngIf="s.editing" [(ngModel)]="s.title" class="flex-1 text-[13px] font-extrabold text-gray-800 bg-transparent border-none outline-none border-b-2 border-[#5412fc] px-0 py-0.5" placeholder="Title...">
              <div class="flex gap-0.5">
                <button *ngIf="!s.editing" (click)="s.editing=true" class="bg-transparent border-none cursor-pointer text-[11px] opacity-40 hover:opacity-100 p-1 rounded" title="Edit">✏️</button>
                <button *ngIf="s.editing" (click)="saveScroll(s)" class="bg-transparent border-none cursor-pointer text-[11px] opacity-100 p-1 rounded bg-indigo-50" title="Save">💾</button>
                <button (click)="copyContent(s)" class="bg-transparent border-none cursor-pointer text-[11px] opacity-40 hover:opacity-100 p-1 rounded" title="Copy">📋</button>
                <button (click)="deleteScroll(s)" class="bg-transparent border-none cursor-pointer text-[11px] opacity-40 hover:opacity-100 hover:bg-red-50 p-1 rounded" title="Delete">🗑</button>
              </div>
            </div>

            <!-- Card Body -->
            <div *ngIf="!s.editing" class="flex-1 min-h-[60px]" (dblclick)="s.editing=true">
              <pre class="m-0 text-xs text-gray-600 whitespace-pre-wrap break-words leading-relaxed" style="font-family:'Cascadia Code','Fira Code',monospace;">{{s.content || 'Double-click to edit...'}}</pre>
            </div>
            <textarea *ngIf="s.editing" [(ngModel)]="s.content"
              class="w-full min-h-[100px] border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 resize-y outline-none focus:border-[#5412fc] bg-white/70"
              style="font-family:'Cascadia Code','Fira Code',monospace;box-sizing:border-box;"
              placeholder="Your notes, commands, credentials..." rows="6"></textarea>

            <!-- Card Footer -->
            <div class="flex gap-2 items-center">
              <select *ngIf="s.editing" [(ngModel)]="s.color" class="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white/70 outline-none">
                <option value="yellow">🟡 Yellow</option>
                <option value="blue">🔵 Blue</option>
                <option value="pink">🩷 Pink</option>
                <option value="green">🟢 Green</option>
                <option value="purple">🟣 Purple</option>
              </select>
              <select *ngIf="s.editing" [(ngModel)]="s.category" class="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white/70 outline-none">
                <option value="notes">📝 Notes</option>
                <option value="credentials">🔑 Credentials</option>
                <option value="commands">⌨️ Commands</option>
                <option value="links">🔗 Links</option>
              </select>
              <span *ngIf="!s.editing" class="text-[10px] text-gray-400 font-semibold">{{catIcon(s.category)}} {{s.category}}</span>
            </div>
          </div>

          <!-- Empty state -->
          <div *ngIf="!filtered().length" class="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
            <span class="text-5xl">📜</span>
            <p class="text-sm">No scrolls yet. Create your first arcane note!</p>
            <button (click)="addScroll()" class="px-4 py-2 bg-[#5412fc] text-white text-xs font-bold rounded-xl hover:bg-[#4309d9] border-none cursor-pointer">＋ New Scroll</button>
          </div>
        </div>

        <!-- Footer hint -->
        <div class="text-center py-2.5 text-[10px] text-gray-400 border-t border-gray-100">
          <span class="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[9px]">Ctrl+Space</span> to toggle ·
          Double-click to edit · 📋 to copy
        </div>
      </div>
    </div>

    <!-- Copied toast -->
    <div *ngIf="copied" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-lg">
      📋 Copied to clipboard!
    </div>
  `,
  styles: [`.animate-fade-in { animation: asFade .15s ease; } @keyframes asFade { from { opacity:0 } to { opacity:1 } }`]
})
export class ArcaneScrollComponent implements OnInit {
  open = false;
  scrolls: Scroll[] = [];
  filterCat = 'all';
  copied = false;

  categories = [
    { id: 'all', icon: '✦', label: 'All' },
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
    this.http.get<Scroll[]>(environment.apiUrl + '/arcane-scrolls').subscribe({
      next: s => this.scrolls = s,
      error: () => {}
    });
  }

  filtered(): Scroll[] {
    if (this.filterCat === 'all') return this.scrolls;
    return this.scrolls.filter(s => s.category === this.filterCat);
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
