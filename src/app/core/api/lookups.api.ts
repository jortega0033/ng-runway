import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import type { AbsenceType, Location, ShiftTemplate, Team } from './models';

/** Small reference lists that every screen needs. */
@Injectable({ providedIn: 'root' })
export class LookupsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  locations(): Observable<Location[]> {
    return this.http.get<Location[]>(`${this.base}/locations`);
  }

  teams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.base}/teams`);
  }

  absenceTypes(): Observable<AbsenceType[]> {
    return this.http.get<AbsenceType[]>(`${this.base}/absence-types`);
  }

  shiftTemplates(): Observable<ShiftTemplate[]> {
    return this.http.get<ShiftTemplate[]>(`${this.base}/shift-templates`);
  }
}
