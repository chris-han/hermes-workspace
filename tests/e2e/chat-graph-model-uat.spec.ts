import { chromium, expect, test as base, type Locator, type Page } from '@playwright/test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const test = base.extend({
  browser: async ({}, use) => {
    const endpoint =
      process.env.F10_REMOTE_CHROME_URL ?? 'http://127.0.0.1:9222'
    const browser = await chromium.connectOverCDP(endpoint)
    await use(browser)
    // The browser is owned by the caller that exposed the CDP endpoint.
    await browser.close()
  },
})

const sourceDocument = 'POC测试敏感词汇总.docx'
const fixtureDirectory = join(
  process.cwd(),
  '..',
  'docs',
  '招投标法规',
  'test-cases',
  'poc测试文件',
)

function findDocuments(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return findDocuments(path)
    return /\.(docx|pdf)$/i.test(entry.name) ? [path] : []
  })
}

const testDocuments = findDocuments(fixtureDirectory).sort((left, right) =>
  left.localeCompare(right, 'zh-CN'),
)

const legacyJdmPattern =
  /\bJDM\b|generate_tender_compliance_jdm|materialize_tender_sensitive_ontology_table/i

type JsonRecord = Record<string, unknown>

function readCredentials() {
  if (
    process.env.CHAT_GRAPH_MODEL_LOGIN &&
    process.env.CHAT_GRAPH_MODEL_PASSWORD
  ) {
    return {
      login: process.env.CHAT_GRAPH_MODEL_LOGIN,
      password: process.env.CHAT_GRAPH_MODEL_PASSWORD,
    }
  }
  const root =
    process.env.F10_ROOT ?? join(process.cwd(), '..', 'workspaces', 'f10_workspace')
  const path = join(root, 'credentials.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as {
    login: string
    password: string
  }
}

async function authenticate(page: Page) {
  const credentials = readCredentials()
  if (!credentials) {
    // Remote Chrome may already carry the authenticated session used for UAT.
    return
  }
  const gatewayLogin = await page.request.post('/auth/password/login', {
    data: { login: credentials.login, password: credentials.password },
  })
  const gatewayBody = await gatewayLogin.text()
  expect(gatewayLogin.ok(), gatewayBody).toBeTruthy()

  const localLogin = await page.request.post('/api/auth', {
    data: { password: credentials.password },
  })
  expect(localLogin.ok() || localLogin.status() === 400).toBeTruthy()

  const loginName = page.getByPlaceholder(/login name|登录名/i)
  if (await loginName.isVisible().catch(() => false)) {
    await loginName.fill(credentials.login)
    await page.getByPlaceholder(/password|密码/i).fill(credentials.password)
    await page
      .getByRole('button', {
        name: /continue with password|使用密码登录/i,
      })
      .click()
    await page.waitForLoadState('networkidle')
  }
}

async function streamChatTurn(
  page: Page,
  composer: Locator,
  message: string,
  documentPath: string,
) {
  await page
    .locator('input[type="file"][accept*=".docx"]')
    .setInputFiles(documentPath)
  await expect(
    page.getByText(documentPath.split('/').at(-1)!, { exact: false }).first(),
  ).toBeVisible({ timeout: 15_000 })
  await composer.fill(message)

  const streamResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/send-stream') &&
      response.request().method() === 'POST',
    { timeout: 900_000 },
  )
  await composer.press('Enter')
  const response = await streamResponse
  expect(response.ok()).toBeTruthy()
}

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value as JsonRecord)) {
      collectStrings(item, output)
    }
  }
  return output
}

async function readTrajectory(page: Page, sessionId: string): Promise<JsonRecord | null> {
  const response = await page.request.get(
    `/api/semantier-proxy/sessions/${encodeURIComponent(sessionId)}/trajectory`,
  )
  const body = await response.text()
  if (response.status() === 404) return null
  expect(response.ok(), body).toBeTruthy()
  return JSON.parse(body) as JsonRecord
}

