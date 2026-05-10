import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { MessagingAccountLinkingScreen } from '@/screens/settings/messaging-settings-screen'

export const Route = createFileRoute('/settings/messaging-accounts')({
  ssr: false,
  component: function SettingsMessagingAccountsRoute() {
    usePageTitle('Feishu Login')
    return <MessagingAccountLinkingScreen />
  },
})
