// Copies the built board (index.html, styles/*.css, dist/**/*.js) into the setup and update skills'
// assets/board/, which they publish. Each skill carries its own copy because claude.ai keeps only a
// skill's own folder. Run `npm run plugin` after board changes; `--check` fails when a copy is stale.
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUTS = ['plugin/skills/setup/assets/board', 'plugin/skills/update/assets/board'];

async function walk(dir, ext) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, ext)));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const sources = async (root) => [
  join(root, 'index.html'),
  ...(await walk(join(root, 'styles'), '.css')),
  ...(await walk(join(root, 'dist'), '.js')),
].map((p) => relative(root, p)).sort();

const want = await sources(ROOT);

async function stale(out) {
  let have = [];
  try { have = await sources(join(ROOT, out)); } catch { return ['missing']; }
  if (want.length !== have.length || want.some((f, i) => f !== have[i])) return ['file list'];
  const diff = [];
  for (const f of want) {
    const [a, b] = await Promise.all([readFile(join(ROOT, f)), readFile(join(ROOT, out, f))]);
    if (!a.equals(b)) diff.push(f);
  }
  return diff;
}

if (process.argv.includes('--check')) {
  let failed = false;
  for (const out of OUTS) {
    const diff = await stale(out);
    if (diff.length) { failed = true; console.log(`FAIL  ${out} is out of date (${diff.join(', ')}). Run npm run plugin.`); }
    else console.log(`PASS  ${out} matches the build (${want.length} files)`);
  }
  // The checkin skill reads its version from assets/VERSION.md; release-please bumps it with plugin.json.
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version;
  const plugin = JSON.parse(await readFile(join(ROOT, 'plugin/.claude-plugin/plugin.json'), 'utf8')).version;
  const note = (await readFile(join(ROOT, 'plugin/skills/checkin/assets/VERSION.md'), 'utf8')).match(/\d+\.\d+\.\d+/)?.[0];
  if (plugin !== pkg || note !== pkg) { failed = true; console.log(`FAIL  versions differ: package.json ${pkg}, plugin.json ${plugin}, checkin VERSION.md ${note}`); }
  else console.log(`PASS  plugin versions match (${pkg})`);
  process.exit(failed ? 1 : 0);
} else {
  for (const out of OUTS) {
    await rm(join(ROOT, out), { recursive: true, force: true });
    for (const f of want) {
      await mkdir(join(ROOT, out, f, '..'), { recursive: true });
      await cp(join(ROOT, f), join(ROOT, out, f));
    }
    console.log(`${out}: ${want.length} files`);
  }
}
