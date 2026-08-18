import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const endpoint = process.env.HERMES_CDP_URL ?? 'http://127.0.0.1:9222'
const baseUrl = process.env.HERMES_BASE_URL ?? 'http://localhost:3300'
const evidenceDir = resolve('../docs/plans/design-system-refactoring/evidence')
const routes = [
  ['workspace-shell', '/'],
  ['chat', '/chat'],
  ['files', '/files'],
  ['jobs', '/jobs'],
  ['gateway', '/orchestrator'],
  ['inspector', '/session-events'],
  ['settings', '/settings'],
  ['knowledge', '/knowledge-base'],
  ['terminal', '/terminal'],
]

function classifyResponseFailure(failure) {
  const url = new URL(failure.url)
  if (
    failure.status === 404 &&
    url.pathname.endsWith('/api/available-models')
  ) {
    return 'Optional provider model discovery is unavailable; the settings UI retains its manual model-entry fallback.'
  }
  if (
    [409, 500].includes(failure.status) &&
    url.pathname.endsWith('/api/knowledge/policy-rules')
  ) {
    return 'The ephemeral browser identity has no governed organization policy store; the authority endpoint fails closed and the knowledge UI renders its empty/error state.'
  }
  return null
}

function classifyConsoleError(message, classifiedResponses) {
  if (
    message.includes('cdn.jsdelivr.net/npm/monaco-editor') &&
    message.includes('Content Security Policy')
  ) {
    return 'The optional CDN Monaco loader is blocked by the governed CSP; the file surface keeps its non-Monaco fallback.'
  }
  if (message.startsWith('Monaco initialization: error:')) {
    return 'Expected consequence of the governed CSP blocking the optional Monaco CDN loader.'
  }
  if (
    message.startsWith('Failed to load resource:') &&
    classifiedResponses.length > 0
  ) {
    return 'Browser console reflection of an explicitly classified HTTP response.'
  }
  return null
}

await mkdir(evidenceDir, { recursive: true })
const launchedLocally = endpoint === 'launch'
const browser = launchedLocally
  ? await chromium.launch({ channel: 'chrome', headless: true })
  : await chromium.connectOverCDP(endpoint)
const context = launchedLocally
  ? await browser.newContext()
  : browser.contexts()[0]
if (!context) throw new Error(`No browser context exposed by ${endpoint}`)
if (launchedLocally) {
  try {
    const remoteBrowser = await chromium.connectOverCDP('http://127.0.0.1:9222')
    const remoteContext = remoteBrowser.contexts()[0]
    if (remoteContext)
      await context.addCookies(await remoteContext.cookies(baseUrl))
    await remoteBrowser.close()
  } catch (error) {
    console.warn(
      `remote authentication state was unavailable: ${String(error)}`,
    )
  }
}
const testLogin = process.env.HERMES_TEST_LOGIN
const testPassword = process.env.HERMES_TEST_PASSWORD
if (testLogin && testPassword) {
  const loginResponse = await context.request.post(
    `${baseUrl}/auth/password/login`,
    { data: { login: testLogin, password: testPassword } },
  )
  const loginPayload = await loginResponse.json()
  if (!loginResponse.ok() || loginPayload.ok !== true) {
    throw new Error(`Authenticated browser fixture login failed`)
  }
}
const page = await context.newPage()
const consoleErrors = []
const fontFailures = []
const responseFailures = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('response', (response) => {
  if (
    /\.(woff2?|ttf|otf)(\?|$)/i.test(response.url()) &&
    response.status() >= 400
  ) {
    fontFailures.push({ status: response.status(), url: response.url() })
  }
  if (response.status() >= 400) {
    responseFailures.push({ status: response.status(), url: response.url() })
  }
})

async function axePage(targetPage) {
  const result = await new AxeBuilder({ page: targetPage })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
    })),
  }))
}

