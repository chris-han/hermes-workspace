import { z } from 'zod'

export const GraphInteractionCommandSchema = z.object({
  schemaVersion: z.literal('graph_interaction.v1'),
  commandId: z.string().min(1),
  candidateGraphId: z.string().nullable(),
  acceptedReleaseId: z.string().nullable(),
  action: z.enum(['highlight', 'focus', 'clear_focus', 'show_path']),
  nodeIds: z.array(z.string().min(1)),
  edgeIds: z.array(z.string().min(1)),
  dimOthers: z.boolean(),
  viewport: z.enum(['unchanged', 'fit_selection']),
  reason: z.string().nullable(),
})

export type GraphInteractionCommand = z.infer<typeof GraphInteractionCommandSchema>
