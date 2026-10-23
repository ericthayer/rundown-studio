/** FNV-1a 32-bit hex of `text`: a short, stable id for deduping docs and fingerprinting rows. */
export function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++)
        h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
}
