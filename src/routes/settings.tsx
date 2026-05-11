import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { SettingsRouteComponent } from './settings/index'

export function isBareSettingsPath(pathname: string): boolean {
  return pathname === '/settings'
}

export const Route = createFileRoute('/settings')({
  ssr: false,
  component: function SettingsLayoutRoute() {
    const pathname = useRouterState({
      select: (state) => state.location.pathname,
    })

    if (isBareSettingsPath(pathname)) {
      return <SettingsRouteComponent />
    }

    return <Outlet />
  },
})
