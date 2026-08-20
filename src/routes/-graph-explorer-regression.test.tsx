// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { Route } from './graph-explorer'
import { ContextGraphStudioScreenV2 } from '@/screens/contextgraph-studio/contextgraph-studio-screen-v2'

/**
 * /graph-explorer now ships the redesigned ContextGraph Studio chrome
 * (workspace rail + graph canvas + inspector + chat), not the legacy
 * retirement redirect. The full MVL flow (Sources / Extract / Ground /
 * Graph / Inspect / Compare / Evaluate) remains at /contextgraph-studio.
 */
describe('graph-explorer studio v2 route', () => {
  it('renders the Studio v2 chrome component', () => {
    expect(Route.options.component).toBe(ContextGraphStudioScreenV2)
  })

  it('does not redirect to /contextgraph-studio anymore', () => {
    expect(Route.options.beforeLoad).toBeUndefined()
  })

  it('is client-rendered only (no SSR)', () => {
    expect(Route.options.ssr).toBe(false)
  })
})
