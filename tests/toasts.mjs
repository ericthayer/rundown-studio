// Toasts: board updates (diffed per snapshot, never on first load), live-feed and save failures. Run: npm test
import { check, finish, page, ROWS } from './harness.mjs';

const toasts = (p) => p.locator('.toasts .toast').allTextContents();
const msg = (p) => p.evaluate(() => [...document.querySelectorAll('.toasts .toast-msg')].map((n) => n.textContent));

{
  const { p, ctx, errors } = await page({ clock: true });
  await p.waitForTimeout(100);
  check('first load: no toast', (await toasts(p)).length === 0);

  const push = (rows) => p.evaluate((r) => window.__push(r), rows);
  await push([...ROWS, { id: 'n', name: 'New thing', state: 'active', priority: 9 }]);
  check('added: names the project', (await msg(p)).join() === 'New project on the board: New thing.');
  check('stack is a polite live region', (await p.getAttribute('.toasts', 'aria-live')) === 'polite');
  await p.waitForTimeout(350); // let the entrance animation finish (real time)
  const box = await p.locator('.toast').boundingBox();
  check('bottom center, clear of the edge', Math.abs(box.x + box.width / 2 - 720) < 2 && box.y + box.height <= 860 - 16, JSON.stringify(box));

  await p.click('.toast-act');
  check('View opens and focuses the row', await p.evaluate(() => document.activeElement?.dataset.fk === 'row:n' && document.activeElement.getAttribute('aria-expanded') === 'true'));

  const next = ROWS.map((r) => (r.id === 'b' ? { ...r, state: 'blocked' } : r));
  await push([...next, { id: 'n', name: 'New thing', state: 'active', priority: 9 }]);
  check('state change: says the new status', (await msg(p)).join() === 'Portfolio chat agent is now blocked.');

  const many = next.map((r) => (r.id === 'a' || r.id === 'c' ? { ...r, nextStep: 'Changed' } : r));
  await push([...many, { id: 'n', name: 'New thing', state: 'active', priority: 9 }, { id: 'm', name: 'Another', priority: 10 }]);
  const all = await msg(p);
  check('one check-in, one toast', all.length === 1 && all[0] === 'Board updated: 3 projects (1 added, 2 updated).', all.join(' | '));

  await p.clock.fastForward(5200);
  check('success dismisses itself', (await toasts(p)).length === 0);

  await push(many);
  await p.hover('.toast');
  await p.clock.fastForward(8000);
  check('hover pauses the timer', (await toasts(p)).length === 1);
  await p.mouse.move(5, 5);
  await p.clock.fastForward(5200);
  check('leaving resumes it', (await toasts(p)).length === 0);

  // A fresh subscription answers with what the board holds now: the last rows pushed.
  await p.evaluate((r) => { window.__rows = r; window.__failRows('unavailable'); }, many);
  await p.clock.fastForward(30000);
  check('feed failure stays up', (await msg(p)).join() === "Couldn't refresh the board. Live updates are paused.");
  check('feed failure is an alert with Retry', (await p.getAttribute('.toast.t-error', 'role')) === 'alert' && (await p.textContent('.toast.t-error .toast-act')) === 'Retry');
  await p.click('.toast.t-error .toast-act');
  await p.waitForSelector('.toast.t-ok');
  check('retry: resumed toast replaces the failure', (await msg(p)).join() === 'Live updates resumed. The board is current.');
  await p.focus('.toast .toast-x');
  await p.keyboard.press('Escape');
  check('Escape dismisses', (await toasts(p)).length === 0);
  check('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// A save the board refuses: failure toast with Retry; Retry writes once the board accepts.
{
  const sampler = () => {
    const use = window.claude.use;
    window.claude.use = async (n) => {
      if (n === 'sample') return async () => ({ text: 'Token Map is stale.' });
      const db = await use(n);
      if (n !== 'db' || !db) return db;
      const col = db.collection;
      return { ...db, collection: (name) => {
        const c = col(name);
        return name !== 'notes' ? c : { ...c, doc: (id) => ({ ...c.doc(id), set: async (d) => { if (window.__refuse) throw { code: 'unavailable' }; return c.doc(id).set(d); } }) };
      } };
    };
    window.__refuse = true;
  };
  const { p, ctx } = await page({ init: sampler });
  await p.fill('rd-composer textarea', 'Stale?');
  await p.press('rd-composer textarea', 'Enter');
  await p.waitForSelector('.asave');
  await p.click('.asave');
  await p.check('#asave-pop [data-fk="save:locker"]');
  await p.waitForSelector('.toast.t-error');
  check('save failure toast', (await msg(p)).join() === "Couldn't save the answer to the board.");
  await p.evaluate(() => { window.__refuse = false; });
  await p.click('.toast.t-error .toast-act');
  await p.waitForFunction(() => Object.keys(window.__notes()).some((k) => k.startsWith('answer-')));
  check('Retry saves', (await toasts(p)).length === 0);
  await ctx.close();
}

// Reduced motion: fade only, no slide.
{
  const { p, ctx } = await page({ motion: 'reduce' });
  await p.evaluate((r) => window.__push(r), [...ROWS, { id: 'n', name: 'New thing' }]);
  check('reduced motion: fade only', (await p.evaluate(() => getComputedStyle(document.querySelector('.toast')).animationName)) === 'toast-fade');
  await ctx.close();
}

process.exit((await finish()) ? 1 : 0);
