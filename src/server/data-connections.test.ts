import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildDataConnectionsSummary } from './data-connections'

describe('buildDataConnectionsSummary', () => {
  let runtimeRoot = ''

  afterEach(() => {
    if (runtimeRoot) {
      fs.rmSync(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('treats eos as authoritative, lakehouse as derived, and duckdb as read-only', () => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'data-connections-'))
    fs.writeFileSync(path.join(runtimeRoot, 'eos.db'), 'sqlite', 'utf-8')

    const lakehouseDir = path.join(runtimeRoot, 'lakehouse')
    fs.mkdirSync(lakehouseDir, { recursive: true })
    fs.writeFileSync(
      path.join(lakehouseDir, 'lakehouse_manifest.json'),
      JSON.stringify({ manifest_version: 'test' }),
      'utf-8',
    )

    const summary = buildDataConnectionsSummary(runtimeRoot)

    expect(summary.eos.kind).toBe('authoritative')
    expect(summary.eos.available).toBe(true)
    expect(summary.lakehouse.kind).toBe('derived')
    expect(summary.lakehouse.available).toBe(true)
    expect(summary.duckdb.kind).toBe('read-only')
    expect(summary.duckdb.available).toBe(true)
    expect(summary.duckdb.description.toLowerCase()).toContain('read-only')
  })

  it('reports missing lakehouse artifacts without promoting duckdb to authority', () => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'data-connections-'))
    fs.writeFileSync(path.join(runtimeRoot, 'eos.db'), 'sqlite', 'utf-8')

    const summary = buildDataConnectionsSummary(runtimeRoot)

    expect(summary.eos.available).toBe(true)
    expect(summary.lakehouse.available).toBe(false)
    expect(summary.duckdb.available).toBe(false)
    expect(summary.lakehouse.details?.join(' ')).toContain('Expected artifacts')
  })
})
