import { useState } from 'react'
import type { FormEvent } from 'react'

type ProfileCompletionScreenProps = {
  currentName?: string | null
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
  const [displayName, setDisplayName] = useState(currentName ?? '')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submitCompletion(e?: FormEvent, skip = false) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/auth/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          skip
            ? {}
            : {
                display_name: displayName,
                login_name: loginName,
                password,
                password_confirm: passwordConfirm,
              },
        ),
      })
      const payload = (await response.json()) as { detail?: string }
      if (!response.ok) {
        throw new Error(payload.detail || `HTTP ${response.status}`)
      }
      window.location.reload()
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
            Add a name and optional password fallback for this workspace.
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save And Continue'}
          </button>
          <button
            type="button"
            onClick={() => void submitCompletion(undefined, true)}
            disabled={loading}
            className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue Without Password
          </button>
        </form>

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
