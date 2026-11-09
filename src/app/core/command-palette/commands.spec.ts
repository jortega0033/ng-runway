import globalEn from '../../../../public/i18n/en.json';
import paletteEn from '../../../../public/i18n/palette/en.json';
import type { UserRole } from '../api/models';
import { buildCommands, filterCommands, type CommandEnv, type PaletteCommand } from './commands';

const strings: Record<string, unknown> = { ...globalEn, palette: paletteEn };

/** Looks keys up in the real English files and fills `{{param}}`. */
function t(key: string, params?: Record<string, string | number>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      strings,
    );
  if (typeof value !== 'string') throw new Error(`Missing translation ${key}`);
  return value.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params?.[name] ?? ''));
}

function env(role: UserRole | null, overrides: Partial<CommandEnv> = {}): CommandEnv {
  return {
    role,
    t,
    navigate: vi.fn(),
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
    signOut: vi.fn(),
    resetDemoData: vi.fn(),
    ...overrides,
  };
}

const labels = (commands: readonly PaletteCommand[]) => commands.map((c) => c.label);

describe('buildCommands', () => {
  it('returns nothing when nobody is signed in', () => {
    expect(buildCommands(env(null))).toEqual([]);
  });

  it('only offers pages the role may open', () => {
    const employee = labels(buildCommands(env('employee')));
    expect(employee).toContain('Go to Schedule');
    expect(employee).toContain('Go to Settings');
    expect(employee).not.toContain('Go to Reports');
    expect(employee).not.toContain('Go to Employees');

    const manager = labels(buildCommands(env('manager')));
    expect(manager).toContain('Go to Reports');
    expect(manager).toContain('Go to Employees');
  });

  it('offers resetting the demo data to admins only', () => {
    expect(labels(buildCommands(env('admin')))).toContain('Reset demo data');
    expect(labels(buildCommands(env('manager')))).not.toContain('Reset demo data');
    expect(labels(buildCommands(env('employee')))).not.toContain('Reset demo data');
  });

  it('has theme, language and sign-out commands for everyone', () => {
    const all = labels(buildCommands(env('employee')));
    expect(all).toEqual(
      expect.arrayContaining([
        'Theme: Light',
        'Theme: Dark',
        'Theme: System',
        'Language: English',
        'Language: Nederlands',
        'Sign out',
      ]),
    );
  });

  it('wires every command to the matching action', () => {
    const e = env('admin');
    const commands = buildCommands(e);
    const run = (label: string) => commands.find((c) => c.label === label)?.run();

    run('Go to Reports');
    run('Theme: Dark');
    run('Language: Nederlands');
    run('Sign out');
    run('Reset demo data');

    expect(e.navigate).toHaveBeenCalledWith('/reports');
    expect(e.setTheme).toHaveBeenCalledWith('dark');
    expect(e.setLanguage).toHaveBeenCalledWith('nl');
    expect(e.signOut).toHaveBeenCalledOnce();
    expect(e.resetDemoData).toHaveBeenCalledOnce();
  });

  it('gives every command a unique id', () => {
    const ids = buildCommands(env('admin')).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('filterCommands', () => {
  const commands = buildCommands(env('admin'));

  it('keeps everything for an empty query', () => {
    expect(filterCommands(commands, '  ')).toHaveLength(commands.length);
  });

  it('matches case-insensitively on the label', () => {
    expect(labels(filterCommands(commands, 'SCHED'))).toEqual(['Go to Schedule']);
  });

  it('needs every word of the query to match', () => {
    expect(labels(filterCommands(commands, 'theme dark'))).toEqual(['Theme: Dark']);
    expect(filterCommands(commands, 'theme banana')).toEqual([]);
  });

  it('finds commands through their keywords', () => {
    expect(labels(filterCommands(commands, 'logout'))).toEqual(['Sign out']);
    expect(labels(filterCommands(commands, 'uitloggen'))).toEqual(['Sign out']);
  });

  it('ignores accents', () => {
    expect(labels(filterCommands(commands, 'nederlánds'))).toEqual(['Language: Nederlands']);
  });

  it('ranks matches at the start of a word before matches inside a word', () => {
    // "set" starts a word in "Settings" but is inside "Reset demo data".
    const result = labels(filterCommands(commands, 'set'));
    expect(result.indexOf('Go to Settings')).toBeLessThan(result.indexOf('Reset demo data'));
  });
});
