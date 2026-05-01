# Production Deployment Architecture Design

## Summary

Page Builder CMS should be deployable as a self-hosted, WordPress-style application without tying the product architecture to Docker Compose. The canonical production artifact will be a prebuilt Docker image that contains the built admin UI, public renderer, API server, and migration/runtime code. Docker Compose remains the default self-hosted VPS recipe, while managed hosts can run the same image with managed Postgres and configured media storage.

This keeps the runtime portable across VPS, Coolify, Railway, Render, Fly.io, DigitalOcean App Platform, and future one-click templates.

## Product Decisions

- The production app is distributed as one Docker image.
- Docker Compose is a supported deployment recipe, not a required runtime platform.
- The app uses Postgres through `DATABASE_URL`.
- The app stores media through a storage abstraction. V1 production supports local filesystem storage; S3-compatible storage is the next required adapter for broad managed-host compatibility.
- The app owns database migrations and runs them safely during startup.
- The same server process serves public pages, `/admin`, `/api`, and uploaded media when using local storage.
- Development Compose and production Compose are separate so development bind mounts do not leak into production instructions.
- Kubernetes is out of scope for v1 ease-of-install work.

## Deployment Targets

### VPS With Docker Compose

This is the default self-host path for users who own a small server.

The stack includes:

- `app`: Page Builder CMS image.
- `postgres`: official Postgres image with a persistent volume.
- `uploads`: persistent local media volume.
- optional `caddy`: reverse proxy with automatic HTTPS.

The user workflow should be:

1. Install Docker on a VPS.
2. Copy `compose.prod.yml` and `.env.production.example`.
3. Rename the env file to `.env`.
4. Set domain, database password, and session secret.
5. Run `docker compose -f compose.prod.yml up -d`.
6. Open `/admin` and create the first admin account.

### Managed Container Host

Providers such as Railway, Render, Fly.io, DigitalOcean App Platform, and similar platforms usually want one web container plus separately configured services. They should not require Docker Compose.

The user workflow should be:

1. Create a Postgres database with the provider.
2. Deploy the Page Builder CMS image or repo Dockerfile.
3. Set environment variables: `DATABASE_URL`, `SESSION_SECRET`, `PUBLIC_URL`, and storage variables.
4. Attach persistent storage if the provider supports it, or use S3-compatible media storage once implemented.
5. Open `/admin` and create the first admin account.

### Self-Hosted Panels

Coolify, CapRover, Dokku, and similar tools should work through either the production Docker image or the production Compose file. The deployment docs should explain which path is preferred for each panel.

## Runtime Configuration

Required production variables:

- `DATABASE_URL`: Postgres connection string.
- `SESSION_SECRET`: long random secret used for signed session cookies.
- `PUBLIC_URL`: canonical public URL for generated links and future emails.
- `PORT`: server port, default `3001`.
- `STATIC_DIR`: built admin assets directory inside the image.
- `MEDIA_STORAGE`: `local` for v1.
- `UPLOADS_DIR`: local media directory when `MEDIA_STORAGE=local`.

Future S3 variables:

- `MEDIA_STORAGE=s3`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`

## Docker Image Design

The production Dockerfile should use a multi-stage build:

1. Dependency/build stage:
   - install dependencies with the lockfile.
   - run typecheck/build.
   - produce `dist`.
2. Runtime stage:
   - copy only runtime files, server files, built assets, lockfile/package metadata, and production dependencies.
   - run as a non-root user where practical.
   - expose `3001`.
   - start `bun run server/index.ts` or a compiled server entry if we later add server bundling.

The image must not require source bind mounts, `bun install`, or `vite build` during container startup.

## Compose Files

The repo should have clearly named Compose files:

- `docker-compose.yml`: local development stack.
- `compose.prod.yml`: production VPS stack using the published image.
- optional `compose.prod.caddy.yml`: HTTPS reverse proxy overlay.

Production Compose requirements:

- no source bind mount.
- named volumes for Postgres and uploads.
- generated or user-provided secrets through `.env`.
- `restart: unless-stopped`.
- app healthcheck.
- Postgres healthcheck.
- no default production `SESSION_SECRET`.
- no default production database password in committed examples.

## Data Persistence

Production data lives in two places:

- Postgres volume/database: pages, versions, admin users, sessions, media metadata.
- media storage: uploaded files.

Documentation must make destructive operations explicit:

- `docker compose down` stops containers and preserves named volumes.
- `docker compose down -v` deletes database and uploaded media volumes.

Backups must include both Postgres and uploaded files. The first backup docs should provide commands for:

- `pg_dump` from the Postgres container.
- copying or archiving the uploads volume.
- restoring both onto a fresh deployment.

## Updates

The update path for Compose installs should be:

1. Pull the new image.
2. Recreate the app container.
3. App startup runs pending migrations.
4. Existing Postgres and uploads volumes remain attached.

The documented command should be:

```sh
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
```

If migrations become risky later, add explicit backup and migration confirmation steps before major-version upgrades.

## Health And Observability

The server already has `/health`. Production deployment should use it for:

- Docker healthchecks.
- provider health checks.
- quick install verification.

Minimum docs should include:

- viewing app logs.
- viewing database logs.
- checking health endpoint.
- common failure cases: database not reachable, bad `SESSION_SECRET`, missing uploads directory, migration failure.

## Security Requirements

- Admin sessions use HttpOnly cookies.
- Production docs require HTTPS.
- Default `SESSION_SECRET=change-me` must not be used in production examples.
- Uploaded files must keep MIME/size validation.
- Local uploads must be served from a configured uploads directory, not arbitrary filesystem paths.
- Database credentials should be set through environment variables or provider secret configuration.

## Documentation Deliverables

The implementation should add:

- `docs/deployment/docker-image.md`
- `docs/deployment/vps-compose.md`
- `docs/deployment/managed-hosts.md`
- `docs/deployment/backup-restore.md`

The README should stop presenting the repo as a Vite template and instead point to local development and deployment docs.

## Testing Strategy

Implementation should be verified with:

- production image build.
- running the image with production Compose.
- `/health` response from the app container.
- setup/login/edit/publish smoke test if a browser is available.
- focused server/CMS test suite.
- `bun run build`.

CI should eventually build the Docker image on every main-branch push and publish versioned images from releases.

## Out Of Scope

- Kubernetes manifests.
- Helm charts.
- Multi-node high availability.
- Built-in cloud account provisioning.
- S3 media adapter implementation in the first production Dockerfile slice, unless local managed-host testing proves it is immediately required.
