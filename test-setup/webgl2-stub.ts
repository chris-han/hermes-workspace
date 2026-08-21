/**
 * Provides minimal WebGL/WebGL2RenderingContext stubs so that imports of the
 * `sigma` package (which references these classes at module top level) succeed
 * in jsdom environments. Sigma will never actually render in these tests; the
 * goal is just to let the import graph resolve.
 *
 * This file is referenced from `vitest.config.ts` as a setupFiles entry so it
 * runs before any module evaluation.
 */

declare global {
  interface Window {
    WebGL2RenderingContext?: unknown
    WebGLRenderingContext?: unknown
  }
}

type StubCtor = new () => unknown

function makeStub(): StubCtor {
  function Stub() {}
  return Stub as unknown as StubCtor
}

if (typeof (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext === 'undefined') {
  ;(globalThis as { WebGL2RenderingContext: unknown }).WebGL2RenderingContext = makeStub()
}
if (typeof (globalThis as { WebGLRenderingContext?: unknown }).WebGLRenderingContext === 'undefined') {
  ;(globalThis as { WebGLRenderingContext: unknown }).WebGLRenderingContext = makeStub()
}

export {}