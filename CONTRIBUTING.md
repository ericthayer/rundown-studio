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

## STATUS.md

`STATUS.md` says where work left off, the one next step, and what's blocking it. The Rundown board and `/rundown:checkin` read it from `main`, so it has to be current when a PR merges.

- **Every `feat:` or `fix:` PR updates it** as the last commit on the branch, whoever authors the PR (Claude, Codex, AI Studio or a person). Set `updated` to today and `updatedBy` to who wrote it. CI warns when a feat or fix PR leaves it alone.
- **Release-please** only bumps the `Released:` line, in its release PR. Never edit that line by hand.
- **Check-ins** write it through a branch or a `chore(status):` PR, never straight to `main`.
- `npm run status:check` validates the file. CI fails a PR when it's malformed.

Format (template: `plugin/templates/STATUS.md`):

```md
---
state: active        # active | blocked | parked
updated: 2026-10-23
updatedBy: claude    # claude | codex | ai-studio | <name>
---
# Status

Released: v1.4.0 <!-- x-release-please-version -->

## Left off
One or two sentences.

## Next step
Exactly one line.

## Blockers
- None

## Waiting on
- who: what · since YYYY-MM-DD

## Open decisions
- A question? · since YYYY-MM-DD
```

Each section replaces its board field whole: `leftOff`, `nextStep`, `blockers`, `waitingOn` `{who, what, since}`, `openDecisions` `{text, since}`; `updated` becomes `lastActivity`. Write `- None` or `- Nobody` for an empty list. There's no Decided section: the board only records decisions the owner stated. `stale` isn't a valid state; the rundown works that out. Repos without releases leave out the `Released:` line. When two open PRs both change STATUS.md, resolve the conflict by keeping the newer text.
