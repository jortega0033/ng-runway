// Command line parsing for gen-feature.mjs. Pure, so it can be tested.

export const USAGE = `Usage: node scripts/gen-feature.mjs <name> [--singular <name>] [--dry-run] [--force] [--no-format]
Example: npm run gen:feature orders`;

/**
 * Reads the arguments (without "node" and the script path): one name plus a few flags.
 * Throws a readable error for anything it does not understand.
 */
export function parseArgs(argv) {
  const options = {
    name: undefined,
    singular: undefined,
    dryRun: false,
    force: false,
    format: true,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--no-format') options.format = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--singular') {
      options.singular = argv[++i];
      if (!options.singular)
        throw new Error('--singular needs a value, for example --singular order');
    } else if (arg.startsWith('--singular=')) {
      options.singular = arg.slice('--singular='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}".\n${USAGE}`);
    } else if (options.name === undefined) {
      options.name = arg;
    } else {
      throw new Error(`Unexpected extra argument "${arg}". Give one name.\n${USAGE}`);
    }
  }
  return options;
}
