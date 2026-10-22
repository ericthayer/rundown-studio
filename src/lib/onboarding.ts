/**
 * First-run onboarding: when the tour auto-starts, replay from settings, and where focus lands after.
 * This is the seam: the renderer (`tour-guide.ts`) and the content (`tour-flow.ts`) load lazily, and
 * any engine with this `TourGuide` shape can replace the renderer (Playwell, once it's ready).
 */
import type { TourFlow } from './tour-flow.js';
import { store } from '../store.js';
import { prefs } from './prefs.js';
import { checkinCommand } from './config.js';

export type TourEnd = 'completed' | 'dismissed';
export interface TourRunOptions {
  /** Label on the last step's primary button. */
  doneLabel: string;
}
export interface TourGuide {
  /** Shows the flow from its first step; resolves once the viewer finishes or dismisses it. */
  run(flow: TourFlow, opts: TourRunOptions): Promise<TourEnd>;
  stop(): void;
}

let guide: Promise<TourGuide> | null = null;
let running = false;

const loadGuide = (): Promise<TourGuide> => (guide ??= import('./tour-guide.js').then((m) => m.createGuide()));

/**
 * Runs the tour from step 1 and records the outcome for this viewer. On finish over an empty board,
 * focus goes to the empty state's check-in action; otherwise back to `returnTo` (or where it was).
 */
export async function startTour(returnTo?: HTMLElement | null): Promise<TourEnd | null> {
  if (running) return null;
  running = true;
  const from = returnTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  try {
    const [g, { firstRunFlow, TOUR_VERSION }] = await Promise.all([loadGuide(), import('./tour-flow.js')]);
    const s = store.state;
    const empty = s.status === 'ready' && s.projects.length === 0;
    const end = await g.run(firstRunFlow(s.config, checkinCommand(), empty), { doneLabel: empty ? 'Start with a check-in' : 'Done' });
    prefs.set('tour', end === 'completed' ? 'done' : 'dismissed');
    prefs.set('tourVersion', TOUR_VERSION);
    const next = end === 'completed' && empty ? document.getElementById('empty-cta') : from;
    (next?.isConnected ? next : document.getElementById('copy-cmd-2'))?.focus();
    return end;
  } catch {
    return null;
  } finally {
    running = false;
  }
}

/** True while something else owns the viewer's attention (a menu, sheet or dialog). */
const busy = (): boolean => document.querySelector('dialog[open], [popover]:popover-open:not(.toasts), .agent.open') !== null;

/** Auto-starts the tour once per viewer, after the board first loads and nothing else is open. */
export function initOnboarding(): void {
  if (prefs.get('tour') !== '') return;
  let armed = true;
  const off = store.subscribe(['status'], (_c, s) => {
    if (!armed || s.status !== 'ready') return;
    armed = false;
    queueMicrotask(() => off());
    let tries = 0;
    const attempt = (): void => {
      if (prefs.get('tour') !== '' || running) return;
      if (busy() && ++tries < 20) { window.setTimeout(attempt, 1500); return; }
      if (!busy()) void startTour();
    };
    window.setTimeout(attempt, 600);
  });
}
