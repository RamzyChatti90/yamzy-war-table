import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
 * AuthService pour l'app WAR TABLE standalone.
 *
 * v1.0.122 :
 *  - Page /login dediee (LoginComponent) + GitHub OAuth backend
 *  - AuthGuard + 401 interceptor pour redirige /login auto
 *  - clearSession() pour logout
 *  - loadCurrentUser() pour hydrater le profil apres login
 *
 * 3 sources possibles pour le JWT, dans cet ordre :
 *   1. ?token=… dans l'URL (auth-callback)
 *   2. localStorage.yamzy_jwt (deja transfere)
 *   3. aucun -> AuthGuard redirige /login
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  readonly TOKEN_KEY = 'yamzy_jwt';
  readonly USER_KEY = 'yamzy_user';

  currentUser = signal<CarnivalUser | null>(null);

  constructor() {
    this.bridgeTokenFromUrl();
    this.currentUser.set(this.loadCachedUser());
    // Au boot : si on a un token, on charge le profil pour le mettre a jour
    if (this.isAuthenticated()) {
      this.loadCurrentUser().subscribe({ error: () => { /* 401 will be handled by interceptor */ } });
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Stocke un JWT et reload pour appliquer aux requetes. */
  setToken(token: string, reload = true): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    if (reload) location.reload();
  }

  /** v1.0.122 — Logout : clear JWT + user, redirige sera fait par le caller. */
  clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
  }

  /** v1.0.122 — Charge le profil utilisateur courant depuis /api/users/me. */
  loadCurrentUser() {
    const obs = this.http.get<any>(`${environment.apiUrl}/users/me`);
    obs.subscribe({
      next: (u) => {
        const mapped: CarnivalUser = {
          id: u.id,
          githubLogin: u.githubLogin || u.login || 'guest',
          name: u.name || u.displayName,
          email: u.email,
          avatarUrl: u.avatarUrl,
          currentRole: u.currentRole || u.role,
          fantasyTitle: u.fantasyTitle,
        };
        this.currentUser.set(mapped);
        localStorage.setItem(this.USER_KEY, JSON.stringify(mapped));
      },
      error: () => { /* 401 handled by interceptor */ }
    });
    return obs;
  }

  /** Lit ?token=… dans l'URL et le persiste, puis clean l'URL. */
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
        id: u.id,
        githubLogin: u.githubLogin || u.login || 'guest',
        name: u.name || u.displayName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        currentRole: u.currentRole || u.role,
        fantasyTitle: u.fantasyTitle,
      };
    } catch {
      return null;
    }
  }
}
