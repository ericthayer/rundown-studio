// Stalled tab: suggest with the board's Claude, Use this / Not now / Undo, the overlay across a rundown
// and a check-in, Restore, failures, badges, keyboard tabs, phone.
import { join } from 'node:path';
import { page, check, finish, OUT, ROWS } from './harness.mjs';

const REPLY = { suggestions: [
  { projectId: 'a', kind: 'next', text: 'Ask the Agrikit admin for a test MCP token today.', why: 'Unblocks the adapter, due in 3 days.' },
  { projectId: 'c', kind: 'park', text: 'Park Token Map until Agrikit ships.', why: 'No activity in 40 days.' },
  { projectId: 'a', kind: 'park', text: 'Duplicate for a.', why: '' },
  { projectId: 'e', kind: 'next', text: 'Not a stalled row.', why: '' },
  { projectId: 'nope', kind: 'next', text: 'Not on the board.', why: '' },
] };

const withSampler = (reply) => {
  window.__calls = [];
  const use = window.claude.use;
  window.claude.use = async (n) => (n === 'sample' ? async (prompt, opts = {}) => {
    window.__calls.push({ prompt, tier: opts.modelTier });
    const mode = window.__mode;
    if (mode === 'junk') return { text: 'Here are some ideas: email the client.' };
    if (mode === 'half') return { text: JSON.stringify({ suggestions: reply.suggestions.slice(0, 1) }) };
    if (mode) throw { code: mode, message: mode };
    return { text: JSON.stringify(reply) };
  } : use(n));
};

const nudges = (p) => p.evaluate(() => window.__nudges());
const toastText = (p) => p.evaluate(() => [...document.querySelectorAll('.toast .toast-msg')].map((e) => e.textContent).join(' | '));

const { p, errors } = await page({ init: withSampler, initArg: REPLY });
await p.waitForSelector('.pitem');
check('Stalled tab counts blocked-on-you and stale rows', (await p.textContent('#tab-stalled .bdg')) === '2' && (await p.getAttribute('#tab-stalled', 'aria-label')) === 'Stalled, 2 need a next step');
check('This week is the default tab', (await p.getAttribute('#tab-week', 'aria-selected')) === 'true' && await p.isHidden('#tp-stalled'));

// Keyboard: arrows move between tabs (automatic activation), roving tabindex.
await p.focus('#tab-week'); await p.keyboard.press('ArrowRight');
check('ArrowRight selects and focuses Stalled', await p.evaluate(() => document.activeElement?.id === 'tab-stalled') && await p.isVisible('#tp-stalled') && (await p.getAttribute('#tab-week', 'tabindex')) === '-1');
check('pending rows are named', (await p.textContent('.npend p')).includes('Agrikit plugin, Token Map'));
await p.click('[data-fk="stall:suggest"]');
await p.waitForSelector('.nlist .ncard');
const call = await p.evaluate(() => window.__calls[0]);
check('suggest uses the quick tier', call.tier === 'quick');
check('prompt sends only stalled rows', call.prompt.includes('"Agrikit plugin"') && call.prompt.includes('"Token Map"') && !call.prompt.includes('"WordPress handoff"') && !call.prompt.includes('"Portfolio chat agent"'));
check('two valid cards; extra, unknown and disallowed park dropped', (await p.$$eval('.stall .ncard', (c) => c.map((x) => x.dataset.nudge))).join() === 'a,c');
check('cards say Suggested, in text', (await p.textContent('.stall .ncard .nl')).startsWith('Suggested · Next step'));
check('park card offers Park it', (await p.textContent('.stall .ncard[data-nudge="c"] .cta')) === 'Park it');
check('title counts suggestions', (await p.textContent('#stall-h')) === '2 suggestions');
check('suggestions saved to the board', Object.values(await nudges(p)).every((n) => n.status === 'suggested') && Object.keys(await nudges(p)).sort().join() === 'a,c');
check('rows carry a Suggestion chip', (await p.$$eval('.pitem .sugm:not([hidden])', (c) => c.length)) === 2);
check('badge still counts open suggestions', (await p.textContent('#tab-stalled .bdg')) === '2');
await p.screenshot({ path: join(OUT, 'nudges-panel.png') });

