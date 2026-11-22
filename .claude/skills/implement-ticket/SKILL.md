---
name: implement-ticket
description: Playbook for implementing a GitHub issue in this repository from start to pull request, with the project subagents run at fixed steps. Use whenever asked to implement, start, continue or finish a ticket, an issue or an epic child, for example "implement #12" or "work on the next ticket".
argument-hint: "[issue number]"
---

# Implement a ticket

Use this playbook for every implementation ticket in this repository. `CLAUDE.md` holds the commands, the architecture boundaries, the Git workflow and the evidence rules; where this playbook and `CLAUDE.md` differ, `CLAUDE.md` wins.

The project subagents in `.claude/agents/` are part of the work. Delegate to them at the steps below without waiting to be asked. If a step names a role that is not installed, do that step yourself and say so in the pull request.

## Steps

1. **Read the ticket.** `gh issue view <number>` and the epic it belongs to. Check that every prerequisite issue is closed and that no owner decision named in the ticket is still open. If the ticket is blocked, stop and say what blocks it.
2. **Read the rules.** `CLAUDE.md`, then the architecture notes it links to.
3. **Orient and check the approach.** Delegate as the table "Before coding" says. Settle open design questions before writing code. For a ticket that changes a screen, start with the `ui-ux-pro-max` skill (`python .claude/skills/ui-ux-pro-max/scripts/search.py "<product type>" --design-system`) and read [docs/ui-quality.md](../../../docs/ui-quality.md).
4. **Branch** as the Git workflow in `CLAUDE.md` says. Never work on the default branch.
5. **Implement** inside the ticket's stated scope. Delegate the work to the implementing role that matches the files being changed (table "While coding"). Do not widen scope; note anything else you find as a follow-up.
6. **Test.** Add or change tests for every acceptance criterion and material edge case, then run the checks listed in `CLAUDE.md`. Record each command and its result.
7. **Specialist review.** Run every role in the table "After coding" whose trigger matches the change. For a UI ticket, check every changed screen against the ten rules in [docs/ui-quality.md](../../../docs/ui-quality.md), in both themes, and fix or justify each breach.
8. **Review gate, always.** Run Code Reviewer on the full diff. Fix every material finding, re-run the checks, and have the reviewer look again until no material finding is left.
9. **Acceptance gate, always.** Run Reality Checker with the ticket's acceptance criteria and the recorded local evidence. It checks that the documented checks ran locally and passed and that CI is configured to run them; do not ask it to confirm a CI result, which does not exist yet. Do not call the ticket done unless it passes.
10. **Pull request text.** Add a line under Unreleased in `CHANGELOG.md`. Run the `unslop` skill on the user-facing copy, the documentation and the pull request description you wrote. Fill in the pull request template `.github/pull_request_template.md`: ticket, evidence, "Agent roles run", risks and rollback.
11. **Hand off.** Capture the evidence `CLAUDE.md` asks for. The review gate hook blocks `gh pr create` and `gh pr ready` until both gate roles ran after the last code edit. Order: local checks, both gates, then push and `gh pr create --draft` (part of this step when the owner asked for it in the current session; a `/next-ticket` run counts as that request), then CI on the draft. If CI fails, fix, re-run the local checks and both gates, and push. Mark the pull request ready (`gh pr ready`) only when CI is green on the current commit; never open one, or mark one ready, with a gate not run on the current diff. **Only the owner merges.** Do not merge, release or enable auto-merge.

## Roles

### Before coding

| Role | Access | Delegate to it |
|---|---|---|
| Codebase Onboarding Engineer | read-only reviewer | At the start of a ticket in an unfamiliar area, to trace the relevant code paths before anything is changed |
| Software Architect | read-only reviewer | Before implementing a ticket that adds or changes a module boundary, data model, storage schema, public API or dependency, to check the approach against the architecture notes |

### While coding

| Role | Access | Delegate to it |
|---|---|---|
| Backend Architect | can edit | When a ticket changes server-side code, HTTP routes, validation, persistence or data migrations. This repository has no server yet: that means the contract in `src/app/core/api/models.ts`, the mock API in `src/app/core/mock/`, the rules in `src/app/core/domain/` and the planned local-mode server |
| Frontend Developer | can edit | When a ticket changes browser-side code such as pages, components, client state, styling or keyboard interaction |
| Test Automation Engineer | can edit | When a ticket adds or changes tests, fixtures or a browser test harness, or when acceptance criteria need new automated checks |

### After coding

| Role | Access | Delegate to it |
|---|---|---|
| Accessibility Auditor | can edit | After a ticket changes user-facing UI, keyboard handling, focus order or markup |

### Gates that run on every ticket

| Role | Access | Delegate to it |
|---|---|---|
| Code Reviewer | read-only reviewer | After implementing or changing code for a ticket, after the local checks pass and before the pull request is opened |
| Reality Checker | read-only reviewer | As the last step of every ticket, to check each acceptance criterion against the recorded local evidence, before the pull request is opened; it does not judge CI |

## Rules

- The session or role that wrote a change does not count as its reviewer.
- Read-only reviewers cannot run commands. Give them the diff, the acceptance criteria and the recorded command output.
- Skills: `ui-ux-pro-max` at the start of a UI ticket and `unslop` before the pull request; both are in `.claude/skills/`.
- Each role file starts with an "In this repository" section. That section and `CLAUDE.md` win over the role's general advice (frameworks, dependencies, cloud services).
- In the pull request description, add a section "Agent roles run" listing each role that ran, what it was asked and its verdict, and any step you did yourself because a role was missing.
