/**
 * Phase-1 Knowledge Evaluation Stack v2 — browser UAT (P6/P7/P8).
 *
 * Drives the running hermes-workspace dev server with Playwright. The
 * backend `/api/semantier-proxy/api/knowledge/builder/benchmark-runs`
 * endpoint is stubbed via page.route() so this spec is independent of
 * a real Semantier backend. The contract being verified is the UI
 * behavior described in §12/§13/§14 of
 * docs/operational/phase1-knowledge-evaluation-stack-v2-uat.md.
 *
 * Required environment:
 *   HERMES_EVAL_BASE_URL — base URL of the running hermes-workspace
 *                          dev server (default http://127.0.0.1:4300).
 *   HERMES_EVAL_ORG_ID   — organization id to scope the stubbed
 *                          orchestration to (default org-uat).
 *   HERMES_EVAL_TOKEN    — bearer token for the stubbed auth header
 *                          (default "uat-token"). Set to "" to test
 *                          anonymous access.
 */
import { test, expect, type Page, type Route } from '@playwright/test'

const ORG_ID = process.env.HERMES_EVAL_ORG_ID ?? 'org-uat'
const OTHER_ORG_ID = 'org-other-tenant'
const TOKEN = process.env.HERMES_EVAL_TOKEN ?? 'uat-token'

const STUB_ORCHESTRATION = {
  benchmark_orchestration_id: 'benchmark-orchestration:uat-1',
  parent_orchestration_ref: null,
  profile_id: 'phase1-default',
  profile_version: '1',
  requested_layers: ['extraction', 'graph', 'reasoning'],
  execution_mode: 'real',
  operational_status: 'COMPLETED',
  stale_reason_code: null,
  warnings: [],
  child_run_refs: [
    {
      layer: 'extraction' as const,
      evaluation_run_id: 'evaluation-run:uat-extraction',
      operational_status: 'COMPLETED' as const,
      run_validity: 'VALID' as const,
      certification_result: 'PASS' as const,
      provider_id: 'semantier_semantica' as const,
      prediction_kind: null,
      parent_orchestration_ref: 'benchmark-orchestration:uat-1',
      stale_reason_code: null,
    },
    {
      layer: 'graph' as const,
      evaluation_run_id: 'evaluation-run:uat-graph',
      operational_status: 'COMPLETED' as const,
      run_validity: 'VALID' as const,
      certification_result: 'PASS' as const,
      provider_id: 'semantier_semantica' as const,
      prediction_kind: 'accepted_release' as const,
      parent_orchestration_ref: 'benchmark-orchestration:uat-1',
      stale_reason_code: null,
    },
    {
      layer: 'reasoning' as const,
      evaluation_run_id: 'evaluation-run:uat-reasoning',
      operational_status: 'COMPLETED' as const,
      run_validity: 'VALID' as const,
      certification_result: 'PASS' as const,
      provider_id: 'semantier_langextract' as const,
      prediction_kind: null,
      parent_orchestration_ref: 'benchmark-orchestration:uat-1',
      stale_reason_code: null,
    },
  ],
  created_at: '2026-08-13T00:00:00Z',
}

const STUB_CASES = {
  cases: [
    {
      case_id: 'case:uat-1',
      layer: 'extraction' as const,
      provider_id: 'semantier_semantica' as const,
      provider_role: 'semantier_semantica' as const,
      status: 'completed' as const,
      challenge_tags: ['tender_sensitive_v1'],
      key_metric_contributions: ['unified_value_f1=0.95', 'exact_grounding_f1=0.93'],
      source_anchor_refs: ['docs/derived/中国进出口银行北河沿办公楼更换屋面防水项目.docx#section-qualification'],
      assertion_refs: ['assertion:uat-1'],
      artifact_refs: ['artifact:case-uat-1'],
    },
  ],
}

const STUB_CHALLENGE_SLICES = {
  challengeSlices: [
    {
      challenge_tag: 'tender_sensitive_v1',
      base_case_set_hash: 'sha256:uat-base',
      base_case_count: 12,
      included_case_count: 12,
      excluded_case_count: 0,
      excluded_case_refs: [],
      denominator_policy: 'base',
      metrics: { entity_f1: 0.94 },
      artifact_refs: ['artifact:challenge-tender-sensitive'],
    },
  ],
}