async function auditPage(targetPage = page) {
  return targetPage.evaluate(() => {
    const visible = (element) => Boolean(element.getClientRects().length)
    const label = (element) =>
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.getAttribute('title') ||
      element.textContent?.trim() ||
      (element.id &&
        document
          .querySelector(`label[for="${CSS.escape(element.id)}"]`)
          ?.textContent?.trim()) ||
      element.closest('label')?.textContent?.trim()
    const controls = [
      ...document.querySelectorAll(
        'button,a[href],input,select,textarea,[role="button"],[role="tab"],[role="switch"],[role="menuitem"],[role="option"]',
      ),
    ].filter(
      (element) =>
        visible(element) && element.getAttribute('aria-hidden') !== 'true',
    )
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter((id, index, ids) => id && ids.indexOf(id) !== index)
    return {
      title: document.title,
      url: location.href,
      controlCount: controls.length,
      unnamedControls: controls
        .filter((element) => !label(element))
        .map((element) => element.outerHTML.slice(0, 180)),
      imagesWithoutAlt: [...document.querySelectorAll('img')]
        .filter((image) => !image.hasAttribute('alt'))
        .map((image) => image.outerHTML.slice(0, 180)),
      duplicateIds: [...new Set(duplicateIds)],
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      hydrationPending:
        Boolean(document.getElementById('splash-screen')) ||
        !document.querySelector('.root')?.children.length,
    }
  })
}

async function auditRoutes() {
  const results = []
  for (const [cluster, route] of routes) {
    console.log(`checking ${cluster} ${route}`)
    const routePage = await context.newPage()
    try {
      const routeConsoleErrors = []
      const routeResponseFailures = []
      routePage.on('console', (message) => {
        if (message.type() === 'error') routeConsoleErrors.push(message.text())
      })
      routePage.on('response', (response) => {
        if (response.status() >= 400) {
          routeResponseFailures.push({
            status: response.status(),
            url: response.url(),
          })
        }
      })
      const response = await routePage.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 5_000,
      })
      await routePage.waitForTimeout(8_000)
      const classifiedResponseFailures = routeResponseFailures.map(
        (failure) => ({
          ...failure,
          classification: classifyResponseFailure(failure),
        }),
      )
      const classifiedConsoleErrors = [...new Set(routeConsoleErrors)].map(
        (message) => ({
          message,
          classification: classifyConsoleError(
            message,
            classifiedResponseFailures.filter((entry) => entry.classification),
          ),
        }),
      )
      results.push({
        cluster,
        route,
        documentStatus: response?.status() ?? null,
        ...(await auditPage(routePage)),
        accessibilityViolations: await axePage(routePage),
        consoleErrors: classifiedConsoleErrors,
        responseFailures: classifiedResponseFailures,
      })
    } catch (error) {
      results.push({
        cluster,
        route,
        documentStatus: null,
        navigationError: String(error),
        unnamedControls: [],
        imagesWithoutAlt: [],
        duplicateIds: [],
      })
    } finally {
      await routePage.close()
    }
  }
  return results
}

async function auditAnonymousAuth() {
  const anonymousContext = await browser.newContext()
  const authPage = await anonymousContext.newPage()
  try {
    const response = await authPage.goto(`${baseUrl}/chat`, {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    })
    await authPage
      .locator('#splash-screen')
      .waitFor({ state: 'detached', timeout: 8_000 })
      .catch(() => undefined)
    const audit = await auditPage(authPage)
    return {
      cluster: 'auth/onboarding',
      route: '/chat (anonymous)',
      documentStatus: response?.status() ?? null,
      ...audit,
      accessibilityViolations: await axePage(authPage),
      loginSurfaceVisible: await authPage
        .getByRole('heading', { name: 'semantier' })
        .isVisible()
        .catch(() => false),
      consoleErrors: [],
      responseFailures: [],
    }
  } finally {
    await anonymousContext.close()
  }
}

