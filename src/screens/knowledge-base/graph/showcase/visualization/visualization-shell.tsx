/**
 * Shared Asimov visualization shell (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, §8.1/W3).
 *
 * One structural shell for chart-native (Recharts/SVG) and graph-native
 * (Sigma) showcase views: transparent viewport over the workbench dot grid
 * (A6), a structural 1px border (A7 — flat depth, no shadow), and a mounted
 * per-canvas footer. The shell owns geometry/chrome; the renderer owns marks
 * only. The screen-level dataset status bar (`showcase-ref-statusbar`) is a
 * separate surface and stays unchanged.
 *
 * Footer placement mirrors the Knowledge Graph tab's Sigma canvas: the footer
 * is a direct child of the OUTER center panel card (the one hosting the
 * ruler), flush at its bottom edge — not nested inside this inner shell.
 * `CenterPanel` exposes a portal target via `VisualizationFooterPortalTarget`;
 * when present, the shell portals its footer there. Without a provider (unit
 * tests, standalone mounts) the footer renders inline after the viewport.
 */

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Portal target for the per-canvas visualization footer, provided by the
 * outer center panel card. `undefined` = no provider (render footer inline);
 * `null` = provider mounted but the target node is not attached yet.
 */
export const VisualizationFooterPortalTarget = createContext<HTMLElement | null | undefined>(undefined)

export function VisualizationShell({
  children,
  footer,
  testId,
  ariaLabel,
  className,
}: {
  children: ReactNode
  footer?: ReactNode
  testId?: string
  ariaLabel?: string
  className?: string
}) {
  const portalTarget = useContext(VisualizationFooterPortalTarget)
  const renderedFooter =
    footer == null
      ? null
      : portalTarget === undefined
        ? footer
        : portalTarget === null
          ? null
          : createPortal(footer, portalTarget)
  return (
    <section
      className={`showcase-viz-shell${className ? ` ${className}` : ''}`}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      <div className="showcase-viz-viewport">{children}</div>
      {renderedFooter}
    </section>
  )
}
