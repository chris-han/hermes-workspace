import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  copySensitiveGovernanceSegment,
  createSensitiveGovernanceAssessment,
  executeSensitiveGovernanceAssessment,
  fetchSensitiveGovernanceRun,
  replaySensitiveGovernanceRun,
  revealSensitiveGovernanceSegment,
  sensitiveGovernanceCanonicalJson,
  SENSITIVE_GOVERNANCE_HASH_PROFILE,
} from './sensitive-governance'

const fixtureUrl = new URL(
  '../../../tests/fixtures/sensitive_governance_contract_fixture_v1.json',
  import.meta.url,
)

function loadFixture(): Record<string, any> {
  return JSON.parse(readFileSync(fileURLToPath(fixtureUrl), 'utf-8'))
}

describe('sensitive governance contract mirror', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matches the Python canonical JSON byte vector and hash fixture', () => {
    const fixture = loadFixture()
    const canonicalJson = sensitiveGovernanceCanonicalJson(
      fixture.canonical_payload,
    )
    const canonicalHex = Buffer.from(canonicalJson, 'utf-8').toString('hex')
    const sha256 = createHash('sha256').update(canonicalJson).digest('hex')

    expect(fixture.hash_profile).toBe(SENSITIVE_GOVERNANCE_HASH_PROFILE)
    expect(canonicalHex).toBe(fixture.expected_canonical_json_utf8_hex)
    expect(sha256).toBe(fixture.expected_sha256)
  })

  it('uses the authenticated Semantier proxy for assessment, execute, run, reveal, copy, and replay requests', async () => {
    const requested: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        requested.push({ url, init })
        if (url.includes('/replay')) {
          return new Response(
            JSON.stringify({
              ok: true,
              replay: {
                run_id: 'sg_run_1',
                replayed_response_hash: 'hash',
                governed_response_hash: 'hash',
                matches: true,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes('/reveal')) {
          return new Response(
            JSON.stringify({
              ok: true,
              decision: {
                operation: 'reveal',
                response_id: 'sg_response_1',
                segment_id: 'seg_1',
                allowed: true,
                reason_codes: ['REVEAL_AUTHORIZED'],
                clear_value: 'temporary value',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes('/copy')) {
          return new Response(
            JSON.stringify({
              ok: true,
              decision: {
                operation: 'copy',
                response_id: 'sg_response_1',
                segment_id: 'seg_1',
                allowed: false,
                reason_codes: ['COPY_REQUIRES_SEPARATE_AUTHORIZATION'],
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes('/execute')) {
          return new Response(
            JSON.stringify({
              ok: true,
              run: { run_id: 'sg_run_1', governed_response: {} },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes('/runs/')) {
          return new Response(
            JSON.stringify({
              ok: true,
              run: { run_id: 'sg_run_1', governed_response: {} },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({
            ok: true,
            assessment: {
              assessment_id: 'sg_assessment_1',
              assessment_hash: 'hash',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )

    await createSensitiveGovernanceAssessment({
      idempotency_key: 'assess-1',
      content: 'fixture',
    })
    await executeSensitiveGovernanceAssessment('sg_assessment_1', {
      idempotency_key: 'execute-1',
      assessment_hash: 'hash',
      confirmation: true,
    })
    await fetchSensitiveGovernanceRun('sg_run_1')
    await revealSensitiveGovernanceSegment('sg_response_1', 'seg_1', {
      idempotency_key: 'reveal-1',
      confirmation: true,
    })
    await copySensitiveGovernanceSegment('sg_response_1', 'seg_1', {
      idempotency_key: 'copy-1',
      confirmation: true,
    })
    await replaySensitiveGovernanceRun('sg_run_1', {
      idempotency_key: 'replay-1',
    })

    expect(requested.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/api/semantier-proxy/api/sensitive-governance/assessments',
      '/api/semantier-proxy/api/sensitive-governance/assessments/sg_assessment_1/execute',
      '/api/semantier-proxy/api/sensitive-governance/runs/sg_run_1',
      '/api/semantier-proxy/api/sensitive-governance/responses/sg_response_1/segments/seg_1/reveal',
      '/api/semantier-proxy/api/sensitive-governance/responses/sg_response_1/segments/seg_1/copy',
      '/api/semantier-proxy/api/sensitive-governance/runs/sg_run_1/replay',
    ])
    expect(requested[0]?.init?.method).toBe('POST')
    expect(requested[1]?.init?.method).toBe('POST')
    expect(requested[3]?.init?.method).toBe('POST')
    expect(requested[4]?.init?.method).toBe('POST')
    expect(requested[5]?.init?.method).toBe('POST')
    const executeBody = JSON.parse(String(requested[1]?.init?.body || '{}'))
    expect(executeBody).toEqual({
      contract_version: 'sensitive_governance.v1',
      idempotency_key: 'execute-1',
      assessment_hash: 'hash',
      confirmation: true,
    })
    expect(JSON.stringify(executeBody)).not.toContain(
      'server_owned_transformed_input',
    )
    expect(JSON.parse(String(requested[3]?.init?.body || '{}'))).toEqual({
      contract_version: 'sensitive_governance.v1',
      idempotency_key: 'reveal-1',
      confirmation: true,
    })
    expect(JSON.parse(String(requested[4]?.init?.body || '{}'))).toEqual({
      contract_version: 'sensitive_governance.v1',
      idempotency_key: 'copy-1',
      confirmation: true,
    })
    expect(JSON.parse(String(requested[5]?.init?.body || '{}'))).toEqual({
      contract_version: 'sensitive_governance.v1',
      idempotency_key: 'replay-1',
    })
  })
})
