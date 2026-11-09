import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { toParams } from './http-params';
import type { AbsenceBalance, AbsenceRequest, AbsenceRequestInput, AbsenceStatus } from './models';

export interface AbsenceQuery {
  from?: string;
  to?: string;
  employeeId?: string;
  teamId?: string;
  status?: AbsenceStatus;
}

@Injectable({ providedIn: 'root' })
export class AbsencesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/absences`;

  list(query: AbsenceQuery = {}): Observable<AbsenceRequest[]> {
    return this.http.get<AbsenceRequest[]>(this.base, { params: toParams(query) });
  }

  balances(employeeId?: string, year?: number): Observable<AbsenceBalance[]> {
    return this.http.get<AbsenceBalance[]>(`${this.base}/balances`, {
      params: toParams({ employeeId, year }),
    });
  }

  create(input: AbsenceRequestInput): Observable<AbsenceRequest> {
    return this.http.post<AbsenceRequest>(this.base, input);
  }

  review(id: string, status: 'approved' | 'rejected', comment = ''): Observable<AbsenceRequest> {
    return this.http.post<AbsenceRequest>(`${this.base}/${id}/review`, { status, comment });
  }
}
