import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

// "a/b/c.ts" (always forward slashes, as stored in the manifest) to a path for this OS.
const toOsPath = (base, rel) => join(base, ...rel.split('/'));

// Lists files below root/rel. rel can be a file or a folder.
// Returns paths relative to root with forward slashes, sorted, so results are the same on every OS.
//   skipNames: file or folder names ignored at any depth (node_modules, .git ...)
//   skipPaths: exact relative paths ignored (".husky/_")
export function listFiles(root, rel, { skipNames = [], skipPaths = [] } = {}) {
  const info = statSync(toOsPath(root, rel), { throwIfNoEntry: false });
  if (!info) return [];
  if (info.isFile()) return [rel];

  const found = [];
  const entries = readdirSync(toOsPath(root, rel), { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    const child = `${rel}/${entry.name}`;
    if (skipNames.includes(entry.name) || skipPaths.includes(child)) continue;
    if (entry.isDirectory()) found.push(...listFiles(root, child, { skipNames, skipPaths }));
    else if (entry.isFile()) found.push(child);
  }
  return found;
}

// Copies each file (a path relative to fromBase) to the same relative path under toBase.
// An existing file is never replaced unless force is true; it is reported as skipped instead.
// Returns { copied, skipped } as absolute destination paths.
export function copyFiles(fromBase, files, toBase, force = false) {
  const copied = [];
  const skipped = [];

  for (const rel of files) {
    const destination = toOsPath(toBase, rel);
    if (existsSync(destination) && !force) {
      skipped.push(destination);
      continue;
    }
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(toOsPath(fromBase, rel), destination);
    copied.push(destination);
  }
  return { copied, skipped };
}

// Prints the result of copyFiles in a form people can read.
export function reportCopy(log, { copied, skipped }, label) {
  log(`${label}: ${copied.length} copied, ${skipped.length} skipped.`);
  for (const file of skipped) log(`  skipped (already exists): ${file}`);
  if (skipped.length > 0) log('  Use --force to overwrite existing files.');
}
