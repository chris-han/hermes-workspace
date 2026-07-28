import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  createPolicyRuleCandidate,
  listPolicyRuleCandidates,
} from '../../../server/policy-rule-studio'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/policy-rules')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await resolveActiveWorkspaceRoot(request.headers)
          const candidates = await listPolicyRuleCandidates(request.headers)
          return json({ candidates })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load policy-rule candidates',
            },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        try {
          await resolveActiveWorkspaceRoot(request.headers)
          const body = await request.json()
          const candidate = await createPolicyRuleCandidate(
            request.headers,
            body as Parameters<typeof createPolicyRuleCandidate>[1],
          )
          return json({ candidate })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to create policy-rule candidate',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
