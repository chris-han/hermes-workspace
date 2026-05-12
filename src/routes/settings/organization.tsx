import { createFileRoute } from '@tanstack/react-router'
import { OrganizationSettingsScreen } from '@/screens/settings/organization-settings-screen'

export const Route = createFileRoute('/settings/organization')({
  ssr: false,
  component: OrganizationSettingsScreen,
})
