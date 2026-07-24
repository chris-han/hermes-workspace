import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { t } from '@/lib/i18n'
import { DatasetKnowledgeBaseScreen } from '@/screens/knowledge-base/knowledge-base-screen'

export const Route = createFileRoute('/database')({
  ssr: false,
  component: function DatabaseRoute() {
    usePageTitle(t('nav.database'))
    return <DatasetKnowledgeBaseScreen />
  },
})
