/**
 * vite.config.lib.js — library build for @vulos/mail-ui
 *
 * Produces dist-lib/ with ESM + CJS bundles plus a single bundled stylesheet
 * (dist-lib/mail-ui.css). Externalizes react/react-dom so consumers dedupe.
 *
 * Usage: vite build --config vite.config.lib.js
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

const dir = import.meta.dirname

/**
 * Emit the hand-authored TypeScript declarations into dist-lib/.
 *
 * The library is JS/JSX, so its public types are maintained by hand in types/
 * and copied verbatim alongside the bundles. This makes the package's `types`
 * field (./dist-lib/index.d.ts) resolve. emptyOutDir wipes dist-lib on each
 * build, so the copy must run as part of the build (writeBundle), not be
 * committed into dist-lib.
 */
function emitDeclarations() {
  return {
    name: 'vulos-mail-ui:emit-dts',
    writeBundle() {
      for (const name of ['index.d.ts', 'api.d.ts']) {
        copyFileSync(resolve(dir, 'types', name), resolve(dir, 'dist-lib', name))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), emitDeclarations()],
  build: {
    lib: {
      entry: {
        index: resolve(dir, 'src/lib/index.js'),
        api: resolve(dir, 'src/api.js'),
      },
      formats: ['es', 'cjs'],
      cssFileName: 'mail-ui',
      fileName: (format, entryName) =>
        format === 'es' ? `${entryName}.js` : `${entryName}.cjs`,
    },
    outDir: 'dist-lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-dom/client',
      ],
      output: {
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },
      },
    },
  },
})
