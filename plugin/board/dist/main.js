/**
 * Rundown — entry module. Defines custom elements (each module self-registers), then connects the
 * artifact runtime. Markup is server-rendered in index.html; components enhance it in place.
 */
import './lib/theme.js';
import './components/rd-sidebar.js';
import './components/rd-count.js';
import './components/rd-stat-strip.js';
import './components/rd-streak.js';
import './components/rd-toolbar.js';
import './components/rd-note.js';
import './components/rd-status.js';
import './components/rd-project-list.js';
import './components/rd-decisions.js';
import './components/rd-priorities.js';
import './components/rd-composer.js';
import './components/rd-assistant.js';
import './components/rd-focus.js';
import './components/rd-settings.js';
import { connectRuntime } from './runtime.js';
import { byId } from './lib/dom.js';
import { initCheckin } from './lib/checkin.js';
import { initViewSwipe } from './lib/view-swipe.js';
import { initBoardToasts } from './lib/board-toasts.js';
initCheckin(byId('copy-cmd-2'));
initViewSwipe(document.querySelector('.ptable') ?? document.body);
initBoardToasts();
void connectRuntime();
export { store } from './store.js';
export { prefs } from './lib/prefs.js';
