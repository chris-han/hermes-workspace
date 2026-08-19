import { describe, expect, it } from 'vitest'

import { resolveSourceEvidenceViewerConfig } from './source-evidence-viewer-config'

describe('resolveSourceEvidenceViewerConfig', () => {
  it('returns a viewer_unavailable diagnostic when Apryse is not configured', () => {
    expect(resolveSourceEvidenceViewerConfig({})).toEqual({
      configured: false,
      diagnostic: {
        code: 'viewer_unavailable',
        provider: 'apryse',
        missing: 'APRYSE_LICENSE_KEY',
        message:
          'Source evidence viewer requires APRYSE_LICENSE_KEY before DOCX/PDF rendering can be enabled.',
      },
    })
  })

  it('reports the configured provider without exposing the license value', () => {
    expect(
      resolveSourceEvidenceViewerConfig({ APRYSE_LICENSE_KEY: 'secret-key' }),
    ).toEqual({
      configured: true,
      provider: 'apryse',
      licenseSource: 'APRYSE_LICENSE_KEY',
    })
  })
})
