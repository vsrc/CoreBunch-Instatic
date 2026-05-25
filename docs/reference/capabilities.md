# Capabilities

The full catalog of `CoreCapability` strings, what each grants, which role gets them by default, and how to add a new capability.

For the broader auth flow (sessions, MFA, step-up), see [docs/features/auth-and-access.md](../features/auth-and-access.md). This page is the capability matrix and the "how do I add one?" cookbook.

---

## TL;DR

- Defined as a closed TypeBox literal union in `server/auth/capabilities.ts`. **19 capabilities.**
- Handlers gate on capability, not on role: `requireCapability(req, db, 'site.read')`.
- The Owner role gets all 19, force-resynced on every server boot.
- Adding a capability: append the literal in two arrays (`CoreCapabilitySchema` + `CORE_CAPABILITIES`), wire `requireCapability(...)` at the gate point, optionally extend the Admin / Client default sets.
- Custom roles editable in the Roles admin page (Owner-only `roles.manage`).

---

## The 19 core capabilities

### Read

| Capability         | Grants                                                              | Roles            |
|--------------------|---------------------------------------------------------------------|------------------|
| `dashboard.read`   | Open the Dashboard workspace                                        | Owner, Admin, Client |
| `site.read`        | Open the Site workspace; view pages, VCs, classes                   | Owner, Admin, Client |

### Site editing (three-way split)

| Capability               | Grants                                                              | Roles         |
|--------------------------|---------------------------------------------------------------------|---------------|
| `site.structure.edit`    | Add / remove / move / rename nodes; manage pages, VCs, classes      | Owner, Admin  |
| `site.content.edit`      | Modify content props (text, image src/alt, link href) on existing nodes — no structure or style edits | Owner, Admin, Client |
| `site.style.edit`        | Modify CSS classes, style overrides, breakpoints, framework tokens  | Owner, Admin  |

`SITE_WRITE_CAPABILITIES` (in `capabilities.ts`) is the convenience set `['site.structure.edit', 'site.content.edit', 'site.style.edit']` — used by the site save handler.

### Page publishing

| Capability       | Grants                                  | Roles         |
|------------------|-----------------------------------------|---------------|
| `pages.edit`     | Edit page metadata (title, slug, ...)   | Owner, Admin  |
| `pages.publish`  | Publish / unpublish pages               | Owner, Admin  |

### Content (postType rows)

| Capability                | Grants                                                              | Roles         |
|---------------------------|---------------------------------------------------------------------|---------------|
| `content.create`          | Create new draft postType rows                                      | Owner, Admin  |
| `content.edit.own`        | Edit rows where `author_user_id = me`                               | Owner, Admin  |
| `content.edit.any`        | Edit any row                                                        | Owner, Admin  |
| `content.publish.own`     | Publish own rows                                                    | Owner, Admin  |
| `content.publish.any`     | Publish any row                                                     | Owner, Admin  |
| `content.manage`          | Full content admin — manage tables, fields, all rows                | Owner, Admin  |

The `own / any` split is the standard CMS workflow: a contributor can edit/publish their own posts; an editor (`content.edit.any`, `content.publish.any`) can manage everyone's.

### Media

| Capability       | Grants                                                              | Roles         |
|------------------|---------------------------------------------------------------------|---------------|
| `media.manage`   | Open the Media workspace; upload, edit, delete, migrate, manage adapters | Owner, Admin |

### Runtime

| Capability         | Grants                                                              | Roles         |
|--------------------|---------------------------------------------------------------------|---------------|
| `runtime.manage`   | Edit `package.json` site dependencies, trigger `bun install`         | Owner, Admin  |

### Plugins

| Capability         | Grants                                                              | Roles         |
|--------------------|---------------------------------------------------------------------|---------------|
| `plugins.manage`   | Install, enable, disable, update, uninstall plugins; edit plugin settings | Owner, Admin |

### Users + roles

| Capability       | Grants                                                              | Roles                                  |
|------------------|---------------------------------------------------------------------|----------------------------------------|
| `users.manage`   | Create, edit, delete, suspend users; assign roles                   | Owner, Admin                           |
| `roles.manage`   | Create, edit, delete custom roles; assign capabilities to roles     | **Owner only.** Admin does not get this. |

`roles.manage` is **owner-only by design** — only the installation owner edits capability grants. Admins manage everything else but can't grant themselves new capabilities.

### Audit

| Capability       | Grants                                                              | Roles         |
|------------------|---------------------------------------------------------------------|---------------|
| `audit.read`     | Read the audit log; see the Dashboard Activity widget               | Owner, Admin  |

---

## Roles

Four built-in `SYSTEM_ROLES`:

| Role     | id        | Capabilities                                                                 | Special     |
|----------|-----------|------------------------------------------------------------------------------|-------------|
| Owner    | `owner`   | All 19 (`CORE_CAPABILITIES`)                                                 | Owner-only `roles.manage`. **Force-resynced on every boot** by `syncSystemRoles(db)`. |
| Admin    | `admin`   | All 19 except `roles.manage`                                                 | Editable    |
| Client   | `client`  | `dashboard.read`, `site.read`, `site.content.edit`                           | Editable    |
| Member   | `member`  | (none)                                                                       | Editable    |

A new capability added to the codebase appears immediately on the Owner role (boot-time resync). Existing **custom** roles don't auto-update — users grant the new capability via the Roles admin page if they want it.

---

## Plugin permissions vs. core capabilities

Don't confuse them:

