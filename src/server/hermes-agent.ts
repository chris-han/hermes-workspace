const HERMES_HEALTH_TIMEOUT_MS = 2_000
const HERMES_START_PORT = 8899

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
    return {
      ok: true,
      message: 'semantier webapi is already running on :8899',
    }
  }

  return {
    ok: false,
    error:
      'semantier webapi is not running on :8899. Start it with `semantier webapi run --replace`.',
  }
}
