// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskCard } from './task-card'
import type { HermesTask } from '@/lib/tasks-api'
import type { PluginUiExtensionRegistration } from '@/lib/plugin-ui-extensions'

const task: HermesTask = {
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
  column: 'review',
  priority: 'medium',
  assignee: null,
  tags: [],
  due_date: null,
  position: 0,
  created_by: 'kanban',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
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
    },
  },
}

describe('TaskCard plugin UI extensions', () => {
  it('renders the manifest-registered card when metadata signal matches', () => {
    const onPluginAction = vi.fn()

    render(
      <TaskCard
        task={task}
        onClick={vi.fn()}
        onDragStart={vi.fn()}
        pluginUiExtensions={[extension]}
        onPluginAction={onPluginAction}
      />,
    )

    expect(screen.getByText('Planning sync')).toBeTruthy()
    expect(screen.getByText('awaiting_requester_decision')).toBeTruthy()
    expect(screen.getByText('A. User')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Nudge' }))
    expect(onPluginAction).toHaveBeenCalledWith(
      task,
      extension,
      'nudge_unblock',
      undefined,
    )
  })
})
