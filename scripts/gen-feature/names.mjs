// Name helpers for `npm run gen:feature`. Pure functions only: no file access, easy to test.
//
// You type one name, for example `order-items`. Everything else (class names, constants, labels)
// is derived from it here, so every template can say `names.pascal` instead of re-deriving it.

/** kebab-case: lower-case words joined by single dashes. The first character must be a letter. */
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Names that would clash with a top-level route or a folder the app already uses. */
const RESERVED = new Set(['login', 'forbidden', 'design-system', 'new', 'edit', 'api', 'i18n']);

/** Irregular plurals the simple suffix rules below cannot handle. */
const IRREGULAR = new Map([
  ['people', 'person'],
  ['children', 'child'],
  ['men', 'man'],
  ['women', 'woman'],
  ['indices', 'index'],
  ['statuses', 'status'],
]);

export function isKebab(value) {
  return KEBAB.test(value);
}

/** Throws a readable error when `name` cannot be used as a feature name. */
export function assertValidName(name, label = 'name') {
  if (typeof name !== 'string' || name === '') {
    throw new Error(`Missing ${label}. Example: npm run gen:feature orders`);
  }
  if (!isKebab(name)) {
    throw new Error(
      `Invalid ${label} "${name}". Use kebab-case: lower-case letters, digits and single dashes, ` +
        'starting with a letter (for example "orders" or "order-items").',
    );
  }
  if (RESERVED.has(name)) {
    throw new Error(`"${name}" is reserved (it clashes with an existing route or folder).`);
  }
}

/**
 * Guesses the singular of the LAST dash-separated word: "order-items" gives "order-item".
 * Returns the input unchanged when it does not look plural; the caller then asks for --singular.
 */
export function singularize(kebab) {
  const parts = kebab.split('-');
  const last = parts.pop() ?? '';
  parts.push(singularWord(last));
  return parts.join('-');
}

function singularWord(word) {
  const irregular = IRREGULAR.get(word);
  if (irregular) return irregular;
  if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`; // categories
  if (/(sses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2); // boxes, addresses
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word; // already singular
  if (word.endsWith('s') && word.length > 1) return word.slice(0, -1); // orders
  return word;
}

const words = (kebab) => kebab.split('-');
const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/** "order-items" to "OrderItems". */
export const toPascal = (kebab) => words(kebab).map(capitalize).join('');
/** "order-items" to "orderItems". */
export const toCamel = (kebab) => {
  const pascal = toPascal(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};
/** "order-items" to "ORDER_ITEMS". */
export const toConstant = (kebab) => words(kebab).join('_').toUpperCase();
/** "order-items" to "Order Items". */
export const toTitle = (kebab) => words(kebab).map(capitalize).join(' ');
/** "order-items" to "order items". */
export const toLower = (kebab) => words(kebab).join(' ');

/**
 * Builds every spelling the templates need.
 * @param {string} plural kebab-case plural name, for example "orders"
 * @param {string} [singularOverride] kebab-case singular, for names the guess gets wrong
 */
export function deriveNames(plural, singularOverride) {
  assertValidName(plural);
  if (singularOverride !== undefined) assertValidName(singularOverride, 'singular');
  const singular = singularOverride ?? singularize(plural);
  if (singular === plural) {
    throw new Error(
      `Could not tell the singular of "${plural}" from its plural. ` +
        `Pass it yourself: --singular <name> (for example --singular ${plural}-item).`,
    );
  }
  return {
    /** "orders": folder name, URL path, i18n scope, collection name. */
    plural,
    /** "order": used for ids and file-internal wording. */
    singular,
    /** "Orders" / "Order": class and type names. */
    pascal: toPascal(plural),
    pascalSingular: toPascal(singular),
    /** "orders" / "order": variable names. */
    camel: toCamel(plural),
    camelSingular: toCamel(singular),
    /** "ORDERS": exported constants such as ORDERS_ROUTES. */
    constant: toConstant(plural),
    /** "Orders" / "Order": headings and nav labels (English). */
    title: toTitle(plural),
    titleSingular: toTitle(singular),
    /** "orders" / "order": the middle of an English sentence. */
    lower: toLower(plural),
    lowerSingular: toLower(singular),
  };
}
