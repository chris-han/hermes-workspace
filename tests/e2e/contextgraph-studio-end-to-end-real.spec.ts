import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'


test.setTimeout(240_000)

type IdentityFixture = {
  fixtureToken: string
  login: string
  password: string
  userId: string
  organizationId: string
  workspaceId: string
  workspaceSlug: string
}

const repositoryRoot = join(process.cwd(), '..')
const fixtureScript = join(repositoryRoot, 'tests', 'fixtures', 'contextgraph_e2e_identity.py')
const fixturePython = join(repositoryRoot, '.venv', 'bin', 'python')
let identityFixture: IdentityFixture | null = null

test.beforeAll(() => {
  identityFixture = JSON.parse(execFileSync(fixturePython, [fixtureScript, 'provision'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })) as IdentityFixture
})

test.afterAll(() => {
  if (!identityFixture) return
  execFileSync(fixturePython, [
    fixtureScript,
    'teardown',
    '--fixture-token', identityFixture.fixtureToken,
    '--user-id', identityFixture.userId,
    '--organization-id', identityFixture.organizationId,
  ], { cwd: repositoryRoot, stdio: 'pipe' })
})

test('authenticated ContextGraph Studio exposes the real seven-screen MVL', async ({ page }) => {
  expect(identityFixture).not.toBeNull()
  const credentials = identityFixture as IdentityFixture
  const sourcePath = process.env.CONTEXTGRAPH_E2E_SOURCE_DOCX
    ?? join(process.cwd(), '..', 'docs', '招投标法规', 'POC测试敏感词汇总.docx')
  const serverFailures: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      serverFailures.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto('/contextgraph-studio')
  const gatewayLogin = await page.request.post('/auth/password/login', {
    data: { login: credentials.login, password: credentials.password },
  })
  expect(gatewayLogin.ok(), await gatewayLogin.text()).toBeTruthy()
  const workspaceLogin = await page.request.post('/api/auth', {
    data: { password: credentials.password },
  })
  expect(workspaceLogin.ok() || workspaceLogin.status() === 400).toBeTruthy()
  await page.reload()

  await expect(page.getByRole('heading', { name: /ContextGraph Studio/i })).toBeVisible()
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/upload') && response.request().method() === 'POST',
  )
  const ingestResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/ingest') && response.request().method() === 'POST',
  )
  await page.getByTestId('source-file-input').setInputFiles(sourcePath)
  const uploadResponse = await uploadResponsePromise
  expect(uploadResponse.ok(), await uploadResponse.text()).toBeTruthy()
  const uploadResults = await uploadResponse.json() as Array<Record<string, unknown>>
  expect(Array.isArray(uploadResults)).toBeTruthy()
  expect(uploadResults.some((result) => result.ok === true)).toBeTruthy()
  const uploadedName = String(uploadResults.find((result) => result.ok)?.storedName
    ?? uploadResults.find((result) => result.ok)?.originalName)
  const ingestResponse = await ingestResponsePromise
  expect(ingestResponse.ok(), await ingestResponse.text()).toBeTruthy()
  const ingestPayload = await ingestResponse.json() as Record<string, unknown>
  const uploadedFileRef = String(ingestPayload.normalizedDocumentArtifactRef ?? '')
  expect(uploadedFileRef).toBeTruthy()
  const persistedSourceName = uploadedName.replace(/\.(docx?|pdf|md)$/i, '')
  await expect(page.getByText(persistedSourceName, { exact: true }).first()).toBeVisible()

  const modeNavigation = page.getByRole('navigation', { name: 'ContextGraph Studio modes' })
  await page.getByLabel(`Select ${persistedSourceName}`).check()
  const extractionResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/builder/extraction-runs')
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Batch extract$/i }).click()
  const extractionResponse = await extractionResponsePromise
  expect(extractionResponse.ok(), await extractionResponse.text()).toBeTruthy()
  const extractionPayload = await extractionResponse.json() as Record<string, any>
  expect(extractionPayload.extractionRun?.run_status).toBe('completed')
  await expect(modeNavigation.getByRole('button', { name: /^Extract$/i })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: /^Ground candidates$/i })).toBeEnabled()

  await page.getByRole('button', { name: /^Ground candidates$/i }).click()
  await expect(modeNavigation.getByRole('button', { name: /^Ground$/i })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText(/Human Grounding/i)).toBeVisible()
  const releaseResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/release') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Accept$/i }).click()
  const releaseResponse = await releaseResponsePromise
  expect(releaseResponse.ok(), await releaseResponse.text()).toBeTruthy()
  const releasePayload = await releaseResponse.json() as Record<string, any>
  await expect(page.getByTestId('ground-accepted-release')).toBeVisible()

  const activationResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/project-activate') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Activate release$/i }).click()
  const activationResponse = await activationResponsePromise
  expect(activationResponse.ok(), await activationResponse.text()).toBeTruthy()
  const activationPayload = await activationResponse.json() as Record<string, any>
  await expect(page.getByTestId('ground-activation-snapshot')).toBeVisible()

  const baseGraphVersion = String(releasePayload.graphRelease?.parent_graph_version ?? '')
  const releasedGraphVersion = String(releasePayload.graphRelease?.graph_version ?? '')
  expect(baseGraphVersion).toBeTruthy()
  expect(releasedGraphVersion).toBeTruthy()
  expect(releasedGraphVersion).not.toBe(baseGraphVersion)

  const discoveryRunId = String(extractionPayload.extractionRun?.discovery_run_id ?? '')
  expect(discoveryRunId).toBeTruthy()
  const evaluationDatasetResponse = await page.request.post(
    '/api/semantier-proxy/api/knowledge/builder/evaluation-datasets',
    { data: { discoveryRunId, useTenderUatFixture: true } },
  )
  expect(evaluationDatasetResponse.ok(), await evaluationDatasetResponse.text()).toBeTruthy()
  const evaluationDataset = (await evaluationDatasetResponse.json() as Record<string, any>).evaluationDataset
  const createEvaluationRun = async () => {
    const response = await page.request.post(
      '/api/semantier-proxy/api/knowledge/builder/evaluation-runs',
      { data: { evaluationDatasetId: evaluationDataset.evaluation_dataset_id, discoveryRunId } },
    )
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json() as Record<string, any>).evaluationRun
  }
  const v0EvaluationRun = await createEvaluationRun()
  const v1EvaluationRun = await createEvaluationRun()

  for (const mode of ['Graph', 'Inspect']) {
    const modeTab = modeNavigation.getByRole('button', { name: new RegExp(`^${mode}$`, 'i') })
    await modeTab.click()
    await expect(modeTab).toHaveAttribute('aria-current', 'page')
  }

  await page.getByPlaceholder('artifacts/document_extraction/target.json').fill(uploadedFileRef)
  const inspectResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/tender-document-review') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Run inspection$/i }).click()
  const inspectResponse = await inspectResponsePromise
  expect(inspectResponse.ok(), await inspectResponse.text()).toBeTruthy()
  const inspectPayload = await inspectResponse.json() as Record<string, any>
  expect(inspectPayload.run?.activation_set_snapshot_id).toBe(
    activationPayload.projection?.snapshot?.activation_set_snapshot_id,
  )
  expect(inspectPayload.run?.findings?.length).toBeGreaterThan(0)
  await expect(page.getByText(/Findings \([1-9]/)).toBeVisible()

  for (const mode of ['Compare', 'Evaluate']) {
    const modeTab = modeNavigation.getByRole('button', { name: new RegExp(`^${mode}$`, 'i') })
    await modeTab.click()
    await expect(modeTab).toHaveAttribute('aria-current', 'page')
  }

  await modeNavigation.getByRole('button', { name: /^Compare$/i }).click()
  await expect(page.getByLabel('Base graph version')).toBeVisible()
  await expect(page.getByLabel('New graph version')).toBeVisible()
  await page.getByLabel('Base graph version').fill(baseGraphVersion)
  await page.getByLabel('New graph version').fill(releasedGraphVersion)
  const compareResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/compare?') && response.request().method() === 'GET',
  )
  await page.locator('section').getByRole('button', { name: /^Compare$/i }).click()
  const compareResponse = await compareResponsePromise
  expect(compareResponse.ok(), await compareResponse.text()).toBeTruthy()
  await expect(page.getByText(/Diff loaded/i)).toBeVisible()
  await modeNavigation.getByRole('button', { name: /^Evaluate$/i }).click()
  await expect(page.getByLabel('V0 evaluation run')).toBeVisible()
  await expect(page.getByLabel('V1 evaluation run')).toBeVisible()
  await page.getByLabel('V0 evaluation run').fill(String(v0EvaluationRun.evaluation_run_id))
  await page.getByLabel('V1 evaluation run').fill(String(v1EvaluationRun.evaluation_run_id))
  const learningGateResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/contextgraph/evaluation/learning-gate') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Run learning gate/i }).click()
  const learningGateResponse = await learningGateResponsePromise
  expect(learningGateResponse.ok(), await learningGateResponse.text()).toBeTruthy()
  await expect(page.getByText(/STOP_REVISE|GO|SPLIT_FIX/).first()).toBeVisible()
  expect(releasePayload.graphRelease?.graph_version).toBeTruthy()
  expect(activationPayload.projection?.snapshot?.activation_set_snapshot_id).toBeTruthy()
  expect(serverFailures, serverFailures.join('\n')).toEqual([])
})
