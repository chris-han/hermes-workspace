import { createFileRoute } from '@tanstack/react-router'

import { GraphExplorerScreen } from '@/screens/graph-explorer/graph-explorer-screen'

export const Route = createFileRoute('/graph-explorer')({
  ssr: false,
  component: GraphExplorerScreen,
})
