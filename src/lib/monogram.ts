/**
 * Deterministic fallback avatars.
 *
 * Card thumbnails are photographs, not glyphs — but a few records genuinely have no
 * photo (a team that has not uploaded a crest). Those fall back to a monogram on a tint
 * derived from the record's id, so a given team always gets the same colour instead of
 * flickering between renders.
 */

/** FNV-1a. Small, stable, and good enough to spread ids across a hue wheel. */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

/** Up to two initials: "Gulberg Gladiators" -> "GG", "Askari XI" -> "AX". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * A muted, readable tint for the given id. Saturation and lightness are fixed so ink
 * text always clears AA on top, whatever hue the hash lands on.
 */
export function tintFor(id: string): string {
  return `hsl(${hash(id) % 360}, 45%, 84%)`;
}
