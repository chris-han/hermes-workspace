/**
 * Vitest/browser spy: the showcase adapter chain must not produce any URL or
 * fetch intent. This is the "Vitest/browser spy" half of W7-06. The Playwright
 * E2E covers the actual network at runtime.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SHOWCASE_ROOT = resolve(__dirname, '..')

const NETWORK_PATTERNS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\baxios\b/,
  /\bWebSocket\s*\(/,
  /\bsendBeacon\s*\(/,
  /\/api\/graph\//,
  /\/api\/ontology\//,
  /\/api\/embeddings\//,
  /\/api\/semantier-proxy\//,
]

function collectSources(dir: string, out: string[] = []): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs')
  const entries = fs.readdirSync(dir)
  for (const entry of entries) {
    const full = resolve(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      collectSources(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('showcase network-spy (Vitest half of W7-06)', () => {
  it('contains no fetch/axios/websocket API call sites or live URLs', () => {
    const files = collectSources(SHOWCASE_ROOT)
    expect(files.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const pattern of NETWORK_PATTERNS) {
        if (pattern.test(text)) {
          offenders.push(`${file}: ${pattern}`)
        }
      }
    }
    expect(offenders, `Network-shaped call sites found:\n${offenders.join('\n')}`).toEqual([])
  })
})
