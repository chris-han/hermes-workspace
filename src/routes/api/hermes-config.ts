/**
 * Hermes Config API — read/write the active Hermes config home used by the backend.
 * Gives the web UI the same config power as `hermes setup`.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  ensureGatewayProbed,
  getCapabilities,
} from '../../server/gateway-capabilities'
import {
  resolveHermesConfigPathFromBackend,
  resolveHermesEnvPathFromBackend,
  resolveHermesHomeFromBackend,
  resolveHermesPathFromBackend,
} from '../../server/hermes-home'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'

type AuthResult = Response | true

// Known Hermes providers
const PROVIDERS = [
  { id: 'nous', name: 'Nous Portal', authType: 'oauth', envKeys: [] },
  { id: 'openai-codex', name: 'OpenAI Codex', authType: 'oauth', envKeys: [] },
  {
    id: 'anthropic',
    name: 'Anthropic',
    authType: 'api_key',
    envKeys: ['ANTHROPIC_API_KEY'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    authType: 'api_key',
    envKeys: ['OPENROUTER_API_KEY'],
  },
  {
    id: 'zai',
    name: 'Z.AI / GLM',
    authType: 'api_key',
    envKeys: ['GLM_API_KEY'],
  },
  {
    id: 'kimi-coding',
    name: 'Kimi / Moonshot',
    authType: 'api_key',
    envKeys: ['KIMI_API_KEY'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    authType: 'api_key',
    envKeys: ['MINIMAX_API_KEY'],
  },
  {
    id: 'minimax-cn',
    name: 'MiniMax (China)',
    authType: 'api_key',
    envKeys: ['MINIMAX_CN_API_KEY'],
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi MiMo',
    authType: 'api_key',
    envKeys: ['XIAOMI_API_KEY'],
  },
  { id: 'ollama', name: 'Ollama (Local)', authType: 'none', envKeys: [] },
  {
    id: 'atomic-chat',
    name: 'Atomic Chat (Local)',
    authType: 'none',
    envKeys: [],
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible',
    authType: 'api_key',
    envKeys: [],
  },
]

function readConfig(configPath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = YAML.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function writeConfig(
  config: Record<string, unknown>,
  hermesHome: string,
  configPath: string,
): void {
  fs.mkdirSync(hermesHome, { recursive: true })
  fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8')
}

function readEnv(envPath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(envPath, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        // Strip quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        env[key] = value
      }
    }
    return env
  } catch {
    return {}
  }
}

function writeEnv(
  env: Record<string, string>,
  hermesHome: string,
  envPath: string,
): void {
  fs.mkdirSync(hermesHome, { recursive: true })
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`)
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8')
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '***'
  return key.slice(0, 4) + '...' + key.slice(-4)
}

async function checkAuthStore(providerId: string): Promise<{
  hasToken: boolean
  source: string
  maskedKey?: string
}> {
  const hermesAuthStorePath =
    await resolveHermesPathFromBackend('auth-profiles.json')
  // Check Hermes auth store
  for (const storePath of [
    hermesAuthStorePath,
    path.join(
      os.homedir(),
      '.openclaw',
      'agents',
      'main',
      'agent',
      'auth-profiles.json',
    ),
  ]) {
    try {
      if (!fs.existsSync(storePath)) continue
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      const profiles = store?.profiles || {}
      for (const [key, value] of Object.entries(profiles)) {
        if (!key.startsWith(`${providerId}:`)) continue
        if (typeof value !== 'object' || value === null) continue
        const p = value as Record<string, unknown>
        const token = String(p.token || p.key || p.access || '').trim()
        if (token) {
          const source = storePath.includes('.hermes')
            ? 'hermes-auth-store'
            : 'openclaw-auth-store'
          return { hasToken: true, source, maskedKey: maskKey(token) }
        }
      }
    } catch {}
  }
  return { hasToken: false, source: '' }
}

export const Route = createFileRoute('/api/hermes-config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authResult = isAuthenticated(request) as AuthResult
        if (authResult !== true) return authResult
        await ensureGatewayProbed()
        const hermesHome = await resolveHermesHomeFromBackend()
        if (!getCapabilities().config) {
          return Response.json({
            ...createCapabilityUnavailablePayload('config'),
            config: {},
            providers: [],
            activeProvider: '',
            activeModel: '',
            hermesHome,
          })
        }

        const configPath = await resolveHermesConfigPathFromBackend()
        const envPath = await resolveHermesEnvPathFromBackend()

        const config = readConfig(configPath)
        const env = readEnv(envPath)

        // Build provider status
        const providerStatus = await Promise.all(
          PROVIDERS.map(async (p) => {
            const hasEnvKey =
              p.envKeys.length === 0 || p.envKeys.some((k) => !!env[k])
            const authStoreCheck = await checkAuthStore(p.id)
            const hasKey =
              hasEnvKey || authStoreCheck.hasToken || p.authType === 'none'
            const maskedKeys: Record<string, string> = {}
            for (const k of p.envKeys) {
              if (env[k]) maskedKeys[k] = maskKey(env[k])
            }
            if (authStoreCheck.hasToken && authStoreCheck.maskedKey) {
              maskedKeys['auth-store'] = authStoreCheck.maskedKey
            }
            return {
              ...p,
              configured: hasKey,
              authSource: authStoreCheck.hasToken
                ? authStoreCheck.source
                : hasEnvKey
                  ? 'env'
                  : 'none',
              maskedKeys,
            }
          }),
        )

        // Get active provider/model from config
        // Support both flat keys (model: "gpt-5.4", provider: "openai-codex")
        // and legacy nested format (model: { default: "...", provider: "..." })
        const modelField = config.model
        let activeModel = ''
        let activeProvider = ''
        if (typeof modelField === 'string') {
          activeModel = modelField
          activeProvider = (config.provider as string) || ''
        } else if (modelField && typeof modelField === 'object') {
          const modelObj = modelField as Record<string, unknown>
          activeModel = (modelObj.default as string) || ''
          activeProvider =
            (modelObj.provider as string) || (config.provider as string) || ''
        }

        return Response.json({
          config,
          providers: providerStatus,
          activeProvider,
          activeModel,
          hermesHome,
        })
      },

      PATCH: async ({ request }) => {
        const authResult = isAuthenticated(request) as AuthResult
        if (authResult !== true) return authResult
        await ensureGatewayProbed()
        if (!getCapabilities().config) {
          return new Response(
            JSON.stringify(
              createCapabilityUnavailablePayload('config', {
                error: 'Configuration updates are unavailable on this backend.',
              }),
            ),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const body = (await request.json()) as Record<string, unknown>
        const hermesHome = await resolveHermesHomeFromBackend()
        const configPath = await resolveHermesConfigPathFromBackend()
        const envPath = await resolveHermesEnvPathFromBackend()

        // Handle config updates
        if (body.config && typeof body.config === 'object') {
          const current = readConfig(configPath)
          const updates = body.config as Record<string, unknown>

          // Deep merge
          function deepMerge(
            target: Record<string, unknown>,
            source: Record<string, unknown>,
          ) {
            for (const [key, value] of Object.entries(source)) {
              if (
                value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                target[key] &&
                typeof target[key] === 'object'
              ) {
                deepMerge(
                  target[key] as Record<string, unknown>,
                  value as Record<string, unknown>,
                )
              } else {
                target[key] = value
              }
            }
          }

          // Handle null values as explicit removals
          for (const [key, value] of Object.entries(updates)) {
            if (value === null) {
              delete current[key]
              delete updates[key]
            }
          }
          deepMerge(current, updates)
          writeConfig(current, hermesHome, configPath)
        }

        // Handle env var updates
        if (body.env && typeof body.env === 'object') {
          const currentEnv = readEnv(envPath)
          const envUpdates = body.env as Record<string, string | null>
          for (const [key, value] of Object.entries(envUpdates)) {
            if (value === '' || value === null) {
              delete currentEnv[key]
            } else {
              currentEnv[key] = value
            }
          }
          writeEnv(currentEnv, hermesHome, envPath)
        }

        return Response.json({
          ok: true,
          message: 'Config updated. Restart Hermes to apply changes.',
          hermesHome,
        })
      },
    },
  },
})
