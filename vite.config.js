import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em desenvolvimento, /api é encaminhado ao servidor (npm run server, porta 3001).
const api = process.env.API_URL || 'http://localhost:3001'
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': api } },
})
