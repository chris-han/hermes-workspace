import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SHOWCASE_ROOT = resolve(__dirname, '..')

const FORBIDDEN = [
  /graph-api-client/,
  /graphStore\.ts/,
  /useLoadGraph/,
  /api\/graph\//,
  /api\/ontology\//,
  /api\/embeddings\//,
  /api\/semantier-proxy\//,
  /runtime graph hooks/i,
  /mutable governance/,
]

function collectSources(dir: string, out: string[] = []): string[] {
  const entries = readdirSafe(dir)
  for (const entry of entries) {
    const full = resolve(dir, entry)
    const stat = statSafe(full)
    if (!stat) continue
    if (stat.isDirectory()) {
      collectSources(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

function readdirSafe(dir: string): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

function statSafe(path: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    return fs.statSync(path)
  } catch {
    return null
  }
}

describe('semantica showcase boundary guard', () => {
  it('does not import any live runtime client or store', () => {
    const files = collectSources(SHOWCASE_ROOT)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const pattern of FORBIDDEN) {
        expect(text, `forbidden import in ${file}: ${pattern}`).not.toMatch(pattern)
      }
    }
  })
})
