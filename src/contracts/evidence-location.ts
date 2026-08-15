import { z } from 'zod'

export const SourceIdentitySchema = z.object({
  schemaVersion: z.literal('semantier.source_identity.v1'),
  sourceIdentityRef: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  mediaType: z.string().min(1),
  originalName: z.string().min(1),
  artifactRef: z.string().min(1),
  sourceVersion: z.string().nullable(),
  supersedesSourceIdentityRef: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
})

const TableSelectorSchema = z.object({
  tableOrdinal: z.number().int().nonnegative().nullable(),
  headingPath: z.array(z.string()),
  headerPath: z.array(z.string()),
  rowKey: z.string().nullable(),
  columnKey: z.string().nullable(),
  cellText: z.string().nullable(),
})

export const EvidenceSelectorSchema = z.object({
  schemaVersion: z.literal('semantier.evidence_selector.v1'),
  selectorKind: z.enum(['quote', 'structure', 'table_cell', 'composite']),
  exactQuote: z.string().nullable(),
  prefix: z.string().nullable(),
  suffix: z.string().nullable(),
  normalizedQuote: z.string().nullable(),
  structuralPath: z.array(z.string()),
  table: TableSelectorSchema.nullable(),
  sourceElementRef: z.string().nullable(),
})

export const EvidenceRefSchema = z.object({
  schemaVersion: z.literal('semantier.evidence_ref.v1'),
  evidenceRef: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceIdentityRef: z.string().min(1),
  selectorSchemaVersion: z.literal('semantier.evidence_selector.v1'),
  selectorHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  selector: EvidenceSelectorSchema,
  evidenceRole: z.enum(['support', 'condition', 'exception', 'definition', 'example', 'provenance', 'other']),
  provenance: z.object({
    extractionRunId: z.string().nullable(),
    providerRef: z.string().nullable(),
    providerCommit: z.string().nullable(),
    candidateId: z.string().nullable(),
    createdBy: z.enum(['machine', 'human', 'migration']),
  }),
  createdAt: z.string().datetime({ offset: true }),
})

export const ResolvedLocationSchema = z.object({
  schemaVersion: z.literal('semantier.resolved_location.v1'),
  evidenceRef: z.string().min(1),
  sourceIdentityRef: z.string().min(1),
  representationType: z.enum(['anydoc_document', 'markdown', 'pdf_render', 'docx_structural', 'html_dom', 'other']),
  representationRef: z.string().min(1),
  representationHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).nullable(),
  locationType: z.enum(['document_structure', 'table_cell', 'character_range', 'pdf_text_rects', 'dom_range', 'other']),
  status: z.enum(['exact', 'relocated_exact', 'normalized_match', 'ambiguous', 'unresolved', 'source_changed']),
  location: z.record(z.unknown()),
  matchedText: z.string().nullable(),
  resolverVersion: z.string().min(1),
  resolvedAt: z.string().datetime({ offset: true }),
})

export type SourceIdentity = z.infer<typeof SourceIdentitySchema>
export type EvidenceSelector = z.infer<typeof EvidenceSelectorSchema>
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>
export type ResolvedLocation = z.infer<typeof ResolvedLocationSchema>
