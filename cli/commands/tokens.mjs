import { resolve } from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { UsageError } from '../lib/errors.mjs';
import { copyFiles, reportCopy } from '../lib/files.mjs';
import { TOKEN_FORMATS, tokenFiles } from '../manifest.mjs';

// ng-runway tokens [dir] [--format css|json|tailwind|ts|all] [--force]
// Copies design token files from the package's tokens/ folder into dir (default ./tokens).
export function run(argv, ctx) {
  const { positionals, flags } = parseArgs(argv, { booleans: ['force'], strings: ['format'] });
  if (positionals.length > 1) throw new UsageError('tokens takes at most one directory.');

  const format = flags.format ?? 'all';
  if (!TOKEN_FORMATS.includes(format)) {
    throw new UsageError(`Unknown format "${format}". Use one of: ${TOKEN_FORMATS.join(', ')}.`);
  }

  const target = resolve(ctx.cwd, positionals[0] ?? 'tokens');
  const result = copyFiles(
    resolve(ctx.root, 'tokens'),
    tokenFiles(format),
    target,
    Boolean(flags.force),
  );

  reportCopy(ctx.log, result, `Tokens (${format}) into ${target}`);
  return 0;
}
