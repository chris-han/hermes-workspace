import { useState } from 'react'
import type { FormEvent } from 'react'

export function LoginScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (data.ok) {
        // Success! Reload to trigger auth check
        window.location.reload()
      } else {
        setError(data.error || 'Invalid password')
        setLoading(false)
      }
    } catch (err) {
      setError('Authentication failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-xl shadow-primary-900/5 ring-1 ring-primary-900/5">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
              <h1 className="brand-wordmark text-2xl font-bold tracking-tight text-primary-900">
                semantier
              </h1>
            </div>
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-lg font-semibold text-primary-900">
            Enter Password
          </h2>
          <p className="mb-6 text-center text-sm text-primary-600">
            This workspace is password-protected
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Continue'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-primary-500">
          Powered by{' '}
          <a
            href="https://github.com/NousResearch/hermes-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-500 hover:text-accent-600 transition-colors"
          >
            Hermes
          </a>
        </p>
      </div>
    </div>
  )
}
