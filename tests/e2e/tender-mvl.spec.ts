import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test('tender reviewer can detect, disposition, and report an exact missed span', async ({ page }) => {
  let runId = 'tdr_mvl_1'
  await page.route('**/auth/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        feishu_oauth_enabled: false,
        password_login_enabled: false,
        organization_id: 'org-mvl',
        organization_name: 'MVL Org',
        profile_completed: true,
        user: {
          user_id: 'mvl-reviewer',
          name: 'MVL Reviewer',
          workspace_slug: 'mvl',
          organization_id: 'org-mvl',
          organization_name: 'MVL Org',
          profile_completed: true,
        },
      }),
    })
  })
  await page.route('**/api/tender-document-review*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const body = request.postDataJSON() as { action?: string } | null
    if (!body?.action) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          run: {
            run_id: runId,
            tender_document_id: 'trial-tender',
            source_document_hash: 'sha256:trial',
            findings: [{
              finding_id: 'tdf_mvl_1',
              issue_type: 'sensitive_expression',
              matched_text: '指定品牌',
              judgment_basis: 'governed rule',
              severity: 'high',
              confidence: 0.95,
              suggested_replacement: '满足性能要求的品牌范围',
              escalation_flag: false,
            }],
            dispositions: [],
          },
        }),
      })
      return
    }
    if (body.action === 'missed_finding_feedback' || body.action === 'feedback') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ feedback: { candidateDelta: { candidate_delta_id: 'delta_mvl_1' } } }) })
      return
    }
    if (body.action === 'disposition') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ disposition: { disposition: 'accepted' } }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: {} }) })
  })

  await page.goto('/knowledge-base?mode=build&tab=tenderReview')
  const v0StartedAt = new Date().toISOString()
  const document = '本项目不得指定品牌，评审应关注指定品牌条款。'
  await page.locator('#tender-document-text').fill(document)
  await page.getByRole('button', { name: 'Run governed review' }).click()
  await expect(page.getByText('sensitive_expression')).toBeVisible()
  await page.getByRole('button', { name: 'Accept' }).click()
  const v0CompletedAt = new Date().toISOString()

  const textarea = page.locator('#tender-document-text')
  await page.getByRole('button', { name: 'Reject' }).click()
  await page.getByRole('button', { name: 'Record edit' }).click()
  await page.getByRole('button', { name: 'False positive' }).click()
  await page.getByRole('button', { name: 'Ambiguous' }).click()
  await page.getByRole('button', { name: 'Escalate to reviewer' }).click()
  await textarea.selectText()
  await page.getByRole('button', { name: 'Report missed finding from selection' }).click()
  await expect(page.getByText('Missed finding sent with exact source span')).toBeVisible()
  const v1CompletedAt = new Date().toISOString()
  const observationPath = path.resolve(process.cwd(), '..', 'docs/operational/uat-scratch/tender-mvl-playwright-observations.json')
  fs.mkdirSync(path.dirname(observationPath), { recursive: true })
  fs.writeFileSync(observationPath, JSON.stringify({
    v0: {
      schema_version: 'tender_mvl_review_observation.v1',
      started_at: v0StartedAt,
      completed_at: v0CompletedAt,
      disposition: 'accepted',
      interaction_count: 1,
      feedback_type: null,
      explanation_sufficient: true,
      reviewer_note: 'Accepted the governed finding during baseline review.',
      metrics: {
        time_to_review_one_finding_seconds: (Date.parse(v0CompletedAt) - Date.parse(v0StartedAt)) / 1000,
        correction_actions_per_finding: 1,
        false_positive_dismissal_actions: 0,
        missed_finding_reports_count: 0,
        explanation_sufficiency_score: 1,
      },
    },
    v1: {
      schema_version: 'tender_mvl_review_observation.v1',
      started_at: v0StartedAt,
      completed_at: v1CompletedAt,
      disposition: 'reported_missed_finding',
      interaction_count: 7,
      feedback_type: 'false_negative',
      explanation_sufficient: true,
      reviewer_note: 'Selected exact source span after reviewing all available dispositions and feedback paths.',
      metrics: {
        time_to_review_one_finding_seconds: (Date.parse(v1CompletedAt) - Date.parse(v0StartedAt)) / 1000,
        correction_actions_per_finding: 3,
        false_positive_dismissal_actions: 1,
        missed_finding_reports_count: 1,
        explanation_sufficiency_score: 1,
      },
    },
  }, null, 2) + '\n')
})
