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
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  }
})
