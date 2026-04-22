import { PDFDocument } from 'pdf-lib'
import { marked } from 'marked'

import { textFromMessage } from './utils'
import type { ChatMessage } from './types'

const PDF_MIME_TYPE = 'application/pdf'
const PDF_PAGE_WIDTH = 595.28
const PDF_PAGE_HEIGHT = 841.89
const RASTER_SCALE = 2
const CANVAS_WIDTH = Math.floor(PDF_PAGE_WIDTH * RASTER_SCALE)
const CANVAS_HEIGHT = Math.floor(PDF_PAGE_HEIGHT * RASTER_SCALE)
const MARGIN = 48 * RASTER_SCALE
const FONT_FAMILY =
  '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Heiti SC", Arial, sans-serif'
const CODE_FONT_FAMILY =
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'

type LineKind =
  | 'title'
  | 'meta'
  | 'role'
  | 'body'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'quote'
  | 'code'
  | 'attachment'

type StyledLine = {
  text: string
  kind: LineKind
}

type StyledTable = {
  kind: 'table'
  header: Array<string>
  rows: Array<Array<string>>
}

type RenderBlock = StyledLine | StyledTable

type LineStyle = {
  fontSize: number
  lineHeight: number
  fontWeight: 400 | 500 | 600 | 700
  color: string
  indent: number
  spacingBefore: number
  spacingAfter: number
  codeBackground?: string
  fontFamily?: string
}

function sanitizeExportToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function styleFor(kind: LineKind): LineStyle {
  const s = RASTER_SCALE
  switch (kind) {
    case 'title':
      return {
        fontSize: 20 * s,
        lineHeight: 28 * s,
        fontWeight: 700,
        color: '#0f172a',
        indent: 0,
        spacingBefore: 0,
        spacingAfter: 8 * s,
      }
    case 'meta':
      return {
        fontSize: 11 * s,
        lineHeight: 17 * s,
        fontWeight: 500,
        color: '#475569',
        indent: 0,
        spacingBefore: 0,
        spacingAfter: 2 * s,
      }
    case 'role':
      return {
        fontSize: 13 * s,
        lineHeight: 20 * s,
        fontWeight: 700,
        color: '#111827',
        indent: 0,
        spacingBefore: 12 * s,
        spacingAfter: 3 * s,
      }
    case 'h1':
      return {
        fontSize: 17 * s,
        lineHeight: 25 * s,
        fontWeight: 700,
        color: '#0f172a',
        indent: 0,
        spacingBefore: 8 * s,
        spacingAfter: 2 * s,
      }
    case 'h2':
      return {
        fontSize: 15 * s,
        lineHeight: 23 * s,
        fontWeight: 700,
        color: '#1e293b',
        indent: 0,
        spacingBefore: 7 * s,
        spacingAfter: 2 * s,
      }
    case 'h3':
      return {
        fontSize: 13 * s,
        lineHeight: 21 * s,
        fontWeight: 700,
        color: '#334155',
        indent: 0,
        spacingBefore: 6 * s,
        spacingAfter: 2 * s,
      }
    case 'bullet':
      return {
        fontSize: 12 * s,
        lineHeight: 19 * s,
        fontWeight: 400,
        color: '#0f172a',
        indent: 14 * s,
        spacingBefore: 1 * s,
        spacingAfter: 1 * s,
      }
    case 'quote':
      return {
        fontSize: 12 * s,
        lineHeight: 19 * s,
        fontWeight: 400,
        color: '#334155',
        indent: 16 * s,
        spacingBefore: 1 * s,
        spacingAfter: 1 * s,
      }
    case 'code':
      return {
        fontSize: 11 * s,
        lineHeight: 18 * s,
        fontWeight: 400,
        color: '#0f172a',
        indent: 12 * s,
        spacingBefore: 2 * s,
        spacingAfter: 2 * s,
        codeBackground: '#f1f5f9',
        fontFamily: CODE_FONT_FAMILY,
      }
    case 'attachment':
      return {
        fontSize: 11 * s,
        lineHeight: 18 * s,
        fontWeight: 500,
        color: '#475569',
        indent: 10 * s,
        spacingBefore: 1 * s,
        spacingAfter: 1 * s,
      }
    case 'body':
    default:
      return {
        fontSize: 12 * s,
        lineHeight: 19 * s,
        fontWeight: 400,
        color: '#111827',
        indent: 0,
        spacingBefore: 1 * s,
        spacingAfter: 2 * s,
      }
  }
}

