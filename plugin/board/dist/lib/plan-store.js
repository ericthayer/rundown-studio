import { KEEP_WEEKS, toWeekPlan } from '../domain/week-plan.js';
export const PLANS = 'plans';
let db = null;
/** Subscribes to the board's plans, newest week first. A dead listener reports an empty list, never throws. */
export function connectPlans(next, onPlans) {
    db = next;
    db.collection(PLANS).onSnapshot((s) => {
        const plans = [];
        for (const d of s.docs) {
            let data;
            try {
                data = d.data();
            }
            catch {
                data = undefined;
            }
            const plan = toWeekPlan(d.id, data, []);
            if (plan)
                plans.push(plan);
        }
        onPlans(plans.sort((a, b) => (a.week < b.week ? 1 : -1)));
    }, () => onPlans([]));
}
/** Writes the whole plan doc. Rejects when the board refuses the write. */
export async function writePlan(plan) {
    if (!db)
        throw new Error('no db');
    await db.collection(PLANS).doc(plan.week).set({ week: plan.week, draft: plan.draft, pinned: plan.pinned });
}
/** Deletes plans older than KEEP_WEEKS weeks before `week`. Best effort: a refused delete waits for the next pin. */
export async function prunePlans(plans, week) {
    const keep = new Set(plans.map((p) => p.week).filter((w) => w <= week).sort().reverse().slice(0, KEEP_WEEKS));
    for (const p of plans) {
        if (p.week < week && !keep.has(p.week))
            await db?.collection(PLANS).doc(p.week).delete().catch(() => undefined);
    }
}
