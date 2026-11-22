# UI quality rules

Ten rules the owner approved on 2026-11-22. They are binding, on top of the "Conventions" and "Forbidden" parts of [CLAUDE.md](../CLAUDE.md). They exist to keep the interface from looking machine-made.

1. No thick accent border on one side of a card, callout, alert, list item or quote (for example `border-left: 4px solid <accent>`). Use spacing, type weight, an icon or a full hairline border instead.
2. No soft tinted background with a thin border of the same hue as the default way to mark a status, tag, callout or card. One neutral surface and one clear signal (text, icon or a solid chip) is enough.
3. No gradient text and no purple-to-blue gradient as a default accent.
4. No blur or glass panels, and no drop shadow plus large radius on every card.
5. No emoji as icons or bullets, and no sparkle marks.
6. No pill or badge on things that are not states. No all-caps, letter-spaced micro labels as section decoration.
7. No centred hero with a slogan in an application screen. Screens open on the user's task.
8. One accent colour, used for the primary action and the current selection. Status colours only for status.
9. Dense, aligned layouts on a consistent spacing scale. No card grid where a table or a list is the right form.
10. User-facing copy is plain and specific: no filler, no exclamation marks, and the same word for the same thing everywhere (EN and NL).

In this repository the colours are the semantic tokens (`--colors-*`) and the components are in `src/app/ui/`. Fix a breach there, not with a one-off style in a feature.

## How the rules are applied

- A UI ticket starts with the `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max/`): run its design-system search for the product type (an admin dashboard for workforce management) before choosing layout, type or colour. Its output is advice; tokens and `src/app/ui/` still win.
- A UI ticket ends with a check of every changed screen against the ten rules above, in both themes. Name the rule number for each breach and fix it, or say why it stays.
- User-facing copy (`public/i18n/`), documentation and pull request text go through the `unslop` skill (`.claude/skills/unslop/`) before the pull request is opened.
- Enforcement is by the review gate: Code Reviewer checks the diff against this file on every ticket, and Frontend Developer and Accessibility Auditor use it as a checklist. No script enforces it. Rule 1 could be linted; rule 2 cannot be detected reliably from CSS.
- Changing a rule needs the owner ([docs/owner-decisions.md](owner-decisions.md)).
