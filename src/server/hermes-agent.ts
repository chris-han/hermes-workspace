import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

const HERMES_HEALTH_TIMEOUT_MS = 2_000
const HERMES_START_PORT = 8642

let startPromise: Promise<StartHermesAgentResult> | null = null

export type StartHermesAgentResult =
  | {
      ok: true
      message: string
      pid?: number
    }
  | {
      ok: false
      error: string
    }

/**
 * Read ~/.hermes/.env and return key=value pairs as an object.
 * Silently returns {} if the file doesn't exist or can't be parsed.
 */
function readHermesEnv(): Record<string, string> {
  const envPath = join(homedir(), '.hermes', '.env')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx <= 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

/** Same directory resolution logic as vite.config.ts. */
export function resolveHermesAgentDir(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const candidates: Array<string> = []

  if (env.HERMES_AGENT_PATH?.trim()) {
    candidates.push(env.HERMES_AGENT_PATH.trim())
  }

  const workspaceRoot = dirname(resolve('.'))
  candidates.push(
    resolve(workspaceRoot, 'hermes-agent'),
    resolve(workspaceRoot, '..', 'hermes-agent'),
  )

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'gateway', 'run.py'))) return candidate
  }

  return null
}

export function resolveHermesPython(agentDir: string): string {
  const venvPython = resolve(agentDir, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return venvPython
  const uvVenv = resolve(agentDir, 'venv', 'bin', 'python')
  if (existsSync(uvVenv)) return uvVenv
  return 'python3'
}

/** Same directory resolution logic as vite.config.ts. */
export function resolveSemantierAgentDir(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const candidates: Array<string> = []

  if (env.SEMANTIER_AGENT_PATH?.trim()) {
    candidates.push(env.SEMANTIER_AGENT_PATH.trim())
  }

  const workspaceRoot = dirname(resolve('.'))
  candidates.push(
    resolve(workspaceRoot, 'agent'),
    resolve(workspaceRoot, '..', 'agent'),
  )

  for (const candidate of candidates) {
    if (
      existsSync(resolve(candidate, 'api_server.py')) &&
      existsSync(resolve(candidate, 'hermes_dashboard_wrapper.py'))
    ) {
      return candidate
    }
  }
  return null
}

export function resolveSemantierPython(agentDir: string): string {
  const venvPython = resolve(agentDir, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return venvPython
  const uvVenv = resolve(agentDir, 'venv', 'bin', 'python')
  if (existsSync(uvVenv)) return uvVenv
  return 'python3'
}

export async function isHermesAgentHealthy(
  port = HERMES_START_PORT,
): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(HERMES_HEALTH_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function startHermesAgent(): Promise<StartHermesAgentResult> {
  if (await isHermesAgentHealthy()) {
    return { ok: true, message: 'already running' }
  }

  if (startPromise) {
    return startPromise
  }

  startPromise = (async () => {
    try {
      const agentDir = resolveHermesAgentDir()
      if (!agentDir) {
        return {
          ok: false,
          error:
            'hermes-agent not found. Expected a sibling ../hermes-agent directory or set HERMES_AGENT_PATH in .env',
        }
      }

      const semantierAgentDir = resolveSemantierAgentDir()
      const python = semantierAgentDir
        ? resolveSemantierPython(semantierAgentDir)
        : resolveHermesPython(agentDir)
      const hermesEnv = readHermesEnv()

      const useGatewayRun = existsSync(resolve(agentDir, 'gateway', 'run.py'))
      const commandArgs = useGatewayRun
        ? ['-m', 'gateway.run']
        : [
            '-m',
            'uvicorn',
            'webapi.app:app',
            '--host',
            '0.0.0.0',
            '--port',
            String(HERMES_START_PORT),
          ]

      const gatewayCwd = semantierAgentDir || agentDir
      const child = spawn(python, commandArgs, {
        cwd: gatewayCwd,
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          ...hermesEnv,
          API_SERVER_ENABLED: 'true',
          PYTHONPATH: agentDir
            ? `${agentDir}${process.env.PYTHONPATH ? `:${process.env.PYTHONPATH}` : ''}`
            : process.env.PYTHONPATH,
          PATH: `${resolve(gatewayCwd, '.venv', 'bin')}:${resolve(gatewayCwd, 'venv', 'bin')}:${process.env.PATH || ''}`,
        },
      })

      child.unref()

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolveAttempt) => setTimeout(resolveAttempt, 1_000))
        if (await isHermesAgentHealthy()) {
          return {
            ok: true,
            pid: child.pid,
            message: 'started',
          }
        }
      }

      return {
        ok: true,
        pid: child.pid,
        message: 'starting',
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })()

  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}