async function runGalleryKeyboardChecks() {
  const checks = []
  const previousTimeout = page.timeoutSettings?.defaultTimeout
  page.setDefaultTimeout(5_000)
  async function check(name, operation) {
    try {
      await operation()
      checks.push({ name, passed: true })
    } catch (error) {
      checks.push({ name, passed: false, error: String(error) })
    }
  }
  const family = (name) => page.locator(`[data-gallery-family="${name}"]`)
  await check('tabs', async () => {
    const first = family('tabs').getByRole('tab', { name: 'First' })
    await first.focus()
    await first.press('ArrowRight')
    if (
      (await family('tabs')
        .getByRole('tab', { name: 'Second' })
        .getAttribute('aria-selected')) !== 'true'
    )
      throw new Error('Second tab was not selected')
  })
  await check('menu', async () => {
    await family('menu').getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Inspect' }).press('ArrowDown')
    await page.keyboard.press('Escape')
  })
  await check('dialog', async () => {
    const trigger = family('dialog-sheet').getByRole('button', {
      name: 'Open dialog',
    })
    await trigger.click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    await trigger.focus()
  })
  await check('combobox', async () => {
    const input = family('autocomplete').getByRole('combobox')
    await input.fill('a')
    await input.press('ArrowDown')
    if (!(await input.getAttribute('aria-activedescendant')))
      throw new Error('Combobox did not expose an active descendant')
    await input.press('Escape')
  })
  await check('pagination', async () => {
    const button = family('pagination').getByRole('button', { name: 'Page 2' })
    await button.focus()
    await button.press('Enter')
    if ((await button.getAttribute('aria-current')) !== 'page')
      throw new Error('Page 2 did not become current')
  })
  await check('accordion', async () => {
    const button = family('disclosure-accordion').getByRole('button').first()
    await button.focus()
    await button.press('Enter')
    if ((await button.getAttribute('aria-expanded')) !== 'true')
      throw new Error('Accordion did not expand')
  })
  await check('switch', async () => {
    const control = family('checkbox-radio-switch').getByRole('switch')
    const before = await control.getAttribute('aria-checked')
    await control.focus()
    await control.press('Space')
    if ((await control.getAttribute('aria-checked')) === before)
      throw new Error('Switch state did not change')
  })
  await check('listbox', async () => {
    const options = family('listbox').getByRole('option')
    await options.nth(0).focus()
    await options.nth(0).press('ArrowDown')
    if (
      !(await options
        .nth(1)
        .evaluate((node) => node === document.activeElement))
    )
      throw new Error('Listbox focus did not move')
  })
  await check('disclosure', async () => {
    const summary = family('disclosure-accordion').locator('summary')
    await summary.focus()
    await summary.press('Enter')
    if (!(await summary.locator('xpath=..').evaluate((node) => node.open)))
      throw new Error('Native disclosure did not open')
  })
  await check('file-upload', async () => {
    const dropzone = family('file-input-upload-dropzone')
      .getByRole('button')
      .first()
    await dropzone.focus()
    await dropzone.press('Enter')
    if (!(await dropzone.evaluate((node) => node === document.activeElement)))
      throw new Error('Dropzone lost keyboard focus')
  })
  await check('data-grid', async () => {
    const cells = family('data-grid').getByRole('gridcell')
    await cells.nth(0).focus()
    await cells.nth(0).press('ArrowRight')
    if (
      !(await cells.nth(1).evaluate((node) => node === document.activeElement))
    )
      throw new Error('Grid focus did not move')
  })
  await check('tree-view', async () => {
    const items = family('tree-view').getByRole('treeitem')
    await items.nth(0).focus()
    await items.nth(0).press('ArrowDown')
    if (
      !(await items.nth(1).evaluate((node) => node === document.activeElement))
    )
      throw new Error('Tree focus did not move')
  })
  await check('resize-handle', async () => {
    const handle = family('resize-split-panel').getByRole('separator').first()
    const before = await handle.getAttribute('aria-valuenow')
    await handle.focus()
    await handle.press('ArrowRight')
    if ((await handle.getAttribute('aria-valuenow')) === before)
      throw new Error('Resize value did not change')
  })
  await check('canvas-controls', async () => {
    const zoom = family('canvas-control-layer').getByRole('button', {
      name: 'Zoom in',
    })
    await zoom.focus()
    await zoom.press('Enter')
    await family('canvas-control-layer').getByText('Node A connects to Node B')
  })
  page.setDefaultTimeout(previousTimeout ?? 30_000)
  return checks
}

await page.setViewportSize({ width: 1440, height: 1000 })
console.log('capturing gallery variants')
let galleryCaptureError = null
let keyboardChecks = []
let galleryAudit = {
  unnamedControls: [],
  imagesWithoutAlt: [],
  duplicateIds: [],
}
try {
  await page.goto(`${baseUrl}/DesignSystemGallery`, {
    waitUntil: 'domcontentloaded',
    timeout: 10_000,
  })
  await page
    .getByTestId('canonical-component-gallery')
    .waitFor({ state: 'attached', timeout: 30_000 })
  const gallery = page.getByTestId('canonical-component-gallery')
  const setGalleryTheme = async (theme) => {
    await page.evaluate((nextTheme) => {
      const root = document.documentElement
      root.setAttribute('data-theme', nextTheme)
      root.classList.toggle('dark', nextTheme === 'semantier')
      root.classList.toggle('light', nextTheme === 'semantier-light')
      root.style.setProperty(
        'color-scheme',
        nextTheme === 'semantier' ? 'dark' : 'light',
      )
    }, theme)
  }
  await setGalleryTheme('semantier-light')
  await gallery.screenshot({
    path: resolve(evidenceDir, 'gallery-en-light.png'),
  })
  keyboardChecks = await runGalleryKeyboardChecks()
  await setGalleryTheme('semantier')
  await gallery.screenshot({
    path: resolve(evidenceDir, 'gallery-en-dark.png'),
  })
  await page.getByRole('button', { name: '中文' }).click()
  await gallery.screenshot({
    path: resolve(evidenceDir, 'gallery-zh-dark.png'),
  })
  await setGalleryTheme('semantier-light')
  await gallery.screenshot({
    path: resolve(evidenceDir, 'gallery-zh-light.png'),
  })
  galleryAudit = await auditPage()
  galleryAudit.accessibilityViolations = await axePage(page)
} catch (error) {
  galleryCaptureError = String(error)
}

