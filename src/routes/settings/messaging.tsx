import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { MessagingSettingsScreen } from '@/screens/settings/messaging-settings-screen'

export const Route = createFileRoute('/settings/messaging')({
  ssr: false,
  component: function SettingsMessagingRoute() {
    usePageTitle('Messaging Gateway')
    return <MessagingSettingsScreen />
  },
})
