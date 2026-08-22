// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const sigmaMockState = vi.hoisted(() => ({ latestInstance: null as unknown }))

class FakeCamera {
  state = { ratio: 1, x: 0, y: 0 }
  private updated: (() => void) | null = null
  enabled = true

  on(event: string, callback: () => void) {
    if (event === 'updated') {
      this.updated = callback
    }
    return this
  }

  animatedZoom() {
    this.state = { ...this.state, ratio: 0.5 }
    this.updated?.()
  }

  animatedUnzoom() {
    this.state = { ...this.state, ratio: 2 }
    this.updated?.()
  }

  animatedReset() {
    this.state = { ...this.state, ratio: 1 }
    this.updated?.()
  }

  getState() {
    return this.state
  }

  disable() {
    this.enabled = false
  }

  enable() {
    this.enabled = true
  }
}

type SigmaHandler = (payload?: any) => void

class FakeMouseCaptor {
  private handlers = new Map<string, Set<SigmaHandler>>()

  on(event: string, handler: SigmaHandler) {
    const handlersForEvent = this.handlers.get(event) ?? new Set<SigmaHandler>()
    handlersForEvent.add(handler)
    this.handlers.set(event, handlersForEvent)
    return this
  }

  off(event: string, handler: SigmaHandler) {
    this.handlers.get(event)?.delete(handler)
    return this
  }

  emit(event: string, payload?: any) {
    this.handlers.get(event)?.forEach((handler) => handler(payload))
  }
}

let fakeSigmaInitialEnableCamera: unknown = true

vi.mock('sigma', () => ({
    default: class FakeSigma {
      camera = new FakeCamera()
      private handlers = new Map<string, Set<SigmaHandler>>()
      private mouseCaptor = new FakeMouseCaptor()
  private settingsState = new Map<string, unknown>([['enableCamera', fakeSigmaInitialEnableCamera]])

      constructor(
        public graph: unknown,
        public container: HTMLDivElement,
        public settings: Record<string, unknown>,
      ) {
        sigmaMockState.latestInstance = this
      }

      on(event: string, handler: SigmaHandler) {
        const handlersForEvent = this.handlers.get(event) ?? new Set<SigmaHandler>()
        handlersForEvent.add(handler)
        this.handlers.set(event, handlersForEvent)
        return this
      }

      off(event: string, handler: SigmaHandler) {
        this.handlers.get(event)?.delete(handler)
        return this
      }

      emit(event: string, payload?: any) {
        this.handlers.get(event)?.forEach((handler) => handler(payload))
      }

      kill() {
        return this
      }

      refresh() {
        return this
      }

      setSetting(key: string, value: unknown) {
        this.settingsState.set(key, value)
        return this
      }

      getSetting(key: string) {
        return this.settingsState.get(key)
      }

      getMouseCaptor() {
        return this.mouseCaptor
      }

      viewportToGraph(event: { x: number; y: number }) {
        return { x: event.x, y: event.y }
      }

      getCamera() {
        return this.camera
      }
    },
}))

import { SigmaGraphReadonly } from '../sigma-graph-readonly'

afterEach(() => {
  cleanup()
  sigmaMockState.latestInstance = null
  fakeSigmaInitialEnableCamera = true
})

describe('SigmaGraphReadonly', () => {
  it('uses curved edge settings and reports camera updates', () => {
    const viewportReady = vi.fn()
    const cameraChange = vi.fn()

    render(
      <SigmaGraphReadonly
        input={{
          nodes: [{ id: 'a', label: 'A' }],
          edges: [{ id: 'e1', source: 'a', target: 'a', label: 'rel' }],
          edgeCurved: true,
        }}
        onViewportReady={viewportReady}
        onCameraChange={cameraChange}
      />,
    )

    const latestInstance = sigmaMockState.latestInstance as {
      settings: Record<string, unknown>
      getCamera: () => FakeCamera
    } | null

    expect(latestInstance).not.toBeNull()
    expect(latestInstance?.settings.defaultEdgeType).toBe('curved')
    expect(latestInstance?.settings.edgeProgramClasses).toHaveProperty('curved')
    expect(viewportReady).toHaveBeenCalled()
    expect(cameraChange).toHaveBeenCalledWith(1)

    viewportReady.mock.calls[0]?.[0]?.zoomIn()

    expect(cameraChange).toHaveBeenLastCalledWith(0.5)
  })

  it('re-enables camera when drag release is handled by window mouseup', () => {
    render(
      <SigmaGraphReadonly
        input={{
          nodes: [
            { id: 'a', label: 'A', x: 0, y: 0 },
            { id: 'b', label: 'B', x: 1, y: 0 },
          ],
          edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel' }],
          dragMode: 'branch',
        }}
      />,
    )

    const latestInstance = sigmaMockState.latestInstance as {
      emit: (event: string, payload?: any) => void
      getSetting: (key: string) => unknown
      getMouseCaptor: () => { emit: (event: string, payload?: any) => void }
    } | null

    expect(latestInstance).not.toBeNull()
    latestInstance?.emit('downNode', { node: 'a', event: { x: 0, y: 0 } })
    latestInstance?.getMouseCaptor().emit('mousemovebody', { x: 12, y: 8 })

    expect(latestInstance?.getSetting('enableCamera')).toBe(false)

    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(latestInstance?.getSetting('enableCamera')).toBe(true)
  })

  it('re-enables camera when drag release is handled by window pointerup', () => {
    render(
      <SigmaGraphReadonly
        input={{
          nodes: [
            { id: 'a', label: 'A', x: 0, y: 0 },
            { id: 'b', label: 'B', x: 1, y: 0 },
          ],
          edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel' }],
          dragMode: 'branch',
        }}
      />,
    )

    const latestInstance = sigmaMockState.latestInstance as {
      emit: (event: string, payload?: any) => void
      getSetting: (key: string) => unknown
      getMouseCaptor: () => { emit: (event: string, payload?: any) => void }
    } | null

    expect(latestInstance).not.toBeNull()
    latestInstance?.emit('downNode', { node: 'a', event: { x: 0, y: 0 } })
    latestInstance?.getMouseCaptor().emit('mousemovebody', { x: 12, y: 8 })
    expect(latestInstance?.getSetting('enableCamera')).toBe(false)

    window.dispatchEvent(new Event('pointerup'))

    expect(latestInstance?.getSetting('enableCamera')).toBe(true)
  })

  it('restores camera to true when initial enableCamera setting is not boolean', () => {
    fakeSigmaInitialEnableCamera = undefined

    render(
      <SigmaGraphReadonly
        input={{
          nodes: [
            { id: 'a', label: 'A', x: 0, y: 0 },
            { id: 'b', label: 'B', x: 1, y: 0 },
          ],
          edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel' }],
          dragMode: 'node',
        }}
      />,
    )

    const latestInstance = sigmaMockState.latestInstance as {
      emit: (event: string, payload?: any) => void
      getSetting: (key: string) => unknown
    } | null

    expect(latestInstance).not.toBeNull()
    latestInstance?.emit('downNode', { node: 'a', event: { x: 0, y: 0 } })
    expect(latestInstance?.getSetting('enableCamera')).toBe(false)

    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(latestInstance?.getSetting('enableCamera')).toBe(true)
  })
})