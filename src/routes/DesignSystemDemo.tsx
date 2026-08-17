import { createFileRoute } from '@tanstack/react-router'
import DesignSystemDemo from '../../../docs/plans/design-system-refactoring/DesignSystemDemo.jsx'

export const Route = createFileRoute('/DesignSystemDemo')({
  ssr: false,
  component: DesignSystemDemoRoute,
})

function DesignSystemDemoRoute() {
  return <DesignSystemDemo />
}
