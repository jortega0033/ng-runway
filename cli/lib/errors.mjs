// Two kinds of expected failure. index.mjs turns them into exit codes.

// The user typed something wrong (unknown option, missing argument). Exit code 2.
export class UsageError extends Error {}

// The command was understood but could not finish (target not empty, copy failed). Exit code 1.
export class CliError extends Error {}
