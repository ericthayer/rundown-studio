// Copies the built board (index.html, styles/*.css, dist/**/*.js) into plugin/board/, which the
// setup and update skills publish. Run `npm run plugin` after board changes; `--check` fails when stale.
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'plugin/board');

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

if (process.argv.includes('--check')) {
  let have = [];
  try { have = await sources(OUT); } catch { /* missing board */ }
  const stale = want.length !== have.length || want.some((f, i) => f !== have[i]);
  const diff = [];
  if (!stale) {
    for (const f of want) {
      const [a, b] = await Promise.all([readFile(join(ROOT, f)), readFile(join(OUT, f))]);
      if (!a.equals(b)) diff.push(f);
    }
  }
  if (stale || diff.length) {
    console.log(`FAIL  plugin/board is out of date${diff.length ? ` (${diff.join(', ')})` : ''}. Run npm run plugin.`);
    process.exit(1);
  }
  console.log(`PASS  plugin/board matches the build (${want.length} files)`);
} else {
  await rm(OUT, { recursive: true, force: true });
  for (const f of want) {
    await mkdir(join(OUT, f, '..'), { recursive: true });
    await cp(join(ROOT, f), join(OUT, f));
  }
  console.log(`plugin/board: ${want.length} files`);
}
