import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  ssr: false,
  beforeLoad: function redirectToWorkspace() {
    throw redirect({
      to: '/chat' as string,
      replace: true,
    })
  },
  component: function AppRoute() {
    return null
  },
})
