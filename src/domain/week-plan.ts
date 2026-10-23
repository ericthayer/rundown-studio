import type { PlanItem, PlanVersion, Project, WeekPlan } from '../types.js';
import { parseDay } from '../lib/dates.js';
import { hash } from '../lib/hash.js';
import { modelRows } from '../lib/sample-json.js';

/**
 * Weekly plan rules: ISO week keys, the rows a draft is built from, the prompt, and validation of
 * what Claude (or a stored doc) hands back. Everything read from Claude or the db is untrusted.
 */

export const MAX_ITEMS = 3;
export const WHY_MAX = 140;
/** Plans older than this many weeks are deleted on the next pin. */
export const KEEP_WEEKS = 8;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Monday (local) of the week holding `day` (YYYY-MM-DD). */
export function weekStart(day: string): Date {
  const d = parseDay(day) ?? new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** ISO 8601 week key, e.g. "2026-W43". Keys sort in time order as plain strings. */
export function weekKey(day: string): string {
  const d = weekStart(day);
  d.setDate(d.getDate() + 3); // Thursday decides the ISO year
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
}

/** The key of the week before `day`'s week. */
export function lastWeekKey(day: string): string {
  const d = weekStart(day);
  d.setDate(d.getDate() - 7);
  return weekKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

/** "Oct 19 – 25", or "Oct 26 – Nov 1" across a month end. */
export function weekLabel(day: string): string {
  const a = weekStart(day);
  const b = new Date(a);
  b.setDate(a.getDate() + 6);
  const mon = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short' });
  return `${mon(a)} ${a.getDate()} – ${a.getMonth() === b.getMonth() ? '' : `${mon(b)} `}${b.getDate()}`;
}

/** Rows a plan is drafted from: everything not parked. */
export const plannable = (projects: readonly Project[]): Project[] => projects.filter((p) => p.state !== 'parked');

/** Fingerprint of the rows a draft reads; a different value later means the board moved on. */
export const basisOf = (projects: readonly Project[]): string => hash(JSON.stringify(modelRows(plannable(projects))));

export function planPrompt(projects: readonly Project[], day: string): string {
  return `Today is ${day}. Below is a JSON list of one person's active projects with their latest check-in status. `
    + `Pick at most ${MAX_ITEMS} projects they should focus on this week, most important first. Weigh due dates, blockers on their side, `
    + 'waits that need a follow-up, decisions left open a long time, and priority (1 = top). '
    + `For each, give one plain-text reason under ${WHY_MAX} characters that names the concrete driver (a date, a blocker, a wait). `
    + 'Reply with only this JSON and nothing else: {"items":[{"projectId":"<id from the data>","why":"<reason>"}]}\n\n'
    + `Projects:\n${JSON.stringify(modelRows(plannable(projects)))}`;
}

const record = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Plan items from untrusted input: known, non-parked project ids only, no repeats, at most three.
 * With `strict` false (stored docs) a project that has since gone keeps its name snapshot.
 */
export function toItems(raw: unknown, projects: readonly Project[], strict = true): PlanItem[] {
  const list = Array.isArray(raw) ? raw : [];
  const byId = new Map(projects.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: PlanItem[] = [];
  for (const entry of list) {
    const r = record(entry);
    const id = r && typeof r.projectId === 'string' ? r.projectId : '';
    const p = byId.get(id);
    if (!id || seen.has(id)) continue;
    if (strict && (!p || p.state === 'parked')) continue;
    const name = p?.name ?? clean(r?.name, 80);
    if (!name) continue;
    seen.add(id);
    out.push({ projectId: id, name, why: clean(r?.why, WHY_MAX) });
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

/** The items in Claude's reply, or [] when none are usable. */
export const parsePlan = (value: unknown, projects: readonly Project[]): PlanItem[] => toItems(record(value)?.items, projects);

function toVersion(v: unknown, projects: readonly Project[]): PlanVersion | null {
  const r = record(v);
  if (!r) return null;
  const items = toItems(r.items, projects, false);
  const str = (x: unknown): string | null => (typeof x === 'string' && x ? x : null);
  return { items, basis: str(r.basis) ?? '', generatedAt: str(r.generatedAt), ...(str(r.pinnedAt) ? { pinnedAt: str(r.pinnedAt) as string } : {}) };
}

/** A `plans` doc read from the board, or null when it isn't one. */
export function toWeekPlan(id: string, data: unknown, projects: readonly Project[]): WeekPlan | null {
  const r = record(data);
  if (!r || !/^\d{4}-W\d{2}$/.test(id)) return null;
  return { week: id, draft: toVersion(r.draft, projects), pinned: toVersion(r.pinned, projects) };
}

/** A version for writing: plain data only. */
export function version(items: readonly PlanItem[], basis: string, generatedAt: string | null, pinnedAt?: string): PlanVersion {
  return { items: items.map((i) => ({ projectId: i.projectId, name: i.name, why: i.why })), basis, generatedAt, ...(pinnedAt ? { pinnedAt } : {}) };
}
