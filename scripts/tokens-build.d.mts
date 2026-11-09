export function parseCss(css: string): {
  root: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
};
export function resolveVar(value: string, maps: Record<string, string>[]): string;
export function resolveRef(json: unknown, value: string): string;
export function cssSemanticColors(
  parsed: ReturnType<typeof parseCss>,
  theme: 'light' | 'dark',
): Record<string, string>;
export function jsonSemanticColors(json: unknown, theme: 'light' | 'dark'): Record<string, string>;
export function build(dir?: string): Record<string, string>;
