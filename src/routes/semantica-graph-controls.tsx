import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { usePageTitle } from '@/hooks/use-page-title'

const MOCKUP_PATH = '/semantica-graph-exploration-controls-mockup.html'

export const Route = createFileRoute('/semantica-graph-controls')({
  ssr: false,
  component: SemanticaGraphControlsRoute,
})

function SemanticaGraphControlsRoute() {
  usePageTitle('Semantica Graph Exploration Controls')

  useEffect(() => {
    window.location.replace(MOCKUP_PATH)
  }, [])

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Opening graph exploration controls…
    </main>
  )
}
