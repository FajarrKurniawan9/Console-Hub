/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev: forward /api to the Laravel hub so the browser stays on one origin (no CORS).
  server: { proxy: { '/api': process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000' } },
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely; keep it out of the app chunk so it caches well.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    exclude: ['src/**/*.hub.test.ts', 'node_modules/**'],
    env: { VITE_API_URL: '/api/v1' },
  },
})
