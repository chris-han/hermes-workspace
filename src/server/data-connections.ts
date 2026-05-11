import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..', '..')
const DEFAULT_RUNTIME_ROOT = path.join(REPO_ROOT, '.hermes-local')

export type DataConnectionSurface = {
  kind: 'authoritative' | 'derived' | 'read-only'
  label: string
  description: string
  path?: string
  available: boolean
  modifiedAt?: string
  details?: Array<string>
}

export type DataConnectionsSummary = {
  eos: DataConnectionSurface
  lakehouse: DataConnectionSurface
  duckdb: DataConnectionSurface
}

export function resolveSemantierRuntimeRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.SEMANTIER_LOCAL_STATE_DIR?.trim()
  return configured ? path.resolve(configured) : DEFAULT_RUNTIME_ROOT
}

function statIfExists(targetPath: string): fs.Stats | null {
  try {
    return fs.statSync(targetPath)
  } catch {
    return null
  }
}

function toIso(value?: Date): string | undefined {
  return value ? value.toISOString() : undefined
}

export function buildDataConnectionsSummary(
  runtimeRoot = resolveSemantierRuntimeRoot(),
): DataConnectionsSummary {
  const normalizedRoot = path.resolve(runtimeRoot)
  const eosPath = path.join(normalizedRoot, 'eos.db')
  const lakehouseDir = path.join(normalizedRoot, 'lakehouse')
  const manifestPath = path.join(lakehouseDir, 'lakehouse_manifest.json')

  const eosStat = statIfExists(eosPath)
  const lakehouseStat = statIfExists(lakehouseDir)
  const manifestStat = statIfExists(manifestPath)

  const lakehouseAvailable = Boolean(lakehouseStat && manifestStat)
  const duckdbReady = Boolean(eosStat && manifestStat)

  return {
    eos: {
      kind: 'authoritative',
      label: 'EOS Governed Store',
      description:
        'Authoritative governed storage for facts, projections, replay bindings, and knowledge artifacts.',
      path: eosPath,
      available: Boolean(eosStat),
      modifiedAt: toIso(eosStat?.mtime),
      details: [
        'Semantic and projection authority lives here.',
        'Runtime writes must flow through Semantier store/runtime layers.',
      ],
    },
    lakehouse: {
      kind: 'derived',
      label: 'Lakehouse Parquet Mirror',
      description:
        'Derived, reproducible read surface exported from pinned EOS artifacts with manifest validation.',
      path: manifestStat ? manifestPath : lakehouseDir,
      available: lakehouseAvailable,
      modifiedAt: toIso(manifestStat?.mtime ?? lakehouseStat?.mtime),
      details: manifestStat
        ? [
            'Parquet datasets are derived mirrors, not authority.',
            'Manifest pinning is required for read-time integrity checks.',
          ]
        : [
            'Expected artifacts live under .hermes-local/lakehouse.',
            'Run bootstrap/materialization before analytics surfaces are ready.',
          ],
    },
    duckdb: {
      kind: 'read-only',
      label: 'DuckDB Query Runtime',
      description:
        'Read-only query-time mount over persisted EOS and lakehouse artifacts. It does not create authoritative projections.',
      available: duckdbReady,
      details: duckdbReady
        ? [
            'Queries attach eos.db and mount Parquet views.',
            'No authoritative writes occur in request-time query paths.',
          ]
        : [
            'Requires eos.db plus a valid lakehouse manifest.',
            'Serves analytics over persisted artifacts only.',
          ],
    },
  }
}
