import { createFileRoute } from '@tanstack/react-router'
import { orchestrator } from '@/screens/gateway/orchestrator'

export const Route = createFileRoute('/orchestrator')({
  component: orchestrator,
})
