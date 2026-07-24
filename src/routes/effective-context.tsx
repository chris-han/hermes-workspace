import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { t } from '@/lib/i18n'
import { EffectiveContextScreen } from '@/screens/knowledge-base/knowledge-base-screen'

export const Route = createFileRoute('/effective-context')({
  ssr: false,
  component: function EffectiveContextRoute() {
    usePageTitle(t('nav.effectiveContext'))
    return <EffectiveContextScreen />
  },
})