function normalizeInlineText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+$/g, '')
}

function wrapByCharacter(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): Array<string> {
  if (!text) return ['']
  const lines = text.split('\n')
  const wrapped: Array<string> = []

  for (const line of lines) {
    if (!line) {
      wrapped.push('')
      continue
    }

    let current = ''
    for (const char of line) {
      const next = `${current}${char}`
      if (context.measureText(next).width <= maxWidth) {
        current = next
        continue
      }

      if (current) wrapped.push(current)
      current = char
    }

    if (current) wrapped.push(current)
  }

  return wrapped
}

function pushLinesFromText(
  output: Array<RenderBlock>,
  kind: LineKind,
  text: string,
) {
  const normalized = normalizeInlineText(text)
  if (!normalized) return
  for (const line of normalized.split('\n')) {
    output.push({ text: line, kind })
  }
}

function pushMarkdownTokens(
  output: Array<RenderBlock>,
  tokens: Array<any>,
  listDepth = 0,
) {
  for (const token of tokens) {
    if (!token || typeof token !== 'object') continue

    if (token.type === 'space') continue

    if (token.type === 'heading') {
      const depth = Number(token.depth || 0)
      const headingKind: LineKind = depth <= 1 ? 'h1' : depth === 2 ? 'h2' : 'h3'
      pushLinesFromText(output, headingKind, token.text || token.raw || '')
      continue
    }

    if (token.type === 'paragraph' || token.type === 'text') {
      pushLinesFromText(output, 'body', token.text || token.raw || '')
      continue
    }

    if (token.type === 'blockquote') {
      const quoteText = (token.text || '').trim()
      if (quoteText) {
        for (const line of quoteText.split('\n')) {
          output.push({ text: `| ${line}`, kind: 'quote' })
        }
      }
      if (Array.isArray(token.tokens)) {
        pushMarkdownTokens(output, token.tokens, listDepth)
      }
      continue
    }

    if (token.type === 'code') {
      const codeText = normalizeInlineText(token.text || token.raw || '')
      if (codeText) {
        for (const line of codeText.split('\n')) {
          output.push({ text: line, kind: 'code' })
        }
      }
      continue
    }

    if (token.type === 'list' && Array.isArray(token.items)) {
      token.items.forEach((item: any, index: number) => {
        const marker = token.ordered ? `${index + 1}.` : '•'
        const indentPrefix = '  '.repeat(listDepth)
        const itemText = normalizeInlineText(item?.text || item?.raw || '')
        if (itemText) {
          output.push({
            text: `${indentPrefix}${marker} ${itemText}`,
            kind: 'bullet',
          })
        }
        if (Array.isArray(item?.tokens)) {
          const nested = item.tokens.filter(
            (nestedToken: any) => nestedToken?.type !== 'text',
          )
          if (nested.length > 0) {
            pushMarkdownTokens(output, nested, listDepth + 1)
          }
        }
      })
      continue
    }

    if (token.type === 'table') {
      const header = Array.isArray(token.header)
        ? token.header.map((cell: any) => normalizeInlineText(cell?.text || ''))
        : []
      const rows = Array.isArray(token.rows)
        ? token.rows.map((row: Array<any>) =>
            Array.isArray(row)
              ? row.map((cell: any) => normalizeInlineText(cell?.text || ''))
              : [],
          )
        : []
      output.push({ kind: 'table', header, rows })
      continue
    }

    if (token.type === 'hr') {
      output.push({ text: '----------------------------------------', kind: 'meta' })
      continue
    }

    pushLinesFromText(output, 'body', token.text || token.raw || '')
  }
}

