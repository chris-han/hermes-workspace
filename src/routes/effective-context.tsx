import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/effective-context')({
  ssr: false,
  component: function EffectiveContextRoute() {
    const navigate = useNavigate()
    useEffect(() => {
      void navigate({
        to: '/knowledge-base',
        search: { tab: 'effective' },
        replace: true,
      })
    }, [navigate])
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Redirecting to Knowledge Base Effective Context...
      </div>
    )
  },
})
