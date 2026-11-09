#!/usr/bin/env node
// Turns the workforce demo into a clean shell that still lints, tests and builds.
//
// Usage (from the repo root):
//   node scripts/strip.mjs [--dry-run] [--yes] [--no-format]
//   npm run strip -- --dry-run
//
//   --dry-run    print what would be deleted, replaced and edited; write nothing
//   --yes        do not ask for confirmation (needed when there is no terminal)
//   --no-format  do not run Prettier on the result
//
// DESTRUCTIVE: it deletes the demo features. Commit (or stash) first so you can get them back
// with git. Plain Node, no dependencies (only node: built-ins).
//
// What stays: layout and shell, navigation, auth with the three demo roles, the MSW mock
// plumbing, API plumbing and interceptors, i18n, theme, command palette, dev toolbar, the UI
// library, the design-system page, tokens, docs/adr, CI and the e2e setup.
//
// What goes: schedule, timesheets, absences, employees, reports, notifications and the
// dashboard; the hours / conflicts / balances logic; their API services, seed data, handlers,
// translations and e2e specs.
//
// How it works, in five steps:
//   1. check       refuse when this is not the repo root, or when it was stripped before
//   2. plan        work out every delete, new file and edit in memory (nothing is written yet)
//   3. confirm     show the plan and ask (unless --yes)
//   4. apply       delete, write, edit; then run gen-feature to add the "items" example
//   5. format      run the repo's own Prettier over what we touched
//
// Where things are:
//   strip/files/    the NEW files, as plain text. The path below files/ is the path in the repo,
//                   with ".tpl" added so ESLint, tsc and Prettier ignore them here.
//   strip/patches.mjs  small edits to files that stay (shell, specs, i18n, agent notes)
//   strip/args.mjs     command line flags
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { USAGE, parseArgs } from './strip/args.mjs';
import { PATCHES, patchGlobalI18n } from './strip/patches.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES_DIR = join(HERE, 'strip', 'files');

/** The feature that gen-feature creates as the example of a full list / detail / form. */
const EXAMPLE_FEATURE = 'items';

/** Features that stay (their files are replaced by the ones in strip/files). */
const KEEP_FEATURES = new Set(['settings']);
/** E2E specs that stay: tokens is generic, a11y and roles are rewritten for the shell. */
const KEEP_E2E = new Set(['tokens.spec.ts', 'a11y.spec.ts', 'roles.spec.ts']);

/** Files in core/ that only the demo features used. (core/domain/time.ts stays: the mock uses it.) */
const DELETE_FILES = [
  'src/app/core/domain/balances.ts',
  'src/app/core/domain/conflicts.ts',
  'src/app/core/domain/hours.ts',
  'src/app/core/domain/domain.spec.ts',
  'src/app/core/api/absences.api.ts',
  'src/app/core/api/clock.api.ts',
  'src/app/core/api/employees.api.ts',
  'src/app/core/api/lookups.api.ts',
  'src/app/core/api/notifications.api.ts',
  'src/app/core/api/reports.api.ts',
  'src/app/core/api/shifts.api.ts',
];

const GLOBAL_I18N = ['public/i18n/en.json', 'public/i18n/nl.json'];

const exists = (path) => existsSync(path);
const read = (path) => readFileSync(path, 'utf8');
const subfolders = (dir) =>
  exists(dir) ? readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()) : [];

/** Step 1: is this the right folder, and is there still something to strip? */
function check() {
  if (!exists('package.json') || !exists('src/app/core/mock/handlers.ts')) {
    throw new Error('Run this from the repo root (the folder with package.json).');
  }
  if (!exists(join(FILES_DIR, 'src/app/core/mock/handlers.ts.tpl'))) {
    throw new Error('scripts/strip/files is missing or incomplete. Restore it from git.');
  }
  if (exists('src/app/features/home') || !exists('src/app/core/domain/hours.ts')) {
    throw new Error(
      'This copy looks stripped already (src/app/features/home exists or core/domain/hours.ts is gone).\nNothing was changed. To start over, restore the files with git.',
    );
  }
}

/** All files under a folder, as paths relative to it, with forward slashes. */
function listFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...listFiles(full));
    else found.push(full);
  }
  return found;
}

/** Step 2a: everything that gets deleted. Folders are deleted with all their content. */
function planDeletes() {
  const paths = [];
  for (const name of subfolders('src/app/features')) {
    if (!KEEP_FEATURES.has(name)) paths.push(`src/app/features/${name}`);
  }
  // Translation scopes: one folder per feature, plus the palette scope which stays.
  const keepScopes = new Set([...KEEP_FEATURES, 'palette']);
  for (const name of subfolders('public/i18n')) {
    if (!keepScopes.has(name)) paths.push(`public/i18n/${name}`);
  }
  for (const file of exists('e2e') ? readdirSync('e2e') : []) {
    if (file.endsWith('.spec.ts') && !KEEP_E2E.has(file)) paths.push(`e2e/${file}`);
  }
  paths.push(...DELETE_FILES.filter(exists));
  return paths;
}

