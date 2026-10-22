# Contributing

Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org). Versions and `CHANGELOG.md` are generated from them by release-please — never edit the version by hand.

| Commit | Release | Example |
|---|---|---|
| `fix:` | patch (1.0.0 → 1.0.1) | `fix(list): keep focus after expanding a row` |
| `feat:` | minor (1.0.0 → 1.1.0) | `feat(assistant): unread badge on the icon rail` |
| `feat!:` or `BREAKING CHANGE:` footer | major (1.0.0 → 2.0.0) | `feat!: rename meta.critique to meta.note` |
| `docs:` `style:` `refactor:` `perf:` `test:` `build:` `ci:` `chore:` | none on its own | `ci: run smoke tests on PRs` |

Scopes are optional; use the component name (`sidebar`, `toolbar`, `list`, `assistant`, `tokens`).

**Flow:** branch → PR with a conventional title → squash merge → release-please updates its release PR → merge that PR to tag `vX.Y.Z` and publish the artifact.

**Local hook:** `npm i -D husky @commitlint/cli @commitlint/config-conventional && npx husky init`, then delete the generated `.husky/pre-commit` (the smoke suite is too slow for every commit). `.husky/commit-msg` is already in the repo.
