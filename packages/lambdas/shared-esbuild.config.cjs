/**
 * Shared esbuild configuration for all Lambda functions
 *
 * Usage in package.json:
 *   "build": "node ../../esbuild.config.js"
 *
 * For lambdas with special needs (like import-anki-deck), extend this config.
 */

const esbuild = require('esbuild')
const path = require('path')

// Determine which lambda we're building based on cwd
const lambdaDir = process.cwd()
const lambdaName = path.basename(lambdaDir)

// Standard build configuration for all lambdas
const standardConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outdir: 'dist',
  sourcemap: true,
  external: ['@aws-sdk/*'],
}

// Special configurations for specific lambdas
const specialConfigs = {
  'ws-authorizer': {
    ...standardConfig,
    format: 'cjs', // WebSocket authorizer needs CommonJS
  },
  'hello': {
    ...standardConfig,
    external: [], // hello lambda doesn't use AWS SDK
  },
  'import-anki-deck': {
    ...standardConfig,
    // Note: Still needs post-build step to copy sql-wasm.wasm
  },
}

// Get config for current lambda
const config = specialConfigs[lambdaName] || standardConfig

// Build
esbuild.build(config).catch(() => process.exit(1))
