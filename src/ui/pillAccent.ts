/**
 * pillAccent — deterministic accent token for tinted pills.
 *
 * Uses the first meaningful alphanumeric character in the input string as the
 * accent key, so selector punctuation like `.`, `#`, and `::` does not collapse
 * unrelated labels into punctuation-led buckets. Purely presentational; the
 * accent has no semantic meaning.
 */

const LETTER_ACCENTS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
] as const
const DIGIT_ACCENTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

const PILL_ACCENTS = [...LETTER_ACCENTS, ...DIGIT_ACCENTS] as const
const PILL_ACCENT_BY_CHAR = new Map<string, PillAccent>(
  PILL_ACCENTS.map((accent) => [accent, accent]),
)
const MEANINGFUL_ACCENT_CHAR_RE = /[a-z0-9]/i

export type PillAccent = typeof PILL_ACCENTS[number]

function firstMeaningfulAccentChar(name: string): string {
  const trimmed = name.trim().toLowerCase()
  for (const char of trimmed) {
    if (MEANINGFUL_ACCENT_CHAR_RE.test(char)) return char
  }
  return trimmed[0] ?? ''
}

export function pillAccent(name: string): PillAccent {
  const accentChar = firstMeaningfulAccentChar(name)
  return PILL_ACCENT_BY_CHAR.get(accentChar) ?? PILL_ACCENTS[0]
}
