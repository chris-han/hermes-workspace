import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  governedPreferenceRouteForScope,
  normalizeKnowledgeBaseConfigForWorkspace,
  readKnowledgeBaseConfig,
  readGovernedKnowledgeDatasetGovernance,
  resolveKnowledgeBaseConfig,
  writeKnowledgeBaseConfig,
} from '../../../server/knowledge-config'
import type {
  KnowledgeBaseConfig,
  KnowledgeContextPreferencePatch,
} from '../../../server/knowledge-config'
import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from '../../../server/semantier-agent-api'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const resolved = resolveKnowledgeBaseConfig(activeWorkspace.path, {
            datasetType: activeWorkspace.datasetType,
          })
          const datasetGovernance =
            await readGovernedKnowledgeDatasetGovernance(request.headers)
          return json({
            config: resolved.config,
            resolved,
            datasetGovernance,
          })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read knowledge base config',
            },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const workspaceRoot = activeWorkspace.path
          const body = (await request.json()) as Partial<KnowledgeBaseConfig>
          const current = readKnowledgeBaseConfig(workspaceRoot, {
            datasetType: activeWorkspace.datasetType,
          })
          const next: KnowledgeBaseConfig = {
            source: body.source ?? current.source,
          }
          const normalized = normalizeKnowledgeBaseConfigForWorkspace(
            next,
            workspaceRoot,
            { datasetType: activeWorkspace.datasetType },
          )
          writeKnowledgeBaseConfig(normalized, workspaceRoot)
          return json({ config: normalized })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to save knowledge base config',
            },
            { status: 500 },
          )
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body =
            (await request.json()) as Partial<KnowledgeContextPreferencePatch>
          const route = governedPreferenceRouteForScope(body.preferenceScope)
          const headers = buildSemantierAgentProxyHeaders(request.headers, {
            forwardBrowserCookies: true,
          })
          headers.set('Content-Type', 'application/json')
          const response = await fetch(withSemantierAgentBase(route), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })
          const payload = (await response.json().catch(() => ({}))) as {
            preference?: unknown
            detail?: unknown
            error?: unknown
          }
          if (!response.ok) {
            throw new Error(
              String(
                payload.detail ||
                  payload.error ||
                  `Governed preference write failed (${response.status})`,
              ),
            )
          }
          return json({ preference: payload.preference })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update knowledge context preference',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
