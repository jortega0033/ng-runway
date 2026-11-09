import { UsageError } from './errors.mjs';

// Tiny argument parser (no dependencies).
//   booleans: flags without a value, like --force
//   strings:  flags with a value, like --format css or --format=css
// Everything that does not start with "--" is a positional argument.
// Returns { positionals: string[], flags: { [name]: true | string } }.
export function parseArgs(argv, { booleans = [], strings = [] } = {}) {
  const positionals = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    // "--format=css" becomes name "format" and inline value "css".
    const [name, inline] = arg.slice(2).split(/=(.*)/s);

    if (booleans.includes(name)) {
      if (inline !== undefined) throw new UsageError(`Option --${name} does not take a value.`);
      flags[name] = true;
    } else if (strings.includes(name)) {
      const value = inline ?? argv[++i];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`Option --${name} needs a value.`);
      }
      flags[name] = value;
    } else {
      throw new UsageError(`Unknown option: --${name}`);
    }
  }

  return { positionals, flags };
}
