import { listFiles } from './lib/files.mjs';
import { PACKAGE_ROOT } from './lib/paths.mjs';

// The manifest decides which files each command copies. It reads the real folder
// tree of the package, so tests can assert on it and nothing is listed by hand
// except the top-level names of the `create` allow-list below.
// All returned paths use forward slashes.

// --- tokens ------------------------------------------------------------------

// Value of --format -> file in the package's tokens/ folder.
export const TOKEN_FILES = {
  css: 'tokens.css',
  json: 'tokens.json',
  tailwind: 'tailwind-theme.css',
  ts: 'tokens.ts',
};

export const TOKEN_FORMATS = [...Object.keys(TOKEN_FILES), 'all'];

// File names (relative to tokens/) for a format. 'all' means every token file.
export function tokenFiles(format = 'all') {
  if (format === 'all') return Object.values(TOKEN_FILES);
  if (!(format in TOKEN_FILES)) throw new Error(`Unknown token format: ${format}`);
  return [TOKEN_FILES[format]];
}

// --- ui ----------------------------------------------------------------------

// Every file of the UI library except unit tests, relative to src/app/ui.
export function uiFiles(root = PACKAGE_ROOT) {
  return listFiles(root, 'src/app/ui')
    .filter((file) => !file.endsWith('.spec.ts'))
    .map((file) => file.slice('src/app/ui/'.length));
}

// Component docs (docs/components/*.md), relative to docs/components.
export function docFiles(root = PACKAGE_ROOT) {
  return listFiles(root, 'docs/components')
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice('docs/components/'.length));
}

// --- create ------------------------------------------------------------------

// Names ignored anywhere inside the copied folders.
export const CREATE_SKIP_NAMES = ['node_modules', 'dist', '.angular', '.git', '.DS_Store'];
// Exact paths ignored (husky writes generated helper files into .husky/_).
export const CREATE_SKIP_PATHS = ['.husky/_'];

// Must exist in the package, otherwise the new app would be broken (a test checks this).
export const CREATE_REQUIRED = [
  'src',
  'public',
  'tokens',
  'scripts',
  'docs',
  'angular.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.spec.json',
  'eslint.config.mjs',
  '.prettierrc',
  '.prettierignore',
  '.gitignore',
  '.nvmrc',
  'LICENSE',
  'README.md',
  'CLAUDE.md',
];

// Copied when present, silently skipped when not. Deliberately absent from both
// lists: cli, drills, node_modules, dist, .angular, .git, .github, .claude/skills.
export const CREATE_OPTIONAL = [
  'e2e',
  '.gitattributes',
  '.editorconfig',
  '.postcssrc.json',
  '.husky',
  'commitlint.config.mjs',
  'playwright.config.ts',
  'AGENTS.md',
  'llms.txt',
  '.mcp.json',
  '.claude/commands',
  '.devcontainer',
];

// Every file `create` copies, relative to the package root.
export function createFiles(root = PACKAGE_ROOT) {
  const options = { skipNames: CREATE_SKIP_NAMES, skipPaths: CREATE_SKIP_PATHS };
  return [...CREATE_REQUIRED, ...CREATE_OPTIONAL].flatMap((entry) =>
    listFiles(root, entry, options),
  );
}
