/**
 * Provenance helpers for the Semantica showcase. All fixtures pin the Semantica
 * commit, manifest SHA-256, and per-source symbol/location records. The
 * browser never parses the upstream notebook; it consumes only checked-in JSON.
 */

import type {
  ShowcaseDatasetBundle,
  ShowcaseProvenanceBadge,
  ShowcaseSourceRecord,
} from './semantica-showcase-types'

export function describeProvenance(bundle: ShowcaseDatasetBundle): ShowcaseProvenanceBadge {
  const hasDerived = bundle.manifest.files.some(
    (file) => file.derivationKind !== 'verbatim',
  )
  return {
    fixtureId: bundle.datasetId,
    semanticaCommit: bundle.manifest.semanticaCommit,
    manifestSha256: bundle.manifest.manifestSha256,
    offline: true,
    source: hasDerived ? 'derived-deterministically' : 'verbatim',
  }
}

export function shortSha256(sha: string): string {
  if (sha.length <= 12) return sha
  return `${sha.slice(0, 6)}…${sha.slice(-4)}`
}

/**
 * Return the most informative source record from the manifest. Prefers
 * records with a `symbol` field; falls back to the first record.
 */
export function primarySourceRecord(
  bundle: ShowcaseDatasetBundle,
): ShowcaseSourceRecord | undefined {
  return (
    bundle.manifest.sources.find((s) => Boolean(s.symbol)) ??
    bundle.manifest.sources[0]
  )
}

export function formatSourceLocation(bundle: ShowcaseDatasetBundle): string {
  const rec = primarySourceRecord(bundle)
  if (!rec) return `${bundle.datasetId}`
  const symbol = rec.symbol ? `${rec.symbol}` : rec.sourcePath
  return symbol
}

export function formatProvenanceLine(bundle: ShowcaseDatasetBundle): string {
  const prov = describeProvenance(bundle)
  return `semantica@${prov.semanticaCommit.slice(0, 7)} · fixture ${prov.fixtureId} · manifest ${shortSha256(
    prov.manifestSha256,
  )}`
}
