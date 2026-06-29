import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { DataConnectionsScreen } from '@/screens/settings/data-connections-screen'

export const Route = createFileRoute('/settings/data-connections')({
  ssr: false,
  component: function SettingsDataConnectionsRoute() {
    usePageTitle('Data Connections')
    return <DataConnectionsScreen />
  },
})
