# Rundown Studio

Cross-project status board. Vanilla TypeScript Web Components (light DOM), compiled by `tsc` to native ES modules — no bundler, no runtime dependencies. Published as a multi-file Claude artifact; the artifact runtime provides the database (`db`) and model answers (`sample`).

## Use it for your own projects

Rundown ships as a Claude Code plugin. Run its commands in Claude Code (the Claude desktop app's Code tab, or `claude` in a terminal): publishing the board and writing to it use tools that chat in the Claude app doesn't have. It publishes a private copy of the board into your own Claude account; your data lives in that board's database and nobody else can see it. No API keys or accounts to set up.

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

### Hearing about new versions

- **Email:** on this repo, choose **Watch → Custom → Releases**. GitHub emails you when a new version ships.
- **On the board:** each `/rundown:checkin` records your installed plugin version. When it is newer than your board, the board shows a notice with a button that copies `/rundown:update`.
- **Plugin itself:** `/plugin marketplace update rundown-studio` pulls the newest release. To get it automatically, turn on **Enable auto-update** for `rundown-studio` under `/plugin` → Marketplaces.

The walkthrough uses demo data and shows the board as of v1.3.3. Re-record it with `npm run walkthrough` (needs `ffmpeg`) after any visible UI change.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | `tsc` → `dist/` (ES2022 modules) |
| `npm run typecheck` | Strict type check, no emit |
| `npm test` | Build + Playwright suites (`tests/smoke.mjs`, `mobile.mjs`, `ask.mjs`, `config.mjs`), screenshots in `tests/out/` |
| `npm run plugin` | Clean build, then copy the board into the setup and update skills (`plugin/skills/*/assets/board/`). Run it in any PR that touches the board; CI fails if you forget |
| `npm run plugin:check` | Fail if a plugin board copy differs from the build, or plugin versions disagree |
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
                        · signals (open decisions with age, waiting on) · week-plan (ISO weeks, prompt, validation)
                        · nudges (stalled rows, prompt, validation, overlay)
  lib/                  dom helpers (h, preserveFocus, copyCommand) · prefs · theme · dates · icons · note-locker · ask-history
                        · sample-json / sample-errors (shared `sample` calls) · plan-store · nudge-store · nudge-actions · reveal · hash
  components/           rd-sidebar · rd-count · rd-stat-strip · rd-streak · rd-toolbar · rd-note
                        rd-project-list · rd-decisions · rd-priorities · rd-composer · rd-assistant · rd-focus · rd-settings
                        rd-note-locker · rd-save-menu · rd-week-plan · plan-editor
                        rd-panel-tabs · rd-stalled · nudge-card
plugin/                 Claude plugin: skills/ (setup, checkin, update), each with its own assets/ (board copies are generated)
.claude-plugin/         marketplace manifest so the repo installs as a plugin source
tests/smoke.mjs         focus retention, filters, contrast, rail/resize, drawer, migration, signals, focus mode, color mode, note locker
tests/ask.mjs           Ask Rundown transcript and saving answers to the Locker / project cards
tests/plan.mjs          This week: draft, edit, pin, failures, no-Claude path, phone
tests/nudges.mjs        Stalled: suggest, Use this / Not now / Undo, overlay across rundown and check-in, Restore, badges
```

## Rules this codebase keeps

- **Update in place.** Components build their DOM once and patch it; lists are keyed by id. Focusable elements carry `data-fk` so `preserveFocus()` can restore focus if a node moves.
- **One prefs object** (`rundown.prefs`, versioned). Old per-key settings migrate on first load.
- **Tokens only** for color; light-mode `--muted` and status colors meet WCAG 2.2 AA.
- **Files under 300 lines.**

## Data contract (artifact database)

`projects/{id}` — `name` (required), `area` (`work|client|personal`), `kind` (`project|chat|repo`), `state` (`active|blocked|stale|parked`), `priority` (number, 1 = top), `lastActivity` / `due` (ISO dates), `leftOff`, `nextStep` (strings), `blockers` / `decided` (string arrays), `openDecisions` (strings or `{ text, since }`), `waitingOn` (`{ who, what?, since? }` or strings), `sourceError` (`{ source, detail?, since? }` or a string naming the source: the last check-in couldn't reach it; null or absent once it answers).

Signals: `since` (ISO date) drives the age shown in the **Decisions** rollup (oldest first, parked projects excluded) and on cards. A `blocked` project with `waitingOn` and no `blockers` is waiting on others: it gets a blue dot and leaves **Needs you** until a wait passes 14 days.

`STATUS.md` (optional, repos only) — a repo's own record of where work left off. Check-ins and the scheduled rundown copy its sections onto the row when it's newer than the row. Format and rules: [CONTRIBUTING.md](CONTRIBUTING.md#statusmd).

`meta/config` — written by `/rundown:setup`: `owner` (sidebar name), `boardUrl`, `schedule` (shown until the first rundown), `checkinCommand` (default `/project-checkin`), `feedbackEmail` and `issuesUrl` (Settings → Help targets; default to the Rundown maintainer and this repo's issue form), plus `repos` and `timezone` for the rundown. All optional.

## Empty and failure states

The list area shows an illustrated panel instead of rows when the board is empty, nothing matches, the database can't be reached (after 12s, or a load error), the browser is offline, or the viewer is signed out. A band under the toolbar covers problems after a good load: offline, live updates paused (a dead `projects` listener; **Try again** opens a fresh one), and rows that couldn't be read (skipped and counted, never thrown on). Changes are announced once each through a polite live region in `<rd-status>`. Ask Rundown failures stay in the transcript with copy per `sample` error code, keep any partial answer, time out after 45s of silence, and offer **Try again** where it can help.

Toasts (bottom center, `src/lib/toast.ts`) say when the board changed: each projects snapshot is diffed against the previous one and summarized in one toast (a new project, a status change, or "Board updated: 3 projects"), never on first load. Successes dismiss after 5s, paused while hovered or focused. Failures (live updates paused, a save the board refused) stay until dismissed and offer **Retry**. The stack is a polite live region, and failure toasts are `role="alert"`.

Illustrations are data (`src/lib/scenes.ts`) rendered as static SVG first and as Lottie (`lottie_light` 5.12.2 from cdnjs, with SRI) only when a panel shows and motion is allowed. Colors come from tokens through tone classes in `styles/states.css`. Set `LOTTIE_FILE=/path/to/lottie_light.min.js` when running `npm test` to also check the real player.

`meta/run` — `nextRun` (string), `critique` (rundown note), `streak` (number) **or** `sessionDays` (ISO date array). Without either, the streak falls back to consecutive check-in days.

`notes/{id}` — the note locker. A dismissed rundown note is `{ kind: 'note', text, savedAt, projectId: null, inLocker: true }` with a deterministic id per text (`noteId()`), so it syncs across devices. The banner hides any `critique` that is in the locker; a run that writes new text shows it again. Entries older than 14 days drop out of the locker and are deleted on the next dismissal. **Show again** (Settings → Locker) deletes the entry. If a write is refused, the dismissal falls back to this browser (`rundown.prefs.noteDismissed`), and an older local dismissal is copied to the board once.

Saved Ask Rundown answers share the collection: `{ kind: 'answer', text, question, savedAt, projectId, inLocker }` with id `answerId(text)`. **Save** under an answer writes it to the Locker, a project card (`projectId`), or both; unticking both deletes it. Answers never expire. The Ask Rundown transcript itself is per tab (`sessionStorage` `rundown.askLog`, 20 turns) and is never written to the board.

`plans/{week}` — **This week** in the right panel, keyed by ISO week (`2026-W43`): `{ week, draft, pinned }`, each a version `{ items: [{ projectId, name, why }], basis, generatedAt, pinnedAt? }` (up to 3 items). **Draft this week** asks the board's own Claude (`sample`, standard tier) for JSON, keeps only known, non-parked ids, and opens the draft in an editor; **Pin plan** writes `pinned` and clears `draft`. Without Claude, **Plan it yourself** opens the same editor empty. `basis` is a hash of the rows the draft read, so a changed board offers **Redraft**. The page writes this collection and never writes `projects`; check-ins don't read or write it. The newest 8 weeks are kept.

`nudges/{projectId}` — the **Stalled** tab. A row stalls when it isn't parked and is stale, blocked on you, or waiting on someone for 14+ days. **Suggest next steps** sends up to 8 stalled rows to the board's own Claude (`sample`, quick tier) and stores one suggestion per row: `{ status: 'suggested'|'accepted'|'dismissed'|'superseded', kind: 'next'|'park', text, why, basis, generatedAt, decidedAt }`. Park is only offered for stale rows and long waits. **Use this** (or **Park it**) and **Not now** write `status` and `decidedAt`, with a 5s **Undo** toast. `basis` fingerprints the row, so a suggestion only comes back after the row itself changes.

The page never writes `projects`. An accepted nudge is laid over its row (next step, or `state: 'parked'`) and marked "Set on the board" until a check-in (`updatedBy: 'checkin'`) writes a newer `updatedAt`; the rundown's writes never end it. Check-ins and the rundown read `nudges` and never write it. When a check-in replaces a board-set value with a different one, the board says so once (marking the nudge `superseded`) and offers **Restore**. Board-update toasts diff the db rows, so accepting a nudge never reads as a board update.

Layout: the right panel holds **Top priorities**, then two tabs, **This week** and **Stalled** (with a count badge). The same count shows on the collapsed rail's ✦ button and on the header toggle on narrow screens. Ask Rundown is docked under the project list and stays on screen on every width; its answers fold away with **Hide answers** (remembered per browser).

## Publishing

Publish `index.html` with `styles/*.css` and `dist/**/*.js` as supporting files to the existing artifact URL, so the database and link stay the same.
