import { z } from 'zod'

import { SourceAnchorSchema } from './source-anchor'

export const GraphViewModelSchema = z.object({
  candidateGraphId: z.string().nullable(),
  acceptedReleaseId: z.string().nullable(),
  nodes: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  edges: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  sourceAnchors: z.array(SourceAnchorSchema),
})

export type GraphViewModel = z.infer<typeof GraphViewModelSchema>
