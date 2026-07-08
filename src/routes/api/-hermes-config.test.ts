import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveActiveModelFromConfigAndEnv } from './hermes-config'
import { readHermesDefaultModelFromEnv } from './models'

describe('hermes config env sync', () => {
  const tmpDirs: Array<string> = []

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to inference env when config is not seeded', () => {
    const result = resolveActiveModelFromConfigAndEnv(
      {},
      {
        HERMES_INFERENCE_PROVIDER: 'alibaba',
        HERMES_INFERENCE_MODEL: 'qwen3.5-plus',
      },
    )

    expect(result).toEqual({
      activeProvider: 'alibaba',
      activeModel: 'qwen3.5-plus',
    })
  })

  it('keeps config values ahead of env fallback when config is seeded', () => {
    const result = resolveActiveModelFromConfigAndEnv(
      {
        model: {
          provider: 'openrouter',
          default: 'openrouter/claude-sonnet-4',
        },
      },
      {
        HERMES_INFERENCE_PROVIDER: 'alibaba',
        HERMES_INFERENCE_MODEL: 'qwen3.5-plus',
      },
    )

    expect(result).toEqual({
      activeProvider: 'openrouter',
      activeModel: 'openrouter/claude-sonnet-4',
    })
  })

  it('reads the inference env file for startup-seeded provider and model', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-config-'))
    tmpDirs.push(dir)
    const envPath = path.join(dir, '.env')
    fs.writeFileSync(
      envPath,
      'HERMES_INFERENCE_PROVIDER=alibaba\nHERMES_INFERENCE_MODEL=qwen3.5-plus\n',
      'utf-8',
    )

    expect(readHermesDefaultModelFromEnv(envPath)).toEqual({
      id: 'qwen3.5-plus',
      name: 'qwen3.5-plus',
      provider: 'alibaba',
    })
  })
})
