import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  extractSensitiveGovernanceInputPreview,
  extractSensitiveGovernanceResponse,
  MessageItem,
} from './message-item'
import { buildSensitiveGovernanceEscalationActivity as buildEscalationActivity } from './input-governance-preview'
import {
  buildGovernedResponseInspectorActivity,
  deriveRevealRenderState,
  sensitiveGovernanceRevealWatermark,
} from './governed-response-renderer'
import type { ChatMessage } from '../types'

vi.mock('@/hooks/use-resolved-avatar', () => ({
  useResolvedDisplayName: () => 'User',
  useResolvedAvatarUrl: () => '',
}))

vi.mock('@/components/avatars', () => ({
  AssistantAvatar: () => <div data-testid="assistant-avatar" />,
  UserAvatar: () => <div data-testid="user-avatar" />,
}))

vi.mock('./message-actions-bar', () => ({
  MessageActionsBar: () => null,
}))

vi.mock('./a2ui-renderer', () => ({
  A2UiRenderer: () => <div data-testid="a2ui-renderer">A2UI</div>,
}))

describe('MessageItem integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders assistant body text only once when a2ui blocks are present', () => {
    const marker = 'RAW_DUP_CHECK_TOKEN'
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `去年利润率分析\n\n- ${marker}`,
        },
        {
          type: 'a2ui',
          id: 'ui-1',
          schema: {
            nodes: [
              {
                component: 'text',
                props: { text: 'Form placeholder' },
              },
            ],
          },
        },
      ],
      timestamp: Date.now(),
    }

    const html = renderToStaticMarkup(
      <MessageItem message={message} onA2UiSubmit={() => {}} />,
    )

    expect(html).toContain('data-testid="a2ui-renderer"')
    expect(html.match(new RegExp(marker, 'g')) ?? []).toHaveLength(1)
  })

  it('renders governed response segments without leaking forbidden browser values', () => {
    const fixtureUrl = new URL(
      '../../../../../tests/fixtures/sensitive_governance_contract_fixture_v1.json',
      import.meta.url,
    )
    const fixture = JSON.parse(
      readFileSync(fileURLToPath(fixtureUrl), 'utf-8'),
    )
    const response = {
      ...fixture.canonical_payload.governed_response,
      response_hash: fixture.expected_sha256,
    }
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'governedResponse',
          featureGate: 'sensitiveGovernance',
          response,
        },
      ],
      timestamp: Date.now(),
    }

    expect(extractSensitiveGovernanceResponse(message)?.response_id).toBe(
      'sg_response_fixture',
    )

    const html = renderToStaticMarkup(<MessageItem message={message} />)

    expect(html).toContain('Governance Summary')
    expect(html).toContain('data-governed-response-id="sg_response_fixture"')
    expect(html).toContain('Never render')
    expect(html).toContain('data-segment-kind="plain-text"')
    expect(html).toContain('data-segment-kind="sensitive-text"')
    expect(html).toContain('data-segment-kind="redacted-placeholder"')
    expect(html).toContain('data-segment-kind="never-render-notice"')
    expect(html).toContain('href="#governance-run=sg_run_fixture&amp;segment=seg_secret_never_render"')
    expect(html).toContain('<summary')
    expect(html).toContain('Evidence')
    expect(html).toContain('aria-label="Reveal segment"')
    expect(html).toContain('aria-label="Request governed copy"')
    expect(html).toContain('PUBLIC_INFORMATION')
    expect(html).toContain('CREDENTIAL_OR_SECRET')
    for (const forbidden of fixture.forbidden_browser_values) {
      expect(html).not.toContain(forbidden)
    }
    expect(html).not.toContain('restricted://')
    expect(html).not.toContain('budget-token-1')
    const rankMatches = [...html.matchAll(/data-action-rank="(\d+)"/g)].map(
      (match) => Number(match[1]),
    )
    expect(rankMatches).toEqual(expect.arrayContaining([0, 2, 3, 4]))
    for (const segment of response.segments) {
      const expectedMinimum =
        segment.display_action === 'SHOW'
          ? 0
          : segment.display_action === 'MASK'
            ? 1
            : segment.display_action === 'TOKENIZE'
              ? 2
              : segment.display_action === 'REDACT'
                ? 3
                : 4
      expect(rankMatches).toContain(expectedMinimum)
    }
    const neverRenderSection =
      html.match(
        /<section[^>]*data-governed-segment-id="seg_secret_never_render"[\s\S]*?<\/section>/,
      )?.[0] || ''
    expect(neverRenderSection).toContain('Never render')
    expect(neverRenderSection).not.toContain('Reveal segment')
    expect(neverRenderSection).not.toContain('Request governed copy')
  })

  it('builds inspector response evidence from governed response AST', () => {
    const fixtureUrl = new URL(
      '../../../../../tests/fixtures/sensitive_governance_contract_fixture_v1.json',
      import.meta.url,
    )
    const fixture = JSON.parse(
      readFileSync(fileURLToPath(fixtureUrl), 'utf-8'),
    )
    const response = {
      ...fixture.canonical_payload.governed_response,
      response_hash: fixture.expected_sha256,
      governance_summary: {
        ...fixture.canonical_payload.governed_response.governance_summary,
        display_justification_ref: 'sg_display_justification_fixture',
        display_admissibility_ref: 'sg_display_admissibility_fixture',
      },
    }

    const activity = buildGovernedResponseInspectorActivity(response, 'session_1', {
      run_id: 'sg_run_fixture',
      replayed_response_hash: fixture.expected_sha256,
      governed_response_hash: fixture.expected_sha256,
      matches: true,
      policy_outcomes_hash: 'policy_outcomes_hash_fixture',
    })

    expect(activity.details).toMatchObject({
      event: 'sensitive_governance_response',
      sessionKey: 'session_1',
      runId: 'sg_run_fixture',
      responseId: 'sg_response_fixture',
      displayJustificationRef: 'sg_display_justification_fixture',
      displayAdmissibilityRef: 'sg_display_admissibility_fixture',
      ontologyVersion: 'soe_sensitive_governance_t1_v1',
      authorityBundleVersion: 'soe_sensitive_governance_t2_t3_v1',
      policyBundleVersion: 'soe_sensitive_governance_t4_v1',
      displayProfileVersion: 'soe_sensitive_display_profile_v1',
      replayStatus: 'matched',
      replayedResponseHash: fixture.expected_sha256,
      replayGovernedResponseHash: fixture.expected_sha256,
      replayPolicyOutcomesHash: 'policy_outcomes_hash_fixture',
    })
    expect(activity.details.classifications).toContain('CREDENTIAL_OR_SECRET')
    expect(activity.details.displayActions).toContain('NEVER_RENDER')
  })

  it('derives reveal render state and watermark without persistent storage fields', () => {
    const revealed = deriveRevealRenderState({
      operation: 'reveal',
      response_id: 'sg_response_1',
      segment_id: 'seg_expert_token',
      allowed: true,
      reason_codes: ['REVEAL_AUTHORIZED'],
      clear_value: 'temporary expert value',
      expires_at: '2026-07-22T12:00:20+00:00',
    })
    const expired = deriveRevealRenderState({
      operation: 'reveal',
      response_id: 'sg_response_1',
      segment_id: 'seg_expert_token',
      allowed: false,
      reason_codes: ['REVEAL_LEASE_EXPIRED'],
    })

    expect(revealed).toMatchObject({
      state: 'revealed',
      clearValue: 'temporary expert value',
      reasonCodes: ['REVEAL_AUTHORIZED'],
    })
    expect(expired).toEqual({
      state: 'expired',
      clearValue: null,
      expiresAt: null,
      reasonCodes: ['REVEAL_LEASE_EXPIRED'],
    })
    expect(
      sensitiveGovernanceRevealWatermark(
        'sg_run_12345678',
        'seg_expert_token',
      ),
    ).toBe('REVEAL 12345678 rt_token')
  })

  it('renders sensitive governance input preview without transformed payload text', () => {
    const assessment = {
      assessment_id: 'sg_assessment_preview',
      state: 'PREPARED',
      assessment_hash: '0123456789abcdef0123456789abcdef',
      request_hash: 'request_hash',
      prepared_payload: {
        input_governance: {
          status: 'PREPARED',
          route: 'PASS_AUTO',
          finding_count: 3,
          destination: 'external_agent',
          policy_bundle_version: 'soe_sensitive_governance_t4_v1',
          decisions: [
            {
              finding_class: 'TENDER_SENSITIVE_INFORMATION',
              enforcement_action: 'REDACT',
            },
            {
              finding_class: 'CREDENTIAL_OR_SECRET',
              enforcement_action: 'BLOCK',
            },
          ],
          transformations: [{ action: 'REDACT' }, { action: 'BLOCK' }],
        },
        execution_intent: {
          agent_boundary: 'local_simulated_agent',
          transformed_input_hash: 'abcdef0123456789',
        },
        agent_boundary_comparison: {
          raw_request_hash: 'raw0123456789abcdef',
          raw_detected_classes: [
            'TENDER_SENSITIVE_INFORMATION',
            'CREDENTIAL_OR_SECRET',
          ],
          governed_payload_hash: 'abcdef0123456789',
          restricted_request_ref:
            'restricted://sensitive-governance/transformed-input/abcdef0123456789',
          transformation_actions: ['REDACT', 'BLOCK'],
          residual_scan_evidence_ref: 'sg_residual_scan_preview',
          critical_residual_sensitive_data: false,
        },
        server_owned_transformed_input: 'DO_NOT_RENDER_TRANSFORMED_PAYLOAD',
      },
    }
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'sensitiveGovernanceInputPreview',
          featureGate: 'sensitiveGovernance',
          assessment,
        },
      ],
      timestamp: Date.now(),
    }

    expect(
      extractSensitiveGovernanceInputPreview(message)?.assessment_id,
    ).toBe('sg_assessment_preview')

    const html = renderToStaticMarkup(<MessageItem message={message} />)

    expect(html).toContain('Input Governance')
    expect(html).toContain('Raw synthetic input')
    expect(html).toContain('Governed agent payload')
    expect(html).toContain(
      'data-sensitive-governance-input-preview="sg_assessment_preview"',
    )
    expect(html).toContain('data-sensitive-governance-boundary-comparison="true"')
    expect(html).toContain('raw0123456789abc')
    expect(html).toContain('abcdef0123456789')
    expect(html).toContain('restricted://sensitive-governance/transformed-input/')
    expect(html).toContain('No critical residual')
    expect(html).toContain('external_agent')
    expect(html).toContain('CREDENTIAL_OR_SECRET')
    expect(html).not.toContain('DO_NOT_RENDER_TRANSFORMED_PAYLOAD')
  })

  it('builds inspector escalation activity evidence from input preview', () => {
    const assessment = {
      assessment_id: 'sg_assessment_escalated',
      state: 'ESCALATED',
      assessment_hash: 'hash_escalated',
      request_hash: 'request_hash',
      prepared_payload: {
        input_governance: {
          status: 'ESCALATED',
          route: 'ESCALATE',
          escalation: {
            escalation_id: 'sg_escalation_1',
            assigned_role: 'governance_security_reviewer',
            assigned_principal: 'org_1:governance_security_reviewer',
            initial_status: 'open',
            execution_blocked: true,
            reason_codes: ['policy_escalation_required'],
          },
        },
      },
    }

    const activity = buildEscalationActivity(assessment, 'session_1')

    expect(activity?.type).toBe('sensitive_governance_escalation')
    expect(activity?.details).toMatchObject({
      event: 'sensitive_governance_escalation',
      sessionKey: 'session_1',
      assessmentId: 'sg_assessment_escalated',
      escalationId: 'sg_escalation_1',
      assignedRole: 'governance_security_reviewer',
      assignedPrincipal: 'org_1:governance_security_reviewer',
      status: 'open',
      blocked: true,
      reasonCodes: ['policy_escalation_required'],
    })
  })
})
