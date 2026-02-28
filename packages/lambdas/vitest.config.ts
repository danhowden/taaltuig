import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.*',
        '**/shared-esbuild.config.cjs',
        '**/eslint.config.js',
      ],
      include: ['src/**/*.ts'],
      all: true,
      thresholds: {
        lines: 88,
        functions: 88,
        branches: 88,
        statements: 88,
      },
    },
  },
})
