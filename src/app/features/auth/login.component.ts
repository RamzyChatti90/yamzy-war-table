// v1.0.122 — Page /login standalone pour le studio WAR TABLE.
// Si l'user n'utilise pas Yamzy World, il peut se connecter ici avec GitHub
// OAuth (memes credentials que Yamzy core).
//
// Workflow :
//   1. User arrive sur /login (via guard ou /logout)
//   2. Click "Sign in with GitHub"
//   3. Redirect vers backend :8080/oauth2/authorization/github
//        avec redirect_uri=http://localhost:4201/auth/callback
//   4. GitHub OAuth -> backend OAuth2SuccessHandler genere JWT
//   5. Backend redirect /auth/callback?token=xxx
//   6. AuthCallbackComponent stocke token + redirect /war-table

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { YamzyAvatar3dComponent } from '../war-table/yamzy-avatar-3d.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, YamzyAvatar3dComponent],
  template: `
    <div class="lg-host">
      <!-- BG gradient + animated orbs -->
      <div class="lg-bg-orb lg-orb-1"></div>
      <div class="lg-bg-orb lg-orb-2"></div>
      <div class="lg-bg-orb lg-orb-3"></div>

      <div class="lg-card">
        <!-- Brand — VESPER, l'ange du purgatoire chantant la cadence des rituels Scrum -->
        <div class="lg-brand">
          <div class="lg-vesper-3d">
            <app-yamzy-avatar-3d
              glbUrl="/assets/agents/vesper.glb"
              [rotate]="true"
              [bob]="true">
            </app-yamzy-avatar-3d>
          </div>
          <div class="lg-brand-name">WAR TABLE</div>
          <div class="lg-brand-tag">Vesper's Conclave · Planning Organisator Studio</div>
        </div>

        <!-- Hero -->
        <h1 class="lg-title">Bienvenue, Architect</h1>
        <p class="lg-subtitle">
          <strong style="color:#ffe5b8">VESPER</strong>, gardienne des cadences,
          t'attend dans son atelier du purgatoire.<br/>
          Connecte-toi avec GitHub pour ouvrir la Conclave.
        </p>

        <!-- Error -->
        <div *ngIf="error()" class="lg-error">
          <span class="lg-error-icon">⚠</span>
          <span>{{ error() }}</span>
        </div>

        <!-- Buttons -->
        <button class="lg-btn lg-btn-github" (click)="loginGithub()" [disabled]="loading()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.62-4.04-1.62-.55-1.38-1.34-1.75-1.34-1.75-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5.99.11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.53.12-3.19 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.19.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 21.79 24 17.31 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span *ngIf="!loading()">Se connecter avec GitHub</span>
          <span *ngIf="loading()">⟳ Redirection vers GitHub…</span>
        </button>

        <!-- Yamzy bridge option -->
        <div class="lg-or">ou</div>
        <button class="lg-btn lg-btn-yamzy" (click)="useYamzy()">
          <span class="lg-yamzy-emoji">🎪</span>
          <span>J'utilise Yamzy World (port 4200)</span>
        </button>

        <!-- Footer info -->
        <div class="lg-footer">
          <a href="https://github.com/RamzyChatti90/yamzy-war-table" target="_blank" rel="noopener" class="lg-footer-link">
            📜 Documentation
          </a>
          <span class="lg-footer-sep">·</span>
          <span class="lg-footer-version">v{{ studioVersion }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
      background: linear-gradient(135deg, #0a0820 0%, #1a1542 50%, #2b2549 100%);
      font-family: 'Poppins', system-ui, sans-serif;
      overflow: hidden;
      position: relative;
    }
    .lg-host {
      width: 100%;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
    }
    /* Animated background orbs */
    .lg-bg-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      pointer-events: none;
      animation: lg-float 14s ease-in-out infinite;
    }
    .lg-orb-1 { width: 380px; height: 380px; top: -100px; left: -100px; background: #d99a51; animation-delay: 0s; }
    .lg-orb-2 { width: 320px; height: 320px; bottom: -80px; right: -100px; background: #6647bf; animation-delay: 5s; }
    .lg-orb-3 { width: 240px; height: 240px; top: 40%; right: 20%; background: #c25d8d; animation-delay: 2.5s; }
    @keyframes lg-float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -20px) scale(1.08); }
      66% { transform: translate(-20px, 30px) scale(0.95); }
    }

    .lg-card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 460px;
      padding: 36px 40px;
      background: rgba(15, 11, 32, 0.72);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(217, 154, 81, 0.35);
      border-radius: 24px;
      box-shadow: 0 28px 64px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(217, 154, 81, 0.10);
      text-align: center;
    }

    .lg-brand { margin-bottom: 24px; }
    /* v1.0.124 — VESPER 3D viewer (replace l'orb ⚔) */
    .lg-vesper-3d {
      width: 130px;
      height: 130px;
      margin: 0 auto;
      position: relative;
      filter: drop-shadow(0 8px 24px rgba(217, 154, 81, 0.55));
      animation: lg-vesper-float 6s ease-in-out infinite;
    }
    @keyframes lg-vesper-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-8px); }
    }
    /* Halo angélique derrière VESPER */
    .lg-vesper-3d::before {
      content: "";
      position: absolute;
      inset: -16px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(217, 154, 81, 0.30), transparent 70%);
      z-index: -1;
      animation: lg-halo 4s ease-in-out infinite;
    }
    @keyframes lg-halo {
      0%, 100% { opacity: 0.55; transform: scale(1); }
      50%      { opacity: 0.85; transform: scale(1.12); }
    }
    .lg-brand-mark {
      font-size: 56px;
      color: #d99a51;
      text-shadow: 0 0 24px rgba(217, 154, 81, 0.55), 0 0 48px rgba(217, 154, 81, 0.30);
      animation: lg-pulse 3s ease-in-out infinite;
    }
    @keyframes lg-pulse {
      0%, 100% { transform: scale(1) rotate(-3deg); }
      50% { transform: scale(1.06) rotate(3deg); }
    }
    .lg-brand-name {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.20em;
      color: #fff;
      margin-top: 4px;
    }
    .lg-brand-tag {
      font-size: 10px;
      letter-spacing: 0.18em;
      color: rgba(217, 154, 81, 0.85);
      text-transform: uppercase;
      margin-top: 4px;
      font-weight: 700;
    }

    .lg-title {
      font-size: 24px;
      font-weight: 800;
      color: #fff;
      margin: 4px 0 8px;
    }
    .lg-subtitle {
      font-size: 13px;
      color: rgba(200, 188, 230, 0.85);
      line-height: 1.55;
      margin-bottom: 24px;
    }

    .lg-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      background: rgba(222, 79, 95, 0.15);
      border: 1px solid rgba(222, 79, 95, 0.55);
      border-radius: 10px;
      color: #fca5a5;
      font-size: 12px;
      text-align: left;
      margin-bottom: 16px;
    }
    .lg-error-icon { font-size: 16px; flex-shrink: 0; }

    .lg-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      border: 1.5px solid transparent;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all .25s ease;
      letter-spacing: 0.04em;
    }
    .lg-btn:disabled { cursor: wait; opacity: 0.7; }
    .lg-btn-github {
      background: #24292f;
      color: #fff;
      border-color: rgba(217, 154, 81, 0.40);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
    }
    .lg-btn-github:hover:not(:disabled) {
      background: #2c3138;
      border-color: rgba(217, 154, 81, 0.85);
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(217, 154, 81, 0.30);
    }
    .lg-or {
      margin: 14px 0;
      font-size: 11px;
      letter-spacing: 0.12em;
      color: rgba(200, 188, 230, 0.50);
      font-weight: 700;
      text-transform: uppercase;
      position: relative;
    }
    .lg-or::before, .lg-or::after {
      content: "";
      position: absolute;
      top: 50%;
      width: 35%;
      height: 1px;
      background: rgba(139, 127, 214, 0.30);
    }
    .lg-or::before { left: 0; }
    .lg-or::after { right: 0; }
    .lg-btn-yamzy {
      background: rgba(105, 100, 232, 0.18);
      color: #d4cbe9;
      border-color: rgba(139, 127, 214, 0.45);
    }
    .lg-btn-yamzy:hover {
      background: rgba(105, 100, 232, 0.35);
      transform: translateY(-1px);
    }
    .lg-yamzy-emoji { font-size: 18px; }

    .lg-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(139, 127, 214, 0.18);
      font-size: 11px;
      color: rgba(200, 188, 230, 0.55);
    }
    .lg-footer-link {
      color: rgba(217, 154, 81, 0.85);
      text-decoration: none;
      font-weight: 700;
    }
    .lg-footer-link:hover { color: #d99a51; }
    .lg-footer-sep { opacity: 0.5; }
    .lg-footer-version { font-family: 'Courier New', monospace; }
  `]
})
export class LoginComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal<string>('');
  studioVersion = '1.0.122';

  ngOnInit(): void {
    // Si deja authentifie -> redirige war-table
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/war-table']);
      return;
    }
    // Si on arrive avec ?error=... (echec OAuth backend), affiche le message
    this.route.queryParams.subscribe(qp => {
      const err = qp['error'];
      if (err) {
        this.error.set('Connexion GitHub échouée : ' + decodeURIComponent(err));
      }
      const expired = qp['expired'];
      if (expired === '1') {
        this.error.set('Ta session a expiré. Reconnecte-toi pour continuer.');
      }
    });
  }

  loginGithub(): void {
    this.loading.set(true);
    this.error.set('');
    // Backend OAuth2SuccessHandler accepte redirect_uri (whitelist
    // app.oauth2.allowed-redirect-uris inclut deja localhost:4201/auth/callback).
    const callbackUri = `${window.location.origin}/auth/callback`;
    const apiBase = environment.apiUrl.replace(/\/api$/, '');
    const oauthUrl = `${apiBase}/oauth2/authorization/github?redirect_uri=${encodeURIComponent(callbackUri)}`;
    window.location.href = oauthUrl;
  }

  useYamzy(): void {
    // Bridge : redirige vers Yamzy World principal pour login,
    // qui renvoie ensuite vers war-table avec ?token=...
    window.location.href = 'http://localhost:4200/login?redirect=' +
      encodeURIComponent(`${window.location.origin}/auth/callback`);
  }
}
