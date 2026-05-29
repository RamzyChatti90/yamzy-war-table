import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'war-table', pathMatch: 'full' },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: 'war-table',
    loadComponent: () =>
      import('./features/war-table/war-table.component').then(m => m.WarTableComponent),
  },
  { path: '**', redirectTo: 'war-table' },
];
