import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const TEST_FILE = fileURLToPath(import.meta.url)
const WORKSPACE_SRC = path.resolve(path.dirname(TEST_FILE), '../..')
const LEGACY_SLUG = ['meeting', 'coordinator'].join('-')
const LEGACY_PANEL = ['Meeting', 'Coordinator', 'Panel'].join('')

const LEGACY_FILES = [
  ['screens/agents/components', `${LEGACY_SLUG}-panel.tsx`].join('/'),
  ['lib', `${LEGACY_SLUG}-api.ts`].join('/'),
  ['routes/api', `${LEGACY_SLUG}.ts`].join('/'),
  ['routes/api', `${LEGACY_SLUG}-settings.ts`].join('/'),
  ['server', `semantier-${LEGACY_SLUG}-api.ts`].join('/'),
]

const FORBIDDEN_LITERALS = [
  `/api/${LEGACY_SLUG}`,
  `/api/${LEGACY_SLUG}-settings`,
  `/system/${LEGACY_SLUG}`,
  LEGACY_PANEL,
  `${LEGACY_SLUG}-panel`,
  ['RSVP', 'Follow-Up', 'Policy'].join(' '),
  'declined attendee',
  'candidate slot',
  'needs-requester-decision',
]

function tsFiles(dir: string): Array<string> {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return tsFiles(fullPath)
    if (!entry.isFile()) return []
    if (!/\.(ts|tsx)$/.test(entry.name)) return []
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return []
    if (path.resolve(fullPath) === TEST_FILE) return []
    return [fullPath]
  })
}

function stringLiterals(sourceFile: ts.SourceFile): Array<string> {
  const values: Array<string> = []
  function visit(node: ts.Node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      values.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return values
}

describe('plugin UI extension boundary', () => {
  it('keeps legacy meeting coordinator workspace files removed', () => {
    for (const relativePath of LEGACY_FILES) {
      expect(fs.existsSync(path.join(WORKSPACE_SRC, relativePath))).toBe(false)
    }
  })

  it('keeps meeting coordinator endpoints and panels out of workspace source', () => {
    const violations: Array<string> = []

    for (const filePath of tsFiles(WORKSPACE_SRC)) {
      const sourceText = fs.readFileSync(filePath, 'utf-8')
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )

      for (const literal of stringLiterals(sourceFile)) {
        const forbidden = FORBIDDEN_LITERALS.find((value) =>
          literal.includes(value),
        )
        if (!forbidden) continue
        violations.push(
          `${path.relative(WORKSPACE_SRC, filePath)}: ${forbidden}`,
        )
      }
    }

    expect(violations).toEqual([])
  })
})
