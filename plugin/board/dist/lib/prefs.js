const KEY = 'rundown.prefs';
const LEGACY = ['rundown.slim', 'rundown.agent', 'rundown.agentW', 'rundown.drawer', 'rundown.filters', 'rundown.noteDismissed', 'rundown.noteSeen'];
const DEFAULTS = { v: 1, slim: false, areasOpen: true, agentOpen: true, agentW: null, drawer: 1, filters: null, noteDismissed: '', noteSeen: '', theme: 'system', tour: '', tourVersion: 0 };
function read(key) {
    try {
        return localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
/** One-time import of the pre-refactor keys so existing layouts survive the upgrade. */
function migrateLegacy() {
    const p = { ...DEFAULTS };
    const num = (k) => { const n = parseFloat(read(k) ?? ''); return Number.isFinite(n) ? n : null; };
    if (read('rundown.slim') === '1')
        p.slim = true;
    if (read('rundown.agent') === '0')
        p.agentOpen = false;
    p.agentW = num('rundown.agentW');
    const d = num('rundown.drawer');
    if (d !== null && d >= 0 && d <= 1)
        p.drawer = d;
    try {
        p.filters = JSON.parse(read('rundown.filters') ?? 'null');
    }
    catch {
        p.filters = null;
    }
    p.noteDismissed = read('rundown.noteDismissed') ?? '';
    p.noteSeen = read('rundown.noteSeen') ?? '';
    // Anyone with pre-refactor keys already knows the board; don't interrupt them with the tour.
    if (LEGACY.some((k) => read(k) !== null))
        p.tour = 'done';
    return p;
}
function load() {
    const raw = read(KEY);
    if (!raw)
        return migrateLegacy();
    try {
        const parsed = JSON.parse(raw);
        if (parsed.v !== 1)
            return { ...DEFAULTS };
        // Prefs saved before the tour shipped belong to an existing viewer: mark the tour seen.
        return { ...DEFAULTS, ...('tour' in parsed ? {} : { tour: 'done' }), ...parsed };
    }
    catch {
        return { ...DEFAULTS };
    }
}
let current = load();
export const prefs = {
    get(key) {
        return current[key];
    },
    set(key, value) {
        current = { ...current, [key]: value };
        try {
            localStorage.setItem(KEY, JSON.stringify(current));
        }
        catch { /* private mode / blocked storage */ }
    },
    /** Reset layout + filters to defaults. */
    reset() {
        current = { ...DEFAULTS, tour: current.tour, tourVersion: current.tourVersion };
        try {
            localStorage.setItem(KEY, JSON.stringify(current));
        }
        catch { /* ignore */ }
    },
};
