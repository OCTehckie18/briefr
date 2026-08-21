import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Vite's dev server natively serves index.html for all navigation requests,
    // so React Router handles client-side routing without extra config.
    // (historyApiFallback is a webpack-dev-server option and is not needed here)
  },
})