// Use this: overlay on the row, Undo toast, no board-update toast, focus to the next card.
await p.click('[data-fk="nudge:use:panel:a"]');
await p.waitForFunction(() => window.__nudges().a?.status === 'accepted');
check('Use this toast with Undo', (await toastText(p)).includes('Next step set for Agrikit plugin.') && await p.isVisible('.toast [data-fk="toast:nudge:a"]'));
check('no "was updated" board toast', !(await toastText(p)).includes('was updated'));
check('focus moves to the next card', await p.evaluate(() => document.activeElement?.dataset.fk === 'nudge:use:panel:c'));
check('row chip reads Set on the board', (await p.textContent('[data-key="a"] .setb')).startsWith('Set on the board'));
check('Set on the board list shows it', (await p.textContent('.nset')).includes('Ask the Agrikit admin'));
check('Top priorities shows the accepted step', (await p.textContent('rd-priorities')).includes('Ask the Agrikit admin'));
await p.click('[data-fk="row:a"]');
check('expanded row shows the step and the badge', (await p.textContent('[data-key="a"] .ns-h')) === 'Ask the Agrikit admin for a test MCP token today.' && await p.isVisible('[data-key="a"] .nscard .setb'));
await p.click('.toast [data-fk="toast:nudge:a"]');
await p.waitForFunction(() => window.__nudges().a?.status === 'suggested');
check('Undo puts the suggestion back', (await p.textContent('[data-key="a"] .ns-h')) === 'Ship the MCP adapter.' && await p.isVisible('[data-key="a"] .nscard .ncard'));

// Not now from the expanded row: focus returns to the row.
await p.click('[data-fk="nudge:no:row:a"]');
await p.waitForFunction(() => window.__nudges().a?.status === 'dismissed');
check('Not now hides it and keeps focus on the row', await p.evaluate(() => document.activeElement?.dataset.fk === 'row:a') && !(await p.isVisible('[data-key="a"] .sugm')));

// Park it: the row shows parked until a check-in says otherwise.
await p.click('[data-fk="nudge:use:panel:c"]');
await p.waitForFunction(() => window.__nudges().c?.status === 'accepted');
check('Park it parks the row on the board', (await p.textContent('[data-key="c"] time')) === 'parked' && (await toastText(p)).includes('Token Map parked on the board.'));
check('nothing left to count', await p.isHidden('#tab-stalled .bdg'));
check('dismissed rows stay quiet after a reload', await (async () => { await p.reload(); await p.waitForSelector('.pitem'); return p.isHidden('#tab-stalled .bdg'); })());

// The rundown's write keeps the overlay; a check-in with another value ends it and offers Restore once.
const push = (patch) => p.evaluate(({ rows, patch }) => window.__push(rows.map((r) => (r.id === 'c' ? { ...r, ...patch } : r))), { rows: ROWS, patch });
await push({ updatedBy: 'rundown', updatedAt: new Date().toISOString(), leftOff: 'Still quiet.' });
check('a rundown write keeps the park', (await p.textContent('[data-key="c"] time')) === 'parked');
await push({ updatedBy: 'checkin', updatedAt: new Date(Date.now() + 1000).toISOString() });
await p.waitForFunction(() => document.querySelector('.toast[data-key="restore:c"]'));
check('check-in that un-parks: Restore toast', (await toastText(p)).includes('A check-in un-parked Token Map'));
await p.waitForFunction(() => window.__nudges().c?.status === 'superseded');
check('overlay ends with the check-in', (await p.textContent('[data-key="c"] time')) !== 'parked');
await p.waitForTimeout(1100);
await p.click('.toast[data-key="restore:c"] .toast-act');
await p.waitForFunction(() => window.__nudges().c?.status === 'accepted');
check('Restore parks it again', (await p.textContent('[data-key="c"] time')) === 'parked');
check('no page errors', errors.length === 0, errors.join(' | '));
await p.context().close();

