import type { AppState, LinkState, LoadStatus } from '../types.js';
import { StoreElement } from './base.js';
import { store } from '../store.js';
import { setText } from '../lib/dom.js';
import { reconnect } from '../runtime.js';

const clock = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

interface Band { tone: 'warn' | 'info'; title: string; text: string; retry: boolean }

/**
 * Connection band under the toolbar (offline, live updates paused, unreadable rows) plus the board's
 * polite live region, which announces load and connection changes once each.
 */
export class RdStatus extends StoreElement {
  #last: { status: LoadStatus; link: LinkState; skipped: number } | null = null;
  /** Set by a failed load, cleared by the next ready one (a retry passes through loading in between). */
  #failed = false;

  protected setup(): void {
    const band = this.ref('band');
    const title = this.ref('title');
    const text = this.ref('text');
    const retry = this.ref<HTMLButtonElement>('retry');
    retry.addEventListener('click', () => {
      setText(retry, 'Trying again…');
      void reconnect();
    });
    this.watch(['status', 'link', 'syncedAt', 'skipped', 'projects', 'openId'], (_c, s) => {
      const b = this.#band(s);
      band.hidden = !b;
      if (b) {
        band.dataset.tone = b.tone;
        setText(title, b.title);
        setText(text, b.text);
        retry.hidden = !b.retry;
        if (s.link === 'paused') setText(retry, 'Try again');
      }
      this.#announce(s);
      // An expanded row whose project left the board: close it and say why.
      if (s.openId && s.status === 'ready' && !s.projects.some((p) => p.id === s.openId)) {
        this.#say('The project you had open was removed from the board.');
        store.set({ openId: null });
      }
    });
  }

  #band(s: Readonly<AppState>): Band | null {
    if (s.status !== 'ready' || !s.syncedAt) return null;
    const since = `Showing projects from ${clock(s.syncedAt)}.`;
    if (s.link === 'offline') return { tone: 'warn', title: "You're offline.", text: `${since} They refresh when you're back online.`, retry: false };
    if (s.link === 'paused') return { tone: 'warn', title: 'Live updates paused.', text: `${since} The board stopped hearing from its database.`, retry: true };
    if (s.skipped > 0) {
      const one = s.skipped === 1;
      const title = one ? "1 row couldn't be read." : `${s.skipped} rows couldn't be read.`;
      const text = one ? 'A check-in saved it without a project name. Run the check-in again for that project.' : 'Check-ins saved them without project names. Run the check-in again for those projects.';
      return { tone: 'info', title, text, retry: false };
    }
    return null;
  }

  /** One announcement per transition, never per snapshot. */
  #announce(s: Readonly<AppState>): void {
    const prev = this.#last;
    this.#last = { status: s.status, link: s.link, skipped: s.skipped };
    if (!prev) return;
    const recovered = this.#failed && s.status === 'ready';
    if (s.status === 'error') this.#failed = true;
    if (recovered) this.#failed = false;
    if (s.status === 'error' && prev.status !== 'error') this.#say(s.link === 'offline' ? "You're offline. Projects load when you're back." : "Can't reach your board. Try again in a moment.");
    else if (s.link !== prev.link) {
      if (s.link === 'offline') this.#say("You're offline. Showing the last projects loaded.");
      // Paused and resumed are announced by their toasts (board-toasts.ts).
      else if (s.status === 'ready' && prev.link !== 'paused') this.#say('Back online. Projects are up to date.');
    } else if (recovered) this.#say('Connected. Projects loaded.');
    if (s.skipped > prev.skipped) this.#say(`${s.skipped} project rows couldn't be read.`);
  }

  #say(msg: string): void {
    const live = this.ref('live');
    // Clear first so the same message twice is still announced.
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = msg; });
  }
}

customElements.define('rd-status', RdStatus);
