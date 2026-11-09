// Small edits to files that STAY in the shell. Each patch takes the current file text and returns
// the new text. Nothing here touches the disk, so strip.mjs can compute every patch first and
// only write when all of them worked.
//
// A patch throws when the text it expects is not there. That is on purpose: if somebody changed
// the file since this script was written, we stop and say so instead of guessing.

/** Replaces `from` with `to` (every occurrence). Throws when `from` is not in the text. */
export function replaceText(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Expected text not found in ${label}:\n  ${from}`);
  return text.split(from).join(to);
}

/** Replaces the first match of a regular expression. Throws when nothing matches. */
export function replaceMatch(text, pattern, to, label) {
  if (!pattern.test(text)) throw new Error(`Expected pattern not found in ${label}: ${pattern}`);
  return text.replace(pattern, to);
}

/** Every patch: the file to change and the function that changes its text. */
export const PATCHES = [
  {
    // The shell had a bell link to the notifications page. That page is gone.
    path: 'src/app/core/layout/shell.ts',
    apply: (text) => {
      let next = replaceMatch(
        text,
        /\n\s*<a\s+routerLink="\/notifications"[\s\S]*?<\/a>/,
        '',
        'shell.ts',
      );
      // The bell was the only icon in this template, so the import would now be unused.
      next = replaceText(
        next,
        "import { IconComponent, type IconName } from '@ui/icon/icon';",
        "import type { IconName } from '@ui/icon/icon';",
        'shell.ts',
      );
      return replaceText(next, '    IconComponent,\n', '', 'shell.ts');
    },
  },
  {
    // A session user no longer has a team or a location.
    path: 'src/app/testing/msw-test-server.ts',
    apply: (text) =>
      replaceText(
        text,
        '          teamId: employee.teamId,\n          locationId: employee.locationId,\n',
        '',
        'msw-test-server.ts',
      ),
  },
  {
    // The palette tests used the Reports page, which is gone. Settings exists for every role.
    path: 'src/app/core/command-palette/command-palette.spec.ts',
    apply: (text) => {
      let next = replaceText(
        text,
        "'Go to Reports'",
        "'Go to Settings'",
        'command-palette.spec.ts',
      );
      next = replaceText(next, "type('reports')", "type('settings')", 'command-palette.spec.ts');
      return replaceText(next, "'/reports'", "'/settings'", 'command-palette.spec.ts');
    },
  },
  {
    path: 'src/app/core/command-palette/commands.spec.ts',
    apply: (text) => {
      const label = 'commands.spec.ts';
      // The role-gating test needs a page that only some roles may open. The shell has none.
      let next = replaceMatch(
        text,
        /  it\('only offers pages the role may open'[\s\S]*?\n  \}\);\n\n(?=  it\('offers resetting)/,
        `  it('offers the pages of the navigation', () => {
    const all = labels(buildCommands(env('employee')));
    expect(all).toEqual(
      expect.arrayContaining(['Go to Home', 'Go to Settings', 'Go to Design system']),
    );
  });

`,
        label,
      );
      next = replaceText(next, "run('Go to Reports')", "run('Go to Settings')", label);
      next = replaceText(next, "'/reports'", "'/settings'", label);
      next = replaceText(
        next,
        "filterCommands(commands, 'SCHED')",
        "filterCommands(commands, 'DESIGN')",
        label,
      );
      return replaceText(next, "['Go to Schedule']", "['Go to Design system']", label);
    },
  },
  {
    // Only the E2E accessibility run lists pages; keep the pages that still exist.
    path: 'e2e/a11y.spec.ts',
    apply: (text) =>
      replaceMatch(
        text,
        /const TARGETS: Target\[\] = \[[\s\S]*?\n\];/,
        `const TARGETS: Target[] = [
  { path: '/login', role: null },
  { path: '/dashboard', role: 'employee' },
  { path: '/items', role: 'employee' },
  { path: '/settings', role: 'employee' },
  { path: '/design-system', role: 'employee' },
];`,
        'a11y.spec.ts',
      ),
  },
  {
    path: 'CLAUDE.md',
    apply: (text) => appendNote(text),
  },
  {
    path: 'AGENTS.md',
    apply: (text) => appendNote(text),
  },
];

const NOTE_MARKER = '## Stripped shell';

/** Adds a short note at the end of the agent files. It is only added once. */
function appendNote(text) {
  if (text.includes(NOTE_MARKER)) return text;
  return `${text.replace(/\s+$/, '')}

${NOTE_MARKER}

This copy was reduced with \`node scripts/strip.mjs\`. The workforce demo (schedule, timesheets, absences, employees, reports, notifications, hours and conflict logic) is gone. What is left: shell, auth with three demo roles, MSW mock plumbing, UI library, design-system page, a Home page (route \`/dashboard\`), Settings and one generated example feature, \`items\`. Mentions of the removed features above and in \`docs/\` are history. The schedule SignalStore (ADR 0002) no longer exists.
`;
}

/** Edits the two shared i18n files (English and Dutch) for the shell that is left. */
export function patchGlobalI18n(text, language) {
  const t = TEXTS[language];
  const json = JSON.parse(text);
  json.nav = { main: t.navMain, home: t.home, settings: t.settings, designSystem: t.designSystem };
  delete json.shell?.notifications;
  json.errors.goHome = t.goHome;
  json.login.adminHint = t.adminHint;
  json.login.managerHint = t.managerHint;
  json.login.employeeHint = t.employeeHint;
  json.home = t.homePage;
  return `${JSON.stringify(json, null, 2)}\n`;
}

const TEXTS = {
  en: {
    navMain: 'Main navigation',
    home: 'Home',
    settings: 'Settings',
    designSystem: 'Design system',
    goHome: 'Back to home',
    adminHint: 'Sees everything and can reset the demo data.',
    managerHint: 'Example of a role with write access.',
    employeeHint: 'Example of a role with the narrowest access.',
    homePage: {
      title: 'Home',
      greeting: 'Welcome, {{ name }}.',
      emptyTitle: 'Nothing here yet',
      emptyText: 'This is the starting point of your app. The Items page is a complete example.',
      openExample: 'Open the Items example',
    },
  },
  nl: {
    navMain: 'Hoofdnavigatie',
    home: 'Home',
    settings: 'Instellingen',
    designSystem: 'Designsysteem',
    goHome: 'Terug naar home',
    adminHint: 'Ziet alles en kan de demodata terugzetten.',
    managerHint: 'Voorbeeld van een rol met schrijfrechten.',
    employeeHint: 'Voorbeeld van een rol met de minste rechten.',
    homePage: {
      title: 'Home',
      greeting: 'Welkom, {{ name }}.',
      emptyTitle: 'Nog niets hier',
      emptyText: 'Dit is het startpunt van je app. De pagina Items is een volledig voorbeeld.',
      openExample: 'Open het voorbeeld Items',
    },
  },
};
