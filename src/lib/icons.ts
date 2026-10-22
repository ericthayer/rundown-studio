/** Static, trusted SVG markup (inner paths only). Safe for the `html` attribute in `h()`. */

export const ICON = {
  all: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  needs: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/>',
  blocked: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  stale: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  parked: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  work: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2"/>',
  client: '<path d="M4 20c1-4 4-6 8-6s7 2 8 6"/><circle cx="12" cy="8" r="4"/>',
  personal: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
} as const;

export const KIND = {
  project: '<path d="M4 7h6l2 2h8v9H4z"/>',
  chat: '<path d="M5 5h14v10H10l-5 4z"/>',
  repo: '<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="9" r="2"/><path d="M7 8v8M17 11c0 4-10 3-10 5"/>',
} as const;

export const UI = {
  chevron: '<path d="m7 10 5 5 5-5"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14.5 4.5c2-1.5 4.5-1.5 5.5-1.5 0 1-.1 3.5-1.6 5.5L12 15l-3-3z"/><path d="M9 12 6 11l2.5-3H12M12 15l1 3 3-2.5V12"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
} as const;

/**
 * Priority artwork. Gradient ids must be unique per document, so each placement passes its own
 * prefix (the cards and the icon rail render the same art side by side).
 */
export function cardArt(index: number, prefix: string): string {
  const id = `${prefix}${index}`;
  const art = [
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7a07c"/><stop offset="1" stop-color="#e9a3b8"/></linearGradient></defs><path d="M12 2.5l2.6 6.1 6.6.6-5 4.4 1.5 6.5L12 16.7l-5.7 3.4 1.5-6.5-5-4.4 6.6-.6z" fill="url(#${id})"/>`,
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a5e8"/><stop offset="1" stop-color="#f7c2a8"/></linearGradient></defs><rect x="3" y="3" width="13" height="13" rx="3.5" fill="url(#${id})" opacity=".9"/><rect x="8" y="8" width="13" height="13" rx="3.5" fill="url(#${id})" opacity=".6"/>`,
    `<defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#e9a3b8"/><stop offset="1" stop-color="#b9a5e8"/></linearGradient></defs><circle cx="12" cy="12" r="9" fill="url(#${id})" opacity=".85"/><circle cx="12" cy="12" r="4" fill="#fff" opacity=".7"/>`,
  ];
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${art[index % art.length]}</svg>`;
}
