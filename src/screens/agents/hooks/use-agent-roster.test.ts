import { describe, expect, it } from 'vitest'

import { getAgentRosterSessionKey } from './use-agent-roster'

describe('getAgentRosterSessionKey', () => {
  it('uses the profile namespace for named profiles', () => {
    expect(getAgentRosterSessionKey('pc1-coder')).toBe('agent:pc1-coder:main')
    expect(getAgentRosterSessionKey('PC1 Planner')).toBe(
      'agent:pc1-planner:main',
    )
  })

  it('maps the default profile to the main session namespace', () => {
    expect(getAgentRosterSessionKey('default')).toBe('agent:main:main')
    expect(getAgentRosterSessionKey('')).toBe('agent:main:main')
  })
})
