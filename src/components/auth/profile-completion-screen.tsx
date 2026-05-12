import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  useDemoOrganizationProfiles,
  type DemoOrganizationProfile,
} from '@/lib/organization-membership'

type ProfileCompletionScreenProps = {
  currentName?: string | null
}

type IndustryOption = {
  industryCode: string
  label: string
  organizationName: string
  seeded: boolean
}

type ProfileCompletionResponse = {
  landing_route?: string
  detail?: string
}

export function industryLabelForCode(industryCode: string): string {
  switch (industryCode) {
    case 'apparel_customization_trade':
      return '服饰定制生产和贸易'
    case 'construction':
      return '建筑工程与项目型服务'
    default:
      return industryCode.replaceAll('_', ' ')
  }
}

export function buildIndustryOptions(
  profiles: Array<DemoOrganizationProfile>,
): Array<IndustryOption> {
  const seen = new Set<string>()
  const options: Array<IndustryOption> = []
  for (const profile of profiles) {
    const industryCode = profile.industry_code?.trim()
    if (!industryCode || seen.has(industryCode)) {
      continue
    }
    seen.add(industryCode)
    options.push({
      industryCode,
      label: industryLabelForCode(industryCode),
      organizationName: profile.organization_name,
      seeded: profile.seeded !== false,
    })
  }
  return options
}

export function shouldShowProfileCompletion(
  authenticated: boolean | undefined,
  profileCompleted: boolean | undefined,
): boolean {
  return authenticated === true && profileCompleted === false
}

export function ProfileCompletionScreen({
  currentName,
}: ProfileCompletionScreenProps) {
  const demoProfilesQuery = useDemoOrganizationProfiles()
  const [displayName, setDisplayName] = useState(currentName ?? '')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [industryCode, setIndustryCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const industryOptions = buildIndustryOptions(demoProfilesQuery.data ?? [])

  useEffect(() => {
    if (industryCode || industryOptions.length === 0) {
      return
    }
    setIndustryCode(industryOptions[0]?.industryCode ?? '')
  }, [industryCode, industryOptions])

  async function submitCompletion(e?: FormEvent, skip = false) {
    e?.preventDefault()
    if (industryOptions.length > 0 && !industryCode) {
      setError('Choose an industry to load the matching demo dataset.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/auth/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          skip
            ? { industry_code: industryCode || undefined }
            : {
                display_name: displayName,
                login_name: loginName,
                password,
                password_confirm: passwordConfirm,
                industry_code: industryCode || undefined,
              },
        ),
      })
      const payload = (await response.json()) as ProfileCompletionResponse
      if (!response.ok) {
        throw new Error(payload.detail || `HTTP ${response.status}`)
      }
      window.location.assign(payload.landing_route || '/chat/new')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to complete profile setup.',
      )
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 shadow-xl shadow-primary-900/5 ring-1 ring-primary-900/5">
        <div className="mb-6 text-center">
          <h1 className="brand-wordmark text-2xl font-bold tracking-tight text-primary-900">
            semantier
          </h1>
          <h2 className="mt-5 text-lg font-semibold text-primary-900">
            Finish Your Profile
          </h2>
          <p className="mt-2 text-sm text-primary-600">
            Add a name, choose your industry demo dataset, and optionally set a password fallback for this workspace.
          </p>
        </div>

        <form onSubmit={(e) => void submitCompletion(e)} className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            disabled={loading}
          />
          <input
            type="text"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder="Login name"
            className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            disabled={loading}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (optional)"
            className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            disabled={loading}
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            disabled={loading}
          />
          <label className="block space-y-1 text-left">
            <span className="text-sm font-medium text-primary-800">
              Industry demo dataset
            </span>
            <select
              value={industryCode}
              onChange={(e) => setIndustryCode(e.target.value)}
              className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              disabled={loading || demoProfilesQuery.isLoading}
            >
              {industryOptions.length === 0 ? (
                <option value="">
                  {demoProfilesQuery.isLoading
                    ? 'Loading demo organizations...'
                    : 'No seeded demo organizations available'}
                </option>
              ) : (
                industryOptions.map((option) => (
                  <option key={option.industryCode} value={option.industryCode}>
                    {option.label} · {option.organizationName}
                  </option>
                ))
              )}
            </select>
            <span className="block text-xs text-primary-500">
              Signup lands in <code>/chat/new</code> and loads demo prompts for the selected organization context.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || demoProfilesQuery.isLoading}
            className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save And Continue'}
          </button>
          <button
            type="button"
            onClick={() => void submitCompletion(undefined, true)}
            disabled={loading || demoProfilesQuery.isLoading}
            className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue Without Password
          </button>
        </form>

        {demoProfilesQuery.isError ? (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
            Failed to load seeded demo organizations. Run the bootstrap dataset before onboarding new users.
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
