import { StoreElement } from './base.js';
import { prefs } from '../lib/prefs.js';
import { applyTheme } from '../lib/theme.js';
import { THEME, UI } from '../lib/icons.js';
import { feedbackAddress, feedbackHref, issuesHref } from '../lib/config.js';
import { toast } from '../lib/toast.js';
import { startTour } from '../lib/onboarding.js';
import { dragToDismiss } from '../lib/gestures.js';
import { h, icon, placeAbove, placeUnder, setAttr } from '../lib/dom.js';
import './rd-note-locker.js';
const MODES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
/** Phones and touch tablets (the same range as the type floor in mobile.css) get the sheet. */
const SHEET = matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1060px)');
const PHONE = matchMedia('(max-width: 720px)');
/**
 * Account settings next to the viewer's name: color mode, the note locker, and Help (tour replay, feedback, issues).
 * Desktop: an anchored popover. Phones: the same content in a full-screen modal sheet; touch tablets: a full-height side
 * sheet on the right, like the assistant drawer (scrolling body, focus trap, Escape, close button; dragging the header
 * down, or right on tablets, is a shortcut for the close button).
 */
export class RdSettings extends StoreElement {
    #btn;
    #pop;
    #sheet;
    #body;
    #content;
    setup() {
        this.#btn = this.ref('btn');
        this.#pop = this.ref('pop');
        const current = prefs.get('theme');
        const locker = document.createElement('rd-note-locker');
        locker.className = 'nlock';
        this.#content = h('div', { class: 'mset-content' }, h('fieldset', { class: 'fset' }, h('legend', {}, 'Color mode'), MODES.map(([value, label]) => h('label', { class: 'fopt' }, h('input', { type: 'radio', name: 'theme', value, checked: value === current, 'data-fk': `theme:${value}`, onchange: () => this.#set(value) }), icon(THEME[value]), label))), locker, this.#help());
        this.#pop.replaceChildren(this.#content);
        this.#pop.addEventListener('beforetoggle', (e) => { if (e.newState === 'open')
            this.#pop.replaceChildren(this.#content); });
        this.#pop.addEventListener('toggle', (e) => {
            const open = e.newState === 'open';
            this.#btn.setAttribute('aria-expanded', String(open));
            // Footer gear (desktop) opens upward; the top-bar gear opens downward.
            if (open)
                (this.#btn.getBoundingClientRect().top < innerHeight / 2 ? placeUnder : placeAbove)(this.#btn, this.#pop);
        });
        this.#buildSheet();
        // On phones and touch tablets the gear opens the sheet instead; cancelling the click stops its popovertarget.
        this.#btn.addEventListener('click', (e) => {
            if (!SHEET.matches)
                return;
            e.preventDefault();
            this.#openSheet();
        });
        this.listen(window, 'resize', () => { if (this.#pop.matches(':popover-open'))
            this.#pop.hidePopover(); });
        const leaveSheet = () => { if (this.#sheet.open)
            this.#sheet.close(); };
        SHEET.addEventListener('change', leaveSheet);
        this.onCleanup(() => SHEET.removeEventListener('change', leaveSheet));
    }
    /** Closes whichever surface is showing the settings. */
    close() {
        if (this.#sheet.open)
            this.#sheet.close();
        if (this.#pop.matches(':popover-open'))
            this.#pop.hidePopover();
    }
    #buildSheet() {
        const x = h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Close settings', onclick: () => this.#sheet.close() }, icon('<path d="m3 3 6 6M9 3 3 9"/>', '0 0 12 12'));
        const head = h('header', { class: 'fsh' }, h('h2', { id: 'msheet-h' }, 'Settings'), x);
        this.#body = h('div', { class: 'msheet-body' });
        this.#sheet = h('dialog', { class: 'fsheet msheet mpop', id: 'msheet', 'aria-labelledby': 'msheet-h', tabindex: -1 }, head, this.#body);
        this.#sheet.addEventListener('click', (e) => { if (e.target === this.#sheet)
            this.#sheet.close(); });
        this.#sheet.addEventListener('close', () => this.#btn.setAttribute('aria-expanded', 'false'));
        dragToDismiss({ handle: head, target: this.#sheet, axis: () => (this.#sheet.open ? (PHONE.matches ? 'down' : 'right') : null), onDismiss: () => this.#sheet.close() });
        this.#pop.after(this.#sheet);
    }
    #openSheet() {
        this.#body.replaceChildren(this.#content);
        this.#body.scrollTop = 0;
        this.#sheet.showModal();
        // Focus the sheet itself, so screen readers start at its title and no focus ring lands on Close; Tab stays trapped inside.
        this.#sheet.focus();
        this.#btn.setAttribute('aria-expanded', 'true');
    }
    /** Tour replay and feedback links. Link targets come from `meta/config` when set, so they're refreshed on config changes. */
    #help() {
        const tour = h('button', { class: 'fopt', type: 'button', 'data-fk': 'help:tour', onclick: () => { this.close(); void startTour(this.#btn); } }, icon(UI.tour), 'Take the tour');
        // A new window, because the artifact frame can't navigate itself to mailto:. The address is copied too,
        // so feedback still has somewhere to go when no mail app answers.
        const mail = h('a', { class: 'fopt', target: '_blank', rel: 'noopener noreferrer', 'data-fk': 'help:feedback', onclick: () => void this.#copyAddress() }, icon(UI.mail), 'Send feedback', h('span', { class: 'sr' }, ' (opens your email app)'));
        const issue = h('a', { class: 'fopt', target: '_blank', rel: 'noopener noreferrer', 'data-fk': 'help:issue' }, icon(UI.bug), 'Report an issue', h('span', { class: 'sr' }, ' (opens in a new tab)'));
        this.watch(['config'], () => { setAttr(mail, 'href', feedbackHref()); setAttr(issue, 'href', issuesHref()); });
        return h('fieldset', { class: 'fset fhelp' }, h('legend', {}, 'Help'), tour, mail, issue);
    }
    async #copyAddress() {
        const to = feedbackAddress();
        try {
            await navigator.clipboard.writeText(to);
            toast({ tone: 'info', text: `Opening your email app. ${to} is copied too.`, key: 'feedback' });
        }
        catch {
            toast({ tone: 'info', text: `Opening your email app. No app? Write to ${to}.`, key: 'feedback' });
        }
    }
    #set(mode) {
        prefs.set('theme', mode);
        applyTheme(mode);
    }
}
customElements.define('rd-settings', RdSettings);
