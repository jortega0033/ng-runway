// Command line parsing for strip.mjs. Pure, so it can be tested.

export const USAGE = `Usage: node scripts/strip.mjs [--dry-run] [--yes] [--no-format]

  --dry-run    print what would be deleted, replaced and edited; write nothing
  --yes        do not ask for confirmation (needed when there is no terminal, for example in CI)
  --no-format  do not run Prettier on the result`;

/** Reads the arguments (without "node" and the script path). Throws a readable error. */
export function parseArgs(argv) {
  const options = { dryRun: false, yes: false, format: true, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--no-format') options.format = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument "${arg}".\n${USAGE}`);
  }
  return options;
}
