// This week: draft with the board's Claude, edit, pin, persist; validation, failures, no-Claude path, docked Ask.
import { join } from 'node:path';
import { page, check, finish, OUT, ROWS } from './harness.mjs';

const PLAN = { items: [
  { projectId: 'a', why: 'Due in 3 days and blocked on MCP auth.' },
  { projectId: 'nope', why: 'Not on the board.' },
  { projectId: 'd', why: 'Parked, so it must be dropped.' },
  { projectId: 'e', why: 'Client copy is late; chase it.' },
  { projectId: 'a', why: 'Duplicate.' },
] };

const withSampler = (plan) => {
  window.__calls = [];
  const use = window.claude.use;
  window.claude.use = async (n) => (n === 'sample' ? async (prompt, opts = {}) => {
    window.__calls.push({ prompt, tier: opts.modelTier });
    const mode = window.__mode;
    if (mode === 'junk') return { text: 'Sure! Here is your plan: focus on Agrikit.' };
    if (mode) throw { code: mode, message: mode };
    return { text: '```json\n' + JSON.stringify(plan) + '\n```' };
  } : use(n));
};

const { p, errors } = await page({ init: withSampler, initArg: PLAN });
await p.waitForSelector('rd-week-plan [data-fk="plan:draft"]');
check('empty week offers Draft this week', await p.isVisible('[data-fk="plan:draft"]'));
check('week range shows in the header', /\w{3} \d+ – /.test(await p.textContent('rd-week-plan [data-ref="range"]')));
check('Ask Rundown is docked under the project list', await p.evaluate(() => document.querySelector('.ptable rd-composer.dock textarea') !== null && !document.querySelector('#agent rd-composer')));

await p.click('[data-fk="plan:draft"]');
await p.waitForSelector('.wed');
const call = await p.evaluate(() => window.__calls[0]);
check('draft uses the standard tier', call.tier === 'standard');
check('prompt leaves parked rows out', !call.prompt.includes('"Brochure site"') && call.prompt.includes('"Agrikit plugin"'));
const picked = await p.$$eval('.wed-row select', (s) => s.map((x) => x.value));
check('unknown, parked and repeated ids are dropped', picked.join() === 'a,e', picked.join());
check('focus moves to the first field', await p.evaluate(() => document.activeElement?.dataset.fk === 'plan:p0'));
check('draft is saved to the board', (await p.evaluate(() => window.__plans()))[Object.keys(await p.evaluate(() => window.__plans()))[0]]?.draft?.items.length === 2);
await p.screenshot({ path: join(OUT, 'plan-editor.png') });

// Reorder with buttons, keep focus on the moved item.
await p.click('[data-fk="plan:down0"]');
check('Move down swaps items', (await p.$$eval('.wed-row select', (s) => s.map((x) => x.value))).join() === 'e,a');
check('focus follows the moved item', await p.evaluate(() => document.activeElement?.dataset.fk?.endsWith('1')));
await p.fill('#wed-w0', 'Chase the client today.');
await p.click('[data-fk="plan:pin"]');
await p.waitForSelector('.wlist');
const names = await p.$$eval('.wlist .wname', (b) => b.map((x) => x.textContent));
check('pinned plan shows in order', names.join('|') === 'WordPress handoff|Agrikit plugin', names.join('|'));
check('edited reason is kept', (await p.textContent('.witem .why')) === 'Chase the client today.');
check('each item shows the live next step', (await p.textContent('.witem:nth-child(2) .nx')).includes('Ship the MCP adapter.'));
const stored = Object.values(await p.evaluate(() => window.__plans()))[0];
check('pin writes pinned and clears the draft', stored.draft === null && stored.pinned.items.length === 2 && Boolean(stored.pinned.pinnedAt));
check('pinned toast', (await p.textContent('.toast .toast-msg'))?.startsWith('Plan pinned'));
await p.screenshot({ path: join(OUT, 'plan-pinned.png') });

await p.reload(); await p.waitForSelector('.wlist');
check('plan survives a reload', (await p.$$eval('.wlist .wname', (b) => b.length)) === 2);
await p.evaluate((rows) => window.__push(rows.map((r) => (r.id === 'a' ? { ...r, nextStep: 'Ask for a test token.' } : r))), ROWS);
check('board changes refresh the next step', (await p.textContent('.witem:nth-child(2) .nx')).includes('Ask for a test token.'));
check('changed board offers Redraft', await p.isVisible('.wmoved [data-fk="plan:redraft-view"]'));
await p.click('.witem:nth-child(2) .wname');
check('project name opens its row', await p.evaluate(() => document.activeElement?.dataset.fk === 'row:a'));