// Failures: unreadable, partial, not granted, and a refused save.
{
  const { p } = await page({ init: withSampler, initArg: REPLY });
  await p.click('#tab-stalled');
  await p.evaluate(() => { window.__mode = 'junk'; });
  await p.click('[data-fk="stall:suggest"]');
  await p.waitForSelector('.stall .werr');
  check('unreadable reply: inline copy + Try again', (await p.textContent('.stall .werr p')).startsWith("Claude's suggestions came back") && await p.isVisible('[data-fk="stall:retry"]'));
  await p.evaluate(() => { window.__mode = 'half'; });
  await p.click('[data-fk="stall:retry"]');
  await p.waitForSelector('.stall .ncard');
  check('partial reply: valid cards show, the rest are counted', (await p.textContent('.stall .wbody')).includes('1 row had no usable suggestion.') && (await p.$$eval('.stall .ncard', (c) => c.length)) === 1);
  check('the row left over can be asked again', await p.isVisible('[data-fk="stall:suggest"]'));
  await p.evaluate(() => { window.__mode = 'not_granted'; });
  await p.click('[data-fk="stall:suggest"]');
  await p.waitForFunction(() => document.querySelector('.stall .werr p')?.textContent?.startsWith('Suggestions need Claude'));
  check('not granted: no retry, no Suggest button', !(await p.isVisible('[data-fk="stall:retry"]')) && !(await p.isVisible('[data-fk="stall:suggest"]')));
  await p.context().close();
}
{
  const refuse = () => {
    const use = window.claude.use;
    window.claude.use = async (n) => {
      const db = await use(n);
      if (n !== 'db' || !db) return db;
      const col = db.collection;
      return { ...db, collection: (name) => {
        const c = col(name);
        return name !== 'nudges' ? c : { ...c, doc: (id) => ({ ...c.doc(id), set: async (d) => { if (window.__refuse && d.status === 'accepted') throw { code: 'unavailable' }; return c.doc(id).set(d); } }) };
      } };
    };
    window.__refuse = true;
  };
  const { p } = await page({ init: (r) => { (0, eval)(`(${r.refuse})`)(); (0, eval)(`(${r.sampler})`)(r.reply); }, initArg: { refuse: refuse.toString(), sampler: withSampler.toString(), reply: REPLY } });
  await p.click('#tab-stalled');
  await p.click('[data-fk="stall:suggest"]');
  await p.waitForSelector('.stall .ncard');
  await p.click('[data-fk="nudge:use:panel:a"]');
  await p.waitForSelector('.toast.t-error');
  check('refused accept: error toast, card kept', (await p.textContent('.toast.t-error .toast-msg')) === "Couldn't set the next step for Agrikit plugin on the board." && await p.isVisible('.stall .ncard[data-nudge="a"]'));
  await p.evaluate(() => { window.__refuse = false; });
  await p.click('.toast.t-error .toast-act');
  await p.waitForFunction(() => window.__nudges().a?.status === 'accepted');
  check('Retry sets it', true);
  await p.context().close();
}

// Collapsed rail: the ✦ button carries the count and opens the panel on Stalled.
{
  const { p } = await page({ init: withSampler, initArg: REPLY });
  await p.click('[data-ref="collapse"]'); await p.waitForTimeout(350);
  check('rail ✦ badge', (await p.textContent('[data-ref="rail-stalled"] .rb')) === '2' && (await p.getAttribute('[data-ref="rail-stalled"]', 'aria-label')) === 'Stalled projects, 2 need a next step');
  await p.screenshot({ path: join(OUT, 'nudges-rail.png') });
  await p.click('[data-ref="rail-stalled"]'); await p.waitForTimeout(350);
  check('rail ✦ opens the panel on Stalled', await p.isVisible('#tp-stalled') && await p.evaluate(() => document.activeElement?.id === 'tab-stalled'));
  await p.click('[data-fk="stall:suggest"]');
  await p.waitForSelector('.stall .ncard');
  await p.click('[data-key="c"] .sugm'); await p.waitForTimeout(100);
  check('row chip jumps to its card', await p.evaluate(() => document.activeElement?.closest('.ncard')?.dataset.nudge === 'c') && (await p.getAttribute('[data-fk="row:c"]', 'aria-expanded')) === 'false');
  await p.context().close();
}

// Phone: count on the header toggle, cards fit, dark mode.
{
  const { p, errors } = await page({ init: withSampler, initArg: REPLY, viewport: { width: 390, height: 844 }, touch: true, scheme: 'dark' });
  check('phone: toggle badge', (await p.textContent('#agent-toggle .tbdg')) === '2' && (await p.getAttribute('#agent-toggle', 'aria-label')) === 'Open your week, 2 stalled');
  await p.tap('#agent-toggle'); await p.waitForTimeout(400);
  await p.tap('[data-fk="stall:suggest"]');
  await p.waitForSelector('.stall .ncard');
  await p.screenshot({ path: join(OUT, 'nudges-phone-dark.png') });
  check('phone: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('no page errors (phone)', errors.length === 0, errors.join(' | '));
  await p.context().close();
}

process.exit(await finish());
