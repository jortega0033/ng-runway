---
name: next-ticket
description: Owner-started driver that takes one ticket of epic #8 (offline employee-to-manager timesheet workflow in local SQLite mode) from the queue to a ready pull request. Starting it is the owner's go signal.
argument-hint: "[issue number]"
disable-model-invocation: true
---

# Next ticket

The owner starts this with `/next-ticket` or `/next-ticket <issue number>`. That start is the go signal for this run, and it counts as the owner's request to push the ticket branch and open the pull request for this one ticket. Nothing else starts ticket work: there is no scheduler and no loop run does it ([LOOP.md](../../../LOOP.md)).

One ticket per run. This skill never merges, never releases and never starts another run by itself. Only the owner merges.

Repository: `jortega0033/ng-runway`. Epic: #8. Labels: `status:ready`, `status:blocked`, `status:in-progress`, `needs-decision`.

## Steps

1. **Refresh the queue.** Read epic #8 and its children with `gh issue list -R jortega0033/ng-runway --state open --limit 100` and `gh issue view`. For each `status:blocked` ticket whose prerequisites (the "Depends on" line of the issue) are all closed, change its label to `status:ready`. Do not change the dependency lines.
2. **Pick the ticket.**
   - With an issue number: use it, but stop and say why if it is closed, `status:blocked`, `status:in-progress` or `needs-decision`.
   - Without one: take the first `status:ready` ticket in the epic's dependency order (the table "Tickets in dependency order" in #8) that is not `status:in-progress` and not `needs-decision`.
   - If none qualifies, say so, list what blocks each open ticket, and stop. Do not guess.
3. **Claim it.** Label the issue `status:in-progress` (remove `status:ready`).
4. **Branch and worktree.** Follow "Git workflow" in [CLAUDE.md](../../../CLAUDE.md): never work on `main`. Create a branch named `<type>/<issue number>-<short slug>` (conventional-commit type) in a fresh worktree under `.claude/worktrees/`, cut from the current `main`. Leave other checkouts and their uncommitted files alone.
5. **Implement.** Run the [implement-ticket](../implement-ticket/SKILL.md) playbook for that issue from its step 1 to its last step: the roles, both gates, the evidence, the changelog line, the pull request template.
6. **Pull request.** The playbook has you push the branch and open the pull request as a draft. The review gate hook blocks `gh pr create` and `gh pr ready` until Code Reviewer and Reality Checker have run after the last code edit. When both gates have passed on the current diff and CI is green on the current commit, mark the pull request ready (`gh pr ready`). Never open or mark a pull request ready with a gate open.
7. **Report.** Comment on the issue with the pull request link, the evidence summary and anything left for the owner. Replace nothing else on the issue.
8. **Stop.** Report the pull request, the evidence and any open question. The owner reviews and merges.

## Stop and ask the owner when

- the ticket names an open owner decision with no stated default ([docs/owner-decisions.md](../../../docs/owner-decisions.md) lists the ones already settled);
- a decision recorded there blocks the work;
- a gate fails twice on the same finding, or CI stays red for a reason outside the ticket;
- the ticket needs a change to `tokens/tokens.css` or `tokens/tokens.json`, `dependencies`, or install scripts, which `CLAUDE.md` forbids.

Say what is blocked and why, put `needs-decision` on the issue if that label fits, and end the run.
