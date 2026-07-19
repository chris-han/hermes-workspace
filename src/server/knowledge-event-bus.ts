import { randomUUID } from 'node:crypto'

export type KnowledgeEventStatus = 'running' | 'waiting' | 'done' | 'failed'

export type KnowledgeEventStage =
  | 'upload'
  | 'review'
  | 'extract'
  | 'build'
  | 'complete'

export type KnowledgeEvent = {
  id: string
  workspaceId?: string | null
  sessionId?: string | null
  stage: KnowledgeEventStage
  status: KnowledgeEventStatus
  label: string
  detail?: string
  filename?: string
  targetPath?: string
  uploadRef?: string
  timestamp: number
}

type KnowledgeEventInput = Omit<KnowledgeEvent, 'id' | 'timestamp'>
type KnowledgeEventListener = (event: KnowledgeEvent) => void

const listeners = new Set<KnowledgeEventListener>()
const recentEvents: Array<KnowledgeEvent> = []
const MAX_RECENT_EVENTS = 100

export function emitKnowledgeEvent(input: KnowledgeEventInput): KnowledgeEvent {
  const event: KnowledgeEvent = {
    id: randomUUID(),
    timestamp: Date.now(),
    ...input,
  }
  recentEvents.unshift(event)
  recentEvents.splice(MAX_RECENT_EVENTS)
  for (const listener of listeners) {
    listener(event)
  }
  return event
}

export function subscribeToKnowledgeEvents(
  listener: KnowledgeEventListener,
  workspaceId?: string,
): () => void {
  const filteredListener: KnowledgeEventListener = (event) => {
    if (workspaceId && event.workspaceId && event.workspaceId !== workspaceId) {
      return
    }
    listener(event)
  }
  listeners.add(filteredListener)
  return () => {
    listeners.delete(filteredListener)
  }
}

export function listRecentKnowledgeEvents(workspaceId?: string) {
  return recentEvents.filter(
    (event) =>
      !workspaceId || !event.workspaceId || event.workspaceId === workspaceId,
  )
}
