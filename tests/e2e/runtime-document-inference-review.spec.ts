import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test.setTimeout(300_000)
test.describe.configure({ mode: 'serial' })

type IdentityFixture = {
  fixtureToken: string
  login: string
  password: string
  userId: string
  organizationId: string
  workspaceId: string
  workspaceSlug: string
}

const enabled = process.env.DOCUMENT_INFERENCE_REVIEW_E2E === '1'
const repositoryRoot = join(process.cwd(), '..')
const fixtureScript = join(
  repositoryRoot,
  'tests',
  'fixtures',
  'contextgraph_e2e_identity.py',
)
const fixturePython = join(repositoryRoot, '.venv', 'bin', 'python')
const fixtureAuthDb =
  process.env.SEMANTIER_AUTH_DB_PATH ??
  join(process.env.F10_ROOT ?? repositoryRoot, 'auth.db')
const workspacePassword = process.env.F10_ROOT
  ? (
      JSON.parse(
        readFileSync(join(process.env.F10_ROOT, 'credentials.json'), 'utf8'),
      ) as { password: string }
    ).password
  : null

const docxRef = process.env.DOCUMENT_INFERENCE_E2E_DOCX_REF ?? ''
const pdfRef = process.env.DOCUMENT_INFERENCE_E2E_PDF_REF ?? ''

let identityFixture: IdentityFixture | null = null

test.skip(
  !enabled,
  'Set DOCUMENT_INFERENCE_REVIEW_E2E=1 in the F10/release job.',
)
test.skip(
  enabled && (!docxRef || !pdfRef),
  'DOCUMENT_INFERENCE_E2E_DOCX_REF and DOCUMENT_INFERENCE_E2E_PDF_REF are required.',
)

test.beforeAll(() => {
  if (!enabled) return
  identityFixture = JSON.parse(
    execFileSync(
      fixturePython,
      [fixtureScript, '--auth-db-path', fixtureAuthDb, 'provision'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    ),
  ) as IdentityFixture
})

test.afterAll(() => {
  if (!enabled || !identityFixture) return
  execFileSync(
    fixturePython,
    [
      fixtureScript,
      '--auth-db-path',
      fixtureAuthDb,
      'teardown',
      '--fixture-token',
      identityFixture.fixtureToken,
      '--user-id',
      identityFixture.userId,
      '--organization-id',
      identityFixture.organizationId,
    ],
    { cwd: repositoryRoot, stdio: 'pipe' },
  )
})

async function authenticate(page: Page) {
  expect(identityFixture).not.toBeNull()
  const credentials = identityFixture as IdentityFixture
  await page.goto('/contextgraph-studio', {
    waitUntil: 'commit',
    timeout: 60_000,
  })
  const gatewayLogin = await page.request.post(
    `${process.env.HERMES_API_URL ?? ''}/auth/password/login`,
    {
      data: { login: credentials.login, password: credentials.password },
    },
  )
  expect(gatewayLogin.ok(), await gatewayLogin.text()).toBeTruthy()
  const workspaceLogin = await page.request.post('/api/auth', {
    data: { password: workspacePassword ?? credentials.password },
  })
  expect(
    workspaceLogin.ok() || workspaceLogin.status() === 400,
    await workspaceLogin.text(),
  ).toBeTruthy()
  await page.reload({ waitUntil: 'commit' })
  await expect(
    page.getByRole('heading', { name: /ContextGraph Studio/i }),
  ).toBeVisible()
  const inspectTab = page
    .getByRole('navigation', { name: 'ContextGraph Studio modes' })
    .getByRole('tab', { name: /^Inspect$/i })
  await expect(inspectTab).toBeVisible()
  await inspectTab.click({ force: true })
}

async function runDocument(page: Page, fileRef: string, kind: 'docx' | 'pdf') {
  const detectionPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/tender-document-review/detections') &&
      response.request().method() === 'POST',
  )
  await page.getByTestId('runtime-document-file-ref').fill(fileRef)
  await page.getByRole('button', { name: /^Run inspection$/i }).click()
  const detectionResponse = await detectionPromise
  expect(detectionResponse.ok(), await detectionResponse.text()).toBeTruthy()

  const viewer = page.getByTestId('source-evidence-viewer')
  await expect(viewer).toBeVisible({ timeout: 120_000 })
  await expect(viewer).toHaveAttribute('data-document-kind', kind)
  await expect(viewer).toHaveAttribute(
    'data-document-adapter-provider',
    'open_source_unified',
  )
  await expect(viewer).toHaveAttribute(
    'data-overlay-strategy',
    'document_coordinates',
  )
  await expect(page.getByTestId('finding-highlight').first()).toBeVisible()
  await expect(page.getByTestId('finding-inspector')).toBeVisible()
}

async function recordStructuredCorrection(page: Page) {
  const dispositionPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/tender-document-review/runs/') &&
      response.url().includes('/disposition') &&
      response.request().method() === 'POST',
  )
  await page
    .getByTestId('finding-feedback-justification')
    .fill(
      'MVL document inference review correction: reviewer changed the highlighted finding after source inspection.',
    )
  await page.getByTestId('finding-change-action').click()
  const dispositionResponse = await dispositionPromise
  expect(
    dispositionResponse.ok(),
    await dispositionResponse.text(),
  ).toBeTruthy()
  const payload = (await dispositionResponse.json()) as {
    semantic_feedback_event?: {
      schema_version?: string
      feedback_id?: string
      action?: string
    }
  }
  expect(payload.semantic_feedback_event?.schema_version).toBe(
    'semantic_feedback_event.v1',
  )
  expect(payload.semantic_feedback_event?.feedback_id ?? '').toMatch(/^sfe_/)
  expect(payload.semantic_feedback_event?.action).toBe('change')
  await expect(page.getByText(/semantic_feedback_event:/i)).toBeVisible()
  await expect(
    page.getByText(payload.semantic_feedback_event?.feedback_id ?? ''),
  ).toBeVisible()
}

test('open-source unified viewer renders DOCX runtime findings with document-coordinate overlays', async ({
  page,
}) => {
  await authenticate(page)
  await runDocument(page, docxRef, 'docx')
  await recordStructuredCorrection(page)
})

test('open-source unified viewer renders PDF runtime findings with document-coordinate overlays', async ({
  page,
}) => {
  await authenticate(page)
  await runDocument(page, pdfRef, 'pdf')
})
