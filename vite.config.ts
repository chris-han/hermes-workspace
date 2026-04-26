import { URL, fileURLToPath } from 'node:url'
import { execSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import net from 'node:net'
import { resolve, dirname } from 'node:path'
import os from 'node:os'

// devtools removed
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// nitro plugin removed (tanstackStart handles server runtime)
import { defineConfig, loadEnv } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// ---------------------------------------------------------------------------
// Local service auto-start helpers
// ---------------------------------------------------------------------------

function normalizeServiceUrl(
  rawValue: string | undefined,
  fallback: string,
): string {
  return rawValue?.trim() || fallback
}

function isLoopbackUrl(rawValue: string): boolean {
  try {
    const parsed = new URL(rawValue)
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  } catch {
    return false
  }
}

function getServicePort(rawValue: string, fallbackPort: number): number {
  try {
    const parsed = new URL(rawValue)
    if (parsed.port) return Number(parsed.port)
    return parsed.protocol === 'https:' ? 443 : 80
  } catch {
    return fallbackPort
  }
}

function localServiceLabel(name: string): string {
  return `[${name}]`
}

/** Resolve the hermes-agent directory using a priority-ordered fallback chain:
 *  1. HERMES_AGENT_PATH env var (explicit override)
 *  2. ../hermes-agent  — sibling clone (standard README setup)
 *  3. ../../hermes-agent — one level up (monorepo / nested workspace)
 *  Returns null if none found.
 */
function resolveHermesAgentDir(env: Record<string, string>): string | null {
  const candidates: string[] = []

  if (env.HERMES_AGENT_PATH?.trim()) {
    candidates.push(env.HERMES_AGENT_PATH.trim())
  }

  // Resolve relative to the workspace root (parent of hermes-workspace/)
  const workspaceRoot = dirname(resolve('.'))
  candidates.push(
    resolve(workspaceRoot, 'hermes-agent'), // sibling hermes-agent directory
    resolve(workspaceRoot, '..', 'hermes-agent'), // one level up
  )

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'gateway', 'run.py'))) return candidate
  }
  return null
}

/** Resolve the Python executable to use for Hermes backend startup.
 *  Prefers .venv/bin/python inside agentDir, falls back to system python3.
 */
