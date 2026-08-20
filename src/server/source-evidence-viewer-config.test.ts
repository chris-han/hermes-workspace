import { describe, expect, it } from 'vitest'

import { resolveSourceEvidenceViewerConfig } from './source-evidence-viewer-config'

describe('resolveSourceEvidenceViewerConfig', () => {
  it('reports the open-source unified viewer without requiring a license', () => {
    expect(resolveSourceEvidenceViewerConfig({})).toEqual({
      configured: true,
      provider: 'open-source-unified',
      engine: 'pdfjs-canonical-source-ir',
    })
  })

  it('ignores proprietary viewer license variables', () => {
    expect(
      resolveSourceEvidenceViewerConfig({ PROPRIETARY_VIEWER_LICENSE: 'secret-key' }),
    ).toEqual({
      configured: true,
      provider: 'open-source-unified',
      engine: 'pdfjs-canonical-source-ir',
    })
  })
})
