/**
 * First-run tour content. The shapes mirror a subset of Playwell's manifest v1 (flow → steps →
 * paragraph blocks, `[data-playwell]` targets, `missingTarget: 'skip'`), so the flow can be handed to
 * Playwell later without rewriting it. Copy reads `meta/config`, so plugin users see their own command.
 */
import type { BoardConfig } from '../types.js';

/** Bump when the copy changes enough that viewers should see the tour again. */
export const TOUR_VERSION = 1;
export const TOUR_ID = 'first-run';

export interface TourTarget { selector: string; fallback?: string; source: 'stable-anchor' }
export interface TourParagraph { type: 'paragraph'; id: string; text: string }
export interface TourStep {
  id: string;
  title: string;
  blocks: TourParagraph[];
  /** Absent → centered card with no spotlight. */
  target?: TourTarget;
  /** A target that is missing or hidden (e.g. at phone width) skips the step. */
  missingTarget?: 'skip';
}
export interface TourFlow { id: string; version: number; name: string; steps: TourStep[] }

const anchor = (name: string, fallback?: string): TourTarget =>
  ({ selector: `[data-playwell="${name}"]`, source: 'stable-anchor', ...(fallback ? { fallback } : {}) });
const para = (...texts: string[]): TourParagraph[] => texts.map((text, i) => ({ type: 'paragraph', id: `p${i + 1}`, text }));

export function firstRunFlow(config: Readonly<BoardConfig>, command: string, empty: boolean): TourFlow {
  const when = config.schedule ? `, or let it run on your schedule (${config.schedule})` : '';
  return {
    id: TOUR_ID,
    version: TOUR_VERSION,
    name: 'Welcome to Rundown',
    steps: [
      {
        id: 'welcome',
        title: config.owner ? `Welcome, ${config.owner.split(/\s+/)[0]}` : 'Welcome to Rundown',
        blocks: para('Rundown is one board for everything you have in flight. It fills itself from check-ins, so you never type status in by hand.', 'This takes about 30 seconds, and you can skip it any time.'),
      },
      {
        id: 'checkin',
        title: 'Check-ins fill the board',
        target: anchor('checkin'),
        missingTarget: 'skip',
        blocks: para(`Run ${command} in Claude${when}. Each check-in reads your work and updates the rows: where you left off, the next step, and what's blocked.`, 'This button copies the command for you.'),
      },
      {
        id: 'stats',
        title: 'What needs you',
        target: anchor('stats'),
        missingTarget: 'skip',
        blocks: para(empty
          ? 'Once rows land, these counts show what needs you, open decisions, what you are waiting on, and what has gone stale. Each one filters the list.'
          : 'These counts show what needs you, open decisions, what you are waiting on, and what has gone stale. Each one filters the list.'),
      },
      {
        id: 'ask',
        title: 'Ask Rundown',
        target: anchor('ask', '[data-playwell="ask-box"]'),
        missingTarget: 'skip',
        blocks: para('Ask about your projects in plain words, like "what is blocked this week?" Save the answers you want to keep.'),
      },
      {
        id: 'settings',
        title: 'Your settings and locker',
        target: anchor('settings'),
        missingTarget: 'skip',
        blocks: para('Color mode, the Locker (dismissed notes for 14 days, saved answers until you remove them), feedback links, and Take the tour to replay this.'),
      },
    ],
  };
}
