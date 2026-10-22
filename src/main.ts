/**
 * Rundown — entry module. Defines custom elements (each module self-registers), then connects the
 * artifact runtime. Markup is server-rendered in index.html; components enhance it in place.
 */
import './components/rd-sidebar.js';
import './components/rd-count.js';
import './components/rd-stat-strip.js';
import './components/rd-streak.js';
import './components/rd-toolbar.js';
import './components/rd-note.js';
import './components/rd-project-list.js';
import './components/rd-priorities.js';
import './components/rd-composer.js';
import './components/rd-assistant.js';
import { connectRuntime } from './runtime.js';
import { byId, copyCommand } from './lib/dom.js';

const cta = byId<HTMLButtonElement>('copy-cmd-2');
cta.addEventListener('click', () => {
  const label = cta.querySelector('.cta-lbl');
  if (label) void copyCommand(label, '/project-checkin');
});

void connectRuntime();

export { store } from './store.js';
export { prefs } from './lib/prefs.js';
