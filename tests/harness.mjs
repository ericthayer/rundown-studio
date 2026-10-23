// Shared Playwright harness: serves the repo over HTTP (ES modules need it), stubs the artifact runtime,
// and opens pages against the stub. Used by every suite in tests/.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const ROOT = new URL('..', import.meta.url).pathname;
export const OUT = join(ROOT, 'tests/out');
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
export const ROWS = [
  { id: 'a', name: 'Agrikit plugin', priority: 1, state: 'blocked', area: 'work', kind: 'repo', lastActivity: day(-2), due: day(3), leftOff: 'WIP branch in shd-agrikit-ui-lib.', nextStep: 'Ship the MCP adapter.', blockers: ['MCP auth'], openDecisions: [{ text: 'One plugin or per framework?', since: day(-20) }, 'Ship under MIT?'], decided: ['React/MUI first', 'Reuse agrikit-mcp'] },
  { id: 'b', name: 'Portfolio chat agent', priority: 2, state: 'active', area: 'personal', kind: 'project', lastActivity: day(0), nextStep: 'Netlify function for streaming', openDecisions: [{ text: 'Streaming or polling?', since: day(-3) }] },
  { id: 'c', name: 'Token Map', priority: 3, state: 'stale', area: 'personal', kind: 'project', lastActivity: day(-40) },
  { id: 'd', name: 'Brochure site', priority: 4, state: 'parked', area: 'client', kind: 'chat', due: day(-12), openDecisions: ['Retire the site?'] },
  { id: 'e', name: 'WordPress handoff', priority: 5, state: 'blocked', area: 'client', kind: 'project', lastActivity: day(-5), waitingOn: [{ who: 'Client', what: 'final copy', since: day(-5) }] },
];
export const META = { critique: 'Three overlapping config-distribution efforts; pick one.', sessionDays: [day(0), day(-1), day(-2), day(-3), day(-4)] };

const stub = ({ rows, meta, config }) => {
  const subs = { rows: [], meta: [], notes: [], config: [] };
  const rowErrs = [];
  const snap = (r) => ({ docs: r.map((x) => ({ id: x.id, data: () => x })) });
  window.__push = (r) => subs.rows.forEach((f) => f(snap(r)));
  // Fires the terminal error on every live projects listener (revoked / dead bridge), like the board db.
  window.__failRows = (code = 'unavailable') => { rowErrs.splice(0).forEach((f) => f({ code, message: code })); subs.rows = []; };
  window.__subscribes = 0;
  window.__pushMeta = (m) => subs.meta.forEach((f) => f({ id: 'run', data: () => m }));
  window.__pushConfig = (c) => subs.config.forEach((f) => f({ id: 'config', data: () => c }));
  // Page-written collections (`notes`, `plans`, `nudges`) persist in localStorage under their own keys so they
  // survive reloads, like the board db.
  const kept = (name) => {
    const key = `__${name}`;
    const listeners = (subs[name] ??= []);
    const load = () => JSON.parse(localStorage.getItem(key) ?? '{}');
    const snapOf = () => ({ docs: Object.entries(load()).map(([id, x]) => ({ id, data: () => x })) });
    const save = (all) => { localStorage.setItem(key, JSON.stringify(all)); listeners.forEach((f) => f(snapOf())); };
    const col = {
      load,
      where: () => col,
      onSnapshot: (f) => { listeners.push(f); f(snapOf()); return () => {}; },
      doc: (id) => ({
        set: async (d) => save({ ...load(), [id]: JSON.parse(JSON.stringify(d)) }),
        delete: async () => { const all = load(); delete all[id]; save(all); },
      }),
    };
    return col;
  };
  const notes = kept('notes');
  const plans = kept('plans');
  const nudges = kept('nudges');
  window.__notes = notes.load;
  window.__plans = plans.load;
  window.__nudges = nudges.load;
  window.claude = { use: async (n) => (n === 'db' ? {
    collection: (name) => (name === 'notes' ? notes : name === 'plans' ? plans : name === 'nudges' ? nudges : { onSnapshot: (f, err) => {
      window.__subscribes++;
      subs.rows.push(f);
      if (err) rowErrs.push(err);
      if (!window.__holdRows) f(snap(window.__rows ?? rows));
      return () => { subs.rows = subs.rows.filter((x) => x !== f); };
    } }),
    doc: (path) => path === 'meta/config'
      ? { onSnapshot: (f) => { subs.config.push(f); f({ id: 'config', data: () => config }); return () => {}; } }
      : { onSnapshot: (f) => { subs.meta.push(f); f({ id: 'run', data: () => meta }); return () => {}; } },
  } : null) };
};

const results = [];
export const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
export const browser = await chromium.launch();

export async function page(opts = {}) {
  const touch = opts.touch ? { hasTouch: true, isMobile: true } : {};
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 860 }, colorScheme: opts.scheme ?? 'light', reducedMotion: opts.motion ?? 'no-preference', ...touch, ...(opts.video ? { recordVideo: opts.video } : {}) });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|net::/.test(m.text())) errors.push(m.text()); });
  // The Lottie player comes from cdnjs: blocked by default (static art), or served from a local copy.
  await ctx.route('https://cdnjs.cloudflare.com/**', (r) => (opts.lottie ? r.fulfill({ path: opts.lottie, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }) : r.abort()));
  if (opts.clock) await p.clock.install();
  await p.addInitScript(stub, { rows: opts.rows ?? ROWS, meta: opts.meta ?? META, config: opts.config });
  // Other suites run as a viewer who has seen the first-run tour; tests/onboarding.mjs passes `tour: true`.
  if (!opts.tour) await p.addInitScript(() => { if (!localStorage.getItem('rundown.prefs')) localStorage.setItem('rundown.prefs', JSON.stringify({ v: 1, tour: 'done', tourVersion: 1 })); });
  if (opts.init) await p.addInitScript(opts.init, opts.initArg);
  await p.goto(URL_);
  await p.waitForSelector(opts.wait ?? (opts.rows?.length === 0 ? 'rd-stat-strip' : '.pitem'));
  return { p, ctx, errors };
}
export const active = (p) => p.evaluate(() => document.activeElement?.dataset?.fk ?? document.activeElement?.tagName);

/** Closes the browser and server; returns the failure count. */
export async function finish() {
  await browser.close();
  server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  return failed.length;
}
