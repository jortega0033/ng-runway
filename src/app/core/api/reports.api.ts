import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { toParams } from './http-params';
import type { ReportResult } from './models';

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/reports`;

  get(range: { from?: string; to?: string } = {}): Observable<ReportResult> {
    return this.http.get<ReportResult>(this.base, { params: toParams(range) });
  }
}
