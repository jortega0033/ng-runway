import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives in <package>/cli/lib, so two levels up is the package root.
// The CLI always reads its source files from there, never from the current directory,
// because `npx github:...` runs it from a temporary download.
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
