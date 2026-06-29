import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { MessagingPlatformSettingsScreen } from '@/screens/settings/messaging-settings-screen'

export const Route = createFileRoute('/settings/messaging-platforms')({
  ssr: false,
  component: function SettingsMessagingPlatformsRoute() {
    usePageTitle('Messaging Platform Config')
    return <MessagingPlatformSettingsScreen />
  },
})
