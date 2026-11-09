# ng-runway CLI

Zero-dependency Node CLI. It copies files out of this repo; it installs nothing (except `create`, which runs `npm ci`).

```bash
npx github:jortega0033/ng-runway#v1.0.0 tokens [dir] [--format css|json|tailwind|ts|all] [--force]
npx github:jortega0033/ng-runway#v1.0.0 ui [dir] [--tokens <dir>] [--docs] [--force]
npx github:jortega0033/ng-runway#v1.0.0 create <app-name> [--no-install] [--no-git]
```

- `tokens`: copies the design tokens (default `./tokens`, all formats).
- `ui`: copies the UI library (`src/app/ui`, no specs) and the tokens, and prints what the library expects.
- `create`: copies the full boilerplate into a new folder, renames the package, runs `git init` and `npm ci --ignore-scripts`.

Existing files are never overwritten without `--force`. Run the tests with `npm run cli:test`.
