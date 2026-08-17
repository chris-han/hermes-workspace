import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const STUDIO_ROOT = join(process.cwd(), 'src/screens/contextgraph-studio')

// Known fixtures that must never appear in production Studio source.
// We use explicit character-class matches for the Chinese fixtures (the
// previous \b boundaries silently skipped them) and a substring match for
// the ``graph_v11`` / ``graph_v12`` literals since the production source
// uses string concatenation to evade the word-boundary check.
const KNOWN_FIXTURE_PATTERNS: RegExp[] = [
  /\bgraph_v11\b/,
  /\bgraph_v12\b/,
  /\bphase1-001-v0-candidate\b/,
  /POC敏感词汇总\.docx/,
  /企业规模门槛/,
  /一、敏感词分类检测表/,
  /行业龙头企业/,
  // Concat-evasion patterns.
  /'graph_' \+ 'v1[12]'/,
  /'POC' \+ '敏感词汇总\.docx'/,
  /'企业规模' \+ '门槛'/,
]

async function productionStudioFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === '__tests__') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await productionStudioFiles(path)))
      continue
    }
    if (/\.test\.[^.]+$|\.spec\.[^.]+$/.test(entry.name)) continue
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(path)
  }
  return files
}

describe('ContextGraph Studio production fixture boundary', () => {
  it('does not contain known fixture identities or static candidate values', async () => {
    const matches: string[] = []
    for (const file of await productionStudioFiles(STUDIO_ROOT)) {
      const source = await readFile(file, 'utf8')
      source.split('\n').forEach((line) => {
        for (const pattern of KNOWN_FIXTURE_PATTERNS) {
          if (pattern.test(line)) {
            matches.push(`${relative(STUDIO_ROOT, file)}: ${line}`)
            return
          }
        }
      })
    }

    expect(matches).toEqual([])
  })
})
