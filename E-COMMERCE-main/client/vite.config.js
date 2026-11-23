import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend-only Vite configuration. There is no API proxy or backend server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        headers: { origin: 'http://localhost:5173' },
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        headers: { origin: 'http://localhost:5173' },
      },
    },
  },
})
