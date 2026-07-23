import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/legal-corpus')({
  ssr: false,
  beforeLoad: function redirectToKnowledgeBase() {
    throw redirect({
      to: '/knowledge-base' as string,
      replace: true,
    })
  },
  component: function LegalCorpusRedirectRoute() {
    return null
  },
})
