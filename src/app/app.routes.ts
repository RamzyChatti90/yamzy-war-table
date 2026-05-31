import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'war-table', pathMatch: 'full' },
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
  // v1.0.122 — Studio protege par authGuard (redirige /login si pas de JWT)
  {
    path: 'war-table',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/war-table/war-table.component').then(m => m.WarTableComponent),
  },
  { path: '**', redirectTo: 'war-table' },
];
