# Loop Budget — ng-runway

> Primary loop: **Issue Triage** (scaffolded by loop-init)

## Daily limits

| Loop         | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
| ------------ | ------------ | -------------- | ------------------------ |
| Issue Triage | 1 (manual)   | 80k            | 0 (L1)                   |

## On budget exceed

1. Stop the manual run. No scheduler exists for this loop (see `LOOP.md`); if one was added, delete it
2. Append event to `loop-run-log.md`
3. Tell the owner in the session; do not post to GitHub from a loop run

## Kill switch

- Command or issue label: `loop-pause-all`
- Resume only after the owner clears the flag in `issue-triage-state.md`

## Estimate spend

```bash
npx --yes @cobusgreyling/loop@0.2.0 cost --pattern issue-triage --level L1
```
