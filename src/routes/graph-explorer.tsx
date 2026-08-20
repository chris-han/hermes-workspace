import { createFileRoute } from '@tanstack/react-router'

import { ContextGraphStudioScreenV2 } from '@/screens/contextgraph-studio/contextgraph-studio-screen-v2'

/**
 * /graph-explorer now ships the redesigned ContextGraph Studio chrome (v2 layout).
 *
 * The full MVL flow (Sources / Extract / Ground / Graph / Inspect / Compare / Evaluate)
 * continues to be served from /contextgraph-studio via the existing StudioShell.
 * This route is the "operational surface" for the graph (workspace + canvas + inspector +
 * co-pilot) with the new Hanken Grotesk / JetBrains Mono typography and a SEMANTIER brand
 * mark at the top right.
 */
export const Route = createFileRoute('/graph-explorer')({
  ssr: false,
  component: ContextGraphStudioScreenV2,
})
