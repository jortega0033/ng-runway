import type { UserRole } from '../api/models';
import type { Language } from '../i18n/i18n';
import { navFor } from '../layout/nav-items';
import type { ThemePreference } from '../theme/theme.service';
import type { IconName } from '@ui/icon/icon';

export type CommandGroup = 'navigate' | 'theme' | 'language' | 'account';

export interface PaletteCommand {
  /** Stable id, also used for the DOM id of the option. */
  readonly id: string;
  readonly group: CommandGroup;
  readonly label: string;
  /** Extra words that find the command although they are not in the label. */
  readonly keywords: string;
  readonly icon: IconName;
  readonly run: () => void;
}

/** Everything the commands need from the app. Passing it in keeps `buildCommands` pure. */
export interface CommandEnv {
  role: UserRole | null;
  /** Translates a key of the shared files or the `palette` scope. */
  t: (key: string, params?: Record<string, string>) => string;
  navigate: (link: string) => void;
  setTheme: (preference: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  signOut: () => void;
  resetDemoData: () => void;
}

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const THEME_ICON: Record<ThemePreference, IconName> = {
  light: 'sun',
  dark: 'moon',
  system: 'globe',
};
const LANGUAGES: readonly Language[] = ['en', 'nl'];

/** The commands the current role may use. A signed-out user gets none. */
export function buildCommands(env: CommandEnv): PaletteCommand[] {
  if (!env.role) return [];
  const { t } = env;

  const pages = navFor(env.role, t).flatMap((item) =>
    item.link
      ? [
          {
            id: `go:${item.link}`,
            group: 'navigate' as const,
            label: t('palette.goTo', { page: item.label }),
            keywords: `${item.label} ${item.link.slice(1)} open page`,
            icon: item.icon ?? 'home',
            run: () => env.navigate(item.link as string),
          },
        ]
      : [],
  );

  const themes = THEMES.map<PaletteCommand>((preference) => ({
    id: `theme:${preference}`,
    group: 'theme',
    label: `${t('theme.label')}: ${t(`theme.${preference}`)}`,
    keywords: 'appearance mode colors thema weergave',
    icon: THEME_ICON[preference],
    run: () => env.setTheme(preference),
  }));

  const languages = LANGUAGES.map<PaletteCommand>((language) => ({
    id: `lang:${language}`,
    group: 'language',
    label: `${t('shell.language')}: ${t(`palette.languages.${language}`)}`,
    keywords: 'locale translate taal',
    icon: 'globe',
    run: () => env.setLanguage(language),
  }));

  const account: PaletteCommand[] = [
    {
      id: 'account:sign-out',
      group: 'account',
      label: t('shell.signOut'),
      keywords: 'log out logout uitloggen afmelden',
      icon: 'logout',
      run: () => env.signOut(),
    },
  ];
  if (env.role === 'admin') {
    account.push({
      id: 'account:reset-demo',
      group: 'account',
      label: t('dev.reset'),
      keywords: 'restore seed database herstellen',
      icon: 'trash',
      run: () => env.resetDemoData(),
    });
  }

  return [...pages, ...themes, ...languages, ...account];
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Keeps the commands that match every word of the query (in the label or the keywords).
 * Label hits that start a word rank first; ties keep the original order. An empty query keeps all.
 */
export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];

  const scored: { command: PaletteCommand; score: number; index: number }[] = [];
  commands.forEach((command, index) => {
    const label = normalize(command.label);
    const keywords = normalize(command.keywords);
    let score = 0;
    for (const word of words) {
      if (startsAWord(label, word)) continue;
      if (label.includes(word)) score += 1;
      else if (keywords.includes(word)) score += 2;
      else return;
    }
    scored.push({ command, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.command);
}

/** True when `word` begins a word of the label. */
function startsAWord(label: string, word: string): boolean {
  return label.split(/[^\p{L}\p{N}]+/u).some((part) => part.startsWith(word));
}
