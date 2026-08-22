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

describe('SemanticaShowcaseScreen — §10.4 temporal/analytics submodes', () => {
  function selectDataset(datasetDisplayName: string) {
    fireEvent.click(screen.getByTestId('dataset-selector'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: datasetDisplayName }))
  }

  it('switches among all declared temporal submodes on the notebook suite', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    const view = screen.getByTestId('temporal-showcase-view')
    expect(screen.getByRole('button', { name: 'Timeline', pressed: true })).toBeDefined()
    expect(view.textContent).toMatch(/Timeline/)

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(screen.getByRole('button', { name: 'Dashboard', pressed: true })).toBeDefined()
    expect(screen.getByTestId('temporal-showcase-view').textContent).toMatch(/Dashboard/)

    fireEvent.click(screen.getByRole('button', { name: 'Evolution' }))
    expect(screen.getByRole('button', { name: 'Evolution', pressed: true })).toBeDefined()
    expect(screen.getByTestId('temporal-showcase-view').textContent).toMatch(/Network Evolution/)

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }))
    expect(screen.getByRole('button', { name: 'Timeline', pressed: true })).toBeDefined()
  })

  it('shows the Versions submode on the temporal-KG dataset', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('10 Temporal Knowledge Graphs')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    fireEvent.click(screen.getByRole('button', { name: 'Versions' }))
    expect(screen.getByRole('button', { name: 'Versions', pressed: true })).toBeDefined()
    expect(screen.getByTestId('temporal-showcase-view').textContent).toMatch(/Version History/)
  })

  it('switches between Centrality and Communities on the notebook suite', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-analytics'))
    expect(screen.getByRole('button', { name: 'Centrality', pressed: true })).toBeDefined()
    expect(screen.getByTestId('analytics-showcase-view').textContent).toMatch(/Centrality/)

    fireEvent.click(screen.getByRole('button', { name: 'Communities' }))
    expect(screen.getByRole('button', { name: 'Communities', pressed: true })).toBeDefined()
    expect(screen.getByTestId('analytics-showcase-view').textContent).toMatch(/Communities/)
  })

  it('disables unsupported temporal submodes on the temporal-KG dataset', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('10 Temporal Knowledge Graphs')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Versions' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Evolution' })).toHaveProperty('disabled', true)
    // Analytics lens is unsupported on this dataset: tab disabled.
    expect(screen.getByTestId('showcase-tab-analytics').getAttribute('aria-disabled')).toBe('true')
  })

  it('falls back per §4.1.3 when a dataset switch loses the selected lens', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-analytics'))
    fireEvent.click(screen.getByRole('button', { name: 'Communities' }))
    expect(screen.getByTestId('analytics-showcase-view')).toBeDefined()

    // Switch to a KG-only dataset: analytics is unsupported, so the screen
    // must land on knowledge-graph (first lens in canonical order) and must
    // not render stale analytics content.
    selectDataset('10 Graph Analytics')
    expect(screen.getByTestId('kg-showcase-view')).toBeDefined()
    expect(screen.queryByTestId('analytics-showcase-view')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Communities', pressed: true })).toBeNull()
  })

  it('keeps the temporal lens when the new dataset supports it, with canonical submode fallback', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(screen.getByRole('button', { name: 'Dashboard', pressed: true })).toBeDefined()

    // 10 Temporal Knowledge Graphs supports temporal but not the dashboard
    // submode: the lens is preserved and the submode falls back to the first
    // declared submode in canonical order (timeline).
    selectDataset('10 Temporal Knowledge Graphs')
    expect(screen.getByTestId('temporal-showcase-view')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Timeline', pressed: true })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveProperty('disabled', true)
  })

  it('includes the §9.6 coverage disclosure for Temporal and Analytics', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    const temporalDisclosure = screen.getByTestId('temporal-coverage-disclosure')
    expect(temporalDisclosure.textContent).toMatch(/Pinned Semantica notebook visualization cases/)
    expect(temporalDisclosure.textContent).toMatch(
      /Source-only Semantica visualization methods are not included in this showcase\./,
    )

    fireEvent.click(screen.getByTestId('showcase-tab-analytics'))
    const analyticsDisclosure = screen.getByTestId('analytics-coverage-disclosure')
    expect(analyticsDisclosure.textContent).toMatch(/Pinned Semantica notebook visualization cases/)
    expect(analyticsDisclosure.textContent).toMatch(
      /Source-only Semantica visualization methods are not included in this showcase\./,
    )
  })

  it('never claims full Semantica source-API parity in the screen copy', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    const page = screen.getByTestId('semantica-showcase-screen')
    expect(page.textContent).not.toMatch(/all Semantica visualizations/i)
    expect(page.textContent).not.toMatch(/complete Semantica visualization API/i)
  })

  it('does not surface source-only methods as notebook-parity controls', () => {
    renderWithProviders(<SemanticaShowcaseScreen />)
    selectDataset('03 Complete Visualization Suite')
    const page = screen.getByTestId('semantica-showcase-screen')
    for (const forbidden of [
      /temporal-patterns/i,
      /snapshot-comparison/i,
      /metrics-evolution/i,
      /connectivity/i,
      /degree-distribution/i,
      /metrics-dashboard/i,
      /centrality-comparison/i,
      /Temporal Patterns/,
      /Snapshot Comparison/,
      /Metrics Evolution/,
      /Degree Distribution/,
      /Centrality Comparison/,
    ]) {
      expect(page.textContent).not.toMatch(forbidden)
    }
  })
})