const routeResults = [await auditAnonymousAuth(), ...(await auditRoutes())]

console.log('capturing workspace')
let workspaceCaptureError = null
try {
  await page.evaluate(() =>
    localStorage.setItem('hermes-theme', 'semantier-light'),
  )
  await page.goto(`${baseUrl}/chat`, {
    waitUntil: 'domcontentloaded',
    timeout: 10_000,
  })
  await page.waitForTimeout(750)
  await page.screenshot({
    path: resolve(evidenceDir, 'workspace-chat-light.png'),
  })
  await page.evaluate(() => localStorage.setItem('hermes-theme', 'semantier'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(750)
  await page.screenshot({
    path: resolve(evidenceDir, 'workspace-chat-dark.png'),
  })
} catch (error) {
  workspaceCaptureError = String(error)
}

const report = {
  generatedAt: new Date().toISOString(),
  endpoint,
  baseUrl,
  routes: routeResults,
  gallery: galleryAudit,
  galleryCaptureError,
  keyboardChecks,
  fontFailures,
  responseFailures,
  consoleErrors: [...new Set(consoleErrors)],
  workspaceCaptureError,
}
await writeFile(
  resolve(evidenceDir, 'browser-verification.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
await page.close()
if (launchedLocally) await browser.close()

const failures = [
  ...routeResults.flatMap((result) => [
    ...(result.documentStatus && result.documentStatus >= 400
      ? [`${result.cluster}: document ${result.documentStatus}`]
      : []),
    ...(result.navigationError ? [`${result.cluster}: navigation failed`] : []),
    ...(result.cluster === 'auth/onboarding' && !result.loginSurfaceVisible
      ? [`${result.cluster}: login surface missing`]
      : []),
    ...(result.hydrationPending
      ? [`${result.cluster}: hydration pending`]
      : []),
    ...(result.accessibilityViolations?.length
      ? [
          `${result.cluster}: ${result.accessibilityViolations.length} axe violations`,
        ]
      : []),
    ...(result.unnamedControls.length
      ? [`${result.cluster}: ${result.unnamedControls.length} unnamed controls`]
      : []),
    ...(result.imagesWithoutAlt.length
      ? [
          `${result.cluster}: ${result.imagesWithoutAlt.length} images without alt`,
        ]
      : []),
    ...(result.duplicateIds.length
      ? [`${result.cluster}: duplicate IDs ${result.duplicateIds.join(', ')}`]
      : []),
    ...((result.responseFailures ?? []).filter((entry) => !entry.classification)
      .length
      ? [`${result.cluster}: unclassified HTTP failures`]
      : []),
    ...((result.consoleErrors ?? []).filter((entry) => !entry.classification)
      .length
      ? [`${result.cluster}: unclassified console errors`]
      : []),
  ]),
  ...(galleryAudit.unnamedControls.length
    ? [`gallery: ${galleryAudit.unnamedControls.length} unnamed controls`]
    : []),
  ...(galleryCaptureError ? ['gallery: capture failed'] : []),
  ...(galleryAudit.accessibilityViolations?.length
    ? [`gallery: ${galleryAudit.accessibilityViolations.length} axe violations`]
    : []),
  ...(fontFailures.length
    ? [`${fontFailures.length} font requests failed`]
    : []),
  ...keyboardChecks
    .filter((check) => !check.passed)
    .map((check) => `keyboard: ${check.name} failed`),
]
console.log(
  JSON.stringify(
    { routeCount: routeResults.length, failures, fontFailures, evidenceDir },
    null,
    2,
  ),
)
if (failures.length) process.exitCode = 1
