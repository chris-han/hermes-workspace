import { Fragment } from 'react'
import type { A2UiNode, A2UiSchema } from '../types'

type PropsBag = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): Array<unknown> {
  return Array.isArray(value) ? value : []
}

function normalizeNodes(schema: A2UiSchema): Array<A2UiNode> {
  if (schema.root && typeof schema.root === 'object') return [schema.root]
  if (Array.isArray(schema.nodes)) return schema.nodes
  if (Array.isArray(schema.blocks)) return schema.blocks
  return []
}

function normalizeChildren(
  children: A2UiNode['children'],
): Array<A2UiNode | string> {
  if (Array.isArray(children)) return children
  if (children === undefined || children === null) return []
  return [children]
}

function renderNode(node: A2UiNode | string, key: string): React.ReactNode {
  if (typeof node === 'string') {
    return (
      <span key={key} className="whitespace-pre-wrap break-words">
        {node}
      </span>
    )
  }

  const component = asString(node.component).trim().toLowerCase()
  const props = (node.props || {}) as PropsBag
  const children = normalizeChildren(node.children)
  const renderedChildren = children.map((child, index) =>
    renderNode(child, `${key}-${index}`),
  )

  switch (component) {
    case 'stack':
    case 'column':
      return (
        <div key={key} className="flex flex-col gap-2">
          {renderedChildren}
        </div>
      )
    case 'row':
      return (
        <div key={key} className="flex flex-wrap items-center gap-2">
          {renderedChildren}
        </div>
      )
    case 'card':
      return (
        <section key={key} className="rounded-lg border border-border/70 bg-muted/20 p-3">
          {renderedChildren}
        </section>
      )
    case 'text': {
      const text = asString(props.text)
      return (
        <p key={key} className="whitespace-pre-wrap break-words text-sm text-foreground">
          {text || renderedChildren}
        </p>
      )
    }
    case 'badge': {
      const text = asString(props.text)
      return (
        <span
          key={key}
          className="inline-flex items-center rounded-full border border-border/80 bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          {text || renderedChildren}
        </span>
      )
    }
    case 'divider':
      return <hr key={key} className="border-border/60" />
    case 'list': {
      const items = asArray(props.items)
      const childrenItems = items.length > 0 ? items : children
      return (
        <ul key={key} className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {childrenItems.map((item, index) => (
            <li key={`${key}-li-${index}`}>{renderNode(item as A2UiNode | string, `${key}-li-node-${index}`)}</li>
          ))}
        </ul>
      )
    }
    case 'keyvalue': {
      const entries = props.items && typeof props.items === 'object'
        ? Object.entries(props.items as Record<string, unknown>)
        : []
      return (
        <dl key={key} className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 text-xs">
          {entries.map(([label, value], index) => (
            <Fragment key={`${key}-kv-${index}`}>
              <dt className="font-medium text-muted-foreground">{label}</dt>
              <dd className="text-foreground">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
            </Fragment>
          ))}
        </dl>
      )
    }
    case 'code': {
      const text = asString(props.text)
      return (
        <pre key={key} className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] text-foreground">
          {text || JSON.stringify(props, null, 2)}
        </pre>
      )
    }
    case 'button': {
      const text = asString(props.text) || 'Action'
      const href = asString(props.href)
      if (href) {
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            {text}
          </a>
        )
      }
      return (
        <button
          key={key}
          type="button"
          className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-xs opacity-80"
          disabled
          title="Interactive actions are not wired for this A2UI block yet"
        >
          {text}
        </button>
      )
    }
    default:
      return (
        <pre key={key} className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] text-foreground">
          {JSON.stringify(node, null, 2)}
        </pre>
      )
  }
}

export function A2UiRenderer({ schema }: { schema: A2UiSchema }) {
  const nodes = normalizeNodes(schema)
  if (nodes.length === 0) {
    return (
      <pre className="max-h-72 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] text-foreground">
        {JSON.stringify(schema, null, 2)}
      </pre>
    )
  }

  return <div className="flex flex-col gap-2">{nodes.map((node, index) => renderNode(node, `a2ui-${index}`))}</div>
}
