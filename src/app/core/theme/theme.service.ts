import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Owns the light / dark / system preference and applies .theme-light / .theme-dark on <html>. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;
  private readonly media = this.view?.matchMedia?.(DARK_QUERY) ?? null;

  private readonly _preference = signal<ThemePreference>(this.readStored());
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = this._preference.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this._preference();
    if (pref === 'system') return this.systemDark() ? 'dark' : 'light';
    return pref;
  });

  constructor() {
    // "system" follows prefers-color-scheme live.
    const onChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));

    effect(() => {
      const theme = this.resolved();
      const root = this.document.documentElement;
      root.classList.remove('theme-light', 'theme-dark');
      root.classList.add(`theme-${theme}`);
      root.style.colorScheme = theme;
    });
  }

  set(preference: ThemePreference): void {
    this._preference.set(preference);
    try {
      this.view?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be unavailable (private mode); the preference still applies for this session.
    }
  }

  private readStored(): ThemePreference {
    try {
      const stored = this.view?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
      return isPreference(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
