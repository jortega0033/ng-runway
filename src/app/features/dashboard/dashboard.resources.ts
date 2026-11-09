import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '@core/api/api-config';

type ParamValue = string | number | boolean | undefined;

export interface ApiRequest {
  /** Path below the API root, for example `/shifts`. */
  path: string;
  params?: Record<string, ParamValue>;
}

/**
 * A signal-based read of the mock API. The `request` function is reactive: when a signal it
 * reads changes, the resource fetches again (and cancels the request in flight). Return
 * `undefined` to stay idle, for example while nobody is signed in. Empty params are left out.
 *
 * Call it in an injection context, such as a field initialiser. Every dashboard card uses this
 * instead of the `*Api` services, to show the `httpResource` approach next to the RxJS one
 * on the employees list.
 */
export function apiResource<T>(
  request: () => ApiRequest | undefined,
  defaultValue: T,
): HttpResourceRef<T> {
  const base = inject(API_BASE_URL);
  return httpResource<T>(
    () => {
      const next = request();
      if (!next) return undefined;
      const params: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(next.params ?? {})) {
        if (value !== undefined && value !== '') params[key] = value;
      }
      return { url: `${base}${next.path}`, params };
    },
    { defaultValue },
  );
}
