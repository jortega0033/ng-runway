// Pure text-to-text helpers used by `create`. Nothing here touches the disk.

// "My Cool App" -> "my-cool-app". Returns '' when nothing usable is left.
export function toKebab(input) {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// package.json: new name, version 0.0.0, no bin and no repository. Everything else is kept.
export function renamePackageJson(text, newName) {
  const pkg = JSON.parse(text);
  const next = { ...pkg, name: newName, version: '0.0.0' };
  delete next.bin;
  delete next.repository;
  return `${JSON.stringify(next, null, 2)}\n`;
}

// Replaces oldName with newName in every key and every string value, at any depth.
// angular.json uses the project name as a key ("projects") and in values ("buildTarget", "outputPath").
function deepRename(value, oldName, newName) {
  if (typeof value === 'string') return value.split(oldName).join(newName);
  if (Array.isArray(value)) return value.map((item) => deepRename(item, oldName, newName));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.split(oldName).join(newName),
        deepRename(item, oldName, newName),
      ]),
    );
  }
  return value;
}

export function renameAngularJson(text, oldName, newName) {
  return `${JSON.stringify(deepRename(JSON.parse(text), oldName, newName), null, 2)}\n`;
}

// package-lock.json: only the two places that hold the project's own name.
// Package names of dependencies must not be touched, so this is not a deep replace.
export function renameLockJson(text, newName) {
  const lock = JSON.parse(text);
  lock.name = newName;
  if (lock.packages?.['']) lock.packages[''].name = newName;
  return `${JSON.stringify(lock, null, 2)}\n`;
}
