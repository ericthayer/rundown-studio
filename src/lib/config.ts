/** Per-board settings from `meta/config`. Rows are shared data: only non-empty strings are kept. */
import type { BoardConfig } from '../types.js';
import { store } from '../store.js';

const DEFAULT_COMMAND = '/project-checkin';
const KEYS = ['owner', 'boardUrl', 'schedule', 'checkinCommand', 'feedbackEmail', 'issuesUrl', 'pluginVersion'] as const;
/** Feedback goes to Rundown's maintainer unless a board's `meta/config` points elsewhere. */
export const FEEDBACK_EMAIL = 'ethayer.design@gmail.com';
export const ISSUES_URL = 'https://github.com/ericthayer/rundown-studio/issues/new';

export function toConfig(raw: Record<string, unknown> | undefined): BoardConfig {
  const out: BoardConfig = {};
  for (const k of KEYS) {
    const v = raw?.[k];
    if (typeof v === 'string' && v.trim() !== '') out[k] = v.trim().slice(0, 200);
  }
  if (out.boardUrl && !out.boardUrl.startsWith('https://claude.ai/')) delete out.boardUrl;
  if (out.checkinCommand && !out.checkinCommand.startsWith('/')) delete out.checkinCommand;
  if (out.feedbackEmail && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(out.feedbackEmail)) delete out.feedbackEmail;
  if (out.issuesUrl && !out.issuesUrl.startsWith('https://')) delete out.issuesUrl;
  if (out.pluginVersion && !/^\d+\.\d+\.\d+$/.test(out.pluginVersion)) delete out.pluginVersion;
  return out;
}

export const checkinCommand = (): string => store.state.config.checkinCommand ?? DEFAULT_COMMAND;

/** mailto: link with a subject and the page URL, so a report says which board it came from. */
export function feedbackHref(): string {
  const to = store.state.config.feedbackEmail ?? FEEDBACK_EMAIL;
  const subject = encodeURIComponent('Rundown feedback');
  const body = encodeURIComponent(`\n\n---\nBoard: ${store.state.config.boardUrl ?? location.href}\nBrowser: ${navigator.userAgent}`);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

export const issuesHref = (): string => store.state.config.issuesUrl ?? ISSUES_URL;

/** Up to two initials for the avatar, e.g. "Ada Lovelace" → "AL", "Rundown" → "R". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const pick = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1);
  return pick.map((p) => [...p][0] ?? '').join('').toUpperCase();
}
