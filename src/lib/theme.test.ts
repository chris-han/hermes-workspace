// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { THEME_CHANGE_EVENT, getTheme, setTheme } from './theme'

describe('setTheme', () => {
  it('updates the current ThemeId and dispatches a theme change event', () => {
    const listener = vi.fn()
    window.addEventListener(THEME_CHANGE_EVENT, listener)

    setTheme('semantier-light')

    expect(getTheme()).toBe('semantier-light')
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'semantier-light',
    )
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      detail: { theme: 'semantier-light' },
    })

    window.removeEventListener(THEME_CHANGE_EVENT, listener)
  })
})
