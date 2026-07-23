import { describe, expect, it } from 'vitest'

import {
  isAssistantPhaseActive,
  isAssistantPhaseTerminal,
  isToolPhaseActive,
  isToolPhaseTerminal,
  normalizeKnownToolPhase,
  selectAssistantActivityState,
  selectToolActivityState,
} from './activity-state'
import type { AssistantTurnPhase } from './activity-state'

describe('normalizeKnownToolPhase', () => {
  it.each([
    ['start', 'calling'],
    ['started', 'calling'],
    ['calling', 'calling'],
    ['running', 'running'],
    ['done', 'done'],
    ['result', 'done'],
    ['complete', 'done'],
    ['completed', 'done'],
    ['error', 'error'],
    ['failed', 'error'],
    ['failure', 'error'],
    ['skill.loaded', 'unknown'],
    [undefined, 'unknown'],
  ] as const)('maps %s to %s', (rawPhase, expected) => {
    expect(normalizeKnownToolPhase(rawPhase)).toBe(expected)
  })

  it('normalizes case and whitespace without making unknown phases active', () => {
    expect(normalizeKnownToolPhase(' COMPLETED ')).toBe('done')
    expect(normalizeKnownToolPhase(' paused ')).toBe('unknown')
  })
})

describe('tool phase predicates', () => {
  it('classifies active and terminal phases', () => {
    expect(isToolPhaseActive('calling')).toBe(true)
    expect(isToolPhaseActive('running')).toBe(true)
    expect(isToolPhaseActive('done')).toBe(false)
    expect(isToolPhaseActive('unknown')).toBe(false)

    expect(isToolPhaseTerminal('done')).toBe(true)
    expect(isToolPhaseTerminal('error')).toBe(true)
    expect(isToolPhaseTerminal('running')).toBe(false)
  })
})

describe('selectToolActivityState', () => {
  it('renders activity for canonical active phases', () => {
    expect(
      selectToolActivityState({
        normalizedPhase: 'calling',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
      }),
    ).toMatchObject({
      isActive: true,
      isTerminal: false,
      renderOrb: true,
      reason: 'active-phase',
    })

    expect(
      selectToolActivityState({
        normalizedPhase: 'running',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
      }).renderOrb,
    ).toBe(true)
  })

  it('keeps terminal phases static with explicit terminal kind', () => {
    expect(
      selectToolActivityState({
        normalizedPhase: 'done',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
      }),
    ).toMatchObject({
      isActive: false,
      isTerminal: true,
      renderOrb: false,
      terminalKind: 'done',
      reason: 'terminal-phase',
    })

    expect(
      selectToolActivityState({
        normalizedPhase: 'error',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
      }),
    ).toMatchObject({
      terminalKind: 'error',
      renderOrb: false,
    })
  })

  it('lets terminal results override active-looking phases', () => {
    expect(
      selectToolActivityState({
        normalizedPhase: 'running',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
        hasTerminalResult: true,
        terminalResultKind: 'error',
      }),
    ).toMatchObject({
      isActive: false,
      isTerminal: true,
      renderOrb: false,
      terminalKind: 'error',
      reason: 'terminal-result',
    })
  })

  it('allows unknown active fallback only for active non-terminal assistant turns', () => {
    expect(
      selectToolActivityState({
        normalizedPhase: 'unknown',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
      }),
    ).toMatchObject({
      isActive: true,
      renderOrb: true,
      reason: 'unknown-active-turn',
    })

    expect(
      selectToolActivityState({
        normalizedPhase: 'unknown',
        assistantTurnPhase: 'completed',
        assistantTurnContext: 'active',
      }),
    ).toMatchObject({
      isActive: false,
      renderOrb: false,
      reason: 'unknown-non-active-turn',
    })

    expect(
      selectToolActivityState({
        normalizedPhase: 'unknown',
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'historical',
      }),
    ).toMatchObject({
      isActive: false,
      renderOrb: false,
      reason: 'unknown-non-active-turn',
    })
  })
})

