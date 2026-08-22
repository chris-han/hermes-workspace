// SourceEvidenceViewer configuration.
//
// The viewer config is the single source of truth for `data-viewer-provider` /
// `data-viewer-engine` E2E selector values and for runtime diagnostics that
// explain why the Open-Source Source Viewer is or is not mounted.
//
// `state` describes the runtime lifecycle of the renderer dependency:
//
// - `pending-installation`: the Flyfish (`@file-viewer/react` +
//   `@file-viewer/preset-office`) renderer has NOT been installed yet because
//   the W0 dependency pre-flight has not completed. The viewer mounts as a
//   Semantier-owned placeholder that names the truthful planned renderer. No
//   commercial / proprietary / license-key-gated renderer is admitted by this
//   config; the placeholder is the only honest state while W0 is open.
// - `ready`: Flyfish is installed and the renderer is active. `engine` holds
//   the truthful pinned renderer identifier (for example
//   `flyfish-preset-office`).
// - `fallback`: a documented fallback renderer (ONLYOFFICE Community /
//   Collabora CODE / separate PDF.js + DOCX adapters) has been admitted
//   because Flyfish failed a hard W0 fidelity gate. `engine` records the
//   selected fallback identifier.
// - `rejected`: no admissible open-source renderer could be approved. This
//   MUST never regress to a commercial license-key-gated renderer; the
//   planner stops here and reopens the W0 chain.
//
// `provider` stays `'open-source-unified'` for `pending-installation`,
// `ready`, and `fallback`; the only legal alternative is a Semantier-owned
// `canonical-source-ir` provider for IR-only fallback views, never a
// proprietary runtime key-gated provider.
export type SourceEvidenceViewerConfig =
  | {
      configured: true
      provider: 'open-source-unified'
      state: 'pending-installation'
      engine: 'placeholder-pending-flyfish-installation'
      plannedRenderer: 'flyfish-preset-office'
    }
  | {
      configured: true
      provider: 'open-source-unified'
      state: 'ready'
      engine:
        | 'flyfish-preset-office'
        | 'flyfish-pdf-only'
        | 'flyfish-docx-only'
      pinnedVersion: string
    }
  | {
      configured: true
      provider: 'open-source-unified'
      state: 'fallback'
      engine:
        | 'onlyoffice-community-edition'
        | 'collabora-code'
        | 'pdfjs-plus-oss-docx'
      reason: string
    }
  | {
      configured: false
      provider: 'canonical-source-ir'
      state: 'rejected'
      reason: string
    }

export function resolveSourceEvidenceViewerConfig(
  _env: Record<string, string | undefined> = process.env,
): SourceEvidenceViewerConfig {
  // The truthful current state. W0 dependency pre-flight has not completed
  // in this sandbox; the placeholder names Flyfish explicitly so every
  // downstream selector (`data-viewer-provider`, `data-viewer-engine`) is
  // consistent and the plan's W0/W0.5 lifecycle is auditable.
  return {
    configured: true,
    provider: 'open-source-unified',
    state: 'pending-installation',
    engine: 'placeholder-pending-flyfish-installation',
    plannedRenderer: 'flyfish-preset-office',
  }
}
