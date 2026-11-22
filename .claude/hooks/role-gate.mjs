#!/usr/bin/env node
/*
 * Review gate for pull requests opened from Claude Code.
 *
 * Two modes, both called by the hooks in .claude/settings.json:
 *
 *   record  when a subagent finishes (SubagentStop): note which role ran, and when.
 *   check   before a shell command: if the command opens a pull request or marks
 *           one ready, refuse unless every gate role ran after the last code edit.
 *
 * A change that touches only documentation or agent configuration passes without
 * a review. The owner can switch the gate off for a session by starting Claude
 * Code with ROLE_GATE=off in the environment.
 *
 * Node built-ins only. Exit code 2 blocks the tool call; the text on stderr is
 * shown to Claude as the reason.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE_ROLES = ['Code Reviewer', 'Reality Checker']; // GATE_ROLES_MARKER
const LEDGER = path.join('.claude', 'state', 'role-runs.jsonl');
const PR_COMMAND = /(?:^|[\s;&|(])gh(?:\.exe)?\s+pr\s+(create|ready)\b/;
const DOC_ONLY = /(^|\/)(\.claude|\.github|docs)\/|\.(md|txt|rst)$|(^|\/)(LICENSE|\.gitignore|\.gitattributes)$/i;
const SLACK_MS = 2000; // file-system timestamp granularity

function git(root, ...args) {
  const out = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 20000 });
  if (out.error || out.status !== 0) return null;
  // keep leading spaces: `git status --porcelain` lines start with them
  return out.stdout.replace(/\s+$/, '');
}

const repoRoot = cwd => git(cwd || '.', 'rev-parse', '--show-toplevel');

function baseRef(root) {
  const head = git(root, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  for (const ref of [head, 'origin/main', 'origin/master', 'main', 'master']) {
    if (ref && git(root, 'rev-parse', '--verify', '--quiet', ref) !== null) return ref;
  }
  return null;
}

/** Files that differ from the default branch, committed or not. null = unknown. */
function changedFiles(root) {
  const base = baseRef(root);
  if (base === null) return null;
  const mergeBase = git(root, 'merge-base', base, 'HEAD');
  if (mergeBase === null) return null;
  const committed = git(root, 'diff', '--name-only', mergeBase, 'HEAD');
  const working = git(root, 'status', '--porcelain', '--untracked-files=all');
  if (committed === null || working === null) return null;
  const names = new Set(committed.split('\n').filter(Boolean));
  for (const line of working.split('\n').filter(Boolean)) {
    let p = line.slice(3);
    if (p.includes(' -> ')) p = p.split(' -> ')[1];
    names.add(p.replace(/^"|"$/g, ''));
  }
  return [...names].sort();
}

const isCode = p => !DOC_ONLY.test(p.replace(/\\/g, '/'));

/** [timestamp ms, path] of the most recently modified changed code file. */
function lastCodeChange(root, files) {
  let newest = 0;
  let newestPath = null;
  for (const rel of files) {
    let stamp;
    try {
      stamp = fs.statSync(path.join(root, rel)).mtimeMs;
    } catch {
      continue; // deleted file: nothing left to review in it
    }
    if (stamp > newest) {
      newest = stamp;
      newestPath = rel;
    }
  }
  return [newest, newestPath];
}

function readLedger(root) {
  const runs = new Map();
  let text;
  try {
    text = fs.readFileSync(path.join(root, LEDGER), 'utf8');
  } catch {
    return runs;
  }
  for (const line of text.split('\n')) {
    try {
      const entry = JSON.parse(line);
      const role = String(entry.role ?? '').trim().toLowerCase();
      const stamp = Number(entry.ts ?? 0);
      if (role && stamp > (runs.get(role) ?? 0)) runs.set(role, stamp);
    } catch {
      /* skip unreadable lines */
    }
  }
  return runs;
}

function record(event) {
  // SubagentStop events carry agent_type; a tool event carries tool_input.subagent_type
  const role = String(event.agent_type || event.tool_input?.subagent_type || '').trim();
  if (!role) return 0;
  const root = repoRoot(event.cwd);
  if (!root) return 0;
  const file = path.join(root, LEDGER);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ role, ts: Date.now(), session: event.session_id ?? '' }) + '\n');
  return 0;
}

const clock = ms => new Date(ms).toLocaleTimeString('en-GB', { hour12: false });

