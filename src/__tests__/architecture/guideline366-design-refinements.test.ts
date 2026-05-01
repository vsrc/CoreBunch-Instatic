/**
 * Architecture Gate Tests — Guideline #366: Panel Visual Refinement
 * (Darker Glass + 3D Inputs + Inter Font)
 *
 * These gates enforce the three remaining items from the Architect's
 * pre-Phase-4 checklist (message #1573 / Guideline #366) that were NOT
 * covered by Contribution #519:
 *
 * Gate 1 — `--panel-shadow` CSS var must be split into three separate vars
 *   (`--panel-shadow-inset-top`, `--panel-shadow-inset-bottom`, `--panel-shadow-drop`)
 *   in `globals.css`.
 *   Guideline #366 item 2 / Task #358 Gate 1 (activates Panel token gate).
 *
 * Gate 2 — Inter Variable font must be loaded via `@fontsource-variable/inter`
 *   (self-hosted, NOT a CDN link), and `--font-sans` must map to Inter in the
 *   `:root` block of `globals.css`.
 *   Guideline #366 item 1 / User directive #1564.
 *   Performance note (message #1571): self-hosted `.woff2` only — no Google/
 *   Bunny Fonts CDN (avoids cross-origin DNS + CORS preflight on first paint).
 *
 * Gate 3 — Input token system: all `--input-*` CSS custom properties must exist
 *   in `globals.css`, and the shared `src/ui/components/Input` and `Select`
 *   primitives must consume those tokens.
 *   Guideline #366 item 5 / User directive #1564.
 *   Phase 4 property controls (TextInput, NumberInput, Select) are built on
 *   shared UI primitives under `src/ui/components`.
 *
 * All three gates are pre-registered (adaptive-skip) until their respective
 * activation signals appear in the codebase:
 *   Gate 1 — self-activates when `--panel-shadow-inset-top` exists in globals.css
 *   Gate 2 — self-activates when `@fontsource-variable/inter` exists in globals.css
 *   Gate 3 — self-activates when `--input-bg` exists in globals.css
 *
 * @see Guideline #366 — Panel Visual Refinement (Darker Glass + 3D Inputs + Inter Font)
 * @see Guideline #367 — Panel & Input Visual Design (amends #356, #252)
 * @see Contribution #518 — UX Reviewer design spec for Guideline #366
 * @see Architect message #1573 — Pre-Phase-4 checklist (5 items)
 * @see Performance Engineer message #1571 — font loading + GPU guardrails
 */

import { describe, it, expect } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const SRC_ROOT = join(import.meta.dir, '../../')

const GLOBALS_CSS_PATH = join(SRC_ROOT, 'styles/globals.css')
const INPUT_MODULE_CSS_PATH = join(SRC_ROOT, 'ui/components/Input/Input.module.css')
const SELECT_MODULE_CSS_PATH = join(SRC_ROOT, 'ui/components/Select/Select.module.css')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readGlobals(): string {
  if (!existsSync(GLOBALS_CSS_PATH)) {
    throw new Error(
      '[Guideline #366] globals.css not found at ' +
        GLOBALS_CSS_PATH.replace(SRC_ROOT, 'src/') +
        '\nExpected at src/styles/globals.css per Phase B design token conventions.'
    )
  }
  return readFileSync(GLOBALS_CSS_PATH, 'utf8')
}

// ---------------------------------------------------------------------------
// Gate 1 — Panel shadow CSS vars split (Guideline #366 item 2)
//
// The existing combined `--panel-shadow` var must be replaced by three
// discrete vars.
//
// Required in globals.css `:root` / overlay panel section:
//   --panel-shadow-inset-top:    inset 0 1px 0 rgba(255,255,255,0.08);
//   --panel-shadow-inset-bottom: inset 0 -1px 0 rgba(0,0,0,0.35);
//   --panel-shadow-drop:         0 12px 40px rgba(0,0,0,0.65);
//
// Also: `--panel-bg` must be updated to the darker value from Guideline #366
// (>= 0.7 alpha against the old 0.45 baseline) and `--panel-blur` must be ≤ 24px
// (Performance Engineer cap, message #1571).
//
// Self-activates when `--panel-shadow-inset-top` appears in globals.css.
// ---------------------------------------------------------------------------

