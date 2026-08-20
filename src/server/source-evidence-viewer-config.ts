export type SourceEvidenceViewerConfig =
  {
    configured: true
    provider: 'open-source-unified'
    engine: 'pdfjs-canonical-source-ir'
  }

export function resolveSourceEvidenceViewerConfig(
  _env: Record<string, string | undefined> = process.env,
): SourceEvidenceViewerConfig {
  return {
    configured: true,
    provider: 'open-source-unified',
    engine: 'pdfjs-canonical-source-ir',
  }
}
