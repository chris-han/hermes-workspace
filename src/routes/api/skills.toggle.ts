import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { toggleSemantierSkill } from '../../server/semantier-skills-api'

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

export const Route = createFileRoute('/api/skills/toggle')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await request.json()) as {
            skillId?: string
            name?: string
            enabled?: boolean
          }
          const name = (body.name || body.skillId || '').trim()
          if (!name) {
            return json(
              { ok: false, error: 'name or skillId required' },
              { status: 400 },
            )
          }
          if (typeof body.enabled !== 'boolean') {
            return json(
              { ok: false, error: 'enabled (boolean) required' },
              { status: 400 },
            )
          }

          const result = normalizeSkillActionResult(
            await toggleSemantierSkill(request.headers, {
              name,
              enabled: body.enabled,
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
                  : 'Failed to toggle skill',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
