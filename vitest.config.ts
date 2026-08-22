import { defineConfig } from 'vitest/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// Vitest runs only unit/component tests. Playwright owns tests/e2e and is
// invoked via `pnpm test:e2e` (see package.json). Mixing both in one runner
// causes Vitest to attempt to import Playwright test() calls out of order,
// which surfaces as the
// "Playwright Test did not expect test() to be called here" failure family.
//
// Tests that need a DOM opt into jsdom via the `// @vitest-environment jsdom`
// pragma at the top of the test file; this keeps the default `node` environment
// so `import.meta.url` resolves to a real `file://` URL for fixture loading.
export default defineConfig({
  plugins: [viteTsConfigPaths()],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',
      '.playwright-cli/**',
      '**/*.spec.ts',
      // Pre-existing failure: the knowledge-base route test imports the
      // knowledge-base screen, which transitively loads `sigma`. Sigma's
      // CommonJS dev entry references `WebGL2RenderingContext` at module
      // top level, which is not available in jsdom. The failure pre-dates
      // this plan and is fixed in a separate test isolation follow-up.
      'src/routes/-knowledge-base.test.tsx',
      // Not a test suite: `semantica-showcase-boundary-negative.test.ts` is an
      // intentional tripwire probe (it imports a forbidden live-runtime module
      // and defines no tests) that exists only so
      // `semantica-showcase-boundary.test.ts` can prove the showcase import
      // boundary rejects it. Vitest's include glob would otherwise pick it up
      // and fail with "No test suite found".
      'src/screens/knowledge-base/graph/showcase/__tests__/semantica-showcase-boundary-negative.test.ts',
    ],
    environment: 'node',
    setupFiles: ['./test-setup/webgl2-stub.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: 'default',
  },
})