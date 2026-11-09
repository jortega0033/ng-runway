import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { useMockApi } from '../../testing/msw-test-server';
import paletteEn from '../../../../public/i18n/palette/en.json';
import { CommandPaletteComponent } from './command-palette';
import { CommandPaletteTriggerComponent } from './command-palette-trigger';
import { CommandPaletteService } from './command-palette.service';

describe('command palette', () => {
  const api = useMockApi();
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    api.signIn('manager');
    TestBed.configureTestingModule({
      providers: [...api.providers({ palette: paletteEn }), provideRouter([])],
    });
    // The app loads the shared strings at startup; do the same here.
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    TestBed.inject(CommandPaletteService).close();
    TestBed.tick();
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  const combobox = () => document.querySelector<HTMLInputElement>('[role="combobox"]');
  const options = () =>
    Array.from(document.querySelectorAll('[role="option"]')).map((o) =>
      o.querySelector('span.flex-1')?.textContent?.trim(),
    );

  function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    TestBed.tick();
    return event;
  }

  function type(text: string) {
    const input = combobox()!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    TestBed.tick();
  }

  async function mount() {
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('opens on Ctrl+K and prevents the browser default', async () => {
    await mount();
    expect(combobox()).toBeNull();

    const event = press('k', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(combobox()).not.toBeNull());
  });

  it('opens on Cmd+K', async () => {
    await mount();
    press('K', { metaKey: true });
    await vi.waitFor(() => expect(combobox()).not.toBeNull());
  });

  it('ignores a plain K', async () => {
    await mount();
    press('k');
    expect(combobox()).toBeNull();
  });

  it('opens through the service and lists only commands for the role', async () => {
    await mount();
    TestBed.inject(CommandPaletteService).open();
    TestBed.tick();
    await vi.waitFor(() => expect(options().length).toBeGreaterThan(0));

    expect(options()).toContain('Go to Reports');
    expect(options()).not.toContain('Reset demo data');
    const listbox = document.querySelector('[role="listbox"]')!;
    expect(combobox()?.getAttribute('aria-controls')).toBe(listbox.id);
    expect(document.querySelector('[role="status"]')?.textContent).toContain('commands available');
  });

  it('filters while typing and announces the count', async () => {
    await mount();
    TestBed.inject(CommandPaletteService).open();
    TestBed.tick();
    await vi.waitFor(() => expect(combobox()).not.toBeNull());

    type('theme');
    expect(options()).toEqual(['Theme: Light', 'Theme: Dark', 'Theme: System']);
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      '3 commands available',
    );

    type('zzz');
    expect(options()).toEqual([]);
    expect(document.body.textContent).toContain('No commands match your search.');
  });

  it('moves the highlight with the arrow keys and exposes it as aria-activedescendant', async () => {
    await mount();
    TestBed.inject(CommandPaletteService).open();
    TestBed.tick();
    await vi.waitFor(() => expect(combobox()).not.toBeNull());

    const selected = () =>
      document.querySelector('[role="option"][aria-selected="true"]')?.id ?? null;
    const first = selected();
    expect(combobox()?.getAttribute('aria-activedescendant')).toBe(first);

    press('ArrowDown', {}, combobox()!);
    const second = selected();
    expect(second).not.toBe(first);
    expect(combobox()?.getAttribute('aria-activedescendant')).toBe(second);

    press('ArrowUp', {}, combobox()!);
    expect(selected()).toBe(first);
    press('ArrowUp', {}, combobox()!); // wraps to the last option
    expect(selected()).toBe(document.querySelector('[role="option"]:last-child')?.id);
  });

  it('runs the highlighted command on Enter and closes', async () => {
    await mount();
    TestBed.inject(CommandPaletteService).open();
    TestBed.tick();
    await vi.waitFor(() => expect(combobox()).not.toBeNull());

    type('settings');
    press('Enter', {}, combobox()!);

    expect(navigate).toHaveBeenCalledWith('/settings');
    await vi.waitFor(() => expect(combobox()).toBeNull());
    expect(TestBed.inject(CommandPaletteService).isOpen()).toBe(false);
  });

  it('runs a command when it is clicked', async () => {
    await mount();
    TestBed.inject(CommandPaletteService).open();
    TestBed.tick();
    await vi.waitFor(() => expect(combobox()).not.toBeNull());

    type('reports');
    document.querySelector<HTMLElement>('[role="option"]')?.click();
    expect(navigate).toHaveBeenCalledWith('/reports');
  });

  it('closes on Escape without running anything', async () => {
    await mount();
    press('k', { ctrlKey: true });
    await vi.waitFor(() => expect(combobox()).not.toBeNull());

    press('Escape', { keyCode: 27 }, combobox()!);
    await vi.waitFor(() => expect(combobox()).toBeNull());
    expect(TestBed.inject(CommandPaletteService).isOpen()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Ctrl+K again closes it', async () => {
    await mount();
    press('k', { ctrlKey: true });
    await vi.waitFor(() => expect(combobox()).not.toBeNull());
    press('k', { ctrlKey: true }, combobox()!);
    await vi.waitFor(() => expect(combobox()).toBeNull());
  });

  it('opens from the top bar trigger, which has an accessible name and a shortcut hint', async () => {
    await mount();
    const trigger = TestBed.createComponent(CommandPaletteTriggerComponent);
    await trigger.whenStable();
    const button: HTMLButtonElement = trigger.nativeElement.querySelector('button');

    expect(button.getAttribute('aria-label')).toBe('Search and commands');
    expect(button.textContent).toContain('Ctrl K');
    button.click();
    TestBed.tick();
    await vi.waitFor(() => expect(combobox()).not.toBeNull());
  });
});
