export async function runStreamOnce(params: {
  sessionKey: string
  friendlyId: string
  message: string
  model?: string
  locale?: string
}): Promise<string> {
  const { sessionKey, friendlyId, message, model } = params

  // Use the session-scoped streaming endpoint so the server attaches the
  // run to the correct session. Add an AbortController timeout to avoid
  // leaving the UI stuck if the stream never completes.
  const controller = new AbortController()
  const timeoutMs = 60_000
  let timeoutId: number | null = null
  if (typeof window !== 'undefined') {
    timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  }

  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionKey)}/chat/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        friendlyId,
        model: model || undefined,
        locale:
          typeof window !== 'undefined'
            ? localStorage.getItem('hermes-workspace-locale') || 'en'
            : 'en',
      }),
      signal: controller.signal,
    },
  )

  if (!response.ok) {
    let payload: any = null
    try {
      payload = await response.json()
    } catch {}
    const payloadError = payload && typeof payload.error === 'string' ? payload.error : ''
    const messageText = payloadError || response.statusText || `Stream request failed (${response.status})`
    throw new Error(messageText)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let finalText = ''

  // Read stream and accumulate assistant text /chunks
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const eventBlock of events) {
      if (!eventBlock.trim()) continue
      const lines = eventBlock.split('\n')
      let currentEvent = ''
      let currentData = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
        else if (line.startsWith('data: ')) currentData += line.slice(6)
        else if (line.startsWith('data:')) currentData += line.slice(5)
      }
      if (!currentEvent || !currentData) continue
      try {
        const payload = JSON.parse(currentData)
        if (currentEvent === 'assistant') {
          const text = (payload as any).text ?? ''
          if (text) finalText += String(text)
        } else if (currentEvent === 'chunk') {
          const chunk = (payload as any).delta ?? (payload as any).text ?? (payload as any).content ?? (payload as any).chunk ?? ''
          if (chunk) finalText += String(chunk)
        } else if (currentEvent === 'done' || currentEvent === 'complete') {
          // optional: payload may contain final message; ignore since we already accumulate
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  if (timeoutId !== null) {
    try {
      window.clearTimeout(timeoutId)
    } catch {}
  }

  return finalText.trim()
}
