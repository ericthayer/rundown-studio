// Pinned ask dock: stays at the bottom of the main panel, shadow only while rows sit under it. Run: npm test
import { ROWS, check, finish, page } from './harness.mjs';

const MANY = Array.from({ length: 24 }, (_, i) => ({ ...ROWS[i % ROWS.length], id: `r${i}`, name: `Project ${i + 1}`, priority: i + 1 }));
const lifted = (p) => p.evaluate(() => document.querySelector('rd-composer.dock').classList.contains('lifted'));
const pinned = (p) => p.evaluate(() => Math.abs(document.querySelector('rd-composer.dock').getBoundingClientRect().bottom - innerHeight) < 1);
const settle = (p) => p.waitForTimeout(150);

for (const [name, opts, scrollEnd] of [
  ['wide', { viewport: { width: 1440, height: 860 } }, () => { const l = document.querySelector('.center .plist'); l.scrollTop = l.scrollHeight; }],
  ['phone', { viewport: { width: 390, height: 844 }, touch: true }, () => window.scrollTo(0, document.scrollingElement.scrollHeight)],
]) {
  {
    const { p, ctx } = await page({ ...opts, viewport: name === 'wide' ? opts.viewport : { width: 390, height: 2000 } });
    await settle(p);
    check(`${name}: no shadow when every row fits`, !(await lifted(p)));
    await ctx.close();
  }
  const { p, ctx, errors } = await page({ ...opts, rows: MANY });
  await settle(p);
  check(`${name}: dock pinned to the bottom`, await pinned(p));
  check(`${name}: shadow while rows sit under the dock`, await lifted(p));
  await p.evaluate(scrollEnd);
  await settle(p);
  check(`${name}: dock still pinned at the end`, await pinned(p));
  check(`${name}: shadow drops at the end of the list`, !(await lifted(p)));
  check(`${name}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

process.exit((await finish()) ? 1 : 0);