async function waitForTrajectory(
  page: Page,
  sessionId: string,
  predicate: (trajectory: JsonRecord) => boolean,
) {
  await expect
    .poll(
      async () => {
        const trajectory = await readTrajectory(page, sessionId)
        return trajectory ? predicate(trajectory) : false
      },
      { timeout: 180_000, intervals: [2_000, 5_000, 10_000] },
    )
    .toBeTruthy()
  const trajectory = await readTrajectory(page, sessionId)
  expect(trajectory).not.toBeNull()
  return trajectory as JsonRecord
}

test.describe('chat graph model UAT', () => {
  test.skip(
    process.env.CHAT_GRAPH_MODEL_UAT !== '1',
    'Set CHAT_GRAPH_MODEL_UAT=1 for the real authenticated UAT.',
  )
  test.setTimeout(30 * 60 * 1_000)

  test('uploads the source DOCX, snapshots the graph model, and reviews every fixture in chat', async ({ page }) => {
    test.skip(testDocuments.length === 0, 'No DOCX/PDF UAT fixtures were found.')

    await page.goto('/chat/new')
    await authenticate(page)

    const composer = page.locator('[data-tour="chat-composer-input"] textarea')
    await expect(composer).toBeVisible({ timeout: 30_000 })

    await streamChatTurn(
      page,
      composer,
      [
        'This is a bounded UAT turn. Use only the attached governed source DOCX and its existing extraction result; do not search files, read files, execute code, list uploads, classify knowledge, query the legacy knowledge graph, or inspect plugin/tool definitions.',
        'Immediately use the semantica_graph tool to create a concise ContextGraph model from the extracted source evidence: add only the minimum canonical nodes and edges needed for tender-document review, then call snapshot_graph once and report graph/version/hash plus source anchors.',
        'Use the current graph-schema-discovery workflow only. Complete this turn in at most 6 tool calls. Do not invoke or mention JDM.',
      ].join(' '),
      join(process.cwd(), '..', 'docs', '招投标法规', sourceDocument),
    )

    await page.waitForURL(/\/chat\/[^/]+$/, { timeout: 30_000 })
    const sessionId = new URL(page.url()).pathname.split('/').at(-1)
    expect(sessionId).toBeTruthy()

    const modelTrajectory = await waitForTrajectory(
      page,
      sessionId!,
      (trajectory) => {
        const text = collectStrings(trajectory).join('\n')
        return /semantica_graph/i.test(text) && /snapshot_graph|graph_version|graphHash|graph_hash/i.test(text)
      },
    )
    const modelText = collectStrings(modelTrajectory).join('\n')
    expect(modelText).not.toMatch(legacyJdmPattern)
    expect(modelText).toMatch(/extract_document_content|read_file|document/i)

    for (const documentPath of testDocuments) {
      const documentName = relative(fixtureDirectory, documentPath)
      const documentBaseName = documentPath.split('/').at(-1)!
      await streamChatTurn(
        page,
        composer,
        [
          `Use the previously snapshotted canonical graph model to test the attached tender document ${documentName}.`,
          'This is a bounded review turn: use only the attached document extraction and the existing graph snapshot. Do not search files, read files, execute code, list uploads, create a new model, classify knowledge, or inspect tools.',
          'Return concise model-backed findings with source anchors, provenance, and an explicit no-finding result when applicable. Use at most 4 tool calls.',
          'Do not create a different model and do not invoke or mention JDM.',
        ].join(' '),
        documentPath,
      )
      const trajectory = await waitForTrajectory(
        page,
        sessionId!,
        (candidate) => {
          const text = collectStrings(candidate).join('\n')
          return text.includes(documentBaseName) && /label_tender_document|document.*review|sensitive/i.test(text)
        },
      )
      const trajectoryText = collectStrings(trajectory).join('\n')
      expect(trajectoryText).not.toMatch(legacyJdmPattern)
      expect(trajectoryText).toContain(documentBaseName)
    }
  })
})
