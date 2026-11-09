import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { toParams } from './http-params';
import type { Shift, ShiftInput } from './models';

export interface ShiftQuery {
  from?: string;
  to?: string;
  teamId?: string;
  locationId?: string;
  employeeId?: string;
}

export interface WeekScope {
  teamId?: string;
  locationId?: string;
}

@Injectable({ providedIn: 'root' })
export class ShiftsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/shifts`;

  list(query: ShiftQuery = {}): Observable<Shift[]> {
    return this.http.get<Shift[]>(this.base, { params: toParams(query) });
  }

  create(input: ShiftInput): Observable<Shift> {
    return this.http.post<Shift>(this.base, input);
  }

  update(id: string, input: ShiftInput): Observable<Shift> {
    return this.http.put<Shift>(`${this.base}/${id}`, input);
  }

  remove(id: string): Observable<null> {
    return this.http.delete<null>(`${this.base}/${id}`);
  }

  publish(range: { from: string; to: string } & WeekScope): Observable<{ published: number }> {
    return this.http.post<{ published: number }>(`${this.base}/publish`, range);
  }

  copyWeek(request: { fromWeek: string; toWeek: string } & WeekScope): Observable<Shift[]> {
    return this.http.post<Shift[]>(`${this.base}/copy-week`, request);
  }
}