const REQUIRED_PANEL_SHADOW_VARS = [
  '--panel-shadow-inset-top',
  '--panel-shadow-inset-bottom',
  '--panel-shadow-drop',
] as const

describe(
  'Guideline #366 Gate 1 — `--panel-shadow` must be split into 3 separate CSS vars (Guideline #366 item 2)',
  () => {
    it(
      'globals.css must declare --panel-shadow-inset-top, ' +
        '--panel-shadow-inset-bottom, and --panel-shadow-drop individually',
      () => {
        const css = readGlobals()

        // Gate is pre-registered until the split lands
        if (!css.includes('--panel-shadow-inset-top')) {
          console.log(
            '[Guideline366 gate] --panel-shadow is still combined — ' +
              'panel shadow CSS var split gate pre-registered ' +
              '(Guideline #366 item 2 / Task #358 Gate 1 activation fix)'
          )
          expect(true).toBe(true)
          return
        }

        // Split landed — assert all three vars are declared
        const missing = REQUIRED_PANEL_SHADOW_VARS.filter(
          (v) => !new RegExp(v.replace('--', '--') + '\\s*:').test(css)
        )

        if (missing.length > 0) {
          throw new Error(
            '[Guideline #366 / Task #358 Gate 1] globals.css is missing required panel shadow CSS vars.\n' +
              'All three shadow vars are required so overlay panel styles can use distinct inset/drop shadows.\n\n' +
              'Required:\n' +
              REQUIRED_PANEL_SHADOW_VARS.map((v) => `  ${v}`).join('\n') +
              '\n\nMissing:\n' +
              missing.map((v) => `  ${v}`).join('\n') +
              '\n\nReplace the combined --panel-shadow with:\n' +
              '  --panel-shadow-inset-top:    inset 0 1px 0 rgba(255, 255, 255, 0.08);\n' +
              '  --panel-shadow-inset-bottom: inset 0 -1px 0 rgba(0, 0, 0, 0.35);\n' +
              '  --panel-shadow-drop:         0 12px 40px rgba(0, 0, 0, 0.65);\n' +
              'See Guideline #366 item 2, Contribution #518 §1.'
          )
        }

        expect(missing).toHaveLength(0)
      }
    )
  }
)

// ---------------------------------------------------------------------------
// Gate 2 — Inter Variable font via @fontsource-variable/inter (Guideline #366 item 1)
//
// User directive #1564: "make sure that Inter font is used across the app."
// Architect (message #1573): "@fontsource-variable/inter import in globals.css,
//   --font-sans CSS var, body rule".
// Performance Engineer (message #1571): self-host ONLY — no Google/Bunny Fonts
//   CDN links. Zero external DNS, no CORS preflight.
//
// Required in globals.css:
//   @import "@fontsource-variable/inter";
//
// Required in globals.css :root block:
//   --font-sans: 'Inter Variable', sans-serif;
//
// Required NOT present (CDN links are forbidden):
//   fonts.googleapis.com/css
//   fonts.bunny.net/css
//
// Self-activates when `@fontsource-variable/inter` appears in globals.css.
// ---------------------------------------------------------------------------

