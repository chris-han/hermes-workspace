import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.setTimeout(600_000)

const enabled = process.env.GRAPH_SCHEMA_LEARNING_LOOP_E2E === '1'
test.skip(!enabled, 'Set GRAPH_SCHEMA_LEARNING_LOOP_E2E=1 in the F10/release job.')

async function authenticate(page: Page) {
  const repositoryRoot = join(process.cwd(), '..')
  const credentials = JSON.parse(
    readFileSync(join(process.env.F10_ROOT ?? repositoryRoot, 'credentials.json'), 'utf8'),
  ) as { login: string; password: string }

  const gatewayLogin = await page.request.post(
    `${process.env.HERMES_API_URL ?? ''}/auth/password/login`,
    { data: { login: credentials.login, password: credentials.password } },
  )
  expect(gatewayLogin.ok(), await gatewayLogin.text()).toBeTruthy()

  const workspaceLogin = await page.request.post('/api/auth', {
    data: { password: credentials.password },
  })
  expect(
    workspaceLogin.ok() || workspaceLogin.status() === 400,
    await workspaceLogin.text(),
  ).toBeTruthy()

  await page.reload({ waitUntil: 'commit' })
  await expect(
    page.getByRole('heading', { name: /ContextGraph Studio/i }),
  ).toBeVisible()
}

