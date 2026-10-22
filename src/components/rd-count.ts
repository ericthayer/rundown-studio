import { StoreElement } from './base.js';
import { setText } from '../lib/dom.js';
import { visibleProjects } from '../domain/filters.js';

/** Visible-project count pill next to the page title. */
export class RdCount extends StoreElement {
  protected setup(): void {
    this.watch(['projects', 'filter', 'query', 'filters', 'day'], (_c, s) => setText(this, String(visibleProjects(s).length)));
  }
}

customElements.define('rd-count', RdCount);
