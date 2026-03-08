import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/api/v1/logs/stream': { target: 'ws://localhost:8080', ws: true },
      '/api/v1/terminal': { target: 'ws://localhost:8080', ws: true },
      '/api/v1/fleet/agent-ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
})
