import type { Project, SourceError } from '../types.js';
import { daysSince } from '../lib/dates.js';

/**
 * Signals attached to a project: open decisions (with age) and who it's waiting on.
 * Rows may hold plain strings (older check-ins) or objects with a `since` date.
 */

export interface Decision { project: Project; text: string; age: number | null }
export interface Wait { who: string; what: string; age: number | null }

/** A wait older than this nudges the project back into "Needs you" (time to follow up). */
export const NUDGE_DAYS = 14;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export function decisions(p: Project): Decision[] {
  return list(p.openDecisions).flatMap((d): Decision[] => {
    const r = record(d);
    const t = typeof d === 'string' ? d.trim() : text(r.text);
    return t ? [{ project: p, text: t, age: daysSince(r.since) }] : [];
  });
}

export function waits(p: Project): Wait[] {
  return list(p.waitingOn).flatMap((w): Wait[] => {
    const r = record(w);
    const who = typeof w === 'string' ? w.trim() : text(r.who);
    return who ? [{ who, what: text(r.what), age: daysSince(r.since) }] : [];
  });
}

/** Blocked only on other people: waiting on someone, with no blockers of your own. */
export function waitingOnOthers(p: Project): boolean {
  const own = list(p.blockers).some((b) => text(b) !== '');
  return p.state === 'blocked' && !own && waits(p).length > 0;
}

/** A wait has gone on long enough to chase. */
export const overdueWait = (p: Project): boolean => waits(p).some((w) => w.age !== null && w.age >= NUDGE_DAYS);

/** Open decisions across the given projects (parked ones excluded), oldest first; undated last, by priority. */
export function decisionRollup(projects: readonly Project[]): Decision[] {
  return projects
    .filter((p) => p.state !== 'parked')
    .flatMap(decisions)
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1) || (a.project.priority ?? 99) - (b.project.priority ?? 99));
}

export const decisionCount = (projects: readonly Project[]): number => decisionRollup(projects).length;

/** "12d" / "today" / "" (unknown). */
export function ageLabel(age: number | null): string {
  if (age === null) return '';
  return age <= 0 ? 'today' : `${age}d`;
}

export function waitLabel(w: Wait): string {
  return w.what ? `${w.who}: ${w.what}` : w.who;
}

/** The source the last check-in couldn't reach, or null. A bare string names the source. */
export function sourceError(p: Project): (SourceError & { age: number | null }) | null {
  const v = p.sourceError;
  const r = record(v);
  const source = typeof v === 'string' ? v.trim() : text(r.source);
  if (!source) return null;
  const detail = text(r.detail);
  return { source: source.slice(0, 40), ...(detail ? { detail: detail.slice(0, 200) } : {}), age: daysSince(r.since) };
}
