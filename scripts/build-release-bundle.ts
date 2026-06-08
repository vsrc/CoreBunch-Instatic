import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const OUT_DIR = join(ROOT, '.tmp', 'release')

const version = Bun.argv[2] ?? process.env.INSTATIC_VERSION
if (!version) {
  throw new Error('Usage: bun run release:bundle -- <semver>')
}

const bundleName = `instatic-${version}`
const stagingDir = join(OUT_DIR, bundleName)
const archivePath = join(OUT_DIR, `${bundleName}-release-bundle.tar.gz`)

const bundleFiles = [
  'compose.prod.yml',
  'compose.sqlite.yml',
  'compose.tls.yml',
  '.env.production.example',
  'docs/deployment/README.md',
  'docs/deployment/vps.md',
  'docs/deployment/docker-image.md',
  'docs/deployment/tls-caddy.md',
  'docs/deployment/backup-restore.md',
  'docs/deployment/railway.md',
]

async function copyIntoBundle(path: string): Promise<void> {
  const source = join(ROOT, path)
  if (!existsSync(source)) {
    throw new Error(`Release bundle source is missing: ${path}`)
  }
  const destination = join(stagingDir, path)
  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true })
}

await rm(stagingDir, { recursive: true, force: true })
await rm(archivePath, { force: true })
await mkdir(stagingDir, { recursive: true })

for (const file of bundleFiles) {
  await copyIntoBundle(file)
}

await writeFile(
  join(stagingDir, 'INSTALL.md'),
  `# Instatic ${version} Install Bundle

This bundle contains the production Compose files and deployment docs for Instatic ${version}.

## SQLite, single-container install

\`\`\`sh
INSTATIC_IMAGE=ghcr.io/corebunch/instatic:${version} docker compose -f compose.prod.yml -f compose.sqlite.yml up -d
\`\`\`

## Postgres install

\`\`\`sh
cp .env.production.example .env
# Edit .env and set POSTGRES_PASSWORD and INSTATIC_SECRET_KEY.
INSTATIC_IMAGE=ghcr.io/corebunch/instatic:${version} docker compose -f compose.prod.yml up -d
\`\`\`

## Railway image-source install

Use \`ghcr.io/corebunch/instatic:${version}\` as the Railway service source. Attach a volume at \`/app/storage\` and set:

\`\`\`txt
DATABASE_URL=sqlite:/app/storage/data/cms.db
UPLOADS_DIR=/app/storage/uploads
STATIC_DIR=/app/dist
INSTATIC_SECRET_KEY=<output of bun run scripts/generate-secret-key.ts>
\`\`\`

Read \`docs/deployment/railway.md\`, \`docs/deployment/vps.md\`, and \`docs/deployment/backup-restore.md\` before running a public site.
`,
  'utf-8',
)

const tar = spawnSync('tar', ['-czf', archivePath, '-C', OUT_DIR, bundleName], {
  stdio: 'inherit',
})

if (tar.status !== 0) {
  throw new Error(`tar failed with exit code ${tar.status ?? 'unknown'}`)
}

console.log(archivePath)
