# Practice drills

A drill is a small piece of deliberately bad code you review and fix, to practise reviewing under time pressure. Nothing here is part of the app.

## search-component

`search-component/user-search.component.ts` is a user search box with planted flaws, plus `user-search.component.spec.ts` with a weak test. It comes from the practice drill of the angular-engineer plugin (review block, about 45 minutes in a 2.5 hour pairing session).

### How to use it

1. Read the component cold. Write your findings down before running any tool.
2. Review it with the plugin skill `angular-review`. Compare its ranking with yours.
3. Fix it in small steps with the plugin skill `angular-engineer`: one flaw per change, a real test for each fix.
4. Note what you missed. That is the area to practise.

Fix it in a copy or a scratch branch. Do not "fix" the drill files in place on `main`, so the next run starts bad again.

### Planted flaws

1. `mergeMap` on the search box: one request per keystroke, responses can return out of order and show stale results (use `debounceTime`, `distinctUntilChanged`, `switchMap`).
2. Nested `subscribe` with no unsubscribe, and the inner call also overwrites `selected`.
3. No loading, empty or error state.
4. A clickable `div` (`(click)` on a non-interactive element, not keyboard operable) instead of a `button`.
5. An input without a label (placeholder is not a label).
6. `@for` with `track $index` on a list that can be reordered.
7. A test that only asserts the component is created.

Also present, not on the list: constructor injection, a non-signal `FormControl` and `OnInit` where signals would do, string concatenation in the URL (no encoding), direct mutation of the `users` array. Treat them as bonus findings.

### Excluded from everything

- `tsconfig.app.json` includes only `src/**/*.ts` and `tsconfig.spec.json` includes only `src/**/*.d.ts` and `src/**/*.spec.ts`, so `drills/` is never compiled.
- `eslint.config.mjs` ignores `drills/**` and `.prettierignore` lists `drills`.
- `ng test` (`@angular/build:unit-test`) searches for `**/*.spec.ts` only inside the project `sourceRoot` (`src`), so the drill spec is not found.
- CI runs the npm scripts, which use those configs, so the drill never runs there.
- `npx ng-runway create` does not copy `drills/`.

To run the drill's test on purpose you would need your own temporary tsconfig that includes it. That is not needed for the review exercise.
