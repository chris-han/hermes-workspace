import fs from 'node:fs'
import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { ensureGatewayProbed } from '../../server/hermes-api'
import {
  resolveHermesConfigPathFromBackend,
  resolveHermesEnvPathFromBackend,
  resolveHermesPathFromBackend,
} from '../../server/hermes-home'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'

type ModelEntry = {
  provider?: string
  id?: string
  name?: string
  [key: string]: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>
  return {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeModel(entry: unknown): ModelEntry | null {
  if (typeof entry === 'string') {
    const id = entry.trim()
    if (!id) return null
    return {
      id,
      name: id,
      provider: id.includes('/') ? id.split('/')[0] : 'unknown',
    }
  }
  const record = asRecord(entry)
  const id =
    readString(record.id) || readString(record.name) || readString(record.model)
  if (!id) return null
  return {
    ...record,
    id,
    name:
      readString(record.name) ||
      readString(record.display_name) ||
      readString(record.label) ||
      id,
    provider:
      readString(record.provider) ||
      readString(record.owned_by) ||
      (id.includes('/') ? id.split('/')[0] : 'unknown'),
  }
}

/**
 * Read user-configured models from the active Hermes home models.json.
 * This is the curated list the user manages via the Hermes CLI or UI.
 * Each entry has: { id, name, provider, model, baseUrl, createdAt }
 */
function readHermesModelsJson(modelsPath: string): Array<ModelEntry> {
  try {
    if (!fs.existsSync(modelsPath)) return []
    const raw = fs.readFileSync(modelsPath, 'utf-8')
    const entries = JSON.parse(raw)
    if (!Array.isArray(entries)) return []
    return entries.flatMap((entry: Record<string, unknown>) => {
      // models.json uses "model" field for the model ID
      const modelId = readString(entry.model) || readString(entry.id)
      if (!modelId) return []
      return [
        {
          id: modelId,
          name: readString(entry.name) || modelId,
          provider: readString(entry.provider) || 'unknown',
        },
      ]
    })
  } catch {
    return []
  }
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

/**
 * Read the default model from the active Hermes config.yaml without a YAML parser.
 * Looks for "default: <model-id>" under the "model:" section.
 */
function readHermesDefaultModel(configPath: string): ModelEntry | null {
  try {
    if (!fs.existsSync(configPath)) return null
    const raw = fs.readFileSync(configPath, 'utf-8')
    const defaultMatch = raw.match(/^\s*default:\s*(.+)$/m)
    const providerMatch = raw.match(/^\s*provider:\s*(.+)$/m)
    if (!defaultMatch) return null
    const modelId = defaultMatch[1].trim()
    const provider = providerMatch ? providerMatch[1].trim() : 'unknown'
    return { id: modelId, name: modelId, provider }
  } catch {
    return null
  }
}

export function readHermesDefaultModelFromEnv(envPath: string): ModelEntry | null {
  const env = readEnv(envPath)
  const rawModel = (env.HERMES_INFERENCE_MODEL || env.HERMES_MODEL || '').trim()
  if (!rawModel) return null

  const providerFromEnv = (env.HERMES_INFERENCE_PROVIDER || '').trim().toLowerCase()
  const provider = providerFromEnv || (rawModel.includes('/') ? rawModel.split('/')[0] : '')

  return {
    id: rawModel,
    name: rawModel,
    ...(provider ? { provider } : {}),
  }
}

export const Route = createFileRoute('/api/models')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        ensureGatewayProbed()

        try {
          const modelsPath = await resolveHermesPathFromBackend(
            request.headers,
            'models.json',
          )
          const configPath = await resolveHermesConfigPathFromBackend(
            request.headers,
          )
          const envPath = await resolveHermesEnvPathFromBackend(request.headers)
          const env = readEnv(envPath)

          // Primary: read user-configured models from the active Hermes home.
          const models = readHermesModelsJson(modelsPath)
          const source = 'models.json'

          // Ensure the default model from config.yaml is always included
          const defaultModel = readHermesDefaultModel(configPath)
          if (defaultModel) {
            const hasDefault = models.some((m) => m.id === defaultModel.id)
            if (!hasDefault) {
              models.unshift(defaultModel)
            }
          }

          const configuredProviderSet = new Set<string>()

          if (env.HERMES_INFERENCE_PROVIDER) {
            configuredProviderSet.add(env.HERMES_INFERENCE_PROVIDER.trim().toLowerCase())
          }

          const envDefaultModel = readHermesDefaultModelFromEnv(envPath)
          if (envDefaultModel) {
            const hasEnvDefault = models.some(
              (m) =>
                m.id === envDefaultModel.id &&
                m.provider === envDefaultModel.provider,
            )
            if (!hasEnvDefault) {
              models.unshift(envDefaultModel)
            }
            if (envDefaultModel.provider) {
              configuredProviderSet.add(
                envDefaultModel.provider.trim().toLowerCase(),
              )
            }
          }

          // In semantier-unicell mode, models come exclusively from the agent
          // wrapper (models.json / config.yaml). No fallback to /v1/models or
          // local provider discovery is performed.

          for (const model of models) {
            if (typeof model.provider === 'string' && model.provider) {
              configuredProviderSet.add(model.provider.trim().toLowerCase())
            }
          }

          const configuredProviders = Array.from(configuredProviderSet)

          return json({
            ok: true,
            object: 'list',
            data: models,
            models,
            configuredProviders,
            source,
          })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return json({ ok: false, error: err.message }, { status: 401 })
          }
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 503 },
          )
        }
      },
    },
  },
})
