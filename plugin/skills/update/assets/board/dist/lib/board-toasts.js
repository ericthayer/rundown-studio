import { store } from '../store.js';
import { toast } from './toast.js';
import { reconnect } from '../runtime.js';
import { reveal } from './reveal.js';
const STATE_LABEL = { active: 'active', blocked: 'blocked', stale: 'stale', parked: 'parked' };
/** Fields a check-in or rundown writes; a change to any of them counts as an update. */
const FIELDS = ['name', 'nextStep', 'leftOff', 'lastActivity', 'due', 'priority', 'blockers', 'openDecisions', 'waitingOn', 'decided', 'sourceError'];
export function diffProjects(prev, next) {
    const before = new Map(prev.map((p) => [p.id, p]));
    const out = [];
    for (const p of next) {
        const old = before.get(p.id);
        before.delete(p.id);
        if (!old)
            out.push({ p, what: 'added' });
        else if ((old.state ?? 'active') !== (p.state ?? 'active'))
            out.push({ p, what: 'state' });
        else if (FIELDS.some((k) => JSON.stringify(old[k]) !== JSON.stringify(p[k])))
            out.push({ p, what: 'updated' });
    }
    for (const p of before.values())
        out.push({ p, what: 'removed' });
    return out;
}
export function describe(changes) {
    const [one] = changes;
    if (changes.length !== 1 || !one) {
        const added = changes.filter((c) => c.what === 'added').length;
        const rest = changes.length - added;
        const parts = [added ? `${added} added` : '', rest ? `${rest} updated` : ''].filter(Boolean);
        return `Board updated: ${changes.length} projects (${parts.join(', ')}).`;
    }
    const name = one.p.name;
    if (one.what === 'added')
        return `New project on the board: ${name}.`;
    if (one.what === 'removed')
        return `${name} was removed from the board.`;
    if (one.what === 'state')
        return `${name} is now ${STATE_LABEL[one.p.state ?? 'active'] ?? one.p.state}.`;
    return `${name} was updated.`;
}
export function initBoardToasts() {
    let prev = null;
    let link = store.state.link;
    // Diffs the db rows, not the overlaid projects: accepting a nudge on this page is not a board update.
    store.subscribe(['rows', 'link', 'status'], (changed, s) => {
        if (changed.has('link') && s.link !== link) {
            if (s.link === 'paused')
                toast({ tone: 'error', key: 'feed', text: "Couldn't refresh the board. Live updates are paused.", action: { label: 'Retry', run: () => reconnect() } });
            else if (link === 'paused' && s.link === 'live')
                toast({ tone: 'ok', key: 'feed', text: 'Live updates resumed. The board is current.' });
            link = s.link;
        }
        if (!changed.has('rows') || s.status !== 'ready')
            return;
        // The first snapshot only sets the baseline: loading the board is not an update.
        if (prev === null) {
            prev = s.rows;
            return;
        }
        const changes = diffProjects(prev, s.rows);
        prev = s.rows;
        if (!changes.length)
            return;
        const [one] = changes;
        const target = changes.length === 1 && one && one.what !== 'removed' ? one.p.id : null;
        toast({ tone: 'ok', key: 'board', text: describe(changes), action: target ? { label: 'View', run: () => reveal(target) } : undefined });
    });
}
