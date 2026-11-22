# Provenance: unslop

- Upstream: https://github.com/theclaymethod/unslop
- Licence: MIT, as stated in upstream's `README.md` ("Licensed MIT"). Upstream has no `LICENSE` file and names no copyright holder (checked 2026-11-22), so the `LICENSE` next to this file is the standard MIT text with the holder given as the upstream account and its contributors. It was added on 2026-11-22 at the owner's request; it records the upstream statement and grants nothing beyond it.
- Copied from: the owner's installed copy at `C:/Users/jorte/.claude/skills/unslop/` (installed 2026-11-04), on 2026-11-22.
- Upstream commit: the installed copy carries no commit id. Upstream `main` was at `0f4a07f5ca8bb400b4d4450b00d67c6e4a30b85a` on 2026-11-22; the copy was not compared file by file with that commit.
- Why it is here: the owner decided on 2026-11-22 that user-facing copy, documentation and pull request text in this repository go through this skill (see `docs/owner-decisions.md`).

## What was copied

`SKILL.md`, `references/` (all of it), `presets/` (read by `SKILL.md`), `scripts/*.py` (the scanners the `cleanup` and other routed commands run) and one data file, `evals/fixtures/silhouette/human_reference.json`, which `scripts/silhouette_scan.py` reads.

## Local changes

1. Left out: upstream's `.github/`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `assets/`, `docs/`, `plans/`, `ruff.toml`, `__pycache__/`, and all of `evals/` except the one fixture above. The `contribute` and maintenance flows in `references/` point at eval files that are not here; they are for contributing upstream and are not used in this repository.
2. No file content was changed.
3. Added: this file and `LICENSE`.

Requires Python 3, no third-party packages. Smoke test: `python .claude/skills/unslop/scripts/banned_phrase_scan.py <file>`.
