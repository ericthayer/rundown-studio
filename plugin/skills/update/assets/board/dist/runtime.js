import { store } from './store.js';
import { toProject } from './domain/projects.js';
import { dayKey, msToMidnight } from './lib/dates.js';
import { connectLocker } from './lib/note-locker.js';
import { toConfig } from './lib/config.js';
import { connectPlans } from './lib/plan-store.js';
import { connectNudges, showRows } from './lib/nudge-store.js';
/** No first snapshot by then → show the can't-reach state (a late snapshot still flips it to ready). */
export const CONNECT_TIMEOUT = 12000;
let sampler = null;
let db = null;
let stopProjects = null;
let timer = 0;
/** The `sample` capability, or null when not granted (the composer then filters the list instead). */
export const getSampler = () => sampler;
export function revokeSampler() {
    sampler = null;
    store.set({ canAsk: false });
}
/** Connects the artifact runtime (db + sample) to the store. Safe outside claude.ai (renders signed-out). */
export async function connectRuntime() {
    scheduleMidnight();
    watchNetwork();
    await connect();
}
/**
 * Retry after a failure: re-acquires the runtime if it never connected, otherwise opens a fresh
 * projects subscription (the only recovery for a dead listener). Rows on screen stay until it answers.
 */
export async function reconnect() {
    if (!db)
        return connect();
    if (!store.state.syncedAt)
        store.set({ status: 'loading' });
    subscribeProjects(db);
}
async function connect() {
    const claude = window.claude;
    if (!claude) {
        store.set({ status: 'signed-out' });
        return;
    }
    store.set({ status: 'loading' });
    armTimeout();
    let next;
    try {
        const [d, s] = await Promise.all([claude.use('db'), claude.use('sample').catch(() => null)]);
        next = d;
        sampler = s;
        store.set({ canAsk: Boolean(s) });
    }
    catch {
        // The runtime itself failed to load: nothing to subscribe to until Retry.
        clearTimeout(timer);
        store.set({ status: 'error' });
        return;
    }
    if (!next) {
        clearTimeout(timer);
        store.set({ status: 'signed-out' });
        return;
    }
    db = next;
    subscribeProjects(db);
    db.doc('meta/run').onSnapshot((d) => store.set({ meta: (d.data() ?? {}) }), () => { });
    connectLocker(db, (notes) => store.set({ notes }));
    connectPlans(db, (plans) => store.set({ plans }));
    connectNudges(db);
    db.doc('meta/config').onSnapshot((d) => store.set({ config: toConfig(d.data()) }), () => { });
}
function subscribeProjects(from) {
    stopProjects?.();
    armTimeout();
    stopProjects = from.collection('projects').onSnapshot((snap) => {
        clearTimeout(timer);
        const { projects, skipped } = readRows(snap);
        showRows(projects, { skipped, status: 'ready', syncedAt: Date.now(), link: navigator.onLine === false ? 'offline' : 'live' });
    }, () => {
        // Terminal for this listener (revoked, dead bridge, quota). Keep the last good rows if there are any.
        clearTimeout(timer);
        stopProjects = null;
        store.set(store.state.syncedAt ? { link: 'paused' } : { status: 'error' });
    });
}
/** Shared data is untrusted: a row that isn't an object with a name is skipped and counted, never thrown on. */
export function readRows(snap) {
    const projects = [];
    let skipped = 0;
    for (const d of snap.docs) {
        let data;
        try {
            data = d.data();
        }
        catch {
            data = undefined;
        }
        const ok = data !== null && typeof data === 'object' && !Array.isArray(data);
        const p = ok ? toProject(d.id, data) : null;
        if (p && typeof p.name === 'string' && p.name.trim() !== '')
            projects.push(p);
        else
            skipped++;
    }
    return { projects, skipped };
}
function armTimeout() {
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (!store.state.syncedAt)
        store.set({ status: 'error' }); }, CONNECT_TIMEOUT);
}
/** Offline pauses the feed label; coming back online re-subscribes so the board catches up at once. */
function watchNetwork() {
    window.addEventListener('offline', () => store.set({ link: 'offline' }));
    window.addEventListener('online', () => {
        if (store.state.status === 'error' || store.state.link !== 'live')
            void reconnect();
        else
            store.set({ link: 'live' });
    });
}
/** Relative dates ("2d ago", streaks) refresh when the page stays open past midnight. */
function scheduleMidnight() {
    window.setTimeout(() => {
        store.set({ day: dayKey() });
        scheduleMidnight();
    }, msToMidnight());
}
