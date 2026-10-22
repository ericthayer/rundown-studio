import { StoreElement, emit } from './base.js';
import { store } from '../store.js';
import { getSampler, revokeSampler } from '../runtime.js';
import { h } from '../lib/dom.js';

/** Fields sent to the model: status data only. */
const FIELDS = ['id', 'name', 'area', 'state', 'priority', 'lastActivity', 'due', 'leftOff', 'decided', 'openDecisions', 'blockers', 'nextStep'] as const;

/**
 * Ask box + answer area. With the `sample` capability it asks Claude about the projects; without it,
 * the same box filters the list (writes `query`).
 */
export class RdComposer extends StoreElement {
  #aborter: AbortController | null = null;
  #input!: HTMLTextAreaElement;
  #answer!: HTMLElement;

  protected setup(): void {
    this.#input = this.ref<HTMLTextAreaElement>('input');
    this.#answer = this.ref('answer');
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

  async ask(question: string): Promise<void> {
    if (!question) return;
    this.#input.value = question;
    const sample = getSampler();
    if (!sample) {
      store.set({ query: question.toLowerCase() });
      return;
    }
    this.#aborter?.abort();
    const aborter = new AbortController();
    this.#aborter = aborter;
    const out = h('div', {}, 'Thinking…');
    this.#answer.hidden = false;
    this.#answer.replaceChildren(h('div', { class: 'q' }, question), out);
    const data = store.state.projects.map((p) => Object.fromEntries(FIELDS.map((k) => [k, p[k]])));
    const prompt = `Today is ${store.state.day}. Below is a JSON list of one person's projects and their latest check-in status. Answer their question in plain text, under 120 words, no markdown headings. Use project names exactly. If the data can't answer it, say what's missing.\n\nProjects:\n${JSON.stringify(data)}\n\nQuestion: ${question}`;
    try {
      const res = await sample(prompt, { signal: aborter.signal, modelTier: 'quick', onText: ({ text }) => { out.textContent = text; } });
      out.textContent = res.text;
      emit(this, 'rd:answer', undefined);
    } catch (e) {
      const err = e as { name?: string; code?: string };
      if (err.name === 'AbortError') return;
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