/** Step 2b: the new files from strip/files. */
function planWrites() {
  return listFiles(FILES_DIR).map((full) => ({
    path: relative(FILES_DIR, full)
      .split('\\')
      .join('/')
      .replace(/\.tpl$/, ''),
    content: readFileSync(full, 'utf8'),
  }));
}

/** Step 2c: edits of files that stay. Throws (before anything is written) when one cannot apply. */
function planEdits() {
  const edits = PATCHES.map((patch) => {
    if (!exists(patch.path)) throw new Error(`${patch.path} not found, cannot edit it.`);
    return { path: patch.path, content: patch.apply(read(patch.path)) };
  });
  for (const path of GLOBAL_I18N) {
    const language = path.endsWith('nl.json') ? 'nl' : 'en';
    edits.push({ path, content: patchGlobalI18n(read(path), language) });
  }
  return edits;
}

/** Runs the repo's own Prettier (if installed) so the output matches the style rules. */
function formatWithPrettier(paths) {
  const bin = join('node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (!exists(bin)) {
    console.log('\nPrettier is not installed here, so the files were not formatted.');
    return;
  }
  const targets = paths.filter((path) => /\.(ts|json|md)$/.test(path) && exists(path));
  const run = spawnSync(process.execPath, [bin, '--write', '--log-level', 'warn', ...targets], {
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    console.log(`\nPrettier failed (exit ${run.status}). Run it yourself: npx prettier --write .`);
    if (run.stderr) console.log(run.stderr.trim());
  } else {
    console.log('\nFormatted with Prettier.');
  }
}

async function confirm() {
  if (!process.stdin.isTTY) {
    throw new Error('This deletes files, so it needs a yes. Run it in a terminal, or pass --yes.');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nDelete the demo and continue? Type "yes" to go on: ');
  rl.close();
  return answer.trim().toLowerCase() === 'yes';
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  check();
  const deletes = planDeletes();
  const writes = planWrites();
  const edits = planEdits();
  const prefix = options.dryRun ? '[dry run] ' : '';

  console.log(`${prefix}Strip the workforce demo down to the shell.\n`);
  console.log(`${prefix}Delete (${deletes.length}):`);
  for (const path of deletes) console.log(`  - ${path}`);
  console.log(`\n${prefix}Write new or replaced files (${writes.length}):`);
  for (const file of writes) {
    console.log(`  + ${file.path}${exists(file.path) ? ' (replaces the demo version)' : ''}`);
  }
  console.log(`\n${prefix}Edit files that stay (${edits.length}):`);
  for (const edit of edits) console.log(`  ~ ${edit.path}`);
  console.log(`\n${prefix}Then run: node scripts/gen-feature.mjs ${EXAMPLE_FEATURE}`);

  if (options.dryRun) {
    console.log('\n[dry run] Nothing was written.');
    return 0;
  }
  if (!options.yes && !(await confirm())) {
    console.log('Cancelled. Nothing was changed.');
    return 1;
  }

  for (const path of deletes) rmSync(path, { recursive: true, force: true });
  for (const file of [...writes, ...edits]) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
  }

  console.log(`\nAdding the example feature "${EXAMPLE_FEATURE}" with gen-feature ...`);
  const generated = spawnSync(
    process.execPath,
    [
      join('scripts', 'gen-feature.mjs'),
      EXAMPLE_FEATURE,
      ...(options.format ? [] : ['--no-format']),
    ],
    { stdio: 'inherit' },
  );
  if (generated.status !== 0) {
    throw new Error(
      `gen-feature failed. The demo is already removed; run "node scripts/gen-feature.mjs ${EXAMPLE_FEATURE}" yourself after fixing the cause (or restore with git).`,
    );
  }

  if (options.format) formatWithPrettier([...writes, ...edits].map((file) => file.path));

  console.log(`
Done. The demo is now a shell. Next steps:
  1. npm run lint && npm run format:check && npm run typecheck
  2. npm test -- --watch=false && npm run build
  3. npm start, sign in and look at Home, Items, Settings and Design system.
  4. Add your own features with: npm run gen:feature <name>
  (scripts/strip.mjs and scripts/strip/ are no longer needed; delete them if you like.)`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`\nstrip failed: ${error.message}`);
    process.exitCode = 1;
  });
