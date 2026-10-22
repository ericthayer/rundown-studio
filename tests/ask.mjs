// Ask Rundown transcript: answers stack, survive a reload in the same tab, follow-ups carry context, Clear empties it.
import { page, check, finish } from './harness.mjs';

const withSampler = () => {
  window.__prompts = [];
  const use = window.claude.use;
  window.claude.use = async (n) => (n === 'sample'
    ? async (prompt, { onText } = {}) => { window.__prompts.push(prompt); const text = `Answer ${window.__prompts.length}`; onText?.({ text }); return { text }; }
    : use(n));
};

const { p, errors } = await page({ init: withSampler });
const ask = async (q) => { const n = (await p.locator('.alog .answer').count()) + 1; await p.fill('rd-composer textarea', q); await p.press('rd-composer textarea', 'Enter'); await p.waitForFunction((n) => document.querySelectorAll('.alog .answer').length === n && !/Thinking/.test(document.querySelector('.alog .answer:last-child').textContent), n); };

check('transcript starts empty with Clear hidden', (await p.locator('.alog .answer').count()) === 0 && await p.locator('.ahead').isHidden());
await ask("What's blocked?");
await ask('And the stale ones?');
check('answers stack in order', (await p.locator('.alog .answer .q').allTextContents()).join('|') === "What's blocked?|And the stale ones?");
check('input clears after asking', (await p.inputValue('rd-composer textarea')) === '');
const prompts = await p.evaluate(() => window.__prompts);
check('follow-up carries the earlier turn', !prompts[0].includes('Earlier in this conversation') && prompts[1].includes("Q: What's blocked?\nA: Answer 1"));
check('Clear is shown once there is history', await p.locator('.ahead').isVisible());

await p.reload();
await p.waitForSelector('.pitem');
check('transcript survives a reload in the same tab', (await p.locator('.alog .answer').count()) === 2 && (await p.locator('.alog .answer').last().textContent()).includes('Answer 2'));

await p.click('.aclear');
check('Clear empties the transcript and storage', (await p.locator('.alog .answer').count()) === 0 && await p.locator('.ahead').isHidden() && (await p.evaluate(() => sessionStorage.getItem('rundown.askLog'))) === null);
check('focus returns to the ask box after Clear', await p.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'));

const fresh = await page({ init: withSampler });
check('a new tab starts with no history', (await fresh.p.locator('.alog .answer').count()) === 0);
check('no page errors', errors.length === 0 && fresh.errors.length === 0, [...errors, ...fresh.errors].join('; '));

process.exit(await finish());
