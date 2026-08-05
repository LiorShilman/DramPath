/// <reference types="vitest/config" />
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// vite-plugin-pwa auto-injects a <link rel="manifest"> pointing at the
// MAIN app's manifest.webmanifest into every HTML entry it sees, including
// touch.html — which already carries its own correct, manually-written
// <link rel="manifest" href="...touch-manifest.webmanifest"> (see
// touch.html). Two manifest links on one document is undefined behavior
// across browsers, so this strips the wrongly-injected one after the
// plugin has already written its output.
function stripDuplicateTouchManifestLink(): Plugin {
  let outDir = 'dist'
  return {
    name: 'strip-duplicate-touch-manifest-link',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const touchHtmlPath = join(outDir, 'touch.html')
      let html: string
      try {
        html = readFileSync(touchHtmlPath, 'utf-8')
      } catch {
        return
      }
      const cleaned = html.replace(/<link rel="manifest" href="[^"]*\/manifest\.webmanifest">\s*/, '')
      if (cleaned !== html) writeFileSync(touchHtmlPath, cleaned)
    },
  }
}

// Production IIS deployment serves DrumPath from a subpath (see
// server-deployment notes) rather than a domain root, matching the sibling
// apps already hosted under the same IIS site. Overridable via `--base` for
// any deploy that does live at the root (e.g. local `vite preview`).
const base = process.env.VITE_BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  build: {
    rollupOptions: {
      // touch.html is a second, separate HTML entry (not a react-router
      // route) with its own manifest/start_url — see touch-main.tsx's doc
      // comment. Vite only auto-detects index.html as an entry by default;
      // a second HTML file needs to be listed explicitly.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        touch: fileURLToPath(new URL('./touch.html', import.meta.url)),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Manual injection into main.tsx via PwaUpdateBanner (virtual:pwa-register/react),
      // not the plugin's auto-injected script — keeps the update UI inside our own component.
      injectRegister: null,
      manifest: {
        id: base,
        name: 'DrumPath',
        short_name: 'DrumPath',
        description: 'מסלול אימון תופים אישי, מקומי ופרטי',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0b6e75',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
    stripDuplicateTouchManifestLink(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts'],
      // §34.4: "≥80% unit coverage for Domain code" — scoped to src/domain
      // (schemas + pure calculations), not the whole app.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
