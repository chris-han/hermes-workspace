// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the Sigma renderer so jsdom does not need to provide WebGL2. The
// showcase shell contract is what we are verifying here, not the Sigma
// rendering output (which is exercised by Playwright against a real browser).
vi.mock('sigma', () => ({
  default: class FakeSigma {
    on() {
      return this
    }
    kill() {
      return this
    }
  },
}))

vi.mock('@/lib/semantier-auth', () => ({
  fetchSemantierAuthStatus: () => Promise.resolve({ authenticated: false, profile: null }),
  semantierAuthQueryKey: ['semantier-auth'],
  useSemantierAuthStatus: () => ({ data: { authenticated: false, profile: null } }),
}))

import { cleanup, render, screen, fireEvent } from '@testing-library/react'
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
})

describe('SemanticaShowcaseScreen — shell structure', () => {
  function selectDataset(datasetDisplayName: string) {
    fireEvent.click(screen.getByTestId('dataset-selector'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: datasetDisplayName }))
  }

  it('renders the six visualization tabs with the expected labels on the notebook suite', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    const tablist = screen.getByTestId('semantica-showcase-screen')
    expect(tablist).toBeDefined()
    expect(screen.getByTestId('showcase-tab-knowledge-graph').textContent).toBe('Knowledge Graph')
    expect(screen.getByTestId('showcase-tab-ontology').textContent).toBe('Ontology')
    expect(screen.getByTestId('showcase-tab-embedding').textContent).toBe('Embedding')
    expect(screen.getByTestId('showcase-tab-semantic-network').textContent).toBe('Semantic Network')
    expect(screen.getByTestId('showcase-tab-temporal').textContent).toBe('Temporal')
    expect(screen.getByTestId('showcase-tab-analytics').textContent).toBe('Analytics')
  })

  it('renders the Knowledge Graph view by default with the metric cards', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    expect(screen.getByTestId('kg-showcase-view')).toBeDefined()
    const metrics = screen.getByTestId('metric-cards')
    expect(metrics.textContent).toMatch(/Nodes/)
    expect(metrics.textContent).toMatch(/Edges/)
    expect(metrics.textContent).toMatch(/Entity types/)
  })

  it('keeps the side inspector visible when the canvas node-detail toggle is off', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    const inspector = screen.getByTestId('inspector-fields')
    expect(inspector.textContent).toMatch(/Selection/)
  })

  it('switches to the Ontology view and renders class nodes', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    fireEvent.click(screen.getByTestId('showcase-tab-ontology'))
    expect(screen.getByTestId('ontology-showcase-view')).toBeDefined()
    expect(screen.getByTestId('topology-hierarchical').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('ontology-class-Organization')).toBeDefined()
    expect(screen.getByTestId('ontology-class-Relationship')).toBeDefined()
  })

  it('selects an ontology class and surfaces the class fields in the inspector', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    fireEvent.click(screen.getByTestId('showcase-tab-ontology'))
    fireEvent.click(screen.getByTestId('ontology-class-Organization'))
    const inspector = screen.getByTestId('inspector-fields')
    expect(inspector.textContent).toMatch(/Organization/)
    expect(inspector.textContent).toMatch(/entity-type/)
  })

  it('switches to the Embedding view and renders the offline disclosure', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    fireEvent.click(screen.getByTestId('showcase-tab-embedding'))
    expect(screen.getByTestId('embedding-showcase-view')).toBeDefined()
    const disclosure = screen.getByTestId('embedding-offline-disclosure')
    expect(disclosure.textContent).toMatch(/frozen/i)
    expect(screen.getByTestId('embedding-point-Apple')).toBeDefined()
  })

  it('selects an embedding point and surfaces label, source text, and coordinates', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    fireEvent.click(screen.getByTestId('showcase-tab-embedding'))
    fireEvent.click(screen.getByTestId('embedding-point-Apple'))
    const inspector = screen.getByTestId('inspector-fields')
    expect(inspector.textContent).toMatch(/Apple/)
    expect(inspector.textContent).toMatch(/Apple Inc\./)
    expect(inspector.textContent).toMatch(/\d+\.\d+/)
  })

  it('switches to the Semantic Network view and keeps type details in the left rail', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    fireEvent.click(screen.getByTestId('showcase-tab-semantic-network'))
    expect(screen.getByTestId('semantic-network-showcase-view')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Node types' })).toBeDefined()
    expect(screen.getByText('Language')).toBeDefined()
    expect(screen.getByText('Concept')).toBeDefined()
  })

  it('switches to the Temporal view on the notebook suite', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    expect(screen.getByTestId('temporal-showcase-view')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Timeline', pressed: true })).toBeDefined()
    expect(screen.getByText('Pinned Semantica notebook visualization cases')).toBeDefined()
  })

  it('switches to the Analytics view on the notebook suite', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-analytics'))
    expect(screen.getByTestId('analytics-showcase-view')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Centrality', pressed: true })).toBeDefined()
    expect(screen.getByText('Pinned Semantica notebook visualization cases')).toBeDefined()
  })

  it('exposes the controlled dataset selector with the registered dataset id', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    const selector = screen.getByTestId('dataset-selector')
    expect(selector).toBeDefined()
    expect(selector.textContent).toMatch(/Semantica Intro · Knowledge Graph/)
    expect(screen.getByText('intro-cookbook-kg')).toBeDefined()

    fireEvent.click(selector)
    expect(screen.getAllByRole('menuitemradio').length).toBeGreaterThan(0)
  })

  it('renders the bottom status bar with the fixture provenance', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    const status = screen.getByTestId('showcase-status-bar')
    expect(status.textContent).toMatch(/intro-cookbook-kg/)
    expect(status.textContent).toMatch(/semantica@/)
    expect(status.textContent).toMatch(/offline/)
  })
})