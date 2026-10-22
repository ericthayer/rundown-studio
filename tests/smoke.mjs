// Playwright smoke suite: the regressions from the code review. Run: npm test
import { join } from 'node:path';
import { META, OUT, ROWS, active, check, finish, page } from './harness.mjs';


// 1. Focus survives activation everywhere (review #1).
{
  const { p, ctx, errors } = await page();
  await p.focus('[data-fk="nav:needs"]'); await p.keyboard.press('Enter');
  check('focus kept after sidebar nav', (await active(p)) === 'nav:needs', await active(p));
  await p.focus('[data-fk="nav:all"]'); await p.keyboard.press('Enter');
  await p.focus('[data-fk="stat:blocked"]'); await p.keyboard.press('Enter');
  check('focus kept after stat button', (await active(p)) === 'stat:blocked', await active(p));
  await p.keyboard.press('Enter');
  await p.focus('[data-fk="row:a"]'); await p.keyboard.press('Enter');
  check('focus kept after expanding a row', (await active(p)) === 'row:a', await active(p));
  check('next-step card renders', await p.isVisible('.nscard'));
  await p.focus('[data-fk="card:c"]'); await p.keyboard.press('Enter');
  check('focus kept after priority card', (await active(p)) === 'card:c', await active(p));
  await p.evaluate((r) => window.__push(r.map((x) => ({ ...x }))), ROWS);
  check('focus kept across a data snapshot', (await active(p)) === 'card:c', await active(p));
  // 2. Filter popover stays open across data updates (review #3).
  await p.click('[data-fk="chip:status"]');
  await p.check('#fp-status input[value=blocked]');
  await p.evaluate((r) => window.__push(r.map((x) => ({ ...x }))), ROWS);
  check('filter popover survives data update', await p.evaluate(() => !!document.querySelector('#fp-status:popover-open')));
  check('status filter applies', (await p.locator('rd-project-list .plist > li').count()) === 2);
  await p.keyboard.press('Escape');
  await p.click('.tright .fclear');
  check('clear restores list', (await p.locator('rd-project-list .plist > li').count()) === ROWS.length);
  // 3. Contrast tokens (review #2).
  const ratio = await p.evaluate(() => {
    const L = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((n) => { n /= 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const el = document.createElement('span'); document.body.append(el);
    const get = (v) => { el.style.color = `var(${v})`; return getComputedStyle(el).color; };
    const fg = L(get('--muted')), bgs = ['--surface', '--rail', '--chip'].map((v) => L(get(v)));
    return Math.min(...bgs.map((b) => (Math.max(fg, b) + 0.05) / (Math.min(fg, b) + 0.05)));
  });
  check('--muted ≥ 4.5:1 on surface/rail/chip (light)', ratio >= 4.5, ratio.toFixed(2));
  await p.screenshot({ path: join(OUT, 'wide-light.png') });
  // 4. Icon rail + unread badge + resize.
  await p.click('[data-ref="collapse"]');
  await p.waitForTimeout(350);
  check('collapse to icon rail', await p.evaluate(() => document.getElementById('shell').classList.contains('agent-rail')));
  check('no badge for a note seen while open', await p.evaluate(() => !document.querySelector('[data-ref="rail-chat"]').hasAttribute('data-unread')));
  await p.evaluate((m) => window.__pushMeta({ ...m, critique: 'New: merge agents-config into tharness.' }), META);
  check('unread badge for a new note while collapsed', await p.evaluate(() => document.querySelector('[data-ref="rail-chat"]').hasAttribute('data-unread')));
  await p.focus('[data-fk="rail:b"]'); await p.keyboard.press('Enter');
  check('focus kept after rail priority', (await active(p)) === 'rail:b', await active(p));
  await p.screenshot({ path: join(OUT, 'wide-rail.png') });
  await p.click('[data-ref="rail-chat"]'); await p.waitForTimeout(350);
  check('badge clears on expand', await p.evaluate(() => !document.querySelector('[data-ref="rail-chat"]').hasAttribute('data-unread')));
  const g = await p.locator('[data-ref="resize"]').boundingBox();
  const w0 = (await p.locator('#agent').boundingBox()).width;
  await p.mouse.move(g.x + 6, g.y + 80); await p.mouse.down(); await p.mouse.move(g.x - 120, g.y + 80, { steps: 5 }); await p.mouse.up();
  const w1 = (await p.locator('#agent').boundingBox()).width;
  check('drag resizes assistant', w1 > w0 + 80, `${Math.round(w0)}→${Math.round(w1)}`);
  check('no console errors (wide)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
// 5. Signals: decisions rollup + waiting on.
{
  const { p, ctx, errors } = await page();
  const stat = (k) => p.textContent(`[data-fk="stat:${k}"] b`);
  check('needs-you excludes waiting-only projects', (await stat('needs')) === '2', await stat('needs'));
  check('waiting stat counts', (await stat('waiting')) === '1', await stat('waiting'));
  check('decisions stat skips parked', (await stat('decisions')) === '3', await stat('decisions'));
  check('waiting row gets its own dot', await p.evaluate(() => document.querySelector('[data-fk="row:e"] .dot').classList.contains('waiting')));
  await p.focus('[data-fk="nav:decisions"]'); await p.keyboard.press('Enter');
  check('decisions view hides the project list', await p.isHidden('rd-project-list .plist'));
  const rows = await p.locator('rd-decisions .plist > li').allTextContents();
  check('rollup lists open decisions, oldest first', rows.length === 3 && rows[0].includes('One plugin or per framework?') && rows[0].includes('20d open') && rows[2].includes('Ship under MIT?'), rows.join(' | '));
  check('old decision is emphasized', await p.evaluate(() => document.querySelector('rd-decisions time').hasAttribute('data-old')));
  await p.screenshot({ path: join(OUT, 'wide-decisions.png') });
  await p.locator('rd-decisions .pitem').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(50);
  check('rollup row opens the project', (await active(p)) === 'row:a' && (await p.textContent('.nscard')).includes('· 20d'), await active(p));
  await p.focus('[data-fk="row:e"]'); await p.keyboard.press('Enter');
  check('card shows who + since', (await p.textContent('[data-key="e"] .nscard')).includes('Waiting onClient: final copy · 5d'));
  await p.evaluate((r) => window.__push(r.map((x) => (x.id === 'e' ? { ...x, waitingOn: [{ who: 'Client', since: '2000-01-01' }] } : x))), ROWS);
  check('overdue wait returns to needs-you', (await stat('needs')) === '3', await stat('needs'));
  const ratio = await p.evaluate(() => {
    const L = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((n) => { n /= 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const el = document.createElement('span'); document.body.append(el);
    const get = (v) => { el.style.color = `var(${v})`; return L(getComputedStyle(el).color); };
    const bg = get('--surface');
    return Math.min(...['--dot-wait', '--dot-decide'].map((v) => { const f = get(v); return (Math.max(f, bg) + 0.05) / (Math.min(f, bg) + 0.05); }));
  });
  check('signal dots ≥ 3:1 on surface (light)', ratio >= 3, ratio.toFixed(2));
  check('no console errors (signals)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
// 6. Persistence + legacy migration.
{
  const { p, ctx } = await page({ init: () => { if (!localStorage.getItem('rundown.prefs')) { localStorage.setItem('rundown.slim', '1'); localStorage.setItem('rundown.agent', '0'); } } });
  check('legacy prefs migrate (slim + rail)', await p.evaluate(() => { const c = document.getElementById('shell').classList; return c.contains('slim') && c.contains('agent-rail'); }));
  await p.screenshot({ path: join(OUT, 'wide-slim-rail.png') });
  await ctx.close();
}
// 7. Narrow: modal drawer focus management.
{
  const { p, ctx, errors } = await page({ viewport: { width: 390, height: 844 }, scheme: 'dark' });
  await p.click('#agent-toggle'); await p.waitForTimeout(350);
  check('drawer opens, focus on title', (await p.evaluate(() => document.activeElement?.id)) === 'agent-h');
  check('background inert while open', await p.evaluate(() => document.querySelector('.center').inert));
  await p.screenshot({ path: join(OUT, 'phone-drawer.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  check('Escape closes, focus returns to toggle', (await p.evaluate(() => document.activeElement?.id)) === 'agent-toggle');
  check('no horizontal scroll (phone)', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.screenshot({ path: join(OUT, 'phone.png') });
  check('no console errors (phone)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
// 8. Focus mode: fullscreen toggle where allowed, hidden where not.
{
  const { p, ctx, errors } = await page();
  const btn = 'rd-focus button';
  check('focus button shown when fullscreen allowed', await p.isVisible(btn));
  await p.click(btn); await p.waitForTimeout(200);
  check('focus mode enters fullscreen', await p.evaluate(() => document.fullscreenElement === document.documentElement));
  check('focus button pressed + relabelled', (await p.getAttribute(btn, 'aria-pressed')) === 'true' && (await p.getAttribute(btn, 'aria-label')) === 'Exit focus mode');
  await p.screenshot({ path: join(OUT, 'focus-mode.png') });
  await p.click(btn); await p.waitForTimeout(200);
  check('focus button exits fullscreen', await p.evaluate(() => !document.fullscreenElement) && (await p.getAttribute(btn, 'aria-pressed')) === 'false');
  check('no console errors (focus)', errors.length === 0, errors.join(' | '));
  await ctx.close();
  const off = await page({ init: () => Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }) });
  check('focus button hidden when fullscreen blocked', !(await off.p.isVisible(btn)));
  await off.ctx.close();
}
// 9. Settings: color mode picker next to the viewer's name.
{
  const { p, ctx, errors } = await page();
  const theme = () => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await p.click('.mset'); await p.waitForTimeout(100);
  check('settings popover opens', await p.isVisible('#me-settings') && (await p.getAttribute('.mset', 'aria-expanded')) === 'true');
  check('popover stays in viewport', await p.evaluate(() => { const r = document.getElementById('me-settings').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await p.screenshot({ path: join(OUT, 'settings.png') });
  await p.check('input[name="theme"][value="dark"]');
  check('dark mode applies', (await theme()) === 'dark');
  check('dark tokens active', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() === '#24262b'));
  await p.reload(); await p.waitForSelector('.pitem');
  check('color mode persists across reload', (await theme()) === 'dark' && await p.isChecked('input[name="theme"][value="dark"]'));
  await p.screenshot({ path: join(OUT, 'wide-dark.png') });
  await p.click('.mset'); await p.check('input[name="theme"][value="system"]');
  check('system mode clears override', (await theme()) === null);
  await p.keyboard.press('Escape');
  check('Escape closes settings', !(await p.isVisible('#me-settings')));
  check('no console errors (settings)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 10. Check-in button: sends to the chat beside the board, copies when there is none.
{
  const withRoom = (state) => {
    const use = window.claude.use;
    window.__sent = [];
    window.claude = { use: async (n) => (n === 'room' ? {
      canSendToClaudeSession: async () => state,
      sendToClaudeSession: async (data, opts) => { window.__sent.push({ data, opts }); return { to: 'pane' }; },
    } : use(n)) };
  };
  const { p, ctx, errors } = await page({ init: withRoom, initArg: 'available' });
  await p.hover('#copy-cmd-2'); await p.waitForTimeout(50);
  check('check-in labelled as run when chat is beside', (await p.getAttribute('#copy-cmd-2', 'aria-label')) === 'Run /project-checkin in chat');
  await p.focus('[data-fk="row:b"]'); await p.keyboard.press('Enter');
  await p.click('#copy-cmd-2'); await p.waitForTimeout(50);
  const sent = await p.evaluate(() => window.__sent);
  check('check-in sends one request', sent.length === 1 && sent[0].opts.deliver === 'send' && sent[0].data.command === '/project-checkin');
  check('check-in names the open project', sent[0]?.data.project?.id === 'b', JSON.stringify(sent[0]?.data.project));
  check('label confirms the send', (await p.textContent('#copy-cmd-2 .cta-lbl')) === 'Sent to chat');
  check('no console errors (check-in)', errors.length === 0, errors.join(' | '));
  await ctx.close();
  const none = await page({ init: withRoom, initArg: 'no_session' });
  await none.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await none.p.hover('#copy-cmd-2'); await none.p.click('#copy-cmd-2'); await none.p.waitForTimeout(50);
  check('no chat beside: copies instead', (await none.p.evaluate(() => window.__sent.length)) === 0 && (await none.p.textContent('#copy-cmd-2 .cta-lbl')) !== 'Sent to chat');
  check('no chat beside: labelled as copy', (await none.p.getAttribute('#copy-cmd-2', 'aria-label')) === 'Copy /project-checkin command');
  await none.ctx.close();
}

process.exit((await finish()) ? 1 : 0);
