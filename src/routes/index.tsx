import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: function redirectToWorkspace() {
    throw redirect({
      to: '/app' as string,
      replace: true,
    })
  },
  component: function RootRoute() {
    return null
  },
})
