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
 */

import type { ReactNode } from 'react'

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
  return (
    <section
      className={`showcase-viz-shell${className ? ` ${className}` : ''}`}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      <div className="showcase-viz-viewport">{children}</div>
      {footer}
    </section>
  )
}
