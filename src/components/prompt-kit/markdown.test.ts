import { describe, expect, it } from 'vitest'
import { linkifyRunDirectoryFooter, normalizeMarkdownHref } from './markdown'

describe('normalizeMarkdownHref', () => {
  it('keeps run links as SPA-routable /runs/ paths', () => {
    expect(normalizeMarkdownHref('/runs/20260422_123456_abcd')).toBe(
      '/runs/20260422_123456_abcd',
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

describe('linkifyRunDirectoryFooter', () => {
  it('rewrites run directory footer into a files deep link', () => {
    const text =
      'Done.\n\nRun directory: /home/chris/repo/semantier/workspaces/abc123/runs/20260423_174033_06_7be5c1'

    expect(linkifyRunDirectoryFooter(text)).toContain(
      'Run directory: [/home/chris/repo/semantier/workspaces/abc123/runs/20260423_174033_06_7be5c1](/files?path=runs%2F20260423_174033_06_7be5c1)',
    )
  })

  it('does not alter lines already containing markdown links', () => {
    const line =
      'Run directory: [/tmp/run/20260423](/files?path=runs%2F20260423)'
    expect(linkifyRunDirectoryFooter(line)).toBe(line)
  })
})
