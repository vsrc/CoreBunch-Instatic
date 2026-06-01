import { describe, expect, it } from 'bun:test'
import {
  FORM_RUNTIME_JS,
  FORM_RUNTIME_PATH,
  injectFormRuntime,
  serveFormRuntimeAsset,
} from '../../../server/forms/formRuntime'

const PAGE_WITH_CMS_FORM = `<!doctype html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; worker-src 'none'; style-src 'self'; img-src 'self' data:; connect-src 'self';">
</head>
<body>
<form data-pb-form-mode="cms" data-pb-form-id="contact"></form>
</body>
</html>`

describe('published form runtime', () => {
  it('injects the external runtime and relaxes CSP for CMS-native forms', () => {
    const html = injectFormRuntime(PAGE_WITH_CMS_FORM, 'page-home')

    expect(html).toContain(`src="${FORM_RUNTIME_PATH}"`)
    expect(html).toContain('data-pb-form-runtime')
    expect(html).toContain('data-pb-page-id="page-home"')
    expect(html).toContain('data-pb-page-token=')
    expect(html).toContain("script-src 'self';")
    expect(html).toContain("worker-src 'none';")
  })

  it('does not inject anything when no CMS-native form is present', () => {
    const html = injectFormRuntime(
      PAGE_WITH_CMS_FORM.replace('data-pb-form-mode="cms"', 'data-pb-form-mode="external"'),
      'page-home',
    )

    expect(html).not.toContain(FORM_RUNTIME_PATH)
    expect(html).toContain("script-src 'none';")
  })

  it('is idempotent', () => {
    const once = injectFormRuntime(PAGE_WITH_CMS_FORM, 'page-home')
    const twice = injectFormRuntime(once, 'page-home')

    expect(twice.match(new RegExp(FORM_RUNTIME_PATH, 'g'))?.length).toBe(1)
    expect(twice).toBe(once)
  })

  it('serves the browser runtime as a fixed public asset', async () => {
    const response = serveFormRuntimeAsset()
    const body = await response.text()

    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(body).toContain('/_pb/form/challenge')
    expect(body).toContain('/_pb/form/submit')
    expect(body).toContain('pageToken')
  })

  it('prefetches the submit challenge on attach and reuses it on submit', async () => {
    document.body.innerHTML = `
      <script data-pb-form-runtime data-pb-page-id="page-home"></script>
      <form data-pb-form-mode="cms" data-pb-form-id="contact" data-pb-page-token="page-token">
        <input name="email" value="ai@example.com">
        <button type="submit">Send</button>
        <p data-pb-form-message="status"></p>
      </form>
    `

    const calls: Array<{ path: string; payload: Record<string, unknown> }> = []
    const originalFetch = globalThis.fetch

    ;(globalThis as Record<string, unknown>).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url
      const payload = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ path, payload })

      if (path === '/_pb/form/challenge') {
        return new Response(JSON.stringify({
          token: 'prefetched-token',
          challenge: 'prefetched-challenge',
          expiresAt: '2099-01-01T00:00:00.000Z',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ ok: true, rowId: 'row-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    try {
      new Function(FORM_RUNTIME_JS)()
      await flushRuntime()

      expect(calls.map((call) => call.path)).toEqual(['/_pb/form/challenge'])

      const form = document.querySelector('form')
      expect(form).not.toBeNull()
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await waitForCalls(calls, 2)

      expect(calls[0].path).toBe('/_pb/form/challenge')
      expect(calls[1].path).toBe('/_pb/form/submit')
      expect(calls[1].payload.token).toBe('prefetched-token')
      expect(calls[1].payload.challenge).toBe('prefetched-challenge')
    } finally {
      ;(globalThis as Record<string, unknown>).fetch = originalFetch
      document.body.innerHTML = ''
    }
  })
})

async function flushRuntime(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitForCalls(calls: unknown[], count: number): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (calls.length >= count) return
    await flushRuntime()
  }
}
