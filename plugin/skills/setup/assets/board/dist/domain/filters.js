import { daysSince, daysUntil } from '../lib/dates.js';
import { byPriority, isArea, needsYou, strings } from './projects.js';
import { decisions, waits } from './signals.js';
export const defaultFilters = () => ({ status: [], updated: 'any', due: 'any', kind: [], flags: [], sort: 'needs' });
const UPDATED = {
    today: (d) => d !== null && d <= 0,
    week: (d) => d !== null && d <= 7,
    month: (d) => d !== null && d <= 30,
    old: (d) => d === null || d > 30,
};
const DUE = {
    overdue: (n) => n !== null && n < 0,
    week: (n) => n !== null && n >= 0 && n <= 7,
    has: (n) => n !== null,
    none: (n) => n === null,
};
const FLAG = {
    blockers: (p) => strings(p.blockers).length > 0,
    decisions: (p) => decisions(p).length > 0,
    waiting: (p) => waits(p).length > 0,
    nonext: (p) => !p.nextStep,
};
export const SORT = {
    needs: (a, b) => Number(needsYou(b)) - Number(needsYou(a)) || byPriority(a, b),
    priority: byPriority,
    recent: (a, b) => (daysSince(a.lastActivity) ?? 1e9) - (daysSince(b.lastActivity) ?? 1e9) || byPriority(a, b),
    due: (a, b) => (daysUntil(a.due) ?? 1e9) - (daysUntil(b.due) ?? 1e9) || byPriority(a, b),
    name: (a, b) => String(a.name).localeCompare(String(b.name)),
};
export const GROUPS = [
    { key: 'status', title: 'Status', multi: true, opts: [['blocked', 'Blocked'], ['stale', 'Stale'], ['active', 'Active'], ['parked', 'Parked']], test: (p, v) => (p.state ?? 'active') === v },
    { key: 'updated', title: 'Updated', multi: false, opts: [['any', 'Any time'], ['today', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days'], ['old', '30+ days or never']], test: (p, v) => UPDATED[v](daysSince(p.lastActivity)) },
    { key: 'due', title: 'Due', multi: false, opts: [['any', 'Any'], ['overdue', 'Overdue'], ['week', 'Next 7 days'], ['has', 'Has a due date'], ['none', 'No due date']], test: (p, v) => DUE[v](daysUntil(p.due)) },
    { key: 'kind', title: 'Type', multi: true, opts: [['project', 'Project'], ['chat', 'Chat'], ['repo', 'Repo']], test: (p, v) => p.kind === v },
    { key: 'flags', title: 'Has', multi: true, all: true, opts: [['blockers', 'Blockers'], ['decisions', 'Open decisions'], ['waiting', 'Waiting on'], ['nonext', 'No next step']], test: (p, v) => FLAG[v](p) },
];
export const SORT_OPTIONS = [['needs', 'Needs you'], ['priority', 'Priority'], ['recent', 'Last updated'], ['due', 'Due date'], ['name', 'Name']];
/** Untyped bridge for UI code that iterates groups generically. */
export function testOption(g, p, v) {
    if (v === 'any')
        return true;
    return g.test(p, v);
}
export function selected(g, f) {
    const v = f[g.key];
    return Array.isArray(v) ? [...v] : v === 'any' ? [] : [v];
}
export const isActive = (g, f) => selected(g, f).length > 0;
export const activeCount = (f) => GROUPS.filter((g) => isActive(g, f)).length;
export function chipValue(g, f) {
    const sel = selected(g, f);
    if (!sel.length)
        return '';
    const label = (v) => g.opts.find(([k]) => k === v)?.[1] ?? v;
    return g.multi ? (sel.length === 1 ? label(sel[0] ?? '') : `${sel.length} selected`) : label(sel[0] ?? '');
}
/** Returns new filters with one option toggled (multi) or set (single). */
export function withOption(f, g, value, on) {
    if (g.multi) {
        const cur = f[g.key];
        const next = on ? [...new Set([...cur, value])] : cur.filter((x) => x !== value);
        return { ...f, [g.key]: next };
    }
    return { ...f, [g.key]: value };
}
function passToolbar(p, f) {
    return GROUPS.every((g) => {
        const sel = selected(g, f);
        if (!sel.length)
            return true;
        return g.multi && g.all ? sel.every((v) => testOption(g, p, v)) : sel.some((v) => testOption(g, p, v));
    });
}
function passRail(p, filter) {
    if (filter === 'needs')
        return needsYou(p);
    if (filter === 'decisions')
        return p.state !== 'parked' && decisions(p).length > 0;
    if (filter === 'waiting')
        return waits(p).length > 0;
    if (filter === 'blocked' || filter === 'stale' || filter === 'parked')
        return p.state === filter;
    if (isArea(filter))
        return p.area === filter;
    return true;
}
function passQuery(p, q) {
    if (!q)
        return true;
    const signals = [...decisions(p).map((d) => d.text), ...waits(p).flatMap((w) => [w.who, w.what])];
    return [p.name, p.leftOff, p.nextStep, ...signals, ...strings(p.blockers), ...strings(p.decided)].join(' ').toLowerCase().includes(q);
}
let memo = null;
/** Visible, sorted projects for the current state. Memoized on its inputs. */
export function visibleProjects(s) {
    const key = [s.projects, s.filter, s.query, s.filters, s.day];
    if (memo && memo.key.every((k, i) => Object.is(k, key[i])))
        return memo.result;
    const result = s.projects.filter((p) => passRail(p, s.filter) && passToolbar(p, s.filters) && passQuery(p, s.query)).sort(SORT[s.filters.sort] ?? SORT.needs);
    memo = { key, result };
    return result;
}
