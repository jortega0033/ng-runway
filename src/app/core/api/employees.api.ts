import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { toParams } from './http-params';
import type { Employee, EmployeeInput, EmployeeQuery, Page } from './models';

@Injectable({ providedIn: 'root' })
export class EmployeesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/employees`;

  list(query: EmployeeQuery = {}): Observable<Page<Employee>> {
    return this.http.get<Page<Employee>>(this.base, { params: toParams(query) });
  }

  get(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.base}/${id}`);
  }

  create(input: EmployeeInput): Observable<Employee> {
    return this.http.post<Employee>(this.base, input);
  }

  update(id: string, input: EmployeeInput): Observable<Employee> {
    return this.http.put<Employee>(`${this.base}/${id}`, input);
  }

  remove(id: string): Observable<null> {
    return this.http.delete<null>(`${this.base}/${id}`);
  }
}
