import { prefs } from './prefs.js';
/** Applies a color mode: tokens.css keys off `data-theme` on <html>; 'system' removes it. */
export function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system')
        root.removeAttribute('data-theme');
    else
        root.setAttribute('data-theme', mode);
}
// Apply the saved mode as soon as the entry module loads, before components render.
applyTheme(prefs.get('theme'));
