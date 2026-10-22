# Rundown Studio

Cross-project status board. Vanilla TypeScript Web Components (light DOM), compiled by `tsc` to native ES modules — no bundler, no runtime dependencies. Published as a multi-file Claude artifact; the artifact runtime provides the database (`db`) and model answers (`sample`).

## Commands

| Command | What it does |
|---|---|
| `npm run build` | `tsc` → `dist/` (ES2022 modules) |
| `npm run typecheck` | Strict type check, no emit |
| `npm test` | Build + Playwright smoke suite (`tests/smoke.mjs`), screenshots in `tests/out/` |

## Layout

```
index.html              server-rendered markup (progressive enhancement)
styles/                 tokens · base · shell · sidebar · header · toolbar · list · assistant
src/
  main.ts               defines elements, connects runtime
  store.ts              typed state + keyed subscriptions (explicit data flow)
  runtime.ts            artifact db/sample bridge, midnight tick
  types.ts              domain + state types, runtime capability typings
  domain/               projects (needs-you, streak, labels) · filters (groups, sort, visible list)
                        · signals (open decisions with age, waiting on)
  lib/                  dom helpers (h, preserveFocus, copyCommand) · prefs · dates · icons
  components/           rd-sidebar · rd-count · rd-stat-strip · rd-streak · rd-toolbar · rd-note
                        rd-project-list · rd-decisions · rd-priorities · rd-composer · rd-assistant
tests/smoke.mjs         focus retention, filters, contrast, rail/resize, drawer, migration, signals
```

## Rules this codebase keeps

- **Update in place.** Components build their DOM once and patch it; lists are keyed by id. Focusable elements carry `data-fk` so `preserveFocus()` can restore focus if a node moves.
- **One prefs object** (`rundown.prefs`, versioned). Old per-key settings migrate on first load.
- **Tokens only** for color; light-mode `--muted` and status colors meet WCAG 2.2 AA.
- **Files under 300 lines.**

## Data contract (artifact database)

`projects/{id}` — `name` (required), `area` (`work|client|personal`), `kind` (`project|chat|repo`), `state` (`active|blocked|stale|parked`), `priority` (number, 1 = top), `lastActivity` / `due` (ISO dates), `leftOff`, `nextStep` (strings), `blockers` / `decided` (string arrays), `openDecisions` (strings or `{ text, since }`), `waitingOn` (`{ who, what?, since? }` or strings).

Signals: `since` (ISO date) drives the age shown in the **Decisions** rollup (oldest first, parked projects excluded) and on cards. A `blocked` project with `waitingOn` and no `blockers` is waiting on others: it gets a blue dot and leaves **Needs you** until a wait passes 14 days.

`meta/run` — `nextRun` (string), `critique` (rundown note), `streak` (number) **or** `sessionDays` (ISO date array). Without either, the streak falls back to consecutive check-in days.

## Publishing

Publish `index.html` with `styles/*.css` and `dist/**/*.js` as supporting files to the existing artifact URL, so the database and link stay the same.
