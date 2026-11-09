---
description: Scaffold a new feature folder with the generator, then flesh it out with the angular-engineer skill
argument-hint: <feature-name>
allowed-tools: Bash(npm run *), Read, Grep, Glob, Edit, Write
---

Feature name: $ARGUMENTS

1. If no feature name was given, ask for one (lowercase kebab-case, for example `time-off`) and stop.
2. Run `npm run gen:feature -- $ARGUMENTS`. If the script is missing or fails, report the error and stop; do not create the files by hand.
3. List the files the generator created.
4. Use the `angular-engineer` skill to flesh the feature out. Follow `CLAUDE.md`: reuse components from `src/app/ui` and semantic tokens (`--colors-*`), signal services, Transloco keys for text, no new one-off components.
5. Add or update tests next to the code, then verify with `npm run verify`. Report pass or fail per step and what you did not check.
