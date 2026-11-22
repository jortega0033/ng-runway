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
 * The gate judges the branch being proposed, not just the session's directory:
 * a `cd`/`Set-Location`/`pushd` before `gh pr` moves the judged directory,
 * `--head <branch>` selects the worktree that has that branch checked out (or the
 * branch's commits when no worktree has it), and `gh pr ready <n>` run from a
 * clean main checkout looks up the pull request's head branch.
 *
 * The ledger lives in the repository's common git dir (claude-role-runs.jsonl),
 * so the main checkout and every worktree share it. The older per-checkout
 * .claude/state/role-runs.jsonl is still read.
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
const LEDGER = path.join('.claude', 'state', 'role-runs.jsonl'); // legacy, read only
const SHARED_LEDGER = 'claude-role-runs.jsonl'; // in the common git dir
const PR_COMMAND = /(?:^|[\s;&|(])gh(?:\.exe)?\s+pr\s+(create|ready)\b/;
const ARG = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s;&|()]+))`;
const CD_COMMAND = new RegExp(
  String.raw`(?:^|[\s;&|(])(?:cd|chdir|pushd|Set-Location|Push-Location|sl)\s+` +
  String.raw`(?:(?:-Path|-LiteralPath|-L|-P|/d)\s+)?` + ARG,
  'gi',
);
const HEAD_OPTION = new RegExp(String.raw`(?:^|\s)(?:--head|-H)(?:=|\s+)` + ARG);
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

function realPath(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

const samePath = (a, b) => {
  const norm = p => (process.platform === 'win32' ? realPath(p).toLowerCase() : realPath(p));
  return norm(a) === norm(b);
};

/** Absolute path of the git dir shared by the main checkout and all worktrees. */
function commonDir(root) {
  const out = git(root, 'rev-parse', '--git-common-dir');
  return out ? path.resolve(root, out) : null;
}

/** [[path, branch name or null]] from `git worktree list --porcelain`; the main checkout is first. */
function worktrees(root) {
  const trees = [];
  for (const line of (git(root, 'worktree', 'list', '--porcelain') ?? '').split('\n')) {
    if (line.startsWith('worktree ')) trees.push([line.slice('worktree '.length), null]);
    else if (line.startsWith('branch refs/heads/') && trees.length) trees.at(-1)[1] = line.slice('branch refs/heads/'.length);
  }
  return trees;
}

const currentBranch = root => git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD');

function isMainCheckout(root) {
  const trees = worktrees(root);
  return trees.length > 0 && samePath(trees[0][0], root);
}

const firstArg = m => m.slice(1).find(g => g !== undefined) ?? '';

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function localPath(raw, current) {
  if (raw === '~' || raw.startsWith('~/') || raw.startsWith('~\\')) raw = path.join(os.homedir(), raw.slice(1));
  if (process.platform === 'win32') {
    const drive = /^\/([a-zA-Z])(?:\/|$)/.exec(raw); // Git Bash style /d/Projects
    if (drive) raw = `${drive[1]}:/${raw.slice(3)}`;
  }
  return path.resolve(current, raw);
}

/** Directory the `gh pr` part runs in: cwd, moved by any cd/Set-Location/pushd before it. */
function targetDir(command, match, cwd) {
  let current = cwd;
  for (const cd of command.slice(0, match.index).matchAll(CD_COMMAND)) {
    const raw = firstArg(cd).trim();
    if (raw === '' || raw === '-') continue;
    const candidate = localPath(raw, current);
    if (isDir(candidate)) current = candidate; // a cd that would fail leaves the directory unchanged
  }
  return current;
}

function headBranch(rest) {
  const found = HEAD_OPTION.exec(rest);
  if (!found) return null;
  const branch = firstArg(found).trim();
  return branch.includes(':') ? branch.split(':').slice(1).join(':') : branch || null; // owner:branch
}

function readyTarget(rest) {
  const segment = rest.split(/[;&|]/)[0];
  for (let token of segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []) {
    token = token.replace(/^["']+|["']+$/g, '');
    if (token && !token.startsWith('-')) return token;
  }
  return null;
}

function prHead(root, target) {
  const out = spawnSync('gh', ['pr', 'view', target, '--json', 'headRefName', '--jq', '.headRefName'], {
    encoding: 'utf8', timeout: 20000, cwd: root,
  });
  if (out.error || out.status !== 0) return null;
  return out.stdout.trim() || null;
}

/** [directory, ref]: the worktree that has the branch checked out, or the repo plus a ref to judge by commits. */
function locateBranch(root, branch) {
  for (const [p, name] of worktrees(root)) {
    if (name === branch && isDir(p)) return [p, null];
  }
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    if (git(root, 'rev-parse', '--verify', '--quiet', ref) !== null) return [root, ref];
  }
  return [root, branch]; // unknown branch: judged as "cannot tell what changed"
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

/** null when nothing needs a review, else [timestamp ms, path] of the last code change. */
function assessCheckout(root) {
  const files = changedFiles(root);
  if (files === null) return [Date.now(), null]; // cannot tell what changed: require the gate
  const code = files.filter(isCode);
  if (code.length === 0) return null; // documentation or agent configuration only
  let [stamp, newest] = lastCodeChange(root, code);
  if (!newest) {
    // every changed code file was deleted: a review any time after the branch point counts
    const branchPoint = git(root, 'log', '-1', '--format=%ct', git(root, 'merge-base', baseRef(root), 'HEAD') || 'HEAD');
    stamp = Number(branchPoint || 0) * 1000;
    newest = '(deleted files only)';
  }
  return [stamp, newest];
}

/** Like assessCheckout, for a branch that is not checked out: judged by its commits. */
function assessBranch(root, ref) {
  const base = baseRef(root);
  const mergeBase = base ? git(root, 'merge-base', base, ref) : null;
  const files = mergeBase ? git(root, 'diff', '--name-only', `${mergeBase}..${ref}`) : null;
  if (files === null) return [Date.now(), null]; // cannot tell what changed: require the gate
  if (!files.split('\n').some(name => name && isCode(name))) return null;
  const log = git(root, 'log', '--format=%x00%ct', '--name-only', `${mergeBase}..${ref}`) ?? '';
  let newest = 0;
  let newestPath = null;
  for (const chunk of log.split('\0').slice(1)) {
    const lines = chunk.split('\n').filter(line => line.trim());
    const code = lines.slice(1).filter(isCode);
    if (lines.length && code.length && Number(lines[0]) * 1000 > newest) {
      newest = Number(lines[0]) * 1000;
      newestPath = code[0];
    }
  }
  if (!newestPath) return [Date.now(), null];
  return [newest, newestPath];
}

function ledgerPaths(root) {
  const paths = [];
  const shared = commonDir(root);
  if (shared) paths.push(path.join(shared, SHARED_LEDGER));
  paths.push(path.join(root, LEDGER));
  const trees = worktrees(root);
  if (trees.length) paths.push(path.join(trees[0][0], LEDGER));
  const unique = [];
  for (const p of paths) if (!unique.some(seen => samePath(p, seen))) unique.push(p);
  return unique;
}

function readLedger(paths) {
  const runs = new Map();
  for (const file of paths) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      try {
        const entry = JSON.parse(line);
        const role = String(entry.role ?? '').trim().toLowerCase();
        let stamp = Number(entry.ts ?? 0);
        if (stamp > 0 && stamp < 1e11) stamp *= 1000; // written in seconds by role_gate.py
        if (role && stamp > (runs.get(role) ?? 0)) runs.set(role, stamp);
      } catch {
        /* skip unreadable lines */
      }
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
  const shared = commonDir(root);
  const file = shared ? path.join(shared, SHARED_LEDGER) : path.join(root, LEDGER);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ role, ts: Date.now(), session: event.session_id ?? '' }) + '\n');
  return 0;
}

const clock = ms => new Date(ms).toLocaleTimeString('en-GB', { hour12: false });

function check(event) {
  const command = String(event.tool_input?.command ?? '');
  const match = PR_COMMAND.exec(command);
  if (!match) return 0;
  if ((process.env.ROLE_GATE ?? '').toLowerCase() === 'off') {
    process.stderr.write('role gate: switched off by ROLE_GATE=off for this session\n');
    return 0;
  }
  let root = repoRoot(targetDir(command, match, String(event.cwd || process.cwd())));
  if (!root) return 0; // not a git checkout: nothing to gate
  const rest = command.slice(match.index + match[0].length);
  const head = headBranch(rest);
  let ref = null;
  if (head && head !== currentBranch(root)) [root, ref] = locateBranch(root, head);
  let verdict = ref ? assessBranch(root, ref) : assessCheckout(root);
  if (verdict === null && match[1] === 'ready' && !head && isMainCheckout(root)) {
    const target = readyTarget(rest);
    const lookedUp = target ? prHead(root, target) : null;
    if (lookedUp && lookedUp !== currentBranch(root)) {
      [root, ref] = locateBranch(root, lookedUp);
      verdict = ref ? assessBranch(root, ref) : assessCheckout(root);
    }
  }
  if (verdict === null) return 0;
  const [stamp, newest] = verdict;
  const runs = readLedger(ledgerPaths(root));
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
  const gh = command => ({ tool_name: 'Bash', tool_input: { command } });
  const stop = role => ({ hook_event_name: 'SubagentStop', agent_type: role });
  const newRepo = root => {
    fs.mkdirSync(root, { recursive: true });
    sh(root, 'init', '-q', '-b', 'main');
    sh(root, 'config', 'user.email', 'test@example.invalid');
    sh(root, 'config', 'user.name', 'test');
    fs.writeFileSync(path.join(root, 'app.js'), 'export const x = 1;\n');
    sh(root, 'add', '-A');
    sh(root, 'commit', '-q', '-m', 'base');
  };
  const pr = gh('gh pr create --draft --title x --body y');
  const failures = [];
  const expect = (label, got, want) => {
    if (got !== want) failures.push(`${label}: got ${got}, expected ${want}`);
  };

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-gate-'));
  try {
    const root = path.join(temp, 'single');
    newRepo(root);
    sh(root, 'checkout', '-q', '-b', 'feature');

    expect('other command passes', run(root, 'check', gh('git status')), 0);
    expect('no change passes', run(root, 'check', pr), 0);

    fs.writeFileSync(path.join(root, 'README.md'), 'docs\n');
    expect('docs-only change passes', run(root, 'check', pr), 0);

    fs.writeFileSync(path.join(root, 'app.js'), 'export const x = 2;\n');
    expect('code change without review is blocked', run(root, 'check', pr), 2);
    expect('gh pr ready is gated too', run(root, 'check', gh('cd x && gh pr ready 12')), 2);
    expect('owner switch passes', run(root, 'check', pr, { ROLE_GATE: 'off' }), 0);

    sleep(SLACK_MS + 1000);
    for (const role of GATE_ROLES.slice(0, -1)) run(root, 'record', stop(role));
    if (GATE_ROLES.length > 1) expect('one gate role missing is blocked', run(root, 'check', pr), 2);
    run(root, 'record', stop(GATE_ROLES.at(-1).toUpperCase()));
    expect('all gate roles after the edit pass', run(root, 'check', pr), 0);

    sh(root, 'add', '-A');
    sh(root, 'commit', '-q', '-m', 'change');
    expect('committing does not invalidate the review', run(root, 'check', pr), 0);

    sleep(SLACK_MS + 1000);
    fs.writeFileSync(path.join(root, 'app.js'), 'export const x = 3;\n');
    expect('code edited after the review is blocked again', run(root, 'check', pr), 2);

    const legacy = path.join(root, LEDGER);
    fs.mkdirSync(path.dirname(legacy), { recursive: true });
    fs.writeFileSync(legacy, GATE_ROLES.map(r => JSON.stringify({ role: r, ts: Date.now() + 1000 }) + '\n').join(''));
    expect('old .claude/state ledger still counts', run(root, 'check', pr), 0);

    // main checkout clean on main, ticket work in a worktree
    const main = path.join(temp, 'main');
    const tree = path.join(temp, 'wt');
    newRepo(main);
    sh(main, 'worktree', 'add', '-q', '-b', 'wt-feature', tree);
    sleep(SLACK_MS + 1000);
    fs.writeFileSync(path.join(tree, 'app.js'), 'export const x = 2;\n');

    expect('clean main checkout alone passes', run(main, 'check', pr), 0);
    const cdCreate = gh(`cd "${tree}" && gh pr create --draft --title x --body y`);
    expect('(a) cd <worktree> && gh pr create is blocked', run(main, 'check', cdCreate), 2);
    expect('(a) relative cd ../wt is blocked', run(main, 'check', gh('cd ../wt && gh pr create --fill')), 2);
    if (process.platform === 'win32') { // backslash paths only exist on Windows
      expect('(a) Set-Location with backslashes is blocked',
        run(main, 'check', gh(`Set-Location '${tree.replace(/\//g, '\\')}'; gh pr create --fill`)), 2);
    }
    const headCreate = gh('gh pr create --head wt-feature --title x --body y');
    expect('(b) gh pr create --head <branch> from main is blocked', run(main, 'check', headCreate), 2);
    expect('(b) -R does not change the directory',
      run(main, 'check', gh('gh pr create -R owner/repo -H wt-feature --fill')), 2);

    sleep(SLACK_MS + 1000);
    run(main, 'record', stop(GATE_ROLES[0]));
    if (GATE_ROLES.length > 1) {
      expect('(c) one role recorded from main, check in worktree is blocked', run(tree, 'check', pr), 2);
    }
    for (const role of GATE_ROLES.slice(1)) run(main, 'record', stop(role));
    expect('(c) roles recorded from main count in the worktree', run(tree, 'check', pr), 0);
    expect('(c) cd <worktree> passes after review', run(main, 'check', cdCreate), 0);
    expect('(c) --head <branch> passes after review', run(main, 'check', headCreate), 0);
    expect('(c) ledger is in the common git dir', fs.existsSync(path.join(main, '.git', SHARED_LEDGER)), true);

    // a branch that no worktree has checked out: judged by its commits
    sleep(SLACK_MS + 1000);
    const side = path.join(temp, 'side');
    sh(main, 'worktree', 'add', '-q', '-b', 'side', side, 'main');
    fs.writeFileSync(path.join(side, 'lib.js'), 'export const y = 1;\n');
    sh(side, 'add', '-A');
    sh(side, 'commit', '-q', '-m', 'side change');
    sh(main, 'worktree', 'remove', side);
    const sideCreate = gh('gh pr create --head side --fill');
    expect('(d) branch judged by commits is blocked before review', run(main, 'check', sideCreate), 2);
    sleep(1000);
    for (const role of GATE_ROLES) run(tree, 'record', stop(role));
    expect('(d) branch judged by commits passes after review', run(main, 'check', sideCreate), 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
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
  if (!event || typeof event !== 'object' || Array.isArray(event)) return 0;
  if (mode === 'record') return record(event);
  if (mode === 'check') return check(event);
  return 0;
}

process.exit(main());
