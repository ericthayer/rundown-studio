import { getSampler, revokeSampler } from '../runtime.js';
import { STALL_MS, UNAVAILABLE } from './sample-errors.js';
/** Fields sent to the model: status data only. */
export const MODEL_FIELDS = ['id', 'name', 'area', 'state', 'priority', 'lastActivity', 'due', 'leftOff', 'decided', 'openDecisions', 'waitingOn', 'blockers', 'nextStep'];
export const modelRows = (projects) => projects.map((p) => Object.fromEntries(MODEL_FIELDS.map((k) => [k, p[k]])));
/** The first `{…}` object in a reply, tolerating code fences and stray prose. Undefined when none parses. */
export function extractJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start)
        return undefined;
    try {
        return JSON.parse(text.slice(start, end + 1));
    }
    catch {
        return undefined;
    }
}
export async function sampleJson(prompt, opts) {
    const sample = getSampler();
    if (!sample)
        return { ok: false, code: 'not_granted' };
    if (navigator.onLine === false)
        return { ok: false, code: 'offline' };
    const aborter = new AbortController();
    const outer = opts.signal;
    const cancel = () => aborter.abort();
    outer?.addEventListener('abort', cancel, { once: true });
    let stalled = false;
    let stall = 0;
    const arm = () => { clearTimeout(stall); stall = window.setTimeout(() => { stalled = true; aborter.abort(); }, STALL_MS); };
    arm();
    try {
        const res = await sample(prompt, { signal: aborter.signal, modelTier: opts.tier, onText: arm });
        const value = extractJson(res.text);
        return value === undefined ? { ok: false, code: 'unusable' } : { ok: true, value };
    }
    catch (e) {
        const err = e;
        if (stalled)
            return { ok: false, code: 'stalled' };
        if (outer?.aborted || err.name === 'AbortError' || err.code === 'cancelled')
            return { ok: false, code: 'cancelled' };
        if (err.code && UNAVAILABLE.has(err.code))
            revokeSampler();
        return { ok: false, code: err.code ?? 'upstream_error' };
    }
    finally {
        clearTimeout(stall);
        outer?.removeEventListener('abort', cancel);
    }
}