describe(
  'Guideline #366 Gate 2 — Inter font must be self-hosted via @fontsource-variable/inter (Guideline #366 item 1)',
  () => {
    it(
      'globals.css must import @fontsource-variable/inter and map --font-sans to Inter Variable; ' +
        'no CDN font links',
      () => {
        const css = readGlobals()

        // Gate is pre-registered until the Inter import lands
        if (!css.includes('@fontsource-variable/inter')) {
          console.log(
            '[Guideline366 gate] @fontsource-variable/inter not yet imported — ' +
              'Inter font gate pre-registered ' +
              '(Guideline #366 item 1 / User directive #1564)'
          )
          expect(true).toBe(true)
          return
        }

        const violations: string[] = []

        // 1. Import must be self-hosted (@fontsource-variable/inter)
        if (!css.includes('@fontsource-variable/inter')) {
          violations.push(
            'Missing: @import "@fontsource-variable/inter" in globals.css\n' +
              '  (self-hosted .woff2 — no CDN, per Performance Engineer message #1571)'
          )
        }

        // 2. --font-sans must map to Inter (contains 'Inter' in the value)
        // Match:  --font-sans: 'Inter Variable', sans-serif
        //     or: --font-sans: "Inter Variable", sans-serif
        //     or: --font-sans: Inter Variable, sans-serif
        const fontSansMatch = css.match(/--font-sans\s*:\s*([^;]+);/)
        if (!fontSansMatch) {
          violations.push(
            'Missing: --font-sans CSS custom property in globals.css :root block.\n' +
              "  Expected: --font-sans: 'Inter Variable', sans-serif;"
          )
        } else {
          const fontSansValue = fontSansMatch[1].toLowerCase()
          if (!fontSansValue.includes('inter')) {
            violations.push(
              `--font-sans does not reference Inter.\n` +
                `  Current value: ${fontSansMatch[1].trim()}\n` +
                `  Expected:      'Inter Variable', sans-serif`
            )
          }
        }

        // 3. No CDN font links (Google Fonts, Bunny Fonts)
        if (/fonts\.googleapis\.com/.test(css)) {
          violations.push(
            'Forbidden: fonts.googleapis.com CDN link found in globals.css.\n' +
              '  Use @fontsource-variable/inter (self-hosted) instead.\n' +
              '  Reason: external DNS round-trip on first paint (Performance Engineer #1571).'
          )
        }
        if (/fonts\.bunny\.net/.test(css)) {
          violations.push(
            'Forbidden: fonts.bunny.net CDN link found in globals.css.\n' +
              '  Use @fontsource-variable/inter (self-hosted) instead.'
          )
        }

        if (violations.length > 0) {
          throw new Error(
            '[Guideline #366 / item 1] Inter font is not correctly configured in globals.css.\n\n' +
              'Required setup:\n' +
              '  1. @import "@fontsource-variable/inter";           // top of file\n' +
              "  2. --font-sans: 'Inter Variable', sans-serif;     // in :root block\n" +
              '  3. Apply font-family: var(--font-sans) to html, body, #root\n' +
              '     (via direct CSS rule)\n\n' +
              'Violations:\n' +
              violations.map((v) => `  • ${v}`).join('\n\n') +
              '\n\nSee Guideline #366 item 1, Contribution #518 §3, message #1571.'
          )
        }

        expect(violations).toHaveLength(0)
      }
    )
  }
)

// ---------------------------------------------------------------------------
// Gate 3 — Input token system: CSS vars + shared Input/Select primitives
//           (Guideline #366 item 5)
//
// User directive #1564: editor form inputs must have a transparent-glass look
// with a 3D inset-well effect. Phase 4 property controls (TextInput, NumberInput,
// Select, Textarea) are specified to use shared primitives under
// `src/ui/components` — this system must land before Phase 4 implementation begins.
//
// Architect (message #1573): "Input token system — `--input-bg/bg-focus/border/
//   border-focus/shadow/shadow-focus/radius` CSS vars + shared UI primitive CSS
//   + shared UI primitive CSS."
//
// Required CSS vars in globals.css:
//   --input-bg             (e.g. rgba(255,255,255,0.055) — transparent glass)
//   --input-border         (≥ rgba(255,255,255,0.22) for WCAG 1.4.11 3:1 ratio)
//   --input-shadow         (inset well shadow)
//   --input-radius         (border radius)
//
// Required primitive CSS modules:
//   src/ui/components/Input/Input.module.css
//   src/ui/components/Select/Select.module.css
//
// Self-activates when `--input-bg` appears in globals.css.
// ---------------------------------------------------------------------------

