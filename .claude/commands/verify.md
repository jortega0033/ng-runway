---
description: Run the full verification (npm run verify) and report pass or fail per step
allowed-tools: Bash(npm run *)
---

Run `npm run verify`.

Report concisely:

- One line per step (for example tokens check, lint, format, typecheck, tests, build): PASS or FAIL.
- For each FAIL, the first error message and the file and line it points to.
- If `npm run verify` does not exist, say so and stop. Do not substitute other commands.

Do not fix anything unless asked.
