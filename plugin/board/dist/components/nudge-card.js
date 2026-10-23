import { h, icon } from '../lib/dom.js';
import { UI } from '../lib/icons.js';
import { reveal } from '../lib/reveal.js';
import { decide, shortDay, undo } from '../lib/nudge-actions.js';
import { waitingOnOthers } from '../domain/signals.js';
const dotClass = (p) => `dot ${waitingOnOthers(p) ? 'waiting' : p.state ?? 'active'}`;
/**
 * One open suggestion: label, the step, why, then Not now and Use this (Park it). Text only, never
 * HTML. `after` runs once the decision landed, so the caller can place focus.
 */
export function suggestionCard(p, n, place, after) {
    const nameId = `ncard-${place}-${p.id}`;
    const park = n.kind === 'park';
    const run = (use) => async (e) => {
        const btns = e.currentTarget.closest('.ncard')?.querySelectorAll('button') ?? [];
        btns.forEach((b) => { b.disabled = true; });
        const ok = await decide(p, n, use);
        btns.forEach((b) => { b.disabled = false; });
        if (ok)
            after(use);
    };
    return h('div', { class: 'ncard', role: 'group', 'aria-labelledby': nameId, 'data-nudge': p.id }, h('div', { class: 'np' }, place === 'panel' ? h('span', { class: dotClass(p), 'aria-hidden': 'true' }) : null, h('span', { id: nameId, class: place === 'row' ? 'sr' : null }, place === 'row' ? `Suggestion for ${p.name}` : p.name), place === 'panel' ? h('button', { class: 'lnk', type: 'button', 'data-fk': `nudge:row:${p.id}`, 'aria-label': `Show ${p.name} in the list`, onclick: () => reveal(p.id) }, 'Show row') : null), h('span', { class: 'nl' }, icon(UI.spark), `Suggested · ${park ? 'Park it' : 'Next step'}`), h('span', { class: 'ns' }, n.text), n.why ? h('span', { class: 'nw' }, n.why) : null, h('div', { class: 'na' }, h('button', { class: 'fclear', type: 'button', 'data-fk': `nudge:no:${place}:${p.id}`, 'aria-label': `Dismiss suggestion for ${p.name}`, onclick: run(false) }, 'Not now'), h('button', { class: 'cta', type: 'button', 'data-fk': `nudge:use:${place}:${p.id}`, 'aria-label': park ? `Park ${p.name} as suggested` : `Use suggested next step for ${p.name}`, onclick: run(true) }, park ? 'Park it' : 'Use this')));
}
/** An accepted nudge still on its row: what was set, when, and Undo. */
export function setCard(p, n) {
    return h('li', { class: 'ncard done', 'data-nudge': p.id }, h('div', { class: 'np' }, h('span', { class: dotClass({ ...p, state: n.kind === 'park' ? 'parked' : p.state }), 'aria-hidden': 'true' }), h('span', {}, p.name), h('button', { class: 'lnk', type: 'button', 'data-fk': `nudge:undo:${p.id}`, 'aria-label': `Undo what was set for ${p.name}`, onclick: () => void undo(p, n) }, 'Undo')), h('span', { class: 'nw' }, n.kind === 'park' ? `Parked on the board ${shortDay(n.decidedAt)}.` : `Next step set on the board ${shortDay(n.decidedAt)}: ${n.text}`));
}
/** "Set on the board · Oct 23": marks a row whose next step (or park) came from an accepted nudge. */
export const setBadge = (at) => h('span', { class: 'setb' }, `Set on the board · ${shortDay(at)}`);
