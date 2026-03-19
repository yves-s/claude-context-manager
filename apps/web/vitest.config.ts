// apps/web/vitest.config.ts
import { defineConfig, Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Strip 'use server' / 'use client' directives so Vitest doesn't trigger
// Next.js SWC transforms that load heavy Next.js internals.
function stripNextDirectives(): Plugin {
  return {
    name: 'strip-next-directives',
    transform(code, id) {
      if (id.includes('node_modules')) return
      return code.replace(/^['"]use (server|client)['"]\s*;?\s*/m, '')
    },
  }
}

export default defineConfig({
  plugins: [stripNextDirectives(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
