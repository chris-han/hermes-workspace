import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { ThinkingActivityIndicator } from './thinking-activity-indicator'
import { Button } from '@/components/ui/button'
import { useThemeId } from '@/hooks/use-theme-id'
import { cn } from '@/lib/utils'

const MotionButton = motion.create(Button)

type ScrollToBottomButtonProps = {
  className?: string
  isVisible: boolean
  isGenerating?: boolean
  unreadCount: number
  onClick: () => void
}

function ScrollToBottomButton({
  className,
  isVisible,
  isGenerating = false,
  unreadCount,
  onClick,
}: ScrollToBottomButtonProps) {
  const themeId = useThemeId()

  return (
    <AnimatePresence>
      {isVisible ? (
        <MotionButton
          type="button"
          variant="default"
          size="icon-sm"
          aria-label={
            isGenerating
              ? 'Assistant is thinking. Scroll to bottom'
              : 'Scroll to bottom'
          }
          className={cn(
            'pointer-events-auto relative rounded-full border text-white shadow-lg transition-all hover:brightness-95',
            !isGenerating && 'theme-accent-button',
            isGenerating
              ? 'size-14 border-transparent bg-transparent p-0 shadow-none hover:bg-transparent hover:brightness-100'
              : 'size-8',
            className,
          )}
          style={{
            backgroundColor: isGenerating
              ? 'transparent'
              : 'var(--theme-accent)',
            borderColor: isGenerating ? 'transparent' : 'var(--theme-accent)',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClick}
        >
          {isGenerating ? (
            <ThinkingActivityIndicator
              size={64}
              themeId={themeId}
              kind="solving"
              label="Assistant thinking"
              className="thinking-scroll-crystal-orb"
            />
          ) : (
            <HugeiconsIcon icon={ArrowDown01Icon} size={20} strokeWidth={1.5} />
          )}
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary-900 px-1.5 text-xs font-medium tabular-nums text-primary-50">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </MotionButton>
      ) : null}
    </AnimatePresence>
  )
}

export { ScrollToBottomButton }
