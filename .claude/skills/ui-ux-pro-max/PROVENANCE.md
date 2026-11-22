# Provenance: ui-ux-pro-max

- Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Licence: MIT, Copyright (c) 2024 Next Level Builder. Full text in `LICENSE` next to this file (fetched from upstream at commit `6ec2bb58334ca3014573c4cbd4834ee3a40afd9d`).
- Copied from: the owner's installed copy at `C:/Users/jorte/.claude/skills/ui-ux-pro-max/` (installed 2026-11-04), on 2026-11-22.
- Upstream commit: the installed copy carries no commit id. Upstream `main` was at `6ec2bb58334ca3014573c4cbd4834ee3a40afd9d` on 2026-11-22; the copy was not compared file by file with that commit.
- Why it is here: the owner decided on 2026-11-22 that UI work in this repository uses this skill (see `docs/owner-decisions.md` and `docs/ui-quality.md`).

## Local changes

1. Commands in `SKILL.md` call `.claude/skills/ui-ux-pro-max/scripts/search.py` (project-relative, run from the repository root) instead of `"${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py"`.
2. Left out: `scripts/tests/` (upstream's own test suite and fixtures) and `__pycache__/`.
3. Added: this file and `LICENSE`.

Requires Python 3, no third-party packages. Smoke test: `python .claude/skills/ui-ux-pro-max/scripts/search.py "keyboard focus modal" --domain ux -n 1`.
