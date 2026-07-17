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
      'Done.\n\nRun directory: /home/chris/repo/semantier/workspaces/abc123/sessions/session_abc/runs/20260423_174033_06_7be5c1'

    expect(linkifyRunDirectoryFooter(text)).toContain(
      'Run directory: [/home/chris/repo/semantier/workspaces/abc123/sessions/session_abc/runs/20260423_174033_06_7be5c1](/files?path=sessions%2Fsession_abc%2Fruns%2F20260423_174033_06_7be5c1)',
    )
  })

  it('does not alter lines already containing markdown links', () => {
    const line =
      'Run directory: [/tmp/run/20260423](/files?path=runs%2F20260423)'
    expect(linkifyRunDirectoryFooter(line)).toBe(line)
  })

  it('rewrites Chinese saved-report footer into an inspector artifact link', () => {
    const line =
      '报告全文已保存至 /home/chris/repo/semantier-runtime/workspaces/ws123/sessions/session_abc/artifacts/tax_report.md'

    expect(linkifyRunDirectoryFooter(line)).toContain(
      '报告全文已保存至 [/sessions/session_abc/artifacts/tax_report.md](#artifact=tax_report.md)',
    )
  })

  it('rewrites backticked saved-report footer into an inspector artifact link', () => {
    const line =
      'Report saved to: `/home/chris/repo/semantier-runtime/workspaces/ws123/sessions/session_abc/artifacts/tax_report.md`'

    expect(linkifyRunDirectoryFooter(line)).toContain(
      'Report saved to: [/sessions/session_abc/artifacts/tax_report.md](#artifact=tax_report.md)',
    )
  })

  it('rewrites file-path lines into inspector artifact selector links', () => {
    const line =
      '- **文件路径**: `/sessions/session_2633894eda13/artifacts/reimbursement/REIM-20260717-001.md`'

    expect(linkifyRunDirectoryFooter(line)).toBe(
      '- **文件路径**: [/sessions/session_2633894eda13/artifacts/reimbursement/REIM-20260717-001.md](#artifact=reimbursement%2FREIM-20260717-001.md)',
    )
  })

  it('rewrites gateway file-path lines when the colon is inside bold text', () => {
    const line =
      '**文件路径:** `/sessions/session_12a47895b4c2/artifacts/reimbursement/REIM-20260717-001.md`'

    expect(linkifyRunDirectoryFooter(line)).toBe(
      '**文件路径:** [/sessions/session_12a47895b4c2/artifacts/reimbursement/REIM-20260717-001.md](#artifact=reimbursement%2FREIM-20260717-001.md)',
    )
  })

  it('removes duplicate raw Inspector link lines', () => {
    const markdown = [
      '- **文件路径**: `/sessions/session_2633894eda13/artifacts/reim.md`',
      '- **Inspector 链接:** `/sessions/session_2633894eda13/artifacts/reim.md/raw`',
    ].join('\n')

    const normalized = linkifyRunDirectoryFooter(markdown)

    expect(normalized).toContain(
      '- **文件路径**: [/sessions/session_2633894eda13/artifacts/reim.md](#artifact=reim.md)',
    )
    expect(normalized).not.toContain('Inspector 链接')
    expect(normalized).not.toContain('/raw')
  })
})
