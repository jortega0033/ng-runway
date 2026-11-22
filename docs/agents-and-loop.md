# Agent roles and the triage loop

Project-local setup for Claude Code: the agent roles in `.claude/agents/` and the Loop Engineering issue-triage loop. Both were added on 2026-11-22 as preparation; neither changes app code.

## Agent roles

Source: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents), MIT license, pinned to revision `8ae6164602c95ca78828b148b9052460ee426885` (commit dated 2026-11-09). The license text is in `.claude/agents/LICENSE.agency-agents.txt` (Copyright (c) 2025 AgentLand Contributors).

| Role (`name`)                | File in `.claude/agents/`                     | Upstream path                                             | Tools              | Use it for                                                            |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| Software Architect           | `engineering-software-architect.md`           | `engineering/engineering-software-architect.md`           | `Read, Grep, Glob` | Reviewing a design or ADR before code, such as the local API decision |
| Code Reviewer                | `engineering-code-reviewer.md`                | `engineering/engineering-code-reviewer.md`                | `Read, Grep, Glob` | Reviewing a diff before a pull request                                |
| Codebase Onboarding Engineer | `engineering-codebase-onboarding-engineer.md` | `engineering/engineering-codebase-onboarding-engineer.md` | `Read, Grep, Glob` | Tracing a flow through the code with citations                        |
| Reality Checker              | `testing-reality-checker.md`                  | `testing/testing-reality-checker.md`                      | `Read, Grep, Glob` | Checking that the recorded evidence supports "done"                   |
| Frontend Developer           | `engineering-frontend-developer.md`           | `engineering/engineering-frontend-developer.md`           | inherited          | Angular work in `src/app/`                                            |
| Backend Architect            | `engineering-backend-architect.md`            | `engineering/engineering-backend-architect.md`            | inherited          | The API contract, the mock API and the planned local-mode server      |
| Test Automation Engineer     | `testing-test-automation-engineer.md`         | `testing/testing-test-automation-engineer.md`             | inherited          | Vitest specs, Playwright in `e2e/` and `node --test` files            |
| Accessibility Auditor        | `testing-accessibility-auditor.md`            | `testing/testing-accessibility-auditor.md`                | inherited          | Accessibility checks; the axe gate is `e2e/a11y.spec.ts`              |

Changes to the upstream files: the four review roles got one added frontmatter line, `tools: Read, Grep, Glob`, so they cannot edit files or run commands. Nothing else was changed. The other four files are byte-identical to the pin. Upstream definitions have no `tools` field, so those four inherit every tool of the session.

The role texts are general. Where a role's examples disagree with this repository (React examples, a UI kit, a cloud backend), [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) win.

### Name collisions

Claude Code identifies an agent by its `name`. A machine that has Agency Agents installed at user level (`~/.claude/agents/`) already has agents with these eight names. Inside this repository the project copy takes precedence, which is intended: it pins the revision and makes the review roles read-only. Outside the repository the user-level copy applies as before. The names were kept as upstream so the roles stay recognizable; rename the `name` field if a distinct name is ever needed.

`loop-verifier.md` in the same folder comes from Loop Engineering, not from Agency Agents.

### Effect on the built stylesheet

`src/styles.css` uses Tailwind's automatic source detection, which reads text files across the project folder, not only `src/`. It read the role files in a build made before they were committed. Two lines in them produce unused rules in the production CSS: `engineering-backend-architect.md:197` (`[users:read]`, emitted as a rule with the declaration `users: read`) and `engineering-frontend-developer.md:159` (`focus-visible:outline`). This was found by comparing the class selectors in a build made with these files against the text of the files on `main`; the comparison approximates Tailwind's matching, so there may be more. No element uses these classes, so nothing changes on screen, but the stylesheet that ships is not identical.

