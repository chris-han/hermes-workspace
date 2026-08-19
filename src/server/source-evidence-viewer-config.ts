export type SourceEvidenceViewerConfig =
  | {
      configured: true
      provider: 'apryse'
      licenseSource: 'APRYSE_LICENSE_KEY'
    }
  | {
      configured: false
      diagnostic: {
        code: 'viewer_unavailable'
        provider: 'apryse'
        missing: 'APRYSE_LICENSE_KEY'
        message: string
      }
    }

export function resolveSourceEvidenceViewerConfig(
  env: Record<string, string | undefined> = process.env,
): SourceEvidenceViewerConfig {
  const license = env.APRYSE_LICENSE_KEY?.trim()
  if (license) {
    return {
      configured: true,
      provider: 'apryse',
      licenseSource: 'APRYSE_LICENSE_KEY',
    }
  }
  return {
    configured: false,
    diagnostic: {
      code: 'viewer_unavailable',
      provider: 'apryse',
      missing: 'APRYSE_LICENSE_KEY',
      message:
        'Source evidence viewer requires APRYSE_LICENSE_KEY before DOCX/PDF rendering can be enabled.',
    },
  }
}
