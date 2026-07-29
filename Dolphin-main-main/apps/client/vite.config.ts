import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui'
          if (id.includes('@tanstack/react-query') || id.includes('axios')) return 'data'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
            return 'react'
          }
          if (id.includes('socket.io-client')) return 'socket'
        },
      },
    },
  },
})
