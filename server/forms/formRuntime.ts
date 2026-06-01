import { issuePublicFormPageToken } from './challenge'

export const FORM_RUNTIME_PATH = '/_pb/form-runtime.js'

const CSP_META_PATTERN = /<meta http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/i
const CMS_FORM_PATTERN = /<form\b(?=[^>]*\bdata-pb-form-mode=(["'])cms\1)(?=[^>]*\bdata-pb-form-id=(["'])[^"']+\2)[^>]*>/i
const CMS_FORM_TAG_PATTERN = /<form\b(?=[^>]*\bdata-pb-form-mode=(["'])cms\1)(?=[^>]*\bdata-pb-form-id=(["'])[^"']+\2)[^>]*>/gi

export const FORM_RUNTIME_JS = `(() => {
  const script = document.querySelector('script[data-pb-form-runtime]');
  const pageId = script ? script.getAttribute('data-pb-page-id') || '' : '';
  const forms = document.querySelectorAll('form[data-pb-form-mode="cms"][data-pb-form-id]');

  for (const form of forms) attachForm(form);

  function attachForm(form) {
    if (form.__pbFormRuntimeAttached) return;
    form.__pbFormRuntimeAttached = true;
    connectLabels(form);
    prepareMessages(form);
    prefetchChallenge(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitForm(form);
    });
  }

  async function submitForm(form) {
    const formId = form.getAttribute('data-pb-form-id') || '';
    const pageToken = form.getAttribute('data-pb-page-token') || '';
    if (!formId || !pageId || !pageToken) {
      setState(form, 'error', 'This form is missing its published form link.');
      return;
    }

    setBusy(form, true);
    setState(form, 'pending', 'Sending...');

    try {
      const challenge = await takeChallenge(form);
      await postJson('/_pb/form/submit', {
        pageId,
        formId,
        token: challenge.token,
        challenge: challenge.challenge,
        values: collectValues(form),
      });

      const redirectUrl = form.getAttribute('data-pb-success-redirect') || '';
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      setState(form, 'success', form.getAttribute('data-pb-success-message') || 'Thanks. Your submission was received.');
      if (form.getAttribute('data-pb-reset-on-success') !== 'false') form.reset();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Form submission failed.';
      setState(form, 'error', message);
    } finally {
      setBusy(form, false);
      if (form.isConnected) prefetchChallenge(form);
    }
  }

  function prefetchChallenge(form) {
    if (form.__pbFormChallenge || form.__pbFormChallengePromise) return form.__pbFormChallengePromise;
    const request = requestChallenge(form)
      .then((challenge) => {
        form.__pbFormChallenge = challenge;
        form.__pbFormChallengePromise = null;
        return challenge;
      })
      .catch((err) => {
        form.__pbFormChallenge = null;
        form.__pbFormChallengePromise = null;
        throw err;
      });
    form.__pbFormChallengePromise = request;
    request.catch(() => {});
    return request;
  }

  async function takeChallenge(form) {
    const existing = form.__pbFormChallenge;
    if (existing && challengeIsFresh(existing)) {
      form.__pbFormChallenge = null;
      return existing;
    }
    form.__pbFormChallenge = null;
    const challenge = await prefetchChallenge(form);
    form.__pbFormChallenge = null;
    return challenge;
  }

  function requestChallenge(form) {
    const formId = form.getAttribute('data-pb-form-id') || '';
    const pageToken = form.getAttribute('data-pb-page-token') || '';
    if (!formId || !pageId || !pageToken) {
      return Promise.reject(new Error('This form is missing its published form link.'));
    }
    return postJson('/_pb/form/challenge', { pageId, formId, pageToken });
  }

  function challengeIsFresh(challenge) {
    const expiresAt = Date.parse(challenge && challenge.expiresAt ? challenge.expiresAt : '');
    return !Number.isFinite(expiresAt) || Date.now() < expiresAt - 10000;
  }

  async function postJson(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(errorMessage(body));
    return body;
  }

  async function readJson(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_err) {
      return { error: 'Form submission failed.' };
    }
  }

  function errorMessage(body) {
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      return body.errors.map((entry) => entry && entry.message ? entry.message : '').filter(Boolean).join('\\n') || 'Invalid form values.';
    }
    return typeof body.error === 'string' && body.error ? body.error : 'Form submission failed.';
  }

  function collectValues(form) {
    const values = {};
    const data = new FormData(form);
    for (const [name, value] of data.entries()) {
      const normalized = typeof value === 'string' ? value : value.name;
      if (values[name] === undefined) {
        values[name] = normalized;
      } else if (Array.isArray(values[name])) {
        values[name].push(normalized);
      } else {
        values[name] = [values[name], normalized];
      }
    }
    return values;
  }

  function connectLabels(form) {
    const elements = Array.from(form.querySelectorAll('label[data-pb-label-target="auto"], input:not([type="hidden"]):not([data-pb-honeypot]), textarea, select'));
    let counter = 0;
    for (const element of elements) {
      if (element.tagName.toLowerCase() !== 'label') continue;
      const index = elements.indexOf(element);
      const control = elements.slice(index + 1).find((candidate) => candidate.tagName.toLowerCase() !== 'label');
      if (!control) continue;
      if (!control.id) {
        counter += 1;
        control.id = 'pb-form-' + safeToken(form.getAttribute('data-pb-form-id') || 'form') + '-' + counter;
      }
      element.setAttribute('for', control.id);
    }
  }

  function safeToken(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'form';
  }

  function setBusy(form, busy) {
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    const buttons = form.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const button of buttons) {
      if (busy) {
        if (button.disabled) button.setAttribute('data-pb-was-disabled', 'true');
        button.disabled = true;
      } else if (!button.hasAttribute('data-pb-was-disabled')) {
        button.disabled = false;
      } else {
        button.removeAttribute('data-pb-was-disabled');
      }
    }
  }

  function prepareMessages(form) {
    for (const message of formMessages(form)) {
      if (!message.hasAttribute('data-pb-default-text')) {
        message.setAttribute('data-pb-default-text', message.textContent || '');
      }
      const kind = message.getAttribute('data-pb-form-message') || 'status';
      if (kind === 'success' || kind === 'error') message.hidden = true;
    }
  }

  function setState(form, state, text) {
    form.setAttribute('data-pb-form-state', state);
    const messages = formMessages(form);
    const messageKind = state === 'error' ? 'error' : state === 'success' ? 'success' : 'status';
    const hasExactMessage = messages.some((message) => (message.getAttribute('data-pb-form-message') || 'status') === messageKind);

    for (const message of messages) {
      if (!message.hasAttribute('data-pb-default-text')) {
        message.setAttribute('data-pb-default-text', message.textContent || '');
      }
      const kind = message.getAttribute('data-pb-form-message') || 'status';
      const shouldShow = kind === messageKind || (!hasExactMessage && kind === 'status');
      if (!shouldShow) {
        message.hidden = true;
        continue;
      }
      message.textContent = text || message.getAttribute('data-pb-default-text') || '';
      message.hidden = !message.textContent;
    }
  }

  function formMessages(form) {
    const formId = form.getAttribute('data-pb-form-id') || '';
    return Array.from(document.querySelectorAll('[data-pb-form-message]')).filter((message) => {
      return form.contains(message) || (formId && message.getAttribute('data-pb-form-id') === formId);
    });
  }
})();`

export function pageHasCmsNativeForm(html: string): boolean {
  return CMS_FORM_PATTERN.test(html)
}

export function injectFormRuntime(html: string, pageId: string): string {
  if (!pageHasCmsNativeForm(html) || html.includes('data-pb-form-runtime')) return html
  const withPageTokens = stampFormPageTokens(html, pageId)
  const script = `<script src="${FORM_RUNTIME_PATH}" defer data-pb-form-runtime data-pb-page-id="${escapeAttr(pageId)}"></script>`
  const withScript = withPageTokens.includes('</body>')
    ? withPageTokens.replace('</body>', `${script}\n</body>`)
    : `${withPageTokens}\n${script}`
  return relaxScriptCsp(withScript)
}

export function serveFormRuntimeAsset(): Response {
  return new Response(FORM_RUNTIME_JS, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}

function relaxScriptCsp(html: string): string {
  return html.replace(CSP_META_PATTERN, (full, content: string) => {
    return full.replace(content, appendOrSetCspDirective(content, 'script-src', ["'self'"]))
  })
}

function stampFormPageTokens(html: string, pageId: string): string {
  return html.replace(CMS_FORM_TAG_PATTERN, (tag) => {
    if (/\bdata-pb-page-token=/.test(tag)) return tag
    const formId = attrValue(tag, 'data-pb-form-id')
    if (!formId) return tag
    const token = issuePublicFormPageToken({ pageId, formId })
    return tag.replace(/<form\b/i, `<form data-pb-page-token="${escapeAttr(token)}"`)
  })
}

function attrValue(tag: string, name: string): string {
  const pattern = new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i')
  const match = tag.match(pattern)
  return match?.[2] ?? ''
}

function appendOrSetCspDirective(policy: string, directive: string, sources: string[]): string {
  const pattern = new RegExp(`${directive}\\s+[^;]*;`, 'i')
  if (!pattern.test(policy)) {
    const trimmed = policy.trim().replace(/;\s*$/, '')
    return `${trimmed}; ${directive} ${sources.join(' ')};`
  }
  return policy.replace(pattern, (existing) => {
    const existingValue = existing
      .replace(new RegExp(`^${directive}\\s+`, 'i'), '')
      .replace(/;\s*$/, '')
    const sourceSet = new Set(existingValue.split(/\s+/).filter((part) => part && part !== "'none'"))
    for (const source of sources) sourceSet.add(source)
    return `${directive} ${[...sourceSet].join(' ')};`
  })
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
