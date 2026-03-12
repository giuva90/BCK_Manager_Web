import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env from the repository root (one level above frontend/).
  // This lets BCK_WEB_PORT drive the dev-server proxy target — no need to
  // hard-code the port in two places.
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const backendPort = env.BCK_WEB_PORT || '8080'
  const backendUrl = `http://localhost:${backendPort}`
  const backendWsUrl = `ws://localhost:${backendPort}`

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': backendUrl,
        '/api/v1/logs/stream': { target: backendWsUrl, ws: true },
        '/api/v1/terminal': { target: backendWsUrl, ws: true },
        '/api/v1/fleet/agent-ws': { target: backendWsUrl, ws: true },
      },
    },
  }
})
