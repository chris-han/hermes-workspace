import { createFileRoute } from '@tanstack/react-router'
import { GithubRadarScreen } from '@/screens/investment/github-radar-screen'

export const Route = createFileRoute('/investment/github-radar')({
  ssr: false,
  component: GithubRadarScreen,
})
