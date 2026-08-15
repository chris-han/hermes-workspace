import type { DocumentEnvelope, SourceIdentity } from '@/contracts/source-document'

export type PinnedSourceRecord = { identity: SourceIdentity; bytes: Uint8Array; envelope: DocumentEnvelope | null }

/** Source lookup deliberately accepts an identity, never a filesystem path or URL. */
export function authorizePinnedSource(record: PinnedSourceRecord | null, request: Pick<SourceIdentity, 'tenantId' | 'workspaceId' | 'sourceIdentityRef'>): PinnedSourceRecord {
  if (!record || record.identity.sourceIdentityRef !== request.sourceIdentityRef || record.identity.tenantId !== request.tenantId || record.identity.workspaceId !== request.workspaceId) throw new Error('pinned source not found')
  return record
}
