import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createKnowledgeBuilderDiscoveryRun,
  createCanonicalTermCandidate,
  compileKnowledgeBuilderSensitiveLexicon,
  curateKnowledgeBuilderRelation,
  getKnowledgeBuilderCandidateExplanation,
  getKnowledgeBuilderDiscoveryRun,
  getKnowledgeBuilderRuntimeSemanticIndex,
  isKnowledgeBuilderRuntimeAuthority,
  listKnowledgeBuilderFeedbackDeltas,
  mergeKnowledgeBuilderClusters,
  promoteKnowledgeBuilderRuntimeSemantics,
  rebuildKnowledgeBuilderReadModels,
  splitKnowledgeBuilderCluster,
} from './knowledge-builder'
import { decodeStagedUploadRef, writeKnowledgeUpload } from './knowledge-files'

describe('knowledge-builder server adapter', () => {
  const originalFetch = globalThis.fetch
  const createdRoots: Array<string> = []

  afterEach(() => {
    globalThis.fetch = originalFetch
    for (const root of createdRoots.splice(0)) {
      fsSync.rmSync(root, { recursive: true, force: true })
    }
  })

  it('creates discovery runs through governed backend routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/discovery-runs')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body))
      expect(body.sourceRef).toBe('uploads/knowledge-builder/source.docx')
      expect(body.sourceText).toBeUndefined()
      return new Response(
        JSON.stringify({
          run: {
            discovery_run_id: 'kbd_1',
            governance_state: 'DISCOVERED',
          },
        }),
        { status: 200 },
      )
    }

    const run = await createKnowledgeBuilderDiscoveryRun(new Headers(), {
      sourceKind: 'file',
      sourceRef: 'uploads/knowledge-builder/source.docx',
    })
    expect(run.discovery_run_id).toBe('kbd_1')
  })

  it('preserves governed upload ingest failure details', async () => {
    const workspaceRoot = fsSync.mkdtempSync(
      path.join(os.tmpdir(), 'knowledge-builder-ingest-failure-'),
    )
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      new File(['docx'], 'source.docx'),
      'uploads',
      {
        forceWorkspaceWikiRoot: true,
        sessionId: 'knowledge-builder',
        workspaceId: 'ws-1',
      },
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest') {
      throw new Error('stage failed')
    }
    const staged = decodeStagedUploadRef(upload.stagedUploadRef)
    fsSync.rmSync(path.join(workspaceRoot, staged.relativePath))

    await expect(
      compileKnowledgeBuilderSensitiveLexicon(new Headers(), {
        authenticated: true,
        path: workspaceRoot,
        workspaceId: 'ws-1',
        workspaceSlug: 'ws-1',
        organizationId: 'org-1',
        source: 'backend',
      }, {
        uploadRef: upload.stagedUploadRef,
      }),
    ).rejects.toThrow(
      'Governed upload ref is not available (invalid_upload_ref)',
    )
  })

  it('loads discovery-run previews without legacy graph routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/discovery-runs/kbd_1')
      expect(String(input)).not.toContain('/graph')
      expect(init?.method ?? 'GET').toBe('GET')
      return new Response(
        JSON.stringify({
          run: {
            discovery_run_id: 'kbd_1',
            governance_state: 'DISCOVERED',
          },
        }),
        { status: 200 },
      )
    }

    const run = await getKnowledgeBuilderDiscoveryRun(new Headers(), 'kbd_1')
    expect(run.discovery_run_id).toBe('kbd_1')
    expect(run.governance_state).toBe('DISCOVERED')
    expect(isKnowledgeBuilderRuntimeAuthority('DISCOVERED')).toBe(false)
  })

  it('loads candidate explanations', async () => {
    globalThis.fetch = async (input) => {
      expect(String(input)).toContain('/api/knowledge/builder/candidates/kbn_1/explanation')
      return new Response(
        JSON.stringify({
          explanation: {
            candidate_id: 'kbn_1',
            is_runtime_authority: false,
          },
        }),
        { status: 200 },
      )
    }

    const explanation = await getKnowledgeBuilderCandidateExplanation(
      new Headers(),
      'kbn_1',
    )
    expect(explanation.is_runtime_authority).toBe(false)
  })

  it('curates relation candidates through governed backend routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/relations/kbr_1/curation')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body)).relationType).toBe('not_same_as')
      return new Response(
        JSON.stringify({
          relationCandidate: {
            semantic_relation_candidate_id: 'src_1',
            relation_type: 'not_same_as',
          },
        }),
        { status: 200 },
      )
    }

    const candidate = await curateKnowledgeBuilderRelation(new Headers(), {
      relationId: 'kbr_1',
      decision: 'change',
      relationType: 'not_same_as',
      reviewerNotes: 'false friend',
    })
    expect(candidate.relation_type).toBe('not_same_as')
  })

  it('routes cluster split and merge curation actions', async () => {
    const seen: Array<string> = []
    globalThis.fetch = async (input, init) => {
      seen.push(String(input))
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          curationEvent: { curation_event_id: `evt_${seen.length}` },
        }),
        { status: 200 },
      )
    }

    await splitKnowledgeBuilderCluster(new Headers(), {
      clusterId: 'kbc_1',
      nodeIds: ['kbn_1', 'kbn_2'],
    })
    await mergeKnowledgeBuilderClusters(new Headers(), {
      clusterIds: ['kbc_1', 'kbc_2'],
    })
    expect(seen[0]).toContain('/api/knowledge/builder/clusters/kbc_1/split')
    expect(seen[1]).toContain('/api/knowledge/builder/clusters/merge')
  })

  it('creates canonical term candidates without activating runtime authority', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/canonical-terms')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body)).governanceState).toBe('PROPOSED')
      return new Response(
        JSON.stringify({
          termCandidate: {
            term_candidate_id: 'ctc_1',
            governance_state: 'PROPOSED',
          },
        }),
        { status: 200 },
      )
    }

    const term = await createCanonicalTermCandidate(new Headers(), {
      discoveryRunId: 'kbd_1',
      domain: 'tender_compliance',
      canonicalLabel: 'exclusive supplier restriction',
      definition: 'Restrictive supplier wording.',
      aliases: ['唯一供应商'],
      allowedContexts: ['supplier qualification evidence'],
      prohibitedContexts: ['unique serial number'],
      sourceAnchorRefs: ['kba_1'],
      evidenceSummary: 'reviewed neighborhood',
      proposedRuntimeEffect: { control_family: 'tender_compliance' },
      governanceState: 'PROPOSED',
    })
    expect(term.governance_state).toBe('PROPOSED')
  })

  it('promotes activated semantic authority and rebuilds read models', async () => {
    const seen: Array<string> = []
    globalThis.fetch = async (input, init) => {
      seen.push(String(input))
      if (String(input).includes('/api/knowledge/builder/promotions')) {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body)).termCandidateId).toBe('ctc_1')
        return new Response(
          JSON.stringify({
            authorityVersion: {
              authority_version_id: 'rsav_1',
              authority_state: 'ACTIVATED',
            },
          }),
          { status: 200 },
        )
      }
      if (String(input).includes('/api/knowledge/builder/read-model-rebuilds')) {
        expect(init?.method).toBe('POST')
        return new Response(
          JSON.stringify({
            readModelRebuild: {
              rebuild_id: 'rsrb_1',
              rebuild_status: 'completed',
            },
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          authorityVersion: { authority_version_id: 'rsav_1' },
          readModel: { term_resolution_index: [] },
        }),
        { status: 200 },
      )
    }

    const authority = await promoteKnowledgeBuilderRuntimeSemantics(new Headers(), {
      termCandidateId: 'ctc_1',
      semanticRelationCandidateIds: ['src_1'],
      evaluationRunId: 'kber_1',
    })
    const rebuild = await rebuildKnowledgeBuilderReadModels(new Headers(), {
      authorityVersionId: 'rsav_1',
    })
    await getKnowledgeBuilderRuntimeSemanticIndex(new Headers(), 'rsav_1')
    expect(authority.authority_state).toBe('ACTIVATED')
    expect(rebuild.rebuild_status).toBe('completed')
    expect(seen[2]).toContain('/api/knowledge/builder/runtime-semantic-index/rsav_1')
  })

  it('lists feedback-derived candidate deltas for Knowledge Builder review', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/feedback-deltas?discoveryRunId=kbd_1')
      expect(init?.method ?? 'GET').toBe('GET')
      return new Response(
        JSON.stringify({
          feedbackDeltas: [
            {
              candidate_delta_id: 'rfcd_1',
              delta_kind: 'not_same_as',
              governance_state: 'DISCOVERED',
            },
          ],
        }),
        { status: 200 },
      )
    }

    const deltas = await listKnowledgeBuilderFeedbackDeltas(new Headers(), 'kbd_1')
    expect(deltas[0].delta_kind).toBe('not_same_as')
  })
})
