import { store } from '../store.js';
import { overlay, toNudge } from '../domain/nudges.js';
export const NUDGES = 'nudges';
let db = null;
/** New db rows: the board shows them with accepted nudges laid over. */
export function showRows(rows, patch = {}) {
    store.set({ ...patch, rows, projects: overlay(rows, store.state.nudges ?? []) });
}
export function showNudges(nudges) {
    store.set({ nudges, projects: overlay(store.state.rows, nudges) });
}
/** Subscribes to the board's nudges. A dead listener reports none (rows show as the db has them), never throws. */
export function connectNudges(next) {
    db = next;
    db.collection(NUDGES).onSnapshot((s) => {
        const nudges = [];
        for (const d of s.docs) {
            let data;
            try {
                data = d.data();
            }
            catch {
                data = undefined;
            }
            const n = toNudge(d.id, data);
            if (n)
                nudges.push(n);
        }
        showNudges(nudges);
    }, () => showNudges([]));
}
/** Writes one nudge doc and mirrors it at once (the snapshot follows). Rejects when the board refuses. */
export async function writeNudge(n) {
    if (!db)
        throw new Error('no db');
    const { projectId, ...doc } = n;
    await db.collection(NUDGES).doc(projectId).set(doc);
    showNudges([n, ...(store.state.nudges ?? []).filter((x) => x.projectId !== projectId)]);
}
