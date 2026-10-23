# Agent notes

Vanilla TypeScript Web Components, published as a multi-file Claude artifact. Keep files under 300 lines, update the DOM in place, take every color from a token, and run `npm test` before publishing. Commits and PR titles are Conventional Commits; see `CONTRIBUTING.md`.

## STATUS.md

Before a `feat:` or `fix:` PR is ready, update `STATUS.md`: Left off, the one Next step, Blockers, Waiting on and Open decisions, plus `updated` (today) and `updatedBy` (you). Leave the `Released:` line alone; release-please bumps it. Run `npm run status:check`. The format is in `CONTRIBUTING.md` under STATUS.md.
