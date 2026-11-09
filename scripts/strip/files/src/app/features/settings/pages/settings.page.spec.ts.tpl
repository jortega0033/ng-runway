import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SESSION_STORAGE_KEY } from '@core/auth/auth.service';
import { RELOAD_APP } from '@core/dev/demo-data.service';
import { ThemeService } from '@core/theme/theme.service';
import { ToastService } from '@ui/index';
import { useMockApi } from '../../../testing/msw-test-server';
import settingsEn from '../../../../../public/i18n/settings/en.json';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  const api = useMockApi();
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ...api.providers({ settings: settingsEn }),
        provideRouter([]),
        { provide: RELOAD_APP, useValue: reload },
      ],
    });
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  async function render() {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const buttonByName = (root: ParentNode, name: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);

  it('shows appearance and language to an employee, and nothing else', async () => {
    api.signIn('employee');
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('h1')?.textContent).toContain('Settings');
    expect(root.querySelector('[role="radiogroup"][aria-label="Theme"]')).not.toBeNull();
    expect(root.querySelector('[role="radiogroup"][aria-label="Language"]')).not.toBeNull();
    expect(buttonByName(root, 'Reset demo data')).toBeUndefined();
  });

  it('changes the theme', async () => {
    api.signIn('employee');
    const fixture = await render();
    const dark = Array.from(
      fixture.nativeElement.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>,
    ).find((r) => r.value === 'dark');
    dark?.click();
    fixture.detectChanges();
    expect(TestBed.inject(ThemeService).preference()).toBe('dark');
  });

  it('resets the demo data for an admin after confirmation, then signs out and reloads', async () => {
    api.signIn('admin');
    const resetSpy = vi.spyOn(api.db, 'reset');
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;

    buttonByName(root, 'Reset demo data')?.click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(buttonByName(document.body, 'Reset and sign out')).toBeDefined());
    expect(resetSpy).not.toHaveBeenCalled();

    buttonByName(document.body, 'Reset and sign out')?.click();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());

    expect(resetSpy).toHaveBeenCalledOnce();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.title),
    ).toContain('Demo data reset');
  });

  it('does nothing when the confirmation is cancelled', async () => {
    api.signIn('admin');
    const resetSpy = vi.spyOn(api.db, 'reset');
    const fixture = await render();

    buttonByName(fixture.nativeElement, 'Reset demo data')?.click();
    await vi.waitFor(() => expect(buttonByName(document.body, 'Cancel')).toBeDefined());
    buttonByName(document.body, 'Cancel')?.click();
    await fixture.whenStable();

    expect(resetSpy).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });
});
