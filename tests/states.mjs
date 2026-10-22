// Empty, no-match and failure states: each failure is simulated against the runtime stub. Run: npm test
// Set LOTTIE_FILE=/path/to/lottie_light.min.js to also check the real player renders the scenes.
import { check, finish, page, ROWS } from './harness.mjs';

const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, sel);
const live = (p) => p.waitForFunction(() => document.querySelector('rd-status [data-ref="live"]')?.textContent).then(() => text(p, 'rd-status [data-ref="live"]'));
const kind = (p) => p.evaluate(() => document.querySelector('.estate')?.dataset.kind ?? null);
/** Fake player: records calls and paints one svg, so the loader's wiring is testable offline. */
const fakeLottie = () => {
  window.__lottie = [];
  window.lottie = { loadAnimation: (o) => {
    window.__lottie.push(o.animationData);
    o.container.innerHTML = '<svg data-fake></svg>';
    const ls = {};
    queueMicrotask(() => ls.DOMLoaded?.());
    return { destroy: () => { o.container.innerHTML = ''; }, addEventListener: (n, f) => { ls[n] = f; } };
  } };
};

// Empty board: illustrated panel, static art when the player is blocked, check-in action.
{
  const { p, ctx, errors } = await page({ rows: [], meta: {}, wait: '.estate' });
  check('empty: panel kind', (await kind(p)) === 'empty');
  check('empty: heading', (await text(p, '#estate-h')) === 'No projects yet');
  check('empty: action runs the check-in command', (await text(p, '#empty-cta')) === 'Run /project-checkin');
  check('empty: static art painted', await p.locator('.estate .art > svg rect').count() > 3);
  await p.waitForTimeout(300);
  check('empty: blocked player keeps the static art', !(await p.getAttribute('.estate .art', 'data-anim')));
  check('empty: stat strip no longer repeats the message', await p.locator('rd-stat-strip [data-ref="msg"]').isHidden());
  check('empty: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// No matches: search with no hits, then Clear filters brings the rows back.
{
  const { p, ctx } = await page({ init: fakeLottie });
  await p.fill('rd-toolbar input[type="search"]', 'zzzz');
  await p.waitForSelector('.estate[data-kind="nomatch"]');
  check('nomatch: copy quotes the search', (await text(p, '.estate-d'))?.includes('“zzzz”'));
  check('nomatch: search scene', (await p.getAttribute('.estate .art', 'data-scene')) === 'search');
  await p.waitForSelector('.estate .art[data-anim="on"]');
  check('nomatch: player animates the scene', await p.evaluate(() => window.__lottie.length === 1 && window.__lottie[0].layers.length === 4));
  await p.click('.estate-cta');
  await p.waitForSelector('.pitem');
  check('nomatch: Clear filters restores rows', (await p.locator('rd-project-list .pitem').count()) === ROWS.length);
  check('nomatch: player cleaned up', (await p.locator('.art-anim').count()) === 0);
  await ctx.close();
}

// Reduced motion: never loads the player.
{
  const { p, ctx } = await page({ rows: [], meta: {}, wait: '.estate', motion: 'reduce', init: fakeLottie });
  await p.waitForTimeout(200);
  check('reduced motion: static only', await p.evaluate(() => window.__lottie.length === 0) && !(await p.getAttribute('.estate .art', 'data-anim')));
  await ctx.close();
}

// The real player (optional): renders each scene with token colors.
if (process.env.LOTTIE_FILE) {
  const { p, ctx, errors } = await page({ rows: [], meta: {}, wait: '.estate', lottie: process.env.LOTTIE_FILE });
  await p.waitForSelector('.estate .art[data-anim="on"]', { timeout: 10000 });
  const fill = await p.evaluate(() => getComputedStyle(document.querySelector('.art-anim .t-peach')).fill);
  const peach = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--peach').trim());
  check('real player: tone class takes the token color', fill === 'rgb(247, 160, 124)' && peach === '#f7a07c', fill);
  check('real player: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Signed out: no runtime at all.
{
  const { p, ctx } = await page({ wait: '.estate', init: () => { delete window.claude; } });
  check('signed out: panel', (await kind(p)) === 'signed-out' && (await p.locator('.estate-cta').isHidden()));
  await ctx.close();
}

// Runtime fails to load, then Try again succeeds.
{
  const { p, ctx } = await page({ wait: '.estate', init: () => {
    const use = window.claude.use;
    window.claude.use = async (n) => { if (n === 'db' && !window.__fixed) throw new Error('runtime failed'); return use(n); };
  } });
  check('runtime error: panel', (await kind(p)) === 'error' && (await text(p, '#estate-h')) === "Can't reach your board");
  check('runtime error: says rows are safe', (await text(p, '.estate-d'))?.startsWith('Your rows are safe.'));
  await p.evaluate(() => { window.__fixed = true; });
  await p.click('.estate-cta');
  await p.waitForSelector('.pitem');
  check('runtime error: Try again loads rows', (await p.locator('rd-project-list .pitem').count()) === ROWS.length);
  check('runtime error: recovery announced', (await live(p)) === 'Connected. Projects loaded.');
  await ctx.close();
}

// db answers but never sends a snapshot: times out to the error panel instead of loading forever.
{
  const { p, ctx } = await page({ clock: true, wait: 'rd-stat-strip', init: () => { window.__holdRows = true; } });
  check('slow db: still loading at first', (await text(p, 'rd-stat-strip [data-ref="msg"]')) === 'Loading your projects…');
  await p.clock.fastForward(13000);
  await p.waitForSelector('.estate[data-kind="error"]');
  check('slow db: times out to the error panel', true);
  check('slow db: announced', (await live(p)) === "Can't reach your board. Try again in a moment.");
  await p.evaluate(() => { window.__holdRows = false; });
  await p.click('.estate-cta');
  await p.waitForSelector('.pitem');
  check('slow db: retry recovers', (await p.locator('rd-project-list .pitem').count()) === ROWS.length);
  await ctx.close();
}

// Live feed dies after load: rows stay, band offers Try again, a fresh subscription clears it.
{
  const { p, ctx, errors } = await page({});
  await p.evaluate(() => window.__failRows('unavailable'));
  await p.waitForSelector('.lstat:not([hidden])');
  check('paused: band title', (await text(p, '.lstat strong')) === 'Live updates paused.');
  check('paused: shows when rows were loaded', /Showing projects from \d/.test(await text(p, '.lstat span')));
  check('paused: rows still shown', (await p.locator('rd-project-list .pitem').count()) === ROWS.length);
  check('paused: announced', (await live(p)) === 'Live updates paused.');
  const before = await p.evaluate(() => window.__subscribes);
  await p.click('.lstat [data-ref="retry"]');
  await p.waitForSelector('.lstat', { state: 'hidden' });
  check('paused: Try again resubscribes', (await p.evaluate(() => window.__subscribes)) === before + 1);
  check('paused: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Browser goes offline, then back online.
{
  const { p, ctx } = await page({});
  await ctx.setOffline(true);
  await p.waitForSelector('.lstat:not([hidden])');
  check('offline: band', (await text(p, '.lstat strong')) === "You're offline." && await p.locator('.lstat [data-ref="retry"]').isHidden());
  check('offline: announced', (await live(p)) === "You're offline. Showing the last projects loaded.");
  await ctx.setOffline(false);
  await p.waitForSelector('.lstat', { state: 'hidden' });
  check('online: band clears', true);
  await p.waitForFunction(() => document.querySelector('rd-status [data-ref="live"]')?.textContent?.startsWith('Back online'));
  check('online: announced', true);
  await ctx.close();
}

// Offline before the board ever loaded: offline panel rather than a generic error.
{
  const { p, ctx } = await page({ wait: '.estate', init: () => { window.claude.use = async () => { throw new Error('offline'); }; } });
  await ctx.setOffline(true);
  await p.waitForSelector('.estate[data-kind="offline"]');
  check('offline at load: panel', (await text(p, '#estate-h')) === "You're offline");
  await ctx.setOffline(false);
  await ctx.close();
}

// Bad data: unreadable rows are skipped and counted; a source the check-in couldn't reach shows on the row.
{
  const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toLocaleDateString('en-CA'); };
  const rows = [...ROWS.slice(0, 2), { id: 'x' }, { id: 'y', name: '  ' }, { id: 'z', name: 42 },
    { id: 'g', name: 'Repo row', state: 'active', sourceError: { source: 'GitHub', detail: 'API returned 503', since: day(-1) } }];
  const { p, ctx, errors } = await page({ rows });
  check('bad rows: readable rows render', (await p.locator('rd-project-list .pitem').count()) === 3);
  check('bad rows: band counts the skipped rows', (await text(p, '.lstat strong')) === "3 rows couldn't be read.");
  const badge = p.locator('[data-key="g"] .b-src');
  check('source error: row badge', (await badge.getAttribute('aria-label')) === "Couldn't reach GitHub at the last check-in");
  await p.click('[data-fk="row:g"]');
  const card = await text(p, '[data-key="g"] .ns-groups');
  check('source error: card line', card?.includes("Couldn't reach") && card.includes('GitHub: API returned 503') && card.includes('1d'), card);
  await p.evaluate((r) => window.__push(r), rows.filter((r) => r.id !== 'g'));
  check('removed project: closes and announces', (await live(p)) === 'The project you had open was removed from the board.' && await p.evaluate(() => !document.querySelector('[aria-expanded="true"].pitem')));
  check('bad rows: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Ask Rundown: Claude failures, offline, a stalled stream, and Try again.
{
  const sampler = () => {
    window.__calls = 0;
    const use = window.claude.use;
    window.claude.use = async (n) => (n === 'sample' ? async (_prompt, { onText, signal } = {}) => {
      window.__calls++;
      const mode = window.__mode;
      if (mode === 'stall') return new Promise((_r, reject) => signal.addEventListener('abort', () => reject({ code: 'cancelled', message: '' })));
      if (mode === 'partial') { onText?.({ text: 'Token Map is' }); throw { code: 'upstream_error', message: 'x', text: 'Token Map is' }; }
      if (mode) throw { code: mode, message: mode };
      onText?.({ text: 'All good.' });
      return { text: 'All good.' };
    } : use(n));
  };
  const { p, ctx, errors } = await page({ init: sampler, clock: true });
  const ask = async (mode, q = 'Status?') => {
    await p.evaluate((m) => { window.__mode = m; }, mode);
    await p.fill('rd-composer textarea', q);
    await p.press('rd-composer textarea', 'Enter');
  };
  const last = () => text(p, '.alog .answer:last-child .atext');
  const retry = () => p.locator('.alog .answer:last-child .aretry');

  await ask('rate_limited');
  await p.waitForSelector('.answer.afail');
  check('ask: rate limit copy + Try again', (await last()) === 'Too many questions in a row. Try again in a minute.' && (await retry().count()) === 1);
  await ask('upstream_error');
  await p.waitForFunction(() => document.querySelectorAll('.answer.afail').length === 2);
  check('ask: Claude down copy', (await last())?.startsWith("Claude isn't available right now."));
  await ask('partial');
  await p.waitForFunction(() => document.querySelectorAll('.answer.afail').length === 3);
  check('ask: keeps the partial answer and marks it', (await last())?.startsWith('Token Map is') && (await last()).includes('stopped early'));
  await ask('refused');
  await p.waitForFunction(() => document.querySelectorAll('.answer.afail').length === 4);
  check('ask: refused has no Try again', (await retry().count()) === 0);
  await ask('stall');
  await p.clock.fastForward(46000);
  await p.waitForFunction(() => document.querySelectorAll('.answer.afail').length === 5);
  check('ask: stalled stream times out', (await last()) === 'Claude stopped responding, so this answer timed out.');
  await p.evaluate(() => { window.__mode = null; });
  await retry().click();
  await p.waitForFunction(() => document.querySelector('.alog .answer:last-child .atext')?.textContent === 'All good.');
  check('ask: Try again re-asks the same question', (await text(p, '.alog .answer:last-child .q')) === 'Status?');
  check('ask: failed turns are not kept in history', await p.evaluate(() => JSON.parse(sessionStorage.getItem('rundown.askLog') ?? '[]').every((t) => t.a === 'All good.')));
  await ctx.setOffline(true);
  const calls = await p.evaluate(() => window.__calls);
  await ask(null);
  await p.waitForFunction(() => document.querySelector('.alog .answer:last-child .atext')?.textContent?.startsWith("You're offline"));
  check('ask: offline never calls Claude', (await p.evaluate(() => window.__calls)) === calls);
  await ctx.setOffline(false);
  await ask('not_granted');
  await p.waitForFunction(() => document.querySelector('rd-composer textarea')?.placeholder === 'Filter projects…');
  check('ask: not granted falls back to filtering', (await last())?.startsWith("Asking Claude isn't available here."));
  check('ask: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

process.exit((await finish()) ? 1 : 0);
