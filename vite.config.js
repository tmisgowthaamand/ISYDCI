import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    open: false,
    watch: {
      // The Express backend lives in this repo and writes backend/data/members.json on every
      // registration. Without this, Vite full-reloads the page mid-registration and the
      // Flow Simulator loses its chat state.
      ignored: ['**/backend/**', '**/wacto/**', '**/scratch/**', '**/dist/**'],
    },
  },
})
