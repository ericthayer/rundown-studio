// Playwright smoke suite. Serves the repo over HTTP (ES modules need it), stubs the artifact runtime,
// and checks the regressions from the code review. Run: npm test
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'tests/out');
await mkdir(OUT, { recursive: true });
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const server = http.createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? null : normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^\/+/, '');
    if (!path) {
      // Mirror the artifact host: it wraps the page in a document skeleton.
      const page = await readFile(join(ROOT, 'index.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>${page}</body></html>`);
      return;
    }
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/`;

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
const ROWS = [
  { id: 'a', name: 'Agrikit plugin', priority: 1, state: 'blocked', area: 'work', kind: 'repo', lastActivity: day(-2), due: day(3), leftOff: 'WIP branch in shd-agrikit-ui-lib.', nextStep: 'Ship the MCP adapter.', blockers: ['MCP auth'], openDecisions: ['One plugin or per framework?'], decided: ['React/MUI first', 'Reuse agrikit-mcp'] },
  { id: 'b', name: 'Portfolio chat agent', priority: 2, state: 'active', area: 'personal', kind: 'project', lastActivity: day(0), nextStep: 'Netlify function for streaming' },
  { id: 'c', name: 'Token Map', priority: 3, state: 'stale', area: 'personal', kind: 'project', lastActivity: day(-40) },
  { id: 'd', name: 'Brochure site', priority: 4, state: 'parked', area: 'client', kind: 'chat', due: day(-12) },
];
const META = { critique: 'Three overlapping config-distribution efforts; pick tharness.', sessionDays: [day(0), day(-1), day(-2), day(-3), day(-4)] };

const stub = ({ rows, meta }) => {
  const subs = { rows: [], meta: [] };
  const snap = (r) => ({ docs: r.map((x) => ({ id: x.id, data: () => x })) });
  window.__push = (r) => subs.rows.forEach((f) => f(snap(r)));
  window.__pushMeta = (m) => subs.meta.forEach((f) => f({ id: 'run', data: () => m }));
  window.claude = { use: async (n) => (n === 'db' ? {
    collection: () => ({ onSnapshot: (f) => { subs.rows.push(f); f(snap(rows)); return () => {}; } }),
    doc: () => ({ onSnapshot: (f) => { subs.meta.push(f); f({ id: 'run', data: () => meta }); return () => {}; } }),
  } : null) };
};

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const browser = await chromium.launch();

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 860 }, colorScheme: opts.scheme ?? 'light' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|net::/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(stub, { rows: ROWS, meta: META });
  if (opts.init) await p.addInitScript(opts.init);
  await p.goto(URL_);
  await p.waitForSelector('.pitem');
  return { p, ctx, errors };
}
const active = (p) => p.evaluate(() => document.activeElement?.dataset?.fk ?? document.activeElement?.tagName);

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
  check('status filter applies', (await p.locator('.plist > li').count()) === 1);
  await p.keyboard.press('Escape');
  await p.click('.tright .fclear');
  check('clear restores list', (await p.locator('.plist > li').count()) === 4);
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
// 5. Persistence + legacy migration.
{
  const { p, ctx } = await page({ init: () => { if (!localStorage.getItem('rundown.prefs')) { localStorage.setItem('rundown.slim', '1'); localStorage.setItem('rundown.agent', '0'); } } });
  check('legacy prefs migrate (slim + rail)', await p.evaluate(() => { const c = document.getElementById('shell').classList; return c.contains('slim') && c.contains('agent-rail'); }));
  await p.screenshot({ path: join(OUT, 'wide-slim-rail.png') });
  await ctx.close();
}
// 6. Narrow: modal drawer focus management.
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

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
