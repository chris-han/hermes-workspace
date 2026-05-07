import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { installSemantierSkill } from '../../server/semantier-skills-api'

function normalizeSkillActionResult(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }

  const result = { ...(payload as Record<string, unknown>) }
  if (
    typeof result.error !== 'string' &&
    typeof result.detail === 'string' &&
    result.detail.trim()
  ) {
    result.error = result.detail
  }
  return result
}

export const Route = createFileRoute('/api/skills/install')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            skillId?: string
            identifier?: string
            category?: string
            force?: boolean
            config?: Record<string, unknown>
          }
          const identifier = (body.identifier || body.skillId || '').trim()
          if (!identifier) {
            return json(
              { ok: false, error: 'identifier or skillId required' },
              { status: 400 },
            )
          }

          const result = normalizeSkillActionResult(
            await installSemantierSkill(request.headers, {
              identifier,
              category: body.category || '',
              force: Boolean(body.force),
              config:
                body.config && typeof body.config === 'object'
                  ? body.config
                  : {},
            }),
          )
          return json(result)
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to install skill',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