function check(event) {
  const command = String(event.tool_input?.command ?? '');
  if (!PR_COMMAND.test(command)) return 0;
  if ((process.env.ROLE_GATE ?? '').toLowerCase() === 'off') {
    process.stderr.write('role gate: switched off by ROLE_GATE=off for this session\n');
    return 0;
  }
  const root = repoRoot(event.cwd);
  if (!root) return 0; // not a git checkout: nothing to gate
  const files = changedFiles(root);
  let code = null; // null = cannot tell what changed: require the gate
  if (files !== null) {
    code = files.filter(isCode);
    if (code.length === 0) return 0; // documentation or agent configuration only
  }
  let [stamp, newest] = code ? lastCodeChange(root, code) : [Date.now(), null];
  if (code && !newest) {
    // every changed code file was deleted: a review any time after the branch point counts
    const branchPoint = git(root, 'log', '-1', '--format=%ct', git(root, 'merge-base', baseRef(root), 'HEAD') || 'HEAD');
    stamp = Number(branchPoint || 0) * 1000;
    newest = '(deleted files only)';
  }
  const runs = readLedger(root);
  const missing = GATE_ROLES.filter(role => (runs.get(role.toLowerCase()) ?? 0) + SLACK_MS < stamp);
  if (missing.length === 0) return 0;
  const seen = GATE_ROLES.filter(r => runs.has(r.toLowerCase()))
    .map(r => `${r} at ${clock(runs.get(r.toLowerCase()))}`).join(', ') || 'none';
  process.stderr.write(
    'Blocked by .claude/hooks/role-gate.mjs: this pull request changes code and the review gate has not ' +
    'run on the current state of it.\n' +
    `Run these project subagents on the full diff, fix what they find, then try again: ${missing.join(', ')}.\n` +
    `Last code change: ${newest || 'unknown'} at ${new Date(stamp).toISOString().slice(0, 10)} ${clock(stamp)}. Gate runs recorded: ${seen}.\n` +
    'A review counts only if it ran after the last code edit. Documentation-only changes pass without one.\n' +
    'The steps are in .claude/skills/implement-ticket/SKILL.md.\n',
  );
  return 2;
}

function selfTest() {
  const self = fileURLToPath(import.meta.url);
  const run = (root, mode, event, env = {}) => {
    const fullEnv = { ...process.env, ...env };
    if (!('ROLE_GATE' in env)) delete fullEnv.ROLE_GATE;
    return spawnSync(process.execPath, [self, mode], {
      input: JSON.stringify({ ...event, cwd: root }), encoding: 'utf8', env: fullEnv,
    }).status;
  };
  const sh = (root, ...args) => {
    const out = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    if (out.status !== 0) throw new Error(`git ${args.join(' ')}: ${out.stderr}`);
  };
  const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const pr = { tool_name: 'Bash', tool_input: { command: 'gh pr create --draft --title x --body y' } };
  const failures = [];
  const expect = (label, got, want) => {
    if (got !== want) failures.push(`${label}: exit ${got}, expected ${want}`);
  };

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'role-gate-'));
  try {
    sh(root, 'init', '-q', '-b', 'main');
    sh(root, 'config', 'user.email', 'test@example.invalid');
    sh(root, 'config', 'user.name', 'test');
    fs.writeFileSync(path.join(root, 'app.js'), 'export const x = 1;\n');
    sh(root, 'add', '-A');
    sh(root, 'commit', '-q', '-m', 'base');
    sh(root, 'checkout', '-q', '-b', 'feature');

    expect('other command passes', run(root, 'check', { tool_name: 'Bash', tool_input: { command: 'git status' } }), 0);
    expect('no change passes', run(root, 'check', pr), 0);

    fs.writeFileSync(path.join(root, 'README.md'), 'docs\n');
    expect('docs-only change passes', run(root, 'check', pr), 0);

    fs.writeFileSync(path.join(root, 'app.js'), 'export const x = 2;\n');
    expect('code change without review is blocked', run(root, 'check', pr), 2);
    expect('gh pr ready is gated too', run(root, 'check', { tool_name: 'Bash', tool_input: { command: 'cd x && gh pr ready 12' } }), 2);
    expect('owner switch passes', run(root, 'check', pr, { ROLE_GATE: 'off' }), 0);

    sleep(SLACK_MS + 1000);
    for (const role of GATE_ROLES.slice(0, -1)) run(root, 'record', { hook_event_name: 'SubagentStop', agent_type: role });
    if (GATE_ROLES.length > 1) expect('one gate role missing is blocked', run(root, 'check', pr), 2);
    run(root, 'record', { hook_event_name: 'SubagentStop', agent_type: GATE_ROLES.at(-1).toUpperCase() });
    expect('all gate roles after the edit pass', run(root, 'check', pr), 0);

    sh(root, 'add', '-A');
    sh(root, 'commit', '-q', '-m', 'change');
    expect('committing does not invalidate the review', run(root, 'check', pr), 0);

    sleep(SLACK_MS + 1000);
    fs.writeFileSync(path.join(root, 'app.js'), 'export const x = 3;\n');
    expect('code edited after the review is blocked again', run(root, 'check', pr), 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  if (failures.length) {
    console.log('role-gate self-test FAILED:\n  ' + failures.join('\n  '));
    return 1;
  }
  console.log(`role-gate self-test passed (gate roles: ${GATE_ROLES.join(', ')})`);
  return 0;
}

function main() {
  const mode = process.argv[2] ?? '';
  if (mode === '--self-test') return selfTest();
  let event;
  try {
    event = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return 0; // no readable event: never block on a malformed call
  }
  if (mode === 'record') return record(event);
  if (mode === 'check') return check(event);
  return 0;
}

process.exit(main());
