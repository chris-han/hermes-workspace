// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  artifactMatchesHighlight,
  getInspectorCopy,
  loadInspectorMemorySnapshots,
  skillMatchesSessionAttachment,
  useInspectorStore,
  persistedArtifactDisplayTitle,
  sensitiveGovernanceEscalationInspectorDetails,
  sensitiveGovernanceResponseInspectorDetails,
} from './inspector-panel'
import { useActivityStore } from './activity-store'
import { defaultStudioSettings, useSettingsStore } from '@/hooks/use-settings'

vi.mock('@/hooks/use-feature-available', () => ({
  useFeatureAvailable: () => true,
}))

describe('persistedArtifactDisplayTitle', () => {
  it('uses the relative path for nested session artifacts', () => {
    expect(
      persistedArtifactDisplayTitle({
        relativePath: 'reimbursement/REIM-20260717-001.md',
        filename: 'REIM-20260717-001.md',
        path: '/workspace/session/artifacts/reimbursement/REIM-20260717-001.md',
      }),
    ).toBe('reimbursement/REIM-20260717-001.md')
  })
})

describe('artifactMatchesHighlight', () => {
  const artifact = {
    artifactId: 'report:abc123',
    filename: 'REIM-20260717-001.md',
    kind: 'governed_report',
    mediaType: 'text/markdown',
    path: '/workspace/sessions/session_abc/artifacts/reimbursement/REIM-20260717-001.md',
    rawUrl:
      '/sessions/session_abc/artifacts/reimbursement/REIM-20260717-001.md/raw',
    relativePath: 'reimbursement/REIM-20260717-001.md',
    sha256: 'abc123',
    sizeBytes: 128,
    timestamp: 1784301954839,
  }

  it('matches an encoded artifact selector hash to the persisted card', () => {
    expect(
      artifactMatchesHighlight(
        artifact,
        'reimbursement%2FREIM-20260717-001.md',
      ),
    ).toBe(true)
  })

  it('matches a raw session artifact URL to the same persisted card', () => {
    expect(
      artifactMatchesHighlight(
        artifact,
        '/sessions/session_abc/artifacts/reimbursement/REIM-20260717-001.md/raw',
      ),
    ).toBe(true)
  })
})

