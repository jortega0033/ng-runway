import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap, type Observable } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import type { LoginResponse, SessionUser, UserRole } from '../api/models';

export const SESSION_STORAGE_KEY = 'ng-runway.session';

function readSession(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse) : null;
  } catch {
    return null;
  }
}

/** Who is signed in. The token is a mock string; a real backend would issue a real one. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = inject(API_BASE_URL);
  private readonly session = signal<LoginResponse | null>(readSession());

  readonly user = computed<SessionUser | null>(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly role = computed<UserRole | null>(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isManager = computed(() => this.role() === 'admin' || this.role() === 'manager');

  /** Picks one of the demo users by role. */
  login(role: UserRole): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, { role }).pipe(
      tap((response) => {
        this.session.set(response);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(response));
      }),
    );
  }

  logout(redirect = true): void {
    this.session.set(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    if (redirect) void this.router.navigateByUrl('/login');
  }

  hasRole(roles: readonly UserRole[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }
}
