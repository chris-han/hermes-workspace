import { PDFDocument } from 'pdf-lib'

import { textFromMessage } from './utils'
import type { ChatMessage } from './types'

const PDF_MIME_TYPE = 'application/pdf'
const PDF_PAGE_WIDTH = 595.28
const PDF_PAGE_HEIGHT = 841.89
const RASTER_SCALE = 2
const CANVAS_WIDTH = Math.floor(PDF_PAGE_WIDTH * RASTER_SCALE)
const CANVAS_HEIGHT = Math.floor(PDF_PAGE_HEIGHT * RASTER_SCALE)
const MARGIN = 48 * RASTER_SCALE
const FONT_SIZE = 12 * RASTER_SCALE
const LINE_HEIGHT = 18 * RASTER_SCALE

function sanitizeExportToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function splitLongWord(word: string, maxChars: number): Array<string> {
  if (word.length <= maxChars) return [word]
  const chunks: Array<string> = []
  let start = 0
  while (start < word.length) {
    chunks.push(word.slice(start, start + maxChars))
    start += maxChars
  }
  return chunks
}

function wrapLineByWidth(
  line: string,
  maxWidth: number,
  measureWidth: (value: string) => number,
): Array<string> {
  const trimmed = line.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ['']

  const words = trimmed.split(' ')
  const wrapped: Array<string> = []
  let current = ''

  for (const word of words) {
    const normalizedWord = word.trim()
    if (!normalizedWord) continue

    const candidates =
      measureWidth(normalizedWord) > maxWidth
        ? splitLongWord(normalizedWord, 32)
        : [normalizedWord]

    for (const candidate of candidates) {
      const next = current ? `${current} ${candidate}` : candidate
      if (measureWidth(next) <= maxWidth) {
        current = next
        continue
      }

      if (current) {
        wrapped.push(current)
        current = candidate
      } else {
        wrapped.push(candidate)
        current = ''
      }
    }
  }

  if (current) wrapped.push(current)
  return wrapped.length > 0 ? wrapped : ['']
}

function buildTranscriptBody(messages: Array<ChatMessage>): string {
  return messages
    .map((message) => {
      const role =
        typeof message.role === 'string' && message.role.trim()
          ? message.role.trim().toUpperCase()
          : 'MESSAGE'
      const text = textFromMessage(message).trim()
      const attachments = Array.isArray(message.attachments)
        ? message.attachments
            .map((attachment) => attachment?.name?.trim())
            .filter((value): value is string => Boolean(value))
        : []

      const lines = [`[${role}]`]
      if (text) {
        lines.push(text)
      } else if (attachments.length === 0) {
        lines.push('(No text content)')
      }

      if (attachments.length > 0) {
        lines.push('Attachments:')
        for (const attachment of attachments) {
          lines.push(`- ${attachment}`)
        }
      }

      return lines.join('\n')
    })
    .join('\n\n')
    .trim()
}

function buildTranscript(payload: {
  sessionLabel: string
  messages: Array<ChatMessage>
}): string {
  return `Hermes Conversation Export\nSession: ${payload.sessionLabel}\nExported: ${new Date().toISOString()}\n\n${buildTranscriptBody(payload.messages) || '(No messages in this conversation.)'}`
}

function wrapTextByWidth(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): Array<string> {
  const wrapped: Array<string> = []
  const rawLines = text.split('\n')

  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrapped.push('')
      continue
    }

    let line = ''
    for (const char of rawLine) {
      const next = `${line}${char}`
      if (context.measureText(next).width <= maxWidth) {
        line = next
        continue
      }

      if (line) wrapped.push(line)
      line = char
    }

    if (line) wrapped.push(line)
  }

  return wrapped
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value)
        else reject(new Error('Failed to create PNG blob for PDF export'))
      },
      'image/png',
      1,
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

async function buildConversationPdf(payload: {
  sessionLabel: string
  messages: Array<ChatMessage>
}): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    throw new Error('PDF export is only available in browser environment')
  }

  const pdf = await PDFDocument.create()
  const transcript = buildTranscript(payload)
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = CANVAS_WIDTH
  measureCanvas.height = CANVAS_HEIGHT
  const measureContext = measureCanvas.getContext('2d')
  if (!measureContext) {
    throw new Error('Could not create canvas context for PDF export')
  }

  measureContext.font = `${FONT_SIZE}px "Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Heiti SC", Arial, sans-serif`
  const maxTextWidth = CANVAS_WIDTH - MARGIN * 2
  const wrappedLines = wrapTextByWidth(measureContext, transcript, maxTextWidth)
  const linesPerPage = Math.max(
    1,
    Math.floor((CANVAS_HEIGHT - MARGIN * 2) / LINE_HEIGHT),
  )

  for (let start = 0; start < wrappedLines.length; start += linesPerPage) {
    const pageLines = wrappedLines.slice(start, start + linesPerPage)
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create canvas context for PDF export page')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    context.fillStyle = '#111111'
    context.font = `${FONT_SIZE}px "Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Heiti SC", Arial, sans-serif`
    context.textBaseline = 'top'

    let y = MARGIN
    for (const line of pageLines) {
      context.fillText(line, MARGIN, y)
      y += LINE_HEIGHT
    }

    const pngBytes = await canvasToPngBytes(canvas)
    const png = await pdf.embedPng(pngBytes)
    const page = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: PDF_PAGE_WIDTH,
      height: PDF_PAGE_HEIGHT,
    })
  }

  if (wrappedLines.length === 0) {
    const page = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PDF_PAGE_WIDTH,
      height: PDF_PAGE_HEIGHT,
    })
  }

  return pdf.save()
}

export async function exportConversationPdf(payload: {
  sessionLabel: string
  messages: Array<ChatMessage>
}): Promise<boolean> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false
  }

  const pdfBytes = await buildConversationPdf(payload)
  const arrayBuffer = new ArrayBuffer(pdfBytes.byteLength)
  new Uint8Array(arrayBuffer).set(pdfBytes)
  const blob = new Blob([arrayBuffer], { type: PDF_MIME_TYPE })
  const url = URL.createObjectURL(blob)
  const sessionToken =
    sanitizeExportToken(payload.sessionLabel) || 'conversation'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  const link = document.createElement('a')
  link.href = url
  link.download = `${sessionToken}-${timestamp}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)

  return true
}
