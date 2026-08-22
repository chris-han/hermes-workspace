/**
 * Shared auth-context stub for the Semantica showcase E2E specs.
 *
 * The workspace shell gates on `/auth/context`. When the suite runs against a
 * remote authenticated Chrome (CDP), that session answers for real; against a
 * bare dev server the gateway may answer `authenticated: false`, which routes
 * the shell to the login page before the showcase can render. Stub the auth
 * context so the showcase route renders deterministically in both
 * environments.
 *
 * Test harness only — offline-boundary assertions in the showcase specs still
 * fail on any live /api/graph|ontology|embeddings|semantier-proxy|llm call.
 */
import type { Page } from '@playwright/test'

export async function stubShowcaseAuth(page: Page): Promise<void> {
  await page.route('**/auth/context', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        feishu_oauth_enabled: false,
        password_login_enabled: true,
        profile_completed: true,
        membership_status: 'active',
        user: {
          user_id: 'e2e-showcase',
          name: 'E2E Showcase',
          feishu_open_id: 'e2e-showcase',
          workspace_slug: 'e2e',
          profile_completed: true,
        },
      }),
    })
  })
}
