import { useEffect, useRef } from 'react'
import embed, { type Result, type VisualizationSpec } from 'vega-embed'

export type DashboardActivityDatum = {
  date: string
  sessions: number
  messages: number
}

function resolveThemeColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
  if (!value) return fallback
  if (value.startsWith('#') || value.includes('(')) return value
  return `hsl(${value})`
}

function buildActivitySpec(data: DashboardActivityDatum[]): VisualizationSpec {
  const sessionsColor = resolveThemeColor('--primary', '#d6a900')
  const messagesColor = resolveThemeColor('--success', '#5f9f62')
  const borderColor = resolveThemeColor('--border', '#8b8b8b')
  const mutedColor = resolveThemeColor('--muted-foreground', '#737373')

  const sharedXAxis = {
    field: 'date',
    type: 'ordinal' as const,
    axis: {
      title: null,
      domain: false,
      ticks: false,
      labelAngle: 0,
      labelColor: mutedColor,
      labelFont: 'JetBrains Mono',
      labelFontSize: 10,
      labelPadding: 8,
    },
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    background: null,
    autosize: { type: 'fit', contains: 'padding', resize: true },
    width: 'container',
    height: 176,
    padding: { top: 8, right: 8, bottom: 0, left: 8 },
    data: { values: data },
    config: {
      view: { stroke: null },
      axis: {
        gridColor: borderColor,
        gridOpacity: 0.32,
        gridDash: [2, 4],
        title: null,
      },
    },
    layer: [
      {
        mark: {
          type: 'area',
          interpolate: 'monotone',
          color: messagesColor,
          opacity: 0.08,
          line: {
            color: messagesColor,
            strokeWidth: 1.5,
          },
        },
        encoding: {
          x: sharedXAxis,
          y: {
            field: 'messages',
            type: 'quantitative',
            axis: {
              orient: 'left',
              domain: false,
              ticks: false,
              grid: true,
              labelColor: messagesColor,
              labelFont: 'JetBrains Mono',
              labelFontSize: 10,
              labelPadding: 6,
              tickMinStep: 1,
            },
            scale: { zero: true, nice: true },
          },
          tooltip: [
            { field: 'date', type: 'nominal', title: 'Date' },
            { field: 'messages', type: 'quantitative', title: 'Messages', format: 'd' },
          ],
        },
      },
      {
        mark: {
          type: 'area',
          interpolate: 'monotone',
          color: sessionsColor,
          opacity: 0.08,
          line: {
            color: sessionsColor,
            strokeWidth: 2,
          },
        },
        encoding: {
          x: sharedXAxis,
          y: {
            field: 'sessions',
            type: 'quantitative',
            axis: {
              orient: 'right',
              domain: false,
              ticks: false,
              grid: false,
              labelColor: sessionsColor,
              labelFont: 'JetBrains Mono',
              labelFontSize: 10,
              labelPadding: 6,
              tickMinStep: 1,
            },
            scale: { zero: true, nice: true },
          },
          tooltip: [
            { field: 'date', type: 'nominal', title: 'Date' },
            { field: 'sessions', type: 'quantitative', title: 'Sessions', format: 'd' },
          ],
        },
      },
    ],
    resolve: {
      scale: { y: 'independent' },
    },
  }
}

export function DashboardActivityVega({ data }: { data: DashboardActivityDatum[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    let result: Result | undefined

    const render = async () => {
      if (!containerRef.current || !active) return
      result?.finalize()
      result = await embed(containerRef.current, buildActivitySpec(data), {
        actions: false,
        renderer: 'svg',
        tooltip: true,
      })
    }

    void render()

    const observer = new MutationObserver(() => {
      void render()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })

    return () => {
      active = false
      observer.disconnect()
      result?.finalize()
    }
  }, [data])

  return (
    <div
      ref={containerRef}
      className="h-[200px] w-full [&_.vega-embed]:h-full [&_.vega-embed]:w-full [&_svg]:overflow-visible"
      data-testid="dashboard-activity-vega"
      aria-label="Dashboard activity over the last 14 days"
    />
  )
}
