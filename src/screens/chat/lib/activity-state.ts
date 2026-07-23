export type AssistantTurnPhase =
  | 'idle'
  | 'sending'
  | 'waiting'
  | 'streaming'
  | 'compacting'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'superseded'

export type AssistantTurnContext = 'active' | 'historical'

export type NormalizedToolPhase =
  | 'calling'
  | 'running'
  | 'done'
  | 'error'
  | 'unknown'

export type ToolActivityState = {
  normalizedPhase: NormalizedToolPhase
  isActive: boolean
  isTerminal: boolean
  renderOrb: boolean
  terminalKind: 'done' | 'error' | null
  reason:
    | 'active-phase'
    | 'terminal-phase'
    | 'terminal-result'
    | 'unknown-active-turn'
    | 'unknown-non-active-turn'
}

export type AssistantActivityState = {
  phase: AssistantTurnPhase
  context: AssistantTurnContext
  showPlaceholder: boolean
  label: string
  statusRole: 'status' | 'none'
  reason:
    | 'no-active-turn'
    | 'sending'
    | 'waiting'
    | 'streaming'
    | 'compacting'
    | 'grace'
    | 'visible-content'
    | 'visible-tool-section'
    | 'terminal'
    | 'historical'
}

export type SelectToolActivityStateInput = {
  normalizedPhase: NormalizedToolPhase
  assistantTurnPhase: AssistantTurnPhase
  assistantTurnContext: AssistantTurnContext
  hasTerminalResult?: boolean
  terminalResultKind?: 'done' | 'error'
}

export type SelectAssistantActivityStateInput = {
  assistantTurnPhase: AssistantTurnPhase
  assistantTurnContext: AssistantTurnContext
  hasSubstantiveVisibleAssistantContent: boolean
  hasActiveToolSection?: boolean
  hasStreamingThinking?: boolean
  hasLifecycleContent?: boolean
  thinkingGraceActive?: boolean
}

const ACTIVE_ASSISTANT_PHASES = new Set<AssistantTurnPhase>([
  'sending',
  'waiting',
  'streaming',
  'compacting',
])

const TERMINAL_ASSISTANT_PHASES = new Set<AssistantTurnPhase>([
  'completed',
  'cancelled',
  'failed',
  'superseded',
])

export function isAssistantPhaseActive(phase: AssistantTurnPhase): boolean {
  return ACTIVE_ASSISTANT_PHASES.has(phase)
}

export function isAssistantPhaseTerminal(phase: AssistantTurnPhase): boolean {
  return TERMINAL_ASSISTANT_PHASES.has(phase)
}

export function normalizeKnownToolPhase(
  rawPhase: unknown,
): NormalizedToolPhase {
  if (typeof rawPhase !== 'string') return 'unknown'
  const phase = rawPhase.trim().toLowerCase()

  if (phase === 'start' || phase === 'started') return 'calling'
  if (phase === 'calling') return 'calling'
  if (phase === 'running') return 'running'
  if (
    phase === 'done' ||
    phase === 'result' ||
    phase === 'complete' ||
    phase === 'completed'
  ) {
    return 'done'
  }
  if (phase === 'error' || phase === 'failed' || phase === 'failure') {
    return 'error'
  }
  return 'unknown'
}

export function isToolPhaseActive(phase: NormalizedToolPhase): boolean {
  return phase === 'calling' || phase === 'running'
}

export function isToolPhaseTerminal(phase: NormalizedToolPhase): boolean {
  return phase === 'done' || phase === 'error'
}

export function selectToolActivityState(
  input: SelectToolActivityStateInput,
): ToolActivityState {
  const normalizedPhase = input.normalizedPhase
  const terminalResultKind = input.terminalResultKind ?? 'done'

  if (input.hasTerminalResult) {
    return {
      normalizedPhase,
      isActive: false,
      isTerminal: true,
      renderOrb: false,
      terminalKind: terminalResultKind,
      reason: 'terminal-result',
    }
  }

  if (normalizedPhase === 'done' || normalizedPhase === 'error') {
    return {
      normalizedPhase,
      isActive: false,
      isTerminal: true,
      renderOrb: false,
      terminalKind: normalizedPhase,
      reason: 'terminal-phase',
    }
  }

  if (normalizedPhase === 'calling' || normalizedPhase === 'running') {
    return {
      normalizedPhase,
      isActive: true,
      isTerminal: false,
      renderOrb: true,
      terminalKind: null,
      reason: 'active-phase',
    }
  }

  const assistantTurnIsActive =
    input.assistantTurnContext === 'active' &&
    isAssistantPhaseActive(input.assistantTurnPhase)

  if (assistantTurnIsActive) {
    return {
      normalizedPhase,
      isActive: true,
      isTerminal: false,
      renderOrb: true,
      terminalKind: null,
      reason: 'unknown-active-turn',
    }
  }

  return {
    normalizedPhase,
    isActive: false,
    isTerminal: false,
    renderOrb: false,
    terminalKind: null,
    reason: 'unknown-non-active-turn',
  }
}

function assistantActivityLabel(phase: AssistantTurnPhase): string {
  switch (phase) {
    case 'sending':
      return 'Sending...'
    case 'waiting':
      return 'Thinking...'
    case 'streaming':
      return 'Working...'
    case 'compacting':
      return 'Compacting context...'
    default:
      return ''
  }
}

export function selectAssistantActivityState(
  input: SelectAssistantActivityStateInput,
): AssistantActivityState {
  const phase = input.assistantTurnPhase
  const context = input.assistantTurnContext

  if (context === 'historical') {
    return {
      phase,
      context,
      showPlaceholder: false,
      label: '',
      statusRole: 'none',
      reason: 'historical',
    }
  }

  if (isAssistantPhaseTerminal(phase)) {
    return {
      phase,
      context,
      showPlaceholder: false,
      label: '',
      statusRole: 'none',
      reason: 'terminal',
    }
  }

  if (input.hasSubstantiveVisibleAssistantContent) {
    return {
      phase,
      context,
      showPlaceholder: false,
      label: '',
      statusRole: 'none',
      reason: 'visible-content',
    }
  }

  if (input.hasActiveToolSection) {
    return {
      phase,
      context,
      showPlaceholder: false,
      label: '',
      statusRole: 'none',
      reason: 'visible-tool-section',
    }
  }

  if (isAssistantPhaseActive(phase)) {
    return {
      phase,
      context,
      showPlaceholder: true,
      label: assistantActivityLabel(phase),
      statusRole: 'status',
      reason:
        phase === 'sending' ||
        phase === 'waiting' ||
        phase === 'streaming' ||
        phase === 'compacting'
          ? phase
          : 'no-active-turn',
    }
  }

  if (input.thinkingGraceActive) {
    return {
      phase,
      context,
      showPlaceholder: true,
      label: 'Thinking...',
      statusRole: 'status',
      reason: 'grace',
    }
  }

  return {
    phase,
    context,
    showPlaceholder: false,
    label: '',
    statusRole: 'none',
    reason: 'no-active-turn',
  }
}
