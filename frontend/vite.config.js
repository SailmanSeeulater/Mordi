import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The API client uses a same-origin base URL, so on the dev server
    // /api/... has to be forwarded to the local backend. Without this every
    // call 404s and the dashboard shows its error state.
    proxy: {
      // MORDI_API points it elsewhere, for when 8080 is taken by something else.
      '/api': process.env.MORDI_API ?? 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  }
})
