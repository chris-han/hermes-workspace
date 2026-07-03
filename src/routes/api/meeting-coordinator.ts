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
        const fetchSystem = async (url: string) =>
          capabilities.dashboard.available
            ? dashboardFetch(url, {}, { requestHeaders: request.headers })
            : fetch(`${HERMES_API}${url}`, { headers: authHeaders() })
        const [monitorRes, negotiationRes] = await Promise.all([
          fetchSystem('/system/meeting-coordinator/monitors'),
          fetchSystem('/system/meeting-coordinator/negotiations'),
        ])
        const monitorPayload = await monitorRes.json()
        const negotiationPayload = await negotiationRes.json()
        const rawNegotiations = Array.isArray(negotiationPayload.negotiations)
          ? negotiationPayload.negotiations
          : []
        const negotiations = negotiationRes.ok
          ? await Promise.all(
              rawNegotiations.map(async (negotiation: Record<string, unknown>) => {
                const negotiationId =
                  typeof negotiation.negotiation_id === 'string'
                    ? negotiation.negotiation_id
                    : ''
                if (!negotiationId) return negotiation
                const detailRes = await fetchSystem(
                  `/system/meeting-coordinator/negotiations/${encodeURIComponent(negotiationId)}`,
                )
                if (!detailRes.ok) return negotiation
                const detailPayload = await detailRes.json()
                return {
                  ...negotiation,
                  participants: Array.isArray(detailPayload.participants)
                    ? detailPayload.participants
                    : [],
                  candidate_slots: Array.isArray(detailPayload.candidate_slots)
                    ? detailPayload.candidate_slots
                    : [],
                  votes: Array.isArray(detailPayload.votes) ? detailPayload.votes : [],
                  messages: Array.isArray(detailPayload.messages)
                    ? detailPayload.messages
                    : [],
                  finalize_attempts: Array.isArray(detailPayload.finalize_attempts)
                    ? detailPayload.finalize_attempts
                    : [],
                  events: Array.isArray(detailPayload.events) ? detailPayload.events : [],
                }
              }),
            )
          : []
        const status = monitorRes.ok ? negotiationRes.status : monitorRes.status
        const body = {
          ...monitorPayload,
          negotiations,
          negotiationError: negotiationRes.ok
            ? undefined
            : negotiationPayload.error || negotiationPayload.detail,
        }
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
      POST: async ({ request }) => {
        const capabilities = ensureGatewayProbed()
        const payload = await request.json()
        const action = typeof payload.action === 'string' ? payload.action : ''
        const deliveryTaskId =
          typeof payload.delivery_task_id === 'string' ? payload.delivery_task_id : ''
        const negotiationId =
          typeof payload.negotiation_id === 'string' ? payload.negotiation_id : ''
        let url = '/system/meeting-coordinator/delivery-tasks/retry'
        let body = JSON.stringify({ reason: 'operator requested retry tick' })
        if (action === 'requeue_delivery_task') {
          url = `/system/meeting-coordinator/delivery-tasks/${encodeURIComponent(deliveryTaskId)}/requeue`
          body = JSON.stringify({
            reason:
              typeof payload.reason === 'string'
                ? payload.reason
                : 'operator requested requeue',
          })
        } else if (action === 'run_negotiation') {
          url = `/system/meeting-coordinator/negotiations/${encodeURIComponent(negotiationId)}/run`
          body = JSON.stringify({ reason: 'operator requested run' })
        } else if (action === 'finalize_negotiation') {
          url = `/system/meeting-coordinator/negotiations/${encodeURIComponent(negotiationId)}/finalize`
          body = JSON.stringify({
            decision_source:
              typeof payload.decision_source === 'string'
                ? payload.decision_source
                : 'consent',
            selected_slot_id:
              typeof payload.selected_slot_id === 'string'
                ? payload.selected_slot_id
                : '',
            requester_confirmation: payload.requester_confirmation === true,
            calendar_update_payload:
              payload.calendar_update_payload &&
              typeof payload.calendar_update_payload === 'object'
                ? payload.calendar_update_payload
                : {},
          })
        } else if (action === 'cancel_negotiation') {
          url = `/system/meeting-coordinator/negotiations/${encodeURIComponent(negotiationId)}/cancel`
          body = JSON.stringify({
            reason:
              typeof payload.reason === 'string'
                ? payload.reason
                : 'operator requested cancellation',
          })
        }
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
