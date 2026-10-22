/**
 * Update notice: /rundown:checkin records the installed plugin's version in `meta/config.pluginVersion`.
 * When that is newer than this board's build, a toast says so once per page load and copies /rundown:update.
 */
import { store } from '../store.js';
import { BOARD_VERSION } from '../version.js';
import { toast } from './toast.js';

export const UPDATE_COMMAND = '/rundown:update';

/** True when semver `a` is newer than `b`. Anything that isn't x.y.z counts as not newer. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  if (pa.length !== 3 || pb.length !== 3 || [...pa, ...pb].some((n) => !Number.isInteger(n))) return false;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

async function copyUpdate(): Promise<void> {
  try {
    await navigator.clipboard.writeText(UPDATE_COMMAND);
    toast({ tone: 'ok', key: 'update', text: `Copied ${UPDATE_COMMAND}. Run it in Claude to update this board.` });
  } catch {
    toast({ tone: 'info', key: 'update', text: `Run ${UPDATE_COMMAND} in Claude to update this board.` });
  }
}

export function initUpdateNotice(): void {
  let shown = '';
  store.subscribe(['config'], (_c, s) => {
    const latest = s.config.pluginVersion;
    if (!latest || latest === shown || !isNewer(latest, BOARD_VERSION)) return;
    shown = latest;
    toast({ tone: 'info', key: 'update', text: `Rundown ${latest} is installed. This board is on ${BOARD_VERSION}.`, action: { label: `Copy ${UPDATE_COMMAND}`, run: copyUpdate } });
  });
}
