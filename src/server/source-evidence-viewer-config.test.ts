import { describe, expect, it } from 'vitest'

import { resolveSourceEvidenceViewerConfig } from './source-evidence-viewer-config'

describe('resolveSourceEvidenceViewerConfig', () => {
  it('reports the open-source unified viewer in pending-installation state while Flyfish is not installed', () => {
    const config = resolveSourceEvidenceViewerConfig({})
    expect(config).toEqual({
      configured: true,
      provider: 'open-source-unified',
      state: 'pending-installation',
      engine: 'placeholder-pending-flyfish-installation',
      plannedRenderer: 'flyfish-preset-office',
    })
  })

  it('does not regress to a commercial / proprietary provider', () => {
    const config = resolveSourceEvidenceViewerConfig({})
    expect(config.provider).not.toBe('apryse')
    expect(config.provider).not.toBe('proprietary')
    expect(config.provider).not.toBe('commercial')
  })

  it('ignores proprietary viewer license variables — Flyfish is the only planned renderer', () => {
    const config = resolveSourceEvidenceViewerConfig({
      PROPRIETARY_VIEWER_LICENSE: 'secret-key',
    })
    // A commercial license key MUST NOT flip the config to `ready` or to a
    // proprietary provider; the renderer remains pending Flyfish install.
    expect(config).toEqual({
      configured: true,
      provider: 'open-source-unified',
      state: 'pending-installation',
      engine: 'placeholder-pending-flyfish-installation',
      plannedRenderer: 'flyfish-preset-office',
    })
  })

  it('truthfully names Flyfish as the planned renderer so the E2E selector is auditable', () => {
    const config = resolveSourceEvidenceViewerConfig({})
    if (config.state === 'pending-installation') {
      expect(config.plannedRenderer).toBe('flyfish-preset-office')
      expect(config.engine).toBe('placeholder-pending-flyfish-installation')
    } else {
      throw new Error('expected pending-installation state in this sandbox')
    }
  })
})
