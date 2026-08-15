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