// Edit, then Cancel keeps the pinned plan.
await p.click('[data-fk="plan:edit"]');
await p.click('[data-fk="plan:remove0"]');
check('Remove drops an item and keeps focus in the form', (await p.$$eval('.wed-row', (r) => r.length)) === 1 && await p.evaluate(() => document.activeElement?.dataset.fk === 'plan:p0'));
await p.click('[data-fk="plan:cancel"]');
check('Cancel keeps the pinned plan', (await p.$$eval('.wlist .wname', (b) => b.length)) === 2);

// Failures stay inline with Try again where it helps.
await p.click('[data-fk="plan:edit"]');
await p.evaluate(() => { window.__mode = 'junk'; });
await p.click('[data-fk="plan:redraft"]');
await p.waitForSelector('.werr');
check('unreadable reply: inline copy + Try again', (await p.textContent('.werr p')).startsWith("Claude's draft came back in a shape") && await p.isVisible('.werr [data-fk="plan:retry"]'));
check('editor stays open after a failed redraft', await p.isVisible('.wed'));
await p.evaluate(() => { window.__mode = 'rate_limited'; });
await p.click('[data-fk="plan:retry"]');
await p.waitForFunction(() => document.querySelector('.werr p')?.textContent?.startsWith('Too many'));
check('rate limit copy', true);
await p.evaluate(() => { window.__mode = 'not_granted'; });
await p.click('[data-fk="plan:retry"]');
await p.waitForFunction(() => document.querySelector('.werr p')?.textContent?.startsWith('Drafting needs Claude'));
check('not granted: no retry, Redraft goes away', !(await p.isVisible('.werr [data-fk="plan:retry"]')) && !(await p.isVisible('[data-fk="plan:redraft"]')));
check('no page errors', errors.length === 0, errors.join(' | '));
await p.context().close();

// No Claude in this view: plan it yourself.
{
  const { p, errors } = await page({});
  await p.waitForSelector('[data-fk="plan:scratch"]');
  check('without Claude: Plan it yourself, no Draft button', !(await p.isVisible('[data-fk="plan:draft"]')));
  await p.click('[data-fk="plan:scratch"]');
  await p.click('[data-fk="plan:pin"]');
  check('pinning nothing asks for a project', (await p.textContent('.wed-msg')) === 'Pick at least one project to pin.');
  await p.selectOption('#wed-p0', 'c');
  await p.click('[data-fk="plan:add"]');
  check('Add a project adds a row and focuses it', await p.evaluate(() => document.activeElement?.dataset.fk === 'plan:p1'));
  await p.click('[data-fk="plan:pin"]');
  await p.waitForSelector('.wlist');
  check('hand-made plan pins', (await p.textContent('.wfoot')) === 'Planned by you.');
  check('no page errors (no Claude)', errors.length === 0, errors.join(' | '));
  await p.context().close();
}

// The board refuses the pin: sticky toast with Retry, draft stays on screen.
{
  const refuse = () => {
    const use = window.claude.use;
    window.claude.use = async (n) => {
      const db = await use(n);
      if (n !== 'db' || !db) return db;
      const col = db.collection;
      return { ...db, collection: (name) => {
        const c = col(name);
        return name !== 'plans' ? c : { ...c, doc: (id) => ({ ...c.doc(id), set: async (d) => { if (window.__refuse) throw { code: 'unavailable' }; return c.doc(id).set(d); } }) };
      } };
    };
    window.__refuse = true;
  };
  const { p } = await page({ init: refuse });
  await p.click('[data-fk="plan:scratch"]');
  await p.selectOption('#wed-p0', 'b');
  await p.click('[data-fk="plan:pin"]');
  await p.waitForSelector('.toast.t-error');
  check('refused pin: error toast, editor kept', (await p.textContent('.toast.t-error .toast-msg')) === "Couldn't pin the plan to the board." && await p.isVisible('.wed'));
  await p.evaluate(() => { window.__refuse = false; });
  await p.click('.toast.t-error .toast-act');
  await p.waitForSelector('.wlist');
  check('Retry pins', Object.values(await p.evaluate(() => window.__plans()))[0]?.pinned?.items[0]?.projectId === 'b');
  await p.context().close();
}

// Phone: the drawer holds the plan; the ask bar stays on the page.
{
  const { p, errors } = await page({ init: withSampler, initArg: PLAN, viewport: { width: 390, height: 844 }, touch: true });
  check('phone: ask bar visible without opening the drawer', await p.isVisible('rd-composer.dock textarea'));
  await p.tap('#agent-toggle'); await p.waitForTimeout(400);
  check('phone: drawer shows This week', await p.isVisible('#agent [data-fk="plan:draft"]'));
  await p.screenshot({ path: join(OUT, 'plan-phone.png') });
  check('phone: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('no page errors (phone)', errors.length === 0, errors.join(' | '));
  await p.context().close();
}

process.exit(await finish());
