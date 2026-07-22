import {
  createSensitiveGovernanceAssessment,
  executeSensitiveGovernanceAssessment,
} from '@/lib/sensitive-governance'
import type {
  SensitiveGovernanceAssessment,
  SensitiveGovernanceRun,
} from '@/lib/sensitive-governance'
import type { ChatMessage } from './types'

export const SENSITIVE_GOVERNANCE_DEMO_TRIGGER =
  '/sensitive-governance-demo'

export const SENSITIVE_GOVERNANCE_DEMO_CONTENT =
  '评标专家：李四 手机13900139000，身份证11010119900307453X，预算控制价1000万元，API_KEY=sk-demo-secret，普通商密。'

export function resolveSensitiveGovernanceDemoContent(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === SENSITIVE_GOVERNANCE_DEMO_TRIGGER) {
    return SENSITIVE_GOVERNANCE_DEMO_CONTENT
  }
  if (
    trimmed.includes('评标专家') &&
    trimmed.includes('预算控制价') &&
    (trimmed.includes('API_KEY') || trimmed.includes('普通商密'))
  ) {
    return trimmed
  }
  return null
}

export function sensitiveGovernanceInputPreviewMessage(
  assessment: SensitiveGovernanceAssessment,
): ChatMessage {
  const preparedPayload = { ...(assessment.prepared_payload || {}) }
  delete preparedPayload.server_owned_transformed_input
  const sanitizedAssessment = {
    ...assessment,
    prepared_payload: preparedPayload,
  }
  return {
    role: 'assistant',
    content: [
      {
        type: 'sensitiveGovernanceInputPreview',
        featureGate: 'sensitiveGovernance',
        assessment: sanitizedAssessment,
      },
    ],
    timestamp: Date.now(),
    id: `${assessment.assessment_id}:input-preview`,
    clientId: `${assessment.assessment_id}:input-preview`,
    client_id: `${assessment.assessment_id}:input-preview`,
  }
}

export function sensitiveGovernanceResponseMessage(
  run: SensitiveGovernanceRun,
): ChatMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'governedResponse',
        featureGate: 'sensitiveGovernance',
        response: run.governed_response,
      },
    ],
    timestamp: Date.now(),
    id: `${run.run_id}:governed-response`,
    clientId: `${run.run_id}:governed-response`,
    client_id: `${run.run_id}:governed-response`,
  }
}

export async function runSensitiveGovernanceDemoFlow({
  input,
  appendAssistantMessage,
}: {
  input: string
  appendAssistantMessage: (message: ChatMessage) => void
}): Promise<boolean> {
  const content = resolveSensitiveGovernanceDemoContent(input)
  if (!content) return false
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : String(Date.now())
  const assessment = await createSensitiveGovernanceAssessment({
    idempotency_key: `chat-demo-assessment-${nonce}`,
    content,
    purpose: 'soe_tender_review',
    destination: 'local_simulated_agent',
    session_id: 'chat_sensitive_governance_demo',
  })
  appendAssistantMessage(sensitiveGovernanceInputPreviewMessage(assessment))
  if (assessment.state !== 'PREPARED') return true
  const run = await executeSensitiveGovernanceAssessment(assessment.assessment_id, {
    idempotency_key: `chat-demo-execute-${nonce}`,
    assessment_hash: assessment.assessment_hash,
    confirmation: true,
  })
  appendAssistantMessage(sensitiveGovernanceResponseMessage(run))
  return true
}
