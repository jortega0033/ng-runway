#!/usr/bin/env node
// Scaffolds a feature: model, mock API, API service, list / detail / form pages, routes, i18n
// (English + Dutch) and specs. It also wires the feature into the app.
//
// Usage (from the repo root):
//   node scripts/gen-feature.mjs <name> [--singular <name>] [--dry-run] [--force] [--no-format]
//   npm run gen:feature orders
//
//   <name>        kebab-case plural, for example "orders" or "order-items"
//   --singular    the singular, when the guess is wrong (for example --singular staff-member)
//   --dry-run     print what would be created and edited; write nothing
//   --force       overwrite an existing feature folder; edits that are already there are skipped
//   --no-format   do not run Prettier on the result
//
// Plain Node, no dependencies (only node: built-ins). Works on Windows, macOS and Linux.
//
// How it works, in four steps:
//   1. names.mjs        derives every spelling of the name (Orders, Order, ORDERS, ...)
//   2. templates*.mjs   turn the names into the text of each new file
//   3. edits.mjs        inserts lines at marker comments of files that already exist
//   4. this file        checks everything first, then writes. Nothing is written if a check fails.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { USAGE, parseArgs } from './gen-feature/args.mjs';
import { addMockFeature, addNavItem, addNavLabel, addRoute } from './gen-feature/edits.mjs';
import { deriveNames } from './gen-feature/names.mjs';
import { navLabel } from './gen-feature/templates-i18n.mjs';
import { buildFiles, featureDir } from './gen-feature/templates.mjs';

const FEATURES_FILE = 'src/app/core/mock/features.ts';
const ROUTES_FILE = 'src/app/app.routes.ts';
const NAV_FILE = 'src/app/core/layout/nav-items.ts';
const I18N_EN = 'public/i18n/en.json';
const I18N_NL = 'public/i18n/nl.json';

const read = (path) => readFileSync(path, 'utf8');

/**
 * Lines present in `after` but not in `before`. Our edits only insert lines, so we walk both
 * files together: a line that matches the next old line is unchanged, any other line is new.
 */
function insertedLines(before, after) {
  const old = before.split(/\r?\n/);
  const inserted = [];
  let next = 0;
  for (const line of after.split(/\r?\n/)) {
    if (next < old.length && line.replace(/,$/, '') === old[next].replace(/,$/, '')) next++;
    else inserted.push(line);
  }
  return inserted;
}

/** Works out every edit of existing files without writing anything. */
function planEdits(names) {
  const label = navLabel(names);
  const steps = [
    {
      path: FEATURES_FILE,
      apply: (t) => addMockFeature(t, names, `@features/${names.plural}/mock/${names.plural}.mock`),
    },
    { path: ROUTES_FILE, apply: (t) => addRoute(t, names) },
    { path: NAV_FILE, apply: (t) => addNavItem(t, names) },
    { path: I18N_EN, apply: (t) => addNavLabel(t, names, label) },
    { path: I18N_NL, apply: (t) => addNavLabel(t, names, label) },
  ];
  return steps.map((step) => {
    if (!existsSync(step.path))
      throw new Error(`${step.path} not found. Run this from the repo root.`);
    const before = read(step.path);
    const result = step.apply(before);
    return { path: step.path, before, after: result.text, status: result.status };
  });
}

/** Runs the repo's own Prettier (if installed) so the output always matches the style rules. */
function formatWithPrettier(paths) {
  const bin = join('node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (!existsSync(bin)) {
    console.log('\nPrettier is not installed here, so the files were not formatted.');
    return;
  }
  const run = spawnSync(process.execPath, [bin, '--write', '--log-level', 'warn', ...paths], {
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    console.log(
      `\nPrettier failed (exit ${run.status}). Run it yourself: npx prettier --write ${paths.length} files`,
    );
    if (run.stderr) console.log(run.stderr.trim());
  } else {
    console.log('\nFormatted with Prettier.');
  }
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  const names = deriveNames(options.name, options.singular);

  if (!existsSync('package.json') || !existsSync(FEATURES_FILE)) {
    throw new Error('Run this from the repo root (the folder with package.json).');
  }

  const dir = featureDir(names);
  const files = buildFiles(names);
  const edits = planEdits(names);

  // Safety checks: refuse to touch anything that already exists, unless --force.
  const problems = [];
  if (existsSync(dir) && !options.force) {
    problems.push(`The folder ${dir} already exists.`);
  }
  const existing = files.filter((file) => existsSync(file.path));
  if (existing.length > 0 && !options.force && !existsSync(dir)) {
    problems.push(`Files already exist: ${existing.map((file) => file.path).join(', ')}.`);
  }
  const present = edits.filter((edit) => edit.status === 'present');
  if (present.length > 0 && !options.force) {
    problems.push(
      `Already wired in: ${present.map((edit) => edit.path).join(', ')} (the feature seems to be registered).`,
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `${problems.join('\n')}\nNothing was changed. Use --force to overwrite the files (existing edits are never repeated).`,
    );
  }

  const changed = edits.filter((edit) => edit.status === 'added');
  const prefix = options.dryRun ? '[dry run] ' : '';

  console.log(
    `${prefix}Feature "${names.plural}" (entity ${names.pascalSingular}, singular "${names.singular}")\n`,
  );
  console.log(`${prefix}Files to create (${files.length}):`);
  for (const file of files) {
    const lines = file.content.split('\n').length - 1;
    console.log(`  + ${file.path}${existsSync(file.path) ? ' (overwrite)' : ''}  [${lines} lines]`);
  }
  console.log(`\n${prefix}Edits to existing files:`);
  for (const edit of edits) {
    if (edit.status === 'present') {
      console.log(`  = ${edit.path}  (already has it, skipped)`);
      continue;
    }
    console.log(`  ~ ${edit.path}`);
    for (const line of insertedLines(edit.before, edit.after))
      console.log(`      + ${line.trim()}`);
  }

  if (options.dryRun) {
    console.log('\n[dry run] Nothing was written.');
    return 0;
  }

  for (const file of files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
  }
  for (const edit of changed) writeFileSync(edit.path, edit.after);

  if (options.format) {
    const formatTargets = [
      ...files.filter((file) => /\.(ts|json)$/.test(file.path)).map((file) => file.path),
      ...changed.filter((edit) => edit.path.endsWith('.ts')).map((edit) => edit.path),
    ];
    formatWithPrettier(formatTargets);
  }

  console.log(`
Done. Next steps:
  1. npx ng test --watch=false --include='${dir}/**/*.spec.ts'
  2. npm run lint && npm run typecheck
  3. npm start, sign in as the manager and open "${names.title}" in the sidebar (route /${names.plural}).
  4. Replace the example fields (name, owner, status, amount) in ${names.plural}.model.ts, the mock,
     the form rules, the pages and public/i18n/${names.plural}/*.json with your own.
  5. To remove the mock backend, delete its line in ${FEATURES_FILE}.
  Dutch texts: the sidebar label "${navLabel(names)}" is the same in both languages; adjust nl.json if needed.`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`\ngen:feature failed: ${error.message}`);
  process.exitCode = 1;
}
