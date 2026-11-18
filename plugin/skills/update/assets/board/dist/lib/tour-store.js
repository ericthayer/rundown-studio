import { prefs } from './prefs.js';
export const VIEWER = 'viewer';
const DOC = 'tour';
/** Longest wait for the board's answer before the auto-start falls back to this browser's record. */
export const TOUR_WAIT = 4000;
let db = null;
/** undefined until the board answers (or can't), then whatever it holds ('' = nothing saved). */
let remote;
const waiters = [];
const valid = (v) => v === 'done' || v === 'dismissed';
function settle(v) {
    remote = v;
    waiters.splice(0).forEach((f) => f());
}
function write(tour, tourVersion) {
    if (!db)
        return Promise.reject(new Error('no db'));
    return db.collection(VIEWER).doc(DOC).set({ tour, tourVersion, savedAt: new Date().toISOString() });
}
/**
 * Subscribes to the board's tour record. A board record is mirrored into this browser; a local
 * record the board doesn't have yet (from before this shipped) is copied up once.
 */
export function connectTour(next) {
    db = next;
    let first = true;
    next.collection(VIEWER).onSnapshot((s) => {
        const o = s.docs.find((d) => d.id === DOC)?.data() ?? {};
        const tour = valid(o.tour) ? o.tour : '';
        if (tour) {
            prefs.set('tour', tour);
            if (typeof o.tourVersion === 'number')
                prefs.set('tourVersion', o.tourVersion);
        }
        else if (first) {
            const local = prefs.get('tour');
            if (valid(local))
                void write(local, prefs.get('tourVersion')).catch(() => undefined);
        }
        first = false;
        settle(tour || prefs.get('tour'));
    }, () => settle(prefs.get('tour')));
}
/** Records how the viewer left the tour, locally and on the board (a refused write stays local). */
export function saveTour(tour, tourVersion) {
    prefs.set('tour', tour);
    prefs.set('tourVersion', tourVersion);
    remote = tour;
    return write(tour, tourVersion).catch(() => undefined);
}
/** True once either the board or this browser says the viewer finished or skipped the tour. */
export const tourSeen = () => prefs.get('tour') !== '' || (remote !== undefined && remote !== '');
/** Resolves when the board has answered, or after `ms` (no runtime, slow bridge): never rejects. */
export function tourReady(ms = TOUR_WAIT) {
    if (remote !== undefined)
        return Promise.resolve();
    return new Promise((r) => {
        const t = window.setTimeout(r, ms);
        waiters.push(() => { clearTimeout(t); r(); });
    });
}
