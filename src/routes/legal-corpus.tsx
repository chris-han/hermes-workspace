import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { LegalCorpusScreen } from '@/screens/legal-corpus/legal-corpus-screen'

export const Route = createFileRoute('/legal-corpus')({
  ssr: false,
  component: LegalCorpusRoute,
})

function LegalCorpusRoute() {
  usePageTitle('Legal Corpus')
  return <LegalCorpusScreen />
}
