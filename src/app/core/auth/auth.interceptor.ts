import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../api/api-config';
import { AuthService } from './auth.service';

/** Adds the bearer token to calls to our own API only, never to other hosts. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  const base = inject(API_BASE_URL).replace(/\/$/, '');
  // Match "<base>/..." exactly, so a host like api.example.com.evil.net never gets the token.
  const isOurApi =
    req.url === base || req.url.startsWith(`${base}/`) || req.url.startsWith(`${base}?`);
  if (!token || !isOurApi) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
