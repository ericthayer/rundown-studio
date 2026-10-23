// Parses and validates STATUS.md (where work left off, next step, blockers) into board-row fields.
// Usage: node scripts/status-check.mjs [STATUS.md] [--json]. Exits 1 when the file is malformed.
import { readFile } from 'node:fs/promises';

const STATES = ['active', 'blocked', 'parked'];
const SECTIONS = { 'Left off': 'leftOff', 'Next step': 'nextStep', Blockers: 'blockers', 'Waiting on': 'waitingOn', 'Open decisions': 'openDecisions' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SINCE = /\s+·\s+since\s+(.+?)\s*$/;
const EMPTY = /^(none|nobody)\.?$/i;

const isDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** Splits "text · since YYYY-MM-DD" into its parts; `since` is undefined when absent. */
function splitSince(item, where, errors) {
  const m = item.match(SINCE);
  if (!m) return { text: item };
  if (!isDate(m[1])) errors.push(`${where}: "${m[1]}" is not a YYYY-MM-DD date`);
  return { text: item.slice(0, m.index).trim(), since: m[1] };
}

function bullets(lines, where, errors) {
  const items = [];
  for (const l of lines) {
    if (!l.startsWith('- ')) { errors.push(`${where}: "${l}" is not a "- " bullet`); continue; }
    items.push(l.slice(2).trim());
  }
  return items.length === 1 && EMPTY.test(items[0]) ? [] : items;
}

/** Returns `{ status, errors }`. `status` uses board field names; `errors` is empty when the file is valid. */
export function parseStatus(src) {
  const errors = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const status = {};

  if (lines[0] !== '---') errors.push('front matter: the file must start with ---');
  const end = lines.indexOf('---', 1);
  if (lines[0] === '---' && end < 0) errors.push('front matter: no closing ---');
  const front = {};
  for (const l of lines[0] === '---' && end > 0 ? lines.slice(1, end) : []) {
    const m = l.match(/^(\w+):\s*(.*?)\s*(#.*)?$/);
    if (m) front[m[1]] = m[2];
  }
  if (!STATES.includes(front.state)) errors.push(`front matter: state must be one of ${STATES.join(', ')}`);
  else status.state = front.state;
  if (!isDate(front.updated ?? '')) errors.push('front matter: updated must be a YYYY-MM-DD date');
  else status.lastActivity = front.updated;
  if (!front.updatedBy) errors.push('front matter: updatedBy is required');
  else status.updatedBy = front.updatedBy;

  const body = end > 0 ? lines.slice(end + 1) : lines;
  const released = body.find((l) => l.startsWith('Released:'));
  if (released) status.released = released.replace(/^Released:\s*/, '').replace(/<!--.*?-->/g, '').trim();

  const found = {};
  let current = null;
  for (const raw of body) {
    const l = raw.trim();
    const h = l.match(/^##\s+(.+)$/);
    if (h) {
      current = h[1].trim();
      if (!(current in SECTIONS)) errors.push(`unknown section "## ${current}"`);
      else if (found[current]) errors.push(`section "## ${current}" appears twice`);
      found[current] = [];
      continue;
    }
    if (current && l && !l.startsWith('<!--')) found[current]?.push(l);
  }
  for (const name of Object.keys(SECTIONS)) if (!found[name]) errors.push(`missing section "## ${name}"`);

  if (found['Left off']) {
    if (!found['Left off'].length) errors.push('Left off: write one or two sentences');
    else status.leftOff = found['Left off'].join(' ');
  }
  if (found['Next step']) {
    const n = found['Next step'];
    if (n.length !== 1) errors.push(`Next step: exactly one line, found ${n.length}`);
    else status.nextStep = n[0].replace(/^- /, '');
  }
  if (found.Blockers) status.blockers = bullets(found.Blockers, 'Blockers', errors);
  if (found['Waiting on']) {
    status.waitingOn = bullets(found['Waiting on'], 'Waiting on', errors).map((item) => {
      const { text, since } = splitSince(item, 'Waiting on', errors);
      const i = text.indexOf(':');
      const who = (i < 0 ? text : text.slice(0, i)).trim();
      const what = i < 0 ? '' : text.slice(i + 1).trim();
      return { who, ...(what && { what }), ...(since && { since }) };
    });
  }
  if (found['Open decisions']) {
    status.openDecisions = bullets(found['Open decisions'], 'Open decisions', errors)
      .map((item) => { const { text, since } = splitSince(item, 'Open decisions', errors); return { text, ...(since && { since }) }; });
  }
  return { status, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'STATUS.md';
  let src;
  try { src = await readFile(file, 'utf8'); } catch {
    console.log(`SKIP  ${file} not found`);
    process.exit(0);
  }
  const { status, errors } = parseStatus(src);
  if (errors.length) {
    for (const e of errors) console.log(`FAIL  ${file}: ${e}`);
    process.exit(1);
  }
  console.log(process.argv.includes('--json') ? JSON.stringify(status, null, 2) : `PASS  ${file} is valid (updated ${status.lastActivity})`);
}
