/**
 * Image-variant worker pool — end-to-end test.
 *
 * Spawns the real `Bun.Worker`, sends a real image through the protocol,
 * and asserts the worker probes metadata, encodes a BlurHash, and produces
 * one variant per target width smaller than the source. The point of this
 * test is to gate the worker round-trip itself — `mediaVariants.ts` is
 * already covered by `cmsMedia.test.ts` for the upload pipeline.
 *
 * The test fixture is built with the sharp instance on the test thread,
 * NOT through the worker — sharp on the main thread is fine in test code,
 * just not in the production hot path.
 */

import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import {
  isImageVariantOk,
  runImageVariantJob,
} from '../../../server/handlers/cms/imageVariantWorkerHost'

async function fixturePng(width: number, height: number): Promise<ArrayBuffer> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 200, g: 100, b: 50, alpha: 1 },
    },
  }).png().toBuffer()
  // Slice into a fresh ArrayBuffer so the worker takes a clean transferable.
  const ab = new ArrayBuffer(buf.byteLength)
  new Uint8Array(ab).set(buf)
  return ab
}

describe('image-variant worker pool', () => {
  it('returns metadata + BlurHash + variants for a large image', async () => {
    const bytes = await fixturePng(800, 400)
    const response = await runImageVariantJob({
      bytes,
      generateLadder: true,
      targetWidths: [64, 320, 640, 1024],
      webpQuality: 80,
      blurhashConfig: { x: 4, y: 3, sampleWidth: 32, sampleHeight: 32 },
    })

    expect(isImageVariantOk(response)).toBe(true)
    if (!isImageVariantOk(response)) return

    expect(response.width).toBe(800)
    expect(response.height).toBe(400)
    // BlurHash is ~30 chars; we don't lock the exact value because the
    // encoder isn't deterministic across libvips versions for the same
    // input, but length + non-empty is enough to gate the round-trip.
    expect(response.blurHash.length).toBeGreaterThan(10)
    // 64, 320, 640 are < 800; 1024 is skipped (>= source width). So 3
    // variants come back, in ascending order.
    expect(response.variants.map((v) => v.width)).toEqual([64, 320, 640])
    for (const variant of response.variants) {
      expect(variant.bytes.byteLength).toBeGreaterThan(0)
      // Each variant is a fresh ArrayBuffer the host now owns.
      expect(variant.bytes).toBeInstanceOf(ArrayBuffer)
    }
  })

  it('skips the ladder when generateLadder is false (delegate path)', async () => {
    const bytes = await fixturePng(800, 400)
    const response = await runImageVariantJob({
      bytes,
      generateLadder: false,
      targetWidths: [64, 320, 640],
      webpQuality: 80,
      blurhashConfig: { x: 4, y: 3, sampleWidth: 32, sampleHeight: 32 },
    })

    expect(isImageVariantOk(response)).toBe(true)
    if (!isImageVariantOk(response)) return
    // Metadata + BlurHash still produced — those are cheap and always
    // needed (the delegate doesn't supply a BlurHash placeholder, the
    // host needs one for the row).
    expect(response.width).toBe(800)
    expect(response.height).toBe(400)
    expect(response.blurHash.length).toBeGreaterThan(10)
    // But no variant bytes — the delegate will materialise variants on
    // demand at the CDN edge.
    expect(response.variants).toEqual([])
  })

  it('reports failure for non-image bytes', async () => {
    const ab = new ArrayBuffer(16)
    new Uint8Array(ab).set(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    const response = await runImageVariantJob({
      bytes: ab,
      generateLadder: true,
      targetWidths: [64],
      webpQuality: 80,
      blurhashConfig: { x: 4, y: 3, sampleWidth: 32, sampleHeight: 32 },
    })

    expect(response.ok).toBe(false)
    if (response.ok) return
    expect(typeof response.error).toBe('string')
    expect(response.error.length).toBeGreaterThan(0)
  })
})
