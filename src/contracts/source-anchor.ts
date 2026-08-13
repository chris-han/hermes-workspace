import { z } from 'zod'

export const SourceAnchorSchema = z.object({
  sourceRef: z.string().min(1),
  sourceHash: z.string().min(1),
  locator: z.string().min(1),
  quote: z.string().nullable(),
})

export type SourceAnchor = z.infer<typeof SourceAnchorSchema>
