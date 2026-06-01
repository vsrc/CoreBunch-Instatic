# CMS-Native Form Modules Design

This spec defines first-party form modules for the visual site editor: pure HTML nodes on the canvas, CMS-native submissions into `data_rows`, and a hardened public submission endpoint.

## TL;DR

- Forms are CMS-native by default: `base.form` targets a `data` table and creates one `data_rows` row per valid submission.
- Form controls are pure primitive modules (`label`, `input`, `textarea`, `select`, `option`, `checkbox`, `radio`, `submit`, `form-message`), not hidden subfields inside one large module.
- Presets insert ordinary nodes only; they never create a private form-builder model.
- The editor infers relationships from tree structure, then exposes explicit overrides in the Properties panel.
- CMS-native submissions require the public form runtime, a short-lived submit challenge, signed published-form metadata, server-side validation, rate limits, honeypot/timing checks, and payload caps.
- Post-submit actions run after the row is saved; action failures do not delete the durable submission by default.

## Product Model

A form is an authored page-tree node with a submission target. In CMS-native mode, the target must be a `data_tables` row with `kind: 'data'`. Pages, posts, and components are never public-write targets.

Each form control may bind to a table field. The binding defines the storage field and seeds the control's default name, id, type, required state, and validation. A control can further tighten browser-facing validation without weakening the server's table/schema validation.

The public form endpoint treats every request as hostile. The browser submits form id/token and values; the server loads the published form snapshot and decides the target table, field mapping, validation, and post-submit actions. Client-provided table ids, action lists, or field metadata are ignored.

## Modules

The first version adds these first-party modules under `src/modules/base/`:

- `base.form`: semantic `<form>`, CMS-native settings, target table id, success behavior, honeypot/timing/rate-limit settings, post-submit action configuration.
- `base.label`: semantic `<label>`, auto or explicit target control.
- `base.input`: text-like input types plus file/hidden placeholders for future upload support.
- `base.textarea`: multi-line text control.
- `base.select`: semantic `<select>`.
- `base.option`: semantic `<option>`.
- `base.option-group`: semantic `<optgroup>`.
- `base.checkbox`: semantic checkbox input.
- `base.radio`: semantic radio input.
- `base.submit`: semantic submit button.
- `base.form-message`: form status surface for pending, success, error, and validation messages.

Later modules can add `base.fieldset`, `base.legend`, `base.output`, `base.progress`, `base.meter`, and richer upload controls without changing the core submission contract.

## Editor UX

Dropping a `base.form` asks the author to pick an existing `data` table or create a new one. Dropping a control inside a form asks the author to bind an existing field or create a matching field inline. Presets such as "Email field" and "Signup form" perform the same operations but insert ordinary nodes.

Relationships are inferred from tree structure:

- A label targets the next form control in the same form/tree region.
- A control inherits the nearest ancestor form unless it explicitly targets another form.
- A submit button inherits the nearest ancestor form unless it explicitly targets another form.

The Properties panel shows inferred relationships and provides explicit overrides. It warns when a control is unbound, a name is duplicated, a label has no target, a control is outside a form, a submit has no form, or the bound table schema has drifted from the authored controls.

## Validation

Validation is combined:

- The bound `DataField` seeds the control type and required/default constraints.
- The control can add stricter native validation props such as `min`, `max`, `minLength`, `maxLength`, `pattern`, and custom messages.
- The browser receives native validation attributes for immediate feedback.
- The server validates against the published form snapshot and target table schema. Unknown fields and type mismatches are rejected.

## Public Runtime

CMS-native forms require a small same-origin runtime. The runtime is only included on pages that contain CMS-native forms. It:

- Fetches a short-lived submit challenge when each CMS-native form attaches in the browser.
- Intercepts submit and posts to the public form endpoint.
- Manages pending, success, and error state.
- Updates `base.form-message` nodes associated with the submitted form.

Published HTML remains clean semantic HTML. The runtime is a progressive behavior layer for secure CMS-native persistence; markup-only/custom-action forms can still work without it.

## Security

The public endpoint must not be treated as protected by obscurity. A real visitor can submit a form, so bots can inspect the page and mimic requests. The endpoint uses layered abuse resistance:

- Same-origin `Origin` and Fetch Metadata checks are required for CMS-native form POSTs; missing-origin browser-style submissions are rejected.
- A server-issued, short-lived submit challenge is mandatory.
- Published form metadata is signed and tied to form id, page id, publish version, schema hash, and endpoint.
- The server loads the published form snapshot and ignores client-provided table/action mapping.
- Rate limits apply per IP, per form, and per field fingerprint.
- Honeypot and minimum-fill-time checks reject or quarantine obvious bot submissions.
- Payload size, field count, string length, and file limits are enforced before persistence.
- Suspicious submissions can be stored as quarantined/spam rows instead of normal rows.
- Post-submit actions have their own limits so spam cannot amplify through email/webhooks.

## Submission Pipeline

1. Runtime fetches a submit challenge for the published form when the form attaches.
2. Visitor submits values to the public endpoint.
3. Endpoint validates origin, Fetch Metadata, method, content type, payload size, signed form token, and challenge.
4. Endpoint loads the published form snapshot and target `data` table.
5. Endpoint validates values against the snapshot, table fields, and per-control overrides.
6. Endpoint creates one `data_rows` row.
7. Endpoint runs configured post-submit actions in order.
8. Endpoint returns a typed success/error envelope to the runtime.

The row is the durable record. Action failures are logged and surfaced but do not delete the row by default.

## Related

- `docs/features/modules.md`
- `docs/features/content-storage.md`
- `docs/features/data-workspace.md`
- `docs/features/publisher.md`
- `src/core/data/schemas.ts`
- `server/repositories/data/`
- `server/publish/publicRouter.ts`
