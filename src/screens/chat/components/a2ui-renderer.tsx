import { Fragment, useState } from 'react'
import type { A2UiNode, A2UiSchema } from '../types'

type PropsBag = Record<string, unknown>
type SchemaFormField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'email'
  required: boolean
  placeholder: string
}

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

function normalizeSchemaFormFields(value: unknown): Array<SchemaFormField> {
  if (!Array.isArray(value)) return []
  const fields: Array<SchemaFormField> = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const key = asString(raw.key).trim()
    const label = asString(raw.label).trim()
    if (!key || !label) continue
    const typeRaw = asString(raw.type).trim().toLowerCase()
    const type: SchemaFormField['type'] =
      typeRaw === 'textarea' ||
      typeRaw === 'number' ||
      typeRaw === 'date' ||
      typeRaw === 'datetime' ||
      typeRaw === 'email'
        ? (typeRaw as SchemaFormField['type'])
        : 'text'
    const requiredRaw = raw.required
    const required =
      requiredRaw === true ||
      requiredRaw === 1 ||
      (typeof requiredRaw === 'string' &&
        ['true', '1', 'yes', 'required'].includes(
          requiredRaw.trim().toLowerCase(),
        ))

    fields.push({
      key,
      label,
      type,
      required,
      placeholder: asString(raw.placeholder),
    })
  }

  return fields
}

function SchemaForm({
  title,
  submitLabel,
  fields,
  followUp,
  onSubmit,
}: {
  title: string
  submitLabel: string
  fields: Array<SchemaFormField>
  followUp: string
  onSubmit?: (payload: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of fields) {
      initial[field.key] = ''
    }
    return initial
  })

  function setFieldValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!onSubmit) return

        const missingRequired = fields.some(
          (field) => field.required && !asString(values[field.key]).trim(),
        )
        if (missingRequired) return

        const lines = fields.map((field) => {
          const value = asString(values[field.key]).trim()
          return `- ${field.label}：${value || '未填写'}`
        })
        const payload = [
          `${title}：`,
          ...lines,
          '',
          followUp,
        ].join('\n')
        onSubmit(payload)
      }}
    >
      <div className="text-sm font-medium text-foreground">{title}</div>
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{field.label}</span>
          {field.type === 'textarea' ? (
            <textarea
              value={asString(values[field.key])}
              onChange={(event) => setFieldValue(field.key, event.target.value)}
              rows={3}
              placeholder={field.placeholder}
              className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              required={field.required}
            />
          ) : (
            <input
              type={field.type === 'datetime' ? 'text' : field.type}
              value={asString(values[field.key])}
              onChange={(event) => setFieldValue(field.key, event.target.value)}
              placeholder={field.placeholder}
              className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              required={field.required}
              min={field.type === 'number' ? 0 : undefined}
              step={field.type === 'number' ? 1 : undefined}
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        className="inline-flex w-fit items-center rounded-md border border-border bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  )
}

function renderNode(
  node: A2UiNode | string,
  key: string,
  onSubmit?: (payload: string) => void,
): React.ReactNode {
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
    renderNode(child, `${key}-${index}`, onSubmit),
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
      const value = asString(props.value)
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
          disabled={!onSubmit}
          title={
            onSubmit
              ? undefined
              : 'Interactive actions are not wired for this A2UI block yet'
          }
          onClick={() => {
            if (!onSubmit) return
            onSubmit(value || text)
          }}
        >
          {text}
        </button>
      )
    }
    case 'schema_form': {
      const title = asString(props.title) || '请填写信息'
      const submitLabel = asString(props.submitLabel) || '提交信息'
      const followUp =
        asString(props.followUp).trim() || '请根据以上信息继续执行。'
      const fields = normalizeSchemaFormFields(props.fields)
      if (fields.length === 0) {
        return (
          <pre key={key} className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] text-foreground">
            {JSON.stringify(node, null, 2)}
          </pre>
        )
      }
      return (
        <SchemaForm
          key={key}
          title={title}
          submitLabel={submitLabel}
          fields={fields}
          followUp={followUp}
          onSubmit={onSubmit}
        />
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

export function A2UiRenderer({
  schema,
  onSubmit,
}: {
  schema: A2UiSchema
  onSubmit?: (payload: string) => void
}) {
  const nodes = normalizeNodes(schema)
  if (nodes.length === 0) {
    return (
      <pre className="max-h-72 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] text-foreground">
        {JSON.stringify(schema, null, 2)}
      </pre>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {nodes.map((node, index) => renderNode(node, `a2ui-${index}`, onSubmit))}
    </div>
  )
}
