import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth.guard';

// v1.0.127 — Renommage WAR TABLE -> Conclave de VESPER
// Route principale : /conclave (avec redirect compat depuis /war-table)
export const routes: Routes = [
  { path: '', redirectTo: 'conclave', pathMatch: 'full' },
  // Backward compat : ancien lien /war-table redirige vers /conclave
  { path: 'war-table', redirectTo: 'conclave', pathMatch: 'full' },
  // v1.0.122 — Page de login standalone (GitHub OAuth)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  // OAuth callback (recoit ?token=...)
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  // v1.0.127 — Studio (anciennement war-table) renomme Conclave de VESPER
  {
    path: 'conclave',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/war-table/war-table.component').then(m => m.WarTableComponent),
  },
  // Sanctuaire 3D : chambre + crystal du spell-caster (publique, sans auth)
  {
    path: 'conclave-room',
    loadComponent: () =>
      import('./features/conclave-room/conclave-room.component').then(m => m.ConclaveRoomComponent),
  },
  // Orrery Viewer — page indépendante fullscreen avec scène GLB + cristal + particules
  // (publique, demo / capture / partage — pas besoin d'auth ni de projet chargé)
  {
    path: 'orrery-viewer',
    loadComponent: () =>
      import('./features/orrery-viewer/orrery-viewer.component').then(m => m.OrreryViewerComponent),
  },
  { path: '**', redirectTo: 'conclave' },
];
