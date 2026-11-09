import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, cssSemanticColors, jsonSemanticColors, parseCss } from '../../scripts/tokens-build.mjs';

const dir = join(process.cwd(), 'tokens');
const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const parsed = parseCss(read('tokens.css'));
const json = JSON.parse(read('tokens.json'));

describe('design tokens', () => {
  it('defines the same semantic tokens in both themes', () => {
    const light = Object.keys(cssSemanticColors(parsed, 'light')).sort();
    const dark = Object.keys(cssSemanticColors(parsed, 'dark')).sort();
    expect(light).toEqual(dark);
    expect(light.length).toBeGreaterThan(100);
  });

  it.each(['light', 'dark'] as const)('tokens.css matches tokens.json (%s colors)', (theme) => {
    expect(cssSemanticColors(parsed, theme)).toEqual(jsonSemanticColors(json, theme));
  });

  it('matches non-color scales between css and json', () => {
    const flat = (group: Record<string, { $value: string }>, prefix: string) =>
      Object.fromEntries(Object.entries(group).map(([k, v]) => [`${prefix}${k}`, v.$value]));
    const expected = {
      ...flat(json.spacing, '--spacing-'),
      ...flat(json.radius, '--radius-'),
    };
    delete (expected as Record<string, string>)['--spacing-unit'];
    for (const [name, value] of Object.entries(expected)) {
      const cssName = name.startsWith('--radius-') && !(name in parsed.root) ? name.replace('--radius-', '--border-radius-') : name;
      expect(parsed.root[cssName], cssName).toBe(value);
    }
  });

  it('keeps generated files current', () => {
    const generated = build(dir);
    for (const [file, content] of Object.entries(generated)) {
      expect(read(file), `${file} is stale: run npm run tokens:build`).toBe(content);
    }
  });

  it('never uses raw palette primitives in tailwind theme utilities', () => {
    expect(read('tailwind-theme.css')).not.toMatch(/--color-[\w-]+:\s*var\(--palette-/);
  });
});
