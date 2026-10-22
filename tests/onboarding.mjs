// First-run tour: auto-start, dismissal and replay, focus, phone width, toast band, lazy loading. Run: npm test
import { check, finish, page, active } from './harness.mjs';

const OPEN = 'dialog.tour[open]';
const prefsOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('rundown.prefs') ?? '{}'));
const stepText = (p) => p.evaluate(() => document.querySelector('.tour-n')?.textContent ?? null);
const title = (p) => p.evaluate(() => document.querySelector('.tour-h')?.textContent ?? null);
/** Card stays inside the viewport and above the bottom-center toast band. */
const cardFits = (p) => p.evaluate(() => {
  const r = document.querySelector('.tour-card').getBoundingClientRect();
  return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight - 88 + 0.5;
});
const existing = () => localStorage.setItem('rundown.prefs', JSON.stringify({ v: 1, theme: 'system' }));

// New viewer on an empty board: the tour starts by itself, Esc dismisses it, and it stays dismissed.
{
  const { p, ctx, errors } = await page({ tour: true, rows: [], meta: {}, wait: '.estate', config: { owner: 'Ada Lovelace', schedule: 'Mon & Fri, 3:16am', checkinCommand: '/rundown:checkin' } });
  await p.waitForSelector(OPEN);
  check('auto: starts on first load', true);
  check('auto: welcome uses the owner name', (await title(p)) === 'Welcome, Ada');
  check('auto: focus on the step heading', await p.evaluate(() => document.activeElement?.id === 'tour-h'));
  check('auto: page behind is inert', await p.evaluate(() => { try { document.querySelector('#copy-cmd-2').focus(); } catch {} return document.activeElement?.id !== 'copy-cmd-2'; }));
  await p.click('.tour-next');
  check('content: check-in step spotlights the button', (await title(p)) === 'Check-ins fill the board');
  check('content: copy names the configured command and schedule', await p.evaluate(() => /\/rundown:checkin in Claude, or let it run on your schedule \(Mon & Fri, 3:16am\)/.test(document.querySelector('.tour-d').textContent)));
  const spot = await p.evaluate(() => { const s = document.querySelector('.tour-spot').getBoundingClientRect(); const b = document.querySelector('#copy-cmd-2').getBoundingClientRect(); return Math.abs(s.left + 6 - b.left) < 1 && Math.abs(s.top + 6 - b.top) < 1; });
  check('content: spotlight wraps the target', spot);
  check('layout: card clear of the toast band', await cardFits(p));
  await p.keyboard.press('Escape');
  await p.waitForSelector(OPEN, { state: 'detached', timeout: 2000 }).catch(() => {});
  check('esc: closes the tour', !(await p.isVisible(OPEN)));
  check('esc: recorded as dismissed', (await prefsOf(p)).tour === 'dismissed');
  await p.reload();
  await p.waitForSelector('.estate');
  await p.waitForTimeout(1500);
  check('esc: does not auto-start again', !(await p.isVisible(OPEN)));
  check('auto: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Finishing over an empty board hands focus to the empty state's check-in action.
{
  const { p, ctx } = await page({ tour: true, rows: [], meta: {}, wait: '.estate' });
  await p.waitForSelector(OPEN);
  const seen = [];
  for (let i = 0; i < 8 && await p.isVisible(OPEN); i++) {
    seen.push(await stepText(p));
    check(`layout: step ${i + 1} card fits`, await cardFits(p));
    await p.click('.tour-next');
  }
  check('finish: walks every step', seen.at(-1) === `Step ${seen.length} of ${seen.length}`, seen.join(', '));
  check('finish: recorded as done', (await prefsOf(p)).tour === 'done' && (await prefsOf(p)).tourVersion === 1);
  check('finish: focus lands on the empty-state action', await p.evaluate(() => document.activeElement?.id === 'empty-cta'));
  await ctx.close();
}

// Existing viewer (prefs saved before the tour shipped): never interrupted, renderer never loaded.
{
  const loaded = [];
  const { p, ctx } = await page({ tour: true, init: existing });
  p.on('request', (r) => { if (/tour/.test(r.url())) loaded.push(r.url()); });
  await p.waitForTimeout(2500);
  check('existing: no auto-start', !(await p.isVisible(OPEN)));
  check('existing: tour code and styles stay unloaded', loaded.length === 0, loaded.join(' '));
  // Replay from settings: starts at step 1 with rows on the board; Skip returns focus to the gear.
  await p.click('rd-settings .mset');
  await p.click('[data-fk="help:tour"]');
  await p.waitForSelector(OPEN);
  check('replay: starts at step 1', (await stepText(p))?.startsWith('Step 1 of'));
  check('replay: settings menu closed', await p.evaluate(() => !document.querySelector('#me-settings').matches(':popover-open')));
  await p.click('.tour-next');
  await p.click('.tour-skip');
  check('replay: skip closes', !(await p.isVisible(OPEN)));
  check('replay: focus back on the settings gear', (await p.evaluate(() => document.activeElement?.dataset.playwell)) === 'settings');
  check('replay: recorded as dismissed', (await prefsOf(p)).tour === 'dismissed');
  await ctx.close();
}

// Phone width, dark mode, reduced motion: hidden targets skip cleanly, tokens follow the theme, no motion.
{
  const { p, ctx, errors } = await page({ tour: true, rows: [], meta: {}, wait: '.estate', viewport: { width: 390, height: 780 }, touch: true, scheme: 'dark', motion: 'reduce' });
  await p.waitForSelector(OPEN);
  const n = Number((await stepText(p)).match(/of (\d+)/)[1]);
  check('phone: step count matches visible targets', n >= 2 && n <= 5, `${n} steps`);
  for (let i = 0; i < n; i++) {
    check(`phone: step ${i + 1} card fits`, await cardFits(p));
    if (i < n - 1) await p.click('.tour-next');
  }
  check('dark: card uses the surface token', await p.evaluate(() => getComputedStyle(document.querySelector('.tour-card')).backgroundColor === 'rgb(36, 38, 43)'));
  check('reduced motion: no transitions', await p.evaluate(() => getComputedStyle(document.querySelector('.tour-card')).transitionDuration === '0s'));
  check('phone: buttons reach 44px', await p.evaluate(() => document.querySelector('.tour-next').getBoundingClientRect().height >= 44));
  await p.click('.tour-next');
  check('phone: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

process.exit(await finish());
