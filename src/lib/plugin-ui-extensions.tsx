import type { ComponentType, ReactNode } from 'react'

export type PluginUiComponentProps = {
  taskId: string
  extensionId: string
  negotiationId?: string
  metadata: Record<string, unknown>
  onOpenDetail?: () => void
  onAction: (actionId: string, payload?: Record<string, unknown>) => void
  onClose?: () => void
  compact?: boolean
}

export type PluginUiExtensionManifest = {
  id: string
  host_screen?: string
  operations_host?: string
  task_signal?: {
    field?: string
    value?: string
  }
  label?: string
  description?: string
  components?: Record<
    string,
    {
      module?: string
      export?: string
      props_version?: string
    }
  >
  actions?: Array<{
    id: string
    label?: string
    plugin_api?: string
  }>
  host_version_requirement?: string
}

export type PluginUiExtensionRegistration = {
  pluginName: string
  extension: PluginUiExtensionManifest
}

type PluginUiComponentModule = Record<string, unknown> & {
  default?: ComponentType<PluginUiComponentProps>
}

const pluginUiModules = import.meta.glob<PluginUiComponentModule>(
  '../../../semantier-skills/plugins/*/dashboard/ui/*.{tsx,ts}',
  { eager: true },
)

function normalizedRelativeModulePath(modulePath?: string): string | null {
  if (!modulePath) return null
  const withoutPrefix = modulePath.replace(/^\.\//, '')
  const withoutExtension = withoutPrefix.replace(/\.(tsx|ts|jsx|js)$/i, '')
  if (!withoutExtension || withoutExtension.includes('..')) return null
  return withoutExtension
}

function moduleKey(
  registration: PluginUiExtensionRegistration,
  componentId: string,
): string | null {
  const component = registration.extension.components?.[componentId]
  const relativePath = normalizedRelativeModulePath(component?.module)
  if (!relativePath) return null
  return `../../../semantier-skills/plugins/${registration.pluginName}/${relativePath}.tsx`
}

export function pluginUiComponent(
  registration: PluginUiExtensionRegistration,
  componentId: string,
): ComponentType<PluginUiComponentProps> | null {
  const key = moduleKey(registration, componentId)
  if (!key) return null

  const component = registration.extension.components?.[componentId]
  const exportedName = component?.export || 'default'
  const mod = pluginUiModules[key]
  const exported =
    exportedName === 'default' ? mod?.default : mod?.[exportedName]
  return typeof exported === 'function'
    ? (exported as ComponentType<PluginUiComponentProps>)
    : null
}

export function matchingPluginUiExtension(
  registrations: Array<PluginUiExtensionRegistration>,
  metadata?: Record<string, unknown>,
): PluginUiExtensionRegistration | null {
  if (!metadata) return null
  const matches = registrations.filter((registration) => {
    const signal = registration.extension.task_signal
    if (!signal?.field || signal.value === undefined) return false
    return metadata[signal.field] === signal.value
  })
  return matches.length === 1 ? matches[0] : null
}

export function pluginUiNegotiationId(
  metadata?: Record<string, unknown>,
): string | undefined {
  const value = metadata?.negotiation_id
  return typeof value === 'string' && value ? value : undefined
}

export function pluginActionPath(
  registration: PluginUiExtensionRegistration,
  actionId: string,
  metadata?: Record<string, unknown>,
): string | null {
  const action = registration.extension.actions?.find(
    (item) => item.id === actionId,
  )
  const raw = action?.plugin_api
  if (!raw) return null
  const match = raw.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i)
  const path = match ? match[2] : raw
  const negotiationId = pluginUiNegotiationId(metadata)
  if (path.includes('{negotiation_id}') && !negotiationId) return null
  return path.replace(
    '{negotiation_id}',
    encodeURIComponent(negotiationId ?? ''),
  )
}

export function PluginUiFallback({
  label,
  children,
}: {
  label: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 text-xs text-[var(--theme-muted)]">
      <p className="font-medium text-[var(--theme-text)]">{label}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}
