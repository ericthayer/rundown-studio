const DAY_MS = 864e5;
/** Local midnight today. */
export function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
/** YYYY-MM-DD in local time. */
export function dayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Parse the date part of an ISO string as a local date (no UTC day shift). */
export function parseDay(s) {
    if (typeof s !== 'string' || !s)
        return null;
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d)
        return null;
    return new Date(y, m - 1, d);
}
export function daysSince(s) {
    const d = parseDay(s);
    return d ? Math.round((today().getTime() - d.getTime()) / DAY_MS) : null;
}
export function daysUntil(s) {
    const d = parseDay(s);
    return d ? Math.round((d.getTime() - today().getTime()) / DAY_MS) : null;
}
export function ago(s) {
    const n = daysSince(s);
    if (n === null)
        return 'no check-in';
    return n <= 0 ? 'today' : `${n}d ago`;
}
/** Milliseconds until the next local midnight (+1s buffer). */
export function msToMidnight() {
    const next = today();
    next.setDate(next.getDate() + 1);
    return next.getTime() - Date.now() + 1000;
}
