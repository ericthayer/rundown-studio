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
  lib/                  dom helpers (h, preserveFocus, copyCommand) · prefs · theme · dates · icons · note-locker
  components/           rd-sidebar · rd-count · rd-stat-strip · rd-streak · rd-toolbar · rd-note
                        rd-project-list · rd-decisions · rd-priorities · rd-composer · rd-assistant · rd-focus · rd-settings
                        rd-note-locker
tests/smoke.mjs         focus retention, filters, contrast, rail/resize, drawer, migration, signals, focus mode, color mode, note locker
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

`notes/{id}` — the note locker. A dismissed rundown note is `{ kind: 'note', text, savedAt, projectId: null, inLocker: true }` with a deterministic id per text (`noteId()`), so it syncs across devices. The banner hides any `critique` that is in the locker; a run that writes new text shows it again. Entries older than 14 days drop out of the locker and are deleted on the next dismissal. **Show again** (Settings → Dismissed notes) deletes the entry. If a write is refused, the dismissal falls back to this browser (`rundown.prefs.noteDismissed`), and an older local dismissal is copied to the board once.

## Publishing

Publish `index.html` with `styles/*.css` and `dist/**/*.js` as supporting files to the existing artifact URL, so the database and link stay the same.
