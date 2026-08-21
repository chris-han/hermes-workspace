// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

const sigmaMockState = vi.hoisted(() => ({
  instances: [] as Array<{ labels: string[]; settings: Record<string, unknown> }>,
}))

vi.mock('sigma', () => ({
  default: class FakeSigma {
    constructor(graph: any, _container: HTMLDivElement, settings: Record<string, unknown>) {
      const labels: string[] = []
      graph.forEachNode((nodeId: string, attrs: { label?: string }) => {
        labels.push(`${nodeId}:${attrs.label ?? ''}`)
      })
      sigmaMockState.instances.push({ labels, settings })
    }

    on() {
      return this
    }

    kill() {
      return this
    }

    refresh() {
      return this
    }

    setSetting() {
      return this
    }

    getCamera() {
      return {
        on() {
          return this
        },
        animatedZoom() {},
        animatedUnzoom() {},
        animatedReset() {},
        getState() {
          return { ratio: 1, x: 0, y: 0 }
        },
      }
    }
  },
}))

vi.mock('@/lib/semantier-auth', () => ({
  fetchSemantierAuthStatus: () => Promise.resolve({ authenticated: false, profile: null }),
  semantierAuthQueryKey: ['semantier-auth'],
  useSemantierAuthStatus: () => ({ data: { authenticated: false, profile: null } }),
}))

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SemanticaShowcaseScreen } from '../semantica-showcase-screen'

function renderWithProviders(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  sigmaMockState.instances = []
})

describe('SemanticaShowcaseScreen — properties toggle', () => {
  it('removes property text from the Sigma canvas when toggled off', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)

    fireEvent.click(screen.getByTestId('dataset-selector'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '03 Complete Visualization Suite' }))

    fireEvent.click(screen.getByTestId('sigma-controls-toggle'))

    const propertiesLabel = screen
      .getAllByText('Node detail')
      .find((element) => element.classList.contains('sigma-control-label'))
    expect(propertiesLabel).toBeDefined()
    const propertiesRow = propertiesLabel?.closest('.sigma-control-row')
    expect(propertiesRow).not.toBeNull()
    const propertiesSwitch = within(propertiesRow as HTMLElement).getByRole('switch')

    fireEvent.click(propertiesSwitch)
    fireEvent.click(propertiesSwitch)

    const latestInstance = sigmaMockState.instances.at(-1)
    expect(latestInstance).toBeDefined()
    expect(latestInstance?.labels.some((label) => label.includes('age='))).toBe(false)
    expect(latestInstance?.labels.some((label) => label.includes('founded='))).toBe(false)
  })
})