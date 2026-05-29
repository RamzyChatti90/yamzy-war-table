// Capture le ?token=… renvoyé par le backend Yamzy après OAuth GitHub réussi.
// Route : /auth/callback?token=eyJhbGc...
// Stocke le JWT, nettoie l'URL, redirige vers /war-table.

import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

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
  error = '';

  ngOnInit(): void {
    this.route.queryParams.subscribe(qp => {
      const token = qp['token'];
      if (!token || String(token).length < 20) {
        this.error = 'Token manquant ou invalide dans le callback.';
        return;
      }
      localStorage.setItem('yamzy_jwt', token);
      console.log('[WAR TABLE] ✓ JWT reçu via OAuth backend');
      // Redirige vers le studio (sans le token dans l'URL)
      setTimeout(() => this.router.navigate(['/war-table']), 300);
    });
  }
}
