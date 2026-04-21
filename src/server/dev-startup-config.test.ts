import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))
const VITE_CONFIG_PATH = resolve(CURRENT_DIR, '../../vite.config.ts')

describe('dev startup config', () => {
  it('auto-starts the Semantier backend and Hermes dashboard wrapper', () => {
    const source = readFileSync(VITE_CONFIG_PATH, 'utf-8')

    expect(source).toContain("[semantier-backend]")
    expect(source).toContain("[hermes-dashboard]")
    expect(source).toContain('void startSemantierBackend()')
    expect(source).toContain('void startHermesDashboard()')
    expect(source).toContain("env.VIBE_AGENT_API_URL || process.env.VIBE_AGENT_API_URL")
    expect(source).toContain("env.HERMES_DASHBOARD_URL || process.env.HERMES_DASHBOARD_URL")
  })
})