function buildStyledTranscript(payload: {
  sessionLabel: string
  messages: Array<ChatMessage>
}): Array<RenderBlock> {
  const lines: Array<RenderBlock> = [
    { text: 'Hermes Conversation Export', kind: 'title' },
    { text: `Session: ${payload.sessionLabel}`, kind: 'meta' },
    { text: `Exported: ${new Date().toISOString()}`, kind: 'meta' },
    { text: '', kind: 'body' },
  ]

  for (const message of payload.messages) {
    const role =
      typeof message.role === 'string' && message.role.trim()
        ? message.role.trim().toUpperCase()
        : 'MESSAGE'
    lines.push({ text: `[${role}]`, kind: 'role' })

    const text = textFromMessage(message).trim()
    if (text) {
      const tokens = marked.lexer(text, { gfm: true, breaks: true }) as Array<any>
      pushMarkdownTokens(lines, tokens)
    } else {
      lines.push({ text: '(No text content)', kind: 'body' })
    }

    const attachments = Array.isArray(message.attachments)
      ? message.attachments
          .map((attachment) => attachment?.name?.trim())
          .filter((value): value is string => Boolean(value))
      : []

    if (attachments.length > 0) {
      lines.push({ text: 'Attachments', kind: 'attachment' })
      for (const attachment of attachments) {
        lines.push({ text: `• ${attachment}`, kind: 'attachment' })
      }
    }

    lines.push({ text: '', kind: 'body' })
  }

  if (payload.messages.length === 0) {
    lines.push({ text: '(No messages in this conversation.)', kind: 'body' })
  }

  return lines
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
  const styledLines = buildStyledTranscript(payload)

  function createPageCanvas() {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create canvas context for PDF export page')
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    context.textBaseline = 'top'
    return { canvas, context, y: MARGIN }
  }

  const pages: Array<Uint8Array> = []
  let page = createPageCanvas()

  async function flushPage() {
    pages.push(await canvasToPngBytes(page.canvas))
    page = createPageCanvas()
  }

  const bottomLimit = CANVAS_HEIGHT - MARGIN
  const maxTextWidth = CANVAS_WIDTH - MARGIN * 2

  function isTableBlock(block: RenderBlock): block is StyledTable {
    return block.kind === 'table'
  }

  function drawTableRow(options: {
    cells: Array<string>
    columnWidth: number
    rowY: number
    isHeader: boolean
  }) {
    const cellPaddingX = 8 * RASTER_SCALE
    const cellPaddingY = 6 * RASTER_SCALE
    const fontSize = (options.isHeader ? 11 : 10) * RASTER_SCALE
    const lineHeight = (options.isHeader ? 17 : 16) * RASTER_SCALE
    const fontWeight = options.isHeader ? 700 : 400
    const background = options.isHeader ? '#e2e8f0' : '#ffffff'
    const borderColor = '#cbd5e1'

    page.context.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`

    const wrappedCells = options.cells.map((cell) =>
      wrapByCharacter(
        page.context,
        cell,
        options.columnWidth - cellPaddingX * 2,
      ),
    )

    const rowHeight = Math.max(
      lineHeight + cellPaddingY * 2,
      ...wrappedCells.map((lines) => lines.length * lineHeight + cellPaddingY * 2),
    )

    let x = MARGIN
    wrappedCells.forEach((lines, index) => {
      page.context.fillStyle = background
      page.context.fillRect(x, options.rowY, options.columnWidth, rowHeight)
      page.context.strokeStyle = borderColor
      page.context.lineWidth = Math.max(1, RASTER_SCALE)
      page.context.strokeRect(x, options.rowY, options.columnWidth, rowHeight)

      page.context.fillStyle = options.isHeader ? '#0f172a' : '#111827'
      page.context.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`

      let textY = options.rowY + cellPaddingY
      for (const line of lines) {
        page.context.fillText(line, x + cellPaddingX, textY)
        textY += lineHeight
      }

      x += options.columnWidth
    })

    return rowHeight
  }

  for (const block of styledLines) {
    if (isTableBlock(block)) {
      const columnCount = Math.max(
        block.header.length,
        ...block.rows.map((row) => row.length),
        1,
      )
      const columnWidth = maxTextWidth / columnCount
      const headerCells = Array.from({ length: columnCount }, (_, index) => block.header[index] || '')

      const estimateHeaderHeight = 32 * RASTER_SCALE
      if (page.y + estimateHeaderHeight > bottomLimit) {
        await flushPage()
      }

      page.y += 4 * RASTER_SCALE
      page.y += drawTableRow({
        cells: headerCells,
        columnWidth,
        rowY: page.y,
        isHeader: true,
      })

      for (const row of block.rows) {
        const cells = Array.from({ length: columnCount }, (_, index) => row[index] || '')

        const probeFontSize = 10 * RASTER_SCALE
        const probeLineHeight = 16 * RASTER_SCALE
        const probePaddingY = 6 * RASTER_SCALE
        const probePaddingX = 8 * RASTER_SCALE
        page.context.font = `400 ${probeFontSize}px ${FONT_FAMILY}`
        const estimatedWrapped = cells.map((cell) =>
          wrapByCharacter(
            page.context,
            cell,
            columnWidth - probePaddingX * 2,
          ),
        )
        const estimatedHeight = Math.max(
          probeLineHeight + probePaddingY * 2,
          ...estimatedWrapped.map(
            (lines) => lines.length * probeLineHeight + probePaddingY * 2,
          ),
        )

        if (page.y + estimatedHeight > bottomLimit) {
          await flushPage()
          page.y += drawTableRow({
            cells: headerCells,
            columnWidth,
            rowY: page.y,
            isHeader: true,
          })
        }

        page.y += drawTableRow({
          cells,
          columnWidth,
          rowY: page.y,
          isHeader: false,
        })
      }

      page.y += 8 * RASTER_SCALE
      continue
    }

    const line = block
    const style = styleFor(line.kind)
    const fontFamily = style.fontFamily || FONT_FAMILY
    page.context.font = `${style.fontWeight} ${style.fontSize}px ${fontFamily}`

    const effectiveWidth = maxTextWidth - style.indent
    const wrapped = wrapByCharacter(page.context, line.text, effectiveWidth)
    const drawLines = wrapped.length > 0 ? wrapped : ['']
    const blockHeight =
      style.spacingBefore +
      style.spacingAfter +
      drawLines.length * style.lineHeight

    if (page.y + blockHeight > bottomLimit) {
      await flushPage()
      page.context.font = `${style.fontWeight} ${style.fontSize}px ${fontFamily}`
    }

    page.y += style.spacingBefore

    for (const drawLine of drawLines) {
      if (style.codeBackground) {
        page.context.fillStyle = style.codeBackground
        page.context.fillRect(
          MARGIN + style.indent - 6 * RASTER_SCALE,
          page.y - 2 * RASTER_SCALE,
          effectiveWidth + 12 * RASTER_SCALE,
          style.lineHeight,
        )
      }
      page.context.fillStyle = style.color
      page.context.font = `${style.fontWeight} ${style.fontSize}px ${fontFamily}`
      page.context.fillText(drawLine, MARGIN + style.indent, page.y)
      page.y += style.lineHeight
    }

    page.y += style.spacingAfter
  }

  if (page.y > MARGIN || pages.length === 0) {
    pages.push(await canvasToPngBytes(page.canvas))
  }

  for (const pngBytes of pages) {
    const png = await pdf.embedPng(pngBytes)
    const pdfPage = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
    pdfPage.drawImage(png, {
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
