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
  { path: '**', redirectTo: 'conclave' },
];
