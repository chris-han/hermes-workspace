import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { resolveHermesHomeFromBackend } from '../../server/hermes-home'

export const Route = createFileRoute('/api/paths')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const hermesHome = await resolveHermesHomeFromBackend(request.headers)
        return json({
          ok: true,
          hermesHome,
          memoriesDir: path.join(hermesHome, 'memories'),
          skillsDir: path.join(hermesHome, 'skills'),
        })
      },
    },
  },
})
