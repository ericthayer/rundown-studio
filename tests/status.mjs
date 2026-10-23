// STATUS.md format suite: the parser that CI and the rundown rules share. Run: npm test
import { readFile } from 'node:fs/promises';
import { parseStatus } from '../scripts/status-check.mjs';

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` (${detail})`}`);
  if (!ok) failed++;
};

const valid = `---
state: blocked   # active | blocked | parked
updated: 2026-10-20
updatedBy: codex
---
# Status

Released: v2.1.0 <!-- x-release-please-version -->

## Left off
Checkout flow is built.
Tests are still flaky.

## Next step
Ship the checkout PR.

## Blockers
- Need a Stripe test key

## Waiting on
- Dana: copy for the error states · since 2026-10-18
- Legal

## Open decisions
- Drop PayPal? · since 2026-10-15
- Keep the old receipt layout?
`;

{
  const { status, errors } = parseStatus(valid);
  check('valid file has no errors', errors.length === 0, errors.join('; '));
  check('state', status.state === 'blocked');
  check('updated maps to lastActivity', status.lastActivity === '2026-10-20');
  check('updatedBy', status.updatedBy === 'codex');
  check('released line without marker', status.released === 'v2.1.0', status.released);
  check('left off joins lines', status.leftOff === 'Checkout flow is built. Tests are still flaky.');
  check('next step', status.nextStep === 'Ship the checkout PR.');
  check('blockers', JSON.stringify(status.blockers) === '["Need a Stripe test key"]');
  check('waiting on with what and since', JSON.stringify(status.waitingOn[0]) === '{"who":"Dana","what":"copy for the error states","since":"2026-10-18"}', JSON.stringify(status.waitingOn[0]));
  check('waiting on with who only', JSON.stringify(status.waitingOn[1]) === '{"who":"Legal"}');
  check('decision with since', JSON.stringify(status.openDecisions[0]) === '{"text":"Drop PayPal?","since":"2026-10-15"}');
  check('decision without since', JSON.stringify(status.openDecisions[1]) === '{"text":"Keep the old receipt layout?"}');
}

{
  const src = valid.replace('- Need a Stripe test key', '- None').replace(/## Waiting on\n[\s\S]*?\n\n/, '## Waiting on\n- Nobody\n\n');
  const { status, errors } = parseStatus(src);
  check('None and Nobody become empty lists', errors.length === 0 && status.blockers.length === 0 && status.waitingOn.length === 0, errors.join('; '));
}

const fails = (name, src, needle) => {
  const { errors } = parseStatus(src);
  check(name, errors.some((e) => e.includes(needle)), errors.join('; ') || 'no errors');
};
fails('two next steps', valid.replace('Ship the checkout PR.', 'Ship the checkout PR.\nThen write docs.'), 'exactly one line');
fails('bad updated date', valid.replace('2026-10-20', '2026-13-40'), 'updated must be');
fails('bad since date', valid.replace('since 2026-10-15', 'since last week'), 'not a YYYY-MM-DD');
fails('stale is not a file state', valid.replace('state: blocked', 'state: stale'), 'state must be');
fails('missing section', valid.replace('## Blockers\n- Need a Stripe test key\n', ''), 'missing section "## Blockers"');
fails('unknown section', `${valid}\n## Decided\n- Ship it\n`, 'unknown section');
fails('no front matter', valid.slice(valid.indexOf('# Status')), 'must start with ---');
fails('non-bullet list line', valid.replace('- Need a Stripe test key', 'Need a Stripe test key'), 'not a "- " bullet');

for (const file of ['STATUS.md', 'plugin/skills/checkin/assets/STATUS.md']) {
  const src = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const { errors } = parseStatus(file.startsWith('plugin') ? src.replace('YYYY-MM-DD', '2026-01-01') : src);
  check(`${file} is valid`, errors.length === 0, errors.join('; '));
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
