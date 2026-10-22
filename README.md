# Rundown Studio

Cross-project status board. Vanilla TypeScript Web Components (light DOM), compiled by `tsc` to native ES modules — no bundler, no runtime dependencies. Published as a multi-file Claude artifact; the artifact runtime provides the database (`db`) and model answers (`sample`).

## Use it for your own projects

Rundown ships as a Claude Code plugin. It publishes a private copy of the board into your own Claude account; your data lives in that board's database and nobody else can see it. No API keys or accounts to set up.

```
/plugin marketplace add ericthayer/rundown-studio
/plugin install rundown@rundown-studio
/rundown:setup
```

| Command | What it does |
|---|---|
| `/rundown:setup` | Publishes your board, asks for your name, repos and schedule, and creates the scheduled rundown (or gives you the prompt to paste) |
| `/rundown:checkin` | Run inside a project: summarizes where it stands and, after you confirm, writes its row to your board |
| `/rundown:update` | Republishes the latest board code to your existing board link; your data stays |

Open the board once after setup and allow the database and Claude permissions.

![Rundown walkthrough: stat filters, a project's next-step card, the Decisions rollup, filter chips, Ask Rundown, the collapsible assistant rail, and color mode](docs/walkthrough.gif)

### What happens after install

1. **`/rundown:setup`** asks four things at once (your display name, the GitHub repos to scan, a schedule, your timezone), then publishes your private board and gives you its link. It creates the scheduled rundown for you, or hands you the prompt to paste into a scheduled task.
2. **Open the board** and allow the database and Claude permissions. It starts empty.
3. **`/rundown:checkin`** inside each project you want tracked. Claude summarizes where the project stands (left off, next step, blockers, open decisions) and writes the row once you confirm.
4. **The scheduled rundown** keeps rows current between check-ins and leaves a short note at the top of the board.
5. **`/rundown:update`** after a new release pulls the latest board code into your same link; your projects and notes stay.

The walkthrough uses demo data. Re-record it with `npm run walkthrough` (needs `ffmpeg`).

## Commands

| Command | What it does |
|---|---|
| `npm run build` | `tsc` → `dist/` (ES2022 modules) |
| `npm run typecheck` | Strict type check, no emit |
| `npm test` | Build + Playwright suites (`tests/smoke.mjs`, `mobile.mjs`, `ask.mjs`, `config.mjs`), screenshots in `tests/out/` |
| `npm run plugin` | Clean build, then copy the board into `plugin/board/` (CI does this on main) |
| `npm run plugin:check` | Fail if `plugin/board/` differs from the build |
| `npm run walkthrough` | Build, then record `docs/walkthrough.gif` against demo data |

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
  lib/                  dom helpers (h, preserveFocus, copyCommand) · prefs · theme · dates · icons · note-locker · ask-history
  components/           rd-sidebar · rd-count · rd-stat-strip · rd-streak · rd-toolbar · rd-note
                        rd-project-list · rd-decisions · rd-priorities · rd-composer · rd-assistant · rd-focus · rd-settings
                        rd-note-locker · rd-save-menu
plugin/                 Claude Code plugin: skills/ (setup, checkin, update), templates/, board/ (generated copy)
.claude-plugin/         marketplace manifest so the repo installs as a plugin source
tests/smoke.mjs         focus retention, filters, contrast, rail/resize, drawer, migration, signals, focus mode, color mode, note locker
tests/ask.mjs           Ask Rundown transcript and saving answers to the Locker / project cards
```

## Rules this codebase keeps

- **Update in place.** Components build their DOM once and patch it; lists are keyed by id. Focusable elements carry `data-fk` so `preserveFocus()` can restore focus if a node moves.
- **One prefs object** (`rundown.prefs`, versioned). Old per-key settings migrate on first load.
- **Tokens only** for color; light-mode `--muted` and status colors meet WCAG 2.2 AA.
- **Files under 300 lines.**

## Data contract (artifact database)

`projects/{id}` — `name` (required), `area` (`work|client|personal`), `kind` (`project|chat|repo`), `state` (`active|blocked|stale|parked`), `priority` (number, 1 = top), `lastActivity` / `due` (ISO dates), `leftOff`, `nextStep` (strings), `blockers` / `decided` (string arrays), `openDecisions` (strings or `{ text, since }`), `waitingOn` (`{ who, what?, since? }` or strings).

Signals: `since` (ISO date) drives the age shown in the **Decisions** rollup (oldest first, parked projects excluded) and on cards. A `blocked` project with `waitingOn` and no `blockers` is waiting on others: it gets a blue dot and leaves **Needs you** until a wait passes 14 days.

`meta/config` — written by `/rundown:setup`: `owner` (sidebar name), `boardUrl`, `schedule` (shown until the first rundown), `checkinCommand` (default `/project-checkin`), plus `repos` and `timezone` for the rundown. All optional.

`meta/run` — `nextRun` (string), `critique` (rundown note), `streak` (number) **or** `sessionDays` (ISO date array). Without either, the streak falls back to consecutive check-in days.

`notes/{id}` — the note locker. A dismissed rundown note is `{ kind: 'note', text, savedAt, projectId: null, inLocker: true }` with a deterministic id per text (`noteId()`), so it syncs across devices. The banner hides any `critique` that is in the locker; a run that writes new text shows it again. Entries older than 14 days drop out of the locker and are deleted on the next dismissal. **Show again** (Settings → Locker) deletes the entry. If a write is refused, the dismissal falls back to this browser (`rundown.prefs.noteDismissed`), and an older local dismissal is copied to the board once.

Saved Ask Rundown answers share the collection: `{ kind: 'answer', text, question, savedAt, projectId, inLocker }` with id `answerId(text)`. **Save** under an answer writes it to the Locker, a project card (`projectId`), or both; unticking both deletes it. Answers never expire. The Ask Rundown transcript itself is per tab (`sessionStorage` `rundown.askLog`, 20 turns) and is never written to the board.

## Publishing

Publish `index.html` with `styles/*.css` and `dist/**/*.js` as supporting files to the existing artifact URL, so the database and link stay the same.
