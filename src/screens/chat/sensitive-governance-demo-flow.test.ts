import { describe, expect, it, vi } from 'vitest'

import {
  resolveSensitiveGovernanceDemoContent,
  runSensitiveGovernanceDemoFlow,
  SENSITIVE_GOVERNANCE_DEMO_CONTENT,
  SENSITIVE_GOVERNANCE_DEMO_TRIGGER,
} from './sensitive-governance-demo-flow'

vi.mock('@/lib/sensitive-governance', () => ({
  createSensitiveGovernanceAssessment: vi.fn(async () => ({
    assessment_id: 'sg_assessment_chat_demo',
    state: 'PREPARED',
    assessment_hash: 'assessment_hash_chat_demo',
    request_hash: 'request_hash_chat_demo',
    prepared_payload: {
      input_governance: {
        route: 'PASS_AUTO',
        finding_count: 3,
      },
      server_owned_transformed_input: 'DO_NOT_RENDER',
    },
  })),
  executeSensitiveGovernanceAssessment: vi.fn(async () => ({
    run_id: 'sg_run_chat_demo',
    assessment_id: 'sg_assessment_chat_demo',
    state: 'SUCCEEDED',
    governed_response_hash: 'response_hash_chat_demo',
    governed_response: {
      response_id: 'sg_response_chat_demo',
      run_id: 'sg_run_chat_demo',
      contract_version: 'sensitive_governance.v1',
      response_hash: 'response_hash_chat_demo',
      governance_summary: {
        actions: ['SHOW', 'TOKENIZE', 'REDACT', 'NEVER_RENDER'],
      },
      pins: {
        contract_version: 'sensitive_governance.v1',
        ontology_version: 'soe_sensitive_governance_t1_v1',
        authority_bundle_version: 'soe_sensitive_governance_t2_t3_v1',
        policy_bundle_version: 'soe_sensitive_governance_t4_v1',
        display_profile_version: 'soe_sensitive_display_profile_v1',
        fixture_manifest_hash: 'fixture_hash',
      },
      segments: [],
    },
  })),
}))

describe('sensitive governance demo flow', () => {
  it('detects the explicit command and canned tender scenario', () => {
    expect(resolveSensitiveGovernanceDemoContent(SENSITIVE_GOVERNANCE_DEMO_TRIGGER)).toBe(
      SENSITIVE_GOVERNANCE_DEMO_CONTENT,
    )
    expect(
      resolveSensitiveGovernanceDemoContent(
        '评标专家：李四，预算控制价1000万元，API_KEY=sk-demo-secret，普通商密。',
      ),
    ).toContain('预算控制价')
    expect(resolveSensitiveGovernanceDemoContent('ordinary chat')).toBeNull()
  })

  it('appends input preview and governed response messages from backend AST', async () => {
    const appended: Array<any> = []

    const handled = await runSensitiveGovernanceDemoFlow({
      input: SENSITIVE_GOVERNANCE_DEMO_TRIGGER,
      appendAssistantMessage: (message) => appended.push(message),
    })

    expect(handled).toBe(true)
    expect(appended).toHaveLength(2)
    expect(appended[0].content[0]).toMatchObject({
      type: 'sensitiveGovernanceInputPreview',
      featureGate: 'sensitiveGovernance',
    })
    expect(appended[0]).toMatchObject({
      clientId: 'sg_assessment_chat_demo:input-preview',
      client_id: 'sg_assessment_chat_demo:input-preview',
    })
    expect(appended[1].content[0]).toMatchObject({
      type: 'governedResponse',
      featureGate: 'sensitiveGovernance',
      response: {
        run_id: 'sg_run_chat_demo',
        response_hash: 'response_hash_chat_demo',
      },
    })
    expect(appended[1]).toMatchObject({
      clientId: 'sg_run_chat_demo:governed-response',
      client_id: 'sg_run_chat_demo:governed-response',
    })
    expect(JSON.stringify(appended)).not.toContain('DO_NOT_RENDER')
  })
})
