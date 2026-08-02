import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { branchSemantierSession } from '../../../server/semantier-session-api'
import { requireJsonContentType } from '../../../server/rate-limit'

export const Route = createFileRoute('/api/sessions/$sessionKey/branches')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const branchPoint = body.branchPoint
          if (
            !branchPoint ||
            typeof branchPoint !== 'object' ||
            typeof (branchPoint as Record<string, unknown>).messageId !== 'string' ||
            typeof (branchPoint as Record<string, unknown>).sequence !== 'number'
          ) {
            return json({ ok: false, error: 'BRANCH_POINT_REQUIRED' }, { status: 400 })
          }
          const title = typeof body.title === 'string' ? body.title : ''
          const idempotencyKey =
            request.headers.get('Idempotency-Key') ||
            (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '')
          if (!idempotencyKey) {
            return json({ ok: false, error: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 })
          }

          const result = await branchSemantierSession(
            request.headers,
            params.sessionKey,
            {
              messageId: (branchPoint as Record<string, unknown>).messageId as string,
              sequence: (branchPoint as Record<string, unknown>).sequence as number,
            },
            title,
            idempotencyKey,
          )
          return json(result)
        } catch (error) {
          const status =
            error instanceof Error && /not found/i.test(error.message)
              ? 404
              : error instanceof Error && /incomplete|checkpoint/i.test(error.message)
                ? 422
                : 502
          return json(
            { ok: false, error: error instanceof Error ? error.message : String(error) },
            { status },
          )
        }
      },
    },
  },
})
