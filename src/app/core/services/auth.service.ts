import { Injectable, signal } from '@angular/core';

export interface CarnivalUser {
  id?: number;
  githubLogin: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  currentRole?: string;
  fantasyTitle?: string;
}

/**
 * AuthService minimal pour l'app WAR TABLE standalone.
 *
 * 3 sources possibles pour le JWT, dans cet ordre :
 *   1. ?token=… dans l'URL (bridge depuis :4200, le plus pratique)
 *   2. localStorage.yamzy_jwt (déjà transféré)
 *   3. aucun → 401 sur les /api/pos/*
 *
 * Au boot : si ?token=… est présent, on le stocke et on clean l'URL.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly TOKEN_KEY = 'yamzy_jwt';
  readonly USER_KEY = 'yamzy_user';

  currentUser = signal<CarnivalUser | null>(null);

  constructor() {
    this.bridgeTokenFromUrl();
    this.currentUser.set(this.loadCachedUser());
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Stocke un JWT et reload pour appliquer aux requêtes. */
  setToken(token: string, reload = true): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    if (reload) location.reload();
  }

  /** Lit ?token=… dans l'URL et le persiste, puis clean l'URL (history.replaceState). */
  private bridgeTokenFromUrl(): void {
    try {
      const url = new URL(window.location.href);
      const t = url.searchParams.get('token');
      if (t && t.length > 20) {
        localStorage.setItem(this.TOKEN_KEY, t);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
        console.log('[WAR TABLE] JWT bridged from URL — ready to call /api/pos/*');
      }
    } catch { /* no-op */ }
  }

  private loadCachedUser(): CarnivalUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return {
        githubLogin: u.githubLogin || u.login || 'guest',
        name: u.name || u.displayName,
        avatarUrl: u.avatarUrl,
        currentRole: u.currentRole || u.role,
        fantasyTitle: u.fantasyTitle,
      };
    } catch {
      return null;
    }
  }
}
