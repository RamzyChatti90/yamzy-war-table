// v1.0.122 — Interceptor : ajoute Bearer JWT + redirige /login sur 401.
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  // Skip Authorization sur les requetes externes (CDN, assets)
  const needsToken = req.url.includes('/api/') && token;
  const cloned = needsToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    catchError(err => {
      // 401 sur une API call -> session expiree, redirige /login
      if (err?.status === 401 && req.url.includes('/api/')) {
        const onLogin = router.url.startsWith('/login') || router.url.startsWith('/auth/');
        if (!onLogin) {
          console.warn('[Auth] 401 detected on', req.url, '-> redirect /login?expired=1');
          auth.clearSession();
          router.navigate(['/login'], { queryParams: { expired: '1' } });
        }
      }
      return throwError(() => err);
    })
  );
};
