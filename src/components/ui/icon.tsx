/**
 * Phosphor icon boundary.
 *
 * This module is the ONLY place the workspace imports from @phosphor-icons/react.
 * Anyone wanting to render a Phosphor glyph imports it from here.
 *
 * The legend contract (docs/derived/semantier-icon-text-legend-v1.md) commits
 * the workspace to a single weight (Thin, 1 px effective stroke). To enforce
 * that without per-call weight props, the IconContext is configured with
 * PHOSPHOR_DEFAULTS at the workspace root (Phase 1 acceptance). Consumers
 * render glyphs without setting `weight`.
 *
 * Re-exports the 21 unique glyphs the chrome rollout plan uses, drawn from
 * the legend inventory. Adding a new glyph to the workspace requires
 * (a) updating the legend Section 6 with the new glyph + context,
 * (b) importing it here,
 * (c) calling it in a component via this module.
 */

import type { ReactNode } from 'react'
import { IconContext } from '@phosphor-icons/react'
import {
  House,
  ChatCircle,
  Briefcase,
  CheckSquare,
  Brain,
  Book,
  GraphIcon,
  ListChecks,
  ShieldCheck,
  Gear,
  Folder,
  Terminal,
  UserCircle,
  SignOut,
  PencilSimple,
  Plus,
  PaperPlaneTilt,
  ArrowsClockwise,
  ArrowsOut,
  ArrowsIn,
  Minus,
  Funnel,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  CalendarBlank,
  CaretUp,
  CaretDown,
  Trash,
  Copy,
  DotsThreeVertical,
  SlidersHorizontal,
  Play,
  FloppyDisk,
  Warning,
  CircleNotch,
  FolderOpen,
  FileX,
  XCircle,
  CheckCircle,
  X,
  // Workspace chrome icons (Phase 2 migration of chat-sidebar.tsx and
  // chat-panel-toggle.tsx). Added when chat-sidebar migration consumed them.
  Sun,
  Moon,
  PushPinSimple,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  // Phase 2 polymorphic nav data migration. Mapped from HugeIcons:
  //   Search01Icon -> MagnifyingGlass (already imported above)
  //   DashboardSquare01Icon -> House (already imported above)
  //   MessageMultiple01Icon -> Chats
  //   Clock01Icon -> Clock
  //   CheckListIcon -> ListChecks (already imported above)
  //   Rocket01Icon -> Rocket
  //   UserGroupIcon -> UsersThree
  //   PuzzleIcon -> PuzzlePiece
  //   UserMultipleIcon -> UsersThree
  //   BrainIcon -> Brain (already imported above)
  //   Book01Icon -> Book (already imported above)
  Chats,
  Clock,
  Rocket,
  PuzzlePiece,
  UsersThree,
  List,
} from '@phosphor-icons/react'

/**
 * Default weight, size, and mirrored state for every Phosphor render in the
 * workspace. Consumers wrap their tree in <PhosphorRoot> and get Thin 1 px
 * stroke at 16 px without per-call props.
 *
 * Locked at the legend plan. Bumping `weight` here is a legend amendment.
 */
export const PHOSPHOR_DEFAULTS = {
  weight: 'thin' as const,
  size: 16,
  mirrored: false,
}

/**
 * Provider component that applies PHOSPHOR_DEFAULTS to every Phosphor render
 * in its subtree. Use this at the workspace root (or any subtree) instead of
 * importing IconContext directly. Keeps the "icon.tsx is the only module that
 * imports Phosphor" rule intact.
 */
export function PhosphorRoot({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={PHOSPHOR_DEFAULTS}>
      {children}
    </IconContext.Provider>
  )
}

/**
 * Re-export the 21+ workspace glyphs. Names match the legend inventory
 * (kebab-case tokens in docs map to PascalCase Phosphor components here).
 *
 * If a glyph is missing from this list, import it from @phosphor-icons/react
 * directly ONLY in this file - no other module may import Phosphor.
 */
export {
  House,
  ChatCircle,
  Briefcase,
  CheckSquare,
  Brain,
  Book,
  GraphIcon,
  ListChecks,
  ShieldCheck,
  Gear,
  Folder,
  Terminal,
  UserCircle,
  SignOut,
  PencilSimple,
  Plus,
  PaperPlaneTilt,
  ArrowsClockwise,
  ArrowsOut,
  ArrowsIn,
  Minus,
  Funnel,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  CalendarBlank,
  CaretUp,
  CaretDown,
  Trash,
  Copy,
  DotsThreeVertical,
  SlidersHorizontal,
  Play,
  FloppyDisk,
  Warning,
  CircleNotch,
  FolderOpen,
  FileX,
  XCircle,
  CheckCircle,
  X,
  Sun,
  Moon,
  PushPinSimple,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  Chats,
  Clock,
  Rocket,
  PuzzlePiece,
  UsersThree,
  List,
}