function resolveHermesPython(agentDir: string): string {
  const venvPython = resolve(agentDir, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return venvPython
  // uv creates 'venv' not '.venv' sometimes
  const uvVenv = resolve(agentDir, 'venv', 'bin', 'python')
  if (existsSync(uvVenv)) return uvVenv
  return 'python3'
}

function resolveSemantierAgentDir(env: Record<string, string>): string | null {
  const candidates: string[] = []

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

function resolveSemantierPython(agentDir: string): string {
  const venvPython = resolve(agentDir, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return venvPython
  const uvVenv = resolve(agentDir, 'venv', 'bin', 'python')
  if (existsSync(uvVenv)) return uvVenv
  return 'python3'
}

async function isHealthyEndpoint(url: string, path: string): Promise<boolean> {
  try {
    const base = url.replace(/\/$/, '')
    const r = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(2000),
    })
    return r.ok
  } catch {
    return false
  }
}

const config = defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hermesApiUrl = normalizeServiceUrl(
    env.HERMES_API_URL || process.env.HERMES_API_URL,
    'http://127.0.0.1:8642',
  )
  const semantierAgentUrl = normalizeServiceUrl(
    env.SEMANTIER_AGENT_API_URL || process.env.SEMANTIER_AGENT_API_URL,
    'http://127.0.0.1:8899',
  )
  const hermesDashboardUrl = normalizeServiceUrl(
    env.HERMES_DASHBOARD_URL || process.env.HERMES_DASHBOARD_URL,
    'http://127.0.0.1:9119',
  )

  // Local service auto-start state
  let hermesGatewayChild: ChildProcess | null = null
  let hermesGatewayStarted = false
  let semantierBackendChild: ChildProcess | null = null
  let semantierBackendStarted = false
  let hermesDashboardChild: ChildProcess | null = null
  let hermesDashboardStarted = false

  const startHermesGateway = async () => {
    if (hermesGatewayStarted) return
    if (!isLoopbackUrl(hermesApiUrl)) {
      console.log(
        `${localServiceLabel('hermes-gateway')} Skipping auto-start — using external API: ${hermesApiUrl}`,
      )
      hermesGatewayStarted = true
      return
    }
    if (await isHealthyEndpoint(hermesApiUrl, '/health')) {
      console.log(
        `${localServiceLabel('hermes-gateway')} Already running — reusing existing process`,
      )
      hermesGatewayStarted = true
      return
    }

    const agentDir = resolveHermesAgentDir(env)
    if (!agentDir) {
      console.warn(
        `${localServiceLabel('hermes-gateway')} Could not find hermes-agent directory.\n` +
          '  Set HERMES_AGENT_PATH in .env or clone hermes-agent as a sibling:\n' +
          '    Ensure hermes-agent exists as a sibling directory (../hermes-agent) or set HERMES_AGENT_PATH in .env',
      )
      return
    }

    const semantierAgentDir = resolveSemantierAgentDir(env)
    const python = semantierAgentDir
      ? resolveSemantierPython(semantierAgentDir)
      : resolveHermesPython(agentDir)
    const useGatewayRun = existsSync(resolve(agentDir, 'gateway', 'run.py'))
    const gatewayPort = String(getServicePort(hermesApiUrl, 8642))
    const commandArgs = useGatewayRun
      ? ['-m', 'gateway.run']
      : [
          '-m',
          'uvicorn',
          'webapi.app:app',
          '--host',
          '0.0.0.0',
          '--port',
          gatewayPort,
        ]

    const gatewayCwd = semantierAgentDir || agentDir
    console.log(
      `${localServiceLabel('hermes-gateway')} Starting from ${gatewayCwd} using ${python} (${useGatewayRun ? 'gateway.run' : `uvicorn :${gatewayPort}`})`,
    )

    const child = spawn(python, commandArgs, {
      cwd: gatewayCwd,
      detached: false, // keep tied to vite process — stops when dev server stops
      stdio: 'pipe',
      env: {
        ...process.env,
        PYTHONPATH: agentDir
          ? `${agentDir}${process.env.PYTHONPATH ? `:${process.env.PYTHONPATH}` : ''}`
          : process.env.PYTHONPATH,
        PATH: `${resolve(gatewayCwd, '.venv', 'bin')}:${resolve(gatewayCwd, 'venv', 'bin')}:${process.env.PATH || ''}`,
      },
    })

    hermesGatewayChild = child
    hermesGatewayStarted = true

    child.stdout?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${localServiceLabel('hermes-gateway')} ${line}`)
    })
    child.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${localServiceLabel('hermes-gateway')} ${line}`)
    })

    child.on('exit', (code) => {
      hermesGatewayChild = null
      hermesGatewayStarted = false
      if (code !== 0 && code !== null) {
        console.warn(
          `${localServiceLabel('hermes-gateway')} Exited with code ${code}`,
        )
      }
    })

    // Wait for healthy
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      if (await isHealthyEndpoint(hermesApiUrl, '/health')) {
        console.log(
          `${localServiceLabel('hermes-gateway')} ✓ Ready on ${hermesApiUrl}`,
        )
        return
      }
    }
    console.warn(
      `${localServiceLabel('hermes-gateway')} Started but health check timed out — may still be loading`,
    )
  }

  const startSemantierBackend = async () => {
    if (semantierBackendStarted) return
    if (!isLoopbackUrl(semantierAgentUrl)) {
      console.log(
        `${localServiceLabel('semantier-backend')} Skipping auto-start — using external API: ${semantierAgentUrl}`,
      )
      semantierBackendStarted = true
      return
    }
    if (await isHealthyEndpoint(semantierAgentUrl, '/health')) {
      console.log(
        `${localServiceLabel('semantier-backend')} Already running — reusing existing process`,
      )
      semantierBackendStarted = true
      return
    }

    const agentDir = resolveSemantierAgentDir(env)
    if (!agentDir) {
      console.warn(
        `${localServiceLabel('semantier-backend')} Could not find the local /agent directory.\n` +
          '  Set SEMANTIER_AGENT_PATH in .env or ensure ../agent exists beside hermes-workspace.',
      )
      return
    }

    const python = resolveSemantierPython(agentDir)
    const backendPort = String(getServicePort(semantierAgentUrl, 8899))
    console.log(
      `${localServiceLabel('semantier-backend')} Starting from ${agentDir} using ${python} (api_server.py :${backendPort})`,
    )

    const child = spawn(
      python,
      ['api_server.py', '--host', '0.0.0.0', '--port', backendPort],
      {
        cwd: agentDir,
        detached: false,
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `${resolve(agentDir, '.venv', 'bin')}:${resolve(agentDir, 'venv', 'bin')}:${process.env.PATH || ''}`,
        },
      },
    )

    semantierBackendChild = child
    semantierBackendStarted = true

    child.stdout?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${localServiceLabel('semantier-backend')} ${line}`)
    })
    child.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${localServiceLabel('semantier-backend')} ${line}`)
    })

    child.on('exit', (code) => {
      semantierBackendChild = null
      semantierBackendStarted = false
      if (code !== 0 && code !== null) {
        console.warn(
          `${localServiceLabel('semantier-backend')} Exited with code ${code}`,
        )
      }
    })

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      if (await isHealthyEndpoint(semantierAgentUrl, '/health')) {
        console.log(
          `${localServiceLabel('semantier-backend')} ✓ Ready on ${semantierAgentUrl}`,
        )
        return
      }
    }

    console.warn(
      `${localServiceLabel('semantier-backend')} Started but health check timed out — may still be loading`,
    )
  }

  const startHermesDashboard = async () => {
    if (hermesDashboardStarted) return
    if (!isLoopbackUrl(hermesDashboardUrl)) {
      console.log(
        `${localServiceLabel('hermes-dashboard')} Skipping auto-start — using external dashboard: ${hermesDashboardUrl}`,
      )
      hermesDashboardStarted = true
      return
    }
    if (await isHealthyEndpoint(hermesDashboardUrl, '/api/status')) {
      console.log(
        `${localServiceLabel('hermes-dashboard')} Already running — reusing existing process`,
      )
      hermesDashboardStarted = true
      return
    }

    const agentDir = resolveSemantierAgentDir(env)
    if (!agentDir) {
      console.warn(
        `${localServiceLabel('hermes-dashboard')} Could not find the local /agent directory.\n` +
          '  Set SEMANTIER_AGENT_PATH in .env or ensure ../agent exists beside hermes-workspace.',
      )
      return
    }

    const python = resolveSemantierPython(agentDir)
    const dashboardPort = String(getServicePort(hermesDashboardUrl, 9119))
    console.log(
      `${localServiceLabel('hermes-dashboard')} Starting from ${agentDir} using ${python} (hermes_dashboard_wrapper:app :${dashboardPort})`,
    )

    const child = spawn(
      python,
      [
        '-m',
        'uvicorn',
        'hermes_dashboard_wrapper:app',
        '--host',
        '0.0.0.0',
        '--port',
        dashboardPort,
        '--log-level',
        'warning',
      ],
      {
        cwd: agentDir,
        detached: false,
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `${resolve(agentDir, '.venv', 'bin')}:${resolve(agentDir, 'venv', 'bin')}:${process.env.PATH || ''}`,
        },
      },
    )

    hermesDashboardChild = child
    hermesDashboardStarted = true

    child.stdout?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${localServiceLabel('hermes-dashboard')} ${line}`)
    })
    child.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${localServiceLabel('hermes-dashboard')} ${line}`)
    })

    child.on('exit', (code) => {
      hermesDashboardChild = null
      hermesDashboardStarted = false
      if (code !== 0 && code !== null) {
        console.warn(
          `${localServiceLabel('hermes-dashboard')} Exited with code ${code}`,
        )
      }
    })

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      if (await isHealthyEndpoint(hermesDashboardUrl, '/api/status')) {
        console.log(
          `${localServiceLabel('hermes-dashboard')} ✓ Ready on ${hermesDashboardUrl}`,
        )
        return
      }
    }

    console.warn(
      `${localServiceLabel('hermes-dashboard')} Started but health check timed out — may still be loading`,
    )
  }

  let workspaceDaemonStarted = false
  let workspaceDaemonStarting = false
  let workspaceDaemonShuttingDown = false
  let workspaceDaemonRestarting = false
  let workspaceDaemonChild: ChildProcess | null = null
  let workspaceDaemonRetryCount = 0
  const workspaceDaemonPort = '3099'
  const daemonCwd = resolve('workspace-daemon')
  const daemonSrcEntry = resolve('workspace-daemon/src/server.ts')
  const daemonDistEntry = resolve('workspace-daemon/dist/server.js')
  const workspaceDaemonDbPath = resolve(
    'workspace-daemon/.workspaces/workspace.db',
  )

  const getWorkspaceDaemonDelayMs = (attempt: number) =>
    Math.min(1000 * 2 ** Math.max(attempt - 1, 0), 30000)

  const startWorkspaceDaemon = () => {
    if (workspaceDaemonShuttingDown) return
    if (workspaceDaemonStarted || workspaceDaemonStarting) return

    const spawnCommand = existsSync(daemonSrcEntry)
      ? {
          commandName: 'npx',
          args: ['tsx', 'watch', 'src/server.ts'],
          options: {
            cwd: daemonCwd,
            env: {
              ...process.env,
              PORT: workspaceDaemonPort,
              DB_PATH: workspaceDaemonDbPath,
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
            },
            stdio: 'inherit' as const,
          },
        }
      : existsSync(daemonDistEntry)
        ? {
            commandName: 'node',
            args: ['dist/server.js'],
            options: {
              cwd: daemonCwd,
              env: {
                ...process.env,
                PORT: workspaceDaemonPort,
                DB_PATH: workspaceDaemonDbPath,
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
              },
              stdio: 'inherit' as const,
            },
          }
        : null

    if (!spawnCommand) {
      workspaceDaemonStarting = false
      console.error('[workspace-daemon] no server entry found to spawn.')
      return
    }

    workspaceDaemonStarted = true
    workspaceDaemonStarting = false
    const child = spawn(
      spawnCommand.commandName,
      spawnCommand.args,
      spawnCommand.options,
    )
    workspaceDaemonChild = child

    child.on('exit', (code) => {
      if (workspaceDaemonChild === child) {
        workspaceDaemonChild = null
      }

      if (workspaceDaemonShuttingDown || workspaceDaemonRestarting) {
        workspaceDaemonStarted = false
        workspaceDaemonStarting = false
        return
      }

      if (code === 0) {
        workspaceDaemonStarted = false
        workspaceDaemonStarting = false
        return
      }

      if (workspaceDaemonRetryCount >= 20) {
        workspaceDaemonStarted = false
        workspaceDaemonStarting = false
        console.error(
          `[workspace-daemon] crashed with code ${code ?? 'unknown'}; max restart attempts reached.`,
        )
        return
      }

      workspaceDaemonRetryCount += 1
      const delayMs = getWorkspaceDaemonDelayMs(workspaceDaemonRetryCount)
      console.error(
        `[workspace-daemon] crashed with code ${code ?? 'unknown'}; restarting in ${Math.round(
          delayMs / 1000,
        )}s (${workspaceDaemonRetryCount}/20).`,
      )

      workspaceDaemonStarting = true
      workspaceDaemonStarted = false
      setTimeout(() => {
        startWorkspaceDaemon()
      }, delayMs)
    })

    child.on('error', (error) => {
      console.error(`[workspace-daemon] failed to spawn: ${error.message}`)
    })
  }

  const stopWorkspaceDaemon = async () => {
    const child = workspaceDaemonChild
    if (!child) {
      workspaceDaemonStarted = false
      workspaceDaemonStarting = false
      return
    }

    workspaceDaemonRestarting = true

    await new Promise<void>((resolve) => {
      const exitTimer = setTimeout(() => {
        if (!child.killed && child.pid) {
          try {
            process.kill(child.pid, 'SIGKILL')
          } catch {
            // ignore
          }
        }
      }, 5000)

      child.once('exit', () => {
        clearTimeout(exitTimer)
        resolve()
      })

      if (child.pid) {
        try {
          process.kill(child.pid, 'SIGTERM')
        } catch {
          clearTimeout(exitTimer)
          resolve()
        }
      } else {
        clearTimeout(exitTimer)
        resolve()
      }
    })

    workspaceDaemonStarted = false
    workspaceDaemonStarting = false
    workspaceDaemonRestarting = false
  }

  const restartWorkspaceDaemon = async () => {
    workspaceDaemonRetryCount = 0
    await stopWorkspaceDaemon()
    workspaceDaemonStarted = false
    workspaceDaemonStarting = false
    startWorkspaceDaemon()
  }

  const isPortInUse = (port: number) =>
    new Promise<boolean>((resolvePortCheck) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.destroy()
        resolvePortCheck(true)
      })
      socket.once('error', () => resolvePortCheck(false))
    })

  const hasHealthyWorkspaceDaemon = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${workspaceDaemonPort}/api/workspace/version`,
        {
          signal: AbortSignal.timeout(2000),
        },
      )
      return response.ok
    } catch {
      return false
    }
  }

  // Allow access from Tailscale, LAN, or custom domains via env var
  // e.g. HERMES_ALLOWED_HOSTS=my-server.tail1234.ts.net,192.168.1.50
  const _allowedHosts: string[] | true = env.HERMES_ALLOWED_HOSTS?.trim()
    ? env
        .HERMES_ALLOWED_HOSTS!.split(',')
        .map((h) => h.trim())
        .filter(Boolean)
    : ['.ts.net'] // allow all Tailscale hostnames by default
  let proxyTarget = 'http://127.0.0.1:18789'

  try {
    const parsed = new URL(hermesApiUrl)
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:'
    parsed.pathname = ''
    proxyTarget = parsed.toString().replace(/\/$/, '')
  } catch {
    // fallback
  }

  return {
    define: {
      // Note: Do NOT set 'process.env': {} here — TanStack Start uses environment-based
      // builds where isSsrBuild is unreliable. Blanket process.env replacement breaks
      // server-side code in Docker (kills runtime env var access).
      // Client-side process.env is handled per-environment below.
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    ssr: {
      external: [
        'md-to-pdf',
        'puppeteer',
      ],
    },
    optimizeDeps: {
      exclude: [
        'md-to-pdf',
        'puppeteer',
      ],
    },
    server: {
      // Force IPv4 — 'localhost' resolves to ::1 (IPv6) on Windows, breaking connectivity
      host: '0.0.0.0',
      port: 3002,
      strictPort: false, // allow fallback if 3002 is taken, but log clearly
      allowedHosts: true,
      watch: {
        // Exclude generated route tree — TanStack Router's file watcher
        // detects its own output as a change → infinite regeneration loop
        ignored: ['**/routeTree.gen.ts'],
      },
      proxy: {
        // WebSocket proxy: clients connect to /ws-hermes on the Hermes Workspace
        // server (any IP/port), which internally forwards to the local server.
        // This means phone/LAN/Docker users never need to reach port 18789 directly.
        '/ws-hermes': {
          target: proxyTarget,
          changeOrigin: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/ws-hermes/, ''),
        },
        // REST API proxy: API proxy for Hermes backend
        '/api/hermes-proxy': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/hermes-proxy/, ''),
        },
        '/hermes-ui': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hermes-ui/, ''),
          ws: true,
          configure: (proxy) => {
            proxy.on('proxyRes', (_proxyRes) => {
              // Strip iframe-blocking headers so we can embed
              delete _proxyRes.headers['x-frame-options']
              delete _proxyRes.headers['content-security-policy']
            })
          },
        },
        '/workspace-api': {
          target: 'http://127.0.0.1:3099',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/workspace-api/, ''),
        },
      },
    },
    plugins: [
      // devtools(),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      {
        name: 'workspace-daemon',
        buildStart() {
          if (command !== 'serve') return
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const requestPath = req.url?.split('?')[0]
            if (req.method === 'GET' && requestPath === '/api/healthcheck') {
              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
              return
            }

            // Portable-aware health check — returns ok if any chat backend is available
            if (
              req.method === 'GET' &&
              requestPath === '/api/connection-status'
            ) {
              try {
                // Check for enhanced Hermes gateway first (has /api/sessions)
                const [modelsRes, sessionsRes] = await Promise.all([
                  fetch(`${hermesApiUrl}/v1/models`, {
                    signal: AbortSignal.timeout(3000),
                  }).catch(() => null),
                  fetch(`${hermesApiUrl}/api/sessions?limit=1`, {
                    signal: AbortSignal.timeout(3000),
                  }).catch(() => null),
                ])
                const hasModels = modelsRes?.ok ?? false
                const hasSessions = sessionsRes?.ok ?? false
                if (hasModels && hasSessions) {
                  res.statusCode = 200
                  res.setHeader('content-type', 'application/json')
                  res.end(
                    JSON.stringify({
                      ok: true,
                      mode: 'enhanced',
                      backend: hermesApiUrl,
                    }),
                  )
                  return
                }
                if (hasModels) {
                  res.statusCode = 200
                  res.setHeader('content-type', 'application/json')
                  res.end(
                    JSON.stringify({
                      ok: true,
                      mode: 'portable',
                      backend: hermesApiUrl,
                    }),
                  )
                  return
                }
                // Fall back to /health for full Hermes backends
                const healthRes = await fetch(`${hermesApiUrl}/health`, {
                  signal: AbortSignal.timeout(3000),
                })
                res.statusCode = healthRes.ok ? 200 : 502
                res.setHeader('content-type', 'application/json')
                res.end(
                  JSON.stringify({
                    ok: healthRes.ok,
                    mode: 'enhanced',
                    backend: hermesApiUrl,
                  }),
                )
              } catch {
                res.statusCode = 502
                res.setHeader('content-type', 'application/json')
                res.end(
                  JSON.stringify({
                    ok: false,
                    mode: 'disconnected',
                    backend: hermesApiUrl,
                  }),
                )
              }
              return
            }

            if (
              req.method !== 'POST' ||
              requestPath !== '/api/workspace/daemon/restart'
            ) {
              next()
              return
            }

            try {
              await restartWorkspaceDaemon()
              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json')
              res.end(
                JSON.stringify({
                  error:
                    error instanceof Error ? error.message : 'Internal error',
                }),
              )
            }
          })

          server.httpServer?.on('close', () => {
            workspaceDaemonShuttingDown = true
            workspaceDaemonStarted = false
            workspaceDaemonStarting = false
            if (workspaceDaemonChild) {
              workspaceDaemonChild.kill()
              workspaceDaemonChild = null
            }
          })

          // Auto-start the local services that are owned by this monorepo.
          if (command === 'serve') {
            void startSemantierBackend()
            void startHermesDashboard()
            void startHermesGateway()
          }

          // Shutdown managed child processes when dev server stops.
          server.httpServer?.on('close', () => {
            if (semantierBackendChild) {
              console.log(
                `${localServiceLabel('semantier-backend')} Stopping...`,
              )
              semantierBackendChild.kill('SIGTERM')
              semantierBackendChild = null
              semantierBackendStarted = false
            }
            if (hermesDashboardChild) {
              console.log(
                `${localServiceLabel('hermes-dashboard')} Stopping...`,
              )
              hermesDashboardChild.kill('SIGTERM')
              hermesDashboardChild = null
              hermesDashboardStarted = false
            }
            if (hermesGatewayChild) {
              console.log(`${localServiceLabel('hermes-gateway')} Stopping...`)
              hermesGatewayChild.kill('SIGTERM')
              hermesGatewayChild = null
              hermesGatewayStarted = false
            }
          })

          if (
            command !== 'serve' ||
            workspaceDaemonStarted ||
            workspaceDaemonStarting
          )
            return

          workspaceDaemonStarting = true
          void (async () => {
            const running = await isPortInUse(Number(workspaceDaemonPort))
            if (workspaceDaemonStarted) {
              workspaceDaemonStarting = false
              return
            }

            if (running) {
              const healthy = await hasHealthyWorkspaceDaemon()
              if (healthy) {
                workspaceDaemonStarting = false
                console.log('[workspace-daemon] Reusing existing daemon')
                return
              }

              try {
                execSync(
                  `lsof -ti:${workspaceDaemonPort} | xargs kill -9 2>/dev/null || true`,
                )
              } catch {
                // ignore stale cleanup failures and continue with a fresh spawn
              }
            }

            startWorkspaceDaemon()
          })()
        },
      },
      // Client-only: replace process.env references in client bundles
      // Server bundles must keep real process.env for Docker runtime env vars
      {
        name: 'client-process-env',
        enforce: 'pre',
        transform(code, _id) {
          const envName = this.environment?.name
          if (envName !== 'client') return null
          if (
            !code.includes('process.env') &&
            !code.includes('process.platform')
          )
            return null

          // Replace specific env vars first, then the generic fallback
          let result = code
          result = result.replace(
            /process\.env\.HERMES_API_URL/g,
            JSON.stringify(hermesApiUrl),
          )
          result = result.replace(
            /process\.env\.HERMES_API_TOKEN/g,
            JSON.stringify(env.HERMES_API_TOKEN || ''),
          )
          result = result.replace(
            /process\.env\.NODE_ENV/g,
            JSON.stringify(mode),
          )
          result = result.replace(/process\.env/g, '{}')
          result = result.replace(/process\.platform/g, '"browser"')
          return result
        },
      },
      // Copy pty-helper.py into the server assets directory after build
      {
        name: 'copy-pty-helper',
        closeBundle() {
          const src = resolve('src/server/pty-helper.py')
          const destDir = resolve('dist/server/assets')
          const dest = resolve(destDir, 'pty-helper.py')
          if (existsSync(src)) {
            mkdirSync(destDir, { recursive: true })
            copyFileSync(src, dest)
          }
        },
      },
    ],
  }
})

export default config
