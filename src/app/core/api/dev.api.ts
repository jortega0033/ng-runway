import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';

/** Demo-only endpoints served by the mock. A real backend will not have them. */
@Injectable({ providedIn: 'root' })
export class DevApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  resetDemoData(): Observable<null> {
    return this.http.post<null>(`${this.base}/dev/reset`, {});
  }
}
