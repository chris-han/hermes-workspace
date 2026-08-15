import { createFileRoute } from '@tanstack/react-router'

import { ContextGraphStudioScreen } from '@/screens/contextgraph-studio/contextgraph-studio-screen'

export const Route = createFileRoute('/contextgraph-studio')({
  ssr: false,
  component: ContextGraphStudioScreen,
})
