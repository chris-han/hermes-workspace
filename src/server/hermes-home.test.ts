import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveHermesHome } from './hermes-home'

describe('resolveHermesHome', () => {
  it('prefers HERMES_HOME when explicitly configured', () => {
    expect(
      resolveHermesHome({
        env: { HERMES_HOME: '/tmp/test-home/custom-hermes' },
        repoAgentHermesHome: '/repo/agent/.hermes',
        existsSync: () => true,
      }),
    ).toBe(path.resolve('/tmp/test-home/custom-hermes'))
  })

  it('defaults to the repo agent home when present', () => {
    expect(
      resolveHermesHome({
        env: {},
        repoAgentHermesHome: '/repo/agent/.hermes',
        existsSync: (targetPath) => targetPath === '/repo/agent/.hermes',
      }),
    ).toBe(path.resolve('/repo/agent/.hermes'))
  })

  it('throws when no explicit or repo-local Hermes home exists', () => {
    expect(() =>
      resolveHermesHome({
        env: {},
        repoAgentHermesHome: '/repo/agent/.hermes',
        existsSync: () => false,
      }),
    ).toThrow('Hermes home is not configured')
  })
})