- **Core capabilities** (this doc) govern **what a logged-in human user can do in the admin**. Stored on `users.role`.
- **Plugin permissions** govern **what a plugin's code can do via the SDK**. Declared in `plugin.json`, approved at install. See [docs/features/plugin-system.md](../features/plugin-system.md).

A plugin route handler can additionally gate on a core capability:

```ts
api.cms.routes.get('/admin-data', 'content.manage', handler)
//                                ^^^^^^^^^^^^^^^^^ — required user capability
```

The route is callable by users who have `content.manage`. Plugin permission (`cms.routes`) controls whether the plugin can register the route at all; core capability controls who can call it.

---

## Handler gates

The canonical pattern is in `server/auth/authz.ts`. Three helpers:

```ts
requireAuthenticatedUser(req, db)                        // any logged-in user
requireCapability(req, db, 'site.read')                  // one capability
requireAnyCapability(req, db, SITE_WRITE_CAPABILITIES)   // any of a set
```

Each returns `AuthUser | Response`. The handler checks `instanceof Response` and returns early on auth failure.

Step-up-gated actions:

```ts
requireStepUp(req, db)        // re-auth within last 15 minutes
```

See [docs/features/auth-and-access.md](../features/auth-and-access.md) for the full step-up flow.

---

## Cookbook

### Gate a handler

```ts
import { requireCapability } from '../../auth/authz'

if (req.method === 'GET') {
  const user = await requireCapability(req, db, 'audit.read')
  if (user instanceof Response) return user
  // … fetch + return audit events
}
```

### Gate the UI

The admin reads `currentUser.capabilities` from `/admin/api/cms/me`:

```ts
import { useAdminSession } from '@admin/session'

function AuditMenuItem() {
  const { user } = useAdminSession()
  if (!user.capabilities.includes('audit.read')) return null
  return <Link to="/admin/audit">Audit log</Link>
}
```

For workspace-level gating, `canAccessWorkspace(user, section)` is the single source of truth (`src/admin/access.ts`).

### Add a new capability

1. **Append** the literal to `CoreCapabilitySchema` and `CORE_CAPABILITIES` in `server/auth/capabilities.ts`:
   ```ts
   const CoreCapabilitySchema = Type.Union([
     // ...
     Type.Literal('analytics.read'),
   ])
   const CORE_CAPABILITIES: CoreCapability[] = [
     // ...
     'analytics.read',
   ]
   ```
2. If it belongs to an existing default role, add it to `adminCapabilities` (or `clientCapabilities`):
   ```ts
   const adminCapabilities: CoreCapability[] = CORE_CAPABILITIES.filter(c => c !== 'roles.manage')
   ```
   (Filtering out only `roles.manage` means Admin auto-gets the new one.)
3. Use it at the gate point:
   ```ts
   const user = await requireCapability(req, db, 'analytics.read')
   if (user instanceof Response) return user
   ```
4. The Owner role auto-syncs on next boot via `syncSystemRoles(db)` — no migration needed for existing Owners.
5. Existing **custom roles** will NOT have the new capability until users grant it through the Roles admin page.
6. Update this doc (table + adjacent docs) so agents and humans can find the new capability.

### Add a custom role

Owner-only (`roles.manage`). Admin → Roles → New role.

```ts
{
  id:           'editor-content-only',
  name:         'Content editor',
  description:  'Can manage all content rows but not site structure.',
  capabilities: ['dashboard.read', 'site.read', 'content.create', 'content.edit.any', 'content.publish.any', 'media.manage'],
}
```

Saved to the `roles` table with `capabilities_json: CoreCapability[]`. Assigned to users via Admin → Users.

### Check capability without responding

```ts
import { userHasCapability, userHasAnyCapability } from '@auth/authz'

if (userHasCapability(user, 'audit.read')) { /* show menu */ }
if (userHasAnyCapability(user, SITE_WRITE_CAPABILITIES)) { /* allow save */ }
```

---

## Forbidden patterns

| Pattern                                                              | Use instead                                              |
|----------------------------------------------------------------------|----------------------------------------------------------|
| `user.role === 'admin'` to gate                                      | `userHasCapability(user, 'media.manage')`                |
| Hand-rolling a capability check (`user.capabilities.includes(...)`) | `userHasCapability` / `requireCapability`                |
| Granting `roles.manage` to non-Owner roles                           | Owner-only by design. Don't expand.                      |
| Skipping the Owner auto-sync (`syncSystemRoles(db)`) in tests        | Tests should call it to set up a realistic state         |
| Adding a "permission" string outside the closed union                | Append to `CoreCapabilitySchema` first; the type catches typos |
| Per-route ad-hoc auth that doesn't go through `requireCapability`    | Always use the helpers — gates aren't optional           |

---

## Related

- [docs/features/auth-and-access.md](../features/auth-and-access.md) — sessions, MFA, step-up, the auth funnel
- [docs/features/plugin-system.md](../features/plugin-system.md) — plugin permissions (separate from core capabilities)
- [docs/server.md](../server.md) — handler patterns
- Source-of-truth files:
  - `server/auth/capabilities.ts` — `CoreCapabilitySchema`, `CORE_CAPABILITIES`, `SYSTEM_ROLES`, `SITE_WRITE_CAPABILITIES`
  - `server/auth/authz.ts` — `requireCapability`, `requireAnyCapability`, `userHasCapability`
  - `server/repositories/roles.ts` — role persistence + `syncSystemRoles`
  - `src/admin/access.ts` — `canAccessWorkspace`, `firstAccessibleWorkspace`
  - `server/handlers/cms/roles.ts` — `/admin/api/cms/roles` (gated by `roles.manage`)
