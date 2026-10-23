/**
 * The `nudges` collection: stale-work suggestions, written only by this page. Check-ins and the
 * scheduled rundown read it and never write it. The store keeps raw `rows` and the overlaid `projects`
 * in step: every change to either side goes through `showRows` / `showNudges`.
 */
import type { ArtifactDb, Nudge, Project } from '../types.js';
import { store } from '../store.js';
import { overlay, toNudge } from '../domain/nudges.js';

export const NUDGES = 'nudges';

let db: ArtifactDb | null = null;

/** New db rows: the board shows them with accepted nudges laid over. */
export function showRows(rows: Project[], patch: Parameters<typeof store.set>[0] = {}): void {
  store.set({ ...patch, rows, projects: overlay(rows, store.state.nudges ?? []) });
}

export function showNudges(nudges: Nudge[]): void {
  store.set({ nudges, projects: overlay(store.state.rows, nudges) });
}

/** Subscribes to the board's nudges. A dead listener reports none (rows show as the db has them), never throws. */
export function connectNudges(next: ArtifactDb): void {
  db = next;
  db.collection(NUDGES).onSnapshot((s) => {
    const nudges: Nudge[] = [];
    for (const d of s.docs) {
      let data: unknown;
      try { data = d.data(); } catch { data = undefined; }
      const n = toNudge(d.id, data);
      if (n) nudges.push(n);
    }
    showNudges(nudges);
  }, () => showNudges([]));
}

/** Writes one nudge doc and mirrors it at once (the snapshot follows). Rejects when the board refuses. */
export async function writeNudge(n: Nudge): Promise<void> {
  if (!db) throw new Error('no db');
  const { projectId, ...doc } = n;
  await db.collection(NUDGES).doc(projectId).set(doc);
  showNudges([n, ...(store.state.nudges ?? []).filter((x) => x.projectId !== projectId)]);
}
