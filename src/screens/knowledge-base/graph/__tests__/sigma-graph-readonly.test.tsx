// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const sigmaMockState = vi.hoisted(() => ({ latestInstance: null as unknown }))

class FakeCamera {
  state = { ratio: 1, x: 0, y: 0 }
  private updated: (() => void) | null = null

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
}

vi.mock('sigma', () => ({
    default: class FakeSigma {
      camera = new FakeCamera()

      constructor(
        public graph: unknown,
        public container: HTMLDivElement,
        public settings: Record<string, unknown>,
      ) {
        sigmaMockState.latestInstance = this
      }

      on() {
        return this
      }

      kill() {
        return this
      }

      refresh() {
        return this
      }

      setSetting() {
        return this
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
})