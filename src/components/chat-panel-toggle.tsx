/**
 * Floating toggle for the right chat/inspector panel.
 *
 * v1.5 polish: green pill replaced with a neutral theme-token surface and a
 * hamburger (list) glyph. Visual: 36 px circle, theme-card background, 1 px
 * theme-border, 6 px editorial radius, no shadow stacks. Hidden when the
 * panel is open (no self-invite) and on /chat descendants / mobile.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { Button } from '@/components/ui/button'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { List } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

export function ChatPanelToggle() {
  const isOpen = useWorkspaceStore((s) => s.chatPanelOpen)
  const toggleChatPanel = useWorkspaceStore((s) => s.toggleChatPanel)

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <TooltipProvider>
            <TooltipRoot>
              <TooltipTrigger
                onClick={toggleChatPanel}
                render={
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Open panel"
                    className={cn(
                      'size-9 border bg-[var(--theme-card)] text-[var(--theme-text)]',
                      'border-[var(--theme-border)] hover:bg-[var(--theme-card2)]',
                      'active:scale-95 transition-all',
                      'rounded-[var(--radius-editorial-card,6px)]',
                    )}
                  >
                    <List size={18} />
                  </Button>
                }
              />
              <TooltipContent side="left">
                <span>
                  Open panel{' '}
                  <kbd className="ml-1 text-[10px] opacity-60">⌘J</kbd>
                </span>
              </TooltipContent>
            </TooltipRoot>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