describe('InspectorPanel', () => {
  afterEach(() => {
    useInspectorStore.setState({
      isOpen: false,
      activeTab: 'activity',
      highlightedArtifact: null,
    })
    useSettingsStore.setState({
      settings: { ...defaultStudioSettings, locale: 'en' },
    })
    useActivityStore.setState({
      events: [],
      resolvedSessionKey: null,
    })
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds Chinese copy when the workspace locale is zh', () => {
    const copy = getInspectorCopy('zh')

    expect(copy.title).toBe('检查器')
    expect(copy.tabs.activity).toBe('活动')
    expect(copy.tabs.artifacts).toBe('制品')
    expect(copy.tabs.memory).toBe('记忆')
    expect(copy.tabs.skills).toBe('技能')
    expect(copy.tabs.logs).toBe('日志')
    expect(copy.empty.openSessionToSeeActivity).toBe('打开一个会话以查看活动')
    expect(copy.labels.assignedRole).toBe('分配角色')
    expect(copy.labels.reasonCodes).toBe('原因码')
    expect(copy.labels.replayStatus).toBe('重放状态')
  })

  it('formats sensitive governance escalation details for the activity inspector', () => {
    expect(
      sensitiveGovernanceEscalationInspectorDetails(
        {
          assessmentId: 'sg_assessment_1',
          assessmentHash: 'assessment_hash_1',
          escalationId: 'sg_escalation_1',
          assignedRole: 'governance_security_reviewer',
          assignedPrincipal: 'org_1:governance_security_reviewer',
          status: 'open',
          blocked: true,
          reasonCodes: ['policy_escalation_required'],
        },
        'fallback_escalation',
      ),
    ).toEqual({
      assessmentId: 'sg_assessment_1',
      assessmentHash: 'assessment_hash_1',
      escalationId: 'sg_escalation_1',
      assignedRole: 'governance_security_reviewer',
      assignedPrincipal: 'org_1:governance_security_reviewer',
      status: 'open',
      blocked: 'true',
      reasonCodes: ['policy_escalation_required'],
    })
  })

  it('formats sensitive governance response evidence for the activity inspector', () => {
    expect(
      sensitiveGovernanceResponseInspectorDetails({
        runId: 'sg_run_1',
        responseId: 'sg_response_1',
        responseHash: 'response_hash_1',
        assessmentId: 'sg_assessment_1',
        displayJustificationRef: 'sg_display_justification_1',
        displayAdmissibilityRef: 'sg_display_admissibility_1',
        ontologyVersion: 'soe_sensitive_governance_t1_v1',
        authorityBundleVersion: 'soe_sensitive_governance_t2_t3_v1',
        policyBundleVersion: 'soe_sensitive_governance_t4_v1',
        displayProfileVersion: 'soe_sensitive_display_profile_v1',
        classifications: ['PUBLIC_INFORMATION', 'CREDENTIAL_OR_SECRET'],
        displayActions: ['SHOW', 'NEVER_RENDER'],
        replayPins: { execution_terminal_event_id: 'sg_event_terminal_1' },
        replayStatus: 'matched',
        replayedResponseHash: 'response_hash_1',
        replayGovernedResponseHash: 'response_hash_1',
        replayPolicyOutcomesHash: 'policy_hash_1',
      }),
    ).toEqual({
      runId: 'sg_run_1',
      responseId: 'sg_response_1',
      responseHash: 'response_hash_1',
      assessmentId: 'sg_assessment_1',
      displayJustificationRef: 'sg_display_justification_1',
      displayAdmissibilityRef: 'sg_display_admissibility_1',
      ontologyVersion: 'soe_sensitive_governance_t1_v1',
      authorityBundleVersion: 'soe_sensitive_governance_t2_t3_v1',
      policyBundleVersion: 'soe_sensitive_governance_t4_v1',
      displayProfileVersion: 'soe_sensitive_display_profile_v1',
      classifications: ['PUBLIC_INFORMATION', 'CREDENTIAL_OR_SECRET'],
      displayActions: ['SHOW', 'NEVER_RENDER'],
      replayPins: { execution_terminal_event_id: 'sg_event_terminal_1' },
      replayStatus: 'matched',
      replayedResponseHash: 'response_hash_1',
      replayGovernedResponseHash: 'response_hash_1',
      replayPolicyOutcomesHash: 'policy_hash_1',
    })
  })

  it('matches session-attached Hermes bundled skills exposed through the Semantier shim', () => {
    expect(
      skillMatchesSessionAttachment(
        {
          id: 'research/llm-wiki',
          name: 'llm-wiki',
          category: 'research',
          description: 'Hermes bundled wiki research skill',
          enabled: true,
          builtin: true,
          sourceLabel: 'Bundled',
          hubIdentifier: 'hermes-agent/skills/research/llm-wiki',
          hubSource: 'hermes-agent',
          packagePath: 'hermes-agent/skills/research/llm-wiki',
          packageType: 'bundled-skill',
        },
        new Set(['llm-wiki']),
        new Set(),
      ),
    ).toBe(true)

    expect(
      skillMatchesSessionAttachment(
        {
          id: 'research/llm-wiki',
          name: 'llm-wiki',
          packagePath: 'hermes-agent/skills/research/llm-wiki',
        },
        new Set(['research/llm-wiki']),
        new Set(),
      ),
    ).toBe(true)

    expect(
      skillMatchesSessionAttachment(
        {
          id: 'research/llm-wiki',
          name: 'llm-wiki',
          packagePath: 'hermes-agent/skills/research/llm-wiki',
        },
        new Set(),
        new Set(['hermes-agent/skills/research/llm-wiki']),
      ),
    ).toBe(true)
  })

  it('loads the live MEMORY.md file in the inspector memory tab', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('path=MEMORY.md')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ path: 'MEMORY.md', content: 'new memory line' }),
        })
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      })
    })
    const snapshots = await loadInspectorMemorySnapshots(
      null,
      fetchMock as typeof fetch,
    )

    expect(snapshots).toEqual([
      {
        kind: 'live-memory-file',
        title: 'Live MEMORY.md',
        content: 'new memory line',
        source: 'live.memory.MEMORY.md',
      },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/semantier-proxy/api/memory/read?path=MEMORY.md',
    )
  })

  it('includes session memory snapshots and live memory when a session key is available', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/memory-snapshot')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            snapshots: [
              {
                kind: 'session-memory',
                title: 'Session Memory',
                content: 'session item',
                source: 'session_db.system_prompt',
              },
            ],
          }),
        })
      }
      if (url.includes('path=USER.md')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ path: 'USER.md', content: 'live user memory' }),
        })
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      })
    })

    const snapshots = await loadInspectorMemorySnapshots(
      'session_5acbdc8a0d98',
      fetchMock as typeof fetch,
    )

    expect(snapshots).toEqual([
      {
        kind: 'session-memory',
        title: 'Session Memory',
        content: 'session item',
        source: 'session_db.system_prompt',
      },
      {
        kind: 'live-memory-file',
        title: 'Live USER.md',
        content: 'live user memory',
        source: 'live.memory.USER.md',
      },
    ])
  })

  it('treats a missing live memory file as an empty state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    })

    const snapshots = await loadInspectorMemorySnapshots(
      null,
      fetchMock as typeof fetch,
    )

    expect(snapshots).toEqual([])
  })
})
