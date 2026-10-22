import { prefs } from './prefs.js';
import { toast } from './toast.js';
/** How long a dismissed note stays in the locker. */
export const LOCKER_DAYS = 14;
const DAY_MS = 864e5;
export const NOTES = 'notes';
let db = null;
/** Ids of locker notes past the window, deleted on the viewer's next dismissal (never from a snapshot). */
let expired = [];
/** FNV-1a 32-bit hex of `text`. */
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++)
        h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
}
/** Deterministic doc id per note text, so dismissing the same note twice keeps one entry. */
export const noteId = (text) => `note-${hash(text)}`;
/** Same idea for saved Ask Rundown answers: saving the same answer again updates one doc. */
export const answerId = (text) => `answer-${hash(text)}`;
const fresh = (savedAt, now) => now - Date.parse(savedAt) < LOCKER_DAYS * DAY_MS;
/**
 * Entries from a `notes` snapshot, newest first. Notes: in the locker and inside the window.
 * Saved answers: in the locker and/or on a project card; they never expire.
 */
export function toLocked(docs, now = Date.now()) {
    const out = [];
    for (const d of docs) {
        const o = d.data() ?? {};
        if (typeof o.text !== 'string' || !o.text || typeof o.savedAt !== 'string' || !Number.isFinite(Date.parse(o.savedAt)))
            continue;
        if (o.kind === 'note') {
            if (o.inLocker !== true || !fresh(o.savedAt, now))
                continue;
            out.push({ id: d.id, kind: 'note', text: o.text, savedAt: o.savedAt, projectId: null, inLocker: true });
        }
        else if (o.kind === 'answer') {
            const projectId = typeof o.projectId === 'string' && o.projectId ? o.projectId : null;
            if (o.inLocker !== true && !projectId)
                continue;
            const question = typeof o.question === 'string' ? o.question : undefined;
            out.push({ id: d.id, kind: 'answer', text: o.text, question, savedAt: o.savedAt, projectId, inLocker: o.inLocker === true });
        }
    }
    return out.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}
/** True when the banner should stay hidden for `text` (locker on the board, or a local fallback). */
export function isDismissed(text, notes) {
    return notes.some((n) => n.kind === 'note' && n.text === text) || prefs.get('noteDismissed') === text;
}
function write(text, savedAt) {
    if (!db)
        return Promise.reject(new Error('no db'));
    return db.collection(NOTES).doc(noteId(text)).set({ kind: 'note', text, savedAt, projectId: null, inLocker: true });
}
/**
 * Connects the locker to the board db. A note dismissed before the locker synced (kept in this
 * browser) is copied to the board once; the local copy is cleared only after the write lands.
 */
export function connectLocker(next, onNotes) {
    db = next;
    db.collection(NOTES).onSnapshot((s) => {
        const now = Date.now();
        const live = toLocked(s.docs, now);
        expired = s.docs.filter((d) => d.data()?.kind === 'note' && d.data()?.inLocker === true && !live.some((n) => n.id === d.id)).map((d) => d.id);
        onNotes(live);
    }, () => onNotes([]));
    const legacy = prefs.get('noteDismissed');
    if (legacy)
        write(legacy, new Date().toISOString()).then(() => prefs.set('noteDismissed', ''), () => { });
}
/** Keeps `text` in the locker on the board; falls back to this browser if the write is refused. */
export async function lockNote(text) {
    if (!text)
        return;
    try {
        await write(text, new Date().toISOString());
    }
    catch {
        prefs.set('noteDismissed', text);
        toast({ tone: 'info', key: 'note', text: "Note hidden on this device only. The board couldn't save it to your Locker." });
    }
    for (const id of expired.splice(0))
        await db?.collection(NOTES).doc(id).delete().catch(() => undefined);
}
/** Takes `text` out of the locker so the banner can show it again. */
export async function unlockNote(text) {
    if (prefs.get('noteDismissed') === text)
        prefs.set('noteDismissed', '');
    await db?.collection(NOTES).doc(noteId(text)).delete().catch(() => undefined);
}
/** Saves, moves or removes an Ask Rundown answer; keeps its first save date. Rejects when the board refuses the write. */
export async function saveAnswer(question, text, place, prev) {
    if (!db)
        throw new Error('no db');
    const ref = db.collection(NOTES).doc(answerId(text));
    if (!place.inLocker && !place.projectId)
        return ref.delete();
    return ref.set({ kind: 'answer', text, question, savedAt: prev?.savedAt ?? new Date().toISOString(), projectId: place.projectId, inLocker: place.inLocker });
}
