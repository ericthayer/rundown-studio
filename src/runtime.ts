import type { RunMeta, Sampler } from './types.js';
import { store } from './store.js';
import { toProject } from './domain/projects.js';
import { dayKey, msToMidnight } from './lib/dates.js';

let sampler: Sampler | null = null;

/** The `sample` capability, or null when not granted (the composer then filters the list instead). */
export const getSampler = (): Sampler | null => sampler;

export function revokeSampler(): void {
  sampler = null;
  store.set({ canAsk: false });
}

/** Connects the artifact runtime (db + sample) to the store. Safe outside claude.ai (renders signed-out). */
export async function connectRuntime(): Promise<void> {
  scheduleMidnight();
  const claude = window.claude;
  if (!claude) {
    store.set({ status: 'signed-out' });
    return;
  }
  const [db, s] = await Promise.all([claude.use('db'), claude.use('sample')]);
  sampler = s;
  store.set({ canAsk: Boolean(s) });
  if (!db) {
    store.set({ status: 'signed-out' });
    return;
  }
  db.collection('projects').onSnapshot(
    (snap) => {
      const projects = snap.docs.map((d) => toProject(d.id, d.data())).filter((p) => typeof p.name === 'string' && p.name !== '');
      store.set({ projects, status: 'ready' });
    },
    () => store.set({ status: 'error' }),
  );
  db.doc('meta/run').onSnapshot(
    (d) => store.set({ meta: (d.data() ?? {}) as RunMeta }),
    () => { /* meta is optional */ },
  );
}

/** Relative dates ("2d ago", streaks) refresh when the page stays open past midnight. */
function scheduleMidnight(): void {
  window.setTimeout(() => {
    store.set({ day: dayKey() });
    scheduleMidnight();
  }, msToMidnight());
}
