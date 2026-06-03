// v1.0.123 — User menu : avatar dropdown avec profile / settings / logout.
// A placer dans le topbar du studio.

import { Component, OnInit, OnDestroy, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="um-wrap">
      <!-- Trigger : avatar + nom -->
      <button class="um-trigger" (click)="toggle()" [title]="user()?.githubLogin || 'User'">
        <div class="um-avatar" *ngIf="user() as u">
          <img *ngIf="u.avatarUrl" [src]="u.avatarUrl" [alt]="u.githubLogin"/>
          <span *ngIf="!u.avatarUrl" class="um-initials">{{ initials(u) }}</span>
        </div>
        <div class="um-trigger-info" *ngIf="user() as u">
          <span class="um-name">{{ u.name || u.githubLogin }}</span>
          <span class="um-role">{{ u.fantasyTitle || u.currentRole || 'Architect' }}</span>
        </div>
        <span class="um-chevron" [class.is-open]="open()">▼</span>
      </button>

      <!-- Dropdown -->
      <div *ngIf="open()" class="um-dropdown" (click)="$event.stopPropagation()">
        <div class="um-dropdown-head" *ngIf="user() as u">
          <div class="um-dropdown-avatar">
            <img *ngIf="u.avatarUrl" [src]="u.avatarUrl"/>
            <span *ngIf="!u.avatarUrl">{{ initials(u) }}</span>
          </div>
          <div class="um-dropdown-info">
            <div class="um-dropdown-name">{{ u.name || u.githubLogin }}</div>
            <div class="um-dropdown-handle">{{ '@' + u.githubLogin }}</div>
            <div class="um-dropdown-email" *ngIf="u.email">{{ u.email }}</div>
          </div>
        </div>

        <div class="um-dropdown-divider"></div>

        <a class="um-item" (click)="navigate('profile')">
          <span class="um-item-ico">👤</span>
          <span class="um-item-label">Profil</span>
          <span class="um-item-hint">Tes infos</span>
        </a>
        <a class="um-item" (click)="navigate('settings')">
          <span class="um-item-ico">⚙</span>
          <span class="um-item-label">Paramètres</span>
          <span class="um-item-hint">Langue, thème</span>
        </a>
        <a class="um-item" href="https://github.com/RamzyChatti90/yamzy-war-table" target="_blank" rel="noopener">
          <span class="um-item-ico">📜</span>
          <span class="um-item-label">Documentation</span>
          <span class="um-item-hint">Aide</span>
        </a>

        <div class="um-dropdown-divider"></div>

        <a class="um-item um-item-danger" (click)="logout()">
          <span class="um-item-ico">🚪</span>
          <span class="um-item-label">Se déconnecter</span>
        </a>

        <div class="um-version">v{{ studioVersion }}</div>
      </div>

      <!-- Profile modal -->
      <div *ngIf="profileOpen()" class="um-modal-backdrop" (click)="profileOpen.set(false)">
        <div class="um-modal" (click)="$event.stopPropagation()">
          <button class="um-modal-close" (click)="profileOpen.set(false)">✕</button>
          <div class="um-modal-head" *ngIf="user() as u">
            <div class="um-modal-avatar">
              <img *ngIf="u.avatarUrl" [src]="u.avatarUrl"/>
              <span *ngIf="!u.avatarUrl">{{ initials(u) }}</span>
            </div>
            <div>
              <h2 class="um-modal-title">{{ u.name || u.githubLogin }}</h2>
              <div class="um-modal-handle">{{ '@' + u.githubLogin }}</div>
              <div class="um-modal-role" *ngIf="u.fantasyTitle || u.currentRole">
                {{ u.fantasyTitle || u.currentRole }}
              </div>
            </div>
          </div>
          <div class="um-modal-body" *ngIf="user() as u">
            <div class="um-field">
              <label>GitHub Login</label>
              <code>{{ u.githubLogin }}</code>
            </div>
            <div class="um-field" *ngIf="u.email">
              <label>Email</label>
              <code>{{ u.email }}</code>
            </div>
            <div class="um-field" *ngIf="u.id">
              <label>User ID</label>
              <code>{{ u.id }}</code>
            </div>
            <div class="um-field" *ngIf="u.currentRole">
              <label>Rôle Scrum</label>
              <code>{{ u.currentRole }}</code>
            </div>
          </div>
          <div class="um-modal-foot">
            <a class="um-btn-ghost" href="https://github.com/{{ user()?.githubLogin }}" target="_blank" rel="noopener">
              🔗 Voir sur GitHub
            </a>
          </div>
        </div>
      </div>

      <!-- Settings modal -->
      <div *ngIf="settingsOpen()" class="um-modal-backdrop" (click)="settingsOpen.set(false)">
        <div class="um-modal" (click)="$event.stopPropagation()">
          <button class="um-modal-close" (click)="settingsOpen.set(false)">✕</button>
          <h2 class="um-modal-title">⚙ Paramètres</h2>
          <div class="um-modal-body">
            <div class="um-setting-row">
              <div>
                <div class="um-setting-name">🌐 Langue</div>
                <div class="um-setting-desc">FR / EN switch (LangSwitcher dans topbar)</div>
              </div>
              <span class="um-setting-value">via topbar</span>
            </div>
            <div class="um-setting-row">
              <div>
                <div class="um-setting-name">🎨 Mode édition</div>
                <div class="um-setting-desc">Affiche les boutons CRUD partout</div>
              </div>
              <span class="um-setting-value">via topbar 🔒/🔓</span>
            </div>
            <div class="um-setting-row">
              <div>
                <div class="um-setting-name">⌨ Raccourcis</div>
                <div class="um-setting-desc">Ctrl+Win wheel, Ctrl+Space arcane scrolls</div>
              </div>
              <span class="um-setting-value">activés</span>
            </div>
            <div class="um-setting-row">
              <div>
                <div class="um-setting-name">💾 Persistance</div>
                <div class="um-setting-desc">JWT localStorage · Excel auto-export 1.5s</div>
              </div>
              <span class="um-setting-value">activé</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: inline-flex; position: relative; }

    .um-wrap { position: relative; }
    .um-trigger {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px 6px 6px;
      background: rgba(15, 11, 32, 0.55);
      border: 1px solid rgba(139, 127, 214, 0.30);
      border-radius: 999px;
      cursor: pointer;
      color: #fff;
      font-family: inherit;
      font-size: 12px;
      transition: all .18s;
    }
    .um-trigger:hover {
      border-color: rgba(217, 154, 81, 0.65);
      background: rgba(43, 37, 73, 0.65);
      transform: translateY(-1px);
    }
    .um-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .um-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .um-initials { color: #fff; font-weight: 800; font-size: 13px; }
    .um-trigger-info { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
    .um-name { font-weight: 700; font-size: 12px; }
    .um-role { font-size: 9px; color: rgba(200, 188, 230, 0.75); letter-spacing: 0.06em; }
    .um-chevron { font-size: 9px; color: rgba(200, 188, 230, 0.65); transition: transform .2s; }
    .um-chevron.is-open { transform: rotate(180deg); }

    /* Dropdown */
    .um-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 280px;
      background: rgba(15, 11, 32, 0.95);
      backdrop-filter: blur(14px);
      border: 1.5px solid rgba(217, 154, 81, 0.35);
      border-radius: 14px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.70);
      padding: 10px;
      z-index: 99000;
      animation: um-drop-in .18s ease-out;
    }
    @keyframes um-drop-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .um-dropdown-head {
      display: flex;
      gap: 10px;
      padding: 8px 8px 12px;
    }
    .um-dropdown-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #fff; font-weight: 800;
    }
    .um-dropdown-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .um-dropdown-info { flex: 1; min-width: 0; }
    .um-dropdown-name {
      font-size: 13px; font-weight: 800; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .um-dropdown-handle { font-size: 10px; color: rgba(200, 188, 230, 0.75); font-family: 'Courier New', monospace; }
    .um-dropdown-email { font-size: 10px; color: rgba(200, 188, 230, 0.55); margin-top: 2px; }
    .um-dropdown-divider {
      height: 1px; margin: 4px 4px; background: rgba(139, 127, 214, 0.18);
    }
    .um-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      color: #f4ecff;
      font-size: 12px;
      transition: background .15s;
    }
    .um-item:hover { background: rgba(217, 154, 81, 0.18); }
    .um-item-ico { font-size: 16px; flex-shrink: 0; }
    .um-item-label { font-weight: 700; flex: 1; }
    .um-item-hint { font-size: 10px; color: rgba(200, 188, 230, 0.55); }
    .um-item-danger:hover { background: rgba(222, 79, 95, 0.18); color: #fca5a5; }
    .um-version {
      text-align: center;
      font-size: 10px;
      color: rgba(200, 188, 230, 0.40);
      font-family: 'Courier New', monospace;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid rgba(139, 127, 214, 0.12);
    }

    /* Modals */
    .um-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(6px);
      z-index: 99500;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .um-modal {
      width: 100%; max-width: 480px;
      background: rgba(15, 11, 32, 0.95);
      backdrop-filter: blur(14px);
      border: 1.5px solid rgba(217, 154, 81, 0.45);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 28px 64px rgba(0, 0, 0, 0.75);
      color: #f4ecff;
      position: relative;
    }
    .um-modal-close {
      position: absolute;
      top: 14px; right: 14px;
      width: 30px; height: 30px;
      border: none;
      background: rgba(0, 0, 0, 0.35);
      color: #fff;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      transition: all .15s;
    }
    .um-modal-close:hover { background: rgba(222, 79, 95, 0.55); }
    .um-modal-head {
      display: flex; gap: 14px;
      margin-bottom: 18px;
    }
    .um-modal-avatar {
      width: 64px; height: 64px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #fff; font-weight: 800; font-size: 24px;
    }
    .um-modal-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .um-modal-title {
      font-size: 20px; font-weight: 800; margin: 0 0 4px;
      color: #fff;
    }
    .um-modal-handle { font-size: 12px; color: rgba(200, 188, 230, 0.85); font-family: 'Courier New', monospace; }
    .um-modal-role {
      display: inline-block;
      font-size: 10px; font-weight: 800; letter-spacing: 0.10em;
      padding: 3px 10px;
      background: linear-gradient(135deg, #d99a51, #c25d8d);
      border-radius: 999px;
      margin-top: 6px;
      color: #fff;
      text-transform: uppercase;
    }
    .um-modal-body { padding: 8px 0; }
    .um-field {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dashed rgba(139, 127, 214, 0.15);
      font-size: 12px;
    }
    .um-field:last-child { border-bottom: none; }
    .um-field label { color: rgba(200, 188, 230, 0.75); font-weight: 700; }
    .um-field code {
      background: rgba(15, 11, 32, 0.5);
      padding: 3px 8px;
      border-radius: 5px;
      font-family: 'Courier New', monospace;
      color: #ffe5b8;
    }
    .um-setting-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px dashed rgba(139, 127, 214, 0.18);
    }
    .um-setting-row:last-child { border-bottom: none; }
    .um-setting-name { font-size: 13px; font-weight: 700; color: #fff; }
    .um-setting-desc { font-size: 11px; color: rgba(200, 188, 230, 0.65); margin-top: 2px; }
    .um-setting-value {
      font-size: 11px;
      padding: 3px 9px;
      background: rgba(112, 185, 68, 0.20);
      border: 1px solid rgba(112, 185, 68, 0.45);
      border-radius: 999px;
      color: #c8eecf;
      font-weight: 700;
    }
    .um-modal-foot {
      display: flex; justify-content: flex-end;
      margin-top: 12px; padding-top: 14px;
      border-top: 1px solid rgba(139, 127, 214, 0.15);
    }
    .um-btn-ghost {
      padding: 8px 14px;
      background: rgba(105, 100, 232, 0.20);
      color: #d4cbe9;
      border-radius: 8px;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid rgba(139, 127, 214, 0.40);
      transition: all .15s;
    }
    .um-btn-ghost:hover {
      background: rgba(105, 100, 232, 0.40);
      color: #fff;
    }
  `]
})
export class UserMenuComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.currentUser;
  open = signal(false);
  profileOpen = signal(false);
  settingsOpen = signal(false);
  studioVersion = '1.0.123';

  private onDocClick = () => this.open.set(false);

  ngOnInit(): void {
    document.addEventListener('click', this.onDocClick);
    // Reload current user au cas ou le cache est obsolete
    if (this.auth.isAuthenticated() && !this.user()) {
      this.auth.loadCurrentUser();
    }
  }
  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocClick);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.open.set(false);
    this.profileOpen.set(false);
    this.settingsOpen.set(false);
  }

  toggle(): void {
    // Fix bubbling : on stop sur le button click via event.stopPropagation
    // (geree par le doc listener qui ferme)
    setTimeout(() => this.open.update(v => !v), 0);
  }

  initials(u: any): string {
    const name = u?.name || u?.githubLogin || '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  navigate(target: 'profile' | 'settings'): void {
    this.open.set(false);
    if (target === 'profile') this.profileOpen.set(true);
    else this.settingsOpen.set(true);
  }

  logout(): void {
    if (!confirm('Se déconnecter ?')) return;
    // v1.0.177cs — Sauve la session timer en cours AVANT logout sinon elle est perdue.
    //   Dispatch d'un événement custom écouté par WarTableComponent.endTicketWork().
    try { window.dispatchEvent(new CustomEvent('yamzy:before-logout')); } catch {}
    this.auth.clearSession();
    this.router.navigate(['/login']);
  }
}
