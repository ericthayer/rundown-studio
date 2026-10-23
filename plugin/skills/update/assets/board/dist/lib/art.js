/**
 * State illustrations: static SVG first, then a Lottie animation when motion is allowed and the
 * player loads. lottie_light (~47KB gzipped) comes from cdnjs only when a state panel shows, with
 * SRI, so the main bundle doesn't carry it. Scene data is trusted and static (scenes.ts).
 */
import { SCENES } from './scenes.js';
const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js';
const SRI = 'sha384-Vtbz3QbtSBqleuQry6kQy5smig1gPZCXUoTFN7RmN9QW47xpEDsV/J1w0Pw0rDJu';
const LOAD_TIMEOUT = 8000;
const FRAMES = 90;
let player = null;
/** Loads the player once; resolves null when blocked, offline or slow (the static art stays). */
export function loadPlayer() {
    if (window.lottie)
        return Promise.resolve(window.lottie);
    player ??= new Promise((resolve) => {
        const done = (p) => { if (!p)
            player = null; resolve(p); };
        const s = document.createElement('script');
        s.src = SRC;
        s.integrity = SRI;
        s.crossOrigin = 'anonymous';
        s.async = true;
        s.onload = () => done(window.lottie ?? null);
        s.onerror = () => { s.remove(); done(null); };
        window.setTimeout(() => done(window.lottie ?? null), LOAD_TIMEOUT);
        document.head.append(s);
    });
    return player;
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const first = (t, fallback) => t?.[0]?.[1] ?? fallback;
/** One scene frame 0 as SVG markup. Tone classes carry the colors. */
export function staticSvg(name) {
    const layers = SCENES[name].layers.map((l) => {
        const [x, y] = l.at;
        const [dx, dy] = first(l.move, [0, 0]);
        const s = first(l.scale, 100) / 100;
        const tf = `translate(${x + dx} ${y + dy}) rotate(${first(l.spin, 0)}) scale(${s}) translate(${-x} ${-y})`;
        const fade = first(l.fade, 100);
        return `<g transform="${tf}"${fade < 100 ? ` opacity="${fade / 100}"` : ''}>${l.shapes.map(svgShape).join('')}</g>`;
    });
    return `<svg viewBox="0 0 120 120" aria-hidden="true">${layers.join('')}</svg>`;
}
function svgShape(sh) {
    const cls = 'fill' in sh ? `t-${sh.fill}` : `s-${sh.stroke}`;
    const sw = 'w' in sh ? ` stroke-width="${sh.w}"` : '';
    if (sh.k === 'rect')
        return `<rect class="${cls}" x="${sh.c[0] - sh.s[0] / 2}" y="${sh.c[1] - sh.s[1] / 2}" width="${sh.s[0]}" height="${sh.s[1]}" rx="${sh.r ?? 0}"${sw}/>`;
    if (sh.k === 'ellipse')
        return `<ellipse class="${cls}" cx="${sh.c[0]}" cy="${sh.c[1]}" rx="${sh.s[0] / 2}" ry="${sh.s[1] / 2}"${sw}/>`;
    return `<${sh.open ? 'polyline' : 'polygon'} class="${cls}" points="${sh.pts.map((p) => p.join(',')).join(' ')}"${sw}/>`;
}
const EASE = { o: { x: [0.45], y: [0] }, i: { x: [0.55], y: [1] } };
const still = (k) => ({ a: 0, k });
function prop(track, fallback, map) {
    if (!track?.length)
        return still(fallback);
    return { a: 1, k: track.map(([t, v], i) => (i < track.length - 1 ? { t, s: map(v), ...EASE } : { t, s: map(v) })) };
}
function lottieShape(sh) {
    const geo = sh.k === 'rect' ? { ty: 'rc', d: 1, p: still([...sh.c]), s: still([...sh.s]), r: still(sh.r ?? 0) }
        : sh.k === 'ellipse' ? { ty: 'el', d: 1, p: still([...sh.c]), s: still([...sh.s]) }
            : { ty: 'sh', d: 1, ks: still({ c: !sh.open, v: sh.pts.map((p) => [...p]), i: sh.pts.map(() => [0, 0]), o: sh.pts.map(() => [0, 0]) }) };
    const color = still([0, 0, 0, 1]);
    const style = 'fill' in sh ? { ty: 'fl', c: color, o: still(100), r: 1, cl: `t-${sh.fill}` }
        : { ty: 'st', c: color, o: still(100), w: still(sh.w), lc: 2, lj: 2, ml: 4, cl: `s-${sh.stroke}` };
    const tr = { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100) };
    return { ty: 'gr', it: [geo, style, tr] };
}
function lottieLayer(l, ind) {
    const [x, y] = l.at;
    return {
        ddd: 0, ind, ty: 4, sr: 1, ao: 0, bm: 0, ip: 0, op: FRAMES, st: 0,
        ks: {
            a: still([x, y, 0]),
            p: prop(l.move, [x, y, 0], ([dx, dy]) => [x + dx, y + dy, 0]),
            s: prop(l.scale, [100, 100, 100], (v) => [v, v, 100]),
            r: prop(l.spin, 0, (v) => [v]),
            o: prop(l.fade, 100, (v) => [v]),
        },
        // Lottie paints the first shape and layer on top; scenes list them bottom-up like SVG.
        shapes: l.shapes.map(lottieShape).reverse(),
    };
}
export function lottieData(name) {
    const layers = SCENES[name].layers.map((l, i) => lottieLayer(l, i + 1)).reverse();
    return { v: '5.7.4', fr: 30, ip: 0, op: FRAMES, w: 120, h: 120, nm: name, ddd: 0, assets: [], layers };
}
/**
 * Paints `name` into `host`: static now, animated once the player loads. Call `stopArt` on removal.
 * Repainting the same scene is a no-op, so store updates don't restart the loop.
 */
export function paintArt(host, name) {
    if (host.dataset.scene === name)
        return;
    stopArt(host);
    host.dataset.scene = name;
    host.innerHTML = staticSvg(name);
    if (reducedMotion())
        return;
    void loadPlayer().then((lottie) => {
        if (!lottie || host.dataset.scene !== name || !host.isConnected)
            return;
        const box = document.createElement('div');
        box.className = 'art-anim';
        host.append(box);
        try {
            const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: true, animationData: lottieData(name), rendererSettings: { progressiveLoad: false } });
            anim.addEventListener('DOMLoaded', () => { if (host.dataset.scene === name)
                host.dataset.anim = 'on'; });
            players.set(host, anim);
        }
        catch {
            box.remove();
        }
    });
}
const players = new WeakMap();
export function stopArt(host) {
    players.get(host)?.destroy();
    players.delete(host);
    host.querySelector('.art-anim')?.remove();
    delete host.dataset.anim;
    delete host.dataset.scene;
}
