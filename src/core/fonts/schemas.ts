/**
 * Fonts — Zod schemas and derived types.
 *
 * Schemas are the source of truth. Types are derived via `z.infer<typeof Schema>`.
 * No parallel TypeScript interfaces — schema definitions ARE the contract.
 *
 * Constraint #269: no imports from editor / editor-store here.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// FontSource
// ---------------------------------------------------------------------------

export const FontSourceSchema = z.enum(['google', 'custom'])

export type FontSource = z.infer<typeof FontSourceSchema>

// ---------------------------------------------------------------------------
// FontFile
// ---------------------------------------------------------------------------

/**
 * One downloaded font file.  The `path` must be under `/uploads/fonts/`, end
 * with `.woff2`, and contain no traversal sequences — mirrors `isSafeFontPath`
 * in `validate.ts` (lines ~557–563).
 */
export const FontFileSchema = z.object({
  variant: z.string().min(1),
  subset: z.string().min(1),
  path: z.string().refine(
    (p) =>
      p.startsWith('/uploads/fonts/') &&
      !p.includes('..') &&
      !/[\s"<>\\]/.test(p) &&
      p.endsWith('.woff2'),
    'Font path must start with /uploads/fonts/ and end with .woff2',
  ),
  format: z.literal('woff2'),
})

export type FontFile = z.infer<typeof FontFileSchema>

// ---------------------------------------------------------------------------
// FontEntry
// ---------------------------------------------------------------------------

/**
 * One font installed in the site library.
 * Invalid entries are silently dropped at the SiteFontsSettings level.
 * Mirrors `validateFontEntry` in validate.ts (lines ~575–603).
 */
export const FontEntrySchema = z.object({
  id: z.string().min(1),
  source: FontSourceSchema.catch('google' as const),
  family: z.string().min(1),
  variants: z.array(z.string().min(1)).catch([]),
  subsets: z.array(z.string().min(1)).catch([]),
  /** Invalid font-file entries are silently dropped. */
  files: z.array(z.unknown()).default([]).transform((items) =>
    items.flatMap((item) => {
      const r = FontFileSchema.safeParse(item)
      return r.success ? [r.data] : []
    }),
  ),
  category: z.string().optional(),
  createdAt: z.number().catch(() => Date.now()),
  updatedAt: z.number().catch(() => Date.now()),
})

export type FontEntry = z.infer<typeof FontEntrySchema>

// ---------------------------------------------------------------------------
// SiteFontsSettings
// ---------------------------------------------------------------------------

/**
 * Library of installed fonts for a site.
 * Mirrors `validateSiteFontsSettings` in validate.ts (lines ~605–612).
 */
export const SiteFontsSettingsSchema = z.object({
  items: z.array(z.unknown()).default([]).transform((items) =>
    items.flatMap((item) => {
      const r = FontEntrySchema.safeParse(item)
      return r.success ? [r.data] : []
    }),
  ),
})

export type SiteFontsSettings = z.infer<typeof SiteFontsSettingsSchema>
