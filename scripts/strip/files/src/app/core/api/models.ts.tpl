/**
 * API contract. The mock handlers and the Angular services both use these types,
 * so the compiler keeps them in sync. Add your own types below the shared ones.
 */

export type UserRole = 'admin' | 'manager' | 'employee';

/** A person who can sign in. The mock keeps one per demo role. */
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userRole: UserRole;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortDirection = 'asc' | 'desc';

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: SortDirection;
  q?: string;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
}
