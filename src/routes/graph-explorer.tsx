import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/graph-explorer')({
  ssr: false,
  beforeLoad: function redirectLegacyGraphExplorer({ search }) {
    throw redirect({
      to: '/contextgraph-studio',
      search,
      replace: true,
    })
  },
  component: function LegacyGraphExplorerRedirect() {
    return null
  },
})
