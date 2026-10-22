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
}

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

/** `meta/run` document written by the scheduled rundown and /project-checkin. */
export interface RunMeta {
  nextRun?: string;
  critique?: string;
  /** Preferred streak source: a count the rundown computes. */
  streak?: number;
  /** Fallback streak source: ISO dates of days with a Claude session. */
  sessionDays?: string[];
}

export type RailFilter = 'all' | 'needs' | 'decisions' | 'waiting' | 'blocked' | 'stale' | 'parked' | Area;
export type SortKey = 'needs' | 'priority' | 'recent' | 'due' | 'name';
export type UpdatedWindow = 'any' | 'today' | 'week' | 'month' | 'old';
export type DueWindow = 'any' | 'overdue' | 'week' | 'has' | 'none';
export type Flag = 'blockers' | 'decisions' | 'waiting' | 'nonext';

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

export interface AppState {
  projects: Project[];
  meta: RunMeta;
  status: LoadStatus;
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
export type Sampler = (
  prompt: string,
  opts: { signal?: AbortSignal; modelTier?: 'quick' | 'standard'; onText?: (chunk: { text: string }) => void },
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
