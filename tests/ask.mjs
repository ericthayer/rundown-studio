// Ask Rundown transcript: answers stack, survive a reload in the same tab, follow-ups carry context, Clear empties it.
import { page, check, finish } from './harness.mjs';

const withSampler = () => {
  window.__prompts = [];
  const use = window.claude.use;
  window.claude.use = async (n) => (n === 'sample'
    ? async (prompt, { onText } = {}) => { window.__prompts.push(prompt); const text = `Answer ${window.__prompts.length}: Token Map has gone stale.`; onText?.({ text }); return { text }; }
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
check('follow-up carries the earlier turn', !prompts[0].includes('Earlier in this conversation') && prompts[1].includes("Q: What's blocked?\nA: Answer 1: Token Map has gone stale."));
check('Clear is shown once there is history', await p.locator('.ahead').isVisible());

await p.reload();
await p.waitForSelector('.pitem');
check('transcript survives a reload in the same tab', (await p.locator('.alog .answer').count()) === 2 && (await p.locator('.alog .answer').last().textContent()).includes('Answer 2'));

// Save: Locker and/or the project card, written to the board db right away.
const doc = () => p.evaluate(() => Object.entries(window.__notes()).find(([id]) => id.startsWith('answer-')));
await p.locator('.asave').last().click();
check('Save opens the Save to menu', await p.isVisible('#asave-pop'));
check('the project the answer names is preselected', (await p.inputValue('#asave-pop select')) === 'c');
check('focus moves into the menu', await p.evaluate(() => document.activeElement?.dataset.fk === 'save:locker'));
await p.check('#asave-pop [data-fk="save:locker"]'); await p.waitForTimeout(50);
let d = await doc();
check('Locker save writes an answer doc', d && d[1].kind === 'answer' && d[1].inLocker === true && d[1].projectId === null && d[1].question === 'And the stale ones?', JSON.stringify(d));
check('the answer reads Saved', (await p.locator('.asave').last().textContent()) === 'Saved');
await p.check('#asave-pop [data-fk="save:card"]'); await p.waitForTimeout(50);
d = await doc();
check('Project card save adds the project to the same doc', d[1].projectId === 'c' && d[1].inLocker === true);
check('status says where it went', (await p.textContent('.asave-st')) === 'Saved to the Locker and Token Map.');
await p.keyboard.press('Escape');
check('Escape closes the menu and returns focus to Save', !(await p.isVisible('#asave-pop')) && await p.evaluate(() => document.activeElement?.classList.contains('asave')));
await p.click('[data-fk="row:c"]');
check('the project card lists the saved answer', (await p.locator('.ns-saved-a').textContent()) === 'Answer 2: Token Map has gone stale.');
await p.click('.mset'); await p.waitForTimeout(50);
check('the Locker lists the saved answer with its question', (await p.locator('.nlock-q').first().textContent()) === 'And the stale ones?');
await p.keyboard.press('Escape');
await p.click('[data-fk^="saved:rm:"]'); await p.waitForTimeout(50);
d = await doc();
check('Remove on the card keeps it in the Locker', d[1].projectId === null && d[1].inLocker === true && (await p.locator('.ns-saved').count()) === 0);
await p.locator('.asave').last().click();
await p.uncheck('#asave-pop [data-fk="save:locker"]'); await p.waitForTimeout(50);
check('unticking both deletes the doc', !(await doc()) && (await p.locator('.asave').last().textContent()) === 'Save');
await p.keyboard.press('Escape');

await p.click('.aclear');
check('Clear empties the transcript and storage', (await p.locator('.alog .answer').count()) === 0 && await p.locator('.ahead').isHidden() && (await p.evaluate(() => sessionStorage.getItem('rundown.askLog'))) === null);
check('focus returns to the ask box after Clear', await p.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'));

// Touch: a haptic tap on submit (Vibration API where it exists), focus stays in the box.
const touch = await page({ init: () => { window.__buzz = []; navigator.vibrate = (ms) => { window.__buzz.push(ms); return true; }; }, viewport: { width: 390, height: 844 }, touch: true });
await touch.p.click('#agent-toggle'); await touch.p.waitForTimeout(400);
await touch.p.fill('rd-composer textarea', 'Token'); await touch.p.press('rd-composer textarea', 'Enter');
check('submit gives a haptic tap on touch', (await touch.p.evaluate(() => window.__buzz)).length === 1);

const fresh = await page({ init: withSampler });
check('a new tab starts with no history', (await fresh.p.locator('.alog .answer').count()) === 0);
check('no page errors', errors.length === 0 && fresh.errors.length === 0 && touch.errors.length === 0, [...errors, ...fresh.errors, ...touch.errors].join('; '));

process.exit(await finish());
