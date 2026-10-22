import type { ArtifactDb, DocSnapshot, LockedNote } from '../types.js';
import { prefs } from './prefs.js';

/** How long a dismissed note stays in the locker. */
export const LOCKER_DAYS = 14;
const DAY_MS = 864e5;
export const NOTES = 'notes';

let db: ArtifactDb | null = null;
/** Ids of locker notes past the window, deleted on the viewer's next dismissal (never from a snapshot). */
let expired: string[] = [];

/** Deterministic doc id per note text, so dismissing the same note twice keeps one entry. */
export function noteId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `note-${(h >>> 0).toString(16)}`;
}

const fresh = (savedAt: string, now: number): boolean => now - Date.parse(savedAt) < LOCKER_DAYS * DAY_MS;

/** Locker entries from a `notes` snapshot: kind 'note', in the locker, inside the window, newest first. */
export function toLocked(docs: readonly DocSnapshot[], now: number = Date.now()): LockedNote[] {
  const out: LockedNote[] = [];
  for (const d of docs) {
    const o = d.data() ?? {};
    if (o.kind !== 'note' || o.inLocker !== true || typeof o.text !== 'string' || !o.text) continue;
    if (typeof o.savedAt !== 'string' || !Number.isFinite(Date.parse(o.savedAt)) || !fresh(o.savedAt, now)) continue;
    out.push({ id: d.id, text: o.text, savedAt: o.savedAt });
  }
  return out.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

/** True when the banner should stay hidden for `text` (locker on the board, or a local fallback). */
export function isDismissed(text: string, notes: readonly LockedNote[]): boolean {
  return notes.some((n) => n.text === text) || prefs.get('noteDismissed') === text;
}

function write(text: string, savedAt: string): Promise<void> {
  if (!db) return Promise.reject(new Error('no db'));
  return db.collection(NOTES).doc(noteId(text)).set({ kind: 'note', text, savedAt, projectId: null, inLocker: true });
}

/**
 * Connects the locker to the board db. A note dismissed before the locker synced (kept in this
 * browser) is copied to the board once; the local copy is cleared only after the write lands.
 */
export function connectLocker(next: ArtifactDb, onNotes: (n: LockedNote[]) => void): void {
  db = next;
  db.collection(NOTES).where('kind', '==', 'note').onSnapshot((s) => {
    const now = Date.now();
    const live = toLocked(s.docs, now);
    expired = s.docs.filter((d) => d.data()?.inLocker === true && !live.some((n) => n.id === d.id)).map((d) => d.id);
    onNotes(live);
  }, () => onNotes([]));
  const legacy = prefs.get('noteDismissed');
  if (legacy) write(legacy, new Date().toISOString()).then(() => prefs.set('noteDismissed', ''), () => { /* stays local */ });
}

/** Keeps `text` in the locker on the board; falls back to this browser if the write is refused. */
export async function lockNote(text: string): Promise<void> {
  if (!text) return;
  try {
    await write(text, new Date().toISOString());
  } catch {
    prefs.set('noteDismissed', text);
  }
  for (const id of expired.splice(0)) await db?.collection(NOTES).doc(id).delete().catch(() => undefined);
}

/** Takes `text` out of the locker so the banner can show it again. */
export async function unlockNote(text: string): Promise<void> {
  if (prefs.get('noteDismissed') === text) prefs.set('noteDismissed', '');
  await db?.collection(NOTES).doc(noteId(text)).delete().catch(() => undefined);
}
