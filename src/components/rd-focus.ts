import { StoreElement } from './base.js';
import { setAttr } from '../lib/dom.js';

/**
 * Focus mode: puts the whole board in browser fullscreen, hiding the host page's chrome.
 * Stays hidden where the frame or browser refuses fullscreen (e.g. iPhone Safari), so the
 * button never appears unless it can work. Esc exits natively; the button toggles back.
 */
export class RdFocus extends StoreElement {
  protected setup(): void {
    if (!document.fullscreenEnabled) return;
    const btn = this.ref<HTMLButtonElement>('btn');
    this.hidden = false;
    btn.addEventListener('click', () => void this.#toggle());
    this.listen(document, 'fullscreenchange', () => this.#sync(btn));
    this.#sync(btn);
  }

  async #toggle(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { /* refused (no user activation or policy); the button simply stays unpressed */ }
  }

  #sync(btn: HTMLButtonElement): void {
    const on = Boolean(document.fullscreenElement);
    setAttr(btn, 'aria-pressed', String(on));
    setAttr(btn, 'aria-label', on ? 'Exit focus mode' : 'Enter focus mode');
    setAttr(btn, 'title', on ? 'Exit focus mode (Esc)' : 'Focus mode');
  }
}

customElements.define('rd-focus', RdFocus);
