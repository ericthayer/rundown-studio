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
}

export type StateKey = keyof AppState;

/** Minimal typings for the artifact runtime capabilities this page uses. */
export interface DocSnapshot { id: string; data(): Record<string, unknown> | undefined }
export interface QuerySnapshot { docs: DocSnapshot[] }
export interface ArtifactDb {
  collection(name: string): { onSnapshot(next: (s: QuerySnapshot) => void, err?: (e: unknown) => void): () => void };
  doc(path: string): { onSnapshot(next: (d: DocSnapshot) => void, err?: (e: unknown) => void): () => void };
}
export interface SampleResult { text: string }
export type Sampler = (
  prompt: string,
  opts: { signal?: AbortSignal; modelTier?: 'quick' | 'standard'; onText?: (chunk: { text: string }) => void },
) => Promise<SampleResult>;

declare global {
  interface Window {
    claude?: { use(name: 'db'): Promise<ArtifactDb | null>; use(name: 'sample'): Promise<Sampler | null> };
  }
}
