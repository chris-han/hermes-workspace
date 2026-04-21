import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveHermesHome } from './hermes-home'

describe('resolveHermesHome', () => {
  it('prefers HERMES_HOME when explicitly configured', () => {
    expect(
      resolveHermesHome({
        env: { HERMES_HOME: '~/custom-hermes' },
        homeDir: '/tmp/test-home',
        repoAgentHermesHome: '/repo/agent/.hermes',
        existsSync: () => true,
      }),
    ).toBe(path.resolve('/tmp/test-home/custom-hermes'))
  })

  it('defaults to the repo agent home when present', () => {
    expect(
      resolveHermesHome({
        env: {},
        homeDir: '/tmp/test-home',
        repoAgentHermesHome: '/repo/agent/.hermes',
        existsSync: (targetPath) => targetPath === '/repo/agent/.hermes',
      }),
    ).toBe(path.resolve('/repo/agent/.hermes'))
  })

  it('falls back to ~/.hermes when no override or repo-local home exists', () => {
    expect(
      resolveHermesHome({
        env: {},
        homeDir: '/tmp/test-home',
        repoAgentHermesHome: '/repo/agent/.hermes',
        existsSync: () => false,
      }),
    ).toBe(path.resolve('/tmp/test-home/.hermes'))
  })
})