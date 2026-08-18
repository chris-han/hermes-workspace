import { createFileRoute } from '@tanstack/react-router'
import { DesignSystemGallery } from '@/components/ui/design-system-gallery'
import '@/components/ui/design-system-gallery.css'

export const Route = createFileRoute('/DesignSystemGallery')({
  ssr: false,
  component: DesignSystemGalleryRoute,
})

function DesignSystemGalleryRoute() {
  return (
    <div className="original-design-system-gallery">
      <DesignSystemGallery />
    </div>
  )
}
