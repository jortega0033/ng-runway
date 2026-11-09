import { resolve } from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { UsageError } from '../lib/errors.mjs';
import { copyFiles, reportCopy } from '../lib/files.mjs';
import { docFiles, tokenFiles, uiFiles } from '../manifest.mjs';

// What the host project must provide. Printed after every `ui` run.
const REQUIREMENTS = [
  'The UI library was copied as it is. It expects the host project to have:',
  '  - Angular 22 (components use signal inputs: input(), model(), output()).',
  '  - Tailwind v4 with the tokens imported in your global stylesheet, as in this repo:',
  "      @import '../tokens/tokens.css';",
  "      @import 'tailwindcss';",
  "      @import '../tokens/tailwind-theme.css';",
  '  - @angular/cdk and @angular/aria installed (overlay, dialog, portal, scrolling, combobox, listbox, tabs).',
  '  - date-fns installed (date picker).',
  '  - A path alias "@ui/*" -> "src/app/ui/*" in tsconfig.json "paths".',
  '  - Charts also import "@tokens" -> "tokens/tokens.ts" and "@core/theme/theme.service";',
  '    add the "@tokens" alias and a ThemeService, or leave the chart folder out.',
  'See docs/adapting.md in the ng-runway repo for older Angular versions.',
];

// ng-runway ui [dir] [--force] [--tokens <dir>] [--docs] [--docs-dir <dir>]
// Copies src/app/ui (without *.spec.ts) into dir (default ./src/app/ui) and the tokens into ./tokens.
export function run(argv, ctx) {
  const { positionals, flags } = parseArgs(argv, {
    booleans: ['force', 'docs'],
    strings: ['tokens', 'docs-dir'],
  });
  if (positionals.length > 1) throw new UsageError('ui takes at most one directory.');

  const force = Boolean(flags.force);
  const uiTarget = resolve(ctx.cwd, positionals[0] ?? 'src/app/ui');
  const tokensTarget = resolve(ctx.cwd, flags.tokens ?? 'tokens');

  const ui = copyFiles(resolve(ctx.root, 'src/app/ui'), uiFiles(ctx.root), uiTarget, force);
  reportCopy(ctx.log, ui, `UI library into ${uiTarget}`);

  const tokens = copyFiles(resolve(ctx.root, 'tokens'), tokenFiles('all'), tokensTarget, force);
  reportCopy(ctx.log, tokens, `Tokens into ${tokensTarget}`);

  if (flags.docs) {
    const docsTarget = resolve(ctx.cwd, flags['docs-dir'] ?? 'docs/components');
    const docs = copyFiles(
      resolve(ctx.root, 'docs/components'),
      docFiles(ctx.root),
      docsTarget,
      force,
    );
    reportCopy(ctx.log, docs, `Component docs into ${docsTarget}`);
  }

  ctx.log('');
  for (const line of REQUIREMENTS) ctx.log(line);
  return 0;
}
