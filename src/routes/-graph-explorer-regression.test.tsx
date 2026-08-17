// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { GraphExplorerScreen } from '@/screens/graph-explorer/graph-explorer-screen'

/**
 * Regression-protection smoke test for the legacy `/graph-explorer` route.
 *
 * The plan rule (CORE-01) is that the Studio implementation must not
 * modify or visually restyle the existing Graph Explorer; the legacy route
 * must remain a stable baseline. This test asserts the legacy screen
 * module still imports successfully and exposes its React component,
 * which is what `/graph-explorer` depends on at the route definition.
 */
describe('graph-explorer regression baseline', () => {
  it('exports a renderable GraphExplorerScreen component', () => {
    expect(typeof GraphExplorerScreen).toBe('function')
  })
})