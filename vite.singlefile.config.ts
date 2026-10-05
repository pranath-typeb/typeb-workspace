import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds one self-contained index.html (JS + CSS inlined) for sharing as a plain file —
// no dev server, no static host, just double-click it. See src/main.tsx for the
// HashRouter switch this build relies on.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    __STANDALONE__: 'true',
  },
  build: {
    outDir: 'dist-singlefile',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
})
