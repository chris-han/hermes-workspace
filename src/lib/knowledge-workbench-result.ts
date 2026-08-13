import {
  KnowledgeWorkbenchResultSchema,
  type KnowledgeWorkbenchResult,
} from '@/contracts/knowledge-workbench'

/** Parse a governed chat tool result without letting malformed output mutate UI state. */
export function parseKnowledgeWorkbenchResult(
  raw: unknown,
): KnowledgeWorkbenchResult | null {
  const candidate = typeof raw === 'string' ? parseJson(raw) : raw
  const parsed = KnowledgeWorkbenchResultSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
