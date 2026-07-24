// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ScrollToBottomButton } from './scroll-to-bottom-button'

vi.mock('@/hooks/use-theme-id', () => ({
  useThemeId: () => 'semantier-light',
}))

vi.mock('thinking-orbs', () => ({
  ThinkingOrb: function MockThinkingOrb(props: any) {
    return <canvas data-testid="thinking-orb" {...props} />
  },
}))

afterEach(() => {
  cleanup()
})

describe('ScrollToBottomButton', () => {
  it('renders the thinking orb instead of the arrow while the assistant is generating', () => {
    render(
      <ScrollToBottomButton
        isVisible
        isGenerating
        unreadCount={0}
        onClick={() => {}}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Assistant is thinking. Scroll to bottom',
      }),
    ).toBeTruthy()
    expect(screen.getByTestId('thinking-orb').getAttribute('size')).toBe('64')
    expect(screen.getByTestId('thinking-orb').getAttribute('state')).toBe(
      'solving',
    )
  })
})
