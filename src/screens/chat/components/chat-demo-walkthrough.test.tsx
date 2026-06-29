import { describe, expect, it } from 'vitest'
import { ACTIONS, STATUS } from 'react-joyride'

import { shouldCompleteDemoWalkthrough } from './chat-demo-walkthrough'

describe('chat demo walkthrough completion logic', () => {
  it('completes when the user closes the walkthrough', () => {
    expect(shouldCompleteDemoWalkthrough(ACTIONS.CLOSE, STATUS.RUNNING)).toBe(
      true,
    )
  })

  it('completes when the walkthrough is finished or skipped', () => {
    expect(shouldCompleteDemoWalkthrough(ACTIONS.NEXT, STATUS.FINISHED)).toBe(
      true,
    )
    expect(shouldCompleteDemoWalkthrough(ACTIONS.NEXT, STATUS.SKIPPED)).toBe(
      true,
    )
  })

  it('stays active during normal step progression', () => {
    expect(shouldCompleteDemoWalkthrough(ACTIONS.NEXT, STATUS.RUNNING)).toBe(
      false,
    )
  })
})