test('reference discovery -> DOCX correction -> graph V1 -> skill S1 -> rediscovery closes the learning loop', async ({ page }) => {
  // Environment/bootstrap helpers may provision authenticated identity and source fixtures,
  // but must not pre-create the human decisions under test.
  const referenceDocx = process.env.GRAPH_SCHEMA_E2E_REFERENCE_DOCX ?? ''
  const runtimeDocx = process.env.GRAPH_SCHEMA_E2E_RUNTIME_DOCX ?? ''
  expect(referenceDocx).toBeTruthy()
  expect(runtimeDocx).toBeTruthy()

  await page.goto('/contextgraph-studio', { waitUntil: 'commit' })
  await authenticate(page)

  // A. Graph-schema discovery from the real reference source.
  const sourcesTab = page.getByRole('navigation', { name: 'ContextGraph Studio modes' })
    .getByRole('tab', { name: /^Sources$/i })
  await expect(sourcesTab).toBeVisible()
  await sourcesTab.click({ force: true })
  await page.getByTestId('source-file-input').setInputFiles(referenceDocx)
  await page.getByTestId('graph-schema-discovery-run').click()
  await expect(page.getByTestId('semantic-discovery-decision').first()).toBeVisible({ timeout: 120_000 })

  // Human semantic review creates V0; no fixture may pre-accept the decisions.
  await page.getByTestId('human-semantic-review').click()
  await page.getByRole('button', { name: /accept reviewed schema/i }).click()
  const graphV0 = (await page.getByTestId('graph-version-ref').textContent())?.trim() ?? ''
  expect(graphV0).toBeTruthy()

  // B. Run real runtime DOCX and open an inline finding highlight.
  const inspectTab = page.getByRole('navigation', { name: 'ContextGraph Studio modes' })
    .getByRole('tab', { name: /^Inspect$/i })
  await expect(inspectTab).toBeVisible()
  await inspectTab.click({ force: true })
  await page.getByTestId('runtime-document-file-input').setInputFiles(runtimeDocx)
  await page.getByRole('button', { name: /^Run inspection$/i }).click()

  const viewer = page.getByTestId('source-evidence-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer).toHaveAttribute('data-document-kind', 'docx')
  const highlight = page.getByTestId('finding-highlight').first()
  await expect(highlight).toBeVisible({ timeout: 120_000 })
  await highlight.click()
  await expect(page.getByTestId('finding-inspector')).toBeVisible()

  // C. Correct the highlighted semantic result with explicit justification.
  await page.getByTestId('finding-change-action').click()
  await expect(page.getByTestId('finding-semantic-editor')).toBeVisible()

  // The fixture/UI must expose a semantically meaningful alternative rather than a cosmetic text edit.
  const conceptEditor = page.getByTestId('finding-concept-editor')
  await conceptEditor.click()
  const alternate = page.getByRole('option').filter({ hasNotText: /current/i }).first()
  await expect(alternate).toBeVisible()
  const correctedConcept = (await alternate.textContent())?.trim() ?? ''
  expect(correctedConcept).toBeTruthy()
  await alternate.click()

  await page.getByTestId('finding-feedback-reason-code').selectOption({ index: 1 })
  const justification = 'MVL learning-loop correction: the highlighted semantic result is wrong for the observed qualifier/scope and should follow the reviewed graph relation instead.'
  await page.getByTestId('finding-feedback-justification').fill(justification)
  await page.getByRole('button', { name: /^Save correction$/i }).click()
  await expect(page.getByTestId('finding-feedback-history')).toContainText(justification)

  // D. Attribution must explain which upstream decisions the correction supports/contradicts.
  await page.getByTestId('feedback-attribution').click()
  const attribution = page.getByTestId('feedback-attribution-panel')
  await expect(attribution).toBeVisible()
  await expect(attribution.getByText(/positive|negative/i).first()).toBeVisible()
  await expect(attribution.getByText(/lexical|classification|scope|hierarchy|inheritance/i).first()).toBeVisible()

  // E. Human reviews the graph delta; accepted delta creates V1.
  await page.getByTestId('graph-delta-review').click()
  await expect(page.getByTestId('graph-delta-diff')).toBeVisible()
  await page.getByRole('button', { name: /accept graph delta/i }).click()
  const graphV1 = (await page.getByTestId('graph-version-ref').textContent())?.trim() ?? ''
  expect(graphV1).toBeTruthy()
  expect(graphV1).not.toBe(graphV0)

  // F. Re-run exactly the same DOCX and prove the corrected result is now produced by V1.
  await page.getByRole('button', { name: /^Run inspection$/i }).click()
  const rerunHighlight = page.getByTestId('finding-highlight').first()
  await expect(rerunHighlight).toBeVisible({ timeout: 120_000 })
  await rerunHighlight.click()
  await expect(page.getByTestId('finding-matched-concept')).toContainText(correctedConcept)
  await expect(page.getByTestId('finding-graph-version-ref')).toContainText(graphV1)

  // V0 remains replayable and reconstructs the original run rather than silently taking V1.
  await page.getByRole('button', { name: /replay v0/i }).click()
  await expect(page.getByTestId('replay-graph-version-ref')).toContainText(graphV0)

  // G. Promote the reusable procedural lesson, not the domain correction itself.
  await page.getByTestId('learning-candidate').click()
  await expect(page.getByTestId('learning-candidate-detail')).toBeVisible()
  await page.getByTestId('promote-learning-candidate').click()
  await expect(page.getByTestId('learning-target')).toContainText('graph-schema-discovery')

  // H. Hermes proposes a patch; human must approve it before the effective skill changes.
  const skillS0 = (await page.getByTestId('effective-skill-version').textContent())?.trim() ?? ''
  expect(skillS0).toBeTruthy()
  await page.getByRole('button', { name: /generate skill patch/i }).click()
  await expect(page.getByTestId('skill-patch-preview')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId('skill-patch-preview')).not.toContainText(/if .*tender/i)
  await page.getByTestId('skill-patch-approve').click()
  const skillS1 = (await page.getByTestId('effective-skill-version').textContent())?.trim() ?? ''
  expect(skillS1).toBeTruthy()
  expect(skillS1).not.toBe(skillS0)

  // I. A fresh discovery run must demonstrate the learned generic procedure and cite its learning precedent.
  await expect(sourcesTab).toBeVisible()
  await sourcesTab.click({ force: true })
  await page.getByTestId('graph-schema-discovery-reset').click()
  await page.getByTestId('graph-schema-discovery-run').click()
  await expect(page.getByTestId('semantic-discovery-decision').first()).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId('effective-skill-version')).toContainText(skillS1)
  await expect(page.getByTestId('semantic-discovery-decision').filter({ hasText: /learning precedent|precedent/i }).first()).toBeVisible()
})
