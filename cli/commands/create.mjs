import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { CliError, UsageError } from '../lib/errors.mjs';
import { copyFiles } from '../lib/files.mjs';
import { renameAngularJson, renameLockJson, renamePackageJson, toKebab } from '../lib/rename.mjs';
import { createFiles } from '../manifest.mjs';

// Runs a command in the new project and shows its output.
// On Windows npm is a .cmd file, which only starts through a shell.
function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

// Reads a file of the new project, transforms its text and writes it back.
function rewrite(target, name, transform) {
  const file = join(target, name);
  if (existsSync(file)) writeFileSync(file, transform(readFileSync(file, 'utf8')));
}

// ng-runway create <app-name> [--no-install] [--no-git]
export function run(argv, ctx) {
  const { positionals, flags } = parseArgs(argv, { booleans: ['no-install', 'no-git'] });
  if (positionals.length !== 1) throw new UsageError('create needs exactly one app name.');

  const target = resolve(ctx.cwd, positionals[0]);
  const appName = toKebab(basename(target));
  if (!appName) throw new UsageError(`"${positionals[0]}" is not a usable app name.`);

  // Never write into a folder that already has content.
  if (existsSync(target)) {
    if (!statSync(target).isDirectory() || readdirSync(target).length > 0) {
      throw new CliError(
        `${target} already exists and is not an empty directory. Nothing was changed.`,
      );
    }
  }

  const oldName = JSON.parse(readFileSync(join(ctx.root, 'package.json'), 'utf8')).name;

  ctx.log(`Creating ${appName} in ${target} ...`);
  try {
    mkdirSync(target, { recursive: true });
    copyFiles(ctx.root, createFiles(ctx.root), target);
    rewrite(target, 'package.json', (text) => renamePackageJson(text, appName));
    rewrite(target, 'angular.json', (text) => renameAngularJson(text, oldName, appName));
    rewrite(target, 'package-lock.json', (text) => renameLockJson(text, appName));
  } catch (error) {
    // Do not leave a half-built project behind.
    rmSync(target, { recursive: true, force: true });
    throw new CliError(`Could not create the project: ${error.message}`);
  }
  ctx.log('Files copied and renamed.');

  const problems = [];

  if (!flags['no-git']) {
    if (runCommand('git', ['init', '-b', 'main'], target))
      ctx.log('Git repository created (branch main).');
    else problems.push('git init failed. Run it yourself: git init -b main');
  }

  if (!flags['no-install']) {
    ctx.log('Installing dependencies (npm ci --ignore-scripts) ...');
    if (!runCommand('npm', ['ci', '--ignore-scripts'], target)) {
      problems.push('npm ci failed. Fix the error above, then run: npm ci --ignore-scripts');
    }
  }

  ctx.log('');
  for (const problem of problems) ctx.log(`WARNING: ${problem}`);
  ctx.log('Next steps:');
  ctx.log(`  cd ${positionals[0]}`);
  if (flags['no-install']) ctx.log('  npm ci --ignore-scripts');
  if (!flags['no-git']) ctx.log('  npm run hooks:install   (sets up Husky git hooks)');
  ctx.log('  npm start               (dev server on http://localhost:4200)');
  return problems.length > 0 ? 1 : 0;
}