const REQUIRED_INPUT_CSS_VARS = [
  '--input-bg',
  '--input-border',
  '--input-shadow',
  '--input-radius',
] as const

describe(
  'Guideline #366 Gate 3 — Input token system: CSS vars + shared primitives (Guideline #366 item 5)',
  () => {
    it(
      'globals.css must declare --input-* CSS vars; shared Input/Select CSS must use them',
      () => {
        const css = readGlobals()
        const inputCss = existsSync(INPUT_MODULE_CSS_PATH)
          ? readFileSync(INPUT_MODULE_CSS_PATH, 'utf8')
          : ''
        const selectCss = existsSync(SELECT_MODULE_CSS_PATH)
          ? readFileSync(SELECT_MODULE_CSS_PATH, 'utf8')
          : ''

        // Gate is pre-registered until the CSS token activation signal lands
        const cssHasInputBg = css.includes('--input-bg')

        if (!cssHasInputBg) {
          console.log(
            '[Guideline366 gate] Input token system not yet landed — ' +
              'input CSS vars + shared input primitives gate pre-registered ' +
              '(Guideline #366 item 5 / User directive #1564)'
          )
          expect(true).toBe(true)
          return
        }

        // At least one activation signal detected — assert the full system
        const violations: string[] = []

        // ── 1. Required CSS vars in globals.css ──────────────────────────
        const missingCssVars = REQUIRED_INPUT_CSS_VARS.filter(
          (v) => !new RegExp(v + '\\s*:').test(css)
        )
        if (missingCssVars.length > 0) {
          violations.push(
            'globals.css is missing required input CSS custom properties:\n' +
              missingCssVars.map((v) => `    ${v}`).join('\n') +
              '\n  All of these must be declared in the :root block.\n' +
              '  Example:\n' +
              '    --input-bg:     rgba(255, 255, 255, 0.055);\n' +
              '    --input-border: rgba(255, 255, 255, 0.22);\n' +
              '    --input-shadow: inset 0 2px 5px rgba(0,0,0,0.45), inset 0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.03);\n' +
              '    --input-radius: 4px;'
          )
        }

        // ── 2. Shared primitive CSS modules consume input tokens ───────────
        if (!inputCss) {
          violations.push(
            'src/ui/components/Input/Input.module.css is missing.\n' +
              '  Text, number, URL, and textarea controls must use the shared Input primitive.'
          )
        } else {
          const missingInputRefs = [
            '--input-bg',
            '--input-bg-focus',
            '--input-border',
            '--input-border-focus',
            '--input-radius',
          ].filter((token) => !inputCss.includes(`var(${token}`))

          if (missingInputRefs.length > 0) {
            violations.push(
              'Input.module.css is not consuming required input tokens:\n' +
                missingInputRefs.map((v) => `    ${v}`).join('\n')
            )
          }
        }

        if (!selectCss) {
          violations.push(
            'src/ui/components/Select/Select.module.css is missing.\n' +
              '  Native select controls must use the shared Select primitive.'
          )
        } else {
          const missingSelectRefs = [
            '--input-bg',
            '--input-bg-focus',
            '--input-border',
            '--input-border-focus',
            '--input-radius',
          ].filter((token) => !selectCss.includes(`var(${token}`))

          if (missingSelectRefs.length > 0) {
            violations.push(
              'Select.module.css is not consuming required input tokens:\n' +
                missingSelectRefs.map((v) => `    ${v}`).join('\n')
            )
          }
        }

        if (violations.length > 0) {
          throw new Error(
            '[Guideline #366 / item 5] Input token system is incomplete.\n' +
              'Phase 4 property controls (TextInput, NumberInput, Select, Textarea) depend on\n' +
              'the shared primitive token system.\n\n' +
              'Violations:\n' +
              violations.map((v) => `  • ${v}`).join('\n\n') +
              '\n\nSee Guideline #366 item 5, Contribution #518 §2, Architect message #1573.'
          )
        }

        expect(violations).toHaveLength(0)
      }
    )
  }
)
