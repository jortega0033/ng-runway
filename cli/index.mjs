#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run as create } from './commands/create.mjs';
import { run as tokens } from './commands/tokens.mjs';
import { run as ui } from './commands/ui.mjs';
import { CliError, UsageError } from './lib/errors.mjs';
import { PACKAGE_ROOT } from './lib/paths.mjs';

const COMMANDS = { tokens, ui, create };

const HELP = `ng-runway: copy the ng-runway design tokens, UI library or full app.

Usage: npx github:jortega0033/ng-runway#v1.0.0 <command> [options]

Commands:
  tokens [dir] [--format css|json|tailwind|ts|all] [--force]
      Copy token files into dir (default ./tokens). Default format: all.
  ui [dir] [--force] [--tokens <dir>] [--docs] [--docs-dir <dir>]
      Copy the UI library (default ./src/app/ui) and the tokens (default ./tokens).
      --docs also copies the component docs (default ./docs/components).
  create <app-name> [--no-install] [--no-git]
      Create a new app from the full boilerplate, then git init and npm ci.

Options:
  --force       Overwrite files that already exist (never done by default)
  -h, --help    Show this help
  -v, --version Show the version

Exit codes: 0 success, 1 failure, 2 wrong usage.`;

// Runs the CLI and returns the exit code. Output goes through ctx so tests can capture it.
export function main(argv, ctx = {}) {
  const context = {
    cwd: process.cwd(),
    root: PACKAGE_ROOT,
    log: console.log,
    ...ctx,
  };
  const [command, ...rest] = argv;

  try {
    if (!command || command === '--help' || command === '-h' || command === 'help') {
      context.log(HELP);
      return 0;
    }
    if (command === '--version' || command === '-v') {
      context.log(JSON.parse(readFileSync(join(context.root, 'package.json'), 'utf8')).version);
      return 0;
    }
    if (rest.includes('--help') || rest.includes('-h')) {
      context.log(HELP);
      return 0;
    }
    if (!Object.hasOwn(COMMANDS, command)) {
      throw new UsageError(`Unknown command: ${command}`);
    }
    return COMMANDS[command](rest, context);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${error.message}\nRun "ng-runway --help" for usage.`);
      return 2;
    }
    if (error instanceof CliError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

// Only run when started from the command line, not when a test imports this file.
// realpathSync matters: npx starts us through a symlink, while import.meta.url is the real path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
