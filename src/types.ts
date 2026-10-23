/** Domain + app-state types. Rows come from the artifact database (`projects` collection, `meta/run` doc). */

export type ProjectState = 'active' | 'blocked' | 'stale' | 'parked';
export type Area = 'work' | 'client' | 'personal';
export type Kind = 'project' | 'chat' | 'repo';

export interface Project {
  id: string;
  name: string;
  area?: Area;
  kind?: Kind;
  state?: ProjectState;
  priority?: number;
  /** ISO date (YYYY-MM-DD…) of the latest check-in. */
  lastActivity?: string;
  /** ISO due date. */
  due?: string;
  leftOff?: string;
  nextStep?: string;
  decided?: unknown;
  /** Strings or `DecisionItem`s; `since` lets the rollup show how long a decision has been open. */
  openDecisions?: unknown;
  blockers?: unknown;
  /** `WaitItem`s (or plain strings naming who): blocked on someone else, not on you. */
  waitingOn?: unknown;
  /** `SourceError` written by a check-in that couldn't reach the project's repo or source; cleared on the next good one. */
  sourceError?: unknown;
  /** ISO time of the last write, and who wrote it (`checkin` or `rundown`). Ends a board-set overlay when `checkin`. */
  updatedAt?: string;
  updatedBy?: string;
  /** Page-only: an accepted nudge laid over this row (never read from or written to the db). */
  boardSet?: BoardSet;
}

/** What an accepted nudge changed on a row, and when it was set on the board. */
export interface BoardSet { kind: NudgeKind; text: string; at: string }

/** A source the last check-in couldn't reach, e.g. `{source: 'GitHub', since: '2026-10-22'}`. */
export interface SourceError { source: string; detail?: string; since?: string }

/** One open decision as /project-checkin writes it. `since` = ISO date it was first raised. */
export interface DecisionItem { text: string; since?: string }

/** One thing the project waits on. `since` = ISO date the wait started. */
export interface WaitItem { who: string; what?: string; since?: string }

/**
 * A `notes/{id}` entry on the board: a rundown note the viewer dismissed (kind 'note', locker only, 14 days),
 * or a saved Ask Rundown answer (kind 'answer', in the locker and/or on a project card, kept until removed).
 */
export interface LockedNote {
  id: string;
  kind: 'note' | 'answer';
  text: string;
  savedAt: string;
  /** The question an answer replied to. */
  question?: string;
  projectId: string | null;
  inLocker: boolean;
}

/** One pick in a weekly plan. `name` is a snapshot so the plan still reads if the row is removed. */
export interface PlanItem { projectId: string; name: string; why: string }

/** A drafted or pinned version of a plan. `basis` fingerprints the rows it was drafted from. */
export interface PlanVersion { items: PlanItem[]; basis: string; generatedAt: string | null; pinnedAt?: string }

/** `plans/{week}` (e.g. `plans/2026-W43`), written only by the board page. */
export interface WeekPlan { week: string; draft: PlanVersion | null; pinned: PlanVersion | null }

export type NudgeKind = 'next' | 'park';
/** `superseded` = a later check-in replaced what was set on the board (the Restore toast showed once). */
export type NudgeStatus = 'suggested' | 'accepted' | 'dismissed' | 'superseded';

/** `nudges/{projectId}`, written only by the board page: one suggested next step (or park) for a stalled row. */
export interface Nudge {
  projectId: string;
  status: NudgeStatus;
  kind: NudgeKind;
  text: string;
  why: string;
  /** Fingerprint of the row when suggested; a different value means the row changed since. */
  basis: string;
  generatedAt: string;
  decidedAt: string | null;
}

/** `meta/run` document written by the scheduled rundown and /project-checkin. */
export interface RunMeta {
  nextRun?: string;
  critique?: string;
  /** Preferred streak source: a count the rundown computes. */
  streak?: number;
  /** Fallback streak source: ISO dates of days with a Claude session. */
  sessionDays?: string[];
}

/** `meta/config` document written by /rundown:setup. Every field is optional; the board falls back to defaults. */
export interface BoardConfig {
  /** Display name in the sidebar footer. */
  owner?: string;
  /** The board artifact's own claude.ai URL, handed to the chat with a check-in request. */
  boardUrl?: string;
  /** Human schedule text shown before the first rundown sets `meta/run.nextRun`. */
  schedule?: string;
  /** Slash command the check-in buttons run or copy. */
  checkinCommand?: string;
  /** Where Send feedback mails. Defaults to the Rundown maintainer. */
  feedbackEmail?: string;
  /** Where Report an issue opens (an https URL). Defaults to the Rundown repo's new-issue page. */
  issuesUrl?: string;
  /** Installed Rundown plugin version (x.y.z), written by /rundown:checkin. Newer than the board's build → update notice. */
  pluginVersion?: string;
}

