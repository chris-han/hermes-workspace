import { describe, expect, it } from 'vitest'

import { DEFAULT_CHAT_DISPLAY_NAME } from '@/hooks/use-chat-settings'

import { resolveDisplayName } from './use-resolved-avatar'

describe('resolveDisplayName', () => {
  it('prefers the completed Semantier profile name over a legacy Weixin identifier', () => {
    expect(
      resolveDisplayName('o9cq8080ok2aVFb...', {
        authenticated: true,
        feishu_oauth_enabled: false,
        profile_completed: true,
        workspace_slug: 'demo-workspace',
        user: {
          user_id: 'user-123',
          name: 'Alice Zhang',
          workspace_slug: 'demo-workspace',
          feishu_open_id: '',
          weixin_user_id: 'o9cq8080ok2aVFb...',
        },
      }),
    ).toBe('Alice Zhang')
  })

  it('keeps an intentional local override when it is not a legacy identifier', () => {
    expect(
      resolveDisplayName('Finance Ops', {
        authenticated: true,
        feishu_oauth_enabled: false,
        profile_completed: true,
        workspace_slug: 'demo-workspace',
        user: {
          user_id: 'user-123',
          name: 'Alice Zhang',
          workspace_slug: 'demo-workspace',
          feishu_open_id: '',
          weixin_user_id: 'o9cq8080ok2aVFb...',
        },
      }),
    ).toBe('Finance Ops')
  })

  it('falls back to the Semantier auth name when local settings are still default', () => {
    expect(
      resolveDisplayName(DEFAULT_CHAT_DISPLAY_NAME, {
        authenticated: true,
        feishu_oauth_enabled: false,
        profile_completed: true,
        workspace_slug: 'demo-workspace',
        user: {
          user_id: 'user-123',
          name: 'Alice Zhang',
          workspace_slug: 'demo-workspace',
          feishu_open_id: '',
        },
      }),
    ).toBe('Alice Zhang')
  })
})
