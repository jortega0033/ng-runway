// Edits to files that already exist. Every function takes the current file text and returns
// `{ text, status }`, where status is 'added' (text changed) or 'present' (already there, text
// unchanged). Nothing here touches the disk, so the main script can compute every edit first and
// only write once they all worked.
//
// The files carry marker comments (for example `// gen:feature:nav`). We insert our lines
// directly above a marker and never remove it, so the next run finds it again.

const FEATURES_IMPORTS_END = '// gen:feature:imports:end';
const FEATURES_LIST_START = '// gen:feature:list:start';
const FEATURES_LIST_END = '// gen:feature:list:end';
const ROUTES_MARKER = '// gen:feature:routes';
const NAV_MARKER = '// gen:feature:nav';

/** Keep the line endings the file already uses (Windows checkouts may have CRLF). */
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

/**
 * Inserts `lines` as new lines directly above the line that holds `marker`.
 * The new lines get the same indentation as the marker. Throws when the marker is missing.
 */
export function insertAboveMarker(text, marker, lines, fileLabel = 'file') {
  const markerAt = text.indexOf(marker);
  if (markerAt < 0) {
    throw new Error(`Marker "${marker}" not found in ${fileLabel}. Was it removed? Add it back.`);
  }
  const lineStart = text.lastIndexOf('\n', markerAt) + 1;
  const indent = text.slice(lineStart, markerAt);
  if (indent.trim() !== '') {
    throw new Error(`Marker "${marker}" in ${fileLabel} must be on a line of its own.`);
  }
  const eol = eolOf(text);
  const block = lines.map((line) => (line === '' ? '' : indent + line) + eol).join('');
  return text.slice(0, lineStart) + block + text.slice(lineStart);
}

/** True when any line of `text` equals `line` once surrounding spaces are ignored. */
const hasLine = (text, line) => text.split(/\r?\n/).some((candidate) => candidate.trim() === line);

/** Registers the feature's mock backend in `src/app/core/mock/features.ts`. */
export function addMockFeature(text, names, importPath) {
  const constantName = `${names.constant}_MOCK`;
  const importLine = `import { ${constantName} } from '${importPath}';`;
  const entryLine = `${constantName},`;

  // The array entry only counts when it sits between the list markers.
  const listStart = text.indexOf(FEATURES_LIST_START);
  const listEnd = text.indexOf(FEATURES_LIST_END);
  if (listStart < 0 || listEnd < listStart) {
    throw new Error(
      `The "${FEATURES_LIST_START}" / "${FEATURES_LIST_END}" markers are missing in features.ts.`,
    );
  }
  const inList = hasLine(text.slice(listStart, listEnd), entryLine);
  const inImports = hasLine(text, importLine);
  if (inList && inImports) return { text, status: 'present' };

  let next = text;
  if (!inImports) next = insertAboveMarker(next, FEATURES_IMPORTS_END, [importLine], 'features.ts');
  if (!inList) next = insertAboveMarker(next, FEATURES_LIST_END, [entryLine], 'features.ts');
  return { text: next, status: 'added' };
}

/**
 * The lazy route loader, written the way Prettier would print it for a 100 column limit:
 * on one line if it fits, otherwise broken after `=>`, otherwise broken inside `.then(...)`.
 * (Prettier is run on the result anyway when it is installed; this just keeps the output tidy.)
 */
function routeLoader(names, indent) {
  const importCall = `import('@features/${names.plural}/${names.plural}.routes')`;
  const then = `.then((m) => m.${names.constant}_ROUTES)`;
  const oneLine = `loadChildren: () => ${importCall}${then},`;
  if (indent.length + oneLine.length <= 100) return [oneLine];
  const second = `${importCall}${then},`;
  if (indent.length + 2 + second.length <= 100) return ['loadChildren: () =>', `  ${second}`];
  return [
    'loadChildren: () =>',
    `  ${importCall}.then(`,
    `    (m) => m.${names.constant}_ROUTES,`,
    '  ),',
  ];
}

/** Adds the lazy route to `src/app/app.routes.ts`, above the `// gen:feature:routes` marker. */
export function addRoute(text, names) {
  if (new RegExp(`path:\\s*'${names.plural}'`).test(text)) return { text, status: 'present' };
  const markerAt = text.indexOf(ROUTES_MARKER);
  const indent = markerAt < 0 ? '' : text.slice(text.lastIndexOf('\n', markerAt) + 1, markerAt);
  const lines = [
    '{',
    `  path: '${names.plural}',`,
    ...routeLoader(names, `${indent}  `).map((line) => `  ${line}`),
    '},',
  ];
  return { text: insertAboveMarker(text, ROUTES_MARKER, lines, 'app.routes.ts'), status: 'added' };
}

/** Adds the sidebar row to `src/app/core/layout/nav-items.ts`, above the `// gen:feature:nav` marker. */
export function addNavItem(text, names) {
  const key = `nav.${names.camel}`;
  if (text.includes(`key: '${key}'`)) return { text, status: 'present' };
  const row = `{ key: '${key}', label: '', icon: 'list', link: '/${names.plural}', roles: ALL },`;
  return { text: insertAboveMarker(text, NAV_MARKER, [row], 'nav-items.ts'), status: 'added' };
}

/**
 * Adds `"<camelName>": "<label>"` to the `nav` object of a global i18n file
 * (`public/i18n/en.json` or `nl.json`).
 *
 * We edit the text instead of parsing and re-printing the JSON, so the rest of the file keeps
 * its exact formatting. Afterwards the result is parsed and compared with the original to make
 * sure nothing but the new key changed.
 */
export function addNavLabel(text, names, label) {
  const key = names.camel;
  const before = JSON.parse(text);
  if (!before.nav || typeof before.nav !== 'object') {
    throw new Error('The i18n file has no "nav" section to add the label to.');
  }
  if (key in before.nav) return { text, status: 'present' };

  // Find `"nav": { ... }` and the last entry inside it.
  const navStart = text.search(/"nav"\s*:\s*\{/);
  const closeAt = navStart < 0 ? -1 : text.indexOf('}', navStart);
  if (closeAt < 0) throw new Error('Could not find the "nav" section in the i18n file.');
  const body = text.slice(navStart, closeAt).replace(/\s+$/, '');
  const eol = eolOf(text);
  const closeLineStart = text.lastIndexOf('\n', closeAt) + 1;
  const closeIndent = text.slice(closeLineStart, closeAt);
  const entryIndent = `${closeIndent}  `;
  const entry = `${entryIndent}${JSON.stringify(key)}: ${JSON.stringify(label)}`;
  const next = `${text.slice(0, navStart)}${body},${eol}${entry}${eol}${text.slice(closeLineStart)}`;

  // Safety net: the only difference may be the new key.
  const after = JSON.parse(next);
  const expected = { ...before, nav: { ...before.nav, [key]: label } };
  if (JSON.stringify(after) !== JSON.stringify(expected)) {
    throw new Error(
      'Adding the nav label would change other parts of the i18n file. Add it by hand.',
    );
  }
  return { text: next, status: 'added' };
}
