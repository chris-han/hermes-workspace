/**
 * Provenance helpers for the Semantica showcase. All fixtures pin the Semantica
 * commit, notebook SHA-256, and per-file source-cell digests. The browser never
 * parses the upstream notebook; it consumes only checked-in JSON.
 */

import type { ShowcaseDatasetBundle, ShowcaseProvenanceBadge } from './semantica-showcase-types'

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

export function formatProvenanceLine(bundle: ShowcaseDatasetBundle): string {
  const prov = describeProvenance(bundle)
  return `semantica@${prov.semanticaCommit.slice(0, 7)} · fixture ${prov.fixtureId} · manifest ${shortSha256(
    prov.manifestSha256,
  )}`
}
