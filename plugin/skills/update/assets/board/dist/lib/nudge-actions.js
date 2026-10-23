import { store } from '../store.js';
import { toast } from './toast.js';
import { writeNudge } from './nudge-store.js';
import { replaced, rowBasis } from '../domain/nudges.js';
const shortDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
/** Writes `next`; on refusal, an error toast retries the same write. Resolves true once it landed. */
async function save(next, failText) {
    try {
        await writeNudge(next);
        return true;
    }
    catch {
        toast({ tone: 'error', key: `nudge:${next.projectId}`, text: failText, action: { label: 'Retry', run: async () => { await save(next, failText); } } });
        return false;
    }
}
/** Use this (or Park it) and Not now. Shows a 5s toast with Undo, which writes the suggestion back. */
export async function decide(p, n, use) {
    const next = { ...n, status: use ? 'accepted' : 'dismissed', decidedAt: new Date().toISOString() };
    const ok = await save(next, use ? `Couldn't set the next step for ${p.name} on the board.` : `Couldn't hide the suggestion for ${p.name}.`);
    if (!ok)
        return false;
    const text = !use ? `Suggestion hidden for ${p.name}.` : n.kind === 'park' ? `${p.name} parked on the board.` : `Next step set for ${p.name}.`;
    toast({ tone: 'ok', key: `nudge:${p.id}`, text, action: { label: 'Undo', run: () => undo(p, n) } });
    return true;
}
/** Puts a decided nudge back to an open suggestion. */
export async function undo(p, n) {
    const back = { ...n, status: 'suggested', decidedAt: null };
    if (await save(back, `Couldn't undo that for ${p.name}.`))
        toast({ tone: 'info', key: `nudge:${p.id}`, text: `Suggestion for ${p.name} is back.` });
}
/** After a check-in replaced it: sets the same step (or park) on the board again, against the row as it is now. */
async function restore(p, n) {
    const again = { ...n, status: 'accepted', basis: rowBasis(p), decidedAt: new Date().toISOString() };
    if (await save(again, `Couldn't restore the next step for ${p.name}.`))
        toast({ tone: 'ok', key: `nudge:${p.id}`, text: n.kind === 'park' ? `${p.name} parked on the board again.` : `Next step for ${p.name} restored.` });
}
/**
 * Older check-in skills don't know about nudges, so their check-in can replace a board-set step
 * silently. Says so once per nudge (marked `superseded` on the board, so other devices stay quiet)
 * and offers Restore.
 */
export function watchReplaced() {
    const told = new Set();
    store.subscribe(['rows', 'nudges', 'status'], (_c, s) => {
        if (s.status !== 'ready' || !s.nudges?.length)
            return;
        const rows = new Map(s.rows.map((p) => [p.id, p]));
        for (const n of s.nudges) {
            const p = rows.get(n.projectId);
            const key = `${n.projectId}@${n.decidedAt ?? ''}`;
            if (!p || told.has(key) || !replaced(n, p))
                continue;
            told.add(key);
            void writeNudge({ ...n, status: 'superseded' }).catch(() => undefined);
            const what = n.kind === 'park' ? `A check-in un-parked ${p.name}, which you parked on ${shortDay(n.decidedAt)}.` : `A check-in replaced the next step you set for ${p.name} on ${shortDay(n.decidedAt)}.`;
            toast({ tone: 'info', key: `restore:${p.id}`, text: what, action: { label: 'Restore', run: () => restore(p, n) } });
        }
    });
}
export { shortDay };
