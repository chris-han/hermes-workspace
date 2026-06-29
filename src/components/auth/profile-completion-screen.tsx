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

type AuthLocale = 'zh' | 'en'

type ProfileCompletionCopy = {
  title: string
  subtitle: string
  displayNamePlaceholder: string
  loginNamePlaceholder: string
  passwordPlaceholder: string
  confirmPasswordPlaceholder: string
  industryLabel: string
  loadingOrganizations: string
  noOrganizations: string
  industryHint: string
  saveButton: string
  savingButton: string
  continueWithoutPasswordButton: string
  loadOrganizationsError: string
  failedToComplete: string
  chooseIndustryError: string
}

const PROFILE_COMPLETION_COPY: Record<AuthLocale, ProfileCompletionCopy> = {
  zh: {
    title: '完成你的资料',
    subtitle:
      '填写姓名，选择行业演示数据集，并可选设置当前工作区的密码兜底登录。',
    displayNamePlaceholder: '显示名称',
    loginNamePlaceholder: '登录名',
    passwordPlaceholder: '密码（可选）',
    confirmPasswordPlaceholder: '确认密码',
    industryLabel: '行业演示数据集',
    loadingOrganizations: '正在加载演示组织...',
    noOrganizations: '暂无可用的预置演示组织',
    industryHint:
      '注册后会进入 /chat/new，并按所选组织上下文加载演示提示词。',
    saveButton: '保存并继续',
    savingButton: '正在保存...',
    continueWithoutPasswordButton: '跳过密码并继续',
    loadOrganizationsError:
      '加载预置演示组织失败，请先运行 bootstrap 数据集再进行新用户引导。',
    failedToComplete: '完成资料设置失败。',
    chooseIndustryError: '请选择一个行业以加载匹配的演示数据集。',
  },
  en: {
    title: 'Finish Your Profile',
    subtitle:
      'Add a name, choose your industry demo dataset, and optionally set a password fallback for this workspace.',
    displayNamePlaceholder: 'Display name',
    loginNamePlaceholder: 'Login name',
    passwordPlaceholder: 'Password (optional)',
    confirmPasswordPlaceholder: 'Confirm password',
    industryLabel: 'Industry demo dataset',
    loadingOrganizations: 'Loading demo organizations...',
    noOrganizations: 'No seeded demo organizations available',
    industryHint:
      'Signup lands in /chat/new and loads demo prompts for the selected organization context.',
    saveButton: 'Save And Continue',
    savingButton: 'Saving...',
    continueWithoutPasswordButton: 'Continue Without Password',
    loadOrganizationsError:
      'Failed to load seeded demo organizations. Run the bootstrap dataset before onboarding new users.',
    failedToComplete: 'Failed to complete profile setup.',
    chooseIndustryError:
      'Choose an industry to load the matching demo dataset.',
  },
}

export function resolveAuthLocale(locale?: string | null): AuthLocale {
  return locale === 'en' ? 'en' : 'zh'
}

export function getProfileCompletionCopy(
  locale?: string | null,
): ProfileCompletionCopy {
  return PROFILE_COMPLETION_COPY[resolveAuthLocale(locale)]
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
  const [locale, setLocale] = useState<AuthLocale>(resolveAuthLocale())
  const copy = getProfileCompletionCopy(locale)
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
      setError(copy.chooseIndustryError)
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
          : copy.failedToComplete,
      )
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-card border border-border bg-card px-8 py-10 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="brand-wordmark text-2xl font-bold tracking-tight text-foreground">
            semantier
          </h1>
          <div className="mt-4 flex justify-center">
            <div className="inline-flex rounded-button border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLocale('zh')}
                className={`rounded-button px-2.5 py-1 transition-colors ${
                  locale === 'zh'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={locale === 'zh'}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-button px-2.5 py-1 transition-colors ${
                  locale === 'en'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={locale === 'en'}
              >
                English
              </button>
            </div>
          </div>
          <h2 className="mt-5 text-lg font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.subtitle}
          </p>
        </div>

        <form onSubmit={(e) => void submitCompletion(e)} className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={copy.displayNamePlaceholder}
            className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
          <input
            type="text"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder={copy.loginNamePlaceholder}
            className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={copy.passwordPlaceholder}
            className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder={copy.confirmPasswordPlaceholder}
            className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
          <label className="block space-y-1 text-left">
            <span className="text-sm font-medium text-foreground">
              {copy.industryLabel}
            </span>
            <select
              value={industryCode}
              onChange={(e) => setIndustryCode(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={loading || demoProfilesQuery.isLoading}
            >
              {industryOptions.length === 0 ? (
                <option value="">
                  {demoProfilesQuery.isLoading
                    ? copy.loadingOrganizations
                    : copy.noOrganizations}
                </option>
              ) : (
                industryOptions.map((option) => (
                  <option key={option.industryCode} value={option.industryCode}>
                    {option.label} · {option.organizationName}
                  </option>
                ))
              )}
            </select>
            <span className="block text-xs text-muted-foreground">
              {copy.industryHint}
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || demoProfilesQuery.isLoading}
            className="w-full rounded-button bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? copy.savingButton : copy.saveButton}
          </button>
          <button
            type="button"
            onClick={() => void submitCompletion(undefined, true)}
            disabled={loading || demoProfilesQuery.isLoading}
            className="w-full rounded-button border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.continueWithoutPasswordButton}
          </button>
        </form>

        {demoProfilesQuery.isError ? (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
            {copy.loadOrganizationsError}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
