type SessionStatusApiResponse = {
  ok?: boolean
  payload?: unknown
  error?: string
  [key: string]: unknown
}

type HermesConfigApiResponse = {
  activeModel?: unknown
  activeProvider?: unknown
  [key: string]: unknown
}

export function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getResolvedModelKey(model: string, provider?: string): string {
  const normalizedModel = model.trim()
  const normalizedProvider = typeof provider === 'string' ? provider.trim() : ''

  if (!normalizedModel) return ''
  if (!normalizedProvider) return normalizedModel
  if (normalizedModel.startsWith(`${normalizedProvider}/`))
    return normalizedModel
  return `${normalizedProvider}/${normalizedModel}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readResponseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>
    if (typeof payload.error === 'string') return payload.error
    if (typeof payload.message === 'string') return payload.message
    return JSON.stringify(payload)
  } catch {
    const text = await response.text().catch(() => '')
    return text || response.statusText || 'Request failed'
  }
}

export function readModelFromStatusPayload(payload: unknown): string {
  if (!isRecord(payload)) return ''

  const directCandidates = [
    payload.model,
    payload.currentModel,
    payload.modelAlias,
  ]
  for (const candidate of directCandidates) {
    const text = readText(candidate)
    if (text) return text
  }

  if (isRecord(payload.resolved)) {
    const provider = readText(payload.resolved.modelProvider)
    const model = readText(payload.resolved.model)
    if (provider && model) return `${provider}/${model}`
    if (model) return model
  }

  const nestedCandidates = [payload.status, payload.session, payload.payload]
  for (const nested of nestedCandidates) {
    const nestedModel = readModelFromStatusPayload(nested)
    if (nestedModel) return nestedModel
  }

  return ''
}

export function readModelFromHermesConfigPayload(payload: unknown): string {
  if (!isRecord(payload)) return ''

  const activeModel = readText(payload.activeModel)
  if (!activeModel) return ''

  const activeProvider = readText(payload.activeProvider)
  return getResolvedModelKey(activeModel, activeProvider)
}

export async function fetchCurrentModelFromStatus(): Promise<string> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 7000)

  try {
    const response = await fetch('/api/session-status', {
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(await readResponseError(response))
    }

    const payload = (await response.json()) as SessionStatusApiResponse
    if (payload.ok === false) {
      throw new Error(readText(payload.error) || 'Server unavailable')
    }

    const currentModel = readModelFromStatusPayload(payload.payload ?? payload)
    if (currentModel) return currentModel

    const configResponse = await fetch('/api/hermes-config', {
      signal: controller.signal,
    })
    if (!configResponse.ok) {
      throw new Error(await readResponseError(configResponse))
    }

    const configPayload = (await configResponse.json()) as HermesConfigApiResponse
    return readModelFromHermesConfigPayload(configPayload)
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new Error('Request timed out')
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
