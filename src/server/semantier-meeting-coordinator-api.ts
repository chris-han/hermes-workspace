import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type MeetingCoordinatorSettings = {
  max_followups: number
}

type SettingsPayload = {
  ok?: boolean
  settings?: Partial<MeetingCoordinatorSettings>
  error?: string
  detail?: string
}

function normalizeSettings(payload: SettingsPayload): MeetingCoordinatorSettings {
  const raw = payload.settings?.max_followups
  const value = typeof raw === 'number' ? raw : Number(raw)
  return {
    max_followups: Number.isFinite(value) && value > 0 ? value : 3,
  }
}

export async function fetchMeetingCoordinatorSettings(
  requestHeaders?: HeadersInit | Headers,
): Promise<MeetingCoordinatorSettings> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const response = await fetch(
    withSemantierAgentBase('/system/meeting-coordinator/settings'),
    {
      headers,
      signal: AbortSignal.timeout(10_000),
    },
  )
  const payload = (await response.json().catch(() => ({}))) as SettingsPayload
  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.detail ||
        `Meeting coordinator settings request failed (${response.status})`,
    )
  }
  return normalizeSettings(payload)
}

export async function saveMeetingCoordinatorSettings(
  settings: MeetingCoordinatorSettings,
  requestHeaders?: HeadersInit | Headers,
): Promise<MeetingCoordinatorSettings> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })
  headers.set('content-type', 'application/json')

  const response = await fetch(
    withSemantierAgentBase('/system/meeting-coordinator/settings'),
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
      signal: AbortSignal.timeout(10_000),
    },
  )
  const payload = (await response.json().catch(() => ({}))) as SettingsPayload
  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.detail ||
        `Meeting coordinator settings save failed (${response.status})`,
    )
  }
  return normalizeSettings(payload)
}