describe('assistant phase predicates', () => {
  it('classifies active and terminal assistant phases', () => {
    expect(isAssistantPhaseActive('sending')).toBe(true)
    expect(isAssistantPhaseActive('waiting')).toBe(true)
    expect(isAssistantPhaseActive('streaming')).toBe(true)
    expect(isAssistantPhaseActive('compacting')).toBe(true)
    expect(isAssistantPhaseActive('completed')).toBe(false)

    expect(isAssistantPhaseTerminal('completed')).toBe(true)
    expect(isAssistantPhaseTerminal('cancelled')).toBe(true)
    expect(isAssistantPhaseTerminal('failed')).toBe(true)
    expect(isAssistantPhaseTerminal('superseded')).toBe(true)
    expect(isAssistantPhaseTerminal('waiting')).toBe(false)
  })
})

describe('selectAssistantActivityState', () => {
  it.each([
    ['sending', 'sending', 'Sending...'],
    ['waiting', 'waiting', 'Thinking...'],
    ['streaming', 'streaming', 'Working...'],
    ['compacting', 'compacting', 'Compacting context...'],
  ] as const)(
    'shows one placeholder for active pre-content %s phase',
    (phase, reason, label) => {
      expect(
        selectAssistantActivityState({
          assistantTurnPhase: phase,
          assistantTurnContext: 'active',
          hasSubstantiveVisibleAssistantContent: false,
        }),
      ).toMatchObject({
        showPlaceholder: true,
        label,
        statusRole: 'status',
        reason,
      })
    },
  )

  it.each([
    'completed',
    'cancelled',
    'failed',
    'superseded',
  ] satisfies Array<AssistantTurnPhase>)(
    'terminal %s suppresses stale active inputs and grace',
    (phase) => {
      expect(
        selectAssistantActivityState({
          assistantTurnPhase: phase,
          assistantTurnContext: 'active',
          hasSubstantiveVisibleAssistantContent: false,
          hasActiveToolSection: true,
          hasStreamingThinking: true,
          hasLifecycleContent: true,
          thinkingGraceActive: true,
        }),
      ).toMatchObject({
        showPlaceholder: false,
        statusRole: 'none',
        reason: 'terminal',
      })
    },
  )

  it('historical context suppresses active indicators without rewriting phase', () => {
    expect(
      selectAssistantActivityState({
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'historical',
        hasSubstantiveVisibleAssistantContent: false,
        thinkingGraceActive: true,
      }),
    ).toMatchObject({
      phase: 'streaming',
      context: 'historical',
      showPlaceholder: false,
      reason: 'historical',
    })
  })

  it('visible assistant content and visible active tool sections suppress assistant placeholder', () => {
    expect(
      selectAssistantActivityState({
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
        hasSubstantiveVisibleAssistantContent: true,
      }),
    ).toMatchObject({
      showPlaceholder: false,
      reason: 'visible-content',
    })

    expect(
      selectAssistantActivityState({
        assistantTurnPhase: 'streaming',
        assistantTurnContext: 'active',
        hasSubstantiveVisibleAssistantContent: false,
        hasActiveToolSection: true,
      }),
    ).toMatchObject({
      showPlaceholder: false,
      reason: 'visible-tool-section',
    })
  })

  it('allows bounded grace only when no terminal or substantive content wins', () => {
    expect(
      selectAssistantActivityState({
        assistantTurnPhase: 'idle',
        assistantTurnContext: 'active',
        hasSubstantiveVisibleAssistantContent: false,
        thinkingGraceActive: true,
      }),
    ).toMatchObject({
      showPlaceholder: true,
      reason: 'grace',
    })

    expect(
      selectAssistantActivityState({
        assistantTurnPhase: 'idle',
        assistantTurnContext: 'active',
        hasSubstantiveVisibleAssistantContent: true,
        thinkingGraceActive: true,
      }),
    ).toMatchObject({
      showPlaceholder: false,
      reason: 'visible-content',
    })
  })

  it('ignores streaming thinking and lifecycle events when there is no active phase', () => {
    expect(
      selectAssistantActivityState({
        assistantTurnPhase: 'idle',
        assistantTurnContext: 'active',
        hasSubstantiveVisibleAssistantContent: false,
        hasStreamingThinking: true,
        hasLifecycleContent: true,
      }),
    ).toMatchObject({
      showPlaceholder: false,
      reason: 'no-active-turn',
    })
  })
})
