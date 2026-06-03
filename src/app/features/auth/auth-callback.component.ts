// Capture le ?token=… renvoyé par le backend Yamzy après OAuth GitHub réussi.
// Route : /auth/callback?token=eyJhbGc...
// Stocke le JWT, hydrate currentUser depuis /api/users/me, redirige vers /war-table.

import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="cb-host">
      <div class="cb-card">
        <div class="cb-orb">⚔</div>
        <h1>Authentification réussie</h1>
        <p *ngIf="!error">Récupération de ton JWT…</p>
        <p class="cb-err" *ngIf="error">{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; width:100%; height:100vh;
      background: linear-gradient(135deg, #0a0820, #1a1542, #2b2549);
      font-family: 'Poppins', sans-serif; }
    .cb-host { width:100%; height:100vh; display:flex; align-items:center; justify-content:center; }
    .cb-card { background: rgba(15,14,35,.7); backdrop-filter: blur(14px);
      border: 1px solid rgba(139,127,214,.3); border-radius: 24px;
      padding: 40px 60px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
    .cb-orb { font-size: 56px; color: #d99a51;
      text-shadow: 0 0 24px rgba(217,154,81,.7); animation: cb-spin 2s infinite; }
    @keyframes cb-spin { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
    h1 { color: #fff; font-size: 20px; font-weight: 800; letter-spacing: .15em;
      text-transform: uppercase; margin: 18px 0 6px; }
    p { color: #a99fd6; font-size: 13px; margin: 0; }
    .cb-err { color: #fca5a5; }
  `]
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  error = '';

  ngOnInit(): void {
    this.route.queryParams.subscribe(qp => {
      const token = qp['token'];
      // v1.0.177ct — Cas 1 : token présent dans l'URL → stocke + hydrate + navigue
      if (token && String(token).length >= 20) {
        localStorage.setItem('yamzy_jwt', token);
        console.log('[WAR TABLE] ✓ JWT reçu via OAuth backend');
        this.auth.loadCurrentUser().subscribe({
          next: (u: any) => console.log('[WAR TABLE] ✓ User hydraté :', u?.githubLogin || '?', '· name=', u?.name || u?.displayName, '· avatar=', !!u?.avatarUrl),
          error: (err) => console.warn('[WAR TABLE] ⚠ Hydratation user failed :', err?.status, err?.message),
        });
        // Navigation immédiate — le user component se mettra à jour quand currentUser sera hydraté
        this.router.navigate(['/war-table']);
        return;
      }
      // v1.0.177ct — Cas 2 : pas de token dans l'URL (refresh sur /auth/callback OU OAuth a échoué)
      //   Si on a déjà un JWT en localStorage → on est probablement déjà connecté, on navigue vers studio
      const existingJwt = localStorage.getItem('yamzy_jwt');
      if (existingJwt && existingJwt.length >= 20) {
        console.log('[WAR TABLE] JWT déjà présent en localStorage → navigation directe vers /war-table');
        this.router.navigate(['/war-table']);
        return;
      }
      // v1.0.177ct — Cas 3 : pas de token, pas de JWT → vraie erreur, retour vers /login
      console.warn('[WAR TABLE] Token manquant et aucun JWT en cache → retour /login');
      this.error = 'Aucun token reçu. Retour à la page de connexion…';
      setTimeout(() => this.router.navigate(['/login']), 1500);
    });
  }
}
