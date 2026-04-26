import { useEffect, useRef } from 'react'
import type { AuthStatus } from '@/lib/hermes-auth'
import { fetchHermesAuthStatus } from '@/lib/hermes-auth'

type Props = { onConnected: (status: AuthStatus) => void }

declare global {
  interface Window {
    __dismissSplash?: () => void
  }
}

export function ConnectionStartupScreen({ onConnected }: Props) {
  const onConnectedRef = useRef(onConnected)
  useEffect(() => {
    onConnectedRef.current = onConnected
  }, [onConnected])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismiss = window.__dismissSplash
    if (!dismiss) return
    const timer = setTimeout(() => dismiss(), 60)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const tryConnect = async () => {
      try {
        const status = await fetchHermesAuthStatus()
        onConnectedRef.current(status)
      } catch {
        // Even if auth-check fails, proceed to the app — the backend
        // is assumed to be the agent wrapper at HERMES_API_URL.
        onConnectedRef.current({
          authenticated: false,
          authRequired: false,
        } as AuthStatus)
      }
    }

    void tryConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-6 py-10 text-[#f8fafc]"
      style={{
        backgroundColor: '#0A0E1A',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <img
          src="/logo.svg"
          alt="semantier logo"
          className="mb-5 h-20 w-20 rounded-2xl object-cover shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        />

        <h1 className="brand-wordmark text-[2rem] font-semibold tracking-tight text-[#f8fafc]">
          semantier
        </h1>

        {/* Connecting spinner */}
        <div className="mt-4 flex items-center gap-3 text-sm text-white/72">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span>Connecting to agent wrapper...</span>
        </div>
      </div>
    </div>
  )
}
