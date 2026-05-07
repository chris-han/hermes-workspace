import fs from 'node:fs'
import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { ensureGatewayProbed } from '../../server/hermes-api'
import {
  resolveHermesConfigPathFromBackend,
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
    return entries
      .map((entry: Record<string, unknown>) => {
        // models.json uses "model" field for the model ID
        const modelId = readString(entry.model) || readString(entry.id)
        if (!modelId) return null
        return {
          id: modelId,
          name: readString(entry.name) || modelId,
          provider: readString(entry.provider) || 'unknown',
        }
      })
      .filter((e: ModelEntry | null): e is ModelEntry => e !== null)
  } catch {
    return []
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

          // Primary: read user-configured models from the active Hermes home.
          let models = readHermesModelsJson(modelsPath)
          let source = 'models.json'

          // Ensure the default model from config.yaml is always included
          const defaultModel = readHermesDefaultModel(configPath)
          if (defaultModel) {
            const hasDefault = models.some((m) => m.id === defaultModel.id)
            if (!hasDefault) {
              models.unshift(defaultModel)
            }
          }

          // In semantier-unicell mode, models come exclusively from the agent
          // wrapper (models.json / config.yaml). No fallback to /v1/models or
          // local provider discovery is performed.

          const configuredProviders = Array.from(
            new Set(
              models
                .map((model) =>
                  typeof model.provider === 'string' ? model.provider : '',
                )
                .filter(Boolean),
            ),
          )

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
