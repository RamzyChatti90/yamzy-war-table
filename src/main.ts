import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// ════════════════════════════════════════════════════════════════════════
// Pré-bootstrap SSO :
//
//   CAS A — JWT déjà présent (localStorage ou ?token=)   → continue
//   CAS B — ?bridged=1 mais pas de token                  → mode anonyme
//   CAS C — Yamzy frontend (:4200) up                     → bridge SSO
//   CAS D — Yamzy frontend down + backend up              → OAuth direct via :8080
//   CAS E — Tout est down                                 → erreur visible plus tard
//
// L'extension peut donc tourner SEULE (sans charger Yamzy frontend),
// en utilisant la même page GitHub login que Yamzy via le backend.
// ════════════════════════════════════════════════════════════════════════
const TOKEN_KEY = 'yamzy_jwt';
const CALLBACK_PATH = '/auth/callback';

// 🪶 Routes publiques qui ne nécessitent AUCUN auth (pas de SSO bridge)
const PUBLIC_ROUTES = [
  '/yamzy-rooms',
  '/yamzy-studio-maker',
  '/yamzy-island',
  '/orrery-viewer',
  '/orrery-lab',
  '/git-tree-room',
  '/kanban-island',
  '/pr-mirror-hall',
  '/phoenix-forge',
  '/okr-mountain',
  '/library-cathedral',
  '/star-map-risks',
  '/oracle-aquarium',
  '/alchemist-cellar',
  '/card-tavern',
  '/telescope-island',
  '/showcase',
  '/welcome',
  '/mana-fountain',
  '/retrospective-cove',
  '/premortem-crypt',
  '/story-trail',
  '/lean-coffee',
  '/refinement-orchard',
  '/five-whys-well',
  '/definitions-beach',
  '/conclave-room',
  '/island/delivery',
  '/island/strategy',
  '/island/knowledge',
  '/island/commerce',
  '/login',
];

async function preBootstrap(): Promise<void> {
  try {
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get('token');

    // 🪶 SKIP entirely : routes publiques (Studio Maker + rooms 3D + login)
    if (PUBLIC_ROUTES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
      console.log('[WAR TABLE] route publique — skip SSO');
      return;
    }
    // Path '/' redirige vers /yamzy-studio-maker → c'est une route publique
    if (url.pathname === '/' || url.pathname === '') {
      console.log('[WAR TABLE] root path → studio maker (public)');
      return;
    }

    // CAS A1 : retour OAuth ou bridge avec ?token=
    if (tokenFromUrl && tokenFromUrl.length > 20) {
      localStorage.setItem(TOKEN_KEY, tokenFromUrl);
      url.searchParams.delete('token');
      url.searchParams.delete('bridged');
      window.history.replaceState({}, '', url.toString());
      console.log('[WAR TABLE] ✓ JWT capturé via URL');
      return;
    }

    // CAS A2 : déjà en localStorage
    if (localStorage.getItem(TOKEN_KEY)) return;

    // CAS A3 : on est sur /auth/callback → laisser le composant gérer (pas de redirect)
    if (url.pathname.endsWith(CALLBACK_PATH)) return;

    // CAS A4 : standalone mode explicite (config) → continue sans auth
    if (environment.standaloneMode) {
      console.log('[WAR TABLE] mode standalone — pas de bridge');
      return;
    }

    // CAS B : on a déjà essayé sans succès → mode anonyme
    if (url.searchParams.get('bridged') === '1') {
      console.warn('[WAR TABLE] ⚠ bridge tenté, aucun JWT — mode anonyme');
      return;
    }

    // CAS C vs D : probe Yamzy frontend
    const yamzyUp = await probeUrl(`${environment.yamzyHostUrl}/`);

    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set('bridged', '1');

    if (yamzyUp) {
      // CAS C — Yamzy frontend reachable → bridge SSO classique
      const bridgeUrl = `${environment.yamzyHostUrl}/auth/bridge?return=${encodeURIComponent(returnUrl.toString())}`;
      console.log('[WAR TABLE] → bridge SSO vers Yamzy hôte');
      window.location.replace(bridgeUrl);
      return;
    }

    // CAS D — Yamzy frontend down → OAuth direct via backend
    // Le backend va orchestrer GitHub OAuth puis redirect vers /auth/callback?token=...
    const callbackUrl = `${window.location.origin}${CALLBACK_PATH}`;
    const ssoStartUrl = `${environment.apiUrl}/auth/sso-start?redirect_uri=${encodeURIComponent(callbackUrl)}`;
    console.log('[WAR TABLE] → OAuth direct via backend (Yamzy frontend down)');
    window.location.replace(ssoStartUrl);
  } catch (e) {
    console.error('[WAR TABLE] preBootstrap SSO error', e);
  }
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(1500) });
    return true;
  } catch { return false; }
}

(async () => {
  await preBootstrap();
  bootstrapApplication(AppComponent, appConfig)
    .catch(err => console.error(err));
})();
