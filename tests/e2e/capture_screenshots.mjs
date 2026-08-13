import { chromium } from '@playwright/test'

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
    { layer: 'extraction', evaluation_run_id: 'evaluation-run:uat-extraction', operational_status: 'COMPLETED', run_validity: 'VALID', certification_result: 'PASS', provider_id: 'semantier_semantica', prediction_kind: null, parent_orchestration_ref: 'benchmark-orchestration:uat-1', stale_reason_code: null },
    { layer: 'graph', evaluation_run_id: 'evaluation-run:uat-graph', operational_status: 'COMPLETED', run_validity: 'VALID', certification_result: 'PASS', provider_id: 'semantier_semantica', prediction_kind: 'accepted_release', parent_orchestration_ref: 'benchmark-orchestration:uat-1', stale_reason_code: null },
    { layer: 'reasoning', evaluation_run_id: 'evaluation-run:uat-reasoning', operational_status: 'COMPLETED', run_validity: 'VALID', certification_result: 'PASS', provider_id: 'semantier_langextract', prediction_kind: null, parent_orchestration_ref: 'benchmark-orchestration:uat-1', stale_reason_code: null },
  ],
  created_at: '2026-08-13T00:00:00Z',
}

const STUB_CASES = { cases: [{ case_id: 'case:uat-1', layer: 'extraction', provider_id: 'semantier_semantica', provider_role: 'semantier_semantica', status: 'completed', challenge_tags: ['tender_sensitive_v1'], key_metric_contributions: ['unified_value_f1=0.95'], source_anchor_refs: ['docs/derived/x.docx#section-qualification'], assertion_refs: ['assertion:uat-1'], artifact_refs: ['artifact:case-uat-1'] }] }
const STUB_CHALLENGE_SLICES = { challengeSlices: [{ challenge_tag: 'tender_sensitive_v1', base_case_set_hash: 'sha256:uat-base', base_case_count: 12, included_case_count: 12, excluded_case_count: 0, excluded_case_refs: [], denominator_policy: 'base', metrics: { entity_f1: 0.94 }, artifact_refs: ['artifact:challenge-tender-sensitive'] }] }

const OUT_DIR = '/home/chris/repo/semantier-runtime/docs/operational/screenshots'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/home/chris/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

await ctx.route('**/auth/context', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, feishu_oauth_enabled: false, password_login_enabled: false, organization_id: 'org-uat', profile_completed: true, user: { user_id: 'uat-user', name: 'UAT User', feishu_open_id: 'o', workspace_slug: 'uat', organization_id: 'org-uat', profile_completed: true } }) })
})
await ctx.route('**/api/semantier-proxy/api/knowledge/builder/benchmark-runs**', async (route) => {
  const url = new URL(route.request().url())
  if (url.pathname.endsWith('/cases')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_CASES) })
    return
  }
  if (url.pathname.endsWith('/challenge-slices')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_CHALLENGE_SLICES) })
    return
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ benchmarkOrchestrations: [STUB_ORCHESTRATION] }) })
})

const page = await ctx.newPage()
await page.goto('http://127.0.0.1:4307/evaluation')
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT_DIR}/evaluation-overview-light.png`, fullPage: true })

await page.getByRole('tab', { name: 'Cases' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT_DIR}/evaluation-cases-tab.png`, fullPage: true })

await ctx.close()
await browser.close()
console.log('Screenshots written to', OUT_DIR)
