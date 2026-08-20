/**
 * Floating toggle for the right chat/inspector panel.
 *
 * Skeuomorphic Minimal styling:
 *   - 36 px square button, theme-card surface, 1 px theme-border
 *   - 6 px editorial card radius (sharp but not square)
 *   - Inset top highlight (`inset 0 1px 0`) gives a paper-press feel
 *     without a drop shadow - the button reads as flat-registered, not floating
 *   - Hover: theme-card2 surface (one shade deeper) reinforces physical pressed feel
 *   - Active: scale 0.96 + inverted inset shadow for "button pressed" cue
 *   - Glyph: Phosphor `List` (THIN, locked by workspace IconContext) at 18 px -
 *     standard hamburger / menu sign
 *   - Tooltip: mono caps "Open panel" + JetBrains Mono "⌘J" - matches the legend
 *     typography policy: tracks cap labels use JetBrains Mono
 *   - Spring physics for the entrance / exit scale + y motion
 *
 * Hidden when the panel is open (no self-invite) and on /chat descendants /
 * mobile (handled at the WorkspaceShell level).
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
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 8 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
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
                      // Geometry: 36 px square (size-9), 6 px editorial radius.
                      'size-9 rounded-[var(--radius-editorial-card,6px)]',
                      // Surface: theme-card bg, theme-border outline. No drop shadow.
                      'border border-[var(--theme-border)] bg-[var(--theme-card)]',
                      // Skeuomorphic: subtle inset top highlight lifts the button
                      // off the canvas without a fake depth shadow.
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
                      // Hover: one shade deeper for pressed feel.
                      'hover:bg-[var(--theme-card2)] hover:border-[var(--theme-border-strong,var(--theme-border))]',
                      // Active: scale + invert the inset highlight to fake recess.
                      'active:scale-[0.96] active:shadow-[inset_0_1px_0_rgba(0,0,0,0.08)]',
                      // Color: theme-text for the glyph.
                      'text-[var(--theme-text)]',
                      // No glow, no gradient, no transition on all (just the properties that move).
                      'transition-[background-color,border-color,box-shadow,transform] duration-150',
                    )}
                  >
                    <List size={18} />
                  </Button>
                }
              />
              <TooltipContent side="left">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase tracking-[0.18em] font-[500]"
                    style={{ fontFamily: 'var(--font-mono-studio)' }}
                  >
                    Open panel
                  </span>
                  <kbd
                    className="text-[10px] opacity-60"
                    style={{ fontFamily: 'var(--font-mono-studio)' }}
                  >
                    ⌘J
                  </kbd>
                </span>
              </TooltipContent>
            </TooltipRoot>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
