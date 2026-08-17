export class StudioApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}

export async function getJson<T>(fetcher: typeof fetch, input: RequestInfo | URL, init: RequestInit, isPayload: (value: unknown) => value is T): Promise<T> {
  const response = await fetcher(input, init)
  if (!response.ok) throw new StudioApiError(response.status, `Studio API request failed (${response.status})`)
  const payload: unknown = await response.json()
  if (!isPayload(payload)) throw new StudioApiError(response.status, 'Studio API returned an invalid response shape')
  return payload
}

export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
