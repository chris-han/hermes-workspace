import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  fetchMeetingCoordinatorSettings,
  saveMeetingCoordinatorSettings,
} from '../../server/semantier-meeting-coordinator-api'

export const Route = createFileRoute('/api/meeting-coordinator-settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const settings = await fetchMeetingCoordinatorSettings(request.headers)
          return json({ settings })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load meeting coordinator settings'
          return json({ error: message }, { status: 502 })
        }
      },
      PUT: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            max_followups?: unknown
          }
          const maxFollowups = Number(body.max_followups)
          const settings = await saveMeetingCoordinatorSettings(
            { max_followups: maxFollowups },
            request.headers,
          )
          return json({ settings })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to save meeting coordinator settings'
          return json({ error: message }, { status: 502 })
        }
      },
    },
  },
})
