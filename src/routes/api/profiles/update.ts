import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { updateProfileConfig } from '../../../server/profiles-browser'
import { requireJsonContentType } from '../../../server/rate-limit'
import {
  requireWorkspaceHermesHome,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/update')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json()) as {
            name?: string
            patch?: Record<string, unknown>
          }
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[api/profiles/update] payload', {
              name: body.name,
              patchKeys: body.patch ? Object.keys(body.patch) : [],
            })
          }
          if (!body.patch || typeof body.patch !== 'object') {
            return json({ error: 'patch is required' }, { status: 400 })
          }
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome = requireWorkspaceHermesHome(workspace)
          const profile = updateProfileConfig(
            body.name || '',
            body.patch,
            hermesHome,
          )
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[api/profiles/update] updated profile', {
              name: profile.name,
              hasSoul: Boolean(profile.soul),
            })
          }
          return json({ ok: true, profile })
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.error('[api/profiles/update] failed', error)
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update profile',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
