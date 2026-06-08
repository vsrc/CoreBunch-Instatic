# Release Workflow

This maintainer guide covers publishing Instatic Docker images.

End users do not need this page to deploy Instatic. They follow [railway.md](railway.md), [vps.md](vps.md), or [docker-image.md](docker-image.md). Maintainers use this page to keep `ghcr.io/corebunch/instatic` release tags aligned with source tags.

---

## TL;DR

Release image tags:

```txt
ghcr.io/corebunch/instatic:latest
ghcr.io/corebunch/instatic:<semver>
ghcr.io/corebunch/instatic:<major>.<minor>
```

Release flow:

1. Keep `main` releasable.
2. Tag a version, e.g. `v0.0.1`.
3. GitHub Actions runs `bun run build`, `bun test`, and `bun run lint`.
4. GitHub Actions builds `Dockerfile`.
5. GitHub Actions pushes the semver image, minor image, and `latest`.
6. GitHub Actions mirrors to Docker Hub when Docker Hub secrets exist.
7. GitHub Actions creates the GitHub Release and uploads the release bundle.

## Tag A Release

```sh
git tag v0.0.1
git push origin v0.0.1
```

The release workflow publishes:

```txt
ghcr.io/corebunch/instatic:0.0.1
ghcr.io/corebunch/instatic:0.0
ghcr.io/corebunch/instatic:latest
```

It also uploads:

```txt
instatic-0.0.1-release-bundle.tar.gz
```

Release notes should link to:

- [railway.md](railway.md)
- [vps.md](vps.md)
- [docker-image.md](docker-image.md)
- [backup-restore.md](backup-restore.md)

## Operator Update Command

Image-based VPS Compose installs update the app container without touching DB/uploads volumes:

```sh
docker compose -f compose.prod.yml pull app
docker compose -f compose.prod.yml up -d
```

SQLite installs include the SQLite override when running commands:

```sh
docker compose -f compose.prod.yml -f compose.sqlite.yml pull app
docker compose -f compose.prod.yml -f compose.sqlite.yml up -d
```

Railway installs should use Docker image source and Railway Image Auto Updates rather than connecting to this GitHub repository as a service source.

## Source Build Testing

When testing a release candidate before publishing GHCR images, build from a source checkout:

```sh
docker compose -f compose.prod.yml -f compose.build.yml up -d --build
```

Or build and tag an image manually:

```sh
docker build -t ghcr.io/corebunch/instatic:dev .
INSTATIC_IMAGE=ghcr.io/corebunch/instatic:dev docker compose -f compose.prod.yml up -d
```

## GitHub Actions Shape

The release workflow should:

- run tests and build checks
- log in to GitHub Container Registry with `GITHUB_TOKEN`
- build `Dockerfile`
- push a semver tag for `v*` tags
- push `latest` for tagged releases
- create a release bundle with the Compose files and deployment docs
- skip the Docker Hub mirror cleanly when `DOCKERHUB_USERNAME` or `DOCKERHUB_TOKEN` is missing

## Docker Hub Mirror

The release workflow always publishes GHCR. It mirrors to Docker Hub only when these repository secrets exist:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

The mirror target is `docker.io/corebunch/instatic:<tag>`. If the secrets are absent, the workflow prints a skip message and the GHCR release still completes.

## GHCR Visibility

After the first successful tagged release, open the package page for `ghcr.io/corebunch/instatic` in GitHub Packages and set visibility to public.

Verify anonymous pulls work:

```sh
docker logout ghcr.io
docker pull ghcr.io/corebunch/instatic:latest
```

## Related

- [deployment/README.md](README.md) — deployment overview
- [docker-image.md](docker-image.md) — runtime image contract
- `Dockerfile` — image build
- `compose.prod.yml` — production image consumer
