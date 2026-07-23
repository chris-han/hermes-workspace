import { describe, expect, it } from 'vitest'

import { projectPreparedToolSection } from './tool-activity-projection'

describe('projectPreparedToolSection', () => {
  it('preserves canonical active phase separately from input display state', () => {
    const section = projectPreparedToolSection({
      key: 'tc-1',
      toolCallId: 'tc-1',
      type: 'web_search',
      rawPhase: 'running',
      state: 'input-available',
      input: { query: 'revenue' },
      assistantTurnPhase: 'streaming',
      assistantTurnContext: 'active',
    })

    expect(section).toMatchObject({
      key: 'tc-1',
      toolCallId: 'tc-1',
      phase: 'running',
      state: 'input-available',
      activity: {
        renderOrb: true,
        reason: 'active-phase',
      },
    })
  })

  it('keeps output display state from changing orb authority while canonical phase is active', () => {
    const section = projectPreparedToolSection({
      key: 'tc-2',
      toolCallId: 'tc-2',
      type: 'exec',
      rawPhase: 'running',
      state: 'output-available',
      outputText: 'done',
      assistantTurnPhase: 'streaming',
      assistantTurnContext: 'active',
    })

    expect(section).toMatchObject({
      phase: 'running',
      state: 'output-available',
      outputText: 'done',
      activity: {
        renderOrb: true,
        terminalKind: null,
        reason: 'active-phase',
      },
    })
  })

  it('lets explicit terminal result authority override active-looking phase', () => {
    const section = projectPreparedToolSection({
      key: 'tc-2b',
      toolCallId: 'tc-2b',
      type: 'exec',
      rawPhase: 'running',
      state: 'output-available',
      outputText: 'done',
      hasTerminalResult: true,
      terminalResultKind: 'done',
      assistantTurnPhase: 'streaming',
      assistantTurnContext: 'active',
    })

    expect(section).toMatchObject({
      phase: 'running',
      state: 'output-available',
      activity: {
        renderOrb: false,
        terminalKind: 'done',
        reason: 'terminal-result',
      },
    })
  })

  it('preserves terminal canonical phase even when output text is not available yet', () => {
    const section = projectPreparedToolSection({
      key: 'tc-3',
      toolCallId: 'tc-3',
      type: 'browser_snapshot',
      rawPhase: 'complete',
      state: 'input-available',
      assistantTurnPhase: 'streaming',
      assistantTurnContext: 'active',
    })

    expect(section).toMatchObject({
      phase: 'done',
      state: 'input-available',
      activity: {
        renderOrb: false,
        terminalKind: 'done',
        reason: 'terminal-phase',
      },
    })
  })

  it('keeps historical unknown phase static', () => {
    const section = projectPreparedToolSection({
      key: 'tc-4',
      toolCallId: 'tc-4',
      type: 'skill_view',
      rawPhase: 'skill.loaded',
      state: 'input-available',
      assistantTurnPhase: 'streaming',
      assistantTurnContext: 'historical',
    })

    expect(section).toMatchObject({
      phase: 'unknown',
      state: 'input-available',
      activity: {
        renderOrb: false,
        reason: 'unknown-non-active-turn',
      },
    })
  })

  it('allows documented unknown active fallback while the owning assistant turn is active', () => {
    const section = projectPreparedToolSection({
      key: 'tc-5',
      toolCallId: 'tc-5',
      type: 'skill_view',
      rawPhase: 'skill.loaded',
      state: 'input-available',
      assistantTurnPhase: 'streaming',
      assistantTurnContext: 'active',
    })

    expect(section).toMatchObject({
      phase: 'unknown',
      activity: {
        renderOrb: true,
        reason: 'unknown-active-turn',
      },
    })
  })

  it('derives a deterministic key when no governed id is available', () => {
    expect(
      projectPreparedToolSection({
        type: 'artifact:report',
        rawPhase: 'complete',
        state: 'output-available',
        assistantTurnPhase: 'completed',
        assistantTurnContext: 'active',
      }).key,
    ).toBe('artifact:report')
  })
})
