import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { KanbanBoard } from './kanban-board'
import type { HubTask } from './task-board'
import type {
  PluginUiComponentProps,
  PluginUiExtensionRegistration,
} from '@/lib/plugin-ui-extensions'

vi.mock('@/lib/plugin-ui-extensions', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/plugin-ui-extensions')>()
  const TestNegotiationCard: ComponentType<PluginUiComponentProps> = ({
    metadata,
  }) => (
    <div>
      <strong>{String(metadata.meeting_title)}</strong>
      <span>{String(metadata.status)}</span>
      <div>{String(metadata.declined_attendee_name)}</div>
      <button type="button">Nudge</button>
      <button type="button">Finalize</button>
      <button type="button">Cancel</button>
    </div>
  )
  return {
    ...actual,
    pluginUiComponent: () => TestNegotiationCard,
  }
})

vi.mock('@/stores/task-store', () => ({
  useTaskStore: (
    selector: (state: { updateTaskStatus: () => void; tasks: [] }) => unknown,
  ) => selector({ updateTaskStatus: vi.fn(), tasks: [] }),
}))

const task: HubTask = {
  id: 'task_1',
  title: 'Fallback title',
  description: '',
  metadata: {
    task_type: 'feishu_meeting_negotiation',
    negotiation_id: 'neg_1',
    meeting_title: 'Planning sync',
    status: 'awaiting_requester_decision',
    declined_attendee_name: 'A. User',
  },
  status: 'review',
  priority: 'normal',
  createdAt: Date.parse('2026-07-01T00:00:00.000Z'),
  updatedAt: Date.parse('2026-07-01T00:00:00.000Z'),
}

const extension: PluginUiExtensionRegistration = {
  pluginName: 'feishu_meeting_coordinator',
  extension: {
    id: 'feishu_meeting_negotiation',
    operations_host: 'kanban',
    task_signal: {
      field: 'task_type',
      value: 'feishu_meeting_negotiation',
    },
    components: {
      card_renderer: {
        module: './dashboard/ui/NegotiationCard',
        export: 'default',
        props_version: '1.0.0',
      },
      detail_drawer: {
        module: './dashboard/ui/NegotiationDetailDrawer',
        export: 'default',
        props_version: '1.0.0',
      },
    },
  },
}

describe('KanbanBoard plugin UI extensions', () => {
  it('renders the registered card component when metadata signal matches', () => {
    const onPluginAction = vi.fn()

    const markup = renderToStaticMarkup(
      <KanbanBoard
        tasks={[task]}
        agents={[]}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
        pluginUiExtensions={[extension]}
        onPluginAction={onPluginAction}
      />,
    )

    expect(markup).toContain('Planning sync')
    expect(markup).toContain('awaiting_requester_decision')
    expect(markup).toContain('A. User')
    expect(markup).toContain('Nudge')
    expect(markup).toContain('Finalize')
    expect(markup).toContain('Cancel')
    expect(markup).not.toContain('Fallback title')
  })
})
