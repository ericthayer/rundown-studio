// Phone suite (390×844, touch): type floor, 44px hit areas, settings access, edge-to-edge shell,
// and the touch gestures with their button/keyboard equivalents. Run: npm test
import { join } from 'node:path';
import { OUT, check, finish, page } from './harness.mjs';

const PHONE = { viewport: { width: 390, height: 844 }, touch: true };

/** Real touch input through CDP, so pointer events carry pointerType "touch". */
async function touchDrag(p, from, to, steps = 8) {
  const cdp = await p.context().newCDPSession(p);
  const pt = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Visible controls whose effective hit area (box or ::before) is under 44px. */
const smallTargets = (p, scope) => p.evaluate((scope) => [...document.querySelectorAll(`${scope} :is(button, [role=separator], .psearch)`)]
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[inert], .fpop:not(:popover-open)'))
  .map((e) => {
    const r = e.getBoundingClientRect();
    const hit = (pseudo) => { const s = getComputedStyle(e, pseudo); return s.content === 'none' ? [0, 0] : [parseFloat(s.width) || 0, parseFloat(s.height) || 0]; };
    const [bw, bh] = hit('::before'), [aw, ah] = hit('::after');
    return { name: e.getAttribute('aria-label') || e.className, w: Math.max(r.width, bw, aw), h: Math.max(r.height, bh, ah) };
  })
  .filter((t) => t.w < 43.5 || t.h < 43.5)
  .map((t) => `${t.name} ${Math.round(t.w)}×${Math.round(t.h)}`), scope);

/** Rendered text smaller than 13px. */
const smallText = (p) => p.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((el) => el.getClientRects().length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.closest('.sr, [inert]'))
  .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13)
  .map((el) => `${el.localName}.${el.className} ${getComputedStyle(el).fontSize}`));

{
  const { p, ctx, errors } = await page({ ...PHONE, scheme: 'light' });
  check('phone: no text under 13px', (await smallText(p)).length === 0, (await smallText(p)).join(', '));
  check('phone: board targets ≥ 44px', (await smallTargets(p, '.shell')).length === 0, (await smallTargets(p, '.shell')).join(', '));
  check('phone: shell is edge to edge', await p.evaluate(() => getComputedStyle(document.getElementById('shell')).borderTopLeftRadius === '0px'));
  check('phone: list panel spans the screen', await p.evaluate(() => { const r = document.querySelector('.ptable').getBoundingClientRect(); return r.left === 0 && Math.round(r.right) === innerWidth; }));
  check('phone: visual control size unchanged', await p.evaluate(() => document.querySelector('.note-x').getBoundingClientRect().width === 22));

  // Settings: the gear moves to the top bar and opens downward.
  check('phone: settings button visible', await p.isVisible('.mset'));
  await p.tap('.mset'); await p.waitForTimeout(100);
  check('phone: settings popover inside viewport', await p.evaluate(() => { const r = document.getElementById('me-settings').getBoundingClientRect(); return r.top > 0 && r.bottom <= innerHeight && r.right <= innerWidth; }));
  await p.screenshot({ path: join(OUT, 'phone-settings.png') });
  await p.keyboard.press('Escape');

  // Swipe between views; the tabs remain the button equivalent.
  const filter = () => p.evaluate(() => document.querySelector('.navb[aria-pressed="true"]')?.dataset.fk);
  const row = await p.locator('.pitem').first().boundingBox();
  await touchDrag(p, { x: 300, y: row.y + 40 }, { x: 120, y: row.y + 46 });
  await p.waitForTimeout(100);
  check('phone: swipe left goes to next view', (await filter()) === 'nav:needs', await filter());
  await touchDrag(p, { x: 100, y: row.y + 40 }, { x: 300, y: row.y + 44 });
  await p.waitForTimeout(100);
  check('phone: swipe right goes back', (await filter()) === 'nav:all', await filter());
  await touchDrag(p, { x: 300, y: row.y + 40 }, { x: 260, y: row.y + 160 });
  check('phone: vertical drag does not switch views', (await filter()) === 'nav:all', await filter());

  // Assistant sheet: drag the header down to close; the close button and Escape still work.
  await p.tap('#agent-toggle'); await p.waitForTimeout(350);
  check('phone: assistant targets ≥ 44px', (await smallTargets(p, '#agent')).length === 0, (await smallTargets(p, '#agent')).join(', '));
  check('phone: no small text in assistant', (await smallText(p)).length === 0, (await smallText(p)).join(', '));
  await p.screenshot({ path: join(OUT, 'phone-assistant-light.png') });
  const head = await p.locator('.agent-head h2').boundingBox();
  await touchDrag(p, { x: head.x + 20, y: head.y + 5 }, { x: head.x + 20, y: head.y + 40 });
  await p.waitForTimeout(350);
  check('phone: short drag springs back', await p.evaluate(() => document.getElementById('agent').classList.contains('open') && !document.getElementById('agent').style.transform));
  await touchDrag(p, { x: head.x + 20, y: head.y + 5 }, { x: head.x + 20, y: head.y + 420 });
  await p.waitForTimeout(350);
  check('phone: drag down closes the assistant', await p.evaluate(() => !document.getElementById('agent').classList.contains('open')));
  check('phone: focus returns to the toggle', (await p.evaluate(() => document.activeElement?.id)) === 'agent-toggle');

  // Filter sheet: drag down to close; Close button remains. (Wait out the fling: a tap during one only stops it.)
  await p.waitForTimeout(1200);
  await p.tap('.fbtn'); await p.waitForTimeout(100);
  check('phone: filter options ≥ 44px tall', await p.evaluate(() => [...document.querySelectorAll('#fsheet .fopt')].every((o) => o.getBoundingClientRect().height >= 44)));
  const fsh = await p.locator('#fsheet-h').boundingBox();
  await touchDrag(p, { x: fsh.x + 10, y: fsh.y + 5 }, { x: fsh.x + 10, y: fsh.y + 400 });
  await p.waitForTimeout(100);
  check('phone: drag down closes the filter sheet', await p.evaluate(() => !document.getElementById('fsheet').open));
  check('no console errors (phone gestures)', errors.length === 0, errors.join(' | '));
  await p.screenshot({ path: join(OUT, 'phone-light.png') });
  await ctx.close();
}

process.exit((await finish()) ? 1 : 0);
