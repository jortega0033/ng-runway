// Run with: node --test cli
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { main } from './index.mjs';
import { PACKAGE_ROOT } from './lib/paths.mjs';
import { CREATE_REQUIRED, createFiles, docFiles, tokenFiles, uiFiles } from './manifest.mjs';

let sandbox;
before(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'ng-runway-cli-'));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

// Runs the CLI inside the sandbox and captures what it prints.
function runCli(args) {
  const lines = [];
  const code = main(args, { cwd: sandbox, log: (line) => lines.push(line) });
  return { code, output: lines.join('\n') };
}

const silenceErrors = (fn) => {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
};

describe('manifest', () => {
  test('every required create entry exists in the package', () => {
    for (const entry of CREATE_REQUIRED) {
      assert.ok(existsSync(join(PACKAGE_ROOT, entry)), `${entry} is missing`);
    }
  });

  test('create list has package.json and src, and never cli, drills or node_modules', () => {
    const files = createFiles();
    assert.ok(files.includes('package.json'));
    assert.ok(files.includes('src/main.ts'));
    assert.ok(files.includes('tokens/tokens.css'));
    assert.ok(!files.some((f) => /^(cli|drills|node_modules|dist|\.angular|\.git)\//.test(f)));
    assert.ok(!files.some((f) => f.startsWith('.husky/_')));
  });

  test('token formats map to existing files', () => {
    assert.deepEqual(tokenFiles('css'), ['tokens.css']);
    assert.equal(tokenFiles('all').length, 4);
    for (const file of tokenFiles('all')) assert.ok(existsSync(join(PACKAGE_ROOT, 'tokens', file)));
    assert.throws(() => tokenFiles('nope'));
  });

  test('ui list excludes spec files and keeps the barrel and components', () => {
    const files = uiFiles();
    assert.ok(files.length > 0);
    assert.ok(!files.some((f) => f.endsWith('.spec.ts')));
    assert.ok(files.includes('index.ts'));
    assert.ok(files.includes('button/button.ts'));
  });

  test('doc list contains markdown only', () => {
    const files = docFiles();
    assert.ok(files.length > 0);
    assert.ok(files.every((f) => f.endsWith('.md')));
  });
});

describe('tokens command', () => {
  test('copies one format', () => {
    const { code } = runCli(['tokens', 'only-css', '--format', 'css']);
    assert.equal(code, 0);
    assert.ok(existsSync(join(sandbox, 'only-css', 'tokens.css')));
    assert.ok(!existsSync(join(sandbox, 'only-css', 'tokens.json')));
  });

  test('copies everything by default and never overwrites without --force', () => {
    const dir = join(sandbox, 'all-tokens');
    assert.equal(runCli(['tokens', 'all-tokens']).code, 0);
    for (const file of tokenFiles('all')) assert.ok(existsSync(join(dir, file)));

    writeFileSync(join(dir, 'tokens.css'), 'MINE');
    const second = runCli(['tokens', 'all-tokens']);
    assert.equal(second.code, 0);
    assert.equal(readFileSync(join(dir, 'tokens.css'), 'utf8'), 'MINE');
    assert.match(second.output, /skipped/);
    assert.match(second.output, /tokens\.css/);

    runCli(['tokens', 'all-tokens', '--force']);
    assert.equal(
      readFileSync(join(dir, 'tokens.css'), 'utf8'),
      readFileSync(join(PACKAGE_ROOT, 'tokens', 'tokens.css'), 'utf8'),
    );
  });

  test('rejects an unknown format with exit code 2', () => {
    assert.equal(
      silenceErrors(() => runCli(['tokens', 'x', '--format', 'scss']).code),
      2,
    );
  });
});

describe('ui command', () => {
  test('copies the library without specs, plus tokens, and docs only with --docs', () => {
    const ui = join(sandbox, 'lib', 'ui');
    const tokens = join(sandbox, 'lib', 'tokens');
    const docs = join(sandbox, 'lib', 'docs');

    const first = runCli(['ui', ui, '--tokens', tokens]);
    assert.equal(first.code, 0);
    assert.ok(existsSync(join(ui, 'index.ts')));
    assert.ok(existsSync(join(ui, 'button', 'button.ts')));
    assert.ok(!existsSync(join(ui, 'feedback.spec.ts')));
    assert.ok(existsSync(join(tokens, 'tailwind-theme.css')));
    assert.ok(!existsSync(docs));
    assert.match(first.output, /Tailwind v4/);
    assert.match(first.output, /@angular\/aria/);

    runCli(['ui', ui, '--tokens', tokens, '--docs', '--docs-dir', docs]);
    assert.ok(existsSync(join(docs, 'overlays.md')));
  });
});

describe('create command', () => {
  test('refuses a directory that is not empty', () => {
    const dir = join(sandbox, 'busy');
    mkdirSync(dir);
    writeFileSync(join(dir, 'file.txt'), 'x');
    const code = silenceErrors(() => runCli(['create', 'busy', '--no-install', '--no-git']).code);
    assert.equal(code, 1);
    assert.deepEqual(readFileSync(join(dir, 'file.txt'), 'utf8'), 'x');
  });

  test('requires an app name', () => {
    assert.equal(
      silenceErrors(() => runCli(['create']).code),
      2,
    );
  });

  test('copies the app and renames package.json and angular.json', () => {
    const { code, output } = runCli(['create', 'My Shiny App', '--no-install', '--no-git']);
    assert.equal(code, 0);
    const dir = join(sandbox, 'My Shiny App');

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'my-shiny-app');
    assert.equal(pkg.version, '0.0.0');
    assert.ok(!('bin' in pkg));
    assert.ok(!('repository' in pkg));
    assert.ok(pkg.devDependencies['@angular/core']);

    const angular = readFileSync(join(dir, 'angular.json'), 'utf8');
    assert.ok(!angular.includes('ng-runway'));
    assert.ok(Object.hasOwn(JSON.parse(angular).projects, 'my-shiny-app'));

    assert.ok(existsSync(join(dir, 'src', 'main.ts')));
    assert.ok(existsSync(join(dir, 'tokens', 'tokens.css')));
    assert.ok(existsSync(join(dir, 'package-lock.json')));
    assert.ok(!existsSync(join(dir, 'cli')));
    assert.ok(!existsSync(join(dir, 'drills')));
    assert.ok(!existsSync(join(dir, 'node_modules')));
    assert.ok(!existsSync(join(dir, '.git')));
    assert.match(output, /npm ci --ignore-scripts/);
  });
});

describe('top level', () => {
  test('help exits 0 and unknown commands exit 2', () => {
    const help = runCli(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.output, /create <app-name>/);
    assert.equal(
      silenceErrors(() => runCli(['nope']).code),
      2,
    );
  });
});
