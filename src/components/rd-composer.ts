import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { getSampler, revokeSampler } from '../runtime.js';
import { h, setAttr, setText } from '../lib/dom.js';
import { type AskTurn, loadTurns, saveTurns, recap, MAX_TURNS } from '../lib/ask-history.js';
import { type RdSaveMenu, savedAnswer } from './rd-save-menu.js';
import './rd-save-menu.js';

/** Fields sent to the model: status data only. */
const FIELDS = ['id', 'name', 'area', 'state', 'priority', 'lastActivity', 'due', 'leftOff', 'decided', 'openDecisions', 'waitingOn', 'blockers', 'nextStep'] as const;

/**
 * Ask box + transcript. With the `sample` capability it asks Claude about the projects; without it,
 * the same box filters the list (writes `query`). The transcript is kept for this tab only.
 */
export class RdComposer extends StoreElement {
  #aborter: AbortController | null = null;
  #input!: HTMLTextAreaElement;
  #scroll!: HTMLElement;
  #log!: HTMLElement;
  #head!: HTMLElement;
  #turns: AskTurn[] = loadTurns();
  #menu!: RdSaveMenu;
  /** Save button per answer element, relabelled as the board's saved answers change. */
  #saves = new Map<HTMLElement, { btn: HTMLButtonElement; a: string }>();

  protected setup(): void {
    this.#input = this.ref<HTMLTextAreaElement>('input');
    this.#scroll = this.ref('scroll');
    this.#log = this.ref('log');
    this.#head = this.ref('head');
    this.ref('clear').addEventListener('click', () => this.clear());
    this.#menu = document.createElement('rd-save-menu') as RdSaveMenu;
    this.append(this.#menu);
    this.#log.replaceChildren(...this.#turns.map((t) => { const [el] = this.#turnEl(t.q, t.a); this.#addSave(el, t.q, t.a); return el; }));
    this.#sync();
    this.watch(['notes'], () => this.#labelSaves());
    const form = this.ref<HTMLFormElement>('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = this.#input.value.trim();
      if (q) void this.ask(q);
    });
    this.#input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    if (!CSS.supports('field-sizing', 'content')) {
      this.#input.addEventListener('input', () => { this.#input.style.height = 'auto'; this.#input.style.height = `${this.#input.scrollHeight}px`; });
    }
    this.querySelectorAll<HTMLButtonElement>('.chip[data-q]').forEach((b) => b.addEventListener('click', () => void this.ask(b.dataset.q ?? '')));
    this.watch(['canAsk'], (_c, s) => { this.#input.placeholder = s.canAsk ? 'Ask about your projects…' : 'Filter projects…'; });
  }

  focusInput(): void {
    this.#input.focus();
  }

  /** Drops this tab's transcript and stops any answer in flight. */
  clear(): void {
    this.#aborter?.abort();
    this.#turns = [];
    saveTurns(this.#turns);
    this.#log.replaceChildren();
    this.#sync();
    this.focusInput();
  }

  #turnEl(q: string, a: string): [HTMLElement, HTMLElement] {
    const out = h('div', {}, a);
    return [h('article', { class: 'answer' }, h('div', { class: 'q' }, q), out), out];
  }

  #sync(): void {
    this.#head.hidden = !this.#turns.length;
    while (this.#log.childElementCount > MAX_TURNS) this.#log.firstElementChild?.remove();
    for (const el of this.#saves.keys()) if (!el.isConnected) this.#saves.delete(el);
  }

  /** Save button under a finished answer; opens the shared Save to menu. */
  #addSave(el: HTMLElement, q: string, a: string): void {
    const btn = h('button', { class: 'asave', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'asave-pop', onclick: () => this.#menu.open(btn, q, a) });
    el.append(h('div', { class: 'afoot' }, btn));
    this.#saves.set(el, { btn, a });
    this.#labelSaves();
  }

  #labelSaves(): void {
    const notes = store.state.notes;
    this.#saves.forEach(({ btn, a }, el) => {
      const saved = Boolean(savedAnswer(a, notes));
      setText(btn, saved ? 'Saved' : 'Save');
      btn.classList.toggle('on', saved);
      setAttr(btn, 'aria-label', `${saved ? 'Saved. Change where' : 'Save'} this answer: ${el.querySelector('.q')?.textContent ?? ''}`);
    });
  }

  async ask(question: string): Promise<void> {
    if (!question) return;
    this.#input.value = question;
    const sample = getSampler();
    if (!sample) {
      store.set({ query: question.toLowerCase() });
      return;
    }
    this.#input.value = '';
    this.#aborter?.abort();
    const aborter = new AbortController();
    this.#aborter = aborter;
    const turn: AskTurn = { q: question, a: '', at: new Date().toISOString() };
    const context = recap(this.#turns);
    this.#turns = [...this.#turns, turn].slice(-MAX_TURNS);
    const [el, out] = this.#turnEl(question, 'Thinking…');
    this.#log.append(el);
    this.#sync();
    requestAnimationFrame(() => { this.#scroll.scrollTop = this.#scroll.scrollHeight; });
    const keep = (text: string): void => { turn.a = text; saveTurns(this.#turns); };
    const data = store.state.projects.map((p) => Object.fromEntries(FIELDS.map((k) => [k, p[k]])));
    const prompt = `Today is ${store.state.day}. Below is a JSON list of one person's projects and their latest check-in status. Answer their question in plain text, under 120 words, no markdown headings. Use project names exactly. If the data can't answer it, say what's missing.\n\nProjects:\n${JSON.stringify(data)}\n\n${context ? `Earlier in this conversation:\n${context}\n\n` : ''}Question: ${question}`;
    try {
      const res = await sample(prompt, { signal: aborter.signal, modelTier: 'quick', onText: ({ text }) => { out.textContent = text; } });
      out.textContent = res.text;
      keep(res.text);
      this.#addSave(el, question, res.text);
      emit(this, 'rd:answer', undefined);
    } catch (e) {
      const err = e as { name?: string; code?: string };
      if (err.name === 'AbortError') {
        // Superseded by a newer question: keep what streamed, or drop an answer that never started.
        if (out.textContent && out.textContent !== 'Thinking…') { keep(out.textContent); this.#addSave(el, question, out.textContent); }
        else { el.remove(); this.#turns = this.#turns.filter((t) => t !== turn); saveTurns(this.#turns); this.#sync(); }
        return;
      }
      this.#turns = this.#turns.filter((t) => t !== turn);
      saveTurns(this.#turns);
      if (err.code === 'not_granted') {
        out.textContent = 'Asking needs permission. The box now filters the list instead.';
        revokeSampler();
      } else {
        out.textContent = err.code === 'rate_limited' ? 'Too many questions in a row. Try again in a minute.' : "Couldn't get an answer. Try again.";
      }
    }
  }
}

customElements.define('rd-composer', RdComposer);
