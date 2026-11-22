# Releasing

Only the owner releases. Agents never tag, create a GitHub release or publish anything.

## What a release is here

A release is a Git tag `vX.Y.Z` on `main` (the latest is `v1.0.0`). `package.json` is `private` and is not published to npm. A merge to `main` already deploys the demo to GitHub Pages through `.github/workflows/ci.yml`, so a tag marks a state that is already live.

## Steps

1. On `main`, with every pull request for the release merged and CI green on the head commit.
2. Run `npm ci --ignore-scripts` and `npm run verify` locally, or confirm the same steps in the CI run for that commit.
3. In `CHANGELOG.md`, rename the `Unreleased` section to the new version with the date, add a fresh empty `Unreleased` section above it, and merge that through a pull request.
4. Tag the merge commit: `git tag -a vX.Y.Z -m "vX.Y.Z"` then `git push origin vX.Y.Z`.
5. Create the GitHub release from the tag with the changelog section as its notes.
6. Open the Pages demo and check that it loads under `/ng-runway/`.

Use a major version for a breaking change to the CLI or to the generated feature layout, a minor version for a new feature and a patch version for a fix.
