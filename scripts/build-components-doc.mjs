/**
 * Builds docs/components.md from the per-group files in docs/components/.
 * Edit the group files, then run: npm run docs:components
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'docs/components';
const order = ['basics', 'forms', 'selection', 'pickers', 'data-display', 'overlays', 'charts-nav'];
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .sort((a, b) => {
    const ia = order.indexOf(a.replace('.md', ''));
    const ib = order.indexOf(b.replace('.md', ''));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

const body = files
  .map((f) => readFileSync(join(dir, f), 'utf8').trim().replace(/^# /, '## '))
  .join('\n\n');

const intro = `# UI component catalog

Every component in \`src/app/ui/\`. **Reuse these and the semantic tokens (\`--colors-*\`); do not invent new components or colors.**
Import from \`@ui/index\`. Each group below is also a live section on the \`/design-system\` page.

`;

writeFileSync('docs/components.md', `${intro}${body}\n`);
console.log(`docs/components.md built from ${files.length} files`);
