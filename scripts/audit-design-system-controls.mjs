import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const ROOT = path.resolve(process.cwd())
const SOURCE_ROOT = path.join(ROOT, 'src')
const OUTPUT = path.resolve(
  ROOT,
  '../docs/plans/design-system-refactoring/control-inventory.md',
)
const UI_ROOT = 'src/components/ui/'
const EXCEPTIONS_PATH = path.join(ROOT, 'design-system-control-exceptions.json')
const COMPATIBILITY_PATH = path.join(ROOT, 'design-system-compatibility.json')
const CONTROL_TAGS = [
  'a',
  'button',
  'details',
  'input',
  'select',
  'summary',
  'table',
  'textarea',
]
const INTERACTIVE_ROLES = [
  'button',
  'checkbox',
  'combobox',
  'dialog',
  'grid',
  'gridcell',
  'link',
  'menu',
  'listbox',
  'menuitem',
  'option',
  'radio',
  'row',
  'separator',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tree',
  'treeitem',
]
const exceptionRegistry = JSON.parse(await readFile(EXCEPTIONS_PATH, 'utf8'))
const compatibilityRegistry = JSON.parse(
  await readFile(COMPATIBILITY_PATH, 'utf8'),
)

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(target)))
    else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(target)
  }
  return files
}

function inspect(relativePath, source) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const findings = []
  const primitiveImports = new Map()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const specifier = statement.moduleSpecifier
    if (!ts.isStringLiteral(specifier)) continue
    const importPath = specifier.text
    const isCanonicalUiImport =
      importPath.includes('/components/ui/') ||
      (relativePath.startsWith(UI_ROOT) && importPath.startsWith('./'))
    if (!isCanonicalUiImport) continue
    const clause = statement.importClause
    if (!clause) continue
    if (clause.name) primitiveImports.set(clause.name.text, clause.name.text)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        primitiveImports.set(
          element.name.text,
          element.propertyName?.text ?? element.name.text,
        )
      }
    }
  }

  function attributeMap(attributes) {
    return new Map(
      attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attribute) => [attribute.name.getText(sourceFile), attribute]),
    )
  }

  function literalAttribute(attribute) {
    if (!attribute?.initializer) return null
    if (ts.isStringLiteral(attribute.initializer))
      return attribute.initializer.text
    if (
      ts.isJsxExpression(attribute.initializer) &&
      attribute.initializer.expression &&
      ts.isStringLiteral(attribute.initializer.expression)
    ) {
      return attribute.initializer.expression.text
    }
    return null
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile)
      const attributes = attributeMap(node.attributes)
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
      if (CONTROL_TAGS.includes(tag)) findings.push({ kind: tag, line })
      if (primitiveImports.has(tag)) {
        findings.push({ kind: `primitive:${primitiveImports.get(tag)}`, line })
      }

      const role = literalAttribute(attributes.get('role'))
      if (
        tag === tag.toLowerCase() &&
        role &&
        INTERACTIVE_ROLES.includes(role)
      ) {
        findings.push({ kind: `role:${role}`, line })
      }
      if (
        ['article', 'div', 'li', 'p', 'section', 'span', 'svg'].includes(tag) &&
        ['onClick', 'onKeyDown', 'onKeyUp'].some((name) => {
          const attribute = attributes.get(name)
          if (!attribute) return false
          const handler = attribute.getText(sourceFile)
          return !/=>\s*(?:\{\s*)?(?:event|e)\.stopPropagation\(\);?\s*}?$/.test(
            handler,
          )
        })
      ) {
        findings.push({ kind: 'non-semantic-handler', line })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const counts = {}
  for (const { kind } of findings) counts[kind] = (counts[kind] ?? 0) + 1
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (!total) {
    return {
      relativePath,
      counts,
      findings,
      total,
      classification: 'reviewed: no detected controls',
    }
  }

  const enforcementFindings = findings.filter(
    ({ kind }) => !kind.startsWith('primitive:'),
  )
  const exception = exceptionRegistry.find(
    (entry) =>
      entry.path === relativePath &&
      enforcementFindings.every((finding) =>
        entry.allowed_kinds.includes(finding.kind),
      ),
  )
  const classification =
    enforcementFindings.length === 0
      ? 'canonical primitive consumer'
      : relativePath.startsWith(UI_ROOT)
        ? 'canonical primitive implementation'
        : exception
          ? 'approved exception'
          : 'migration required'
  return { relativePath, counts, findings, total, classification }
}

const files = await walk(SOURCE_ROOT)
const rows = []
for (const file of files.sort()) {
  const relativePath = path.relative(ROOT, file)
  const result = inspect(relativePath, await readFile(file, 'utf8'))
  if (result) rows.push(result)
}

const totals = new Map()
for (const row of rows) {
  for (const [kind, count] of Object.entries(row.counts)) {
    totals.set(kind, (totals.get(kind) ?? 0) + count)
  }
}