Excluding the folder from the scan is a change to app source (an exclusion such as Tailwind's `@source not` directive in `src/styles.css`) and was left for the owner to decide. It is not part of this setup and was not tested.

### Updating

Fetch a file at a new revision with `gh api "repos/msitarzewski/agency-agents/contents/<upstream path>?ref=<sha>" --jq .content | base64 -d`, re-add the `tools` line to the review roles, and update the revision in this file.

### Load check

Recorded 2026-11-22 from the repository root of a worktree with Claude Code 2.1.323:

1. `claude -p "Reply with the single word OK." --output-format stream-json --verbose --max-turns 1` lists the loaded agents in its `init` event. All eight role names and `loop-verifier` were in that list, and the four loop skills were in `skills`. `loop-verifier` exists only in this repository, so the project folder is being read.
2. Because the eight names also exist at user level on the machine that ran the check, a second headless run asked the `Software Architect` agent to list its tools. It answered `Read, Grep, Glob`, which only the project copy declares. The project copy is the one in effect.

The other three read-only roles were not spawned individually; they use the same mechanism and the same frontmatter line.

## Triage loop

Source: [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering), MIT license, npm package `@cobusgreyling/loop@0.2.0`. The links to upstream documentation in `LOOP.md` point at repository revision `959fad23efa52456d3b478bd78eca1b1b4d9e88a`.

Scaffolded with:

```bash
npx --yes @cobusgreyling/loop@0.2.0 init . --pattern issue-triage --tool claude
```

The pattern is `issue-triage` at **L1 report-only**. The operating rules are in [LOOP.md](../LOOP.md) and [loop-constraints.md](../loop-constraints.md): manual runs only, no scheduler, no automated source fixes, no labels, comments, pushes or merges from a run.

### What init generated and what was changed

- Kept: `LOOP.md`, `issue-triage-state.md`, `loop-budget.md`, `loop-constraints.md`, `loop-run-log.md`, `.claude/agents/loop-verifier.md`, and the skills `issue-triage`, `loop-budget`, `loop-constraints` and `loop-intake` under `.claude/skills/`.
- Removed: `.grok/` and `.codex/`. The package has no Claude-only variant of this pattern and also writes Grok and Codex copies; this setup is for Claude Code.
- Edited: the project name placeholder, the broken relative links in `LOOP.md`, the budget (one manual run per day, no sub-agents), and a repository section in `loop-constraints.md`.
- No workflow file was generated under `.github/workflows/`, so there was no scheduled workflow to disable.
- `.gitignore` ignored all of `.claude/skills/`. It now ignores everything there except the four loop skills, so locally installed skills stay untracked.
- `.prettierignore` lists `issue-triage-state.md` and `loop-run-log.md`, because triage runs rewrite them.

### Doctor and status

Recorded 2026-11-22 on the final configuration, Node v22.23.4, Windows:

```text
$ npx --yes @cobusgreyling/loop@0.2.0 doctor .
Ready:   100/100 L2
         Strong structure but no proven loop runs yet — run one L1 cycle and commit state before L3.
Sync:    n/a
Files:   state=issue-triage-state.md  LOOP.md=yes  budget=yes  run-log=yes  gate=no
Status:  HEALTHY (exit 0)

Top next actions:
  1. Copy or create docs/safety.md (denylists, auto-merge policy, MCP scopes)
  2. Add patterns/registry.yaml following the existing format
  3. Add gate.yaml to define explicit human approval gates.

Notes:
  · Could not parse loop-sync JSON output

$ npx --yes @cobusgreyling/loop@0.2.0 status .
  Pattern:  issue-triage
  Ready:    100/100  L2
  State:    issue-triage-state.md · not yet run
  Budget:   loop-budget.md  · gate=no  · constraints=yes
  Recent runs:
    (none in loop-run-log.md)
  Next: Schedule a report-only first run and append loop-run-log.md
```

Both commands exited 0. How to read this:

- "L2" is the audit's score for the files that exist. It is not the level the loop runs at. The loop is L1 report-only and stays there until the owner decides otherwise in `LOOP.md`.
- "Sync: n/a" with the parse note means doctor could not read the output of its own sync step. It did not fail the check. The cause was not investigated.
- The three next actions are optional scaffolding and were not done. The human gates are listed in `LOOP.md`.
- Status suggests scheduling a first run. Do not schedule one; start it by hand as described below.

One doctor finding was fixed during setup: it asked for `allowed-tools` in the skill frontmatter. `.claude/skills/issue-triage/SKILL.md` now declares `Read, Grep, Glob, Edit` and four read-only `gh` commands (`gh issue list`, `gh issue view`, `gh pr list`, `gh pr view`). That line pre-approves those tools for the skill; it is not a sandbox. The binding limits are in `loop-constraints.md`.

### Next manual triage

```bash
claude
# in the session:
/issue-triage
```

Then append an entry to `loop-run-log.md` and run `npx --yes @cobusgreyling/loop@0.2.0 doctor .`. No triage run has been made yet; `issue-triage-state.md` is the empty template.

## Local change: automatic delegation (2026-11-22)

One sentence beginning "Use proactively" was appended to the `description:` line of every Agency Agents role in `.claude/agents/` (not to `loop-verifier`). Claude Code uses that field to decide when to delegate, so the roles now run during ticket work without being named. Nothing else in the role files changed in that step.

This supersedes any statement above that a role file is unmodified or that the `tools:` line is the only local change.

The steps at which each role runs are in `.claude/skills/implement-ticket/SKILL.md`.

### Project section in every role

A section headed "In this repository" was then inserted directly after the frontmatter of every Agency Agents role (not in `loop-verifier`). It is project-specific text written for this repository, not upstream text. It says what the role owns here, which commands from [CLAUDE.md](../CLAUDE.md) it runs (or, for the read-only roles, what the caller must hand over), which rules of this project it checks and where each is written down, which parts of the generic text do not apply, and what the role hands back. Each section ends with the sentence "This section and CLAUDE.md override the generic text below wherever they differ." This replaces the paragraph above that begins "The role texts are general".

The frontmatter and the upstream text below the section were not touched: removing the section gives back the file of the previous commit byte for byte (checked for all eight files when the sections were inserted).

To compare a role with the pinned upstream file, remove three things first: the "In this repository" section (from its heading up to the line before the role's first `# ` heading), the "Use proactively" sentence, and the `tools:` line where one was added.

The sections describe the repository at the commit that added them: issues #1 to #9 open, no local mode in the code. They go stale the same way `docs/architecture.md` does, so correct a section in the pull request that makes one of its statements untrue.

Two side effects:

- The line numbers in "Effect on the built stylesheet" above were moved to match the longer files. No build was run for this change, so the sections were not compared with the built stylesheet. The plain words in them that are also Tailwind class names (`fixed`, `visible`, `blur`) already occur in other scanned files such as `AGENTS.md`.
- `.claude/skills/implement-ticket/SKILL.md` is tracked from this commit on. The commit that wrote it did not include it, because `.gitignore` ignores `.claude/skills/*` apart from the four loop skills. It was added with `git add -f` and `.gitignore` was left as it is, so another new file in that folder stays ignored until it is added the same way or the owner adds an exception.

### Verification

2026-11-22, Claude Code 2.1.323, from the root of the worktree, with the sections in place and before the commit: one headless run, `claude -p "List every project subagent defined in .claude/agents with its exact name and tools, say for each whether its instructions begin with a section titled In this repository, and say whether a skill named implement-ticket is available. Plain list, no commentary." --model haiku`, exited 0. It listed the eight roles by their exact names, with `Read, Grep, Glob` for Code Reviewer, Codebase Onboarding Engineer, Software Architect and Reality Checker and no `tools` line for the other four, answered "yes" for the "In this repository" section on all eight and "no" for `loop-verifier`, and reported the `implement-ticket` skill as available and in its skill list. This is what one model run reported after looking at the folder; no role was started as a subagent in this check, and no ticket was run through the playbook.

## Local change: SDLC kit (2026-11-22)

This pass added the delivery workflow around the roles. No role text other than the three lines below was changed.

- Review gate hook `.claude/hooks/role-gate.mjs` and `.claude/settings.json` (permissions and hooks); `.claude/state/` is git-ignored.
- `.claude/skills/next-ticket/` (owner-started driver), changes to `.claude/skills/implement-ticket/`, and the copies of `ui-ux-pro-max` and `unslop` with their `PROVENANCE.md` files; `.gitignore` tracks all four.
- One checklist line naming `docs/ui-quality.md` in the "In this repository" section of Frontend Developer, Code Reviewer and Accessibility Auditor. UI Designer and UX Architect are not installed here.
- `.github/` pull request template, issue template, CODEOWNERS and Dependabot; `SECURITY.md`, `CHANGELOG.md`, `docs/RELEASING.md`, `docs/ui-quality.md` and `docs/owner-decisions.md`.
- A "Delivery workflow" part in `CLAUDE.md` and `AGENTS.md`, and a note in `LOOP.md` that ticket work is not a loop run.

The existing CI workflow was not changed.
