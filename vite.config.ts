import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2021',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          store: ['zustand'],
          webllm: ['@mlc-ai/web-llm'],
        },
      },
    },
  },
})
