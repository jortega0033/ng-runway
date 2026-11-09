import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let listeners: ((e: { matches: boolean }) => void)[];
  let systemDark: boolean;

  beforeEach(() => {
    listeners = [];
    systemDark = false;
    localStorage.clear();
    document.documentElement.className = '';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () =>
        ({
          get matches() {
            return systemDark;
          },
          addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
            listeners.push(fn),
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    });
  });

  function create() {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  it('defaults to system and applies the matching class', () => {
    systemDark = true;
    const service = create();
    expect(service.preference()).toBe('system');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('persists an explicit choice under "theme"', () => {
    const service = create();
    service.set('dark');
    TestBed.tick();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
  });

  it('restores the stored preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(create().preference()).toBe('light');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(create().preference()).toBe('system');
  });

  it('follows prefers-color-scheme live while on system', () => {
    const service = create();
    expect(service.resolved()).toBe('light');
    listeners.forEach((fn) => fn({ matches: true }));
    TestBed.tick();
    expect(service.resolved()).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('does not follow the system once a theme is chosen', () => {
    const service = create();
    service.set('light');
    listeners.forEach((fn) => fn({ matches: true }));
    expect(service.resolved()).toBe('light');
  });
});
