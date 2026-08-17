// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { Route } from './graph-explorer'

/**
 * The legacy route is a compatibility shim. It must never mount the retired
 * Graph Explorer screen or expose a second knowledge-management surface.
 */
describe('graph-explorer retirement route', () => {
  it('redirects legacy navigation to ContextGraph Studio', () => {
    const beforeLoad = Route.options.beforeLoad
    expect(typeof beforeLoad).toBe('function')
    expect(Route.options.component).toBeTruthy()

    try {
      beforeLoad?.({ search: { node_id: 'legacy-node' } } as never)
      throw new Error('legacy route did not redirect')
    } catch (error) {
      expect(error).toMatchObject({
        options: {
          to: '/contextgraph-studio',
          search: { node_id: 'legacy-node' },
          replace: true,
        },
      })
    }
  })
})
