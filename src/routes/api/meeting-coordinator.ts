import { createFileRoute } from '@tanstack/react-router'
import {
  BEARER_TOKEN,
  HERMES_API,
  dashboardFetch,
  ensureGatewayProbed,
} from '../../server/gateway-capabilities'

function authHeaders(): Record<string, string> {
  return BEARER_TOKEN ? { Authorization: `Bearer ${BEARER_TOKEN}` } : {}
}

export const Route = createFileRoute('/api/meeting-coordinator')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const capabilities = ensureGatewayProbed()
        const url = '/system/meeting-coordinator/monitors'
        const res = capabilities.dashboard.available
          ? await dashboardFetch(url, {}, { requestHeaders: request.headers })
          : await fetch(`${HERMES_API}${url}`, { headers: authHeaders() })
        return new Response(res.body, {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
      POST: async ({ request }) => {
        const capabilities = ensureGatewayProbed()
        const payload = await request.json()
        const action = typeof payload.action === 'string' ? payload.action : ''
        const deliveryTaskId =
          typeof payload.delivery_task_id === 'string' ? payload.delivery_task_id : ''
        const url =
          action === 'requeue_delivery_task'
            ? `/system/meeting-coordinator/delivery-tasks/${encodeURIComponent(deliveryTaskId)}/requeue`
            : '/system/meeting-coordinator/delivery-tasks/retry'
        const body =
          action === 'requeue_delivery_task'
            ? JSON.stringify({
                reason:
                  typeof payload.reason === 'string'
                    ? payload.reason
                    : 'operator requested requeue',
              })
            : JSON.stringify({ reason: 'operator requested retry tick' })
        const res = capabilities.dashboard.available
          ? await dashboardFetch(
              url,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
              },
              { requestHeaders: request.headers },
            )
          : await fetch(`${HERMES_API}${url}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body,
            })
        return new Response(await res.text(), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
