import {
  
  
  
  
  normalizeKnownToolPhase,
  selectToolActivityState
} from './activity-state'
import type {AssistantTurnContext, AssistantTurnPhase, NormalizedToolPhase, ToolActivityState} from './activity-state';

export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export type PreparedToolSection = {
  key: string
  toolCallId: string | null
  type: string
  phase: NormalizedToolPhase
  state: ToolPartState
  input?: Record<string, unknown>
  preview?: string
  outputText: string
  errorText?: string
  activity: ToolActivityState
  labelOverride?: string
}

export type ProjectToolSectionInput = {
  key?: string
  toolCallId?: string | null
  type: string
  rawPhase?: unknown
  state: ToolPartState
  input?: Record<string, unknown>
  preview?: string
  outputText?: string
  errorText?: string
  hasTerminalResult?: boolean
  terminalResultKind?: 'done' | 'error'
  labelOverride?: string
  assistantTurnPhase: AssistantTurnPhase
  assistantTurnContext: AssistantTurnContext
}

function hasTerminalDisplayState(input: ProjectToolSectionInput): boolean {
  if (input.hasTerminalResult !== undefined) return input.hasTerminalResult
  if (input.state === 'output-error') return true
  if (input.errorText && input.errorText.trim().length > 0) return true
  return false
}

function terminalKindForDisplayState(
  input: ProjectToolSectionInput,
): 'done' | 'error' {
  if (input.terminalResultKind) return input.terminalResultKind
  if (input.state === 'output-error') return 'error'
  if (input.errorText && input.errorText.trim().length > 0) return 'error'
  return 'done'
}

export function projectPreparedToolSection(
  input: ProjectToolSectionInput,
): PreparedToolSection {
  const phase = normalizeKnownToolPhase(input.rawPhase)
  const toolCallId = input.toolCallId?.trim() || null
  const key = input.key?.trim() || toolCallId || input.type
  const activity = selectToolActivityState({
    normalizedPhase: phase,
    assistantTurnPhase: input.assistantTurnPhase,
    assistantTurnContext: input.assistantTurnContext,
    hasTerminalResult: hasTerminalDisplayState(input),
    terminalResultKind: terminalKindForDisplayState(input),
  })

  return {
    key,
    toolCallId,
    type: input.type,
    phase,
    state: input.state,
    input: input.input,
    preview: input.preview,
    outputText: input.outputText ?? '',
    errorText: input.errorText,
    activity,
    labelOverride: input.labelOverride,
  }
}
