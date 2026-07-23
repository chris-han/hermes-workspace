// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ThinkingActivityIndicator,
  resolveThinkingOrbState,
  resolveThinkingOrbTheme,
} from './thinking-activity-indicator'

vi.mock('thinking-orbs', () => ({
  ThinkingOrb: function MockThinkingOrb(props: any) {
    return <canvas data-testid="thinking-orb" {...props} />
  },
}))

afterEach(() => {
  cleanup()
})

describe('resolveThinkingOrbTheme', () => {
  it('maps dark workspace themes to dark orb mode', () => {
    expect(resolveThinkingOrbTheme('semantier')).toBe('dark')
    expect(resolveThinkingOrbTheme('hermes-nous')).toBe('dark')
    expect(resolveThinkingOrbTheme('hermes-official')).toBe('dark')
  })

  it('maps light workspace themes to light orb mode', () => {
    expect(resolveThinkingOrbTheme('semantier-light')).toBe('light')
    expect(resolveThinkingOrbTheme('hermes-nous-light')).toBe('light')
    expect(resolveThinkingOrbTheme('hermes-slate-light')).toBe('light')
  })
})

describe('resolveThinkingOrbState', () => {
  it('maps activity kinds to package states', () => {
    expect(resolveThinkingOrbState('working')).toBe('working')
    expect(resolveThinkingOrbState('searching')).toBe('searching')
    expect(resolveThinkingOrbState('solving')).toBe('solving')
    expect(resolveThinkingOrbState('listening')).toBe('listening')
    expect(resolveThinkingOrbState('composing')).toBe('composing')
    expect(resolveThinkingOrbState('shaping')).toBe('shaping')
  })

  it('defaults to working', () => {
    expect(resolveThinkingOrbState()).toBe('working')
  })
})

describe('ThinkingActivityIndicator', () => {
  it('passes locked size, state, theme, and label to thinking-orbs', () => {
    render(
      <ThinkingActivityIndicator
        size={64}
        themeId="semantier-light"
        kind="searching"
        label="Searching memory"
      />,
    )

    const orb = screen.getByTestId('thinking-orb')
    expect(orb.getAttribute('size')).toBe('64')
    expect(orb.getAttribute('state')).toBe('searching')
    expect(orb.getAttribute('theme')).toBe('light')
    expect(orb.getAttribute('aria-label')).toBe('Searching memory')
  })

  it('renders a static accessible fallback when requested', () => {
    render(
      <ThinkingActivityIndicator
        size={20}
        themeId="semantier"
        label="Tool working"
        fallbackOnly
      />,
    )

    expect(
      screen
        .getByRole('img', { name: 'Tool working' })
        .hasAttribute('data-thinking-activity-fallback'),
    ).toBe(true)
  })

  it('keeps stable dimensions for reduced-motion static frames and layout rhythm', () => {
    render(
      <ThinkingActivityIndicator
        size={64}
        themeId="semantier"
        label="Assistant working"
        fallbackOnly
      />,
    )

    const wrapper = screen.getByRole('img', { name: 'Assistant working' })
      .parentElement
    expect(wrapper?.getAttribute('style')).toContain('width: 64px')
    expect(wrapper?.getAttribute('style')).toContain('height: 64px')
  })

  it('does not leave stale orb instances across rapid activity changes', () => {
    const { rerender, unmount } = render(
      <ThinkingActivityIndicator
        size={20}
        themeId="semantier"
        kind="working"
        label="Tool working"
      />,
    )

    rerender(
      <ThinkingActivityIndicator
        size={20}
        themeId="semantier-light"
        kind="searching"
        label="Tool searching"
      />,
    )

    expect(screen.getAllByTestId('thinking-orb')).toHaveLength(1)
    expect(screen.getByTestId('thinking-orb').getAttribute('state')).toBe(
      'searching',
    )
    expect(screen.getByTestId('thinking-orb').getAttribute('theme')).toBe(
      'light',
    )

    unmount()
    expect(screen.queryByTestId('thinking-orb')).toBeNull()
  })
})
