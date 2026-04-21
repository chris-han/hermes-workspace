import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  fetchSemantierSkillsInventory,
  uninstallSemantierSkill,
} from '../../server/semantier-skills-api'

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

export const Route = createFileRoute('/api/skills/uninstall')({
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
          }
          const name = (body.name || body.skillId || '').trim()
          if (!name) {
            return json(
              { ok: false, error: 'name or skillId required' },
              { status: 400 },
            )
          }

          const inventory = await fetchSemantierSkillsInventory(request.headers)
          const skill = inventory.skills.find(
            (entry) => entry.id === name || entry.name === name,
          )
          if (skill && skill.canUninstall === false) {
            return json(
              {
                ok: false,
                error: 'Only workspace-owned skills can be uninstalled.',
              },
              { status: 403 },
            )
          }

          const result = normalizeSkillActionResult(
            await uninstallSemantierSkill(request.headers, { name }),
          )
          return json(result)
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to uninstall skill',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})