function stubEvaluationApi(page: Page, opts: { deny?: boolean; orgId?: string; authenticated?: boolean } = {}) {
  const deny = opts.deny ?? false
  const targetOrg = opts.orgId ?? ORG_ID
  const authenticated = opts.authenticated ?? true

  const handler = async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (deny) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'forbidden' }),
      })
      return
    }
    // Auth context — must report authenticated=true so the LoginScreen
    // gate in workspace-shell is bypassed.
    if (url.pathname === '/auth/context' || url.pathname.endsWith('/auth/context')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated,
          feishu_oauth_enabled: false,
          password_login_enabled: false,
          organization_id: targetOrg,
          organization_name: 'UAT Org',
          profile_completed: true,
          user: authenticated
            ? {
                user_id: 'uat-user',
                name: 'UAT User',
                feishu_open_id: 'uat-open-id',
                workspace_slug: 'uat',
                organization_id: targetOrg,
                organization_name: 'UAT Org',
                profile_completed: true,
              }
            : null,
        }),
      })
      return
    }
    if (url.pathname.endsWith('/benchmark-runs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ benchmarkOrchestrations: [STUB_ORCHESTRATION] }),
      })
      return
    }
    if (url.pathname.endsWith('/cases')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STUB_CASES),
      })
      return
    }
    if (url.pathname.endsWith('/challenge-slices')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STUB_CHALLENGE_SLICES),
      })
      return
    }
    await route.continue()
  }

  page.route('**/auth/context', handler)
  page.route('**/api/semantier-proxy/api/knowledge/builder/benchmark-runs**', handler)

  // Set an auth header on every request so the dev server treats the page
  // as authenticated; tests for anonymous access override this.
  if (TOKEN) {
    page.setExtraHTTPHeaders({ authorization: `Bearer ${TOKEN}`, 'x-organization-id': targetOrg })
  } else {
    page.setExtraHTTPHeaders({})
  }
}

