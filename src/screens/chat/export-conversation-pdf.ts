const PDF_MIME_TYPE = 'application/pdf'

function sanitizeExportToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveDownloadFilename(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const basicMatch = /filename="?([^";]+)"?/i.exec(disposition)
  if (basicMatch?.[1]) {
    return basicMatch[1]
  }

  return fallback
}

export async function exportConversationPdf(payload: {
  sessionLabel: string
  sessionKey: string
  friendlyId?: string
}): Promise<boolean> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false
  }

  const query = new URLSearchParams()
  if (payload.sessionKey) query.set('sessionKey', payload.sessionKey)
  if (payload.friendlyId) query.set('friendlyId', payload.friendlyId)
  if (payload.sessionLabel) query.set('title', payload.sessionLabel)

  const response = await fetch(`/api/session-export-pdf?${query.toString()}`)
  if (!response.ok) {
    let message = 'Failed to export conversation as PDF'
    try {
      const data = (await response.json()) as { error?: string }
      if (typeof data.error === 'string' && data.error.trim()) {
        message = data.error.trim()
      }
    } catch {
      // Ignore JSON parse failures and keep the fallback message.
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  if (blob.type && blob.type !== PDF_MIME_TYPE) {
    throw new Error('Server did not return a PDF file')
  }

  const fallbackName = `${sanitizeExportToken(payload.sessionLabel) || 'conversation'}.pdf`
  const filename = resolveDownloadFilename(
    response.headers.get('Content-Disposition'),
    fallbackName,
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)

  return true
}
