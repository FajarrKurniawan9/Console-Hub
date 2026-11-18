/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely; keep it out of the app chunk so it caches well.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner)/ },
            // Mock layer is loaded lazily and only when VITE_USE_MOCKS=true.
            { name: 'mocks', test: /node_modules[\\/](msw|@mswjs|@bundled-es-modules|rettime|graphql|headers-polyfill|outvariant|strict-event-emitter|path-to-regexp|cookie|tough-cookie)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './mocks/vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'mocks/**/*.test.{ts,tsx}'],
    env: { VITE_API_URL: '/api/v1', VITE_USE_MOCKS: 'true' },
  },
})
