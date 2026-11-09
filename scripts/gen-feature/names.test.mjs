// Run with: node --test "scripts/**/*.test.mjs"
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertValidName, deriveNames, isKebab, singularize, toCamel, toPascal } from './names.mjs';

describe('isKebab', () => {
  it('accepts lower-case words, digits and single dashes', () => {
    for (const ok of ['orders', 'order-items', 'orders2', 'shift-swaps-2024']) {
      assert.equal(isKebab(ok), true, ok);
    }
  });

  it('rejects everything else', () => {
    for (const bad of [
      '',
      'Orders',
      'order_items',
      'order--items',
      '-orders',
      'orders-',
      '2orders',
      'or ders',
    ]) {
      assert.equal(isKebab(bad), false, bad);
    }
  });
});

describe('assertValidName', () => {
  it('throws a helpful message for a bad name', () => {
    assert.throws(() => assertValidName('Order_Items'), /kebab-case/);
    assert.throws(() => assertValidName(''), /Missing name/);
    assert.throws(() => assertValidName(undefined), /Missing name/);
  });

  it('refuses names that clash with existing routes', () => {
    assert.throws(() => assertValidName('login'), /reserved/);
    assert.throws(() => assertValidName('design-system'), /reserved/);
  });
});

describe('singularize', () => {
  it('handles the common English endings', () => {
    assert.equal(singularize('orders'), 'order');
    assert.equal(singularize('categories'), 'category');
    assert.equal(singularize('boxes'), 'box');
    assert.equal(singularize('addresses'), 'address');
    assert.equal(singularize('branches'), 'branch');
    assert.equal(singularize('people'), 'person');
    assert.equal(singularize('statuses'), 'status');
  });

  it('only changes the last word of a compound name', () => {
    assert.equal(singularize('order-items'), 'order-item');
    assert.equal(singularize('shift-categories'), 'shift-category');
  });

  it('leaves words that do not look plural alone', () => {
    assert.equal(singularize('staff'), 'staff');
    assert.equal(singularize('address'), 'address');
    assert.equal(singularize('status'), 'status');
  });
});

describe('case helpers', () => {
  it('converts kebab-case', () => {
    assert.equal(toPascal('order-items'), 'OrderItems');
    assert.equal(toCamel('order-items'), 'orderItems');
    assert.equal(toCamel('orders'), 'orders');
  });
});

describe('deriveNames', () => {
  it('derives every form for a simple name', () => {
    const n = deriveNames('orders');
    assert.deepEqual(n, {
      plural: 'orders',
      singular: 'order',
      pascal: 'Orders',
      pascalSingular: 'Order',
      camel: 'orders',
      camelSingular: 'order',
      constant: 'ORDERS',
      title: 'Orders',
      titleSingular: 'Order',
      lower: 'orders',
      lowerSingular: 'order',
    });
  });

  it('derives forms for a compound name', () => {
    const n = deriveNames('order-items');
    assert.equal(n.pascal, 'OrderItems');
    assert.equal(n.pascalSingular, 'OrderItem');
    assert.equal(n.camelSingular, 'orderItem');
    assert.equal(n.constant, 'ORDER_ITEMS');
    assert.equal(n.title, 'Order Items');
    assert.equal(n.lowerSingular, 'order item');
  });

  it('uses the --singular override', () => {
    const n = deriveNames('staff', 'staff-member');
    assert.equal(n.singular, 'staff-member');
    assert.equal(n.pascalSingular, 'StaffMember');
  });

  it('asks for --singular when it cannot tell', () => {
    assert.throws(() => deriveNames('staff'), /--singular/);
  });

  it('validates the override too', () => {
    assert.throws(() => deriveNames('orders', 'Order Item'), /singular/);
  });
});
