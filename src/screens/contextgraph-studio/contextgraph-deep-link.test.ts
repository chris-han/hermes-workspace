import { describe, expect, it } from 'vitest'

import {
  buildDeepLinkSearchParams,
  parseDeepLinkFromSearchParams,
  validateDeepLinkAgainstIdentity,
  type DeepLinkSelection,
} from './contextgraph-deep-link'

const identity = {
  graphRef: 'graph_v12',
  graphVersion: 'graph_v12',
  graphHash: 'sha256:abcd',
  authorityState: 'candidate' as const,
  semanticaCommit: null,
}

const mvl = {
  v0RunRef: 'phase1-001-v0',
  v1RunRef: 'phase1-001-v1',
  evaluationRunId: 'mvl_phase1_eval_001',
}

const viewModel = {
  nodes: [{ id: 'rule-001' }, { id: 'concept-1' }],
  edges: [{ id: 'e_requires' }],
}

describe('contextgraph-deep-link', () => {
  it('parses a graph deep link from URLSearchParams', () => {
    const params = new URLSearchParams(
      'mode=graph&graph_ref=graph_v12&node_id=rule-001',
    )
    const link = parseDeepLinkFromSearchParams(params)
    expect(link).toEqual({
      mode: 'graph',
      graphRef: 'graph_v12',
      nodeId: 'rule-001',
    })
  })

  it('returns null for unknown mode values', () => {
    const params = new URLSearchParams('mode=does-not-exist')
    expect(parseDeepLinkFromSearchParams(params)).toBeNull()
  })

  it('returns null when mode is missing', () => {
    expect(parseDeepLinkFromSearchParams(new URLSearchParams(''))).toBeNull()
  })

  it('accepts a graph deep link that resolves against current identity', () => {
    const link: DeepLinkSelection = {
      mode: 'graph',
      graphRef: 'graph_v12',
      graphVersion: 'graph_v12',
      nodeId: 'rule-001',
    }
    const validated = validateDeepLinkAgainstIdentity(link, identity, viewModel, mvl)
    expect(validated).toEqual(link)
  })

  it('rejects a graph deep link that targets a different graph', () => {
    const link: DeepLinkSelection = {
      mode: 'graph',
      graphRef: 'graph_v99',
      graphVersion: 'graph_v12',
    }
    expect(validateDeepLinkAgainstIdentity(link, identity, viewModel, mvl)).toBeNull()
  })

  it('rejects a graph deep link when nodeId does not resolve in the view model', () => {
    const link: DeepLinkSelection = {
      mode: 'graph',
      graphRef: 'graph_v12',
      nodeId: 'unknown-node',
    }
    expect(validateDeepLinkAgainstIdentity(link, identity, viewModel, mvl)).toBeNull()
  })

  it('rejects a compare deep link when v0_run_ref mismatches persisted MVL', () => {
    const link: DeepLinkSelection = {
      mode: 'compare',
      v0RunRef: 'unknown-run',
      v1RunRef: 'phase1-001-v1',
    }
    expect(validateDeepLinkAgainstIdentity(link, identity, viewModel, mvl)).toBeNull()
  })

  it('accepts an evaluate deep link when evaluation_run_id matches persisted MVL', () => {
    const link: DeepLinkSelection = {
      mode: 'evaluate',
      evaluationRunId: 'mvl_phase1_eval_001',
    }
    const validated = validateDeepLinkAgainstIdentity(link, identity, viewModel, mvl)
    expect(validated).toEqual(link)
  })

  it('rejects a ground deep link when candidate_id is empty', () => {
    const link: DeepLinkSelection = { mode: 'ground' }
    expect(validateDeepLinkAgainstIdentity(link, identity, viewModel, mvl)).toEqual(link)
  })

  it('round-trips a deep link through buildDeepLinkSearchParams', () => {
    const link: DeepLinkSelection = {
      mode: 'compare',
      v0RunRef: 'phase1-001-v0',
      v1RunRef: 'phase1-001-v1',
      assertionId: 'assertion-001',
    }
    const search = buildDeepLinkSearchParams(link)
    const parsed = parseDeepLinkFromSearchParams(new URLSearchParams(search))
    expect(parsed).toEqual(link)
  })
})