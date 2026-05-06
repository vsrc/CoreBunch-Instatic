/**
 * pillAccent — deterministic accent token for tinted pills.
 *
 * Picks one of four rail-tint accents (`mint`, `lilac`, `sky`, `peach`) from a
 * stable hash of the input string so the same name always renders in the same
 * tint across the editor (Layers panel tag badges, ClassPicker class pills,
 * etc.). Purely presentational — the accent has no semantic meaning, it just
 * gives the editor's tinted chips a consistent yet varied look without
 * forcing the user to pick a color.
 *
 * The CSS that consumes the accent ships per-surface (each module that uses
 * pills declares its own `[data-accent="…"]` rules) so visual treatment can
 * differ (e.g. ClassPicker chips have hover/active states; Tree badges are
 * static read-only labels) — only the accent label is shared.
 */

export type PillAccent = 'mint' | 'lilac' | 'sky' | 'peach'

const PILL_ACCENTS: readonly PillAccent[] = ['mint', 'lilac', 'sky', 'peach']

export function pillAccent(name: string): PillAccent {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0
  }
  return PILL_ACCENTS[Math.abs(h) % PILL_ACCENTS.length]!
}
