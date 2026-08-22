import { z } from 'zod'

export const SourceIdentitySchema = z.object({
  sourceIdentityRef: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceVersion: z.string().nullable().default(null),
  mediaType: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
})

const SpanSchema = z.object({
  elementRef: z.string().min(1),
  kind: z.enum(['heading', 'paragraph', 'list', 'table', 'row', 'cell', 'text']),
  text: z.string(),
  contentHash: z.string().min(1),
  headingLevel: z.number().int().positive().nullable().default(null),
  parentRef: z.string().nullable().default(null),
  index: z.number().int().nonnegative(),
})

export const DocumentEnvelopeSchema = z.object({
  schemaVersion: z.literal('semantier.document_envelope.v1'),
  source: SourceIdentitySchema,
  parser: z.object({ provider: z.literal('anydoc'), version: z.string(), commit: z.string() }).nullable(),
  spans: z.array(SpanSchema),
  tables: z.array(z.object({ elementRef: z.string(), rowRefs: z.array(z.string()), contentHash: z.string() })),
})

export type SourceIdentity = z.infer<typeof SourceIdentitySchema>
export type DocumentSpan = z.infer<typeof SpanSchema>
export type DocumentEnvelope = z.infer<typeof DocumentEnvelopeSchema>

// C1: Governed presentation projection of an already-resolved SourceIdentity.
// This is a presentation-shape only; it MUST NOT become a second authority schema.
// The original SourceIdentity remains the authority-bearing object and is embedded
// verbatim via the `source` field so identity/tenant/workspace/hash are not
// duplicated or risk drift. `documentKind` is intentionally derived from
// `source.mediaType` by the consumer, not re-encoded here.
export const SourceDocumentPresentationSchema = z.object({
  sourceIdentityRef: z.string().min(1),
  documentName: z.string().min(1),
  source: SourceIdentitySchema,
  // contentUrl MUST be same-origin by construction; non-same-origin values are a
  // contract violation and the viewer layer MUST refuse to load them.
  contentUrl: z.string().min(1),
  readOnly: z.literal(true),
})

export type SourceDocumentPresentation = z.infer<typeof SourceDocumentPresentationSchema>
