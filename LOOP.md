# Loop Configuration — Issue Triage

Scaffolded with `@cobusgreyling/loop@0.2.0` (`init . --pattern issue-triage --tool claude`). Setup record, doctor and status results: [docs/agents-and-loop.md](docs/agents-and-loop.md).

## Active Loops

| Pattern      | Cadence                     | Status                 | Command                                |
| ------------ | --------------------------- | ---------------------- | -------------------------------------- |
| Issue Triage | Manual, at most one per day | L1 report-only (fixed) | `claude` then `/issue-triage` (manual) |

Level: **L1 report-only**. A run reads the open issues and pull requests of `jortega0033/ng-runway` and rewrites `issue-triage-state.md`. It does nothing else.

## Disabled on purpose

- No scheduler. Do not start `/loop`, cron jobs, scheduled tasks or a GitHub Actions workflow for this loop. `loop init` generated no workflow file and none was added.
- No automated source fixes. A triage run never edits files outside `issue-triage-state.md` and `loop-run-log.md`.
- No label, comment, close, push, pull request or merge from a loop run. Auto-merge stays off.
- Raising the level (L2 label apply, fix-capable patterns) needs an explicit owner decision recorded in this file first.

## Ticket work is not a loop run

Implementing tickets is not a loop run. It is started by the owner with `/next-ticket` and governed by [CLAUDE.md](CLAUDE.md), the `implement-ticket` playbook, the review gate hook, CI and branch protection. The loop stays at L1: report-only and unscheduled.

## Human Gates

- Priority assignment (P0, P1) — human only. A loop run may propose a priority in `issue-triage-state.md`; it never writes one to an issue
- Auth, the local API session model, security, public API — always escalate
- Duplicate closure — human confirms
- Stale issue closure — human confirms
- Anything under `tokens/` (`tokens.css`, `tokens.json` are the source of truth) — human only

## Manual triage run

From the repository root:

```bash
claude
# then, in the session:
/issue-triage
```

Afterwards append one entry to `loop-run-log.md` and check the result:

```bash
npx --yes @cobusgreyling/loop@0.2.0 doctor .
npx --yes @cobusgreyling/loop@0.2.0 status .
```

## Worktree isolation

Agent sessions work in their own Git worktree under `.claude/worktrees/` and on their own branch. A loop run never writes to the owner's main checkout and never commits to `main`; changes reach `main` through a reviewed pull request ([CONTRIBUTING.md](CONTRIBUTING.md)).

## Budget

- Max sub-agent spawns per run: 0 (L1)
- See `loop-budget.md`

## Files

- `issue-triage-state.md` — current triage state, rewritten by each run
- `loop-run-log.md` — one entry per run
- `loop-budget.md`, `loop-constraints.md` — limits and binding rules
- `.claude/skills/issue-triage`, `.claude/skills/loop-budget`, `.claude/skills/loop-constraints`, `.claude/skills/loop-intake` — the skills the loop uses
- `.claude/agents/loop-verifier.md` — checker role, unused at L1

## Links

- Upstream pattern: [issue-triage](https://github.com/cobusgreyling/loop-engineering/blob/959fad23efa52456d3b478bd78eca1b1b4d9e88a/patterns/issue-triage.md)
- Upstream quick start: [QUICKSTART](https://github.com/cobusgreyling/loop-engineering/blob/959fad23efa52456d3b478bd78eca1b1b4d9e88a/docs/QUICKSTART.md)
