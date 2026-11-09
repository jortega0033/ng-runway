# Contributing

Until v1.0.0 the maintainer commits directly to `main`. After v1.0.0 all changes go through small pull requests.

- Conventional commits (enforced by commitlint).
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test -- --watch=false` and `npm run build` must pass.
- Reuse components in `src/app/ui/` and semantic tokens. Never edit values in `tokens/tokens.css` or `tokens/tokens.json`.
