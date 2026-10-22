import { ago, daysUntil, parseDay, today } from '../lib/dates.js';
import { overdueWait, waitingOnOthers } from './signals.js';
export const AREA_LABEL = { work: 'Work', client: 'Client', personal: 'Personal' };
export const isArea = (v) => v === 'work' || v === 'client' || v === 'personal';
/** Non-empty strings from an unknown list field. */
export function strings(v) {
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '') : [];
}
export function dueSoon(p) {
    const n = daysUntil(p.due);
    return n !== null && n <= 7;
}
/** Blocked on you, stale, or due soon. Blocked only on others counts once the wait is overdue. */
export function needsYou(p) {
    const blocked = p.state === 'blocked' && (!waitingOnOthers(p) || overdueWait(p));
    return blocked || p.state === 'stale' || (p.state !== 'parked' && dueSoon(p));
}
export function byPriority(a, b) {
    return (a.priority ?? 99) - (b.priority ?? 99) || String(a.name).localeCompare(String(b.name));
}
/** Short status line for a row: parked / due window / last check-in. */
export function whenLabel(p) {
    if (p.state === 'parked')
        return 'parked';
    const due = daysUntil(p.due);
    if (due !== null && due <= 7)
        return due < 0 ? `overdue ${-due}d` : due === 0 ? 'due today' : `due in ${due}d`;
    return ago(p.lastActivity);
}
export function topPriorities(projects, n = 3) {
    return projects.filter((p) => p.state !== 'parked').sort(byPriority).slice(0, n);
}
export function streakTier(n) {
    return n >= 30 ? 5 : n >= 14 ? 4 : n >= 7 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
}
/**
 * Consecutive days with activity, alive through yesterday. Source, best first:
 * meta.streak → meta.sessionDays → distinct project check-in days.
 */
export function streakInfo(meta, projects) {
    if (typeof meta.streak === 'number' && Number.isFinite(meta.streak)) {
        const n = Math.max(0, Math.floor(meta.streak));
        return { n, source: 'rundown', tier: streakTier(n) };
    }
    const useSessions = Array.isArray(meta.sessionDays);
    const raw = useSessions ? (meta.sessionDays ?? []) : projects.map((p) => p.lastActivity);
    const days = new Set(raw.map((d) => parseDay(d)?.getTime()).filter((t) => t !== undefined));
    const cursor = today();
    if (!days.has(cursor.getTime()))
        cursor.setDate(cursor.getDate() - 1);
    let n = 0;
    while (days.has(cursor.getTime())) {
        n++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return { n, source: useSessions ? 'Claude sessions' : 'project check-ins', tier: streakTier(n) };
}
/** Normalizes a raw database row; rows without a name are dropped by the caller. */
export function toProject(id, data) {
    return { id, ...(data ?? {}) };
}