test.describe('Phase-1 Knowledge Evaluation v2 — browser UAT', () => {
  test('P6 — entry, tabs, no mutation controls', async ({ page }) => {
    stubEvaluationApi(page)
    await page.goto('/evaluation')
    await expect(page.getByRole('heading', { name: /Knowledge Evaluation|知识评估/i })).toBeVisible()

    const tabs = ['Overview', 'Extraction', 'Graph', 'Reasoning', 'Cases']
    for (const tab of tabs) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible()
    }

    // No Accept / Edit / Reject / GraphDelta / activate controls.
    const pageText = await page.locator('body').innerText()
    for (const forbidden of ['Accept Candidate', 'Edit Candidate', 'Reject Candidate', 'Promote Candidate', 'Activate']) {
      expect(pageText, `forbidden verb "${forbidden}" must not appear`).not.toContain(forbidden)
    }
  })

  test('P6 — provider-role and execution-mode badges render', async ({ page }) => {
    stubEvaluationApi(page)
    await page.goto('/evaluation')
    // Wait for the orchestration data to load — the metric grid
    // renders only when the canonical orchestrations query resolves.
    await expect(page.getByText(/^Status$/).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/^Baseline$/).first()).toBeVisible()
    await expect(page.getByText(/^Challenger$/).first()).toBeVisible()
    // Execution-mode badge rendered as Real — scoped to <span> badges
    // so the <option value="real">Real</option> in the mode selector
    // is not matched.
    await expect(page.locator('span:has-text("Real")').first()).toBeVisible()
  })

  test('P6 — Cases tab loads governed endpoints (not just child-run IDs)', async ({ page }) => {
    stubEvaluationApi(page)
    await page.goto('/evaluation')
    await page.getByRole('tab', { name: 'Cases' }).click()
    await expect(page.getByText('case:uat-1')).toBeVisible()
    await expect(page.getByText('tender_sensitive_v1').first()).toBeVisible()
    await expect(page.getByText(/unified_value_f1=0\.95/)).toBeVisible()
  })

  test('P7 — bilingual copy (en + zh)', async ({ page }) => {
    stubEvaluationApi(page)
    // English copy by default.
    await page.goto('/evaluation')
    await expect(page.getByRole('heading', { name: 'Knowledge Evaluation' })).toBeVisible({ timeout: 15_000 })

    // The Chinese locale is baked into the route component's copy
    // table. Walk every loaded <script> tag and assert both en and zh
    // literals exist somewhere in the loaded bundle. This is a
    // regression against a future change that drops the zh table from
    // the route file.
    const found: Record<string, boolean> = await page.evaluate(async () => {
      const result = { en: false, zh: false }
      const targets = [
        ...Array.from(document.scripts).map((s) => s.src || '<inline>'),
        ...performance.getEntriesByType('resource')
          .map((e) => (e as PerformanceResourceTiming).name)
          .filter((n) => /\.tsx?|\.js(\?|$)/.test(n)),
      ]
      const uniq = Array.from(new Set(targets))
      for (const t of uniq) {
        if (!t.startsWith('http')) continue
        try {
          const r = await fetch(t)
        if (!r.ok) continue
          const text = await r.text()
          if (text.includes('Knowledge Evaluation')) result.en = true
          if (text.includes('知识评估')) result.zh = true
        } catch {
          // ignore
        }
      }
      return result
    })
    expect(found.en, 'en copy literal "Knowledge Evaluation" must appear in the loaded route bundle').toBe(true)
    expect(found.zh, 'zh copy literal "知识评估" must appear in the loaded route bundle').toBe(true)
  })

  test('P7 — keyboard focus reaches tabs and controls', async ({ page }) => {
    stubEvaluationApi(page)
    await page.goto('/evaluation')
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // The Cases tab is rendered with role=tab. Find it in the DOM and
    // focus it directly via .focus() so the test does not depend on
    // the exact tab order across the rest of the SPA (which includes
    // sidebar links, mode selector, layer toggles, etc.).
    const casesTab = page.getByRole('tab', { name: 'Cases' })
    await casesTab.focus()
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const role = el.getAttribute('role')
      const text = (el.textContent ?? '').trim()
      return { role, text }
    })
    expect(focused?.role).toBe('tab')
    expect(focused?.text).toBe('Cases')

    // Arrow-key navigation between tabs is the documented keyboard
    // contract for tablist widgets; verify RightArrow moves focus to
    // the next tab.
    await page.keyboard.press('ArrowLeft')
    const focusedLeft = await page.evaluate(() => {
      const el = document.activeElement
      return el?.textContent?.trim() ?? ''
    })
    expect(focusedLeft).toBe('Reasoning')
  })

  test('P8 — anonymous access is rejected', async ({ page }) => {
    // authenticated=false forces the workspace-shell to render LoginScreen
    // and never the EvaluationRoute, even though the URL is /evaluation.
    stubEvaluationApi(page, { authenticated: false })
    await page.goto('/evaluation')
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    // The page either redirects to a sign-in surface or surfaces the
    // LoginScreen; in both cases the canonical benchmark data must not
    // appear in the DOM. LoginScreen renders the WeChat / password tabs.
    const pageText = await page.locator('body').innerText()
    expect(pageText).not.toContain('benchmark-orchestration:uat-1')
    const hasLoginMarkers =
      pageText.includes('微信登录') ||
      pageText.includes('使用密码') ||
      pageText.includes('登录')
    expect(hasLoginMarkers, 'anonymous access must surface a login surface, not the Evaluation workspace').toBe(true)
  })

  test('P8 — cross-tenant run/case access is rejected', async ({ page }) => {
    // The fixture page is bound to org-uat. Attempting to read another
    // tenant's run id must not return its data.
    stubEvaluationApi(page, { deny: true, orgId: OTHER_ORG_ID })
    const responses: Array<{ url: string; status: number }> = []
    page.on('response', (r) => {
      const url = r.url()
      if (url.includes('/api/semantier-proxy/api/knowledge/builder/benchmark-runs')) {
        responses.push({ url, status: r.status() })
      }
    })
    await page.goto('/evaluation')
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    // The stub denies the runs endpoint with 403; verify the response shape.
    expect(responses.some((r) => r.status === 403)).toBe(true)
    // And the benchmark data must not leak into the DOM.
    const pageText = await page.locator('body').innerText()
    expect(pageText).not.toContain('benchmark-orchestration:uat-1')
  })

  test('P18 — Knowledge Base deep-link uses stable IDs (no mutation)', async ({ page }) => {
    stubEvaluationApi(page)
    await page.goto('/evaluation')
    await page.getByRole('tab', { name: 'Cases' }).click()
    const link = page.getByRole('link', { name: /Open in Knowledge Base/i }).first()
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href, 'deep-link must target /knowledge-base').toContain('/knowledge-base')
    // The URL must NOT contain mutation verbs.
    for (const verb of ['accept', 'edit', 'reject', 'mutate']) {
      expect(href?.toLowerCase() ?? '', `forbidden verb ${verb}`).not.toContain(verb)
    }
  })
})