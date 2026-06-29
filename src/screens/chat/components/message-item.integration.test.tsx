import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageItem } from './message-item'
import type { ChatMessage } from '../types'

vi.mock('@/hooks/use-resolved-avatar', () => ({
  useResolvedDisplayName: () => 'User',
  useResolvedAvatarUrl: () => '',
}))

vi.mock('@/components/avatars', () => ({
  AssistantAvatar: () => <div data-testid="assistant-avatar" />,
  UserAvatar: () => <div data-testid="user-avatar" />,
}))

vi.mock('./message-actions-bar', () => ({
  MessageActionsBar: () => null,
}))

vi.mock('./a2ui-renderer', () => ({
  A2UiRenderer: () => <div data-testid="a2ui-renderer">A2UI</div>,
}))

describe('MessageItem integration', () => {
  it('renders assistant body text only once when a2ui blocks are present', () => {
    const marker = 'RAW_DUP_CHECK_TOKEN'
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `去年利润率分析\n\n- ${marker}`,
        },
        {
          type: 'a2ui',
          id: 'ui-1',
          schema: {
            nodes: [
              {
                component: 'text',
                props: { text: 'Form placeholder' },
              },
            ],
          },
        },
      ],
      timestamp: Date.now(),
    }

    const html = renderToStaticMarkup(
      <MessageItem message={message} onA2UiSubmit={() => {}} />,
    )

    expect(html).toContain('data-testid="a2ui-renderer"')
    expect(html.match(new RegExp(marker, 'g')) ?? []).toHaveLength(1)
  })
})
