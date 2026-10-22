// Board config suite: `meta/config` personalizes the sidebar and check-in command. Run: npm test
import { check, finish, page } from './harness.mjs';

const own = { owner: 'Ada Lovelace', schedule: 'Tue 7:00am', checkinCommand: '/rundown:checkin', boardUrl: 'https://claude.ai/artifact/example' };
const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent?.trim(), sel);

// Defaults: no config doc.
{
  const { p, ctx, errors } = await page({ meta: {} });
  check('default owner', (await text(p, '[data-ref="owner"]')) === 'Rundown');
  check('default initials', (await text(p, '[data-ref="initials"]')) === 'R');
  check('default schedule', (await text(p, '[data-ref="run"]')) === 'No schedule yet');
  check('default command', (await text(p, '#copy-cmd-2 .cta-lbl')) === '/project-checkin');
  check('no console errors (defaults)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Config applied, then updated live.
{
  const { p, ctx, errors } = await page({ meta: {}, config: own });
  check('owner from config', (await text(p, '[data-ref="owner"]')) === 'Ada Lovelace');
  check('initials from owner', (await text(p, '[data-ref="initials"]')) === 'AL');
  check('schedule from config', (await text(p, '[data-ref="run"]')) === 'Tue 7:00am');
  check('command label from config', (await text(p, '#copy-cmd-2 .cta-lbl')) === '/rundown:checkin');
  await p.evaluate(() => window.__pushMeta({ nextRun: 'Fri 3:16am' }));
  check('nextRun wins over schedule', (await text(p, '[data-ref="run"]')) === 'Next run Fri 3:16am');
  await p.evaluate(() => window.__pushConfig({ owner: 'Grace', checkinCommand: 'rm -rf', boardUrl: 'https://evil.example/' }));
  check('live owner update', (await text(p, '[data-ref="owner"]')) === 'Grace');
  check('rejects command without slash', (await text(p, '#copy-cmd-2 .cta-lbl')) === '/project-checkin');
  check('no console errors (config)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Empty board: the list panel names the configured command.
{
  const { p, ctx } = await page({ rows: [], meta: {}, config: own, wait: '.estate' });
  const msg = await text(p, '.estate-d');
  check('empty state names command', msg?.includes('/rundown:checkin'), msg);
  check('empty state action names command', (await text(p, '#empty-cta')) === 'Run /rundown:checkin');
  await ctx.close();
}

// Feedback links follow meta/config, with the maintainer as the default.
{
  const { p, ctx } = await page({ meta: {} });
  const href = (sel) => p.getAttribute(sel, 'href');
  check('feedback mails the maintainer by default', (await href('[data-fk="help:feedback"]'))?.startsWith('mailto:ethayer.design@gmail.com?subject=Rundown%20feedback'));
  check('issue link opens the repo issue form', (await href('[data-fk="help:issue"]')) === 'https://github.com/ericthayer/rundown-studio/issues/new');
  await p.evaluate(() => window.__pushConfig({ feedbackEmail: 'ada@example.com', issuesUrl: 'https://example.com/issues' }));
  check('feedbackEmail from config', (await href('[data-fk="help:feedback"]'))?.startsWith('mailto:ada@example.com?'));
  check('issuesUrl from config', (await href('[data-fk="help:issue"]')) === 'https://example.com/issues');
  await p.evaluate(() => window.__pushConfig({ feedbackEmail: 'not an email', issuesUrl: 'javascript:alert(1)' }));
  check('rejects bad feedback targets', (await href('[data-fk="help:feedback"]'))?.startsWith('mailto:ethayer.design@gmail.com?') && (await href('[data-fk="help:issue"]'))?.startsWith('https://github.com/'));
  await ctx.close();
}

process.exit((await finish()) ? 1 : 0);
