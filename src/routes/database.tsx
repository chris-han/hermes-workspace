import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/database')({
  ssr: false,
  component: function DatabaseRoute() {
    const navigate = useNavigate()
    useEffect(() => {
      void navigate({
        to: '/knowledge-base',
        search: { tab: 'dataset' },
        replace: true,
      })
    }, [navigate])
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Redirecting to Knowledge Base Dataset...
      </div>
    )
  },
})
