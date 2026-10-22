import { prefs, type LockedNote } from './prefs.js';

/** How long a dismissed note stays in the locker. */
export const LOCKER_DAYS = 14;
const DAY_MS = 864e5;

function valid(n: unknown): n is LockedNote {
  const o = n as Partial<LockedNote> | null;
  return !!o && typeof o.text === 'string' && !!o.text && typeof o.at === 'string' && Number.isFinite(Date.parse(o.at));
}

/**
 * Dismissed notes still inside the retention window, newest first. Drops expired or malformed
 * entries, and adopts a note dismissed before the locker existed (`noteDismissed`) so it isn't lost.
 */
export function lockedNotes(now: number = Date.now()): LockedNote[] {
  const stored = prefs.get('noteLocker');
  let list = (Array.isArray(stored) ? stored : []).filter(valid);
  const legacy = prefs.get('noteDismissed');
  if (legacy && !list.some((n) => n.text === legacy)) list.push({ text: legacy, at: new Date(now).toISOString() });
  list = list.filter((n) => now - Date.parse(n.at) < LOCKER_DAYS * DAY_MS).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (JSON.stringify(list) !== JSON.stringify(stored)) prefs.set('noteLocker', list);
  return list;
}

/** Hides `text` from the banner and keeps it in the locker. */
export function lockNote(text: string, now: number = Date.now()): void {
  if (!text) return;
  prefs.set('noteDismissed', text);
  const rest = lockedNotes(now).filter((n) => n.text !== text);
  prefs.set('noteLocker', [{ text, at: new Date(now).toISOString() }, ...rest]);
}

/** Takes `text` out of the locker; if it is the dismissed banner note, the banner can show it again. */
export function unlockNote(text: string): void {
  prefs.set('noteLocker', lockedNotes().filter((n) => n.text !== text));
  if (prefs.get('noteDismissed') === text) prefs.set('noteDismissed', '');
}
