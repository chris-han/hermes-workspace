import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  resolveHermesAccessControlFromBackend,
  updateHermesAccessControlFromBackend,
} from '../../server/hermes-home'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'

type AccessControlRole = 'regular' | 'administrator'

export const Route = createFileRoute('/api/paths')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const accessControl = await resolveHermesAccessControlFromBackend(
            request.headers,
          )
          const hermesHome = accessControl.effectiveHermesHome
          return json({
            ok: true,
            hermesHome,
            workspaceHermesHome: accessControl.workspaceHermesHome,
            accessControl: {
              role: accessControl.role,
              administratorHome: accessControl.administratorHome,
              defaultAdministratorHome: accessControl.defaultAdministratorHome,
            },
            memoriesDir: path.join(hermesHome, 'memories'),
            skillsDir: path.join(hermesHome, 'skills'),
          })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return json({ ok: false, error: err.message }, { status: 401 })
          }
          throw err
        }
      },

      PATCH: async ({ request }) => {
        const body = (await request.json()) as {
          role?: unknown
          administratorHome?: unknown
        }

        if (
          body.role !== undefined &&
          body.role !== 'regular' &&
          body.role !== 'administrator'
        ) {
          return json(
            {
              ok: false,
              error:
                "Invalid role. Expected 'regular' or 'administrator'.",
            },
            { status: 400 },
          )
        }

        const role = body.role as AccessControlRole | undefined
        const administratorHome =
          typeof body.administratorHome === 'string'
            ? body.administratorHome.trim()
            : undefined

        if (
          administratorHome !== undefined &&
          administratorHome.length > 0 &&
          !path.isAbsolute(administratorHome) &&
          !administratorHome.startsWith('~/') &&
          administratorHome !== '~'
        ) {
          return json(
            {
              ok: false,
              error: 'administratorHome must be an absolute path or use ~.',
            },
            { status: 400 },
          )
        }

        try {
          const accessControl = await updateHermesAccessControlFromBackend(
            request.headers,
            {
              role,
              administratorHome,
            },
          )
          const hermesHome = accessControl.effectiveHermesHome
          return json({
            ok: true,
            hermesHome,
            workspaceHermesHome: accessControl.workspaceHermesHome,
            accessControl: {
              role: accessControl.role,
              administratorHome: accessControl.administratorHome,
              defaultAdministratorHome: accessControl.defaultAdministratorHome,
            },
            memoriesDir: path.join(hermesHome, 'memories'),
            skillsDir: path.join(hermesHome, 'skills'),
          })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ ok: false, error: error.message }, { status: 401 })
          }
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update access control.',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
