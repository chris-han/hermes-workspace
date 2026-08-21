import { createFileRoute } from '@tanstack/react-router'

import { SemanticaShowcaseScreen } from '@/screens/knowledge-base/graph/showcase/semantica-showcase-screen'
import { usePageTitle } from '@/hooks/use-page-title'

export const Route = createFileRoute('/semantica-showcase')({
  ssr: false,
  component: SemanticaShowcaseRoute,
})

function SemanticaShowcaseRoute() {
  usePageTitle('Semantica Visualization Showcase')
  return <SemanticaShowcaseScreen />
}