const unclassified = rows.filter(
  ({ classification }) => classification === 'migration required',
)
const approvedExceptions = rows.filter(
  ({ classification }) => classification === 'approved exception',
)
const compatibilityErrors = []
for (const shim of compatibilityRegistry) {
  let actualConsumers = 0
  for (const allowedFile of shim.allowed_files) {
    const source = await readFile(path.join(ROOT, allowedFile), 'utf8')
    const escaped = shim.shim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const uses = source.match(new RegExp(`var\\(${escaped}\\)`, 'g')) ?? []
    actualConsumers += uses.length
  }
  if (actualConsumers !== shim.remaining_consumer_count) {
    compatibilityErrors.push(
      `${shim.shim}: registry says ${shim.remaining_consumer_count}, found ${actualConsumers}`,
    )
  }
}
const lines = [
  '# Design-system control inventory',
  '',
  'Generated deterministically by `pnpm audit:design-system`.',
  '',
  'This artifact is the deterministic migration baseline. A row is classified as a canonical primitive implementation only when it lives in `src/components/ui/`; every other row remains migration work until it consumes a canonical primitive or is entered in the governed exception registry.',
  '',
  '## Summary',
  '',
  `- Files reviewed: ${rows.length}`,
  `- Files containing controls: ${rows.filter(({ total }) => total > 0).length}`,
  `- Files reviewed with no detected controls: ${rows.filter(({ classification }) => classification === 'reviewed: no detected controls').length}`,
  `- Control occurrences: ${rows.reduce((sum, row) => sum + row.total, 0)}`,
  `- Files requiring migration or an approved exception: ${unclassified.length}`,
  `- Files covered by approved exceptions: ${approvedExceptions.length}`,
  `- Zero-unclassified status: ${unclassified.length === 0 ? 'PASS' : 'FAIL'}`,
  '',
  '| Control kind | Count | Canonical primitive |',
  '| --- | ---: | --- |',
]

const primitiveMap = {
  a: 'Link',
  button: 'Button / IconButton',
  details: 'Disclosure',
  input: 'Input / Checkbox / Radio / FileInput',
  select: 'NativeSelect',
  summary: 'Disclosure',
  table: 'Table / DataGrid',
  textarea: 'Textarea',
  'non-semantic-handler': 'Button / Link / reviewed canvas control',
}
for (const role of INTERACTIVE_ROLES) primitiveMap[`role:${role}`] = role

for (const [kind, count] of [...totals.entries()].sort()) {
  lines.push(
    `| \`${kind}\` | ${count} | ${kind.startsWith('primitive:') ? kind.slice('primitive:'.length) : (primitiveMap[kind] ?? 'ARIA primitive')} |`,
  )
}

lines.push(
  '',
  '## File inventory',
  '',
  '| File | Controls | Classification |',
  '| --- | --- | --- |',
)

for (const row of rows) {
  const controls = Object.entries(row.counts)
    .map(([kind, count]) => {
      const locations = row.findings
        .filter((finding) => finding.kind === kind)
        .map((finding) => finding.line)
        .join('/')
      return `${kind}:${count} (L${locations})`
    })
    .join(', ')
  lines.push(
    `| \`${row.relativePath}\` | ${controls} | ${row.classification} |`,
  )
}

lines.push('', '## Approved exception registry', '')
for (const exception of exceptionRegistry) {
  lines.push(
    `- \`${exception.path}\` — owner: ${exception.owner}; replacement: ${exception.replacement}; remove by: ${exception.remove_by}. ${exception.rationale} Fallback: ${exception.accessible_fallback}`,
  )
}

lines.push('', '## Compatibility shim registry', '')
for (const shim of compatibilityRegistry) {
  lines.push(
    `- \`${shim.shim}\` — owner: ${shim.owner}; consumers: ${shim.remaining_consumer_count}; replacement: ${shim.replacement}; allowlist: ${shim.allowed_files.join(', ')}; remove by: ${shim.remove_by}. ${shim.rationale}`,
  )
}

lines.push(
  '',
  '## Approval state',
  '',
  unclassified.length === 0
    ? 'All detected controls are classified through the canonical primitive layer or the governed exception registry.'
    : `Inventory generated; approval is blocked by ${unclassified.length} files that still require migration or an approved exception.`,
  '',
)

await writeFile(OUTPUT, `${lines.join('\n')}\n`)
console.log(
  `design-system inventory: ${rows.length} files, ${unclassified.length} require migration`,
)
if (compatibilityErrors.length) {
  console.error(
    `compatibility registry errors:\n${compatibilityErrors.join('\n')}`,
  )
}
if (
  process.argv.includes('--check') &&
  (unclassified.length > 0 || compatibilityErrors.length > 0)
)
  process.exitCode = 1
