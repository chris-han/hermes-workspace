import { describe, expect, it } from 'vitest'
import { normalizeMarkdownHref } from './markdown'

describe('normalizeMarkdownHref', () => {
  it('rewrites semantier run links through the proxy', () => {
    expect(normalizeMarkdownHref('/runs/20260422_123456_abcd')).toBe(
      '/api/semantier-proxy/runs/20260422_123456_abcd',
    )
  })

  it('keeps non-run links unchanged', () => {
    expect(normalizeMarkdownHref('/chat/main')).toBe('/chat/main')
    expect(normalizeMarkdownHref('https://example.com')).toBe(
      'https://example.com',
    )
  })

  it('keeps empty href values unchanged', () => {
    expect(normalizeMarkdownHref(undefined)).toBeUndefined()
    expect(normalizeMarkdownHref('')).toBe('')
  })
})
