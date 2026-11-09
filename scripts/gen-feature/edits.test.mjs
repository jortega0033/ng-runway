// Run with: node --test "scripts/**/*.test.mjs"
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addMockFeature, addNavItem, addNavLabel, addRoute, insertAboveMarker } from './edits.mjs';
import { deriveNames } from './names.mjs';

const names = deriveNames('orders');

const FEATURES = `import type { Db } from './db';
// gen:feature:imports:start
// gen:feature:imports:end

export const MOCK_FEATURES: readonly MockFeature[] = [
  // gen:feature:list:start
  // gen:feature:list:end
];
`;

const ROUTES = `export const routes = [
  {
    children: [
      { path: 'settings' },
      // gen:feature:routes
      { path: 'design-system' },
    ],
  },
];
`;

const NAV = `export const NAV = [
  { key: 'nav.settings' },
  // gen:feature:nav
  { key: 'nav.designSystem' },
];
`;

const I18N = `{
  "common": {
    "save": "Save"
  },
  "nav": {
    "main": "Main navigation",
    "designSystem": "Design system"
  },
  "shell": {
    "skipToContent": "Skip to content"
  }
}
`;

describe('insertAboveMarker', () => {
  it('inserts with the marker indentation and keeps the marker', () => {
    const out = insertAboveMarker('a\n    // marker\nb\n', '// marker', ['x', '  y']);
    assert.equal(out, 'a\n    x\n      y\n    // marker\nb\n');
  });

  it('keeps CRLF line endings', () => {
    const out = insertAboveMarker('a\r\n  // marker\r\nb\r\n', '// marker', ['x']);
    assert.equal(out, 'a\r\n  x\r\n  // marker\r\nb\r\n');
  });

  it('throws a clear error when the marker is missing', () => {
    assert.throws(() => insertAboveMarker('nothing', '// marker', ['x'], 'file.ts'), /file\.ts/);
  });
});

describe('addMockFeature', () => {
  const importPath = '@features/orders/mock/orders.mock';

  it('adds the import and the list entry between the markers', () => {
    const { text, status } = addMockFeature(FEATURES, names, importPath);
    assert.equal(status, 'added');
    assert.match(
      text,
      /import \{ ORDERS_MOCK \} from '@features\/orders\/mock\/orders\.mock';\n\/\/ gen:feature:imports:end/,
    );
    assert.match(
      text,
      /\/\/ gen:feature:list:start\n {2}ORDERS_MOCK,\n {2}\/\/ gen:feature:list:end/,
    );
  });

  it('is idempotent: a second run changes nothing', () => {
    const once = addMockFeature(FEATURES, names, importPath).text;
    const twice = addMockFeature(once, names, importPath);
    assert.equal(twice.status, 'present');
    assert.equal(twice.text, once);
  });

  it('adds only the missing half when one line was removed by hand', () => {
    const once = addMockFeature(FEATURES, names, importPath).text;
    const withoutEntry = once.replace('  ORDERS_MOCK,\n', '');
    const repaired = addMockFeature(withoutEntry, names, importPath).text;
    assert.equal(repaired, once);
  });

  it('keeps other features and adds the new one below them', () => {
    const other = deriveNames('shift-swaps');
    const first = addMockFeature(
      FEATURES,
      other,
      '@features/shift-swaps/mock/shift-swaps.mock',
    ).text;
    const both = addMockFeature(first, names, importPath).text;
    assert.ok(both.indexOf('SHIFT_SWAPS_MOCK,') < both.indexOf('ORDERS_MOCK,'));
  });
});

describe('addRoute', () => {
  it('inserts the lazy route before the marker and keeps the marker', () => {
    const { text, status } = addRoute(ROUTES, names);
    assert.equal(status, 'added');
    assert.match(
      text,
      / {6}\{\n {8}path: 'orders',\n {8}loadChildren: \(\) =>\n? ?.*ORDERS_ROUTES\),\n {6}\},\n {6}\/\/ gen:feature:routes/s,
    );
    assert.ok(text.includes("{ path: 'design-system' }"));
  });

  it('is idempotent', () => {
    const once = addRoute(ROUTES, names).text;
    assert.equal(addRoute(once, names).status, 'present');
    assert.equal(addRoute(once, names).text, once);
  });

  it('breaks long loaders the way Prettier does (max 100 columns)', () => {
    const long = deriveNames('warehouse-delivery-schedules');
    const { text } = addRoute(ROUTES, long);
    for (const line of text.split('\n')) assert.ok(line.length <= 100, line);
  });
});

describe('addNavItem', () => {
  it('adds one row above the marker', () => {
    const { text, status } = addNavItem(NAV, names);
    assert.equal(status, 'added');
    assert.match(
      text,
      /\{ key: 'nav\.orders', label: '', icon: 'list', link: '\/orders', roles: ALL \},\n {2}\/\/ gen:feature:nav/,
    );
  });

  it('is idempotent', () => {
    const once = addNavItem(NAV, names).text;
    assert.equal(addNavItem(once, names).status, 'present');
  });
});

describe('addNavLabel', () => {
  it('adds the key at the end of nav and changes nothing else', () => {
    const { text, status } = addNavLabel(I18N, names, 'Orders');
    assert.equal(status, 'added');
    assert.equal(
      text,
      I18N.replace(
        '"designSystem": "Design system"',
        '"designSystem": "Design system",\n    "orders": "Orders"',
      ),
    );
    assert.equal(JSON.parse(text).nav.orders, 'Orders');
    assert.ok(text.endsWith('}\n'));
  });

  it('uses the camelCase key for compound names', () => {
    const { text } = addNavLabel(I18N, deriveNames('order-items'), 'Order Items');
    assert.equal(JSON.parse(text).nav.orderItems, 'Order Items');
  });

  it('is idempotent', () => {
    const once = addNavLabel(I18N, names, 'Orders').text;
    const twice = addNavLabel(once, names, 'Orders');
    assert.equal(twice.status, 'present');
    assert.equal(twice.text, once);
  });

  it('throws when there is no nav section', () => {
    assert.throws(() => addNavLabel('{ "common": {} }\n', names, 'Orders'), /nav/);
  });
});
