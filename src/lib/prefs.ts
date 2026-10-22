import type { ThemeMode, ToolbarFilters, TourOutcome } from '../types.js';

/** Per-viewer conveniences only (layout, filters, dismissals). Never shared or durable state. */
export interface Prefs {
  v: 1;
  slim: boolean;
  areasOpen: boolean;
  agentOpen: boolean;
  agentW: number | null;
  /** Priorities drawer openness, 0 (collapsed) … 1 (three items). */
  drawer: number;
  filters: Partial<ToolbarFilters> | null;
  noteDismissed: string;
  noteSeen: string;
  /** Color mode; 'system' follows the OS setting. */
  theme: ThemeMode;
  /** First-run tour outcome; '' = not seen yet, so it may auto-start once. */
  tour: TourOutcome;
  /** Version of the tour the viewer last finished or dismissed. */
  tourVersion: number;
}

const KEY = 'rundown.prefs';
const LEGACY = ['rundown.slim', 'rundown.agent', 'rundown.agentW', 'rundown.drawer', 'rundown.filters', 'rundown.noteDismissed', 'rundown.noteSeen'];
const DEFAULTS: Prefs = { v: 1, slim: false, areasOpen: true, agentOpen: true, agentW: null, drawer: 1, filters: null, noteDismissed: '', noteSeen: '', theme: 'system', tour: '', tourVersion: 0 };

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** One-time import of the pre-refactor keys so existing layouts survive the upgrade. */
function migrateLegacy(): Prefs {
  const p: Prefs = { ...DEFAULTS };
  const num = (k: string): number | null => { const n = parseFloat(read(k) ?? ''); return Number.isFinite(n) ? n : null; };
  if (read('rundown.slim') === '1') p.slim = true;
  if (read('rundown.agent') === '0') p.agentOpen = false;
  p.agentW = num('rundown.agentW');
  const d = num('rundown.drawer');
  if (d !== null && d >= 0 && d <= 1) p.drawer = d;
  try { p.filters = JSON.parse(read('rundown.filters') ?? 'null') as Partial<ToolbarFilters> | null; } catch { p.filters = null; }
  p.noteDismissed = read('rundown.noteDismissed') ?? '';
  p.noteSeen = read('rundown.noteSeen') ?? '';
  // Anyone with pre-refactor keys already knows the board; don't interrupt them with the tour.
  if (LEGACY.some((k) => read(k) !== null)) p.tour = 'done';
  return p;
}

function load(): Prefs {
  const raw = read(KEY);
  if (!raw) return migrateLegacy();
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    if (parsed.v !== 1) return { ...DEFAULTS };
    // Prefs saved before the tour shipped belong to an existing viewer: mark the tour seen.
    return { ...DEFAULTS, ...('tour' in parsed ? {} : { tour: 'done' as const }), ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();

export const prefs = {
  get<K extends keyof Prefs>(key: K): Prefs[K] {
    return current[key];
  },
  set<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    current = { ...current, [key]: value };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode / blocked storage */ }
  },
  /** Reset layout + filters to defaults. */
  reset(): void {
    current = { ...DEFAULTS, tour: current.tour, tourVersion: current.tourVersion };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  },
};
