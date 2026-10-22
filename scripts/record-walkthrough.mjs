// Records the README walkthrough: drives the board against the test stub with demo data and
// writes docs/walkthrough.gif. Run: npm run build && node scripts/record-walkthrough.mjs (needs ffmpeg).
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { page, browser } from '../tests/harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SIZE = { width: 1440, height: 900 };
const dir = await mkdtemp(join(tmpdir(), 'rundown-walk-'));
const config = { owner: 'Alex Rivera', schedule: 'Mon & Fri, 9:00am', checkinCommand: '/rundown:checkin' };
const sampler = () => {
  const use = window.claude.use;
  const answer = 'Start with Agrikit plugin: the MCP auth blocker is the only thing holding the adapter. Then chase the client for the WordPress copy, and park or revive Token Map; it has been quiet for 40 days.';
  window.claude.use = async (n) => (n === 'sample'
    ? async (_prompt, { onText } = {}) => {
      let text = '';
      for (const word of answer.split(' ')) { text += (text ? ' ' : '') + word; onText?.({ text }); await new Promise((r) => setTimeout(r, 45)); }
      return { text };
    }
    : use(n));
};

const { p, ctx } = await page({ scheme: 'dark', viewport: SIZE, video: { dir, size: SIZE }, config, init: sampler });
const pause = (ms) => p.waitForTimeout(ms);
await pause(1800);
// Stat strip filters the list.
await p.click('[data-fk="stat:needs"]'); await pause(1400);
await p.click('[data-fk="stat:needs"]'); await pause(600);
// A row opens its next-step card.
await p.click('[data-fk="row:a"]'); await pause(2600);
await p.click('[data-fk="row:a"]'); await pause(500);
// Decisions rollup, oldest first.
await p.click('[data-fk="nav:decisions"]'); await pause(2000);
await p.click('[data-fk="nav:all"]'); await pause(600);
// Filter chips.
await p.click('[data-fk="chip:status"]'); await pause(500);
await p.check('#fp-status input[value=blocked]'); await pause(1400);
await p.keyboard.press('Escape'); await p.click('.tright .fclear'); await pause(700);
// Ask Rundown answers from the board.
await p.click('rd-composer textarea');
await p.keyboard.type('What should I do first this week?', { delay: 35 });
await p.keyboard.press('Enter'); await pause(3200);
// Collapse the assistant to its icon rail and back.
await p.click('.aclose'); await pause(1500);
await p.click('[data-ref="rail-open"]'); await pause(900);
// Color mode from settings.
await p.click('.mset'); await pause(500);
await p.click('[data-fk="theme:light"]'); await pause(400);
await p.keyboard.press('Escape'); await pause(2000);

await ctx.close();
await browser.close();
const video = join(dir, (await readdir(dir)).find((f) => f.endsWith('.webm')));
const out = join(ROOT, 'docs/walkthrough.gif');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vf',
  'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  out]);
await rm(dir, { recursive: true, force: true });
console.log(`wrote ${out}`);
process.exit(0);
