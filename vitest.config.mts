import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Unit and integration tests.
 *
 * Integration tests talk to TEST_DATABASE_URL — a separate database from
 * development — so they can create and delete rows freely. They are skipped
 * automatically when that variable is not set, keeping `npm test` usable on a
 * machine without Postgres.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Server modules under test import this guard; stub it out under Node.
      'server-only': path.resolve(here, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/generated/**', 'src/lib/mail/**'],
    },
  },
})
