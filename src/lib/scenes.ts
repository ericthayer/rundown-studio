/**
 * State illustrations as plain data. One description renders two ways (art.ts): a static SVG (first
 * paint, reduced motion, script blocked) and a Lottie animation. Colors are tone names that map to
 * tokens in styles/states.css, so both renderings follow the color mode. Canvas 120×120, 90 frames
 * at 30fps (a 3s loop); frame 0 is the static rest pose.
 */
export type Tone = 'surface' | 'chip' | 'line' | 'muted' | 'ink' | 'peach' | 'pink' | 'violet';
export type Pt = readonly [number, number];
type Geo =
  | { k: 'rect'; c: Pt; s: Pt; r?: number }
  | { k: 'ellipse'; c: Pt; s: Pt }
  | { k: 'poly'; pts: readonly Pt[]; open?: true };
export type Shape = Geo & ({ fill: Tone } | { stroke: Tone; w: number });
/** Keyframes as [frame, value]; the last frame should equal the first so the loop is seamless. */
export type Track<T> = readonly (readonly [number, T])[];
export interface Layer { at: Pt; move?: Track<Pt>; scale?: Track<number>; spin?: Track<number>; fade?: Track<number>; shapes: readonly Shape[] }
export interface Scene { layers: readonly Layer[] }
export type SceneName = 'empty' | 'search' | 'unplugged';

/** Four-point sparkle (the assistant mark) as a polygon. */
function star(cx: number, cy: number, R: number, r: number): Pt[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const d = i % 2 ? r : R;
    return [Math.round((cx + d * Math.cos(a)) * 10) / 10, Math.round((cy + d * Math.sin(a)) * 10) / 10] as const;
  });
}

const bob: Track<Pt> = [[0, [0, 0]], [45, [0, -6]], [90, [0, 0]]];
const row = (y: number, dot: Tone, w: number): Shape[] => [
  { k: 'rect', c: [40, y], s: [6, 6], r: 2, fill: dot },
  { k: 'rect', c: [48 + w / 2, y], s: [w, 6], r: 3, fill: 'chip' },
];

export const SCENES: Record<SceneName, Scene> = {
  // Empty board: a blank card floats while two sparkles twinkle.
  empty: { layers: [
    { at: [60, 104], scale: [[0, 100], [45, 82], [90, 100]], fade: [[0, 100], [45, 60], [90, 100]], shapes: [{ k: 'ellipse', c: [60, 104], s: [56, 8], fill: 'line' }] },
    { at: [60, 58], move: bob, shapes: [
      { k: 'rect', c: [60, 58], s: [64, 76], r: 10, fill: 'surface' },
      { k: 'rect', c: [60, 58], s: [64, 76], r: 10, stroke: 'line', w: 2 },
      { k: 'rect', c: [60, 22], s: [26, 10], r: 5, fill: 'violet' },
      ...row(42, 'peach', 32), ...row(56, 'pink', 22), ...row(70, 'violet', 28),
    ] },
    { at: [92, 26], scale: [[0, 100], [20, 55], [40, 100], [90, 100]], spin: [[0, 0], [90, 90]], shapes: [{ k: 'poly', pts: star(92, 26, 9, 3), fill: 'peach' }] },
    { at: [26, 40], scale: [[0, 100], [45, 100], [60, 35], [75, 100], [90, 100]], shapes: [{ k: 'poly', pts: star(26, 40, 6, 2), fill: 'pink' }] },
  ] },
  // No matches: a magnifier sweeps a card; a question mark nods.
  search: { layers: [
    { at: [58, 104], shapes: [{ k: 'ellipse', c: [58, 104], s: [56, 8], fill: 'line' }] },
    { at: [54, 58], shapes: [
      { k: 'rect', c: [54, 58], s: [60, 72], r: 10, fill: 'surface' },
      { k: 'rect', c: [54, 58], s: [60, 72], r: 10, stroke: 'line', w: 2 },
      { k: 'rect', c: [52, 38], s: [36, 6], r: 3, fill: 'chip' },
      { k: 'rect', c: [48, 52], s: [28, 6], r: 3, fill: 'chip' },
      { k: 'rect', c: [50, 66], s: [32, 6], r: 3, fill: 'chip' },
    ] },
    { at: [70, 66], move: [[0, [0, 0]], [30, [-18, -12]], [60, [-6, 8]], [90, [0, 0]]], spin: [[0, 0], [30, -10], [60, 8], [90, 0]], shapes: [
      { k: 'ellipse', c: [70, 66], s: [30, 30], fill: 'surface' },
      { k: 'poly', pts: [[64, 61], [67, 58]], open: true, stroke: 'peach', w: 3 },
      { k: 'ellipse', c: [70, 66], s: [30, 30], stroke: 'ink', w: 5 },
      { k: 'poly', pts: [[82, 78], [92, 88]], open: true, stroke: 'ink', w: 7 },
    ] },
    { at: [92, 34], scale: [[0, 100], [15, 118], [30, 100], [90, 100]], spin: [[0, 0], [15, 8], [30, 0], [90, 0]], shapes: [
      { k: 'poly', pts: [[87, 25], [88.5, 21.5], [92, 20], [95.5, 21.5], [97, 25.5], [95, 28.5], [92, 30.5], [92, 34]], open: true, stroke: 'peach', w: 4 },
      { k: 'ellipse', c: [92, 41], s: [5, 5], fill: 'peach' },
    ] },
  ] },
  // Disconnected: plug and socket drift apart and back; sparks flicker in the gap.
  unplugged: { layers: [
    { at: [60, 100], shapes: [{ k: 'ellipse', c: [60, 100], s: [84, 7], fill: 'line' }] },
    { at: [44, 62], move: [[0, [0, 0]], [45, [-5, 0]], [90, [0, 0]]], shapes: [
      { k: 'poly', pts: [[6, 82], [18, 82], [26, 62], [32, 62]], open: true, stroke: 'muted', w: 4 },
      { k: 'rect', c: [56, 56], s: [12, 4], r: 2, fill: 'muted' },
      { k: 'rect', c: [56, 68], s: [12, 4], r: 2, fill: 'muted' },
      { k: 'rect', c: [42, 62], s: [20, 24], r: 5, fill: 'ink' },
    ] },
    { at: [80, 62], move: [[0, [0, 0]], [45, [5, 0]], [90, [0, 0]]], shapes: [
      { k: 'poly', pts: [[90, 62], [100, 62], [106, 42], [116, 42]], open: true, stroke: 'muted', w: 4 },
      { k: 'rect', c: [80, 62], s: [20, 28], r: 6, fill: 'peach' },
      { k: 'rect', c: [74, 56], s: [4, 4], r: 1, fill: 'surface' },
      { k: 'rect', c: [74, 68], s: [4, 4], r: 1, fill: 'surface' },
    ] },
    { at: [66, 36], fade: [[0, 100], [30, 0], [60, 100], [90, 100]], scale: [[0, 100], [30, 50], [60, 100], [90, 100]], shapes: [{ k: 'poly', pts: star(66, 36, 7, 2.2), fill: 'pink' }] },
    { at: [70, 86], fade: [[0, 100], [45, 100], [70, 0], [90, 100]], shapes: [{ k: 'poly', pts: star(70, 86, 5, 1.6), fill: 'violet' }] },
  ] },
};