export type RailFilter = 'all' | 'needs' | 'decisions' | 'waiting' | 'blocked' | 'stale' | 'parked' | Area;
export type SortKey = 'needs' | 'priority' | 'recent' | 'due' | 'name';
export type UpdatedWindow = 'any' | 'today' | 'week' | 'month' | 'old';
export type DueWindow = 'any' | 'overdue' | 'week' | 'has' | 'none';
export type Flag = 'blockers' | 'decisions' | 'waiting' | 'nonext';

/** How a viewer left the first-run tour; '' = not seen yet. */
export type TourOutcome = '' | 'done' | 'dismissed';

/** Per-viewer color mode. */
export type ThemeMode = 'system' | 'light' | 'dark';

export interface ToolbarFilters {
  status: ProjectState[];
  updated: UpdatedWindow;
  due: DueWindow;
  kind: Kind[];
  flags: Flag[];
  sort: SortKey;
}

export type LoadStatus = 'loading' | 'ready' | 'signed-out' | 'error';
/** Live feed health once loaded: streaming, browser offline, or the db subscription died (rows shown are the last good ones). */
export type LinkState = 'live' | 'offline' | 'paused';

export interface AppState {
  projects: Project[];
  meta: RunMeta;
  config: BoardConfig;
  status: LoadStatus;
  link: LinkState;
  /** Time (ms) of the last good projects snapshot; null before the first. */
  syncedAt: number | null;
  /** Rows in the last snapshot that couldn't be read (no name, or not an object). */
  skipped: number;
  /** Sidebar / stat-strip filter. */
  filter: RailFilter;
  /** Search box text, lower-cased and trimmed. */
  query: string;
  /** Expanded project row. */
  openId: string | null;
  filters: ToolbarFilters;
  /** True when the `sample` capability is granted (assistant answers vs filter fallback). */
  canAsk: boolean;
  /** Local calendar day (YYYY-MM-DD); bumps at midnight so relative dates refresh. */
  day: string;
  /** Note locker entries from the board db, newest first; null until the first snapshot. */
  notes: LockedNote[] | null;
  /** Weekly plans from the board db, newest week first; null until the first snapshot. */
  plans: WeekPlan[] | null;
  /** Project rows exactly as the db holds them; `projects` is these with accepted nudges laid over. */
  rows: Project[];
  /** Stale-work nudges from the board db; null until the first snapshot. */
  nudges: Nudge[] | null;
}

export type StateKey = keyof AppState;

/** Minimal typings for the artifact runtime capabilities this page uses. */
export interface DocSnapshot { id: string; data(): Record<string, unknown> | undefined }
export interface QuerySnapshot { docs: DocSnapshot[] }
export interface DocRef {
  onSnapshot(next: (d: DocSnapshot) => void, err?: (e: unknown) => void): () => void;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
export interface DbQuery {
  where(field: string, op: string, value: unknown): DbQuery;
  onSnapshot(next: (s: QuerySnapshot) => void, err?: (e: unknown) => void): () => void;
}
export interface ArtifactDb {
  collection(name: string): DbQuery & { doc(id: string): DocRef };
  doc(path: string): DocRef;
}
export interface SampleResult { text: string }
/** The runtime's `modelTier` values; anything else rejects `invalid_request`. */
export type ModelTier = 'quick' | 'default' | 'complex';

export type Sampler = (
  prompt: string,
  opts: { signal?: AbortSignal; modelTier?: ModelTier; onText?: (chunk: { text: string }) => void },
) => Promise<SampleResult>;

/** `room` capability: only the hand-off to the viewer's own Claude chat beside the board. */
export type SendAvailability = 'available' | 'available_if_summoned' | 'available_if_opened' | 'no_session' | 'unsupported' | 'off';
export type ToClaude = { label?: string } & { [key: string]: unknown };
export interface ArtifactRoom {
  canSendToClaudeSession(): Promise<SendAvailability>;
  sendToClaudeSession(data: ToClaude, opts?: { deliver?: 'stage' | 'send'; attachPresence?: boolean }): Promise<{ to: 'pane' | 'session' | 'new' }>;
}

declare global {
  interface Window {
    claude?: {
      use(name: 'db'): Promise<ArtifactDb | null>;
      use(name: 'sample'): Promise<Sampler | null>;
      use(name: 'room'): Promise<ArtifactRoom | null>;
    };
  }
}
