import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))
const VITE_CONFIG_PATH = resolve(CURRENT_DIR, '../../vite.config.ts')

describe('dev startup config', () => {
  it('auto-starts the Semantier backend and Hermes dashboard wrapper', () => {
    const source = readFileSync(VITE_CONFIG_PATH, 'utf-8')

    expect(source).toContain(
      "const SEMANTIER_BACKEND_HEALTH_PATH = '/gateway/channels'",
    )
    expect(source).toContain(
      'env.SEMANTIER_AGENT_API_URL || process.env.SEMANTIER_AGENT_API_URL',
    )
    expect(source).toContain("'http://127.0.0.1:8899'")
    expect(source).not.toContain(
      "isHealthyEndpoint(semantierAgentUrl, '/health')",
    )
    expect(source).not.toContain('void startHermesGateway()')
    expect(source).not.toContain('SEMANTIER_AGENT_PATH')
    expect(source).not.toContain('api_server.py')
    expect(source).not.toContain('hermes_dashboard_wrapper')
    expect(source).not.toContain('void startSemantierBackend()')
    expect(source).not.toContain('void startHermesDashboard()')
  })
})
